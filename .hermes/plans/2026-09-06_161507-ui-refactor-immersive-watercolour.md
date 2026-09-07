# Okim Dive Immersive Watercolour UI Redesign Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task if available; otherwise use the available delegation/review workflow explicitly. This is a proposal, NOT implementation authorization.

**Goal:** Turn all six Okim Dive pages into a coherent, image-led underwater journey while making learning, trip selection, and enquiry easier.

**Architecture:** Preserve the plain HTML/CSS/JavaScript runtime, six routes, bilingual content and continuous surface-to-seabed concept. Consolidate the existing CSS/motion system rather than adding another override layer or an animation framework. Atmosphere belongs behind stable content; comparison and form surfaces remain calm.

**Tech Stack:** Semantic HTML, shared CSS variables, CSS transforms/opacity, IntersectionObserver, small optional Web Animations API sequences, native details/dialog, existing Playwright tooling. No React migration, GSAP, WebGL, autoplay video, or canvas simulation in the base proposal.

**Status:** PLAN ONLY. No site source/assets changed, no commit/push/deployment. Saving this Markdown is the only intended repository edit.

---

## 1. Scope, direction and authority

- Repository: `/Users/agentvega/Documents/Projects/okim-dive`.
- Live branch: `UI-Refactor`, based on `6810114`; the user's later `UI-factor` wording does not name an existing branch. Do not rename/create another branch without confirmation.
- Jeff selected **Immersive underwater journey: more atmospheric motion and visual storytelling** during this audit. Editorial-only and minimal-refresh approaches were offered but not selected.
- Preserve the watercolour identity, current logo, calm personal voice, restrained coral actions, individual round watercolour illustrations, and no shared decorative connectors between those illustrations.
- Audience assumption, grounded in current content: newcomers considering certification, certified divers returning after a break, and recreational divers exploring trips. Primary outcome: understand the appropriate next step and make a genuine enquiry.
- This is a redesign of composition and experience inside an established brand, not a rebrand or a request to invent operations.
- Sources: `AGENTS.md`, `docs/design/OKIM-DIVE-VIBE.md`, `CONTENT-REVIEW-CHECKLIST.md`, `BRAND-GUIDE.md`, `DESIGN-SYSTEM.md`, Cosmos Star project status, live pages and source.
- **Conflicting/stale records:** Cosmos Star still names local `main`; live branch is `UI-Refactor`. Legacy brand/design sections prescribe Playfair Display and old card/template patterns, while the current typography section and CSS use Fraunces/Lato with Noto SC roles. Treat current render as baseline, not authorization to resolve the records silently. Ask Jeff to approve documentation reconciliation before implementation. Missing root PRODUCT.md/DESIGN.md is a documentation gap, not missing brand identity.

### Copy and tone contract

All new headings, supporting copy, labels, captions, empty states, dialogs, validation messages and CTAs must follow `docs/design/OKIM-DIVE-VIBE.md` and `docs/design/CONTENT-REVIEW-CHECKLIST.md`:

- Sound like a knowledgeable local guide and patient instructor: warm, personal, calm and quietly curious—not corporate, loud or sales-led.
- Use plain, polished English with short purposeful sentences. Simplified Chinese must be natural, concise and reassuring rather than literal translation.
- Express love and respect for the underwater world through specific details, not vague poetic filler or environmental claims we cannot verify.
- Build confidence with language such as clear guidance, learning at your own pace, asking questions and knowing what to expect. Never promise risk-free diving, guaranteed certification, perfect conditions or the “safest” experience.
- Treat certification as one part of an ongoing diving journey: learning, returning, practising, Tioman and further exploration—not an extreme-sport or bucket-list sales pitch.
- Every section must help the visitor understand, decide, prepare or feel more confident. Remove repeated headings, decorative kickers, generic tourism copy and package-style boilerplate.
- Do not use unsupported claims about prices, dates, availability, credentials, statistics, facilities, conservation, transport, payment or enquiry success. Keep sample, on-request and unconfirmed content visibly qualified.
- Keep the primary expression, **“Learn with care. Explore with wonder.”**, as a directional anchor. Do not repeat it mechanically across pages.

## 2. Audit method and limits

Direct parent review used the existing local server at `http://127.0.0.1:8080/pages/`. The native browser tool timed out and a CDP connection returned 404; local headless Chromium via installed Playwright provided working rendered evidence. No new server/install was required.

