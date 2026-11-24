import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export async function requirePortalSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'instructor') redirect('/portal/sign-in')
}
