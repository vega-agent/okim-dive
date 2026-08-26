# Okim Dive Lightweight Beautification Implementation Plan

> **For Hermes:** Use this plan task-by-task. Do not begin Phase 2 until Phase 1 verification passes.

**Goal:** Make the existing multi-page Okim Dive website feel more distinctive, watercolor-led, and editorial while keeping it fast, accessible, and easy to maintain.

**Architecture:** Keep the current static HTML/CSS/JavaScript architecture and six-page information structure. Use a small set of opaque watercolor backgrounds, real photography, CSS transitions, and a tiny shared reveal script. Do not add Three.js, Lenis, GSAP, a CMS, or a single-page-app migration in this work.

**Repository:** `/Users/agentvega/Documents/Projects/okim-dive`

**Routes:** `index.html`, `about.html`, `courses.html`, `trips.html`, `gallery.html`, `contact.html`

**Primary verification:** `npm run build`, local HTTP smoke test for all six routes, browser visual QA at desktop/tablet/mobile widths, keyboard QA, and reduced-motion QA.

---

## Definition of Done

The work is complete only when all of the following are true:

- All six pages retain normal links and render without console errors.
- The site remains multi-page; no route is replaced by a single-page scroll experience.
- Generated backgrounds are opaque, compressed, correctly referenced, and used selectively.
- No fake CSS marine-life illustrations remain as required visual assets.
- Shared navigation, buttons, cards, section spacing, and typography are consistent.
- Motion is limited to purposeful reveals, subtle image movement, and state transitions.
- Essential content is visible when JavaScript is disabled.
- `prefers-reduced-motion: reduce` disables or simplifies non-essential motion.
- All interactive controls work with keyboard and touch.
- Static verification and browser smoke tests pass.
- Performance is measured before and after; no unexplained large asset or dependency increase is accepted.

---

# Phase 1 — Visual Foundation

**Goal:** Establish the visual language before adding animation.

**Expected result:** The site already looks better when all motion is disabled.

## 1.1 Audit the current implementation

**Files:**
- Read: `index.html`, `about.html`, `courses.html`, `trips.html`, `gallery.html`, `contact.html`
- Read: `styles.css`, `site-i18n.js`, `scripts/verify-static.mjs`
- Read: `BRAND-GUIDE.md`, `DESIGN-SYSTEM.md`

**Steps:**
1. List all shared selectors used by navigation, hero, buttons, cards, sections, forms, and footer.
2. List every local image reference in HTML and CSS.
3. Identify dead framework configuration and do not introduce framework-specific code.
4. Record baseline CSS size, local asset sizes, and build output.

**Verification:**

```bash
cd /Users/agentvega/Documents/Projects/okim-dive
npm run build
find . -type f \( -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' -o -name '*.webp' -o -name '*.avif' \) -not -path './node_modules/*' -exec wc -c {} +
```

Expected: build passes; baseline numbers are recorded in the implementation PR or project notes.

## 1.2 Normalize design tokens

**Files:**
- Modify: `styles.css`

**Steps:**
1. Keep one authoritative color, typography, spacing, radius, shadow, and motion-token block.
2. Align CSS values with `BRAND-GUIDE.md` and `DESIGN-SYSTEM.md`.
3. Define explicit tokens for:
   - `--paper-sand`
   - `--paper-cloud`
   - `--ocean-mist`
   - `--deep-water`
   - `--coral`
   - `--deep-sea`
   - `--content-max`
   - `--motion-fast`
   - `--motion-medium`
4. Remove conflicting duplicate overrides rather than appending another stylesheet layer.

**Verification:**

```bash
npm run build
```

Expected: build passes and no required selector disappears. Browser check: all six pages use the same body background, text contrast, and button geometry.

## 1.3 Build the paper and image treatment system

**Files:**
- Modify: `styles.css`
- Assets: `assets/watercolor/backgrounds/`, `assets/photos/` as images become available

**Steps:**
1. Define reusable classes for `paper-section`, `watercolor-wash`, `photo-frame`, `photo-caption`, and `eyebrow-label`.
2. Use complete opaque watercolor backgrounds only; never depend on transparent overlays from Gemini.
3. Apply watercolor backgrounds to major sections, not every card.
4. Give photos a consistent warm-paper frame, subtle shadow, and restrained color treatment.
5. Use `object-fit`, `object-position`, and aspect-ratio rules to avoid layout shifts.

