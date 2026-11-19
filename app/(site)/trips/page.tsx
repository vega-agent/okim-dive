// M2 port of legacy-static/trips.html (design preserved verbatim).
// M3: trip cards + detail dialog render from Postgres (src/lib/trips.ts,
// seed JSON fallback); no client-side data fetch.
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/site-footer'
import TripsGrid from '@/components/trips-grid'
import { getTrips } from '@/lib/trips'

// Read trips at request time so portal edits (M5) appear without a rebuild.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dive Trips - Okim Dive',
  description: 'Follow your curiosity beneath the surface. Tioman dives arranged around your plans, and organised journeys to new destinations.',
}

export default async function TripsPage() {
  const trips = await getTrips()
  return (
    <>
      {/* Hero Section */}
      <section className="page-hero trips-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">Dive Trips</h1>
          <p className="hero-subtitle">Follow your curiosity beneath the surface.</p>
        </div>
      </section>

      <main className="ocean-journey">
        {/* Available Trips */}
        <section className="trips-section">
          <div className="container">
            <h2 className="section-title">Trips</h2>
            <p className="section-lede">Join us for the reefs, light, and marine life—or for the simple pleasure of being underwater. Choose a Tioman dive arranged around your plans, or a planned journey to a new destination.</p>
            <TripsGrid trips={trips} />
          </div>
        </section>

        {/* Trip planning CTA */}
        <section className="trip-planning-section">
          <div className="container">
            <div className="intro-content trip-planning-note">
              <h2 className="section-title">Every trip is a little different</h2>
              <p>
                Every dive begins somewhere. Tell us what you would like to explore, and we can talk through the destination, timing, experience, and equipment arrangements together. Equipment rental is available at an additional cost.
              </p>
              <Link href="/contact" className="btn btn-primary">Ask about a trip</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}