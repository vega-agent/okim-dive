import { localCalendarDate, parseMoneyMinor, validatePaymentSchedule, type StageInput } from './payment-schedule'

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
  balanceDueDate: string | null
  departureTimezone: string
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
export type TripDeposit = { amount: string; dueDate: string | null }

/** Stage IDs in this offer are positions. Reservation gives them booking-specific IDs. */
export function buildTripStages(facts: TripFacts, deposits: TripDeposit[]): StageInput[] {
  const price = parseMoneyMinor(String(facts.priceAmount))
  const stages: StageInput[] = deposits.map((row, i) => ({
    id: 'deposit-' + (i + 1), kind: 'deposit', position: i === 0 ? 1 : 2,
    amountMinor: parseMoneyMinor(row.amount), dueDate: row.dueDate,
  }))
  const final = stages.reduce((remaining, stage) => remaining - stage.amountMinor, price)
  stages.push({ id: 'final', kind: 'final', position: 3, amountMinor: final, dueDate: facts.balanceDueDate })
  const start = utcDate(facts.travelStart)
  if (!start) throw new RangeError('Missing departure date')
  validatePaymentSchedule(price, stages, localCalendarDate(start, facts.departureTimezone))
  return stages
}

export function deriveDisplay(facts: TripFacts, locale: Locale, deposits: TripDeposit[]): DerivedDisplay {
  const price = Number(facts.priceAmount)
  const balance = (parseMoneyMinor(String(facts.priceAmount)) - deposits.reduce((sum, row) => sum + parseMoneyMinor(row.amount), 0)) / 100
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

  const due = (date: string | null) => date ? (locale === 'zh' ? '，截止 ' : ' · due ') + date : ''
  const depositText = deposits.map((row, i) => (locale === 'zh' ? '订金 ' : 'Deposit ') + (i + 1) + ' · ' +
    money(facts.currency, Number(row.amount)) + due(row.dueDate)).join(' · ')
  const balanceText = money(facts.currency, balance) + (balance > 0 ? due(facts.balanceDueDate) : '')

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

export type Blocker = { en: string; zh: string; fields?: string[] }

/** Server-side publish gate (TRIP-MANAGEMENT-SPEC §6): facts + both languages complete. */
export function publishBlockers(trip: TripFacts & TripContent, deposits: TripDeposit[]): Blocker[] {
  const blockers: Blocker[] = []
  const price = Number(trip.priceAmount)
  if (!(price > 0)) blockers.push({ en: 'Set a price above 0', zh: '请设置大于 0 的价格', fields: ['price'] })
  try {
    buildTripStages(trip, deposits)
  } catch {
    blockers.push({ en: 'Set one or two positive deposits within the price. Give each payable stage a later due date before departure.',
      zh: '请设置一至两笔订金，总额不超过行程价格。各笔应付款的截止日期须依次递增，并早于出发日。', fields: ['deposits', 'balanceDueDate'] })
  }
  if (!(trip.capacity >= 1)) blockers.push({ en: 'Capacity must be at least 1', zh: '名额至少为 1', fields: ['capacity'] })
  const start = utcDate(trip.travelStart)
  const end = utcDate(trip.travelEnd)
  if (!start || !end) blockers.push({ en: 'Set travel start and end dates', zh: '请设置行程出发和结束日期', fields: ['travelStart', 'travelEnd'] })
  else if (end < start) blockers.push({ en: 'End date must be after start date', zh: '结束日期必须晚于出发日期', fields: ['travelStart', 'travelEnd'] })
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
        ? { en: `Chinese content missing: ${missingRequired.map(f => names[f].en).join(', ')}`, zh: `中文内容缺少：${list}`, fields: missingRequired.map(f => `content:${f}:zh`) }
        : { en: `English content missing: ${list}`, zh: `英文内容缺少：${list}`, fields: missingRequired.map(f => `content:${f}:en`) })
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
  locationKey: string
  diveSiteEn: string | null
  diveSiteZh: string | null
  airportEn: string | null
  airportZh: string | null
  jettyEn: string | null
  jettyZh: string | null
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
  if (trip.status === 'on_request') return { key: 'on_request', en: 'On request', zh: '按需安排', tone: 'pending' }
  if (consumed >= capacity) return { key: 'full', en: 'Full', zh: '已满员', tone: 'pending' }
  return { key: 'open', en: 'Open for booking', zh: '开放预订', tone: 'ok' }
}