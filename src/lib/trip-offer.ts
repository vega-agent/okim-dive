import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { tripDeposits, trips } from '@/db/schema'
import { buildTripStages } from './trip-display'
import type { StageInput } from './payment-schedule'

/** Price and deposit dates must come from the same committed settings revision. */
export const getPublishedTripOffer = cache(async (slug: string) => {
  if (!db) return null
  const rows = await db.select({ trip: trips, deposit: tripDeposits }).from(trips)
    .leftJoin(tripDeposits, eq(tripDeposits.tripId, trips.id))
    .where(and(eq(trips.slug, slug), eq(trips.published, true))).orderBy(tripDeposits.sort)
  if (!rows.length) return null
  const trip = rows[0].trip
  const deposits = rows.flatMap(row => row.deposit ? [row.deposit] : [])
  let stages: StageInput[] = []
  if (trip.travelStart && deposits.length) {
    try { stages = buildTripStages(trip, deposits) }
    catch (error) {
      if (!(error instanceof RangeError)) throw error
      console.error('[booking] Incomplete payment schedule for trip', trip.id)
    }
  }
  return { trip, stages }
})
