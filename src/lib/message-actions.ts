'use server'

/**
 * Trip messages (TRIP-MESSAGES-SPEC, owner-locked 2026-11-22): Luma-style
 * participant stream, ON-PLATFORM delivery only (zero Resend sends).
 * Publish = human approval; edits/deletes audited with before-text; audience
 * filtered at view time so late bookers see earlier matching messages.
 */
import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, bookings, messageReads, tripMessages, trips } from '@/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireInstructor } from '@/lib/portal-actions'
import { messageAudienceStatuses, type MessageBookingStatus } from '@/lib/trip-display'

const CONFIRMED_STATUSES: MessageBookingStatus[] = ['deposit_verified', 'confirmed']

const text = (form: FormData, key: string, max: number): string => String(form.get(key) ?? '').trim().slice(0, max)

async function nextMessageId(): Promise<string> {
  const rows = await db!.select({ id: tripMessages.id }).from(tripMessages)
  const max = rows.reduce((acc, row) => {
    const n = Number(row.id.replace(/^MSG-/, ''))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `MSG-${String(max + 1).padStart(3, '0')}`
}

function messageFields(form: FormData) {
  const label = text(form, 'label', 40)
  const subjectEn = text(form, 'subjectEn', 200)
  const subjectZh = text(form, 'subjectZh', 200)
  const bodyEn = text(form, 'bodyEn', 20000)
  const bodyZh = text(form, 'bodyZh', 20000)
  const audience = String(form.get('audience') ?? 'confirmed')
  if (!label) throw new Error('Label required / 请填写标签')
  // §11: both languages publish together — never a half-translated message.
  if (!subjectEn || !subjectZh || !bodyEn || !bodyZh) {
    throw new Error('Subject and body are required in both languages / 英文与中文的标题和正文均须填写')
  }
  if (!['confirmed', 'all_active'].includes(audience)) throw new Error('Invalid audience / 接收对象无效')
  return { label, subjectEn, subjectZh, bodyEn, bodyZh, audience: audience as 'confirmed' | 'all_active' }
}

function revalidateMessages(tripId: string) {
  revalidatePath(`/portal/trips/${tripId}/messages`)
  revalidatePath('/myokim')
}

export async function publishMessage(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const [trip] = await db.select({ id: trips.id }).from(trips).where(eq(trips.id, tripId))
  if (!trip) throw new Error('Unknown trip / 行程不存在')
  const fields = messageFields(form)
  const insert = async () => {
    const id = await nextMessageId()
    await db!.insert(tripMessages).values({ id, tripId, ...fields, publishedBy: actor })
    return id
  }
  let id: string
  try {
    id = await insert()
  } catch {
    id = await insert() // sequential id collision under concurrent publishes
  }
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'message_published', entity: 'trip_message', entityId: id, meta: { tripId, label: fields.label, audience: fields.audience } })
  revalidateMessages(tripId)
  redirect(`/portal/trips/${tripId}/messages?published=1`)
}

export async function editMessage(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const messageId = String(form.get('messageId') ?? '')
  const [before] = await db.select().from(tripMessages).where(and(eq(tripMessages.id, messageId), isNull(tripMessages.deletedAt)))
  if (!before) throw new Error('Unknown message / 消息不存在')
  const fields = messageFields(form)
  await db.update(tripMessages).set({ ...fields, updatedAt: new Date() }).where(eq(tripMessages.id, messageId))
  await db.insert(auditLog).values({
    id: randomUUID(), actorUserId: actor, action: 'message_edited', entity: 'trip_message', entityId: messageId,
    meta: { before: { label: before.label, subjectEn: before.subjectEn, subjectZh: before.subjectZh, bodyEn: before.bodyEn, bodyZh: before.bodyZh, audience: before.audience } },
  })
  revalidateMessages(before.tripId)
  redirect(`/portal/trips/${before.tripId}/messages?edited=1`)
}

export async function deleteMessage(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const messageId = String(form.get('messageId') ?? '')
  const [before] = await db.select().from(tripMessages).where(eq(tripMessages.id, messageId))
  if (!before) throw new Error('Unknown message / 消息不存在')
  if (before.deletedAt) { // idempotent: a repeated delete is a no-op
    redirect(`/portal/trips/${before.tripId}/messages`)
  }
  await db.update(tripMessages).set({ deletedAt: new Date() }).where(eq(tripMessages.id, messageId))
  await db.insert(auditLog).values({
    id: randomUUID(), actorUserId: actor, action: 'message_deleted', entity: 'trip_message', entityId: messageId,
    meta: { before: { label: before.label, subjectEn: before.subjectEn, subjectZh: before.subjectZh, bodyEn: before.bodyEn, bodyZh: before.bodyZh } },
  })
  revalidateMessages(before.tripId)
  redirect(`/portal/trips/${before.tripId}/messages`)
}

/** Diver marks a message seen (static unread dot until then). Access-checked:
 *  the diver must hold an active booking on the trip matching the audience. */
export async function markMessageRead(messageId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.customerId || !db) return
  const [message] = await db.select().from(tripMessages)
    .where(and(eq(tripMessages.id, messageId), isNull(tripMessages.deletedAt)))
  if (!message) return
  const mine = await db.select({ id: bookings.id }).from(bookings)
    .where(and(eq(bookings.customerId, session.user.customerId), eq(bookings.productId, message.tripId), inArray(bookings.status, messageAudienceStatuses(message.audience))))
    .limit(1)
  if (!mine.length) return
  await db.insert(messageReads).values({ messageId, customerId: session.user.customerId })
    .onConflictDoNothing()
  revalidatePath('/myokim')
}

/** Instructor outbox helper: seen counts against current confirmed divers. */
export async function messageSeenStats(tripId: string): Promise<Record<string, { seen: number; total: number }>> {
  await requireInstructor()
  if (!db) return {}
  const divers = await db.select({ customerId: bookings.customerId }).from(bookings)
    .where(and(eq(bookings.productId, tripId), eq(bookings.productType, 'trip'), inArray(bookings.status, CONFIRMED_STATUSES)))
  const total = new Set(divers.map(d => d.customerId)).size
  const msgs = await db.select({ id: tripMessages.id }).from(tripMessages)
    .where(and(eq(tripMessages.tripId, tripId), isNull(tripMessages.deletedAt)))
  const reads = msgs.length
    ? await db.select({ messageId: messageReads.messageId, customerId: messageReads.customerId }).from(messageReads)
      .where(inArray(messageReads.messageId, msgs.map(m => m.id)))
    : []
  const confirmedSet = new Set(divers.map(d => d.customerId))
  const stats: Record<string, { seen: number; total: number }> = {}
  for (const m of msgs) {
    stats[m.id] = { seen: reads.filter(r => r.messageId === m.id && confirmedSet.has(r.customerId)).length, total }
  }
  return stats
}