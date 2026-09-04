/**
 * PHASE 17 — Review Operator CLI: focused harness
 *
 * Tests the CLI commands by importing them as functions against fresh
 * temporary SQLite databases. Covers:
 *
 *   1  pending review listing works
 *   2  review detail exposes required evidence
 *   3  approve same_entity works
 *   4  reject works
 *   5  approve relocated_entity works
 *   6  approve same_brand_different_location does NOT merge
 *   7  uncertain without relatedEntityId is safely resolved
 *   8  invalid review ID fails safely
 *   9  repeated resolution is idempotent
 *  10  conflicting second resolution is rejected
 *  11  decisions survive a fresh Node process
 *  12  unrelated entity remains untouched
 *
 * Deterministic, self-cleaning (removes .db / -wal / -shm), async-safe.
 *
 * Run: node test_phase17_review_operator.js
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { initializeDatabase, closeDatabase } from './src/db/client.js';
import { IdentityRepository, ValidationError, NotFoundError } from './src/db/IdentityRepository.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const DB = './test_phase17_operator.db';
const RESTART_DB = process.env.SQLITE_DATABASE_PATH || './test_phase17_restart_op.db';

function cleanupDbFiles() {
  for (const base of [DB, RESTART_DB]) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.rmSync(base + suffix, { force: true }); } catch { /* ignore */ }
    }
  }
}

// ─── Seed helpers ───────────────────────────────────────────────────────────

function seedPair(repo, prefix, matchType = 'uncertain') {
  const a = repo.createEntityWithProviderIdentity(
    { canonicalName: `${prefix} Alpha`, canonicalAddress: '1 Alpha St' },
    { provider: 'geoapify', providerRecordId: `${prefix}-rec-A`, resolutionMethod: 'first_observation', resolutionConfidence: 0.95 }
  );
  const b = repo.createEntityWithProviderIdentity(
    { canonicalName: `${prefix} Bravo`, canonicalAddress: '2 Bravo Ave' },
    { provider: 'web_extraction', providerRecordId: `${prefix}-rec-B`, resolutionMethod: 'provisional_separate', resolutionConfidence: null }
  );
  const review = repo.createReviewItem({
    entityId: a.entity.entityId,
    relatedEntityId: b.entity.entityId,
    provider: 'geoapify', providerRecordId: `${prefix}-rec-A`,
    relatedProvider: 'web_extraction', relatedProviderRecordId: `${prefix}-rec-B`,
    matchType, matchScore: 0.6,
    reason: `${prefix}: ambiguous pairwise resolution`,
    evidence: { source: 'pairwise_resolution', matchType, matchScore: 0.6 },
    dedupeContext: { providerA: 'geoapify', providerRecordIdA: `${prefix}-rec-A`, providerB: 'web_extraction', providerRecordIdB: `${prefix}-rec-B`, matchType },
  });
  return { auth: a.entity, prov: b.entity, review };
}

// ─── Scenario runner ────────────────────────────────────────────────────────

