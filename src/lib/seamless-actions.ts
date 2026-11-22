'use server'

/**
 * Seamless journey actions (S1–S5, OPC/PORTAL-REDESIGN-PLAN.md, 2026-11-22).
 * One linked booking-to-confirmed flow: the booking request carries the payment
 * expectation; Iris's "Received" click writes claim + payment atomically (the
 * recording ≠ verification distinction survives inside the one act), re-checks
 * capacity, and emails the diver. 14-day soft-hold mechanics per decision #22.
 */
import { db, transactionDb } from '@/db'
import { localEmailsDisabled } from './local-email-gate'
import { auditLog, bookings, customers, inquiries, paymentClaims, payments, trips } from '@/db/schema'
import { and, eq, inArray, isNull, lte, gt } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireInstructor } from './portal-actions'
import { sendBookingConfirmedEmail, sendDepositReminderEmail, sendHoldExpiredEmail } from './emails'

const REMINDER_DAYS_BEFORE = 3
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const num2 = (v: string) => Math.round(Number(v) * 100) / 100

/* ---------- S1/S3: "Received" — one click, expected amount pre-filled ---------- */

export async function confirmReceived(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb || !db) throw new Error('Database unavailable')
  const bookingId = String(form.get('bookingId') ?? '')
  const operationKey = String(form.get('operationKey') ?? '')
  if (!bookingId || !operationKey) throw new Error('Invalid confirmation')
  const amountRaw = String(form.get('amount') ?? '').trim()
  const kindRaw = String(form.get('kind') ?? '').trim()
  const paidOnRaw = String(form.get('paidOn') ?? '').trim()
  if (kindRaw && !['deposit', 'balance', 'full'].includes(kindRaw)) throw new Error('Invalid payment kind')
  if (amountRaw && (!/^\d+(\.\d{1,2})?$/.test(amountRaw) || Number(amountRaw) <= 0)) throw new Error('Invalid amount / 金额无效')
  const paidOn = paidOnRaw ? new Date(paidOnRaw) : new Date()
  if (Number.isNaN(paidOn.getTime()) || paidOn > new Date()) throw new Error('Invalid date paid / 付款日期无效')

  const notifications: { customerId: string; tripId: string; paymentId: string; amount: string; kind: string; points: number; bookingStatus: string }[] = []
  await transactionDb.transaction(async tx => {
    // Serialize on the trip exactly like verifyPayment before capacity checks.
    const [lookup] = await tx.select().from(bookings).where(eq(bookings.id, bookingId))
    if (!lookup || lookup.productType !== 'trip') throw new Error('Unknown trip booking')
    await tx.select().from(customers).where(eq(customers.id, lookup.customerId)).for('update')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, lookup.productId)).for('update')
    if (!trip) throw new Error('Unknown trip')
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update')
    if (booking.status === 'completed') return
    const previous = await tx.select().from(payments).where(eq(payments.bookingId, booking.id))
    const cash = previous.reduce((sum, p) => sum + (p.kind === 'refund' ? -1 : 1) * Math.round(Number(p.amount) * 100), 0)
    const depositCents = Math.round(Number(booking.depositAmount ?? 0) * 100)
    const priceCents = depositCents + Math.round(Number(booking.balanceAmount ?? 0) * 100)
    const kind = (kindRaw || (cash < depositCents ? 'deposit' : 'balance')) as 'deposit' | 'balance' | 'full'
    const expectedCents = cash < depositCents ? depositCents - cash : priceCents - cash
    const amountCents = amountRaw ? Math.round(Number(amountRaw) * 100) : expectedCents
    if (amountCents <= 0) throw new Error('Nothing left to receive on this booking')
    const amount = (amountCents / 100).toFixed(2)
    const replay = await tx.select().from(paymentClaims).where(eq(paymentClaims.operationKey, operationKey))
    if (replay.length) {
      if (replay[0].bookingId !== bookingId || replay[0].amount !== amount || replay[0].kind !== kind) throw new Error('Operation key reused')
      return
    }

    const unavailable = booking.eligibilityStatus === 'declined'
      || ['cancelled', 'refund_flagged', 'eligibility_declined', 'expired'].includes(booking.status)
      || !['open', 'full'].includes(trip.status)
      || (!!trip.travelStart && trip.travelStart <= new Date())
    const occupied = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.productId, trip.id), inArray(bookings.status, ['confirmed', 'completed'])))
    let status = booking.status
    if (unavailable || occupied.length >= trip.capacity) status = 'refund_flagged'
    else if (cash + amountCents >= depositCents) status = 'confirmed'

    const claimId = randomUUID()
    await tx.insert(paymentClaims).values({
      id: claimId, bookingId, amount, currency: booking.currency, paidOn,
      reference: bookingId, kind, recordedBy: actor, operationKey,
      submittedAt: new Date(), status: 'verified',
    })
    const paymentId = `PAY-${claimId}`
    const now = new Date()
    if (Number(trip.rmRate) <= 0) throw new Error('Invalid RM conversion')
    const rm = Number(amount) * Number(trip.rmRate)
    const points = 0
    await tx.insert(payments).values({
      id: paymentId, bookingId, claimId, kind, amount, currency: booking.currency,
      rmRate: trip.rmRate, rmAmount: rm.toFixed(2), verifiedBy: actor, verifiedAt: now,
      receiptNo: `RCT-${claimId}`, operationKey: `pay-${operationKey}`,
    })
    await tx.update(bookings).set({ status, ...(status === 'confirmed' ? { holdExpiresAt: null } : {}) }).where(eq(bookings.id, bookingId))
    // Two audit rows, one act — the claim/verification trail stays intact (S1).
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'payment_recorded', entity: 'payment_claim', entityId: claimId, meta: { via: 'received' } })
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'payment_verified', entity: 'payment', entityId: paymentId, meta: { bookingStatus: status, via: 'received' } })
    notifications.push({ customerId: booking.customerId, tripId: trip.id, paymentId, amount, kind, points, bookingStatus: status })
  })

  // Notify after commit; email failure never undoes the confirmation.
  for (const p of notifications) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, p.customerId))
    const [trip] = await db.select().from(trips).where(eq(trips.id, p.tripId))
    if (customer && trip) {
      const locale = customer.locale === 'zh' ? 'zh' : 'en'
      const balanceDue = p.bookingStatus === 'confirmed' && trip.travelStart
        ? new Date(trip.travelStart.getTime() - trip.balanceDueDays * 86_400_000).toISOString()
        : null
      const ok = await sendBookingConfirmedEmail({
        to: customer.email, locale, customerName: customer.name,
        tripTitle: locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn,
        bookingId, amount: p.amount, currency: trip.currency, kind: p.kind,
        paymentId: p.paymentId, pointsEarned: p.points, balanceDue,
      })
      await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'booking_confirmed_notified', entity: 'booking', entityId: bookingId, meta: { emailsSent: ok ? 1 : 0, emailsFailed: ok ? 0 : 1, bookingStatus: p.bookingStatus } })
    }
  }
  revalidatePath('/portal'); revalidatePath('/myokim')
}

