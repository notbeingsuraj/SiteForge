import express from 'express';
import { initializeDatabase } from '../db/client.js';
import { IdentityRepository, ValidationError, NotFoundError } from '../db/IdentityRepository.js';

const router = express.Router();

// Whitelist of review statuses accepted as a query filter and returned in lists.
const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

/**
 * Compact, operator-facing summary of a review's evidence so a list can say
 * "why Webloom is uncertain" without exposing raw internal rows.
 */
function summarizeEvidence(review) {
  const evidence = review.evidence && typeof review.evidence === 'object' ? review.evidence : {};
  if (review.matchType === 'relocated_entity' || evidence.source === 'temporal_analysis') {
    return {
      source: evidence.source || 'temporal_analysis',
      verdict: evidence.verdict || review.matchType,
      addressFrom: evidence.addressFrom || null,
      addressTo: evidence.addressTo || null,
    };
  }
  if (evidence.source === 'pairwise_resolution') {
    return {
      source: 'pairwise_resolution',
      matchType: evidence.matchType || review.matchType,
      matchScore: typeof evidence.matchScore === 'number' ? evidence.matchScore : review.matchScore,
    };
  }
  return {
    source: evidence.source || review.matchType,
    matchScore: review.matchScore,
  };
}

/**
 * Project a review item into the operator-facing list shape (no raw internals
 * beyond what is needed to triage).
 */
function toListShape(review) {
  return {
    id: review.id,
    matchType: review.matchType,
    status: review.status,
    entityId: review.entityId,
    relatedEntityId: review.relatedEntityId || null,
    provider: review.provider || null,
    providerRecordId: review.providerRecordId || null,
    relatedProvider: review.relatedProvider || null,
    relatedProviderRecordId: review.relatedProviderRecordId || null,
    matchScore: review.matchScore,
    reason: review.reason || null,
    evidence: summarizeEvidence(review),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

/**
 * Resolve the review repository, honoring the same SQLite path convention the
 * rest of the API uses.
 */
async function getRepo() {
  const db = await initializeDatabase(process.env.SQLITE_DATABASE_PATH || './webloom.db');
  return new IdentityRepository(db);
}

/**
 * Translate the HTTP decision token into the repository decision, and validate
 * the request body at the HTTP boundary only (business rules stay in the repo).
 * @returns {{ decision: 'approved'|'rejected', options: Object }}
 */
function parseResolveBody(body) {
  const decision = body?.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    throw new ValidationError("decision must be 'approve' or 'reject'");
  }
  const resolvedDecision = decision === 'approve' ? 'approved' : 'rejected';

  const note = typeof body?.resolutionNote === 'string' && body.resolutionNote.trim() !== ''
    ? body.resolutionNote.trim()
    : (typeof body?.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null);
  const resolvedBy = typeof body?.resolvedBy === 'string' && body.resolvedBy.trim() !== ''
    ? body.resolvedBy.trim()
    : null;

  const options = { resolvedBy, note };
  if (typeof body?.evidence?.addressTo === 'string' && body.evidence.addressTo.trim() !== '') {
    options.addressTo = body.evidence.addressTo.trim();
  }
  return { decision: resolvedDecision, options };
}

/**
 * GET /api/reviews
 * List review items. Filters by `?status=` (default: pending).
 * Returns only the fields an operator needs to triage the queue.
 */
router.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status !== '' ? req.query.status : 'pending';
    if (!REVIEW_STATUSES.has(status)) {
      return res.status(400).json({ error: `status must be one of: ${[...REVIEW_STATUSES].join(', ')}` });
    }

    const repo = await getRepo();
    const reviews = repo.getReviewItems({ status }).map(toListShape);
    return res.json({ reviews, count: reviews.length, status });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reviews/:reviewId
 * Full operator-facing detail with every piece of the decision context.
 */
router.get('/:reviewId', async (req, res, next) => {
  try {
    const repo = await getRepo();
    const detail = repo.getReviewDetail(req.params.reviewId);
    if (!detail) {
      return res.status(404).json({ error: `Review ${req.params.reviewId} not found` });
    }
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews/:reviewId/resolve
 * Delegate to the existing atomic, idempotent repository enforcement boundary.
 * Body: { decision: 'approve'|'reject', resolvedBy?, resolutionNote?|note?,
 *        evidence?: { addressTo? } }
 */
router.post('/:reviewId/resolve', async (req, res, next) => {
  try {
    const { decision, options } = parseResolveBody(req.body);
    const repo = await getRepo();

    // Let the repository's own idempotency/validation rules produce the result.
    const item = repo.resolveReviewItem(req.params.reviewId, decision, options);
    return res.json({
      id: item.id,
      matchType: item.matchType,
      status: item.status,
      resolvedBy: item.resolvedBy,
      resolutionNote: item.resolutionNote,
      resolvedAt: item.resolvedAt,
    });
  } catch (err) {
    // Translate repository NotFound / invalid transitions into appropriate HTTP
    // errors; let anything unexpected fall through to the global error handler.
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

export default router;