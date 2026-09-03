/**
 * Temporal Relocation Analyzer — Phase 15
 *
 * Uses the observation timestamps already persisted (observation.observed_at) to
 * distinguish a genuine relocation over time from two simultaneous same-brand
 * branches. It is a READ-ONLY analysis layer: it never changes EntityResolution
 * scoring, never merges entities, and never overwrites canonical data. Its output
 * is evidence used to decide whether a human-review item should be created.
 *
 * Discriminator (matches Phase 14 semantics, adds the temporal axis):
 *   - RELOCATED: >=2 distinct addresses observed in chronological order (old
 *     before new) WITH a stable hard identifier carried across the move (same
 *     phone, same website/domain, or the same provider record spanning both
 *     addresses) and no contradicting identifier.
 *   - SAME_BRAND_DIFFERENT_LOCATION: >=2 distinct addresses observed at ~the same
 *     time (simultaneous) with a differing local phone (branch signal).
 *   - UNCERTAIN: insufficient temporal evidence (fewer than 2 distinct
 *     addresses), address-difference-alone (no stable identifier), or otherwise
 *     ambiguous. Relocation is NEVER forced.
 */

import { normalizePhone, normalizeWebsite } from './EntityResolution.js';

export const TEMPORAL_VERDICT = Object.freeze({
  RELOCATED: 'relocated',
  SAME_BRAND_DIFFERENT_LOCATION: 'same_brand_different_location',
  UNCERTAIN: 'uncertain',
});

const DEFAULTS = {
  // Two differing address observations within this window are treated as
  // "simultaneous" (a branch/data-discrepancy signal), not a move over time.
  SIMULTANEOUS_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
};

function toTime(observedAt) {
  if (!observedAt) return null;
  const t = Date.parse(observedAt);
  return Number.isNaN(t) ? null : t;
}

function normAddress(obs) {
  const raw = obs.normalizedValue || obs.value;
  return raw ? String(raw).trim().toLowerCase() : null;
}

/**
 * Analyze an entity's observation history for a relocation-vs-branch verdict.
 *
 * @param {Array<Object>} observations - observation rows ({ fieldPath, value,
 *   normalizedValue, observedAt, provider, providerRecordId })
 * @param {Object} [options]
 * @returns {{ verdict: string, reason: string, evidence: Object }}
 */
