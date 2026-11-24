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

Preview update, 2026-11-24. Commit `155576a` reached the preview branch. An isolated local build passed with 15 static pages. The [Vercel Preview build](https://vercel.com/vega-f28d/okim-dive/8p66P4GxKXULu5cy5n4dRTcb3yLX) failed. Read the authenticated build log before retrying. Hosted route verification is pending and production is on hold.

Jeff's team now owns a separate Vercel project, `jefflyts-projects/okim-dive`. The CLI refused an explicit Preview deployment of commit `155576a` with `first_deployment_production`. Vercel requires the first deployment in this project to target Production. The project is empty. No repository transfer, production deployment or domain change was made.

Jeff approved a blank static Production placeholder. Deployment 2HnwqTCcYYNDNcLx7rCoFPixG8qt is Ready at okim-dive-eta.vercel.app. The separate [app Preview](https://okim-dive-gix47vyiy-jefflyts-projects.vercel.app) is Ready from committed application files at 155576a. The first upload omitted assets referenced by CSS; the corrected upload built successfully. Homepage 200, signed-out My Okim 307 to /book, legacy /about.html 308 to /about, portal request 302 to Vercel SSO. Temporary automation bypass revoked. App database and email credentials were not configured on Vercel. No custom domain changes.

2026-11-24 hosted review update. The owner approved sharing the retained Neon review database and Okim Resend configuration with the Preview environment of jefflyts-projects/okim-dive. This [configured Preview](https://okim-dive-1ti2a7maz-jefflyts-projects.vercel.app/portal) supersedes the visual-only deployment. A hosted Chromium check loaded Auth.js's Resend provider, opened Record payment on PARTIAL and previewed MYR 350 with MYR 100 flowing to deposit 2, found the MYR 590 balance on POINTS, and read the MYR 950 combined receipt. No payment was submitted or test email sent. The temporary session was deleted and temporary Vercel automation access revoked. Interactive sign-in email delivery was not exercised. Production contains the blank placeholder.

Portal entry correction. The former preview threw Forbidden (digest 2307551768) when opened without an Okim instructor session. Start at the [corrected hosted portal](https://okim-dive-nz3hud8ih-jefflyts-projects.vercel.app/portal). Browser checks verified fresh desktop EN entry, mobile ZH deep-link entry, the form response with an unlisted test address, authorized allocation preview, discounted balance and the combined receipt. The local route/action regression passed. An isolated loopback Resend simulator captured an authorized synthetic instructor link and verified that it opened Actions. The harness required the same canonical localhost hostname throughout. No real email was sent. Temporary sessions, synthetic identities and automation access were cleaned up.

My Okim and Portal logout is available in the [updated preview](https://okim-dive-8o164r2za-jefflyts-projects.vercel.app/portal). Both header buttons end the current Okim session and return to the homepage. Hosted browser checks from each surface verified EN/ZH labels, 1280/390/320 px layouts, database session deletion, a signed-out Auth.js response and restricted access to both routes. An initial check saw a session cookie immediately after navigation; the subsequent run checked the database and revisited protected pages, and both logout paths passed. Temporary sessions and automation access were cleaned up.

Public account navigation. The owner requested both links for signed-out visitors, superseding the earlier role-based navigation visibility. Start at the [updated preview homepage](https://okim-dive-ffpjzm1lr-jefflyts-projects.vercel.app/). Hosted browser clicks reached both correct sign-in forms in English at 1280, 969 and 390 px and Chinese at 1280 and 320 px. Local email-catcher checks followed both magic links into their respective dashboards and confirmed a diver session could not enter Portal. No real test emails were sent. Synthetic identities were removed.

Sign-in visual revision. The [Preview](https://okim-dive-fhakri2gu-jefflyts-projects.vercel.app/) pairs each email form with an existing Okim watercolor. Chromium checks on both pages passed at 1440 px EN, 1280 px ZH, 390 px EN and 320 px ZH. Titles fit one line, the fixed header cleared the form, the submit button was on screen, keyboard focus moved from email to submit, and English form text passed the CJK scan. No emails sent. Owner visual acceptance pending.

Sign-in background revision. The owner accepted the sign-in cards and requested plain underwater watercolor behind them. The shared page background uses the [optimized WebP](../../public/assets/backgrounds/ocean/open-water-wash.webp) with a translucent wash. Built-in ImageGen prompt: “Wide landscape 3:2 background painting, edge to edge. Plain open tropical seawater viewed from underwater, looking horizontally into empty water. A quiet traditional wet-on-wet watercolor on fine cold-pressed paper. Luminous pale sea-glass turquoise above, gently deepening to muted ocean blue below, with delicate pigment granulation and barely visible broad wisps of filtered daylight. Understated atmospheric depth from top to bottom, no focal point. Water only. No horizon line, no sea floor, no rocks, sand, coral, vegetation, people, creatures, bubbles, boats, equipment, lettering or borders. Soft enough behind an existing dive website sign-in card.”

The updated [review preview](https://okim-dive-mfduixvz6-jefflyts-projects.vercel.app/myokim) loaded the 1536 × 1024 background on both signed-out pages. Browser checks covered EN at 1440/390 px and ZH at 1280/320 px. No form submissions or test emails.
