# Legacy payment action reproduction

The real `confirmReceived(FormData)` action failed the same three assertions in two runs on 23 November 2026. Each run used a schema-only clone of the migrated disposable PostgreSQL database at `127.0.0.1:55433`, in `okim_payment_action_rehearsal`. Instructor context, email delivery, and Next.js cache invalidation were stubbed in the test process. The action ran real transactions and post-commit database writes.

| Case | Observed | Expected |
|---|---|---|
| Confirmed diver on a full trip pays the MYR 800.00 final amount | Receipt saved and booking moved to `refund_flagged` | Receipt saved and booking stays `confirmed` |
| Retry identical MYR 200.00 first-deposit request | `Operation key reused`; one claim and payment remain | Success for the original receipt; one claim and payment remain |
| MYR 1,000.01 received with MYR 1,000.00 outstanding | MYR 1,000.01 payment and claim saved; booking moved to `confirmed` | Error, zero claim/payment rows, and original booking state |

The legacy capacity check counts the existing confirmed booking as occupied before flagging it. Retry validation compares the new inferred payment kind with the original kind after the first deposit changes the next stage. Amount validation rejects nonpositive values and lacks a remaining-balance ceiling.

Run the quarantined reproducer with `./node_modules/.bin/tsx --test tests/financial-workflow-db/legacy-confirm-received.cjs` while the legacy export is present. Both runs returned exit 1 with three failed assertions. Each run recorded four synthetic instructor invocations, three stubbed email attempts, zero real sends, and zero remaining fixtures across eight tables.
