import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { transactionDb } from '@/db'
import { bookings, bookingStages, customers, paymentAllocations, payments, trips } from '@/db/schema'
import { localCalendarDate, parseMoneyMinor, summarizeBooking, type BookingPaymentSummary, type StageInput } from './payment-schedule'

export type PaymentTransaction = Parameters<Parameters<NonNullable<typeof transactionDb>['transaction']>[0]>[0]
type PaymentInput = Parameters<typeof summarizeBooking>[0]
type Booking = typeof bookings.$inferSelect
type SummaryHeader = Pick<Booking, 'id' | 'productType' | 'departureTimezone' | 'originalPriceAmount' | 'paymentRevision' | 'currency' |
  'pointsDiscountAmount' | 'cancellationKind' | 'refundEntitlementAmount' | 'refundBaselineAmount'>

export async function lockPaymentBooking(tx: PaymentTransaction, bookingId: string) {
  const [identity] = await tx.select({ tripId: bookings.productId, customerId: bookings.customerId }).from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.productType, 'trip')))
  if (!identity) return null
  const [trip] = await tx.select().from(trips).where(eq(trips.id, identity.tripId)).for('update')
  const [customer] = await tx.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.id, identity.customerId)).for('update')
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update')
  if (!booking || !trip || !customer || booking.customerId !== customer.id || booking.productId !== trip.id) return null
  return { booking, trip, customerName: customer.name }
}

function remainingSources(input:PaymentInput, rows:(typeof payments.$inferSelect)[]) {
  const received=new Map<string,Map<string,number>>()
  const byId=new Map(rows.map(row=>[row.id,row]))
  for(const a of input.allocations.filter(a=>a.direction==='received')){
    const stages=received.get(a.paymentId)??new Map<string,number>()
    stages.set(a.stageId,a.amountMinor)
    received.set(a.paymentId,stages)
  }
  for(const a of input.allocations.filter(a=>a.direction==='refunded')){
    const sourceId=byId.get(a.paymentId)?.sourcePaymentId
    const portions=sourceId?received.get(sourceId):undefined
    const remainder=(portions?.get(a.stageId)??0)-a.amountMinor
    if(!portions||remainder<0) throw Error('Refund source does not reconcile to its booking stage')
    portions.set(a.stageId,remainder)
  }
  return received
}

/** The caller holds the booking lock or a repeatable-read snapshot across these batched reads. */
export async function readLockedPaymentFacts(tx: PaymentTransaction, headers: SummaryHeader[]) {
  const inputs = new Map<string, PaymentInput>()
  const summaries = new Map<string, BookingPaymentSummary>()
  const sourceBalances=new Map<string,ReturnType<typeof remainingSources>>()
  const ids = headers.map(row => row.id)
  if (!ids.length) return { inputs, summaries, sourceBalances, payments: [] as (typeof payments.$inferSelect)[] }
  const receiptRows = await tx.select().from(payments).where(inArray(payments.bookingId, ids)).orderBy(payments.verifiedAt, payments.id)
  const stageRows = await tx.select().from(bookingStages).where(inArray(bookingStages.bookingId, ids)).orderBy(bookingStages.position)
  const receiptIds = receiptRows.map(row => row.id)
  const allocationRows = receiptIds.length ? await tx.select().from(paymentAllocations).where(inArray(paymentAllocations.paymentId, receiptIds)) : []
  const now = new Date()
  for (const b of headers) {
    if (b.productType !== 'trip') continue
    if (!b.departureTimezone || !b.originalPriceAmount) throw new Error('Missing booked schedule')
    inputs.set(b.id, { bookingId: b.id, revision: b.paymentRevision, currency: b.currency, originalPriceMinor: parseMoneyMinor(b.originalPriceAmount),
      discountMinor: parseMoneyMinor(b.pointsDiscountAmount ?? '0'), stages: [], allocations: [],
      today: localCalendarDate(now, b.departureTimezone), cancellationKind: b.cancellationKind,
      refundEntitlementMinor: parseMoneyMinor(b.refundEntitlementAmount ?? '0'), refundBaselineMinor: parseMoneyMinor(b.refundBaselineAmount ?? '0') })
  }
  for (const stage of stageRows) inputs.get(stage.bookingId)?.stages.push({
    id: stage.id, position: stage.position as StageInput['position'], kind: stage.kind, amountMinor: parseMoneyMinor(stage.amount), dueDate: stage.dueDate,
  })
  const byPayment = new Map(receiptRows.map(row => [row.id, row]))
  const totals = new Map<string, number>()
  for (const row of allocationRows) {
    const payment = byPayment.get(row.paymentId)!
    const input = inputs.get(payment.bookingId)
    if (!input || !payment.verifiedAt) continue
    const amountMinor = parseMoneyMinor(row.amount)
    totals.set(payment.id, (totals.get(payment.id) ?? 0) + amountMinor)
    input.allocations.push({ paymentId: payment.id, stageId: row.stageId, amountMinor, direction: payment.kind === 'refund' ? 'refunded' : 'received' })
  }
  for (const row of receiptRows) {
    const input = inputs.get(row.bookingId)
    if (!row.verifiedAt || !input) continue
    if (row.currency !== input.currency || !['deposit','balance','full','refund'].includes(row.kind) ||
        totals.get(row.id) !== parseMoneyMinor(row.amount)) throw new Error('Payment allocations do not reconcile')
  }
  const byBooking=new Map<string,typeof receiptRows>()
  for(const row of receiptRows){const group=byBooking.get(row.bookingId)??[]; group.push(row);byBooking.set(row.bookingId,group)}
  inputs.forEach((input,id)=>{
    sourceBalances.set(id,remainingSources(input,byBooking.get(id)??[]))
    summaries.set(id,summarizeBooking(input))
  })
  return { inputs, summaries, sourceBalances, payments: receiptRows }
}

