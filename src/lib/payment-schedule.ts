export type StageKind = 'deposit' | 'final'
export type StageInput = { id: string; position: 1 | 2 | 3; kind: StageKind; amountMinor: number; dueDate: string | null }
export type AllocationInput = { paymentId: string; stageId: string; amountMinor: number; direction: 'received' | 'refunded' }
export type CancellationKind = 'diver_withdrawal' | 'nonpayment' | 'no_show' | 'operator_cancelled' | 'postponement_declined'

export type StageSummary = StageInput & {
  discountMinor: number
  payableMinor: number
  receivedMinor: number
  outstandingMinor: number
  state: 'paid' | 'upcoming' | 'due' | 'overdue' | 'waived'
}

type RefundSnapshot = { refundEntitlementMinor: number; refundBaselineMinor: number }
type BookingIdentity = { bookingId: string; revision: number; currency: string; originalPriceMinor: number; discountMinor: number }
type BookingPaymentInput = BookingIdentity & RefundSnapshot & {
  stages: StageInput[]
  allocations: AllocationInput[]
  today: string
  cancellationKind: CancellationKind | null
}

export type BookingPaymentSummary = BookingIdentity & RefundSnapshot & {
  payableMinor: number
  grossReceivedMinor: number
  refundedMinor: number
  netReceivedMinor: number
  outstandingMinor: number
  stages: StageSummary[]
  nextStageId: string | null
  suggestedAmountMinor: number
  refundOutstandingMinor: number
}

function nonnegativeInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Expected a nonnegative safe integer')
  return value
}

export function parseMoneyMinor(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new RangeError('Invalid monetary amount')
  const [whole, fraction = ''] = value.split('.')
  return nonnegativeInteger(Number(whole + fraction.padEnd(2, '0')))
}

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) throw new RangeError('Expected YYYY-MM-DD')
  const date = new Date(value + 'T00:00:00Z')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError('Invalid calendar date')
}

export function localCalendarDate(now: Date, timeZone: string): string {
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new RangeError('Missing booking timezone')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', era: 'short',
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]))
  if (parts.era !== 'AD' || parts.year.length > 4) throw new RangeError('Calendar date outside years 0001–9999')
  return parts.year.padStart(4, '0') + '-' + parts.month + '-' + parts.day
}

function orderedStages(priceMinor: number, stages: StageInput[], departure?: string): StageInput[] {
  nonnegativeInteger(priceMinor)
  if (stages.length !== 2 && stages.length !== 3) throw new RangeError('Expected one or two deposits and a final stage')
  const ordered = [...stages].sort((a, b) => a.position - b.position)
  const ids = new Set<string>()
  let total = 0
  let previousDate = ''
  for (let index = 0; index < ordered.length; index++) {
    const stage = ordered[index]
    const isFinal = index === ordered.length - 1
    if (stage.kind !== (isFinal ? 'final' : 'deposit') || stage.position !== (isFinal ? 3 : index + 1)) {
      throw new RangeError('Invalid payment stage position or kind')
    }
    if (!stage.id || ids.has(stage.id)) throw new RangeError('Stage IDs must be distinct')
    ids.add(stage.id)
    nonnegativeInteger(stage.amountMinor)
    if (!isFinal && stage.amountMinor === 0) throw new RangeError('Deposits must be positive')
    total = nonnegativeInteger(total + stage.amountMinor)
    if (stage.dueDate !== null) validateDate(stage.dueDate)
    if (stage.amountMinor > 0) {
      if (!stage.dueDate || stage.dueDate <= previousDate || (departure && stage.dueDate >= departure)) {
        throw new RangeError('Positive stages need increasing due dates before departure')
      }
      previousDate = stage.dueDate
    }
  }
  if (total !== priceMinor) throw new RangeError('Stages must add up to the original price')
  return ordered
}

/** Validate a complete schedule at publication or booking, in the departure timezone. */
export function validatePaymentSchedule(priceMinor: number, stages: StageInput[], departure: string): void {
  validateDate(departure)
  orderedStages(priceMinor, stages, departure)
}

export function maximumDiscountMinor(priceMinor: number, finalMinor: number, configuredCapPct = 20): number {
  nonnegativeInteger(priceMinor)
  nonnegativeInteger(finalMinor)
  if (!Number.isFinite(configuredCapPct) || configuredCapPct < 0) throw new RangeError('Invalid discount cap')

  // Compute floor(price * percentage / 100) exactly, including fractional configured percentages.
  const [mantissa, exponent = '0'] = Math.min(configuredCapPct, 20).toString().split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const scale = fraction.length - Number(exponent)
  const percentageLimit = BigInt(priceMinor) * BigInt(whole + fraction) / (BigInt('1' + '0'.repeat(scale + 2)))
  return Math.min(finalMinor, Number(percentageLimit))
}

type StageCash = { gross: number; refunded: number; paymentIds: Set<string> }

function stageState(remaining: number, cancelled: boolean, dueDate: string | null, today: string): StageSummary['state'] {
  if (remaining === 0) return 'paid'
  if (cancelled) return 'waived'
  // Positive scheduled amounts have a validated date.
  if (dueDate === today) return 'due'
  return dueDate! < today ? 'overdue' : 'upcoming'
}