**Verification:**
- Run `npm run build`.
- Inspect every page at 1440px and 390px width.
- Confirm no background image repeats unexpectedly and no photo is stretched.
- Confirm all local image paths resolve through the static verifier.

## 1.4 Improve typography and section composition

**Files:**
- Modify: all six HTML files where markup needs semantic eyebrow labels/captions
- Modify: `styles.css`

**Steps:**
1. Use a short eyebrow label above major headings.
2. Keep headings concise and body text within a readable line length.
3. Use Playfair Display for editorial headings and Lato for utility text.
4. Reserve decorative/script typography for short accents only.
5. Replace repetitive equal-card rows with editorial layouts where the content is narrative.
6. Use balanced grids for known item counts; avoid orphan cards.

**Verification:**
- Browser inspect all six routes.
- Confirm heading order is logical (`h1` then `h2`/`h3`).
- Confirm no section has cramped text or excessive empty height at mobile width.
- Confirm all visible text remains readable over backgrounds.

## Phase 1 exit gate

- [ ] Site looks coherent with JavaScript disabled.
- [ ] No layout depends on animation.
- [ ] No unresolved local asset references.
- [ ] All six routes pass static build and browser 200 checks.
- [ ] A screenshot review confirms the design is not merely a card/gradient template.

---

# Phase 2 — Lightweight Motion

**Goal:** Add a small, shared motion vocabulary using CSS and minimal JavaScript.

**Expected result:** The site feels alive but does not feel animated everywhere.

## 2.1 Add progressive-enhancement reveal styles

**Files:**
- Modify: `styles.css`
- Modify: `site-i18n.js` or create `site-motion.js` only if separation is cleaner

**Steps:**
1. Add `.reveal`, `.reveal.is-visible`, and stagger-delay utility classes.
2. Default content to visible when JavaScript is unavailable.
3. Animate only `opacity` and `transform`.
4. Add a global reduced-motion rule that removes transforms and long transitions.
5. Do not hide headings, forms, navigation, or essential course/trip information.

**Verification:**
- Disable JavaScript: all essential content remains visible.
- Enable reduced motion in browser/OS: no meaningful movement remains.
- Run keyboard tab navigation: focus is visible and not delayed by animation.
- Run `npm run build`.

## 2.2 Add IntersectionObserver reveals

**Files:**
- Create or modify: `site-motion.js`
- Modify: all six HTML files to load the shared script once

**Steps:**
1. Observe only elements with `.reveal`.
2. Use a conservative `rootMargin` so content enters before the user reaches it.
3. Add `.is-visible` once and unobserve one-shot elements.
4. Add a safe fallback if `IntersectionObserver` is unavailable.
5. Keep the script dependency-free.

**Verification:**
- Browser console has no errors on all six pages.
- Scroll each route from top to bottom and confirm every reveal appears.
- Reload midway through a page and confirm no content remains permanently hidden.
- Test with JavaScript disabled.

## 2.3 Add navigation and control transitions

**Files:**
- Modify: `styles.css`
- Modify: shared navigation markup/scripts in all six HTML pages

**Steps:**
1. Add a subtle active-page underline.
2. Add a compact nav background transition only after scrolling, if the current structure supports it.
3. Add hover, focus-visible, and pressed states to both primary and secondary buttons.
4. Add mobile-menu open/close transition without trapping focus.
5. Ensure normal links still navigate normally.

**Verification:**
- Test desktop hover and keyboard focus.
- Test mobile menu open, close, Escape, and navigation.
- Test direct loading of every route.
- Confirm no horizontal scrollbar appears.

## 2.4 Add one ambient watercolor motion layer

**Files:**
- Modify: `styles.css`

**Steps:**
1. Select one background wash per page or one shared hero wash.
2. Animate a pseudo-element or background position very slowly.
3. Keep opacity and contrast low enough that text remains stable.
4. Disable the effect under reduced motion.
5. Do not add bubbles, jellyfish, boats, or repeated geometric marine shapes.

