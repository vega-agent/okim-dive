# Multiple deposit workflow implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for sequential execution, or superpowers:subagent-driven-development if the owner selects delegated implementation. Steps use checkboxes for tracking. Shared financial interfaces and files must be implemented sequentially, not concurrently. No automatic commits.

**Goal:** one or two deposits plus a final payment, with one Record payment action and consistent received/outstanding figures across instructor and diver screens.

**Architecture:** persist agreed booking schedules and append-only financial events; derive current balances with one pure shared calculator. Record payment allocations and receipt-time summaries atomically so later refunds cannot rewrite old receipts. Keep the existing Next.js routes, cards, dialogs and Neon/Drizzle connections.

**Tech stack:** existing Next.js 14, React 18, TypeScript, Drizzle/Postgres and Playwright. No new payment provider, general-purpose instalment engine or test framework.

**Spec:** [workflow](MULTI-DEPOSIT-FLOW-SPEC.md), [UI proposal](MULTI-DEPOSIT-UI-PROPOSAL.md), [deep audit](MULTI-DEPOSIT-PAYMENT-AUDIT.md), [final check](MULTI-DEPOSIT-FINAL-CHECK.md).

**Status:** Tasks 0–7 passed their implementation gates. The owner approved the hosted migration and the separate fixture replacement. Task 8 technical verification passed on 24 November 2026. Owner visual acceptance remains open. See the [execution log](MULTI-DEPOSIT-EXECUTION-LOG.md) and [review guide](MULTI-DEPOSIT-REVIEW-FIXTURES.md). Policy publication, the full shared-service suite, commit, push and deployment each require separate authorization.

## Locked completion rule — owner approved 2026-11-23

A booking must be fully paid after its points discount before Iris can mark it completed. Keep the existing ended-trip, individual participation and eligibility/status checks; full settlement is an additional server-side condition, not an automatic completion trigger. Completion awards points once from eligible net verified cash. No new receipts are accepted after completion through the normal payment action; existing explicit refund/correction handling remains.

## Global constraints

- One required deposit, optional second deposit, final payment; maximum two deposits. Absolute calendar dates. No age-of-trip-specific rules.
- Booking reserves capacity; full deposit 1 confirms it. Cancellation/release is manual. No expiry, extension buttons or T-3 reminder workflow.
- Points discount only reduces final payment; cap at final amount and 20% of original price, also respecting any lower configured cap. Apply once, before any payment. Earn on individual completion only; spent points never restored.
- Diver withdrawal/nonpayment/no-show retains paid deposit portions; paid final portions refundable. Operator cancellation/postponement exit refunds all paid money.
- One booking lifecycle email; all later information on-platform. Sign-in mail remains separate. Test sends must be stubbed/suppressed.
- All present data is test data. This removes the need for permanent legacy logic, not the need to identify migration/reset targets. No blanket deletion.
- Respect AGENTS.md, CLAUDE.md, latest design system including amendments #47–49/v1.31–1.33, existing uncommitted edits and root ownership notes. Re-read current versions at execution time.
- All app copy EN/CN one language at a time. Reuse current tabs/cards, white editor actions, sticky header, inline blocker dots, native dialogs and 44px controls. Mobile stacks rows, never horizontally scrolls the schedule.
- No shared 3100 rebuild during another run. Isolated build directory does not isolate the database. Full suite and shared-service side effects retain owner gates.

## Review focus

Each case has a test in the tasks below:

1. Confirmed diver pays again on a full trip: keep their place; do not count it twice (Task 4).
2. Retry after a successful save versus a second intentional payment: replay one result without duplicating money, allow the second payment (Task 4).
3. A payment spans Deposit 2/final then is partly refunded: refund only eligible portions and preserve the original receipt (Tasks 1, 5, 7).
4. Browser timezone, backdated bank date and mutable trip dates: preserve agreed deadlines and receipt allocations (Tasks 1–3, 7).
5. Cancelled booking with outstanding refund: release place, waive future payments, keep refund task visible until settled (Tasks 5–7).

## File boundaries and interfaces

Create these focused modules; do not split the entire existing portal merely to implement this change:

