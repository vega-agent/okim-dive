// M6: public booking terms — latest published version (MVP-SPEC §8/§10).
// Linked from the footer only, never the navbar (owner decision 2026-11-21).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SiteFooter from '@/components/site-footer'
import PolicyView from '@/components/policy-view'
import { latestPolicy } from '@/lib/policies'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Terms of Booking - Okim Dive' }

export default async function TermsPage() {
  const policy = await latestPolicy('terms')
  if (!policy) notFound()
  return (
    <>
      <main className="ocean-journey policy-page">
        <section className="trips-section">
          <div className="container">
            <PolicyView kind="terms" version={policy.version} effectiveAt={policy.effectiveAt.toISOString()} bodyEn={policy.bodyEn} bodyZh={policy.bodyZh} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}