// Run from the repo root with the migrated disposable DB already available:
// ./node_modules/.bin/tsx --test tests/financial-workflow-db/record-payment.cjs
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
const prefix = 'record-payment-' + randomUUID()
const actor = prefix + '-instructor'
const pattern = prefix + '%'
const currentBankDate = '2026-01-05'

class LocalTestClient extends Client {
  constructor(config) {
    super({ ...config, stream: new Socket(), ssl: false })
    this.neonConfig.pipelineConnect = false
  }
}

const pool = new Pool({
  host: '127.0.0.1', port: 55433, database, user: 'okim_payment_test', password: '',
  ssl: false, max: 4, connectionTimeoutMillis: 3000,
})
pool.Client = LocalTestClient
const db = drizzle(pool, { schema })

function inject(specifier, exports) {
  const filename = require.resolve(specifier)
  assert.equal(require.cache[filename], undefined)
  const entry = new Module(filename, module)
  entry.filename = filename
  entry.exports = exports
  entry.loaded = true
  require.cache[filename] = entry
}

let authCalls = 0
let fakeSends = 0
const revalidated = []
inject('@/db', { db, transactionDb: db, schema })
inject('@/auth', {
  async auth() {
    authCalls++
    return { user: { id: actor, role: 'instructor' } }
  },
})
inject('next/cache', { revalidatePath: path => revalidated.push(path) })
inject('../../src/lib/emails.ts', new Proxy({}, {
  get(_, property) {
    if (String(property).startsWith('send')) {
      return async () => { fakeSends++; return false }
    }
  },
}))
inject('resend', {
  Resend: class {
    constructor() {
      fakeSends++
      throw Error('Real email transport is disabled in this test')
    }
  },
})

const { cancelBooking, recordBookingPayment, recordBookingRefund } = require('../../src/lib/payment-actions.ts')
const { completeBooking, redeemPoints, refundPayment } = require('../../src/lib/portal-actions.ts')
const { completeTrip } = require('../../src/lib/seamless-actions.ts')
const { cancelTrip } = require('../../src/lib/trip-actions.ts')
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
      await tx.execute(sql`DELETE FROM audit_log WHERE actor_user_id = ${actor} OR entity_id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM points_ledger WHERE customer_id LIKE ${pattern}`)
      await tx.execute(sql`DELETE FROM payment_allocations WHERE stage_id LIKE ${pattern}`)
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
        UNION ALL SELECT 1 FROM points_ledger WHERE customer_id LIKE ${pattern}
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
    assert.equal(fakeSends, 0, 'Receipt recording must never attempt lifecycle email')
    console.log(`Verification: ${authCalls} synthetic instructor invocations, zero attempted email sends, zero remaining fixtures across nine tables.`)
  } finally {
    await pool.end()
  }
})

async function seed(suffix, existingCustomerId) {
  const id = prefix + '-' + suffix
  const customerId = existingCustomerId ?? id + '-customer'
  const tripId = id + '-trip'
  await db.transaction(async tx => {
    if (!existingCustomerId) {
      await tx.insert(schema.customers).values({ id: customerId, name: customerId, email: customerId + '@example.com' })
    }
    await tx.insert(schema.trips).values({
      id: tripId, slug: tripId, titleEn: 'Payment test trip', titleZh: 'Payment test trip',
      status: 'open', capacity: 1, depositValue: '200.00', priceAmount: '1000.00',
      travelStart: new Date('2099-04-01T00:00:00.000Z'), travelEnd: new Date('2099-04-03T00:00:00.000Z'),
      balanceDueDate: '2099-03-01',
    })
    await tx.insert(schema.bookings).values({
      id, customerId, productId: tripId, currency: 'MYR', declarations: {}, eligibilityStatus: 'approved',
      originalPriceAmount: '1000.00', departureTimezone: 'Asia/Kuala_Lumpur',
      depositAmount: '200.00', balanceAmount: '800.00',
    })
    await tx.insert(schema.bookingStages).values([
      { id: id + '-d1', bookingId: id, position: 1, kind: 'deposit', amount: '200.00', dueDate: '2099-01-01' },
      { id: id + '-d2', bookingId: id, position: 2, kind: 'deposit', amount: '300.00', dueDate: '2099-02-01' },
      { id: id + '-final', bookingId: id, position: 3, kind: 'final', amount: '500.00', dueDate: '2099-03-01' },
    ])
  })
  return { id, tripId, customerId }
}