Evidence directory: `/tmp/okim-ui-plan-audit/` (temporary local evidence, not a durable delivery location).
- `manifest.json` verifies six unique routes × two widths = 12 full-page captures.
- Routes: index, about, courses, trips, gallery, contact.
- Widths: 1280 and 390; height 900 for capture viewport.
- All 12 captures directly viewed; readable crops additionally inspected for Home journey, About biography, Courses FAQ, Trips cards and Contact form.
- No horizontal document overflow and no broken HTML image loads found in this sample. This does not certify CSS-image correctness or accessibility conformance.
- Static screenshots use reduced motion for stable composition. Normal-motion runtime separately inspected on Home, Trips and Contact; active hero drift, particles, caustics and floating section headings were found. Dynamic trip cards lacked `.motion-reveal` after asynchronous injection.
- Tioman dialog viewed at 390 × 844, opened successfully without dialog-width overflow; Escape closed it. Full long-dialog keyboard/focus/scroll QA is future acceptance work.
- Current-turn audit is not a complete Chinese, tablet, Safari, contrast, screen-reader, network/performance or interactive regression certification. Earlier smoke-test results are historical, not proof for a redesign.
- **Method: dual-agent** (A: `sa-0-969cd19d`, B: `sa-1-96be33ba`) plus direct parent browser review. Both completed; final reports and tool evidence were recovered from their completed local transcripts when the consolidated delivery did not surface inline.
- Independent A separately inspected desktop/mobile captures across all six routes. It corroborated excessive mobile nesting, repeated panels, the missing portrait, destination-image sameness and the need for page-specific composition. Its narrower recommendation for restrained movement is synthesized with Jeff's explicit choice: retain more ambitious Home/Trips atmosphere, but keep task surfaces stable.
- Independent B ran the requested Impeccable markup detector and aggregated JSON: **6 warnings, all `overused-font`, one per page at line 11**. Five pages flag Fraunces; Trips flags Lato. The subsequently delivered complete report confirms the detector ran in **degraded regex mode** because `htmlparser2`, `css-select`, `css-tree` and `domutils` were unavailable; custom properties, selector matching and computed contrast were not evaluated. These are aesthetic detector signals, not six accessibility failures. Existing font roles are brand-context exceptions; do not change typography merely to clear this detector. Its browser automation timed out; no overlay was injected or claimed. Parent's successful Playwright render covers the composition evidence, not a full accessibility audit.
- B corroborated the default-GET contact risk, all-or-nothing trip fetching and reduced-motion-only smoke-test gap. It correctly distinguished missing trip-card entrance registration from hidden content: cards remain visible. It flagged placeholders, optgroup labels and dialog-close aria-label as localization review candidates; add attribute-localization assertions, not only text-node checks, during implementation.

## 3. Findings and priorities

### P1 — Enquiry currently looks more operational than it is
`pages/contact.html:55` has no configured action/method or submission handler; browser resolves it to GET on the current page. A valid native submission could place entered personal data in the URL without delivering an enquiry. Do not submit real personal information during QA. `https://wa.me/60123456789` is present but its business validity is unverified. Keep this a launch blocker: no fake success animation or claim of delivery.

### P1 — Trust content needs verification, not decorative amplification
About displays an empty ornate portrait frame and the claims `500+`, `10+`, `20+`, plus instructor credentials. The frame cannot substitute for a real person; the audit does not verify those claims. Courses' Refresher details list equipment as included and also equipment rental as excluded/additional, and contain a certification inclusion needing clarification. Existing prices are source content, not independently verified business truth. Do not animate counters or rewrite these facts from inference.

### P1 — Image payload is disproportionate to its rendered role
On-disk source sizes: `assets/images/course-open-water.png` 2,777,722 bytes; `course-scuba-refresher.png` 2,335,551 bytes; `course-advanced-open-water.png` 779,460 bytes. About's three principle PNGs are also large. These are small rendered round illustrations. Resize/encode copies after approval while preserving the original art and transparency; do not generate replacements merely to fix payload.

### P2 — Layout repetition dilutes the journey
Home moves from a three-card philosophy block to a three-part journey to four navigation cards; several sections answer similar next-step questions. Courses is 7,937 CSS pixels high at 390px in this capture, with 11 fully expanded FAQ blocks. Long pages are not automatically bad; repeated boxed content and weak prioritization are the issue.

