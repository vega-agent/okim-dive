import {
  localCalendarDate, parseMoneyMinor, previewPayment, summarizeBooking, validatePaymentSchedule,
  type AllocationInput, type StageInput,
} from '../src/lib/payment-schedule'

type Trip = { id: string; status: string; timezone: string; departure: string | null; price: string; final_days: number }
type Deposit = { id: string; trip_id: string; sort: number; amount: string; due_days: number }
type Booking = { id: string; product_id: string; product_type: string; status: string; currency: string; deposit: string | null; balance: string | null; discount: string | null; has_cancel_date: boolean; has_cancel_reason: boolean }
type Claim = { id: string; booking_id: string; kind: string; status: string; amount: string; currency: string; submitted: string; paid_on: string }
type Payment = { id: string; booking_id: string; claim_id: string | null; kind: string; amount: string; currency: string; verified: string | null; source: string | null; receipt_no: string | null }
export type LegacyFacts = { trips: Trip[]; deposits: Deposit[]; bookings: Booking[]; claims: Claim[]; payments: Payment[] }

type Issue = { reason: string; ids: string[] }
type DateWrite = { id: string; dueDate: string }
type StageWrite = StageInput & { bookingId: string }
type Receipt = {
  schemaVersion: 1; provenance: 'reconstructed_test_fixture'; bookingId: string; currency: string
  amountMinor: number; kind: 'received' | 'refunded'; paidOn: string; recordedAt: string
  allocations: { stageId: string; position: number; kind: string; amountMinor: number }[]
  grossReceivedMinor: number; refundedMinor: number; netReceivedMinor: number; outstandingMinor: number
}
type Transition = {
  blockers: Issue[]; missingDepartureIds: string[]; incompleteTripIds: string[]; invalidScheduleTripIds: string[]; overTwoDepositTripIds: string[]
  tripDates: DateWrite[]; depositDates: DateWrite[]
  bookings: { id: string; originalPriceMinor: number; timezone: string }[]
  stages: StageWrite[]; allocations: AllocationInput[]; receipts: { id: string; snapshot: Receipt }[]
}

function dueBefore(date: string, days: number) {
  if (!Number.isSafeInteger(days) || days <= 0) throw Error('invalid day offset')
  const instant = new Date(date + 'T00:00:00Z')
  instant.setUTCDate(instant.getUTCDate() - days)
  return instant.toISOString().slice(0, 10)
}

function amount(value: string | null) {
  if (value === null) throw Error('missing booked amount')
  return parseMoneyMinor(value)
}

const knownInactive = ['draft', 'on_request', 'cancelled']
const activeBookings = ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed', 'completed']
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

