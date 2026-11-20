/**
 * Customer identity (MVP-SPEC §3): one permanent CUS-xxx per verified email,
 * created only after email verification (called from the Auth.js session
 * callback, which fires post-verify). Many Booking IDs per customer.
 * Server-only.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers } from '@/db/schema'

async function nextCustomerId(): Promise<string> {
  const rows = await db!.select({ id: customers.id }).from(customers)
  const max = rows.reduce((acc, row) => {
    const n = Number(row.id.replace(/^CUS-/, ''))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `CUS-${String(max + 1).padStart(3, '0')}`
}

export async function ensureCustomerForUser(userId: string, email: string, name: string | null | undefined): Promise<string> {
  const existing = await db!.select({ id: customers.id }).from(customers).where(eq(customers.userId, userId)).limit(1)
  if (existing[0]) return existing[0].id

  const displayName = (name ?? '').trim() || email.split('@')[0]
  // Two concurrent first sessions: unique email index prevents duplicates.
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = await nextCustomerId()
    try {
      await db!.insert(customers).values({ id, userId, name: displayName, email, locale: 'en' })
      return id
    } catch {
      const again = await db!.select({ id: customers.id }).from(customers).where(eq(customers.userId, userId)).limit(1)
      if (again[0]) return again[0].id
    }
  }
  throw new Error('CUSTOMER_PROVISION_FAILED')
}

export async function customerByUserId(userId: string) {
  const rows = await db!.select().from(customers).where(eq(customers.userId, userId)).limit(1)
  return rows[0] ?? null
}