### P2 — Mobile artwork and reading measures need structural correction
The continuous artwork stretches across very different page lengths. About has narrow nested biography content and an oversized empty frame. Home's journey text sits directly over textured water. Contact's nested padding leaves narrow fields and clipped example placeholders. Reduce redundant container insets and maintain a stable clear reading zone; do not just decrease font sizes or add opaque panels everywhere.

### P2 — Destination identity and gallery material are missing
Trips presents the same abstract header treatment on all cards and gives sample destinations comparable visual weight to Tioman. Gallery is multiple large intro/empty/CTA sections without actual photographs; its heavy dark CTA interrupts the lighter reading-surface system. More animation alone cannot repair either issue.

### P2 — Existing motion is abundant but poorly prioritized
`styles/styles.css` contains `watercolor-drift`, `ocean-particle-drift`, `caustic-drift` and `depth-float`; headings move continuously in normal mode. `site-motion.js` prepares reveals once, before trip cards arrive. Shared CSS contains repeated environment/cascade overrides. Retire floating text, fix dynamic registration, and replace the competing ambient layers with one owned environment system.

### P2 — Typography and tests have gaps
Trips' font request does not include Fraunces although CSS requests it, risking a fallback in a cold page load. All routes request more font families/weights than the intended roles need. Current Playwright defaults to reduced motion and mainly smoke-tests loading/overflow/navigation; it cannot validate normal-motion lifecycle, no-JS trip usability, submission, or image storytelling.

## 4. Recommended experience: “Enter the water, discover, choose”

### Visual thesis
A visitor arrives at the sunlit surface, crosses a painted waterline, and discovers image-led chapters within a continuous ocean. Watercolour carries atmosphere; real photography carries identity and evidence. The visitor should feel immersed without losing control of reading or navigation.

### Signature moment: crossing the surface
- Home only: separate the hero into a static base painting and a soft painted waterline transition into the main canvas. A further surface-light layer requires a concrete visual benefit and explicit approval.
- At the natural hero/main boundary, use a brief, one-shot waterline reveal that makes entering the underwater content feel authored. No pinned multi-screen sequence, forced scroll distance or hidden CTA.
- Depth is visual, never a fake depth gauge or simulated diving instruction.
- Preserve ordinary scrolling and browser back/forward. A static composition must be beautiful before motion is enabled.
- Mobile uses an art-directed portrait crop and simpler opacity/light treatment, not desktop artwork squeezed or stretched over the whole page.

### Continuous environment
- One owner for shallow light, open mid-water and final seabed, with seamless overlap rather than section background resets.
- Keep a quiet central reading region; reef detail frames edges and the ending.
- Use current assets first. If new plates are approved, produce complementary shallow/mid/floor assets with shared pigment, paper grain, light direction and mobile crops.
- Atmosphere strengthens on Home/Trips/Gallery, reduces on About, and becomes static behind Courses facts, FAQ, dialogs and Contact inputs.
- No moving body text, bobbing headings, fish following the cursor, bubble trails behind every button, audio, animated statistics, cursor replacement, or scroll hijacking.

## 5. Page-by-page redesign

### Home — Discover and choose
**Keep:** recognisable island/waterline hero, logo, concise offer, Courses and Trips entry points.
**Proposed sequence:**
1. Immersive hero with text in the painting's quiet zone; one primary course action and one secondary trips action visible immediately.
2. Surface-crossing transition.
3. One short image-led philosophy chapter with a genuine teaching or underwater moment when approved; retain existing warm brand meaning without another feature grid.
4. A single Learn / Return / Explore chooser. These are parallel visitor paths, not a mandatory numbered progression. Distinct actionable rows/panels, not a wizard.
5. One featured Tioman invitation or approved photographic moment, then a compact final enquiry action near the seabed. Gallery link remains in navigation/footer rather than another full navigation grid.
**Motion:** one visible, one-shot waterline transition; grouped entrance only where it clarifies chooser relationships; quick focus/hover feedback. Do not retain continuous ambient motion unless it is clearly perceptible and earns its performance cost.
**Images:** preserve hero; request candid instructor-and-learner image and one honest underwater wide shot. Missing photos use existing illustration with no claim of photographic proof.

