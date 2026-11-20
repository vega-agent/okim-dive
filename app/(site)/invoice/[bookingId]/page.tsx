// M4: auth-gated invoice view (MVP-SPEC §6 — one per booking, regenerated from
// DB records on demand). Owner customer or instructor only. Print-ready HTML;
// browser print produces the PDF (dedicated PDF renderer deferred).
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, customers, invoices, policyVersions, trips } from '@/db/schema'
import SiteFooter from '@/components/site-footer'
import InvoiceView from '@/components/invoice-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Invoice - Okim Dive' }

export default async function InvoicePage({ params }: { params: { bookingId: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/book')
  if (!db) notFound()

  const bookingRows = await db.select().from(bookings).where(eq(bookings.id, params.bookingId)).limit(1)
  const booking = bookingRows[0]
  if (!booking) notFound()
  const isOwner = session.user.customerId === booking.customerId
  if (!isOwner && session.user.role !== 'instructor') notFound()

  const [customerRows, invoiceRows, tripRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, booking.customerId)).limit(1),
    db.select().from(invoices).where(eq(invoices.bookingId, booking.id)).limit(1),
    db.select().from(trips).where(eq(trips.id, booking.productId)).limit(1),
  ])
  const customer = customerRows[0]
  const invoice = invoiceRows[0]
  const trip = tripRows[0]
  if (!customer || !invoice || !trip) notFound()

  const policy = booking.policyVersionId
    ? (await db.select().from(policyVersions).where(eq(policyVersions.id, booking.policyVersionId)).limit(1))[0]
    : null

  const balanceDue = trip.travelStart
    ? new Date(trip.travelStart.getTime() - trip.balanceDueDays * 86_400_000).toISOString().slice(0, 10)
    : null

  return (
    <>
      <main className="ocean-journey invoice-page" data-page-locale={customer.locale}>
        <section className="trips-section">
          <div className="container">
            <InvoiceView
              locale={customer.locale}
              invoiceNumber={invoice.number}
              issuedAt={invoice.issuedAt.toISOString().slice(0, 10)}
              bookingId={booking.id}
              bookingStatus={booking.status}
              customerName={customer.name}
              customerEmail={customer.email}
              tripTitleEn={trip.titleEn}
              tripTitleZh={trip.titleZh}
              travelDatesEn={trip.travelDatesEn}
              travelDatesZh={trip.travelDatesZh}
              currency={booking.currency}
              deposit={booking.depositAmount ?? '0'}
              balance={booking.balanceAmount ?? '0'}
              discount={booking.pointsDiscountAmount ?? '0'}
              balanceDue={balanceDue}
              policyKind={policy?.kind ?? 'refund'}
              policyVersion={policy?.version ?? 1}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}