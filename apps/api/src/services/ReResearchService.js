/**
 * ReResearchService — Phase 18: Re-run affected research after a resolved review.
 *
 * Closes the Webloom intelligence loop:
 *
 *   OBSERVE → RESOLVE → CANONICALIZE → REVIEW → DECIDE → RESEARCH AGAIN → LEARN
 *
 * The authoritative research path remains BusinessResearchService (and its
 * underlying IdentityRepository + CanonicalizationService + EntityResolution).
 * This service is THIN ORCHESTRATION ONLY — it never re-implements research:
 *
 *   - it reads the persisted post-decision review
 *   - it identifies the affected provider record(s) from the review
 *   - it resolves each provider record to the entity its PERSISTED provider
 *     mapping now points at (the corrected, post-merge / post-relocation state)
 *   - it re-plays the provider's persisted observations through the EXISTING
 *     CanonicalizationService so canonical state re-converges deterministically
 *   - it reloads the canonical profile and regenerates intelligence via the
 *     EXISTING BusinessResearchService.regenerateCanonicalIntelligence()
 *
 * Guarantees:
 *   - No new BusinessEntity is ever created here (re-run never duplicates).
 *   - No ProviderIdentity is ever created here (mappings come from persisted
 *     post-decision state).
 *   - A resolved review is never re-opened; its status is left untouched.
 *   - Canonical data is never destroyed; verified fields win by existing policy.
 *   - Re-running is idempotent: repeating the same review yields the same
 *     entity/canonical/mapping/review state.
 *   - Provider / persistence failures are surfaced explicitly, never masked.
 */

import { IdentityRepository, NotFoundError, ValidationError } from '../db/IdentityRepository.js';
import { CanonicalizationService } from './CanonicalizationService.js';
import BusinessResearchService from './BusinessResearchService.js';

// Provider/kinds labels for provenance reporting in the refreshed snapshot.
const PROVIDER_TRACE_LABEL = {
  geoapify: 'geoapify',
  web_extraction: 'web_extraction',
  persisted: 'persisted',
};

/**
 * Reconstruct a single canonical provider record from the persisted
 * observations of one (entity, provider, providerRecordId) triple.
 *
 * Uses the MOST RECENT observation per field path so the re-run reflects the
 * provider's current state (deterministic, offline). If a provider has no
 * persisted observations at all, returns null => "provider unavailable".
 *
 * @param {Object[]} observations - IdentityRepository.getObservations(entityId, fieldPath?) rows
 * @returns {Object|null} flat canonical record { business, contact, location, ratings }
 */
function reconstructRecordFromObservations(observations) {
  if (!observations || observations.length === 0) return null;

  // Keep the most recent observation per field path.
  const latestByField = new Map();
  for (const obs of observations) {
    const existing = latestByField.get(obs.fieldPath);
    if (!existing || (obs.observedAt || '') >= (existing.observedAt || '')) {
      latestByField.set(obs.fieldPath, obs);
    }
  }

  const get = (fieldPath) => {
    const obs = latestByField.get(fieldPath);
    return obs ? obs.value : null;
  };

  let coordinates = null;
  const latObs = latestByField.get('location.coordinates');
  if (latObs && latObs.value && typeof latObs.value === 'object') {
    coordinates = latObs.value;
  }

  const record = {
    business: {
      name: get('identity.name'),
      category: get('identity.category'),
      description: get('identity.description'),
      business_type: get('identity.business_type'),
      categories: get('identity.categories') || [],
    },
    contact: {
      phone: get('contact.phone'),
      email: get('contact.email'),
      website: get('contact.website'),
    },
    location: {
      full_address: get('location.full_address'),
      street: get('location.street'),
      city: get('location.city'),
      state: get('location.state'),
      country: get('location.country'),
      postal_code: get('location.postal_code'),
      coordinates,
    },
    ratings: {
      rating: get('ratings.rating'),
      review_count: get('ratings.review_count'),
    },
  };

  return record;
}

export class ReResearchService {
  /**
   * @param {Object} dbInstance - drizzle DB instance (from initializeDatabase)
   */
  constructor(dbInstance) {
    if (!dbInstance) {
      throw new ValidationError('Database instance is required');
    }
    this.repo = new IdentityRepository(dbInstance);
    this.canonicalization = new CanonicalizationService(this.repo);
  }

