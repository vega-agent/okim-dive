import { spendablePoints } from '@/lib/points-accounting'
// M6: My Okim — customer area (MVP-SPEC §10), tabbed per owner revision:
// Upcoming trips (default) / Past trips (compact) / Points / Profile.
// Bookings and points are read-only — changes go through Iris. Profile details
// and per-trip equipment are self-declared (Iris reviews suitability).
// Declarations (medical, emergency contact) are instructor-only and never queried here.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, customers, invoices, messageReads, pointsLedger, tripMessages, trips } from '@/db/schema'
import SiteFooter from '@/components/site-footer'
import MyOkimView from '@/components/my-okim-view'
import { Equipment, equipmentEditable } from '@/lib/diver-equipment'
import { messageAudienceStatuses } from '@/lib/trip-display'
import { receiptReference } from '@/lib/payment-documents'
import { bookingTravelDates, travelDateRange, travelAuditFields, travelAuditScope } from '@/lib/booking-travel-dates'
import { readPaymentBooks } from '@/lib/payment-queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'My Okim - Okim Dive' }

export default async function MyOkimPage() {
  const session = await auth()
  if (!session?.user?.id || !session.user.customerId) redirect('/book')
  if (!db) throw new Error('Database unavailable')
  const customerId = session.user.customerId

  const [customerRows, book, ledgerRows] = await Promise.all([
    db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.userId, session.user.id), isNull(customers.mergedInto))).limit(1),
    readPaymentBooks({ customerId, userId: session.user.id }),
    db.select().from(pointsLedger).where(eq(pointsLedger.customerId, customerId)).orderBy(desc(pointsLedger.createdAt)),
  ])
  const customer = customerRows[0]
  if (!customer) redirect('/book')

  const { bookings: bookingRows, payments: paymentRows, summaries } = book
  const bookingIds = bookingRows.filter(b => b.status === 'completed').map(b => b.id)
  const tripIds = Array.from(new Set(bookingRows.filter(b => b.productType === 'trip').map(b => b.productId)))
  const [tripRows, invoiceRows, dateAudits] = await Promise.all([
    tripIds.length ? db.select().from(trips).where(inArray(trips.id, tripIds)) : Promise.resolve([]),
    bookingIds.length ? db.select().from(invoices).where(inArray(invoices.bookingId, bookingIds)) : Promise.resolve([]),
    tripIds.length ? db.select(travelAuditFields).from(auditLog)
      .where(travelAuditScope(tripIds, bookingRows.map(b => b.id))).orderBy(auditLog.at,auditLog.id) : Promise.resolve([]),
  ])
  // Trip messages (TRIP-MESSAGES-SPEC): on-platform feed, audience filtered at
  // view time so late bookers see earlier matching messages. Zero emails.
  const [messageRows, readRows] = await Promise.all([
    tripIds.length ? db.select().from(tripMessages).where(and(inArray(tripMessages.tripId, tripIds), isNull(tripMessages.deletedAt))).orderBy(desc(tripMessages.publishedAt)) : Promise.resolve([]),
    db.select({ messageId: messageReads.messageId }).from(messageReads).where(eq(messageReads.customerId, customerId)),
  ])
  const seenSet = new Set(readRows.map(r => r.messageId))
  const tripById = new Map(tripRows.map(t => [t.id, t]))
  const invoiceByBooking = new Map(invoiceRows.map(i => [i.bookingId, i]))

  // Balance is always derived from the ledger (MVP-SPEC §7). "Available" mirrors
  // the redemption gate: earned lots from completed bookings, unexpired, net of
  // reversals/redemptions. Read-only: expiry is evaluated here, never written.
  const now = new Date()
  const completedIds = new Set(bookingRows.filter(b => b.status === 'completed').map(b => b.id))
  const totalPoints = ledgerRows.reduce((sum, e) => sum + e.points, 0)
  const availablePoints=spendablePoints(ledgerRows,completedIds,now).available

  const data = {
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, diverProfile: customer.diverProfile },
    totalPoints,
    availablePoints,
    bookings: bookingRows.map(b => {
      const trip = b.productType === 'trip' ? tripById.get(b.productId) : undefined
      const summary = summaries.get(b.id) ?? null
      const change = bookingTravelDates(dateAudits,b.id,b.productId)
      const dates = change ? change.agreed : travelDateRange(trip?.travelStart,trip?.travelEnd,trip?.departureTimezone)
      return {
        id: b.id,
        status: b.status,
        cancellation: b.status === 'cancelled' && b.cancellationKind ? { kind: b.cancellationKind, reason: b.cancelReason } : null,
        eligibilityStatus: b.eligibilityStatus,
        currency: b.currency,
        proposedDates: b.status === 'cancelled' || b.status === 'completed' ? null : change?.proposed ?? null,

        trip: trip ? {
          slug: trip.slug,
          titleEn: trip.titleEn,
          titleZh: trip.titleZh,
          travelDatesEn: change ? dates : dates ?? trip.travelDatesEn,
          travelDatesZh: change ? dates : dates ?? trip.travelDatesZh,
          sample: trip.sample,
        } : null,
        summary,
        // Equipment is scoped to its booking card on the Upcoming tab only;
        // cutoff is formatted client-side so the language toggle stays live.
        equipment: trip ? {
          initial: (b.equipment as Equipment | null) ?? null,
          editable: equipmentEditable(b.status, trip.status, trip.travelStart ?? null),
          cutoffAt: trip.travelStart ? new Date(trip.travelStart.getTime() - 86_400_000).toISOString() : null,
          timezone: trip.departureTimezone ?? null,
        } : null,
        invoiceNumber: invoiceByBooking.get(b.id)?.number ?? null,
        messages: messageRows
          .filter(m => m.tripId === b.productId && (messageAudienceStatuses(m.audience) as string[]).includes(b.status))
          .map(m => ({
            id: m.id, label: m.label,
            subjectEn: m.subjectEn, subjectZh: m.subjectZh,
            bodyEn: m.bodyEn, bodyZh: m.bodyZh,
            publishedAt: m.publishedAt.toISOString(),
            seen: seenSet.has(m.id),
          })),
        receipts: paymentRows
          .filter(p => p.bookingId === b.id && p.receiptNo && p.verifiedAt && p.receiptSnapshot)
          .map(p => ({ id: p.id, receiptNo: receiptReference(p.receiptNo!), kind: p.kind, amount: p.amount, currency: p.currency })),
      }
    }),
    ledger: ledgerRows.map(e => ({
      id: e.id,
      type: e.type,
      points: e.points,
      rmAmount: e.rmAmount,
      rateSnapshot: e.rateSnapshot,
      bookingId: e.bookingId,
      expiresAt: e.expiresAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  }

  return (
    <>
      <main className="ocean-journey my-okim" data-locale-managed>
        <MyOkimView data={JSON.parse(JSON.stringify(data))} />
      </main>
      <SiteFooter />
    </>
  )
}