| File | Responsibility |
|---|---|
| `src/lib/payment-schedule.ts` | Pure date/money validation, allocation and summary types/calculations; no DB/Next imports |
| `src/lib/payment-queries.ts` | Batched reads and mapping DB facts into the shared summary; no mutations |
| `src/lib/payment-actions.ts` | Record payment, cancellation and refund transaction orchestration; structured results |
| `src/components/payment-schedule.tsx` | Locale-aware compact schedule, totals and points adjustment reused by portal/My Okim/booking |
| `src/components/record-payment-dialog.tsx` | One payment intent, editable prefilled fields, preview, pending/error/success handling |
| `scripts/migrate-payment-schedule.ts` | Explicit dry-run/apply migration with target checks and report; no schema push |
| `tests/payment-unit/`, `playwright.payment-unit.config.mjs` | Pure tests, no browser/server/DB |
| `tests/multi-deposit.spec.mjs`, `playwright.payment.config.mjs` | Targeted rendered/transaction tests against a deliberately started isolated preview |

Existing actions/pages stay where they are unless listed below. Route all payment writes through the new transaction helpers; do not leave legacy action paths bypassing validation.

### Shared types (names are the cross-task contract)

All money in calculator inputs/outputs is safe integer minor units. SQL numeric strings convert at the boundary with `parseMoneyMinor(value: string): number`; reject extra decimals, negatives where forbidden and unsafe integers.

- `StageKind = 'deposit' | 'final'`.
- `StageInput = { id: string; position: 1 | 2 | 3; kind: StageKind; amountMinor: number; dueDate: string | null }` (ISO date-only; null only for zero final).
- `AllocationInput = { paymentId: string; stageId: string; amountMinor: number; direction: 'received' | 'refunded' }`.
- `CancellationKind = 'diver_withdrawal' | 'nonpayment' | 'no_show' | 'operator_cancelled' | 'postponement_declined'`.
- `StageSummary` extends StageInput with `discountMinor`, `payableMinor`, `receivedMinor` (net allocated cash), `outstandingMinor`, `state: 'paid' | 'upcoming' | 'due' | 'overdue' | 'waived'`.
- `BookingPaymentSummary = { bookingId; revision; currency; originalPriceMinor; discountMinor; payableMinor; grossReceivedMinor; refundedMinor; netReceivedMinor; outstandingMinor; stages: StageSummary[]; nextStageId: string | null; suggestedAmountMinor; refundEntitlementMinor; refundBaselineMinor; refundOutstandingMinor }`. Identifiers/currency are strings; revision/all monetary fields are integers.
- `summarizeBooking(input: { bookingId: string; revision: number; currency: string; originalPriceMinor: number; discountMinor: number; stages: StageInput[]; allocations: AllocationInput[]; today: string; cancellationKind: CancellationKind | null; refundEntitlementMinor: number; refundBaselineMinor: number }): BookingPaymentSummary`.
- `previewPayment(summary: BookingPaymentSummary, amountMinor: number): { allocations: { stageId: string; amountMinor: number }[]; remainingMinor: number }` rejects <=0 and > outstanding.
- `localCalendarDate(now: Date, timeZone: string): string`; dates become overdue the day after their date, using snapshotted trip timezone.
- `loadPaymentSummaries(bookingIds: string[]): Promise<Map<string, BookingPaymentSummary>>`: batch selects; empty list returns empty map. Use the same mapper with records already loaded by portal/My Okim rather than querying them twice.
- `recordBookingPayment(form: FormData): Promise<PaymentActionResult>` where result is success `{status:'saved', paymentId, receiptUrl, summary}` or `{status:'stale', summary}` or `{status:'error', messageKey}`. Server actions exposed to clients perform authentication and validation themselves.

Stage state is about money/date; booking confirmation is separate. Fully paid but future trips remain confirmed. On cancellation outstanding becomes zero, unpaid stages are waived, and refund outstanding is presented separately. Show gross received/refunded/net separately whenever refunds exist; do not label net cash as gross received.

## Task 0 — Establish a safe execution baseline

**Files:** repository rules, root sibling notes, latest source and plan; no product edits yet.

- [x] Run `git status --short`; inspect active sessions and latest ownership notes. Record baseline diff/file list privately without credentials. Confirm shared work has been handed off or coordinate overlapping files before editing.
- [x] Read workflow/spec/proposal/audit and latest design-system §13/§14. Preserve newer concurrent changes. Branch observed during planning was `QwenWork-refactor`, not a promise of the next session's state.
- [x] Establish an isolated build workspace/port and a test database strategy. Prefer disposable/local Postgres for financial tests; if only the shared Neon database is available, use bounded unique fixtures with explicit test-run authorization and cleanup. Do not provision an external branch or install infrastructure without assessing required permissions.
- [x] Record the exact migration target from configuration without printing connection strings. Hosted metadata was checked on 2026-11-23; refresh only necessary metadata before applying DDL. No `db:push`, truncate prompts or fixture purge.

