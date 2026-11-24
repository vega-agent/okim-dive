'use server'

/**
 * M5 item 6 — trip management + runtime settings (TRIP-MANAGEMENT-SPEC).
 * Reuses M5 locked rules: audit_log on every mutation, insertWithRetry for
 * sequential TRP ids, slot math per decision #22 (see trip-display.ts).
 */
import { db, transactionDb } from '@/db'
import { auditLog, bookings, settings, trips, tripDeposits } from '@/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireInstructor } from '@/lib/portal-actions'
import { activeBookingStatuses, cancelLockedBooking, lockActiveTripBookings } from './booking-lifecycle'
import { readLockedPaymentFacts } from './payment-queries'
import { bookingRevisionList, parseMoneyMinor, localCalendarDate } from './payment-schedule'
import { buildTripStages, DERIVED_FIELDS, deriveDisplay, publishBlockers, slugify, slotsConsumed, type Locale, type TripFacts } from '@/lib/trip-display'
import { COUNTRIES, COUNTRY_KEYS, matchSite, type CountryKey } from '@/lib/locations'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CURRENCIES = ['MYR', 'SGD', 'USD'] as const

type TripTransaction = Parameters<Parameters<NonNullable<typeof transactionDb>['transaction']>[0]>[0]

async function uniqueSlug(tx: TripTransaction, base: string): Promise<string> {
  const rows = await tx.select({ slug: trips.slug }).from(trips)
  const taken = new Set(rows.map(r => r.slug))
  let slug = base
  for (let i = 2; taken.has(slug); i++) slug = base + '-' + i
  return slug
}

async function newTripIdentity(tx: TripTransaction, baseSlug: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('okim-trip-number'))`)
  const [row] = await tx.select({ next: sql<string>`coalesce(max(substring(${trips.id} from '^TRP-([0-9]+)$')::numeric),0)+1` }).from(trips)
  return { id: 'TRP-' + String(row.next).padStart(3, '0'), slug: await uniqueSlug(tx, baseSlug) }
}

const tripDate = (form: FormData, key: string): Date | null => {
  const raw = String(form.get(key) ?? '').trim()
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Invalid date / 日期无效')
  const d = new Date(`${raw}T00:00:00Z`)
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== raw || raw.startsWith('0000')) throw new Error('Invalid date')
  return d
}

const num = (form: FormData, key: string, fallback = 0): number => {
  const raw = String(form.get(key) ?? '').trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${key} / 数字无效`)
  return n
}

const text = (form: FormData, key: string, max = 2000): string => String(form.get(key) ?? '').trim().slice(0, max)

function revalidateTrip(slug?: string) {
  revalidatePath('/portal')
  revalidatePath('/trips')
  if (slug) revalidatePath(`/trips/${slug}`)
}

async function defaultRmRate(tx: TripTransaction): Promise<string> {
  const [row] = await tx.select().from(settings).where(eq(settings.key, 'default_rm_rate'))
  const value = Number((row?.value as { value?: unknown } | undefined)?.value)
  return Number.isFinite(value) && value > 0 ? String(value) : '1'
}

/* ---------- Create / duplicate / delete ---------- */

export async function createTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const titleEn = text(form, 'titleEn', 200) || 'Untitled trip'
  const { id, slug } = await transactionDb.transaction(async tx => {
    const identity = await newTripIdentity(tx, slugify(titleEn))
    await tx.insert(trips).values({ ...identity, titleEn, titleZh: '', locationKey: 'malaysia', status: 'draft', published: false,
      currency: 'MYR', priceAmount: '0.00', depositType: 'fixed', depositValue: '0', capacity: 1, minParticipants: 1,
      rmRate: await defaultRmRate(tx), reqMedical: true, reqInsurance: false, sample: false })
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_created', entity: 'trip', entityId: identity.id, meta: { slug: identity.slug, titleEn } })
    return identity
  })
  revalidateTrip(slug)
  redirect(`/portal/trips/${id}`)
}

