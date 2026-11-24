import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import PortalSignIn from '@/components/portal-sign-in'

export default async function PortalSignInPage() {
  const session = await auth()
  if (session?.user?.role === 'instructor') redirect('/portal')
  return <PortalSignIn />
}
