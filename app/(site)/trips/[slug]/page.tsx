// M4: trip detail page (MVP-SPEC §10) — replaces the dialog-only flow for booking.
// Design follows the DESIGN-SYSTEM §5 trip-detail pattern as a full page:
// atmospheric header, compact fact strip, detail sections, planning note, CTA.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema'
import { slotsConsumed } from '@/lib/trip-display'
import { getPublishedTripOffer } from '@/lib/trip-offer'
import { localCalendarDate } from '@/lib/payment-schedule'
import SiteFooter from '@/components/site-footer'
import TripDetail from '@/components/trip-detail'
import '../../../../styles/portal-tabs.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const offer = await getPublishedTripOffer(params.slug)
  const trip = offer?.trip
  if (!trip) return { title: 'Trip not found - Okim Dive' }
  return { title: `${trip.titleEn} - Okim Dive`, description: trip.summaryEn ?? undefined }
}

export default async function TripPage({ params, searchParams }: { params: { slug: string }; searchParams: { interest?: string } }) {
  const offer = await getPublishedTripOffer(params.slug)
  if (!offer) notFound()
  const { trip, stages } = offer
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
        currency: trip.currency, stages, today: localCalendarDate(new Date(), trip.departureTimezone),
        bookable: Boolean(stages.length && ['open', 'full'].includes(trip.status) && trip.travelStart && localCalendarDate(new Date(), trip.departureTimezone) < localCalendarDate(trip.travelStart, trip.departureTimezone)),
        capacity: trip.capacity,
        consumed,
        interestState,
        titleEn: trip.titleEn, titleZh: trip.titleZh,
        locationEn: trip.locationEn, locationZh: trip.locationZh,
        airportEn: trip.airportEn, airportZh: trip.airportZh,
        jettyEn: trip.jettyEn, jettyZh: trip.jettyZh,
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
