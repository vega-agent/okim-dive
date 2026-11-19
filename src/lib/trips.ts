/**
 * M3: trips read path — Postgres is the source of truth (MVP-SPEC §2, one record book).
 * Server-only: imported by server components/actions, never by client code
 * (client components import the Trip type only, which is erased at compile time).
 *
 * Rendering uses the EN columns; the M2 site-i18n runtime translates the DOM via
 * the same dictionary used to seed the CN columns, so EN/CN output is unchanged.
 * If the DB is unreachable, fall back to the seed JSON files (data/trips/*.json).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { trips } from '@/db/schema'

export type Trip = {
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
}

type TripRow = typeof trips.$inferSelect

// Badge labels match the seed JSON status strings (dictionary-translated in CN).
const STATUS_LABELS: Record<string, string> = {
  draft: 'Planned',
  open: 'Open',
  on_request: 'On request',
  full: 'Full',
  departed: 'Departed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function rowToTrip(row: TripRow): Trip {
  return {
    id: row.slug,
    title: row.titleEn,
    location: row.locationEn ?? '',
    status: row.sample ? 'Sample trip' : (STATUS_LABELS[row.status] ?? row.status),
    summary: row.summaryEn ?? '',
    travelDates: row.travelDatesEn ?? '',
    duration: row.durationEn ?? '',
    difficulty: row.difficultyEn ?? '',
    groupSize: row.groupSizeEn ?? '',
    cost: { amount: row.costDisplayEn ?? undefined, basis: row.costBasisEn ?? undefined },
    bookingRules: {
      deposit: row.depositTextEn ?? undefined,
      balanceDue: row.balanceTextEn ?? undefined,
      cancellation: row.cancellationTextEn ?? undefined,
      requirements: row.requirementsTextEn ?? undefined,
    },
    highlights: row.highlightsEn ?? undefined,
    itinerary: row.itineraryEn ?? undefined,
    included: row.includedEn ?? undefined,
    additionalCosts: row.additionalCostsEn ?? undefined,
    notes: row.notesEn ?? undefined,
    inquiryLabel: row.inquiryLabelEn ?? undefined,
  }
}

async function fromDb(): Promise<Trip[] | null> {
  if (!db) return null
  try {
    const rows = await db.select().from(trips).where(eq(trips.published, true)).orderBy(asc(trips.sortOrder))
    return rows.map(rowToTrip)
  } catch (error) {
    console.error('[trips] DB read failed — falling back to seed JSON.', error)
    return null
  }
}

// Fallback only: same files the seed imports, in site order (Tioman featured first).
const JSON_FILES = ['tioman-on-request.json', 'sipadan-sample.json', 'raja-ampat-sample.json']
function fromJson(): Trip[] {
  try {
    return JSON_FILES.map((file) => JSON.parse(readFileSync(join(process.cwd(), 'data/trips', file), 'utf8')) as Trip)
  } catch (error) {
    console.error('[trips] JSON fallback failed.', error)
    return []
  }
}

export async function getTrips(): Promise<Trip[]> {
  return (await fromDb()) ?? fromJson()
}