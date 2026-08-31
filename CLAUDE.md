# Okim Dive — Coding and Content Rules

This is the concise implementation guide for all agents. Start with `AGENTS.md`; use the linked reference documents only when the task requires them.

## Before editing

1. Inspect the current source, data, and rendered page.
2. Read `docs/design/OKIM-DIVE-VIBE.md` for every content, UX, page, or image task.
3. Read `docs/design/CONTENT-REVIEW-CHECKLIST.md` for copy/content changes.
4. Read `docs/design/BRAND-GUIDE.md` and `docs/design/DESIGN-SYSTEM.md` for visual or layout changes.
5. Read `docs/design/PRD.md` only for scope, route, audience, or product decisions.

## Content gate

- Keep Okim Dive warm, nature-loving, safety-conscious, quietly adventurous, and visually thoughtful.
- Write for clarity first, warmth second, and beauty third.
- Every sentence must help visitors understand, decide, prepare, or feel more confident.
- Do not add content to fill space. A clear heading does not need a repetitive subtitle.
- Keep one clear message per section and remove duplicated ideas.
- Treat Okim Explorer, supplied PDFs, screenshots, and old documents as historical source material—not copy to paste.
- Use current, verified Okim Dive facts only. Ask before publishing uncertain prices, dates, availability, booking/payment rules, safety/medical guidance, certifications, facilities, conservation claims, or guarantees.
- Update Simplified Chinese when translated English content changes; keep it natural rather than literal.
- Never publish sensitive information, including credentials, bank details, passwords, API keys, tokens, or connection strings.

## Page ownership

- **Home:** the emotional invitation—nature, beauty, learning, confidence, and exploration.
- **About:** Iris, love of the sea, and why Okim Dive is more than certification.
- **Courses:** course choice, progressive learning, safety, package facts, and preparation.
- **Trips:** Tioman Island and other destinations as one dive journey; explain on-demand or fixed-date differences only when useful.
- **Gallery:** honest visual appreciation and verified imagery.
- **Contact:** direct form-led conversion; alternative contact methods stay secondary.

## Structure and visual guardrails

- Preserve the six-page static structure unless an approved user or business need requires otherwise.
- Use one hero title plus one concise supporting line.
- Prefer title-only section headings unless supporting copy adds information.
- Do not add decorative kickers, separator lines, cards, badges, icons, or paragraphs without a clear purpose.
- Preserve the continuous underwater editorial / dive-journal language, readable surfaces, bilingual typography, accessibility, responsive behavior, and reduced-motion support.

## Handoff checks

- Content: run the content checklist; check duplicates, page ownership, unsupported claims, English, and Simplified Chinese.
- Visual: inspect rendered desktop and mobile states, alignment, wrapping, spacing, contrast, focus, and overflow; use independent UI/UX review for substantial changes.
- Run the repository's lint, build, UI tests, and `git diff --check`.
- Do not claim completion from source inspection or automated tests alone.

When facts or scope are unclear, ask rather than infer.
