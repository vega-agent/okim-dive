// Shared footer — identical on every page (design audit 2026-11-19: the trips
// page's historical © 2024 / alternate tagline variant was retired for consistency).
import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Okim Dive</h3>
            <p>Your gateway to underwater adventures in Tioman Island</p>
          </div>
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul className="footer-links">
              <li><Link href="/courses">Courses</Link></li>
              <li><Link href="/trips">Trips</Link></li>
              <li><Link href="/gallery">Gallery</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Connect</h3>
            <div className="social-links">
              <a href="https://www.instagram.com/okim_dive" className="social-link" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://www.facebook.com/people/OKIM-Dive/61578882252925/" className="social-link" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://xhslink.cn/m/9TfIoxN1yFp" className="social-link" target="_blank" rel="noreferrer">XiaoHongShu</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          {/* Single text node: the i18n dictionary matches the whole sentence. */}
          <p>{'© 2026 Okim Dive. All rights reserved.'}</p>
        </div>
      </div>
    </footer>
  )
}