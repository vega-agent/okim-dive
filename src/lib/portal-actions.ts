'use server'

import { auth } from '@/auth'
import { transactionDb } from '@/db'
import { auditLog, bookings, paymentClaims, payments, pointsLedger, trips, inquiries, customers, settings, invoices } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

export async function requireInstructor() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'instructor') throw new Error('Forbidden / 无权访问')
  return session.user.id
}

export async function recordPayment(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const bookingId = String(form.get('bookingId') ?? '')
  const amount = String(form.get('amount') ?? '')
  const currency = String(form.get('currency') ?? '')
  const kind = String(form.get('kind') ?? '')
  const operationKey = String(form.get('operationKey') ?? '')
  if (!['deposit', 'balance', 'full'].includes(kind) || !operationKey) throw new Error('Invalid payment kind or operation')
  const reference = String(form.get('reference') ?? '').trim()
  const paidOn = new Date(String(form.get('paidOn') ?? ''))
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || !reference || reference.length > 120 || !Number.isFinite(paidOn.getTime()) || paidOn > new Date()) throw new Error('Invalid payment / 付款资料无效')
  await transactionDb.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update')
    if (!booking || booking.currency !== currency) throw new Error('Currency or booking mismatch / 币种或预订不符')
    const existing = await tx.select().from(paymentClaims).where(eq(paymentClaims.operationKey, operationKey))
    if (existing.length) {
      if (existing[0].bookingId !== bookingId || existing[0].amount !== Number(amount).toFixed(2) || existing[0].kind !== kind || existing[0].reference !== reference) throw new Error('Operation key reused')
      return
    }
    const id = randomUUID()
    await tx.insert(paymentClaims).values({ id, bookingId, amount, currency: booking.currency, paidOn, reference, kind: kind as 'deposit' | 'balance' | 'full', recordedBy: actor, operationKey })
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'payment_recorded', entity: 'payment_claim', entityId: id })
  })
  revalidatePath('/portal')
}

export async function verifyPayment(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const claimId = String(form.get('claimId') ?? '')
  await transactionDb.transaction(async tx => {
    // All verification on a trip serializes before capacity and booking checks.
    const [lookup] = await tx.select().from(paymentClaims).where(eq(paymentClaims.id, claimId))
    if (!lookup) throw new Error('Unknown payment')
    const [lookupBooking] = await tx.select().from(bookings).where(eq(bookings.id, lookup.bookingId))
    if (!lookupBooking || lookupBooking.productType !== 'trip') throw new Error('Unknown trip booking')
    await tx.select().from(customers).where(eq(customers.id, lookupBooking.customerId)).for('update')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, lookupBooking.productId)).for('update')
    if (!trip) throw new Error('Unknown trip')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, lookup.bookingId)).for('update')
    const [claim] = await tx.select().from(paymentClaims).where(eq(paymentClaims.id, claimId)).for('update')
    if (claim.status === 'verified') return
    if (claim.status !== 'pending' || claim.currency !== booking.currency) throw new Error('Invalid claim')
    const previous = await tx.select().from(payments).where(eq(payments.bookingId, booking.id))
    const cash = previous.reduce((sum, p) => sum + (p.kind === 'refund' ? -1 : 1) * Math.round(Number(p.amount) * 100), 0) + Math.round(Number(claim.amount) * 100)
    let status = booking.status
    if (!['confirmed', 'completed'].includes(status)) {
      const occupied = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.productId, trip.id), inArray(bookings.status, ['confirmed', 'completed'])))
      const unavailable = booking.eligibilityStatus === 'declined' || ['cancelled', 'refund_flagged', 'eligibility_declined'].includes(status) || !['open', 'full'].includes(trip.status) || (!!trip.travelStart && trip.travelStart <= new Date())
      if (unavailable || occupied.length >= trip.capacity) status = 'refund_flagged'
      else if (claim.kind !== 'balance' && booking.depositAmount !== null && cash >= Math.round(Number(booking.depositAmount) * 100)) status = 'confirmed'
    }
    const id = `PAY-${claim.id}`
    const now = new Date()
    if (Number(trip.rmRate) <= 0) throw new Error('Invalid RM conversion')
    const rm = Number(claim.amount) * Number(trip.rmRate)
    await tx.insert(payments).values({ id, bookingId: booking.id, claimId, kind: claim.kind, amount: claim.amount, currency: claim.currency, rmRate: trip.rmRate, rmAmount: rm.toFixed(2), verifiedBy: actor, verifiedAt: now, receiptNo: `RCT-${claim.id}` })
    await tx.update(paymentClaims).set({ status: 'verified' }).where(eq(paymentClaims.id, claimId))
    await tx.update(bookings).set({ status }).where(eq(bookings.id, booking.id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'payment_verified', entity: 'payment', entityId: id, meta: { bookingStatus: status } })
  })
  revalidatePath('/portal')
}

