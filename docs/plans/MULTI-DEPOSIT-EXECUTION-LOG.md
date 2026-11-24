# Multiple-deposit execution log

## 2026-11-23 — Task 0

- Owner authorized sequential implementation with GPT-6.2 Astra High and independent reviewers. No commit/push/deploy, policy publication, blanket reset, full shared-service suite or hosted writes authorized.
- Baseline: branch `QwenWork-refactor`, HEAD `eb8a0ed78e8dd95c0f22751b5e9135d52c5db42c`. Existing changes preserved; private tracked patch and tracked/untracked file lists: `/tmp/okim-multi-deposit-baseline/`. No secrets copied from environment files.
- Rules, STATUS, handoff, plan, workflow, UI proposal, audit, final check, vibe and design-system sections 13/14 read. Current source checked against reported defects; no runtime reproduction claimed.
- Existing Next previews occupy 3100 (PID 15586) and 3220 (PID 4661). Neither touched. Later isolated preview uses 3221 and a separate build workspace; check again before startup. No application build started.
- Owner explicitly confirmed My Okim/Messages ownership handoff in this session. Preserve Messages behavior and existing changes when integrating.
- New calculator/tests/config are the initial writable boundary. Other application files remain untouched until their sequential task.
- Configured hosted target: Neon project `restless-mouse-32313871`, branch label `production` from `.neon`; database `neondb`, endpoint `ep-purple-paper-ao84nvvx` in ap-southeast-1. Environment endpoint parsed without exposing credentials. Hosted metadata not refreshed; refresh only necessary preflight data in Task 2.
- Local migration rehearsal strategy: disposable PostgreSQL 17.12 cluster `/tmp/okim-multi-deposit-postgres`, loopback port 55433, role `okim_payment_test`, UTF-8. Initdb required sandbox approval for shared memory; approved initialization/start succeeded. Existing local databases on 5432/55432 untouched. No hosted writes or email requests.
- Ruling: work in the owner's dirty branch, initially only new files, rather than a clean git worktree that omits approved uncommitted source. Later build isolation must include current source; no git reset/stash/clean.

## Task 1

Astra High implementer is writing pure failing tests before calculator code. Independent review follows. No browser, server, database or email fixtures in this suite.

### Owner preview amendment

Owner requested port 3100 for their preview and other previews stopped. Sent SIGTERM to confirmed Okim Next process 4661 on 3220; port 3100 remains untouched. No preview on 3221. Do not start another preview without reconciling this instruction; future build artifacts can still be isolated. Disposable PostgreSQL is a test database, not a preview.

### Pure-runner isolation check

Independent reviewer found the normal browser configuration also collected the new pure specs. Added `**/payment-unit/**` to both browser projects existing ignore lists. Collection-only command `playwright test --list payment-unit`: before 30 cases (15 duplicated across desktop/mobile); after 0, expected no-tests exit 1. This was collection, not a browser test run. Dedicated pure config remains one worker with no webServer, setup or browser fixture.

## Task 1 — complete

- Sequential Astra High implementation plus independent Astra High financial review. Added pure calculator/types, schedule/date/money validation, FIFO allocation, final-only discount cap and cancellation snapshot/refund accounting.
- Initial typed-stub RED: 14 failed, 1 rejection-only test passed (`/tmp/okim-payment-unit-red.log`). Independent review found invalid cancellation waiver, impossible refund entitlement and duplicate allocation identity gaps; regressions failed before fixes. Missing timezone fallback also reproduced and fixed; four-digit calendar years validated.
- Parent verification: `./node_modules/.bin/playwright test --config=playwright.payment-unit.config.mjs --reporter=dot` => 20 passed, 1 worker, 286ms. No browser, server, DB or emails. Reviewer also exercised 166 valid in-memory payment/cancellation combinations.
- Full `tsc --noEmit --incremental false --pretty false`, scoped ESLint (calculator, tests, both configs) and `git diff --check` passed. Logs: `/tmp/okim-payment-unit-{red,review-red,duplicate-red,timezone-red,green}.log`.
- Extra pure API: `validatePaymentSchedule(priceMinor, stages, departure)`, `maximumDiscountMinor(priceMinor, finalMinor, configuredCapPct=20)`, `cancellationRefundSnapshot(summary, kind)`. Refund source eligibility and expired point lots require the action-layer transaction tests in Task 5; no claim those are fixed yet.
- Existing capacity/retry/receipt-history action defects remain pending Tasks 3–7. No UI changed, no visual acceptance claimed.