async function runScenarios() {
  const db = await initializeDatabase(DB);
  const repo = new IdentityRepository(db);

  // Seed test data
  const s3 = seedPair(repo, 's3');
  const s4 = seedPair(repo, 's4', 'same_brand_different_location');
  const s8 = seedPair(repo, 's8');

  // Relocation review
  const relo = repo.createEntity({ canonicalName: 'Relo Co', canonicalAddress: '740 Valencia St, SF', canonicalPhone: '415-349-0942' });
  repo.createObservation({ entityId: relo.entityId, provider: 'geoapify', providerRecordId: 'relo-rec', fieldPath: 'location.full_address', value: '740 Valencia St, SF', normalizedValue: '740 valencia st, sf', provenance: 'discovered', confidence: 0.9, observedAt: '2025-01-01T10:00:00.000Z' });
  repo.createObservation({ entityId: relo.entityId, provider: 'geoapify', providerRecordId: 'relo-rec', fieldPath: 'contact.phone', value: '415-349-0942', normalizedValue: '4153490942', provenance: 'discovered', confidence: 0.9, observedAt: '2025-01-01T10:00:00.000Z' });
  repo.createObservation({ entityId: relo.entityId, provider: 'geoapify', providerRecordId: 'relo-rec', fieldPath: 'location.full_address', value: '2600 16th St, SF', normalizedValue: '2600 16th st, sf', provenance: 'discovered', confidence: 0.9, observedAt: '2025-02-01T10:00:00.000Z' });
  const reloReview = repo.createReviewItem({
    entityId: relo.entityId,
    matchType: 'relocated_entity', matchScore: 1.0,
    reason: 'address changed over time with stable identity',
    evidence: { source: 'temporal_analysis', verdict: 'relocated', addressFrom: '740 valencia st, sf', addressTo: '2600 16th st, sf' },
    dedupeContext: { entityId: relo.entityId, addressFrom: '740 valencia st, sf', addressTo: '2600 16th st, sf', matchType: 'relocated_entity' },
  });

  // Uncertain without related entity
  const unc = repo.createEntity({ canonicalName: 'Uncertain Solo', canonicalAddress: '5 Solo Rd' });
  const uncReview = repo.createReviewItem({
    entityId: unc.entityId,
    matchType: 'uncertain', matchScore: 0.5,
    reason: 'insufficient evidence, no related entity',
    evidence: { source: 'pairwise_resolution', matchType: 'uncertain' },
    dedupeContext: { entityId: unc.entityId, matchType: 'uncertain' },
  });

  // Unrelated entity (scenario 12)
  const iso = repo.createEntityWithProviderIdentity(
    { canonicalName: 'Isolated Coffee', canonicalAddress: '99 Isolation Lane' },
    { provider: 'geoapify', providerRecordId: 'iso-rec-C', resolutionMethod: 'first_observation', resolutionConfidence: 0.9 }
  );
  repo.createObservation({ entityId: iso.entity.entityId, provider: 'geoapify', providerRecordId: 'iso-rec-C', fieldPath: 'location.full_address', value: '99 Isolation Lane', normalizedValue: '99 isolation lane', provenance: 'discovered', confidence: 0.9 });

  const isoBefore = repo.getEntityById(iso.entity.entityId);
  const isoObsBefore = repo.getObservations(iso.entity.entityId).length;
  const isoMappingBefore = repo.findProviderIdentity('geoapify', 'iso-rec-C');

  closeDatabase();

  console.log('\n[1] Pending review listing');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const reviews = r.getReviewItems({ status: 'pending' });
    check('1 list returns all seeded pending reviews', reviews.length === 5, `${reviews.length} (expected 5: s3,s4,s8,relo,unc)`);
    check('1 each review has id + matchType + status', reviews.every((r) => r.id && r.matchType && r.status === 'pending'));
    mod.closeDatabase();
  }

  console.log('\n[2] Review detail exposes required evidence');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    // Pairwise detail
    const det3 = r.getReviewDetail(s3.review.id);
    check('2 pairwise detail has review + entities + providerIdentities + context', det3.review && det3.entities.entity && det3.providerIdentities.provider && det3.context);
    check('2 pairwise detail has both entities', det3.entities.entity.entityId === s3.auth.entityId && det3.entities.relatedEntity.entityId === s3.prov.entityId);
    check('2 pairwise detail has observations array', Array.isArray(det3.context.observations));
    // Relocation detail
    const detR = r.getReviewDetail(reloReview.id);
    check('2 relocation detail has addressFrom/addressTo in evidence', detR.review.evidence.addressFrom && detR.review.evidence.addressTo);
    check('2 relocation detail has entity', detR.entities.entity.entityId === relo.entityId);
    // Branch detail
    const det4 = r.getReviewDetail(s4.review.id);
    check('2 branch detail has both entities', det4.entities.entity && det4.entities.relatedEntity);
    mod.closeDatabase();
  }

  console.log('\n[3] Approve same_entity works');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const item = r.resolveReviewItem(s3.review.id, 'approved', { resolvedBy: 'cli-test', note: 'same business' });
    check('3 approved review has status approved', item.status === 'approved');
    check('3 authoritative entity ACTIVE', r.getEntityById(s3.auth.entityId).status === 'ACTIVE');
    check('3 provisional entity MERGED', r.getEntityById(s3.prov.entityId).status === 'MERGED');
    check('3 secondary mapping reassigned', r.findProviderIdentity('web_extraction', 's3-rec-B').entityId === s3.auth.entityId);
    mod.closeDatabase();
  }

  console.log('\n[4] Reject works');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const item = r.resolveReviewItem(s4.review.id, 'rejected', { resolvedBy: 'cli-test', note: 'not same' });
    check('4 rejected review has status rejected', item.status === 'rejected');
    check('4 entities unchanged', r.getEntityById(s4.auth.entityId).status === 'ACTIVE' && r.getEntityById(s4.prov.entityId).status === 'ACTIVE');
    mod.closeDatabase();
  }

  console.log('\n[5] Approve relocated_entity works');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const item = r.resolveReviewItem(reloReview.id, 'approved', { resolvedBy: 'cli-test', note: 'confirmed move' });
    check('5 approved relocation review', item.status === 'approved');
    const ent = r.getEntityById(relo.entityId);
    check('5 canonical address promoted', ent.canonicalAddress === '2600 16th st, sf', ent.canonicalAddress);
    check('5 observations preserved', r.getObservations(relo.entityId).length === 3);
    mod.closeDatabase();
  }

  console.log('\n[6] Approve same_brand_different_location does NOT merge');
  {
    // s4 was rejected in scenario 4; seed a new branch review
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const s6 = seedPair(r, 's6', 'same_brand_different_location');
    const item = r.resolveReviewItem(s6.review.id, 'approved', { resolvedBy: 'cli-test', note: 'branch confirmed' });
    check('6 approved branch review', item.status === 'approved');
    check('6 both entities remain ACTIVE', r.getEntityById(s6.auth.entityId).status === 'ACTIVE' && r.getEntityById(s6.prov.entityId).status === 'ACTIVE');
    check('6 secondary mapping stays on provisional', r.findProviderIdentity('web_extraction', 's6-rec-B').entityId === s6.prov.entityId);
    mod.closeDatabase();
  }

  console.log('\n[7] Uncertain without relatedEntityId is safely resolved');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const item = r.resolveReviewItem(uncReview.id, 'approved', { resolvedBy: 'cli-test', note: 'confirmed as is' });
    check('7 approved uncertain (status-only)', item.status === 'approved');
    check('7 entity remains ACTIVE (no merge)', r.getEntityById(uncReview.entityId).status === 'ACTIVE');
    mod.closeDatabase();
  }

  console.log('\n[8] Invalid review ID fails safely');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    let errNotFound = null;
    try { r.resolveReviewItem('rev_does_not_exist', 'approved'); } catch (e) { errNotFound = e; }
    check('8 nonexistent review -> NotFoundError', errNotFound instanceof NotFoundError, String(errNotFound));
    let errBadDecision = null;
    try { r.resolveReviewItem('rev_does_not_exist', 'garbage'); } catch (e) { errBadDecision = e; }
    check('8 invalid decision -> ValidationError', errBadDecision instanceof ValidationError, String(errBadDecision));
    const detail = r.getReviewDetail('rev_does_not_exist');
    check('8 nonexistent review detail -> null', detail === null);
    mod.closeDatabase();
  }

  console.log('\n[9] Repeated resolution is idempotent');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    // s3 was approved in scenario 3
    const item = r.resolveReviewItem(s3.review.id, 'approved', { resolvedBy: 'cli-test', note: 'again' });
    check('9 repeat approve returns same status', item.status === 'approved');
    check('9 repeat approve is idempotent (no error)', item.id === s3.review.id);
    mod.closeDatabase();
  }

  console.log('\n[10] Conflicting second resolution is rejected');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    // s3 is approved; try to reject
    let err = null;
    try { r.resolveReviewItem(s3.review.id, 'rejected'); } catch (e) { err = e; }
    check('10 approve->reject -> ValidationError', err instanceof ValidationError, String(err));
    // s4 is rejected; try to approve
    let err2 = null;
    try { r.resolveReviewItem(s4.review.id, 'approved'); } catch (e) { err2 = e; }
    check('10 reject->approve -> ValidationError', err2 instanceof ValidationError, String(err2));
    mod.closeDatabase();
  }

  console.log('\n[11] Decisions survive a fresh Node process');
  // Child Process A creates + resolves, Process B verifies
  // (see restart runner below)

  console.log('\n[12] Unrelated entity remains untouched');
  {
    process.env.SQLITE_DATABASE_PATH = DB;
    const mod = await import('./src/db/client.js');
    const rDb = await mod.initializeDatabase(DB);
    const r = new IdentityRepository(rDb);
    const isoAfter = r.getEntityById(iso.entity.entityId);
    const isoMappingAfter = r.findProviderIdentity('geoapify', 'iso-rec-C');
    const isoObsAfter = r.getObservations(iso.entity.entityId).length;
    check('12 unrelated entity still ACTIVE', isoAfter.status === 'ACTIVE');
    check('12 unrelated entity canonical untouched', isoAfter.canonicalName === isoBefore.canonicalName && isoAfter.updatedAt === isoBefore.updatedAt);
    check('12 unrelated provider mapping unchanged', isoMappingAfter.entityId === isoMappingBefore.entityId);
    check('12 unrelated observations intact', isoObsAfter === isoObsBefore);
    mod.closeDatabase();
  }
}