  /**
   * Re-run research for a review that has ALREADY been resolved (approved or
   * rejected). Refuses to run on a pending review.
   *
   * @param {string} reviewId
   * @param {Object} [options]
   * @returns {Promise<Object>} {
   *   reviewId, reviewStatus, matchType,
   *   reviewedEntityId, relatedEntityId,
   *   entities: string[],                 // affected entity ids actually re-run
   *   results: Array<{ provider, providerRecordId, entityId, status, detail?,
   *                    rerunCount?, intelligence? }>
   * }
   */
  async rerunReview(reviewId, options = {}) {
    const review = this.repo.getReviewItem(reviewId);
    if (!review) {
      throw new NotFoundError(`Review ${reviewId} not found`);
    }
    if (review.status === 'pending') {
      throw new ValidationError(
        `Review ${reviewId} is still pending; it must be resolved before it can be re-run.`
      );
    }

    // 1) Identify the affected provider records from the review. Both sides of
    //    a pairwise review are affected; a temporal review affects its single
    //    provider record. If the review carries no explicit provider pair (e.g.
    //    a temporal relocation review whose provider records live only on the
    //    entity's observations), derive the affected records from the review
    //    entity's persisted observations.
    const affectedProviders = [];
    const addProvider = (provider, providerRecordId) => {
      if (!provider || !providerRecordId) return;
      const dup = affectedProviders.some(
        (p) => p.provider === provider && p.providerRecordId === providerRecordId
      );
      if (!dup) affectedProviders.push({ provider, providerRecordId });
    };
    addProvider(review.provider, review.providerRecordId);
    addProvider(review.relatedProvider, review.relatedProviderRecordId);

    if (affectedProviders.length === 0) {
      const sourceEntityIds = [review.entityId, review.relatedEntityId].filter(Boolean);
      for (const eid of sourceEntityIds) {
        let obs = [];
        try {
          obs = this.repo.getObservations(eid, null);
        } catch {
          obs = [];
        }
        for (const o of obs) {
          addProvider(o.provider, o.providerRecordId);
        }
      }
    }

    // 2) Re-run each affected provider record against its PERSISTED mapping.
    const results = [];
    const affectedEntityIds = new Set();

    // Candidate entities to pull the provider's persisted observations from:
    // the mapped entity first (post-merge it is the authoritative entity), then
    // the review's own entity/related-entity (post-merge the provisional
    // entity that still holds the historical observations).
    const reviewSourceEntityIds = [
      review.entityId,
      review.relatedEntityId,
    ].filter(Boolean);

    for (const aff of affectedProviders) {
      const result = await this._rerunProviderRecord(
        aff.provider,
        aff.providerRecordId,
        reviewSourceEntityIds
      );
      results.push(result);
      if (result.entityId) affectedEntityIds.add(result.entityId);
    }

    // Edge: a review may carry no provider-record pair (e.g. status-only
    // approval of an "uncertain" review with no provisional record). There is
    // nothing to re-run; report that explicitly rather than fabricating work.
    if (affectedProviders.length === 0) {
      return {
        reviewId,
        reviewStatus: review.status,
        matchType: review.matchType,
        reviewedEntityId: review.entityId,
        relatedEntityId: review.relatedEntityId || null,
        entities: [],
        results: [{ status: 'no_provider_records', detail: 'review carries no provider-record pair to re-run', entityId: null }],
      };
    }

    return {
      reviewId,
      reviewStatus: review.status,
      matchType: review.matchType,
      reviewedEntityId: review.entityId,
      relatedEntityId: review.relatedEntityId || null,
      entities: [...affectedEntityIds],
      results,
    };
  }

