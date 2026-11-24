import { and, eq, inArray, or } from 'drizzle-orm'
import { auditLog } from '@/db/schema'
import { localCalendarDate } from './payment-schedule'

export function travelDateRange(start: unknown, end: unknown, zone: unknown) {
  if (typeof zone !== 'string') return null
  const date = (value: unknown) => value instanceof Date || typeof value === 'string' ? localCalendarDate(new Date(value), zone) : null
  const first = date(start), last = date(end)
  return [first, last === first ? null : last].filter(Boolean).join(' – ') || null
}

export const travelAuditFields = { id: auditLog.id, action: auditLog.action, entityId: auditLog.entityId, meta: auditLog.meta }
export function travelAuditScope(trips: string[], bookings: string[]) {
  return or(and(eq(auditLog.action,'trip_dates_changed'),inArray(auditLog.entityId,trips)),
    and(eq(auditLog.action,'postponement_response'),inArray(auditLog.entityId,bookings)))
}
type TravelAudit = { id: string; action: string; entityId: string; meta: Record<string, unknown> | null }

/** Changes arrive in recorded order. Only an explicit acceptance changes the agreed dates. */
export function bookingTravelDates(rows: TravelAudit[], bookingId: string, tripId: string) {
  const changes = rows.filter(row => row.action === 'trip_dates_changed' && row.entityId === tripId &&
    Array.isArray(row.meta?.bookingIds) && row.meta.bookingIds.includes(bookingId))
  if (!changes.length) return null
  const first = changes[0].meta!
  let agreed = travelDateRange(first.oldStart,first.oldEnd,first.oldZone)
  let proposed: string | null = null
  const responses = new Map(rows.filter(row => row.action === 'postponement_response' && row.entityId === bookingId)
    .map(row => [row.meta?.changeId,row.meta?.decision]))
  for (const { id, meta } of changes) {
    const dates = travelDateRange(meta!.newStart,meta!.newEnd,meta!.newZone)
    const response = responses.get(id)
    if (response === 'accept') agreed = dates
    proposed = response ? null : dates
  }
  return { agreed, proposed }
}