**Verification:**
- Capture desktop and mobile screenshots before/after.
- Confirm the effect is visible but not distracting after 30 seconds.
- Confirm reduced motion removes the effect.
- Confirm CPU usage and frame rate remain acceptable on a low-powered device/browser profile.

## Phase 2 exit gate

- [ ] Motion uses only CSS and a small shared script.
- [ ] Essential content works without JavaScript.
- [ ] Reduced motion is implemented and verified.
- [ ] Navigation and forms remain keyboard accessible.
- [ ] No route has more than two simultaneous motion systems.

---

# Phase 3 — Signature Page Treatments

**Goal:** Give each page one deliberate visual idea without turning the site into a single-page animation demo.

## 3.1 Home — watercolor depth transition

**Files:**
- Modify: `index.html`, `styles.css`

**Steps:**
1. Establish a clear hero background and readable content layer.
2. Add one subtle image/background movement effect.
3. Reveal the hero heading first, subtitle second, CTA third.
4. Add a calm transition into the first content section.
5. Remove or hide any crude CSS marine-life illustration that competes with the hero.

**Verification:**
- Hero is understandable immediately without waiting for animation.
- CTA is reachable immediately by keyboard.
- Mobile hero does not crop the key subject or push the CTA below an unreasonable height.
- Reduced-motion mode displays the final hero state immediately.

## 3.2 About — personal story timeline

**Files:**
- Modify: `about.html`, `styles.css`

**Steps:**
1. Convert narrative content into semantic milestone sections.
2. Add alternating desktop layout only if it remains readable on mobile.
3. Add reveal-on-entry for milestone blocks.
4. Use image frames or watercolor washes as supporting context, not decoration overload.

**Verification:**
- Timeline reads correctly from top to bottom with CSS disabled.
- Mobile order matches the intended story order.
- Keyboard and screen-reader reading order is logical.

## 3.3 Courses — comparison and progressive disclosure

**Files:**
- Modify: `courses.html`, `styles.css`, shared script if accordion behavior is needed

**Steps:**
1. Identify one featured beginner path.
2. Group remaining courses by level or purpose.
3. Add accessible `<details>` elements for long descriptions where useful.
4. Use restrained card hover/focus states.
5. Keep prices, prerequisites, and booking actions visually scannable when Iris provides verified content.

**Verification:**
- All courses are reachable without hover.
- `<details>` content works with keyboard and no custom script.
- Grid remains balanced at desktop and stacked at mobile.

## 3.4 Trips — destination journal

**Files:**
- Modify: `trips.html`, `styles.css`

**Steps:**
1. Use a destination feature block with image, story, conditions, season, and CTA.
2. Add optional subtle image parallax only on capable desktop layouts.
3. Disable parallax for reduced motion and mobile.
4. Do not implement a map, horizontal scroll, or 3D scene unless a later requirement justifies it.

**Verification:**
- Trip information remains readable when parallax is disabled.
- Touch scrolling is normal on mobile.
- No section traps the user or hijacks scroll.

## 3.5 Gallery — editorial image browsing

**Files:**
- Modify: `gallery.html`, `styles.css`

**Steps:**
1. Use a balanced masonry or editorial grid.
2. Add captions and meaningful alt text.
3. Add a subtle reveal and focus/hover caption state.
4. Lazy-load below-the-fold images.
5. Use a normal vertical fallback on small screens.

**Verification:**
- Images do not shift layout after load when dimensions are known.
- Keyboard users can reach every image/caption.
- Mobile remains a straightforward vertical gallery.

## 3.6 Contact — calm form and confirmation

**Files:**
- Modify: `contact.html`, `styles.css`, existing form script if present

**Steps:**
1. Keep the visual treatment quiet and high contrast.
2. Add clear labels, validation messages, and success/error states.
3. Use motion only for confirmation feedback.
4. Do not animate the form fields continuously.

**Verification:**
- Submit, validation, error, and success states are understandable without motion.
- Every form field has a label and keyboard focus.
- Invalid submission does not clear user input.

## Phase 3 exit gate

