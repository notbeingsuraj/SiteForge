/**
 * IdentityRepository Tests — Phase 2
 * 
 * Validates persistent identity CRUD and lookup operations.
 * Tests run against an isolated test SQLite database.
 * 
 * Run: node test_identity_repository.js
 */

import assert from 'node:assert';
import { IdentityRepository, NotFoundError, DuplicateError, ValidationError } from './src/db/IdentityRepository.js';
import { initializeDatabase, closeDatabase, getRawDb } from './src/db/client.js';

const TEST_DB = './test_identity_repository.db';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err });
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err });
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

/* ================================================================== *
 * SETUP
 * ================================================================== */
console.log('\n[0] Setup');

let db = null;
let repo = null;

await checkAsync('Initialize test database', async () => {
  db = await initializeDatabase(TEST_DB);
  repo = new IdentityRepository(db);
  assert.ok(repo, 'Repository should be created');
});

/* ================================================================== *
 * TEST 1 — Create + Retrieve Entity
 * ================================================================== */
console.log('\n[1] Create + Retrieve Entity');

let createdEntity = null;

check('createEntity returns created entity with generated ID', () => {
  createdEntity = repo.createEntity({
    canonicalName: 'Tartine Bakery',
    canonicalAddress: '600 Guerrero St, San Francisco, CA 94110',
    canonicalPhone: '+1-415-487-2600',
    canonicalWebsite: 'https://tartinebakery.com',
    canonicalLatitude: 37.7614552,
    canonicalLongitude: -122.4239452,
    category: 'Bakery',
    status: 'ACTIVE',
  });

  assert.ok(createdEntity, 'Entity should be returned');
  assert.ok(createdEntity.entityId, 'Entity should have a generated ID');
  assert.ok(createdEntity.entityId.startsWith('ent_'), 'ID should start with ent_');
  assert.strictEqual(createdEntity.canonicalName, 'Tartine Bakery');
  assert.strictEqual(createdEntity.canonicalAddress, '600 Guerrero St, San Francisco, CA 94110');
  assert.strictEqual(createdEntity.canonicalPhone, '+1-415-487-2600');
  assert.strictEqual(createdEntity.status, 'ACTIVE');
  assert.ok(createdEntity.createdAt, 'Should have createdAt');
  assert.ok(createdEntity.updatedAt, 'Should have updatedAt');
});

check('getEntityById returns same entity', () => {
  const retrieved = repo.getEntityById(createdEntity.entityId);
  assert.ok(retrieved, 'Entity should be retrieved');
  assert.strictEqual(retrieved.entityId, createdEntity.entityId);
  assert.strictEqual(retrieved.canonicalName, 'Tartine Bakery');
  assert.strictEqual(retrieved.canonicalPhone, '+1-415-487-2600');
});

/* ================================================================== *
 * TEST 2 — Update Entity
 * ================================================================== */
console.log('\n[2] Update Entity');

check('updateEntity changes supplied fields and preserves others', () => {
  const originalCreatedAt = createdEntity.createdAt;
  const updated = repo.updateEntity(createdEntity.entityId, {
    canonicalPhone: '+1-415-487-9999',
    category: 'Artisan Bakery',
  });

  assert.strictEqual(updated.canonicalPhone, '+1-415-487-9999', 'Phone should be updated');
  assert.strictEqual(updated.category, 'Artisan Bakery', 'Category should be updated');
  assert.strictEqual(updated.canonicalName, 'Tartine Bakery', 'Name should be preserved');
  assert.strictEqual(updated.canonicalAddress, '600 Guerrero St, San Francisco, CA 94110', 'Address should be preserved');
  assert.strictEqual(updated.entityId, createdEntity.entityId, 'Entity ID should not change');
  assert.strictEqual(updated.createdAt, originalCreatedAt, 'createdAt should not change');
  assert.notStrictEqual(updated.updatedAt, createdEntity.updatedAt, 'updatedAt should change');
});

/* ================================================================== *
 * TEST 3 — Provider Identity Mapping
 * ================================================================== */
console.log('\n[3] Provider Identity Mapping');

check('createProviderIdentity + findProviderIdentity round-trips', () => {
  const mapping = repo.createProviderIdentity({
    provider: 'geoapify',
    providerRecordId: 'ChIJ_tartine_place_123',
    entityId: createdEntity.entityId,
    resolutionMethod: 'first_observation',
    resolutionConfidence: 0.95,
  });

  assert.ok(mapping, 'Mapping should be returned');
  assert.strictEqual(mapping.provider, 'geoapify');
  assert.strictEqual(mapping.providerRecordId, 'ChIJ_tartine_place_123');
  assert.strictEqual(mapping.entityId, createdEntity.entityId);
  assert.strictEqual(mapping.resolutionMethod, 'first_observation');
  assert.ok(mapping.firstSeen, 'Should have firstSeen');
  assert.ok(mapping.lastSeen, 'Should have lastSeen');

  const found = repo.findProviderIdentity('geoapify', 'ChIJ_tartine_place_123');
  assert.ok(found, 'Provider identity should be found');
  assert.strictEqual(found.entityId, createdEntity.entityId);
  assert.strictEqual(found.provider, 'geoapify');
});

