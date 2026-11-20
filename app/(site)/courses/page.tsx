// M2 port of legacy-static/courses.html (design preserved verbatim).
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Dive Courses - Okim Dive',
  description: 'Learn at your own pace, with clear guidance from the first breath onward. PADI Open Water, Advanced Open Water, and Scuba Refresher courses in Tioman.',
}

export default function CoursesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="page-hero courses-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <h1 className="hero-title">Dive Courses</h1>
          <p className="hero-subtitle">Learn at your own pace, with clear guidance from the first breath onward.</p>
        </div>
      </section>

      <main className="ocean-journey">
        {/* Core Courses */}
        <section className="courses-section" aria-labelledby="core-courses-title">
          <div className="container">
            <h2 className="section-title" id="core-courses-title">Core Courses</h2>
            <div className="courses-grid core-courses-grid">
              <div className="course-card">
                <div className="course-header"><div className="course-icon" aria-hidden="true"><img src="/assets/images/course-open-water.png" alt="" /></div><h3>Open Water Diver</h3><span className="course-level">Beginner</span></div>
                <div className="course-content"><p>Learn the fundamentals step by step, then find your comfort beneath the surface.</p><ul className="course-details"><li><strong>Duration:</strong> 4 days / 3 nights</li><li><strong>Depth Limit:</strong> 18 meters</li></ul><div className="course-pricing"><strong>From RM 1,400</strong><details><summary>View package details</summary><div className="package-details"><h4>Package pricing</h4><ul className="package-prices"><li><span>1:4 or 1:3</span><strong>RM 1,400</strong></li><li><span>1:2</span><strong>RM 1,700</strong></li><li><span>1:1</span><strong>RM 1,800</strong></li><li><span>Course retake</span><strong>RM 150 / dive</strong></li></ul><div className="package-columns"><div><h4>Includes</h4><ul><li>Course Material</li><li>Diving Equipment</li><li>Certification</li></ul></div><div><h4>Exclude</h4><ul><li>Accommodation</li><li>Transportation</li><li>Ferry Ticket</li><li>Marine Park Fee</li><li>Travel Insurance</li></ul></div></div></div></details></div><Link href="/contact" className="btn btn-primary">Book Now</Link></div>
              </div>
              <div className="course-card">
                <div className="course-header"><div className="course-icon" aria-hidden="true"><img src="/assets/images/course-advanced-open-water.png" alt="" /></div><h3>Advanced Open Water</h3><span className="course-level">Intermediate</span></div>
                <div className="course-content"><p>Build on your foundation and practise new skills through guided adventure dives.</p><ul className="course-details"><li><strong>Duration:</strong> 3 days / 2 nights</li><li><strong>Depth Limit:</strong> 30 meters</li></ul><div className="course-pricing"><strong>From RM 1,250</strong><details><summary>View package details</summary><div className="package-details"><h4>Package pricing</h4><ul className="package-prices"><li><span>1:4 or 1:3</span><strong>RM 1,250</strong></li><li><span>1:2</span><strong>RM 1,550</strong></li><li><span>1:1</span><strong>RM 1,650</strong></li><li><span>Nitrox add-on</span><strong>RM 450 (Ori RM 550)</strong></li></ul><div className="package-columns"><div><h4>Includes</h4><ul><li>Course Material</li><li>Diving Equipment</li><li>Certification</li></ul></div><div><h4>Exclude</h4><ul><li>Accommodation</li><li>Transportation</li><li>Ferry Ticket</li><li>Marine Park Fee</li><li>Travel Insurance</li></ul></div></div></div></details></div><Link href="/contact" className="btn btn-primary">Book Now</Link></div>
              </div>
              <div className="course-card">
                <div className="course-header"><div className="course-icon" aria-hidden="true"><img src="/assets/images/course-scuba-refresher.png" alt="" /></div><h3>Scuba Refresher</h3><span className="course-level">Returning divers</span></div>
                <div className="course-content"><p>Returning after time away? Rebuild your comfort and confidence with a calm, guided refresher.</p><ul className="course-details"><li><strong>For:</strong> Certified divers returning to diving</li><li><strong>Focus:</strong> Essential skills and water confidence</li></ul><div className="course-pricing"><strong>Pricing on request</strong><details><summary>View package details</summary><div className="package-details"><div className="package-columns"><div><h4>Includes</h4><ul><li>Course Material</li><li>Diving Equipment</li><li>Certification</li></ul></div><div><h4>Exclude</h4><ul><li>Accommodation</li><li>Transportation</li><li>Ferry Ticket</li><li>Marine Park Fee</li><li>Travel Insurance</li><li>Dive Equipment (available for rent)</li></ul></div></div></div></details></div><Link href="/contact" className="btn btn-primary">Ask About Refresher</Link></div>
              </div>
            </div>
            <div className="courses-inquiry-panel">
              <h3>Other courses are available on request.</h3>
              <p>If you are looking for another path, tell us what you would like to learn. We will explain the available options and help you choose a sensible next step.</p>
              <Link href="/contact" className="btn btn-secondary">Contact us for more information</Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-section" aria-labelledby="faq-title">
          <div className="container">
            <div className="faq-intro"><h2 className="section-title" id="faq-title">Frequently Asked Questions</h2></div>
            <div className="faq-grid">
              <details className="faq-item"><summary>Can I learn to dive if I’m not a strong swimmer?</summary><p>Talk to us about your experience first. You should be comfortable in the water and able to swim and float. If you’re nervous, you can start by practising basic floating or swimming in a pool and discuss the best approach with your instructor.</p></details>
              <details className="faq-item"><summary>Will the course be too difficult for me?</summary><p>Feeling nervous at first is completely normal. Training is progressive, and your instructor will explain each skill before you practise it. Everyone learns at a different pace, so the focus is on building your confidence—not comparing yourself with others.</p></details>
              <details className="faq-item"><summary>Can older participants learn to dive?</summary><p>Age alone is not always a limitation, but your health and comfort in the water matter. Please share any health concerns with us. If you are unsure about your fitness for diving, seek medical advice before booking.</p></details>
              <details className="faq-item"><summary>Why can instructors seem serious sometimes?</summary><p>Your instructor’s first priority is your safety. They may be especially focused during underwater practice. If you are unsure about a step or feel nervous, please ask—clear communication makes learning safer and easier.</p></details>
              <details className="faq-item"><summary>How can I protect myself from the sun?</summary><p>Bring a long-sleeved rash guard or sun-protective clothing, stay hydrated, and use reef-conscious sunscreen when needed. Try to prevent sunburn and take regular breaks between activities.</p></details>
              <details className="faq-item"><summary>What if my ears feel uncomfortable while descending?</summary><p>Changes in pressure can make your ears feel uncomfortable, especially when you’re new to diving. Your instructor will explain equalisation and guide you from shallow water. Never force a descent—tell your instructor immediately if you feel pain or cannot equalise.</p></details>
              <details className="faq-item"><summary>Which certification organisation should I choose?</summary><p>There are several recognised organisations, including PADI, SSI, NAUI, and CMAS. Okim Dive currently offers PADI certification. If you’re unsure which course fits your goals, contact us and we’ll help you choose.</p></details>
              <details className="faq-item"><summary>How many days does a diving course take?</summary><p>It depends on the course, your progress, and whether you complete theory work in advance. Open Water training usually takes several days for theory, skills practice, and open-water dives. We recommend allowing some flexibility so you can learn comfortably.</p></details>
              <details className="faq-item"><summary>Do I need to buy diving equipment?</summary><p>Course packages generally provide the essential equipment, so beginners do not need to buy a full set. You may want to bring or later choose items such as dive socks, a rash guard, a mask, or fins after you understand your own needs.</p></details>
              <details className="faq-item"><summary>What should I bring?</summary><p>Bring swimwear, a change of clothes, toiletries, personal medication, and sun-protective clothing. Dive socks and a dry bag may also be useful. Your instructor will let you know if anything else is needed.</p></details>
              <details className="faq-item"><summary>Can I choose where I want to dive?</summary><p>For Tioman Island diving, contact us to discuss your preferred date and diving experience. Organised trips follow their published destination and dates. We will confirm the available options with you before making arrangements.</p></details>
            </div>
            <div className="faq-cta"><p>Every diver arrives with a different story. Whether you are choosing your first course, returning after time away, or wondering what to learn next, tell us a little about where you are and what you hope to find in the water. We will take the time to listen and help you find a course that feels right for you.</p><Link href="/contact" className="btn btn-primary">Talk to Us</Link></div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}