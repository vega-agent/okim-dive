// Transaction tests use the app's Neon Drizzle adapter on local PostgreSQL.
// Hard-coded connection fields keep environment DB URLs out of these tests.
import { Socket } from 'node:net'
import { Client, Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '../../src/db/schema.ts'

class LocalTestClient extends Client {
  constructor(config) {
    super({ ...config, stream: new Socket(), ssl: false })
    this.neonConfig.pipelineConnect = false
  }
}

export function createLocalPaymentDb() {
  const pool = new Pool({
    host: '127.0.0.1', port: 55433, database: 'okim_task3_rehearsal',
    user: 'okim_payment_test', password: '', ssl: false, max: 4, connectionTimeoutMillis: 3000,
  })
  // The Neon Pool constructor always selects its own Client, ignoring config.Client.
  pool.Client = LocalTestClient
  return { db: drizzle(pool, { schema }), pool }
}

// The action modules use the outer transaction, including their own savepoints.
// Rolling it back also restores global settings without touching another test's writes.
export async function withLocalTripActions(check) {
  const { createRequire, Module } = await import('node:module')
  const { randomUUID } = await import('node:crypto')
  const { sql } = await import('drizzle-orm')
  const require = createRequire(import.meta.url)
  const { db, pool } = createLocalPaymentDb()
  const rollback = new Error('Rollback successful test')
  const actor = 'trip-test-' + randomUUID()
  const originals = new Map()
  const replace = (id, exports) => {
    const filename = require.resolve(id)
    originals.set(filename, require.cache[filename])
    delete require.cache[filename]
    if (exports) {
      const item = new Module(filename)
      item.loaded = true
      item.exports = exports
      require.cache[filename] = item
    }
  }
  try {
    await db.transaction(async tx => {
      const { rows: [target] } = await tx.execute(sql`select current_database() as db, current_user as role, host(inet_server_addr()) as host, inet_server_port() as port`)
      if (target.db !== 'okim_task3_rehearsal' || target.role !== 'okim_payment_test' || target.host !== '127.0.0.1' || target.port !== 55433) throw Error('Unexpected test database')
      replace('../../src/db/index.ts', { db: tx, transactionDb: tx })
      replace('../../src/lib/portal-actions.ts', { requireInstructor: async () => actor })
      replace('next/cache', { revalidatePath() {} })
      replace('next/navigation', { redirect(path) { throw Object.assign(new Error('Redirect'), { path }) } })
      for (const source of ['payment-queries', 'booking-lifecycle', 'trip-actions', 'seamless-actions']) replace('../../src/lib/' + source + '.ts')
      const tripActions = require('../../src/lib/trip-actions.ts')
      const { registerInterest } = require('../../src/lib/seamless-actions.ts')
      await check({ actor, tx, tripActions, registerInterest })
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  } finally {
    for (const [id, original] of originals) {
      if (original) require.cache[id] = original
      else delete require.cache[id]
    }
    await pool.end()
  }
}

export function actionForm(values) {
  const form = new FormData()
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, String(item))
  }
  return form
}
