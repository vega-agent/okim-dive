'use server'

import { auth } from '@/auth'
import { transactionDb } from '@/db'
import { auditLog, bookings, payments, pointsLedger, trips, inquiries, customers, settings, invoices } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { recordCompletedCorrection } from './payment-actions'
import { hasPendingDateDecision } from './booking-lifecycle'
import { readLockedPaymentFacts } from './payment-queries'
import { cashAward, redemptionDiscountMinor, spendablePoints } from './points-accounting'
import { maximumDiscountMinor, parseMoneyMinor } from './payment-schedule'
import { revalidatePath } from 'next/cache'

export async function requireInstructor() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'instructor') throw new Error('Forbidden / 无权访问')
  return session.user.id
}

// Completed-booking corrections retain an explicit source payment and reason.
export async function refundPayment(form: FormData) {
  const result = await recordCompletedCorrection(form)
  if(result.status==='error') throw Error(result.messageKey)
  if(result.status==='stale') throw Error('Booking changed. Review the current payment record.')
}

export async function completeBooking(form: FormData) {
  const actor = await requireInstructor()
  if (form.get('participated') !== 'on') throw new Error('Confirm individual participation before completion')
  if (!transactionDb) throw new Error('Database unavailable')
  await transactionDb.transaction(async tx => {
    const id = String(form.get('bookingId') ?? '')
    const [lookup] = await tx.select().from(bookings).where(eq(bookings.id, id))
    if (!lookup) throw new Error('Unknown booking')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, lookup.productId)).for('update')
    await tx.select().from(customers).where(eq(customers.id, lookup.customerId)).for('update')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
    if (booking.status === 'completed') return
    if (booking.productType !== 'trip' || booking.status !== 'confirmed' || booking.eligibilityStatus === 'declined' || booking.cancelledAt || booking.cancelReason || !trip?.travelEnd || trip.travelEnd > new Date() || ['draft', 'cancelled'].includes(trip.status)) throw new Error('Completion requires an individual confirmed participant and ended travel')
    const facts=await readLockedPaymentFacts(tx,[booking])
    if(facts.summaries.get(id)?.outstandingMinor!==0) throw Error('Full payment required before confirming participation')
    if(await hasPendingDateDecision(tx,trip.id,[booking.id]))throw Error('Record the diver’s date decision before completion')
    const paid = facts.payments
    const allocations = paid.filter(p => p.kind !== 'refund' && p.verifiedAt).map(p => {
      const refundedCents = paid.filter(r => r.kind === 'refund' && r.sourcePaymentId === p.id && r.verifiedAt).reduce((s, r) => s + parseMoneyMinor(r.amount), 0)
      const cashCents = parseMoneyMinor(p.amount) - refundedCents
      if (!p.rmRate || Number(p.rmRate) <= 0 || cashCents < 0) throw new Error('Invalid payment conversion or refund allocation')
      return { paymentId:p.id, cashCents, refundedCents, rateSnapshot:p.rmRate, ...cashAward(cashCents,p.rmRate) }
    })
    const points = allocations.reduce((s, a) => s + a.points, 0)
    const existing = await tx.select().from(pointsLedger).where(and(eq(pointsLedger.bookingId, id), eq(pointsLedger.type, 'earned')))
    const now = new Date()
    const expiry = new Date(now)
    // Clamp leap-day completion to the last day of that month next year.
    const day = expiry.getUTCDate()
    expiry.setUTCDate(1)
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1)
    expiry.setUTCDate(Math.min(day, new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate()))
    if (!existing.length) {
      await tx.insert(pointsLedger).values({ id: `EARN-COMPLETE-${id}`, operationKey: `completion:${id}`, customerId: booking.customerId, bookingId: id, type: 'earned', points, rmAmount: (allocations.reduce((s, a) => s + Math.round(Number(a.rmAmount) * 100), 0) / 100).toFixed(2), expiresAt: expiry, ruleSnapshot: { awardVersion: 'completion-v1', earnRate: 1, expiryMonths: 12, rounding: 'floor_per_payment', restoration: 'none', allocations } })
    } else {
      const ledger = await tx.select().from(pointsLedger).where(eq(pointsLedger.customerId, booking.customerId))
      const retained = existing.reduce((s, lot) => s + lot.points + ledger.filter(e => e.sourceLotId === lot.id && e.type === 'reversed' && e.points < 0).reduce((n, e) => n + e.points, 0), 0)
      if (retained !== points) throw new Error(`Legacy points reconciliation required: retained ${retained}, completion calculation ${points}; no financial records changed`)
      await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'legacy_points_retained', entity: 'booking', entityId: id, meta: { points: retained, lots: existing.map(e => e.id), originalRulesAndExpiryRetained: true } })
    }
    await tx.update(bookings).set({ status: 'completed', completedAt: now, paymentRevision:booking.paymentRevision+1 }).where(eq(bookings.id, id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'booking_completed', entity: 'booking', entityId: id, meta: { points, legacyAwardRetained: existing.length > 0 } })
  })
  revalidatePath('/portal'); revalidatePath('/myokim'); revalidatePath('/invoice/[bookingId]','page')
}

