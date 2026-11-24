import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createRequire, Module } from 'node:module'
import { createLocalPaymentDb } from './support/local-payment-db.mjs'

// Test ordinary action and document entry points with synthetic sessions.
// First/last-place reservation and the two current-policy checks run in
// multi-deposit.spec.mjs. The owner-preview journey exercises rendered access.
const require = createRequire(import.meta.url)

test('receipt and instructor gates protect bookings; cancelled, declined, no-show and unpaid divers do not earn', async () => {
  const { db, pool } = createLocalPaymentDb()
  const prefix = 'cc-' + randomUUID()
  const owner = prefix + '-owner'
  const other = prefix + '-other'
  const staff = prefix + '-staff'
  const identities = [owner, other]
  const statuses = ['owner', 'cancelled', 'declined', 'noshow', 'future', 'pending']
  const book = label => prefix + '-' + label + '-booking'
  const bookingIds = statuses.map(book)
  const ownBooking = book('owner')
  const paymentId = ownBooking + '-pay'
  const routeInvoice = { params: { bookingId: ownBooking } }
  const routeReceipt = { params: { paymentId } }
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
  const toForm = values => {
    const form = new FormData()
    for (const [field, value] of Object.entries(values)) form.set(field, String(value))
    return form
  }
  const login = (id, role = 'customer') => ({ user: { id, customerId: id, role } })
  const systemReact = globalThis.React
  let session = null
  const conn = await pool.connect()
  try {
    replace('../src/db/index.ts', { db, transactionDb: db })
    replace('../src/auth.ts', { auth: async () => session })
    replace('next/cache', { revalidatePath() {} })
    replace('next/navigation', {
      notFound() { throw new Error('not found') },
      redirect(path) { throw new Error('redirect to ' + path) },
    })
    // The route functions perform authorization. The stand-ins capture only the
    // props handed to the client so these tests run without Next's browser build.
    const view = () => null
    for (const name of ['invoice-view', 'receipt-view', 'portal-view', 'diver-updates', 'site-footer']) {
      replace('../src/components/' + name + '.tsx', { __esModule: true, default: view })
    }
    replace('../styles/portal-tabs.css', {})
    for (const name of ['portal-actions', 'payment-actions', 'payment-queries', 'payment-documents', 'booking-lifecycle']) {
      replace('../src/lib/' + name + '.ts')
    }
    const modules = ['invoice/[bookingId]', 'receipt/[paymentId]', 'portal'].map(path => '../app/(site)/' + path + '/page.tsx')
    for (const path of modules) replace(path)
    globalThis.React = require('react')
    const [InvoicePage, ReceiptPage, PortalPage] = modules.map(path => require(path).default)
    const { recordBookingPayment, recordBookingRefund } = require('../src/lib/payment-actions.ts')
    const { completeBooking, redeemPoints, refundPayment } = require('../src/lib/portal-actions.ts')
    const visibleDocumentProps = tree => {
      const list = []
      function visit(node) {
        if (!node?.props) return
        if (node.type === view) list.push(node.props)
        for (const child of [node.props.children].flat()) visit(child)
      }
      visit(tree)
      return list
    }

    await conn.query('BEGIN')
    await conn.query("INSERT INTO users(id,email) SELECT id,id||'@example.com' FROM unnest($1::text[]) AS x(id)", [identities])
    await conn.query("INSERT INTO customers(id,user_id,name,email) SELECT id,id,id,id||'@example.com' FROM unnest($1::text[]) AS x(id)", [identities])
    await conn.query(`
      INSERT INTO trips(id,slug,title_en,title_zh,status,price_amount,deposit_value,travel_start,travel_end)
      VALUES($1||'-past',$1||'-past','Test','Test','departed',100,40,'2026-02-01','2026-02-05'),
        ($1||'-future',$1||'-future','Test','Test','open',100,40,'2099-02-01','2099-02-05')
    `, [prefix])
    for (const label of statuses) {
      const id = book(label)
      const status = label === 'cancelled' ? 'cancelled' : label === 'pending' ? 'awaiting_deposit' : 'confirmed'
      await conn.query(`
        INSERT INTO bookings(id,customer_id,product_id,status,eligibility_status,currency,original_price_amount,
          departure_timezone,deposit_amount,balance_amount,declarations,cancel_reason)
        VALUES($1,$2,$3,$4,$5,'MYR',100,'Asia/Kuala_Lumpur',40,60,'{"medical":"synthetic private declaration"}',$6)
      `, [id, owner, prefix + (label === 'future' ? '-future' : '-past'), status, label === 'declined' ? 'declined' : 'approved',
        label === 'noshow' ? 'No-show' : null])
    }
    await conn.query(`
      INSERT INTO booking_stages(id,booking_id,position,kind,amount,due_date)
      SELECT id||suffix,id,position,kind,amount,due_date FROM unnest($1::text[]) b(id)
        CROSS JOIN (VALUES ('-D1',1,'deposit',40,DATE '2026-01-01'),('-F',3,'final',60,DATE '2026-01-10'))
          s(suffix,position,kind,amount,due_date)
    `, [bookingIds])
    await conn.query('INSERT INTO invoices(id,booking_id,number) VALUES ($1,$1,$1)', [ownBooking])
    await conn.query(`
      INSERT INTO payments(id,booking_id,kind,amount,currency,rm_rate,rm_amount,verified_at,receipt_no,receipt_snapshot)
      VALUES($1,$2,'full',100,'MYR',1,100,'2026-01-10',$3,$4::json)
    `, [paymentId, ownBooking, 'RCT-' + ownBooking, JSON.stringify({
      schemaVersion: 1, provenance: 'recorded', bookingId: ownBooking, currency: 'MYR', amountMinor: 10000, kind: 'received',
      paidOn: '2026-01-09', recordedAt: '2026-01-10T00:00:00.000Z', grossReceivedMinor: 10000,
      refundedMinor: 0, netReceivedMinor: 10000, outstandingMinor: 0,
      allocations: [{ stageId: ownBooking + '-D1', position: 1, kind: 'deposit', amountMinor: 4000 },
        { stageId: ownBooking + '-F', position: 3, kind: 'final', amountMinor: 6000 }],
    })])
    await conn.query('INSERT INTO payment_allocations(payment_id,stage_id,amount) VALUES($1,$2,40),($1,$3,60)',
      [paymentId, ownBooking + '-D1', ownBooking + '-F'])
    await conn.query('COMMIT')

    await expect(ReceiptPage(routeReceipt)).rejects.toThrow('redirect to /book')
    await expect(InvoicePage(routeInvoice)).rejects.toThrow('redirect to /book')
    session = login(other)
    await expect(ReceiptPage(routeReceipt)).rejects.toThrow('not found')
    await expect(InvoicePage(routeInvoice)).rejects.toThrow('not found')
    await expect(PortalPage()).rejects.toThrow('Forbidden')

    const mutation = toForm({ bookingId: ownBooking, paymentId, participated: 'on', points: 100, amount: '1.00',
      expectedRevision: 0, expectedDiscountMinor: 500, reason: 'Synthetic test', paidOn: '2026-01-11',
      operationKey: randomUUID() })
    await expect(completeBooking(mutation)).rejects.toThrow('Forbidden')
    await expect(redeemPoints(mutation)).rejects.toThrow('Forbidden')
    await expect(refundPayment(mutation)).rejects.toThrow('forbidden')
    await expect(recordBookingPayment(mutation)).resolves.toEqual({ status: 'error', messageKey: 'forbidden' })
    await expect(recordBookingRefund(mutation)).resolves.toEqual({ status: 'error', messageKey: 'forbidden' })

    session = login(owner)
    const receiptProps = visibleDocumentProps(await ReceiptPage(routeReceipt))
    expect(receiptProps[0].receipt).toMatchObject({ bookingId: ownBooking, paidOn: '2026-01-09',
      number: expect.stringMatching(/^RCT-[0-9A-F]{20}$/), amountMinor: 10000 })
    for (const hidden of ['synthetic private declaration', paymentId, 'RCT-' + ownBooking, ownBooking + '-D1']) {
      expect(JSON.stringify(receiptProps)).not.toContain(hidden)
    }
    await expect(InvoicePage(routeInvoice)).rejects.toThrow('not found')
    session = login(staff, 'instructor')
    expect(JSON.stringify(visibleDocumentProps(await InvoicePage(routeInvoice)))).toContain(ownBooking)

    for (const label of ['cancelled', 'declined', 'noshow', 'future', 'pending']) {
      await expect(completeBooking(toForm({ bookingId: book(label), participated: 'on' }))).rejects.toThrow()
    }
    expect((await conn.query('SELECT count(*)::int n FROM points_ledger WHERE customer_id=$1', [owner])).rows[0].n).toBe(0)
    expect((await conn.query('SELECT count(*)::int n FROM bookings WHERE customer_id=$1 AND completed_at IS NOT NULL', [owner])).rows[0].n).toBe(0)
    expect((await conn.query("SELECT count(*)::int n FROM payments WHERE booking_id=$1 AND kind='refund'", [ownBooking])).rows[0].n).toBe(0)

    await completeBooking(toForm({ bookingId: ownBooking, participated: 'on' }))
    session = login(owner)
    expect(JSON.stringify(visibleDocumentProps(await InvoicePage(routeInvoice)))).toContain(ownBooking)
  } finally {
    try {
      await conn.query('ROLLBACK')
      await conn.query('BEGIN')
      await conn.query('DELETE FROM audit_log WHERE actor_user_id=$1', [staff])
      await conn.query('DELETE FROM points_ledger WHERE customer_id=ANY($1)', [identities])
      await conn.query('DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE booking_id=ANY($1))', [bookingIds])
      for (const table of ['payments', 'payment_claims', 'invoices', 'booking_stages']) {
        await conn.query('DELETE FROM ' + table + ' WHERE booking_id=ANY($1)', [bookingIds])
      }
      await conn.query('DELETE FROM bookings WHERE id=ANY($1)', [bookingIds])
      await conn.query('DELETE FROM trips WHERE id IN($1,$2)', [prefix + '-past', prefix + '-future'])
      await conn.query('DELETE FROM customers WHERE id=ANY($1)', [identities])
      await conn.query('DELETE FROM users WHERE id=ANY($1)', [identities])
      const { rows: [check] } = await conn.query(`
        SELECT (SELECT count(*) FROM audit_log WHERE actor_user_id=$1) +
          (SELECT count(*) FROM points_ledger WHERE customer_id=ANY($2)) +
          (SELECT count(*) FROM payment_allocations WHERE stage_id LIKE $4) +
          (SELECT count(*) FROM payments WHERE booking_id=ANY($3)) +
          (SELECT count(*) FROM payment_claims WHERE booking_id=ANY($3)) +
          (SELECT count(*) FROM invoices WHERE booking_id=ANY($3)) +
          (SELECT count(*) FROM booking_stages WHERE booking_id=ANY($3)) +
          (SELECT count(*) FROM bookings WHERE id=ANY($3)) +
          (SELECT count(*) FROM trips WHERE id LIKE $4) +
          (SELECT count(*) FROM customers WHERE id=ANY($2)) +
          (SELECT count(*) FROM users WHERE id=ANY($2)) AS remaining
      `, [staff, identities, bookingIds, prefix + '%'])
      expect(Number(check.remaining)).toBe(0)
      await conn.query('COMMIT')
    } finally {
      globalThis.React = systemReact
      for (const [path, original] of cache) {
        if (original) require.cache[path] = original
        else delete require.cache[path]
      }
      conn.release()
      await pool.end()
    }
  }
})
