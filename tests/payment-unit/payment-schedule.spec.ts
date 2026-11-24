import { expect, test } from '@playwright/test'
import {
  cancellationRefundSnapshot, localCalendarDate, maximumDiscountMinor, parseMoneyMinor,
  previewPayment, summarizeBooking, validatePaymentSchedule,
  type AllocationInput, type CancellationKind, type StageInput,
} from '../../src/lib/payment-schedule'

const d1: StageInput = { id: 'd1', position: 1, kind: 'deposit', amountMinor: 50000, dueDate: '2027-01-01' }
const d2: StageInput = { id: 'd2', position: 2, kind: 'deposit', amountMinor: 70000, dueDate: '2027-02-01' }
const final: StageInput = { id: 'final', position: 3, kind: 'final', amountMinor: 180000, dueDate: '2027-03-01' }
const booking = {
  bookingId: 'booking', revision: 2, currency: 'MYR', originalPriceMinor: 300000, discountMinor: 15000,
  stages: [d1, d2, final], allocations: [] as AllocationInput[], today: '2027-02-01',
  cancellationKind: null, refundEntitlementMinor: 0, refundBaselineMinor: 0,
}

function receipt(paymentId: string, stageId: string, amountMinor: number): AllocationInput {
  return { paymentId, stageId, amountMinor, direction: 'received' }
}

function refund(paymentId: string, stageId: string, amountMinor: number): AllocationInput {
  return { paymentId, stageId, amountMinor, direction: 'refunded' }
}

test('the discount adjusts only the final payment and the next receipt covers D2 before final', () => {
  const stages = [final, d2, d1] // Batched SQL reads may be unordered.
  const summary = summarizeBooking({ ...booking, stages, allocations: [receipt('a', 'd1', 50000), receipt('b', 'd2', 40000)] })
  expect(summary).toMatchObject({
    bookingId: 'booking', revision: 2, currency: 'MYR', originalPriceMinor: 300000, discountMinor: 15000,
    payableMinor: 285000, grossReceivedMinor: 90000, refundedMinor: 0, netReceivedMinor: 90000,
    outstandingMinor: 195000, nextStageId: 'd2', suggestedAmountMinor: 30000,
    stages: [
      { ...d1, discountMinor: 0, payableMinor: 50000, receivedMinor: 50000, outstandingMinor: 0, state: 'paid' },
      { ...d2, discountMinor: 0, payableMinor: 70000, receivedMinor: 40000, outstandingMinor: 30000, state: 'due' },
      { ...final, discountMinor: 15000, payableMinor: 165000, receivedMinor: 0, outstandingMinor: 165000, state: 'upcoming' },
    ],
  })
  expect(previewPayment(summary, 50000)).toEqual({
    allocations: [{ stageId: 'd2', amountMinor: 30000 }, { stageId: 'final', amountMinor: 20000 }], remainingMinor: 145000,
  })
  expect(stages.map(s => s.id)).toEqual(['final', 'd2', 'd1'])
})

test('one deposit accepts a partial payment and exact settlement leaves no next payment', () => {
  const input = { ...booking, stages: [d1, { ...final, amountMinor: 250000 }], allocations: [receipt('a', 'd1', 20000)] }
  const partial = summarizeBooking(input)
  expect(partial).toMatchObject({ nextStageId: 'd1', suggestedAmountMinor: 30000, outstandingMinor: 265000 })
  const rest = previewPayment(partial, 265000)
  expect(rest).toEqual({
    allocations: [{ stageId: 'd1', amountMinor: 30000 }, { stageId: 'final', amountMinor: 235000 }], remainingMinor: 0,
  })
  const settled = summarizeBooking({ ...input, allocations: [...input.allocations, ...rest.allocations.map(a => receipt('b', a.stageId, a.amountMinor))] })
  expect(settled).toMatchObject({ nextStageId: null, suggestedAmountMinor: 0, outstandingMinor: 0 })
})

test('a deposit covering the price leaves a paid zero final with no deadline', () => {
  const stages = [d1, { ...final, amountMinor: 0, dueDate: null }]
  validatePaymentSchedule(50000, stages, '2027-01-02')
  expect(summarizeBooking({ ...booking, originalPriceMinor: 50000, discountMinor: 0, stages }).stages[1])
    .toMatchObject({ state: 'paid', payableMinor: 0, outstandingMinor: 0 })
  expect(() => summarizeBooking({ ...booking, originalPriceMinor: 50000, discountMinor: 1, stages })).toThrow()
})

