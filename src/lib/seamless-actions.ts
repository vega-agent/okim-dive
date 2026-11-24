'use server'

import { db, transactionDb } from '@/db'
import { auditLog, inquiries, trips } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hasPendingDateDecision, lockActiveTripBookings } from './booking-lifecycle'
import { readLockedPaymentFacts } from './payment-queries'
import { requireInstructor } from './portal-actions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/* ---------- S5: trip-level completion (replaces per-booking dropdown) ---------- */

export async function completeTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const completed = 0
  await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip?.travelEnd || trip.travelEnd > new Date()) throw new Error('Trip has not ended yet / 行程尚未结束')
    if(trip.status==='completed')return
    if(['draft','cancelled'].includes(trip.status))throw Error('Trip cannot be closed')
    const active=await lockActiveTripBookings(tx,tripId)
    const {summaries}=await readLockedPaymentFacts(tx,active)
    if(active.some(b=>summaries.get(b.id)?.outstandingMinor!==0)) throw Error('Active bookings must be fully paid before closing the trip')
    if(await hasPendingDateDecision(tx,tripId,active.map(b=>b.id)))throw Error('Record the remaining date decisions before closing the trip')
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
