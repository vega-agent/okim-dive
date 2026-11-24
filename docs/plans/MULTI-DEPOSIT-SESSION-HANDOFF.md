# Multiple deposit implementation handoff

**Updated 2026-11-24.** The staged payment workflow is implemented. The owner approved the hosted migration and replacement of identifiable test data with seven retained cases. Independent source reviews, focused financial tests and authenticated browser checks passed. Owner visual acceptance remains open. [Execution log](MULTI-DEPOSIT-EXECUTION-LOG.md) · [Review the seven cases](MULTI-DEPOSIT-REVIEW-FIXTURES.md)

## Task contract

Implement the owner-authorized workflow sequentially, with Astra High implementers and independent reviewers. Read [implementation plan](MULTI-DEPOSIT-IMPLEMENTATION-PLAN.md), [workflow specification](MULTI-DEPOSIT-FLOW-SPEC.md), [UI proposal](MULTI-DEPOSIT-UI-PROPOSAL.md), then relevant [deep audit](MULTI-DEPOSIT-PAYMENT-AUDIT.md) and [final check](MULTI-DEPOSIT-FINAL-CHECK.md). Start with AGENTS.md, CLAUDE.md, docs/STATUS.md and git status. The older MULTI-DEPOSIT-FLOW-PLAN.md is a decision HISTORY, not the execution plan.

## Owner decisions to preserve

- Maximum two deposits plus final payment; one deposit is valid. Absolute due dates. No separate rules for near/far trips.
- Booking reserves a place until Iris cancels it; deposit 1 fully paid confirms it. Remove 14-day expiry, +7/+14 extensions and T-3 reminder workflow.
- One Record payment action replaces Received/Different amount. Prefill next remaining amount and date; allow edits; calculate allocation automatically. List shows each stage received/outstanding and booking totals without opening a dialog.
- Points discount reduces final payment only, capped at final amount and 20% price. Show discount and adjusted final in My Okim. Existing pre-payment, completion-only earning and no-restoration rules remain.
- Diver withdrawal/nonpayment/no-show retains deposit money, refunds paid final portion. Operator cancellation or declined postponement refunds all cash. Capture category explicitly; refund progress is separate from cancellation.
- One booking lifecycle email, later updates/receipts on-platform; sign-in emails remain separate. Diver invoice after completion; instructor access anytime.
- All existing records are test data, not production. No permanent legacy engine required. The owner authorized cleanup of test data and creation of retained review cases. The cleanup used a reviewed manifest.

## Verification evidence

- The migration and fixture transactions each had a private backup and separate reconciliation. The lower-model tester independently confirmed the hosted totals in a read-only transaction. [Hosted verification](../../tests/financial-workflow-db/HOSTED-VERIFICATION.md)
- The tester reproduced capacity, overpayment and replay failures in the old action on disposable PostgreSQL. Subsequent local server-action runs covered those regressions, historical receipts, refund source allocation, final-only discounts and individual completion. [Legacy reproduction](../../tests/financial-workflow-db/LEGACY-REPRODUCTION.md)
- The port 3100 preview uses a private copy of the current implementation, loopback authentication and suppressed email. Signed-in browser inspection found narrow-screen schedule clipping before the Task 6 layout fix. The execution log records later results.

## Workspace and approval boundaries

Observed branch QwenWork-refactor, latest observed checkpoint eb8a0ed, many pre-existing tracked/untracked modifications. Concurrent design work advanced through #49/v1.33. Preserve all existing changes. Owner confirmed My Okim/Messages handoff in the implementation session; preserve existing Messages behavior. Do not reset/stash/clean/blanket-commit.

All sessions may share source, Neon and port 3100. Build separately and verify test DB isolation explicitly. Use zero real test emails, token-insert sign-in and bounded fixtures with cleanup. Full suite requires Jeff's quiet-window go. The old cron endpoint now requires its secret, returns manual-release status and performs no writes. This was tested directly.

No policy publication, source commit, push or deployment has been authorized. Owner visual acceptance remains open.

## Next action

Open the [owner preview](http://localhost:3100/portal) with the existing instructor sign-in and follow the [review walkthrough](MULTI-DEPOSIT-REVIEW-FIXTURES.md). The owner can accept the visual result or name the screen, language and width to revise. Keep the seven retained bookings for review. Every transient hosted financial fixture from the browser run was deleted.

The [verification receipt](../../tests/financial-workflow-db/HOSTED-VERIFICATION.md) identifies which assertions ran on migrated Neon and which ran on disposable PostgreSQL. The full shared-service suite is still gated on an explicit quiet-window request. Hosted policy publication, commit, push and deployment each require explicit owner authorization.
