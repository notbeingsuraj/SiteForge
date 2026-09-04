#!/usr/bin/env node
/**
 * Webloom Review CLI — Deterministic operator interface for identity reviews.
 *
 * Uses the existing IdentityRepository + enforceReviewDecision() — no
 * duplicate decision logic.
 *
 * Usage:
 *   node review-cli.js list [--status pending|approved|rejected]
 *   node review-cli.js show <reviewId>
 *   node review-cli.js approve <reviewId> [--note "..."] [--by "..."] [--address-to "..."]
 *   node review-cli.js reject <reviewId> [--note "..."] [--by "..."]
 *
 * Environment:
 *   SQLITE_DATABASE_PATH  — database file (default: ./webloom.db)
 */

import { initializeDatabase, closeDatabase } from './src/db/client.js';
import { IdentityRepository, ValidationError, NotFoundError } from './src/db/IdentityRepository.js';

// ─── Argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] || '';

function flag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  // Boolean flag with no value
  if (next === undefined || next.startsWith('--')) return true;
  return next;
}

function positional(n) {
  return args[n];
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

const W = 72;

function sep(char = '─') {
  return char.repeat(W);
}

function heading(text) {
  return `\n${sep('═')}\n  ${text}\n${sep('═')}`;
}

function subheading(text) {
  return `\n  ${text}`;
}

function kv(key, val, indent = '  ') {
  const k = String(key).padEnd(26);
  const v = val === null || val === undefined ? '(none)' : String(val);
  return `${indent}${k}${v}`;
}

function formatTimestamp(ts) {
  if (!ts) return '(none)';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toISOString().replace('T', ' ').replace('.000Z', '');
  } catch {
    return String(ts);
  }
}

function formatMatchType(mt) {
  const labels = {
    same_entity: 'same_entity',
    uncertain: 'uncertain',
    different_entity: 'different_entity',
    same_brand_different_location: 'same_brand_different_location',
    relocated_entity: 'relocated_entity',
  };
  return labels[mt] || mt;
}

function formatStatus(s) {
  const colors = { pending: '⏳', approved: '✅', rejected: '❌' };
  return `${colors[s] || '?'} ${s}`;
}

