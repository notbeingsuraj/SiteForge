/**
 * IdentityRepository — Phase 2: Persistent Business Identity
 * 
 * Provides CRUD and lookup operations for:
 * - BusinessEntity (canonical business identity)
 * - ProviderIdentity (provider → entity mapping)
 * - ResolutionRecord (entity resolution history)
 * 
 * Sits between application/business logic and Drizzle/SQLite.
 * Does NOT contain business logic — pure persistence operations.
 */

import { randomUUID } from 'node:crypto';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { 
  BusinessEntity, 
  ProviderIdentity, 
  ResolutionRecord,
  Source,
  Evidence,
  Claim,
  ClaimSource,
  ClaimEvidence,
  Conflict,
  CanonicalField,
  Observation,
  CanonicalizationDecision
} from './schema.js';

// =============================================================================
// Custom Error Types
// =============================================================================

export class NotFoundError extends Error {
  constructor(message = 'Entity not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DuplicateError extends Error {
  constructor(message = 'Record already exists') {
    super(message);
    this.name = 'DuplicateError';
  }
}

export class ValidationError extends Error {
  constructor(message = 'Invalid input') {
    super(message);
    this.name = 'ValidationError';
  }
}

// =============================================================================
// IdentityRepository
// =============================================================================

export class IdentityRepository {
  /**
   * Create a new IdentityRepository instance.
   * 
   * @param {Object} dbInstance - Drizzle database instance (from getDb())
   */
  constructor(dbInstance) {
    if (!dbInstance) {
      throw new ValidationError('Database instance is required');
    }
    this.db = dbInstance;
  }

  // =========================================================================
  // BusinessEntity Operations
  // =========================================================================

