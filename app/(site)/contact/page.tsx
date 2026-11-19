// M2 port of legacy-static/contact.html (design preserved verbatim).
// Form is uncontrolled/native for parity; M3 wires it to a server action -> inquiries.
import type { Metadata } from 'next'
import SiteFooter from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Contact - Okim Dive',
  description: 'Tell us where you are in your diving journey. Ask about courses, Tioman diving, or an organised trip with Okim Dive.',
}

export default function ContactPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="page-hero contact-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">Contact Us</h1>
          <p className="hero-subtitle">Tell us where you are in your diving journey.</p>
        </div>
      </section>

      <main className="ocean-journey">
        {/* Contact Form */}
        <section className="contact-form-section">
          <div className="container">
            <div className="form-content">
              <div className="watercolor-decoration bottom-right"></div>
              <h2 className="section-title">Send Us a Message</h2>
              <p className="form-intro">Tell us about your experience, what you would like to learn or explore, and the dates you have in mind. We will help you understand the next step.</p>
              <form className="contact-form">
                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input type="text" id="name" name="name" autoComplete="name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input type="email" id="email" name="email" autoComplete="email" required />
                </div>
                <div className="form-group">
                  <label htmlFor="whatsapp">WhatsApp Number</label>
                  <input type="tel" id="whatsapp" name="whatsapp" autoComplete="tel" />
                </div>
                <div className="form-group">
                  <label htmlFor="interest">What are you interested in? *</label>
                  <select id="interest" name="interest" required defaultValue="">
                    <option value="">Select an option</option>
                    <optgroup label="Courses">
                      <option value="course-open-water">Open Water Diver</option>
                      <option value="course-advanced-open-water">Advanced Open Water</option>
                      <option value="course-scuba-refresher">Scuba Refresher</option>
                      <option value="course-other">Other course</option>
                    </optgroup>
                    <optgroup label="Trips">
                      <option value="trip-tioman-island">Tioman Island</option>
                      <option value="trip-sipadan-blue-current-week">Sipadan Blue Current Week</option>
                      <option value="trip-raja-ampat-reef-explorer">Raja Ampat Reef Explorer</option>
                      <option value="trip-other">Other trip</option>
                    </optgroup>
                    <option value="not-sure">Not sure yet</option>
                    <option value="general-question">General question</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="dates">Preferred Date or Dates</label>
                  <input type="text" id="dates" name="dates" placeholder="For example, 12–16 October 2027" />
                </div>
                <div className="form-group">
                  <label htmlFor="group-size">Number of Divers / Travellers</label>
                  <input type="number" id="group-size" name="group_size" min={1} inputMode="numeric" />
                </div>
                <div className="form-group">
                  <label htmlFor="certification">Certification Level</label>
                  <input type="text" id="certification" name="certification" placeholder="For example, Open Water Diver" />
                </div>
                <div className="form-group">
                  <label htmlFor="message">Tell us a little more *</label>
                  <textarea id="message" name="message" rows={5} required></textarea>
                </div>
                <div className="form-group form-consent">
                  <label><input type="checkbox" name="consent" required /> I agree to Okim Dive using the information I provide to respond to this enquiry. *</label>
                </div>
                <button type="submit" className="btn btn-primary">Send Enquiry</button>
              </form>
            </div>
          </div>
        </section>

        {/* Contact Methods */}
        <section className="contact-methods">
          <div className="container">
            <h2 className="section-title">Other Ways to Reach Us</h2>
            <div className="methods-grid">
              {/* WhatsApp */}
              <div className="method-card">
                <div className="method-icon">💬</div>
                <h3>WhatsApp</h3>
                <p>A direct way to ask about courses, Tioman diving, or an organised trip</p>
                <a href="https://wa.me/60123456789" className="btn btn-primary" target="_blank" rel="noreferrer">
                  Message Us
                </a>
                <p className="method-info">+60 12-345 6789</p>
              </div>

              {/* Instagram */}
              <div className="method-card">
                <div className="method-icon">📸</div>
                <h3>Instagram</h3>
                <p>See the places, light, and life that keep us looking beneath the surface</p>
                <a href="https://www.instagram.com/okim_dive" className="btn btn-primary" target="_blank" rel="noreferrer">
                  @okim_dive
                </a>
                <p className="method-info">DM us anytime</p>
              </div>

              {/* Facebook */}
              <div className="method-card">
                <div className="method-icon">👥</div>
                <h3>Facebook</h3>
                <p>Connect with our diving community and get updates</p>
                <a href="https://www.facebook.com/people/OKIM-Dive/61578882252925/" className="btn btn-primary" target="_blank" rel="noreferrer">
                  Visit Page
                </a>
                <p className="method-info">Send us a message</p>
              </div>

              {/* XiaoHongShu */}
              <div className="method-card">
                <div className="method-icon">📕</div>
                <h3>XiaoHongShu</h3>
                <p>See the places, light, and life that keep us looking beneath the surface</p>
                <a href="https://xhslink.cn/m/9TfIoxN1yFp" className="btn btn-primary" target="_blank" rel="noreferrer">
                  View Page
                </a>
                <p className="method-info">DM us anytime</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}