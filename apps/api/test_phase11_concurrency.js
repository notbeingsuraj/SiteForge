import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, closeDatabase, getRawDb, getDb } from './src/db/client.js';
import { IdentityRepository, DuplicateError } from './src/db/IdentityRepository.js';
import { CanonicalizationService } from './src/services/CanonicalizationService.js';

const databasePath = process.env.SQLITE_DATABASE_PATH || './test_phase11_concurrency.db';
const mode = process.env.PHASE11_MODE;
const secondProviderRecordId = 'https://www.google.com/maps/place/Concurrency+Bakery/@37.7,-122.4,17z';
const secondaryRecord = {
  business: { name: 'Concurrency Bakery', category: 'Bakery', description: 'Concurrency Bakery fixture' },
  contact: { phone: '4155550100', website: 'https://concurrency-place.example.test' },
  location: { full_address: '11 Race Street', city: 'San Francisco', state: 'CA', country: 'US' },
  ratings: { rating: 4.2, review_count: 10 },
};

const businessRecord = (name, placeId, rating = 4.2) => ({
  business: { name, category: 'Bakery', description: `${name} fixture` },
  contact: { phone: name === 'Concurrency Bakery' ? '4155550100' : '4155550200', website: `https://${placeId}.example.test` },
  location: { full_address: name === 'Concurrency Bakery' ? '11 Race Street' : '22 Isolated Street', city: 'San Francisco', state: 'CA', country: 'US' },
  ratings: { rating, review_count: 10 },
  provider: { placeId },
});