**Exit:** writable source boundary, test target and protected existing work are identified. Database writes wait until Task 2's concrete migration is reviewable and authorized.

## Task 1 — Pure payment calculator and zero-service tests

**Files:** create `src/lib/payment-schedule.ts`, `tests/payment-unit/payment-schedule.spec.ts`, `playwright.payment-unit.config.mjs`.

- [x] Configure Playwright test runner with testDir `tests/payment-unit`, workers 1, no webServer/global setup/project dependencies; tests import only pure TS helpers and use no browser fixture.
- [x] Write failing table tests using price 300000, D1 50000, D2 70000, final 180000, discount 15000. After receipts 50000 + 40000, assert D1 outstanding 0, D2 30000, final 165000, total outstanding 195000. Preview 50000 => D2 30000/final 20000, remaining 145000. Run red once.
- [x] Implement the shared types/helpers. Discount adjustment belongs solely to final; allocations settle earliest unpaid stage. Require positive deposits, at most two, sum <= price. Strictly ascending nonzero-stage dates before departure; allow past dates. Draft editor may retain incomplete dates, but publishing/booking must validate.
- [x] Test one deposit, optional second omitted, zero final, zero/negative/excess payment, fractional-cent rejection, configured lower discount cap, expired points exclusion reserved for Task 5 action-layer tests, date boundary in Asia/Kuala_Lumpur versus UTC, and cancelled unpaid amounts waived.
- [x] Test cancellation entitlement from allocation portions: D1 50000 + D2 70000 + final paid 30000 => diver refund 30000; operator refund 150000; after refund 10000 remaining entitlement 20000/140000 respectively. Never double-count previous refunds. Regression: final portion originally paid 30000, already refunded 10000 before cancellation => entitlement at cancellation 20000, baseline all prior booking refunds 10000; outstanding remains 20000 until new refunds occur. Calculate refund outstanding as entitlement minus (total refunds minus baseline), clamped at zero; source eligibility is still capped independently.
- [x] Run `npx playwright test --config=playwright.payment-unit.config.mjs`; all pass with zero services.

**Exit:** deterministic money/date contract used by subsequent tasks. No persisted editable balance.

## Task 2 — Schema and explicit test-data transition

**Files:** modify `src/db/schema.ts`; create `scripts/migrate-payment-schedule.ts`, `tests/payment-unit/migration-report.spec.ts` (pure report validation), create `src/db/migrations/20261123_payment_schedule.sql`.

Concrete proposed schema (additive first; keep obsolete fields temporarily until all callers migrate):

- `trip_deposits.due_date date` nullable for drafts. Add unique `(trip_id, sort)` and check sort in (0,1) after preflight proves existing data fits; do not silently discard a third row.
- `trips.balance_due_date date` nullable for drafts/zero final.
- `bookings.original_price_amount numeric(10,2)`, `departure_timezone text`, `payment_revision integer NOT NULL DEFAULT 0`, `cancellation_kind text`, `refund_entitlement_amount numeric(10,2)`, `refund_baseline_amount numeric(10,2)`, `request_operation_key text UNIQUE`, `acknowledgment_attempted_at timestamptz`; use existing cancel_reason/cancelled_at. New bookings require price/timezone in app and DB once transition is complete.
- `booking_stages`: id PK, booking_id FK, position int 1..3, kind deposit/final, amount numeric(10,2), due_date date; unique `(booking_id,position)`, unique final per booking, deposit positions 1/2, final position 3. Final zero permitted; positive amounts require dates. Cross-row sums/order validated transactionally.
- `payment_allocations`: payment_id FK, stage_id FK, amount numeric(10,2) >0, primary key `(payment_id,stage_id)`. Payment kind refund determines direction; source_payment_id retains refund source. Application verifies stage belongs to same booking and refund portion <= remaining original allocation.
- `payments.receipt_snapshot json` stores immutable stage labels/amounts allocated by THIS payment plus paid/remaining totals at recording; include schema version and actual paid date. Existing payments may be nullable until explicitly transitioned.