/* ---------- #22: Extend / Release the 14-day soft hold ---------- */

export async function extendHold(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const bookingId = String(form.get('bookingId') ?? '')
  const days = Number(form.get('days'))
  if (![7, 14].includes(days)) throw new Error('Invalid extension')
  await transactionDb.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update')
    if (!booking || booking.status !== 'awaiting_deposit' || !booking.holdExpiresAt) throw new Error('No active hold on this booking')
    const [trip] = await tx.select().from(trips).where(eq(trips.id, booking.productId))
    const extended = new Date(booking.holdExpiresAt.getTime() + days * 86_400_000)
    const capped = trip?.travelStart && extended > trip.travelStart ? trip.travelStart : extended
    if (capped <= booking.holdExpiresAt) throw new Error('Hold already at departure cap')
    await tx.update(bookings).set({ holdExpiresAt: capped, reminderSentAt: null }).where(eq(bookings.id, bookingId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'hold_extended', entity: 'booking', entityId: bookingId, meta: { days, from: booking.holdExpiresAt.toISOString(), to: capped.toISOString() } })
  })
  revalidatePath('/portal'); revalidatePath('/myokim')
}

export async function releaseHold(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb || !db) throw new Error('Database unavailable')
  const bookingId = String(form.get('bookingId') ?? '')
  const reason = String(form.get('reason') ?? '').trim().slice(0, 200)
  if (!reason) throw new Error('Reason required / 请填写原因')
  const notifications: { customerId: string; tripId: string }[] = []
  await transactionDb.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update')
    if (!booking || !['awaiting_deposit', 'payment_claimed'].includes(booking.status)) throw new Error('Only unconfirmed bookings can be released')
    const paid = await tx.select().from(payments).where(eq(payments.bookingId, bookingId))
    const netPaid = paid.reduce((sum, p) => sum + (p.kind === 'refund' ? -1 : 1) * Number(p.amount), 0)
    const status = netPaid > 0 ? 'refund_flagged' : 'cancelled'
    await tx.update(bookings).set({
      status, holdExpiresAt: null,
      ...(status === 'cancelled' ? { cancelledAt: new Date(), cancelReason: `Released: ${reason}` } : {}),
    }).where(eq(bookings.id, bookingId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: netPaid > 0 ? 'booking_refund_flagged' : 'hold_released', entity: 'booking', entityId: bookingId, meta: { reason } })
    // Paid bookings enter the refund flow (Iris contacts personally, S4);
    // only unpaid releases get the automated notice.
    if (status === 'cancelled') notifications.push({ customerId: booking.customerId, tripId: booking.productId })
  })
  for (const n of notifications) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, n.customerId))
    const [trip] = await db.select().from(trips).where(eq(trips.id, n.tripId))
    if (customer && trip) {
      const locale = customer.locale === 'zh' ? 'zh' : 'en'
      const ok = await sendHoldExpiredEmail({
        to: customer.email, locale, customerName: customer.name,
        tripTitle: locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn,
        bookingId, mode: 'released', reason,
      })
      await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'hold_release_notified', entity: 'booking', entityId: bookingId, meta: { emailsSent: ok ? 1 : 0, emailsFailed: ok ? 0 : 1 } })
    }
  }
  revalidatePath('/portal'); revalidatePath('/myokim')
}

