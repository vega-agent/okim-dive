// M4: booking flow entry (MVP-SPEC §10 /book/[tripSlug]).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, customers, policyVersions } from '@/db/schema'
import SiteFooter from '@/components/site-footer'
import { getPublishedTripOffer } from '@/lib/trip-offer'
import { SLOT_STATUSES } from '@/lib/trip-display'
import { localCalendarDate } from '@/lib/payment-schedule'
import { offerFingerprint } from '@/lib/booking-reservation'
import BookingWizard, { BookingAvailability, BookingHero } from '@/components/booking-wizard'
import CustomerSetup from '@/components/customer-setup'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Book a trip - Okim Dive' }

export default async function BookPage({ params }: { params: { tripSlug: string } }) {
  if (!db) notFound()
  const offer = await getPublishedTripOffer(params.tripSlug)
  if (!offer) notFound()
  const { trip, stages } = offer

  const session = await auth()
  const policies = await db.select().from(policyVersions).orderBy(desc(policyVersions.version))
  const refund = policies.find((p) => p.kind === 'refund')
  const terms = policies.find((p) => p.kind === 'terms')
  if (!refund || !terms) notFound()

  let diverProfile: {agency?:string;level?:string;dives?:number;phone?:string} | undefined
  let equipmentProfile: unknown
  let customerName = ''
  if (session?.user?.customerId) {
    const rows = await db.select({ name: customers.name, locale: customers.locale, profile: customers.diverProfile, phone: customers.phone }).from(customers)
      .where(eq(customers.id, session.user.customerId)).limit(1)
    diverProfile = {...rows[0]?.profile,phone:rows[0]?.phone ?? undefined}
    equipmentProfile = rows[0]?.profile?.equipment
    customerName = rows[0]?.name ?? ''
  }

  const today = localCalendarDate(new Date(), trip.departureTimezone)
  const [occupied] = await db.select({ count: sql<number>`count(*)::int`,
    mine: sql<boolean>`coalesce(bool_or(${bookings.customerId} = ${session?.user?.customerId ?? null}),false)` })
    .from(bookings).where(and(eq(bookings.productType, 'trip'), eq(bookings.productId, trip.id), inArray(bookings.status, SLOT_STATUSES.slice())))
  const beforeDeparture = Boolean(trip.travelStart && today < localCalendarDate(trip.travelStart, trip.departureTimezone))
  const full = beforeDeparture && (trip.status === 'full' || (trip.status === 'open' && occupied.count >= trip.capacity))
  const bookable = trip.status === 'open' && !occupied.mine && !full && stages.length > 0 && beforeDeparture
  // '' = name setup pending (unique diver names, owner decision 2026-11-21).
  const needsSetup = Boolean(session?.user?.customerId) && customerName === ''

  return (
    <>
      <BookingHero />
        <main className="ocean-journey">
        <section className="trips-section">
          <div className="container">
            {bookable ? (
              needsSetup ? <CustomerSetup /> : <BookingWizard
                slug={trip.slug}
                titleEn={trip.titleEn}
                titleZh={trip.titleZh}
                priceDisplay={trip.currency + ' ' + Number(trip.priceAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                currency={trip.currency} stages={stages} today={today}
                acceptedOffer={offerFingerprint(trip, stages)}
                authenticated={Boolean(session?.user)}
                diverProfile={diverProfile}
                equipmentProfile={equipmentProfile}
                customerName={customerName}
                sessionEmail={session?.user?.email ?? ''}
                refund={{ id: refund.id, version: refund.version, bodyEn: refund.bodyEn, bodyZh: refund.bodyZh }}
                terms={{ id: terms.id, version: terms.version, bodyEn: terms.bodyEn, bodyZh: terms.bodyZh }}
              />
            ) : (
              <BookingAvailability full={full} reserved={occupied.mine}
                slug={trip.slug} titleEn={trip.titleEn} titleZh={trip.titleZh} />
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