function formData(values) {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.set(key, value)
  return form
}

function receive(bookingId, amount, expectedRevision, { operationKey = randomUUID(), paidOn = currentBankDate } = {}) {
  return recordBookingPayment(formData({
    bookingId, amount, expectedRevision: String(expectedRevision), operationKey, paidOn,
    currency: 'USD', reference: 'client-provided-reference', actor: 'client-provided-actor',
  }))
}

function saved(result, revision, remainingMinor) {
  assert.equal(result.status, 'saved', JSON.stringify(result))
  assert.match(result.paymentId, /^PAY-/)
  assert.equal(result.receiptUrl, '/receipt/' + result.paymentId)
  assert.equal(result.summary.revision, revision)
  assert.equal(result.summary.outstandingMinor, remainingMinor)
  return result
}

async function bookingState(id) {
  const [row] = await db.select({
    status: schema.bookings.status,
    revision: schema.bookings.paymentRevision,
  }).from(schema.bookings).where(eq(schema.bookings.id, id))
  return row
}

async function ledger(id) {
  const claims = await db.select().from(schema.paymentClaims).where(eq(schema.paymentClaims.bookingId, id)).orderBy(schema.paymentClaims.id)
  const payments = await db.select().from(schema.payments).where(eq(schema.payments.bookingId, id)).orderBy(schema.payments.id)
  const audits = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id)).orderBy(schema.auditLog.id)
  return { claims, payments, audits }
}

async function receipt(id) {
  const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, id))
  assert.ok(payment?.receiptSnapshot)
  return payment
}

test('partial D1 reserves the place and only complete D1 settlement confirms', async () => {
  const { id } = await seed('partial')
  const partial = saved(await receive(id, '50.00', 0), 1, 95000)
  assert.equal(partial.summary.nextStageId, id + '-d1')
  assert.equal(partial.summary.suggestedAmountMinor, 15000)
  assert.deepEqual(await bookingState(id), { status: 'awaiting_deposit', revision: 1 })

  const d1 = saved(await receive(id, '150.00', 1), 2, 80000)
  assert.equal(d1.summary.nextStageId, id + '-d2')
  assert.deepEqual(await bookingState(id), { status: 'confirmed', revision: 2 })
  assert.equal((await ledger(id)).payments.length, 2)
})

test('a confirmed diver pays combined D2 and final on a full trip without losing the place', async () => {
  const { id, tripId } = await seed('full')
  saved(await receive(id, '200.00', 0), 1, 80000)
  await db.update(schema.trips).set({ status: 'full' }).where(eq(schema.trips.id, tripId))
  const combined = saved(await receive(id, '400.00', 1), 2, 40000)
  assert.deepEqual(await bookingState(id), { status: 'confirmed', revision: 2 })
  const payment = await receipt(combined.paymentId)
  assert.deepEqual(payment.receiptSnapshot.allocations, [
    { stageId: id + '-d2', position: 2, kind: 'deposit', amountMinor: 30000 },
    { stageId: id + '-final', position: 3, kind: 'final', amountMinor: 10000 },
  ])
  assert.deepEqual(
    await db.select({ stageId: schema.paymentAllocations.stageId, amount: schema.paymentAllocations.amount })
      .from(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, combined.paymentId))
      .orderBy(schema.paymentAllocations.stageId),
    [{ stageId: id + '-d2', amount: '300.00' }, { stageId: id + '-final', amount: '100.00' }],
  )
  for (const path of ['/portal', '/myokim', '/invoice/' + id, combined.receiptUrl, '/trips/' + tripId]) {
    assert.ok(revalidated.includes(path), 'Missing post-save revalidation for ' + path)
  }
})

