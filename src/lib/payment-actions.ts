'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { and, desc, eq, sql } from 'drizzle-orm'
import { transactionDb } from '@/db'
import { auditLog, bookings, paymentAllocations, paymentClaims, payments } from '@/db/schema'
import { requireInstructor } from './portal-actions'
import { lockPaymentBooking, readLockedPaymentFacts } from './payment-queries'
import { parseMoneyMinor, previewPayment, summarizeBooking, type BookingPaymentSummary, type CancellationKind } from './payment-schedule'

import { activeBookingStatuses, calendarDay, cancelLockedBooking, refundLockedBooking, uuidKey, type MutationResult } from './booking-lifecycle'

export type PaymentActionResult =
  | { status: 'saved'; paymentId: string; receiptUrl: string; summary: BookingPaymentSummary }
  | { status: 'stale'; summary: BookingPaymentSummary }
  | { status: 'error'; messageKey: 'forbidden' | 'invalid' | 'key_reused' | 'closed' | 'excess' | 'unavailable' }

export async function recordBookingPayment(form: FormData): Promise<PaymentActionResult> {
  let actor: string
  try { actor = await requireInstructor() } catch { return { status: 'error', messageKey: 'forbidden' } }
  if (!transactionDb) return { status: 'error', messageKey: 'unavailable' }
  const bookingId = String(form.get('bookingId') ?? '')
  const key = String(form.get('operationKey') ?? '').toLowerCase()
  const paidOn = String(form.get('paidOn') ?? '')
  const revision = String(form.get('expectedRevision') ?? '')
  const date = new Date(paidOn + 'T00:00:00Z')
  if (!bookingId || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key) ||
      !/^\d+$/.test(revision) || !Number.isSafeInteger(Number(revision)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== paidOn) {
    return { status: 'error', messageKey: 'invalid' }
  }
  let amountMinor: number
  try { amountMinor = parseMoneyMinor(String(form.get('amount') ?? '')) } catch { return { status: 'error', messageKey: 'invalid' } }
  if (amountMinor <= 0) return { status: 'error', messageKey: 'invalid' }
  let tripSlug: string | undefined
  let result: PaymentActionResult
  try {
    result = await transactionDb.transaction(async (tx): Promise<PaymentActionResult> => {
      // Different bookings can receive the same forged key concurrently. Protect its global namespace as well.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'payment:' + key},0))`)
      const auditId = 'record-payment-' + key
      const [previous] = await tx.select().from(auditLog).where(eq(auditLog.id, auditId))
      if (previous) {
        const meta = previous.meta
        if (!meta || previous.entityId !== bookingId || meta.amountMinor !== amountMinor || meta.paidOn !== paidOn) return { status: 'error', messageKey: 'key_reused' }
        const paymentId = String(meta.paymentId)
        return { status: 'saved', paymentId, receiptUrl: '/receipt/' + paymentId, summary: meta.summaryAfter as BookingPaymentSummary }
      }
      const locked = await lockPaymentBooking(tx, bookingId)
      if (!locked) return { status: 'error', messageKey: 'invalid' }
      const { booking, trip } = locked
      tripSlug = trip.slug
      const { inputs, summaries } = await readLockedPaymentFacts(tx, [booking])
      const before = summaries.get(bookingId)!
      const input = inputs.get(bookingId)!
      if (before.revision !== Number(revision)) return { status: 'stale', summary: before }
      if (booking.cancellationKind || booking.cancelledAt || booking.completedAt || booking.eligibilityStatus === 'declined' ||
          !['awaiting_deposit','payment_claimed','deposit_verified','confirmed'].includes(booking.status)) return { status: 'error', messageKey: 'closed' }
      if (paidOn > input.today) return { status: 'error', messageKey: 'invalid' }
      if (amountMinor > before.outstandingMinor) return { status: 'error', messageKey: 'excess' }
      const { allocations } = previewPayment(before, amountMinor)
      const claimId = randomUUID()
      const paymentId = 'PAY-' + claimId
      const now = new Date()
      const pieces = allocations.map(piece => {
        const stage = before.stages.find(s => s.id === piece.stageId)!
        return { ...piece, position: stage.position, kind: stage.kind }
      })
      const summary = summarizeBooking({ ...input, revision: before.revision + 1,
        allocations: input.allocations.concat(allocations.map(a => ({ ...a, paymentId, direction: 'received' }))) })
      const amount = (amountMinor / 100).toFixed(2)
      const hasFinal = pieces.some(p => p.kind === 'final')
      const kind = hasFinal ? (pieces.some(p => p.kind === 'deposit') ? 'full' : 'balance') : 'deposit'
      const receiptSnapshot = { schemaVersion: 1, provenance: 'recorded', bookingId, customerName: locked.customerName, currency: booking.currency, amountMinor, kind: 'received',
        paidOn, recordedAt: now.toISOString(), allocations: pieces, grossReceivedMinor: summary.grossReceivedMinor,
        refundedMinor: summary.refundedMinor, netReceivedMinor: summary.netReceivedMinor, outstandingMinor: summary.outstandingMinor }
      if (!(Number(trip.rmRate) > 0)) throw new Error('Invalid snapshotted RM conversion')
      await tx.insert(paymentClaims).values({ id: claimId, bookingId, amount, currency: booking.currency, paidOn: date,
        reference: bookingId, recordedBy: actor, operationKey: key, kind, status: 'verified', submittedAt: now })
      await tx.insert(payments).values({ id: paymentId, bookingId, claimId, amount, currency: booking.currency, kind, rmRate: trip.rmRate,
        rmAmount: sql`round(${amount}::numeric * ${trip.rmRate}::numeric,2)`, verifiedBy: actor, verifiedAt: now, receiptNo: 'RCT-' + claimId,
        operationKey: 'pay-' + key, receiptSnapshot })
      await tx.insert(paymentAllocations).values(allocations.map(a => ({ paymentId, stageId: a.stageId, amount: (a.amountMinor / 100).toFixed(2) })))
      const status = summary.stages[0].outstandingMinor === 0 ? 'confirmed' : booking.status
      await tx.update(bookings).set({ status, paymentRevision: summary.revision, holdExpiresAt: null }).where(eq(bookings.id, bookingId))
      await tx.insert(auditLog).values({ id: auditId, actorUserId: actor, entity: 'booking', entityId: bookingId, action: 'booking_payment_recorded',
        meta: { paidOn, amountMinor, paymentId, claimId, summaryAfter: summary } })
      return { status: 'saved', paymentId, receiptUrl: '/receipt/' + paymentId, summary }
    })
  } catch { return { status: 'error', messageKey: 'unavailable' } }
  if (result.status === 'saved') {
    for (const path of ['/portal', '/myokim', '/invoice/' + bookingId, result.receiptUrl]) revalidatePath(path)
    if (tripSlug) revalidatePath('/trips/' + tripSlug)
  }
  return result
}