function child(childMode, extra = {}) {
  return new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, PHASE11_MODE: childMode, SQLITE_DATABASE_PATH: databasePath, ...extra },
      stdio: 'inherit',
    });
    worker.once('error', reject);
    worker.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Phase 11 worker ${childMode} exited with ${code}`)));
  });
}

async function repositoryRaceWorker() {
  const db = await initializeDatabase(databasePath);
  const repository = new IdentityRepository(db);
  const entity = repository.createEntity({ canonicalName: `Race Entity ${process.pid}`, canonicalAddress: 'Race Street' });
  try {
    repository.createProviderIdentity({ provider: 'race_provider', providerRecordId: 'same-record', entityId: entity.entityId, resolutionMethod: 'race' });
    console.log(`REPOSITORY RACE SUCCESS ${entity.entityId}`);
  } catch (error) {
    if (!(error instanceof DuplicateError)) throw error;
    console.log('REPOSITORY RACE DUPLICATE_ERROR');
  }
  closeDatabase();
}

async function serviceWorker() {
  const { default: BusinessResearchService } = await import('./src/services/BusinessResearchService.js');
  const { default: GeoapifyProvider } = await import('./src/services/providers/GeoapifyProvider.js');
  const { default: WebExtractionProvider } = await import('./src/services/providers/WebExtractionProvider.js');
  const record = businessRecord(process.env.PHASE11_NAME, process.env.PHASE11_PLACE, 4.2);
  GeoapifyProvider.isAvailable = () => true;
  GeoapifyProvider.getBusiness = async () => record;
  WebExtractionProvider.search = async () => process.env.PHASE11_SECONDARY === 'true'
    ? { status: 'ok', records: [secondaryRecord] }
    : { status: 'no_result', records: [] };
  await BusinessResearchService.extractBusinessIntelligenceWithProviders({
    name: record.business.name,
    googleMapsUrl: process.env.PHASE11_SECONDARY === 'true' ? secondProviderRecordId : undefined,
  });
  console.log(`SERVICE WORKER COMPLETE ${record.provider.placeId}`);
}

async function observationWorker() {
  const db = await initializeDatabase(databasePath);
  const repository = new IdentityRepository(db);
  const entityId = process.env.PHASE11_ENTITY;
  const canonicalizer = new CanonicalizationService(repository);
  await canonicalizer.processObservation({
    entityId,
    provider: `observation_${process.pid}`,
    providerRecordId: `observation-${process.pid}`,
    record: businessRecord('Concurrency Bakery', 'observation-place', Number(process.env.PHASE11_RATING)),
    confidence: 0.8,
  });
  closeDatabase();
}

async function main() {
  if (mode === 'repository-race') return repositoryRaceWorker();
  if (mode === 'service') return serviceWorker();
  if (mode === 'observation') return observationWorker();

  await initializeDatabase(databasePath);
  closeDatabase();

  await Promise.all(Array.from({ length: 8 }, () => child('repository-race')));
  let db = await initializeDatabase(databasePath);
  let repository = new IdentityRepository(db);
  let raceMappings = getRawDb().prepare("SELECT COUNT(*) AS count FROM provider_identity WHERE provider = 'race_provider' AND provider_record_id = 'same-record'").get().count;
  let raceEntities = getRawDb().prepare("SELECT COUNT(*) AS count FROM business_entity WHERE canonical_address = 'Race Street'").get().count;
  assert.equal(raceMappings, 1);
  assert.equal(raceEntities, 8);
  closeDatabase();
  console.log(`REPOSITORY RACE: mappings=${raceMappings}, entities=${raceEntities}`);

  await Promise.all(Array.from({ length: 8 }, () => child('service', { PHASE11_NAME: 'Concurrency Bakery', PHASE11_PLACE: 'concurrency-place' })));
  db = await initializeDatabase(databasePath);
  repository = new IdentityRepository(db);
  const serviceMappings = getRawDb().prepare("SELECT COUNT(*) AS count FROM provider_identity WHERE provider = 'geoapify' AND provider_record_id = 'concurrency-place'").get().count;
  const serviceEntities = getRawDb().prepare("SELECT COUNT(*) AS count FROM business_entity WHERE canonical_name = 'Concurrency Bakery'").get().count;
  const serviceEntityId = repository.findProviderIdentity('geoapify', 'concurrency-place')?.entityId;
  assert.equal(serviceMappings, 1);
  assert.equal(serviceEntities, 1);
  assert.ok(serviceEntityId);
  closeDatabase();
  console.log(`SERVICE RACE: mappings=${serviceMappings}, entities=${serviceEntities}, entity=${serviceEntityId}`);

  await Promise.all([
    child('service', { PHASE11_NAME: 'Concurrent Different A', PHASE11_PLACE: 'different-a' }),
    child('service', { PHASE11_NAME: 'Concurrent Different B', PHASE11_PLACE: 'different-b' }),
  ]);
  db = await initializeDatabase(databasePath);
  repository = new IdentityRepository(db);
  const differentA = repository.findProviderIdentity('geoapify', 'different-a');
  const differentB = repository.findProviderIdentity('geoapify', 'different-b');
  assert.ok(differentA && differentB);
  assert.notEqual(differentA.entityId, differentB.entityId);
  assert.equal(getRawDb().prepare("SELECT COUNT(*) AS count FROM business_entity WHERE canonical_name LIKE 'Concurrent Different %'").get().count, 2);
  closeDatabase();
  console.log(`DIFFERENT BUSINESS RACE: entityA=${differentA.entityId}, entityB=${differentB.entityId}`);

  await Promise.all(Array.from({ length: 3 }, () => child('service', {
    PHASE11_NAME: 'Concurrency Bakery',
    PHASE11_PLACE: 'concurrency-place',
    PHASE11_SECONDARY: 'true',
  })));
  db = await initializeDatabase(databasePath);
  repository = new IdentityRepository(db);
  const concurrentSecondary = repository.findProviderIdentity('web_extraction', secondProviderRecordId);
  assert.ok(concurrentSecondary);
  assert.equal(concurrentSecondary.entityId, serviceEntityId);
  assert.equal(repository.getObservations(serviceEntityId).length >= 10, true);
  console.log(`CROSS-PROVIDER RACE: entity=${concurrentSecondary.entityId}, observations=${repository.getObservations(serviceEntityId).length}`);
  closeDatabase();

  db = await initializeDatabase(databasePath);
  repository = new IdentityRepository(db);
  const canonicalEntity = repository.createEntity({ canonicalName: 'Concurrency Bakery', canonicalAddress: '11 Race Street' });
  const canonicalizer = new CanonicalizationService(repository);
  await canonicalizer.processObservation({ entityId: canonicalEntity.entityId, provider: 'seed', providerRecordId: 'seed', record: businessRecord('Concurrency Bakery', 'canonical-place', 4.2), confidence: 0.8 });
  const observationEntity = canonicalEntity.entityId;
  closeDatabase();
  await Promise.all([4.2, 4.8, 4.1, 4.6, 4.3].map((rating) => child('observation', { PHASE11_ENTITY: observationEntity, PHASE11_RATING: String(rating) })));
  db = await initializeDatabase(databasePath);
  repository = new IdentityRepository(db);
  const observations = repository.getObservations(observationEntity, 'ratings.rating');
  const canonical = repository.getCanonicalField(observationEntity, 'ratings.rating');
  const conflicts = repository.getConflicts(observationEntity, 'ratings.rating');
  assert.equal(observations.length, 6);
  assert.equal(canonical.value, '4.2');
  assert.ok(conflicts.length >= 1);
  console.log(`OBSERVATIONS: count=${observations.length}, canonical=${canonical.value}, conflicts=${conflicts.length}`);
  closeDatabase();

  console.log('PHASE 11 CONCURRENCY: 5 scenarios passed, 0 failed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
