# Okim Dive — Agent Working Rules

These rules apply to every agent, developer, designer, and content editor working in this repository.

## Before changing anything

1. Read `docs/design/OKIM-DIVE-VIBE.md`.
2. Read `docs/design/BRAND-GUIDE.md` and `docs/design/DESIGN-SYSTEM.md` for visual implementation decisions.
3. Read `docs/design/CONTENT-REVIEW-CHECKLIST.md` before creating or editing copy, pages, UX writing, or image prompts.
4. Inspect the current page, component, data file, and rendered state before proposing a change.
5. Confirm the change belongs to the correct page and advances that page's primary visitor decision.
6. Check whether the requested information already exists elsewhere before adding a new section or paragraph.

## Non-negotiable brand direction

Okim Dive should feel like:

- A thoughtful invitation into a beautiful underwater world
- Genuine love and respect for nature and marine life
- Calm, capable safety guidance
- Curious, quietly adventurous exploration
- Personal, warm, and encouraging rather than corporate
- Visually beautiful without decorative clutter

The directional expression is:

> **Learn with care. Explore with wonder.**

Use it as a decision filter, not as a slogan to repeat on every page.

## Content rules

- Write for clarity first, then warmth, then beauty.
- Every sentence must help the visitor understand, decide, prepare, or feel more confident.
- Do not add copy merely to fill whitespace or make a page look fuller.
- A clear heading does not need supporting copy if the copy only repeats the heading.
- Keep one clear message per section.
- Prefer concise, specific copy over generic tourism language.
- Use verified facts only. Mark uncertain, stale, sample, or business-dependent information before publication.
- Do not invent prices, dates, availability, booking rules, payment requirements, certifications, facilities, conservation programmes, destinations, or guarantees.
- Use qualified safety and medical wording. Never promise risk-free diving, universal suitability, or guaranteed certification.
- Keep the current brand as **Okim Dive**. Treat **Okim Explorer** as historical source material only.
- Do not carry old general-outdoor positioning, loyalty schemes, merchandise, equipment-shop claims, or unrelated hiking/camping/surfing services into Okim Dive without explicit approval.
- Treat supplied PDFs, screenshots, and old documents as source material. Extract useful facts, then rewrite them for current Okim Dive context.
- When English copy changes, update Simplified Chinese copy in the same change when that text is translated on the site.
- Preserve brand names exactly: `Okim Dive`, `PADI`, `Instagram`, `Facebook`, `WhatsApp`, and verified trip/course names.
- Never publish or preserve credentials, bank details, passwords, API keys, tokens, or connection strings.

## Page ownership

- **Home:** emotional introduction to nature, beauty, learning, confidence, and wider exploration.
- **About:** Iris, the love of the sea, Okim Dive's philosophy, and why the experience is more than certification.
- **Courses:** course choice, progressive learning, confidence, safety, package facts, and practical preparation.
- **Trips:** Tioman Island and other destinations as one continuing dive journey; distinguish on-demand and fixed-date arrangements only when useful.
- **Gallery:** visual appreciation, honest captions, and verified imagery only.
- **Contact:** direct conversion path; the form is primary and alternative contact methods are secondary.

Do not move content between pages solely to make a page longer. Move it when the destination page owns the visitor question better.

## Structure and visual rules

- Preserve the six-page structure unless a new route has a clear user or business purpose.
- Use one hero title and one concise supporting line.
- Section headings should normally be title-only or title plus genuinely useful supporting copy.
- Do not add kicker labels, decorative title rules, or separators above headings unless they communicate meaning.
- Keep the continuous underwater editorial / dive-journal visual language.
- Use watercolor as a quiet environmental layer, not as unrelated decoration.
- Let content breathe; do not solve weak content with extra cards, paragraphs, badges, or icons.
- Prefer fewer strong content groupings over repetitive card grids.
- Preserve readable surfaces, contrast, keyboard focus, mobile layout, and reduced-motion behavior.
- Keep the existing typography system and bilingual hierarchy consistent.

## Required review before handoff

For content changes:

- Run the content checklist.
- Check English and Simplified Chinese rendering.
- Check for duplicate headings, repeated ideas, unsupported claims, and empty-value paragraphs.
- Confirm the content is placed on the correct page.

For visual or page changes:

- Inspect the rendered page at desktop and mobile widths.
- Check alignment, wrapping, spacing, contrast, focus states, and overflow.
- Run the independent UI/UX visual review for substantial changes.
- Run the repository's lint, build, UI tests, and `git diff --check`.
- Do not call work complete based on source inspection or automated tests alone.

## When uncertain

Stop and identify the uncertainty. Do not fill missing business facts from memory or inference. Ask for confirmation when the decision affects public claims, booking, payment, safety, certification, pricing, availability, or brand positioning.
