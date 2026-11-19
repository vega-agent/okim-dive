# Okim Dive — MVP Specification (Website + Booking Portal)

**Version:** 1.0
**Date:** 2026-11-18
**Owner:** Jeff (product owner) · Iris (instructor / business owner)
**Status:** Approved for build — source of truth for the QwenWork-refactor branch
**Extends:** `docs/design/PRD.md` (v0.2). Where this spec and the PRD differ, this spec wins for portal/booking scope.
**Repo rules still apply:** `AGENTS.md`, `CLAUDE.md`, `OKIM-DIVE-VIBE.md`, `CONTENT-REVIEW-CHECKLIST.md`, `BRAND-GUIDE.md`, `DESIGN-SYSTEM.md`.

## 1. Purpose and scope

Okim Dive is Iris's freelance dive business (Tioman, Malaysia): dive courses and overseas dive trips. The MVP turns the existing static marketing site into a production-intent Next.js application with a booking portal, while preserving the approved watercolor editorial design, bilingual content, and accessibility.

**In scope (v1):**
- Public website: home, about, courses, trips (+ trip detail), gallery, contact — migrated to Next.js, design preserved.
- Trip booking: one diver per booking, email magic-link sign-in, external payment with instructor verification, invoice + receipt.
- Instructor portal: inquiries, trips, bookings, payment verification, points ledger, refund-policy editor, settings, preparation checklist, trip-briefing draft workflow.
- Customer area "My Okim": read-only My Trips + My Rewards.
- Okim Points: RM-based transaction ledger (never an editable balance).
- Public refund-policy, privacy, and terms pages; booking-time acceptance.
- Bilingual EN + 简体中文 on all user-facing surfaces, including emails.
- One AI workflow: draft a trip briefing from instructor-approved trip details (manual handoff, see §15).

**Out of scope (v1):** online payments, group/family bookings, course booking (Phase 2: one bookable course), document uploads other than the payment screenshot, embedded AI/cloud agents in the product, headless WordPress CMS, self-service booking changes by customers.

**Production intent:** this is built for real use, not a throwaway demo. Secure sign-in, storage, backups, privacy, and audit trails are in scope even where a demo alone would not need them.

## 2. Architecture and stack (locked)

