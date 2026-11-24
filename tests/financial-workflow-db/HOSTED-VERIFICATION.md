# Hosted payment review fixture verification

On 23 November 2026, one repeatable-read, read-only transaction on the approved hosted database confirmed the replacement marker for SHA-256 `d0e294cd3bbc044a953fe529c56bf2ea7ea5e971e7fd36b597cb46c1b0c5df57`. The check used verified TLS and returned only aggregate evidence in its receipt. It wrote no data, sent no emails, and returned no contact details or session tokens. [Approved fixture plan](../../docs/plans/MULTI-DEPOSIT-REVIEW-FIXTURES.md)

| Fixture | Stored booking state | Gross paid (MYR) | Refunded (MYR) | Unpaid (MYR) | Refund due (MYR) |
|---|---|---:|---:|---:|---:|
| HISTORY | Completed | 3,000 | 0 | 0 | 0 |
| POINTS | Confirmed | 560 | 0 | 590 | 0 |
| COMBINED | Confirmed | 1,450 | 0 | 1,550 | 0 |
| REFUND | Cancelled | 1,500 | 100 | 0 | 200 |
| PARTIAL | Awaiting deposit | 250 | 0 | 2,750 | 0 |
| RESERVED | Awaiting deposit | 0 | 0 | 3,000 | 0 |
| ZERO | Confirmed | 600 | 0 | 0 | 0 |
| **Total** | | **7,360** | **100** | **7,890** | **200** |

- All 18 booked stages, 13 allocations, and 10 receipt snapshots matched the reviewed seed. The nine cash receipts matched their verified claims and bank dates. The refund linked to its original payment, and the final stage of ZERO stored a zero amount and null due date. There were zero cross-booking allocations and zero duplicate reserved places.
- HISTORY earned 3,000 points on completion. POINTS redeemed 1,000 from that lot for MYR 50 off the final stage, leaving 2,000 points. All seven invoices, 20 fixture audit events, three unlinked sample profiles, three unpublished sample trips, and four new deposit definitions were present.
- All approved obsolete records were absent across 13 tables, including 10 test users and their 10 sessions. The preflight projections matched for four retained trips, three deposit definitions, three linked profiles and users, two Messages and one read, three policy versions, and 39 retained audits, including both specifically protected prior-trip audits. Settings keys and the projected points rules matched. The instructor session count remained 1,368.

Protected-record verification covers the identity and metadata captured at preflight. Full authored bodies and individual session token values were outside that comparison. This receipt covers stored state. Browser journeys and action behavior require the compatible application preview.

## Synced preview browser receipts

The first hosted browser attempt signed in through the token-insert callback and submitted the booking form with both policy controls checked. The server returned HTTP 200. The test timed out waiting for the confirmation reference and did not capture a validation alert or pre-cleanup financial counts. Cleanup verified zero fixture residue across 16 tables. The original response outcome is undetermined.

The corrected pass selected equipment as an explicit hydration check and observed the booking confirmation reference. It verified the English desktop wizard, per-stage and total amounts in the instructor portal and My Okim, and the actual bank dates and stage allocations on both receipts. MYR 75.00 settled part of Deposit 1. The MYR 575.00 receipt covered the remaining MYR 125.00 of Deposit 1, all MYR 300.00 of Deposit 2 and MYR 150.00 of the final stage. The diver withdrawal showed MYR 500.00 retained and MYR 150.00 refundable. Recording MYR 60.00 then MYR 90.00 first reduced the queue to MYR 90.00 and then removed the booking from it. Both refunds appeared in My Okim.

Before cleanup, the corrected pass found one cancelled booking, three stages, two verified claims, four receipts, six allocations, one invoice, one policy-acceptance audit, MYR 150.00 in source-linked refunds and zero awarded points. Cleanup verified zero fixture residue across 16 tables. The command stopped after the full refund because its receipt-history selector matched both MYR 75.00 and MYR 575.00. The harness now uses the previously captured exact receipt link.

The three updated local regression specs separately passed against disposable PostgreSQL. They exercised document ownership and role gates, payment and refund action authorization, ineligible completion, exact source-rate awards, legacy expiry preservation, cumulative reversal, the redemption cap, replay, and expired-lot write-off. These cases called the app entry points with synthetic sessions.

The follow-up browser pass read retained fixtures using temporary authentication. The first auth-only attempt confirmed the anonymous route returned redirects through `/book` to `/trips`; its assertion expected the intermediate route. Cleanup confirmed zero financial fixtures and zero residue. The corrected auth-only pass exited successfully. Anonymous viewers were redirected to `/trips`. An unrelated signed-in diver received 404 for the retained receipt and invoice and could not enter the instructor portal. The instructor saw the retained MYR 50 final-stage discount, the MYR 3,000 completed invoice, and a paid zero final stage with no due date.

The retained combined receipt showed the 19 November bank date, MYR 700 allocated to Deposit 2 and MYR 250 to the final stage. It rendered the same English text after reload. The 390 px Chinese mobile check confirmed localized receipt allocations and the retained cancelled booking's MYR 200 still to refund, with no horizontal page overflow. The temporary sessions and identity were deleted. The final cleanup found zero rows across all 16 scoped tables and found no created financial rows before deletion. This browser evidence spans the mutation and retained read passes. Reopening the newly created MYR 75 receipt after its later payments and refunds was not rerun against hosted data. Its invariance after later actions was verified by the local action suite.
