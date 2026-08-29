# Okim Dive - Design System

**Version:** 1.0  
**Created:** 2026-01-XX  
**Inspired by:** Stripe, Notion, Airbnb design systems
**Approved Direction:** Continuous Underwater Editorial / Dive Journal
**Last Updated:** 2026-08-27

> This document describes the approved implementation direction, not an aspirational alternative. Future pages must extend the current underwater environment rather than introducing a new visual language.

### Non-negotiable visual rules

- Use one continuous underwater canvas after the hero: bright surface/light rays at the top, open mid-sea content in the middle, and seabed only at the final content section.
- Keep hero banners visually distinct from the post-hero journey.
- Let the background create atmosphere, but keep content and controls in the foreground with strong contrast.
- Use light editorial reading surfaces only where text needs protection; do not add dark glass panels.
- Prefer asymmetrical editorial composition, generous whitespace, restrained borders, and photography-led storytelling over repeated card grids.
- Treat watercolor artwork as a quiet environmental layer, never as a collection of unrelated decorative stickers.
- Preserve the dependency-free HTML/CSS/JavaScript architecture and `prefers-reduced-motion` behavior.

## 1. Visual Theme & Atmosphere

Okim Dive embodies a **watercolor ocean aesthetic** — soft, organic, and inviting. The design operates on warm neutrals with ocean-inspired accents, creating a canvas that feels like quality paper meeting the sea.

The typography uses **Playfair Display** for headlines (elegant serif with personality) paired with **Lato** for body text (clean, readable sans-serif). Headlines use weight 300-400 to create whispers rather than shouts — confidence through restraint, not volume.

What distinguishes the visual language:
- **Watercolor-inspired color palette**: Soft blues, aquas, sandy neutrals with coral accents
- **Organic shapes**: Rounded corners (8px standard), flowing layouts
- **Whisper borders**: `1px solid rgba(0,0,0,0.08)` — barely perceptible structure
- **Soft shadows**: Blue-tinted, multi-layer for natural depth
- **Photography-forward**: Large, immersive images that breathe
- **Generous whitespace**: Content islands in a sea of calm

**Key Characteristics:**
- Playfair Display (serif) for headlines at weight 300-400 — light, confident, elegant
- Lato (sans-serif) for body at weight 300-400 — clean, readable
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
- **Headlines**: `'Playfair Display', Georgia, serif`
- **Body**: `'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Hero Heading | Playfair Display | 48px (3.00rem) | 300 | 1.10 | -0.5px | Maximum size, whisper-weight elegance |
| Section Heading | Playfair Display | 36px (2.25rem) | 300 | 1.15 | -0.3px | Feature section titles |
| Card Title | Playfair Display | 28px (1.75rem) | 400 | 1.20 | -0.2px | Card headings, sub-sections |
| Sub-heading | Playfair Display | 24px (1.50rem) | 400 | 1.25 | -0.1px | Smaller section heads |
| Body Large | Lato | 18px (1.13rem) | 300 | 1.60 | normal | Feature descriptions, intro text |
| Body | Lato | 16px (1.00rem) | 300 | 1.60 | normal | Standard reading text |
| Body Small | Lato | 14px (0.88rem) | 400 | 1.50 | normal | Captions, metadata |
| Button | Lato | 16px (1.00rem) | 400 | 1.00 | normal | Button labels |
| Nav Link | Lato | 15px (0.94rem) | 400 | 1.00 | 0.3px | Navigation links |
| Badge | Lato | 12px (0.75rem) | 600 | 1.33 | 0.5px | Tags, status labels |

### Typography Principles
- **Light weight as signature**: Weight 300 for headlines creates elegance and confidence
- **Serif headlines, sans-serif body**: Playfair Display for personality, Lato for readability
- **Generous line-height**: 1.60 for body text creates breathing room
- **Negative tracking on headlines**: -0.1px to -0.5px creates intimate, warm headings
- **Four-weight system**: 300 (light), 400 (regular), 600 (semibold for badges only)

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
- Title: 24px Playfair Display weight 400
- Description: 16px Lato weight 300, Driftwood color

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
- Logo: 24px Playfair Display weight 400, Deep Sea color
- Links: 15px Lato weight 400, Driftwood color, 0.3px letter-spacing
- Active state: `color: #457B9D; border-bottom: 2px solid #457B9D;`
- Hover: `color: #457B9D;`

**Mobile Nav**
- Hamburger menu icon (3 lines, 24px)
- Full-screen overlay on open
- Large touch targets (48px minimum)
- Smooth slide-in animation

### Hero Section

```css
background: linear-gradient(135deg, #A8DADC 0%, #457B9D 100%);
color: #ffffff;
padding: 120px 24px;
text-align: center;
position: relative;
overflow: hidden;
```
- Heading: 48px Playfair Display weight 300, white
- Subtitle: 20px Lato weight 300, rgba(255,255,255,0.9)
- CTA buttons: Coral primary + transparent secondary
- Optional: Subtle wave SVG overlay at bottom

### Form Inputs

```css
background: #ffffff;
border: 1px solid rgba(0,0,0,0.12);
border-radius: 8px;
padding: 12px 16px;
font: 16px Lato weight 300;
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
- **Mobile fallback:** Horizontal journeys stack vertically with directional markers; never require horizontal scrolling or scroll hijacking.

---

---

## Current web typography implementation

The live static site uses a role-based bilingual type system:

- **English display:** Fraunces 500 for hero and major section headings.
- **English body/UI:** Lato 400/700 for reading copy, navigation, cards, forms, metadata, and buttons.
- **Simplified Chinese display:** Noto Serif SC 600 for hero and editorial section headings.
- **Simplified Chinese body/UI:** Noto Sans SC 400/600 for reading copy and controls.
- **Decorative script:** Great Vibes is not part of content hierarchy and must not be used for Han text.

This separation keeps the calm editorial voice while giving compact UI elements a clearer, more energetic rhythm.

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
  --font-heading: 'Playfair Display', Georgia, serif;
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400&family=Lato:wght@300;400;600&display=swap" rel="stylesheet">
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
- Use weight 300 for headlines — lightness is elegance
- Apply blue-tinted shadows for brand cohesion
- Use #264653 (Deep Sea) for headings — warm, not cold
- Keep border-radius between 8px-16px — organic, not harsh
- Use generous whitespace — content needs to breathe
- Apply negative letter-spacing on headlines for warmth
- Use photography as hero — underwater shots, student experiences
- Use Coral (#E63946) sparingly — only for primary CTAs

### Don't
- Don't use weight 600-700 for headlines — weight 300 is the voice
- Don't use pure black (#000000) — always Deep Sea (#264653)
- Don't use large border-radius (20px+) — 8-16px is organic
- Don't use neutral gray shadows — always tint with ocean blue
- Don't crowd content — generous whitespace is essential
- Don't use warm accent colors (Sunset, Kelp) for buttons — Coral is primary
- Don't apply positive letter-spacing at display sizes — track tight
- Don't use stock photos — authentic images only

---

## 12. Page Templates

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

**Next Steps:**
1. Review this design system
2. Update CSS file with these specifications
3. Test with real content and photos
4. Iterate based on feedback
