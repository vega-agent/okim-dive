# Multi-deposit diver booking flow — decision plan

## Owner decision — full settlement before completion (2026-11-23)

Booking completion requires full payment after any points discount. Existing ended-trip and explicit individual-participation checks remain. Final payment does not automatically mark completion; points are awarded once when Iris completes the booking.

## Owner amendment — one payment action and visible progress (2026-11-23)

Consolidate Received and Different amount into one action. The Actions list must clearly show which deposits have been received, amounts received and amounts outstanding. Use database records to prefill known information and keep the workflow consistent across screens. The detailed interaction proposal is in MULTI-DEPOSIT-UI-PROPOSAL.md.

## Owner clarification — test data, points and cancellation (2026-11-23)

- All current data is test data; the application is not in production. Preserving legacy bookings as production agreements is not required. Fixture conversion or reset belongs in the explicit implementation/migration plan; this clarification does not authorize an immediate database purge.
- Points discounts reduce only the final payment, capped at the final-payment amount and the existing 20% booking-price limit. Deposits are unchanged. My Okim must show the applied points discount and adjusted final payment. Existing instructor-controlled, pre-payment redemption and completion-only earning rules remain.
- Cancellation terms confirmed: diver withdrawal/nonpayment/no-show retains paid deposits and refunds any paid final-payment portion; operator cancellation refunds all paid amounts. Iris records the cancellation reason so clicking Cancel does not itself determine the money treatment. Previously agreed postponement accept-or-full-refund treatment remains.
- The reconciled MULTI-DEPOSIT-FLOW-SPEC.md supersedes the historical design below where they conflict. Implementation has not started.

## Owner amendment — simple payment workflow (2026-11-23)

**Locked in conversation:** one required deposit, an optional second deposit, and a final payment. Maximum two deposits; no separate rules based on how far away the trip is. Iris sets deposit amounts and absolute due dates; final payment is the trip price minus deposits. Payments cover the earliest unpaid amount first. Full settlement of deposit 1 confirms the place.

A booking reserves a place until Iris releases it. Missed payment deadlines show Overdue; there is no automatic expiry or release. Remove the separate 14-day hold and +7/+14 extension workflow. Later missed stages also require Iris's manual decision. Passed dates show Due now for late bookings; no separate late-booking window.

This amendment supersedes conflicting hold, expiry, extension and unlimited-deposit provisions below. The remaining detailed specification is a historical draft requiring reconciliation before implementation, not build authorization. Existing booking migration, cancellation/refund classification and points-discount limits still need explicit treatment in the final implementation specification. Earlier locked cancellation and notification decisions remain unless explicitly amended.


> Repository copy imported 2026-11-23 from OPC. This remains a pending design, not build authorization. Historical DB counts and runtime checks below were not reverified during import. Follow [current status](../STATUS.md) for implementation boundaries. References prefixed OPC identify the historical sibling archive.

Chat: multi-deposit workflow (from OPC/MULTI-DEPOSIT-FLOW-HANDOFF.md).
Status: DESIGN IN PROGRESS — nothing built. Rows lock one at a time (grill).
Depends on pricing rework #42 (`trip_deposits`, fixed deposits + due-days) — schema co-designed, not created twice.

## Historical decisions — superseded where amended above

The numbered rows below preserve the earlier discussion. Implement from MULTI-DEPOSIT-FLOW-SPEC.md; do not revive old holds, reminders, unlimited deposits or legacy-preservation requirements from this history.

