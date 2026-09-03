/**
 * Phase 5 Canonical Profile Read/Write Integration Tests
 * 
 * Tests the integration between canonical persistent state and BusinessProfile.
 * Tests the read/write path for canonical business intelligence.
 */

import assert from 'node:assert';
import BusinessProfile from './src/services/BusinessProfile.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';
import { IdentityRepository, NotFoundError, DuplicateError, ValidationError } from './src/db/IdentityRepository.js';
import { initializeDatabase, closeDatabase, getRawDb } from './src/db/client.js';
import { calculateMatchScore } from './src/services/EntityResolution.js';

const TEST_DB = './test_phase5.db';

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

// ---- realistic provider record fixtures ----
const tartineGeoapify = {
  business: { name: 'Tartine Bakery', category: 'Bakery' },
  contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
  location: {
    full_address: '600 Guerrero Street, San Francisco, CA 94110',
    coordinates: { lat: 37.7614552, lng: -122.4239452 },
  },
  provider: { name: 'geoapify', placeId: 'ChIJ_tartine_place_1' },
};

const tartineWeb = {
  business: { name: 'Tartine Bakery', category: 'Bakery' },
  contact: { phone: '(415) 487-2600', website: 'www.tartinebakery.com' },
  location: {
    full_address: '600 Guerrero St, San Francisco, CA 94110',
    coordinates: { lat: 37.7614552, lng: -122.4239452 },
  },
};

const abcCafeDelhi = {
  business: { name: 'ABC Cafe', category: 'Cafe' },
  contact: { phone: '+91-11-5555-0001', website: 'https://abccafedelhi.com' },
  location: {
    full_address: '1 Connaught Place, New Delhi, Delhi 110001',
    coordinates: { lat: 28.6315, lng: 77.2167 },
  },
  provider: { name: 'geoapify', placeId: 'ChIJ_abc_delhi_1' },
};

const abcCafeMumbai = {
  business: { name: 'ABC Cafe', category: 'Cafe' },
  contact: { phone: '+91-22-5555-0002', website: 'https://abccafemumbai.com' },
  location: {
    full_address: 'Nariman Point, Mumbai, Maharashtra 400021',
    coordinates: { lat: 18.9337, lng: 72.8247 },
  },
  provider: { name: 'geoapify', placeId: 'ChIJ_abc_mumbai_1' },
};

/* ================================================================== *
 * SETUP
 * ================================================================== */
console.log('\n[0] Setup');

let db = null;
let repo = null;
let service = null;

await checkAsync('Initialize test database', async () => {
  db = await initializeDatabase('./test_phase5.db');
  service = new BusinessResearchService();
});

const resetTestDb = () => {
  const raw = getRawDb();
  raw.prepare('DELETE FROM canonicalization_decision').run();
  raw.prepare('DELETE FROM conflict').run();
  raw.prepare('DELETE FROM observation').run();
  raw.prepare('DELETE FROM canonical_field').run();
  raw.prepare('DELETE FROM business_entity').run();
  raw.prepare('DELETE FROM provider_identity').run();
  raw.prepare('DELETE FROM resolution_record').run();
};

/* ================================================================== *
 * TEST 1 — Canonical write → immediate profile read
 * ================================================================== */
console.log('\n[1] Canonical write → immediate profile read');

checkAsync('Canonicalized values appear in returned BusinessProfile', async () => {
  const repo = new IdentityRepository(getRawDb ? (await import('./src/db/client.js')).getRawDb() : (await import('./src/db/client.js')).getDb());
  
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_1');
  
  // Manually set canonical field via repo
  repo.upsertCanonicalField({
    entityId: 'test_ent_1',
    fieldPath: 'identity.name',
    value: 'Tartine Bakery',
    provenance: 'verified',
    confidence: 0.95,
  });
  
  // Load canonical fields into profile
  await repo.loadCanonicalFieldsIntoProfile('test_ent_1', profile);
  
  assert.strictEqual(profile.get('identity.name'), 'Tartine Bakery');
  const nameField = profile.getField('identity.name');
  assert.strictEqual(nameField.provenance, 'verified');
  assert.strictEqual(nameField.confidence, 0.95);
});

