// M2 port of legacy-static/index.html (design preserved verbatim).
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
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">Explore the Ocean With Wonder</h1>
          <p className="hero-subtitle">Join us for a dive, a trip, or the next step in your own journey beneath the surface.</p>
          <div className="hero-cta">
            <Link href="/courses" className="btn btn-primary">Explore Courses</Link>
            <Link href="/trips" className="btn btn-secondary">View Trips</Link>
          </div>
        </div>
      </section>

      <main className="ocean-journey">
        {/* Introduction Section */}
        <section className="intro-section">
          <div className="container">
            <div className="intro-content">
              <div className="watercolor-decoration top-left"></div>
              <div className="watercolor-decoration top-right"></div>
              <h2 className="section-title">More Than a Certification</h2>
              <p className="intro-text">
                Whether you are already certified, returning to the water, or curious about learning, there is always more to notice beneath the surface.
              </p>
              <div className="intro-features">
                <div className="feature-card">
                  <div className="feature-icon">🎓</div>
                  <h3>Learn with Care</h3>
                  <p>Clear, patient guidance to help you feel at home in the water</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🏝️</div>
                  <h3>Love the Ocean</h3>
                  <p>Look closer at the reefs, light, and life beneath the surface</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🌊</div>
                  <h3>Explore Further</h3>
                  <p>Keep discovering new underwater worlds, one dive at a time</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Diving Journey Section */}
        <section className="home-journey-section" aria-labelledby="home-journey-title">
          <div className="container">
            <div className="home-journey-content">
              <h2 className="section-title" id="home-journey-title">Find Your Way Into Diving</h2>
              <p className="intro-text">Come for the reefs, the light, the marine life, or the feeling of being underwater. We will help you find the right way to take part.</p>
              <div className="home-journey-grid">
                <article className="home-journey-step"><span className="journey-node-mark" aria-hidden="true">01</span><h3>Learn</h3><p>Start with the foundations and gain the skills you need to feel comfortable underwater.</p><Link href="/courses" className="text-link">Explore courses →</Link></article>
                <article className="home-journey-step"><span className="journey-node-mark" aria-hidden="true">02</span><h3>Return</h3><p>Been away from diving? Rebuild your comfort and confidence with guidance at your own pace.</p><Link href="/courses" className="text-link">Ask about a refresher →</Link></article>
                <article className="home-journey-step"><span className="journey-node-mark" aria-hidden="true">03</span><h3>Go Further</h3><p>Keep practising and explore new underwater worlds through organised trips with published dates.</p><Link href="/trips" className="text-link">Discover dive trips →</Link></article>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links Section */}
        <section className="quick-links-section">
          <div className="container">
            <h2 className="section-title">Start Your Adventure</h2>
            <div className="quick-links-grid">
              <Link href="/courses" className="quick-link-card">
                <div className="card-content">
                  <h3>Dive Courses</h3>
                  <p>Build your confidence from the first lesson onward</p>
                  <span className="card-arrow">→</span>
                </div>
              </Link>
              <Link href="/trips" className="quick-link-card">
                <div className="card-content">
                  <h3>Dive Trips</h3>
                  <p>Discover Tioman and the waters beyond</p>
                  <span className="card-arrow">→</span>
                </div>
              </Link>
              <Link href="/gallery" className="quick-link-card">
                <div className="card-content">
                  <h3>Photo Gallery</h3>
                  <p>Look closer at the beauty beneath the surface</p>
                  <span className="card-arrow">→</span>
                </div>
              </Link>
              <Link href="/contact" className="quick-link-card">
                <div className="card-content">
                  <h3>Contact Us</h3>
                  <p>Tell us what you would like to explore</p>
                  <span className="card-arrow">→</span>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}