export async function cancelBooking(form:FormData):Promise<MutationResult>{
  let actor:string
  try{actor=await requireInstructor()}catch{return {status:'error',messageKey:'forbidden'}}
  if(!transactionDb)return {status:'error',messageKey:'unavailable'}
  const id=String(form.get('bookingId')??''),reason=String(form.get('reason')??'').trim(),kind=String(form.get('cancellationKind')??'')
  if(!reason||reason.length>500||!['diver_withdrawal','nonpayment','no_show','operator_cancelled'].includes(kind))return {status:'error',messageKey:'invalid'}
  const result=await transactionDb.transaction(async (tx):Promise<MutationResult>=>{
    const locked=await lockPaymentBooking(tx,id)
    if(!locked)return {status:'error',messageKey:'invalid'}
    const facts=await readLockedPaymentFacts(tx,[locked.booking])
    const before=facts.summaries.get(id)!
    if(!locked.booking.cancellationKind&&form.has('expectedRevision')&&String(before.revision)!==form.get('expectedRevision'))return {status:'stale',summary:before}
    return cancelLockedBooking(tx,locked.booking,facts,kind as CancellationKind,reason,actor)
  })
  if(result.status==='saved')refreshBooking(id)
  return result
}

function refreshBooking(bookingId:string){
  for(const path of ['/portal','/myokim','/trips','/invoice/'+bookingId]) revalidatePath(path)
  revalidatePath('/trips/[slug]','page')
}