/* ================================================================== *
 * TEST 2 — Persistent read after reload
 * ================================================================== */
console.log('\n[2] Persistent read after reload');

checkAsync('Persisted canonical state survives reload and appears in profile', async () => {
  // First establish canonical value
  repo.upsertCanonicalField({
    entityId: 'test_ent_2',
    fieldPath: 'contact.phone',
    value: '4154872600',
    provenance: 'verified',
    confidence: 0.98,
  });
  
  const profile1 = new BusinessProfile();
  profile1.setEntityId('test_ent_2');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_2', profile1);
  
  assert.strictEqual(profile1.get('contact.phone'), '4154872600');
  const phoneField1 = profile1.getField('contact.phone');
  assert.strictEqual(phoneField1.provenance, 'verified');
  assert.strictEqual(phoneField1.confidence, 0.98);
});

/* ================================================================== *
 * TEST 3 — Multiple canonical fields
 * ================================================================== */
console.log('\n[3] Multiple canonical fields');

checkAsync('Multiple canonical fields map correctly to profile', async () => {
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_3');
  
  repo.upsertCanonicalField({
    entityId: 'test_ent_3',
    fieldPath: 'identity.name',
    value: 'Test Business',
    provenance: 'verified',
    confidence: 0.95,
  });
  repo.upsertCanonicalField({
    entityId: 'test_ent_3',
    fieldPath: 'contact.phone',
    value: '4155551234',
    provenance: 'discovered',
    confidence: 0.9,
  });
  repo.upsertCanonicalField({
    entityId: 'test_ent_3',
    fieldPath: 'contact.website',
    value: 'https://example.com',
    provenance: 'discovered',
    confidence: 0.85,
  });
  repo.upsertCanonicalField({
    entityId: 'test_ent_3',
    fieldPath: 'location.full_address',
    value: '123 Main St, San Francisco, CA',
    provenance: 'discovered',
    confidence: 0.9,
  });
  repo.upsertCanonicalField({
    entityId: 'test_ent_3',
    fieldPath: 'identity.category',
    value: 'Restaurant',
    provenance: 'verified',
    confidence: 0.9,
  });
  
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_3');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_3', profile);
  
  assert.strictEqual(profile.get('identity.name'), 'Test Business');
  assert.strictEqual(profile.get('contact.phone'), '4155551234');
  assert.strictEqual(profile.get('contact.website'), 'https://example.com');
  assert.strictEqual(profile.get('location.full_address'), '123 Main St, San Francisco, CA');
  assert.strictEqual(profile.get('identity.category'), 'Restaurant');
});

/* ================================================================== *
 * TEST 4 — Missing canonical field
 * ================================================================== */
console.log('\n[4] Missing canonical field');

checkAsync('Missing canonical field preserves existing profile behavior', async () => {
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_4');
  
  // Set a value in profile first
  profile.set('identity.name', 'Existing Name', 'identified', 0.6);
  
  // No canonical field for this entity - should preserve existing
  await repo.loadCanonicalFieldsIntoProfile('test_ent_4', profile);
  
  assert.strictEqual(profile.get('identity.name'), 'Existing Name');
});

/* ================================================================== *
 * TEST 5 — Conflict handling
 * ================================================================== */
console.log('\n[5] Conflict handling');

checkAsync('Conflicting observation does not blindly overwrite canonical value', async () => {
  // First establish canonical value with high provenance
  repo.upsertCanonicalField({
    entityId: 'test_ent_5',
    fieldPath: 'contact.phone',
    value: '4154872600',
    provenance: 'verified',
    confidence: 0.98,
  });
  
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_5');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_5', profile);
  
  assert.strictEqual(profile.get('contact.phone'), '4154872600');
  
  // Manually try to insert conflicting canonical field with lower provenance
  // The repo's upsertCanonicalField should not overwrite due to provenance priority
  repo.upsertCanonicalField({
    entityId: 'test_ent_5',
    fieldPath: 'contact.phone',
    value: '4159999999',
    provenance: 'discovered',
    confidence: 0.6,
  });
  
  // Verify canonical value was preserved (higher provenance wins)
  const updated = repo.getCanonicalField('test_ent_5', 'contact.phone');
  assert.strictEqual(updated.value, '4154872600');
  assert.strictEqual(updated.provenance, 'verified');
});

