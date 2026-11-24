# Okim Dive current status

Updated 2026-11-24 from the working tree, migration receipts and browser verification. This is the repository entry point for continuation; it is not a deployment or live-database verification receipt.

## Authority and history

- `AGENTS.md` and `CLAUDE.md` govern work. [MVP-SPEC](design/MVP-SPEC.md) change-control decisions through #50 govern approved product behavior; later explicit amendments supersede earlier wording. [DESIGN-SYSTEM](design/DESIGN-SYSTEM.md) is v1.34.
- Code establishes what is implemented; an approved requirement does not establish that it has shipped. Draft recommendations remain proposals.
- Earlier documentation and screenshots are in the sibling `../OPC` directory (relative to the repository root). Necessary pending multi-deposit records are now preserved in [docs/plans](plans/). OPC backups and dated reports remain historical evidence, not current runbooks.
- Branch observed: `QwenWork-refactor`; checkpoint `eb8a0ed`. Substantial uncommitted application work is present. Preserve it and inspect `git status` and root ownership notes before editing.

## Implemented in the working tree

- Next.js public website, DB-backed trips and inquiries, magic-link booking, instructor portal, My Okim, policy pages, authorized print-ready invoices/receipts.
- Portal tabs: Actions / Trips / Money / Settings. Trip editors use a sticky header, white icon actions and field-level publication blockers. New trip creates a draft directly; `/portal/trips/new` was removed.
- Trip settings own names and location facts. Display lines derive from facts; manual display overrides are removed. Country and matched dive-site references supply location details. Chrome on-device translation is optional draft assistance, hidden when unsupported.
- Trips define one required deposit and an optional second deposit with absolute dates. Booking reserves capacity and snapshots the schedule and rate. A single Record payment action allocates cash to the earliest unpaid stage and confirms the booking when deposit 1 is fully covered.
- Editor launch actions accept draft/open/closed. Existing Tioman On request remains a public contact flow; general inquiries and full-trip interest registration remain.
- Individual completion awards points once from net verified cash; payment receipt alone awards none. Redeemed points are not restored. Trip Messages are delivered on-platform.
- Database HTTP reads force `cache: 'no-store'`. Financial transactions use the separate transactional connection.

## Multiple deposit continuation

Tasks 0–7 of the [authorized implementation plan](plans/MULTI-DEPOSIT-IMPLEMENTATION-PLAN.md) passed their gates. The [approved migration](plans/MULTI-DEPOSIT-MIGRATION-REVIEW.md) and separate replacement of identifiable test data with seven retained scenarios committed on Neon. The owner preview on port 3100 is running an isolated copy with email suppressed. See the [handoff](plans/MULTI-DEPOSIT-SESSION-HANDOFF.md) and [execution log](plans/MULTI-DEPOSIT-EXECUTION-LOG.md).

## Outstanding work and conflicts

| Item | State and next action |
|---|---|
| Multi-deposit booking | The working tree implements the staged workflow. Local gate results were 34 pure tests, 21 guarded integration/browser tests, 5 additional disposable PostgreSQL regressions and 9 independent real-action scenarios. Lower-model browser checks exercised booking, staged receipts, cancellation, refunds and document access on migrated Neon. Owner visual acceptance is pending. [Review cases](plans/MULTI-DEPOSIT-REVIEW-FIXTURES.md) · [Browser and cleanup evidence](../tests/financial-workflow-db/HOSTED-VERIFICATION.md) |
| Published policy | Unpublished EN/CN policy source uses manual release, source-based refunds and final-only points discounts. The insert-only seed preserves existing accepted text. Publication of any replacement version requires separate owner authorization. |
| Tests | A focused runner exercises the migrated financial paths without invoking the shared-service suite. Some broader UI specs have updated fixtures/expectations and have not been run against shared services. [Execution log](plans/MULTI-DEPOSIT-EXECUTION-LOG.md) |
| Email failure reporting | Auth sends throw an ordinary Error on provider failure; the historical handoff flags possible false “check your email” success. Verify and fix error propagation before release. |
| Release hardening | PDF rendering beyond print-ready views, backup/restore, retention, production cutover and deployment remain items for a scoped release review. Preview commit `155576a` selects Next.js and redirects legacy HTML URLs. The isolated local build passed. The app Preview is Ready on jefflyts-projects. The approved blank placeholder occupies Production. The configured Preview uses the shared review data. Hosted browser checks verified signed-out portal sign-in in EN and ZH, instructor allocation preview, discounted diver balance and a combined receipt. An isolated mail catcher verified the instructor sign-in callback. No test email was sent. Do not infer completion from old milestone checklists. |

## Working and verification boundaries

All sessions may share the worktree, configured Neon database and port 3100. Check active work before rebuilding. Use an isolated build directory for concurrent verification, with matching AUTH_URL/browser host; it does not isolate the database. The authenticated former sweep endpoint is a no-op. Local financial checks use disposable PostgreSQL on port 55433.

Follow AGENTS.md’s service budget: token-insert authentication, no real sends except approved canaries, one runner, and fixture cleanup in dependency order. Never accept schema-tool truncation prompts. Keep bank instructions and credentials out of documentation.

The root `TRIP-MESSAGES-OWNERSHIP-NOTE.md` still marks Messages/My Okim ownership. Read it and `PORTAL-V2-SIBLING-NOTE.md` / `TRANSLATE-BUTTON-SIBLING-NOTE.md` before related edits. Owner explicitly confirmed My Okim/Messages handoff in the multi-deposit implementation session on 2026-11-23. Preserve Messages behavior. Port 3100 is the owner preview; the other preview on 3220 was stopped at owner request.

For application changes: lint/typecheck, scoped tests, build and rendered checks appropriate to the change. Full suite, shared-preview rebuild and release actions retain their coordination/authorization gates. Test emails are disabled on the owner preview.
