'use server'

/**
 * M3: contact form → inquiries table (MVP-SPEC §10, §13).
 * Server-side validation at the boundary; PDPA consent recorded (§14).
 * The raw select value is kept as interest_detail so the portal queue (M5)
 * shows exactly what the diver chose; trip selections link to the trips row.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { inquiries, trips } from '@/db/schema'

export type InquiryResult = { status: 'success' | 'error' }

// Form option values → trip slugs (seeded in scripts/seed-trips.ts).
const TRIP_SLUGS: Record<string, string> = {
  'trip-tioman-island': 'tioman-on-request',
  'trip-sipadan-blue-current-week': 'sipadan-sample',
  'trip-raja-ampat-reef-explorer': 'raja-ampat-sample',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max)

export async function submitInquiry(formData: FormData): Promise<InquiryResult> {
  const name = text(formData, 'name', 200)
  const email = text(formData, 'email', 200)
  const message = text(formData, 'message', 5000)
  const interestRaw = text(formData, 'interest', 100)
  const consent = formData.get('consent') === 'on'

  if (!name || !EMAIL_RE.test(email) || !message || !interestRaw || !consent) {
    return { status: 'error' }
  }

  const groupSizeRaw = text(formData, 'group_size', 10)
  const groupSize = groupSizeRaw ? Number(groupSizeRaw) : null
  if (groupSize !== null && (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 1000)) {
    return { status: 'error' }
  }

  const interest = interestRaw.startsWith('course') ? 'course' : interestRaw.startsWith('trip') ? 'trip' : 'other'
  const locale = formData.get('locale') === 'zh' ? 'zh' : 'en'

  if (!db) return { status: 'error' }

  try {
    let tripId: string | null = null
    const slug = TRIP_SLUGS[interestRaw]
    if (slug) {
      const found = await db.select({ id: trips.id }).from(trips).where(eq(trips.slug, slug)).limit(1)
      tripId = found[0]?.id ?? null
    }

    await db.insert(inquiries).values({
      id: randomUUID(),
      name,
      email,
      interest,
      interestDetail: interestRaw,
      tripId,
      message,
      whatsapp: text(formData, 'whatsapp', 40) || null,
      preferredDates: text(formData, 'dates', 200) || null,
      groupSize,
      certification: text(formData, 'certification', 200) || null,
      locale,
      consentAt: new Date(),
    })
    return { status: 'success' }
  } catch (error) {
    console.error('[contact] inquiry insert failed.', error)
    return { status: 'error' }
  }
}