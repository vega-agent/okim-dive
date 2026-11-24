import { requirePortalSession } from '@/lib/portal-session'
import { missingAcknowledgment } from '@/lib/booking-notifications'
import { readPaymentBooks } from '@/lib/payment-queries'
import { maximumRedeemablePoints, spendablePoints } from '@/lib/points-accounting'
import { localCalendarDate, maximumDiscountMinor } from '@/lib/payment-schedule'
import { db } from '@/db'
import { auditLog, inquiries, pointsLedger, customers, trips, settings, policyVersions, tripMessages, messageReads } from '@/db/schema'
import { slotsConsumed } from '@/lib/trip-display'
import DiverUpdates from '@/components/diver-updates'
import { users } from '@/db/schema'
import { desc, isNull } from 'drizzle-orm'
import PortalView from '@/components/portal-view'
import '../../../styles/portal-tabs.css'

export const dynamic = 'force-dynamic'
export default async function PortalPage() {
  await requirePortalSession()
  if (!db) throw new Error('Database unavailable')
  const [book, queue, ledger, customerRows, tripRows, settingRows, policyRows, messageRows, readRows, auditRows] = await Promise.all([
    readPaymentBooks({ instructor: true }), db.select().from(inquiries), db.select().from(pointsLedger),
    db.select({ id: customers.id, name: customers.name }).from(customers),
    db.select().from(trips),
    db.select().from(settings),
    db.select({ kind: policyVersions.kind, version: policyVersions.version, effectiveAt: policyVersions.effectiveAt, createdBy: policyVersions.createdBy }).from(policyVersions),
    db.select({ id: tripMessages.id, tripId: tripMessages.tripId }).from(tripMessages).where(isNull(tripMessages.deletedAt)),
    db.select({ messageId: messageReads.messageId, customerId: messageReads.customerId }).from(messageReads),
    db.select().from(auditLog).orderBy(desc(auditLog.at),desc(auditLog.id)),
  ])
  const { bookings: manifest, summaries, payments: receipts } = book
  const customerNames = Object.fromEntries(customerRows.map(c => [c.id, c.name]))
  const tripTitles = Object.fromEntries(tripRows.map(t => [t.id, { en: t.titleEn, zh: t.titleZh }]))
  const settingValue = (key: string) => settingRows.find(s => s.key === key)?.value as Record<string, unknown> | undefined
  const pointsRules = { earnRate: 1, redeemValue: 0.05, expiryMonths: 12, capPct: 20, ...settingValue('points_rules') }
  const envEmails = (process.env.AUTH_INSTRUCTOR_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  const storedEmails = (settingValue('instructor_emails')?.emails as string[] | undefined) ?? []
  const tripSample = Object.fromEntries(tripRows.map(t => [t.id, t.sample]))
  const latestChange = new Map<string,typeof auditRows[number]>()
  const responses = new Set(auditRows.filter(a=>a.action==='postponement_response').map(a=>a.id))
  for(const row of auditRows)if(row.action==='trip_dates_changed'&&!latestChange.has(row.entityId))latestChange.set(row.entityId,row)
  function pendingChange(bookingId:string,tripId:string){
    const change=latestChange.get(tripId),meta=change?.meta
    if(!change||!Array.isArray(meta?.bookingIds)||!meta.bookingIds.includes(bookingId)||responses.has('postponement-'+change.id+'-'+bookingId))return null
    const asDate=(value:unknown,zone:unknown)=>typeof value==='string'&&typeof zone==='string'?localCalendarDate(new Date(value),zone):null
    return {id:change.id,oldStart:asDate(meta.oldStart,meta.oldZone),oldEnd:asDate(meta.oldEnd,meta.oldZone),newStart:asDate(meta.newStart,meta.newZone),newEnd:asDate(meta.newEnd,meta.newZone)}
  }
  const completedIds = new Set(manifest.filter(b => b.status === 'completed').map(b => b.id))
  const redeemedIds = new Set(ledger.filter(entry => entry.type === 'redeemed').map(entry => entry.bookingId))
  const paidIds = new Set(receipts.map(receipt => receipt.bookingId))
  const lots = new Map<string, typeof ledger>()
  for (const row of ledger) {
    const group = lots.get(row.customerId) ?? []
    group.push(row)
    lots.set(row.customerId, group)
  }
  const now = new Date()
  const available = new Map(Array.from(lots, ([id, rows]) => [id, spendablePoints(rows, completedIds, now).available]))
  const tripById = new Map(tripRows.map(trip => [trip.id, trip]))
  function redemptionFor(booking: typeof manifest[number]) {
    const trip = tripById.get(booking.productId)
    const summary = summaries.get(booking.id)
    if (!trip?.travelStart || trip.status !== 'open' || trip.travelStart <= now || !summary || summary.discountMinor ||
        booking.status !== 'awaiting_deposit' || booking.eligibilityStatus === 'declined' || booking.cancelledAt || booking.completedAt ||
        booking.cancellationKind || redeemedIds.has(booking.id) || paidIds.has(booking.id)) return null
    const finalMinor = summary.stages[summary.stages.length - 1].amountMinor
    const capMinor = maximumDiscountMinor(summary.originalPriceMinor, finalMinor, Number(pointsRules.capPct))
    const availablePoints = available.get(booking.customerId) ?? 0
    const redeemValue = String(pointsRules.redeemValue)
    const maximumPoints = maximumRedeemablePoints(availablePoints, capMinor, redeemValue, trip.rmRate)
    return maximumPoints ? { revision: summary.revision, availablePoints, maximumPoints, finalMinor, redeemValue, rmRate: trip.rmRate } : null
  }
  const receiptCounts = new Map<string, number>()
  const data = {
    manifest: manifest.map(b => ({ ...b, redemption: redemptionFor(b), pendingChange:pendingChange(b.id,b.productId), customerName: customerNames[b.customerId] || b.customerId, tripTitle: tripTitles[b.productId] ?? null, sample: tripSample[b.productId] ?? false, holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null, summary: summaries.get(b.id) ?? null,
      paymentToday: b.departureTimezone ? localCalendarDate(new Date(), b.departureTimezone) : null })),
    queue: queue.map(i => ({ ...i, tripTitle: i.tripId ? tripTitles[i.tripId] ?? null : null })),
    ledger: ledger.map(e => ({ ...e, customerName: customerNames[e.customerId] || e.customerId })),
    receipts: receipts.filter(row => row.verifiedAt && row.receiptNo).map(row => {
      const number = (receiptCounts.get(row.bookingId) ?? 0) + 1
      receiptCounts.set(row.bookingId, number)
      return { id: row.id, bookingId: row.bookingId, amount: row.amount, currency: row.currency, kind: row.kind, number,
        paidOn: typeof row.receiptSnapshot?.paidOn === 'string' ? row.receiptSnapshot.paidOn : null,
        refundableMinor: Array.from(book.sourceBalances.get(row.bookingId)?.get(row.id)?.values() ?? []).reduce((sum, amount) => sum + amount, 0),
      }
    }),
    trips: tripRows.map(t => {
      const tripBookings = manifest.filter(b => b.productId === t.id && b.productType === 'trip')
      const statuses = tripBookings.map(b => b.status)
      // Seen stats mirror message-actions CONFIRMED_STATUSES (deposit_verified + confirmed).
      const confirmedIds = new Set(tripBookings.filter(b => ['deposit_verified', 'confirmed'].includes(b.status)).map(b => b.customerId))
      const msgs = messageRows.filter(m => m.tripId === t.id)
      const msgIds = new Set(msgs.map(m => m.id))
      const seen = readRows.filter(r => msgIds.has(r.messageId) && confirmedIds.has(r.customerId)).length
      return {
        id: t.id, slug: t.slug, status: t.status, published: t.published, sample: t.sample,
        titleEn: t.titleEn, titleZh: t.titleZh,
        travelStart: t.travelStart?.toISOString() ?? null, travelEnd: t.travelEnd?.toISOString() ?? null,
        capacity: t.capacity, consumed: slotsConsumed(statuses), bookingCount: statuses.length,
        confirmedCount: tripBookings.filter(b => ['deposit_verified', 'confirmed', 'completed'].includes(b.status)).length,
        completedCount: tripBookings.filter(b => b.status === 'completed').length,
        messagesPublished: msgs.length, messagesSeen: seen, messagesSeenTotal: msgs.length * confirmedIds.size,
      }
    }),
    settings: {
      pointsRules: { earnRate: Number(pointsRules.earnRate), redeemValue: Number(pointsRules.redeemValue), expiryMonths: Number(pointsRules.expiryMonths), capPct: Number(pointsRules.capPct) },
      defaultRmRate: Number(settingValue('default_rm_rate')?.value ?? 1),
      instructorEmails: Array.from(new Set([...envEmails, ...storedEmails])),
      paymentInstructions: {
        en: String(settingValue('payment_instructions')?.en ?? ''),
        zh: String(settingValue('payment_instructions')?.zh ?? ''),
        sample: settingValue('payment_instructions')?.sample !== false,
      },
    },
    policies: policyRows.map(p => ({ kind: p.kind, version: p.version, effectiveAt: p.effectiveAt.toISOString(), createdBy: p.createdBy })),
  }
  const alerts = auditRows.filter(a => (a.meta as Record<string, unknown> | null)?.notifyIris === true)
  const actors = new Map((await db.select().from(users)).map(u=>[u.id,u.name || u.email]))
  const bookingContext = Object.fromEntries(manifest.map(b => [b.id, {
    customerName: customerNames[b.customerId] || b.customerId,
    tripTitle: tripTitles[b.productId] ?? null,
    sample: tripSample[b.productId] ?? false,
  }]))
  const alertRows = alerts.map(a => ({
    id: a.id, entityId: a.entityId, action: a.action,
    actorName: actors.get(a.actorUserId ?? '') ?? '',
    at: a.at.toISOString(),
    context: bookingContext[a.entityId] ?? null,
    old: (a.meta as Record<string, unknown>)?.old ?? null,
    new: (a.meta as Record<string, unknown>)?.new ?? null,
  }))
  const acknowledged = new Set(auditRows.filter(a => a.action === 'booking_acknowledgment').map(a => a.entityId))
  for (const b of manifest) {
    const missing = missingAcknowledgment(b, acknowledged.has(b.id), now.getTime())
    if (missing) alertRows.push({ id: 'ack-' + b.id, entityId: b.id, action: missing.action,
      actorName: '', at: missing.at.toISOString(), context: bookingContext[b.id], old: null, new: null })
  }
  alertRows.sort((a,b) => b.at.localeCompare(a.at))
  return <PortalView data={JSON.parse(JSON.stringify(data))} updates={<DiverUpdates alerts={alertRows} />} />
}