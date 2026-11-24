import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { auditLog, bookings, customers, paymentAllocations, payments, pointsLedger } from '@/db/schema'
import { readLockedPaymentFacts, type PaymentTransaction } from './payment-queries'
import {
  cancellationRefundSnapshot,
  parseMoneyMinor,
  summarizeBooking,
  type BookingPaymentSummary,
  type CancellationKind,
} from './payment-schedule'

export const activeBookingStatuses = ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed'] as const
export const money = (minor: number) => (minor / 100).toFixed(2)
export type PaymentFacts = Awaited<ReturnType<typeof readLockedPaymentFacts>>
type Booking = typeof bookings.$inferSelect
type Source = typeof payments.$inferSelect
type PaymentInput = Parameters<typeof summarizeBooking>[0]
export type MutationResult =
  | { status: 'saved'; summary: BookingPaymentSummary; childPaymentIds: string[] }
  | { status: 'stale'; summary: BookingPaymentSummary }
  | { status: 'error'; messageKey: 'forbidden' | 'invalid' | 'key_reused' | 'closed' | 'excess' | 'unavailable' }
export const uuidKey = (key: string) => /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(key)
export const calendarDay = (value: string) => {
  const day = new Date(value + 'T00:00:00Z')
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !value.startsWith('0000') &&
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === value
  )
}

// All mutations on a trip take its lock first. Batch locks retain the customer → booking order of single-booking writes.
export async function lockActiveTripBookings(tx: PaymentTransaction, tripId: string) {
  const where = and(
    eq(bookings.productType, 'trip'),
    eq(bookings.productId, tripId),
    inArray(bookings.status, [...activeBookingStatuses]),
  )
  const identities = await tx.select({ customerId: bookings.customerId }).from(bookings).where(where)
  if (!identities.length) return []
  await tx
    .select({ id: customers.id })
    .from(customers)
    .where(
      inArray(
        customers.id,
        identities.map((b) => b.customerId),
      ),
    )
    .orderBy(customers.id)
    .for('update')
  return tx.select().from(bookings).where(where).orderBy(bookings.id).for('update')
}

export async function hasPendingDateDecision(tx: PaymentTransaction, tripId: string, ids: string[]) {
  if (!ids.length) return false
  const [change] = await tx
    .select({ id: auditLog.id, meta: auditLog.meta })
    .from(auditLog)
    .where(and(eq(auditLog.entity, 'trip'), eq(auditLog.entityId, tripId), eq(auditLog.action, 'trip_dates_changed')))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(1)
  const affected = change?.meta?.bookingIds
  if (!Array.isArray(affected)) return false
  const expected = ids.filter((id) => affected.includes(id)).map((id) => 'postponement-' + change.id + '-' + id)
  if (!expected.length) return false
  const responses = await tx
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.action, 'postponement_response'), inArray(auditLog.id, expected)))
  return responses.length < expected.length
}

export async function cancelLockedBooking(
  tx: PaymentTransaction,
  booking: Booking,
  facts: PaymentFacts,
  kind: CancellationKind,
  reason: string,
  actor: string,
): Promise<MutationResult> {
  const before = facts.summaries.get(booking.id)!
  if (booking.cancellationKind) {
    if (booking.cancellationKind !== kind || booking.cancelReason !== reason)
      return { status: 'error', messageKey: 'closed' }
    const [record] = await tx
      .select({ meta: auditLog.meta })
      .from(auditLog)
      .where(eq(auditLog.id, 'booking-cancel-' + booking.id))
    return {
      status: 'saved',
      summary: (record?.meta?.summaryAfter as BookingPaymentSummary | undefined) ?? before,
      childPaymentIds: [],
    }
  }
  if (!activeBookingStatuses.some((s) => s === booking.status) || booking.completedAt || booking.cancelledAt)
    return { status: 'error', messageKey: 'closed' }
  const snapshot = cancellationRefundSnapshot(before, kind)
  const summary = summarizeBooking({
    ...facts.inputs.get(booking.id)!,
    revision: before.revision + 1,
    cancellationKind: kind,
    ...snapshot,
  })
  await tx
    .update(bookings)
    .set({
      status: 'cancelled',
      cancellationKind: kind,
      cancelledAt: new Date(),
      cancelReason: reason,
      holdExpiresAt: null,
      refundEntitlementAmount: money(snapshot.refundEntitlementMinor),
      refundBaselineAmount: money(snapshot.refundBaselineMinor),
      paymentRevision: summary.revision,
    })
    .where(eq(bookings.id, booking.id))
  await tx
    .insert(auditLog)
    .values({
      id: 'booking-cancel-' + booking.id,
      actorUserId: actor,
      action: 'booking_cancelled',
      entity: 'booking',
      entityId: booking.id,
      meta: { category: kind, reason, ...snapshot, summaryAfter: summary },
    })
  return { status: 'saved', summary, childPaymentIds: [] }
}

