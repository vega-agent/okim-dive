// Gallery — honest empty state until verified Okim Dive photography is available.
// Design audit 2026-11-19: removed the 12 emoji placeholder tiles that contradicted
// the "coming soon" message (vibe doc: never present unverified imagery as content),
// and the repetitive "Gallery in progress" kicker (title-led sections rule).
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Gallery - Okim Dive',
  description: 'Look closely at the light, life, and quiet moments beneath the surface. Verified Okim Dive photography is coming soon.',
}

export default function GalleryPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="page-hero gallery-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">Photo Gallery</h1>
          <p className="hero-subtitle">Look closely at the light, life, and quiet moments beneath the surface.</p>
        </div>
      </section>

      {/* Gallery Introduction */}
      <main className="ocean-journey">
        <section className="gallery-intro">
          <div className="container">
            <div className="intro-content">
              <div className="watercolor-decoration top-left"></div>
              <h2 className="section-title">Underwater Memories</h2>
              <p className="intro-text">
                There is always something small worth noticing—a change in light, a quiet reef, a passing school of fish. This collection will grow with verified Okim Dive moments.
              </p>
            </div>
          </div>
        </section>

        {/* Gallery empty state — verified photography pending (Iris) */}
        <section className="gallery-section">
          <div className="container">
            <div className="gallery-empty-state">
              <h2>Real underwater stories are coming soon</h2>
              <p>We are preparing a collection of verified Okim Dive photography. Until then, contact us to hear about the places and encounters behind the next dive.</p>
              <Link href="/contact" className="btn btn-primary">Plan a Dive</Link>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="gallery-cta">
          <div className="container">
            <div className="cta-content">
              <div className="watercolor-decoration bottom-right"></div>
              <div className="cta-copy">
                <h2 className="section-title">Find Your Next Underwater World</h2>
                <p>Begin with a course, return to the water, or ask about a trip. There is no single right pace for the journey.</p>
              </div>
              <div className="cta-buttons">
                <Link href="/courses" className="btn btn-primary">Start Diving</Link>
                <Link href="/trips" className="btn btn-secondary">View Trips</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}