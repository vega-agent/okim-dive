'use server'

/**
 * M5 item 6 — trip management + runtime settings (TRIP-MANAGEMENT-SPEC).
 * Reuses M5 locked rules: audit_log on every mutation, insertWithRetry for
 * sequential TRP ids, slot math per decision #22 (see trip-display.ts).
 * Cancellation (owner decision 2026-11-21): flag paid bookings refund_flagged,
 * unpaid bookings cancelled; NO points action here — the existing refundPayment
 * reverses points when Iris records each external refund. Divers emailed.
 */
import { db, transactionDb } from '@/db'
import { auditLog, bookings, customers, payments, settings, trips } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireInstructor } from '@/lib/portal-actions'
import { sendTripCancelledEmail } from '@/lib/emails'
import { DERIVED_FIELDS, deriveDisplay, publishBlockers, slugify, slotsConsumed, type Locale, type TripFacts } from '@/lib/trip-display'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CURRENCIES = ['MYR', 'SGD', 'USD'] as const

async function nextTripId(): Promise<string> {
  const rows = await db!.select({ id: trips.id }).from(trips)
  const max = rows.reduce((acc, row) => {
    const n = Number(row.id.replace(/^TRP-/, ''))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `TRP-${String(max + 1).padStart(3, '0')}`
}

async function insertTripWithRetry(values: Omit<typeof trips.$inferInsert, 'id'>): Promise<string> {
  const attempt = async () => {
    const id = await nextTripId()
    await db!.insert(trips).values({ ...values, id })
    return id
  }
  try {
    return await attempt()
  } catch {
    return await attempt()
  }
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const rows = await db!.select({ id: trips.id, slug: trips.slug }).from(trips)
  const taken = new Set(rows.filter(r => r.id !== excludeId).map(r => r.slug))
  let slug = base
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`
  return slug
}

const tripDate = (form: FormData, key: string): Date | null => {
  const raw = String(form.get(key) ?? '').trim()
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Invalid date / 日期无效')
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

const num = (form: FormData, key: string, fallback = 0): number => {
  const raw = String(form.get(key) ?? '').trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${key} / 数字无效`)
  return n
}

const text = (form: FormData, key: string, max = 2000): string => String(form.get(key) ?? '').trim().slice(0, max)

async function tripBookingStatuses(tripId: string): Promise<string[]> {
  const rows = await db!.select({ status: bookings.status }).from(bookings)
    .where(and(eq(bookings.productId, tripId), eq(bookings.productType, 'trip')))
  return rows.map(r => r.status)
}

function revalidateTrip(slug?: string) {
  revalidatePath('/portal')
  revalidatePath('/trips')
  if (slug) revalidatePath(`/trips/${slug}`)
}

async function defaultRmRate(): Promise<string> {
  const [row] = await db!.select().from(settings).where(eq(settings.key, 'default_rm_rate'))
  const value = Number((row?.value as { value?: unknown } | undefined)?.value)
  return Number.isFinite(value) && value > 0 ? String(value) : '1'
}

/* ---------- Create / duplicate / delete ---------- */

export async function createTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const titleEn = text(form, 'titleEn', 200)
  if (!titleEn) throw new Error('Trip name required / 请填写行程名称')
  const slug = await uniqueSlug(slugify(titleEn))
  const id = await insertTripWithRetry({
    slug,
    titleEn,
    titleZh: '',
    status: 'draft',
    published: false,
    currency: 'MYR',
    priceAmount: '0.00',
    depositType: 'percent',
    depositValue: '0',
    balanceDueDays: 30,
    capacity: 1,
    minParticipants: 1,
    rmRate: await defaultRmRate(),
    reqMedical: true,
    reqInsurance: false,
    sample: false,
  })
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_created', entity: 'trip', entityId: id, meta: { slug, titleEn } })
  revalidateTrip(slug)
  redirect(`/portal/trips/${id}`)
}