**Decision:** full migration to Next.js (option A, owner's choice over the recommended separate-app option B). One codebase, one deployable. The finished static design is ported, not redesigned.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | `app/` directory; server components read the DB directly |
| Styling | Existing `styles/styles.css` + `redesign.css` preserved verbatim | No Tailwind rewrite; Tailwind/unused deps removed after parity |
| i18n | Port `site-i18n.js` dictionary approach to a React locale context | EN + 简体中文, same keys/structure where possible |
| Motion | Port `site-motion.js` to a client component | `prefers-reduced-motion` fallback preserved |
| Database | Neon Postgres (free tier) + Drizzle ORM | Standard Postgres + SQL migrations = host-portable |
| Auth | Auth.js (NextAuth) email magic links | No passwords; short expiry; rate-limited; role-gated |
| Email | Resend free tier (3,000/mo, 100/day) + purchased email-only domain (~SGD 15/yr) | Domain used for sending only; site stays on free Vercel subdomain |
| File storage | S3-compatible object storage (Cloudflare R2 free tier) | Payment screenshots only; standard S3 API keeps it portable |
| Hosting | Vercel free tier, `okimdive.vercel.app` | Next server runtime (not static export) |
| PDF | Invoice/receipt PDFs generated on demand from DB records | No PDF storage needed; regenerate from ledger |

**Required config changes during migration:**
- Remove `output: 'export'` from `next.config.js` (server runtime needed for auth/API/DB).
- Replace `vercel.json` static rewrites with Next framework deployment.
- Replace `scripts/verify-static.mjs` build/lint with Next lint/build + Playwright after page parity is verified.
- Keep old static `pages/*.html` until each ported page passes rendered desktop/mobile comparison; then remove.
- Update the "preserve six-page static structure" guardrail in `CLAUDE.md`/`AGENTS.md` to reflect this approved expansion (task in §13).

**Portability rules:** no proprietary KV/D1, no vendor-specific auth lock-in, standard Postgres/S3/SMTP-or-API email. Swapping Vercel↔Cloudflare or Neon↔another Postgres host must remain a config change, not a rewrite.

**One record book:** Postgres is the single source of truth for trips, bookings, customers, payments, and points. Existing `data/trips/*.json` becomes seed data (honest sample labels preserved). No duplicate trip data in frontend code.

## 3. Roles and customer identity (locked)

**Roles:**
- **Instructor (Iris):** full portal access. Sign-in via magic link to an allowlisted instructor email (settings-managed). Iris — not the AI — makes all dive-suitability and safety decisions.
- **Customer (diver):** booking flow + read-only My Okim. Sign-in via emailed magic link; no password, no Customer ID entry.

**Identity model:**
- One customer = one auto-generated, non-editable **Customer ID** (e.g. `CUS-001`), created only after email verification. Many **Booking IDs** (e.g. `BKG-001`) per customer; booking a second trip never creates a second Customer ID.
- Customer ID is permanent even if the diver later changes their verified email.
- Duplicate records are merged only by the instructor, after identity verification — never by name match.
- Okim Points belong to the customer; bank-transfer payments reference the Booking ID.

**Magic-link rules:**
- Single-use, short expiry (15 minutes), rate-limited requests with resend cooldown.
- Link must resume the booking cleanly when opened on a different device/browser than where it started.
- Verification proves mailbox access only — it is not eligibility, payment, or slot confirmation.
- Managed via Auth.js; no hand-rolled token security.

## 4. Trips, currency, and instructor-set rules (locked)

- **Currency is set per trip by Iris** (MYR, SGD, USD, etc.) — the business travels to different countries with different requirements. Iris is based in Malaysia; **RM is the base currency for points calculation** (§7).
- Each trip stores: title, slug, location, status, travel dates, duration, difficulty, group size/capacity, price amount + currency, summary, highlights, itinerary, inclusions, additional costs, notes — bilingual fields, extending the existing `data/trips/_template.json` shape.
- **Iris sets per trip:** deposit type (fixed amount or percentage) + value; balance due (days before departure); eligibility requirements (certification level, minimum logged dives, insurance, medical declaration); cancellation terms reference; minimum participants to run; RM conversion rate used for points.
- Trip statuses: `draft`, `open`, `on_request`, `full`, `departed`, `completed`, `cancelled`. Sample/unverified trips keep an honest `sample` label per the vibe doc — never presented as confirmed offers.
- **Content gate:** prices, dates, availability, deposit/refund rules, and requirements are published only after Iris/Jeff confirmation. Assistant-proposed defaults in this spec are starting points, not verified business facts.
- Courses remain inquiry-only in v1. The booking schema is product-agnostic (`product_type: trip | course`) so Phase 2 can enable one bookable course without a rebuild.

## 5. Booking flow and slot rules (locked)

**One diver per booking.** Group/family bookings are deferred.

**Flow:**
1. Diver opens a trip → "Book this trip" → enters name + email.
2. Magic link sent → diver verifies → Customer ID created (new) or linked (returning).
3. Diver completes booking details: eligibility declarations (cert, dives, insurance, medical, emergency contact), accepts refund policy + terms (version snapshot recorded).
4. Booking created with status `awaiting_deposit`; **invoice issued** (states: slot confirmed only after deposit verification, subject to availability).
5. Diver pays externally (bank transfer/PayNow) using **Booking ID as reference**, then submits a payment claim (§6).
6. Instructor verifies the deposit against the bank app → **availability re-checked at verification** → slot `confirmed`, or `refund_flagged` if the trip filled meanwhile.
7. Balance tracked to the trip's due date; instructor reviews at deadline (grace / chase / cancel — no auto-cancellation).
8. Trip `completed` → earned points become usable (§7).

**Slot-hold rule (owner's decision):** an awaiting-deposit booking does **not** reserve a slot. Another diver can take the remaining space until the instructor verifies the deposit. If the trip filled in the meantime, the payment is still recorded, the booking is not confirmed, and it is flagged for refund or an instructor-agreed alternative (next departure / credit hold) — recorded, with the diver contacted.

**Booking status machine:**
`awaiting_deposit → payment_claimed → deposit_verified → confirmed → completed`
Branches: `refund_flagged` (full after payment), `cancelled` (diver or instructor), `eligibility_declined` (paid-but-ineligible → full refund path).
Eligibility approval (`pending / approved / declined`) is a **separate gate** from payment and slot confirmation.

**Instructor cancellation:** trips can be cancelled (weather, minimum participants not met, operator issues). Cancelling flags all affected bookings for full refund, reverses related points, and notifies divers. Minimum-participants threshold is Iris-set per trip.

**Edge cases handled:** last-slot race (atomic capacity re-check at verification); abandoned bookings after verification (clean up drafts); payment received after departure (record + flag); over/underpayment and wrong-reference transfers (manual matching queue); diver changes email (ID permanent).

## 6. Payments, claims, invoices, receipts (locked)

- **External payments only.** No payment gateway in v1. Payment status is tracked separately from booking status.
- **Payment claim ("I've paid") — required step:** diver submits amount, date paid, transfer reference, and **one screenshot (required)**. This bridges external payment to instructor verification; without it the instructor has no signal to check the bank.
- **Screenshot boundaries:** payment evidence only (no passport/medical/cert uploads). Stored in S3-compatible storage; **instructor-only access**; never visible to other customers. Retention: kept until trip completed + refund window closed, then purgeable; stated on the privacy page. Screenshots may contain bank details — treat as sensitive personal data.
- **Screenshot ≠ verification.** The instructor matches the claim against the bank app and verifies manually. Every verification records who/when (audit trail).
- **Invoice:** one per booking, generated on demand as PDF from DB records. Must state that the slot is confirmed only after deposit verification, subject to availability. Shows trip currency, deposit, balance, due date, any points discount, and Booking ID as payment reference.
- **Receipt:** one per instructor-verified payment (deposit, balance, or full), generated on demand. Links booking + payment + claim.
- **Refunds:** executed externally by Iris, recorded in the portal against the booking/payment; points reversed per §7. Refund reasons: instructor cancellation, trip full after payment, eligibility declined, diver cancellation per policy (§8).
- **Bank details:** Iris's receiving account details are shown to the diver at the invoice/payment step only as needed for transfer, never committed to the repo or logged. (Repo rule: never publish credentials/bank details in code or docs.)

## 7. Okim Points (locked rules, configurable values)

**Name:** Okim Points (supersedes "Dive Credits"). **Base currency: RM** — all points calculation converts to RM regardless of trip currency (owner's decision).

**Ledger, never a balance:** every entry is a transaction of type `earned`, `redeemed`, `expired`, or `reversed`, linked to Customer ID + Booking ID + payment record. The visible balance is always derived from the ledger. No editable balance field exists.

**Earning:**
- Only from **instructor-verified payments**, on actual money paid, **excluding any points-funded discount**.
- Rate: **1 point per RM 1** of the verified payment converted to RM.
- Conversion: payment amount × the trip's **Iris-set RM rate**, snapshotted on the ledger entry (original amount + currency + rate + RM amount all stored). Rate changes never rewrite history.

**Redemption:**
- **100 points = RM 5** equivalent discount on a future booking, converted into the booking's currency at that trip's RM rate at invoice time.
- Cap: **max 20% of the booking price** per booking; one redemption per booking; applied by the instructor at invoice time (no self-service changes in v1).
- Usable **only after the course/trip is completed** — prevents earn-and-burn on cancelled trips.

**Expiry:** 12 months from earning; expired entries recorded as `expired` transactions, never deleted.

**Reversal:** any refund reverses the related earned points via a `reversed` entry (partial refund → proportional reversal). Redemption on a refunded booking is restored via reversal.

**Configurability:** earn rate, redemption value, expiry months, cap %, and default RM rate live in instructor settings. Each ledger entry snapshots the rules applied. "Agree for now, change later" is safe: changing rules is a settings edit, not a migration.

**Loyalty never bypasses trip prerequisites** — points cannot override eligibility or safety gates.

## 8. Refund policy and terms management (locked)

- **Instructor-editable:** Iris edits the refund policy text (EN + CN) in portal settings. It renders on a public `/refund-policy` page, linked from every trip page and the booking form.
- **Versioned:** every edit creates a new policy version. Each booking records the **policy version accepted + timestamp**. Editing the policy later never changes the terms of an existing booking.
- Same versioning applies to privacy policy and terms/waiver acceptance.
- Booking requires explicit acceptance (checkbox) of the current refund policy + terms before the booking is created.

**Default refund tiers (starting point — pending Iris confirmation, editable):**
| Situation | Default outcome |
|---|---|
| Instructor cancels trip | Full refund (deposit + balance); points reversed |
| Trip full after payment verified | Full refund or instructor-agreed alternative; points reversed if refunded |
| Diver paid but eligibility declined | Full refund; points reversed |
| Diver cancels ≥ balance-deadline days before departure | Balance refunded; deposit forfeited (covers boat/admin commitments) |
| Diver cancels < deadline, or no-show | No refund; instructor may offer transfer to a future trip at discretion |

- Balance deadline is Iris-set per trip (§4); the cancellation tier boundary follows that trip's deadline.
- All refunds are executed externally and recorded; the policy page must state how refunds are requested (contact Iris) and typical handling.
- Per the content gate, this default text is **not published until Iris/Jeff confirm it**.

## 9. Eligibility and safety (locked)

- Each trip defines requirements (Iris-set): certification level, minimum logged dives, dive/travel insurance, medical self-declaration, emergency contact / next of kin.
- At booking, the diver declares these and provides emergency contact details. Declarations are stored against the booking.
- **Instructor approval is a separate gate** from payment and slot confirmation: `eligibility_status = pending / approved / declined`. Iris reviews declarations before the trip; a confirmed slot does not imply eligibility approval.
- **Paid but declined → full refund path** (§8), points reversed.
- **Iris — not the AI — makes all dive-suitability and safety decisions.** The AI briefing workflow (§15) drafts text from instructor-approved details only; it never assesses suitability.
- Safety copy follows the vibe doc: calm, capable, reassuring; no guarantees ("risk-free", "safest"); medical/certification claims qualified.
- Minors: minimum age and parental-consent rules are an open item for Iris (§17); v1 booking form includes date-of-birth/age declaration and blocks under-minimum bookings once the rule is set.
- Sensitive data (medical declarations, emergency contacts, screenshots): instructor-only access, minimized collection, retention stated on privacy page, PDPA consent at booking.

## 10. Surfaces and routes

**Public website (migrated, design preserved):**
| Route | Purpose |
|---|---|
| `/` | Home — emotional invitation, featured trip, courses/trips links |
| `/about` | Iris and Okim Dive story |
| `/courses` | Course overview + inquiry (no booking in v1) |
| `/trips` | Trip list from DB; honest sample labels |
| `/trips/[slug]` | Trip detail + "Book this trip" (replaces the static dialog-only flow) |
| `/gallery` | Verified imagery / clearly-labelled illustration |
| `/contact` | Inquiry form → DB `inquiries` table (server action) |
| `/refund-policy`, `/privacy`, `/terms` | Versioned public policy pages |

**Booking + customer area:**
| Route | Purpose |
|---|---|
| `/book/[tripSlug]` | Booking flow: email → magic link → details + declarations + policy acceptance → invoice |
| `/my` | My Okim — read-only My Trips (bookings, statuses, invoices/receipts) + My Rewards (points balance derived from ledger, transaction history) |
| `/api/auth/*` | Auth.js magic-link endpoints |

**Instructor portal (`/portal`, role-gated):**
- Dashboard: upcoming trips, outstanding balances, payment-claim queue, new inquiries.
- Inquiries list (from contact form + course interest), mark handled.
- Trip management: create/edit trips, currency, deposit/balance rules, requirements, capacity, RM rate, status, bilingual content.
- Bookings: per-trip manifest, eligibility review (approve/decline), status transitions, cancellation + refund flagging.
- Payment verification queue: claim details + screenshot, verify/reject with audit trail, issue receipts.
- Points ledger view per customer; apply redemption at invoice time.
- Policy editor (refund/privacy/terms) with versioning.
- Settings: points rules, default RM rate, instructor email allowlist, locale.
- Preparation checklist per trip (extend existing MVP checklist concept).
- **Trip briefing workflow (the one AI feature):** Iris approves trip details → draft briefing produced via QwenWork as a **stated manual handoff** (no embedded AI API in the product) → Iris reviews/edits/appves → approved briefing stored and shared with participants. Draft and approved text both recorded; AI never makes safety decisions.

**My Okim is read-only in v1:** no self-service changes, cancellations, or redemptions — divers contact Iris, who acts in the portal.

## 11. Bilingual requirements (locked — owner: "Include Bilingual in our spec")

- **EN + 简体中文 on all user-facing surfaces:** public pages (already bilingual — preserve), trip detail, booking flow, declarations, policy pages, My Okim, **instructor portal**, and **all transactional emails** (magic link, booking received, invoice, receipt, deposit verified, balance reminder, trip cancelled, refund flagged).
- Extend the existing `site-i18n.js` dictionary approach into a React locale context; keep keys/structure compatible where possible. Locale preference stored per customer; language switcher preserved on public pages and added to portal/My Okim.
- Simplified Chinese must be natural, polished, concise, warm — not word-for-word translation (vibe doc rule).
- Policy editor stores `body_en` + `body_zh` per version; both published together.
- Trip content fields are bilingual; Iris edits both in the portal.
- Any English copy change requires the matching CN update before handoff (repo content gate).
- Emails render in the customer's locale; magic-link emails include both languages if locale unknown.

## 12. Data model outline (Drizzle / Postgres)

Key tables and fields (full DDL written during build; IDs human-readable where diver-facing):

- **auth_users / accounts / sessions / verification_tokens** — Auth.js standard tables; `role` (`instructor` | `customer`) on users; instructor allowlist in settings.
- **customers** — `id` (CUS-xxx), `user_id`, name, email, phone, locale, created_at, `merged_into` (nullable, instructor-only merge).
- **trips** — `id`, slug, status, currency, price_amount, deposit_type (`fixed`|`percent`), deposit_value, balance_due_days, capacity, min_participants, rm_rate, requirements (cert_level, min_dives, insurance, medical), bilingual content fields (title, summary, highlights, itinerary, included, additional_costs, notes), published flag, sample flag.
- **bookings** — `id` (BKG-xxx), customer_id, `product_type` (`trip`|`course`), product_id, status (§5 machine), eligibility_status, policy_version_id, accepted_at, deposit_amount, balance_amount, currency, points_discount_amount, declarations (JSON: cert, dives, insurance, medical, emergency contact, age), created_at, completed_at, cancelled_at, cancel_reason.
- **payment_claims** — id, booking_id, amount, currency, paid_on, reference, screenshot_key (S3), submitted_at, status (`pending`|`verified`|`rejected`).
- **payments** — id, booking_id, claim_id, kind (`deposit`|`balance`|`full`|`refund`), amount, currency, rm_rate, rm_amount, verified_by, verified_at, receipt_no.
- **invoices** — id, booking_id, number, issued_at, points_redemption_id (nullable); PDF regenerated on demand.
- **points_ledger** — id, customer_id, booking_id (nullable), payment_id (nullable), type (`earned`|`redeemed`|`expired`|`reversed`), points, rm_amount, rate_snapshot, rule_snapshot (JSON), expires_at, created_at, note. Balance always derived.
- **policy_versions** — id, kind (`refund`|`privacy`|`terms`), version, body_en, body_zh, effective_at, created_by.
- **settings** — points rules (earn_rate, redeem_value, expiry_months, cap_pct), default_rm_rate, instructor_emails, default_locale.
- **inquiries** — id, name, email, interest (`course`|`trip`|`other`), trip_id (nullable), message, locale, status (`new`|`handled`), created_at.
- **trip_checklist_items** — id, trip_id, label_en, label_zh, done, sort.
- **briefings** — id, trip_id, draft_text, approved_text, approved_by, approved_at, source (`qwenwork-handoff`).
- **audit_log** — id, actor_user_id, action, entity, entity_id, at, meta (JSON). Every payment verification, eligibility decision, policy edit, merge, and refund record lands here.

**Integrity rules:** capacity re-check is atomic at deposit verification; ledger entries are append-only (corrections via reversal entries, never updates/deletes); policy acceptance references an immutable version; screenshot keys are access-controlled server-side.

## 13. Migration plan (static → Next.js, design preserved)

Work happens on branch **`QwenWork-refactor`** (created 2026-11-18). No pushes to `origin` without owner confirmation (remote is `vega-agent/okim-dive`; confirm Jeff's push access).

**Phase M1 — Scaffold:** Next 14 App Router + TS in repo root; move static assets/styles into Next-served locations; remove `output: 'export'`; wire Neon + Drizzle + Auth.js + Resend via env vars (never committed).

**Phase M2 — Port public pages:** convert each of the six HTML pages to React components reusing the existing CSS verbatim; port i18n dictionary + motion; preserve rendered output. Per page: compare desktop + mobile rendering against the static original, run content checklist (EN + CN). Keep old HTML until parity passes.

**Phase M3 — Data-backed content:** import `data/trips/*.json` as seed trips (sample labels preserved); trips list/detail render from DB via server components; retire `trips-data.js` client fetch; contact form → server action → `inquiries`.

**Phase M4 — Auth + booking:** magic-link flow, customer identity, booking flow with declarations + policy acceptance, invoice generation, payment claim + screenshot upload.

**Phase M5 — Instructor portal:** verification queue, bookings/eligibility, trips CRUD, points ledger + redemption, policy editor, settings, checklist, briefing handoff record.

**Phase M6 — My Okim + policies:** read-only customer area; public refund/privacy/terms pages from versioned content.

**Phase M7 — Hardening + cutover:** rate limits, session expiry, audit log, backups (Neon PITR + scheduled export), retention job for screenshots; update Playwright tests (smoke → booking/portal flows); replace `verify-static.mjs` scripts; update `vercel.json`; remove vestigial static files/deps; **update `CLAUDE.md`/`AGENTS.md` structure guardrail** to record the approved expansion; update PRD change log.

**Validation at every phase:** repo lint/build/UI tests + `git diff --check` + rendered desktop/mobile inspection + content checklist. No completion claims from source inspection alone (repo rule).

**Deadline sequencing (video due 23 Nov 2026):** M1–M4 + seed data are the demo-critical path; M5 portal verification queue is the demo's centerpiece; M6–M7 hardening continues after the video if needed, but privacy/terms pages and secure sign-in are demo-required because the build is production-intent.

## 14. Production obligations (in scope, not optional)

- **Privacy/PDPA:** consent checkbox at booking and inquiry; public privacy page (versioned) covering what is collected (name, email, declarations, emergency contact, payment screenshot), why, access (instructor-only), retention, and how to request correction/deletion. Iris is the data controller; contact route for requests.
- **Terms + waiver:** accepted at booking with version snapshot; liability/waiver text confirmed by Iris before publication (content gate).
- **Sensitive data:** medical declarations, emergency contacts, screenshots — instructor-only, encrypted at rest (provider default), never logged, never in repo, retention per §6/§9.
- **Auth security:** single-use short-expiry magic links, request rate limiting + resend cooldown, session expiry, role checks server-side on every portal route, instructor allowlist.
- **Audit trail:** every verification, eligibility decision, refund, merge, policy edit, and settings change recorded (who/when).
- **Backups:** Neon point-in-time recovery + scheduled logical export to owner-controlled storage; restore procedure documented.
- **Secrets:** env vars only (`.env.local`, Vercel env); `.gitignore` verified; no credentials/bank details/tokens in code, docs, or logs (repo rule).
- **Email deliverability:** verify sending domain (DKIM/SPF/DMARC) in Resend; test magic-link delivery to Gmail + Outlook before demo; monitor bounce/complaint rates.
- **Availability/capacity integrity:** atomic slot re-check; no double-confirmation of the last slot.
- **Accessibility:** preserve semantic HTML, contrast, keyboard navigation, touch targets, reduced-motion support across new surfaces (booking forms, portal tables, dialogs).

## 15. Hackathon deliverables and demo (QwenWork × Hashmeta AI OPC Hackathon)

- **Deadline:** 3-minute video demo due **23 Nov 2026**; top-10 live pitch 11 Dec. Judging: Innovation 25%, Feasibility & viability 25%, Use of QwenWork 20%, Demo presentation 15%, Hashmeta-built website 15%.
- **Hashmeta decision (owner's):** Hashmeta AI is dropped — owner refuses recurring platform fees and wants code ownership for production use, accepting the risk to the 15% criterion. **Eligibility question to organizers is still open — send today:** does a self-built site remain eligible, and is the 15% criterion scored zero or does it affect eligibility overall? Do not discover this after building.
- **Use of QwenWork (20%):** QwenWork is the founder's back-end workspace — it builds the site/portal, runs business workflows, and produces the trip-briefing draft. It is **not** an embedded API backend in the product. Any AI use in the demo must be presented as a **stated manual handoff**, not an implied integration.
- **The one AI workflow:** Iris approves trip details in the portal → QwenWork drafts the trip briefing → Iris reviews/edits/approves → approved briefing stored and shared. Demo shows the handoff honestly: approved inputs, AI draft, human approval, published output.
- **Demo data:** real database, fictional-but-realistic records — Iris persona, one featured bookable trip, a handful of customers/bookings across statuses (awaiting deposit, claimed, confirmed, completed with points). Sample/unverified trips keep honest `sample` labels per the vibe doc; no generated artwork presented as verified photography.
- **Demo story arc (3 min):** diver discovers trip → books via magic link → pays externally + submits claim with screenshot → Iris verifies, slot confirmed, receipt issued → points earned → My Okim shows trip + rewards → Iris drafts briefing via QwenWork handoff. Show the instructor portal as the one-person-company operations engine.
- **Two separate projects:** Okim Dive and JFunnel Studio remain separate submissions, connected only by a clearly-labelled manual deliverables handoff (no technical integration).

## 16. Deferred / Phase 2

- **One bookable course** (Phase 2 target, owner's decision): enable `product_type: course` for a single course, with course-specific eligibility/scheduling fields. Schema is already product-agnostic.
- Group/family bookings (multiple divers per booking).
- Online payments / payment gateway.
- Document uploads beyond the payment screenshot (cert cards, passports, medical forms).
- Customer self-service changes (cancel, reschedule, redeem points online).
- Embedded AI/cloud agents inside the product; AI eligibility assessment (never — safety decisions stay with Iris).
- Headless WordPress CMS (existing future doc remains deferred; Postgres + portal already gives Iris self-service content editing, which may remove the need).
- Waitlist automation, marketing campaigns/newsletters (Brevo or Resend broadcasts later), testimonials management.

## 17. Open items — require Iris/Jeff confirmation before publication

Per the repo content gate, none of these are published as fact until confirmed:

1. Actual trip prices, dates, capacity, and inclusions (existing JSON samples are placeholders).
2. Deposit defaults per trip (fixed amount vs %, value) and balance-deadline days.
3. Refund policy final text (EN + CN) — §8 tiers are a starting proposal.
4. Eligibility requirements per trip: cert level, minimum dives, insurance mandate, medical declaration wording, minimum age / parental consent.
5. RM conversion rates per trip (and how often Iris updates them).
6. Points rule values confirmation (1 pt/RM1, 100 pts = RM5, 12-month expiry, 20% cap) — agreed "for now", changeable in settings.
7. Iris's receiving bank/PayNow details (entered in portal settings at runtime, never in repo).
8. Contact details: WhatsApp number, email, response-time expectations.
9. Terms/waiver and privacy policy text (legal review advisable for production).
10. Verified photography for gallery/trips (no generated art labelled as real).
11. Minimum participants to run each trip.
12. Push access to `vega-agent/okim-dive` remote, or fork/branch strategy.
13. Organizer answer on Hashmeta eligibility (§15) — send today.
14. Email domain name choice and purchase (~SGD 15/yr, email-only).

## 18. Validation and handoff checklist (repo rules apply to every change)

- Run `npm run lint`, `npm run build`, `npm run test:ui` (Playwright), and `git diff --check` before handoff. Scripts updated in M7; until then use the repo's current commands.
- Inspect **rendered desktop and mobile** output — not source alone. No completion claims from inspection/tests alone.
- Content changes: run `CONTENT-REVIEW-CHECKLIST.md`; check duplicates, page ownership, unsupported claims, **English and Simplified Chinese**.
- Visual changes: check alignment, wrapping, spacing, contrast, focus, overflow against `BRAND-GUIDE.md` / `DESIGN-SYSTEM.md`; independent UI/UX review for substantial changes.
- New booking/portal flows: test magic-link expiry/resend, cross-device resume, last-slot race, claim→verify→confirm, refund flag + points reversal, policy version snapshot, bilingual emails.
- Security: verify role gates server-side, screenshot access control, rate limits, secrets not committed.
- Record review decisions and open facts per the checklist's review-note format.

## 19. Decision log (this spec's locked decisions)

| # | Date | Decision | Source |
|---|---|---|---|
| 1 | 2026-11-18 | Full migration to Next.js (option A), one codebase; design preserved | Owner, over assistant's option B recommendation |
| 2 | 2026-11-18 | Iris is the instructor and portal user; brand Okim Dive; Tioman, Malaysia | Owner |
| 3 | 2026-11-18 | Currency set per trip by Iris; points calculated in RM | Owner |
| 4 | 2026-11-18 | Deposit/balance/requirements Iris-set per trip; defaults pending confirmation | Owner |
| 5 | 2026-11-18 | Bilingual EN + 简体中文 included across all surfaces and emails | Owner |
| 6 | 2026-11-18 | One record book: Postgres source of truth; JSON becomes seed | Owner |
| 7 | 2026-11-18 | Update PRD + create MVP spec as source of truth; build follows specs | Owner |
| 8 | 2026-11-18 | Work on new branch `QwenWork-refactor`; no push without confirmation | Owner |
| 9 | 2026-11-18 | Buy email-only domain (~SGD 15/yr) + Resend free tier (switched from Brevo after verifying Brevo rewrites free sender addresses and adds branding) | Owner, on assistant's verified recommendation |
| 10 | 2026-11-18 | Payment claim requires screenshot (one image, instructor-only, retention rule); payment evidence only, no other uploads | Owner |
| 11 | 2026-11-18 | Refund policy instructor-editable + public page + versioned acceptance snapshot | Owner |
| 12 | 2026-11-18 | Points rules configurable in settings; ledger snapshots rates/rules; agreed "for now" | Owner |
| 13 | 2026-11-18 | Courses inquiry-only v1; Phase 2 targets one bookable course; product-agnostic schema | Owner |
| 14 | 2026-11-18 | Magic-link auth (Auth.js), one Customer ID per diver, many Booking IDs, instructor-only merge | Earlier agreement, reaffirmed |
| 15 | 2026-11-18 | External payments only; slot confirmed only on instructor deposit verification with availability re-check; unpaid never holds slot | Earlier agreement, reaffirmed |
| 16 | 2026-11-18 | Okim Points ledger (earned/redeemed/expired/reversed), never editable balance; usable after completion; reversed on refund | Earlier agreement, reaffirmed |
| 17 | 2026-11-18 | Hashmeta dropped; eligibility question to organizers outstanding; AI shown as stated manual handoff | Earlier agreement, reaffirmed |
| 18 | 2026-11-18 | Production intent: privacy/PDPA, terms, backups, audit, secure sign-in in scope | Earlier agreement, reaffirmed |

**Change control:** edits to locked decisions require owner approval and a new row here. Iris-confirmation items (§17) are tracked separately and do not block build, only publication.