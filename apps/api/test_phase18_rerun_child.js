/**
 * PHASE 18 — Child-process re-run runner (Scenario 9).
 *
 * Opened by test_phase18_reresearch.js in a FRESH Node process to prove the
 * review→re-run workflow survives a process restart. Reads the db path and
 * review id from env, re-runs the affected research, and prints a compact JSON
 * summary that the parent asserts against.
 *
 * Every async step is awaited; no process.exit before promises settle.
 */
import { initializeDatabase, closeDatabase } from './src/db/client.js';
import { IdentityRepository } from './src/db/IdentityRepository.js';
import { BusinessEntity } from './src/db/schema.js';
import { sql } from 'drizzle-orm';
import { ReResearchService } from './src/services/ReResearchService.js';

// Keep STDOUT JSON-only: route library console.log noise (DB init) to stderr so
// the parent can parse the final JSON exactly.
const originalLog = console.log.bind(console);
console.log = (...args) => { console.error(...args); };

async function run() {
  const dbPath = process.env.SQLITE_RESTART_DB || './test_phase18_restart.db';
  const reviewId = process.env.__RERUN_REVIEW_ID;

  const db = await initializeDatabase(dbPath);
  const repo = new IdentityRepository(db);

  const review = repo.getReviewItem(reviewId);
  const rerun = new ReResearchService(db);
  const out = await rerun.rerunReview(reviewId);

  const entities = repo.db.select({ n: sql`count(*)` }).from(BusinessEntity).all();
  const entityCount = Number(entities[0]?.n ?? 0);

  // The secondary (related) mapping after a merge points at the authoritative entity.
  const recBMapping = repo.findProviderIdentity('web_extraction', 'rs-rec-B');
  const geoTrace = out.results.find((r) => r.provider === 'geoapify');

  const result = {
    reviewStatus: review?.status,
    entityCount,
    recBMapsTo: recBMapping ? recBMapping.entityId : null,
    results: out.results.map((r) => ({ provider: r.provider, providerRecordId: r.providerRecordId, status: r.status, entityId: r.entityId })),
    intelligenceName: geoTrace?.intelligence?.identity?.name || null,
  };

  closeDatabase();
  // Restore stdout logging and emit the clean JSON payload.
  console.log = originalLog;
  process.stdout.write(JSON.stringify(result) + '\n');
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