export async function duplicateTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const sourceId = String(form.get('tripId') ?? '')
  const [source] = await db.select().from(trips).where(eq(trips.id, sourceId))
  if (!source) throw new Error('Unknown trip / 行程不存在')
  const slug = await uniqueSlug(`${source.slug}-copy`)
  const copy: Partial<typeof source> = { ...source }
  delete copy.id
  delete copy.createdAt
  delete copy.updatedAt
  const id = await insertTripWithRetry({ ...copy, slug, status: 'draft', published: false } as Omit<typeof trips.$inferInsert, 'id'>)
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_duplicated', entity: 'trip', entityId: id, meta: { sourceId, slug } })
  revalidateTrip(slug)
  redirect(`/portal/trips/${id}`)
}

export async function deleteDraft(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId))
  if (!trip) throw new Error('Unknown trip / 行程不存在')
  const statuses = await tripBookingStatuses(tripId)
  if (trip.status !== 'draft' || trip.published || statuses.length) {
    throw new Error('Only unpublished drafts without bookings can be deleted / 仅可删除无预订的未发布草稿')
  }
  await db.delete(trips).where(eq(trips.id, tripId))
  // Audit meta keeps a full snapshot so a mistaken delete is recoverable.
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_deleted', entity: 'trip', entityId: tripId, meta: { snapshot: JSON.parse(JSON.stringify(trip)) } })
  revalidateTrip(trip.slug)
  redirect('/portal')
}

/* ---------- Settings (facts) ---------- */

export async function updateTripSettings(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip) throw new Error('Unknown trip / 行程不存在')
    if (trip.status === 'cancelled') throw new Error('Cancelled trips are read-only — duplicate to relaunch / 已取消行程只读，请复制后重新发布')

    const statuses = (await tx.select({ status: bookings.status }).from(bookings)
      .where(and(eq(bookings.productId, tripId), eq(bookings.productType, 'trip')))).map(r => r.status)
    const consumed = slotsConsumed(statuses)

    const currency = String(form.get('currency') ?? trip.currency)
    if (!(CURRENCIES as readonly string[]).includes(currency)) throw new Error('Invalid currency / 币种无效')
    const priceAmount = num(form, 'priceAmount', Number(trip.priceAmount))
    const depositType = String(form.get('depositType') ?? trip.depositType)
    if (!['fixed', 'percent'].includes(depositType)) throw new Error('Invalid deposit type / 订金类型无效')
    const depositValue = num(form, 'depositValue', Number(trip.depositValue))
    const balanceDueDays = Math.round(num(form, 'balanceDueDays', trip.balanceDueDays))
    const capacity = Math.round(num(form, 'capacity', trip.capacity))
    const minParticipants = Math.round(num(form, 'minParticipants', trip.minParticipants))
    const rmRate = num(form, 'rmRate', Number(trip.rmRate))
    if (priceAmount < 0 || depositValue < 0 || balanceDueDays < 0 || rmRate <= 0) throw new Error('Invalid pricing / 价格设置无效')
    if (depositType === 'percent' && depositValue > 100) throw new Error('Deposit percent cannot exceed 100 / 订金比例不能超过 100%')
    if (capacity < 1) throw new Error('Capacity must be at least 1 / 名额至少为 1')
    if (capacity < consumed) throw new Error(`Capacity cannot drop below ${consumed} held/confirmed slots / 名额不能低于已占用名额 ${consumed}`)
    if (minParticipants < 1 || minParticipants > capacity) throw new Error('Minimum participants must be between 1 and capacity / 最低成团人数须介于 1 与名额之间')
    const departureTimezone = text(form,'departureTimezone',100) || trip.departureTimezone
    try { new Intl.DateTimeFormat('en',{timeZone:departureTimezone}).format(new Date()) } catch { throw new Error('Invalid IANA timezone / 时区无效') }
    const travelStart = tripDate(form, 'travelStart')
    const travelEnd = tripDate(form, 'travelEnd')
    if (travelStart && travelEnd && travelEnd < travelStart) throw new Error('End date must be after start date / 结束日期必须晚于出发日期')

    // Slug locks once launched (published or non-draft) or any booking exists.
    const slugEditable = trip.status === 'draft' && !trip.published && statuses.length === 0
    let slug = trip.slug
    if (slugEditable) {
      const submitted = text(form, 'slug', 100)
      if (submitted && slugify(submitted) !== trip.slug) slug = await uniqueSlug(slugify(submitted), tripId)
    }

    const facts: TripFacts = { currency, priceAmount, depositType, depositValue, balanceDueDays, capacity, travelStart, travelEnd }
    const oldDerived = { en: deriveDisplay(trip, 'en'), zh: deriveDisplay(trip, 'zh') }
    const newDerived = { en: deriveDisplay(facts, 'en'), zh: deriveDisplay(facts, 'zh') }
    const display: Record<string, string> = {}
    for (const field of DERIVED_FIELDS) {
      for (const locale of ['en', 'zh'] as const) {
        const column = `${field}${locale === 'zh' ? 'Zh' : 'En'}` as keyof typeof trip
        const current = (trip[column] as string | null) ?? ''
        // Keep custom wording (overrides); refresh only lines still matching the old derivation.
        display[column] = current && current !== oldDerived[locale][field] ? current : newDerived[locale][field]
      }
    }

    const reqMinDivesRaw = String(form.get('reqMinDives') ?? '').trim()
    const reqMinDives = reqMinDivesRaw === '' ? null : Math.round(num(form, 'reqMinDives'))
    if (reqMinDives !== null && reqMinDives < 0) throw new Error('Invalid minimum dives / 最低潜水次数无效')

    await tx.update(trips).set({
      slug,
      currency: currency as typeof trip.currency,
      priceAmount: priceAmount.toFixed(2),
      depositType: depositType as typeof trip.depositType,
      depositValue: depositValue.toFixed(2),
      balanceDueDays,
      capacity,
      minParticipants,
      rmRate: rmRate.toFixed(4),
      departureTimezone,
      travelStart,
      travelEnd,
      reqCertLevel: text(form, 'reqCertLevel', 100) || null,
      reqMinDives,
      reqInsurance: form.get('reqInsurance') === 'on',
      reqMedical: form.get('reqMedical') === 'on',
      sample: form.get('sample') === 'on',
      ...(display as Partial<typeof trips.$inferInsert>),
      updatedAt: new Date(),
    }).where(eq(trips.id, tripId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_updated', entity: 'trip', entityId: tripId, meta: { consumed, capacity, slug } })
  })
  const [updated] = await db!.select({ slug: trips.slug }).from(trips).where(eq(trips.id, tripId))
  revalidateTrip(updated?.slug)
  revalidatePath(`/portal/trips/${tripId}`)
}

