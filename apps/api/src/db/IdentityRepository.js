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
import { eq, and, desc, sql } from 'drizzle-orm';
import { BusinessEntity, ProviderIdentity, ResolutionRecord } from './schema.js';

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
}

export default IdentityRepository;