- [x] Implement default read-only dry-run: report table/column/index differences, counts of invalid schedules, >2 deposit rows, orphaned/ambiguous payment sources, missing trip dates and affected fixture IDs. Do not expose personal details or credentials.
- [x] Build bounded migration SQL and a transaction/backup procedure. Require explicit `--apply` and exact reviewed target; environment-file presence alone must not trigger writes. Preserve accounts/policies/settings and unrelated tables.
- [x] Derive trip due dates from existing day offsets in trip timezone where valid; leave incomplete drafts incomplete. Existing test bookings may be converted to a D1/final snapshot using THEIR stored deposit/balance and discount, not today's trip price. Original price = stored deposit + stored balance + discount. This is a one-time test-fixture transition, not a legacy runtime engine.
- [x] Allocate existing verified test payments deterministically by claim submitted_at, then payment id; derive refund allocations against original sources. Generate receipt snapshots explicitly marked in migration audit as reconstructed test fixtures. If cancellation category/date/source is ambiguous, stop that transition and report exact IDs—do not fabricate facts. Resolve with a reviewed fixture manifest or separately authorized scoped reset.
- [x] Test migration on disposable DB first: apply twice, second apply no changes; injected mid-transition failure rolls back; all existing money sums remain identical. Capture affected-ID/count and cleanup receipts.
- [x] Apply to shared target only after concrete migration/data treatment is approved and other sessions are quiet. Keep previous app stopped during incompatible cutover; do not serve half-migrated behavior. Drop obsolete columns only in a later separately reviewed cleanup, not this rollout.

**Exit:** database and Drizzle agree, new fixtures can represent two deposits; no unaccounted changes/deletions. Production compatibility layer is intentionally absent.

## Task 3 — Trip schedule editing and atomic booking

**Files:** `src/lib/trip-actions.ts`, `trip-display.ts`, `booking-actions.ts`, `src/components/deposit-editor.tsx`, `trip-settings-editor.tsx`, `trip-content-editor.tsx`, `trip-detail.tsx`, `app/(site)/trips/[slug]/page.tsx`, `app/(site)/book/[tripSlug]/page.tsx`; tests `tests/multi-deposit.spec.mjs`.

- [x] Establish `playwright.payment.config.mjs` now, using the guarded settings described in Task 8, before any integration runs. Name test groups `schedule`, `booking`, `payments`, `refunds`, `ui`, `documents`. Each task runs only its group on an explicitly prepared server, for example `PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test --config=playwright.payment.config.mjs --grep "schedule|booking"`. Migration rehearsal is a separate SQL test, not dependent on the UI server.
- [x] Add tests: valid D1/D2/final publishes; third deposit, same-day/reversed dates, dates on/after departure and excessive deposits rejected; incomplete draft saves; past deposit dates allowed; zero final needs no deadline. Read-only derived content preview matches public schedule.
- [x] Replace due-days inputs with absolute date inputs and named stages; optional Deposit 2 only. Preserve latest blocker/translation/sticky-head behavior. Derive final amount live; date and schedule validation server-side as well as in UI. Duplicate copies complete schedule.
- [x] Refactor createBooking into a transaction: lock trip, check capacity and duplicate active booking, verify accepted policy versions, insert booking + schedule snapshot + invoice record + acceptance audit together. Use audit action `booking_policy_accepted` with meta `{refundVersionId, termsVersionId, acceptedAt, depositsNonRefundableAcknowledged:true}`; retain bookings.policy_version_id as the refund reference, with no fabricated terms column. The wizard creates one request operation key per booking intent and retains it through retries; return the original booking for an identical replay (same customer/trip/accepted input fingerprint recorded in audit), reject reuse for a different request. Do not rely only on active-booking uniqueness to identify a successful retry. One consistent lock order for affected mutations: trip → customer(s sorted by ID) → booking(s sorted by ID); update existing actions to avoid conflicting order. No external send inside transaction.
- [x] Snapshot price, currency, timezone and dates. Keep zero final row for clear discount boundary and display; no payment is requested for it. Do not allow edit of existing booking stages via trip settings.
- [x] Test two simultaneous attempts for the last place: exactly one succeeds. Failure inserting schedule rolls back booking/invoice. Later trip price/date edits leave existing booked schedule unchanged.

