// Quarantined legacy reproduction: all three assertions should fail before Task 4.
// Run from the repo root: ./node_modules/.bin/tsx --test tests/financial-workflow-db/legacy-confirm-received.cjs
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { after, before, test } = require('node:test')
const { Socket } = require('node:net')
const Module = require('node:module')
const { Client, Pool } = require('@neondatabase/serverless')
const { drizzle } = require('drizzle-orm/neon-serverless')
const { eq, sql } = require('drizzle-orm')
const schema = require('../../src/db/schema.ts')

const database = 'okim_payment_action_rehearsal'
const prefix = 'legacy-payment-' + randomUUID()
const actor = prefix + '-instructor'
const pattern = prefix + '%'

class LocalTestClient extends Client {
  constructor(config) {
    super({ ...config, stream: new Socket(), ssl: false })
    this.neonConfig.pipelineConnect = false
  }
}

const pool = new Pool({
  host: '127.0.0.1', port: 55433, database, user: 'okim_payment_test',
  password: '', ssl: false, max: 2, connectionTimeoutMillis: 3000,
})
pool.Client = LocalTestClient
const db = drizzle(pool, { schema })

function inject(specifier, exports) {
  const filename = require.resolve(specifier)
  assert.equal(require.cache[filename], undefined, 'Install the test stub before loading ' + specifier)
  const entry = new Module(filename, module)
  entry.filename = filename
  entry.exports = exports
  entry.loaded = true
  require.cache[filename] = entry
}

let fakeSends = 0
let authCalls = 0
inject('@/db', { db, transactionDb: db })
inject('next/cache', { revalidatePath() {} })
inject('../../src/lib/portal-actions.ts', {
  async requireInstructor() {
    authCalls++
    return actor
  },
})
inject('../../src/lib/emails.ts', {
  async sendBookingConfirmedEmail({ to }) {
    assert.match(to, /^legacy-payment-[-\w]+@example\.com$/)
    fakeSends++
    return true
  },
  sendDepositReminderEmail() { throw Error('Unexpected reminder attempt') },
  sendHoldExpiredEmail() { throw Error('Unexpected hold-expired notice attempt') },
})

const { confirmReceived } = require('../../src/lib/seamless-actions.ts')
assert.equal(typeof confirmReceived, 'function', 'The legacy action was retired. Use the Task 4 regression suite.')

let targetVerified = false
before(async () => {
  const { rows: [identity] } = await pool.query(`
    SELECT current_database() AS database, current_user AS role,
           inet_server_port() AS port, host(inet_server_addr()) AS host,
           to_regclass('public.payment_allocations') IS NOT NULL AS migrated
  `)
  assert.deepEqual(identity, { database, role: 'okim_payment_test', port: 55433, host: '127.0.0.1', migrated: true })
  targetVerified = true
})

after(async () => {
  try {
    if (!targetVerified) return
    await db.transaction(async tx => {
      await tx.execute(sql`
        DELETE FROM audit_log WHERE actor_user_id = ${actor} OR entity_id LIKE ${pattern}
      `)
      await tx.execute(sql`
        DELETE FROM payment_allocations WHERE stage_id IN (
          SELECT id FROM booking_stages WHERE booking_id LIKE ${pattern}
        )
      `)
      await tx.execute(sql`DELETE FROM payments WHERE booking_id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM payment_claims WHERE booking_id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM booking_stages WHERE booking_id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM bookings WHERE id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM trips WHERE id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM customers WHERE id LIKE ${pattern}`)
    })
    const { rows: [{ remaining }] } = await db.execute(sql`
      SELECT count(*)::int AS remaining FROM (
        SELECT 1 FROM audit_log WHERE actor_user_id = ${actor} OR entity_id LIKE ${pattern}
        UNION ALL SELECT 1 FROM payment_allocations WHERE stage_id LIKE ${pattern}
        UNION ALL SELECT 1 FROM payments WHERE booking_id LIKE ${pattern}
        UNION ALL SELECT 1 FROM payment_claims WHERE booking_id LIKE ${pattern}
        UNION ALL SELECT 1 FROM booking_stages WHERE booking_id LIKE ${pattern}
        UNION ALL SELECT 1 FROM bookings WHERE id LIKE ${pattern}
        UNION ALL SELECT 1 FROM trips WHERE id LIKE ${pattern}
        UNION ALL SELECT 1 FROM customers WHERE id LIKE ${pattern}
      ) AS fixtures
    `)
    assert.equal(remaining, 0)
    assert.equal(authCalls, 4, 'Every invocation must use the synthetic instructor context')
    console.log(`Verification: ${authCalls} synthetic instructor invocations, ${fakeSends} stubbed email attempts, zero real sends, zero remaining fixture rows across eight tables.`)
  } finally {
    await pool.end()
  }
})