/* ---------- S5: trip-level completion (replaces per-booking dropdown) ---------- */

export async function completeTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const completed = 0
  await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip?.travelEnd || trip.travelEnd > new Date()) throw new Error('Trip has not ended yet / 行程尚未结束')
    // Trip closure never asserts individual attendance or awards points.
    await tx.update(trips).set({ status: 'completed' }).where(eq(trips.id, tripId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_completed', entity: 'trip', entityId: tripId, meta: { bookingsCompleted: completed } })
  })
  revalidatePath('/portal'); revalidatePath('/myokim')
}

/* ---------- S2: Register interest when a trip is full (public) ---------- */

export async function registerInterest(form: FormData) {
  const text = (key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max)
  const name = text('name', 200)
  const email = text('email', 200)
  const tripId = text('tripId', 100)
  const consent = form.get('consent') === 'on'
  const locale = form.get('locale') === 'zh' ? 'zh' : 'en'
  if (!db) redirect('/trips?interest=error')
  const [trip] = await db.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.published, true))).limit(1)
  if (!trip || name.length < 2 || !EMAIL_RE.test(email) || !consent) redirect(`/trips/${trip?.slug ?? ''}?interest=error`)
  try {
    await db.insert(inquiries).values({
      id: randomUUID(), name, email, interest: 'trip', interestDetail: 'waitlist',
      tripId, message: locale === 'zh' ? '候补登记——行程已满，希望有空位时获通知。' : 'Waitlist interest — trip full, would like a slot if one opens.',
      whatsapp: text('whatsapp', 40) || null, locale, consentAt: new Date(),
    })
    await db.insert(auditLog).values({ id: randomUUID(), actorUserId: null, action: 'interest_registered', entity: 'trip', entityId: tripId, meta: { email } })
  } catch (error) {
    console.error('[interest] insert failed.', error)
    redirect(`/trips/${trip.slug}?interest=error`)
  }
  redirect(`/trips/${trip.slug}?interest=registered`)
}