type Portion = { stageId: string; amountMinor: number }
async function reverseCompletedPoints(
  tx: PaymentTransaction,
  booking: Booking,
  source: Source,
  refundId: string,
  totalRefundMinor: number,
) {
  const ledger = await tx.select().from(pointsLedger).where(eq(pointsLedger.customerId, booking.customerId))
  const earned = ledger.find(
    (e) =>
      e.type === 'earned' &&
      (e.paymentId === source.id || (e.bookingId === booking.id && e.ruleSnapshot?.awardVersion === 'completion-v1')),
  )
  if (!earned) return
  const parts = earned.ruleSnapshot?.allocations as
    { paymentId: string; points: number; cashCents: number; refundedCents: number }[] | undefined
  const part = parts?.find((p) => p.paymentId === source.id)
  if (parts && !part) return
  const cash = part?.cashCents ?? parseMoneyMinor(source.amount)
  if (!cash) return
  const proportion = Number(
    (BigInt(part?.points ?? earned.points) * BigInt(Math.max(0, totalRefundMinor - (part?.refundedCents ?? 0)))) /
      BigInt(cash),
  )
  const reversed = ledger
    .filter((e) => e.sourceLotId === earned.id && e.type === 'reversed' && (!part || e.note === 'refund:' + source.id))
    .reduce((s, e) => s - e.points, 0)
  if (proportion > reversed)
    await tx
      .insert(pointsLedger)
      .values({
        id: 'REV-' + refundId,
        customerId: booking.customerId,
        bookingId: booking.id,
        paymentId: refundId,
        sourceLotId: earned.id,
        type: 'reversed',
        points: reversed - proportion,
        expiresAt: earned.expiresAt,
        ruleSnapshot: earned.ruleSnapshot,
        rateSnapshot: earned.rateSnapshot,
        note: 'refund:' + source.id,
      })
}

