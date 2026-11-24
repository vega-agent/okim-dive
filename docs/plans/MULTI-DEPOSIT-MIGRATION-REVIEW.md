# Multi-deposit migration approval review

**Decision pending, 23 November 2026.** Approve the following conversion of test fixtures on Neon project `restless-mouse-32313871`, branch label `production`, database `neondb`. The direct target is `ep-purple-paper-ao84nvvx.c-2.ap-southeast-1.aws.neon.tech:5432/neondb`. Hosted checks used read-only transactions. The shared database and owner preview on port 3100 have received no migration writes or restarts.

**Reviewed report SHA-256** `81bda1da00a5e9ce392633662309900a1512497c24e9cdd8a7de65f0df2da63b`. This binds the target, legacy source facts, relevant catalog, migration code, calculator and complete proposed writes. Any change requires a fresh matching report and review.

## Exact fixture treatment

The hosted read found 16 trips, 4 deposit definitions, 6 bookings, 5 verified claims and 5 verified payments. No refunds, cancelled bookings, duplicate deposit positions, third deposits, or ambiguous payment sources were found. All legacy columns, existing financial entries, booking statuses and receipt numbers are preserved.

| Trip and deposit row updated | Deposit due | Final due |
|---|---|---|
| TRP-002 / TRP-002-D1 | 2027-07-14 | 2027-08-13 |
| TRP-003 / TRP-003-D1 | 2027-07-22 | 2027-08-21 |
| TRP-004 / TRP-004-D1 | 2026-10-13 | 2026-11-12 |
| TRP-DEMO-01 / TRP-DEMO-01-D1 | 2026-08-11 | 2026-09-10 |

Each deadline subtracts the existing day offset from the departure's local calendar date. The legacy timezone-less timestamp encodes a UTC instant. For example, TRP-DEMO-01 departs on 10 October in Kuala Lumpur even though the stored UTC date is 9 October. The migration uses the current trip dates to reconstruct these test snapshots. Historical booking-time dates were never stored.

Twelve unbooked trips lack a departure and deposit rows. Leave all twelve incomplete with null new dates. The ten drafts are TRP-005, TRP-006, TRP-007, TRP-008, TRP-010, TRP-011, TRP-012, TRP-013, TRP-014 and TRP-015. TRP-001 is on request. TRP-009 is a cancelled trip with no booking to reclassify.

| Booking | Original MYR | D1 / original final MYR | Receipt payment ID | Bank date | Allocate to D1 / final MYR | Remaining MYR |
|---|---:|---:|---|---|---:|---:|
| BKG-DEMO-01 | 1,200 | 360 / 840 | PAY-DEMO-01 | 2026-11-18 | 360 / 0 | 840 |
| BKG-DEMO-02 | 1,000 | 300 / 700 | PAY-DEMO-02 | 2026-09-20 | 300 / 700 | 0 |
| BKG-DEMO-03 | 1,200 | 360 / 840 | PAY-569ad12b-726c-42b9-bc16-a733141e4735 | 2026-11-23 | 360 / 0 | 840 |
| BKG-DEMO-04 | 1,200 | 360 / 840 | PAY-a42b197d-bc3f-453d-990c-137e879516c0 | 2026-11-22 | 360 / 0 | 840 |
| BKG-DEMO-05 | 1,200 | 360 / 840 | None | — | 0 / 0 | 1,200 |
| BKG-DEMO-06 | 1,200 | 360 / 840 | PAY-DEMO-06 | 2026-11-20 | 360 / 0 | 840 |

BKG-DEMO-02 uses TRP-DEMO-01's dates. The other five use TRP-004's dates. All six receive the snapshotted timezone `Asia/Kuala_Lumpur` and revision zero. Each gets exactly two stage IDs formed from its booking ID and the suffixes `-D1` and `-FINAL`, at positions 1 and 3. Price uses stored booking deposit plus stored balance plus discount. All six discounts are zero or null. The five original claims retain their IDs and amounts. No receipt is created for BKG-DEMO-05.

The proposed writes are four trip dates, four deposit dates, six booking headers, twelve stage inserts, six allocation inserts, five payment snapshot updates and one audit insert with ID `payment-schedule-20261123`. The snapshots have schema version 1 and provenance `reconstructed_test_fixture`. Each records actual claim bank date, verified timestamp, this payment’s stage amounts and receipt-time totals. The audit lists the booking IDs and reconstructed payment IDs. No rows are deleted. The migration does not write to accounts, policies, settings, invoices, claims, points or email services.

**Reconciliation in MYR.** Original booked amounts total 7,000.00, comprising 2,100.00 in deposits and 4,900.00 in final payments. Of the 2,440.00 received, 1,740.00 goes to deposits and 700.00 to final payments. The six bookings have 4,560.00 remaining.