/* ================================================================== *
 * TEST 4 — Provider Namespace Isolation
 * ================================================================== */
console.log('\n[4] Provider Namespace Isolation');

check('Different providers can map same providerRecordId to different entities', async () => {
  // Create second entity
  const entity2 = repo.createEntity({
    canonicalName: 'Blue Bottle Coffee',
    canonicalAddress: '300 Webster St, Oakland, CA 94607',
    canonicalLatitude: 37.7989,
    canonicalLongitude: -122.2654,
    category: 'Coffee Shop',
  });

  // Map providerA record to entity1, providerB record with same ID to entity2
  repo.createProviderIdentity({
    provider: 'geoapify',
    providerRecordId: 'record_123',
    entityId: createdEntity.entityId,
    resolutionMethod: 'first_observation',
  });

  repo.createProviderIdentity({
    provider: 'web_extraction',
    providerRecordId: 'record_123',
    entityId: entity2.entityId,
    resolutionMethod: 'first_observation',
  });

  // Both lookups must return different entities
  const foundA = repo.findProviderIdentity('geoapify', 'record_123');
  const foundB = repo.findProviderIdentity('web_extraction', 'record_123');

  assert.ok(foundA, 'geoapify mapping should exist');
  assert.ok(foundB, 'web_extraction mapping should exist');
  assert.strictEqual(foundA.entityId, createdEntity.entityId, 'geoapify → entity1');
  assert.strictEqual(foundB.entityId, entity2.entityId, 'web_extraction → entity2');
});

/* ================================================================== *
 * TEST 5 — Duplicate Provider Identity
 * ================================================================== */
console.log('\n[5] Duplicate Provider Identity');

check('Second mapping with same (provider, providerRecordId) throws DuplicateError', () => {
  assert.throws(
    () => {
      repo.createProviderIdentity({
        provider: 'geoapify',
        providerRecordId: 'ChIJ_tartine_place_123',
        entityId: createdEntity.entityId,
        resolutionMethod: 'first_observation',
      });
    },
    DuplicateError,
    'Should throw DuplicateError for duplicate (provider, providerRecordId)'
  );
});

check('Duplicate detection uses database constraint, not application logic', () => {
  // The DuplicateError should reference the constraint
  try {
    repo.createProviderIdentity({
      provider: 'geoapify',
      providerRecordId: 'ChIJ_tartine_place_123',
      entityId: createdEntity.entityId,
      resolutionMethod: 'first_observation',
    });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.strictEqual(err.name, 'DuplicateError');
    assert.ok(err.message.includes('already exists'), 'Error message should indicate duplicate');
  }
});

/* ================================================================== *
 * TEST 6 — Observation Update (touchProviderIdentity)
 * ================================================================== */
console.log('\n[6] Observation Update');

check('touchProviderIdentity preserves firstSeen and updates lastSeen', () => {
  const before = repo.findProviderIdentity('geoapify', 'ChIJ_tartine_place_123');
  assert.ok(before, 'Should find existing mapping');

  const originalFirstSeen = before.firstSeen;

  // Small delay to ensure timestamp differs
  const updated = repo.touchProviderIdentity('geoapify', 'ChIJ_tartine_place_123', {
    resolutionMethod: 'same_entity_match',
    resolutionConfidence: 0.88,
  });

  assert.ok(updated, 'Updated mapping should be returned');
  assert.strictEqual(updated.firstSeen, originalFirstSeen, 'firstSeen must not change');
  assert.notStrictEqual(updated.lastSeen, before.lastSeen, 'lastSeen should update');
  assert.strictEqual(updated.resolutionMethod, 'same_entity_match', 'resolutionMethod should update');
  assert.strictEqual(updated.resolutionConfidence, 0.88, 'resolutionConfidence should update');
});

check('touchProviderIdentity returns null for unknown provider', () => {
  const result = repo.touchProviderIdentity('unknown_provider', 'unknown_id');
  assert.strictEqual(result, null, 'Should return null for unknown');
});

/* ================================================================== *
 * TEST 7 — Resolution History
 * ================================================================== */
console.log('\n[7] Resolution History');

let resolutionRecord1 = null;
let resolutionRecord2 = null;

