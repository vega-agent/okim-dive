// M4: trip detail page (MVP-SPEC §10) — replaces the dialog-only flow for booking.
// Design follows the DESIGN-SYSTEM §5 trip-detail pattern as a full page:
// atmospheric header, compact fact strip, detail sections, planning note, CTA.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, trips } from '@/db/schema'
import { slotsConsumed } from '@/lib/trip-display'
import { sweepHolds } from '@/lib/seamless-actions'
import SiteFooter from '@/components/site-footer'
import TripDetail from '@/components/trip-detail'
import '../../../../styles/portal-tabs.css'

export const dynamic = 'force-dynamic'

async function getTrip(slug: string) {
  if (!db) return null
  const rows = await db.select().from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.published, true))).limit(1)
  return rows[0] ?? null
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const trip = await getTrip(params.slug)
  if (!trip) return { title: 'Trip not found - Okim Dive' }
  return { title: `${trip.titleEn} - Okim Dive`, description: trip.summaryEn ?? undefined }
}

export default async function TripPage({ params, searchParams }: { params: { slug: string }; searchParams: { interest?: string } }) {
  const trip = await getTrip(params.slug)
  if (!trip) notFound()
  await sweepHolds()
  const rows = db ? await db.select({ status: bookings.status }).from(bookings).where(and(eq(bookings.productId, trip.id), eq(bookings.productType, 'trip'))) : []
  const consumed = slotsConsumed(rows.map(r => r.status))
  const interestState = searchParams.interest === 'registered' ? 'registered' : searchParams.interest === 'error' ? 'error' : null

  return (
    <>
      <TripDetail trip={{
        id: trip.id,
        slug: trip.slug,
        status: trip.status,
        sample: trip.sample,
        currency: trip.currency,
        capacity: trip.capacity,
        consumed,
        interestState,
        titleEn: trip.titleEn, titleZh: trip.titleZh,
        locationEn: trip.locationEn, locationZh: trip.locationZh,
        summaryEn: trip.summaryEn, summaryZh: trip.summaryZh,
        travelDatesEn: trip.travelDatesEn, travelDatesZh: trip.travelDatesZh,
        durationEn: trip.durationEn, durationZh: trip.durationZh,
        difficultyEn: trip.difficultyEn, difficultyZh: trip.difficultyZh,
        groupSizeEn: trip.groupSizeEn, groupSizeZh: trip.groupSizeZh,
        costDisplayEn: trip.costDisplayEn, costDisplayZh: trip.costDisplayZh,
        costBasisEn: trip.costBasisEn, costBasisZh: trip.costBasisZh,
        highlightsEn: trip.highlightsEn, highlightsZh: trip.highlightsZh,
        itineraryEn: trip.itineraryEn, itineraryZh: trip.itineraryZh,
        includedEn: trip.includedEn, includedZh: trip.includedZh,
        additionalCostsEn: trip.additionalCostsEn, additionalCostsZh: trip.additionalCostsZh,
        depositTextEn: trip.depositTextEn, depositTextZh: trip.depositTextZh,
        balanceTextEn: trip.balanceTextEn, balanceTextZh: trip.balanceTextZh,
        cancellationTextEn: trip.cancellationTextEn, cancellationTextZh: trip.cancellationTextZh,
        requirementsTextEn: trip.requirementsTextEn, requirementsTextZh: trip.requirementsTextZh,
        notesEn: trip.notesEn, notesZh: trip.notesZh,
      }} />
      <SiteFooter />
    </>
  )
}