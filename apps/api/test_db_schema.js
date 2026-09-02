/**
 * Database Schema Tests — Phase 1
 * 
 * Validates SQLite schema creation and basic constraints.
 * Does NOT test business logic; only validates schema structure.
 * 
 * Run: node test_db_schema.js
 */

import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { initializeDatabase, getDb, closeDatabase } from './src/db/client.js';
import { BusinessEntity, ProviderIdentity, ResolutionRecord } from './src/db/schema.js';

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
 * DATABASE INITIALIZATION
 * ================================================================== */
console.log('\n[1] Database Initialization');

let db = null;

await checkAsync('Initialize SQLite database', async () => {
  db = await initializeDatabase('./test_webloom.db');
  assert.ok(db, 'Database instance should be returned');
});

/* ================================================================== *
 * TABLE CREATION
 * ================================================================== */
console.log('\n[2] Table Creation');

check('BusinessEntity table exists', () => {
  assert.ok(BusinessEntity, 'BusinessEntity table should exist');
  assert.ok(BusinessEntity.entityId, 'entityId column should exist');
  assert.ok(BusinessEntity.canonicalName, 'canonicalName column should exist');
  assert.ok(BusinessEntity.status, 'status column should exist');
});

check('ProviderIdentity table exists', () => {
  assert.ok(ProviderIdentity, 'ProviderIdentity table should exist');
  assert.ok(ProviderIdentity.id, 'id column should exist');
  assert.ok(ProviderIdentity.entityId, 'entityId column should exist');
  assert.ok(ProviderIdentity.provider, 'provider column should exist');
  assert.ok(ProviderIdentity.providerRecordId, 'providerRecordId column should exist');
});

check('ResolutionRecord table exists', () => {
  assert.ok(ResolutionRecord, 'ResolutionRecord table should exist');
  assert.ok(ResolutionRecord.id, 'id column should exist');
  assert.ok(ResolutionRecord.entityId, 'entityId column should exist');
  assert.ok(ResolutionRecord.matchScore, 'matchScore column should exist');
  assert.ok(ResolutionRecord.matchType, 'matchType column should exist');
});

/* ================================================================== *
 * BASIC CRUD OPERATIONS
 * ================================================================== */
console.log('\n[3] Basic CRUD Operations');

let testEntityId = null;

await checkAsync('Create BusinessEntity', async () => {
  testEntityId = `ent_test_${Date.now()}`;
  const result = await db.insert(BusinessEntity).values({
    entityId: testEntityId,
    canonicalName: 'Test Coffee',
    canonicalPhone: '+1-555-0100',
    canonicalWebsite: 'https://testcoffee.example.com',
    canonicalAddress: '123 Test St, Testville, CA 90210',
    canonicalLatitude: 37.7749,
    canonicalLongitude: -122.4194,
    category: 'Cafe',
    status: 'ACTIVE',
  }).returning();
  
  assert.ok(result.length === 1, 'Insert should return 1 row');
  assert.strictEqual(result[0].entityId, testEntityId);
  assert.strictEqual(result[0].canonicalName, 'Test Coffee');
  assert.strictEqual(result[0].status, 'ACTIVE');
});

await checkAsync('Create ProviderIdentity', async () => {
  const providerId = `pid_test_${Date.now()}`;
  const result = await db.insert(ProviderIdentity).values({
    id: providerId,
    entityId: testEntityId,
    provider: 'geoapify',
    providerRecordId: 'ChIJ_test_place_id_123',
    resolutionMethod: 'first_observation',
    resolutionConfidence: 0.95,
  }).returning();
  
  assert.ok(result.length === 1, 'Insert should return 1 row');
  assert.strictEqual(result[0].entityId, testEntityId);
  assert.strictEqual(result[0].provider, 'geoapify');
  assert.strictEqual(result[0].providerRecordId, 'ChIJ_test_place_id_123');
});