export function analyzeTemporalRelocation(observations = [], options = {}) {
  const simultaneousWindowMs = options.simultaneousWindowMs ?? DEFAULTS.SIMULTANEOUS_WINDOW_MS;

  const addressObs = (observations || [])
    .filter((o) => o && o.fieldPath === 'location.full_address' && (o.normalizedValue || o.value))
    .map((o) => ({ norm: normAddress(o), time: toTime(o.observedAt), providerRecordId: o.providerRecordId || null, raw: o.value }))
    .filter((o) => o.norm && o.time != null)
    .sort((a, b) => a.time - b.time);

  const distinct = [...new Set(addressObs.map((o) => o.norm))];

  const baseEvidence = {
    addressObservationCount: addressObs.length,
    distinctAddressCount: distinct.length,
    distinctAddresses: distinct,
  };

  // (D) Insufficient history — need at least two distinct addresses over time.
  if (addressObs.length < 2 || distinct.length < 2) {
    return {
      verdict: TEMPORAL_VERDICT.UNCERTAIN,
      reason: 'Insufficient temporal history: fewer than two distinct addresses observed.',
      evidence: baseEvidence,
    };
  }

  // Old = first-observed address; New = first differing address (by time).
  const oldNorm = addressObs[0].norm;
  const newObs = addressObs.find((o) => o.norm !== oldNorm);
  const oldGroup = addressObs.filter((o) => o.norm === oldNorm);
  const newGroup = addressObs.filter((o) => o.norm === newObs.norm);

  const oldEarliest = Math.min(...oldGroup.map((o) => o.time));
  const newEarliest = Math.min(...newGroup.map((o) => o.time));
  const gapMs = newEarliest - oldEarliest;
  const simultaneous = Math.abs(gapMs) <= simultaneousWindowMs;
  const chronological = gapMs > simultaneousWindowMs;

  // Identifier stability across the whole history.
  const phones = new Set(
    (observations || [])
      .filter((o) => o && o.fieldPath === 'contact.phone')
      .map((o) => normalizePhone(o.normalizedValue || o.value))
      .filter(Boolean)
  );
  const websites = new Set(
    (observations || [])
      .filter((o) => o && o.fieldPath === 'contact.website')
      .map((o) => normalizeWebsite(o.normalizedValue || o.value))
      .filter(Boolean)
  );

  const phonePresent = phones.size >= 1;
  const stablePhone = phones.size === 1;
  const multiPhone = phones.size >= 2;
  const websitePresent = websites.size >= 1;
  const stableWebsite = websites.size === 1;
  const multiWebsite = websites.size >= 2;

  // Same provider record reporting BOTH the old and the new address is strong
  // stable-identity evidence for a move.
  const oldProviders = new Set(oldGroup.map((o) => o.providerRecordId).filter(Boolean));
  const newProviders = new Set(newGroup.map((o) => o.providerRecordId).filter(Boolean));
  const providerSpan = [...oldProviders].some((p) => newProviders.has(p));

  const evidence = {
    ...baseEvidence,
    addressFrom: oldNorm,
    addressTo: newObs.norm,
    oldEarliest: new Date(oldEarliest).toISOString(),
    newEarliest: new Date(newEarliest).toISOString(),
    gapMs,
    simultaneous,
    chronological,
    stablePhone,
    multiPhone,
    stableWebsite,
    multiWebsite,
    providerSpan,
  };

  // (C) Simultaneous different addresses. A differing local phone identifies two
  // branches of the same brand; without that discriminator it stays uncertain
  // (a simultaneous address discrepancy is not a proven move).
  if (simultaneous) {
    if (multiPhone) {
      return {
        verdict: TEMPORAL_VERDICT.SAME_BRAND_DIFFERENT_LOCATION,
        reason: 'Two distinct addresses observed at ~the same time with differing phones (branch signal, not a move).',
        evidence,
      };
    }
    return {
      verdict: TEMPORAL_VERDICT.UNCERTAIN,
      reason: 'Two distinct addresses observed simultaneously without a differentiating identifier; not a proven relocation.',
      evidence,
    };
  }

  // (B) Chronological old -> new. Require a stable identifier carried across the
  // move and no contradicting identifier; otherwise this is address-difference
  // alone and must stay uncertain.
  if (chronological) {
    const stableIdentity = (phonePresent && stablePhone) || (websitePresent && stableWebsite) || providerSpan;
    const contradicted = multiPhone || multiWebsite;
    if (stableIdentity && !contradicted) {
      return {
        verdict: TEMPORAL_VERDICT.RELOCATED,
        reason: 'Address changed over time with stable identity signals carried across the move.',
        evidence,
      };
    }
    return {
      verdict: TEMPORAL_VERDICT.UNCERTAIN,
      reason: contradicted
        ? 'Address changed over time but identifiers also changed; relocation not confirmed.'
        : 'Address changed over time without a stable identifier to confirm a move (address-difference alone).',
      evidence,
    };
  }

  return {
    verdict: TEMPORAL_VERDICT.UNCERTAIN,
    reason: 'Ambiguous temporal ordering of address observations.',
    evidence,
  };
}

/**
 * Convenience: analyze an entity's persisted observation history via a repository.
 * @param {Object} repo - IdentityRepository
 * @param {string} entityId
 * @param {Object} [options]
 */
export function analyzeEntityRelocation(repo, entityId, options = {}) {
  if (!repo || !entityId) {
    return { verdict: TEMPORAL_VERDICT.UNCERTAIN, reason: 'Missing repository or entityId.', evidence: {} };
  }
  const observations = repo.getObservations(entityId);
  return analyzeTemporalRelocation(observations, options);
}

export default { analyzeTemporalRelocation, analyzeEntityRelocation, TEMPORAL_VERDICT };
