import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import type { transactionDb } from '@/db'
import { auditLog, bookings, customers, invoices, payments, policyVersions, trips } from '@/db/schema'
import { bookingTravelDates, travelDateRange, travelAuditFields, travelAuditScope } from './booking-travel-dates'
import { readLockedPaymentFacts } from './payment-queries'

type Database = NonNullable<typeof transactionDb>
type Viewer = { id?: string; customerId?: string | null; role?: string | null }
function documentAccess(viewer: Viewer, completedOnly: boolean) {
  if (!viewer.id) return sql`false`
  if (viewer.role === 'instructor') return undefined
  if (!viewer.customerId) return sql`false`
  return and(eq(customers.id, viewer.customerId), eq(customers.userId, viewer.id), isNull(customers.mergedInto),
    completedOnly ? eq(bookings.status, 'completed') : undefined)
}

export async function readInvoice(db: Database, viewer: Viewer, bookingId: string) {
  return db.transaction(async tx => {
    const [row] = await tx.select({
      number: invoices.number, issuedAt: invoices.issuedAt, customerName: customers.name, customerEmail: customers.email,
      tripTitleEn: trips.titleEn, tripTitleZh: trips.titleZh, travelDatesEn: trips.travelDatesEn, travelDatesZh: trips.travelDatesZh, bookingStatus: bookings.status, policyVersion: policyVersions.version,
      tripId: trips.id, travelStart: trips.travelStart, travelEnd: trips.travelEnd, zone: trips.departureTimezone,
      header: { id: bookings.id, productType: bookings.productType, departureTimezone: bookings.departureTimezone,
        originalPriceAmount: bookings.originalPriceAmount, currency: bookings.currency, paymentRevision: bookings.paymentRevision,
        pointsDiscountAmount: bookings.pointsDiscountAmount, cancellationKind: bookings.cancellationKind,
        refundEntitlementAmount: bookings.refundEntitlementAmount, refundBaselineAmount: bookings.refundBaselineAmount },
    }).from(invoices).innerJoin(bookings, eq(invoices.bookingId, bookings.id))
      .innerJoin(customers, eq(customers.id, bookings.customerId)).innerJoin(trips, eq(trips.id, bookings.productId))
      .leftJoin(policyVersions, eq(policyVersions.id, bookings.policyVersionId))
      .where(and(eq(bookings.id, bookingId), eq(bookings.productType, 'trip'), documentAccess(viewer, true))).limit(1)
    if (!row) return null
    const { header, issuedAt, tripId, travelStart, travelEnd, zone, ...document } = row
    const facts = await readLockedPaymentFacts(tx, [header])
    const audits = await tx.select(travelAuditFields).from(auditLog)
      .where(travelAuditScope([tripId],[bookingId])).orderBy(auditLog.at,auditLog.id)
    const change = bookingTravelDates(audits,bookingId,tripId)
    const dates = change ? change.agreed : travelDateRange(travelStart,travelEnd,zone)
    return { ...document, travelDatesEn: change ? dates : dates ?? document.travelDatesEn,
      travelDatesZh: change ? dates : dates ?? document.travelDatesZh, pendingDates: change?.proposed ?? null, issuedAt: issuedAt.toISOString().slice(0, 10), summary: facts.summaries.get(bookingId)! }
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
}

// Older references contain the internal claim/payment UUID. Give those records
// a stable printable reference without changing their stored data or links.
export function receiptReference(number: string) {
  if (!/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i.test(number)) return number
  return (number.startsWith('REF-') ? 'REF-' : 'RCT-') + createHash('sha256').update(number).digest('hex').slice(0, 20).toUpperCase()
}

const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

function receiptFacts(raw: Record<string, unknown> | null, bookingId: string) {
  if (!raw || raw.schemaVersion !== 1 || raw.bookingId !== bookingId || typeof raw.currency !== 'string' ||
      !['received','refunded'].includes(String(raw.kind)) || !isMoney(raw.amountMinor) || !raw.amountMinor ||
      !isMoney(raw.grossReceivedMinor) || !isMoney(raw.refundedMinor) || !isMoney(raw.netReceivedMinor) ||
      !isMoney(raw.outstandingMinor) || raw.grossReceivedMinor - raw.refundedMinor !== raw.netReceivedMinor ||
      typeof raw.paidOn !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(raw.paidOn) ||
      typeof raw.recordedAt !== 'string' || !Number.isFinite(Date.parse(raw.recordedAt)) || !Array.isArray(raw.allocations)) return null
  const allocations: { position: number; kind: 'deposit' | 'final'; amountMinor: number }[] = []
  for (const a of raw.allocations) {
    if (!a || !isMoney(a.amountMinor) || !a.amountMinor ||
        !(a.kind === 'final' && a.position === 3 || a.kind === 'deposit' && [1,2].includes(a.position))) return null
    allocations.push({ position: a.position, kind: a.kind, amountMinor: a.amountMinor })
  }
  if (allocations.reduce((sum,a) => sum + a.amountMinor, 0) !== raw.amountMinor) return null
  return { bookingId, customerName: typeof raw.customerName === 'string' ? raw.customerName : null, currency: raw.currency, kind: raw.kind as 'received' | 'refunded', amountMinor: raw.amountMinor,
    grossReceivedMinor: raw.grossReceivedMinor, refundedMinor: raw.refundedMinor, netReceivedMinor: raw.netReceivedMinor,
    outstandingMinor: raw.outstandingMinor, paidOn: raw.paidOn, recordedAt: raw.recordedAt, allocations }
}

export async function readReceipt(db: Database, viewer: Viewer, paymentId: string) {
  const [row] = await db.select({ receiptNo: payments.receiptNo, bookingId: payments.bookingId, snapshot: payments.receiptSnapshot }).from(payments).innerJoin(bookings,eq(bookings.id,payments.bookingId))
    .innerJoin(customers,eq(customers.id,bookings.customerId))
    .where(and(eq(payments.id,paymentId), isNotNull(payments.verifiedAt), isNotNull(payments.receiptNo), documentAccess(viewer,false))).limit(1)
  if (!row?.receiptNo) return null
  const facts = receiptFacts(row.snapshot, row.bookingId)
  return facts && { ...facts, number: receiptReference(row.receiptNo) }
}