await checkAsync('Create ResolutionRecord', async () => {
  const resolutionId = `res_test_${Date.now()}`;
  const result = await db.insert(ResolutionRecord).values({
    id: resolutionId,
    entityId: testEntityId,
    matchScore: 0.92,
    matchType: 'same_entity',
    providerA: 'geoapify',
    providerRecordIdA: 'ChIJ_test_place_id_123',
    providerB: 'web_extraction',
    providerRecordIdB: null,
    status: 'confirmed',
    confidence: 0.88,
  }).returning();
  
  assert.ok(result.length === 1, 'Insert should return 1 row');
  assert.strictEqual(result[0].entityId, testEntityId);
  assert.strictEqual(result[0].matchType, 'same_entity');
  assert.strictEqual(result[0].matchScore, 0.92);
});

/* ================================================================== *
 * CONSTRAINT VALIDATION
 * ================================================================== */
console.log('\n[4] Constraint Validation');

await checkAsync('Unique constraint on ProviderIdentity(provider, providerRecordId)', async () => {
  const duplicateId = `pid_dup_${Date.now()}`;
  
  // First insert should succeed
  await db.insert(ProviderIdentity).values({
    id: duplicateId,
    entityId: testEntityId,
    provider: 'web_extraction',
    providerRecordId: 'duplicate_test_record',
    resolutionMethod: 'first_observation',
    resolutionConfidence: 0.80,
  });
  
  // Second insert with same (provider, providerRecordId) should fail
  await assert.rejects(async () => {
    await db.insert(ProviderIdentity).values({
      id: `${duplicateId}_dup`,
      entityId: testEntityId,
      provider: 'web_extraction',
      providerRecordId: 'duplicate_test_record',
      resolutionMethod: 'first_observation',
      resolutionConfidence: 0.80,
    });
  }, /UNIQUE constraint failed/, 'Duplicate should fail with UNIQUE constraint');
});

await checkAsync('Foreign key constraint on ProviderIdentity.entityId', async () => {
  const fakeEntityId = 'ent_nonexistent_999';
  
  await assert.rejects(async () => {
    await db.insert(ProviderIdentity).values({
      id: `pid_fake_${Date.now()}`,
      entityId: fakeEntityId,
      provider: 'test',
      providerRecordId: 'test_record',
      resolutionMethod: 'first_observation',
    });
  }, /FOREIGN KEY constraint failed/, 'Invalid entityId should fail with FOREIGN KEY constraint');
});

/* ================================================================== *
 * QUERY OPERATIONS
 * ================================================================== */
console.log('\n[5] Query Operations');

await checkAsync('Query BusinessEntity by entityId', async () => {
  const result = await db.select().from(BusinessEntity).where(
    eq(BusinessEntity.entityId, testEntityId)
  );
  
  assert.ok(result.length === 1, 'Should find 1 entity');
  assert.strictEqual(result[0].canonicalName, 'Test Coffee');
  assert.strictEqual(result[0].status, 'ACTIVE');
});

await checkAsync('Query ProviderIdentity by entityId', async () => {
  const result = await db.select().from(ProviderIdentity).where(
    eq(ProviderIdentity.entityId, testEntityId)
  );
  
  assert.ok(result.length >= 2, 'Should find at least 2 provider identities');
});

await checkAsync('Query ResolutionRecord by entityId', async () => {
  const result = await db.select().from(ResolutionRecord).where(
    eq(ResolutionRecord.entityId, testEntityId)
  );
  
  assert.ok(result.length === 1, 'Should find 1 resolution record');
  assert.strictEqual(result[0].matchType, 'same_entity');
});

/* ================================================================== *
 * CLEANUP
 * ================================================================== */
console.log('\n[6] Cleanup');

await checkAsync('Delete test data and close database', async () => {
  // Delete in reverse order of foreign keys
  await db.delete(ResolutionRecord).where(eq(ResolutionRecord.entityId, testEntityId));
  await db.delete(ProviderIdentity).where(eq(ProviderIdentity.entityId, testEntityId));
  await db.delete(BusinessEntity).where(eq(BusinessEntity.entityId, testEntityId));
  
  // Verify deletion
  const remaining = await db.select().from(BusinessEntity).where(
    eq(BusinessEntity.entityId, testEntityId)
  );
  assert.strictEqual(remaining.length, 0, 'Entity should be deleted');
  
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

console.log('\n✓ All schema tests passed');
process.exit(0);