test('overpayment is rejected without money, audit, or booking-state changes', async () => {
  const { id } = await seed('overpay')
  assert.deepEqual(await receive(id, '1000.01', 0), { status: 'error', messageKey: 'excess' })
  assert.deepEqual(await bookingState(id), { status: 'awaiting_deposit', revision: 0 })
  assert.deepEqual(await ledger(id), { claims: [], payments: [], audits: [] })
})

test('retry returns the original payment and receipt, rejects changed intent, and accepts a fresh key', async () => {
  const { id } = await seed('replay')
  const operationKey = randomUUID()
  const first = saved(await receive(id, '200.00', 0, { operationKey }), 1, 80000)
  assert.deepEqual(await receive(id, '200.00', 0, { operationKey }), first)
  assert.deepEqual(await receive(id, '200.01', 0, { operationKey }), { status: 'error', messageKey: 'key_reused' })
  assert.deepEqual(await receive(id, '200.00', 0, { operationKey, paidOn: '2026-01-04' }), {
    status: 'error', messageKey: 'key_reused',
  })
  const next = saved(await receive(id, '200.00', 1), 2, 60000)
  assert.notEqual(next.paymentId, first.paymentId)
  const { claims, payments, audits } = await ledger(id)
  assert.equal(claims.length, 2)
  assert.equal(payments.length, 2)
  assert.equal(audits.length, 2)
  for (const claim of claims) {
    assert.equal(claim.currency, 'MYR')
    assert.equal(claim.reference, id)
    assert.equal(claim.recordedBy, actor)
    assert.equal(claim.status, 'verified')
  }
  assert.ok(payments.every(payment => payment.verifiedBy === actor && payment.receiptNo))
})

test('two distinct intents at one revision produce one saved receipt and one stale summary', async () => {
  const { id } = await seed('concurrent')
  const results = await Promise.all([receive(id, '60.00', 0), receive(id, '70.00', 0)])
  assert.deepEqual(results.map(result => result.status).sort(), ['saved', 'stale'])
  const [winner] = results.filter(result => result.status === 'saved')
  const [loser] = results.filter(result => result.status === 'stale')
  assert.deepEqual(loser.summary, winner.summary)
  assert.equal(winner.summary.revision, 1)
  const { claims, payments, audits } = await ledger(id)
  assert.equal(claims.length, 1)
  assert.deepEqual(payments.map(payment => payment.id), [winner.paymentId])
  assert.equal(audits.length, 1)
  assert.deepEqual(await bookingState(id), { status: 'awaiting_deposit', revision: 1 })
})

test('backdated bank date is separate from recording time and leaves the earlier receipt unchanged', async () => {
  const { id } = await seed('backdated')
  const operationKey = randomUUID()
  const first = saved(await receive(id, '50.00', 0, { operationKey }), 1, 95000)
  const originalSnapshot = (await receipt(first.paymentId)).receiptSnapshot

  const second = saved(await receive(id, '150.00', 1, { paidOn: '2026-01-02' }), 2, 80000)
  const snapshot = (await receipt(second.paymentId)).receiptSnapshot
  assert.equal(snapshot.paidOn, '2026-01-02')
  assert.ok(new Date(snapshot.recordedAt) >= new Date(originalSnapshot.recordedAt))
  assert.equal(snapshot.grossReceivedMinor, 20000)
  assert.equal(snapshot.outstandingMinor, 80000)
  assert.deepEqual((await receipt(first.paymentId)).receiptSnapshot, originalSnapshot)
  assert.deepEqual(await receive(id, '50.00', 0, { operationKey }), first)
  const { claims, payments, audits } = await ledger(id)
  const backdated = payments.find(payment => payment.id === second.paymentId)
  assert.equal(claims.find(claim => claim.id === backdated.claimId).paidOn.toISOString(), '2026-01-02T00:00:00.000Z')
  assert.equal(audits.length, 2)
})

async function pointsFor(customerId) {
  return db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.customerId, customerId))
}

