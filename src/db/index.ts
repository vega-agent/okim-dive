/**
 * Neon Postgres connection (free tier). Portability rule (MVP-SPEC §2):
 * standard Postgres — swapping hosts is a DATABASE_URL change.
 */
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  // App still builds without a DB (public pages); fail loudly at query time.
  console.warn('[db] DATABASE_URL not set — DB-backed features disabled until configured.')
}

const sql = connectionString ? neon(connectionString) : null

export const db = sql ? drizzle(sql, { schema }) : null
export { schema }
