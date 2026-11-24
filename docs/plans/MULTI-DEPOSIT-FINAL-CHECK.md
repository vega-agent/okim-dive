# Multiple deposit final readiness check

**Date:** 2026-11-23. **Outcome:** ready to prepare the concrete implementation plan, not ready to claim implementation complete or release. The subsequent plan review found a completion/payment conflict; the owner resolved it: full settlement after discount is required before completion, alongside existing ended-trip/participation checks. The implementation plan includes the corresponding gate and tests. UI layouts remain proposed until owner visual review.

## Evidence checked

- Reconciled workflow, owner amendments, UI proposal and deep payment audit.
- Current booking, payment, refund, points and trip-cancellation source paths; current schema definitions and dirty working tree.
- Two read-only metadata queries against the database configured in `.env.local`: column inventory and relevant index definitions. No customer/payment record contents queried; no writes or email calls. Neon connector rejected argument shapes, so the installed Neon driver was used with the existing configuration without printing credentials.
- Prior subagent screenshot review covers desktop English Actions, payment dialog, Pricing and My Okim. It does not cover mobile/Chinese or successful payment execution.

## Confirmed schema starting point

- `trip_deposits`: id, trip_id, sort, amount, due_days. No due_date yet.
- `trips`: legacy deposit_value and balance_due_days; no balance_due_date.
- No `booking_stages` table in public schema.
- Payment claims and payments have unique operation-key indexes. Payments also have unique claim and receipt-number indexes.
- The new maximum-two-deposit rule is not enforced by a corresponding stage constraint in the current deposit table.

This confirms the main migration prerequisites; it is not a complete schema-drift or provider-configuration audit.

## Technical choices to make concrete in the plan

1. **Agreed versus derived data:** persist booking schedule, original price and discounts separately. Derive paid/outstanding from verified financial events with one shared minor-unit calculation.
2. **Stable receipt history:** choose immutable per-payment allocations or an explicit stable recording sequence. Later refunds and backdated bank dates must not rewrite earlier receipts. Actual paid date and recorded time are different facts.
3. **Cancellation versus money owed back:** cancellation frees capacity; refund progress remains independent. Record cancellation category and refund entitlement so partial refunds clear only the amount actually settled. Waived future payments are not overdue debt.
4. **Concurrency and retries:** booking and schedule creation must be atomic with capacity reservation. Each intentional payment gets a new key, retries retain it. Replay before recalculating expected amount. Later payments keep an already confirmed place. Reject overpayment under lock and expose stale-data errors without closing the dialog.
5. **Calendar dates:** use date-only schedule values interpreted consistently in the trip's existing timezone. A deadline is overdue after that calendar date, not because a browser is in a different timezone. Keep a zero final payment settled without requiring a meaningless payment action.
6. **Shared refresh and access:** same summary powers portal, dialog, My Okim and documents. All affected routes refresh after payment/refund/discount changes. Diver invoice access follows the agreed completion rule at the route as well as link level.
7. **Side-effect removal:** reach trip cancellation emails, page-load sweeps and cron as well as payment confirmation/reminder emails. Keep sign-in separate from the single booking lifecycle acknowledgment.
8. **Postponement:** changing trip dates must not silently change booking obligations or classify an operator-caused exit as diver withdrawal. Include the existing accept-or-full-refund rule in the action and audit design.

## Scope and data boundaries

All data is test data by owner confirmation. No production legacy engine is required. The plan must identify any fixture conversion/reset targets and dependencies explicitly; this check authorizes no deletion. Retain current work, accounts, policy records and settings unless a later scoped action says otherwise. Concurrent design work now includes amendments through MVP #49 / DESIGN-SYSTEM v1.33; preserve those changes.

The historical decision plan has been clearly labelled so superseded 14-day holds, T-3 reminders, extensions and unlimited deposits cannot be mistaken for current requirements. The workflow specification is the implementation basis; the UI proposal and audit provide detail.

## Planning acceptance gates

- Concrete schema/migration and scoped fixture treatment, with rollback/backup considerations.
- Pure allocation/discount/refund tests plus focused transaction tests for duplicates, races, full-trip later payments and overpayment.
- One/two deposits, partial/combined payments, zero final, cancelled/refund-pending and receipt-history fixtures.
- EN/CN desktop/mobile rendered review and owner visual acceptance.
- Zero real test emails; full shared-service suite only under existing owner/quiet-window gate.

No build, live mutation test, policy publication, schema write, fixture deletion, commit or deployment performed in this check. Source-discovered financial issues remain unexecuted hypotheses until targeted tests reproduce and verify fixes.