**Exit:** real one/two-deposit schedules exist from setup through booking, with atomic capacity reservation.

## Task 4 — Shared reads and one safe payment action

**Files:** create `src/lib/payment-queries.ts`, `payment-actions.ts`; modify `seamless-actions.ts`, `portal-actions.ts`, `app/(site)/portal/page.tsx`, `app/(site)/myokim/page.tsx`; tests pure + targeted integration.

- [x] Implement batched summary loader and mapper; portal uses existing fetched payments/claims where possible. Fetch only authorized booking records for divers. No per-row query loop or client-only source of truth.
- [x] Implement recordBookingPayment inputs: bookingId, operationKey, expectedRevision, amount, paidOn. Currency/reference/actor are derived, not trusted form inputs. Under consistent locks, check existing operation first; replay identical booking/amount/date intent, reject changed payload. Then compare revision; return stale summary instead of silently reallocating changed data.
- [x] Recompute summary, validate amount against current outstanding, record verified claim/payment + allocations + receipt snapshot + audit, increment revision and confirm only when D1 fully settles. Already confirmed bookings retain their seat; do not apply full-trip/departure eligibility checks as though they were new bookings. Reject new receipts for cancelled bookings through this normal action; reject receipts for completed bookings as well; full settlement is now required before completion; retain existing explicit correction/refund path.
- [x] Return structured errors/success. Revalidate portal, My Okim, trip availability and relevant documents after commit. No confirmation/receipt email. Existing record/verify exports must delegate to compatible validated helpers or be retired with callers/tests; no alternate financial bypass.
- [x] Tests: partial D1; combined D2/final; overpayment rejected; full-trip confirmed diver pays without refund flag; identical retry returns same payment/receipt; changed retry payload rejected; new key permits second payment; competing submissions with same revision yield one save and one stale result; no duplicate financial rows.

Run targeted `--grep "payments"` with the Task 3 harness; pure suite stays zero-service.

**Exit:** payment writes and all read views use the same accounting logic; transaction defects from the audit have regression coverage.

## Task 5 — Points, cancellation, refunds and postponement

**Files:** `payment-actions.ts`, `portal-actions.ts`, `trip-actions.ts`, payment calculator/queries; targeted tests.

- [x] Update completeBooking and trip-level completeTrip entry points to enforce zero outstanding after discount using the shared summary under lock. UI disables completion for unpaid bookings with the exact remaining amount; server rejects forged/stale requests. No automatic completion on final payment.
- [x] Update redeemPoints to use original price and real final-stage amount, retaining one pre-payment redemption and available unexpired completed-point checks. Preserve original stage amount; store discount separately, increment revision. Do not reduce D2 through old balanceAmount semantics.
- [x] Add `cancelBooking(form: FormData)` with typed cancellation category and required reason. Under locks snapshot refundable entitlement from net stage allocations AND snapshot total prior booking refunds as refundBaselineMinor, mark cancelled, waive unpaid obligations and release capacity; audit category/amount. Repeat cancellation returns original result, not a larger entitlement.
- [x] Refactor cancelTrip to apply operator cancellation across affected active bookings with batched reads and deterministic lock order; no per-diver emails. Preserve receipt/payment/points history. Keep completed historical bookings out of automatic trip-wide cancellation.
- [x] Add `recordBookingRefund(form: FormData)` accepting bookingId, amount, paidOn, operationKey, expectedRevision. Compute remaining entitlement, allocate to eligible source-payment portions in stable order, append source-linked refund rows/allocations/audit atomically. Persist the parent refund operation atomically as audit_log.id = `refund-op-${operationKey}` (validated UUID key) with meta `{bookingId, amountMinor, paidOn, cancellationKind, childPaymentIds, refundOutstandingAfterMinor}`. Check that unique audit row BEFORE computing new allocation; identical booking/amount/date returns saved child IDs/result, changed payload is rejected. Child payment keys derive from parent UUID and source payment ID. One transaction writes all children and the parent audit row; rollback leaves neither. Test replay after full success and after an injected mid-write rollback. Queue membership = refund outstanding >0, independent of booking status.
- [x] For postponed trips, save new trip dates without changing booked schedules; audit old/new dates. The trip-change audit ID identifies the specific old/new dates; pending responses are derived by joining affected booking IDs recorded in that audit with acceptance/decline audit entries for that change ID. Iris records each active diver's acceptance (audit-only, schedule unchanged) or invokes cancellation category postponement_declined with full entitlement. Expose the choice in existing booking information/dialog context, no new global dashboard. Do not infer acceptance from silence.
- [x] Tests: final-only discount including zero final; 20% and lower configured cap; cancelled deposit-only no refund task; partially paid final refund only that portion; operator full refund; partial refunds reduce task, full refund removes task; old receipt unchanged; points not restored/awarded on cancellation; later refunds after completion retain existing earned-point reversal behavior.

