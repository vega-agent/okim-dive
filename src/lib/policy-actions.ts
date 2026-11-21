'use server'

/**
 * M5 item 7 — versioned policy editor (MVP-SPEC §10/§11/§12).
 * Locked rules: every edit creates a NEW immutable version (both languages
 * published together); bookings keep their accepted version snapshot; audit
 * row per publication. No updates/deletes of existing versions, ever.
 */
import { db } from '@/db'
import { auditLog, policyVersions } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireInstructor } from '@/lib/portal-actions'
import { POLICY_KINDS, type PolicyKind } from '@/lib/policy-kinds'

const MAX_BODY = 50_000

export async function publishPolicyVersion(form: FormData) {
  const actor = await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  const kind = String(form.get('kind') ?? '')
  if (!(POLICY_KINDS as readonly string[]).includes(kind)) throw new Error('Unknown policy kind / 未知政策类型')
  if (form.get('confirm') !== 'on') throw new Error('Confirmation required / 请勾选确认')
  const bodyEn = String(form.get('bodyEn') ?? '').trim().slice(0, MAX_BODY)
  const bodyZh = String(form.get('bodyZh') ?? '').trim().slice(0, MAX_BODY)
  // §11: both languages publish together — never a half-translated policy.
  if (!bodyEn || !bodyZh) throw new Error('Both English and Chinese text are required / 英文与中文内容均须填写')

  const insert = async () => {
    const rows = await db!.select({ version: policyVersions.version }).from(policyVersions)
      .where(eq(policyVersions.kind, kind as PolicyKind)).orderBy(desc(policyVersions.version)).limit(1)
    const version = (rows[0]?.version ?? 0) + 1
    const id = `POL-${kind.toUpperCase()}-${String(version).padStart(3, '0')}`
    await db!.insert(policyVersions).values({ id, kind: kind as PolicyKind, version, bodyEn, bodyZh, createdBy: actor })
    return { id, version }
  }
  let result: { id: string; version: number }
  try {
    result = await insert()
  } catch {
    result = await insert() // (kind, version) unique collision under concurrent publishes
  }
  await db.insert(auditLog).values({ id: randomUUID(), actorUserId: actor, action: 'policy_version_published', entity: 'policy_version', entityId: result.id, meta: { kind, version: result.version } })
  revalidatePath('/portal')
  revalidatePath('/book')
  redirect(`/portal/policies/${kind}?published=${result.version}`)
}