/* ---------- Content (one language at a time) ---------- */

export async function updateTripContent(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const locale: Locale = form.get('locale') === 'zh' ? 'zh' : 'en'
  const suffix = locale === 'zh' ? 'Zh' : 'En'
  await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip) throw new Error('Unknown trip / 行程不存在')
    if (trip.status === 'cancelled') throw new Error('Cancelled trips are read-only / 已取消行程只读')

    const list = (key: string): string[] => form.getAll(key).map(v => String(v).trim()).filter(Boolean).slice(0, 50)
    const difficultyValue = String(form.get('difficulty') ?? '')
    const difficultyLabels: Record<string, { en: string; zh: string }> = {
      beginner: { en: 'Beginner', zh: '初级' },
      intermediate: { en: 'Intermediate', zh: '进阶' },
      advanced: { en: 'Advanced', zh: '高级' },
      all: { en: 'All levels', zh: '所有级别' },
    }
    const derived = deriveDisplay(trip, locale)
    const override = (field: keyof typeof derived): string => {
      const use = form.get(`useOverride_${field}`) === 'on'
      const value = text(form, `${field}Override`, 500)
      return use && value ? value : derived[field]
    }

    await tx.update(trips).set({
      [`title${suffix}`]: text(form, 'title', 200),
      [`location${suffix}`]: text(form, 'location', 200) || null,
      [`summary${suffix}`]: text(form, 'summary', 4000) || null,
      [`highlights${suffix}`]: list('highlights'),
      [`itinerary${suffix}`]: list('itinerary'),
      [`included${suffix}`]: list('included'),
      [`additionalCosts${suffix}`]: list('additionalCosts'),
      [`notes${suffix}`]: text(form, 'notes', 4000) || null,
      [`requirementsText${suffix}`]: text(form, 'requirementsText', 2000) || null,
      [`inquiryLabel${suffix}`]: text(form, 'inquiryLabel', 100) || null,
      [`difficulty${suffix}`]: difficultyLabels[difficultyValue]?.[locale] ?? null,
      [`travelDates${suffix}`]: override('travelDates'),
      [`duration${suffix}`]: override('duration'),
      [`costDisplay${suffix}`]: override('costDisplay'),
      [`costBasis${suffix}`]: override('costBasis'),
      [`depositText${suffix}`]: override('depositText'),
      [`balanceText${suffix}`]: override('balanceText'),
      [`groupSize${suffix}`]: override('groupSize'),
      ...(form.get('demoFill') === '1' ? { sample: true } : {}),
      updatedAt: new Date(),
    } as Partial<typeof trips.$inferInsert>).where(eq(trips.id, tripId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_content_updated', entity: 'trip', entityId: tripId, meta: { locale, demoFill: form.get('demoFill') === '1' } })
  })
  const [updated] = await db!.select({ slug: trips.slug }).from(trips).where(eq(trips.id, tripId))
  revalidateTrip(updated?.slug)
  revalidatePath(`/portal/trips/${tripId}/content`)
}

