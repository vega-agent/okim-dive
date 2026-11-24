# Okim Dive - Design System

**Version:** 1.34
**Created:** 2026-01-XX
**Inspired by:** Stripe, Notion, Airbnb design systems
**Approved Direction:** Continuous Underwater Editorial / Dive Journal
**Last Updated:** 2026-11-23
**Applies to:** migrated Next.js app (public pages + booking flow + instructor portal + My Okim) per `MVP-SPEC.md` and approved change-control through #46

> This document describes the approved implementation direction, not an aspirational alternative. Future pages must extend the current underwater environment rather than introducing a new visual language.
>
> Pair this system with [OKIM-DIVE-VIBE.md](OKIM-DIVE-VIBE.md), the project rule for emotional tone, copy decisions, imagery, and future generated visuals.

### Non-negotiable visual rules

- Use one continuous underwater canvas after the hero: bright surface/light rays at the top, open mid-sea content in the middle, and seabed only at the final content section.
- Keep hero banners visually distinct from the post-hero journey.
- Let the background create atmosphere, but keep content and controls in the foreground with strong contrast.
- Use light editorial reading surfaces only where text needs protection; do not add dark glass panels.
- Prefer asymmetrical editorial composition, generous whitespace, restrained borders, and photography-led storytelling over repeated card grids.
- Treat watercolor artwork as a quiet environmental layer, never as a collection of unrelated decorative stickers.
- Use title-led sections by default; do not place decorative kickers or starter lines above a heading unless they carry necessary information.
- Use the shared `.intro-content` editorial surface for large reading/CTA blocks that need a translucent watercolor wash. Do not introduce opaque white panels or one-off watercolor treatments when an existing shared surface fits.
- Preserve the watercolor CSS (`styles.css` / `redesign.css`), `prefers-reduced-motion` behavior, and no-JS content resilience. The site is migrating to Next.js App Router (PRD Decision 4); the design is ported verbatim, not rewritten — no Tailwind, no visual redesign.

## 1. Visual Theme & Atmosphere

Okim Dive embodies a **watercolor ocean aesthetic** — soft, organic, and inviting. The design operates on warm neutrals with ocean-inspired accents, creating a canvas that feels like quality paper meeting the sea.

The typography uses **Fraunces** (weight 500) for English display headlines paired with **Lato** for body text (clean, readable sans-serif). Chinese content swaps to **Noto Serif SC** (headings) and **Noto Sans SC** (body/UI) — see the bilingual rules below. Headlines keep a calm, restrained presence — confidence through restraint, not volume.

What distinguishes the visual language:
- **Watercolor-inspired color palette**: Soft blues, aquas, sandy neutrals with coral accents
- **Organic shapes**: Rounded corners (8px standard), flowing layouts
- **Whisper borders**: `1px solid rgba(0,0,0,0.08)` — barely perceptible structure
- **Soft shadows**: Blue-tinted, multi-layer for natural depth
- **Photography-forward**: Large, immersive images that breathe
- **Generous whitespace**: Content islands in a sea of calm

