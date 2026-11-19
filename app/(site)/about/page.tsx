// M2 port of legacy-static/about.html (design preserved verbatim).
import type { Metadata } from 'next'
import SiteFooter from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'About Us - Okim Dive',
  description: 'A personal approach to learning, diving, and the world beneath the surface. Meet Iris and the story of Okim Dive in Tioman, Malaysia.',
}

export default function AboutPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="page-hero about-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">About Okim Dive</h1>
          <p className="hero-subtitle">A personal approach to learning, diving, and the world beneath the surface.</p>
        </div>
      </section>

      <main className="ocean-journey">
        {/* Meet Iris Section */}
        <section className="about-iris-section">
          <div className="container">
            <div className="about-content">
              <div className="watercolor-decoration top-left"></div>
              <h2 className="section-title">Meet Iris</h2>
              <div className="iris-profile">
                <div className="iris-photo">
                  {/* Placeholder for watercolor photo frame */}
                  <div className="photo-frame"></div>
                </div>
                <div className="iris-info">
                  <h3>Certified Dive Instructor</h3>
                  <p>
                    Iris brings calm, attentive guidance and a deep love of the sea to every dive.
                  </p>
                  <p>
                    As a PADI-certified instructor, she helps divers learn at their own pace—from the first breath underwater to the next place they hope to explore.
                  </p>
                  <div className="iris-stats">
                    <div className="stat">
                      <span className="stat-number">500+</span>
                      <span className="stat-label">Divers Trained</span>
                    </div>
                    <div className="stat">
                      <span className="stat-number">10+</span>
                      <span className="stat-label">Years Experience</span>
                    </div>
                    <div className="stat">
                      <span className="stat-number">20+</span>
                      <span className="stat-label">Dive Sites</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Story Section */}
        <section className="story-section">
          <div className="container">
            <div className="story-content">
              <div className="watercolor-decoration bottom-right"></div>
              <h2 className="section-title">Our Story</h2>
              <div className="story-text">
                <p>
                  Okim Dive grew from a love of Tioman&apos;s reefs and a simple belief: diving should leave you feeling more at home in the water. We bring learning, practice, and exploration together, one considered step at a time.
                </p>
                <p>
                  Tioman is where we begin, but not where the journey has to end. Whether you are returning after time away or preparing for a new destination, we are here to help you keep going.
                </p>
              </div>
              <div className="story-principles">
                <article className="story-principle">
                  <div className="principle-graphic" aria-hidden="true"><img src="/assets/images/about-mission.png" alt="" /></div>
                  <div>
                    <h3>Our Mission</h3>
                    <p>To help more people feel at home in the water and discover the world beneath the surface.</p>
                  </div>
                </article>
                <article className="story-principle">
                  <div className="principle-graphic" aria-hidden="true"><img src="/assets/images/about-values.png" alt="" /></div>
                  <div>
                    <h3>Our Values</h3>
                    <p>Careful guidance, respect for nature, and thoughtful attention to every diver.</p>
                  </div>
                </article>
                <article className="story-principle">
                  <div className="principle-graphic" aria-hidden="true"><img src="/assets/images/about-promise.png" alt="" /></div>
                  <div>
                    <h3>Our Promise</h3>
                    <p>A welcoming experience shaped around your goals, comfort, and curiosity.</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="why-us-section">
          <div className="container">
            <h2 className="section-title">Why Choose Okim Dive</h2>
            <div className="why-list">
              <div className="why-item">
                <div className="why-icon">✓</div>
                <h3>Certified Instruction</h3>
                <p>PADI-certified courses with clear guidance from the first lesson onward.</p>
              </div>
              <div className="why-item">
                <div className="why-icon">✓</div>
                <h3>Small Groups</h3>
                <p>Focused attention to help you learn with confidence.</p>
              </div>
              <div className="why-item">
                <div className="why-icon">✓</div>
                <h3>Local Expertise</h3>
                <p>A thoughtful local starting point for discovering the underwater world.</p>
              </div>
              <div className="why-item">
                <div className="why-icon">✓</div>
                <h3>Quality Equipment</h3>
                <p>Equipment arranged with your comfort and safety in mind.</p>
              </div>
              <div className="why-item">
                <div className="why-icon">✓</div>
                <h3>Flexible Scheduling</h3>
                <p>On-demand options for your plans, with details confirmed before you dive.</p>
              </div>
              <div className="why-item">
                <div className="why-icon">✓</div>
                <h3>Mandarin Instruction</h3>
                <p>Lessons are conducted in Mandarin.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}