/* ---------- Launch / cancel ---------- */

export async function setLaunchState(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const state = String(form.get('state') ?? '')
  if (!['draft', 'inquiries', 'open', 'closed'].includes(state)) throw new Error('Invalid launch state / 发布状态无效')
  await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip) throw new Error('Unknown trip / 行程不存在')
    if (trip.status === 'cancelled') throw new Error('Cancelled trips cannot relaunch — duplicate instead / 已取消行程不能重新发布，请复制')
    const statuses = (await tx.select({ status: bookings.status }).from(bookings)
      .where(and(eq(bookings.productId, tripId), eq(bookings.productType, 'trip')))).map(r => r.status)

    if (state === 'draft') {
      if (statuses.length) throw new Error('Trips with bookings cannot return to draft — close instead / 有预订的行程不能回到草稿，请改为关闭')
      await tx.update(trips).set({ published: false, status: 'draft', updatedAt: new Date() }).where(eq(trips.id, tripId))
    } else if (state === 'closed') {
      // Unpublish: hidden from public, no new bookings; existing payments stay verifiable.
      await tx.update(trips).set({ published: false, updatedAt: new Date() }).where(eq(trips.id, tripId))
    } else {
      const blockers = publishBlockers(trip)
      if (blockers.length) {
        throw new Error(`Publish blocked / 无法发布：${blockers.map(b => b.en).join('; ')} | ${blockers.map(b => b.zh).join('；')}`)
      }
      await tx.update(trips).set({ published: true, status: state === 'open' ? 'open' : 'on_request', updatedAt: new Date() }).where(eq(trips.id, tripId))
    }
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_launch_state', entity: 'trip', entityId: tripId, meta: { state } })
  })
  const [updated] = await db!.select({ slug: trips.slug }).from(trips).where(eq(trips.id, tripId))
  revalidateTrip(updated?.slug)
  revalidatePath(`/portal/trips/${tripId}`)
}

