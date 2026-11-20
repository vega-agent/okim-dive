/**
 * M3 seed: data/trips/*.json → Postgres trips table (MVP-SPEC §13, one record book).
 * Run: node scripts/seed-trips.ts   (Node >= 24 strips types natively)
 *
 * - Display strings are preserved verbatim so rendered output matches the M2 port.
 * - CN columns are seeded from the same dictionary the site-i18n runtime uses,
 *   guaranteeing EN/CN parity; missing entries fall back to EN and are reported.
 * - Sample trips keep sample=true + status draft (honest label, never a confirmed
 *   offer). Structured booking fields are parsed from the JSON where stated;
 *   unconfirmed values stay at schema defaults until Iris sets them (portal, M5).
 * - Idempotent: upserts by slug.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import { trips } from '../src/db/schema.ts'
import translations from '../src/lib/translations.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set (check .env.local). Aborting.')
  process.exit(1)
}
const db = drizzle(neon(connectionString))

type TripJson = {
  id: string
  title: string
  location: string
  status: string
  summary: string
  travelDates: string
  duration: string
  difficulty: string
  groupSize: string
  cost?: { amount?: string; basis?: string }
  bookingRules?: { deposit?: string; balanceDue?: string; cancellation?: string; requirements?: string }
  highlights?: string[]
  itinerary?: string[]
  included?: string[]
  additionalCosts?: string[]
  notes?: string
  inquiryLabel?: string
  sample?: boolean
}

// Seed order = current site order (Tioman featured first; demo departure second).
const files = ['tioman-on-request.json', 'tioman-reef-weekend.json', 'sipadan-sample.json', 'raja-ampat-sample.json']
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
const missingZh: string[] = []
const zh = (value: string | undefined | null): string | null => {
  if (value == null || value === '') return null
  const hit = translations[normalize(value)]
  if (!hit) missingZh.push(value)
  return hit ?? value
}
const zhList = (items: string[] | undefined): string[] | null => items?.length ? items.map((item) => zh(item) ?? item) : null

const MONTHS: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
}
function parseTravelDates(text: string): { start: Date | null; end: Date | null } {
  const m = /^([A-Za-z]+) (\d+)–(\d+), (\d{4})$/.exec(text)
  if (!m || !(m[1] in MONTHS)) return { start: null, end: null }
  const [, month, from, to, year] = m
  return {
    start: new Date(Date.UTC(Number(year), MONTHS[month], Number(from))),
    end: new Date(Date.UTC(Number(year), MONTHS[month], Number(to))),
  }
}
function parsePrice(amount: string | undefined): { currency: 'MYR' | 'SGD' | 'USD'; price: string } {
  const m = /(RM|MYR|SGD|USD)\s*([\d,]+(?:\.\d+)?)/.exec(amount ?? '')
  if (!m) return { currency: 'MYR', price: '0' }
  const currency = m[1] === 'RM' || m[1] === 'MYR' ? 'MYR' : m[1] === 'SGD' ? 'SGD' : 'USD'
  return { currency, price: m[2].replace(/,/g, '') }
}

// Stable IDs per slug (display order is sortOrder, not ID).
const TRIP_IDS: Record<string, string> = {
  'tioman-on-request': 'TRP-001',
  'sipadan-sample': 'TRP-002',
  'raja-ampat-sample': 'TRP-003',
  'tioman-reef-weekend': 'TRP-004',
}

const rows = files.map((file, index) => {
  const trip: TripJson = JSON.parse(readFileSync(join(process.cwd(), 'data/trips', file), 'utf8'))
  const sample = trip.sample ?? trip.status === 'Sample trip'
  const status = sample && trip.status === 'Sample trip' ? 'draft' as const
    : trip.status === 'Open' ? 'open' as const
    : 'on_request' as const
  const { currency, price } = parsePrice(trip.cost?.amount)
  const { start, end } = parseTravelDates(trip.travelDates)
  const depositPercent = /(\d+(?:\.\d+)?)%/.exec(trip.bookingRules?.deposit ?? '')
  const balanceDays = /(\d+) days/.exec(trip.bookingRules?.balanceDue ?? '')
  const capacityNumbers = Array.from(trip.groupSize.matchAll(/\d+/g), (m) => Number(m[0]))
  const requirements = trip.bookingRules?.requirements ?? ''

  return {
    id: TRIP_IDS[trip.id] ?? `TRP-${String(index + 1).padStart(3, '0')}`,
    slug: trip.id,
    status,
    currency,
    priceAmount: price,
    depositType: 'percent' as const,
    depositValue: depositPercent ? depositPercent[1] : '0', // 0 = unconfirmed; Iris sets in portal
    balanceDueDays: balanceDays ? Number(balanceDays[1]) : 30,
    capacity: capacityNumbers.length ? Math.max(...capacityNumbers) : 1,
    minParticipants: 1, // unconfirmed (§17); Iris sets per trip
    rmRate: '1', // USD→RM rate unconfirmed (§17); default until Iris sets it in the portal
    reqCertLevel: /advanced certification/i.test(requirements) ? 'advanced' : /open water/i.test(requirements) ? 'open_water' : null,
    reqMinDives: null,
    reqInsurance: /insurance required/i.test(requirements),
    reqMedical: true,
    travelStart: start,
    travelEnd: end,
    titleEn: trip.title,
    titleZh: zh(trip.title) ?? trip.title,
    locationEn: trip.location,
    locationZh: zh(trip.location),
    summaryEn: trip.summary,
    summaryZh: zh(trip.summary),
    sortOrder: index,
    travelDatesEn: trip.travelDates,
    travelDatesZh: zh(trip.travelDates),
    durationEn: trip.duration,
    durationZh: zh(trip.duration),
    difficultyEn: trip.difficulty,
    difficultyZh: zh(trip.difficulty),
    groupSizeEn: trip.groupSize,
    groupSizeZh: zh(trip.groupSize),
    costDisplayEn: trip.cost?.amount ?? null,
    costDisplayZh: zh(trip.cost?.amount),
    costBasisEn: trip.cost?.basis ?? null,
    costBasisZh: zh(trip.cost?.basis),
    depositTextEn: trip.bookingRules?.deposit ?? null,
    depositTextZh: zh(trip.bookingRules?.deposit),
    balanceTextEn: trip.bookingRules?.balanceDue ?? null,
    balanceTextZh: zh(trip.bookingRules?.balanceDue),
    cancellationTextEn: trip.bookingRules?.cancellation ?? null,
    cancellationTextZh: zh(trip.bookingRules?.cancellation),
    requirementsTextEn: trip.bookingRules?.requirements ?? null,
    requirementsTextZh: zh(trip.bookingRules?.requirements),
    inquiryLabelEn: trip.inquiryLabel ?? null,
    inquiryLabelZh: zh(trip.inquiryLabel),
    highlightsEn: trip.highlights ?? null,
    highlightsZh: zhList(trip.highlights),
    itineraryEn: trip.itinerary ?? null,
    itineraryZh: zhList(trip.itinerary),
    includedEn: trip.included ?? null,
    includedZh: zhList(trip.included),
    additionalCostsEn: trip.additionalCosts ?? null,
    additionalCostsZh: zhList(trip.additionalCosts),
    notesEn: trip.notes ?? null,
    notesZh: zh(trip.notes),
    published: true, // all three are on the live site today
    sample,
    updatedAt: new Date(),
  }
})

async function main() {
  for (const row of rows) {
    await db.insert(trips).values(row).onConflictDoUpdate({
      target: trips.slug,
      set: { ...row, updatedAt: new Date() },
    })
    console.log(`seeded ${row.id} ${row.slug} (status=${row.status}, sample=${row.sample}, ${row.currency} ${row.priceAmount})`)
  }

  const count = await db.select({ n: sql<number>`count(*)::int` }).from(trips)
  console.log(`trips table now has ${count[0].n} row(s).`)
  if (missingZh.length) {
    console.warn(`CN dictionary missing ${missingZh.length} string(s) — seeded EN fallback:`)
    for (const value of missingZh) console.warn(`  - ${value}`)
  } else {
    console.log('CN coverage complete (all display strings found in the site dictionary).')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})