Run targeted `--grep "refunds"` plus pure allocation tests. Test that partial/unpaid bookings cannot complete, fully settled bookings still require ended travel and explicit participation, and repeated completion never awards points twice.

**Exit:** cancellation state and refund obligation are distinct and reconcile to source payments. Postponement does not silently rewrite obligations.

## Task 6 — Instructor UI and a single payment dialog

**Files:** create `src/components/payment-schedule.tsx`, `record-payment-dialog.tsx`; modify `portal-view.tsx`, `portal-dialog.tsx`, `portal-trips.tsx`, `styles/portal-tabs.css`; tests rendered + targeted financial flow.

- [x] Build shared schedule inside existing card: Stage / date / Payable / Received / Outstanding; omit D2 when absent. Footer gross/net/refund labels adapt honestly when refunds exist. Final row shows original amount minus points discount.
- [x] Rename Booking requests → Payments to receive. Show per-stage progress directly in list, next amount/date and overdue text. Sort overdue first then next due date with stable booking ID tie-break; include future next payments for early receipts. Fully paid exits this queue but remains in Trips/Money history.
- [x] Replace Received and Different amount with Record payment. One dialog, actual amount default = suggestedAmountMinor, date = today, no kind/currency/booking selectors. Show preview and remaining after payment. Generate fresh operation key on each new intent; retain it through failure/retry, rotate after success. Pending prevents duplicate click; errors keep fields; stale response refreshes preview and asks for explicit confirmation of updated data.
- [x] Replace Release/Withdraw variants with Cancel booking; show category/reason and Paid / Deposits retained / Refund due preview before confirm. Refund task opens booking-context refund dialog, not internal payment selector. Points dialog filters eligible bookings and previews original/final discount amounts without requiring booking reselection from a contextual action.
- [x] Keep dialog open on submit until success; scope behavior so unrelated dialogs are not silently changed. Preserve Esc/close/focus return when idle. Show clear saving state and prevent ambiguous close during financial submission.
- [x] Render desktop and 390px/320px EN/CN states: one/two deposits, partial, overdue, zero final, refund pending, save error/stale. Verify keyboard reachability, ≥44px controls, wrapping, no horizontal schedule scroll and no CJK leakage. Capture viewport screenshots, not only full-page.

Run targeted `--grep "ui"` with both locales/viewports.

**Exit:** Iris can see all payment progress without opening a dialog and record exact/partial/combined payments through one action.

## Task 7 — Diver views, documents and truthful notices

**Files:** `booking-wizard.tsx`, `my-okim-view.tsx`, `invoice-view.tsx`, `receipt-view.tsx`, their route loaders, `emails.ts`, `local-email-gate.ts`, all sweep callers, `app/api/cron/sweep/route.ts`, `scripts/seed-policies.ts`, `src/lib/translations.ts` and relevant dictionary strings.

