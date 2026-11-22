/**
 * Trip management pure helpers (M5 item 6, TRIP-MANAGEMENT-SPEC).
 * Client-safe: no server imports. Shared by trip actions, portal list and editors.
 *
 * Capacity math follows MVP-SPEC decision #22 (14-day soft hold): active holds
 * (awaiting_deposit) + payment_claimed + deposit_verified + confirmed consume
 * slots. When the hold milestone lands hold_expires_at + sweep, expired holds
 * must be excluded here — keep this the single occupancy definition.
 */

export type Locale = 'en' | 'zh'

/** Statuses that consume a slot (decision #22). Completed trips are history, not occupancy. */
export const SLOT_STATUSES = ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed'] as const

/** Trip-message audience → booking statuses (TRIP-MESSAGES-SPEC #2, view-time filter). */
export type MessageBookingStatus = 'awaiting_deposit' | 'payment_claimed' | 'deposit_verified' | 'confirmed'
export const messageAudienceStatuses = (audience: string): MessageBookingStatus[] =>
  audience === 'all_active'
    ? ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed']
    : ['deposit_verified', 'confirmed']

export function slotsConsumed(bookingStatuses: string[]): number {
  return bookingStatuses.filter(s => (SLOT_STATUSES as readonly string[]).includes(s)).length
}

/** Settings subset the display derivation needs. */
export type TripFacts = {
  currency: string
  priceAmount: string | number
  depositType: string
  depositValue: string | number
  balanceDueDays: number
  capacity: number
  travelStart: string | Date | null
  travelEnd: string | Date | null
}

export type DerivedDisplay = {
  travelDates: string
  duration: string
  costDisplay: string
  costBasis: string
  depositText: string
  balanceText: string
  groupSize: string
}

export const DERIVED_FIELDS = ['travelDates', 'duration', 'costDisplay', 'costBasis', 'depositText', 'balanceText', 'groupSize'] as const

const money = (currency: string, amount: number) =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function utcDate(value: string | Date | null): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Display lines auto-written from Settings facts, in the requested language. */
export function deriveDisplay(facts: TripFacts, locale: Locale): DerivedDisplay {
  const price = Number(facts.priceAmount)
  const depositValue = Number(facts.depositValue)
  const deposit = facts.depositType === 'percent'
    ? Math.round(price * depositValue) / 100
    : Math.min(depositValue, price)
  const balance = Math.round((price - deposit) * 100) / 100
  const start = utcDate(facts.travelStart)
  const end = utcDate(facts.travelEnd)

  let travelDates = ''
  let duration = ''
  if (start && end) {
    const sy = start.getUTCFullYear(), sm = start.getUTCMonth(), sd = start.getUTCDate()
    const ey = end.getUTCFullYear(), em = end.getUTCMonth(), ed = end.getUTCDate()
    if (locale === 'zh') {
      travelDates = sy === ey && sm === em
        ? `${sy}年${sm + 1}月${sd}–${ed}日`
        : `${sy}年${sm + 1}月${sd}日–${ey === sy ? '' : `${ey}年`}${em + 1}月${ed}日`
    } else {
      travelDates = sy === ey && sm === em
        ? `${sd}–${ed} ${MONTHS_EN[sm]} ${sy}`
        : `${sd} ${MONTHS_EN[sm]}${ey === sy ? '' : ` ${sy}`} – ${ed} ${MONTHS_EN[em]} ${ey}`
    }
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
    const nights = Math.max(0, days - 1)
    duration = locale === 'zh' ? `${days}天${nights}夜` : `${days} ${days === 1 ? 'day' : 'days'} / ${nights} ${nights === 1 ? 'night' : 'nights'}`
  }

  const depositText = facts.depositType === 'percent'
    ? locale === 'zh'
      ? `订金 ${depositValue}%（${money(facts.currency, deposit)}）`
      : `Deposit ${depositValue}% (${money(facts.currency, deposit)})`
    : locale === 'zh'
      ? `订金 ${money(facts.currency, deposit)}`
      : `Deposit ${money(facts.currency, deposit)}`

  const balanceText = locale === 'zh'
    ? `尾款 ${money(facts.currency, balance)}，出发前 ${facts.balanceDueDays} 天缴清`
    : `Balance ${money(facts.currency, balance)}, due ${facts.balanceDueDays} days before departure`

  return {
    travelDates,
    duration,
    costDisplay: money(facts.currency, price),
    costBasis: locale === 'zh' ? '每人' : 'per person',
    depositText,
    balanceText,
    groupSize: locale === 'zh' ? `最多 ${facts.capacity} 位潜水员` : `Max ${facts.capacity} divers`,
  }
}

/** Difficulty pill options: value stored is the localized label pair. */
export const DIFFICULTY_OPTIONS = [
  { value: 'beginner', en: 'Beginner', zh: '初级' },
  { value: 'intermediate', en: 'Intermediate', zh: '进阶' },
  { value: 'advanced', en: 'Advanced', zh: '高级' },
  { value: 'all', en: 'All levels', zh: '所有级别' },
] as const

export const CERT_OPTIONS = ['Open Water', 'Advanced Open Water', 'Rescue Diver', 'Divemaster', 'Instructor'] as const

export type TripContent = {
  titleEn: string; titleZh: string
  locationEn: string | null; locationZh: string | null
  summaryEn: string | null; summaryZh: string | null
  highlightsEn: string[] | null; highlightsZh: string[] | null
  itineraryEn: string[] | null; itineraryZh: string[] | null
  includedEn: string[] | null; includedZh: string[] | null
  additionalCostsEn: string[] | null; additionalCostsZh: string[] | null
  notesEn: string | null; notesZh: string | null
  requirementsTextEn: string | null; requirementsTextZh: string | null
  inquiryLabelEn: string | null; inquiryLabelZh: string | null
}