export function buildTransition(facts: LegacyFacts): Transition {
  const plan: Transition = { blockers: [], missingDepartureIds: [], incompleteTripIds: [], invalidScheduleTripIds: [], overTwoDepositTripIds: [], tripDates: [], depositDates: [], bookings: [], stages: [], allocations: [], receipts: [] }
  const block = (reason: string, ...ids: string[]) => { plan.blockers.push({ reason, ids }) }
  const byTrip = new Map<string, { departure: string; timezone: string; firstDate: string; finalDays: number }>()
  for (const trip of facts.trips) {
    const deposits = facts.deposits.filter(d => d.trip_id === trip.id).sort((a, b) => a.sort - b.sort)
    const ids = deposits.map(d => d.id)
    const hasBookings = facts.bookings.some(b => b.product_id === trip.id && b.product_type === 'trip')
    if (!trip.departure) plan.missingDepartureIds.push(trip.id)
    if (deposits.length > 2) plan.overTwoDepositTripIds.push(trip.id)
    if (deposits.some((d, i) => d.sort !== i || i > 1)) {
      block('invalid_or_duplicate_deposit_position', trip.id, ...ids)
    }
    try {
      const price = amount(trip.price)
      const totalDeposits = deposits.reduce((sum,d) => sum + amount(d.amount), 0)
      if (totalDeposits > price || deposits.some(d => amount(d.amount) <= 0 || !Number.isSafeInteger(d.due_days) || d.due_days <= 0)) throw Error('invalid deposit terms')
      if (price > totalDeposits && (!Number.isSafeInteger(trip.final_days) || trip.final_days <= 0)) throw Error('invalid final offset')
      // Validate the timezone even when the departure has not yet been chosen.
      const departure = localCalendarDate(trip.departure ? new Date(trip.departure) : new Date(0), trip.timezone)
      if (!deposits.length || !trip.departure) {
        if (hasBookings || !knownInactive.includes(trip.status)) throw Error('active schedule is incomplete')
        plan.incompleteTripIds.push(trip.id)
        plan.invalidScheduleTripIds.push(trip.id)
        continue
      }
      const stages: StageInput[] = deposits.map(d => ({
        id: d.id, position: d.sort === 0 ? 1 : 2, kind: 'deposit', amountMinor: amount(d.amount), dueDate: dueBefore(departure, d.due_days),
      }))
      const finalMinor = price - stages.reduce((sum, d) => sum + d.amountMinor, 0)
      const finalDate = finalMinor === 0 ? null : dueBefore(departure, trip.final_days)
      validatePaymentSchedule(price, [...stages, { id:'trip-final', position:3, kind:'final', amountMinor:finalMinor, dueDate:finalDate }], departure)
      if (finalDate) plan.tripDates.push({ id:trip.id, dueDate:finalDate })
      for (const d of stages) plan.depositDates.push({ id:d.id, dueDate:d.dueDate! })
      byTrip.set(trip.id, { departure, timezone:trip.timezone, firstDate:stages[0].dueDate!, finalDays:trip.final_days })
    } catch {
      plan.invalidScheduleTripIds.push(trip.id)
      block('trip_schedule_needs_review', trip.id, ...ids)
    }
  }

  const claims = new Map(facts.claims.map(c => [c.id, c]))
  const payments = new Map(facts.payments.map(p => [p.id, p]))
  for (const p of facts.payments) {
    const claim = claims.get(p.claim_id ?? '')
    if (!p.verified || !claim || !claim.paid_on || !claim.submitted || claim.status !== 'verified') block('missing_verified_claim_or_bank_date', p.id, ...(p.claim_id ? [p.claim_id] : []))
    if (claim && (claim.booking_id !== p.booking_id || claim.currency !== p.currency || claim.amount !== p.amount || claim.kind !== p.kind)) block('claim_mismatch', p.id, claim.id)
    if (!p.receipt_no) block('missing_receipt_number', p.id)
    if (!facts.bookings.some(b => b.id === p.booking_id && b.currency === p.currency)) block('missing_booking_or_currency_mismatch', p.id, p.booking_id)
    if (!['deposit','balance','full','refund'].includes(p.kind) || (p.kind !== 'refund' && p.source)) block('unexpected_payment_kind_or_source', p.id)
    if (p.kind === 'refund') {
      const source = payments.get(p.source ?? '')
      if (!source || source.kind === 'refund' || source.booking_id !== p.booking_id || source.currency !== p.currency || !source.verified) block('unresolved_refund_source', p.id, ...(p.source ? [p.source] : []))
    }
  }
  for (const c of facts.claims) {
    if (c.status === 'verified' && !facts.payments.some(p => p.claim_id === c.id)) block('verified_claim_without_payment', c.id)
  }

  for (const b of facts.bookings) {
    if (!activeBookings.includes(b.status) || b.has_cancel_date || b.has_cancel_reason) {
      block('cancellation_history_or_status_needs_review', b.id)
      continue
    }
    const trip = byTrip.get(b.product_id)
    if (!trip || b.product_type !== 'trip') { block('missing_booking_schedule_source', b.id, b.product_id); continue }
    const bookedPayments = facts.payments.filter(p => p.booking_id === b.id)
    if (bookedPayments.some(p => plan.blockers.some(issue => issue.ids.includes(p.id)))) continue
    try {
      const deposit = amount(b.deposit)
      const discountMinor = amount(b.discount ?? '0')
      const final = amount(b.balance) + discountMinor
      const originalPriceMinor = deposit + final
      if (originalPriceMinor > 9999999999) throw Error('numeric(10,2) overflow')
      const stages: StageInput[] = [
        { id:b.id+'-D1', kind:'deposit', position:1, amountMinor:deposit, dueDate:trip.firstDate },
        { id:b.id+'-FINAL', kind:'final', position:3, amountMinor:final, dueDate:final ? dueBefore(trip.departure, trip.finalDays) : null },
      ]
      validatePaymentSchedule(originalPriceMinor, stages, trip.departure)
      const allocations: AllocationInput[] = []
      const summary = () => summarizeBooking({ bookingId:b.id, revision:0, currency:b.currency, originalPriceMinor, discountMinor, stages, allocations, today:trip.departure, cancellationKind:null, refundEntitlementMinor:0, refundBaselineMinor:0 })
      summary()
      const sourceRemainders = new Map<string, { stageId:string; amountMinor:number }[]>()
      const ordered = bookedPayments.sort((a,b) => compare(claims.get(a.claim_id!)!.submitted, claims.get(b.claim_id!)!.submitted) || compare(a.id,b.id))
      for (const p of ordered) {
        const claim = claims.get(p.claim_id!)!
        const amountMinor = amount(p.amount)
        const refund = p.kind === 'refund'
        let pieces: { stageId:string; amountMinor:number }[]
        if (refund) {
          const remaining = (sourceRemainders.get(p.source!) ?? []).filter(s => s.amountMinor > 0)
          const total = remaining.reduce((sum,s) => sum+s.amountMinor,0)
          if (amountMinor <= 0 || amountMinor > total) { block('refund_exceeds_recorded_source', p.id, p.source!); break }
          if (remaining.length > 1 && amountMinor !== total) { block('ambiguous_refund_stage_portions',p.id,p.source!); break }
          pieces = remaining.map(s => ({ stageId:s.stageId, amountMinor:Math.min(s.amountMinor, amountMinor) }))
          remaining.forEach((s,i) => { s.amountMinor -= pieces[i].amountMinor })
        } else {
          if (!amountMinor || amountMinor > summary().outstandingMinor) { block('receipt_exceeds_outstanding_or_zero', p.id,b.id); break }
          pieces = previewPayment(summary(), amountMinor).allocations
          sourceRemainders.set(p.id, pieces.map(s => ({...s})))
        }
        const direction = refund ? 'refunded' : 'received'
        allocations.push(...pieces.map(s => ({ ...s, paymentId:p.id, direction } as AllocationInput)))
        const current = summary()
        plan.receipts.push({ id:p.id, snapshot:{ schemaVersion:1, provenance:'reconstructed_test_fixture', bookingId:b.id, currency:b.currency, amountMinor, kind:direction, paidOn:claim.paid_on, recordedAt:p.verified!, allocations:pieces.map(piece => {
          const s = stages.find(s => s.id === piece.stageId)!
          return { ...piece, kind:s.kind, position:s.position }
        }), grossReceivedMinor:current.grossReceivedMinor, refundedMinor:current.refundedMinor, netReceivedMinor:current.netReceivedMinor, outstandingMinor:current.outstandingMinor } })
      }
      if (b.status === 'completed' && summary().outstandingMinor > 0) block('unsettled_completed_booking',b.id)
      plan.allocations.push(...allocations)
      plan.stages.push(...stages.map(s => ({ ...s, bookingId:b.id })))
      plan.bookings.push({ id:b.id, originalPriceMinor, timezone:trip.timezone })
    } catch {
      block('invalid_booked_terms_or_ledger', b.id, ...bookedPayments.map(p => p.id))
    }
  }
  return plan
}
