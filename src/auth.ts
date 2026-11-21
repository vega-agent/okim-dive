/**
 * Auth.js v5 — email magic links via Resend. No passwords.
 * MVP-SPEC §3: single-use, 15-minute expiry, resend cooldown; role-gated portal.
 * Instructor allowlist: AUTH_INSTRUCTOR_EMAILS (comma-separated).
 * Customer identity (§3): CUS-xxx created only AFTER email verification,
 * provisioned in the session callback (database strategy fires post-verify).
 */
import NextAuth, { AuthError } from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import Resend from 'next-auth/providers/resend'
import { Resend as ResendClient } from 'resend'
import { and, eq, gt, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users, accounts, sessions, verificationTokens, settings } from '@/db/schema'
import { ensureCustomerForUser } from '@/lib/customers'

const instructorEmails = (process.env.AUTH_INSTRUCTOR_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// Durable resend cooldown + hourly cap (M5 dry-run fix, owner-approved 2026-11-21).
// Module-level Maps do not survive across server-action invocations in the Next
// production runtime, so the verification_tokens table IS the send ledger:
// each row's expires = sentAt + 15 min, so send-time windows derive from expires.
// Auth.js runs sendVerificationRequest and createVerificationToken in PARALLEL
// (Promise.all), so the current request's row may or may not exist yet — it is
// excluded by its exact expires value. Rejected attempts still leave their row
// and count toward the windows (conservative anti-abuse).
const TOKEN_TTL_MS = 15 * 60 * 1000
const COOLDOWN_MS = 60_000
const HOURLY_CAP = 5

// Auth.js only re-throws AuthError instances to signIn({ redirect: false });
// a plain Error is swallowed and converted into a success redirect.
class MagicLinkRateLimit extends AuthError {
  static type = 'MagicLinkRateLimit'
  constructor(kind: 'EMAIL_COOLDOWN' | 'EMAIL_RATE_LIMIT') { super(kind) }
}

async function checkSendRate(email: string, currentExpires: Date) {
  if (!db) return
  const now = Date.now()
  const cooldownCutoff = new Date(now + TOKEN_TTL_MS - COOLDOWN_MS)
  const hourCutoff = new Date(now + TOKEN_TTL_MS - 3_600_000)
  const others = and(eq(verificationTokens.identifier, email), ne(verificationTokens.expires, currentExpires))
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(verificationTokens)
    .where(and(others, gt(verificationTokens.expires, cooldownCutoff)))
  if (recent.n >= 1) throw new MagicLinkRateLimit('EMAIL_COOLDOWN')
  const [hour] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(verificationTokens)
    .where(and(others, gt(verificationTokens.expires, hourCutoff)))
  if (hour.n >= HOURLY_CAP) throw new MagicLinkRateLimit('EMAIL_RATE_LIMIT')
}

// Bilingual magic-link email (MVP-SPEC §11/§13: both languages when locale unknown,
// Lato, sand/white, one coral CTA, link on its own line).
function magicLinkEmail(url: string) {
  const button = `display:inline-block;background:#e63946;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;`
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f1faee;font-family:Lato,'Noto Sans SC',Arial,sans-serif;color:#264653;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:20px;font-weight:700;margin:0 0 24px;">Okim Dive</p>
    <p style="margin:0 0 8px;">Your sign-in link is ready. It expires in 15 minutes and can be used once.</p>
    <p style="margin:0 0 20px;color:#6c757d;font-size:14px;">你的登录链接已准备好，15 分钟内有效，仅可使用一次。</p>
    <p style="margin:0 0 24px;"><a href="${url}" style="${button}">Sign in to Okim Dive · 登录</a></p>
    <p style="margin:0 0 4px;font-size:14px;">Or open this link:</p>
    <p style="margin:0 0 24px;font-size:14px;word-break:break-all;"><a href="${url}" style="color:#457b9d;">${url}</a></p>
    <p style="margin:0 0 4px;font-size:13px;color:#6c757d;">If you did not request this email, you can safely ignore it.</p>
    <p style="margin:0;font-size:13px;color:#6c757d;">如果你没有请求此邮件，可以放心忽略。</p>
  </div>
</body></html>`
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Vercel is auto-trusted; this keeps local dev and any future host working (portability §2).
  trustHost: true,
  adapter: db
    ? (DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      }) as never)
    : undefined,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>',
      maxAge: 15 * 60, // §3: short expiry
      async sendVerificationRequest({ identifier, url, provider, expires }) {
        const email = identifier.toLowerCase()
        await checkSendRate(email, expires)
        const client = new ResendClient(provider.apiKey as string)
        const { error } = await client.emails.send({
          from: provider.from as string,
          to: email,
          subject: 'Your Okim Dive sign-in link · 你的 Okim Dive 登录链接',
          html: magicLinkEmail(url),
        })
        if (error) throw new Error(`EMAIL_SEND_FAILED: ${error.message}`)
      },
    }),
  ],
  session: { strategy: 'database', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/book' }, // entry page: choose a trip (M4)
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email)
    },
    async session({ session, user }) {
      if (!db) return session
      const email = user.email?.toLowerCase() ?? ''
      // Role from the instructor allowlist (idempotent). Settings-managed
      // (M5 item 6); the env list always keeps access as a safety fallback.
      let storedEmails: string[] = []
      try {
        const [row] = await db.select().from(settings).where(eq(settings.key, 'instructor_emails'))
        const emails = (row?.value as { emails?: unknown } | undefined)?.emails
        if (Array.isArray(emails)) storedEmails = emails.map(e => String(e).toLowerCase())
      } catch { /* settings unreadable — env fallback still applies */ }
      const isInstructor = instructorEmails.includes(email) || storedEmails.includes(email)
      if (isInstructor && user.role !== 'instructor') {
        await db.update(users).set({ role: 'instructor' }).where(eq(users.id, user.id))
      }
      // Customer ID created only after verification (§3); permanent thereafter.
      const customerId = await ensureCustomerForUser(user.id, email, user.name)
      session.user = {
        ...session.user,
        id: user.id,
        role: isInstructor ? 'instructor' : 'customer',
        customerId,
      } as typeof session.user
      return session
    },
  },
})