function truncate(str, max = 60) {
  if (!str) return '(none)';
  const s = String(str);
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

// ─── Review detail renderers ────────────────────────────────────────────────

function renderPairwiseReview(detail) {
  const { review, entities, providerIdentities, context } = detail;
  const evidence = review.evidence && typeof review.evidence === 'object' ? review.evidence : {};
  const entity = entities.entity;
  const related = entities.relatedEntity;

  const lines = [];
  lines.push(heading(`REVIEW ${review.id}`));
  lines.push(kv('Status', formatStatus(review.status)));
  lines.push(kv('Type', formatMatchType(review.matchType)));
  lines.push(kv('Score', review.matchScore != null ? review.matchScore.toFixed(3) : '(none)'));
  lines.push(kv('Dedupe key', truncate(review.dedupeKey)));
  lines.push(kv('Created', formatTimestamp(review.createdAt)));
  if (review.resolvedAt) {
    lines.push(kv('Resolved', formatTimestamp(review.resolvedAt)));
    lines.push(kv('Resolved by', review.resolvedBy));
    lines.push(kv('Note', review.resolutionNote));
  }

  lines.push(subheading('Entity A (primary):'));
  if (entity) {
    lines.push(kv('ID', entity.entityId));
    lines.push(kv('Name', entity.canonicalName));
    lines.push(kv('Phone', entity.canonicalPhone));
    lines.push(kv('Website', entity.canonicalWebsite));
    lines.push(kv('Address', truncate(entity.canonicalAddress)));
    lines.push(kv('Status', entity.status));
  } else {
    lines.push('  (not found)');
  }

  lines.push(subheading('Entity B (secondary):'));
  if (related) {
    lines.push(kv('ID', related.entityId));
    lines.push(kv('Name', related.canonicalName));
    lines.push(kv('Phone', related.canonicalPhone));
    lines.push(kv('Website', related.canonicalWebsite));
    lines.push(kv('Address', truncate(related.canonicalAddress)));
    lines.push(kv('Status', related.status));
  } else {
    lines.push('  (no secondary entity)');
  }

  lines.push(subheading('Provider identities:'));
  if (providerIdentities.provider) {
    const p = providerIdentities.provider;
    lines.push(kv('Provider A', `${p.provider} / ${p.providerRecordId}`, '    '));
  }
  if (providerIdentities.relatedProvider) {
    const rp = providerIdentities.relatedProvider;
    lines.push(kv('Provider B', `${rp.provider} / ${rp.providerRecordId}`, '    '));
  }

  lines.push(subheading('Evidence signals:'));
  lines.push(kv('Source', evidence.source || review.matchType));
  lines.push(kv('Match type (evidence)', evidence.matchType));
  lines.push(kv('Match score (evidence)', typeof evidence.matchScore === 'number' ? evidence.matchScore.toFixed(3) : '(none)'));

  // Entity observations summary
  const entityObs = context.observations || [];
  if (entityObs.length > 0) {
    const byField = {};
    for (const o of entityObs) {
      if (!byField[o.fieldPath]) byField[o.fieldPath] = [];
      byField[o.fieldPath].push(o);
    }
    lines.push(subheading('Observations (entity A):'));
    for (const [field, obs] of Object.entries(byField)) {
      const vals = [...new Set(obs.map((o) => o.normalizedValue || o.value))];
      lines.push(kv(field, vals.join(' | ').slice(0, 55), '    '));
    }
  }

  const cf = context.canonicalFields || [];
  if (cf.length > 0) {
    lines.push(subheading('Canonical fields (entity A):'));
    for (const f of cf) {
      lines.push(kv(f.fieldPath, truncate(`${f.value} [${f.provenance}/${f.confidence}]`), '    '));
    }
  }

  const conflicts = context.conflicts || [];
  if (conflicts.length > 0) {
    lines.push(subheading('Conflicts:'));
    for (const c of conflicts) {
      lines.push(kv(c.fieldPath, `status=${c.status}`, '    '));
    }
  }

  lines.push(subheading('Reason:'));
  lines.push(`  ${review.reason || '(none)'}`);
  lines.push('');
  return lines.join('\n');
}

function renderRelocationReview(detail) {
  const { review, entities, providerIdentities, context } = detail;
  const evidence = review.evidence && typeof review.evidence === 'object' ? review.evidence : {};
  const entity = entities.entity;

  const lines = [];
  lines.push(heading(`REVIEW ${review.id}`));
  lines.push(kv('Status', formatStatus(review.status)));
  lines.push(kv('Type', formatMatchType(review.matchType)));
  lines.push(kv('Score', review.matchScore != null ? review.matchScore.toFixed(3) : '(none)'));
  lines.push(kv('Dedupe key', truncate(review.dedupeKey)));
  lines.push(kv('Created', formatTimestamp(review.createdAt)));
  if (review.resolvedAt) {
    lines.push(kv('Resolved', formatTimestamp(review.resolvedAt)));
    lines.push(kv('Resolved by', review.resolvedBy));
    lines.push(kv('Note', review.resolutionNote));
  }

  lines.push(subheading('Entity:'));
  if (entity) {
    lines.push(kv('ID', entity.entityId));
    lines.push(kv('Name', entity.canonicalName));
    lines.push(kv('Phone', entity.canonicalPhone));
    lines.push(kv('Website', entity.canonicalWebsite));
    lines.push(kv('Current address', truncate(entity.canonicalAddress)));
    lines.push(kv('Status', entity.status));
  } else {
    lines.push('  (entity not found)');
  }

  lines.push(subheading('Relocation evidence:'));
  lines.push(kv('Verdict', evidence.verdict || review.matchType));
  lines.push(kv('Previous address', evidence.addressFrom || '(none)'));
  lines.push(kv('New address', evidence.addressTo || '(none)'));
  lines.push(kv('Chronological', evidence.chronological != null ? String(evidence.chronological) : '(unknown)'));
  lines.push(kv('Stable phone', evidence.stablePhone != null ? String(evidence.stablePhone) : '(unknown)'));
  lines.push(kv('Stable website', evidence.stableWebsite != null ? String(evidence.stableWebsite) : '(unknown)'));
  lines.push(kv('Provider span', evidence.providerSpan != null ? String(evidence.providerSpan) : '(unknown)'));
  lines.push(kv('Address observations', evidence.addressObservationCount || 0));
  lines.push(kv('Distinct addresses', evidence.distinctAddressCount || 0));
  if (evidence.addressFrom && evidence.addressTo) {
    lines.push(kv('Gap', evidence.gapMs != null ? `${Math.round(evidence.gapMs / 1000)}s` : '(unknown)'));
    lines.push(kv('Simultaneous', evidence.simultaneous != null ? String(evidence.simultaneous) : '(unknown)'));
  }

  if (providerIdentities.provider) {
    lines.push(subheading('Provider identity:'));
    const p = providerIdentities.provider;
    lines.push(kv('Provider', p.provider));
    lines.push(kv('Record ID', p.providerRecordId));
  }

  const entityObs = context.observations || [];
  if (entityObs.length > 0) {
    lines.push(subheading(`Observations (${entityObs.length} total):`));
    for (const o of entityObs.slice(0, 10)) {
      lines.push(kv(o.fieldPath, `${truncate(o.normalizedValue || o.value, 35)} @ ${formatTimestamp(o.observedAt)}`, '    '));
    }
    if (entityObs.length > 10) {
      lines.push(`    ... ${entityObs.length - 10} more`);
    }
  }

  lines.push(subheading('Reason:'));
  lines.push(`  ${review.reason || '(none)'}`);
  lines.push('');
  return lines.join('\n');
}

function renderBranchReview(detail) {
  const { review, entities, providerIdentities, context } = detail;
  const evidence = review.evidence && typeof review.evidence === 'object' ? review.evidence : {};
  const entity = entities.entity;
  const related = entities.relatedEntity;

  const lines = [];
  lines.push(heading(`REVIEW ${review.id}`));
  lines.push(kv('Status', formatStatus(review.status)));
  lines.push(kv('Type', formatMatchType(review.matchType)));
  lines.push(kv('Score', review.matchScore != null ? review.matchScore.toFixed(3) : '(none)'));
  lines.push(kv('Dedupe key', truncate(review.dedupeKey)));
  lines.push(kv('Created', formatTimestamp(review.createdAt)));
  if (review.resolvedAt) {
    lines.push(kv('Resolved', formatTimestamp(review.resolvedAt)));
    lines.push(kv('Resolved by', review.resolvedBy));
    lines.push(kv('Note', review.resolutionNote));
  }

  lines.push(subheading('Branch identity A:'));
  if (entity) {
    lines.push(kv('ID', entity.entityId));
    lines.push(kv('Name', entity.canonicalName));
    lines.push(kv('Address', truncate(entity.canonicalAddress)));
    lines.push(kv('Status', entity.status));
  }

  lines.push(subheading('Branch identity B:'));
  if (related) {
    lines.push(kv('ID', related.entityId));
    lines.push(kv('Name', related.canonicalName));
    lines.push(kv('Address', truncate(related.canonicalAddress)));
    lines.push(kv('Status', related.status));
  } else {
    lines.push('  (no secondary entity)');
  }

  if (providerIdentities.provider) {
    lines.push(subheading('Provider A:'));
    lines.push(kv('Provider', `${providerIdentities.provider.provider} / ${providerIdentities.provider.providerRecordId}`, '    '));
  }
  if (providerIdentities.relatedProvider) {
    lines.push(subheading('Provider B:'));
    lines.push(kv('Provider', `${providerIdentities.relatedProvider.provider} / ${providerIdentities.relatedProvider.providerRecordId}`, '    '));
  }

  lines.push(subheading('Why separate:'));
  lines.push('  Same brand name observed, but different locations with');
  lines.push('  differing branch identifiers (phone, address). These are');
  lines.push('  distinct business entities; approval confirms they stay separate.');
  lines.push('');

  lines.push(subheading('Reason:'));
  lines.push(`  ${review.reason || '(none)'}`);
  lines.push('');
  return lines.join('\n');
}

function renderReviewDetail(detail) {
  if (!detail) return '\n  Review not found.\n';
  const { review } = detail;
  if (review.matchType === 'relocated_entity') return renderRelocationReview(detail);
  if (review.matchType === 'same_brand_different_location') return renderBranchReview(detail);
  // Default: pairwise (uncertain / same_entity / other)
  return renderPairwiseReview(detail);
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function cmdList() {
  const status = flag('--status') || 'pending';
  const validStatuses = new Set(['pending', 'approved', 'rejected']);
  if (!validStatuses.has(status)) {
    console.error(`Invalid status: ${status}. Use: pending, approved, rejected`);
    process.exitCode = 1;
    return;
  }

  const db = await initializeDatabase(process.env.SQLITE_DATABASE_PATH || './webloom.db');
  const repo = new IdentityRepository(db);
  const reviews = repo.getReviewItems({ status });

  if (reviews.length === 0) {
    console.log(`\n  No ${status} reviews found.\n`);
    return;
  }

  console.log(`\n  ${reviews.length} ${status} review(s)\n`);
  console.log('  ' + '─'.repeat(W - 2));
  console.log(`  ${'ID'.padEnd(18)} ${'Type'.padEnd(38)} ${'Score'.padEnd(8)} Created`);
  console.log('  ' + '─'.repeat(W - 2));

  for (const r of reviews) {
    const score = r.matchScore != null ? r.matchScore.toFixed(3) : '—';
    const created = formatTimestamp(r.createdAt);
    const short = r.id.slice(0, 16);
    console.log(`  ${short.padEnd(18)} ${formatMatchType(r.matchType).padEnd(38)} ${score.padEnd(8)} ${created}`);
  }
  console.log('  ' + '─'.repeat(W - 2));
  console.log(`  Use: node review-cli.js show <full-id>\n`);
}

async function cmdShow() {
  const reviewId = positional(1);
  if (!reviewId) {
    console.error('Usage: node review-cli.js show <reviewId>');
    process.exitCode = 1;
    return;
  }

  const db = await initializeDatabase(process.env.SQLITE_DATABASE_PATH || './webloom.db');
  const repo = new IdentityRepository(db);
  const detail = repo.getReviewDetail(reviewId);
  console.log(renderReviewDetail(detail));
}

async function cmdApprove() {
  const reviewId = positional(1);
  if (!reviewId) {
    console.error('Usage: node review-cli.js approve <reviewId> [--note "..."] [--by "..."] [--address-to "..."]');
    process.exitCode = 1;
    return;
  }
  const note = flag('--note') || flag('--resolutionNote') || null;
  const by = flag('--by') || flag('--resolvedBy') || 'operator-cli';
  const addressTo = flag('--address-to') || null;

  const db = await initializeDatabase(process.env.SQLITE_DATABASE_PATH || './webloom.db');
  const repo = new IdentityRepository(db);
  try {
    const item = repo.resolveReviewItem(reviewId, 'approved', { resolvedBy: by, note, addressTo });
    console.log(`\n  ✅ Approved: ${item.id}`);
    console.log(`     Status: ${item.status}`);
    console.log(`     Resolved by: ${item.resolvedBy}`);
    console.log(`     Note: ${item.resolutionNote || '(none)'}\n`);
  } catch (err) {
    if (err instanceof NotFoundError) {
      console.error(`\n  ❌ Review not found: ${reviewId}\n`);
      process.exitCode = 1;
    } else if (err instanceof ValidationError) {
      console.error(`\n  ❌ Cannot approve: ${err.message}\n`);
      process.exitCode = 1;
    } else {
      throw err;
    }
  }
}

async function cmdReject() {
  const reviewId = positional(1);
  if (!reviewId) {
    console.error('Usage: node review-cli.js reject <reviewId> [--note "..."] [--by "..."]');
    process.exitCode = 1;
    return;
  }
  const note = flag('--note') || flag('--resolutionNote') || null;
  const by = flag('--by') || flag('--resolvedBy') || 'operator-cli';

  const db = await initializeDatabase(process.env.SQLITE_DATABASE_PATH || './webloom.db');
  const repo = new IdentityRepository(db);
  try {
    const item = repo.resolveReviewItem(reviewId, 'rejected', { resolvedBy: by, note });
    console.log(`\n  ❌ Rejected: ${item.id}`);
    console.log(`     Status: ${item.status}`);
    console.log(`     Resolved by: ${item.resolvedBy}`);
    console.log(`     Note: ${item.resolutionNote || '(none)'}\n`);
  } catch (err) {
    if (err instanceof NotFoundError) {
      console.error(`\n  ❌ Review not found: ${reviewId}\n`);
      process.exitCode = 1;
    } else if (err instanceof ValidationError) {
      console.error(`\n  ❌ Cannot reject: ${err.message}\n`);
      process.exitCode = 1;
    } else {
      throw err;
    }
  }
}

// ─── Entry ──────────────────────────────────────────────────────────────────

async function main() {
  try {
    switch (command) {
      case 'list':
        await cmdList();
        break;
      case 'show':
        await cmdShow();
        break;
      case 'approve':
        await cmdApprove();
        break;
      case 'reject':
        await cmdReject();
        break;
      default:
        console.log(`
  Webloom Review CLI

  Usage:
    node review-cli.js list [--status pending|approved|rejected]
    node review-cli.js show <reviewId>
    node review-cli.js approve <reviewId> [--note "..."] [--by "..."] [--address-to "..."]
    node review-cli.js reject <reviewId> [--note "..."] [--by "..."]

  Environment:
    SQLITE_DATABASE_PATH  — database file (default: ./webloom.db)
`);
        break;
    }
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});