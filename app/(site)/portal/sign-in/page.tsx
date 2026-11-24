import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import AccountSignIn from '@/components/account-sign-in'

export default async function PortalSignInPage() {
  const session = await auth()
  if (session?.user?.role === 'instructor') redirect('/portal')
  return <AccountSignIn area="portal" />
}