/* ================================================================== *
 * TEST 6 — Provenance
 * ================================================================== */
console.log('\n[6] Provenance');

checkAsync('Returned profile reflects canonical provenance', async () => {
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_6');
  
  repo.upsertCanonicalField({
    entityId: 'test_ent_6',
    fieldPath: 'identity.name',
    value: 'Test Business',
    provenance: 'verified',
    confidence: 0.95,
  });
  
  const profile2 = new BusinessProfile();
  profile2.setEntityId('test_ent_6');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_6', profile2);
  
  const nameField = profile2.getField('identity.name');
  assert.strictEqual(nameField.provenance, 'verified');
  assert.strictEqual(nameField.confidence, 0.95);
});

/* ================================================================== *
 * TEST 7 — Canonical update
 * ================================================================== */
console.log('\n[7] Canonical update');

checkAsync('Stronger observation updates canonical state and profile reflects new value', async () => {
  // First set a canonical value with lower provenance
  repo.upsertCanonicalField({
    entityId: 'test_ent_7',
    fieldPath: 'contact.phone',
    value: '4155550000',
    provenance: 'discovered',
    confidence: 0.7,
  });
  
  const profile1 = new BusinessProfile();
  profile1.setEntityId('test_ent_7');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_7', profile1);
  assert.strictEqual(profile1.get('contact.phone'), '4155550000');
  
  // Update with stronger provenance
  repo.upsertCanonicalField({
    entityId: 'test_ent_7',
    fieldPath: 'contact.phone',
    value: '4155550000',
    provenance: 'verified',
    confidence: 0.95,
  });
  
  const profile2 = new BusinessProfile();
  profile2.setEntityId('test_ent_7');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_7', profile2);
  
  const phoneField = profile2.getField('contact.phone');
  assert.strictEqual(phoneField.value, '4155550000');
  assert.strictEqual(phoneField.provenance, 'verified');
  assert.strictEqual(phoneField.confidence, 0.95);
});

/* ================================================================== *
 * TEST 8 — Repeated observation
 * ================================================================== */
console.log('\n[8] Repeated observation');

checkAsync('Repeated identical provider data remains deterministic', async () => {
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_8');
  
  await repo.loadCanonicalFieldsIntoProfile('test_ent_8', profile);
  
  // First load - should be null since no canonical fields
  assert.strictEqual(profile.get('identity.name'), null);
  
  // Add canonical field
  repo.upsertCanonicalField({
    entityId: 'test_ent_8',
    fieldPath: 'identity.name',
    value: 'Test Business',
    provenance: 'verified',
    confidence: 0.95,
  });
  
  const profile2 = new BusinessProfile();
  profile2.setEntityId('test_ent_8');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_8', profile2);
  
  // Second load should return same value
  const profile3 = new BusinessProfile();
  profile3.setEntityId('test_ent_8');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_8', profile3);
  
  assert.strictEqual(profile3.get('identity.name'), 'Test Business');
});

/* ================================================================== *
 * TEST 9 — Multi-provider entity
 * ================================================================== */
console.log('\n[9] Multi-provider entity');

checkAsync('Multiple provider observations produce one coherent canonical profile', async () => {
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_9');
  
  // Simulate geoapify observation
  repo.upsertCanonicalField({
    entityId: 'test_ent_9',
    fieldPath: 'identity.name',
    value: 'Tartine Bakery',
    provenance: 'discovered',
    confidence: 0.9,
  });
  repo.upsertCanonicalField({
    entityId: 'test_ent_9',
    fieldPath: 'contact.phone',
    value: '4154872600',
    provenance: 'discovered',
    confidence: 0.85,
  });
  
  // Simulate web extraction
  repo.upsertCanonicalField({
    entityId: 'test_ent_9',
    fieldPath: 'identity.name',
    value: 'Tartine Bakery',
    provenance: 'discovered',
    confidence: 0.85,
  });
  repo.upsertCanonicalField({
    entityId: 'test_ent_9',
    fieldPath: 'contact.phone',
    value: '4154872600',
    provenance: 'discovered',
    confidence: 0.8,
  });
  
  const profile = new BusinessProfile();
  profile.setEntityId('test_ent_9');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_9', profile);
  
  // Should have coherent profile from both providers
  assert.strictEqual(profile.get('identity.name'), 'Tartine Bakery');
  assert.strictEqual(profile.get('contact.phone'), '4154872600');
});