/* ---------- #22: idempotent lazy sweep (reminders T-3, expiry release) ---------- */

export async function sweepHolds(): Promise<{ reminded: number; expired: number }> {
  if (localEmailsDisabled()) return { reminded: 0, expired: 0 }
  if (!db) return { reminded: 0, expired: 0 }
  const now = new Date()
  const reminderCutoff = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 86_400_000)
  let reminded = 0, expired = 0

  const dueReminders = await db.select().from(bookings).where(and(
    eq(bookings.status, 'awaiting_deposit'), isNull(bookings.reminderSentAt),
    gt(bookings.holdExpiresAt, now), lte(bookings.holdExpiresAt, reminderCutoff),
  ))
  for (const booking of dueReminders) {
    // Claim the row first so concurrent sweeps never double-send.
    const claimed = await db.update(bookings).set({ reminderSentAt: now })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'awaiting_deposit'), isNull(bookings.reminderSentAt)))
      .returning({ id: bookings.id })
    if (!claimed.length) continue
    const [customer] = await db.select().from(customers).where(eq(customers.id, booking.customerId))
    const [trip] = await db.select().from(trips).where(eq(trips.id, booking.productId))
    if (!customer || !trip || !booking.holdExpiresAt) continue
    const locale = customer.locale === 'zh' ? 'zh' : 'en'
    const ok = await sendDepositReminderEmail({
      to: customer.email, locale, customerName: customer.name,
      tripTitle: locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn,
      bookingId: booking.id, amount: booking.depositAmount ?? '0', currency: booking.currency,
      dueDate: booking.holdExpiresAt.toISOString(),
    })
    await db.insert(auditLog).values({ id: randomUUID(), actorUserId: null, action: 'hold_reminder_sent', entity: 'booking', entityId: booking.id, meta: { emailsSent: ok ? 1 : 0, emailsFailed: ok ? 0 : 1 } })
    reminded++
  }

  const dueExpiry = await db.select().from(bookings).where(and(
    eq(bookings.status, 'awaiting_deposit'), lte(bookings.holdExpiresAt, now),
  ))
  for (const booking of dueExpiry) {
    const claimed = await db.update(bookings).set({ status: 'expired' })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'awaiting_deposit')))
      .returning({ id: bookings.id })
    if (!claimed.length) continue
    await db.insert(auditLog).values({ id: randomUUID(), actorUserId: null, action: 'hold_expired', entity: 'booking', entityId: booking.id })
    const [customer] = await db.select().from(customers).where(eq(customers.id, booking.customerId))
    const [trip] = await db.select().from(trips).where(eq(trips.id, booking.productId))
    if (customer && trip) {
      const locale = customer.locale === 'zh' ? 'zh' : 'en'
      const ok = await sendHoldExpiredEmail({
        to: customer.email, locale, customerName: customer.name,
        tripTitle: locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn,
        bookingId: booking.id, mode: 'expired',
      })
      await db.insert(auditLog).values({ id: randomUUID(), actorUserId: null, action: 'hold_expiry_notified', entity: 'booking', entityId: booking.id, meta: { emailsSent: ok ? 1 : 0, emailsFailed: ok ? 0 : 1 } })
    }
    expired++
  }
  return { reminded, expired }
}