test('payment preview rejects zero, negative, fractional, unsafe or excessive amounts', () => {
  const summary = summarizeBooking(booking)
  for (const amount of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 285001]) {
    expect(() => previewPayment(summary, amount)).toThrow()
  }
})

test('money parsing preserves exact minor units and rejects invalid decimal inputs', () => {
  for (const [value, expected] of [['0', 0], ['1.1', 110], ['19.99', 1999], ['90071992547409.91', Number.MAX_SAFE_INTEGER]] as const) {
    expect(parseMoneyMinor(value)).toBe(expected)
  }
  for (const value of ['', '-1.00', '0.001', '1e3', '1,000.00', '2abc', '90071992547409.92']) {
    expect(() => parseMoneyMinor(value)).toThrow()
  }
})

test('discount ceiling uses original price, configured percentage and remaining final-stage value', () => {
  expect(maximumDiscountMinor(300001, 180000, 30)).toBe(60000)
  expect(maximumDiscountMinor(300001, 180000, 12.5)).toBe(37500)
  expect(maximumDiscountMinor(300001, 599, 10)).toBe(599)
  expect(maximumDiscountMinor(300001, 0, 10)).toBe(0)
  expect(maximumDiscountMinor(Number.MAX_SAFE_INTEGER - 2, Number.MAX_SAFE_INTEGER - 2, 20)).toBe(1801439850948197)
  for (const discountMinor of [-1, 0.01, 60001]) {
    expect(() => summarizeBooking({ ...booking, discountMinor })).toThrow()
  }
  for (const cap of [NaN, Infinity, -1]) expect(() => maximumDiscountMinor(300000, 180000, cap)).toThrow()
})

test('publishing a schedule requires correct positions, unique stages, positive deposits, matching price and ordered dates before departure', () => {
  validatePaymentSchedule(300000, [d1, d2, final], '2027-03-02')
  const invalid: StageInput[][] = [
    [d1, d2], [final], [d2, { ...final, amountMinor: 230000 }], [d1, d2, { ...d2, id: 'd3' }, final],
    [d1, { ...d2, id: d1.id }, final], [d1, { ...d2, position: 1 }, final], [d1, d2, { ...final, kind: 'deposit' }],
    [{ ...d1, amountMinor: 0 }, d2, { ...final, amountMinor: 230000 }], [{ ...d1, amountMinor: 50000.5 }, d2, final],
    [d1, d2, { ...final, amountMinor: 179999 }], [{ ...d1, amountMinor: 300001 }, { ...final, amountMinor: -1 }],
    [{ ...d1, dueDate: null }, d2, final], [d1, d2, { ...final, dueDate: null }],
    [d1, { ...d2, dueDate: d1.dueDate }, final], [d1, { ...d2, dueDate: '2026-12-31' }, final],
    [d1, { ...d2, dueDate: '2027-02-29' }, final], [d1, { ...d2, dueDate: '2027-2-01' }, final],
  ]
  for (const stages of invalid) expect(() => validatePaymentSchedule(300000, stages, '2027-03-02')).toThrow()
  for (const departure of ['2027-03-01', '2027-02-28', '2027-02-30']) {
    expect(() => validatePaymentSchedule(300000, booking.stages, departure)).toThrow()
  }
})

test('date state changes at midnight in the booking timezone', () => {
  const now = new Date('2027-01-01T16:00:00Z')
  const local = localCalendarDate(now, 'Asia/Kuala_Lumpur')
  const utc = localCalendarDate(now, 'UTC')
  expect([local, utc]).toEqual(['2027-01-02', '2027-01-01'])
  expect(summarizeBooking({ ...booking, today: local }).stages[0].state).toBe('overdue')
  expect(summarizeBooking({ ...booking, today: utc }).stages[0].state).toBe('due')
  expect(() => summarizeBooking({ ...booking, today: '2027-02-30' })).toThrow()
})

const paid = [receipt('a', 'd1', 50000), receipt('b', 'd2', 70000), receipt('b', 'final', 30000)]
for (const [kind, entitled] of [
  ['diver_withdrawal', 30000], ['nonpayment', 30000], ['no_show', 30000],
  ['operator_cancelled', 150000], ['postponement_declined', 150000],
] as const satisfies ReadonlyArray<readonly [CancellationKind, number]>) {
  test(kind + ' snapshots eligible cash and waives unpaid stages independently of refunds', () => {
    const snap = cancellationRefundSnapshot(summarizeBooking({ ...booking, allocations: paid }), kind)
    expect(snap).toEqual({ refundEntitlementMinor: entitled, refundBaselineMinor: 0 })
    const cancelled = summarizeBooking({ ...booking, cancellationKind: kind, ...snap, allocations: [...paid, refund('r', 'final', 10000)] })
    expect(cancelled).toMatchObject({
      grossReceivedMinor: 150000, refundedMinor: 10000, netReceivedMinor: 140000,
      outstandingMinor: 0, nextStageId: null, suggestedAmountMinor: 0, refundOutstandingMinor: entitled - 10000,
    })
    expect(cancelled.stages[2]).toMatchObject({ receivedMinor: 20000, outstandingMinor: 0, state: 'waived' })
    expect(() => previewPayment(cancelled, 1)).toThrow()
  })
}