- [ ] Every page has a distinct purpose and one signature visual treatment.
- [ ] No page depends on a one-page scroll narrative.
- [ ] Mobile and reduced-motion layouts are intentional, not afterthoughts.
- [ ] All content is accessible without hover, parallax, or animation.

---

# Phase 4 — Performance and QA

**Goal:** Prove the finished experience is fast, stable, accessible, and complete.

## 4.1 Asset audit and optimization

**Files:**
- Inspect all files under `assets/`
- Modify image formats and references as needed

**Steps:**
1. List every local asset and its MIME type.
2. Convert oversized JPEG/PNG assets to WebP or AVIF where appropriate.
3. Keep watercolor textures small and opaque.
4. Add explicit width/height or aspect-ratio for content images.
5. Confirm no unused generated asset is referenced by CSS.

**Verification:**

```bash
npm run build
find assets -type f -print
```

Expected: every referenced asset exists, has the correct extension/MIME type, and no single decorative asset is unnecessarily large. Record total image weight.

## 4.2 Static and HTTP verification

**Steps:**

```bash
npm run lint
npm run build
python3 -m http.server 8080
```

In another terminal:

```bash
for page in index.html about.html courses.html trips.html gallery.html contact.html; do
  curl -fsS -o /dev/null -w "$page %{http_code}\n" "http://127.0.0.1:8080/$page"
done
```

Expected: all commands pass and every page returns HTTP 200.

## 4.3 Browser visual QA

**Viewports:**
- Desktop: 1440×900
- Tablet: 1024×768
- Mobile: 390×844

**Check each route:**
- First viewport hierarchy
- Last section before footer
- Navigation and footer
- Card grids and incomplete rows
- Images and captions
- Forms
- Horizontal overflow
- Console errors

**Expected:** no clipped content, orphaned layout, missing backgrounds, accidental scrollbars, or inconsistent shared components.

## 4.4 Accessibility QA

**Steps:**
1. Navigate every page using only keyboard.
2. Confirm visible `:focus-visible` states.
3. Test with reduced motion enabled.
4. Check heading order, landmarks, labels, alt text, and link names.
5. Confirm color contrast for body text, CTA text, and text over images.

**Expected:** every action is possible without mouse or animation.

## 4.5 Performance QA

**Steps:**
1. Measure baseline and final page weight.
2. Use browser DevTools Performance/Lighthouse or an equivalent local audit.
3. Test with network throttling and CPU throttling.
4. Check for layout shifts caused by images or fonts.
5. Confirm no new dependency was added without a documented reason.

**Acceptance targets:**
- No large unexpected asset or JavaScript bundle increase
- No visible layout shift during image loading
- Smooth scrolling and reveal effects on a throttled mobile profile
- First content remains readable before below-the-fold assets load

## 4.6 Final completeness report

Create a short report containing:

```text
Routes verified:
Build/lint result:
HTTP smoke-test result:
Asset count and total weight:
Largest assets:
Desktop QA:
Tablet QA:
Mobile QA:
Keyboard QA:
Reduced-motion QA:
Console errors:
Known limitations:
```

## Phase 4 exit gate

- [ ] Static verification passes.
- [ ] All six routes return HTTP 200.
- [ ] Browser QA passes at all three viewport sizes.
- [ ] Keyboard and reduced-motion QA passes.
- [ ] Asset weight is recorded and acceptable.
- [ ] No unresolved console errors or broken links remain.
- [ ] Final report is attached to the project work or commit.

---

## Suggested Commit Boundaries

Use one focused commit per verified phase:

```text
feat: establish Okim watercolor visual foundation
feat: add lightweight accessible motion system
feat: add page-specific editorial treatments
qa: optimize assets and verify all Okim routes
```

Do not commit a phase until its exit gate passes. Do not push or deploy until Phase 4 is complete and the final report has been reviewed.

## Open Inputs Required from Iris Before Content Lock

These are not blockers for visual scaffolding, but must be confirmed before final content implementation:

- Verified course names, prices, prerequisites, and durations
- Verified trip destinations, seasons, and booking details
- Approved photography and usage rights
- Contact channels and response expectations
- Loyalty-program rules and member CTA wording
- English/Chinese content requirements
