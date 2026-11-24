// Only an explicitly opted-in local preview may suppress email.
export function localEmailsDisabled(): boolean {
  if (process.env.OKIM_DISABLE_EMAILS !== '1') return false
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(process.env.AUTH_URL ?? '').hostname)
  } catch {
    return false
  }
}
