'use server'

import { auth, signIn } from '@/auth'
import { db, transactionDb } from '@/db'
import { auditLog, bookings, customers, signupNames, trips } from '@/db/schema'
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { parseEquipment } from './diver-equipment'
import { reserveTripBooking, type ReservationResult } from './booking-reservation'
import { revalidatePath } from 'next/cache'
import { attemptBookingAcknowledgment, type AcknowledgmentStatus } from './booking-notifications'
import { localEmailsDisabled } from './local-email-gate'
import { sendDepositPromptEmail } from './emails'

export type MagicLinkResult = { status: 'sent' | 'cooldown' | 'rate_limited' | 'name_taken' | 'error' }
type CreatedReservation = Extract<ReservationResult, { status: 'created' }>
export type BookingResult = Exclude<ReservationResult, CreatedReservation> | (CreatedReservation & { acknowledgment: AcknowledgmentStatus }) | { status: 'error' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Persist the customer's language choice on app surfaces (MVP-SPEC §11).
export async function setCustomerLocale(locale: 'en' | 'zh'): Promise<void> {
  const session = await auth()
  if (!session?.user?.customerId || !db) return
  await db.update(customers).set({ locale }).where(eq(customers.id, session.user.customerId))
}

export type NameSetupResult = { status: 'saved' | 'taken' | 'invalid' | 'unauthenticated' }

// Customer setup (owner decision 2026-11-21): unique diver name, captured once
// before the first booking. Case-insensitive; the partial unique index is the
// race-safe backstop. '' names are pending and excluded from the index.
export async function setCustomerName(formData: FormData): Promise<NameSetupResult> {
  const session = await auth()
  if (!session?.user?.customerId || !db) return { status: 'unauthenticated' }
  const name = String(formData.get('name') ?? '').trim().slice(0, 200)
  if (name.length < 2) return { status: 'invalid' }
  // Idempotent: re-submitting the already-set name never writes a second audit
  // row (known double-submit flake, logged by the My Okim chat 2026-11-21).
  const [current] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, session.user.customerId)).limit(1)
  if (current && current.name === name) return { status: 'saved' }
  const clash = await db.select({ id: customers.id }).from(customers)
    .where(and(sql`lower(${customers.name}) = ${name.toLowerCase()}`, ne(customers.id, session.user.customerId))).limit(1)
  if (clash.length) return { status: 'taken' }
  try {
    // Conditional update: a concurrent duplicate submission changes no row and
    // writes no second audit entry (race-safe idempotency).
    const changed = await db.update(customers).set({ name })
      .where(and(eq(customers.id, session.user.customerId), ne(customers.name, name))).returning({ id: customers.id })
    if (!changed.length) return { status: 'saved' }
  } catch {
    return { status: 'taken' } // concurrent setup won the race for this name
  }
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: session.user.id, action: 'customer_name_set', entity: 'customer', entityId: session.user.customerId })
  return { status: 'saved' }
}

// Email-step detection (owner decision 2026-11-21): new emails — and existing
// customers whose name is still pending — capture a unique name right here,
// not on a separate page. The name is stashed and applied at diver creation.
export async function checkSignupEmail(email: string): Promise<{ status: 'existing' | 'needs_name' | 'invalid' }> {
  const clean = email.trim().toLowerCase()
  if (!EMAIL_RE.test(clean) || !db) return { status: 'invalid' }
  const [customer] = await db.select({ name: customers.name }).from(customers).where(eq(customers.email, clean)).limit(1)
  return { status: customer && customer.name !== '' ? 'existing' : 'needs_name' }
}

async function nameIsFree(name: string, excludeEmail?: string): Promise<boolean> {
  const lower = name.toLowerCase()
  const clash = await db!.select({ id: customers.id }).from(customers).where(sql`lower(${customers.name}) = ${lower}`).limit(1)
  if (clash.length) return false
  // Unconsumed stashes older than 24h never block a name (magic links live 15 min).
  const fresh = new Date(Date.now() - 86_400_000)
  const stashClash = await db!.select({ email: signupNames.email }).from(signupNames)
    .where(and(sql`lower(${signupNames.name}) = ${lower}`, gt(signupNames.createdAt, fresh), excludeEmail ? ne(signupNames.email, excludeEmail) : undefined)).limit(1)
  return stashClash.length === 0
}

export async function requestMagicLink(email: string, slug: string, name?: string): Promise<MagicLinkResult> {
  const clean = email.trim().toLowerCase()
  if (!EMAIL_RE.test(clean) || !slug) return { status: 'error' }
  const trimmedName = (name ?? '').trim().slice(0, 200)
  if (trimmedName) {
    if (trimmedName.length < 2) return { status: 'error' }
    if (!db || !(await nameIsFree(trimmedName, clean))) return { status: 'name_taken' }
    await db.insert(signupNames).values({ email: clean, name: trimmedName })
      .onConflictDoUpdate({ target: signupNames.email, set: { name: trimmedName, createdAt: new Date() } })
  }
  try {
    await signIn('resend', { email: clean, redirectTo: `/book/${slug}`, redirect: false })
    return { status: 'sent' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('EMAIL_COOLDOWN')) return { status: 'cooldown' }
    if (message.includes('EMAIL_RATE_LIMIT')) return { status: 'rate_limited' }
    console.error('[booking] magic link request failed.', message)
    return { status: 'error' }
  }
}