async function refundAction(form:FormData,correction:boolean):Promise<MutationResult>{
  let actor:string
  try{actor=await requireInstructor()}catch{return {status:'error',messageKey:'forbidden'}}
  if(!transactionDb)return {status:'error',messageKey:'unavailable'}
  const key=String(form.get('operationKey')??'').toLowerCase(),paidOn=String(form.get('paidOn')??''),rawRevision=String(form.get('expectedRevision')??'')
  const sourceId=String(form.get('paymentId')??''),reason=String(form.get('reason')??'').trim()
  const bookingId=String(form.get('bookingId')??'')
  let amountMinor:number
  try{amountMinor=parseMoneyMinor(String(form.get('amount')??''))}catch{return {status:'error',messageKey:'invalid'}}
  if(!uuidKey(key)||!calendarDay(paidOn)||!/^\d+$/.test(rawRevision)||!Number.isSafeInteger(Number(rawRevision))||!amountMinor||
    (correction?(!sourceId||!reason||reason.length>500):!bookingId))return {status:'error',messageKey:'invalid'}
  let result:MutationResult
  try {
    result=await transactionDb.transaction(async (tx):Promise<MutationResult>=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'refund:'+key},0))`)
      let id=bookingId
      if(correction){
        const [source]=await tx.select({bookingId:payments.bookingId,kind:payments.kind}).from(payments).where(eq(payments.id,sourceId))
        if(!source||source.kind==='refund'||(bookingId&&source.bookingId!==bookingId))return {status:'error',messageKey:'invalid'}
        id=source.bookingId
      }
      const [op]=await tx.select().from(auditLog).where(eq(auditLog.id,'refund-op-'+key))
      if(op){
        const m=op.meta, saved=m?.correction as {sourceId:string;reason:string}|null
        if(op.action!=='booking_refund_recorded'||op.entityId!==id||m?.amountMinor!==amountMinor||m?.paidOn!==paidOn||
          (correction?(saved?.sourceId!==sourceId||saved.reason!==reason):!!saved))return {status:'error',messageKey:'key_reused'}
        return {status:'saved',summary:m.summaryAfter as BookingPaymentSummary,childPaymentIds:m.childPaymentIds as string[]}
      }
      const locked=await lockPaymentBooking(tx,id)
      if(!locked)return {status:'error',messageKey:'invalid'}
      const facts=await readLockedPaymentFacts(tx,[locked.booking])
      return refundLockedBooking(tx,locked.booking,facts,{customerName:locked.customerName,bookingId:id,amountMinor,key,paidOn,expectedRevision:Number(rawRevision),correction:correction?{sourceId,reason}:undefined},actor)
    })
  }catch{return {status:'error',messageKey:'unavailable'}}
  if(result.status==='saved'){
    refreshBooking(result.summary.bookingId)
    for(const child of result.childPaymentIds) revalidatePath('/receipt/'+child)
  } else if (result.status === 'stale') revalidatePath('/portal')
  return result
}

export async function recordBookingRefund(form:FormData){return refundAction(form,false)}
export async function recordCompletedCorrection(form:FormData){return refundAction(form,true)}

export async function respondToPostponement(form:FormData):Promise<MutationResult>{
  let actor:string
  try{actor=await requireInstructor()}catch{return {status:'error',messageKey:'forbidden'}}
  if(!transactionDb)return {status:'error',messageKey:'unavailable'}
  const bookingId=String(form.get('bookingId')??''),changeId=String(form.get('changeId')??''),decision=String(form.get('decision')??''),reason=String(form.get('reason')??'').trim()
  if(!uuidKey(changeId)||!['accept','decline'].includes(decision)||(decision==='decline'&&(!reason||reason.length>500)))return {status:'error',messageKey:'invalid'}
  const result=await transactionDb.transaction(async(tx):Promise<MutationResult>=>{
    const locked=await lockPaymentBooking(tx,bookingId)
    if(!locked)return {status:'error',messageKey:'invalid'}
    const [latest]=await tx.select().from(auditLog).where(and(eq(auditLog.entity,'trip'),eq(auditLog.entityId,locked.trip.id),eq(auditLog.action,'trip_dates_changed')))
      .orderBy(desc(auditLog.at),desc(auditLog.id)).limit(1)
    if(!latest||latest.id!==changeId||!Array.isArray(latest.meta?.bookingIds)||!latest.meta.bookingIds.includes(bookingId))return {status:'error',messageKey:'invalid'}
    const responseId='postponement-'+changeId+'-'+bookingId
    const [prior]=await tx.select().from(auditLog).where(eq(auditLog.id,responseId))
    const facts=await readLockedPaymentFacts(tx,[locked.booking])
    const summary=facts.summaries.get(bookingId)!
    if(prior)return prior.meta?.decision===decision?{status:'saved',summary,childPaymentIds:[]}:{status:'error',messageKey:'closed'}
    if(!activeBookingStatuses.some(s=>s===locked.booking.status))return {status:'error',messageKey:'closed'}
    if(decision==='decline'&&form.has('expectedRevision')&&String(summary.revision)!==form.get('expectedRevision'))return {status:'stale',summary}
    const response:MutationResult=decision==='decline'?await cancelLockedBooking(tx,locked.booking,facts,'postponement_declined',reason,actor):{status:'saved',summary,childPaymentIds:[]}
    if(response.status!=='saved')return response
    await tx.insert(auditLog).values({id:responseId,action:'postponement_response',entity:'booking',entityId:bookingId,actorUserId:actor,meta:{changeId,decision}})
    return response
  })
  if(result.status==='saved')refreshBooking(bookingId)
  return result
}
