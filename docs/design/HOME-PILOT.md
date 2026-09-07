# Home pilot — immersive watercolour

## Authority and scope

Jeff approved the Home-page pilot in CosmosStarHQ thread 2 on 2026-09-06 after selecting the immersive underwater journey direction. This authorizes a working pilot on `UI-Refactor`, not the other five page redesigns, new photography, an enquiry backend, merge or deployment.

Baseline: `6810114`. The full proposal remains in `.hermes/plans/2026-09-06_161507-ui-refactor-immersive-watercolour.md`. Approval of this pilot does not resolve older conflicting sections in `BRAND-GUIDE.md` / `DESIGN-SYSTEM.md`.

## Direction contract

- **Thesis:** enter at the sunlit surface, discover the underwater world, then choose how to take part. Preserve ordinary scrolling and immediate actions.
- **Material:** existing Okim Dive watercolour paintings; one continuous ocean environment, soft painted transitions and localized reading washes. No fake photography, ornamental icon pack or dark glass panel.
- **Story:** nature-led invitation → one Learn / Return / Explore chooser → honest Tioman on-request invitation → enquiry ending. These are parallel paths, not certification steps.
- **Typography:** retain current Fraunces/Lato English and Noto Serif/Sans SC Chinese roles. No new font direction is being approved.
- **Motion:** authored waterline/light transition, bounded ambient illustration movement, still headings and body copy. Respect reduced motion and manual pause, suspend environmental work when offscreen/hidden, preserve all content without JavaScript.
- **Finish:** direct bilingual desktop/mobile review, independent design/code review, exercised behavior tests and regression evidence for the other five routes. A test pass alone is not visual approval.

## Implementation boundary

Home-specific selectors use `.home-pilot`; general shared behavior must remain compatible with other pages. Reuse the existing CSS and motion scripts rather than introduce an animation library or another override stylesheet. Preserve actual artwork files.

Pending business/asset questions stay outside this pilot: portrait consent, destination/gallery photographs, instructor statistics, Refresher inclusions, enquiry delivery and WhatsApp destination.

## Review status

Implementation and verification are complete for this pilot checkpoint. `npm run lint`, `npm run build`, `npm run test:ui` (31 passed, 1 intentionally skipped), and `git diff --check` pass. EN/ZH normal/reduced screenshots were reviewed at 320, 390, 768, and 1280 widths with no tested overflow or local resource failures. Independent code review found no blockers, and independent visual QA found no blocking or major defects across the eight documented full-page states. The other five route files remain unchanged.

The pilot remains uncommitted and requires Jeff's visual approval before any whole-site rollout. This document does not authorize merge, push, deployment, new photography, an enquiry backend, or redesign work on the other five pages.