export async function redeemPoints(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const id = String(form.get('bookingId') ?? '')
  const requested = Number(form.get('points'))
  const operationKey = String(form.get('operationKey') ?? '')
  if (!operationKey || !Number.isSafeInteger(requested) || requested <= 0) throw new Error('Invalid points')
  const result = await transactionDb.transaction(async tx => {
    const [lookup] = await tx.select().from(bookings).where(eq(bookings.id, id))
    if (!lookup) throw new Error('Unknown booking')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, lookup.productId)).for('update')
    await tx.select().from(customers).where(eq(customers.id, lookup.customerId)).for('update')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
    const ledger = await tx.select().from(pointsLedger).where(eq(pointsLedger.customerId, booking.customerId))
    const replay = ledger.find(e => e.operationKey === operationKey)
    if (replay) {
      const allocations = ledger.filter(e => e.bookingId === replay.bookingId && e.type === 'redeemed')
      if (replay.bookingId !== id || allocations.reduce((sum, e) => sum - e.points, 0) !== requested) throw new Error('Operation key reused')
      return {status: 'saved'} as const
    }
    if (String(booking.paymentRevision) !== form.get('expectedRevision')) return {status: 'stale'} as const
    if (!trip || trip.status !== 'open' || !trip.travelStart || trip.travelStart <= new Date() || booking.status !== 'awaiting_deposit' || booking.cancelledAt || booking.cancellationKind || booking.completedAt || booking.eligibilityStatus === 'declined' || ledger.some(e => e.bookingId === id && e.type === 'redeemed')) throw new Error('Redemption unavailable')
    const existingPayments = await tx.select().from(payments).where(eq(payments.bookingId, id))
    if (existingPayments.length) throw new Error('Apply points before payment')
    const [configured] = await tx.select().from(settings).where(eq(settings.key, 'points_rules'))
    const rules = { redeemValue: 0.05, capPct: 20, ...configured?.value }
    const rate = Number(trip.rmRate)
    const value = Number(rules.redeemValue)
    const cap = Math.min(20, Number(rules.capPct))
    const facts=await readLockedPaymentFacts(tx,[booking])
    const before=facts.summaries.get(id)!
    const final=before.stages[before.stages.length-1]
    if (!Number.isFinite(value) || value <= 0 || !(rate > 0) || !Number.isFinite(cap) || cap<=0 || before.discountMinor!==0) throw Error('Invalid redemption terms')
    const discountCents = redemptionDiscountMinor(requested, String(value), trip.rmRate)
    if (form.get('expectedDiscountMinor') !== String(discountCents)) return {status: 'stale'} as const
    if (!Number.isSafeInteger(discountCents)||discountCents<1||discountCents>maximumDiscountMinor(before.originalPriceMinor,final.amountMinor,cap)) throw Error('Points discount exceeds the final payment or cap')
    const completed = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.customerId, booking.customerId), eq(bookings.status, 'completed')))
    const now = new Date()
    let remaining = requested
    const funds=spendablePoints(ledger,new Set(completed.map(b=>b.id)),now)
    if(funds.available<requested)throw Error('Insufficient completed unexpired points')
    for(const {lot,amount} of funds.expired) {
      await tx.insert(pointsLedger).values({id:randomUUID(),customerId:booking.customerId,sourceLotId:lot.id,type:'expired',points:-amount,expiresAt:lot.expiresAt,ruleSnapshot:lot.ruleSnapshot})
    }
    for(const {lot,amount:available} of funds.spendable) {
      if(!remaining)break
      const used = Math.min(available, remaining)
      await tx.insert(pointsLedger).values({ id: randomUUID(), customerId: booking.customerId, bookingId: id, sourceLotId: lot.id, type: 'redeemed', points: -used, operationKey: remaining === requested ? operationKey : null, expiresAt: lot.expiresAt, ruleSnapshot: { ...rules, restoration: 'none' }, rateSnapshot: trip.rmRate, rmAmount: (used * value).toFixed(2) })
      remaining -= used
    }
    if (remaining) throw new Error('Insufficient completed unexpired points / 可用积分不足')
    const discount = discountCents / 100
    await tx.update(bookings).set({ pointsDiscountAmount: discount.toFixed(2), balanceAmount: ((before.originalPriceMinor-before.stages[0].amountMinor-discountCents)/100).toFixed(2), paymentRevision:before.revision+1 }).where(eq(bookings.id, id))
    await tx.update(invoices).set({ pointsRedemptionId: operationKey }).where(eq(invoices.bookingId, id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'points_redeemed', entity: 'booking', entityId: id, meta: { points: requested, discount: discount.toFixed(2), rules } })
    return {status: 'saved'} as const
  })
  revalidatePath('/portal'); revalidatePath('/myokim'); revalidatePath('/invoice/[bookingId]','page')
  return result
}

export async function handleInquiry(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  await transactionDb.transaction(async tx => {
    const id = String(form.get('inquiryId') ?? '')
    const changed = await tx.update(inquiries).set({ status: 'handled' }).where(and(eq(inquiries.id, id), eq(inquiries.status, 'new'))).returning({ id: inquiries.id })
    if (changed.length) await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'inquiry_handled', entity: 'inquiry', entityId: id })
  })
  revalidatePath('/portal')
}
