// M4: booking flow entry (MVP-SPEC §10 /book/[tripSlug]).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { customers, policyVersions, trips } from '@/db/schema'
import SiteFooter from '@/components/site-footer'
import BookingWizard from '@/components/booking-wizard'
import CustomerSetup from '@/components/customer-setup'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Book a trip - Okim Dive' }

export default async function BookPage({ params }: { params: { tripSlug: string } }) {
  if (!db) notFound()
  const tripRows = await db.select().from(trips)
    .where(and(eq(trips.slug, params.tripSlug), eq(trips.published, true))).limit(1)
  const trip = tripRows[0]
  if (!trip) notFound()

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

  const bookable = trip.status === 'open'
  // '' = name setup pending (unique diver names, owner decision 2026-11-21).
  const needsSetup = Boolean(session?.user?.customerId) && customerName === ''

  return (
    <>
      <section className="page-hero trips-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">Book your trip</h1>
          <p className="hero-subtitle">One diver per booking. Your slot is confirmed after deposit verification.</p>
        </div>
      </section>
        <main className="ocean-journey">
        <section className="trips-section">
          <div className="container">
            {bookable ? (
              needsSetup ? <CustomerSetup /> : <BookingWizard
                slug={trip.slug}
                titleEn={trip.titleEn}
                titleZh={trip.titleZh}
                priceDisplay={trip.costDisplayEn}
                depositTextEn={trip.depositTextEn}
                depositTextZh={trip.depositTextZh}
                authenticated={Boolean(session?.user)}
                diverProfile={diverProfile}
                equipmentProfile={equipmentProfile}
                customerName={customerName}
                sessionEmail={session?.user?.email ?? ''}
                refund={{ id: refund.id, version: refund.version, bodyEn: refund.bodyEn, bodyZh: refund.bodyZh }}
                terms={{ id: terms.id, version: terms.version, bodyEn: terms.bodyEn, bodyZh: terms.bodyZh }}
              />
            ) : (
              <div className="booking-shell">
                <div className="booking-card">
                  <h2 className="booking-title">{trip.titleEn}</h2>
                  <p className="booking-intro">This trip is arranged on request. Tell us your plans and we will confirm the options together.</p>
                  <Link className="btn btn-primary" href="/contact">Ask about this trip</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