const REQUIRED_CONTENT = ['title', 'location', 'summary', 'highlights', 'itinerary', 'included'] as const
const OPTIONAL_CONTENT = ['additionalCosts', 'notes', 'requirementsText', 'inquiryLabel'] as const
export const CONTENT_TOTAL = REQUIRED_CONTENT.length + OPTIONAL_CONTENT.length

function contentValue(trip: TripContent, field: string, locale: Locale): string | string[] | null {
  const key = `${field}${locale === 'zh' ? 'Zh' : 'En'}` as keyof TripContent
  return trip[key] as string | string[] | null
}

function filled(value: string | string[] | null): boolean {
  if (Array.isArray(value)) return value.some(v => v.trim())
  return Boolean(value && value.trim())
}

/** Completion badge: filled fields out of 10 (6 required + 4 optional). */
export function contentCompleteness(trip: TripContent, locale: Locale): { done: number; total: number; missingRequired: string[] } {
  const all = [...REQUIRED_CONTENT, ...OPTIONAL_CONTENT]
  const done = all.filter(f => filled(contentValue(trip, f, locale))).length
  const missingRequired = REQUIRED_CONTENT.filter(f => !filled(contentValue(trip, f, locale)))
  return { done, total: CONTENT_TOTAL, missingRequired }
}

export type Blocker = { en: string; zh: string }

/** Server-side publish gate (TRIP-MANAGEMENT-SPEC §6): facts + both languages complete. */
export function publishBlockers(trip: TripFacts & TripContent): Blocker[] {
  const blockers: Blocker[] = []
  const price = Number(trip.priceAmount)
  const depositValue = Number(trip.depositValue)
  if (!(price > 0)) blockers.push({ en: 'Set a price above 0', zh: '请设置大于 0 的价格' })
  if (!(depositValue > 0)) blockers.push({ en: 'Set a deposit above 0', zh: '请设置大于 0 的订金' })
  if (trip.depositType === 'percent' && depositValue > 100) blockers.push({ en: 'Deposit percent cannot exceed 100', zh: '订金比例不能超过 100%' })
  if (trip.depositType === 'fixed' && depositValue > price) blockers.push({ en: 'Fixed deposit cannot exceed the price', zh: '固定订金不能超过价格' })
  if (!(trip.capacity >= 1)) blockers.push({ en: 'Capacity must be at least 1', zh: '名额至少为 1' })
  const start = utcDate(trip.travelStart)
  const end = utcDate(trip.travelEnd)
  if (!start || !end) blockers.push({ en: 'Set travel start and end dates', zh: '请设置行程出发和结束日期' })
  else if (end < start) blockers.push({ en: 'End date must be after start date', zh: '结束日期必须晚于出发日期' })
  for (const locale of ['en', 'zh'] as const) {
    const { missingRequired } = contentCompleteness(trip, locale)
    if (missingRequired.length) {
      const names: Record<string, Blocker> = {
        title: { en: 'title', zh: '标题' },
        location: { en: 'location', zh: '地点' },
        summary: { en: 'summary', zh: '简介' },
        highlights: { en: 'highlights', zh: '亮点' },
        itinerary: { en: 'itinerary', zh: '行程' },
        included: { en: 'included items', zh: '费用包含' },
      }
      const list = missingRequired.map(f => names[f][locale]).join(locale === 'zh' ? '、' : ', ')
      blockers.push(locale === 'zh'
        ? { en: `Chinese content missing: ${missingRequired.map(f => names[f].en).join(', ')}`, zh: `中文内容缺少：${list}` }
        : { en: `English content missing: ${list}`, zh: `英文内容缺少：${list}` })
    }
  }
  return blockers
}

export function slugify(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return slug || 'trip'
}

/** Full trip row as passed to client editors (dates ISO-serialized). */
export type SerializedTrip = Omit<TripFacts, 'travelStart' | 'travelEnd'> & TripContent & {
  departureTimezone: string
  travelStart: string | null
  travelEnd: string | null
  id: string
  slug: string
  status: string
  published: boolean
  sample: boolean
  depositType: string
  minParticipants: number
  rmRate: string
  reqCertLevel: string | null
  reqMinDives: number | null
  reqInsurance: boolean
  reqMedical: boolean
  difficultyEn: string | null
  difficultyZh: string | null
  travelDatesEn: string | null; travelDatesZh: string | null
  durationEn: string | null; durationZh: string | null
  costDisplayEn: string | null; costDisplayZh: string | null
  costBasisEn: string | null; costBasisZh: string | null
  depositTextEn: string | null; depositTextZh: string | null
  balanceTextEn: string | null; balanceTextZh: string | null
  groupSizeEn: string | null; groupSizeZh: string | null
  updatedAt: string
}

/** Launch state shown in the portal list, derived without manual status flips. */
export function tripDisplayState(trip: { status: string; published: boolean }, consumed: number, capacity: number):
  { key: string; en: string; zh: string; tone: 'pending' | 'ok' | 'bad' | 'neutral' } {
  if (trip.status === 'cancelled') return { key: 'cancelled', en: 'Cancelled', zh: '已取消', tone: 'bad' }
  if (trip.status === 'draft') return { key: 'draft', en: 'Draft', zh: '草稿', tone: 'neutral' }
  if (!trip.published) return { key: 'closed', en: 'Closed', zh: '已关闭', tone: 'neutral' }
  if (trip.status === 'on_request') return { key: 'on_request', en: 'Inquiries only', zh: '仅接受咨询', tone: 'pending' }
  if (consumed >= capacity) return { key: 'full', en: 'Full', zh: '已满员', tone: 'pending' }
  return { key: 'open', en: 'Open for booking', zh: '开放预订', tone: 'ok' }
}