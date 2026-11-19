import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Okim Dive - Scuba Diving Adventures in Tioman',
  description: 'Freelance dive instructor & trip planner — Tioman, Malaysia.',
}

// Fonts per DESIGN-SYSTEM v1.1: Fraunces (EN display), Lato (EN body/UI),
// Noto Serif SC / Noto Sans SC (中文), Great Vibes (decorative only).
// Playfair Display removed in the design audit — no CSS references it.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Great+Vibes&family=Lato:wght@400;700&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}