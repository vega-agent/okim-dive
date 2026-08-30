# Courses Page Priority Content Flow Implementation Plan

> **For Hermes:** Implement this plan task-by-task on the `Update-Data` branch. Do not work directly on `main`.

**Goal:** Refocus the Courses page on Open Water Diver, Advanced Open Water, and Scuba Refresher while making the FAQ a prominent reassurance and decision-support section.

**Architecture:** Keep the existing dependency-free static HTML/CSS/JavaScript architecture. Make the page content-driven in `pages/courses.html`, preserve the shared global styling in `styles/styles.css`, and use `styles/redesign.css` only for layout-specific refinements. Do not introduce a CMS, new framework, or page-specific inline styling.

**Tech Stack:** Static HTML, shared CSS, existing JavaScript localization/motion, Playwright Chromium smoke tests.

---

## Product interpretation

- “Advance Open Water” is interpreted as the existing course name **Advanced Open Water**.
- “Scba Refresher” is interpreted as **Scuba Refresher**.
- The three priority offerings should be the only full course cards shown in the primary course grid.
- Rescue Diver, Divemaster, Specialty Courses, and Discover Scuba should not be presented as equal-priority cards. They should be represented by a secondary inquiry panel stating that additional courses are available on request.
- Do not invent Iris-specific pricing, schedules, prerequisites, certification details, or refresher requirements. Preserve confirmed existing details where they remain applicable; flag any new Scuba Refresher data that needs Iris’s confirmation.

## Proposed page flow

1. **Hero**
   - Keep the existing Courses hero treatment.
   - Adjust subtitle to communicate a focused selection of core courses, without overclaiming availability.

2. **Short orientation / journey intro**
   - Keep the existing journey concept, but shorten its copy so it supports the three-course decision rather than competing with it.
   - Suggested framing: start with Open Water, build skills with Advanced Open Water, or return confidently with Scuba Refresher.

3. **Priority courses section**
   - Rename heading to something more direct, such as “Core Courses” or “Start Here”.
   - Render exactly three cards:
     - Open Water Diver
     - Advanced Open Water
     - Scuba Refresher
   - Use a consistent card system. Do not mark Advanced Open Water as “Popular” unless Iris specifically wants that claim.
   - Each card should have a clear action leading to Contact.
   - Scuba Refresher should use confirmed content only; unknown fields should be written as inquiry-led copy rather than guessed facts.

4. **Additional courses inquiry panel**
   - Replace the four non-priority cards with one visually secondary panel.
   - Copy should explain that Rescue Diver, Divemaster, Specialty Courses, Discover Scuba, and other training options are available on request.
   - Primary CTA: “Contact us for more information”.
   - This panel should visually defer to the three core courses, not appear as a fourth course card.

5. **FAQ reassurance section**
   - Move FAQ directly after the core course/inquiry content, before the process section, so uncertainty is addressed while visitors are deciding.
   - Give it more visual space through a wider content measure, larger vertical padding, and a comfortable two-column desktop grid that becomes one column on mobile.
   - Expand the FAQ to approximately six to eight questions, using confirmed/general information only:
     - Do I need to be a good swimmer?
     - Which course should I start with?
     - What happens during Open Water certification?
     - What should I do if I have not dived for a while?
     - What is included in the course fee?
     - Are lessons conducted in Mandarin?
     - How do I choose course dates?
     - Can I ask about other courses?
   - If any answer needs Iris’s exact policy, use careful contact-led wording rather than inventing a rule.
- Jeff supplied `9 大潜水前常见问题.pdf` as source material. Adapt its nine concerns into concise web FAQ answers rather than copying the long-form article verbatim: swimming confidence, course difficulty, age/health, instructor expectations, sun protection, ear discomfort/equalisation, certification organisations, course duration, and required equipment.
- Safety-sensitive claims from the PDF require review before publication. Do not state that swimming ability is irrelevant, diagnose ear problems, promise that every student will certify, prescribe medical clearance as a universal rule, or describe diving as definitively the world’s most dangerous sport. Use qualified wording and direct health-specific questions to a doctor and/or instructor.
- The FAQ can be nine items if the layout remains spacious. Prioritize the questions that reduce first-time uncertainty, and include a clear contact CTA for anything personal or policy-dependent.

