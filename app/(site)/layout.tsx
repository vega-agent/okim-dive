// M2: shared chrome for the six public pages (ported from legacy-static/*.html).
// Navbar + i18n/motion effects live here; each page renders its own hero, main,
// and SiteFooter (trips keeps its historical footer variant for parity).
import Navbar from '@/components/navbar'
import SiteI18n from '@/components/site-i18n'
import SiteMotion from '@/components/site-motion'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <SiteI18n />
      <SiteMotion />
    </>
  )
}