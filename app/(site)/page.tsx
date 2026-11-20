// Home pilot — immersive watercolour (UI-Refactor, Vega 2026-09-07), approved by
// Jeff 2026-11-19 and ported to Next.js (MVP-SPEC decision #19). Structure and
// copy follow the pilot verbatim; adaptations: body.home-pilot selectors became
// a .home-pilot wrapper (SSR/no-JS safe), links are Next Links, and the footer is
// the unified audited SiteFooter (the pilot predates the M2 footer unification).
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Okim Dive - Scuba Diving Adventures in Tioman',
  description: 'Join us for a dive, a trip, or the next step in your own journey beneath the surface. Dive courses and trips with instructor Iris in Tioman, Malaysia.',
}

export default function HomePage() {
  return (
    <>
      <div className="home-pilot">
        {/* Mobile: viewport-fixed ocean environment (the section is too tall for
            cover-scaling the painting — it would zoom into a blur). Desktop keeps
            the scrolling section background. */}
        <div className="pilot-ocean-bg" aria-hidden="true"></div>
        <main id="main-content">
          <section className="pilot-hero" aria-labelledby="pilot-title">
            <div className="pilot-hero-art" aria-hidden="true"></div>
            <div className="pilot-hero-copy">
              <h1 id="pilot-title">Explore the Ocean With Wonder</h1>
              <p>Join us for a dive, a trip, or the next step in your own journey beneath the surface.</p>
              <div className="pilot-actions">
                <Link href="/courses" className="pilot-button pilot-primary">Explore Courses</Link>
                <Link href="/trips" className="pilot-button pilot-secondary">View Trips</Link>
              </div>
            </div>
          </section>

          <div className="pilot-ocean">
            <div className="pilot-waterline" aria-hidden="true"></div>
            <section className="pilot-philosophy" aria-labelledby="pilot-philosophy-title">
              <div className="pilot-reading">
                <h2 id="pilot-philosophy-title">Learn with care. Explore with wonder.</h2>
                <p>Look closer at the reefs, the light, and the life beneath the surface. With patient guidance and room for curiosity, there is always more to discover.</p>
                <Link className="pilot-text-link" href="/about">Meet Iris and Okim Dive <span aria-hidden="true">↗</span></Link>
              </div>
            </section>

            <section className="pilot-chooser" aria-labelledby="pilot-chooser-title">
              <h2 id="pilot-chooser-title">Find your next dive</h2>
              <div className="pilot-paths">
                <Link href="/courses" className="pilot-path"><h3>Learn</h3><p>Start with the foundations and gain the skills you need to feel comfortable underwater.</p><span aria-hidden="true">↗</span></Link>
                <Link href="/courses" className="pilot-path"><h3>Return</h3><p>Been away from diving? Rebuild your comfort and confidence with guidance at your own pace.</p><span aria-hidden="true">↗</span></Link>
                <Link href="/trips" className="pilot-path"><h3>Explore</h3><p>Discover Tioman and the waters beyond.</p><span aria-hidden="true">↗</span></Link>
              </div>
            </section>

            <section className="pilot-tioman" aria-labelledby="pilot-tioman-title">
              <div className="pilot-reading">
                <p className="pilot-availability">On request</p>
                <h2 id="pilot-tioman-title">Tioman Island</h2>
                <p>Already certified? Come back to the water around Tioman. Share your preferred dates and dive interests; we will confirm availability and equipment needs together.</p>
                <Link className="pilot-text-link" href="/trips">Explore Tioman diving <span aria-hidden="true">↗</span></Link>
              </div>
            </section>

            <section className="pilot-enquiry" aria-labelledby="pilot-enquiry-title">
              <h2 id="pilot-enquiry-title">Where would you like to go next?</h2>
              <Link className="pilot-button pilot-primary" href="/contact">Talk to us about your next dive</Link>
            </section>
          </div>
        </main>
      </div>

      <SiteFooter />
    </>
  )
}