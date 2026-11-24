import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createRequire, Module } from 'node:module'
import { createLocalPaymentDb } from './support/local-payment-db.mjs'

// The broader lifecycle suite in financial-workflow-db/record-payment.cjs covers
// no-award before completion and no restoration on refund. Bilingual published
// terms rendering is covered by m6-policies.spec.mjs.
const require = createRequire(import.meta.url)

test('completion uses source cash rates and preserves legacy expiry; correction rounding is cumulative', async () => {
  const { db, pool } = createLocalPaymentDb()
  const run = 'cp-' + randomUUID()
  const mixed = run + '-mixed'
  const historical = run + '-historical'
  const badHistory = run + '-bad-history'
  const bookingIds = [mixed, historical, badHistory]
  const source = mixed + '-a'
  const retainedExpiry = new Date('2027-07-09T07:00:00Z')
  const cache = new Map()
  const replace = (specifier, exports) => {
    const path = require.resolve(specifier)
    cache.set(path, require.cache[path])
    delete require.cache[path]
    if (exports) {
      const entry = new Module(path)
      entry.loaded = true
      entry.exports = exports
      require.cache[path] = entry
    }
  }
  const form = values => {
    const data = new FormData()
    for (const [key, value] of Object.entries(values)) data.set(key, String(value))
    return data
  }

  const conn = await pool.connect()
  try {
    replace('../src/db/index.ts', { db, transactionDb: db })
    replace('../src/auth.ts', { auth: async () => ({ user: { id: run, role: 'instructor' } }) })
    replace('next/cache', { revalidatePath() {} })
    for (const module of ['portal-actions', 'payment-actions', 'payment-queries', 'booking-lifecycle']) {
      replace('../src/lib/' + module + '.ts')
    }
    const { completeBooking, refundPayment } = require('../src/lib/portal-actions.ts')
    await conn.query('BEGIN')
    await conn.query('INSERT INTO customers(id,name,email) VALUES($1,$1,$2)', [run, run + '@example.com'])
    await conn.query(`INSERT INTO trips(id,slug,status,title_en,title_zh,price_amount,deposit_value,travel_start,travel_end,rm_rate)
      VALUES($1,$1,'completed','Test','Test',140,80,'2026-02-01','2026-02-07',9)`, [run])
    await conn.query(`
      INSERT INTO bookings(id,customer_id,product_id,status,currency,original_price_amount,departure_timezone,
        points_discount_amount,declarations)
      VALUES ($1,$4,$4,'confirmed','MYR',140,'Asia/Kuala_Lumpur',10,'{}'),
        ($2,$4,$4,'confirmed','MYR',20,'Asia/Kuala_Lumpur',0,'{}'),
        ($3,$4,$4,'confirmed','MYR',20,'Asia/Kuala_Lumpur',0,'{}')
    `, [...bookingIds, run])
    await conn.query(`
      INSERT INTO booking_stages(id,booking_id,position,kind,amount,due_date)
      VALUES ($1||'-D1',$1,1,'deposit',80,'2025-12-01'),($1||'-F',$1,3,'final',60,'2026-01-10'),
        ($2||'-D1',$2,1,'deposit',20,'2025-12-01'),($2||'-F',$2,3,'final',0,NULL),
        ($3||'-D1',$3,1,'deposit',20,'2025-12-01'),($3||'-F',$3,3,'final',0,NULL)
    `, bookingIds)
    await conn.query(`
      INSERT INTO payments(id,booking_id,kind,amount,currency,rm_rate,rm_amount,verified_at,source_payment_id,receipt_snapshot)
      VALUES ($1||'-a',$1,'full',100,'MYR',1.5,150,'2025-12-03',NULL,'{"paidOn":"2025-12-03"}'),
        ($1||'-b',$1,'balance',50,'MYR',2,100,'2026-01-05',NULL,'{"paidOn":"2026-01-05"}'),
        ($1||'-prior',$1,'refund',20,'MYR',1.5,30,'2025-12-04',$1||'-a','{"paidOn":"2025-12-04"}'),
        ($2||'-a',$2,'full',20,'MYR',1,20,'2025-12-03',NULL,'{"paidOn":"2025-12-03"}'),
        ($3||'-a',$3,'full',20,'MYR',1,20,'2025-12-03',NULL,'{"paidOn":"2025-12-03"}')
    `, bookingIds)
    await conn.query(`
      INSERT INTO payment_allocations(payment_id,stage_id,amount)
      VALUES ($1||'-a',$1||'-D1',80),($1||'-a',$1||'-F',20),($1||'-b',$1||'-F',50),
        ($1||'-prior',$1||'-F',20),($2||'-a',$2||'-D1',20),($3||'-a',$3||'-D1',20)
    `, bookingIds)
    await conn.query(`
      INSERT INTO points_ledger(id,customer_id,booking_id,payment_id,type,points,expires_at,rule_snapshot)
      VALUES ($1||'-lot',$3,$1,$1||'-a','earned',20,$4,'{"awardVersion":"legacy"}'),
        ($2||'-lot',$3,$2,$2||'-a','earned',19,$4,'{"awardVersion":"legacy"}')
    `, [historical, badHistory, run, retainedExpiry.toISOString()])
    await conn.query('COMMIT')

    const complete = bookingId => completeBooking(form({ bookingId, participated: 'on' }))
    const reward = id => conn.query('SELECT points,rm_amount,expires_at,rule_snapshot FROM points_ledger WHERE booking_id=$1 AND type=\'earned\'', [id])
    await Promise.all([complete(mixed), complete(mixed)])
    const { rows: [completed] } = await conn.query('SELECT status,completed_at,payment_revision FROM bookings WHERE id=$1', [mixed])
    expect(completed.status).toBe('completed')
    const { rows: earned } = await reward(mixed)
    expect(earned).toHaveLength(1)
    const [award] = earned
    expect(award).toMatchObject({ points: 220, rm_amount: '220.00' })
    expect(award.rule_snapshot.allocations.map(a => [a.rateSnapshot, a.cashCents, a.points])).toEqual([
      ['1.5000', 8000, 120], ['2.0000', 5000, 100],
    ])
    const expiry = new Date(completed.completed_at)
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1)
    expect(award.expires_at).toEqual(expiry)

    const { rows: historicalBefore } = await reward(historical)
    expect(historicalBefore).toHaveLength(1)
    await complete(historical)
    const { rows: preserved } = await reward(historical)
    expect(preserved).toEqual(historicalBefore)
    expect((await conn.query("SELECT count(*)::int n FROM audit_log WHERE entity_id=$1 AND action='legacy_points_retained'", [historical])).rows[0].n).toBe(1)
    await expect(complete(badHistory)).rejects.toThrow(/reconciliation required/)
    expect((await conn.query('SELECT status FROM bookings WHERE id=$1', [badHistory])).rows[0].status).toBe('confirmed')

    const correct = (amount, expectedRevision, operationKey = randomUUID()) => refundPayment(form({
      bookingId: mixed, paymentId: source, amount, paidOn: '2026-11-22',
      reason: 'Synthetic completed correction', operationKey, expectedRevision,
    }))
    let revision = completed.payment_revision
    const key = randomUUID()
    await correct('0.50', revision, key)
    await correct('0.50', revision, key)
    revision += 1
    await expect(correct('0.51', revision, key)).rejects.toThrow('key_reused')
    await correct('0.50', revision++)
    await correct('39.00', revision++)
    const totals = () => conn.query(`
      SELECT (SELECT sum(points)::int FROM points_ledger WHERE booking_id=$1 AND type='reversed') AS reversed,
        (SELECT count(*)::int FROM payments WHERE source_payment_id=$2) AS refunds,
        (SELECT status FROM bookings WHERE id=$1) AS status
    `, [mixed, source])
    expect((await totals()).rows[0]).toEqual({ reversed: -60, refunds: 4, status: 'completed' })
    await expect(correct('40.01', revision)).rejects.toThrow('excess')
    expect((await totals()).rows[0]).toEqual({ reversed: -60, refunds: 4, status: 'completed' })
  } finally {
    try {
      await conn.query('ROLLBACK')
      await conn.query('BEGIN')
      await conn.query('DELETE FROM audit_log WHERE actor_user_id=$1', [run])
      await conn.query('DELETE FROM points_ledger WHERE customer_id=$1', [run])
      await conn.query('DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE booking_id=ANY($1))', [bookingIds])
      await conn.query('DELETE FROM payments WHERE booking_id=ANY($1)', [bookingIds])
      await conn.query('DELETE FROM booking_stages WHERE booking_id=ANY($1)', [bookingIds])
      await conn.query('DELETE FROM bookings WHERE customer_id=$1', [run])
      await conn.query('DELETE FROM trips WHERE id=$1', [run])
      await conn.query('DELETE FROM customers WHERE id=$1', [run])
      const { rows: [check] } = await conn.query(`
        SELECT (SELECT count(*) FROM audit_log WHERE actor_user_id=$1) +
          (SELECT count(*) FROM points_ledger WHERE customer_id=$1) +
          (SELECT count(*) FROM payment_allocations WHERE stage_id LIKE $2) +
          (SELECT count(*) FROM payments WHERE booking_id LIKE $2) +
          (SELECT count(*) FROM booking_stages WHERE booking_id LIKE $2) +
          (SELECT count(*) FROM bookings WHERE customer_id=$1) +
          (SELECT count(*) FROM trips WHERE id=$1) +
          (SELECT count(*) FROM customers WHERE id=$1) AS remaining
      `, [run, run + '%'])
      expect(Number(check.remaining)).toBe(0)
      await conn.query('COMMIT')
    } finally {
      for (const [path, original] of cache) {
        if (original) require.cache[path] = original
        else delete require.cache[path]
      }
      conn.release()
      await pool.end()
    }
  }
})
