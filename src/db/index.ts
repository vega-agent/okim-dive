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

// Next.js patches global fetch in production and can cache library-internal
// requests (drizzle neon-http reads went stale across renders). DB reads must
// never be cached — force no-store at the driver level.
const sql = connectionString ? neon(connectionString, { fetchOptions: { cache: 'no-store' } }) : null

export const db = sql ? drizzle(sql, { schema }) : null
export { schema }

// Interactive transactions are required for financial operations and row locks.
import { drizzle as transactionalDrizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
neonConfig.webSocketConstructor = ws
export const transactionDb = connectionString
  ? transactionalDrizzle(new Pool({ connectionString }), { schema })
  : null
