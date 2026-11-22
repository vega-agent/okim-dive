# Okim Dive — Agent Working Rules

These rules apply to every agent working in this repository, regardless of model or provider.

## Required reading by task

- **Any code, page, content, UX, or image work:** read `docs/design/OKIM-DIVE-VIBE.md`.
- **Copy or content work:** also read `docs/design/CONTENT-REVIEW-CHECKLIST.md`.
- **Visual, layout, typography, image, or bilingual/i18n work:** read `docs/design/BRAND-GUIDE.md` and `docs/design/DESIGN-SYSTEM.md` (including §13 app surfaces and §14 locale handling) BEFORE editing, and audit the rendered result against them. Redesigns extend the approved visual language; they never introduce a new one.
- **Bilingual hard rule (DESIGN-SYSTEM §14):** one language at a time — never hardcode "English / 中文" literals; locale-dependent UI lives in client components; EN surfaces contain zero CJK except the language switcher; user-entered data displays as submitted.
- **Project scope or route changes:** also read `docs/design/PRD.md`.

Do not read every reference file by default. Read only what the task requires.

## Core rule

> **Learn with care. Explore with wonder.**

New work must feel like Okim Dive: warm, nature-loving, safety-conscious, quietly adventurous, and visually thoughtful.

## Content guardrail

Every new sentence, section, image, or decoration must earn its space by helping visitors understand, decide, prepare, or feel more confident. Do not add filler, repeat a clear heading, or carry over unapproved Okim Explorer content.

Use verified current Okim Dive facts only. Ask before publishing uncertain claims about safety, health, certification, pricing, availability, payment, booking, facilities, or conservation.

## Delivery guardrail

Inspect existing source and rendered output before editing. For content changes, check English and Simplified Chinese and run the content checklist. For visual changes, inspect desktop and mobile rendering. Run the repository's validation commands before handoff.

Never publish credentials, bank details, passwords, API keys, tokens, or connection strings.

## External-service discipline (databases, email, all APIs) — owner rule 2026-11-22

**General rule, every project — not just this one.** Hosted databases (Neon, Supabase, any provider), email senders (Resend, etc.), and third-party APIs all run on plans with rate limits, quotas, and storage caps — usually free tiers. Treat every external call as a budgeted resource. Testing must be done properly and as required, never by blasting massive test traffic at a live service.

- **Test surgically.** Make only the requests a test needs to prove its claim. No mass fixture floods, no retry storms, no polling loops, no brute-force re-runs against live services. One well-designed assertion beats ten blind attempts.
- **Default to zero live side effects in tests:** stub or skip external sends where possible; use provider-rejected recipient domains for email fixtures; insert auth tokens directly instead of requesting real sign-in emails; delete every fixture you create — storage caps are real.
- **Know the plan's limits before any heavy run** (daily quota, rate limit, storage). Check usage/send logs before and after. When a limit is hit, stop and report — never retry-loop through it.
- **Minimize DB traffic:** batch reads instead of per-row loops, no speculative writes, no unnecessary schema pushes or migrations.
- **Real side effects** (live emails, paid API calls, production writes) **only when explicitly required and owner-approved.**

Current plan facts for this repo (verified): Resend free = 100 emails/day, resets UTC midnight (08:00 local); `@example.com` is API-rejected (free) but `@example.invalid` is ACCEPTED → queues → bounces → COUNTS against quota (two specs burned ~54 sends per run this way, 2026-11-22). Neon free ≈ 0.5 GB, no FK cascades — purge fixtures in dependency order inside one transaction; never accept `db:push` truncate prompts. Okim test budget: token-insert sign-in, zero real sends except the 2 owner-approved desktop canaries per full suite; full suite only in a quiet window with Jeff's go-ahead, one runner at a time. This Resend key is Okim Dive's only — other projects (e.g. FJ SafeSpace) must not share it.

See `CLAUDE.md` for the concise implementation and handoff checklist. `CLAUDE.md` is retained as a compatibility filename; these rules apply equally to Vega, Claude, Codex, and other agents.
