import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { transactionDb } from '@/db'
import { readInvoice } from '@/lib/payment-documents'
import SiteFooter from '@/components/site-footer'
import InvoiceView from '@/components/invoice-view'
import '../../../../styles/portal-tabs.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoice - Okim Dive' }

export default async function InvoicePage({ params }: { params: { bookingId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/book')
  if (!transactionDb) notFound()
  const invoice = await readInvoice(transactionDb, session.user, params.bookingId)
  if (!invoice) notFound()
  return <><main className="ocean-journey invoice-page"><section className="trips-section"><div className="container">
    <InvoiceView invoice={invoice} />
  </div></section></main><SiteFooter /></>
}
