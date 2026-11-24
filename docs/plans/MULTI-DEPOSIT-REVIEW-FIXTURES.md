# Payment review fixtures

**23 November 2026.** Owner requested replacement of obsolete test records with retained examples. The schema migration and this data replacement are separate transactions. The shared-target dry run found zero blockers and the local rehearsal passed. The parent then applied the reviewed digest to the hosted database. The committed transaction receipt is in `/tmp/okim-review-hosted-result.log`. [Execution log](MULTI-DEPOSIT-EXECUTION-LOG.md)

The direct target is `ep-purple-paper-ao84nvvx.c-2.ap-southeast-1.aws.neon.tech:5432/neondb` in Neon project `restless-mouse-32313871`. The reviewed replacement SHA-256 is `d0e294cd3bbc044a953fe529c56bf2ea7ea5e971e7fd36b597cb46c1b0c5df57`. It binds the exact target, obsolete record contents, supporting facts, implementation and all inserted values.

## What the owner can review

Use the existing instructor sign-in on the [port 3100 preview](http://localhost:3100/portal). To review without changing the examples:

1. Open **Actions → Payments to receive** and find Nadia’s PARTIAL booking. The first deposit shows MYR 250 received and MYR 250 outstanding. Open **Record payment**, type 350, and check that MYR 250 completes deposit 1 and MYR 100 goes to deposit 2. Close the dialog to keep the example intact.
2. In [My Okim](http://localhost:3100/myokim), open **Upcoming trips**. POINTS shows MYR 50 off the original MYR 840 final, MYR 200 received toward it and MYR 590 remaining. COMBINED shows one receipt spread across deposit 2 and final. [Combined receipt](http://localhost:3100/receipt/PAY-REVIEW-COMBINED-2)
3. Under **Past trips**, expand **Payment details** on REFUND. Check MYR 1,200 retained, MYR 300 agreed for refund, MYR 100 already refunded and MYR 200 still due. HISTORY has the settled invoice and earned the points used on POINTS. [Completed invoice](http://localhost:3100/invoice/BKG-REVIEW-HISTORY)
4. For ZERO, use **Portal → Trips → All bookings**, select the sample reef day and open **Payment schedule**. The final is MYR 0 and has no due date. Switch the page language to review either language on desktop or phone-width layouts.

The saved screenshots show the [desktop schedule](../reports/multi-deposit-preview/action-en-1280.png), [Chinese mobile payment dialog](../reports/multi-deposit-preview/dialog-zh-390.png), [adjusted final](../reports/multi-deposit-preview/upcoming-POINTS-en-1280.png), [refund accounting](../reports/multi-deposit-preview/past-REFUND-en-1280.png) and the [Chinese mobile booking wizard](../reports/multi-deposit-preview/wizard-zh-390.png). Identifying dialog context was masked in the mobile capture.

All figures are synthetic MYR. The CUS-001 examples reuse the existing demo-linked instructor customer so the owner can see both sides of the same booking through My Okim and the portal. Three fictitious profiles have English display names prefixed with “Sample ·”, use example.com, and have no sign-in account. All new trip titles are bilingual and labelled as samples, with publication disabled. No contact details, declarations of medical suitability or claims of real consent are generated. Each synthetic receipt carries its own bank date, stage allocations, running balances and provenance.

| Booking ID suffix after BKG-REVIEW- | Where | State on 23 Nov | Gross paid | Refunded | Unpaid | Refund due |
|---|---|---|---:|---:|---:|---:|
| HISTORY | Owner · Past | Completed after the trip. One receipt covers D1 500 and final 2,500. Earns 3,000 points at completion. | 3,000 | 0 | 0 | 0 |
| POINTS | Owner · Upcoming | On existing TRP-004. Spend 1,000 earned points for 50 off final. D1 360 settled, 200 received toward adjusted final 790. | 560 | 0 | 590 | 0 |
| COMBINED | Owner · Upcoming | D1 500 settled. Second receipt of 950 covers D2 700 and final 250. | 1,450 | 0 | 1,550 | 0 |
| REFUND | Owner · Past / refund queue | Diver withdrew. Deposits of 1,200 retained; paid final portion 300 refundable. A source-linked refund of 100 leaves 200 due. | 1,500 | 100 | 0 | 200 |
| PARTIAL | Portal · Sample · Nadia Tan | D1 due 16 Nov. Received 250 of 500. Remainder overdue. | 250 | 0 | 2,750 | 0 |
| RESERVED | Portal · Sample · Kai Lim | Late booking with no cash yet. Place reserved, D1 due now. | 0 | 0 | 3,000 | 0 |
| ZERO | Portal · Sample · Jun Lee | Fully paid one-deposit booking. Final amount is zero, no final date. Remains confirmed until participation is recorded. | 600 | 0 | 0 | 0 |

REFUND was cancelled and partly refunded before the same owner booked COMBINED on that trip. The active bookings do not duplicate a customer’s place on a trip. The two-deposit trip price is 3,000 with D1 500, D2 700 and final 1,800. The owner’s points lot has 2,000 available after the redemption. Fixed historical dates keep original receipts reproducible. Overdue labels will advance with the clock.

The replacement inserts 3 synthetic customers, 3 unpublished sample trips, 4 deposit definitions, 7 bookings, 18 stages, 7 invoices, 9 verified claims, 10 payment/refund receipts, 13 allocations, 2 linked points entries and 20 event audits plus the single replacement marker. Three existing trip definitions with deposit dates remain available for review alongside the original on-request trip. [Retained data definitions](../../scripts/payment-review-data.ts)

## Obsolete records and retained history

| Removed by exact identity | Rows | Basis |
|---|---:|---|
| Trips and deposit definitions | 12 trips, 1 deposit | Test-title/test-slug drafts TRP-005 through TRP-008, empty untitled TRP-009 through TRP-015 and legacy TRP-DEMO-01 with its D1 definition |
| Previous financial fixtures | 6 bookings, 12 stages, 6 invoices, 5 claims, 5 payments, 6 allocations, 3 points entries | BKG-DEMO-01 through BKG-DEMO-06 and their identified dependents |
| Sample profiles | 4 | CUS-DEMO-01 through CUS-DEMO-04, no linked users |
| Orphaned test identities | 10 users, 10 sessions | Exact customer-role user IDs, example-domain identifiers, no linked customer or provider account |
| Superseded fixture audits | 23 | Exact audited entities. Current trip creation timestamp excludes historical entries for earlier trips that reused the same ID. |

The prior-trip audit rows `a186a603-2518-4899-ae1c-ccefcead6c7a` and `97726969-5dae-4fb9-838a-27f2f4b5dedc` fall before their current trip’s creation and remain. The candidate ID file lists the exact accounts, trips, claims, payments, invoices, ledger entries and audits. Sessions are identified by the ten fixture user IDs. Session token values never appear in reports. Allocation and stage IDs come from the named old payments and bookings. The full per-table projection is in the machine report at `/tmp/okim-payment-review-hosted-report.json`. [Obsolete ID allowlist](../../scripts/payment-review-obsolete.json)

Preserve TRP-001 through TRP-004 and their authored content, the three existing linked customer profiles and users, the two published Messages and existing read, all policies/settings, migration history and older audit history without positive fixture provenance. Instructor sessions were checked without returning their tokens. All 1,368 were unexpired UUIDv4 tokens. The test callback and normal sign-in both ask Auth.js to issue these opaque tokens. None had a recognizable test label, and no stored origin distinguishes a test from a valid owner login. Rotating these sessions would log the owner out.

## Apply and verification

The default command is a batched read-only transaction. The guarded apply requires both the exact target and matching report fingerprint. It takes a protected custom-format database backup, inventories the archive, locks the affected tables, checks the source again and commits deletion, seed, financial checks and audit marker together. An identical rerun returns zero changes and preserves edits made while reviewing the examples. Use PostgreSQL 18-compatible client tools for Neon, including `pg_dump` and `pg_restore`. The local installation is under `/opt/homebrew/opt/libpq/bin`. [Fixture runner](../../scripts/reset-payment-review-fixtures.ts)

The rehearsal ran against `127.0.0.1:55433/okim_review_fixtures` on the full migrated schema with synthetic baseline rows and exact legacy IDs. An injected failure at replacement booking insertion restored the original trips, bookings, cash, identities and sessions. A clean apply produced the seven reviewed states and replay returned zero changes. A fingerprint covering retained trip rows, the owner profile/session, policies, settings and Messages stayed identical. There were zero cross-booking allocations and zero orphan refunds. TypeScript, scoped ESLint, the 26-test pure suite and whitespace checks passed. Local transaction evidence is in `/tmp/okim-review-local-verification.log`. The dedicated local rehearsal database was then removed and the local database catalog showed zero remaining copies under that name. The retained examples on the hosted review database remain. No email transports run in the fixture script.