export async function duplicateTrip(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const sourceId = String(form.get('tripId') ?? '')
  const { id, slug } = await transactionDb.transaction(async tx => {
    const [source] = await tx.select().from(trips).where(eq(trips.id, sourceId)).for('update')
    if (!source) throw new Error('Unknown trip')
    const { slug, id } = await newTripIdentity(tx, source.slug + '-copy')
    const { createdAt: _created, updatedAt: _updated, ...fields } = source
    await tx.insert(trips).values({ ...fields, id, slug, status: 'draft', published: false })
    const rows = await tx.select().from(tripDeposits).where(eq(tripDeposits.tripId, sourceId)).orderBy(tripDeposits.sort)
    if (rows.length) await tx.insert(tripDeposits).values(rows.map(d => ({
      ...d, id: id + '-D' + (d.sort + 1), tripId: id,
    })))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_duplicated', entity: 'trip', entityId: id, meta: { sourceId, slug } })
    return { id, slug }
  })
  revalidateTrip(slug)
  redirect(`/portal/trips/${id}`)
}

export async function deleteDraft(form: FormData) {
  const actor = await requireInstructor()
  if (!transactionDb) throw new Error('Database unavailable')
  const tripId = String(form.get('tripId') ?? '')
  const slug = await transactionDb.transaction(async tx => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update')
    if (!trip) throw new Error('Unknown trip')
    const [existing] = await tx.select({ id: bookings.id }).from(bookings)
      .where(and(eq(bookings.productId, tripId), eq(bookings.productType, 'trip'))).limit(1)
    if (trip.status !== 'draft' || trip.published || existing) throw new Error('Only unpublished drafts without bookings can be deleted')
    const deposits = await tx.delete(tripDeposits).where(eq(tripDeposits.tripId, tripId)).returning()
    await tx.delete(trips).where(eq(trips.id, tripId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_deleted', entity: 'trip', entityId: tripId,
      meta: { snapshot: trip, deposits } })
    return trip.slug
  })
  revalidateTrip(slug)
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

    const tripBookings = await tx.select({id:bookings.id,status:bookings.status}).from(bookings)
      .where(and(eq(bookings.productId,tripId),eq(bookings.productType,'trip'))).orderBy(bookings.id)
    const statuses = tripBookings.map(b=>b.status)
    const consumed = slotsConsumed(statuses)

    const countryKey = (COUNTRY_KEYS as string[]).includes(String(form.get('locationKey'))) ? String(form.get('locationKey')) as CountryKey : 'malaysia'
    const loc = COUNTRIES[countryKey]
    const currency = String(form.get('currency') ?? trip.currency)
    if (!(CURRENCIES as readonly string[]).includes(currency)) throw new Error('Invalid currency / 币种无效')
    const priceMinor = parseMoneyMinor(String(form.get('priceAmount') || '0'))
    const priceAmount = priceMinor / 100
    const amounts = form.getAll('depositAmount').map(String)
    const dates = form.getAll('depositDueDate').map(String)
    if (amounts.length > 2 || amounts.length !== dates.length) throw new Error('Invalid deposit rows')
    // Ignore optional trailing blanks, but keep the first position if a second row was entered.
    while (amounts.length && !amounts[amounts.length - 1] && !dates[dates.length - 1]) { amounts.pop(); dates.pop() }
    const deposits = amounts.map((amount, i) => {
      const cents = parseMoneyMinor(amount || '0')
      if (amount && cents === 0) throw new Error('Deposits must be positive')
      if (dates[i]) {
        const day = new Date(dates[i] + 'T00:00:00Z')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dates[i]) || dates[i].startsWith('0000') ||
            !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== dates[i]) throw new Error('Invalid deposit due date')
      }
      return { amount: (cents / 100).toFixed(2), dueDate: dates[i] || null }
    })
    const depositTotal = deposits.reduce((sum, row) => sum + parseMoneyMinor(row.amount), 0)
    const balanceDueDate = tripDate(form, 'balanceDueDate')?.toISOString().slice(0, 10) ?? null
    const capacity = Math.round(num(form, 'capacity', trip.capacity))
    const minParticipants = Math.round(num(form, 'minParticipants', trip.minParticipants))
    const rmRate = Number(trip.rmRate) // frozen at creation; global rate edits affect new trips only
    if (rmRate <= 0) throw new Error('Invalid pricing / 价格设置无效')
    if (depositTotal > priceMinor) throw new Error('Total deposits cannot exceed the price / 订金总额不能超过价格')
    if (capacity < 1) throw new Error('Capacity must be at least 1 / 名额至少为 1')
    if (capacity < consumed) throw new Error(`Capacity cannot drop below ${consumed} held/confirmed slots / 名额不能低于已占用名额 ${consumed}`)
    if (minParticipants < 1 || minParticipants > capacity) throw new Error('Minimum participants must be between 1 and capacity / 最低成团人数须介于 1 与名额之间')
    const departureTimezone = loc.timezone
    const travelStart = tripDate(form, 'travelStart')
    const travelEnd = tripDate(form, 'travelEnd')
    if (travelStart && travelEnd && travelEnd < travelStart) throw new Error('End date must be after start date / 结束日期必须晚于出发日期')

    const dateChanged = travelStart?.getTime()!==trip.travelStart?.getTime() || travelEnd?.getTime()!==trip.travelEnd?.getTime()
    const affected = tripBookings.filter(b=>activeBookingStatuses.some(s=>s===b.status)).map(b=>b.id)
    if (dateChanged && affected.length) {
      if(!travelStart || !travelEnd) throw Error('Enter both new dates for bookings affected by a change')
      await tx.insert(auditLog).values({id:randomUUID(),actorUserId:actor,entity:'trip',entityId:tripId,action:'trip_dates_changed',at:sql`clock_timestamp()`,
        meta:{oldStart:trip.travelStart?.toISOString()??null,oldEnd:trip.travelEnd?.toISOString()??null,newStart:travelStart.toISOString(),newEnd:travelEnd.toISOString(),oldZone:trip.departureTimezone,newZone:departureTimezone,bookingIds:affected}})
    }
    const titleEn = text(form, 'titleEn', 200) || trip.titleEn
    const titleZh = text(form, 'titleZh', 200) || trip.titleZh
    // Slug is never hand-typed (owner: typos/drift cause confusion). It is
    // auto-generated from the trip name and locks once launched or booked.
    const slugEditable = trip.status === 'draft' && !trip.published && statuses.length === 0
    let slug = trip.slug
    if (slugEditable) {
      const auto = slugify(titleEn)
      if (auto && auto !== trip.slug) slug = await uniqueSlug(tx, auto)
    }

    const facts: TripFacts = { currency, priceAmount, balanceDueDate, departureTimezone, capacity, travelStart, travelEnd }
    if (trip.published && trip.status === 'open') buildTripStages(facts, deposits)
    const departure = travelStart ? localCalendarDate(travelStart, departureTimezone) : null
    const daysBefore = (date: string | null) => date && departure ? Math.round((Date.parse(departure) - Date.parse(date)) / 86400000) : 0
    const newDerived = { en: deriveDisplay(facts, 'en', deposits), zh: deriveDisplay(facts, 'zh', deposits) }
    // Display lines are ALWAYS derived from facts (owner 2026-11-22: trips are
    // fixed; Settings is the single source — no custom wording, no drift).
    const display: Record<string, string> = {}
    for (const field of DERIVED_FIELDS) {
      for (const locale of ['en', 'zh'] as const) {
        display[`${field}${locale === 'zh' ? 'Zh' : 'En'}`] = newDerived[locale][field]
      }
    }

    const reqMinDivesRaw = String(form.get('reqMinDives') ?? '').trim()
    const reqMinDives = reqMinDivesRaw === '' ? null : Math.round(num(form, 'reqMinDives'))
    if (reqMinDives !== null && reqMinDives < 0) throw new Error('Invalid minimum dives / 最低潜水次数无效')

    await tx.update(trips).set({
      slug,
      currency: currency as typeof trip.currency,
      priceAmount: priceAmount.toFixed(2),
      depositType: 'fixed',
      depositValue: deposits[0]?.amount ?? '0.00',
      balanceDueDate, balanceDueDays: daysBefore(balanceDueDate),
      capacity,
      minParticipants,
      rmRate: rmRate.toFixed(4),
      departureTimezone,
      locationKey: countryKey,
      diveSiteEn: text(form, 'diveSiteEn', 200) || null,
      diveSiteZh: text(form, 'diveSiteZh', 200) || null,
      airportEn: matchSite(text(form, 'diveSiteEn', 200) || text(form, 'diveSiteZh', 200))?.airportEn ?? null,
      airportZh: matchSite(text(form, 'diveSiteEn', 200) || text(form, 'diveSiteZh', 200))?.airportZh ?? null,
      jettyEn: matchSite(text(form, 'diveSiteEn', 200) || text(form, 'diveSiteZh', 200))?.jettyEn ?? null,
      jettyZh: matchSite(text(form, 'diveSiteEn', 200) || text(form, 'diveSiteZh', 200))?.jettyZh ?? null,
      locationEn: [text(form, 'diveSiteEn', 200), loc.nameEn].filter(Boolean).join(', '),
      locationZh: [text(form, 'diveSiteZh', 200), loc.nameZh].filter(Boolean).join('，'),
      titleEn,
      titleZh,
      travelStart,
      travelEnd,
      reqCertLevel: text(form, 'reqCertLevel', 100) || null,
      reqMinDives,
      reqInsurance: form.get('reqInsurance') === 'on',
      reqMedical: form.get('reqMedical') === 'on',
      sample: trip.sample,
      ...(display as Partial<typeof trips.$inferInsert>),
      updatedAt: new Date(),
    }).where(eq(trips.id, tripId))
    await tx.delete(tripDeposits).where(eq(tripDeposits.tripId, tripId))
    if (deposits.length) await tx.insert(tripDeposits).values(deposits.map((d, i) => ({ id: `${tripId}-D${i + 1}`, tripId, sort: i, amount: d.amount, dueDate: d.dueDate, dueDays: daysBefore(d.dueDate) })))
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
    const tripDeps = await tx.select({ amount: tripDeposits.amount, dueDate: tripDeposits.dueDate }).from(tripDeposits).where(eq(tripDeposits.tripId, tripId)).orderBy(tripDeposits.sort)
    const derivedEn = deriveDisplay(trip, 'en', tripDeps)
    const derivedZh = deriveDisplay(trip, 'zh', tripDeps)
    const displayCols = Object.fromEntries(DERIVED_FIELDS.flatMap(f => [[`${f}En`, derivedEn[f]], [`${f}Zh`, derivedZh[f]]]))

    await tx.update(trips).set({
      [`summary${suffix}`]: text(form, 'summary', 4000) || null,
      [`highlights${suffix}`]: list('highlights'),
      [`itinerary${suffix}`]: list('itinerary'),
      [`included${suffix}`]: list('included'),
      [`additionalCosts${suffix}`]: list('additionalCosts'),
      [`notes${suffix}`]: text(form, 'notes', 4000) || null,
      [`requirementsText${suffix}`]: text(form, 'requirementsText', 2000) || null,
      [`inquiryLabel${suffix}`]: text(form, 'inquiryLabel', 100) || null,
      [`difficulty${suffix}`]: difficultyLabels[difficultyValue]?.[locale] ?? null,
      ...displayCols,
      updatedAt: new Date(),
    } as Partial<typeof trips.$inferInsert>).where(eq(trips.id, tripId))
    await tx.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'trip_content_updated', entity: 'trip', entityId: tripId, meta: { locale } })
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
  if (!['draft', 'open', 'closed'].includes(state)) throw new Error('Invalid launch state / 发布状态无效')
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
      const blockers = publishBlockers(trip, await tx.select({ amount: tripDeposits.amount, dueDate: tripDeposits.dueDate }).from(tripDeposits).where(eq(tripDeposits.tripId, tripId)).orderBy(tripDeposits.sort))
      if (blockers.length) {
        throw new Error(`Publish blocked / 无法发布：${blockers.map(b => b.en).join('; ')} | ${blockers.map(b => b.zh).join('；')}`)
      }
      await tx.update(trips).set({ published: true, status: 'open', updatedAt: new Date() }).where(eq(trips.id, tripId))
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

  const result=await transactionDb.transaction(async tx=>{
    const [trip]=await tx.select().from(trips).where(eq(trips.id,tripId)).for('update')
    if(!trip)throw Error('Unknown trip')
    if(trip.status==='cancelled')return {status:'saved',slug:trip.slug} as const
    const active=await lockActiveTripBookings(tx,tripId)
    const revisions = bookingRevisionList(active.map(b => ({ id: b.id, revision: b.paymentRevision })))
    if (form.get('expectedBookings') !== revisions) return {status:'stale',slug:trip.slug} as const
    const facts=await readLockedPaymentFacts(tx,active)
    for(const booking of active) {
      const result=await cancelLockedBooking(tx,booking,facts,'operator_cancelled',reason,actor)
      if(result.status!=='saved')throw Error('Unable to cancel active booking')
    }
    await tx.update(trips).set({status:'cancelled',updatedAt:new Date()}).where(eq(trips.id,tripId))
    await tx.insert(auditLog).values({id:randomUUID(),actorUserId:actor,action:'trip_cancelled',entity:'trip',entityId:tripId,meta:{reason,bookingIds:active.map(b=>b.id)}})
    return {status:'saved',slug:trip.slug} as const
  })
  revalidatePath('/myokim')
  revalidatePath('/invoice/[bookingId]','page')
  revalidateTrip(result.slug)
  revalidatePath(`/portal/trips/${tripId}`)
  return {status:result.status}
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