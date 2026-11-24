# Multiple deposit workflow specification

**Updated:** 2026-11-23. Consolidates the owner decisions in [the decision plan](MULTI-DEPOSIT-FLOW-PLAN.md). Business rules below are confirmed; implementation has not started. Implementation details identified as recommendations require technical review before changes to the shared database. No deployment or database reset is authorized by this document.

## Purpose

Support trips paid with one or two deposits and a final payment, using the same rules regardless of how far away the trip is. Iris records externally received payments and decides cancellations. Divers see the same payment information in My Okim.

## Confirmed rules

1. Iris sets the trip price, deposit 1, optional deposit 2, their absolute due dates and the final-payment date. Maximum two deposits. Final payment equals price minus deposits.
2. Each new booking gets its own schedule. Later trip edits do not change an existing booking's agreed amounts or dates.
3. Each payment covers the earliest unpaid amount first. Partial payments leave the remainder outstanding; larger payments continue into the next stage. Fully paying deposit 1 confirms the place.
4. A booking reserves a place until Iris cancels/releases it. Missed dates show Overdue; nothing automatically expires. Remove the 14-day hold and +7/+14 extensions. Late bookings show passed deadlines as Due now, without a separate payment window.
5. One booking-request email contains the schedule and payment instructions. Later updates and receipts stay on-platform. Sign-in emails are separate. Remove scheduled T-3 lifecycle emails and reminder machinery; display dates and overdue amounts directly.
6. Points discounts reduce only the final payment, capped at that payment and the existing 20% booking-price limit. Deposit amounts never change. Redemption remains instructor-controlled, once per booking before payment. Completion-only earning and no restoration of spent points remain unchanged.
7. Diver withdrawal, nonpayment cancellation or no-show: retain paid deposit portions and refund paid final-payment portions. Operator cancellation: refund all payments. For postponement, accept new dates or exit with a full refund. Iris records which reason applies and records refunds after making them externally.

8. **Completion requires full payment after the points discount** (owner confirmed 2026-11-23). Iris still explicitly confirms participation after the trip ends; final payment does not automatically complete a booking. Award points once on completion from eligible net cash.

## UI review

See [the UI proposal](MULTI-DEPOSIT-UI-PROPOSAL.md) for screen-by-screen changes and review states. It is proposed, not yet visually approved.

## Iris's workflow

- Settings: price, one required deposit row, optional second deposit row, final amount calculated automatically, date input for each stage. No percentage deposits or third deposit.
- Portal: diver, trip, next unpaid stage, remaining amount and due/overdue state. One Record payment action opens a prefilled editable amount/date dialog for exact, partial or combined payments. The list shows received and outstanding amounts for each stage and the booking totals.
- Cancellation: explicitly distinguish diver withdrawal/nonpayment/no-show from operator cancellation. Show retained deposit amount and refundable amount before confirmation. Cancellation releases capacity immediately; unpaid refund obligations remain visible until recorded.
- Keep financial entries append-only and audit payments, cancellations, refunds and points redemptions. Repeated clicks must not duplicate financial entries.

## Diver's My Okim and documents

Show the full schedule with amounts, dates and payment progress. Show the applied points discount separately, the adjusted final payment, total paid and total remaining. A discount is not a cash payment. Deposits must visibly remain unchanged after redemption.

The booking summary presents the schedule and a required acknowledgment of non-refundable deposits, qualified by the operator-cancellation exception and linked policy. Each recorded payment creates an accessible receipt showing payment amount, stages covered and running totals. Iris can access invoices/receipts anytime; the diver's invoice appears after completion. Neither document is emailed.

## Data and calculation design — implementation recommendations

- Add absolute dates to the existing trip-deposit structure and a final-payment date to trips; reuse the existing table. Retain old columns temporarily only where needed for a safe transition.
- Create per-booking schedule snapshots, up to two deposit stages and a final stage. Keep original final amount and points discount distinguishable so the UI and ledger reconcile.
- Use one shared calculation for allocation, next amount due, balances and refundable amounts across server actions and UI. Calculate currency in integer minor units.
- A payment can cover deposit and final portions. Refund records must retain original payment links; do not assume an entire payment row belongs to just one stage.
- Validate positive deposits, total deposits no greater than price, and chronological dates before departure. Allow passed due dates for late bookings. If final amount becomes zero, show it as settled with no payment requested; disallow further points discounts when no final amount remains.
- Disable automatic expiry in every path, including page-load sweeps, cron and capacity reads. Merely hiding extension buttons is insufficient.
- Protect booking capacity, payment allocation and redemption with transactional checks; concurrent requests must not overbook or over-discount.

## Test data and rollout

The owner confirms all current data is test data and the app is not in production. There is no requirement to preserve legacy bookings as production agreements or build a permanent legacy payment engine. Prepare an explicit, scoped fixture transition/reset plan before changing shared data; preserve accounts, policies and settings unless that plan explicitly includes them. Do not run a blanket purge.

Before implementation, reconcile seeded policy text and portal help with these rules. The prior automatic-hold wording and stale points clause must not remain as contradictory promises. Publishing/upserting policies is a separate explicit action.

## Verification

- One-deposit and two-deposit bookings use the same calculations; a third deposit is rejected server-side.
- Partial, exact and combined payments allocate correctly; only full deposit 1 settlement confirms the place.
- Missed deadlines and old unpaid bookings never auto-expire; Iris cancellation frees capacity.
- Discounts leave deposits unchanged, respect both caps and appear correctly in My Okim, invoice and remaining totals.
- Refunds correctly split a payment spanning deposit/final stages; cancelled bookings with refunds owed remain actionable.
- Completion awards points only on eligible net cash; cancellation awards none and spent points are not restored.
- One lifecycle email is attempted per booking without duplicates on retried actions; tests stub delivery and make zero real sends.
- EN/CN desktop/mobile rendering, authorization, concurrent payment/capacity checks and fixture cleanup are verified under AGENTS.md service-budget rules.

## Implementation sequence

1. Review the shared calculations, schema changes and scoped test-data transition.
2. Implement schedule snapshots, allocation, discounts and cancellation/refund behavior together.
3. Update Settings, booking, portal, My Okim and documents; remove obsolete hold/email paths.
4. Reconcile policies/help, run targeted checks and obtain owner visual review before commit or deployment authorization.

Use the existing Next.js/Drizzle architecture. No new payment service, automated cancellation engine or general-purpose instalment framework is needed.

## Final planning check

[Readiness check](MULTI-DEPOSIT-FINAL-CHECK.md) records the read-only hosted schema verification and technical items the concrete plan must resolve.