test('a refund before cancellation is counted once even if an unrelated deposit refund was also made', () => {
  const prior = [...paid, refund('before', 'final', 10000)]
  const snapshot = cancellationRefundSnapshot(summarizeBooking({ ...booking, allocations: prior }), 'diver_withdrawal')
  expect(snapshot).toEqual({ refundEntitlementMinor: 20000, refundBaselineMinor: 10000 })
  const cancelled = { ...booking, cancellationKind: 'diver_withdrawal' as const, ...snapshot, allocations: prior }
  expect(summarizeBooking(cancelled).refundOutstandingMinor).toBe(20000)
  expect(summarizeBooking({ ...cancelled, allocations: [...prior, refund('after', 'final', 20000)] }).refundOutstandingMinor).toBe(0)
  const mixed = [...prior, refund('prior-deposit', 'd1', 5000)]
  const mixedSnapshot = cancellationRefundSnapshot(summarizeBooking({ ...booking, allocations: mixed }), 'diver_withdrawal')
  expect(mixedSnapshot).toEqual({ refundEntitlementMinor: 20000, refundBaselineMinor: 15000 })
})

test('invalid ledger amounts, unknown stages, unsupported balances and unsafe totals are rejected', () => {
  const invalid: AllocationInput[][] = [
    [receipt('x', 'missing', 100)], [receipt('x', 'd1', 0)], [receipt('x', 'd1', -1)],
    [receipt('x', 'd1', 1.5)], [receipt('x', 'd1', 50001)], [refund('x', 'd1', 1)],
    [receipt('x', 'd1', Number.MAX_SAFE_INTEGER), receipt('y', 'd1', 1), refund('r', 'd1', Number.MAX_SAFE_INTEGER)],
  ]
  for (const allocations of invalid) expect(() => summarizeBooking({ ...booking, allocations })).toThrow()
})

test('an absent or unknown cancellation reason cannot waive a booking balance', () => {
  for (const kind of [undefined, 'operator_canceled']) {
    expect(() => summarizeBooking({ ...booking, cancellationKind: kind as CancellationKind })).toThrow()
  }
})

test('refund snapshots reject obligations unsupported by total cash or the eligible paid stages', () => {
  expect(() => summarizeBooking({ ...booking, cancellationKind: 'operator_cancelled', refundEntitlementMinor: 5000 })).toThrow()
  expect(() => summarizeBooking({
    ...booking, cancellationKind: 'diver_withdrawal', refundEntitlementMinor: 30001, allocations: paid,
  })).toThrow()
  expect(() => summarizeBooking({
    ...booking, cancellationKind: 'operator_cancelled', refundEntitlementMinor: 150000, refundBaselineMinor: 10000,
    allocations: [...paid, refund('r', 'd1', 10000)],
  })).toThrow()
})

test('duplicate or unidentified payment allocations cannot inflate or erase cash', () => {
  for (const allocations of [
    [receipt('', 'd1', 1)], [receipt('  ', 'd1', 1)],
    [receipt('a', 'd1', 1000), receipt('a', 'd1', 1000)],
    [receipt('a', 'd1', 1000), refund('a', 'd1', 1000)],
  ]) {
    expect(() => summarizeBooking({ ...booking, allocations })).toThrow()
  }
})

test('calendar conversion requires an explicit timezone and a valid instant', () => {
  const midnight = new Date('2027-01-01T00:00:00Z')
  for (const timeZone of [undefined, null, '', '   ']) {
    expect(() => localCalendarDate(midnight, timeZone as string)).toThrow()
  }
  expect(() => localCalendarDate(new Date(NaN), 'UTC')).toThrow()
})

test('local dates use four-digit ISO years and reject dates outside the supported calendar', () => {
  expect(localCalendarDate(new Date('0999-01-01T00:00:00Z'), 'UTC')).toBe('0999-01-01')
  for (const iso of ['0000-12-01T00:00:00Z', '+010000-01-01T00:00:00Z']) {
    expect(() => localCalendarDate(new Date(iso), 'UTC')).toThrow()
  }
})
