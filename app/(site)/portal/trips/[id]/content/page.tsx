import { notFound } from 'next/navigation'
import { requireInstructor } from '@/lib/portal-actions'
import { db } from '@/db'
import { bookings, trips } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { slotsConsumed } from '@/lib/trip-display'
import TripContentEditor from '@/components/trip-content-editor'

export const dynamic = 'force-dynamic'
export default async function TripContentPage({ params }: { params: { id: string } }) {
  await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const [trip] = await db.select().from(trips).where(eq(trips.id, params.id))
  if (!trip) notFound()
  const rows = await db.select({ status: bookings.status }).from(bookings)
    .where(and(eq(bookings.productId, trip.id), eq(bookings.productType, 'trip')))
  return <TripContentEditor trip={JSON.parse(JSON.stringify(trip))} consumed={slotsConsumed(rows.map(r => r.status))} />
}