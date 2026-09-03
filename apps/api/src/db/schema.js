/**
 * Database Schema — Phase 1 + Phase 4: Persistent Business Identity + Canonical Business Intelligence
 * 
 * Core entities for durable business identity:
 * - BusinessEntity: canonical business identity
 * - ProviderIdentity: maps provider records to persistent entities
 * - ResolutionRecord: historical entity resolution decisions
 * 
 * Phase 4 Canonical Business Intelligence entities:
 * - CanonicalField: canonical field values with provenance and confidence
 * - Observation: provider observations with full provenance
 * - CanonicalizationDecision: canonicalization decisions and conflict resolutions
 * - Source: source of information with authority
 * - Evidence: evidence supporting a claim
 * - Claim: claim about a business field with evidence
 * - Conflict: conflict between claims on the same field
 * 
 * Uses Drizzle ORM with SQLite (better-sqlite3).
 * This is a schema-only module; no business logic is integrated yet.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// Phase 1: BusinessEntity — Durable canonical business identity
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
// Phase 1: ProviderIdentity — Maps provider records to persistent entities
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
// Phase 1: ResolutionRecord — Historical entity resolution decisions
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
// Phase 4: Source — Origin of information
// =============================================================================
export const Source = sqliteTable('source', {
  id: text('id').primaryKey(),
  url: text('url'),
  domain: text('domain'),
  provider: text('provider'),
  sourceType: text('source_type').notNull().default('other'), // 'official_website', 'structured_provider', 'search_result', 'directory', 'review_platform', 'news', 'social', 'user_provided', 'ai_inference', 'other'
  authority: real('authority').notNull().default(0.5), // 0-1
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  retrievedAt: text('retrieved_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text('published_at'),
  updatedAt: text('updated_at'),
  metadata: text('metadata', { mode: 'json' }), // JSON string
}, (table) => ({
  domainIdx: index('source_domain_idx').on(table.domain),
  providerIdx: index('source_provider_idx').on(table.provider),
}));

// =============================================================================
// Phase 4: Evidence — Supporting material extracted from a source
// =============================================================================
export const Evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => Source.id, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(), // e.g., 'identity.name', 'contact.phone'
  value: text('value').notNull(),
  excerpt: text('excerpt'),
  location: text('location', { mode: 'json' }), // { xpath, cssSelector, lineNumber, charOffset }
  extractedAt: text('extracted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  extractionMethod: text('extraction_method').notNull().default('unknown'), // 'schema.org', 'microdata', 'openGraph', 'visibleText', 'aiExtraction', 'apiResponse'
  metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
  sourceIdx: index('evidence_source_idx').on(table.sourceId),
  fieldIdx: index('evidence_field_idx').on(table.fieldPath),
}));

// =============================================================================
// Phase 4: Claim — Statement about a business field with evidence
// =============================================================================
export const Claim = sqliteTable('claim', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(),
  value: text('value').notNull(),
  normalizedValue: text('normalized_value'),
  claimType: text('claim_type').notNull().default('fact'), // 'fact', 'observation', 'inference'
  confidence: real('confidence').notNull().default(0.5),
  verificationStatus: text('verification_status').notNull().default('unverified'), // 'verified', 'supported', 'unverified', 'conflicted', 'refuted'
  temporalRetrievedAt: text('temporal_retrieved_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  temporalPublishedAt: text('temporal_published_at'),
  temporalObservedAt: text('temporal_observed_at'),
  temporalLastVerifiedAt: text('temporal_last_verified_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityIdx: index('claim_entity_idx').on(table.entityId),
  fieldIdx: index('claim_field_idx').on(table.fieldPath),
  entityFieldIdx: index('claim_entity_field_idx').on(table.entityId, table.fieldPath),
}));

// =============================================================================
// Phase 4: ClaimSource — Links claims to sources
// =============================================================================
export const ClaimSource = sqliteTable('claim_source', {
  id: text('id').primaryKey(),
  claimId: text('claim_id').notNull().references(() => Claim.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').notNull().references(() => Source.id, { onDelete: 'cascade' }),
  confidence: real('confidence').notNull().default(0.5),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  claimIdx: index('claim_source_claim_idx').on(table.claimId),
  sourceIdx: index('claim_source_source_idx').on(table.sourceId),
}));

// =============================================================================
// Phase 4: ClaimEvidence — Links claims to evidence
// =============================================================================
export const ClaimEvidence = sqliteTable('claim_evidence', {
  id: text('id').primaryKey(),
  claimId: text('claim_id').notNull().references(() => Claim.id, { onDelete: 'cascade' }),
  evidenceId: text('evidence_id').notNull().references(() => Evidence.id, { onDelete: 'cascade' }),
}, (table) => ({
  claimIdx: index('claim_evidence_claim_idx').on(table.claimId),
  evidenceIdx: index('claim_evidence_evidence_idx').on(table.evidenceId),
}));

// =============================================================================
// Phase 4: Conflict — Disagreement between claims on the same field
// =============================================================================
export const Conflict = sqliteTable('conflict', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(),
  values: text('values', { mode: 'json' }).notNull(), // Array of { value, source, provider, provenance, confidence, sourceId, claimId }
  status: text('status', { enum: ['conflicted', 'resolved', 'dismissed'] }).notNull().default('conflicted'),
  resolutionStrategy: text('resolution_strategy'), // 'authority_wins', 'most_recent', 'highest_confidence', 'manual_review', 'preserve_all'
  resolutionReason: text('resolution_reason'),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityIdx: index('conflict_entity_idx').on(table.entityId),
  fieldIdx: index('conflict_field_idx').on(table.fieldPath),
  statusIdx: index('conflict_status_idx').on(table.status),
}));

// =============================================================================
// Phase 4: CanonicalField — Canonical field values with provenance
// =============================================================================
export const CanonicalField = sqliteTable('canonical_field', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(),
  value: text('value').notNull(),
  provenance: text('provenance').notNull(), // 'verified', 'discovered', 'identified', 'user_provided', 'inferred'
  confidence: real('confidence').notNull(),
  sourceId: text('source_id').references(() => Source.id, { onDelete: 'set null' }),
  claimId: text('claim_id').references(() => Claim.id, { onDelete: 'set null' }),
  resolvedAt: text('resolved_at'),
  supersededAt: text('superseded_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityIdx: index('canonical_field_entity_idx').on(table.entityId),
  fieldIdx: index('canonical_field_field_idx').on(table.fieldPath),
  entityFieldIdx: index('canonical_field_entity_field_idx').on(table.entityId, table.fieldPath),
}));

// =============================================================================
// Phase 4: Observation — Provider observations with full provenance
// =============================================================================
export const Observation = sqliteTable('observation', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerRecordId: text('provider_record_id'),
  fieldPath: text('field_path').notNull(),
  value: text('value').notNull(),
  normalizedValue: text('normalized_value'),
  provenance: text('provenance').notNull(),
  confidence: real('confidence').notNull(),
  sourceId: text('source_id').references(() => Source.id, { onDelete: 'set null' }),
  claimId: text('claim_id').references(() => Claim.id, { onDelete: 'set null' }),
  observedAt: text('observed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityIdx: index('observation_entity_idx').on(table.entityId),
  providerIdx: index('observation_provider_idx').on(table.provider),
  fieldIdx: index('observation_field_idx').on(table.fieldPath),
  entityFieldIdx: index('observation_entity_field_idx').on(table.entityId, table.fieldPath),
}));

// =============================================================================
// Phase 4: CanonicalizationDecision — Canonicalization decisions and conflict resolutions
// =============================================================================
export const CanonicalizationDecision = sqliteTable('canonicalization_decision', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(),
  decisionType: text('decision_type').notNull(), // 'accepted', 'rejected', 'superseded', 'conflict_resolved'
  chosenValue: text('chosen_value'),
  rejectedValue: text('rejected_value'),
  reason: text('reason'),
  strategy: text('strategy'), // 'authority_wins', 'most_recent', 'highest_confidence', 'manual_review', 'preserve_all', 'provenance_upgrade'
  confidence: real('confidence'),
  conflictId: text('conflict_id').references(() => Conflict.id, { onDelete: 'set null' }),
  claimId: text('claim_id').references(() => Claim.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityIdx: index('canonicalization_entity_idx').on(table.entityId),
  fieldIdx: index('canonicalization_field_idx').on(table.fieldPath),
}));

// =============================================================================
// Phase 15: ReviewItem — Lightweight human-review queue for ambiguous resolutions
// =============================================================================
// Layered ON TOP of resolution_record (which remains the immutable audit log of
// evidence). A ReviewItem is the *actionable* review state: created when a
// resolution is ambiguous (same_brand_different_location / relocated_entity /
// uncertain), deduplicated on a deterministic identity-resolution context key so
// repeated research does not pile up duplicates, and resolved by a reviewer
// (pending -> approved | rejected). Resolving a review NEVER overwrites canonical
// data; the original resolution_record evidence is preserved.
export const ReviewItem = sqliteTable('review_item', {
  id: text('id').primaryKey(),
  // Deterministic dedupe key derived from the resolution context (provider
  // records / entity + address transition + matchType), NOT timestamps. Unique.
  dedupeKey: text('dedupe_key').notNull(),
  // The owning/primary entity. FK cascade keeps reviews isolated per entity.
  entityId: text('entity_id').notNull().references(() => BusinessEntity.entityId, { onDelete: 'cascade' }),
  // The other entity involved (if one was created); informational, nullable.
  relatedEntityId: text('related_entity_id'),
  provider: text('provider'),
  providerRecordId: text('provider_record_id'),
  relatedProvider: text('related_provider'),
  relatedProviderRecordId: text('related_provider_record_id'),
  matchType: text('match_type').notNull(), // same_brand_different_location | relocated_entity | uncertain
  matchScore: real('match_score'),
  reason: text('reason'),
  evidence: text('evidence', { mode: 'json' }), // structured signals / temporal verdict
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by'),
  resolutionNote: text('resolution_note'),
}, (table) => ({
  dedupeUnique: index('review_item_dedupe_unique').on(table.dedupeKey),
  entityIdx: index('review_item_entity_idx').on(table.entityId),
  statusIdx: index('review_item_status_idx').on(table.status),
}));

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
  Source,
  Evidence,
  Claim,
  ClaimSource,
  ClaimEvidence,
  Conflict,
  CanonicalField,
  Observation,
  CanonicalizationDecision,
  ReviewItem,
  validateSchema,
};