### About — Meet the people, understand the care
**Keep:** Iris story, personal brand, separate round mission/values/promise art.
**Proposed sequence:** shorter immersive hero → portrait/bio split → one story chapter → concise teaching values integrated with approved candid imagery → enquiry link.
- Replace empty-frame visual only after an approved portrait exists; otherwise use an honest compact no-portrait layout, not a fake human image.
- On mobile remove double/triple insets, place biography below a modest portrait crop, keep statistics compact only if verified.
- Consolidate repetitive mission/promise/why-us wording without deleting unique verified facts. Credentials and metrics require owner validation before enhanced prominence.
**Motion:** a single portrait/wash reveal, restrained story transitions; no animated numbers or looping person/photo movement.
**Images:** natural portrait near shore/boat, candid briefing or skill practice with participant permission. Never synthesize Iris or identifiable students.

### Courses — Understand your next learning step
**Keep:** Open Water, Advanced Open Water, Refresher, round watercolour art and package details.
**Proposed sequence:** compact atmospheric hero → clear three-course comparison → optional/request-only offerings line → question list → one enquiry ending.
- Align comparison fields consistently: intended diver, main outcome, duration where verified, price where verified, and enquiry action. Refresher is a parallel returning-diver path, not the third certification level.
- Retain three comparable course blocks rather than force all content into elaborate storytelling layouts.
- Replace 11 open FAQ cards with native `details/summary` on a shared calm reading surface. All questions remain visible; answers are keyboard-accessible. Do not hide material prices, inclusions or eligibility exclusively in accordions.
- Inquiry button wording must reflect enquiry, not promise transactional booking. Carry selected course into Contact only through a defined, sanitized value.
**Motion:** static comparison text; quick disclosure affordance change and optional short opacity transition. No fragile fixed-height accordion animation.
**Images:** optimize existing round PNGs; optionally one real calm learning photograph if it contributes evidence. No new ornamental art set required.

### Trips — Feel the destination, understand the arrangement
**Keep:** JSON-backed records and native detail dialog; explicit sample/on-request states; included versus additional costs separation.
**Proposed sequence:** scenic hero → larger Tioman feature with meaningful image/facts → separately labelled sample concepts if Jeff approves retaining them → single planning invitation.
- Differentiate offered/on-request versus sample content structurally, not just a badge. Never make sample dates look like live inventory. Decision to hide sample records in production belongs to Jeff.
- Replace interchangeable card headers with approved destination-specific imagery or clearly atmospheric illustration. Do not imply wildlife guarantees or exact locations from generated artwork.
- Dialog retains its readable facts-first structure; add an appropriately cropped destination header, compact mobile spacing and consistently reachable close control. CTA carries trip identity into enquiry; no sensitive data in URL.
- Provide useful loading, partial-failure, retry and no-JS guidance rather than an empty catalogue. Preserve readable static information as the baseline.
**Motion:** bounded image reveal, gentle hover crop on fine pointers, short dialog enter/exit; register newly injected cards once. No autoplay slider or interactive map required for this inventory.

### Gallery — Let real images be the experience
**Two explicit states:**
1. **Before approved photography:** one concise honest empty state and one appropriate onward link. Remove redundant intro/CTA repetition; do not fill with invented experiences.
2. **After approval:** one lead photograph followed by a curated CSS grid with varied image sizes, generous spacing, short useful captions, and optional chapters only if enough material exists.
- Keep DOM/keyboard reading order coherent; avoid a JS masonry layout or an infinite feed.
- Accessible native-dialog viewer with caption, previous/next controls, Escape, focus return and appropriate mobile scroll behavior. No autoplay and no hover-only captions. Preserve normal image links as fallback.
**Motion:** gentle image entrance when approaching viewport, subtle crop feedback and viewer continuity; stillness while inspecting an image.
**Images:** a small curated set across reef detail, underwater light, divers, shore and quiet between-dive moments, all approved and attributable. Suggested initial commissioning range: 8–12 photographs; do not delay an honest smaller collection just to reach a quota.

### Contact — Bring the journey to a calm decision
**Keep:** direct welcoming tone, visible labels, consent wording subject to business review, existing genuine contact alternatives.
**Proposed sequence:** shorter horizon hero → compact stable form → one verified alternate contact channel plus restrained social links → footer.
- Prioritize name, reply channel, interest and message. Put dates/group/certification under optional trip/course context, with sensible unknown/not-sure choices after business approval.
- Desktop may use paired fields where appropriate; mobile uses one column with a wider usable inner area and full-size labels. Never use placeholder text as the only label.
- Preserve entered values across errors, associate inline messages, focus an error summary, and use a real pending/success/failure lifecycle only after transport is configured.
- Do not ship a working-looking submit flow backed by default GET. Transport integration is a separately approved prerequisite, not secretly included in this visual refactor.
- Verify WhatsApp destination before rendering it as an operational action; do not substitute a guessed number.
**Motion:** immediate focus/validation feedback only; no drifting frame, animated form surface or celebratory fake success.
**Images:** current horizon artwork can stay. Optional quiet horizon crop, not additional contact-method illustration cards.

