# Okim Dive — M5 Handoff Brief (instructor portal)

**For a fresh session:** read this file, then `docs/design/MVP-SPEC.md` (v1.1, source of truth), `AGENTS.md`/`CLAUDE.md` guardrails, and `DESIGN-SYSTEM.md` v1.3 §13 (app surfaces) before building.

## State at handoff (2026-11-20)

- Repo: `/Users/jefflee/Documents/AIProjects/okim-dive`, branch `QwenWork-refactor`, checkpoint **dcccea5** (pushed to `ssh://git@github.com/vega-agent/okim-dive.git`; GitHub `main` is still the old static site — never merge without Jeff's confirmation). Working tree clean.
- Done: M1 scaffold, M2 six-page port (parity verified), M3 DB trips + inquiries, home pilot port + motion pass (owner-approved, decision #19), **M4 booking flow** (trip detail, magic-link wizard, declarations + versioned policy acceptance, BKG booking + INV invoice, auth-gated print-ready invoice).
- Email LIVE: Resend key in `.env.local`, domain **okimdive.com verified** (DNS at Vercel), `EMAIL_FROM=Okim Dive <no-reply@okimdive.com>`. Magic links: 15-min single-use, bilingual, 60s cooldown + 5/hr cap (in-memory; M7 makes durable).
- DB: Neon Postgres `restless-mouse-32313871` (production branch). 4 trips: TRP-001 tioman-on-request, **TRP-004 tioman-reef-weekend (status open, sample=true — the demo bookable trip, MYR 1200, 30% deposit, Dec 12–14 2026, capacity 8)**, TRP-002/003 samples. Policies v1 seeded (POL-REFUND/PRIVACY/TERMS-001, demo-approved wording, Iris confirmation pending). Jeff's identity exists: jeff.mailme@gmail.com = instructor role + customer row.
- Vercel CLI authenticated (jefflyt) + Vercel MCP connector installed in QwenWork; deployment not done yet (M7).
- Preview: `npm run start -- -p 3100` (port 3000 taken). Tests: `npm run build` then `npm run test:ui` (79 passing). Lint: `npm run lint`.

## M5 scope (MVP-SPEC §10 portal, §13) — demo-priority order

Video due **23 Nov 2026**; the verification queue is the demo centerpiece. Build in this order; items 6–8 may slip past the video if needed:

1. **Portal shell + role gate** `/portal` — server-side instructor check on every route/action (session.user.role), bilingual EN+CN (useLocale pattern; portal may use solid white cards on Sand per DESIGN-SYSTEM §13).
2. **Payment recording + verification queue** — Iris logs a payment from the WhatsApp evidence (amount, currency, paid_on, reference, kind deposit/balance/full) into `payment_claims`/`payments`; **recording ≠ verification**. Verify act: **atomic capacity re-check** (slot-hold rule: awaiting-deposit never reserves; if trip filled meanwhile → payment recorded, booking `refund_flagged`, diver contacted), else `confirmed`; audit_log who/when; issue receipt (print-ready like invoice). Points earned on verification (see 4).
3. **Bookings list + eligibility gate** — per-trip manifest, declarations view (instructor-only), approve/decline eligibility (separate from payment/slot); paid-but-declined → full refund path + points reversal.
4. **Okim Points ledger** — append-only earned/redeemed/expired/reversed; earn 1pt/RM1 of verified payment × trip rm_rate (snapshot rate + rules on entry); usable only after trip completed; 12-month expiry; reversal on refund; balance always derived. Redemption applied by Iris at invoice time (max 20% cap).
5. **Inquiries queue** — list from contact form, mark handled.
6. **Trips CRUD + settings** — bilingual trip editor (currency, deposit/balance rules, requirements, capacity, rm_rate, status, sample flag); settings: points rules, default RM rate, instructor email allowlist, payment instructions (bank details NEVER in repo — runtime settings only).
7. **Policy editor** — refund/privacy/terms EN+CN, each edit creates a NEW version; bookings keep their accepted snapshot.
8. **Prep checklist + briefing handoff record** — checklist per trip; briefing draft/approved text with source `qwenwork-handoff` (the one AI workflow is a stated manual handoff, no embedded AI).

## Locked rules (do not relax)

- External payments only; Booking ID is the transfer reference; evidence via WhatsApp (decision #20) — **no upload UI**.
- Slot confirmed only on instructor deposit verification with availability re-check; unpaid never holds a slot.
- Eligibility is a separate gate; **Iris, never software, decides dive suitability**.
- Ledger append-only; corrections via reversal entries; policy acceptance references immutable versions.
- Sensitive data (medical declarations, emergency contacts) instructor-only, never logged.
- Bilingual EN+CN on every portal surface and transactional email; content gate: unverified business facts stay labelled sample/draft.
- audit_log row for every verification, eligibility decision, refund, policy edit, settings change.

## Gotchas (learned the hard way)

- **Cookie host:** AUTH_URL and Playwright baseURL must both be `http://localhost:3100` — 127.0.0.1 vs localhost breaks host-only session cookies.
- **Resend rejects @example.com recipients** — E2E test emails use unique `@okimdive.com` addresses (bounces irrelevant; real delivery proven to Jeff's Gmail).
- **E2E magic links without email access:** insert `verification_tokens` row with `sha256(rawToken + AUTH_SECRET)` and open the real `/api/auth/callback/resend?callbackUrl=…&token=raw&email=…` URL (see tests/m4-booking.spec.mjs). No app backdoors.
- Kill stale preview servers before tests/visual checks; Playwright shuts its webServer down after runs.
- Smooth scrolling releases `:hover` mid-transition in tests — hover again after settle. Finished fill-mode CSS animations report identity matrix, and stay in getAnimations() (filter playState==='running').
- Signed-in app surfaces pin customer locale via `data-page-locale` + `data-locale-managed` (DOM dictionary skips them); language event fires on user toggle only.
- Sequential IDs (CUS/BKG/INV) collide under concurrency — insertWithRetry pattern in booking-actions.ts.
- Tool read output can be masked (`[REDACTED]`) — never copy masked text into source; verify against dictionary keys.
- Visual reviewers mislabel shots and full-page captures with fixed navbars fake clipping — verify deterministically (computed styles, contrast math, viewport shots). media_read needs files inside the conversation workspace.
- `drizzle-kit` loads `.env.local` via drizzle.config.ts; schema changes: `npm run db:push`.

## Open items (not build-blocking unless noted)

- Iris confirmations: real prices/dates/capacity, deposit/balance values, final refund/privacy/terms wording, per-trip requirements, WhatsApp number, RM rates (MVP-SPEC §17).
- **Hashmeta-eligibility question to organizers still unsent** (hackathon risk).
- M7: durable rate limits, PDF renderer, backups, retention, cutover, AGENTS/CLAUDE guardrail update, deployment to Vercel.
- Demo data for the video: a handful of customers/bookings across statuses (awaiting deposit, claimed/recorded, confirmed, completed with points) — seed via script, honest sample labels.

## Standing rules

- Never commit/push without Jeff's explicit go-ahead; no merge to main; design changes need his visual approval + a spec change-control row.
- Validate before handoff: lint + build + test:ui + git diff --check + rendered EN/CN desktop/mobile inspection + design audit against DESIGN-SYSTEM.md.