import { requireInstructor } from '@/lib/portal-actions'
import { sweepHolds } from '@/lib/seamless-actions'
import { db } from '@/db'
import { auditLog, bookings, paymentClaims, inquiries, pointsLedger, payments, customers, trips, settings, policyVersions } from '@/db/schema'
import { slotsConsumed } from '@/lib/trip-display'
import DiverUpdates from '@/components/diver-updates'
import { users } from '@/db/schema'
import { desc } from 'drizzle-orm'
import PortalView from '@/components/portal-view'
import '../../../styles/portal-tabs.css'

export const dynamic = 'force-dynamic'
export default async function PortalPage() {
  await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  await sweepHolds()
  const [manifest, claims, queue, ledger, receipts, customerRows, tripRows, settingRows, policyRows] = await Promise.all([
    db.select().from(bookings), db.select().from(paymentClaims), db.select().from(inquiries), db.select().from(pointsLedger), db.select().from(payments),
    db.select({ id: customers.id, name: customers.name }).from(customers),
    db.select().from(trips),
    db.select().from(settings),
    db.select({ kind: policyVersions.kind, version: policyVersions.version, effectiveAt: policyVersions.effectiveAt, createdBy: policyVersions.createdBy }).from(policyVersions),
  ])
  const customerNames = Object.fromEntries(customerRows.map(c => [c.id, c.name]))
  const tripTitles = Object.fromEntries(tripRows.map(t => [t.id, { en: t.titleEn, zh: t.titleZh }]))
  const settingValue = (key: string) => settingRows.find(s => s.key === key)?.value as Record<string, unknown> | undefined
  const pointsRules = { earnRate: 1, redeemValue: 0.05, expiryMonths: 12, capPct: 20, ...settingValue('points_rules') }
  const envEmails = (process.env.AUTH_INSTRUCTOR_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  const storedEmails = (settingValue('instructor_emails')?.emails as string[] | undefined) ?? []
  const tripSample = Object.fromEntries(tripRows.map(t => [t.id, t.sample]))
  const tripBalanceDue = Object.fromEntries(tripRows.map(t => [t.id, t.travelStart ? new Date(t.travelStart.getTime() - t.balanceDueDays * 86_400_000).toISOString() : null]))
  const data = {
    manifest: manifest.map(b => ({ ...b, customerName: customerNames[b.customerId] || b.customerId, tripTitle: tripTitles[b.productId] ?? null, sample: tripSample[b.productId] ?? false, holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null, balanceDueAt: tripBalanceDue[b.productId] ?? null })),
    claims,
    queue,
    ledger: ledger.map(e => ({ ...e, customerName: customerNames[e.customerId] || e.customerId })),
    receipts,
    trips: tripRows.map(t => {
      const statuses = manifest.filter(b => b.productId === t.id && b.productType === 'trip').map(b => b.status)
      return {
        id: t.id, slug: t.slug, status: t.status, published: t.published, sample: t.sample,
        titleEn: t.titleEn, titleZh: t.titleZh,
        travelStart: t.travelStart?.toISOString() ?? null, travelEnd: t.travelEnd?.toISOString() ?? null,
        capacity: t.capacity, consumed: slotsConsumed(statuses), bookingCount: statuses.length,
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
  const alerts = (await db.select().from(auditLog).orderBy(desc(auditLog.at))).filter(a => (a.meta as Record<string, unknown> | null)?.notifyIris === true)
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
  const equipmentRows = manifest.filter(b => b.equipment).map(b => ({
    id: b.id, equipment: b.equipment,
    customerName: customerNames[b.customerId] || b.customerId,
    tripTitle: tripTitles[b.productId] ?? null,
    sample: tripSample[b.productId] ?? false,
  }))
  return <PortalView data={JSON.parse(JSON.stringify(data))} updates={<DiverUpdates alerts={alertRows} bookings={equipmentRows} />} />
}