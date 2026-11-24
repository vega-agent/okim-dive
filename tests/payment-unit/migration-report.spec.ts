import { expect, test } from '@playwright/test'
import { buildTransition, type LegacyFacts } from '../../scripts/payment-migration-report'

function legacy(): LegacyFacts {
  return {
    trips: [{ id: 'T', status: 'open', timezone: 'Asia/Kuala_Lumpur', departure: '2027-01-01T16:00:00.000000Z', price: '999.00', final_days: 10 }],
    deposits: [{ id: 'D', trip_id: 'T', sort: 0, amount: '80.00', due_days: 20 }],
    bookings: [{ id: 'B', product_id: 'T', product_type: 'trip', status: 'confirmed', currency: 'MYR', deposit: '20.00', balance: '70.00', discount: '10.00', has_cancel_reason: false, has_cancel_date: false }],
    claims: ['a', 'b'].map((id, i) => ({ id, booking_id: 'B', kind: 'full', currency: 'MYR', status: 'verified', amount: i ? '25.00' : '10.00', submitted: '2026-10-10T00:00:00.000000Z', paid_on: i ? '2026-10-08' : '2026-10-09' })),
    payments: ['b', 'a'].map(id => ({ id, booking_id: 'B', kind: 'full', currency: 'MYR', amount: id === 'a' ? '10.00' : '25.00', source: null, claim_id: id, receipt_no: 'RCT-' + id, verified: '2026-10-10T01:00:00.000000Z' })),
  }
}

test('reconstructs booked terms, local calendar dates and stable receipt-time FIFO from recorded order', () => {
  const plan = buildTransition(legacy())
  expect(plan.blockers).toEqual([])
  expect(plan.stages.map(s => [s.amountMinor, s.dueDate])).toEqual([[2000,'2026-12-13'],[8000,'2026-12-23']])
  expect(plan.receipts.map(r => [r.id, r.snapshot.paidOn, r.snapshot.outstandingMinor])).toEqual([['a','2026-10-09',8000],['b','2026-10-08',5500]])
  expect(plan.allocations.map(a => [a.paymentId, a.amountMinor])).toEqual([['a',1000],['b',1000],['b',1500]])
})

test('reports exact unresolved cancellation, missing dates and duplicate/third deposit IDs', () => {
  const f = legacy()
  f.bookings[0].status = 'cancelled'
  f.trips[0].departure = null
  f.deposits.push({ ...f.deposits[0], id:'duplicate' }, { ...f.deposits[0], id:'third', sort:2 })
  const result = buildTransition(f)
  const blocked = result.blockers.flatMap(b => b.ids)
  expect(blocked).toEqual(expect.arrayContaining(['B','T','D','duplicate','third']))
  expect(result.missingDepartureIds).toEqual(['T'])
})

test('keeps incomplete drafts and unbooked inactive trips without assigning dates', () => {
  const f = legacy()
  f.bookings=[]; f.claims=[]; f.payments=[]; f.deposits=[]
  for (const status of ['draft','on_request','cancelled']) {
    f.trips[0] = { ...f.trips[0], status, departure:null }
    const p = buildTransition(f)
    expect(p.blockers).toEqual([])
    expect(p.incompleteTripIds).toEqual(['T'])
    expect(p.tripDates).toEqual([])
  }
})

test('requires original source and bank date for refunds even when recorded time exists', () => {
  const f = legacy()
  f.payments.push({ ...f.payments[0], id:'refund', kind:'refund', claim_id:null, source:'absent' })
  const issues = buildTransition(f).blockers
  expect(issues).toContainEqual({ reason:'unresolved_refund_source', ids:['refund','absent'] })
  expect(issues).toContainEqual({ reason:'missing_verified_claim_or_bank_date', ids:['refund'] })
})

test('rejects ambiguous source portions and reconciles an exact source refund', () => {
  const f=legacy()
  f.claims.push({ ...f.claims[1], id:'rc', kind:'refund', amount:'8.00', submitted:'2026-10-11T00:00:00.000000Z' })
  f.payments.push({ ...f.payments[0], id:'r', kind:'refund', amount:'8.00', source:'b', claim_id:'rc', verified:'2026-10-11T01:00:00.000000Z' })
  expect(buildTransition(f).blockers).toContainEqual({ reason:'ambiguous_refund_stage_portions', ids:['r','b'] })
  f.claims[2].amount=f.payments[2].amount='25.00'
  const plan=buildTransition(f)
  expect(plan.blockers).toEqual([])
  expect(plan.receipts[2].snapshot.refundedMinor).toBe(2500)
  expect(plan.receipts[1].snapshot.refundedMinor).toBe(0)
})

test('present but corrupt draft facts require review even without any bookings', () => {
  for (const defect of ['timezone','excess','ordering']) {
    const f = legacy()
    f.bookings=[]; f.claims=[]; f.payments=[]
    f.trips[0].status='draft'
    if (defect === 'timezone') f.trips[0].timezone='broken'
    if (defect === 'excess') f.deposits[0].amount='1000.00'
    if (defect === 'ordering') f.deposits[0].due_days=5
    const result=buildTransition(f)
    expect(result.blockers).toContainEqual({reason:'trip_schedule_needs_review',ids:['T','D']})
    expect(result.incompleteTripIds).toEqual([])
  }
})
