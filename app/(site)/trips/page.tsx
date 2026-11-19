// M2 port of legacy-static/trips.html (design preserved verbatim).
// Trip cards + detail dialog are rendered by TripsGrid from /data/trips/*.json,
// exactly as scripts/site/trips-data.js did (DB-backed in M3).
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/site-footer'
import TripsGrid from '@/components/trips-grid'

export const metadata: Metadata = {
  title: 'Dive Trips - Okim Dive',
  description: 'Follow your curiosity beneath the surface. Tioman dives arranged around your plans, and organised journeys to new destinations.',
}

export default function TripsPage() {
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
            <TripsGrid />
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