test('completion requires settlement, ended travel and participation, and awards once', async () => {
  const { id, tripId, customerId } = await seed('completion')
  const bookingForm = formData({ bookingId: id, participated: 'on' })
  const tripForm = formData({ tripId })

  const first = saved(await receive(id, '200.00', 0), 1, 80000)
  const ended = { travelStart: new Date('2026-06-07T00:00:00Z'), travelEnd: new Date('2026-06-09T00:00:00Z') }
  await db.update(schema.trips).set({ ...ended, status: 'departed' }).where(eq(schema.trips.id, tripId))
  await assert.rejects(() => completeBooking(bookingForm))
  await assert.rejects(() => completeTrip(tripForm))
  assert.deepEqual(await pointsFor(customerId), [])

  saved(await receive(id, '800.00', 1), 2, 0)
  assert.deepEqual(await bookingState(id), { status: 'confirmed', revision: 2 })
  assert.deepEqual(await pointsFor(customerId), [])
  await assert.rejects(() => completeBooking(formData({ bookingId: id })))

  await db.update(schema.trips).set({ travelEnd: new Date('2099-04-03T00:00:00Z') }).where(eq(schema.trips.id, tripId))
  await assert.rejects(() => completeBooking(bookingForm))
  await db.update(schema.trips).set(ended).where(eq(schema.trips.id, tripId))

  await completeTrip(tripForm)
  assert.equal((await bookingState(id)).status, 'confirmed')
  assert.deepEqual(await pointsFor(customerId), [])
  await Promise.all([completeBooking(bookingForm), completeBooking(bookingForm)])
  assert.equal((await bookingState(id)).status, 'completed')
  assert.deepEqual((await pointsFor(customerId)).map(({ type, points }) => ({ type, points })), [
    { type: 'earned', points: 1000 },
  ])

  const { revision } = await bookingState(id)
  const correction = formData({ bookingId: id, paymentId: first.paymentId, amount: '50.00',
    operationKey: randomUUID(), expectedRevision: String(revision), paidOn: '2026-11-22',
    reason: 'Synthetic post-completion correction',
  })
  await refundPayment(correction)
  await refundPayment(correction)
  assert.equal((await bookingState(id)).status, 'completed')
  assert.deepEqual((await pointsFor(customerId)).map(({ type, points }) => ({ type, points }))
    .sort((a, b) => a.type.localeCompare(b.type)), [
    { type: 'earned', points: 1000 }, { type: 'reversed', points: -50 },
  ])
})

function cancel(id, cancellationKind) {
  return cancelBooking(formData({ bookingId: id, cancellationKind, reason: 'Synthetic cancellation' }))
}

function refundForm(bookingId, amount, revision, operationKey = randomUUID()) {
  return formData({ bookingId, amount, expectedRevision: String(revision), operationKey, paidOn: currentBankDate })
}

function refundSaved(result, remainingMinor) {
  assert.equal(result.status, 'saved', JSON.stringify(result))
  assert.ok(result.childPaymentIds.length)
  assert.equal(result.summary.refundOutstandingMinor, remainingMinor)
  return result
}