  /**
   * Re-run a single (provider, providerRecordId) through the existing
   * canonicalization path and refresh its canonical intelligence.
   *
   * Provider unavailability (no persisted observations) and persistence
   * failures are surfaced explicitly and never destroy canonical state.
   *
   * @param {string} provider
   * @param {string} providerRecordId
   * @param {string[]} reviewSourceEntityIds - candidate entities whose
   *   observations may back this provider record (mapped entity first).
   * @private
   */
  async _rerunProviderRecord(provider, providerRecordId, reviewSourceEntityIds = []) {
    // 2a) Reload the persistent mapping. After a merge approval, this mapping
    //     points at the authoritative entity; after a relocation it still
    //     points at the same entity.
    let mapping;
    try {
      mapping = this.repo.findProviderIdentity(provider, providerRecordId);
    } catch (err) {
      return {
        provider,
        providerRecordId,
        entityId: null,
        status: 'persistence_error',
        detail: `failed to read provider mapping: ${err?.message || String(err)}`,
      };
    }
    if (!mapping) {
      return {
        provider,
        providerRecordId,
        entityId: null,
        status: 'provider_unavailable',
        detail: 'no provider mapping persisted for this record',
      };
    }

    const entityId = mapping.entityId;
    let entity;
    try {
      entity = this.repo.getEntityById(entityId);
    } catch (err) {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'persistence_error',
        detail: `failed to read entity: ${err?.message || String(err)}`,
      };
    }
    if (!entity) {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'entity_not_found',
        detail: 'mapped entity does not exist',
      };
    }

    // A record that maps to an already-MERGED/DEPRECATED entity cannot be woven
    // into canonical output for a live entity. Report explicitly; do not create
    // anything. This is the "provider resolves to an absorbed identity" signal.
    if (entity.status === 'MERGED' || entity.status === 'DEPRECATED') {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'entity_merged',
        detail: `entity ${entityId} is ${entity.status}; record cannot re-run into a live entity`,
      };
    }

    // 2b) Re-run the provider's persisted observations through the EXISTING
    //     canonicalization service. If no observations persist, that is a
    //     "provider unavailable" condition: do not fabricate, do not destroy
    //     canonical state — report it.
    //     Candidate observation sources: the mapped (authoritative) entity
    //     first, then the review's entity / related-entity (a MERGED source
    //     entity retains the historical observations).
    let observations = [];
    try {
      for (const candidateId of [entityId, ...reviewSourceEntityIds]) {
        if (observations.length > 0) break;
        observations = this.repo
          .getObservations(candidateId, null)
          .filter(
            (o) =>
              o.provider === provider &&
              o.providerRecordId === providerRecordId
          );
      }
    } catch (err) {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'persistence_error',
        detail: `failed to read observations: ${err?.message || String(err)}`,
      };
    }

    if (!observations || observations.length === 0) {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'provider_unavailable',
        detail: 'no persisted observations to re-run; canonical state left untouched',
      };
    }

    const record = reconstructRecordFromObservations(observations);
    if (!record) {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'provider_unavailable',
        detail: 'could not reconstruct a provider record from persisted observations',
      };
    }

    // 2c) Re-canonicalize through the authoritative pipeline. This appends a
    //     fresh observation set and lets existing canonical policy (provenance
    //     priority / verified-wins) re-converge deterministically. Verified
    //     canonical fields (e.g. an approved relocation address) are preserved.
    let canonicalization;
    try {
      canonicalization = await this.canonicalization.processObservation({
        entityId,
        provider,
        providerRecordId,
        record,
        sourceInfo: { sourceUrl: null, reRun: true },
        confidence: 0.9,
      });
    } catch (err) {
      // Persistence / canonicalization failure: surface, never fudge success.
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'canonicalization_error',
        detail: err?.message || String(err),
      };
    }

    // 2d) Reload the canonical profile (re-reads persisted canonical fields)
    //     and regenerate deterministic intelligence.
    let intelligence;
    try {
      intelligence = await BusinessResearchService.regenerateCanonicalIntelligence(
        this.repo,
        entityId,
        { provider: PROVIDER_TRACE_LABEL[provider] || provider, source: 'post-review-rerun' }
      );
    } catch (err) {
      return {
        provider,
        providerRecordId,
        entityId,
        status: 'intelligence_error',
        detail: err?.message || String(err),
      };
    }

    return {
      provider,
      providerRecordId,
      entityId,
      status: 'ok',
      detail: 'provider record re-run through canonical research',
      rerunCount: 1,
      canonicalization: {
        canonicalizedFields: canonicalization.canonicalizedFields.length,
        conflictsDetected: canonicalization.conflictsDetected.length,
        provenanceUpgrades: canonicalization.provenanceUpgrades.length,
        observationsStored: canonicalization.observationsStored,
      },
      intelligence,
    };
  }
}

export default ReResearchService;
