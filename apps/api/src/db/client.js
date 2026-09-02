/**
 * Database Client — Phase 1: SQLite with Drizzle ORM
 * 
 * Initializes SQLite database and creates tables if they don't exist.
 * This is a client-only module; no business logic is integrated yet.
 * 
 * Usage:
 *   import { db } from '../db/client.js';
 *   // db is ready for schema operations
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { BusinessEntity, ProviderIdentity, ResolutionRecord } from './schema.js';

// =============================================================================
// Configuration
// =============================================================================

// Default SQLite database path (relative to working directory)
const DATABASE_PATH = process.env.SQLITE_DATABASE_PATH || './webloom.db';

// =============================================================================
// Database Initialization
// =============================================================================

let database = null;
let drizzleDb = null;

/**
 * Initialize SQLite database and run schema migration
 * Creates tables if they don't exist; preserves data if they do.
 * 
 * @param {string} dbPath - path to SQLite database file
 * @returns {Promise<Object>} drizzle instance ready for queries
 */
export async function initializeDatabase(dbPath = DATABASE_PATH) {
  if (drizzleDb) {
    return drizzleDb;
  }

  try {
    // Create SQLite connection
    database = new Database(dbPath);
    
    // Enable WAL mode for better concurrency (optional but recommended)
    database.pragma('journal_mode = WAL');
    
    // Create drizzle instance
    drizzleDb = drizzle(database, {
      schema: {
        BusinessEntity,
        ProviderIdentity,
        ResolutionRecord,
      },
    });

    // Create tables if they don't exist
    // This is a manual migration; for production, use Drizzle Kit migrations
    createTables(database);

    console.log(`[DB] SQLite database initialized: ${dbPath}`);
    return drizzleDb;
  } catch (error) {
    console.error(`[DB] Failed to initialize database: ${error.message}`);
    throw error;
  }
}

/**
 * Create tables using raw SQL (schema-first approach)
 * Only creates tables; does not modify existing data.
 */
function createTables(db) {
  // BusinessEntity table
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_entity (
      entity_id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      canonical_phone TEXT,
      canonical_website TEXT,
      canonical_address TEXT NOT NULL,
      canonical_latitude REAL,
      canonical_longitude REAL,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ProviderIdentity table
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_identity (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_record_id TEXT NOT NULL,
      first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolution_method TEXT NOT NULL,
      resolution_confidence REAL,
      FOREIGN KEY (entity_id) REFERENCES business_entity(entity_id) ON DELETE CASCADE
    )
  `);

  // Indexes for ProviderIdentity
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_identity_provider_record 
    ON provider_identity(provider, provider_record_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_provider_identity_entity 
    ON provider_identity(entity_id)
  `);

  // ResolutionRecord table
  db.exec(`
    CREATE TABLE IF NOT EXISTS resolution_record (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      match_score REAL NOT NULL,
      match_type TEXT NOT NULL,
      provider_a TEXT NOT NULL,
      provider_record_id_a TEXT,
      provider_b TEXT NOT NULL,
      provider_record_id_b TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending_review',
      confidence REAL,
      notes TEXT,
      FOREIGN KEY (entity_id) REFERENCES business_entity(entity_id) ON DELETE CASCADE
    )
  `);

  // Indexes for ResolutionRecord
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_resolution_record_entity 
    ON resolution_record(entity_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_resolution_record_timestamp 
    ON resolution_record(timestamp)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_resolution_record_match_type 
    ON resolution_record(match_type)
  `);

  // Index for BusinessEntity
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_business_entity_status 
    ON business_entity(status)
  `);
}

/**
 * Get the drizzle database instance
 * Must call initializeDatabase() first.
 * 
 * @returns {Object} drizzle instance
 * @throws {Error} if database not initialized
 */
export function getDb() {
  if (!drizzleDb) {
    throw new Error('[DB] Database not initialized. Call initializeDatabase() first.');
  }
  return drizzleDb;
}

/**
 * Get the raw SQLite connection
 * Useful for raw queries or advanced operations.
 * 
 * @returns {Object} better-sqlite3 database instance
 * @throws {Error} if database not initialized
 */
export function getRawDb() {
  if (!database) {
    throw new Error('[DB] Database not initialized. Call initializeDatabase() first.');
  }
  return database;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (database) {
    database.close();
    database = null;
    drizzleDb = null;
    console.log('[DB] Database connection closed');
  }
}

// =============================================================================
// Default export
// =============================================================================
export default {
  initializeDatabase,
  getDb,
  getRawDb,
  closeDatabase,
};
