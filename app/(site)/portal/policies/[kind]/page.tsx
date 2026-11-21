import { notFound } from 'next/navigation'
import { requireInstructor } from '@/lib/portal-actions'
import { db } from '@/db'
import { policyVersions } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { POLICY_KINDS, type PolicyKind } from '@/lib/policy-kinds'
import PolicyEditor from '@/components/policy-editor'

export const dynamic = 'force-dynamic'
export default async function PolicyEditorPage({ params, searchParams }: { params: { kind: string }; searchParams: { published?: string } }) {
  await requireInstructor()
  if (!db) throw new Error('Database unavailable')
  if (!(POLICY_KINDS as readonly string[]).includes(params.kind)) notFound()
  const kind = params.kind as PolicyKind
  const versions = await db.select().from(policyVersions).where(eq(policyVersions.kind, kind)).orderBy(desc(policyVersions.version))
  const published = searchParams.published && /^\d+$/.test(searchParams.published) ? Number(searchParams.published) : null
  return <PolicyEditor kind={kind} versions={JSON.parse(JSON.stringify(versions))} published={published} />
}