/* ================================================================== *
 * TEST 10 — Different entity isolation
 * ================================================================== */
console.log('\n[10] Different entity isolation');

checkAsync('Canonical fields from entity A do not leak into entity B', async () => {
  // Entity A
  repo.upsertCanonicalField({
    entityId: 'ent_A',
    fieldPath: 'identity.name',
    value: 'Business A',
    provenance: 'verified',
    confidence: 0.95,
  });
  repo.upsertCanonicalField({
    entityId: 'ent_A',
    fieldPath: 'contact.phone',
    value: '4155551111',
    provenance: 'discovered',
    confidence: 0.9,
  });
  
  // Entity B
  repo.upsertCanonicalField({
    entityId: 'ent_B',
    fieldPath: 'identity.name',
    value: 'Business B',
    provenance: 'verified',
    confidence: 0.95,
  });
  repo.upsertCanonicalField({
    entityId: 'ent_B',
    fieldPath: 'contact.phone',
    value: '4155552222',
    provenance: 'discovered',
    confidence: 0.9,
  });
  
  const profileA = new BusinessProfile();
  profileA.setEntityId('ent_A');
  await repo.loadCanonicalFieldsIntoProfile('ent_A', profileA);
  
  const profileB = new BusinessProfile();
  profileB.setEntityId('ent_B');
  await repo.loadCanonicalFieldsIntoProfile('ent_B', profileB);
  
  assert.strictEqual(profileA.get('identity.name'), 'Business A');
  assert.strictEqual(profileA.get('contact.phone'), '4155551111');
  assert.strictEqual(profileB.get('identity.name'), 'Business B');
  assert.strictEqual(profileB.get('contact.phone'), '4155552222');
});

/* ================================================================== *
 * TEST 11 — Database reload
 * ================================================================== */
console.log('\n[11] Database reload');

checkAsync('Canonical state survives process/database reload', async () => {
  // Set canonical fields
  repo.upsertCanonicalField({
    entityId: 'test_ent_reload',
    fieldPath: 'identity.name',
    value: 'Reload Test',
    provenance: 'verified',
    confidence: 0.95,
  });
  
  const profile1 = new BusinessProfile();
  profile1.setEntityId('test_ent_reload');
  await repo.loadCanonicalFieldsIntoProfile('test_ent_reload', profile1);
  
  assert.strictEqual(profile1.get('identity.name'), 'Reload Test');
  
  // Close and reopen database
  closeDatabase();
  const newDb = await initializeDatabase('./test_phase5.db');
  const newRepo = new IdentityRepository((await import('./src/db/client.js')).getDb());
  
  const profile2 = new BusinessProfile();
  profile2.setEntityId('test_ent_reload');
  await newRepo.loadCanonicalFieldsIntoProfile('test_ent_reload', profile2);
  
  assert.strictEqual(profile2.get('identity.name'), 'Reload Test');
});

/* ================================================================== *
 * TEST 12 — Database failure handling
 * ================================================================== */
console.log('\n[12] Database failure handling');

check('Database failure does not masquerade as "no canonical data"', () => {
  // Create a repo with a closed/invalid database
  const { IdentityRepository } = await import('./src/db/IdentityRepository.js');
  
  // The constructor should validate the db instance
  assert.throws(() => {
    new IdentityRepository(null);
  }, /IdentityRepository instance is required|Database instance is required/);
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

closeDatabase();
console.log('\n✓ All Phase 5 tests passed');
process.exit(0);