/**
 * Drizzle Kit Configuration
 * 
 * Used for schema migrations and database management.
 * Run: npx drizzle-kit push (create/update tables from schema)
 * Run: npx drizzle-kit studio (visual database explorer)
 */

export default {
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './webloom.db',
  },
};
