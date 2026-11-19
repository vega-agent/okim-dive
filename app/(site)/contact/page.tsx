// M2 port of legacy-static/contact.html (design preserved verbatim).
// M3: the form submits via server action to the inquiries table.
import type { Metadata } from 'next'
import SiteFooter from '@/components/site-footer'
import ContactForm from '@/components/contact-form'

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
              <ContactForm />
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