async function seed(suffix, { full = false } = {}) {
  const id = prefix + '-' + suffix
  const customerId = id + '-customer'
  const tripId = id + '-trip'
  await db.transaction(async tx => {
    await tx.insert(schema.customers).values({ id: customerId, name: customerId, email: customerId + '@example.com' })
    await tx.insert(schema.trips).values({
      id: tripId, slug: tripId, titleEn: 'Payment test trip', titleZh: 'Payment test trip',
      status: full ? 'full' : 'open', capacity: 1, depositValue: '200.00', priceAmount: '1000.00',
      travelStart: new Date('2099-04-01T00:00:00.000Z'), balanceDueDate: '2099-03-01',
    })
    await tx.insert(schema.bookings).values({
      id, customerId, productId: tripId, currency: 'MYR', declarations: {},
      status: full ? 'confirmed' : 'awaiting_deposit', eligibilityStatus: 'approved',
      originalPriceAmount: '1000.00', departureTimezone: 'Asia/Kuala_Lumpur',
      depositAmount: '200.00', balanceAmount: '800.00',
    })
    await tx.insert(schema.bookingStages).values([
      { id: id + '-d1', bookingId: id, position: 1, kind: 'deposit', amount: '200.00', dueDate: '2099-02-01' },
      { id: id + '-final', bookingId: id, position: 3, kind: 'final', amount: '800.00', dueDate: '2099-03-01' },
    ])
    if (full) {
      const claimId = id + '-seed-claim'
      const paymentId = id + '-seed-deposit'
      await tx.insert(schema.paymentClaims).values({
        id: claimId, bookingId: id, kind: 'deposit', amount: '200.00', currency: 'MYR',
        paidOn: new Date('2026-01-01T00:00:00.000Z'), reference: id, status: 'verified',
      })
      await tx.insert(schema.payments).values({
        id: paymentId, bookingId: id, claimId, kind: 'deposit', amount: '200.00', currency: 'MYR',
      })
      await tx.insert(schema.paymentAllocations).values({ paymentId, stageId: id + '-d1', amount: '200.00' })
    }
  })
  return id
}

function paymentForm(bookingId, amount, operationKey = randomUUID()) {
  const form = new FormData()
  for (const [key, value] of Object.entries({ bookingId, amount, operationKey, paidOn: '2026-01-02' })) {
    form.set(key, value)
  }
  return form
}

async function bookingResult(id) {
  const [booking] = await db.select({ status: schema.bookings.status }).from(schema.bookings).where(eq(schema.bookings.id, id))
  const claims = await db.select({ id: schema.paymentClaims.id }).from(schema.paymentClaims).where(eq(schema.paymentClaims.bookingId, id))
  const payments = await db.select({ amount: schema.payments.amount }).from(schema.payments).where(eq(schema.payments.bookingId, id))
  return { status: booking.status, claimCount: claims.length, paymentAmounts: payments.map(row => row.amount).sort() }
}

async function receive(form) {
  try {
    await confirmReceived(form)
    return { error: null }
  } catch (error) {
    return { error: error.message }
  }
}

test('confirmed diver stays confirmed after paying the final amount on a full trip', async () => {
  const id = await seed('full-trip', { full: true })
  const action = await receive(paymentForm(id, '800.00'))
  assert.deepEqual({ ...action, ...await bookingResult(id) }, {
    error: null, status: 'confirmed', claimCount: 2, paymentAmounts: ['200.00', '800.00'],
  })
})

test('identical retry succeeds after first deposit changes the inferred next stage', async () => {
  const id = await seed('retry')
  const form = paymentForm(id, '200.00')
  assert.deepEqual(await receive(form), { error: null })
  const retried = await receive(form)
  assert.deepEqual({ ...retried, ...await bookingResult(id) }, {
    error: null, status: 'confirmed', claimCount: 1, paymentAmounts: ['200.00'],
  })
})

test('overpayment is rejected before creating money rows or changing booking state', async () => {
  const id = await seed('overpayment')
  const action = await receive(paymentForm(id, '1000.01'))
  assert.deepEqual({ rejected: action.error !== null, ...await bookingResult(id) }, {
    rejected: true, status: 'awaiting_deposit', claimCount: 0, paymentAmounts: [],
  })
})
