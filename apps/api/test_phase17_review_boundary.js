/**
 * PHASE 17 — Operator Review + Cold-Call Intelligence Boundary: focused harness
 *
 * Exercises the real HTTP boundary (app.js mount /api/reviews) end-to-end:
 *
 *   HTTP
 *    ↓
 *   reviews route/controller
 *    ↓
 *   IdentityRepository review API (getReviewItems / getReviewDetail /
 *        resolveReviewItem -> enforceReviewDecision)
 *    ↓
 *   SQLite transaction
 *
 * Scenarios:
 *   1  list pending reviews
 *   2  retrieve review detail (evidence for decision)
 *   3  approve same-entity (pairwise uncertain) via HTTP
 *   4  reject via HTTP
 *   5  approve relocated_entity via HTTP (address promoted to canonical)
 *   6  approve same_brand_different_location (never merges)
 *   7  approve uncertain (no related entity) — status-only
 *   8  invalid request -> 400
 *   9  already-resolved review idempotency
 *  10  conflicting second decision -> 400 (history immutable)
 *  11  persistence across process restart (two child processes over HTTP)
 *  12  unrelated entity remains isolated
 *  13  underlying enforcement error -> appropriate HTTP error (404 / 400)
 *
 * Deterministic, self-cleaning (removes .db / -wal / -shm), async-safe.
 *
 * Run: node test_phase17_review_boundary.js
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import app from './src/app.js';
import { initializeDatabase, closeDatabase } from './src/db/client.js';
import { IdentityRepository } from './src/db/IdentityRepository.js';

const TEST_DB = process.env.SQLITE_DATABASE_PATH || './test_phase17_reviews.db';
process.env.SQLITE_DATABASE_PATH = TEST_DB;

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

function cleanupDbFiles() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
}

let server;
let port;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0);
    server.once('listening', () => {
      port = server.address().port;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function get(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: await res.json() };
}

async function post(path, body) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Seeding helpers (using the repository directly to prepare pending reviews;
// the HTTP boundary under test never mutates entities itself).
// ---------------------------------------------------------------------------
async function getRepo() {
  const db = await initializeDatabase(TEST_DB);
  return new IdentityRepository(db);
}

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
    provider: 'geoapify',
    providerRecordId: `${prefix}-rec-A`,
    relatedProvider: 'web_extraction',
    relatedProviderRecordId: `${prefix}-rec-B`,
    matchType,
    matchScore: 0.6,
    reason: `${prefix}: ambiguous pairwise resolution pending review`,
    evidence: { source: 'pairwise_resolution', matchType, matchScore: 0.6 },
    dedupeContext: {
      providerA: 'geoapify', providerRecordIdA: `${prefix}-rec-A`,
      providerB: 'web_extraction', providerRecordIdB: `${prefix}-rec-B`,
      matchType,
    },
  });
  return { auth: a.entity, prov: b.entity, review };
}

async function seedAll(repo) {
  // For scenarios 1,2,3,9,10,12,13
  const s3 = seedPair(repo, 's3');
  const s4 = seedPair(repo, 's4', 'same_brand_different_location');
  // Relocation review (scenario 5): single entity with temporal address
  const relo = repo.createEntity({ canonicalName: 'Relo Co', canonicalAddress: '740 Valencia St, SF', canonicalPhone: '415-349-0942' });
  repo.createObservation({ entityId: relo.entityId, provider: 'geoapify', providerRecordId: 'relo-rec', fieldPath: 'location.full_address', value: '740 Valencia St, SF', normalizedValue: '740 valencia st, sf', provenance: 'discovered', confidence: 0.9, observedAt: '2025-01-01T10:00:00.000Z' });
  repo.createObservation({ entityId: relo.entityId, provider: 'geoapify', providerRecordId: 'relo-rec', fieldPath: 'contact.phone', value: '415-349-0942', normalizedValue: '4153490942', provenance: 'discovered', confidence: 0.9, observedAt: '2025-01-01T10:00:00.000Z' });
  repo.createObservation({ entityId: relo.entityId, provider: 'geoapify', providerRecordId: 'relo-rec', fieldPath: 'location.full_address', value: '2600 16th St, SF', normalizedValue: '2600 16th st, sf', provenance: 'discovered', confidence: 0.9, observedAt: '2025-02-01T10:00:00.000Z' });
  const reloReview = repo.createReviewItem({
    entityId: relo.entityId,
    matchType: 'relocated_entity',
    matchScore: 1.0,
    reason: 'address changed over time with stable identity',
    evidence: { source: 'temporal_analysis', verdict: 'relocated', addressFrom: '740 valencia st, sf', addressTo: '2600 16th st, sf' },
    dedupeContext: { entityId: relo.entityId, addressFrom: '740 valencia st, sf', addressTo: '2600 16th st, sf', matchType: 'relocated_entity' },
  });
  // Uncertain review with no related entity (scenario 7): status-only approval
  const unc = repo.createEntity({ canonicalName: 'Uncertain Solo', canonicalAddress: '5 Solo Rd' });
  const uncReview = repo.createReviewItem({
    entityId: unc.entityId,
    matchType: 'uncertain',
    matchScore: 0.5,
    reason: 'insufficient evidence, no related entity',
    evidence: { source: 'pairwise_resolution', matchType: 'uncertain' },
    dedupeContext: { entityId: unc.entityId, matchType: 'uncertain' },
  });
  // Unrelated isolated entity for scenario 12
  const iso = repo.createEntityWithProviderIdentity(
    { canonicalName: 'Isolated Coffee', canonicalAddress: '99 Isolation Lane' },
    { provider: 'geoapify', providerRecordId: 'iso-rec-C', resolutionMethod: 'first_observation', resolutionConfidence: 0.9 }
  );
  repo.createObservation({ entityId: iso.entity.entityId, provider: 'geoapify', providerRecordId: 'iso-rec-C', fieldPath: 'location.full_address', value: '99 Isolation Lane', normalizedValue: '99 isolation lane', provenance: 'discovered', confidence: 0.9 });

  return {
    s3, s4,
    relo: { entity: relo, review: reloReview },
    uncReview,
    iso,
  };
}

// ---------------------------------------------------------------------------
// Scenarios (HTTP)
// ---------------------------------------------------------------------------
async function runScenarios() {
  await startServer();
  const repo = await getRepo();
  const seeded = await seedAll(repo);

  console.log('\n[1] List pending reviews');
  {
    const { status, body } = await get('/api/reviews');
    check('1 GET /api/reviews -> 200', status === 200, String(status));
    check('1 lists all seeded pending reviews', body.count === 4, `${body.count} (expected 4)`);
  }
  console.log('    Pending reviews listed:', (await get('/api/reviews')).body.reviews.map((r) => r.matchType).join(', '));

  console.log('\n[2] Retrieve review detail');
  {
    const { status, body } = await get(`/api/reviews/${seeded.s3.review.id}`);
    check('2 GET /api/reviews/:id -> 200', status === 200, String(status));
    check('2 detail exposes match type + status', body.review.matchType === 'uncertain' && body.review.status === 'pending');
    check('2 detail exposes both entity ids', body.entities.entity.entityId === seeded.s3.auth.entityId && body.entities.relatedEntity.entityId === seeded.s3.prov.entityId);
    check('2 detail exposes provider identities', body.providerIdentities.provider && body.providerIdentities.relatedProvider);
    check('2 detail exposes evidence + observations array', Array.isArray(body.context.observations) && typeof body.review.evidence === 'object');
    check('2 detail exposes canonical fields + conflicts arrays', Array.isArray(body.context.canonicalFields) && Array.isArray(body.context.conflicts));
  }

  console.log('\n[3] Approve same-entity (pairwise uncertain) via HTTP');
  {
    const { status, body } = await post(`/api/reviews/${seeded.s3.review.id}/resolve`, { decision: 'approve', resolvedBy: 'operator-1', resolutionNote: 'same business' });
    check('3 POST resolve approve -> 200 + approved', status === 200 && body.status === 'approved', `${status}/${body.status}`);
    check('3 authoritative entity ACTIVE, provisional MERGED', repo.getEntityById(seeded.s3.auth.entityId).status === 'ACTIVE' && repo.getEntityById(seeded.s3.prov.entityId).status === 'MERGED');
    check('3 secondary mapping reassigned to authoritative', repo.findProviderIdentity('web_extraction', 's3-rec-B').entityId === seeded.s3.auth.entityId);
  }

  console.log('\n[4] Reject via HTTP');
  {
    const { status, body } = await post(`/api/reviews/${seeded.s4.review.id}/resolve`, { decision: 'reject', resolvedBy: 'operator-1', resolutionNote: 'not the same business' });
    check('4 POST resolve reject -> 200 + rejected', status === 200 && body.status === 'rejected', `${status}/${body.status}`);
    check('4 entities unchanged (ACTIVE + canonical untouched)', repo.getEntityById(seeded.s4.auth.entityId).status === 'ACTIVE' && repo.getEntityById(seeded.s4.prov.entityId).status === 'ACTIVE');
  }

  console.log('\n[5] Approve relocated_entity via HTTP');
  {
    const { status, body } = await post(`/api/reviews/${seeded.relo.review.id}/resolve`, { decision: 'approve', resolvedBy: 'operator-1', resolutionNote: 'confirmed move' });
    check('5 POST resolve approve relocation -> 200 + approved', status === 200 && body.status === 'approved', `${status}/${body.status}`);
    const ent = repo.getEntityById(seeded.relo.entity.entityId);
    check('5 canonical address promoted to approved new address', ent.canonicalAddress === '2600 16th st, sf', ent.canonicalAddress);
    check('5 historical observations preserved', repo.getObservations(seeded.relo.entity.entityId).length === 3);
  }

  console.log('\n[6] Approve same_brand_different_location (never merges)');
  {
    const { auth: a6, prov: b6, review: r6 } = seedPair(repo, 's6', 'same_brand_different_location');
    const { status, body } = await post(`/api/reviews/${r6.id}/resolve`, { decision: 'approve', resolvedBy: 'operator-1', resolutionNote: 'branch identities' });
    check('6 POST resolve approve branch -> 200 + approved', status === 200 && body.status === 'approved', `${status}/${body.status}`);
    check('6 both entities remain ACTIVE (no merge)', repo.getEntityById(a6.entityId).status === 'ACTIVE' && repo.getEntityById(b6.entityId).status === 'ACTIVE');
    check('6 secondary mapping stays on provisional entity', repo.findProviderIdentity('web_extraction', 's6-rec-B').entityId === b6.entityId);
  }

  console.log('\n[7] Approve uncertain (no related entity) -> status-only');
  {
    const { status, body } = await post(`/api/reviews/${seeded.uncReview.id}/resolve`, { decision: 'approve', resolvedBy: 'operator-1', resolutionNote: 'confirmed as is' });
    check('7 POST resolve approve uncertain -> 200 + approved', status === 200 && body.status === 'approved', `${status}/${body.status}`);
    check('7 no related entity to merge; entity ACTIVE', repo.getEntityById(seeded.uncReview.entityId).status === 'ACTIVE');
  }

  console.log('\n[8] Invalid request -> 400');
  {
    const badDecision = await post(`/api/reviews/${seeded.s3.review.id}/resolve`, { decision: 'maybe' });
    check('8 invalid decision -> 400', badDecision.status === 400, String(badDecision.status));
    const badFilter = await get('/api/reviews?status=bogus');
    check('8 invalid status filter -> 400', badFilter.status === 400, String(badFilter.status));
    check('8 review unchanged after invalid request', repo.getReviewItem(seeded.s3.review.id).status === 'approved');
  }

  console.log('\n[9] Already-resolved review idempotency');
  {
    const { status, body } = await post(`/api/reviews/${seeded.s3.review.id}/resolve`, { decision: 'approve', resolvedBy: 'operator-1', resolutionNote: 'same business' });
    check('9 repeat approve -> 200 + approved (idempotent)', status === 200 && body.status === 'approved', `${status}/${body.status}`);
    check('9 unchanged reviewer/note', body.resolvedBy === 'operator-1' && body.resolutionNote === 'same business');
  }

  console.log('\n[10] Conflicting second decision -> 400 (immutable history)');
  {
    const { auth: a10, prov: b10, review: r10 } = seedPair(repo, 's10', 'uncertain');
    await post(`/api/reviews/${r10.id}/resolve`, { decision: 'approve', resolvedBy: 'op', resolutionNote: 'yes' });
    const { status } = await post(`/api/reviews/${r10.id}/resolve`, { decision: 'reject', resolvedBy: 'op', resolutionNote: 'no' });
    check('10 approve->reject -> 400', status === 400, String(status));
    check('10 history not rewritten', repo.getReviewItem(r10.id).status === 'approved');
    const ref10 = repo.findProviderIdentity('web_extraction', 's10-rec-B');
    check('10 merge not undone by failed reject', ref10.entityId === a10.entityId);
  }

  console.log('\n[12] Unrelated entity remains isolated');
  {
    check('12 unrelated isolated entity still ACTIVE', repo.getEntityById(seeded.iso.entity.entityId).status === 'ACTIVE');
    check('12 unrelated provider mapping unchanged', repo.findProviderIdentity('geoapify', 'iso-rec-C').entityId === seeded.iso.entity.entityId);
    check('12 unrelated observations intact', repo.getObservations(seeded.iso.entity.entityId).length >= 1);
  }

  console.log('\n[13] Underlying enforcement error -> appropriate HTTP error');
  {
    const missing = await post('/api/reviews/rev_does_not_exist/resolve', { decision: 'approve' });
    check('13 resolve unknown review -> 404', missing.status === 404, String(missing.status));
    const missingGet = await get('/api/reviews/rev_does_not_exist');
    check('13 get unknown review detail -> 404', missingGet.status === 404, String(missingGet.status));
    // Relocation review already resolved cannot be re-opened to a different decision -> 400
    const { status: reloStatus } = await post(`/api/reviews/${seeded.relo.review.id}/resolve`, { decision: 'reject' });
    check('13 approve->reject on relocation review -> 400', reloStatus === 400, String(reloStatus));
  }

  closeDatabase();
}

// ---------------------------------------------------------------------------
// Restart (scenario 11) — two child processes over HTTP, sharing one SQLite file
// ---------------------------------------------------------------------------
const RESTART_PREFIX = 'p17-restart';

async function runRestartA() {
  process.env.SQLITE_DATABASE_PATH = TEST_DB;
  const appA = (await import('./src/app.js')).default;
  const db = await initializeDatabase(TEST_DB);
  const repo = new IdentityRepository(db);
  const a = repo.createEntityWithProviderIdentity(
    { canonicalName: 'Restart Alpha', canonicalAddress: '1 Restart Rd' },
    { provider: 'geoapify', providerRecordId: `${RESTART_PREFIX}-A`, resolutionMethod: 'first_observation', resolutionConfidence: 0.9 }
  );
  const b = repo.createEntityWithProviderIdentity(
    { canonicalName: 'Restart Bravo', canonicalAddress: '2 Restart Ave' },
    { provider: 'web_extraction', providerRecordId: `${RESTART_PREFIX}-B`, resolutionMethod: 'provisional_separate', resolutionConfidence: null }
  );
  const review = repo.createReviewItem({
    entityId: a.entity.entityId,
    relatedEntityId: b.entity.entityId,
    provider: 'geoapify', providerRecordId: `${RESTART_PREFIX}-A`,
    relatedProvider: 'web_extraction', relatedProviderRecordId: `${RESTART_PREFIX}-B`,
    matchType: 'uncertain',
    matchScore: 0.6,
    reason: 'restart merge review',
    evidence: { source: 'pairwise_resolution', matchType: 'uncertain' },
    dedupeContext: { providerA: 'geoapify', providerRecordIdA: `${RESTART_PREFIX}-A`, providerB: 'web_extraction', providerRecordIdB: `${RESTART_PREFIX}-B`, matchType: 'uncertain' },
  });
  console.log(`RESTART A: review=${review.id} auth=${a.entity.entityId} prov=${b.entity.entityId}`);
  closeDatabase();

  // Resolve via HTTP
  const httpApp = appA;
  const srv = httpApp.listen(0);
  const p = await new Promise((resolve) => srv.once('listening', () => resolve(srv.address().port)));
  const res = await fetch(`http://127.0.0.1:${p}/api/reviews/${review.id}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approve', resolvedBy: 'restart-operator', resolutionNote: 'approved across restart' }),
  });
  const bodyJson = await res.json();
  assert.equal(res.status, 200, `restart A resolve: ${res.status}`);
  assert.equal(bodyJson.status, 'approved');
  await new Promise((resolve) => srv.close(() => resolve()));
}

async function runRestartB() {
  process.env.SQLITE_DATABASE_PATH = TEST_DB;
  const appB = (await import('./src/app.js')).default;
  const db = await initializeDatabase(TEST_DB);
  const repo = new IdentityRepository(db);
  const key = repo.buildReviewDedupeKey({ providerA: 'geoapify', providerRecordIdA: `${RESTART_PREFIX}-A`, providerB: 'web_extraction', providerRecordIdB: `${RESTART_PREFIX}-B`, matchType: 'uncertain' });
  const rev = repo.getReviewItemByDedupeKey(key);
  assert.ok(rev, 'review must survive restart');
  assert.equal(rev.status, 'approved');
  assert.equal(rev.resolvedBy, 'restart-operator');
  const mapping = repo.findProviderIdentity('web_extraction', `${RESTART_PREFIX}-B`);
  assert.ok(mapping && mapping.entityId === rev.entityId, 'mapping must be merged after restart');
  const prov = repo.getEntityById(rev.relatedEntityId);
  assert.ok(prov && prov.status === 'MERGED', 'provisional entity must be MERGED after restart');
  closeDatabase();

  // Confirm via HTTP detail
  const httpApp = appB;
  const srv = httpApp.listen(0);
  const p = await new Promise((resolve) => srv.once('listening', () => resolve(srv.address().port)));
  const detailRes = await fetch(`http://127.0.0.1:${p}/api/reviews/${rev.id}`);
  const detail = await detailRes.json();
  assert.equal(detailRes.status, 200);
  assert.equal(detail.review.status, 'approved');
  await new Promise((resolve) => srv.close(() => resolve()));
  console.log(`RESTART B: review approved after restart, mapping merged, detail confirmed via HTTP`);
}

function runChild(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, PHASE17_MODE: mode, SQLITE_DATABASE_PATH: TEST_DB },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Phase 17 child ${mode} exited with ${code}`))));
  });
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
async function main() {
  const mode = process.env.PHASE17_MODE;
  if (mode === 'restartA') return runRestartA();
  if (mode === 'restartB') return runRestartB();

  console.log('='.repeat(72));
  console.log('PHASE 17 — Operator Review + Cold-Call Intelligence Boundary');
  console.log('='.repeat(72));

  cleanupDbFiles();

  await runScenarios();

  console.log('\n[11] Persistence across process restart (HTTP, two children)');
  try {
    await runChild('restartA');
    await runChild('restartB');
    // Re-open and confirm externally.
    const repo = await getRepo();
    const key = repo.buildReviewDedupeKey({ providerA: 'geoapify', providerRecordIdA: `${RESTART_PREFIX}-A`, providerB: 'web_extraction', providerRecordIdB: `${RESTART_PREFIX}-B`, matchType: 'uncertain' });
    const rev = repo.getReviewItemByDedupeKey(key);
    check('11 review approved + stable after restart', rev && rev.status === 'approved', rev && rev.status);
    check('11 merged identity state survives restart', rev && repo.findProviderIdentity('web_extraction', `${RESTART_PREFIX}-B`).entityId === rev.entityId);
  } catch (e) {
    check('11 restart persistence scenario failed', false, e.message);
  }

  await stopServer();

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