export async function createBooking(slug: string, formData: FormData): Promise<BookingResult> {
  const session = await auth()
  const userId = session?.user?.id
  const customerId = session?.user?.customerId
  if (!userId || !customerId || !db || !transactionDb) return { status: 'unauthenticated' }
  let equipment
  try { equipment = parseEquipment(JSON.parse(String(formData.get('equipment')))) } catch { return { status: 'invalid' } }
  if (!equipment) return { status: 'invalid' }
  const text = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max)
  const name = text('name', 200)
  const certLevel = text('cert_level', 100)
  const divesRaw = text('logged_dives', 10)
  const loggedDives = divesRaw === '' ? NaN : Number(divesRaw)
  const emergencyName = text('emergency_name', 200)
  const emergencyPhone = text('emergency_phone', 40)
  const dob = text('dob', 20)
  const insurance = formData.get('insurance') === 'on'
  const medical = formData.get('medical') === 'on'
  const accepted = formData.get('accept_policy') === 'on'

  const operationKey = text('operationKey', 100)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationKey) ||
      formData.get('accept_deposits') !== 'on' || !name || !certLevel || !Number.isInteger(loggedDives) ||
      loggedDives < 0 || loggedDives > 10000 || !emergencyName || !emergencyPhone || !dob || !insurance || !medical || !accepted) {
    return { status: 'invalid' }
  }
  const termsVersionId = text('terms_version_id', 200)
  const locale = formData.get('locale') === 'zh' ? 'zh' : 'en'
  let result: ReservationResult
  try {
    result = await reserveTripBooking(transactionDb, {
      customerId, userId, slug, operationKey, acceptedOffer: text('acceptedOffer', 100), name,
      refundVersionId: text('refund_version_id', 200), termsVersionId, equipment,
      declarations: { certLevel, certAgency: text('cert_agency', 100), agencyOther: text('agency_other', 100),
        levelOther: text('level_other', 100), loggedDives, insurance, medical, emergencyName, emergencyPhone, dob,
        whatsapp: text('whatsapp', 40) || null, termsVersionId, locale },
    })
  } catch {
    console.error('[booking] Reservation transaction failed')
    return { status: 'error' }
  }
  if (result.status !== 'created') return result
  const database = db
  const acknowledgment = await attemptBookingAcknowledgment(result.bookingId, result, {
    suppressed: localEmailsDisabled(),
    async claimAttempt(id) {
      const rows = await database.update(bookings).set({ acknowledgmentAttemptedAt: new Date() })
        .where(and(eq(bookings.id, id), isNull(bookings.acknowledgmentAttemptedAt))).returning({ id: bookings.id })
      return rows.length === 1
    },
    async previousOutcome(id) {
      const [audit] = await database.select({ meta: auditLog.meta }).from(auditLog)
        .where(and(eq(auditLog.action, 'booking_acknowledgment'), eq(auditLog.entityId, id))).limit(1)
      const meta = audit?.meta as Record<string, unknown> | null
      if (meta?.outcome === 'failed' || meta?.outcome === 'suppressed' || meta?.outcome === 'provider_accepted') return meta.outcome
      return meta?.acceptedByProvider === true ? 'provider_accepted' : 'unconfirmed'
    },
    async send(booking) {
      const [recipient] = await database.select({ email: customers.email, name: customers.name, storedLocale: customers.locale,
        titleEn: trips.titleEn, titleZh: trips.titleZh }).from(customers).innerJoin(trips, eq(trips.slug, slug)).where(eq(customers.id, customerId))
      const mailLocale = recipient.storedLocale === 'zh' ? 'zh' : 'en'
      return sendDepositPromptEmail({ to: recipient.email, locale: mailLocale, customerName: recipient.name,
        tripTitle: mailLocale === 'zh' ? recipient.titleZh || recipient.titleEn : recipient.titleEn,
        bookingId: booking.bookingId, currency: booking.currency, stages: booking.stages })
    },
    async recordOutcome(id, outcome) {
      await database.insert(auditLog).values({ id: randomUUID(), actorUserId: userId, action: 'booking_acknowledgment',
        entity: 'booking', entityId: id, meta: { outcome, acceptedByProvider: outcome === 'provider_accepted', notifyIris: outcome === 'failed' } })
    },
  })
  revalidatePath('/portal')
  revalidatePath('/myokim')
  revalidatePath('/trips/' + slug)
  return { ...result, acknowledgment }
}