// Owner decision 2026-11-22: eligibility APPROVAL removed — declarations are
// self-declared (truthfulness disclaimer at booking/profile), so an approval
// click verified nothing. Withdraw replaces Decline: diver withdraws or Iris
// rejects; paid bookings enter refund review, unpaid bookings cancel.
export async function withdrawBooking(form: FormData) {
  const actor = await requireInstructor()
  const id = String(form.get('bookingId') ?? '')
  if (!transactionDb) throw new Error('Database unavailable')
  await transactionDb.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
    if (!booking) throw new Error('Unknown booking')
    if (['cancelled', 'completed', 'refund_flagged', 'eligibility_declined'].includes(booking.status)) return
    const paid = await tx.select().from(payments).where(eq(payments.bookingId, id))
    const netPaid = paid.reduce((sum, p) => sum + (p.kind === 'refund' ? -1 : 1) * Number(p.amount), 0)
    await tx.update(bookings).set({
      status: netPaid > 0 ? 'refund_flagged' as const : 'cancelled' as const,
      holdExpiresAt: null,
      ...(netPaid > 0 ? {} : { cancelledAt: new Date(), cancelReason: 'Withdrawn' }),
    }).where(eq(bookings.id, id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'booking_withdrawn', entity: 'booking', entityId: id, meta: { netPaid } })
  })
  revalidatePath('/portal'); revalidatePath('/myokim')
}

export async function refundPayment(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const paymentId = String(form.get('paymentId') ?? '')
  const amount = String(form.get('amount') ?? '')
  const operationKey = String(form.get('operationKey') ?? '')
  const reason = String(form.get('reason') ?? '').trim()
  if (!operationKey || !reason || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) throw new Error('Invalid refund / 退款资料无效')
  await transactionDb.transaction(async tx => {
    const [source] = await tx.select().from(payments).where(eq(payments.id, paymentId))
    if (!source || source.kind === 'refund' || !source.verifiedAt) throw new Error('Unknown verified payment')
    const [lookup] = await tx.select().from(bookings).where(eq(bookings.id, source.bookingId))
    await tx.select().from(customers).where(eq(customers.id, lookup.customerId)).for('update')
    await tx.select().from(trips).where(eq(trips.id, lookup.productId)).for('update')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, source.bookingId)).for('update')
    const [replay] = await tx.select().from(payments).where(eq(payments.operationKey, operationKey))
    if (replay) {
      if (replay.sourcePaymentId !== paymentId || replay.amount !== Number(amount).toFixed(2)) throw new Error('Operation key reused')
      return
    }
    const refunds = await tx.select().from(payments).where(eq(payments.sourcePaymentId, paymentId))
    const cents = Math.round(Number(amount) * 100)
    const total = refunds.reduce((s, p) => s + Math.round(Number(p.amount) * 100), cents)
    const original = Math.round(Number(source.amount) * 100)
    if (total > original) throw new Error('Refund exceeds payment / 退款超过付款金额')
    const id = randomUUID()
    await tx.insert(payments).values({ id, bookingId: booking.id, sourcePaymentId: source.id, operationKey, kind: 'refund', amount: (cents / 100).toFixed(2), currency: source.currency, rmRate: source.rmRate, rmAmount: (Number(amount) * Number(source.rmRate)).toFixed(2), verifiedBy: actor, verifiedAt: new Date(), receiptNo: `REF-${id}` })
    const ledger = await tx.select().from(pointsLedger).where(eq(pointsLedger.customerId, booking.customerId))
    const earned = ledger.find(e => e.type === 'earned' && (e.paymentId === source.id || (e.bookingId === booking.id && e.ruleSnapshot?.awardVersion === 'completion-v1')))
    if (earned) {
      const allocations = earned.ruleSnapshot?.allocations as { paymentId: string; points: number; cashCents: number; refundedCents: number }[] | undefined
      const allocation = allocations?.find(a => a.paymentId === source.id)
      const reversed = ledger.filter(e => e.sourceLotId === earned.id && e.type === 'reversed' && e.points < 0 && (!allocation || e.note === `refund:${source.id}`)).reduce((s, e) => s - e.points, 0)
      const points = allocation && allocation.cashCents > 0 ? Math.floor(allocation.points * (total - allocation.refundedCents) / allocation.cashCents) - reversed : allocations ? 0 : Math.floor(earned.points * total / original) - reversed
      if (points > 0) await tx.insert(pointsLedger).values({ id: `REV-${id}`, customerId: booking.customerId, bookingId: booking.id, paymentId: id, sourceLotId: earned.id, type: 'reversed', points: -points, expiresAt: earned.expiresAt, ruleSnapshot: earned.ruleSnapshot, rateSnapshot: earned.rateSnapshot, note: allocation ? `refund:${source.id}` : reason })
    }
    // Owner decision (keep it simple): redeemed points are NEVER restored on
    // refund — no refund of points. Earned-lot reversal above still applies;
    // a resulting negative balance blocks future redemption (redeemPoints).
    await tx.update(bookings).set({ status: booking.completedAt ? 'completed' : 'refund_flagged' }).where(eq(bookings.id, booking.id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'refund_recorded', entity: 'payment', entityId: id, meta: { reason, sourcePaymentId: paymentId } })
  })
  revalidatePath('/portal')
}