## Task 2 — in progress

Astra High implementer owns additive schema, explicit migration/dry-run, pure report validation and local rehearsal. Hosted writes prohibited until owner reviews exact migration and fixture treatment. Local target connectivity verified as `postgres|okim_payment_test|55433`. No second implementation task runs concurrently.

## Task 2 — hosted approval pending

The read-only hosted report has zero blockers. [Migration review and exact fixture treatment](MULTI-DEPOSIT-MIGRATION-REVIEW.md). Six existing demo bookings become 12 booked stages. Five payments totaling MYR 2,440 become six stage allocations with five reconstructed receipt snapshots. Four trips have convertible dates. Twelve unbooked trips retain incomplete schedules.

The independent review identified nonfinite SQL money checks, foreign-key naming differences and an overly broad exception for unbooked incomplete schedules. Corrected both SQL and Drizzle constraints, checked all three FK names and added a regression for invalid inactive-trip financial inputs. The approved candidate is identified by report digest `81bda1da00a5e9ce392633662309900a1512497c24e9cdd8a7de65f0df2da63b`.

Parent reran the dedicated pure suite (26 passed with one worker), full no-emit TypeScript, application lint, scoped ESLint and whitespace checks. The local rehearsal recorded full rollback on injected failure, money reconciliation, zero changes on repeat apply, archive restoration and constraint enforcement. Cleanup counted zero named fixture rows and zero intermediate rehearsal databases. The local migration audit entry remains. No hosted writes, real test emails, policy publication or release. Port 3100 still serves the earlier build. Before the approved transaction coordinate its stop and keep it offline until the booking and payment writers are compatible. Tasks 3–8, transaction regressions and visual acceptance remain open.

## Task 2 — hosted migration committed

Owner explicitly approved the reviewed migration and preview interruption, then requested cleanup of all test fixtures, retained review scenarios and lower-model workflow testing. The approved migration ran first, against the exact approved target and fingerprint. Port 3100 stopped. The PostgreSQL 17 backup client refused to dump the newer hosted server before any mutation. Installed keg-only Homebrew libpq 18.7 and selected it for this command. Backup succeeded and the migration committed with its reconciliation assertion. Local receipt: `/tmp/okim-task2-hosted-apply-pg18.log` (includes private backup path). No emails. A lower-model agent independently checks the committed database read-only and will test the customer workflow when the preview is ready.

Task 3 is underway. A separate cleanup/seed transaction is being prepared against exact fixture IDs, with rehearsal and retained review cases. Keep functional identities, authored content, settings, published policy records and audit entries of uncertain provenance. The old preview stays offline during incompatible writes.

## Review fixtures — replacement committed

The owner-authorized replacement transaction committed with a second private backup. See the [review guide and exact fixture treatment](MULTI-DEPOSIT-REVIEW-FIXTURES.md). The seven retained bookings cover unpaid reservation, partial D1, a D2/final split, discounted final, zero final, completion with points and a pending refund. Known obsolete finance, trips, demo customers and ten fixture-domain accounts and sessions were removed. Unattributable active instructor sessions and historical audit entries were preserved to protect functional access and audit history. No real sends.

A lower-model tester independently verified the prior migrated totals in one read-only hosted transaction and ran five rollback-only SQL checks on disposable PostgreSQL. The actual old server action subsequently failed three regression assertions on the migrated local schema, covering capacity on a later receipt, replay and overpayment. [Reproduction](../../tests/financial-workflow-db/LEGACY-REPRODUCTION.md). These are known failing action tests until Task 4.