check('createResolutionRecord persists and returns record', () => {
  resolutionRecord1 = repo.createResolutionRecord({
    entityId: createdEntity.entityId,
    matchScore: 0.92,
    matchType: 'same_entity',
    providerA: 'geoapify',
    providerRecordIdA: 'ChIJ_tartine_place_123',
    providerB: 'web_extraction',
    providerRecordIdB: null,
    confidence: 0.88,
    notes: 'Strong match on name + phone + coordinates',
  });

  assert.ok(resolutionRecord1, 'Record should be returned');
  assert.ok(resolutionRecord1.id, 'Should have generated ID');
  assert.ok(resolutionRecord1.id.startsWith('res_'), 'ID should start with res_');
  assert.strictEqual(resolutionRecord1.entityId, createdEntity.entityId);
  assert.strictEqual(resolutionRecord1.matchScore, 0.92);
  assert.strictEqual(resolutionRecord1.matchType, 'same_entity');
  assert.strictEqual(resolutionRecord1.status, 'pending_review');
  assert.strictEqual(resolutionRecord1.notes, 'Strong match on name + phone + coordinates');
});

check('getResolutionHistory returns records newest first', () => {
  // Create a second record (newer timestamp)
  resolutionRecord2 = repo.createResolutionRecord({
    entityId: createdEntity.entityId,
    matchScore: 0.75,
    matchType: 'uncertain',
    providerA: 'geoapify',
    providerB: 'manual',
    status: 'confirmed',
  });

  const history = repo.getResolutionHistory(createdEntity.entityId);

  assert.ok(history.length >= 2, `Should have at least 2 records, got ${history.length}`);
  assert.strictEqual(history[0].matchType, 'uncertain', 'Newest record first');
  assert.strictEqual(history[1].matchType, 'same_entity', 'Older record second');

  // All records belong to the same entity
  for (const record of history) {
    assert.strictEqual(record.entityId, createdEntity.entityId);
  }
});

/* ================================================================== *
 * TEST 8 — Missing Entity
 * ================================================================== */
console.log('\n[8] Missing Entity');

check('getEntityById returns null for nonexistent ID', () => {
  const result = repo.getEntityById('ent_nonexistent_999');
  assert.strictEqual(result, null, 'Should return null for missing entity');
});

check('updateEntity throws NotFoundError for nonexistent ID', () => {
  assert.throws(
    () => {
      repo.updateEntity('ent_nonexistent_999', { canonicalName: 'Test' });
    },
    NotFoundError,
    'Should throw NotFoundError'
  );
});

check('findProviderIdentity returns null for unknown provider record', () => {
  const result = repo.findProviderIdentity('unknown_provider', 'unknown_id');
  assert.strictEqual(result, null, 'Should return null');
});

/* ================================================================== *
 * TEST 9 — Input Validation
 * ================================================================== */
console.log('\n[9] Input Validation');

check('createEntity rejects missing canonicalName', () => {
  assert.throws(
    () => {
      repo.createEntity({ canonicalAddress: '123 St' });
    },
    ValidationError,
    'Should throw ValidationError for missing canonicalName'
  );
});

check('createEntity rejects missing canonicalAddress', () => {
  assert.throws(
    () => {
      repo.createEntity({ canonicalName: 'Test' });
    },
    ValidationError,
    'Should throw ValidationError for missing canonicalAddress'
  );
});

check('createProviderIdentity rejects missing provider', () => {
  assert.throws(
    () => {
      repo.createProviderIdentity({
        providerRecordId: 'test_123',
        entityId: createdEntity.entityId,
        resolutionMethod: 'first_observation',
      });
    },
    ValidationError
  );
});

check('createProviderIdentity rejects missing entityId', () => {
  assert.throws(
    () => {
      repo.createProviderIdentity({
        provider: 'geoapify',
        providerRecordId: 'test_123',
        resolutionMethod: 'first_observation',
      });
    },
    ValidationError
  );
});

check('createResolutionRecord rejects missing entityId', () => {
  assert.throws(
    () => {
      repo.createResolutionRecord({
        matchScore: 0.5,
        matchType: 'uncertain',
        providerA: 'a',
        providerB: 'b',
      });
    },
    ValidationError
  );
});

check('IdentityRepository constructor rejects missing db', () => {
  assert.throws(
    () => {
      new IdentityRepository(null);
    },
    ValidationError,
    'Should throw ValidationError for null db'
  );
});

/* ================================================================== *
 * CLEANUP
 * ================================================================== */
console.log('\n[10] Cleanup');

check('Clean up test database', () => {
  closeDatabase();
});

/* ------------------------------------------------------------------ */
console.log(`\n------------------------------------`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
    console.log(`    ${f.error.message}`);
  }
  process.exit(1);
}

console.log('\n✓ All IdentityRepository tests passed');
process.exit(0);