export async function completeBooking(form: FormData) {
  const actor = await requireInstructor()
  if (form.get('participated') !== 'on') throw new Error('Confirm individual participation before completion')
  if (!transactionDb) throw new Error('Database unavailable')
  await transactionDb.transaction(async tx => {
    const id = String(form.get('bookingId') ?? '')
    const [lookup] = await tx.select().from(bookings).where(eq(bookings.id, id))
    if (!lookup) throw new Error('Unknown booking')
    await tx.select().from(customers).where(eq(customers.id, lookup.customerId)).for('update')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, lookup.productId)).for('update')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
    if (booking.status === 'completed') return
    if (booking.productType !== 'trip' || booking.status !== 'confirmed' || booking.eligibilityStatus === 'declined' || booking.cancelledAt || booking.cancelReason || !trip?.travelEnd || trip.travelEnd > new Date() || ['draft', 'cancelled'].includes(trip.status)) throw new Error('Completion requires an individual confirmed participant and ended travel')
    const paid = await tx.select().from(payments).where(eq(payments.bookingId, id))
    const allocations = paid.filter(p => p.kind !== 'refund' && p.verifiedAt).map(p => {
      const refundedCents = paid.filter(r => r.kind === 'refund' && r.sourcePaymentId === p.id && r.verifiedAt).reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0)
      const cashCents = Math.round(Number(p.amount) * 100) - refundedCents
      if (!p.rmRate || Number(p.rmRate) <= 0 || cashCents < 0) throw new Error('Invalid payment conversion or refund allocation')
      const rm = cashCents / 100 * Number(p.rmRate)
      return { paymentId: p.id, cashCents, refundedCents, rateSnapshot: p.rmRate, rmAmount: rm.toFixed(2), points: Math.floor(rm) }
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
    await tx.update(bookings).set({ status: 'completed', completedAt: now }).where(eq(bookings.id, id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'booking_completed', entity: 'booking', entityId: id, meta: { points, legacyAwardRetained: existing.length > 0 } })
  })
  revalidatePath('/portal')
}