  /**
   * Create a new BusinessEntity with a generated durable ID.
   * 
   * @param {Object} data - { canonicalName, canonicalAddress, canonicalPhone?, canonicalWebsite?, canonicalLatitude?, canonicalLongitude?, category?, status? }
   * @returns {Object} created entity
   * @throws {ValidationError} if required fields are missing
   */
  createEntity(data) {
    if (!data?.canonicalName || typeof data.canonicalName !== 'string') {
      throw new ValidationError('canonicalName is required and must be a string');
    }
    if (!data?.canonicalAddress || typeof data.canonicalAddress !== 'string') {
      throw new ValidationError('canonicalAddress is required and must be a string');
    }

    const entityId = `ent_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      entityId,
      canonicalName: data.canonicalName,
      canonicalPhone: data.canonicalPhone || null,
      canonicalWebsite: data.canonicalWebsite || null,
      canonicalAddress: data.canonicalAddress,
      canonicalLatitude: data.canonicalLatitude ?? null,
      canonicalLongitude: data.canonicalLongitude ?? null,
      category: data.category || null,
      status: data.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(BusinessEntity).values(row).run();
    return this._mapEntityRow(row);
  }

  /**
   * Get a BusinessEntity by its primary key.
   * 
   * @param {string} entityId
   * @returns {Object|null} entity or null if not found
   */
  getEntityById(entityId) {
    if (!entityId || typeof entityId !== 'string') return null;

    const rows = this.db
      .select()
      .from(BusinessEntity)
      .where(eq(BusinessEntity.entityId, entityId))
      .all();
    return rows.length > 0 ? this._mapEntityRow(rows[0]) : null;
  }

  /**
   * Update fields on a BusinessEntity.
   * Only supplied fields are updated; unspecified fields are preserved.
   * 
   * @param {string} entityId
   * @param {Object} patch - partial entity data (same shape as createEntity input)
   * @returns {Object} updated entity
   * @throws {NotFoundError} if entity does not exist
   */
  updateEntity(entityId, patch) {
    const existing = this.getEntityById(entityId);
    if (!existing) {
      throw new NotFoundError(`Entity ${entityId} not found`);
    }

    const updates = {};
    if (patch.canonicalName !== undefined) updates.canonicalName = patch.canonicalName;
    if (patch.canonicalPhone !== undefined) updates.canonicalPhone = patch.canonicalPhone || null;
    if (patch.canonicalWebsite !== undefined) updates.canonicalWebsite = patch.canonicalWebsite || null;
    if (patch.canonicalAddress !== undefined) updates.canonicalAddress = patch.canonicalAddress;
    if (patch.canonicalLatitude !== undefined) updates.canonicalLatitude = patch.canonicalLatitude ?? null;
    if (patch.canonicalLongitude !== undefined) updates.canonicalLongitude = patch.canonicalLongitude ?? null;
    if (patch.category !== undefined) updates.category = patch.category || null;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    updates.updatedAt = new Date().toISOString();

    this.db
      .update(BusinessEntity)
      .set(updates)
      .where(eq(BusinessEntity.entityId, entityId))
      .run();

    return this.getEntityById(entityId);
  }

  // =========================================================================
  // ProviderIdentity Operations
  // =========================================================================

  /**
   * Find a ProviderIdentity by (provider, providerRecordId).
   * Returns the mapped entity ID if found, null otherwise.
   * 
   * @param {string} provider - provider name (e.g., 'geoapify')
   * @param {string} providerRecordId - provider-specific record ID
   * @returns {Object|null} { entityId, id, firstSeen, lastSeen, ... } or null
   */
  findProviderIdentity(provider, providerRecordId) {
    if (!provider || typeof provider !== 'string') return null;
    if (!providerRecordId || typeof providerRecordId !== 'string') return null;

    const rows = this.db
      .select()
      .from(ProviderIdentity)
      .where(
        and(
          eq(ProviderIdentity.provider, provider),
          eq(ProviderIdentity.providerRecordId, providerRecordId)
        )
      )
      .all();

    return rows.length > 0 ? this._mapProviderRow(rows[0]) : null;
  }

  /**
   * Create a new ProviderIdentity mapping.
   * 
   * @param {Object} data - { provider, providerRecordId, entityId, resolutionMethod, resolutionConfidence? }
   * @returns {Object} created mapping
   * @throws {ValidationError} if required fields are missing
   * @throws {DuplicateError} if (provider, providerRecordId) already exists
   */
  createProviderIdentity(data) {
    if (!data?.provider || typeof data.provider !== 'string') {
      throw new ValidationError('provider is required and must be a string');
    }
    if (!data?.providerRecordId || typeof data.providerRecordId !== 'string') {
      throw new ValidationError('providerRecordId is required and must be a string');
    }
    if (!data?.entityId || typeof data.entityId !== 'string') {
      throw new ValidationError('entityId is required and must be a string');
    }
    if (!data?.resolutionMethod || typeof data.resolutionMethod !== 'string') {
      throw new ValidationError('resolutionMethod is required and must be a string');
    }

    // Verify entity exists (foreign key integrity)
    const entity = this.getEntityById(data.entityId);
    if (!entity) {
      throw new NotFoundError(`Entity ${data.entityId} not found`);
    }

    const id = `pid_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      entityId: data.entityId,
      provider: data.provider,
      providerRecordId: data.providerRecordId,
      firstSeen: now,
      lastSeen: now,
      resolutionMethod: data.resolutionMethod,
      resolutionConfidence: data.resolutionConfidence ?? null,
    };

    try {
      this.db.insert(ProviderIdentity).values(row).run();
    } catch (err) {
      // SQLite UNIQUE constraint violation
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new DuplicateError(
          `Provider identity (${data.provider}, ${data.providerRecordId}) already exists`
        );
      }
      throw err;
    }