export type RefundIntent = {
  customerName: string
  bookingId: string
  amountMinor: number
  paidOn: string
  key: string
  expectedRevision: number
  correction?: { sourceId: string; reason: string }
}
export async function refundLockedBooking(
  tx: PaymentTransaction,
  booking: Booking,
  facts: PaymentFacts,
  intent: RefundIntent,
  actor: string,
): Promise<MutationResult> {
  const input = facts.inputs.get(booking.id)!
  let summary = facts.summaries.get(booking.id)!
  if (intent.expectedRevision !== summary.revision) return { status: 'stale', summary }
  if (intent.paidOn > input.today) return { status: 'error', messageKey: 'invalid' }
  if (
    intent.correction
      ? booking.status !== 'completed' || !booking.completedAt || !!booking.cancellationKind
      : !booking.cancellationKind || booking.status !== 'cancelled'
  )
    return { status: 'error', messageKey: 'closed' }
  if (!intent.correction && intent.amountMinor > summary.refundOutstandingMinor)
    return { status: 'error', messageKey: 'excess' }
  const sourceRows = facts.payments.filter((p) => p.bookingId === booking.id)
  const remaining = facts.sourceBalances.get(booking.id)!
  const finalOnly = ['diver_withdrawal', 'nonpayment', 'no_show'].some((k) => k === booking.cancellationKind)
  const groups: { source: Source; pieces: Portion[]; minor: number }[] = []
  let needed = intent.amountMinor
  for (const source of sourceRows) {
    if (
      source.kind === 'refund' ||
      !source.verifiedAt ||
      (intent.correction && source.id !== intent.correction.sourceId)
    )
      continue
    const receivedOn = source.receiptSnapshot?.paidOn
    if (typeof receivedOn !== 'string' || !calendarDay(receivedOn)) throw Error('Missing original bank date')
    if (receivedOn > intent.paidOn) continue
    const pieces: Portion[] = []
    for (const stage of summary.stages) {
      if (finalOnly && stage.kind !== 'final') continue
      const take = Math.min(needed, remaining.get(source.id)?.get(stage.id) ?? 0)
      if (take) {
        pieces.push({ stageId: stage.id, amountMinor: take })
        needed -= take
      }
    }
    if (pieces.length) groups.push({ source, pieces, minor: pieces.reduce((sum, p) => sum + p.amountMinor, 0) })
    if (!needed) break
  }
  if (needed) return { status: 'error', messageKey: 'excess' }
  const revision = summary.revision + 1,
    now = new Date(),
    childPaymentIds: string[] = []
  const allocations = [...input.allocations]
  for (const { source, pieces, minor } of groups) {
    if (!source.rmRate || !/^\d+(\.\d{1,4})?$/.test(source.rmRate) || !(Number(source.rmRate) > 0))
      throw Error('Missing source conversion rate')
    const id = randomUUID()
    childPaymentIds.push(id)
    allocations.push(...pieces.map((p) => ({ ...p, paymentId: id, direction: 'refunded' as const })))
    summary = summarizeBooking({ ...input, revision, allocations })
    const snapshot = {
      schemaVersion: 1,
      provenance: 'recorded',
      customerName: intent.customerName,
      bookingId: booking.id,
      currency: booking.currency,
      amountMinor: minor,
      kind: 'refunded',
      paidOn: intent.paidOn,
      recordedAt: now.toISOString(),
      allocations: pieces.map((p) => {
        const stage = summary.stages.find((s) => s.id === p.stageId)!
        return { ...p, position: stage.position, kind: stage.kind }
      }),
      grossReceivedMinor: summary.grossReceivedMinor,
      refundedMinor: summary.refundedMinor,
      netReceivedMinor: summary.netReceivedMinor,
      outstandingMinor: summary.outstandingMinor,
    }
    await tx
      .insert(payments)
      .values({
        id,
        bookingId: booking.id,
        sourcePaymentId: source.id,
        kind: 'refund',
        operationKey: 'refund-' + intent.key + '-' + source.id,
        amount: money(minor),
        currency: booking.currency,
        rmRate: source.rmRate,
        rmAmount: sql`round(${money(minor)}::numeric*${source.rmRate}::numeric,2)`,
        verifiedAt: now,
        verifiedBy: actor,
        receiptNo: 'REF-' + id,
        receiptSnapshot: snapshot,
      })
    await tx
      .insert(paymentAllocations)
      .values(pieces.map((p) => ({ paymentId: id, stageId: p.stageId, amount: money(p.amountMinor) })))
    if (intent.correction) {
      const prior = sourceRows
        .filter((p) => p.kind === 'refund' && p.verifiedAt && p.sourcePaymentId === source.id)
        .reduce((s, p) => s + parseMoneyMinor(p.amount), 0)
      await reverseCompletedPoints(tx, booking, source, id, prior + minor)
    }
  }
  await tx.update(bookings).set({ paymentRevision: revision }).where(eq(bookings.id, booking.id))
  await tx.insert(auditLog).values({
    id: 'refund-op-' + intent.key,
    entity: 'booking',
    entityId: booking.id,
    actorUserId: actor,
    action: 'booking_refund_recorded',
    meta: {
      bookingId: booking.id,
      amountMinor: intent.amountMinor,
      paidOn: intent.paidOn,
      cancellationKind: booking.cancellationKind,
      childPaymentIds,
      refundOutstandingAfterMinor: summary.refundOutstandingMinor,
      correction: intent.correction ?? null,
      summaryAfter: summary,
    },
  })
  return { status: 'saved', summary, childPaymentIds }
}
