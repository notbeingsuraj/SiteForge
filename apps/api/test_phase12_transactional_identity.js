import assert from 'node:assert/strict';
import { initializeDatabase, closeDatabase, getRawDb } from './src/db/client.js';
import { IdentityRepository, DuplicateError } from './src/db/IdentityRepository.js';
import { BusinessEntity, ProviderIdentity } from './src/db/schema.js';

const databasePath = './test_phase12_transactional_identity.db';
const database = await initializeDatabase(databasePath);
const repository = new IdentityRepository(database);
const raw = getRawDb();

function counts() {
  return {
    entities: raw.prepare('SELECT COUNT(*) AS count FROM business_entity').get().count,
    mappings: raw.prepare('SELECT COUNT(*) AS count FROM provider_identity').get().count,
  };
}

function orphanCount() {
  return raw.prepare(`
    SELECT COUNT(*) AS count
    FROM business_entity entity
    LEFT JOIN provider_identity identity ON identity.entity_id = entity.entity_id
    WHERE identity.id IS NULL
  `).get().count;
}

async function main() {
  const committed = repository.createEntityWithProviderIdentity(
    { canonicalName: 'Transactional Bakery', canonicalAddress: '1 Commit Street' },
    { provider: 'phase12', providerRecordId: 'committed', resolutionMethod: 'first_observation' },
  );
  assert.ok(committed.entity.entityId);
  assert.equal(counts().entities, 1);
  assert.equal(counts().mappings, 1);

  assert.throws(() => repository.createEntityWithProviderIdentity(
    { canonicalName: 'Duplicate Attempt', canonicalAddress: '2 Rollback Street' },
    { provider: 'phase12', providerRecordId: 'committed', resolutionMethod: 'first_observation' },
  ), DuplicateError);
  assert.equal(counts().entities, 1);
  assert.equal(counts().mappings, 1);

  raw.exec(`
    CREATE TEMP TRIGGER phase12_injected_failure
    AFTER INSERT ON business_entity
    WHEN NEW.canonical_name = 'Injected Failure'
    BEGIN
      SELECT RAISE(ABORT, 'injected failure');
    END
  `);
  let injectedError;
  try {
    repository.createEntityWithProviderIdentity(
      { canonicalName: 'Injected Failure', canonicalAddress: '3 Rollback Street' },
      { provider: 'phase12', providerRecordId: 'injected', resolutionMethod: 'first_observation' },
    );
  } catch (error) {
    injectedError = error;
  }
  raw.exec('DROP TRIGGER phase12_injected_failure');
  assert.match(injectedError?.message || '', /injected failure/);
  assert.equal(counts().entities, 1);
  assert.equal(counts().mappings, 1);

  const existing = repository.findProviderIdentity('phase12', 'committed');
  assert.equal(existing.entityId, committed.entity.entityId);
  const touched = repository.touchProviderIdentity('phase12', 'committed', { resolutionMethod: 'known_identity' });
  assert.equal(touched.id, committed.providerIdentity.id);
  assert.equal(counts().entities, 1);
  assert.equal(counts().mappings, 1);

  const foreignKeys = raw.pragma('foreign_keys')[0].foreign_keys;
  assert.equal(foreignKeys, 1);
  assert.equal(orphanCount(), 0);
  console.log(`PHASE 12 TRANSACTION: entities=${counts().entities}, mappings=${counts().mappings}, orphans=${orphanCount()}, foreign_keys=${foreignKeys}`);
  console.log('PHASE 12 TRANSACTIONAL IDENTITY: 12 passed, 0 failed');
  closeDatabase();
}

main().catch((error) => {
  console.error(error);
  closeDatabase();
  process.exitCode = 1;
});
