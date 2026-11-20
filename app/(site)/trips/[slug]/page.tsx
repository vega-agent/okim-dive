// M4: trip detail page (MVP-SPEC §10) — replaces the dialog-only flow for booking.
// Design follows the DESIGN-SYSTEM §5 trip-detail pattern as a full page:
// atmospheric header, compact fact strip, detail sections, planning note, CTA.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { trips } from '@/db/schema'
import SiteFooter from '@/components/site-footer'
import TripDetail from '@/components/trip-detail'

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

export default async function TripPage({ params }: { params: { slug: string } }) {
  const trip = await getTrip(params.slug)
  if (!trip) notFound()

  return (
    <>
      <TripDetail trip={{
        slug: trip.slug,
        status: trip.status,
        sample: trip.sample,
        currency: trip.currency,
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