6. **How It Works**
   - Keep the process section after the FAQ, or reduce it to a compact three-step sequence:
     1. Choose the right course
     2. Contact Iris and confirm dates
     3. Learn, practise, and complete the dives
   - Avoid letting a long process section push the reassurance content below the fold unnecessarily.

7. **Footer**
   - Preserve existing navigation and social links.

## Implementation tasks

### Task 1: Add content assertions before implementation

**Files:**
- Modify: `tests/smoke.spec.mjs`
- Modify or create: a focused Courses content test if the existing test structure supports it

Add assertions that `pages/courses.html` contains the three priority course names, does not render the four deprioritized offerings as `.course-card` elements, contains an on-request message, and exposes the FAQ section after the course content. Keep the assertions compatible with the static page and existing test setup.

### Task 2: Restructure Courses HTML

**Files:**
- Modify: `pages/courses.html`

- Retain the navigation, hero, journey intro, footer, and shared script loading.
- Replace the six-card course grid with three core course cards.
- Add a separate inquiry panel for non-priority courses.
- Move the FAQ block before the process block.
- Add the expanded FAQ copy.
- Keep links relative to the `pages/` directory and use the existing Contact route.
- Add semantic headings and `aria-labelledby` where useful.

### Task 3: Add shared layout rules

**Files:**
- Modify: `styles/styles.css`
- Modify: `styles/redesign.css` only if necessary for existing redesign-layer layout rules

- Set the core course grid to three balanced columns at desktop and one column on narrow screens.
- Add a shared inquiry-panel style rather than styling each omitted course independently.
- Increase FAQ section spacing and readable content width.
- Ensure the FAQ grid collapses cleanly at the existing mobile breakpoint.
- Preserve existing card borders, typography tokens, watercolor canvas, reduced-motion behavior, and focus styles.
- Do not reintroduce the removed outer blue border or horizontal process-section line.

### Task 4: Update Simplified Chinese content

**Files:**
- Modify: `scripts/site/site-i18n.js`

Add translations for the new core-course labels, on-request panel, revised process copy, and all new FAQ questions/answers. Verify dynamic or translated content through the existing shared translation mechanism rather than page-specific scripts.

### Task 5: Update project documentation

**Files:**
- Modify: `README.md` only if the page inventory or course description is materially inaccurate
- Modify: `/Users/agentvega/Documents/CosmosStar/Projects/okim-dive/STATUS.md` after implementation is verified

Record that the Courses page now prioritizes three courses and routes other offerings through inquiry. Do not mark Iris-specific course details as confirmed until she supplies them.

## Validation plan

Run:

```bash
npm run lint
npm run build
npm run test:ui

git diff --check
```

Add targeted browser checks for `pages/courses.html`:

- Desktop viewport: three core cards visible; inquiry panel present; FAQ has expanded spacing and all questions render.
- Mobile viewport: one-column course cards; inquiry CTA remains readable; FAQ does not overflow; no horizontal scroll.
- Navigation: Contact links resolve correctly from the `pages/` directory.
- Chinese mode: all new visible course and FAQ copy translates; intentional brand names such as PADI remain appropriately preserved.
- Console/network: no missing assets, scripts, or JSON resources.
- Visual review: inspect hero, core cards, inquiry panel, expanded FAQ, process section, and footer directly in rendered screenshots.

## Risks and open questions

- Exact Scuba Refresher duration, prerequisites, inclusions, and certification implications are not currently confirmed in the existing page. Use inquiry-led content until Iris supplies those facts.
- The wording “available on request” should not imply that every listed course is currently guaranteed; phrase it as “ask us about availability and details.”
- The existing translation dictionary may contain keys for removed course cards. Remove or leave only if still referenced; do not leave stale visible translations.
- The existing static route tests currently verify loading and navigation, not detailed content hierarchy. Add focused assertions so future edits cannot silently restore the deprioritized cards.
- Do not commit or merge until direct visual review confirms the FAQ has genuinely more breathing room and the three core courses remain the dominant visual focus.

## Recommended acceptance criteria

- Exactly three primary course cards are visible.
- The three primary cards are Open Water Diver, Advanced Open Water, and Scuba Refresher.
- The other courses are communicated through one secondary contact/inquiry panel.
- FAQ appears before How It Works and has visibly increased space.
- FAQ content addresses both first-time uncertainty and refresher-course uncertainty.
- Desktop and mobile layouts pass without overflow or console errors.
- English and Simplified Chinese visible content is complete.
- Existing public route behavior, visual system, and accessibility behavior remain intact.