## 6. Motion specification (proposed budgets, not measurements)

- **Control feedback:** 120–180ms; hover/focus colour or painted underline, press feedback. Never communicate only via hover or colour.
- **Disclosure/menu/dialog state:** 180–280ms, exits slightly faster; preserve semantic state and focus regardless of animation completion.
- **Image/chapter entrance:** 350–550ms, small movement at most; reveal once, not every scroll reversal. Group stagger total capped at 180ms.
- **Home signature:** 600–900ms once near the surface boundary; no delayed headline/CTA accessibility.
- **Continuous ambient light and depth offset:** removed from the current pilot after direct browser review found the effect was not perceptually useful. Do not add these back without a concrete visual benefit, performance evidence and explicit approval.
- **Lifecycle:** keep the one-shot transition bounded and avoid duplicate observers/listeners; no permanent per-element `will-change`.
- **Reduced motion:** show the static waterline immediately and keep all content visible. Essential state feedback is immediate or a brief non-spatial colour/opacity change.
- **Progressive enhancement:** default HTML visible; don't add a hide class until an observer is safely available. Keyboard focus must never land on an invisible reveal target. Failed JS never hides primary content.
- **Do not add:** WebGL ocean simulation, pagewide SVG turbulence, full-screen video, scroll-smoothing library, custom cursor, navigation transition that delays links, perpetual heading floats.

## 7. Image commissioning and preservation plan

### Priority A: highest UX value
1. **Iris portrait:** real, approved, 4:5; natural light, recognisable face, uncluttered background, room for crop. Lives in About. No generated substitute.
2. **Tioman feature:** approved, accurately located photograph, landscape 3:2 with mobile crop; coast/boat/reef subject that explains the actual experience. Lives in Trips and optionally one Home feature. Rights/location confirmed.
3. **Learning moment:** candid instructor/student interaction, landscape 3:2; safe visible behaviour, participant permission, no unsupported certification/safety implication. Home or About, not duplicated in every section.
4. **Gallery collection:** approved diverse frames with source, photographer, rights, consent, factual location, caption, alt and focal point recorded.

### Priority B: immersive atmosphere
5. **Layered surface treatment:** preserve current Home painting; commission only missing complementary light/waterline plates. Wide desktop and separately art-directed portrait mobile framing, subject detail away from copy.
6. **Continuous environment plates:** shallow light, low-detail mid-water, final reef floor with matching pigment and colour. Reuse current `assets/backgrounds/ocean/` wherever possible. Seamless transitions, not visibly repeated cards or one image distorted to every page height.

### Priority C: optional, only if a concrete gap remains
7. Courses learning/environment photograph and a quiet Contact horizon variation. Existing artwork is acceptable; these are not mandatory purchases/generation.

### Illustration brief template for later approval
“Hand-painted watercolour ocean atmosphere matching the approved Okim Dive artwork; transparent pigment edges and subtle paper grain; blue-green water with warm surface light; open, low-detail reading space; coral detail confined to edges/bottom; calm non-photoreal illustration; no text, logos, fabricated people or location-specific wildlife claims. Compose separately for desktop and mobile.”

### Delivery contract
- Keep original artwork untouched; optimized derivatives use explicit filenames and provenance. Never silently replace approved images.
- Prefer responsive WebP derivatives; consider AVIF only with measured quality benefit and fallback. Preserve PNG-like alpha where required.
- Proposed targets: small round illustrations ≤80KB each; typical content photos ≤180KB at needed display size; hero layer set ≤500KB desktop / ≤250KB mobile. These are budgets to validate visually, not a claim of achievable quality for every source.
- Use explicit width/height or aspect ratio, `srcset`/`sizes`, sensible focal points; preload only the genuine critical hero/LCP asset, lazy-load below-fold photos.
- Alternative text describes meaningful photographs, not decorative washes; decorative images use empty alt or CSS.
- No downloading stock or generating assets during planning. Obtain approval for source/licensing and any paid generation.

