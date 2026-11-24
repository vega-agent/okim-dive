import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

// Read-only browser cases use the retained demo. Only their short-lived session is written.
export async function openReviewSession(page, { customerId = 'CUS-001' } = {}) {
  const base = process.env.PLAYWRIGHT_BASE_URL
  if (!['http://localhost:3100', 'http://127.0.0.1:3100'].includes(base) ||
      process.env.AUTH_URL !== base || process.env.OKIM_DISABLE_EMAILS !== '1') {
    throw new Error('Set matching loopback preview origins and OKIM_DISABLE_EMAILS=1 before running review cases.')
  }
  config({ path: '.env.local', quiet: true })
  const sql = neon(process.env.DATABASE_URL)
  const token = randomUUID()
  const cleanup = () => sql`DELETE FROM sessions WHERE "sessionToken"=${token}`
  try {
    const rows = await sql`INSERT INTO sessions ("sessionToken","userId",expires)
      SELECT ${token},user_id,now()+interval '15 minutes' FROM customers
      WHERE id=${customerId} AND user_id IS NOT NULL RETURNING 1`
    if (rows.length !== 1) throw new Error('Linked review identity unavailable')
    await page.context().addCookies([{ name:'authjs.session-token',value:token,url:base,httpOnly:true,sameSite:'Lax' }])
    return cleanup
  } catch (error) {
    await cleanup()
    throw error
  }
}

export async function withReviewSession(page, run, options) {
  const cleanup = await openReviewSession(page, options)
  try {
    return await run()
  } finally {
    await cleanup()
  }
}
