import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createRequire, Module } from 'node:module'
import { createLocalPaymentDb } from './support/local-payment-db.mjs'

// Last-place reservation and payments on a full trip run in multi-deposit.spec.mjs.
// Source-refund rounding runs in completion-points.spec.mjs. This case covers the
// redemption cap, replay and write-off on the real action with disposable PostgreSQL.
const require = createRequire(import.meta.url)

test('points cap, replay, and expired-lot write-off reconcile without extra redemptions', async () => {
  const { db, pool } = createLocalPaymentDb()
  const prefix = 'm5f-' + randomUUID()
  const bookingIds = ['valid-lot', 'expired-lot', 'target', 'next'].map(suffix => prefix + '-' + suffix)
  const [validLot, expiredLot, target, next] = bookingIds
  const cache = new Map()
  const replace = (specifier, exports) => {
    const path = require.resolve(specifier)
    cache.set(path, require.cache[path])
    delete require.cache[path]
    if (!exports) return
    const entry = new Module(path)
    entry.loaded = true
    entry.exports = exports
    require.cache[path] = entry
  }
  try {
    replace('../src/db/index.ts', { db, transactionDb: db })
    replace('../src/auth.ts', { auth: async () => ({ user: { id: prefix, role: 'instructor' } }) })
    replace('next/cache', { revalidatePath() {} })
    for (const module of ['portal-actions', 'payment-actions', 'payment-queries', 'booking-lifecycle']) {
      replace('../src/lib/' + module + '.ts')
    }
    const { redeemPoints } = require('../src/lib/portal-actions.ts')
    const redeem = (id, points, operationKey = randomUUID()) => {
      const form = new FormData()
      for (const [field, value] of Object.entries({ bookingId: id, points, operationKey, expectedRevision: 0, expectedDiscountMinor: points * 5 })) {
        form.set(field, String(value))
      }
      return redeemPoints(form)
    }
    const conn = await pool.connect()
    try {
      await conn.query('BEGIN')
      await conn.query('INSERT INTO customers(id,name,email) VALUES($1,$1,$2)', [prefix, prefix + '@example.com'])
      await conn.query(`INSERT INTO trips(id,slug,status,title_en,title_zh,price_amount,deposit_value,
        travel_start,balance_due_date) VALUES($1,$1,'open','Test','Test',100,30,'2099-04-01','2099-03-01')`, [prefix])
      await conn.query(`
        INSERT INTO bookings(id,customer_id,product_id,status,currency,original_price_amount,departure_timezone,
          deposit_amount,balance_amount,declarations)
        SELECT id,$2,$2,CASE WHEN n<=2 THEN 'completed' ELSE 'awaiting_deposit' END,'MYR',100,
          'Asia/Kuala_Lumpur',30,70,'{}'::json
        FROM unnest($1::text[]) WITH ORDINALITY x(id,n)
      `, [bookingIds, prefix])
      await conn.query(`
        INSERT INTO booking_stages(id,booking_id,position,kind,amount,due_date)
        SELECT b.id || s.suffix,b.id,s.position,s.kind,s.amount,s.due_date
        FROM unnest($1::text[]) b(id)
        CROSS JOIN (VALUES ('-D1',1,'deposit',30,DATE '2099-02-01'),('-F',3,'final',70,DATE '2099-03-01'))
          s(suffix,position,kind,amount,due_date)
      `, [bookingIds])
      await conn.query(`INSERT INTO points_ledger(id,customer_id,booking_id,type,points,expires_at)
        VALUES ($2,$1,$2,'earned',500,'2099-12-31'),($3,$1,$3,'earned',100,'2026-01-01')`, [prefix, validLot, expiredLot])
      await conn.query('COMMIT')
      const ledger = () => conn.query('SELECT booking_id,source_lot_id,type,points FROM points_ledger WHERE customer_id=$1 ORDER BY type,id', [prefix])
      await expect(redeem(target, 401)).rejects.toThrow(/exceeds/)
      expect((await ledger()).rows.every(r => r.type === 'earned')).toBe(true)
      const key = randomUUID()
      expect(await redeem(target, 400, key)).toEqual({ status: 'saved' })
      expect(await redeem(target, 400, key)).toEqual({ status: 'saved' })
      await expect(redeem(target, 401, key)).rejects.toThrow(/reused/)
      await expect(redeem(next, 400, key)).rejects.toThrow(/reused/)
      const { rows: [booked] } = await conn.query(`
        SELECT points_discount_amount, payment_revision,
          (SELECT amount FROM booking_stages WHERE booking_id=$1 AND position=3) AS original_final
        FROM bookings WHERE id=$1
      `, [target])
      expect(booked).toEqual({ points_discount_amount: '20.00', payment_revision: 1, original_final: '70.00' })
      await expect(redeem(next, 101)).rejects.toThrow(/Insufficient/)
      expect(await redeem(next, 100)).toEqual({ status: 'saved' })
      const entries = (await ledger()).rows
      expect(entries.filter(row => row.type === 'expired')).toEqual([
        { booking_id: null, source_lot_id: expiredLot, type: 'expired', points: -100 },
      ])
      expect(entries.filter(row => row.type === 'redeemed').sort((a, b) => b.points - a.points)).toEqual([
        { booking_id: next, source_lot_id: validLot, type: 'redeemed', points: -100 },
        { booking_id: target, source_lot_id: validLot, type: 'redeemed', points: -400 },
      ])
    } finally {
      try {
        await conn.query('ROLLBACK')
        await conn.query('BEGIN')
        await conn.query('DELETE FROM audit_log WHERE actor_user_id=$1', [prefix])
        await conn.query('DELETE FROM points_ledger WHERE customer_id=$1', [prefix])
        await conn.query('DELETE FROM booking_stages WHERE booking_id=ANY($1)', [bookingIds])
        await conn.query('DELETE FROM bookings WHERE customer_id=$1', [prefix])
        await conn.query('DELETE FROM trips WHERE id=$1', [prefix])
        await conn.query('DELETE FROM customers WHERE id=$1', [prefix])
        const { rows: [cleanup] } = await conn.query(`
          SELECT  (SELECT count(*) FROM audit_log WHERE actor_user_id=$1) +
            (SELECT count(*) FROM points_ledger WHERE customer_id=$1) +
            (SELECT count(*) FROM booking_stages WHERE booking_id=ANY($2)) +
            (SELECT count(*) FROM bookings WHERE customer_id=$1) +
            (SELECT count(*) FROM trips WHERE id=$1) +
            (SELECT count(*) FROM customers WHERE id=$1) AS remaining
        `, [prefix, bookingIds])
        expect(Number(cleanup.remaining)).toBe(0)
        await conn.query('COMMIT')
      } finally { conn.release() }
    }
  } finally {
    for (const [path, original] of cache) {
      if (original) require.cache[path] = original
      else delete require.cache[path]
    }
    await pool.end()
  }
})