test('a multi-source refund rolls back at the parent audit, retries, and serializes competing refunds', async () => {
  const { id } = await seed('refund-race')
  const deposit = saved(await receive(id, '450.00', 0), 1, 55000)
  const split = saved(await receive(id, '120.00', 1), 2, 43000)
  const final = saved(await receive(id, '130.00', 2), 3, 30000)
  const originalReceipt = (await receipt(split.paymentId)).receiptSnapshot
  const cancelled = await cancel(id, 'diver_withdrawal')
  assert.equal(cancelled.status, 'saved', JSON.stringify(cancelled))
  assert.equal(cancelled.summary.refundOutstandingMinor, 20000)
  assert.equal(cancelled.summary.outstandingMinor, 0)
  const revision = cancelled.summary.revision
  const originalLedger = await ledger(id)
  const countAllocations = async () => (await db.execute(sql`
    SELECT count(*)::int AS count FROM payment_allocations WHERE stage_id LIKE ${id + '-%'}
  `)).rows[0].count
  const originalAllocationCount = await countAllocations()
  const key = randomUUID()
  const attempt = refundForm(id, '140.00', revision, key)

  // A NOT VALID constraint leaves existing rows intact and rejects only this new parent audit.
  const constraintName = sql.identifier('refund_test_' + key.replaceAll('-', '_'))
  const parentId = sql.raw("'refund-op-" + key + "'")
  await db.execute(sql`ALTER TABLE audit_log ADD CONSTRAINT ${constraintName} CHECK (id <> ${parentId}) NOT VALID`)
  try {
    assert.deepEqual(await recordBookingRefund(attempt), { status: 'error', messageKey: 'unavailable' })
  } finally {
    await db.execute(sql`ALTER TABLE audit_log DROP CONSTRAINT ${constraintName}`)
  }
  assert.deepEqual(await ledger(id), originalLedger)
  assert.equal(await countAllocations(), originalAllocationCount)
  assert.deepEqual(await bookingState(id), { revision, status: 'cancelled' })

  const partial = refundSaved(await recordBookingRefund(attempt), 6000)
  assert.equal(partial.childPaymentIds.length, 2)
  const competing = await Promise.all([
    recordBookingRefund(refundForm(id, '30.00', partial.summary.revision)),
    recordBookingRefund(refundForm(id, '40.00', partial.summary.revision)),
  ])
  assert.deepEqual(competing.map(result => result.status).sort(), ['saved', 'stale'])
  const winner = competing.find(result => result.status === 'saved')
  assert.deepEqual(competing.find(result => result.status === 'stale').summary, winner.summary)

  const outstanding = (winner.summary.refundOutstandingMinor / 100).toFixed(2)
  const finalKey = randomUUID()
  const finalAttempt = refundForm(id, outstanding, winner.summary.revision, finalKey)
  const settled = refundSaved(await recordBookingRefund(finalAttempt), 0)
  assert.deepEqual(await recordBookingRefund(finalAttempt), settled)
  assert.deepEqual(await recordBookingRefund(attempt), partial)
  assert.deepEqual(await recordBookingRefund(refundForm(id, '0.01', winner.summary.revision, finalKey)), {
    status: 'error', messageKey: 'key_reused',
  })

  const { payments, audits } = await ledger(id)
  const refunds = payments.filter(payment => payment.kind === 'refund')
  const totals = new Map()
  for (const payment of refunds) {
    assert.notEqual(payment.sourcePaymentId, deposit.paymentId)
    assert.ok([split.paymentId, final.paymentId].includes(payment.sourcePaymentId))
    assert.ok(payment.receiptSnapshot.allocations.every(allocation => allocation.position === 3))
    totals.set(payment.sourcePaymentId, (totals.get(payment.sourcePaymentId) || 0) + Number(payment.amount))
  }
  assert.equal(totals.get(split.paymentId), 70)
  assert.equal(totals.get(final.paymentId), 130)
  assert.equal(audits.filter(audit => audit.id.startsWith('refund-op-')).length, 3)
  assert.deepEqual((await receipt(split.paymentId)).receiptSnapshot, originalReceipt)
})

