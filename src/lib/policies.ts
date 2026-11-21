// M6: public policy pages read the latest published version per kind
// (MVP-SPEC §8/§10). Versions are immutable; the portal editor publishes new
// ones (policy-actions.ts). Bookings keep their own accepted snapshot.
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { policyVersions } from '@/db/schema'
import type { PolicyKind } from '@/lib/policy-kinds'

export async function latestPolicy(kind: PolicyKind) {
  if (!db) return null
  const [row] = await db.select().from(policyVersions).where(eq(policyVersions.kind, kind)).orderBy(desc(policyVersions.version)).limit(1)
  return row ?? null
}