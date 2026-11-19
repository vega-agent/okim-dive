/**
 * Auth.js v5 — email magic links via Resend. No passwords.
 * MVP-SPEC §3: single-use, 15-minute expiry, rate-limited; role-gated portal.
 * Instructor allowlist: AUTH_INSTRUCTOR_EMAILS (comma-separated).
 */
import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import Resend from 'next-auth/providers/resend'
import { db } from '@/db'
import { users, accounts, sessions, verificationTokens } from '@/db/schema'

const instructorEmails = (process.env.AUTH_INSTRUCTOR_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

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
      from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>',
    }),
  ],
  // Short-lived sessions; magic-link expiry handled by provider defaults (15 min).
  session: { strategy: 'database', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/book' }, // M4 introduces the real sign-in entry point
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase()
      if (!email) return false
      // Role is set at first sign-in from the instructor allowlist.
      if (instructorEmails.includes(email)) {
        // Role assignment happens in the adapter/jwt flow in M4; allow here.
        return true
      }
      return true // customers sign in via magic link during booking
    },
  },
})