Independent read-only postcheck verified all seven replacement bookings, 18 stages, 13 allocations, 10 receipt snapshots, MYR 7,360 gross, MYR 100 refunded, MYR 7,890 active outstanding and MYR 200 refund due. Owner points balance 2,000. See [hosted verification](../../tests/financial-workflow-db/HOSTED-VERIFICATION.md). Actual app-level and visual gates remain open.

## Task 3 — schedule and reservation implementation verified

Four guarded schedule/booking tests passed on disposable PostgreSQL with the real transaction driver, without a live preview or email. Tested draft saving, copying, publishing, the last-place race, replay, changed accepted offer/policies, immutable snapshots, and rollback after an injected invoice failure. All synthetic rows were cleaned. The independent reviewer verified the fixes for lock order, coherent schedule reads, sold-out direct booking links, and acceptance fingerprints including the agreed travel dates. TypeScript, scoped ESLint and diff checks passed. Hydrated EN/CN desktop/mobile and owner acceptance remain pending the compatible port 3100 build.

Task 4 is implementing the shared payment reads and safe record action against the three reproduced legacy failures.

## Task 4 — payment action and reads verified

A single authenticated action now records the claim, payment, immutable receipt snapshot, FIFO allocations, revision and audits in one transaction. Identical replays return the original receipt. Changes to the bank amount/date or booking are rejected for the same operation key, and stale balances require a fresh review. Diver reads enforce unmerged ownership within the transaction. Cash events must match the booking currency and expected payment kind. The old positive payment writers were retired.

Five focused local integration scenarios plus all 26 pure tests passed. An independent lower-model tester exercised six real server-action cases against migrated disposable PostgreSQL. Correct outcomes included preserving a confirmed seat on a full trip, rejecting an excess cent, replaying a completed intent, accepting a fresh same-amount intent, serializing concurrent submissions and preserving historical receipt data. Zero real email attempts and zero remaining test fixtures. [Action tests](../../tests/financial-workflow-db/record-payment.cjs). Full TypeScript, scoped ESLint and diff checks passed. Independent source review found no outstanding material Task 4 issue after regression fixes. Hydrated UI and user acceptance follow in the later tasks.

Task 5 is underway for cancellation, refund entitlement, points, postponement and completion.

## Task 5 — cancellation, refunds, points and completion verified

The server now freezes refund entitlement at cancellation, waives unpaid stages, releases the place and records refunds against the original eligible payment/stage portions. The source-linked child refunds and their replay audit commit in one transaction. Completion requires full settlement, ended travel, explicit individual participation and a response to the current postponement when applicable. Discounts use the original final amount and overall cap, with spendable points adjusted for expired lots and debt. New tests reproduce the prior unpaid-completion defect, exact RM conversion error and expired-points/debt issue.

28 pure tests, 6 targeted integration cases and 9 independent real-action tests passed on disposable PostgreSQL. Independent tests exercised 44 instructor calls, zero email attempts and zero leftover fixtures across nine tables. TypeScript, lint and whitespace checks passed. Independent reviewer verified the source/bank-date, postponement revision, per-source reconciliation and points fixes.

The isolated port 3100 preview reopened with matching loopback AUTH_URL and email suppressed from a private copy of the Task 5 working tree. Task 6 is addressing instructor UI and mobile rendering. Preliminary Chromium component checks found clipped EN schedule values at 320px with the old mobile cell layout. Full authenticated browser journeys and owner visual acceptance are pending.

## Task 6 — instructor finance screens

Actions now shows the amounts for each stage, sorts by next due date, and previews how each new receipt will be allocated. Trips and Money keep signed payments and refunds available after an item leaves the action queue. Points and trip cancellation check the exact quote or included bookings again under lock before accepting confirmation.