## Schema and execution

Two new tables store booking stages and payment allocations. Additive columns store absolute dates, booked price and timezone, operation key, acknowledgment timestamp, payment revision, cancellation/refund terms and receipt snapshot. Position, uniqueness, FK and monetary checks reject invalid rows. A booking requires price and timezone after the backfill. The Drizzle definition and SQL declare the same checks. The dry run found all 38 expected new table, column, index and constraint entries absent, as expected for this target. The full per-object list and planned writes are in the machine report.

- Default command from the repository root: `./node_modules/.bin/tsx scripts/migrate-payment-schedule.ts`. The transaction uses repeatable read, read only, the direct endpoint and verified TLS. It reads one snapshot of the relevant financial fields and schema. Personal contact fields, bank instructions and secrets are excluded.
- Apply requires both the exact target and the approved report fingerprint. The runner takes a private custom-format database backup, checks its archive inventory, then locks the affected tables and rechecks source and catalog inside one write transaction. The SQL checks per-payment allocations and booked amount reconciliation before commit. A failure rolls the whole transaction back. A duplicate application with the same approval recognizes the audit marker without taking another backup or writing.
- An ambiguous cancellation, absent verified claim or paid date, unmatched source, unsupported partial refund across multiple source stages, invalid active schedule or partial schema blocks the whole transition. Review the exact reported IDs separately. A legacy refund verification timestamp alone does not establish its bank date.
- **Cutover requires downtime for the old app.** The old release queries and inserts different booking fields. In particular, old booking inserts fail the new booked price/timezone check. Coordinate a quiet window and stop the old preview on 3100 and any other writers before a hosted apply. Keep them stopped until compatible code is verified or rollback is completed. The owner’s current preview remains available pending that decision. Hosted approval alone does not authorize policy publication, deployment, fixture deletion or unrelated writes.

### Recovery

The runner prints the private archive path before mutation. Preserve that backup in a protected location for the cutover. If the transaction fails, inspect the error, check the legacy state read-only and return the old app to service when confirmed. After a successful commit, restoring the old application also requires its compatible database. Restore the archive into a separate empty recovery database, verify source totals and schema, and obtain authorization before redirecting service or replacing a shared target. Later writes need reconciliation before a recovery cutover. Avoid restoring over a live database.

## Local rehearsal receipts

PostgreSQL 17.12 on `127.0.0.1:55433` used the complete pre-change Drizzle schema and a reproduction of the projected financial facts with synthetic identity, settings and points rows. The source-facts SHA-256 matched the hosted report. The two targets have distinct catalog fingerprints and approval hashes.

| Check | Observed result |
|---|---|
| Injected failure on payment snapshot update, after table creation and allocation insert | Transaction rolled back. Both tables, new date/price/snapshot fields and migration marker absent. All legacy money totals matched. |
| Apply once, then replay approved command | First apply created 12 stages, 6 allocations totaling 2,440.00, 5 snapshots and 1 marker. Replay returned zero changes. Touched-row fingerprint stayed identical. |
| Legacy money and sentinels | Before and after matched for trip prices, deposit definitions, booked deposits/balances/discounts, claims, received and RM amounts, refunds, points and customer/settings counts. |
| Restore and raw-SQL guard | Pre-migration archive restored into the empty disposable database. Six original bookings and 2,440.00 received were present, with neither new table. Executing the raw SQL directly failed before the first ALTER. |
| Schema probes | Valid deposit 2 represented at position 2. Nine invalid inserts/updates were rejected, including nonfinite cash, invalid/duplicate stage positions and missing positive-stage dates. Probe transaction rolled back. |
| Fixture cleanup | All named local financial, customer and settings fixtures removed in FK order. Zero remaining across ten tables. Three intermediate disposable rehearsal databases removed. The final local schema and its one migration audit marker remain. |
| Pure and source checks | 26 pure tests passed including six migration-report cases. Full TypeScript, scoped ESLint and `git diff --check` passed. |

The host preflight report is at `/tmp/okim-task2-hosted-dry.json`. Local verification, injection, replay, restore, constraints and cleanup receipts use `/tmp/okim-task2-*.log`. These are local session files. Source hash is `693355b6a092cacfe09dbffa0b0ab557a131a3dd2f43eb8fccd10fb94dcb01af`. Hosted catalog hash is `0a94bcc9f050aa459f7bb16fafb08012da04826da2b5d16fcb4f24e2704c7c58`. The checked code hash is `9bb35a48d790e3a00f2af353b39744d4bb34b38c4f41be1c09ec6cda45731f5d`.

The hosted target still uses the legacy schema. Application flow, rendering and visual acceptance are later tasks.