export function summarizeBooking(input: BookingPaymentInput): BookingPaymentSummary {
  const { bookingId, revision, currency, originalPriceMinor, discountMinor, refundEntitlementMinor, refundBaselineMinor } = input
  nonnegativeInteger(revision)
  nonnegativeInteger(discountMinor)
  nonnegativeInteger(refundEntitlementMinor)
  nonnegativeInteger(refundBaselineMinor)
  validateDate(input.today)
  const ordered = orderedStages(originalPriceMinor, input.stages)
  const final = ordered[ordered.length - 1]
  if (discountMinor > maximumDiscountMinor(originalPriceMinor, final.amountMinor)) throw new RangeError('Discount exceeds the booking cap')

  const cash = new Map<string, StageCash>(ordered.map(stage => [stage.id, { gross: 0, refunded: 0, paymentIds: new Set<string>() }]))
  for (const allocation of input.allocations) {
    const stage = cash.get(allocation.stageId)
    if (!stage) throw new RangeError('Allocation references an unknown stage')
    if (typeof allocation.paymentId !== 'string' || !allocation.paymentId.trim() || stage.paymentIds.has(allocation.paymentId)) {
      throw new RangeError('Each stage allocation needs a distinct payment ID')
    }
    stage.paymentIds.add(allocation.paymentId)
    if (nonnegativeInteger(allocation.amountMinor) === 0) throw new RangeError('Allocation must be positive')
    if (allocation.direction === 'received') stage.gross = nonnegativeInteger(stage.gross + allocation.amountMinor)
    else if (allocation.direction === 'refunded') stage.refunded = nonnegativeInteger(stage.refunded + allocation.amountMinor)
    else throw new RangeError('Unknown allocation direction')
  }

  const cancelled = input.cancellationKind !== null
  let grossReceivedMinor = 0
  let refundedMinor = 0
  const stages = ordered.map((stage): StageSummary => {
    const amounts = cash.get(stage.id)!
    grossReceivedMinor = nonnegativeInteger(grossReceivedMinor + amounts.gross)
    refundedMinor = nonnegativeInteger(refundedMinor + amounts.refunded)
    const receivedMinor = nonnegativeInteger(amounts.gross - amounts.refunded)
    const adjustment = stage.kind === 'final' ? discountMinor : 0
    const payableMinor = stage.amountMinor - adjustment
    const remaining = nonnegativeInteger(payableMinor - receivedMinor)
    return {
      ...stage, discountMinor: adjustment, payableMinor, receivedMinor, outstandingMinor: cancelled ? 0 : remaining,
      state: stageState(remaining, cancelled, stage.dueDate, input.today),
    }
  })
  if (refundBaselineMinor > refundedMinor || (!cancelled && (refundEntitlementMinor !== 0 || refundBaselineMinor !== 0))) {
    throw new RangeError('Inconsistent cancellation refund snapshot')
  }
  const payableMinor = originalPriceMinor - discountMinor
  const netReceivedMinor = grossReceivedMinor - refundedMinor
  const refundOutstandingMinor = Math.max(0, refundEntitlementMinor - (refundedMinor - refundBaselineMinor))
  if (input.cancellationKind !== null) {
    const eligible = refundableCash(input.cancellationKind, netReceivedMinor, stages[stages.length - 1].receivedMinor)
    if (refundEntitlementMinor > grossReceivedMinor - refundBaselineMinor || refundOutstandingMinor > eligible) {
      throw new RangeError('Refund obligation exceeds eligible cash')
    }
  }
  const next = stages.find(stage => stage.outstandingMinor > 0)
  return {
    bookingId, revision, currency, originalPriceMinor, discountMinor, payableMinor, grossReceivedMinor, refundedMinor, netReceivedMinor,
    outstandingMinor: cancelled ? 0 : payableMinor - netReceivedMinor, stages,
    nextStageId: next?.id ?? null, suggestedAmountMinor: next?.outstandingMinor ?? 0,
    refundEntitlementMinor, refundBaselineMinor,
    refundOutstandingMinor,
  }
}

function refundableCash(kind: CancellationKind, netReceivedMinor: number, finalReceivedMinor: number): number {
  switch (kind) {
    case 'operator_cancelled':
    case 'postponement_declined':
      return netReceivedMinor
    case 'diver_withdrawal':
    case 'nonpayment':
    case 'no_show':
      return finalReceivedMinor
    default:
      throw new RangeError('Unknown cancellation reason')
  }
}

/** Call on the active booking immediately before recording its first cancellation. */
export function cancellationRefundSnapshot(summary: BookingPaymentSummary, kind: CancellationKind): RefundSnapshot {
  const final = summary.stages.find(stage => stage.kind === 'final')!
  return {
    refundEntitlementMinor: refundableCash(kind, summary.netReceivedMinor, final.receivedMinor),
    refundBaselineMinor: summary.refundedMinor,
  }
}

export function previewPayment(summary: BookingPaymentSummary, amountMinor: number): {
  allocations: { stageId: string; amountMinor: number }[]
  remainingMinor: number
} {
  if (nonnegativeInteger(amountMinor) === 0 || amountMinor > summary.outstandingMinor) {
    throw new RangeError('Payment must be positive and within the outstanding amount')
  }
  const allocations: { stageId: string; amountMinor: number }[] = []
  let unallocated = amountMinor
  for (const stage of summary.stages) {
    const portion = Math.min(unallocated, stage.outstandingMinor)
    if (portion > 0) allocations.push({ stageId: stage.id, amountMinor: portion })
    unallocated -= portion
    if (unallocated === 0) break
  }
  return { allocations, remainingMinor: summary.outstandingMinor - amountMinor }
}

/** The operator confirms exactly these active bookings and their quoted amounts. */
export function bookingRevisionList(rows: { id: string; revision: number }[]): string {
  return JSON.stringify(rows.map(row => [row.id, row.revision] as const).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
}
