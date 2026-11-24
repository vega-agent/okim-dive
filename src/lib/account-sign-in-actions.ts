'use server'

import { signIn, isInstructorEmail } from '@/auth'

export async function requestPortalLink(_previous: string, form: FormData) {
  return requestAccountLink(form, '/portal')
}

export async function requestDiverLink(_previous: string, form: FormData) {
  return requestAccountLink(form, '/myokim')
}

async function requestAccountLink(form: FormData, redirectTo: '/portal' | '/myokim'): Promise<string> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'invalid'
  try {
    if (redirectTo === '/portal' && !(await isInstructorEmail(email))) return 'sent'
    const result = await signIn('resend', { email, redirectTo, redirect: false })
    return new URL(result).pathname.endsWith('/verify-request') ? 'sent' : 'error'
  } catch (error) {
    if (error instanceof Error && /EMAIL_(COOLDOWN|RATE_LIMIT)/.test(error.message)) return 'wait'
    return 'error'
  }
}
