# Okim Dive - Design System

**Version:** 1.1
**Created:** 2026-01-XX
**Inspired by:** Stripe, Notion, Airbnb design systems
**Approved Direction:** Continuous Underwater Editorial / Dive Journal
**Last Updated:** 2026-11-19
**Applies to:** migrated Next.js app (public pages + booking flow + instructor portal + My Okim) per `MVP-SPEC.md` v1.0

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

### Home Page
1. **Hero Section**: Ocean gradient background, headline, tagline, 2 CTAs
2. **Intro Section**: "Discover the underwater world with Iris" + description
3. **Features Grid**: 3 cards (Courses, Trips, Personalized) with icons
4. **Social Proof**: Instagram feed preview or testimonials
5. **Social Links**: Instagram, Facebook, XiaoHongShu cards

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
- Required screenshot upload (payment claim): single file input, preview thumbnail in a Standard Card, caption "payment evidence only" per privacy rules

### Empty states
- Short heading (Card Title size), one sentence of Body text, one primary CTA where an action exists. Example: verification queue empty → "All caught up" + "Nothing waiting for review."
- No illustrations or watercolor artwork inside empty-state boxes — keep the environmental art on the page background.

### Currency & points display
- Every money amount shows its trip currency code/symbol as set per trip (MYR/SGD/USD/…) — never a bare number
- Okim Points ledger entries show: points, the RM conversion rate snapshot applied, and the RM amount — consistent column order across My Okim and the portal
- Invoices/receipts state currency explicitly on the total line

### Transactional emails (bilingual)
- Lato for everything (email-safe); Noto Sans SC when the Chinese variant is sent
- Sand/white background, Deep Sea text, one Coral CTA button maximum per email (the magic-link / primary action)
- Magic-link emails keep the link on its own line, clickable text, not only "click here"
- Email content is defined by copy rules in `OKIM-DIVE-VIBE.md`; this section only constrains visuals

---

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-01-XX | 1.0 | Initial system | Vega |
| 2026-08-27 | 1.0 | Non-negotiable watercolor rules; trip dialog patterns | Vega |
| 2026-11-19 | 1.1 | Audit fixes: Fraunces/Noto first-class (removes stale Playfair specs), bilingual rules for all surfaces, architecture guardrail updated for Next.js migration, hero gradient marked reference-only, Google Fonts link corrected, new §13 app surfaces (tables, status badges, forms, empty states, currency/points, transactional emails) | QwenWork (owner: Jeff) |

**Status:** v1.1 active for the Next.js migration on branch `QwenWork-refactor` per `MVP-SPEC.md` v1.0.
