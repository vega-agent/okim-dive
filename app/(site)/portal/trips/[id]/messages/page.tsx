import { notFound } from 'next/navigation'
import { requirePortalSession } from '@/lib/portal-session'
import { db } from '@/db'
import { bookings, tripMessages, trips } from '@/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { messageSeenStats } from '@/lib/message-actions'
import { slotsConsumed } from '@/lib/trip-display'
import TripEditorNav from '@/components/trip-editor-nav'
import TripMessages from '@/components/trip-messages'

export const dynamic = 'force-dynamic'
export default async function TripMessagesPage({ params, searchParams }: { params: { id: string }; searchParams: { published?: string; edited?: string } }) {
  await requirePortalSession()
  if (!db) throw new Error('Database unavailable')
  const [trip] = await db.select().from(trips).where(eq(trips.id, params.id))
  if (!trip) notFound()
  const [messages, bookingRows] = await Promise.all([
    db.select().from(tripMessages)
      .where(and(eq(tripMessages.tripId, trip.id), isNull(tripMessages.deletedAt)))
      .orderBy(desc(tripMessages.publishedAt)),
    db.select({ status: bookings.status }).from(bookings)
      .where(and(eq(bookings.productId, trip.id), eq(bookings.productType, 'trip'))),
  ])
  const seen = await messageSeenStats(trip.id)
  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <TripEditorNav trip={JSON.parse(JSON.stringify(trip))} active="messages" consumed={slotsConsumed(bookingRows.map(r => r.status))} />
    <TripMessages
      tripId={trip.id}
      messages={JSON.parse(JSON.stringify(messages))}
      seen={seen}
      published={searchParams.published === '1'}
      edited={searchParams.edited === '1'}
    />
  </div></main>
}