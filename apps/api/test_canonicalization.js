/**
 * Phase 4 canonical business intelligence tests.
 */

import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { CanonicalizationService } from './src/services/CanonicalizationService.js';
import { IdentityRepository } from './src/db/IdentityRepository.js';
import { initializeDatabase, getRawDb, closeDatabase } from './src/db/client.js';
import { BusinessEntity, CanonicalField, Observation, Conflict } from './src/db/schema.js';

const databasePath = './test_canonicalization.db';
const database = await initializeDatabase(databasePath);
const repository = new IdentityRepository(database);
const service = new CanonicalizationService(repository);
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n      ${error.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n      ${error.message}`);
  }
}

function resetDatabase() {
  const raw = getRawDb();
  raw.prepare('DELETE FROM canonicalization_decision').run();
  raw.prepare('DELETE FROM conflict').run();
  raw.prepare('DELETE FROM observation').run();
  raw.prepare('DELETE FROM canonical_field').run();
  raw.prepare('DELETE FROM business_entity').run();
}

function createEntity() {
  return repository.createEntity({
    canonicalName: 'Tartine Bakery',
    canonicalAddress: '600 Guerrero Street, San Francisco, CA 94110',
    canonicalPhone: '4154872600',
  });
}

const record = (overrides = {}) => ({
  business: { name: 'Tartine Bakery', category: 'Bakery', ...overrides.business },
  contact: { phone: '4154872600', website: 'https://tartinebakery.com', ...overrides.contact },
  location: {
    full_address: '600 Guerrero Street, San Francisco, CA 94110',
    coordinates: { lat: 37.7614552, lng: -122.4239452 },
    ...overrides.location,
  },
  ratings: overrides.ratings,
});

console.log('\n[1] Canonical Creation');
await checkAsync('First trusted observation creates canonical fields and observation history', async () => {
  resetDatabase();
  const entity = createEntity();
  const result = await service.processObservation({
    entityId: entity.entityId,
    provider: 'geoapify',
    providerRecordId: 'place_1',
    record: record(),
    confidence: 0.95,
  });
  assert.ok(result.canonicalizedFields.length > 0);
  assert.ok(repository.getCanonicalField(entity.entityId, 'identity.name'));
  assert.ok(repository.getObservations(entity.entityId).length > 0);
});

console.log('\n[2] Normalized Agreement');
await checkAsync('Equivalent phone formatting does not create a conflict', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record(), confidence: 0.9 });
  const result = await service.processObservation({
    entityId: entity.entityId,
    provider: 'web_extraction',
    providerRecordId: 'b',
    record: record({ contact: { phone: '+1 (415) 487-2600' } }),
    confidence: 0.9,
  });
  assert.strictEqual(repository.getConflicts(entity.entityId, 'contact.phone').length, 0);
  assert.ok(result.observationsStored > 0);
});

console.log('\n[3] Provenance');
await checkAsync('Stronger provenance replaces weaker provenance while preserving value', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'ai', providerRecordId: 'a', record: record(), confidence: 0.5 });
  // The service currently emits discovered provenance for provider observations;
  // exercise the repository precedence directly for the inferred → verified contract.
  repository.upsertCanonicalField({ entityId: entity.entityId, fieldPath: 'identity.name', value: 'Tartine Bakery', provenance: 'inferred', confidence: 0.5 });
  const upgraded = repository.upsertCanonicalField({ entityId: entity.entityId, fieldPath: 'identity.name', value: 'Tartine Bakery', provenance: 'verified', confidence: 0.95 });
  assert.strictEqual(upgraded.provenance, 'verified');
  assert.strictEqual(upgraded.value, 'Tartine Bakery');
});

console.log('\n[4] Conflicts');
await checkAsync('Conflicting identity values preserve observation and canonical value', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record(), confidence: 0.95 });
  const result = await service.processObservation({
    entityId: entity.entityId,
    provider: 'web_extraction',
    providerRecordId: 'b',
    record: record({ contact: { phone: '4159999999' } }),
    confidence: 0.6,
  });
  assert.strictEqual(result.conflictsDetected.length > 0, true);
  assert.strictEqual(repository.getCanonicalField(entity.entityId, 'contact.phone').value, '4154872600');
  assert.strictEqual(repository.getObservations(entity.entityId, 'contact.phone').length, 2);
});

console.log('\n[5] Missing Values');
await checkAsync('Missing provider fields cannot erase canonical values', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record(), confidence: 0.95 });
  await service.processObservation({ entityId: entity.entityId, provider: 'web_extraction', providerRecordId: 'b', record: { business: {}, contact: {}, location: {} }, confidence: 0.5 });
  assert.strictEqual(repository.getCanonicalField(entity.entityId, 'contact.phone').value, '4154872600');
});

console.log('\n[6] Field-Specific Behavior');
await checkAsync('Descriptive field disagreement is resolved independently from identity fields', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record({ ratings: { rating: 4.2 } }), confidence: 0.7 });
  const result = await service.processObservation({ entityId: entity.entityId, provider: 'official_website', providerRecordId: 'b', record: record({ ratings: { rating: 4.8 } }), confidence: 0.95 });
  assert.ok(result.conflictsDetected.length >= 1);
  assert.strictEqual(repository.getCanonicalField(entity.entityId, 'identity.name').value, 'Tartine Bakery');
});

console.log('\n[7] Historical Preservation');
await checkAsync('Canonical updates retain previous observations', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record(), confidence: 0.5 });
  repository.upsertCanonicalField({ entityId: entity.entityId, fieldPath: 'identity.name', value: 'Tartine Bakery SF', provenance: 'verified', confidence: 0.95 });
  const observations = repository.getObservations(entity.entityId, 'identity.name');
  assert.ok(observations.length >= 1);
  assert.strictEqual(repository.getCanonicalField(entity.entityId, 'identity.name').value, 'Tartine Bakery SF');
});

console.log('\n[8] Idempotency');
await checkAsync('Repeated identical provider observations remain deterministic', async () => {
  resetDatabase();
  const entity = createEntity();
  const input = { entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record(), confidence: 0.9 };
  await service.processObservation(input);
  await service.processObservation(input);
  assert.strictEqual(repository.getCanonicalField(entity.entityId, 'contact.phone').value, '4154872600');
  assert.strictEqual(repository.getConflicts(entity.entityId, 'contact.phone').length, 0);
  assert.strictEqual(repository.getObservations(entity.entityId, 'contact.phone').length, 2);
});

console.log('\n[9] Persistence Reload');
await checkAsync('Canonical state survives database reload', async () => {
  resetDatabase();
  const entity = createEntity();
  await service.processObservation({ entityId: entity.entityId, provider: 'geoapify', providerRecordId: 'a', record: record(), confidence: 0.9 });
  closeDatabase();
  const reloadedDb = await initializeDatabase(databasePath);
  const reloadedRepository = new IdentityRepository(reloadedDb);
  const canonical = reloadedRepository.getCanonicalField(entity.entityId, 'identity.name');
  assert.strictEqual(canonical.value, 'Tartine Bakery');
  closeDatabase();
});

console.log('\n[10] Failure Handling');
check('Invalid repository construction fails explicitly', () => {
  assert.throws(() => new CanonicalizationService(null), /IdentityRepository or database instance is required/);
});

closeDatabase();
console.log(`\nRESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
