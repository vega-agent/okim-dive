# Payment workflow deep audit

2026-11-23. Read-only source review by the parent and two subagents, plus a separate rendered-dialog review. No financial operations, database writes or runtime bug reproductions. Findings below are source-derived unless expressly marked rendered.

## Conclusion

Consolidate Received and Different amount into one Record payment action, as requested. More importantly, consolidate the payment calculations. The database already supplies payment records to the portal and My Okim, but the views do not consistently expose them. A shared server-side booking payment summary must drive list, dialog, My Okim and documents.

## Current correctness findings

1. `src/lib/seamless-actions.ts:65–72`: Received rechecks capacity on later payments and counts the booking's own confirmed place. On a full trip it can flag an already confirmed booking for refund. Subsequent instalments must not reacquire capacity; only deposit 1 settlement changes confirmation state. Audit trip-state/departure checks separately from receipt recording.
2. `seamless-actions.ts:50–62`: expected amount/kind is recalculated before replay detection. An identical retry after successful payment can conflict with the original operation. `portal-view.tsx:110,257,432` also reuses a mount-scoped key for later payments. Use one key per payment intent, stable on retry, and replay the original committed result before recalculation.
3. `seamless-actions.ts:55–58`: custom amount has no upper bound against the current outstanding obligation. Recheck under lock and reject excess; never record negative outstanding amounts.
4. `portal-actions.ts:144` and `portal-view.tsx:137–138,272–284`: refund task visibility depends on refund_flagged status, which remains after refund; source payment selection reverses unordered data. Track refund entitlement minus recorded refunds, separate from cancelled booking status; allocate source-payment portions deterministically.
5. `booking-actions.ts:160–214`: availability check and booking/invoice inserts are separate operations. Booking, stage snapshot and capacity reservation must commit atomically, including concurrent last-place attempts.

These are source findings, not executed financial tests. Include focused transaction tests in the implementation gate.

## What the list must show

For each booking, show diver, trip, booking reference and booking status, followed by a maximum-three-row schedule:

| Stage | Payable | Received | Outstanding |
|---|---:|---:|---:|
| Deposit 1 | MYR 500 | MYR 500 | Paid |
| Deposit 2 | MYR 700 | MYR 400 | MYR 300 |
| Final payment | MYR 1,650 | MYR 0 | MYR 1,650 |

Example values only. Each stage includes its date and textual due/overdue status. Final payment shows its MYR 150 points adjustment from MYR 1,800. Footer: Received MYR 900 · Outstanding MYR 1,950. One next-payment line identifies Deposit 2, MYR 300 and its date. Do not require a dialog to discover payment progress. Mobile stacks the same labelled rows; unused Deposit 2 is omitted.

## One payment interaction

1. Iris clicks Record payment on the booking.
2. Dialog already knows diver, trip, booking, currency, outstanding stages and booking reference. Amount received is prefilled with the next stage's remainder; date defaults to today. Both are editable. No payment-kind dropdown.
3. Preview shows allocation and remaining after payment. Changing MYR 300 to MYR 500 shows MYR 300 to Deposit 2 and MYR 200 to final payment.
4. Iris matches the real bank record, then explicitly confirms. This is recording money already received, not collecting or verifying bank transfers automatically.
5. Keep dialog open while saving and on error. Disable duplicate submission. On success, refresh payment progress, expose receipt and prepare a fresh key for the next payment.

If another session changed payments since opening the dialog, refresh the summary and require Iris to review the changed allocation instead of silently applying a stale expectation. Reuse preloaded data for the initial dialog; make only necessary save-time checks, not a polling loop.

## Shared data contract

Batch/group bookings, stage snapshots, verified payments/refunds, claims and points information. Supply:

- Booking identity, currency and lifecycle status.
- Original price, points discount and adjusted cash payable.
- Per-stage original/payable amount, date, cash allocation, outstanding and status.
- Gross received, refunded, net received and active-booking outstanding totals.
- Next unpaid stage and suggested amount.
- Cancellation reason, retained deposits, refund entitlement, refunded and refund outstanding.
- Payment history with actual paid date, recorded time, receipt and stage allocations.

Use one integer-minor-unit calculation shared across read views and write validation. Store obligations and financial events, not editable paid/outstanding totals. My Okim already fetches payments but maps them largely to receipt links; reuse those batched records. Invoice needs those payment records too. Actual paid date is on the claim, not the payment row.

## Receipt and cancellation integrity

A historical receipt must not change its allocation when later payments/refunds arrive. Use a stable recorded sequence or immutable per-payment allocation facts; backdating the bank date must not reorder existing receipts. Review the precise schema choice in the implementation plan.

Refund a payment spanning deposit/final stages by its eligible portions, not its broad payment.kind label. A cancelled booking's unpaid future amounts are waived, not debt to continue displaying. Its money summary becomes Deposits retained / Refund due / Refunded, remaining visible in Past trips and the portal until settled.

## Cross-surface repairs

- Snapshot stage dates; stop deriving booked deadlines from editable trip dates.
- Points discount applies to actual final stage, not the legacy remainder after Deposit 1 (which would include Deposit 2).
- Replace My Okim's generic Pay balance text with next unpaid stage; fully paid must have no payment instruction.
- Remove old hold/expiry/email promises from wizard, portal help, trip counts, My Okim and documents; remove sweep behavior from page loads and cron.
- Keep pre-completion invoice links and route authorization consistent with the agreed visibility rule.
- Separate invoice price summary from payment schedule. Receipts show bank-paid date and recorded date distinctly where useful, without internal UUID noise.
- Revalidate affected portal/diver/document views after payments, refunds and points use.

## Verification priorities

Single/two deposits; partial/exact/combined payment; points-adjusted final; zero final; simultaneous requests; same retry and second intentional payment; confirmed diver paying on a full trip; amount above outstanding; cancellation with split-payment refund; completed refund clears queue; stable old receipt after later refund; EN/CN desktop/mobile and accessible pending/error states.

## Rendered evidence

The visual-review subagent viewed actual desktop English Actions and Different amount dialog screenshots through native Chrome. Amount displayed 840.00 as a placeholder rather than a populated value; Date paid was blank; Payment kind was a Balance dropdown. The dialog lacked amount already received, total outstanding and allocation preview. This confirms that known payment context is not sufficiently carried into the action. The dialog and review tab were closed without submitting. Mobile/Chinese and future proposed states were not visually tested.
