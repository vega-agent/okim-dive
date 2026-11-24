import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { transactionDb } from '@/db'
import { readReceipt } from '@/lib/payment-documents'
import ReceiptView from '@/components/receipt-view'

export const dynamic = 'force-dynamic'
export default async function ReceiptPage({ params }: { params: { paymentId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/book')
  if (!transactionDb) notFound()
  const receipt = await readReceipt(transactionDb, session.user, params.paymentId)
  if (!receipt) notFound()
  return <main className="ocean-journey invoice-page"><section className="trips-section"><div className="container">
    <ReceiptView receipt={receipt} />
  </div></section></main>
}