type DiverScope = { customerId: string; userId: string }
type InstructorScope = { instructor: true } | { bookingIds: string[] }
const diverColumns = {
  id: bookings.id, productId: bookings.productId, productType: bookings.productType, status: bookings.status,
  eligibilityStatus: bookings.eligibilityStatus, currency: bookings.currency, createdAt: bookings.createdAt, cancelReason: bookings.cancelReason,
  depositAmount: bookings.depositAmount, balanceAmount: bookings.balanceAmount, equipment: bookings.equipment,
  departureTimezone: bookings.departureTimezone, originalPriceAmount: bookings.originalPriceAmount, paymentRevision: bookings.paymentRevision,
  pointsDiscountAmount: bookings.pointsDiscountAmount, cancellationKind: bookings.cancellationKind,
  refundEntitlementAmount: bookings.refundEntitlementAmount, refundBaselineAmount: bookings.refundBaselineAmount,
}
type DiverBooking = Pick<Booking, keyof typeof diverColumns>
type BookData<B> = { sourceBalances: Awaited<ReturnType<typeof readLockedPaymentFacts>>['sourceBalances']; bookings: B[]; summaries: Map<string, BookingPaymentSummary>; payments: (typeof payments.$inferSelect)[] }

export function readPaymentBooks(scope: DiverScope): Promise<BookData<DiverBooking>>
export function readPaymentBooks(scope: InstructorScope): Promise<BookData<Booking>>
export async function readPaymentBooks(scope: DiverScope | InstructorScope) {
  if (!transactionDb) throw new Error('Database unavailable')
  return transactionDb.transaction(async tx => {
    const bookingRows = 'customerId' in scope
      ? await tx.select(diverColumns).from(bookings).innerJoin(customers, eq(customers.id, bookings.customerId))
        .where(and(eq(customers.id, scope.customerId), eq(customers.userId, scope.userId), isNull(customers.mergedInto))).orderBy(desc(bookings.createdAt))
      : await tx.select().from(bookings).where('bookingIds' in scope ? inArray(bookings.id, scope.bookingIds) : undefined).orderBy(desc(bookings.createdAt))
    const { summaries, payments, sourceBalances } = await readLockedPaymentFacts(tx, bookingRows)
    return { bookings: bookingRows, summaries, payments, sourceBalances }
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
}

export async function loadPaymentSummaries(bookingIds: string[]): Promise<Map<string, BookingPaymentSummary>> {
  return bookingIds.length ? (await readPaymentBooks({ bookingIds })).summaries : new Map()
}
