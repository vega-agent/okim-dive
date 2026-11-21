# Okim Dive — MVP Specification (Website + Booking Portal)

**Version:** 1.1
**Date:** 2026-11-20
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

**Out of scope (v1):** online payments, group/family bookings, course booking (Phase 2: one bookable course), in-app document uploads of any kind (payment evidence is shared manually via WhatsApp — decision #20), embedded AI/cloud agents in the product, headless WordPress CMS, self-service booking changes by customers.

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
| File storage | Deferred — no uploads in v1 (decision #20) | Payment evidence travels via WhatsApp; Iris records verification in the portal. Cloudflare R2 remains the portable option if in-app uploads return later |
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
4. Booking created with status `awaiting_deposit`; **1 slot held for 14 days** (capped at departure); **invoice issued** showing the exact "pay by" date and that the slot is confirmed once the deposit is verified.
5. Diver pays externally (bank transfer/PayNow) using **Booking ID as reference**, then sends the transfer screenshot to Iris via **WhatsApp** (§6). Iris records and verifies the payment in the portal.
6. Instructor verifies the deposit against the bank app → **availability re-checked at verification** → slot `confirmed`, or `refund_flagged` if the trip filled meanwhile.
7. Balance tracked to the trip's due date; instructor reviews at deadline (grace / chase / cancel — no auto-cancellation).
8. Trip `completed` → earned points become usable (§7).

**Slot-hold rule (decision #22, owner 2026-11-21 — supersedes the "unpaid never holds slot" clause of #15):** a booking request **reserves 1 slot for 14 days** from creation, capped at the trip's departure date: `hold_expires_at = min(created_at + 14 days, travel_start)`. The hold is a promise to the diver — pay the deposit by the shown date and the slot is theirs.

- **Capacity math:** slots consumed = active holds (`awaiting_deposit`, not expired) + `payment_claimed` + `deposit_verified` + `confirmed`. `expired`, `cancelled`, `refund_flagged`, `eligibility_declined` consume nothing. Availability is computed live; when consumed = capacity the trip page shows "Fully booked" and booking is blocked (no manual status flip required).
- **Claim freezes the timer:** once Iris records the payment claim (`payment_claimed`), the hold stops expiring — the slot stays reserved until she verifies or rejects. If she **rejects** a claim, the booking returns to `awaiting_deposit` under the original deadline; if that deadline already passed, the booking expires and the recorded payment goes to the manual matching queue.
- **Expiry:** unpaid at the deadline → status `expired`, slot released immediately. The diver may book again (new Booking ID; the expired record is kept, never deleted).
- **One active booking per customer per trip** (active = awaiting deposit / claimed / confirmed). Duplicate attempts are blocked with a pointer to the existing booking; after expiry/cancel/refund the diver rebooks freely.
- **Verification re-check stays:** the atomic capacity re-check at deposit verification remains (protects against trip cancellation and rejected-then-repaid races). Trip filled meanwhile → payment recorded, booking `refund_flagged`, diver contacted.
- **Iris hold controls (portal):** *Extend hold* (+7 or +14 days, never past departure) and *Release hold* (early cancel, frees the slot, audit-logged with reason, diver emailed). Both act on `awaiting_deposit` bookings.
- **Expiry mechanism:** one idempotent server-side sweep — expires overdue holds, sends the reminder once when a hold enters its final 3 days, sends the expiry notice. Runs on trip/booking/portal page loads and is exposed as a protected API endpoint so M7 can attach a Vercel daily cron without rework. Until then, on zero-traffic days emails wait for the next visitor; slot math is always correct because expiry is also computed live on read. Holds shorter than 3 days skip the reminder (the deadline was already shown at creation).
- **Existing bookings:** backfill `hold_expires_at = min(created_at + 14 days, travel_start)`; already-past holds expire on the first sweep.

**Booking status machine:**
`awaiting_deposit → payment_claimed → deposit_verified → confirmed → completed`
Branches: `expired` (unpaid at the hold deadline), `refund_flagged` (full after payment), `cancelled` (diver or instructor, incl. Iris "Release hold"), `eligibility_declined` (paid-but-ineligible → full refund path).
Eligibility approval (`pending / approved / declined`) is a **separate gate** from payment and slot confirmation.

**Instructor cancellation:** trips can be cancelled (weather, minimum participants not met, operator issues). Cancelling flags all affected bookings for full refund, reverses related points, and notifies divers. Minimum-participants threshold is Iris-set per trip.

**Edge cases handled:** last-slot race (atomic capacity re-check at verification); claim recorded near the deadline (claim freezes the hold); rejected claim after the deadline (booking expires, payment → manual matching queue); abandoned bookings after verification (clean up drafts); payment received after departure (record + flag); over/underpayment and wrong-reference transfers (manual matching queue); diver changes email (ID permanent).

## 6. Payments, claims, invoices, receipts (locked)

- **External payments only.** No payment gateway in v1. Payment status is tracked separately from booking status.
- **Payment evidence is manual (decision #20, owner 2026-11-20):** the diver sends the amount, date paid, transfer reference, and transfer screenshot to Iris via **WhatsApp**. There is **no in-app claim form and no file upload in v1**. Iris matches the evidence against the bank app and **records the payment in the portal** (M5): amount, currency, date, reference, kind (deposit/balance/full), with who/when audit trail. Recording ≠ verification; verification is Iris's explicit act against the real bank record.
- **WhatsApp evidence boundaries:** payment evidence only (no passport/medical/cert documents). Screenshots stay in Iris's instructor-only WhatsApp/business records — never uploaded to the app, never visible to other customers. They may contain bank details — treat as sensitive personal data; the privacy page states that payment evidence is handled this way and how long Iris keeps it.
- **Screenshot ≠ verification.** The instructor matches the evidence against the bank app and verifies manually. Every verification records who/when (audit trail).
- **Invoice:** one per booking, generated on demand as PDF from DB records. Must state the hold deadline ("slot held until &lt;date&gt;") and that the slot is confirmed once the deposit is verified. Shows trip currency, deposit, balance, due date, any points discount, and Booking ID as payment reference.
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
| `/myokim` | My Okim — read-only, tabbed: Upcoming trips (default after login; bookings, statuses, invoices/receipts), Past trips (compact capped rows), Points (balance derived from ledger + transaction history) |
| `/api/auth/*` | Auth.js magic-link endpoints |

**Instructor portal (`/portal`, role-gated):**
- Dashboard: upcoming trips, outstanding balances, payment-claim queue, new inquiries.
- Inquiries list (from contact form + course interest), mark handled.
- Trip management: create/edit trips, currency, deposit/balance rules, requirements, capacity, RM rate, status, bilingual content.
- Bookings: per-trip manifest, eligibility review (approve/decline), status transitions, cancellation + refund flagging; hold countdown per awaiting-deposit booking, **Extend hold** (+7/+14 days, capped at departure) and **Release hold** (early cancel, audit-logged, diver emailed).
- Payment recording + verification: Iris logs payment details from the WhatsApp evidence, verifies against the bank record with audit trail, issues receipts.
- Points ledger view per customer; apply redemption at invoice time.
- Policy editor (refund/privacy/terms) with versioning.
- Settings: points rules, default RM rate, instructor email allowlist, locale.
- Preparation checklist per trip (extend existing MVP checklist concept).
- **Trip briefing workflow (the one AI feature):** Iris approves trip details → draft briefing produced via QwenWork as a **stated manual handoff** (no embedded AI API in the product) → Iris reviews/edits/appves → approved briefing stored and shared with participants. Draft and approved text both recorded; AI never makes safety decisions.

**My Okim is read-only in v1:** no self-service changes, cancellations, or redemptions — divers contact Iris, who acts in the portal.

## 11. Bilingual requirements (locked — owner: "Include Bilingual in our spec")

- **EN + 简体中文 on all user-facing surfaces:** public pages (already bilingual — preserve), trip detail, booking flow, declarations, policy pages, My Okim, **instructor portal**, and **all transactional emails** (magic link, booking received, invoice, receipt, deposit verified, balance reminder, trip cancelled, refund flagged, **hold reminder, hold expired, hold released**).
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
- **bookings** — `id` (BKG-xxx), customer_id, `product_type` (`trip`|`course`), product_id, status (§5 machine, incl. `expired`), eligibility_status, policy_version_id, accepted_at, deposit_amount, balance_amount, currency, points_discount_amount, declarations (JSON: cert, dives, insurance, medical, emergency contact, age), **hold_expires_at** (min(created_at + 14 days, travel_start); extended by Iris), **reminder_sent_at** (once-only guard for the hold-reminder email), created_at, completed_at, cancelled_at, cancel_reason.
- **payment_claims** — id, booking_id, amount, currency, paid_on, reference, screenshot_key (nullable — unused in v1; evidence stays in WhatsApp), submitted_at, status (`pending`|`verified`|`rejected`). In v1 the **instructor** creates these records from WhatsApp evidence (M5); there is no diver-facing claim form.
- **payments** — id, booking_id, claim_id, kind (`deposit`|`balance`|`full`|`refund`), amount, currency, rm_rate, rm_amount, verified_by, verified_at, receipt_no.
- **invoices** — id, booking_id, number, issued_at, points_redemption_id (nullable); PDF regenerated on demand.
- **points_ledger** — id, customer_id, booking_id (nullable), payment_id (nullable), type (`earned`|`redeemed`|`expired`|`reversed`), points, rm_amount, rate_snapshot, rule_snapshot (JSON), expires_at, created_at, note. Balance always derived.
- **policy_versions** — id, kind (`refund`|`privacy`|`terms`), version, body_en, body_zh, effective_at, created_by.
- **settings** — points rules (earn_rate, redeem_value, expiry_months, cap_pct), default_rm_rate, instructor_emails, default_locale.
- **inquiries** — id, name, email, interest (`course`|`trip`|`other`), trip_id (nullable), message, locale, status (`new`|`handled`), created_at.
- **trip_checklist_items** — id, trip_id, label_en, label_zh, done, sort.
- **briefings** — id, trip_id, draft_text, approved_text, approved_by, approved_at, source (`qwenwork-handoff`).
- **audit_log** — id, actor_user_id, action, entity, entity_id, at, meta (JSON). Every payment verification, eligibility decision, policy edit, merge, refund record, hold extension, hold release, and hold expiry lands here.

**Integrity rules:** capacity re-check is atomic at deposit verification; ledger entries are append-only (corrections via reversal entries, never updates/deletes); policy acceptance references an immutable version; screenshot keys are access-controlled server-side.

## 13. Migration plan (static → Next.js, design preserved)

Work happens on branch **`QwenWork-refactor`** (created 2026-11-18). No pushes to `origin` without owner confirmation (remote is `vega-agent/okim-dive`; confirm Jeff's push access).

**Phase M1 — Scaffold:** Next 14 App Router + TS in repo root; move static assets/styles into Next-served locations; remove `output: 'export'`; wire Neon + Drizzle + Auth.js + Resend via env vars (never committed).

**Phase M2 — Port public pages:** convert each of the six HTML pages to React components reusing the existing CSS verbatim; port i18n dictionary + motion; preserve rendered output. Per page: compare desktop + mobile rendering against the static original, run content checklist (EN + CN). Keep old HTML until parity passes.

**Phase M3 — Data-backed content:** import `data/trips/*.json` as seed trips (sample labels preserved); trips list/detail render from DB via server components; retire `trips-data.js` client fetch; contact form → server action → `inquiries`.

**Phase M4 — Auth + booking:** magic-link flow, customer identity, booking flow with declarations + policy acceptance, invoice generation. Payment evidence is manual via WhatsApp (decision #20); Iris records and verifies payments in the M5 portal.

**Phase M5 — Instructor portal:** verification queue, bookings/eligibility, trips CRUD, points ledger + redemption, policy editor, settings, checklist, briefing handoff record.

**Phase M6 — My Okim + policies:** read-only customer area; public refund/privacy/terms pages from versioned content.

**Phase M7 — Hardening + cutover:** rate limits, session expiry, audit log, backups (Neon PITR + scheduled export), retention job for screenshots; update Playwright tests (smoke → booking/portal flows); replace `verify-static.mjs` scripts; update `vercel.json`; remove vestigial static files/deps; **update `CLAUDE.md`/`AGENTS.md` structure guardrail** to record the approved expansion; update PRD change log.

**Validation at every phase:** repo lint/build/UI tests + `git diff --check` + rendered desktop/mobile inspection + content checklist. No completion claims from source inspection alone (repo rule).

**Deadline sequencing (video due 23 Nov 2026):** M1–M4 + seed data are the demo-critical path; M5 portal verification queue is the demo's centerpiece; M6–M7 hardening continues after the video if needed, but privacy/terms pages and secure sign-in are demo-required because the build is production-intent.

## 14. Production obligations (in scope, not optional)

- **Privacy/PDPA:** consent checkbox at booking and inquiry; public privacy page (versioned) covering what is collected in the app (name, email, declarations, emergency contact), why, access (instructor-only), retention, and how to request correction/deletion. Payment screenshots are **not collected by the app** — they travel via WhatsApp and stay in Iris's instructor-only records (§6). Iris is the data controller; contact route for requests.
- **Terms + waiver:** accepted at booking with version snapshot; liability/waiver text confirmed by Iris before publication (content gate).
- **Sensitive data:** medical declarations and emergency contacts — instructor-only, encrypted at rest (provider default), never logged, never in repo, retention per §9. Payment screenshots stay in Iris's WhatsApp records (instructor-only), never uploaded to the app (decision #20).
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
- **Demo story arc (3 min):** diver discovers trip → books via magic link → pays externally + sends the transfer screenshot to Iris via WhatsApp → Iris records and verifies the payment, slot confirmed, receipt issued → points earned → My Okim shows trip + rewards → Iris drafts briefing via QwenWork handoff. Show the instructor portal as the one-person-company operations engine.
- **Two separate projects:** Okim Dive and JFunnel Studio remain separate submissions, connected only by a clearly-labelled manual deliverables handoff (no technical integration).

## 16. Deferred / Phase 2

- **One bookable course** (Phase 2 target, owner's decision): enable `product_type: course` for a single course, with course-specific eligibility/scheduling fields. Schema is already product-agnostic.
- Group/family bookings (multiple divers per booking).
- Online payments / payment gateway.
- Document uploads beyond the payment screenshot (cert cards, passports, medical forms).
- **In-app payment claim form + screenshot upload (Cloudflare R2)** — owner decision #20 (2026-11-20): v1 uses manual WhatsApp evidence; Iris records payments in the portal. Revisit only if the manual flow proves too slow in real use.
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
- New booking/portal flows: test magic-link expiry/resend, cross-device resume, last-slot race, claim→verify→confirm, refund flag + points reversal, policy version snapshot, bilingual emails; hold lifecycle (capacity gate at booking, full-trip block, duplicate-booking block, expiry releases slot, claim freezes timer, rejected-after-deadline → manual matching, extend/release actions, reminder + expiry emails send exactly once, sweep idempotency).
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
| 19 | 2026-11-19 | Home pilot approved: Vega's UI-Refactor immersive-watercolour home (pilot hero, Learn/Return/Explore chooser, Tioman on-request feature, enquiry ending) + courses FAQ disclosures ported into the Next.js app, superseding the verbatim-port rule for these two surfaces only. UI-Refactor branch itself stays unmerged; unified audited footer kept | Owner (Jeff), after visual review of the pilot |
| 20 | 2026-11-20 | Payment evidence manual: diver sends transfer screenshot via WhatsApp; Iris records + verifies payments in the portal; no in-app claim form or uploads; Cloudflare R2 deferred out of v1 | Owner (Jeff) |
| 21 | 2026-11-20 | Policy v1 (refund/privacy/terms) seeded from §8 defaults, owner-approved for demo use; final wording pending Iris confirmation; versioned acceptance snapshots unchanged | Owner (Jeff) |
| 22 | 2026-11-21 | 14-day soft hold: a booking request reserves 1 slot for 14 days (capped at departure); recorded claim freezes the timer; unpaid at deadline → `expired` + slot released; reminder + expiry emails; Iris Extend/Release hold controls; one active booking per customer per trip; full scope before the 23 Nov video. Supersedes #15's "unpaid never holds slot" clause; external payments and verification-time atomic re-check unchanged | Owner (Jeff), "Plan customer booking specs" grilling session |
| 23 | 2026-11-21 | Trip management (M5 item 6) authorized: portal Trips + Settings sections, dedicated editor routes (Settings facts page + Content page with one-language-at-a-time EN/中文 switch), auto-derived display lines with per-line override, launch states Draft/Inquiries/Open/Closed (Full derived live, Closed = unpublish; no new status enum values), cancel cascade (paid → refund_flagged, unpaid → cancelled, bilingual email; NO points action at cancel — reversal stays in refundPayment when Iris records each external refund), duplicate-as-draft, draft-only delete with audit snapshot. Trip capacity checks follow #22 hold math. Settings: points rules, default RM rate, instructor allowlist (settings-managed, env union fallback), payment instructions (runtime only, sample-labelled until Iris confirms). Supersedes the "items 6–8 deferred" clause for item 6 only; items 7–8 remain deferred | Owner (Jeff), trip-management grilling session + M5 item 6 handoff |
| 24 | 2026-11-21 | Unique diver names set during customer setup: customers.name gains a partial unique index on lower(name) WHERE name <> '' ('' = setup pending, many pending may coexist); new customers no longer default to the email prefix; the book page shows a one-field setup card after first sign-in until a unique name is saved (case-insensitive collision → "add a surname or initial"); createBooking renames only when the submitted name is free, never overwriting the setup name or blocking a booking. CUS-001 placeholder reset to pending. m4 tests updated to complete setup; new tests/customer-setup.spec.mjs in the mutations project | Owner (Jeff): "add name as unique so that Iris will not be confused, this is setup during customer setup" |
| 25 | 2026-11-21 | Name capture moved to diver creation (supersedes #24's separate setup page): the booking email step detects new emails (and existing customers with pending names) via checkSignupEmail and shows the name field inline; requestMagicLink validates uniqueness (customers + fresh stashes) and stashes the name in signup_names (email PK, 24h freshness); ensureCustomerForUser applies the stashed name atomically at creation or to an existing pending row. The post-sign-in setup card remains ONLY as a fallback (lost name race / sign-in without a stash). No separate page in the normal flow | Owner (Jeff): "why are we creating a single 'Your name' page? This should be when diver creation if the email entered is detected as new" |
| 26 | 2026-11-21 | Policy editor (M5 item 7) authorized and built: portal Policies section + /portal/policies/[kind] editor with one-language-at-a-time EN/中文 switch (both textareas stay mounted, one submit publishes BOTH languages together per §11); every publish creates a NEW immutable version (POL-KIND-NNN, sequential per kind, insertWithRetry on the unique (kind,version)); confirmation pill required; version history read-only; bookings keep their accepted snapshot (no booking-code change); audit policy_version_published. Public policy pages remain M6 scope — the wizard/invoice consume the latest version automatically. v1 wording stays demo-approved until Iris publishes final wording | Owner (Jeff), "Start item 7 (policy editor) now" |

| 26 | 2026-11-21 | Authorized My Okim exception: editable own diver name, phone, language, self-declared certification agency/level (Not certified, Other), total logged dives only, equipment ownership and approximate sizes. Permanent Customer ID; email changes Iris-assisted; existing onboarding retained. Certification/dives propagate only to upcoming active awaiting-deposit/payment-review/confirmed bookings, reset eligibility pending, audit old/new and alert Iris. No medical approval or slot/payment changes; terminal/departed/completed records unchanged | Owner, diver-profile authorization and Paused—proceed |
| 27 | 2026-11-21 | Booking equipment planning: all 12 checklist items belong exclusively to Bringing my own, May need to rent, Not needed; profile prefill, free moves, Bring all/Rent all/Remove all (never delete)/Reset. Rental sizes profile-prefilled and booking editable; submitted snapshot never overwritten by later profile changes. Edit strictly before departure minus 24h, trip-local timezone displayed; postponement before departure reopens until new cutoff, never departed/completed/terminal. Server ownership checks, old/new audit and Iris alerts. No profile mutation through booking moves | Owner |
| 28 | 2026-11-21 | Rental is a needs-only planning reference, not inventory, reservation, availability/fit/price confirmation, trip requirement or approval/payment system. Cost/payment arranged at dive shop on trip, excluded invoice/balance/points. EN/CN notice required. No automatic rental refund entitlement; Iris decides safe participation/refund individually; refund-policy publication requires Iris approval. No customer cancellation/reschedule/redemption authorized | Owner |

### Diver profile and equipment implementation contract

Checklist: mask, snorkel, fins, boots, wetsuit/exposure suit, BCD, regulator set, dive computer, SMB/DSMB, torch, action camera, Other (short note). Approximate wetsuit/BCD sizes XS–XXL, Other, Unsure; footwear EU/UK/US or Unsure; optional fit note. Profile sizes are saved preferences; booking displays sizes for rental items only. Equipment profile ownership changes alert Iris for pertinent upcoming bookings without changing submitted snapshots.

Required notice: “Rental items are subject to availability at the dive shop. This list indicates your needs only—it does not reserve equipment or confirm availability, fit, or price.” / “租赁装备以潜店实际供应为准。此清单仅说明你的需求，不代表预留装备，也不确认供应、合身程度或价格。”

Read-only statements elsewhere in this specification retain their original meaning except this explicit profile/equipment exception. No other customer actions are authorized. White readable cards on existing watercolor; bilingual compact controls with minimum 44px targets, keyboard access and navbar profile access. Focused additive fields only: customers.diver_profile, bookings.equipment, trips.departure_timezone; no broad schema push or destructive changes.

### M5 authorized change-control decisions (2026-11-21)

- Owner authorizes items 1–5 only; items 6–8 remain deferred. Additive schema changes on the configured Neon production branch are authorized after data inspection; destructive alterations are not.
- Slot confirmation requires aggregate verified cash to meet the required deposit, followed by a locked capacity recheck. Partial deposits do not reserve capacity; balance payments do not consume another slot.
- Earned points are rounded DOWN to whole points separately for each verified payment. Ledger entries snapshot this rule alongside conversion and configured points rules.
- Restored redemption allocations retain their source lot's original expiry. Expired restored lots are unavailable, not renewed.
- These are owner-confirmed business decisions, not visual approval. New portal visual design remains pending owner approval. No commit, push, merge, or deployment is authorized.
- 2026-11-21 portal UX revision (owner request): dedicated Iris watercolor canvas `portal-shallows.webp` (same palette/technique as the public ocean journey, calmer shallow-lagoon composition), solid white data cards per DESIGN-SYSTEM §13, booking/payment dropdown selectors, pill-style payment-kind selection, status badges, sticky portal section nav, and an instructor-only Portal link in the navbar. Financial rules unchanged. **Owner visual approval granted 2026-11-21** ("Instructor page looks good to go").
- 2026-11-21 magic-link rate limiting made durable (owner-approved after live dry run proved the in-memory cooldown/hourly cap ineffective in the production runtime): verification_tokens rows are the send ledger (expires = sentAt + 15 min windows); limits throw AuthError subclasses so signIn({redirect:false}) propagates them; regression tests in tests/rate-limit.spec.mjs drive the real wizard form. Rejected attempts count toward the windows (conservative anti-abuse).
- 2026-11-21 owner decision: public policy pages (/refund-policy, /privacy, /terms — M6) are linked from the **footer only, never the navbar**. M6 (My Okim) workflow/spec design is being driven in the owner's separate chats ("Review booking workflow" owns M6 + integration; "Plan customer booking specs" and "Review diver booking logic" are resolving hold/points/re-entry decisions). This chat (M5) does not start M6 until those decisions land.

### Customer booking hold decisions (2026-11-21, "Plan customer booking specs" chat)

- Owner chose the **14-day soft hold** over the no-hold and manual-hold alternatives; decision #15's "unpaid never holds slot" clause is superseded (row 22). External payments, WhatsApp evidence, and the verification-time atomic re-check are unchanged.
- **Hold clock:** 14 days from the diver's request, capped at departure (trips are often listed more than a year ahead; late bookings get a shorter, honest hold shown on the invoice). The balance-due date remains a separate concept.
- **Claim freezes the timer:** recording a payment claim protects the slot until verify/reject; rejection restores the original deadline (if already past → booking expires, payment to the manual matching queue). Only divers who never pay lose the slot.
- **Emails:** reminder 3 days before the deadline + expiry notice, bilingual EN/CN; holds shorter than 3 days skip the reminder. Expiry notice adapts to remaining availability.
- **Mechanism:** idempotent lazy sweep on trip/booking/portal loads + a protected cron-ready endpoint (Vercel cron attaches at M7). No deployment before the video.
- **Portal controls:** Extend hold (+7/+14 day pills, capped at departure) and Release hold (early cancel, audit-logged with reason, diver emailed) — matching the real WhatsApp conversations; Release doubles as the portal's general cancel-booking action.
- **Duplicates:** one active booking per customer per trip; rebooking after expiry/cancel/refund creates a new Booking ID (expired records kept).
- **Timing:** the full hold scope (schema, capacity gate, invoice/confirmation wording, portal countdown + controls, both emails, sweep) builds **before the 23 Nov video** (owner override of the earlier "core now, automation after" recommendation).
- **Schema:** additive only — `hold_expires_at`, `reminder_sent_at`, `expired` status value; backfill existing awaiting-deposit bookings from `created_at`. Points/re-entry rules owned by the sibling chats are untouched.

### M6 authorized change-control decisions (2026-11-21)

- 2026-11-21 My Okim built per §10 (read-only My Trips + My Rewards, ledger-derived total/available balance, EN/CN pinned locale, §13 app-surface design, dedicated `my-okim-lagoon.webp` watercolor, navbar link for signed-in customers). **Owner visual approval granted 2026-11-21** ("Looks good"), with one revision: the customer area route is **`/myokim`**, not `/my` (owner: `/my` is confusing). Read-only scope unchanged; no commit, push, merge, or deployment authorized.
- 2026-11-21 owner revision (tabbed layout): after login `/myokim` shows **Upcoming trips only** by default; **Past trips** and **Points** are separate tabs. Past trips are compact single rows (title, booking ID, dates, status badge, invoice/receipt record links), newest first, capped at 5 with an explicit "show all" toggle so history never bloats the page. Completed/cancelled bookings are Past; bookings needing attention (awaiting deposit, refund review, eligibility declined) stay on Upcoming. Read-only scope unchanged.
- 2026-11-21 M6 completion (owner-authorized build): public policy pages `/refund-policy`, `/privacy`, `/terms` render the latest published version per kind (immutable versions, EN+CN together, demo notice visible until Iris publishes final wording); links are **footer-only, never navbar** (per the 2026-11-21 owner decision). Cross-part integration test added (tests/m6-integration.spec.mjs, mutations project, zero email sends): portal trip create/publish → diver wizard booking → deposit record/verify + eligibility → completion → My Okim past trip + unlocked points.
- 2026-11-21 owner feedback revision (policy readability + i18n leak): policy bodies render as structured reading text — section headings, bullet/numbered lists, generous line height (plain-text editor format parsed at render; content unchanged). Fixed Chinese leaking into EN surfaces: the signed-in navbar "Profile / 资料" link (added by the booking-setup chat) now uses EN source "Profile" + dictionary key 资料; the `/myokim` equipment cutoff fallback string is locale-conditional. Navbar fits one row at 969–1200px (nowrap + compact gap) with the added signed-in links. Regression tests assert no CJK in EN policy document or navbar (language switcher excepted).
- 2026-11-21 owner revision (Profile tab + equipment placement): `/myokim` has FOUR tabs — Upcoming trips / Past trips / Points / **Profile** (the diver-profile form, deep-linkable via `#profile`). The separate navbar Profile entry is removed (one My Okim entry). Per-booking equipment forms render beside their booking card **on the Upcoming tab only** — never under Past trips or Points (owner: "why is there Equipment under Past Trips and Points?"). Profile-tab form controls get the §4 form treatment scoped to `#my-panel-profile` (borders, radius, full-width, ≥44px, footwear input+unit pair collision-free); sibling components unchanged. Lede reworded: bookings/points read-only, profile self-declared. diver-equipment spec isolated in the mutations project (it publishes a fixture trip) and given two tab-navigation clicks.
- 2026-11-21 design audit pass (owner: "formatting is horrible — audit and update"; design-skill discipline applied WITHIN §3/§4/§13, no new visual language): computed-style + geometry audit across 4 tabs × EN/CN × desktop/mobile. Fixes, all scoped to `.my-okim`: display hierarchy restrained to §3 (h1 36px/Fraunces 500/1.15, panel h2 24px/500, profile h2 28px/500 — was 51.2px/700 marketing scale; CN Noto Serif SC 600); equipment/profile cards normalized to §4 standard card (white, 12px radius, 24–32px padding, tinted shadow); `.booking-card .btn{width:100%}` overridden to content-width (bulk actions were full-width bars; save button 200px, `justify-self:start`); equipment group heads h4 → Lato 700 15.2px (were serif display); booking-card metadata → Body Small driftwood; equipment form controls get §4 borders/radius/focus ring; stat values 40→32px; mobile equipment choice rows stack label-above-select (option text needed 169px in a 157px select — truncation verified by canvas text measurement, fixed to 242px). Audit evidence: /tmp/myokim-audit.json computed-style dump + rendered screenshots; 20 tests re-passed.
- 2026-11-21 i18n leak fix round 2 + nav pills (owner: "Chinese text is leaking over again… why greenish blue pill background?"): the portal "Diver updates" section (booking-setup chat) was server-rendered with hardcoded "EN / 中文" literals (1,686 CJK nodes on EN portal) — moved into client `diver-updates.tsx` on the portal locale hook; `equipment-summary.tsx` made locale-aware; profile language options locale-aware ("Chinese (Simplified)" in EN, 简体中文 in CN). **Visibility bug found by screenshot self-check:** the section sat OUTSIDE `main.portal`, whose fixed watercolor `::before` (isolated stacking context) painted over it — now passed into PortalView via an `updates` prop and rendered inside the container (elementFromPoint-verified). Nav pills removed: `.nav-link-my` / `.nav-link-portal` tinted-pill backgrounds deleted (M5 had pill-marked the instructor link; My Okim copied it) — plain nav links with the standard active underline. Regression scans added: portal EN UI chrome and all four My Okim tabs assert zero CJK (user-entered CN data such as customer names/inquiry messages displays as submitted and is excluded from the scan). 36 tests re-passed.

### M5 item 6 trip management decisions (2026-11-21, trip-management chat)

- **Cancellation cascade (owner: "lets keep it simple… no reverse of points"):** cancelling a trip flags paid bookings (net verified cash > 0) `refund_flagged` and unpaid bookings `cancelled` with reason; the cancel action performs NO points reversal. Earned points stay ledger-recorded but can never become usable (trip never completes); the existing `refundPayment` reverses them proportionally when Iris records each external refund. This refines §5's "reverses related points" wording: reversal happens at refund recording, not at cancellation. Refunds are never auto-recorded — money movement stays Iris's external act (§6).
- **Notification:** bilingual trip-cancellation email built via Resend (customer's stored locale; calm tone, refund next steps, no guarantees), sent after the cancel transaction commits; email failures never undo the cancellation and are audit-logged (`trip_cancel_notified` with sent/failed counts). WhatsApp follow-up remains Iris's manual step.
- **Lifecycle mapping without schema change:** `Full` is derived live from #22 slot math (no manual status flip, per §5); `Closed` = `published=false` with status kept, so existing payments stay verifiable (`verifyPayment` checks status, not published) while new bookings stop (`createBooking` requires published+open). `draft` return is blocked once any booking exists. Cancelled trips are read-only; relaunch = duplicate.
- **Editor structure (grill session, owner-approved):** Settings page holds language-neutral facts; Content page edits one language at a time via an explicit EN/中文 switch independent of UI locale; publish gate requires title/location/summary/highlights/itinerary/included in BOTH languages plus valid facts, enforced server-side. Display lines computable from facts (dates, duration, cost, deposit/balance, group size) are auto-written in both languages at save; per-line Override preserves custom wording across fact changes. Difficulty is a pill selector. Forms start empty with placeholders; "Fill with example (demo)" fills demo content and sets `sample=true`.
- **Edit safety:** slug locks once launched or booked; capacity cannot drop below slots consumed (#22 math: awaiting_deposit + payment_claimed + deposit_verified + confirmed — single definition in `src/lib/trip-display.ts`, to be refined by the hold milestone when `hold_expires_at` lands); warning banner when bookings exist; every mutation audit-logged. Draft delete keeps a full row snapshot in audit meta.
- **Settings:** `points_rules`, `default_rm_rate`, `instructor_emails`, `payment_instructions` runtime rows; instructor allowlist is settings-managed with the env list always unioned as a lockout safety fallback; payment instructions carry `sample:true` until Iris confirms (bank details never in repo); settings audit meta stores the key only (minimization).
- **Test infrastructure:** trip-mutation E2E lives in `tests/m5-trips-lifecycle.spec.mjs`, run by the dependent `chromium-mutations` Playwright project AFTER the public-page projects, because a temporarily published fixture trip races the exact-count `/trips` assertions. Read-only editor rendering checks stay in `tests/m5-trips.spec.mjs` (both viewports).
- **Known pre-existing conflict (not item 6):** `tests/m3-data.spec.mjs` hardcodes 3 trip cards while the demo DB has 4 published trips (TRP-004 published for the M4 booking flow) — fails on a quiet DB independent of item 6; needs the M3/demo-data owner to update the expectation. Concurrent suite runs from sibling chats on the same working tree also intermittently race public-page specs (handoff: do not run both chats in parallel).

**Change control:** edits to locked decisions require owner approval and a new row here. Iris-confirmation items (§17) are tracked separately and do not block build, only publication.