**Key Characteristics:**
- Fraunces (serif) weight 500 for English display headings — confident, elegant
- Lato (sans-serif) 400/700 for body, UI, forms, buttons
- Noto Serif SC 600 for Chinese display headings; Noto Sans SC 400/600 for Chinese body and UI (matches live `styles.css` variables)
- Ocean palette: #A8DADC (mist), #457B9D (deep), #F1FAEE (sand), #E63946 (coral accent)
- Whisper borders: `1px solid rgba(0,0,0,0.08)` throughout
- Soft, blue-tinted shadows for natural elevation
- Generous border-radius: 8px buttons, 12px cards, 16px large elements
- Photography as hero — underwater shots, landscapes, student experiences
- Near-black text (#264653 deep sea) — warm, not cold

---

## 2. Color Palette & Roles

### Primary Ocean Palette
- **Ocean Mist** (`#A8DADC`): Soft blue-green, section backgrounds, subtle accents
- **Deep Water** (`#457B9D`): Muted blue, secondary CTA, links, interactive elements
- **Sand** (`#F1FAEE`): Warm off-white, primary page background (not pure white)
- **Cloud** (`#FEFAE0`): Very light warm white, alternating sections

### Accent Colors
- **Coral** (`#E63946`): Primary CTA buttons, important highlights (use sparingly)
- **Sunset** (`#F4A261`): Warm orange, feature highlights, badges
- **Kelp** (`#2A9D8F`): Teal green, secondary accents, success states

### Text Colors
- **Deep Sea** (`#264653`): Primary headings, nav text — warm, not cold
- **Driftwood** (`#6C757D`): Body text, secondary content
- **Foam** (`rgba(255,255,255,0.9)`): Light text on dark backgrounds

### Surface & Borders
- **Whisper Border** (`1px solid rgba(0,0,0,0.08)`): Standard card borders
- **Soft Border** (`1px solid rgba(0,0,0,0.12)`): Active/focused states
- **Card Shadow**: `rgba(69,123,157,0.08) 0px 2px 8px, rgba(0,0,0,0.04) 0px 1px 3px`

### Interactive States
- **Deep Water Hover** (`#3a6a87`): Darker blue for link/button hover
- **Coral Hover** (`#d42f3d`): Darker coral for CTA hover
- **Focus Ring** (`2px solid #457B9D`): Keyboard focus indicator

---

## 3. Typography Rules

### Font Families
- **English display headings**: `'Fraunces', Georgia, serif` (weight 500)
- **English body/UI**: `'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (400/700)
- **Chinese display headings** (`html[lang="zh-CN"]`): `'Noto Serif SC', 'Songti SC', 'STSong', serif` (600)
- **Chinese body/UI**: `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif` (400/600)
- **Decorative script** (Great Vibes): atmosphere only; never for Han characters and never for content hierarchy

**Bilingual rule (first-class, all surfaces):** every new surface — booking flow, portal pages, My Okim, policy pages, and transactional emails — inherits the role-based font swap. Do not design any page or component in English only and "translate later"; layout, buttons, tables, and badges must be checked with `lang="zh-CN"` active (Chinese text runs longer; verify wrapping and truncation).

Weights below are the English defaults; Chinese equivalents use the families above at the same visual size.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Hero Heading | Fraunces | 48px (3.00rem) | 500 | 1.10 | -0.5px | Maximum size, calm elegance |
| Section Heading | Fraunces | 36px (2.25rem) | 500 | 1.15 | -0.3px | Feature section titles |
| Card Title | Fraunces | 28px (1.75rem) | 500 | 1.20 | -0.2px | Card headings, sub-sections |
| Sub-heading | Fraunces | 24px (1.50rem) | 500 | 1.25 | -0.1px | Smaller section heads |
| Body Large | Lato | 18px (1.13rem) | 400 | 1.60 | normal | Feature descriptions, intro text |
| Body | Lato | 16px (1.00rem) | 400 | 1.60 | normal | Standard reading text |
| Body Small | Lato | 14px (0.88rem) | 400 | 1.50 | normal | Captions, metadata |
| Button | Lato | 16px (1.00rem) | 400 | 1.00 | normal | Button labels |
| Nav Link | Lato | 15px (0.94rem) | 400 | 1.00 | 0.3px | Navigation links |
| Badge | Lato | 12px (0.75rem) | 600 | 1.33 | 0.5px | Tags, status labels |

### Typography Principles
- **Restrained display weight**: Fraunces 500 for English headings, Noto Serif SC 600 for Chinese — calm, not loud
- **Serif headlines, sans-serif body**: Fraunces for personality, Lato for readability
- **Generous line-height**: 1.60 for body text creates breathing room
- **Negative tracking on English headlines**: -0.1px to -0.5px creates intimate, warm headings (does not apply to Han text)
- **Weight system**: English 400/500/700; Chinese 400/600; Lato 600 only for badges

---

## 4. Component Stylings

### Buttons

**Primary Button (Coral)**
```css
background: #E63946;
color: #ffffff;
padding: 12px 24px;
border-radius: 8px;
font: 16px Lato weight 400;
box-shadow: 0 2px 4px rgba(230,57,70,0.2);
transition: all 0.2s ease;
```
- Hover: `background: #d42f3d; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(230,57,70,0.3);`
- Use: Primary CTA ("View Courses", "Book Now")

**Secondary Button (Deep Water)**
```css
background: transparent;
color: #457B9D;
padding: 12px 24px;
border-radius: 8px;
border: 2px solid #457B9D;
font: 16px Lato weight 400;
transition: all 0.2s ease;
```
- Hover: `background: rgba(69,123,157,0.05); border-color: #3a6a87;`
- Use: Secondary actions ("Explore Trips")

**Text Link**
```css
color: #457B9D;
text-decoration: none;
transition: color 0.2s ease;
```
- Hover: `color: #3a6a87; text-decoration: underline;`

### Cards

**Standard Card**
```css
background: #ffffff;
border: 1px solid rgba(0,0,0,0.08);
border-radius: 12px;
padding: 24px;
box-shadow: rgba(69,123,157,0.08) 0px 2px 8px, rgba(0,0,0,0.04) 0px 1px 3px;
transition: all 0.2s ease;
```
- Hover: `transform: translateY(-4px); box-shadow: rgba(69,123,157,0.12) 0px 4px 16px, rgba(0,0,0,0.06) 0px 2px 6px;`

**Feature Card (Icon + Text)**
- Background: `#ffffff`
- Border: `1px solid rgba(0,0,0,0.08)`
- Radius: `12px`
- Padding: `32px 24px`
- Icon: 48px, centered, ocean color
- Title: 24px Fraunces weight 400
- Description: 16px Lato weight 400, Driftwood color

### Navigation

**Desktop Nav**
```css
background: #ffffff;
height: 72px;
box-shadow: 0 1px 3px rgba(0,0,0,0.05);
position: sticky;
top: 0;
z-index: 100;
```
- Logo: 24px Fraunces weight 400, Deep Sea color
- Links: 15px Lato weight 400, Driftwood color, 0.3px letter-spacing
- Active state: `color: #457B9D; border-bottom: 2px solid #457B9D;`
- Hover: `color: #457B9D;`

**Mobile Nav**
- Hamburger menu icon (3 lines, 24px)
- Full-screen overlay on open
- Large touch targets (48px minimum)
- Smooth slide-in animation

### Hero Section

The live site uses the approved watercolor hero artwork (see `WATERCOLOR-DESIGN-ELEMENTS.md`), not a flat gradient. The early prototype direction (reference only):

```css
background: linear-gradient(135deg, #A8DADC 0%, #457B9D 100%);
color: #ffffff;
padding: 120px 24px;
text-align: center;
position: relative;
overflow: hidden;
```
- Heading: 48px Fraunces weight 500, white
- Subtitle: 20px Lato weight 400, rgba(255,255,255,0.9)
- CTA buttons: Coral primary + transparent secondary
- Optional: Subtle wave SVG overlay at bottom

### Form Inputs

```css
background: #ffffff;
border: 1px solid rgba(0,0,0,0.12);
border-radius: 8px;
padding: 12px 16px;
font: 16px Lato weight 400;
color: #264653;
transition: all 0.2s ease;
```
- Focus: `border-color: #457B9D; box-shadow: 0 0 0 3px rgba(69,123,157,0.1);`
- Placeholder: `color: #6C757D;`

### Badges / Tags

```css
background: rgba(244,162,97,0.15);
color: #F4A261;
padding: 4px 12px;
border-radius: 999px;
font: 12px Lato weight 600;
letter-spacing: 0.5px;
```

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px, 128px

### Grid & Container
- Max content width: 1200px
- Container padding: 24px (mobile), 48px (desktop)
- Section padding: 96px vertical (desktop), 64px (mobile)

### Whitespace Philosophy
- **Generous vertical rhythm**: 96-128px between major sections — content breathes
- **Warm alternation**: Sand (#F1FAEE) sections alternate with Cloud (#FEFAE0) for gentle visual rhythm
- **Content islands**: Cards and sections float in generous whitespace
- **Translucent editorial surfaces**: When a section needs text protection, use a shared translucent watercolor wash that lets the underlying environmental artwork remain present. The surface should read as a soft wash, not a solid white card.
- **Photography space**: Large images with breathing room, not cramped

### Border Radius Scale
- Subtle (4px): Small badges, inline elements
- Standard (8px): Buttons, inputs, small cards
- Comfortable (12px): Feature cards, content containers
- Large (16px): Hero cards, large containers
- Full Pill (999px): Badges, tags

### Visual storytelling patterns

- **Journey track:** Use for ordered progress such as course levels or booking steps. Keep labels short and pair each stage with a restrained numbered marker.
- **Icon-led scanning:** Use consistent inline SVG icons for equipment, experience level, safety, duration, and destinations. Icons must clarify content, not decorate empty space.
- **Progressive reveal:** Use the shared `site-motion.js` reveal behavior for section and node entrances. Content remains visible without JavaScript and all motion yields to `prefers-reduced-motion`.
- **Page-specific rhythm:** Home uses depth, About uses story, Courses uses progression, Trips uses destination flow, Gallery uses image chapters, and Contact uses calm conversion.
- **Title-led sections:** Prefer one clear heading followed by purposeful supporting copy. Decorative kickers are not part of the default hierarchy.
- **Shared watercolor surfaces:** Reuse `.intro-content` for editorial reading and CTA blocks that need a translucent watercolor wash. Keep product cards separate from this surface contract.
- **Trip detail dialog:** Present data-driven trip information in a readable sequence: atmospheric header, compact key-fact strip, two-column detail sections on desktop, single-column stacking on mobile, then planning note and CTA. Render `included` and `additionalCosts` as separate sections; never imply a universal package.
- **Mobile fallback:** Horizontal journeys stack vertically with directional markers; never require horizontal scrolling or scroll hijacking.

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow | Page background, text blocks |
| Soft (Level 1) | `rgba(69,123,157,0.08) 0px 2px 8px, rgba(0,0,0,0.04) 0px 1px 3px` | Standard cards |
| Elevated (Level 2) | `rgba(69,123,157,0.12) 0px 4px 16px, rgba(0,0,0,0.06) 0px 2px 6px` | Hover cards, dropdowns |
| Deep (Level 3) | `rgba(69,123,157,0.16) 0px 8px 24px, rgba(0,0,0,0.08) 0px 4px 12px` | Modals, featured panels |

**Shadow Philosophy**: Blue-tinted shadows (`rgba(69,123,157,...)`) echo the ocean palette, creating elevation that feels brand-colored rather than generic gray. Multi-layer approach pairs a soft ambient shadow with a tighter contact shadow for natural depth.

---

## 7. Interactive States

### Transitions
- Duration: 200ms
- Easing: `ease` (natural)
- Apply to: hover, focus, active states

### Hover Effects
- **Cards**: `transform: translateY(-4px);` shadow intensifies
- **Buttons**: `transform: translateY(-2px);` shadow intensifies
- **Links**: `color` darkens, `text-decoration: underline`
- **Images**: `transform: scale(1.02);` subtle zoom

### Focus States
- All interactive elements: `outline: 2px solid #457B9D; outline-offset: 2px;`
- Keyboard navigation supported throughout

---

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | Single column, 24px padding, 64px section spacing |
| Tablet | 640-1024px | 2-column grids, 32px padding |
| Desktop | 1024-1280px | 3-column grids, 48px padding, 96px section spacing |
| Large Desktop | >1280px | Max-width 1200px centered, generous margins |

### Collapsing Strategy
- Hero: 48px → 36px → 32px heading sizes across breakpoints
- Navigation: horizontal links → hamburger menu
- Feature cards: 3-column → 2-column → single column stacked
- Section spacing: 96px → 64px on mobile

---

## 9. Implementation Guide

### CSS Variables
```css
:root {
  /* Colors */
  --ocean-mist: #A8DADC;
  --deep-water: #457B9D;
  --sand: #F1FAEE;
  --cloud: #FEFAE0;
  --coral: #E63946;
  --sunset: #F4A261;
  --kelp: #2A9D8F;
  --deep-sea: #264653;
  --driftwood: #6C757D;

  /* Typography */
  --font-heading: 'Fraunces', Georgia, serif;
  --font-body: 'Lato', -apple-system, sans-serif;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* Shadows */
  --shadow-soft: rgba(69,123,157,0.08) 0px 2px 8px, rgba(0,0,0,0.04) 0px 1px 3px;
  --shadow-elevated: rgba(69,123,157,0.12) 0px 4px 16px, rgba(0,0,0,0.06) 0px 2px 6px;

  /* Borders */
  --border-whisper: 1px solid rgba(0,0,0,0.08);
  --border-soft: 1px solid rgba(0,0,0,0.12);
}
```

### Google Fonts Link
```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Lato:wght@400;700&family=Noto+Sans+SC:wght@400;600&family=Noto+Serif+SC:wght@600&display=swap" rel="stylesheet">
```

---

## 10. Design Principles

### Simplicity First
- Clean layouts with generous whitespace
- One clear message per section
- Minimal decorations — let content breathe

### Soft & Organic
- Rounded corners (8-12px standard)
- Soft shadows (blue-tinted for brand cohesion)
- Gentle transitions (200ms ease)
- Flowing, not rigid

### Authentic & Personal
- Real photos over stock
- Personal voice in copy
- Show Iris's personality
- Highlight student experiences

### Nature-Inspired
- Colors from ocean and sky
- Organic shapes and patterns
- Natural textures (subtle watercolor washes)
- Environmental awareness

---

## 11. Do's and Don'ts

### Do
- Use Fraunces 500 (EN) / Noto Serif SC 600 (中文) for headlines — restrained elegance
- Apply blue-tinted shadows for brand cohesion
- Use #264653 (Deep Sea) for headings — warm, not cold
- Keep border-radius between 8px-16px — organic, not harsh
- Use generous whitespace — content needs to breathe
- Apply negative letter-spacing on English headlines for warmth
- Use photography as hero — underwater shots, student experiences
- Use Coral (#E63946) sparingly — only for primary CTAs
- Check every new UI surface with `lang="zh-CN"` active — Chinese text runs longer

### Don't
- Don't use heavy display weights (700+) for headlines — 500/600 is the voice
- Don't use pure black (#000000) — always Deep Sea (#264653)
- Don't use large border-radius (20px+) — 8-16px is organic
- Don't use neutral gray shadows — always tint with ocean blue
- Don't crowd content — generous whitespace is essential
- Don't use warm accent colors (Sunset, Kelp) for buttons — Coral is primary
- Don't apply negative letter-spacing to Han text — track normal
- Don't use stock photos — authentic images only
- Don't design English-only components and "translate later" — bilingual is first-class

---

## 12. Page Templates (marketing pages)

> These describe the six migrated public pages (existing implementations are the reference). New routes from `MVP-SPEC.md` §10 — `/trips/[slug]`, `/book/[tripSlug]`, `/my`, `/portal`, `/refund-policy`, `/privacy`, `/terms` — follow §13 plus the original page's compositional patterns.

### Home Page (pilot, approved 2026-11-19 — MVP-SPEC decision #19)
1. **Pilot hero**: full-viewport sunlit-surface → underwater watercolor scene, "Explore the Ocean With Wonder", Explore Courses / View Trips actions
2. **Painted waterline**: one-shot crossing enhancement (bounded, reduced-motion safe); no continuous ambient animation on home
3. **Philosophy**: "Learn with care. Explore with wonder." reading wash + Meet Iris link
4. **Chooser**: Learn / Return / Explore — three parallel paths (not certification steps)
5. **Tioman feature**: honest "On request" invitation for certified divers
6. **Enquiry ending**: one primary CTA to contact; unified footer

### About Page
1. **Hero**: "About Okim Dive"
2. **Meet Iris**: Photo + bio + story
3. **Why Tioman**: Destination highlights
4. **Our Approach**: Teaching philosophy, safety, personalization

### Courses Page
1. **Hero**: "Dive Courses"
2. **Course Grid**: 4 cards (Open Water, Advanced, Try Scuba, Private)
3. **What's Included**: Equipment, materials, certification
4. **Prerequisites**: Age, swimming, medical

### Trips Page
1. **Hero**: "Dive Trips"
2. **Trip Grid**: Destination cards (Tioman, Semporna, overseas)
3. **What's Included**: Dives, accommodation, transfers
4. **Trip Planning**: How it works, group size, skill levels

### Contact Page
1. **Hero**: "Contact Okim Dive"
2. **Contact Methods**: WhatsApp, Email, Instagram cards
3. **Location**: Tioman map, how to get there
4. **FAQ**: Common questions

---

## 13. App Surfaces — Booking, Portal & My Okim (v1.1)

Marketing pages follow the templates above. These rules cover the new app surfaces defined in `MVP-SPEC.md` so portal pages stay inside the approved visual language instead of improvising.

### General app rules
- Same palette, fonts, borders, shadows, and spacing scale as the public site — the portal is the same ocean, not a separate admin theme. No dark sidebars, no dense dashboard chrome.
- Portal pages may use **solid white cards on Sand background** for data-heavy areas (tables, verification queue) — the `.intro-content` translucent wash is reserved for editorial reading; data legibility wins.
- Respect `prefers-reduced-motion`; server-rendered content remains readable before/without hydration.
- Locale handling and the app-surface stacking-context rule are locked in **§14** — read it before any app-surface layout or bilingual change.

### Data tables (portal)
- Standard Card surface (white, 12px radius, whisper border, soft shadow)
- Header row: Body Small (12px Lato 400, uppercase not required), Driftwood color, 1px soft border below
- Rows: 16px Lato 400, Deep Sea text; hover row background `rgba(168,218,220,0.15)`
- Mobile: tables collapse to stacked definition lists — never horizontal scrolling

### Status badges (bookings, inquiries, payments, points)
Map states to the existing palette; reuse the Badge component style (12px Lato 600, 999px pill):

| Status | Color family | Treatment |
|---|---|---|
| Pending / awaiting verification | Sunset `#F4A261` | Existing badge treatment (15% tint bg, colored text) |
| Confirmed / verified / completed | Kelp `#2A9D8F` | Same pattern, Kelp |
| Cancelled / declined | Coral `#E63946` | Same pattern, Coral — but never on a button |
| Refunded / reversed / expired | Driftwood `#6C757D` | Neutral gray pill |
| Earned (points ledger) | Kelp `#2A9D8F` | Same pattern |

Status badges are information, not CTAs. Coral stays reserved for primary action buttons.

### Forms (booking flow, portal editors)
- Use the Form Input spec in §4 (white, 8px radius, soft border, Deep Water focus ring)
- Validation: error border `#E63946` with 2px inset ring; error text Body Small in Coral below the field; success state Kelp text only (no green border flash)
- Multi-step booking flow: one section per step, a restrained journey-track progress indicator (see §5), Back/Continue as secondary/primary buttons — never a destructive-looking Next
- Payment evidence is manual (WhatsApp) in v1 — no upload UI (MVP-SPEC decision #20). The portal's payment-recording form follows the Form Input spec above

### Empty states
- Short heading (Card Title size), one sentence of Body text, one primary CTA where an action exists. Example: verification queue empty → "All caught up" + "Nothing waiting for review."
- No illustrations or watercolor artwork inside empty-state boxes — keep the environmental art on the page background.

### Booking sub-cards & typographic weight discipline (v1.5, owner revision 2026-11-21)
- An upcoming booking reads as **three sub-cards**, each with a header band + body: **Trip information** (title, dates, explained booking reference, status badges, amounts, guidance, invoice/receipt links), **Equipment** (choices + bulk actions + save), **Sizes & fit** (sizes, footwear, fit notes). Close the group with **one disclaimer in Body Small-minus (12px) driftwood** — self-declared data, edit cutoff, rental notices.
- Sub-card surface: white, 10px radius, whisper border; header band `rgba(168,218,220,.14)` with a 1.15rem Fraunces 500 title (CN Noto Serif SC 600); body padding 1.1rem 1.25rem, grid gap .8rem.
- **Weight discipline:** body text, item labels, and amount values are **400**. 600–700 is reserved for card/section headers, badges, and buttons. Group headers inside a sub-card are Lato 700 12.8px uppercase-ish small caps in Deep Water — never serif display, never bold body paragraphs.
- **Identifiers are explained once, where they first appear:** e.g. "Booking reference BKG-001 — use it as your bank transfer reference." Never repeat a bare ID as a heading or in multiple cards without explanation.
- Meta lines (dates, references, helper intro) use Body Small (14px) driftwood; the disclaimer uses 12px.

### Equipment pill board (v1.6, owner experiment 2026-11-21)
- Equipment choices render as **pills in three side-by-side columns — Bring / Rent / No need** (CN 自带 / 需租 / 不需要), with count badges; three columns at ALL viewports (pills wrap inside columns, never clip).
- Moving pills: **drag & drop on desktop**; **tap a pill → destination menu** everywhere (touch + keyboard). On mobile the menu is a **bottom action sheet** (fixed, two destinations side by side) — an anchored popover would cover the neighbouring column at 390px. Escape / outside tap / selection dismisses it.
- Columns **auto-fill from the profile's equipment list** (own→Bring, rent→Rent, none→No need); "Reset from profile" re-applies it. Bulk actions (Bring all / Rent all / Remove all) stay above the board.
- Pill: 44px min tap target, 999px radius, white with whisper border; expanded pill inverts to Deep Sea. Column: sand-tinted surface, dashed mist border while a drag is active.
- **Bulk actions are icon buttons, not text buttons (v1.7):** each column header carries a collect-all icon (tray + down arrow) at its right — Bring all / Rent all / Remove all — with a hover tooltip + aria-label explaining the action; Reset (circular arrow, "auto-fill from profile") sits at the Equipment card head's far right. Icons are 44×44 at all viewports; on mobile the header wraps the icon to a second row rather than shrinking it.
- **Diving icon set + instant tooltips (v1.8):** the collect/reset buttons use generated diving line-icons (mask+snorkel / empty rental tag with bubbles / crossed mask / refresh arrow with bubbles), consistent outline weight, deep-teal on white, served as webp from `/assets/icons/`, displayed 24px inside the 44px button. Hover/focus shows an **instant styled tooltip** (`data-tip` + `::after`, Deep Sea bg, foam text, 12px) — not the delayed native `title`; edge columns align the tooltip inward. Aria-labels carry the same text for assistive tech.

### Icon system (v1.9, owner: "I love the icons — where else?")
- **Inventory** (`public/assets/icons/`, transparent webp, monoline deep-teal `#1B4965`, uniform rounded stroke ≈ 1/10 canvas): `ui-dive-flag` (Upcoming), `ui-anchor` (Past), `ui-pearl` (Points/My Rewards), `ui-diver` (Profile), `ui-compass` (Trip information), `ui-wetsuit` (Sizes & fit), `eq-bring-mask` (Bring / Equipment head), `eq-rent-tag` (Rent), `eq-remove-crossed-mask` (No need), `eq-reset-bubbles` (Reset).
- **Style spec:** outline only, no fills, no text, single teal on transparent; generated on white then keyed to alpha (unmix against white) so icons sit on any surface. 20px in tabs and card/panel headers; 24px inside 44px icon-only buttons. Never recolor per surface except the selected-tab inversion.
- **Placement rules (wayfinding only):** icons accompany **tab labels and card/panel headers**, plus the established icon-only bulk actions. **Never** inside body text, status badges, amount values, empty-state boxes (§13 forbids artwork there), the navbar, or text buttons that already carry a clear label.
- **Selected state:** on the Deep Sea selected-tab pill, invert the icon with `filter: brightness(0) invert(1)` (foam on deep sea); unselected tabs show teal on white. Header icons stay teal on light bands.
- **Footer paint order (v1.13):** `.footer` must be `position: relative; z-index: 1`. App surfaces (`main.my-okim`, `main.portal`) are positioned with an opacity-1 watercolor `::before`; a static footer paints BEFORE positioned surfaces and gets covered — its own height then reads as a huge empty gap and the footer seems missing. Public pages mask this because their wash is opacity .08.
- **New icons** must match the inventory style (same stroke weight, teal, outline-only, centered with margin) and be reviewed at 20px before shipping; regenerate rather than hand-mixing styles.
- **Profile tab layout (v1.10, owner: "width not the same as the navigation… layout horrible"):** Profile spans the **full container width, equal to the tab bar** (no narrower card). Three sub-cards: **Contact & language** (ui-contact icon; 3-column grid name/phone/language; ID+email meta with the "ID permanent, email via Iris" explanation), **Certification & dives** (ui-cert-card icon; 3-column agency/level/dives; self-declared meta), **Equipment defaults** (eq-bring-mask icon; 2-column checkbox grid + 4-column sizes grid; meta explains auto-fill into new bookings). One right-aligned **Save profile** with status beside it; rental notices as 12px fine print last. Field grids collapse to 1 column (sizes 2) on mobile. Inventory adds `ui-cert-card` and `ui-contact`.
- **Sizes & fit is a 4-column grid** (Wetsuit size / BCD size / Footwear size / Fit note), 2×2 on mobile; cells whose item isn't rented stay visible but disabled + dimmed with a "only needed when rented" tooltip. **Other equipment note** is the only field below the grid. **Save** ends the Sizes card, right-aligned, with its status message beside it.

### Portal tabs and compact data rows (v1.14, owner decisions 2026-11-22)
- The instructor portal is **4 action-first tabs** — Actions (default) / Bookings / Money / Manage — replacing the 9-section anchor stack (owner: "way too long to scroll… pages stacked without grouping"). Same tab language as My Okim: sticky white bar, 44px pills, inventory icons at 20px, count badges, Deep Sea selected pill with inverted icon, arrow-key navigation. Styles live in `styles/portal-tabs.css` (portal-scoped; redesign.css untouched).
- **Actions** shows only actionable work: verification queue FIRST (demo centerpiece), record-payment form, eligibility-review rows (diver · trip · Review button jumping to the booking in Bookings with declarations open), new inquiries, diver updates. Empty blocks collapse to one-line hints; empty queue keeps the §13 "All caught up" state.
- **Bookings** rows are compact white sub-cards: diver name heading (700), status/eligibility/Sample badges, meta line (trip · booking ref · deposit) in Body Small driftwood 400. Active/Past/All filter pills reuse `.kind-pill`; trip dropdown beside them. Lists cap at 5 with an explicit show-all button (owner dashboard rule). Declarations render as a labelled grid (bilingual human labels, 400 weight, never raw JSON keys); booleans as Yes/No.
- **Identifiers:** booking refs explained once in the Bookings hint ("Booking references (BKG-…) double as the bank transfer reference"); payment UUIDs are NEVER displayed — pickers read `booking · diver · amount · kind`; queue rows omit the transfer reference when it equals the booking ID. Empty customer names fall back to the customer ID.
- **Money** groups receipts + refund/redeem/completion forms + capped ledger; **Manage** wraps the unchanged trips/policies/settings editors. Deep links (`/portal#verify`, `#points`, `#settings`…) open the owning tab on load.
- Regression: `tests/portal-tabs.spec.mjs` (mutations project, zero sends, full fixture cleanup — owner: Neon free tier, no test residue) + EN zero-CJK scans per §14 on every tab.

### Booking-request cards and the seamless flow (v1.15, owner decisions S1–S5, 2026-11-22)
- The Actions tab leads with **booking-request cards** (`.portal-request`, compact sub-card per §13): diver name heading, status + Sample badges, meta line `trip · BKG ref · expected amount`, hold countdown line ("Transfer by … · n days left"), then the action row: **[Received]** primary (one click = record + verify + confirm + email), Extend +7/+14 secondary pills, and two folded escapes — "Different amount" (pre-filled amount/kind/date form) and "Release slot" (reason + release). Legacy recorded claims keep a small verify list only when present.
- **Never re-enter known data:** the expected amount, reference and currency come from the booking; Iris only asserts the bank match. Human decisions (bank match, suitability, trip happened) stay explicit clicks; everything else is automatic and audited.
- Full trip pages replace the Book CTA with a **Register interest** form (§4 inputs, `.portal-consent` 44px label, PDPA checkbox) under a Full badge; success/error banners via `?interest=` redirect params. Trip-level **Mark completed** sits in Manage → Trips for ended trips.
- Wizard confirmation shows "Transfer deposit by" (14-day hold due date); the transfer prompt email carries the same facts. Styles: `styles/portal-tabs.css` (imported by portal AND trip pages).

### Eligibility removal + condensed bookings (v1.16, owner decision 2026-11-22)
- **No eligibility approval anywhere** (owner: self-declaration can't be verified by a click). Booking rows carry status + Sample badges only, with a right-aligned **Withdraw** secondary button on active rows (paid → refund review, unpaid → cancelled). The Actions eligibility-review section is gone.
- **Truthfulness disclaimer** is mandatory fine print (12px, `.my-disclaimer`) on the booking wizard (above submit) and the diver profile (last line): true/complete/accurate at the point of registration, diver responsible, tell Iris immediately on change. Declarations summary reads "Self-declared information", never "approved".
- **Bookings list condensed:** tighter row padding/gap, cap **10** + show-all (owner: more listings visible; overrides cap-5 for this list only). Legacy `eligibility_declined` displays as "Withdrawn / 已退出" (neutral).

### Portal v2 — trip-centric tabs, folding cards, dialogs (v1.18, owner decisions 2026-11-22)
- The portal regrouped around the trip (owner approved PORTAL-REDESIGN-V2-PLAN): **Actions 待办 (default) / Trips 行程 / Money 财务 / Settings 设置**. Same tab language as v1.14 (sticky bar, 44px pills, 20px inventory icons, count badges, arrow keys, Deep Sea selected pill). Settings reuses ui-anchor pending a dedicated gear icon.
- **Actions = only clickable work**: booking-request cards (Received flow unchanged) → refunds to record (refund_flagged bookings, pre-filled refund dialog) → completions to mark (one group per ended trip, per-diver dialog) → inquiries & register interest (trip context shown) → legacy recorded claims when present. Empty = "All caught up". Read-only diver updates moved to a collapsed fold at the bottom of Trips.
- **Trips = trip workspace**: one white card per trip (upcoming first; past trips in a collapsed fold). Face carries the whole story: dates · slots x/y · confirmed count · completion x/y · messages published + seen x/y (seen = reads by deposit_verified/confirmed divers, matching message-actions). Buttons: Messages (direct link to the composer page — trip-messages chat owns that page), Edit, Duplicate, Close trip. Folded manifest inside each card; per-booking rows expose Info / Equipment / Complete / Withdraw via dialogs. "All bookings" cross-trip flat list (v1.16 filters, cap 10) stays as a collapsed fold; booking anchor IDs (`#booking-…`) exist ONLY in that flat list, never in trip manifests (duplicate-ID rule).
- **Folding cards (V7)**: native `<details class="portal-fold">` — white card, 56px summary head (optional icon + Fraunces 500 1.15rem title + count pill + rotating chevron), hover mist tint, body separated by a whisper border. Open by default ONLY when the group has actionable items; reference groups (receipts, ledger, diver updates, past trips, manifests, all bookings) start collapsed. (?) help toggles sit at the top-right of the fold body.
- **Dialogs (V8)**: one native `<dialog class="portal-dialog">` for one-time actions and viewing — compact trip-dialog language (white, 16px radius, mist header band, 44px round ×, deep backdrop, min(600px, 100%−2rem)). Esc / backdrop / × close; closes on submit; server action revalidates. Contents pre-filled from the originating card (expected amount, original payment, booking context) — never re-enter known data. Destructive confirms (Release slot, Withdraw) state the outcome in plain language and use the coral solid button.
- **Button restyle (V6, app-surface deviation)**: inside `main.portal` only — primary = Deep Sea fill/white text, secondary = white fill + whisper border/Deep Sea text, hover = Ocean Mid fill (primary) / sand tint + mid border (secondary); 44px min, 10px radius, no watercolor texture, no heavy shadow, no lift; `btn-compact` for row clusters; coral (`#d42f3d`) reserved for destructive confirm buttons inside dialogs. Marketing pages keep the coral CTA (§13 status-badge rule unchanged). Overrides live in `styles/portal-tabs.css`; styles.css/redesign.css untouched.
- Regression: `tests/portal-tabs.spec.mjs` (v2 layout, mutations project, zero sends, full cleanup) + mobile 390px EN/CN rendered checks (folds, dialog geometry, ≥44px targets, computed button styles, zero-CJK, no overflow).

### Translate assist button (v1.19, owner decision 2026-11-22, MVP-SPEC #36)
- Bilingual authoring surfaces (messages composer, trip content editor, payment-instructions settings) carry a **Translate button** using Chrome's built-in on-device Translator API. Clean v2 button language (white fill + whisper border, 44px, 10px radius, no texture/shadow) via `styles/translate.css` bundled with the component so it looks identical on pages that don't import portal-tabs.css.
- **Draft, not decision:** output fills the other language's field(s) and a 12px driftwood status line reads "Machine draft — review before saving or publishing" (bilingual, `role="status"`). The both-languages gate and the human save/publish click remain the approval (#32). Download progress shows as static text with a percentage — no spinners/blinking.
- **Graceful degradation:** feature- and pair-detected (`Translator.availability`); renders nothing when unsupported — the manual two-language flow is unchanged. No error states for missing API, only for failed translation ("retry or type manually").
- Placement: under the target field(s) in settings/messages; one button per editing language in the trip content card with a fine-print note that it translates the SAVED other language (save edits there first). Difficulty enums and auto-derived display lines are never translated.

### List fields — row inputs with square × / + (v1.20, owner 2026-11-22)
- Highlights / itinerary / included / additional costs keep one input per item, with **two 44px square buttons at the right of each row: × removes that row, + inserts a row below** (owner: "very common way of adding new items"). No bottom Add button. Clean v2 button language (white fill + whisper border, sand hover) via `styles/list-editor.css` bundled with the component. Server parsing unchanged (repeated inputs). Translate assist fills rows via key-remount.

### Display lines — read-only, facts are the single source (v1.21, owner 2026-11-22, MVP-SPEC #37)
- Trips are always fixed (boat bookings). The content editor's Display lines card is a **read-only bilingual preview** of `deriveDisplay(facts)` — no Override checkbox, no custom-wording input. Both save actions (Settings + Content) write all 14 display columns from facts, so EN/CN can never drift. Empty facts → "Set the facts in Settings first" hint; the public page shows the derived line (empty until facts exist).

### Location-driven facts; no hand-typed slug/timezone (v1.22, owner 2026-11-22, MVP-SPEC #38)
- Settings → **Destination select** (curated bilingual locations in `src/lib/locations.ts`: Tioman / Sipadan / Raja Ampat / Other). Choosing one auto-loads currency (select disabled, "Set by the destination"), nearest airport + timezone as a read-only hint; Other reveals manual currency + EN/CN location names. Public trip page shows a **Nearest airport** fact.
- **Slug input removed** — public URL shown read-only (`/trips/…`), auto-generated from the trip name, regenerated while draft, locked once launched/booked. **Timezone input removed** — day trips need none; derived from location. Location name edited in Settings only (Content editor no longer has it).

### Merged trip creation, country + dive site, dual currency, grouped facts (v1.23, owner 2026-11-22, MVP-SPEC #39 — supersedes v1.22 destination list)
- **No separate new-trip page**: New trip creates a draft instantly → Settings. Trip name EN/CN editable in Settings Identity (with Translate assist); Content shows the name read-only. Slug read-only everywhere.
- **Country select (Asia only)** auto-loads local currency + timezone (read-only hint). **Dive site + nearest airport typed per trip** (EN/CN) — no dive-site dropdown. **Payment currency** (what the shop accepts, MYR/SGD/USD) is a separate editable select from the auto local currency.
- **Public facts = four grouped cards** (When / Where / Cost / Group), 2×2 desktop, 1-col mobile, white sub-cards with uppercase driftwood labels; deposit + balance live in Cost; planning list keeps cancellation + requirements. Replaces the 5-column fact strip.

### Translate icon per field; Sample checkbox removed (v1.24, owner 2026-11-22, MVP-SPEC #40)
- **Icon, not text button**: every bilingual field ends with a 44px `translate-icon-btn` (new inventory icon `ui-translate.webp` — A/文 speech bubbles, monoline deep-teal, alpha-keyed transparent, 24px inside) with an instant `data-tip` tooltip (v1.8 pattern, right-aligned above). Field + icon lay out as `.translate-field` grid (1fr + 44px; label and draft-status span both columns; textareas top-align the icon). Lists carry the icon at the head right.
- One click fills THAT field from the other language (content fields/lists from the SAVED other language). Draft/progress/error status line stays under the field. Unsupported browsers render nothing.
- Settings **Sample-trip checkbox removed**; `trip.sample` is preserved on settings saves. The Content demo fill that used to set it is retired (v1.33, MVP-SPEC #49); Sample badges stay on existing sample trips.

### Location = dive site + country only; auto facts formatted (v1.25, owner 2026-11-22, MVP-SPEC #41 — amends v1.23)
- Settings Location card inputs: **dive site (EN/CN with translate icons) + country select**. Nothing else is typed. A curated `SITES` reference matched on the typed dive-site name auto-displays **nearest airport + jetty/transfer**; country supplies **local currency + timezone (UTC offset)**. Unknown site → "—" + hint.
- Auto information renders as `.location-facts`: read-only 2×2 grid (1-col mobile), tinted sub-card, uppercase driftwood labels + 700 values — never a cramped inline hint line. Public trip Where group shows airport + jetty rows from the stored auto-written columns.

### Pricing = fixed deposit schedule; global frozen points rate (v1.26, owner 2026-11-22, MVP-SPEC #42)
- Pricing card is a tight 2-col grid — no half-empty span-2 gaps. Currency label is just **Currency**; the duplicate "local currency is…" hint is gone (Location card owns that fact).
- **Deposits are an item list** (`deposit-editor.tsx`): each row = amount + due days before departure, with the same 44px square × / + buttons as the list editors (remove / insert below). Fixed amounts only — percent pills and the percent input are removed. 2+ deposits at different timings supported; summary line shows total deposits + remaining balance. Deposit grid aligns with the card: Amount column = `calc(50% - 8px)` (matches the parent 1fr 1fr / 1rem grid exactly), Due column shortened to `calc(50% - 128px)`, ×/+ flush right; below 640px falls back to equal flexible columns. The `.list-editor-btn` rules are intentionally UNSCOPED so list rows and deposit rows share the identical button language as the translate icon (scoped rules left deposit buttons as browser defaults — misaligned and off-style; fixed same day, verified by a computed-style + row-centering probe).
- **Points rate is global and frozen per trip**: no per-trip rate input; the card shows a read-only "Points rate … fixed when the trip was created" line. Editing the global rate (portal Settings) affects new trips only.
- Public Cost group lists each deposit with its due timing; balance = price − sum(deposits).

### Trip Settings lifecycle = one Launch card + dialogs (v1.27, owner 2026-11-22, MVP-SPEC #43)
- The old Launch / Cancel trip / Delete draft cards merge into **one Launch card**: current-state hint, blockers warning, primary row (Open for booking / Inquiries only), then a quiet `.trip-lifecycle-row` of compact secondary buttons — Close trip · Back to draft · Cancel trip… · Delete draft… — each rendered only when applicable.
- One-time actions run in `PortalDialog`: Close/Back-to-draft = outcome text + confirm; **Cancel trip = reason field + understanding checkbox + coral `btn-danger-solid` confirm**; Delete draft = audit-snapshot note + coral confirm. Esc / backdrop / × close; no destructive action is ever one bare click on the page.
- Editor pages (settings + content) now import `portal-tabs.css`, so every button on them uses the clean v2 language (Deep Sea primary, white/border secondary, 44px, no watercolor/cream). The messages page stays sibling-owned.
- Checkbox fix: the `.booking-form` text-input rule (48px min-height + 12/16px padding) now excludes `[type="checkbox"]` — consent rows (Requirements, wizard declarations, cancel dialog) render natural 16px boxes in tight ≤44px rows, left-aligned with the card grid; previously the padded invisible box bloated and misaligned every consent row.

### Lifecycle actions in the sticky nav; field-level blockers (v1.28, owner 2026-11-22, MVP-SPEC #44 — supersedes v1.27's Launch card)
- The Launch card is gone. `TripEditorNav` renders a right-aligned `actions` cluster inside the sticky nav (already `position: sticky; top: 88px`), so Save and launch actions stay reachable while scrolling.
- Actions are **44px square monoline SVG icon buttons** (`icon-action.tsx`) with instant tooltips, same language as the translate icon: Save (Deep Sea filled, wired to the page form via the `form=` attribute), Open for booking (globe), Inquiries only (chat), Close trip (lock), Back to draft (pencil), Delete draft (trash). Launch icons disable while blockers exist; their tooltip then reads "Complete the highlighted fields first".
- **Blockers indicate on the individual field**, not a list: `Blocker.fields` keys drive `.field-blocked` — amber outline + dot + hover/focus tooltip carrying the exact blocker text. Settings flags price/deposits/dates/capacity/trip names/dive site; Content flags summary + the highlights/itinerary/included lists for the editing language.
- **Cancel trip lives on the Trips list**: each trip card has a coral x-circle icon opening the same reason + consent + coral-confirm dialog. Close/Back-to-draft/Delete stay as nav-icon dialogs in Settings.
- Dialog specs must scope to `dialog.portal-dialog[open]` — a closed Cancel dialog is now always present in the Trips tab DOM.

### Editor head is the sticky card; all action icons white; tooltips keep the action name (v1.29, owner 2026-11-23, MVP-SPEC #45 — fixes v1.28)
- **Dark fill = current location ONLY** (the active tab). v1.28's Deep Sea save icon violated this: `icon-action-primary` is deleted (prop + CSS). Every nav action icon is white + border; danger stays coral outline. Filled Deep Sea remains correct for dialog confirm buttons and the active tab pill.
- **Sticky belongs to the whole head, not the nav inside it.** `.trip-editor-head:has(.trip-editor-nav)` is the sticky card (top 88px; 72px below 640px; z-index 50; white bg + border/radius/padding); the inner `.trip-editor-nav` is static (no own card chrome). A sticky child confined to a short parent scrolls away with the parent — that was the bug. The policy editor's head (no trip-editor nav) stays static. Applies to Settings/Content/Messages.
- **Tooltips always name the action.** A disabled state APPENDS the reason after an em dash, never replaces the name: "Open for booking — Complete the highlighted fields first" / "开放预订 — 请先完成标记的字段".
- **Verify behavior, not just computed styles:** scroll and measure the pinned top, read the rendered tooltip text, pixel-sample screenshots. Smooth-scroll frames fooled the visual reviewer twice; deterministic geometry (head top = 88 at scrollY 800, navbar bottom = 81) is the evidence.

### Confirmed trips only in the editor; Tioman stays On request (v1.30, owner decision 2026-11-23, MVP-SPEC #46)
- Iris-created trips have **no inquiry launch mode**. The Settings nav keeps Save / Open for booking / Close / Back to draft / Delete as applicable; the Inquiries-only chat icon and form are removed. `setLaunchState` accepts only `draft`, `open`, and `closed`, so no UI or server-action path creates a new `on_request` trip.
- The existing Tioman record (TRP-001) is the explicit exception: it remains publicly **On request / 按需安排** with the ordinary `/contact` link and no booking CTA. The portal uses that same honest label instead of "Inquiries only". No status or data migration is required.
- General Contact Us inquiries and the full-trip Register-interest waitlist are separate features and remain unchanged. Opening any editor-created trip still requires all publish blockers to pass and represents Iris's explicit confirmation.

### List rows: field + × + + + Translate on one line (v1.31, owner 2026-11-23, MVP-SPEC #47)
- The translate icon belongs to the ROW, not the section head. `.list-editor-row` becomes `minmax(0, 1fr) 44px 44px 44px` only when a translate button actually renders (`:has(.translate-icon-btn)`), so the text field, ×, + and Translate share one baseline and the three controls form flush columns at the card's right edge. Browsers without Chrome's Translator API render no button and keep the 3-track row.
- Translate is per row: it fills that row from the same index in the other language. Do not reintroduce a whole-list "replace everything" control in the section head — that is what put an icon on the label line and broke the row rhythm.
- ≤480px the field takes the full row and the × / + / Translate cluster wraps to a right-aligned line beneath it (44px targets preserved). 481px+ keeps the single line. Never shrink the field to keep the buttons inline — at 320px that left a 63px field.
- Bilingual textareas keep the 2-track `translate-field` (textarea + icon); only list rows carry ×/+.

### Blocker dot sits at the end of the field's label (v1.32, owner 2026-11-23, MVP-SPEC #48)
- The amber publish-blocker dot is an inline `.blocker-dot` span at the END of the field's label text ("Summary ●"), never an absolutely positioned dot in the field's top-right corner — there it floated over the input and, in list rows, beside the ×/+ controls.
- It must be a real span inside the label: these labels are grid/flex containers, so a `::after` is laid out as a separate item (below the text) instead of following the words. Labels that are themselves grid containers wrap their text in a span first; keep the dot inside that span.
- 8px, `.45rem` after the last glyph, vertically centred with the text. The amber input outline and the hover/focus tooltip carrying the blocker text are unchanged.

### Demo fill retired (v1.33, owner decision 2026-11-23, MVP-SPEC #49)
- The Content editor has no "Fill with example" control. Demo copy must never be one click away from a real trip: the DEMO fixture copy, the `demo` state, the hidden `demoFill` field, the bottom action row, and the help bullet are removed, and `updateTripContent` no longer sets `sample = true` or records `demoFill`.
- `trip.sample` is data only: seeded sample trips keep their "Sample" badge on the public page and portal. Editor saves preserve it and cannot set it.
- The read-only "Display lines (auto from Settings)" card stays — it is the only way to read the derived dates/price/deposit wording of a draft, which has no public page yet.

### Currency & points display
- Every money amount shows its trip currency code/symbol as set per trip (MYR/SGD/USD/…) — never a bare number
- Okim Points ledger entries show: points, the RM conversion rate snapshot applied, and the RM amount — consistent column order across My Okim and the portal
- Invoices/receipts state currency explicitly on the total line

### Transactional emails (bilingual)
- Lato for everything (email-safe); Noto Sans SC when the Chinese variant is sent
- Sand/white background, Deep Sea text, one Coral CTA button maximum per email (the magic-link / primary action)
- Magic-link emails keep the link on its own line, clickable text, not only "click here"
- Email content is defined by copy rules in `OKIM-DIVE-VIBE.md`; this section only constrains visuals

### Payment schedules and record-payment dialogs (v1.34, MVP-SPEC #50)

Actions and My Okim show each booked stage, its date, payable amount, received amount and outstanding balance. The final stage shows the original amount and points discount when applicable. The card footer shows booking totals. After a refund, label gross receipts, refunds and net receipts separately. Completed bookings show their final accounting.

Use the existing app card and table styles. On narrow cards, keep currency and figure together, repeat the column labels with their values and stack them when inline spacing is insufficient. Keep stage dates in the booking’s local calendar and use the active browsing language for labels.

The Record payment dialog opens with the suggested amount and bank date. Editing the amount updates the allocation preview. Keep the entered values through a save error, show revised figures after a stale balance, and require a fresh confirmation. A successful save links directly to its receipt. On idle dismissal, return keyboard focus to the opening control.

## 14. Bilingual Surfaces & Locale Handling (locked, v1.4)

Owner mandate 2026-11-21: **every redesign, layout, or bilingual change must reference this document first and audit the rendered result against it.** These rules exist because sibling chats improvising locale handling leaked Chinese onto English surfaces twice (navbar "Profile / 资料", portal "Diver updates / 潜水员更新").

### Locale source of truth per surface
- **Public/marketing pages:** browser preference via the site-i18n DOM dictionary (`localStorage okim-language`).
- **Signed-in customer surfaces** (`/myokim`, invoice, receipt): the customer's stored locale, pinned for the WHOLE page (chrome included) via `data-page-locale` on `main`.
- **Instructor portal:** browser preference via `useLocale()` — Iris's own choice, not a customer's.
- **Self-localized surfaces** render bilingual DB/content directly and mark their root `data-locale-managed` so the DOM dictionary never overwrites them; they subscribe to `okim-language-change`, which fires ONLY on a user toggle (never on load/navigation).

### Hard rules
1. **One language at a time.** Never hardcode `"English / 中文"` literals in components, server pages, emails, or attributes. Every user-visible string goes through `t(en, zh)` / `pick(locale, …)` or the dictionary.
2. **Locale-dependent UI must be a client component** (`useLocale`). Server components cannot read the active locale — pass serializable data down and localize at the client boundary. (The Diver-updates leak was a server component with bilingual literals.)
3. **EN surfaces contain zero CJK characters.** Sole exception: the language-switcher button (中文). Language names inside selects/options are locale-aware: "Chinese (Simplified)" in EN, 简体中文 in CN.
4. **User-entered content displays as submitted** in every locale (names, inquiry messages, declarations). That is data, not a leak — never machine-translate it.
5. **CN is not word-for-word:** natural, concise, warm (vibe doc). Verify wrapping in BOTH languages at desktop AND mobile; Han runs differ in length per string.
6. **Font roles swap by `html[lang]`** per §3: EN Fraunces 500 display / Lato body; CN Noto Serif SC 600 display / Noto Sans SC body. Negative tracking never applies to Han text.
7. **Every new or changed surface ships with a CJK-scan regression** (text nodes; exclude the switcher, script payloads, and data containers) plus rendered EN/CN desktop/mobile checks. Existing scans: `tests/m6-policies.spec.mjs` (portal UI, policy pages, navbar), `tests/m6-my-okim.spec.mjs` (all four tabs).

### App-surface stacking-context rule (layout)
- App content must render **inside** `main.<surface>` (`main.portal`, `main.my-okim`, …). The surface's fixed watercolor `::before` lives in an isolated stacking context and paints over the ENTIRE viewport: sibling nodes placed BEFORE `main` are invisible even though present in the DOM (the Diver-updates card was silently covered this way). Pass extra sections into the surface's view component — see `PortalView`'s `updates` prop.
- Verify visibility with `document.elementFromPoint` or a screenshot, never DOM presence alone.

---

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-01-XX | 1.0 | Initial system | Vega |
| 2026-08-27 | 1.0 | Non-negotiable watercolor rules; trip dialog patterns | Vega |
| 2026-11-19 | 1.1 | Audit fixes: Fraunces/Noto first-class (removes stale Playfair specs), bilingual rules for all surfaces, architecture guardrail updated for Next.js migration, hero gradient marked reference-only, Google Fonts link corrected, new §13 app surfaces (tables, status badges, forms, empty states, currency/points, transactional emails) | QwenWork (owner: Jeff) |
| 2026-11-19 | 1.2 | Home pilot approved by owner and ported to Next.js (§12 Home template replaced; MVP-SPEC decision #19): painting-led hero, one-shot waterline, Learn/Return/Explore chooser, Tioman on-request feature, enquiry ending; courses FAQ becomes bilingual disclosures | QwenWork (owner: Jeff) |
| 2026-11-20 | 1.3 | §13 forms: screenshot-upload rule removed — payment evidence is manual via WhatsApp in v1 (MVP-SPEC decision #20); portal payment-recording form follows the standard form spec | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.4 | New §14: locked bilingual/locale rules (one language at a time, client-boundary localization, zero-CJK EN scans, data-as-submitted, font-role swap) + app-surface stacking-context rule, after the Diver-updates leak/invisibility incident. Owner mandate: every redesign/layout/bilingual change references this document and audits against it | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.5 | §13 booking sub-cards (Trip information / Equipment / Sizes & fit + 12px closing disclaimer), weight discipline (400 body/labels; 600-700 headers/badges/buttons only), identifiers explained once — owner: "bold text all over… BKG-DEMO-01 appearing a few times without explaining" | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.6 | §13 equipment pill board: three columns (Bring/Rent/No need), drag on desktop + tap-menu/bottom action sheet on mobile, auto-fill from profile (none now respected) — owner experiment, pending visual approval | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.7 | §13 board refinements (owner: "Looks good~!"): collect-all icons in column headers + Reset icon at card head right (tooltips, 44px), sizes as 4-column grid (2×2 mobile) with disabled-dimmed inactive cells, Other note alone below the grid, Save right-aligned after sizing. Board approved by owner | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.8 | §13 diving icon set (generated webp line-icons) + instant styled hover tooltips via data-tip, replacing native title delay — owner: "generate icons related to diving… mouse over explanation" | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.9 | §13 icon system: 10-icon inventory, alpha-keyed transparent webp, wayfinding-only placement rules (tabs + card heads + icon-only actions), selected-tab inversion, 20/24px sizes — owner: "I love the icons, where else can we add them?" | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.10 | §13 Profile relayout: full width equal to tab bar, three grouped sub-cards (Contact & language / Certification & dives / Equipment defaults) with field grids, right-aligned Save, fine-print disclaimer; +2 icons (cert card, contact bubble) — owner: "relayout Profile tab" | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.11 | Width/scale stragglers fixed after owner screenshot: removed leftover `#profile form max-width:680px` (section was full-width but form capped) and extended the 24px header rule to `.portal-card-head h2` (Profile head sits outside `.portal-card`). Width regression now measures the FORM and sub-card against the tab bar, plus header font-size ≤26px | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.12 | Equipment text weight + grids (owner: "why bold? 3 columns… notes as multi-line boxes"): killed leftover `#my-panel-profile label{font-weight:600}` ID-specificity rule (overrode the 400 discipline); equipment defaults checkboxes now 3 columns matching the field grids above; sizes grid 3 columns (wetsuit/BCD/footwear); **fit note + other equipment note are multi-line textareas at the very bottom** on both Profile and Upcoming (2-col desktop, 1-col mobile); notes persist via the equipment JSON payload | QwenWork (owner: Jeff) |
| 2026-11-21 | 1.13 | Footer paint-order fix (`.footer` positioned z1) + Profile sizes/notes stacked like Upcoming (nested `.profile-eq` fieldset was a grid placing sizes and notes side-by-side) — owner: "why Profile looks different… big space… footer missing" | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.14 | §13 portal tabs + compact data rows: portal becomes 4 action-first tabs (Actions/Bookings/Money/Manage) with My Okim tab language, capped lists, filter pills, labelled declaration grids, identifier hygiene (no displayed UUIDs, refs explained once) — owner: "way too long to scroll… long alphanumeric text… pages stacked without grouping"; paired with fixture purge + 4-diver demo seed (MVP-SPEC portal redesign decisions) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.15 | §13 booking-request cards + seamless flow (owner S1–S5): one-click Received (record+verify+confirm+email), pre-filled expected amounts, Extend/Release hold controls, Different-amount escape, Register interest on full trips, trip-level Mark completed, wizard hold due date — owner: "too many steps and not linked together… shared DB should be seamless for diver and instructor" | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.16 | §13 eligibility gate REMOVED (owner: "self declaration… Iris cannot approve if the diver hides information"): truthfulness disclaimers on booking wizard + profile, Withdraw replaces Decline (right-aligned, paid→refund review / unpaid→cancelled), condensed booking rows cap 10, eligibility badges/reviews retired, legacy declined → Withdrawn | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.17 | §13 trip messages (Luma-style stream, TRIP-MESSAGES-SPEC): diver feed as a My Okim sub-card ("Messages from Iris", ui-contact icon, label badges, static sunset unread dot — no blinking, details-expand marks read, pre-wrap body); instructor composer reuses policy-form pattern (label + audience pills + EN\|CN switch, both textareas mounted) and outbox rows reuse portal-row + label filter pills + seen counts + two-step delete; publish = human approval, on-platform only (no email channel until post-production) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.18 | §13 portal v2 (owner-approved PORTAL-REDESIGN-V2-PLAN + MVP-SPEC #35): trip-centric 4 tabs (Actions/Trips/Money/Settings), trip cards with whole-story face + direct Messages link, folding details-cards open only when actionable, native dialogs for one-time actions/viewing pre-filled from the card, portal-scoped button restyle (Deep Sea primary / white secondary / coral destructive-only — app-surface deviation from coral-primary), refund-review + completion action cards, inquiry trip context, diver updates moved to collapsed Trips fold | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.19 | §13 translate assist button (MVP-SPEC #36, amends #32 no-embedded-AI for this assist): Chrome built-in on-device Translator API fills the other language as a reviewed draft on messages/trip-content/payment-instructions; feature-detected graceful hiding (Chrome/Edge desktop only), static download progress, machine-draft hint, human publish gate unchanged | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.20 | §13 list rows get square 44px × / + buttons at the right (remove row / insert row below); bottom Add buttons removed; clean v2 button language; server parsing unchanged | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.21 | §13 display lines become read-only derived previews; Override removed (MVP-SPEC #37, trips always fixed, Settings single source); stored columns synced from facts | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.22 | §13 location-driven facts (Destination select auto-loads currency/airport/timezone; public Nearest airport fact); slug + timezone inputs removed, URL read-only auto-from-name (MVP-SPEC #38) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.23 | §13 new-trip merged into Settings (instant draft, name editable there); country select (Asia) + typed dive site/airport; local vs payment currency; public facts regrouped into When/Where/Cost/Group cards (MVP-SPEC #39, supersedes v1.22 destination list) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.24 | §13 translate assist = per-field 44px icon + instant tooltip (new ui-translate icon); bulk translate row removed; Settings Sample-trip checkbox removed, sample flag preserved (MVP-SPEC #40) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.25 | §13 Location inputs = dive site + country only; curated SITES match auto-displays airport + jetty/transfer; formatted .location-facts read-only grid; public Where group gains jetty row (MVP-SPEC #41) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.26 | §13 Pricing compacted; deposits = fixed-amount item list (×/+ rows, 2+ timings), percent removed; currency label simplified, duplicate hint removed; points rate global + frozen per trip (read-only line); public Cost lists deposit schedule (MVP-SPEC #42) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.27 | §13 trip Settings lifecycle = one Launch card + quiet lifecycle row; Close/Back-to-draft/Cancel/Delete in dialogs (cancel carries reason + consent + coral confirm); editor pages import portal-tabs.css so all buttons use the clean v2 language (MVP-SPEC #43) | QwenWork (owner: Jeff) |
| 2026-11-22 | 1.28 | §13 Launch card removed; lifecycle = right-aligned 44px square icon buttons with tooltips in the sticky editor nav (Save always reachable); blockers mark individual fields (amber outline + dot + tooltip); Cancel trip moved to Trips-list card dialog (MVP-SPEC #44, supersedes v1.27) | QwenWork (owner: Jeff) |
| 2026-11-23 | 1.34 | §13 staged payment schedules, narrow-card labels and financial dialogs. See the [implementation log](../plans/MULTI-DEPOSIT-EXECUTION-LOG.md) for verification and owner visual acceptance status. |

**Status:** v1.34 reflects the owner-authorized workflow on `QwenWork-refactor` through MVP-SPEC #50.