## 8. Implementation sequence AFTER explicit approval

### Task 1: Freeze baseline and resolve design/content decisions
**Files:** read `AGENTS.md`, `docs/design/OKIM-DIVE-VIBE.md`, `CONTENT-REVIEW-CHECKLIST.md`, `BRAND-GUIDE.md`, `DESIGN-SYSTEM.md`; proposed `DESIGN.md` and product/context documentation only after reconciliation approval.
1. Verify branch and preserve unrelated changes; do not touch `main`.
2. Capture stable EN/ZH desktop/mobile baseline and key interactions.
3. Confirm document precedence, sample-trip publication, business claims, enquiry destination and asset availability.
4. Record selected immersive direction and a short motion/image contract. Do not rewrite history in Cosmos Star.
**Gate:** Jeff approves the proposed direction and unresolved consequential choices; production-blocking unknowns remain explicit.

### Task 2: Design pilot before whole-site rollout
**Files likely:** `pages/index.html`, `styles/styles.css`, `styles/redesign.css`, `scripts/site/site-motion.js`, approved `assets/backgrounds/` derivatives.
1. Propose a Home visual storyboard showing surface, transition, chooser, and ending at desktop/mobile.
2. Obtain approval for the composed pilot, not merely a list of effects.
3. Add motion/no-JS/reduced-motion tests that fail against missing behavior.
4. Consolidate environmental ownership and implement only the approved Home composition/signature.
5. Review normal motion on real viewport, low-motion version, screenshots and performance together.
**Gate:** visibly stronger immersive identity without worse clarity or mobile speed; otherwise simplify before rollout.

### Task 3: Consolidate shared foundations
**Modify:** `styles/styles.css`, `styles/redesign.css`, all `pages/*.html`, `scripts/site/site-motion.js`.
1. Map active cascade rules and remove obsolete duplicate background/motion overrides in coherent groups.
2. Retain shared structure; no new `redesign-v2.css` or per-route patch pile.
3. Align font imports to approved bilingual roles and repair Trips' missing display font request.
4. Implement stable heading/body/control tokens, shared readable wash, responsive gutters and accessible motion toggle.
5. Test keyboard, reduced motion, offscreen pause and JS failure before expanding pages.
**Gate:** foundation change reviewed across all six routes, not Home alone.

### Task 4: Courses and Contact clarity
**Modify:** `pages/courses.html`, `pages/contact.html`, shared styles, `scripts/site/site-i18n.js`; create a focused contact UI script only if approved behavior needs one.
**Tests proposed:** `tests/courses.spec.mjs`, `tests/contact.spec.mjs`.
1. Write failing tests for FAQ keyboard disclosure, preserved package visibility, contextual interest selection and no false submission success.
2. Refactor FAQ and field grouping; preserve unique copy and bilingual coverage.
3. Hold operational submission until transport/business rules approved. Use intercepted requests/synthetic input only in tests; never a real enquiry.
4. Review narrow screens, long Chinese labels, zoom, validation/focus and expanded details.
**Gate:** clarity and shorter navigation path without loss of required information.

### Task 5: About trust and story
**Modify:** `pages/about.html`, shared styles, i18n, approved image derivatives.
1. Confirm portrait consent and content claims.
2. Implement portrait/story composition and compact mobile reading layout.
3. Preserve standalone round art; reduce repeated supporting copy only with meaning retained.
4. Screenshot-review no-portrait fallback and approved-photo state.
**Gate:** human credibility without invented proof.

### Task 6: Trips discovery and state handling
**Modify:** `pages/trips.html`, `scripts/site/trips-data.js`, `scripts/site/site-motion.js`, `scripts/site/site-i18n.js`, shared styles; extend `data/trips/*.json` only for approved image metadata/non-business fields.
**Test proposed:** `tests/trips.spec.mjs`.
1. Write failing tests for partial fetch failure, all-failure recovery, delayed content visibility/reveal, sample labelling, dialog keyboard close/focus return and context handoff.
2. Implement tiered composition, approved imagery and robust data states.
3. Keep native dialog and readable no-JS fallback; preserve safe escaping of data.
4. Review longest title, Chinese text, sample/on-request states and mobile full-dialog scroll.
**Gate:** no sample mistaken for bookable inventory; no empty/frozen catalogue on one failed request.