- [x] Booking summary/success shows schedule, qualified non-refundable acknowledgment, reference/instructions and View My Okim. Remove 14-day promise, receipt-email claim and pre-completion invoice link. Acceptance persisted with policy versions/audit in Task 3, not merely a client checkbox.
- [x] My Okim reuses summary inside Trip information; next instruction derives from next unpaid stage, no generic Pay balance on fully paid bookings. Show discount and adjusted final clearly. Keep cancelled/refund-pending amounts visible in Past/attention context. Leave equipment and Messages behavior unchanged.
- [x] Invoice separates price minus discount from payment schedule and paid/remaining totals. Enforce diver completion-only access at route and link; instructor retains access. Receipt reads immutable snapshot, actual paid date and stage allocations; internal UUIDs stay out of visible content. Current booking status must be labelled current, not implied as receipt-time fact.
- [x] Remove sweepHolds calls from every page/action and automatic expiry/extension behavior. Keep authenticated cron endpoint temporarily as a no-op response `{disabled:true, reason:'manual_release'}` to avoid stale scheduled invocations mutating data; remove secretless access. Tests prove page loads/cron leave old unpaid bookings unchanged.
- [x] Create `src/lib/booking-notifications.ts` with `attemptBookingAcknowledgment(bookingId, payload, deps)` where deps explicitly provides `claimAttempt(bookingId): Promise<boolean>`, `send(payload): Promise<boolean>`, and `recordOutcome(bookingId, outcome): Promise<void>`. Inject a counting fake sender in `tests/payment-unit/booking-notifications.spec.ts`; production wires the existing Resend transport. Test concurrent attempts produce one sender call; failed send/claimed-before-crash does not retry automatically. Also run mutation notification tests with fake dependencies to prove payment/refund/cancel invoke zero lifecycle sends. Browser suppression alone is not evidence of emission counts.
- [x] Keep one booking-request email sent after successful transaction, guarded against retried booking requests; atomically claim acknowledgment_attempted_at only when null before making one send attempt and audit the result. A crash after claiming can mean no email; expose that failure for manual support rather than automatic retries that risk duplicates. Provider delivery cannot be guaranteed exactly once; report failure truthfully and never undo booking. No automatic email on receipt/refund/cancellation; preserve auth email and unrelated inquiry behavior. Update seed text/help in both languages; do not execute policy upsert without explicit publication authorization.
- [x] Tests: no invoice access for uncompleted diver; instructor access works; receipt unchanged after later/backdated payment and refund; one acknowledgment attempt for retried booking; other lifecycle paths produce zero email calls; hold sweep no-op; bank/medical data absent from unauthorized views.

Run targeted `--grep "documents"` and the zero-service notification tests.

**Exit:** diver and instructor amounts agree, old promises are removed and notifications match the agreed policy.

## Task 8 — Integration gate and handoff

**Files:** `tests/multi-deposit.spec.mjs`, targeted config, affected existing specs, current docs.

- [x] Verify the Task 3 `playwright.payment.config.mjs`: workers 1, testMatch only multi-deposit spec, no project dependencies or automatic shared-server start. Require explicit loopback PLAYWRIGHT_BASE_URL and a deliberately started matching AUTH_URL preview with OKIM_DISABLE_EMAILS=1. Reject absent/nonloopback URL; no fallback to 3100.
- [x] Token-insert sign-in, no real sends. Create only fixtures each assertion needs under unique run prefix; clean in finally in FK order in a transaction. Keep receipt/points/allocations cleanup complete. If quotas/connection limits fail, stop rather than retry-loop.
- [x] Update existing impacted tests: m4-booking, m5-financial, m5-trips-lifecycle, m6-integration, seamless-flow, completion-critical, completion-points, portal-tabs, m6-my-okim and policy copy assertions. Remove old hold/percent/rate-edit assumptions; preserve completion and auth assertions. Do not weaken tests to retain obsolete UI.
- [x] Run pure suite; `npm run lint`; `npx tsc --noEmit --incremental false`; `git diff --check`. Build once in isolated workspace. Run `PLAYWRIGHT_BASE_URL=http://localhost:3100 AUTH_URL=http://localhost:3100 OKIM_DISABLE_EMAILS=1 npx playwright test --config=playwright.payment.config.mjs` only with the deliberate server/test target ready. Record actual counts/results, not collected-test counts.
- [ ] Perform targeted rendered journeys EN/CN desktop/mobile; obtain independent code/financial review and owner visual review. Independent review and desktop/mobile browser checks are recorded in the execution log. Owner visual acceptance is pending. Broader suite only in owner-approved quiet window, one runner. Do not silently restart 3100 or enable real sends for convenience.
- [x] Update MVP change-control and design system with actual approved/implemented changes, STATUS and this checklist. Reconcile policy publication as its own explicit action. Provide test/fixture-cleanup receipts and remaining limits. Commit/push/deploy only on explicit owner go.

## Completion criteria

All seven confirmed workflow rules implemented end-to-end; exactly one payment action; consistent per-stage received/outstanding on portal/My Okim/documents; stable receipts; no automatic release or obsolete lifecycle sends; scoped migrations accounted for; targeted financial and rendered tests pass; owner visual acceptance recorded. No release-readiness claim from source inspection alone.
