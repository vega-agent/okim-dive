# Multiple deposit UI proposal

**Status:** proposed for owner review, 2026-11-23; no application changes. Complements [the workflow specification](MULTI-DEPOSIT-FLOW-SPEC.md). Preserve the latest design-system amendments, including v1.31–1.33, alongside the existing sticky header, white action icons and single-language display.

## Recommended direction

Extend the existing Pricing card, portal payment cards and My Okim Trip information sub-card. Keep the current navigation. One shared payment schedule supplies all screens; each view must not independently calculate money.

## 1. Trip Settings

Keep Currency and Trip price at the top of Pricing. Replace unlabeled amount/day-count rows with:

| Stage | Amount | Due date |
|---|---|---|
| Deposit 1 | Editable | Date input |
| Deposit 2 (optional) | Editable | Date input |
| Final payment | Calculated, read-only | Date input |

Show one existing-style 44px + control to add Deposit 2, and × to remove only that optional stage. No third row and no removable Deposit 1. Preserve inline amber blocker dots after labels and the sticky Save action. Mobile stacks fields without shrinking date inputs or adding horizontal scroll. A zero final amount reads “No final payment required”.

## 2. Booking and public trip details

Use the same compact schedule within the public Cost section and booking summary. Show it before acceptance, with total price and the deposit/refund acknowledgment. No countdown or automatic release promise. Success shows Booking received, next amount/date, booking reference, payment instructions and View My Okim. Remove immediate invoice links and emailed-receipt promises.

## 3. Iris's Actions

Rename “Booking requests” to “Payments to receive”. One payment card per booking. Diver/trip first; next payment stage, remaining amount and date next. Overdue is text plus a restrained warning color, not a second copy of the booking in another queue. Future next payments remain reachable for early payments. The list itself shows every stage’s amount received and outstanding, plus total received and total outstanding; do not hide this information inside the dialog.

Owner amendment: replace Received and Different amount with one **Record payment** action. It opens the existing dialog with actual prefilled next-stage remaining amount and today’s date, both editable, and no manual payment-kind selector. A simple preview explains allocation when a payment crosses stages. Full deposit 1 settlement confirms the place; a partial Received click must not claim confirmation.

Remove hold countdowns, Extend +7/+14 and separate Release/Withdraw variants. Use Cancel booking with reason and a preview of Paid / Deposits retained / Refund due. Keep outstanding refunds visible even when the booking is cancelled. Keep dialogs open while saving; close only on success and display errors inside the dialog.

## 4. My Okim

Keep Upcoming / Past / Points / Profile. Inside Trip information, replace Deposit/Balance totals with a payment schedule. Example only, not a business price:

| Payment | Due | Amount | Progress |
|---|---|---:|---|
| Deposit 1 | 1 February | MYR 500 | Paid |
| Deposit 2 | 1 April | MYR 700 | MYR 400 paid; MYR 300 remaining |
| Final payment | 1 June | MYR 1,650 | Upcoming |

Beneath Final payment: “MYR 1,800 − MYR 150 Okim Points discount”. Then “Paid MYR 900 · Remaining MYR 1,950” and one next-action sentence: “Deposit 2: MYR 300 remaining, due 1 April.” Deposits visibly remain unchanged.

Mobile uses stacked labeled rows. Status is never color-only. Receipt links remain available; invoice appears after completion. Cancelled bookings must still expose Refund due / Refund recorded, even in Past trips. Points help says to contact Iris before the first payment, not “at invoice time”.

## 5. Points and documents

Iris's redemption dialog shows available points, maximum usable discount, original final payment and adjusted final payment. Only eligible bookings are selectable. Keep the existing 20% cap and final-payment cap visible without a separate rules panel.

Invoice: price summary (trip price minus discount equals total), separate schedule, total paid and remaining. Do not display price plus deposits as though they are additive invoice lines. Receipt: receipt number, booking reference, amount/date and stage allocation; omit internal payment/claim UUIDs from the visible document. Invoice authorization must enforce the completion-only diver rule, not merely hide a link.

## Source review findings

- `src/components/deposit-editor.tsx`: unrestricted row controls and due-days inputs.
- `src/components/booking-wizard.tsx`: old hold/receipt-email promises and immediate invoice link.
- `src/components/portal-view.tsx`: two-stage expectation, manual payment kind, hold controls, premature dialog close and refund queue coupled to booking status.
- `src/components/my-okim-view.tsx`: obligation totals lack allocation, confirmed guidance jumps to balance, invoice links are early, points help conflicts with pre-payment redemption.
- `app/(site)/myokim/page.tsx`: mutable trip dates supply balance timing; use booking snapshot instead.
- `src/components/invoice-view.tsx`, `receipt-view.tsx`: separate price from payment schedule and expose actual stage allocation.
- `app/(site)/invoice/[bookingId]/page.tsx`: owner access currently lacks the proposed completion gate.

## Review and acceptance

Review one and two deposits, partial deposit 1, confirmed but overdue deposit 2, combined payment, discounted final payment, zero final payment, fully paid and cancelled/refund-pending states. Check EN/CN at desktop and mobile, keyboard focus, 44px controls and native-dialog behavior. UI proposal approval does not authorize live financial actions or fixture purges.

Source review was performed by two independent subagents. Rendered observations are recorded separately below; source findings must not be treated as screenshot-verified behavior.

### Rendered review evidence — 2026-11-23

A third subagent inspected actual desktop English screenshots through native Chrome after the browser-tab connector failed. It viewed portal Actions, TRP-004 Settings/Pricing and My Okim Trip information. No forms were submitted.

- Actions: airy white fold cards on watercolor; per-diver rows show deposit amount, transfer deadline/countdown, Received, +7/+14, Different amount and Release slot. The Booking requests heading also contains confirmed bookings awaiting later payments. Reuse the layout, rename the section and remove hold controls.
- Pricing: generic amount/day-count deposit row with ×/+ on the first row; separate balance-day input and quiet calculated balance line. Named stage rows with dates fit this existing card; no new section is needed.
- My Okim: Deposit/Balance/Balance due grid, a passed date without explicit overdue treatment, guidance to pay the balance and an invoice link on a confirmed booking. Replace with stage progress and keep the next payment instruction above receipt links.
- Desktop English only was visually reviewed. Mobile, Chinese and proposed states remain acceptance work; the proposal itself has not been rendered or implemented.

## Deeper payment audit

[Payment workflow audit](MULTI-DEPOSIT-PAYMENT-AUDIT.md) specifies the single action, visible per-stage received/outstanding rows, shared data contract and source-level correctness fixes required alongside the UI.
