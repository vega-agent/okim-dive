# Okim Dive - Scuba Diving Website

A multi-page website for Okim Dive, a freelance dive instructor and trip planner based in Tioman, Malaysia.

## Project Structure

```
okim-dive/
├── pages/
│   ├── index.html
│   ├── about.html
│   ├── courses.html
│   ├── trips.html
│   ├── gallery.html
│   └── contact.html
├── styles/
│   ├── styles.css
│   └── redesign.css
├── scripts/
│   ├── verify-static.mjs
│   └── site/
│       ├── site-i18n.js
│       ├── site-motion.js
│       └── trips-data.js
├── assets/
│   └── watercolor/     # Folder for watercolor design elements
│       ├── backgrounds/
│       ├── hero-banners/
│       ├── decorative/
│       ├── frames/
│       ├── dividers/
│       ├── icons/
│       ├── corners/
│       └── overlays/
├── docs/
│   ├── design/
│   │   ├── PRD.md
│   │   ├── DESIGN-SYSTEM.md
│   │   ├── BRAND-GUIDE.md
│   │   └── WATERCOLOR-DESIGN-ELEMENTS.md
│   └── reports/
│       └── PHASE-4-QA-REPORT.md
```

## Pages

### Homepage (index.html)
- Hero section with underwater ocean background
- Welcome introduction with feature cards
- Quick links to courses, trips, gallery, and contact
- Responsive navigation

### About Us (about.html)
- Meet Iris section with instructor profile
- Our story and mission
- Why choose us with 6 key benefits

### Courses (courses.html)
- 6 dive courses (Open Water to Discover Scuba)
- Course details with duration, depth, prerequisites
- How it works process
- FAQ section

### Trips (trips.html)
- Local dive sites (Tioman, Perhentian, Redang)
- International destinations (Sipadan, Raja Ampat, Similan, Maldives)
- What's included in trips
- Trip planning information

### Gallery (gallery.html)
- Masonry-style photo grid
- 12 image placeholders ready for watercolor assets
- Photo categories section
- Call-to-action to start diving

### Contact (contact.html)
- Contact methods (WhatsApp, Instagram, Facebook, XiaoHongShu)
- Contact form with interest selection
- FAQ section
- Location and transport information

## Design Theme — Approved Direction

- **Style**: Continuous underwater editorial / dive journal
- **Composition**: Distinct hero followed by one continuous underwater canvas; surface light at the top, open mid-sea content, seabed only at the final content section
- **Palette**: Light watercolor ocean blues, seafoam, warm paper, sand, and restrained coral accents
- **Typography**: Fraunces for expressive English display headings, Lato for readable body/UI copy; Simplified Chinese uses Noto Serif SC for editorial headings and Noto Sans SC for body/UI
- **Surfaces**: Light editorial reading surfaces only where required for contrast; no dark glass panels
- **Imagery**: Photography-led, with generated watercolor artwork used only as atmosphere or illustration and never labeled as verified Okim Dive photography
- **Layout**: Generous whitespace, clear hierarchy, restrained borders, occasional asymmetry, and fewer stronger content groupings instead of repetitive card grids
- **Interaction**: Lightweight native CSS/JavaScript, accessible focus states, keyboard-friendly navigation, mobile touch targets, and reduced-motion support

Future pages must extend this visual system rather than introduce a new page-specific theme.

## Current Status

✅ Multi-page structure created  
✅ Responsive CSS with mobile support  
✅ All navigation links working  
✅ Placeholder sections for content
✅ Courses visual journey proof-of-concept with inline SVG icons
✅ Shared progressive-reveal motion with reduced-motion fallback

## Next Steps

1. Generate watercolor design elements using prompts in `docs/design/WATERCOLOR-DESIGN-ELEMENTS.md`
2. Replace placeholder images with actual watercolor assets
3. Add real photography from Iris's Instagram/Facebook
4. Update contact form to connect to backend service
5. Deploy to hosting platform

## Development

To view locally:
```bash
# Open any HTML file in browser, or use a local server:
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Deployment

Ready to deploy to:
- Vercel (recommended)
- Netlify
- GitHub Pages
- Any static hosting service

## Color Palette

```css
--ocean-deep: #0a2342;
--ocean-mid: #1b4965;
--ocean-light: #5fa8d3;
--ocean-surface: #bee9e8;
--ocean-foam: #cae9ff;
--coral: #ff6b6b;
--sand: #f4e4c1;
```

## Contact

- **Instructor**: Iris
- **Location**: Tioman Island, Malaysia
- **Instagram**: [@okim_dive](https://www.instagram.com/okim_dive)
- **Facebook**: [OKIM Dive](https://www.facebook.com/people/OKIM-Dive/61578882252925/)
- **小红书**: [Profile](https://xhslink.cn/m/9TfIoxN1yFp)

---

Built with 🤿 for Okim Dive