// ─── Restart child processes (scenario 11) ──────────────────────────────────

const R_PREFIX = 'op17-rst';

async function runChildA() {
  process.env.SQLITE_DATABASE_PATH = RESTART_DB;
  const { initializeDatabase: init, closeDatabase: close } = await import('./src/db/client.js');
  const { IdentityRepository: Repo } = await import('./src/db/IdentityRepository.js');

  const db = await init(RESTART_DB);
  const r = new Repo(db);
  const a = r.createEntityWithProviderIdentity(
    { canonicalName: 'Restart Alpha', canonicalAddress: '1 Restart Rd' },
    { provider: 'geoapify', providerRecordId: `${R_PREFIX}-A`, resolutionMethod: 'first_observation', resolutionConfidence: 0.9 }
  );
  const b = r.createEntityWithProviderIdentity(
    { canonicalName: 'Restart Bravo', canonicalAddress: '2 Restart Ave' },
    { provider: 'web_extraction', providerRecordId: `${R_PREFIX}-B`, resolutionMethod: 'provisional_separate', resolutionConfidence: null }
  );
  const review = r.createReviewItem({
    entityId: a.entity.entityId,
    relatedEntityId: b.entity.entityId,
    provider: 'geoapify', providerRecordId: `${R_PREFIX}-A`,
    relatedProvider: 'web_extraction', relatedProviderRecordId: `${R_PREFIX}-B`,
    matchType: 'uncertain', matchScore: 0.6,
    reason: 'restart merge review',
    evidence: { source: 'pairwise_resolution', matchType: 'uncertain' },
    dedupeContext: { providerA: 'geoapify', providerRecordIdA: `${R_PREFIX}-A`, providerB: 'web_extraction', providerRecordIdB: `${R_PREFIX}-B`, matchType: 'uncertain' },
  });
  const item = r.resolveReviewItem(review.id, 'approved', { resolvedBy: 'restart-operator', note: 'approved across restart' });
  assert.equal(item.status, 'approved');
  console.log(`  PROCESS A: review=${review.id} resolved approved, auth=${a.entity.entityId} prov=${b.entity.entityId}`);
  close();
}