export async function cancelTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const reason = text(form, 'reason', 500)
  if (!reason) throw new Error('Cancellation reason required / 请填写取消原因')
  if (form.get('confirm') !== 'on') throw new Error('Confirmation required / 请勾选确认')

  const affected: { bookingId: string; customerId: string; paid: boolean }[] = []
  await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip) throw new Error('Unknown trip / 行程不存在')
    if (trip.status === 'cancelled') return
    await tx.update(trips).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(trips.id, tripId))
    const active = await tx.select().from(bookings)
      .where(and(eq(bookings.productId, tripId), eq(bookings.productType, 'trip'), inArray(bookings.status, ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed'])))
    for (const booking of active) {
      const [locked] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for('update')
      const paidRows = await tx.select().from(payments).where(eq(payments.bookingId, booking.id))
      const netPaid = paidRows.reduce((sum, p) => sum + (p.kind === 'refund' ? -1 : 1) * Number(p.amount), 0)
      const paid = netPaid > 0
      // Points are NOT touched here (owner decision): refundPayment reverses them
      // when Iris records each external refund. Earned-but-unusable until completion.
      await tx.update(bookings).set(paid
        ? { status: 'refund_flagged' }
        : { status: 'cancelled', cancelledAt: new Date(), cancelReason: `Trip cancelled: ${reason}` }
      ).where(eq(bookings.id, booking.id))
      await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: paid ? 'booking_refund_flagged' : 'booking_cancelled', entity: 'booking', entityId: booking.id, meta: { tripCancellation: tripId, reason } })
      affected.push({ bookingId: booking.id, customerId: locked.customerId, paid })
    }
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_cancelled', entity: 'trip', entityId: tripId, meta: { reason, affectedBookings: affected.length } })
  })

  // Notify divers after commit; email failures never undo the cancellation.
  const [trip] = await db!.select().from(trips).where(eq(trips.id, tripId))
  const byCustomer = new Map<string, string[]>()
  for (const a of affected) byCustomer.set(a.customerId, [...(byCustomer.get(a.customerId) ?? []), a.bookingId])
  let sent = 0, failed = 0
  const customerIds = Array.from(byCustomer.keys())
  for (const customerId of customerIds) {
    const bookingIds = byCustomer.get(customerId) ?? []
    const [customer] = await db!.select().from(customers).where(eq(customers.id, customerId))
    if (!customer) continue
    const ok = await sendTripCancelledEmail({
      to: customer.email,
      locale: customer.locale === 'zh' ? 'zh' : 'en',
      customerName: customer.name,
      tripTitle: customer.locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn,
      bookingIds,
      reason,
    })
    if (ok) sent++
    else failed++
  }
  await db!.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_cancel_notified', entity: 'trip', entityId: tripId, meta: { emailsSent: sent, emailsFailed: failed } })
  revalidateTrip(trip.slug)
  revalidatePath(`/portal/trips/${tripId}`)
}

/* ---------- Runtime settings (bank details NEVER in repo) ---------- */

export async function updateSettings(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const key = String(form.get('key') ?? '')
  let value: Record<string, unknown>
  if (key === 'points_rules') {
    const earnRate = num(form, 'earnRate', 1)
    const redeemValue = num(form, 'redeemValue', 0.05)
    const expiryMonths = Math.round(num(form, 'expiryMonths', 12))
    const capPct = num(form, 'capPct', 20)
    if (earnRate < 0 || redeemValue <= 0 || expiryMonths < 1 || capPct < 1 || capPct > 20) {
      throw new Error('Invalid points rules / 积分规则无效')
    }
    value = { earnRate, redeemValue, expiryMonths, capPct }
  } else if (key === 'default_rm_rate') {
    const rate = num(form, 'rmRate', 1)
    if (rate <= 0) throw new Error('Invalid RM rate / 汇率无效')
    value = { value: rate }
  } else if (key === 'instructor_emails') {
    const emails = Array.from(new Set(String(form.get('emails') ?? '').split(/[\n,]/).map(e => e.trim().toLowerCase()).filter(Boolean)))
    if (!emails.length || emails.some(e => !EMAIL_RE.test(e))) throw new Error('Enter at least one valid email / 请至少填写一个有效邮箱')
    value = { emails }
  } else if (key === 'payment_instructions') {
    value = {
      en: text(form, 'instructionsEn', 2000),
      zh: text(form, 'instructionsZh', 2000),
      sample: form.get('confirmed') !== 'on', // honest sample label until Iris confirms
    }
  } else {
    throw new Error('Unknown settings key / 未知设置项')
  }
  await db.insert(settings).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
  // Meta keeps the key only — payment instructions may hold bank details (minimization).
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'settings_updated', entity: 'settings', entityId: key, meta: { key } })
  revalidatePath('/portal')
}