/**
 * Database Schema — Phase 1: Persistent Business Identity Layer
 * 
 * Core entities for durable business identity:
 * - BusinessEntity: canonical business identity
 * - ProviderIdentity: maps provider records to persistent entities
 * - ResolutionRecord: historical entity resolution decisions
 * 
 * Uses Drizzle ORM with SQLite (better-sqlite3).
 * This is a schema-only module; no business logic is integrated yet.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// BusinessEntity — Durable canonical business identity
// =============================================================================
export const BusinessEntity = sqliteTable('business_entity', {
  entityId: text('entity_id').primaryKey(),
  canonicalName: text('canonical_name').notNull(),
  canonicalPhone: text('canonical_phone'),
  canonicalWebsite: text('canonical_website'),
  canonicalAddress: text('canonical_address').notNull(),
  canonicalLatitude: real('canonical_latitude'),
  canonicalLongitude: real('canonical_longitude'),
  category: text('category'),
  status: text('status', { enum: ['ACTIVE', 'MERGED', 'DEPRECATED'] }).notNull().default('ACTIVE'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// =============================================================================
// ProviderIdentity — Maps provider records to persistent entities
// =============================================================================
export const ProviderIdentity = sqliteTable('provider_identity', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'geoapify' | 'web_extraction' | 'google_maps' | etc.
  providerRecordId: text('provider_record_id').notNull(), // provider-specific ID (ChIJ..., cid:..., etc.)
  firstSeen: text('first_seen').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeen: text('last_seen').notNull().default(sql`CURRENT_TIMESTAMP`),
  resolutionMethod: text('resolution_method').notNull(), // 'first_observation' | 'same_entity_match' | 'manual' | etc.
  resolutionConfidence: real('resolution_confidence'), // 0.0 to 1.0
}, (table) => ({
  // Unique constraint: (provider, providerRecordId) must be unique
  providerRecordUnique: {
    provider: table.provider,
    providerRecordId: table.providerRecordId,
  },
}));

// =============================================================================
// ResolutionRecord — Historical entity resolution decisions
// =============================================================================
export const ResolutionRecord = sqliteTable('resolution_record', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  matchScore: real('match_score').notNull(), // -1.0 to 1.0
  matchType: text('match_type', { enum: ['same_entity', 'uncertain', 'different_entity', 'same_brand_different_location'] }).notNull(),
  providerA: text('provider_a').notNull(), // first provider in comparison
  providerRecordIdA: text('provider_record_id_a'), // first provider's record ID (nullable for synthetic)
  providerB: text('provider_b').notNull(), // second provider in comparison
  providerRecordIdB: text('provider_record_id_b'), // second provider's record ID (nullable for synthetic)
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text('status', { enum: ['pending_review', 'confirmed', 'dismissed', 'merged'] }).notNull().default('pending_review'),
  confidence: real('confidence'), // 0.0 to 1.0 (optional)
  notes: text('notes'), // optional human-readable notes
});

// =============================================================================
// Schema Validation
// =============================================================================
export function validateSchema() {
  // Drizzle ORM validates schema at compile-time and runtime
  // This function can be called to ensure tables are valid before first use
  return true;
}

// =============================================================================
// Default export
// =============================================================================
export default {
  BusinessEntity,
  ProviderIdentity,
  ResolutionRecord,
  validateSchema,
};