export async function redeemPoints(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const id = String(form.get('bookingId') ?? '')
  const requested = Number(form.get('points'))
  const operationKey = String(form.get('operationKey') ?? '')
  if (!operationKey || !Number.isSafeInteger(requested) || requested <= 0) throw new Error('Invalid points')
  await transactionDb.transaction(async tx => {
    const [lookup] = await tx.select().from(bookings).where(eq(bookings.id, id))
    if (!lookup) throw new Error('Unknown booking')
    await tx.select().from(customers).where(eq(customers.id, lookup.customerId)).for('update')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, lookup.productId)).for('update')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update')
    const ledger = await tx.select().from(pointsLedger).where(eq(pointsLedger.customerId, booking.customerId))
    const replay = ledger.find(e => e.operationKey === operationKey)
    if (replay) {
      const allocations = ledger.filter(e => e.bookingId === replay.bookingId && e.type === 'redeemed')
      if (replay.bookingId !== id || allocations.reduce((sum, e) => sum - e.points, 0) !== requested) throw new Error('Operation key reused')
      return
    }
    if (!trip || trip.status !== 'open' || !trip.travelStart || trip.travelStart <= new Date() || booking.status !== 'awaiting_deposit' || booking.eligibilityStatus === 'declined' || ledger.some(e => e.bookingId === id && e.type === 'redeemed')) throw new Error('Redemption unavailable')
    const existingPayments = await tx.select().from(payments).where(eq(payments.bookingId, id))
    if (existingPayments.length) throw new Error('Apply points before payment')
    const [configured] = await tx.select().from(settings).where(eq(settings.key, 'points_rules'))
    const rules = { redeemValue: 0.05, capPct: 20, ...configured?.value }
    const rate = Number(trip.rmRate)
    const value = Number(rules.redeemValue)
    const cap = Math.min(20, Number(rules.capPct))
    const price = Number(booking.depositAmount) + Number(booking.balanceAmount)
    const discountCents = Math.floor(requested * value / rate * 100)
    if (!Number.isFinite(value) || value <= 0 || rate <= 0 || !Number.isFinite(cap) || cap <= 0 || discountCents < 1 || discountCents > Math.floor(price * cap)) throw new Error('Points discount exceeds cap')
    const completed = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.customerId, booking.customerId), eq(bookings.status, 'completed')))
    const now = new Date()
    let remaining = requested
    const lots = ledger.filter(e => e.type === 'earned').sort((a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0))
    // Negative debt from refunded, previously spent earnings blocks further redemption.
    if (ledger.reduce((s, e) => s + e.points, 0) < requested) throw new Error('Insufficient points')
    for (const lot of lots) {
      const available = lot.points + ledger.filter(e => e.sourceLotId === lot.id).reduce((s, e) => s + e.points, 0)
      if (available <= 0) continue
      if (!lot.expiresAt || lot.expiresAt <= now) {
        await tx.insert(pointsLedger).values({ id: randomUUID(), customerId: booking.customerId, sourceLotId: lot.id, type: 'expired', points: -available, expiresAt: lot.expiresAt, ruleSnapshot: lot.ruleSnapshot })
        continue
      }
      if (!completed.some(b => b.id === lot.bookingId) || remaining <= 0) continue
      const used = Math.min(available, remaining)
      await tx.insert(pointsLedger).values({ id: randomUUID(), customerId: booking.customerId, bookingId: id, sourceLotId: lot.id, type: 'redeemed', points: -used, operationKey: remaining === requested ? operationKey : null, expiresAt: lot.expiresAt, ruleSnapshot: { ...rules, restoration: 'none' }, rateSnapshot: trip.rmRate, rmAmount: (used * value).toFixed(2) })
      remaining -= used
    }
    if (remaining) throw new Error('Insufficient completed unexpired points / 可用积分不足')
    const discount = discountCents / 100
    if (discount > Number(booking.balanceAmount)) throw new Error('Discount cannot reduce required cash deposit')
    await tx.update(bookings).set({ pointsDiscountAmount: discount.toFixed(2), balanceAmount: (Number(booking.balanceAmount) - discount).toFixed(2) }).where(eq(bookings.id, id))
    await tx.update(invoices).set({ pointsRedemptionId: operationKey }).where(eq(invoices.bookingId, id))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'points_redeemed', entity: 'booking', entityId: id, meta: { points: requested, discount: discount.toFixed(2), rules } })
  })
  revalidatePath('/portal')
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