### Task 7: Gallery conditional rollout
**Modify:** `pages/gallery.html`, shared styles/i18n; create `scripts/site/gallery.js` only when approved photos justify a viewer.
**Test proposed:** `tests/gallery.spec.mjs`.
1. Write tests for honest empty state; later, viewer keyboard/focus/captions if real images exist.
2. Ship one compact empty state or the curated collection, never synthetic documentary photography.
3. Retain normal links and captions without JS.
**Gate:** image rights/consent and accurate context; no duplicate conversion panels.

### Task 8: Full acceptance and handoff
**Tests:** extend `tests/smoke.spec.mjs`; proposed `tests/motion.spec.mjs`, `tests/visual-regression.spec.mjs`; update `playwright.config.mjs` with explicit normal/reduced-motion coverage without losing current smoke checks.
1. Run `npm run lint`, `npm run build`, `npm run test:ui`, `git diff --check`.
2. Directly inspect every route in EN/ZH at 390, 768 and 1280 widths; check 320px and 200% zoom edge cases. Cover Chrome and available Safari/WebKit, clearly flagging unavailable real-device testing.
3. Review screenshots after final shared change, plus normal-motion sequences; screenshots alone cannot certify animation.
4. Independent design review and code/accessibility review; verify differences from the approved pilot.
5. Inspect Lighthouse/network/performance evidence under documented conditions and compare to baseline.
6. Only after approval commit verified coherent work on `UI-Refactor`; no merge/push/deployment is implied by approval of this plan.

## 9. Acceptance criteria

- All six pages visibly belong to the same immersive watercolour world, while each serves its distinct visitor task.
- Home has an authored surface-crossing moment and image-led narrative, not only generic fade-ins.
- Text/actions stay stable and readable; no floating headings, scroll hijack, hover-only controls or animation-dependent content.
- Reduced motion, one-shot transition safeguards and no-JS fallback work; changing motion preference does not duplicate observers or listeners. Continuous ambient motion is not required and should not be retained merely because it is technically active.
- EN and Simplified Chinese cover new static and dynamically inserted content, labels, errors and state announcements.
- All interactive targets have visible keyboard focus and generally at least 44px touch area. Modal, menu, disclosures, gallery and form paths are keyboard-tested.
- Contrast targets: WCAG AA 4.5:1 normal text, 3:1 large text and relevant UI boundaries; measure against actual backgrounds, not nominal colour tokens.
- No horizontal overflow, image distortion or layout shift from missing image dimensions at tested widths.
- Proposed performance goals, not current results: mobile LCP ≤2.5s, CLS ≤0.1 and field INP ≤200ms when field data exists. Lab interaction timing is not field INP. Record device/network/cache/test conditions; remove expensive effects if budgets regress.
- Gallery/portrait/trip images have approved provenance. No fabricated operational details, counters, photo authenticity or enquiry success.
- UI redesign completion is separate from production launch: unresolved transport/business/content issues still block launch.

## 10. Open decisions and tradeoffs

1. Approve this immersive plan, then approve the Home pilot before all-page changes.
2. Confirm use/availability of genuine Iris, student, Tioman and Gallery photographs and whether new atmospheric plates may be generated.
3. Resolve existing Refresher inclusions/credentials/statistics and verify published course/trip facts; source presence alone is not validation.
4. Decide whether sample international trips remain in a clearly separate preview area or are omitted from public launch.
5. Confirm the real enquiry delivery workflow and WhatsApp destination; backend integration remains a separately scoped dependency.
6. Approve reconciliation of stale design/vault records. Do not silently convert current Fraunces/Noto roles back to legacy Playfair guidance.
7. More immersive layers cost download/render work. Favor one strong, perceptible Home transition over ambient effects that users cannot see. Keep Courses/Contact deliberately quieter without abandoning the brand.

## 11. Reference basis for motion safeguards

- W3C, [Understanding Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): automatically moving information lasting more than five seconds alongside other content needs a pause/stop/hide mechanism unless essential. The current pilot avoids that requirement by removing continuous ambient motion.
- MDN, [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): honor OS preferences; large-object panning/scaling can cause vestibular discomfort.
- web.dev, [High-performance CSS animations](https://web.dev/articles/animations-guide): use rendering-aware animation techniques and verify rather than assuming all visual effects are cheap.

**Questions skipped beyond the direction choice:** existing brand/audience/routes are sufficiently grounded for a proposal; remaining asset/business decisions are explicit approval gates, not guessed answers. No implementation follows this document automatically.