Independent source review closed the points-rate race, stale trip-wide cancellation totals, missing refund history links and correction refunds incorrectly appearing overdue after completion. The implementer ran 29 pure tests and 9 independent-action scenarios (47 synthetic instructor calls, zero emails or fixture residue). Seven isolated browser checks passed. A signed-in lower-model reviewer read four hosted cases, checked both languages at 1280, 390 and 320px, and verified keyboard focus return and a 500/300 split on an 800 payment preview. This required one temporary session, which was removed. A 320px spacing issue found in that run was fixed and passed isolated browser regression. Final integrated mobile review and owner visual acceptance are still open. Task 7 is underway.

## Task 7 — diver views, documents and notifications

The signed-in booking and My Okim show staged amounts, including the final-only points discount. Completed customer invoices and all verified receipts are available on-platform under scoped access checks. Receipts preserve their bank date, individual allocations and recording-time totals. Customer names are frozen for new receipts and omitted if an older snapshot lacks one. Past bookings present cancellation reason, retained deposits and refund progress. Unanswered postponement dates are labelled as proposals. The authenticated sweep endpoint performs no writes.

The real acknowledgment path atomically claims the attempt, records the transport outcome and exposes missing outcomes for manual follow-up. Fake transports covered concurrent calls, failure, suppressed sends and interrupted attempts. Local documents coverage verified access and immutability through later/backdated receipts, profile rename and refunds. The policy source was updated in both languages. The existing hosted policy versions were preserved.

## Task 8 — integration, rendering and handoff

Final local checks on 23–24 November passed with 34 pure cases, 21 guarded integration and Chromium cases, 5 additional disposable database regressions and 9 independent real-action scenarios. The last group exercised 47 synthetic instructor calls, zero email attempts and zero fixture residue across nine tables. Full lint, TypeScript, production compilation and whitespace checks passed. Browser, local transaction and component checks cover overlapping behavior.

The lower-model hosted tester completed a normal reservation, two real payment saves, cancellation and two refund saves, then verified cleanup across 16 tables. A read-only follow-up covered authorization, the grouped receipt, the discounted final, the zero final and CN mobile history. An ambiguous receipt locator stopped the mutation run after the refund. The new receipt’s post-refund immutability was exercised locally. The earlier first-submit timeout could not be attributed to a specific validation failure. [Full evidence](../../tests/financial-workflow-db/HOSTED-VERIFICATION.md)

The independent visual matrix covered Actions, Record payment, My Okim Upcoming and Past, and one- and two-deposit Pricing at 1280, 390 and 320px in both languages. No horizontal overflow was measured on these surfaces. A missing link from the public trip cards and a Chinese status label in the English editor were fixed after the first isolated build. Published open/full cards lead to the authoritative schedule, while on-request cards retain their existing inquiry dialog. The final isolated build incorporated those fixes and passed. Representative screenshots are linked from the [review guide](MULTI-DEPOSIT-REVIEW-FIXTURES.md).

The obsolete hosted M6 integration script was consolidated into the guarded browser journey and local reservation/payment/completion tests. Related broader booking, My Okim, policy, Messages and equipment specs use updated snapshots, cleanup and controls. The full shared-service suite was not run. The open gate is owner visual acceptance.

The signed-in booking wizard and public trip detail were verified in both languages at 1280, 390 and 320px. Both showed MYR 360 due on 13 October and MYR 840 due on 12 November. The narrow Chinese wizard initially split its deposit label vertically. Stage labels now stack above amounts, and dates stay intact. A final local Chromium regression passed in both languages. On the corrected production-mode preview the lower-model reviewer measured both labels and both dates on one line apiece at each mobile width, with no horizontal overflow. The temporary login was removed with zero remaining rows and no booking submission.

Port 3100 serves the final isolated production-mode build at [localhost](http://localhost:3100/trips). The read-only smoke request returned HTTP 200. Ports 3220 and 3221 have no preview listener. A rebuild after each final visual correction kept the running build separate from the source workspace. Final owner acceptance was requested on 24 November.

On 24 November the owner authorized the implementation commit and push to `QwenWork-refactor`. Owner visual acceptance and deployment remain separate.