test('expired points cannot be spent and trip-wide refunds do not restore redeemed points', async () => {
  const history = await seed('points-history')
  const active = await seed('points-current', history.customerId)
  const unpaid = await seed('operator-unpaid')
  await db.update(schema.bookings).set({ status: 'completed', completedAt: new Date('2026-07-01T00:00:00Z') })
    .where(eq(schema.bookings.id, history.id))
  await db.insert(schema.pointsLedger).values({
    id: history.id + '-expired', customerId: history.customerId, bookingId: history.id,
    type: 'earned', points: 3000, expiresAt: new Date('2026-01-01T00:00:00Z'),
  })
  const redeem = formData({ bookingId: active.id, points: '1000', operationKey: randomUUID(), expectedRevision: '0', expectedDiscountMinor: '5000' })
  await assert.rejects(() => redeemPoints(redeem))
  assert.deepEqual(await bookingState(active.id), { status: 'awaiting_deposit', revision: 0 })
  assert.ok(!(await pointsFor(history.customerId)).some(entry => entry.type === 'redeemed'))

  const liveLot = history.id + '-live'
  await db.insert(schema.pointsLedger).values({
    id: liveLot, customerId: history.customerId, bookingId: history.id,
    type: 'earned', points: 3000, expiresAt: new Date('2099-12-31T00:00:00Z'),
  })
  redeem.set('expectedDiscountMinor', '2000')
  assert.deepEqual(await redeemPoints(redeem), { status: 'stale' })
  assert.deepEqual(await bookingState(active.id), { status: 'awaiting_deposit', revision: 0 })
  assert.ok(!(await pointsFor(history.customerId)).some(entry => entry.type === 'redeemed'))
  redeem.set('expectedDiscountMinor', '5000')
  assert.deepEqual(await redeemPoints(redeem), { status: 'saved' })
  assert.deepEqual(await redeemPoints(redeem), { status: 'saved' })
  let points = await pointsFor(history.customerId)
  const redeemed = points.filter(entry => entry.type === 'redeemed')
  assert.deepEqual(redeemed.map(row => [row.sourceLotId, row.points]), [[liveLot, -1000]])
  assert.deepEqual(await bookingState(active.id), { status: 'awaiting_deposit', revision: 1 })

  const payment = saved(await receive(active.id, '200.00', 1), 2, 75000)
  assert.deepEqual(payment.summary.stages.map(s => [s.position, s.amountMinor, s.payableMinor]), [
    [1, 20000, 20000], [2, 30000, 30000], [3, 50000, 45000],
  ])
  points = await pointsFor(history.customerId)

  // Include a completed booking and a second active diver on the cancelled trip.
  await db.update(schema.bookings).set({ productId: active.tripId }).where(eq(schema.bookings.id, history.id))
  await db.update(schema.bookings).set({ productId: active.tripId }).where(eq(schema.bookings.id, unpaid.id))
  const close = formData({ tripId: active.tripId, reason: 'Synthetic operator cancellation', confirm: 'on' })
  close.set('expectedBookings', JSON.stringify([[active.id, 2]]))
  assert.deepEqual(await cancelTrip(close), { status: 'stale' })
  assert.deepEqual(await bookingState(active.id), { status: 'confirmed', revision: 2 })
  assert.deepEqual(await bookingState(unpaid.id), { status: 'awaiting_deposit', revision: 0 })
  close.set('expectedBookings', JSON.stringify([[active.id, 2], [unpaid.id, 0]].sort(([a], [b]) => a.localeCompare(b))))
  assert.deepEqual(await cancelTrip(close), { status: 'saved' })
  assert.deepEqual(await cancelTrip(close), { status: 'saved' })
  assert.deepEqual(await bookingState(history.id), { status: 'completed', revision: 0 })
  assert.deepEqual(await bookingState(active.id), { status: 'cancelled', revision: 3 })
  assert.deepEqual(await bookingState(unpaid.id), { status: 'cancelled', revision: 1 })
  const [cancelled] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, active.id))
  assert.equal(cancelled.cancellationKind, 'operator_cancelled')
  assert.equal(cancelled.refundEntitlementAmount, '200.00')
  const [released] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, unpaid.id))
  assert.equal(released.refundEntitlementAmount, '0.00')

  const refund = refundSaved(await recordBookingRefund(refundForm(active.id, '200.00', 3)), 0)
  const refundPaymentRow = await receipt(refund.childPaymentIds[0])
  assert.equal(refundPaymentRow.sourcePaymentId, payment.paymentId)
  assert.deepEqual(refundPaymentRow.receiptSnapshot.allocations.map(a => [a.position, a.amountMinor]), [[1, 20000]])
  const sortById = rows => rows.slice().sort((a, b) => a.id.localeCompare(b.id))
  assert.deepEqual(sortById(await pointsFor(history.customerId)), sortById(points))
})