| # | Decision | Detail |
|---|----------|--------|
| 1 | Slot permanent at deposit 1; later stages never auto-release | Capacity confirmed when deposit 1 received (unchanged from today). Each later stage (deposit 2…, balance) has its own due date; a missed stage flags the booking for Iris review — release/extend/cancel is a manual decision. Auto-expiry (14-day hold, capped at departure) applies only while nothing is paid. Partially-paid bookings never auto-expire. |
| 2 | Missed-stage mechanics: T-3 reminder per stage, Overdue card, no auto overdue email | T-3 reminder before each stage's due date, on-platform only (amended by #8 — no reminder email). Due date passes with no claim → Overdue card in Iris's Actions tab (diver name, trip, stage, amount, days overdue) with Extend +7/+14 and Release slot (deposits forfeited per #9 — no refund review for deposits); no status change, no automatic overdue email to diver — Iris decides. Diver's My Okim shows the stage overdue in red text only. |

| 3 | Due-days strictly descending, enforced at publish | deposit 1 > deposit 2 > … > balance due-days, all ≥ 0; no same-day stages (merge into one deposit instead). Balance always final stage = price − sum(deposits), due at balance_due_days. Validation in publishBlockers alongside sum(deposits) ≤ price; plain-language error names the offending row. Drafts save in any order — only publish is gated. **(Amended by #5: ordering now on absolute dates.)** |
| 4 | Late bookings: stages stay separate, past-due stages due immediately | No merging. At booking time each stage keeps its own amount and snapshot; stages whose due date already passed are "due now". Stages are sequential — only the next unpaid stage is expected/overdue-flagged, so deposit 2 isn't flagged until deposit 1 is received (no fake-overdue spam). 14-day hold + slot confirmation attach to deposit 1. If all stages past due → full price due now, still itemized. |
| 5 | Absolute dates stored (amends #42 due_days → due_date; supersedes #3's day-count ordering) | Jeff: trips rarely postponed, usually cancelled; shop deadlines are real dates. Settings rows: amount + date picker; balance due date is its own row (replaces balance_due_days). Publish gate: today < deposit 1 < deposit 2 < … < balance < departure, strictly ordered, error names the bad row; drafts save freely. Postponement (rare): changing departure re-validates at save, flags stage dates after new departure for manual fix. Late booking #4 unchanged. trip_deposits schema co-designed with #42 using due_date. |
| 6 | Received: one button, FIFO allocation across stages, append-only ledger | Received pre-filled with the expected stage's remaining amount; Different amount opens a field. Payments allocate FIFO: overpayment marks stage paid and carries into next; partial leaves stage partially paid (still expected, overdue flag still applies at its date). Stage paid when cumulative payments reach its boundary; slot confirms on the payment that completes deposit 1. No manual allocation UI. Every entry audited (amount, time, recorder); corrections only via refund entries. |
| 7 | Diver surfaces + documents: schedule everywhere; receipts/invoices never auto-sent | Wizard summary: itemized schedule (amount + actual date, "due now" if past), balance row, total; transfer instructions unchanged. My Okim booking card: compact schedule with per-stage status (Paid ✓ / Due now / Due date / Overdue red), one next-action card for expected stage's remaining amount. **Jeff amendment (clarified): receipts and invoices are NEVER emailed; BOTH are viewable on-platform by diver AND Iris.** Iris views/downloads anytime from the portal. Diver: receipt link appears when each payment is recorded (#8); invoice appears in My Okim after trip completed. One living invoice per booking; one receipt per Received event (amount, stages covered, running paid/remaining). |

| 8 | Exactly ONE email per booking lifecycle: "booking request received"; everything else on-platform | Single email at wizard submit: acknowledgment + full schedule + deposit-1 transfer instructions. No other lifecycle emails — supersedes #2's reminder email and removes today's T-3 reminder, confirmation and expiry emails. On-platform instead: T-3 stage reminders (My Okim), payment received (short status + receipt link appears for diver), slot confirmed, overdue (Iris card only), expiry/release status. Resend budget: 1 email/booking — trivially inside 100/day. |

| 9 | Deposits are NON-REFUNDABLE on diver-initiated exits | Jeff policy call. Diver withdraw / Iris release-slot / no-show → all verified deposit payments forfeited; booking cancelled, slot freed, no refund review for deposits (changes today's withdrawBooking paid→refund_flagged for deposit-only bookings). Points unchanged: cancelled bookings never complete, so forfeited deposits never earn points. Wizard shows "Deposits are non-refundable" (EN+中文) with a required acknowledgment click before submit; term goes into v2 policy draft (#31), never v1. Balance treatment + operator-cancelled-trip exception: Q10/Q11. |

| 10 | Non-refundable scope: diver-initiated exits only; operator-cancelled trip → full refund | Jeff confirmed. Iris cancels the trip (boat operator cancels, weather, min pax not reached) → every verified payment refunded INCLUDING deposits, via the existing refund review flow (external refund recorded, refundPayment entries). #9 forfeiture applies only to diver withdraw / release-slot / no-show. |

| 11 | Diver withdraw after full payment: balance refundable, deposits forfeited | Withdraw → refund review lists only the balance payment entries; deposit entries marked forfeited (#9). No time-window rules. Policy line: deposits non-refundable, balance refundable on withdrawal. |

| 12 | No-show = same money outcome as withdraw (Jeff: keep it simple) | One No-show action for Iris after departure, routes through the existing withdraw logic with reason no-show. Deposits forfeited (#9); paid balance → refund review (#11); unpaid balance waived — no chasing after departure. Nothing paid → cancelled. No points (never completed), no email (#8); diver sees status on My Okim. No new status or money logic. |

| 13 | Postponement: accept new dates or full refund (operator-initiated) | Departure change → each booked diver either accepts (booking snapshots unchanged) or exits with FULL refund including deposits via the existing refund review; Iris triggers per diver. Same principle as #10: non-refundable only covers diver-initiated exits. Trip stage dates re-validate per #5. |

| 14 | Policy term sheet published as v1 NOW (Jeff overrides the #31 freeze) | Jeff: "update policy term sheet and publish as v1" — supersedes #31's "v1 frozen until go-live / wording goes to v2 draft" for this content. The 6 clauses become the live v1 policy, bilingual EN+中文: schedule (#3–5), deposits non-refundable on diver-initiated exits (#9), balance refundable on withdraw/no-show (#11–12), operator-cancel → full refund (#10), postponement → accept or full refund (#13), slot confirmed at deposit 1 / missed stages reviewed not auto-released (#1–2). Wizard keeps the non-refundable acknowledgment click (#9). No commit without Jeff. **PUBLISHED** via `node scripts/seed-policies.ts` (v1-in-place upsert; portal editor only creates v2+): refund + terms v1 rewritten EN+中文, zero CJK, 5 refund situations + spec headings kept green (m6-policies), privacy unchanged, demo notice kept. Sibling note: `okim-dive/POLICY-V1-SIBLING-NOTE.md`. |

| 15 | Schema reconciled to absolute due_date (#5 wins); THIS chat implements after grilling + spec confirmation | Convert sibling #42's `trip_deposits.due_days` → `due_date` (date); balance gets its own due_date (replaces balanceDueDays). Rework schema.ts, trip-actions.ts (date parsing + ordering publish gate), trip-settings-editor.tsx (date pickers), trip-display.ts (derive dates). Legacy deposit_value/deposit_type synced to deposit #1 for interim wizard/Received. No double table. Jeff: this chat does the FULL implementation once grilling finishes and specs are confirmed — not now. Coordinate with portal-v2 sibling (uncommitted work in those files) at build time. |

## Historical open-question queue — consult reconciled specification
16. Policy: stale points wording in terms v1 clause 5 — align to #29/#30 (completion-only award, net cash, usable immediately, spent never restored)
17. UI: points discount across stages (code: redeemPoints reduces balanceAmount only, once, before payment)
18. UI: T-3 on-platform reminder surface (badge / #32 message / due-date highlight)
19. UI: Extend semantics with absolute dates; refund-review UI distinguishing forfeited deposits vs refundable balance
20. UI: wizard non-refundable acknowledgment (checkbox wording/placement); partial-stage display
21. UI: Settings date editor UX (date pickers, live ordering validation)
22. Migration: existing bookings keep single-deposit snapshots

## UI build tasks (implement locked rows, no new decision)

- Wizard + My Okim + invoice: itemized schedule (amount + date, "due now", per-stage status) — #7
- Receipt link on payment recorded; diver invoice after completion; Iris download anytime; never email — #7/#8
- Portal Received pre-filled next stage + Different amount (FIFO) — #6; Overdue card — #2; No-show button — #12; postponement refund trigger — #13
- Email: only booking-request-received; remove T-3/confirmation/expiry templates + fix portal help copy ("confirmation email with receipt" is now wrong) — #8
- Public trip page deposit schedule lines — #42

## Change-control (when all locked)

- MVP-SPEC row: pending (needs #42 schema reconciliation first — see flag)
- DESIGN-SYSTEM row: pending
- Sibling note: DONE for policy (`okim-dive/POLICY-V1-SIBLING-NOTE.md`); flow build note pending
- Policy v1: PUBLISHED (#14, overrides #31 freeze)

## Coord flags

- **due_date vs due_days**: now grilling as Q15. Sibling #42 built `trip_deposits.due_days` (uncommitted); #5 locked absolute `due_date`. Reconcile to ONE column; don't create the table twice.
- **Stale points wording**: now grilling as Q16. terms v1 clause 5 still describes the pre-#29/#30 points model.