import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, customers, payments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import ReceiptView from '@/components/receipt-view'

export const dynamic = 'force-dynamic'
export default async function ReceiptPage({ params }: { params: { paymentId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/book')
  if (!db) notFound()
  const [payment] = await db.select().from(payments).where(eq(payments.id, params.paymentId))
  if (!payment?.verifiedAt || !payment.receiptNo) notFound()
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId))
  if (!booking || (session.user.role !== 'instructor' && session.user.customerId !== booking.customerId)) notFound()
  const [customer] = await db.select().from(customers).where(eq(customers.id, booking.customerId))
  if (!customer) notFound()
  return <main className="ocean-journey invoice-page"><section className="trips-section"><div className="container"><ReceiptView receipt={{ number: payment.receiptNo, paymentId: payment.id, claimId: payment.claimId, bookingId: booking.id, customerName: customer.name, amount: payment.amount, currency: payment.currency, verifiedAt: payment.verifiedAt.toISOString(), kind: payment.kind }} /></div></section></main>
}
