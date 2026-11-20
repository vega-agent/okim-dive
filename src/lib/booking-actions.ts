'use server'

/**
 * M4 booking server actions (MVP-SPEC §5).
 * Slot-hold rule: creating a booking does NOT reserve capacity — availability is
 * re-checked by Iris at deposit verification (M5). No payment claim/upload here:
 * evidence travels via WhatsApp (decision #20); Iris records payments in the portal.
 */
import { auth, signIn } from '@/auth'
import { db } from '@/db'
import { bookings, customers, invoices, policyVersions, trips } from '@/db/schema'
import { and, desc, eq } from 'drizzle-orm'

export type MagicLinkResult = { status: 'sent' | 'cooldown' | 'rate_limited' | 'error' }
export type BookingResult =
  | { status: 'created'; bookingId: string; invoiceNumber: string; deposit: string; balance: string; currency: string; balanceDue: string | null }
  | { status: 'unauthenticated' | 'invalid' | 'trip_unavailable' | 'error' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Persist the customer's language choice on app surfaces (MVP-SPEC §11).
export async function setCustomerLocale(locale: 'en' | 'zh'): Promise<void> {
  const session = await auth()
  if (!session?.user?.customerId || !db) return
  await db.update(customers).set({ locale }).where(eq(customers.id, session.user.customerId))
}

// Sequential human-readable IDs can collide under concurrent inserts; retry once.
async function insertWithRetry(fn: () => Promise<string>): Promise<string> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
}

export async function requestMagicLink(email: string, slug: string): Promise<MagicLinkResult> {
  const clean = email.trim().toLowerCase()
  if (!EMAIL_RE.test(clean) || !slug) return { status: 'error' }
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

    const policies = await db.select().from(policyVersions).orderBy(desc(policyVersions.version))
    const refund = policies.find((p) => p.kind === 'refund')
    const terms = policies.find((p) => p.kind === 'terms')
    if (!refund || !terms) return { status: 'error' }

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
        productType: 'trip',
        productId: trip.id,
        status: 'awaiting_deposit',
        eligibilityStatus: 'pending',
        policyVersionId: refund.id,
        acceptedAt: new Date(),
        depositAmount: deposit.toFixed(2),
        balanceAmount: balance.toFixed(2),
        currency: trip.currency,
        pointsDiscountAmount: '0',
        declarations: {
          certLevel, loggedDives, insurance, medical, emergencyName, emergencyPhone, dob,
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

    await db.update(customers).set({ name }).where(eq(customers.id, session.user.customerId))

    return {
      status: 'created',
      bookingId,
      invoiceNumber,
      deposit: deposit.toFixed(2),
      balance: balance.toFixed(2),
      currency: trip.currency,
      balanceDue: balanceDue ? balanceDue.toISOString().slice(0, 10) : null,
    }
  } catch (error) {
    console.error('[booking] create failed.', error)
    return { status: 'error' }
  }
}