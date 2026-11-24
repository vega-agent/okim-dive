import { createHash, randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { transactionDb } from '../db'
import { auditLog, bookings, bookingStages, customers, invoices, policyVersions, tripDeposits, trips } from '../db/schema'
import { buildTripStages, SLOT_STATUSES } from './trip-display'
import { localCalendarDate, parseMoneyMinor, type StageInput } from './payment-schedule'

type BookingRequest = {
  userId: string; customerId: string; slug: string; operationKey: string; acceptedOffer: string; name: string
  refundVersionId: string; termsVersionId: string; declarations: Record<string, unknown>; equipment: Record<string, unknown>
}
export type ReservationResult =
  | { status: 'created'; bookingId: string; currency: string; stages: StageInput[]; replay: boolean }
  | { status: 'unauthenticated' | 'trip_full' | 'already_booked' | 'invalid' | 'trip_unavailable' | 'offer_changed' }

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function offerFingerprint(trip: Pick<typeof trips.$inferSelect, 'id' | 'currency' | 'departureTimezone' | 'travelStart' | 'travelEnd'>, stages: StageInput[]): string {
  const travelDate = (date: Date | null) => date && localCalendarDate(date, trip.departureTimezone)
  return fingerprint([trip.id, trip.currency, trip.departureTimezone, travelDate(trip.travelStart), travelDate(trip.travelEnd), stages.map(s => [s.position, s.kind, s.amountMinor, s.dueDate])])
}

export async function reserveTripBooking(database: NonNullable<typeof transactionDb>, request: BookingRequest): Promise<ReservationResult> {
  const { customerId, userId, slug, operationKey, acceptedOffer, refundVersionId, termsVersionId } = request
  const intent = fingerprint([customerId, slug, acceptedOffer, refundVersionId, termsVersionId, request.name, request.declarations, request.equipment])
  return database.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.slug, slug)).for('update')
    if (!trip) return { status: 'trip_unavailable' }
    const [owner] = await tx.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.userId, userId))).for('update')
    if (!owner || owner.mergedInto) return { status: 'unauthenticated' }

    const [existing] = await tx.select().from(bookings).where(eq(bookings.requestOperationKey, operationKey)).for('update')
    if (existing) {
      if (existing.customerId !== customerId || existing.productId !== trip.id) return { status: 'invalid' }
      const [accepted] = await tx.select({ meta: auditLog.meta }).from(auditLog)
        .where(and(eq(auditLog.entity, 'booking'), eq(auditLog.entityId, existing.id), eq(auditLog.action, 'booking_policy_accepted')))
      if (accepted?.meta?.fingerprint !== intent) return { status: 'invalid' }
      const stages = await tx.select().from(bookingStages).where(eq(bookingStages.bookingId, existing.id)).orderBy(bookingStages.position)
      return { status: 'created', bookingId: existing.id, currency: existing.currency, replay: true,
        stages: stages.map(s => ({ id: s.id, position: s.position as StageInput['position'], kind: s.kind, dueDate: s.dueDate, amountMinor: parseMoneyMinor(s.amount) })) }
    }

    if (!trip.published || trip.status !== 'open' || !trip.travelStart ||
        localCalendarDate(new Date(), trip.departureTimezone) >= localCalendarDate(trip.travelStart, trip.departureTimezone)) {
      return { status: 'trip_unavailable' }
    }
    const [capacity] = await tx.select({ count: sql<number>`count(*)::int`, sameDiver: sql<boolean>`coalesce(bool_or(${bookings.customerId} = ${customerId}),false)` })
      .from(bookings).where(and(eq(bookings.productType, 'trip'), eq(bookings.productId, trip.id), inArray(bookings.status, SLOT_STATUSES.slice())))
    if (capacity.sameDiver) return { status: 'already_booked' }
    if (capacity.count >= trip.capacity) return { status: 'trip_full' }

    const policies = await tx.selectDistinctOn([policyVersions.kind], { kind: policyVersions.kind, id: policyVersions.id })
      .from(policyVersions).where(inArray(policyVersions.kind, ['refund', 'terms'])).orderBy(policyVersions.kind, desc(policyVersions.version))
    if (policies.find(p => p.kind === 'terms')?.id !== termsVersionId || policies.find(p => p.kind === 'refund')?.id !== refundVersionId) return { status: 'invalid' }
    const deposits = await tx.select().from(tripDeposits).where(eq(tripDeposits.tripId, trip.id)).orderBy(tripDeposits.sort)
    const offer = buildTripStages(trip, deposits)
    if (offerFingerprint(trip, offer) !== acceptedOffer) return { status: 'offer_changed' }

    // Numbered bank references are shared across trips. Allocate both IDs under one transaction lock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('okim-booking-invoice-number'))`)
    const ids = await tx.execute<{ b: string; i: string }>(sql`select
      (select coalesce(max(substring(id from '^BKG-([0-9]+)$')::numeric),0)+1 from bookings) as b,
      (select coalesce(max(substring(id from '^INV-([0-9]+)$')::numeric),0)+1 from invoices) as i`)
    const bookingId = 'BKG-' + String(ids.rows[0].b).padStart(3, '0')
    const invoiceSuffix = String(ids.rows[0].i).padStart(3, '0')
    const stages = offer.map(stage => ({ ...stage, id: bookingId + '-S' + stage.position }))
    const acceptedAt = new Date()
    await tx.insert(bookings).values({
      id: bookingId, customerId, productId: trip.id, productType: 'trip', status: 'awaiting_deposit', eligibilityStatus: 'approved',
      originalPriceAmount: trip.priceAmount, departureTimezone: trip.departureTimezone, currency: trip.currency,
      requestOperationKey: operationKey, acceptedAt, policyVersionId: refundVersionId, declarations: { ...request.declarations, name: request.name }, equipment: request.equipment,
      depositAmount: deposits[0].amount, balanceAmount: ((parseMoneyMinor(trip.priceAmount) - stages[0].amountMinor) / 100).toFixed(2), pointsDiscountAmount: '0',
    })
    await tx.insert(bookingStages).values(stages.map(s => ({ id: s.id, bookingId, position: s.position, kind: s.kind, dueDate: s.dueDate, amount: (s.amountMinor / 100).toFixed(2) })))
    await tx.insert(invoices).values({ id: 'INV-' + invoiceSuffix, bookingId, number: 'INV-' + acceptedAt.getUTCFullYear() + '-' + invoiceSuffix })
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: userId, entity: 'booking', entityId: bookingId, action: 'booking_policy_accepted',
      meta: { refundVersionId, termsVersionId, acceptedAt: acceptedAt.toISOString(), depositsNonRefundableAcknowledged: true, fingerprint: intent } })
    return { status: 'created', bookingId, currency: trip.currency, stages, replay: false }
  })
}
