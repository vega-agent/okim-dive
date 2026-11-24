'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/courses', label: 'Courses' },
  { href: '/trips', label: 'Trips' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          <img src="/assets/brand/okim-dive-logo-transparent.webp" alt="OKIM Dive" className="logo-image" width={900} height={300} decoding="async" />
        </Link>
        <ul className="nav-menu" id="primary-navigation">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={`nav-link${pathname === link.href ? ' active' : ''}`}>{link.label}</Link>
            </li>
          ))}
          <li>
            <Link href="/myokim" prefetch={false} className={`nav-link nav-link-my${pathname === '/myokim' ? ' active' : ''}`}>My Okim</Link>
          </li>
          <li>
            <Link href="/portal" prefetch={false} className={`nav-link nav-link-portal${pathname === '/portal' || pathname.startsWith('/portal/') ? ' active' : ''}`}>Portal</Link>
          </li>
        </ul>
        <button className="lang-toggle" type="button" data-lang-toggle aria-pressed="false" aria-label="切换到简体中文">中文</button>
        <button className="nav-toggle" type="button" aria-controls="primary-navigation" aria-expanded="false" aria-label="Toggle navigation">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  )
}