async function runChildB() {
  process.env.SQLITE_DATABASE_PATH = RESTART_DB;
  const { initializeDatabase: init, closeDatabase: close } = await import('./src/db/client.js');
  const { IdentityRepository: Repo } = await import('./src/db/IdentityRepository.js');

  const db = await init(RESTART_DB);
  const r = new Repo(db);
  const key = r.buildReviewDedupeKey({ providerA: 'geoapify', providerRecordIdA: `${R_PREFIX}-A`, providerB: 'web_extraction', providerRecordIdB: `${R_PREFIX}-B`, matchType: 'uncertain' });
  const rev = r.getReviewItemByDedupeKey(key);
  assert.ok(rev, 'review must survive restart');
  assert.equal(rev.status, 'approved');
  assert.equal(rev.resolvedBy, 'restart-operator');
  const mapping = r.findProviderIdentity('web_extraction', `${R_PREFIX}-B`);
  assert.ok(mapping && mapping.entityId === rev.entityId, 'mapping must be merged after restart');
  const prov = r.getEntityById(rev.relatedEntityId);
  assert.ok(prov && prov.status === 'MERGED', 'provisional entity must be MERGED after restart');
  console.log(`  PROCESS B: review approved, mapping merged, state verified`);
  close();
}

function runChild(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, P17OP_MODE: mode, SQLITE_DATABASE_PATH: RESTART_DB },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`child ${mode} exited with ${code}`))));
  });
}

// ─── Orchestration ──────────────────────────────────────────────────────────

async function main() {
  const mode = process.env.P17OP_MODE;
  if (mode === 'a') return runChildA();
  if (mode === 'b') return runChildB();

  console.log('='.repeat(72));
  console.log('PHASE 17 — Review Operator CLI');
  console.log('='.repeat(72));

  cleanupDbFiles();
  await runScenarios();

  console.log('\n[11] Decisions survive a fresh Node process (child processes)');
  try {
    await runChild('a');
    await runChild('b');
    process.env.SQLITE_DATABASE_PATH = RESTART_DB;
    const { initializeDatabase: init, closeDatabase: close } = await import('./src/db/client.js');
    const { IdentityRepository: Repo } = await import('./src/db/IdentityRepository.js');
    const db = await init(RESTART_DB);
    const r = new Repo(db);
    const key = r.buildReviewDedupeKey({ providerA: 'geoapify', providerRecordIdA: `${R_PREFIX}-A`, providerB: 'web_extraction', providerRecordIdB: `${R_PREFIX}-B`, matchType: 'uncertain' });
    const rev = r.getReviewItemByDedupeKey(key);
    check('11 review approved + stable after restart', rev && rev.status === 'approved', rev && rev.status);
    check('11 merged identity state survives restart', rev && r.findProviderIdentity('web_extraction', `${R_PREFIX}-B`).entityId === rev.entityId);
    close();
  } catch (e) {
    check('11 restart scenario failed', false, e.message);
  }

  console.log('\n' + '='.repeat(72));
  console.log(`PHASE 17 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(72));
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  }
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});