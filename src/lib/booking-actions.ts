'use server'

/**
 * M4 booking server actions (MVP-SPEC §5), updated for the seamless journey
 * (S1–S2, 2026-11-22): creating a booking soft-holds ONE slot for 14 days
 * (decision #22) and emails the transfer prompt; Iris's "Received" click in the
 * portal confirms against the bank record. No payment claim/upload here:
 * evidence travels via WhatsApp (decision #20).
 */
import { auth, signIn } from '@/auth'
import { db } from '@/db'
import { auditLog, bookings, customers, invoices, policyVersions, signupNames, trips } from '@/db/schema'
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { parseEquipment } from './diver-equipment'
import { slotsConsumed } from './trip-display'
import { sendDepositPromptEmail } from './emails'

export type MagicLinkResult = { status: 'sent' | 'cooldown' | 'rate_limited' | 'name_taken' | 'error' }
export type BookingResult =
  | { status: 'created'; bookingId: string; invoiceNumber: string; deposit: string; balance: string; currency: string; balanceDue: string | null; holdDue: string | null }
  | { status: 'unauthenticated' | 'invalid' | 'trip_unavailable' | 'trip_full' | 'error' }

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

// Sequential human-readable IDs can collide under concurrent inserts; retry once.
async function insertWithRetry(fn: () => Promise<string>): Promise<string> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
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

async function nextSequentialId(table: 'bookings' | 'invoices', prefix: string): Promise<string> {
  const rows = table === 'bookings'
    ? await db!.select({ id: bookings.id }).from(bookings)
    : await db!.select({ id: invoices.id }).from(invoices)
  const max = rows.reduce((acc, row) => {
    const n = Number(row.id.replace(new RegExp(`^${prefix}-`), ''))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

export async function createBooking(slug: string, formData: FormData): Promise<BookingResult> {
  const session = await auth()
  if (!session?.user?.customerId || !db) return { status: 'unauthenticated' }

  const [owner] = await db.select().from(customers).where(and(eq(customers.id, session.user.customerId), eq(customers.userId, session.user.id!))).limit(1)
  if (!owner || owner.mergedInto) return { status: 'unauthenticated' }
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

  if (!name || !certLevel || !Number.isInteger(loggedDives) || loggedDives < 0 || loggedDives > 10000
    || !emergencyName || !emergencyPhone || !dob || !insurance || !medical || !accepted) {
    return { status: 'invalid' }
  }

  try {
    const tripRows = await db.select().from(trips)
      .where(and(eq(trips.slug, slug), eq(trips.published, true), eq(trips.status, 'open'))).limit(1)
    const trip = tripRows[0]
    if (!trip) return { status: 'trip_unavailable' }

    // S2/#22: a booking soft-holds one slot for 14 days — block creation when
    // the hold math says full; the trip page offers Register interest instead.
    const existing = await db.select({ status: bookings.status }).from(bookings)
      .where(and(eq(bookings.productId, trip.id), eq(bookings.productType, 'trip')))
    if (slotsConsumed(existing.map(b => b.status)) >= trip.capacity) return { status: 'trip_full' }

    const policies = await db.select().from(policyVersions).orderBy(desc(policyVersions.version))
    const refund = policies.find((p) => p.kind === 'refund')
    const terms = policies.find((p) => p.kind === 'terms')
    if (!refund || !terms) return { status: 'error' }
    if (formData.get('refund_version_id') !== refund.id || formData.get('terms_version_id') !== terms.id) {
      return { status: 'invalid' }
    }

    const price = Number(trip.priceAmount)
    const deposit = trip.depositType === 'percent'
      ? Math.round(price * Number(trip.depositValue)) / 100
      : Math.min(Number(trip.depositValue), price)
    const balance = Math.round((price - deposit) * 100) / 100
    const balanceDue = trip.travelStart
      ? new Date(trip.travelStart.getTime() - trip.balanceDueDays * 86_400_000)
      : null

    const bookingId = await insertWithRetry(async () => {
      const id = await nextSequentialId('bookings', 'BKG')
      await db!.insert(bookings).values({
        id,
        customerId: session.user.customerId,
        equipment: equipment as unknown as Record<string, unknown>,
        productType: 'trip',
        productId: trip.id,
        status: 'awaiting_deposit',
        // Self-declared with truthfulness disclaimer (owner 2026-11-22): no
        // eligibility approval gate; the column stays for legacy rows.
        eligibilityStatus: 'approved',
        policyVersionId: refund.id,
        acceptedAt: new Date(),
        holdExpiresAt: new Date(Date.now() + 14 * 86_400_000),
        depositAmount: deposit.toFixed(2),
        balanceAmount: balance.toFixed(2),
        currency: trip.currency,
        pointsDiscountAmount: '0',
        declarations: {
          certLevel, certAgency: text('cert_agency',100), agencyOther:text('agency_other',100), levelOther:text('level_other',100), loggedDives, insurance, medical, emergencyName, emergencyPhone, dob,
          whatsapp: text('whatsapp', 40) || null,
          termsVersionId: terms.id,
          locale: formData.get('locale') === 'zh' ? 'zh' : 'en',
        },
      })
      return id
    })

    const invoiceId = await insertWithRetry(async () => {
      const id = await nextSequentialId('invoices', 'INV')
      await db!.insert(invoices).values({ id, bookingId, number: `INV-${new Date().getFullYear()}-${id.replace('INV-', '')}` })
      return id
    })
    const invoiceNumber = `INV-${new Date().getFullYear()}-${invoiceId.replace('INV-', '')}`

    // S1: transfer prompt email after commit; failure never fails the booking.
    const holdDue = new Date(Date.now() + 14 * 86_400_000)
    const [customer] = await db.select().from(customers).where(eq(customers.id, session.user.customerId!))
    if (customer) {
      const locale = customer.locale === 'zh' ? 'zh' : 'en'
      const ok = await sendDepositPromptEmail({
        to: customer.email, locale, customerName: customer.name,
        tripTitle: locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn,
        bookingId, amount: deposit.toFixed(2), currency: trip.currency, dueDate: holdDue.toISOString(),
      })
      await db.insert(auditLog).values({ id: randomUUID(), actorUserId: session.user.id, action: 'deposit_prompt_notified', entity: 'booking', entityId: bookingId, meta: { emailsSent: ok ? 1 : 0, emailsFailed: ok ? 0 : 1 } })
    }

    return {
      status: 'created',
      bookingId,
      invoiceNumber,
      deposit: deposit.toFixed(2),
      balance: balance.toFixed(2),
      currency: trip.currency,
      balanceDue: balanceDue ? balanceDue.toISOString().slice(0, 10) : null,
      holdDue: holdDue.toISOString().slice(0, 10),
    }
  } catch (error) {
    console.error('[booking] create failed.', error)
    return { status: 'error' }
  }
}