    return this._mapProviderRow(row);
  }

  /**
   * Update lastSeen (and optionally metadata) for an existing provider identity.
   * Preserves firstSeen.
   * 
   * @param {string} provider
   * @param {string} providerRecordId
   * @param {Object} options - { resolutionMethod?, resolutionConfidence? }
   * @returns {Object|null} updated mapping or null if not found
   */
  touchProviderIdentity(provider, providerRecordId, options = {}) {
    const existing = this.findProviderIdentity(provider, providerRecordId);
    if (!existing) return null;

    const updates = {
      lastSeen: new Date().toISOString(),
    };
    if (options.resolutionMethod !== undefined) {
      updates.resolutionMethod = options.resolutionMethod;
    }
    if (options.resolutionConfidence !== undefined) {
      updates.resolutionConfidence = options.resolutionConfidence;
    }

    this.db
      .update(ProviderIdentity)
      .set(updates)
      .where(
        and(
          eq(ProviderIdentity.provider, provider),
          eq(ProviderIdentity.providerRecordId, providerRecordId)
        )
      )
      .run();

    return this.findProviderIdentity(provider, providerRecordId);
  }

  // =========================================================================
  // ResolutionRecord Operations
  // =========================================================================

  /**
   * Create a new ResolutionRecord.
   * 
   * @param {Object} data - { entityId, matchScore, matchType, providerA, providerB, providerRecordIdA?, providerRecordIdB?, confidence?, status?, notes? }
   * @returns {Object} created record
   * @throws {ValidationError} if required fields are missing
   */
  createResolutionRecord(data) {
    if (!data?.entityId || typeof data.entityId !== 'string') {
      throw new ValidationError('entityId is required and must be a string');
    }
    if (typeof data?.matchScore !== 'number') {
      throw new ValidationError('matchScore is required and must be a number');
    }
    if (!data?.matchType || typeof data.matchType !== 'string') {
      throw new ValidationError('matchType is required and must be a string');
    }
    if (!data?.providerA || typeof data.providerA !== 'string') {
      throw new ValidationError('providerA is required and must be a string');
    }
    if (!data?.providerB || typeof data.providerB !== 'string') {
      throw new ValidationError('providerB is required and must be a string');
    }

    // Verify entity exists
    const entity = this.getEntityById(data.entityId);
    if (!entity) {
      throw new NotFoundError(`Entity ${data.entityId} not found`);
    }

    const id = `res_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      entityId: data.entityId,
      matchScore: data.matchScore,
      matchType: data.matchType,
      providerA: data.providerA,
      providerRecordIdA: data.providerRecordIdA || null,
      providerB: data.providerB,
      providerRecordIdB: data.providerRecordIdB || null,
      timestamp: now,
      status: data.status || 'pending_review',
      confidence: data.confidence ?? null,
      notes: data.notes || null,
    };

    this.db.insert(ResolutionRecord).values(row).run();
    return this._mapResolutionRow(row);
  }

  /**
   * Get resolution history for an entity, newest first.
   * 
   * @param {string} entityId
   * @returns {Object[]} resolution records (newest first)
   */
  getResolutionHistory(entityId) {
    if (!entityId || typeof entityId !== 'string') return [];

    // Order newest-first. Use SQLite's implicit rowid (monotonically increasing
    // per insert) as a deterministic tiebreaker when two records share the same
    // millisecond-precision timestamp (e.g., same-millisecond inserts).
    const rows = this.db
      .select()
      .from(ResolutionRecord)
      .where(eq(ResolutionRecord.entityId, entityId))
      .orderBy(desc(ResolutionRecord.timestamp), sql`rowid desc`)
      .all();

    return rows.map(this._mapResolutionRow);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  _mapEntityRow(row) {
    return {
      entityId: row.entityId,
      canonicalName: row.canonicalName,
      canonicalPhone: row.canonicalPhone,
      canonicalWebsite: row.canonicalWebsite,
      canonicalAddress: row.canonicalAddress,
      canonicalLatitude: row.canonicalLatitude,
      canonicalLongitude: row.canonicalLongitude,
      category: row.category,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  _mapProviderRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      provider: row.provider,
      providerRecordId: row.providerRecordId,
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen,
      resolutionMethod: row.resolutionMethod,
      resolutionConfidence: row.resolutionConfidence,
    };
  }

  _mapResolutionRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      matchScore: row.matchScore,
      matchType: row.matchType,
      providerA: row.providerA,
      providerRecordIdA: row.providerRecordIdA,
      providerB: row.providerB,
      providerRecordIdB: row.providerRecordIdB,
      timestamp: row.timestamp,
      status: row.status,
      confidence: row.confidence,
      notes: row.notes,
    };
  }

  // =========================================================================
  // Phase 4: Canonical Business Intelligence Operations
  // =========================================================================

  /**
   * Create or update a canonical field for an entity
   * @param {Object} data - { entityId, fieldPath, value, provenance, confidence, sourceId?, claimId? }
   * @returns {Object} created/updated canonical field
   */
  upsertCanonicalField(data) {
    if (!data?.entityId || !data?.fieldPath || data.value === undefined) {
      throw new ValidationError('entityId, fieldPath, and value are required');
    }
    if (!data?.provenance || typeof data.provenance !== 'string') {
      throw new ValidationError('provenance is required and must be a string');
    }
    if (typeof data?.confidence !== 'number') {
      throw new ValidationError('confidence is required and must be a number');
    }

    // Check if canonical field already exists
    const existing = this.db
      .select()
      .from(CanonicalField)
      .where(
        and(
          eq(CanonicalField.entityId, data.entityId),
          eq(CanonicalField.fieldPath, data.fieldPath)
        )
      )
      .all();

    const now = new Date().toISOString();
    const id = `cf_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    if (existing.length > 0) {
      const existingRow = existing[0];
      const existingProvenancePriority = this._provenancePriority(existingRow.provenance);
      const newProvenancePriority = this._provenancePriority(data.provenance);

      // Only update if new provenance is higher or same provenance with higher confidence
      if (newProvenancePriority > existingProvenancePriority || 
          (newProvenancePriority === existingProvenancePriority && data.confidence > existingRow.confidence)) {
        
        const updates = {
          value: data.value,
          provenance: data.provenance,
          confidence: data.confidence,
          sourceId: data.sourceId || null,
          claimId: data.claimId || null,
          resolvedAt: new Date().toISOString(),
          supersededAt: existingRow.supersededAt,
          updatedAt: new Date().toISOString()
        };

        this.db
          .update(CanonicalField)
          .set(updates)
          .where(eq(CanonicalField.id, existingRow.id))
          .run();

        return this._mapCanonicalFieldRow({ ...existingRow, ...updates });
      }
      // If not updating, return existing
      return this._mapCanonicalFieldRow(existingRow);
    }

    // Create new canonical field
    const row = {
      id: `cf_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      entityId: data.entityId,
      fieldPath: data.fieldPath,
      value: data.value,
      provenance: data.provenance,
      confidence: data.confidence,
      sourceId: data.sourceId || null,
      claimId: data.claimId || null,
      resolvedAt: new Date().toISOString(),
      supersededAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.db.insert(CanonicalField).values(row).run();
    return this._mapCanonicalFieldRow(row);
  }

  /**
   * Get a canonical field for an entity
   * @param {string} entityId
   * @param {string} fieldPath
   * @returns {Object|null}
   */
  getCanonicalField(entityId, fieldPath) {
    if (!entityId || !fieldPath) return null;

    const rows = this.db
      .select()
      .from(CanonicalField)
      .where(
        and(
          eq(CanonicalField.entityId, entityId),
          eq(CanonicalField.fieldPath, fieldPath)
        )
      )
      .all();

    return rows.length > 0 ? this._mapCanonicalFieldRow(rows[0]) : null;
  }

  /**
   * Get all canonical fields for an entity
   * @param {string} entityId
   * @returns {Object[]}
   */
  getCanonicalFields(entityId) {
    if (!entityId) return [];

    const rows = this.db
      .select()
      .from(CanonicalField)
      .where(eq(CanonicalField.entityId, entityId))
      .all();

    return rows.map(this._mapCanonicalFieldRow);
  }

  /**
   * Create an observation record
   * @param {Object} data - { entityId, provider, providerRecordId, fieldPath, value, normalizedValue?, provenance, confidence, sourceId?, claimId? }
   * @returns {Object} created observation
   */
  createObservation(data) {
    if (!data?.entityId || !data?.provider || !data?.fieldPath || data.value === undefined) {
      throw new ValidationError('entityId, provider, fieldPath, and value are required');
    }

    const id = `obs_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id: `obs_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      entityId: data.entityId,
      provider: data.provider,
      providerRecordId: data.providerRecordId || null,
      fieldPath: data.fieldPath,
      value: data.value,
      normalizedValue: data.normalizedValue || null,
      provenance: data.provenance || 'discovered',
      confidence: data.confidence ?? 0.8,
      sourceId: data.sourceId || null,
      claimId: data.claimId || null,
      observedAt: data.observedAt || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    this.db.insert(Observation).values(row).run();
    return this._mapObservationRow(row);
  }

  /**
   * Get observations for an entity
   * @param {string} entityId
   * @param {string} [fieldPath]
   * @returns {Object[]}
   */
  getObservations(entityId, fieldPath = null) {
    if (!entityId) return [];

    const conditions = [eq(Observation.entityId, entityId)];
    if (fieldPath) conditions.push(eq(Observation.fieldPath, fieldPath));

    const rows = this.db
      .select()
      .from(Observation)
      .where(and(...conditions))
      .orderBy(Observation.observedAt)
      .all();

    return rows.map(this._mapObservationRow);
  }

  /**
   * Create a source record
   * @param {Object} data - { url, domain?, provider?, sourceType?, authority?, isPrimary?, publishedAt?, updatedAt?, metadata? }
   * @returns {Object} created source
   */
  createSource(data) {
    if (!data?.url) {
      throw new ValidationError('url is required for source');
    }

    const id = `src_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      url: data.url,
      domain: data.domain || (data.url ? new URL(data.url).hostname : null),
      provider: data.provider || null,
      sourceType: data.sourceType || 'other',
      authority: Math.max(0, Math.min(1, data.authority ?? 0.5)),
      isPrimary: data.isPrimary ? 1 : 0,
      retrievedAt: new Date().toISOString(),
      publishedAt: data.publishedAt || null,
      updatedAt: data.updatedAt || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    };

    this.db.insert(Source).values(row).run();
    return this._mapSourceRow(row);
  }

  /**
   * Get source by ID
   */
  getSource(sourceId) {
    if (!sourceId) return null;
    const rows = this.db.select().from(Source).where(eq(Source.id, sourceId)).all();
    return rows.length > 0 ? this._mapSourceRow(rows[0]) : null;
  }

  /**
   * Create an evidence record
   * @param {Object} data - { sourceId, fieldPath, value, excerpt?, location?, extractionMethod?, metadata? }
   * @returns {Object} created evidence
   */
  createEvidence(data) {
    if (!data?.sourceId || !data?.fieldPath || data.value === undefined) {
      throw new ValidationError('sourceId, fieldPath, and value are required');
    }

    const id = `ev_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      sourceId: data.sourceId,
      fieldPath: data.fieldPath,
      value: data.value,
      excerpt: data.excerpt || null,
      location: data.location ? JSON.stringify(data.location) : null,
      extractedAt: data.extractedAt || new Date().toISOString(),
      extractionMethod: data.extractionMethod || 'unknown',
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    };

    this.db.insert(Evidence).values(row).run();
    return this._mapEvidenceRow(row);
  }

  /**
   * Create a claim
   * @param {Object} data - { entityId, fieldPath, value, normalizedValue?, claimType?, confidence?, verificationStatus?, temporalMetadata? }
   * @returns {Object} created claim
   */
  createClaim(data) {
    if (!data?.entityId || !data?.fieldPath || data.value === undefined) {
      throw new ValidationError('entityId, fieldPath, and value are required');
    }

    const id = `clm_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      entityId: data.entityId,
      fieldPath: data.fieldPath,
      value: data.value,
      normalizedValue: data.normalizedValue || null,
      claimType: data.claimType || 'fact',
      confidence: data.confidence ?? 0.5,
      verificationStatus: data.verificationStatus || 'unverified',
      temporalRetrievedAt: new Date().toISOString(),
      temporalPublishedAt: data.temporalMetadata?.publishedAt || null,
      temporalObservedAt: data.temporalMetadata?.observedAt || null,
      temporalLastVerifiedAt: data.temporalMetadata?.lastVerifiedAt || null,
      createdAt: now,
      updatedAt: now
    };

    this.db.insert(Claim).values(row).run();
    return this._mapClaimRow(row);
  }

  /**
   * Link claim to source
   */
  linkClaimSource(claimId, sourceId, confidence = 0.5, isPrimary = false) {
    const id = `cs_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.db.insert(ClaimSource).values({
      id,
      claimId,
      sourceId,
      confidence,
      isPrimary: isPrimary ? 1 : 0
    }).run();
  }

  /**
   * Link claim to evidence
   */
  linkClaimEvidence(claimId, evidenceId) {
    const id = `ce_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.db.insert(ClaimEvidence).values({ id, claimId, evidenceId }).run();
  }

  /**
   * Create a conflict
   * @param {Object} data - { entityId, fieldPath, values, resolutionStrategy?, resolutionReason?, resolvedAt?, resolvedBy? }
   * @returns {Object} created conflict
   */
  createConflict(data) {
    if (!data?.entityId || !data?.fieldPath || !data?.values) {
      throw new ValidationError('entityId, fieldPath, and values are required');
    }

    const id = `conf_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      entityId: data.entityId,
      fieldPath: data.fieldPath,
      values: JSON.stringify(data.values),
      status: data.status || 'conflicted',
      resolutionStrategy: data.resolutionStrategy || null,
      resolutionReason: data.resolutionReason || null,
      resolvedAt: data.resolvedAt || null,
      resolvedBy: data.resolvedBy || null,
      createdAt: now,
      updatedAt: now
    };

    this.db.insert(Conflict).values(row).run();
    return this._mapConflictRow(row);
  }

  /**
   * Get conflicts for an entity
   */
  getConflicts(entityId, fieldPath = null, status = null) {
    if (!entityId) return [];

    const conditions = [eq(Conflict.entityId, entityId)];
    if (fieldPath) conditions.push(eq(Conflict.fieldPath, fieldPath));
    if (status) conditions.push(eq(Conflict.status, status));

    const rows = this.db.select().from(Conflict).where(and(...conditions)).all();
    return rows.map(this._mapConflictRow);
  }

  /**
   * Resolve a conflict
   */
  resolveConflict(conflictId, resolutionStrategy, resolutionReason, resolvedBy) {
    const now = new Date().toISOString();
    this.db
      .update(Conflict)
      .set({
        status: 'resolved',
        resolutionStrategy,
        resolutionReason,
        resolvedAt: now,
        resolvedBy,
        updatedAt: now
      })
      .where(eq(Conflict.id, conflictId))
      .run();

    const rows = this.db.select().from(Conflict).where(eq(Conflict.id, conflictId)).all();
    return rows.length > 0 ? this._mapConflictRow(rows[0]) : null;
  }

  /**
   * Record a canonicalization decision
   */
  recordCanonicalizationDecision(data) {
    if (!data?.entityId || !data?.fieldPath || !data?.decisionType || !data?.chosenValue) {
      throw new ValidationError('entityId, fieldPath, decisionType, and chosenValue are required');
    }

    const id = `cd_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      entityId: data.entityId,
      fieldPath: data.fieldPath,
      decisionType: data.decisionType,
      chosenValue: data.chosenValue,
      rejectedValue: data.rejectedValue || null,
      reason: data.reason || null,
      strategy: data.strategy || null,
      confidence: data.confidence || null,
      conflictId: data.conflictId || null,
      claimId: data.claimId || null,
      createdAt: now
    };

    this.db.insert(CanonicalizationDecision).values(row).run();
    return this._mapCanonicalizationDecisionRow(row);
  }

  /**
   * Get canonicalization decisions for an entity
   */
  getCanonicalizationDecisions(entityId, fieldPath = null) {
    if (!entityId) return [];

    const conditions = [eq(CanonicalizationDecision.entityId, entityId)];
    if (fieldPath) conditions.push(eq(CanonicalizationDecision.fieldPath, fieldPath));

    const rows = this.db.select().from(CanonicalizationDecision).where(and(...conditions)).all();
    return rows.map(this._mapCanonicalizationDecisionRow);
  }

  /**
   * Provenance priority helper
   */
  _provenancePriority(provenance) {
    const priorities = { verified: 4, discovered: 3, user_provided: 3, identified: 2, inferred: 1 };
    return priorities[provenance] || 0;
  }

  // Mapping helpers for new tables
  _mapCanonicalFieldRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      fieldPath: row.fieldPath,
      value: row.value,
      provenance: row.provenance,
      confidence: row.confidence,
      sourceId: row.sourceId,
      claimId: row.claimId,
      resolvedAt: row.resolvedAt,
      supersededAt: row.supersededAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  _mapObservationRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      provider: row.provider,
      providerRecordId: row.providerRecordId,
      fieldPath: row.fieldPath,
      value: row.value,
      normalizedValue: row.normalizedValue,
      provenance: row.provenance,
      confidence: row.confidence,
      sourceId: row.sourceId,
      claimId: row.claimId,
      observedAt: row.observedAt,
      createdAt: row.createdAt
    };
  }

  _mapSourceRow(row) {
    return {
      id: row.id,
      url: row.url,
      domain: row.domain,
      provider: row.provider,
      sourceType: row.sourceType,
      authority: row.authority,
      isPrimary: Boolean(row.isPrimary),
      retrievedAt: row.retrievedAt,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }

  _mapEvidenceRow(row) {
    return {
      id: row.id,
      sourceId: row.sourceId,
      fieldPath: row.fieldPath,
      value: row.value,
      excerpt: row.excerpt,
      location: row.location ? JSON.parse(row.location) : null,
      extractedAt: row.extractedAt,
      extractionMethod: row.extractionMethod,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }

  _mapClaimRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      fieldPath: row.fieldPath,
      value: row.value,
      normalizedValue: row.normalizedValue,
      claimType: row.claimType,
      confidence: row.confidence,
      verificationStatus: row.verificationStatus,
      temporalRetrievedAt: row.temporalRetrievedAt,
      temporalPublishedAt: row.temporalPublishedAt,
      temporalObservedAt: row.temporalObservedAt,
      temporalLastVerifiedAt: row.temporalLastVerifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  _mapConflictRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      fieldPath: row.fieldPath,
      values: JSON.parse(row.values),
      status: row.status,
      resolutionStrategy: row.resolutionStrategy,
      resolutionReason: row.resolutionReason,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  _mapCanonicalizationDecisionRow(row) {
    return {
      id: row.id,
      entityId: row.entityId,
      fieldPath: row.fieldPath,
      decisionType: row.decisionType,
      chosenValue: row.chosenValue,
      rejectedValue: row.rejectedValue,
      reason: row.reason,
      strategy: row.strategy,
      confidence: row.confidence,
      conflictId: row.conflictId,
      claimId: row.claimId,
      createdAt: row.createdAt
    };
  }

  /**
   * Load canonical fields from persistent storage into a BusinessProfile
   * @param {string} entityId - Entity ID to load canonical fields for
   * @param {BusinessProfile} profile - BusinessProfile instance to populate
   * @returns {Promise<void>}
   */
  async loadCanonicalFieldsIntoProfile(entityId, profile) {
    if (!entityId || !profile) return;
    
    const canonicalFields = this.getCanonicalFields(entityId);
    for (const field of canonicalFields) {
      // Only set if the profile doesn't already have a stronger value
      const current = profile.getField(field.fieldPath);
      if (!current || current.value === null) {
        // Load the canonical value into the profile
        profile.set(field.fieldPath, field.value, field.provenance, field.confidence, {
          sourceId: field.sourceId,
          claimId: field.claimId
        });
      }
    }
  }
}

export default IdentityRepository;
