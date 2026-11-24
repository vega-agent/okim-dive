# Okim Dive Website - Product Requirements Document

**Version:** 0.3\
**Created:** 2026-01-XX\
**Last Updated:** 2026-11-20\
**Owner:** Jeff\
**Developer:** Vega (website foundation); QwenWork (portal MVP + Next.js migration)\
**Companion spec:** `docs/design/MVP-SPEC.md` (change-control through #50) — approved source of truth for booking/portal scope. Where this PRD and the MVP spec differ on portal/booking matters, the MVP spec wins.

---

## 1. Product Overview

### 1.1 What is Okim Dive?
Okim Dive is a freelance dive instructor and trip planner business run by Iris, based in Tioman, Malaysia.

### 1.2 Business Context
- **Services:** Dive instruction + overseas dive trips
- **Location:** Tioman Island, Malaysia
- **Owner:** Iris (sole entrepreneur)
- **Current Presence:** Instagram, Facebook, XiaoHongShu (小红书)
- **Target Audience:** Bilingual (English + Chinese speakers)

### 1.3 Product Vision
A production-intent Next.js application (migrated from the static website) that provides:
1. Branding and professional online presence (design preserved)
2. Information about services offered (courses — inquiry-only in v1)
3. Details about dive trips (Tioman + overseas), rendered from the database
4. Educational content for students
5. Contact and inquiry capture into the instructor portal
6. **Trip booking portal:** magic-link sign-in, one diver per booking, external payment with instructor verification, invoices/receipts
7. **Instructor operations portal** for Iris: inquiries, trips, bookings, payment verification, Okim Points ledger, refund-policy editor, settings, preparation checklist, trip-briefing draft workflow
8. **Read-only customer area "My Okim":** My Trips + My Rewards
9. Bilingual EN + 简体中文 across all surfaces and transactional emails

Scope, flows, rules, and schema are defined in `docs/design/MVP-SPEC.md` (approved 2026-11-18).

---

## 2. Goals & Success Metrics

### 2.1 Business Goals
- [ ] Establish professional online presence
- [ ] Build brand credibility
- [ ] Attract new students/customers
- [ ] Provide easy access to service information
- [ ] Showcase trip offerings
- [ ] Enable easy contact/booking

### 2.2 Success Metrics
- **Engagement:** Time spent on site, pages visited
- **Conversion:** Contact form submissions, WhatsApp clicks, email inquiries
- **Content:** Social media follower growth, return visitors
- **Technical:** Page load speed, mobile responsiveness, SEO ranking

---

## 3. Target Audience

### 3.1 Primary Users
- **Beginner divers** - Looking for dive courses (Open Water, Try Scuba)
- **Certified divers** - Looking for fun dives and trip planning
- **Chinese-speaking divers** - From XiaoHongShu audience
- **International tourists** - Planning Tioman dive trips

### 3.2 User Personas

**Persona 1: First-Time Diver**
- Age: 25-40
- Background: Adventure seeker, vacation planner
- Goal: Find a reputable dive instructor, learn about courses
- Needs: Clear course info, pricing, safety information, easy booking

**Persona 2: Experienced Diver**
- Age: 28-50
- Background: Certified diver, travel enthusiast
- Goal: Find dive trips, explore new destinations
- Needs: Trip details, dive site information, group size, pricing

**Persona 3: Chinese-Speaking Tourist**
- Age: 22-35
- Background: Follows XiaoHongShu, planning Malaysia trip
- Goal: Find Chinese-language dive services
- Needs: Bilingual content, WeChat/WhatsApp contact, trip packages

---

## 4. Information Architecture

### 4.1 Site Structure
```
/                    Home (landing page)
/about               About Iris & Okim Dive
/courses             Dive courses offered (inquiry-only in v1)
/trips               Dive trips (Tioman + overseas), from database
/trips/[slug]        Trip detail + "Book this trip"
/gallery             Verified Okim Dive photography and visual stories
/contact             Contact information + inquiry form → portal
/book/[tripSlug]     Booking flow (magic link → details → invoice)
/my                  My Okim — read-only My Trips + My Rewards
/portal              Instructor portal (role-gated)
/refund-policy       Versioned public refund policy (Iris-editable)
/privacy             Privacy policy (PDPA)
/terms               Terms + waiver
/api/auth/*          Auth.js magic-link endpoints
```

**Approved scope expansion (2026-11-18):** the original six static pages are migrated to Next.js App Router with the design preserved; the booking, customer, portal, and policy routes above are added per `MVP-SPEC.md` §10. This supersedes the "preserve six-page static structure" guardrail in `CLAUDE.md`/`AGENTS.md`; those files are updated during migration phase M7. The principle still holds: add routes only for a clear user journey or substantial content, never to pad navigation.

### 4.2 Page Requirements

#### 4.2.1 Home Page
**Purpose:** Introduce Okim Dive, showcase key offerings

**Must Have:**
- Hero section with branding
- Brief introduction
- Service highlights (courses, trips, personalized instruction)
- Social media links
- Call-to-action buttons

**Nice to Have:**
- Testimonials/reviews
- Recent dive photos
- Upcoming trip announcements

#### 4.2.2 About Page
**Purpose:** Build trust, tell Iris's story

**Must Have:**
- Iris's background and experience
- Certifications (PADI/SSI level)
- Teaching philosophy
- Why Tioman?
- What makes Okim Dive different

**Nice to Have:**
- Personal dive story
- Marine conservation involvement
- Photos of Iris diving/teaching

#### 4.2.3 Courses Page
**Purpose:** Detail course offerings

**Must Have:**
- Course list (Open Water, Advanced, Try Scuba, etc.)
- For each course:
  - Description
  - Duration
  - Prerequisites
  - What's included
  - Price (or "Contact for pricing")
- Booking information

**Nice to Have:**
- Course comparison table
- FAQs
- Student testimonials
- Sample schedule

#### 4.2.4 Trips Page
**Purpose:** Showcase trip offerings

**Must Have:**
- Trip list (Tioman, Semporna, overseas destinations)
- For each trip:
  - Destination
  - Duration
  - Dive sites
  - Accommodation
  - Inclusions
  - Pricing
- Booking information

**Nice to Have:**
- Trip calendar/schedule
- Photo gallery per destination
- Dive site descriptions
- What to bring list
- Travel tips

#### 4.2.5 Contact Page
**Purpose:** Enable easy communication

**Must Have:**
- WhatsApp link (primary contact)
- Email address
- Instagram link
- Facebook link
- XiaoHongShu link

**Nice to Have:**
- Contact form
- Response time expectations
- Location map (Tioman)
- FAQ about booking process

---

## 5. Content Requirements

### 5.1 Text Content
- [ ] Iris's bio and story
- [ ] Course descriptions (4 courses)
- [ ] Trip descriptions (3+ destinations)
- [ ] Pricing information
- [ ] Contact details (WhatsApp, email)
- [ ] Social media handles
- [ ] FAQ content

### 5.2 Visual Content
- [ ] Hero image (underwater or Tioman landscape)
- [ ] Iris's photo (professional headshot or action shot)
- [ ] Course photos (students diving)
- [ ] Trip photos (destinations, dive sites)
- [ ] Logo (if exists, otherwise create simple text logo)
- [ ] Social media screenshots (optional)

### 5.3 Bilingual Support
**Phase 1:** English only  
**Phase 2:** Add Chinese translations (if needed)

**Priority pages for translation:**
1. Home page
2. Courses page
3. Contact page

---

## 6. Design Requirements

### 6.1 Visual Style — Approved Direction
- **Theme:** Continuous underwater editorial / dive journal
- **Composition:** Distinct hero followed by one continuous underwater canvas: surface light at the top, open mid-sea content in the middle, seabed only at the final content section
- **Colors:** Light watercolor ocean blues, seafoam, warm paper, sand, and restrained coral accents; avoid heavy dark surfaces
- **Typography:** Fraunces for expressive English headings and Lato for readable body text; Noto Serif SC / Noto Sans SC for Chinese content (see DESIGN-SYSTEM v1.1)
- **Surfaces:** Light editorial reading surfaces only where needed for contrast; no dark glassmorphism
- **Imagery:** Real, approved Okim Dive photography first; generated watercolor artwork only as atmosphere or illustration, never as verified photography
- **Mood:** Calm, immersive, personal, adventurous, and trustworthy

### 6.2 Layout Principles
- Mobile-first responsive design
- Preserve the continuous underwater environment across page sections
- Use generous whitespace and clear hierarchy
- Prefer editorial composition and fewer stronger content groupings over repetitive card grids
- Keep hero and post-hero content visually distinct
- Keep ocean artwork secondary to copy, navigation, forms, and calls to action
- Fast load times (static site)
- Accessible contrast ratios, semantic HTML, keyboard navigation, and touch-friendly controls
- Preserve `prefers-reduced-motion`; essential content must remain usable without motion JavaScript

### 6.3 Brand Elements
- **Logo:** Text-based "🤿 Okim Dive" (emoji + text)
- **Tagline:** "Freelance dive instructor & trip planner"
- **Location:** "Tioman, Malaysia"

---

## 7. Technical Requirements

### 7.1 Tech Stack (updated 2026-11-18 — see MVP-SPEC §2)
- **Framework:** Next.js 14 (App Router) + TypeScript — full migration from static HTML (owner decision, option A)
- **Styling:** existing `styles.css` / `redesign.css` preserved verbatim; no Tailwind rewrite
- **Database:** Neon Postgres (free tier) + Drizzle ORM — single source of truth
- **Auth:** Auth.js email magic links (no passwords), role-gated instructor portal
- **Email:** Resend free tier + purchased email-only domain (~SGD 15/yr); site stays on free subdomain
- **Storage:** no in-app uploads in v1 — payment evidence via WhatsApp, Iris records verification in the portal (MVP-SPEC decision #20); Cloudflare R2 deferred
- **Hosting:** Vercel free tier, `okimdive.vercel.app`, Next server runtime (`output: 'export'` removed)
- **Responsive:** Mobile-first CSS preserved
- **Performance:** Target < 3s load time on 3G for public pages
- **Portability:** standard Postgres/S3/email APIs; host swap must remain a config change

### 7.2 Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Minimum: Last 2 versions

### 7.3 Accessibility
- Semantic HTML
- Alt text for images
- Keyboard navigation
- Color contrast compliance
- Screen reader friendly

### 7.4 SEO
- Meta titles and descriptions
- Open Graph tags (for social sharing)
- Semantic heading structure
- Fast load times
- Mobile-friendly

---

## 8. Development Roadmap

### Phase 1: Foundation ✅ (Complete)
- [x] Project setup
- [x] Basic HTML structure (5 pages)
- [x] CSS styling
- [x] Navigation
- [x] Mobile responsive
- [x] GitHub repo
- [x] Local preview working

### Phase 2: Content (In Progress)
- [ ] Iris's bio and story
- [ ] Course details
- [ ] Trip information
- [ ] Contact information
- [ ] Photos and images
- [ ] Social media links

### Phase 3: Polish
- [ ] SEO optimization
- [ ] Performance tuning
- [ ] Accessibility audit
- [ ] Cross-browser testing
- [ ] Mobile testing

### Phase 4: Launch
- [ ] Deploy to Vercel
- [ ] Custom domain (optional)
- [ ] Social media announcement
- [ ] Share with Iris for review

### Phase 5: Growth (Post-Launch)
- [ ] Add blog/tips section
- [x] Bilingual support (EN/CN) — live on static site; preserved and extended in migration
- [x] Photo gallery — live; verified-imagery rules apply
- [ ] Testimonials section
- [ ] CMS migration (if needed) — headless WordPress doc remains deferred; portal already gives Iris self-service trip/policy editing

### Phase 6: Portal MVP + Next.js migration (approved 2026-11-18)
Defined by `docs/design/MVP-SPEC.md`; work on branch `QwenWork-refactor`.
- [ ] M1 Scaffold Next.js + Neon + Drizzle + Auth.js + Resend
- [ ] M2 Port six public pages with design/i18n/motion parity (desktop + mobile verified)
- [ ] M3 DB-backed trips + contact form → inquiries
- [ ] M4 Magic-link auth + booking flow + invoice (payment evidence manual via WhatsApp; verification in M5 portal)
- [ ] M5 Instructor portal (verification queue, bookings, eligibility, trips CRUD, points ledger, policy editor, settings, checklist, briefing handoff)
- [ ] M6 My Okim (read-only) + public refund/privacy/terms pages
- [ ] M7 Hardening, tests, cutover, remove vestigial static config, update AGENTS/CLAUDE guardrails
- [ ] Hackathon: 3-minute video demo due 23 Nov 2026; organizer Hashmeta-eligibility question outstanding
- [ ] Phase 2 (deferred): one bookable course; group bookings; online payments; other uploads

---

## 9. Open Questions

> **Update 2026-11-18:** business, pricing, booking/payment, and legal questions are now tracked as Iris/Jeff confirmation items in `MVP-SPEC.md` §17 (content gate: nothing publishes as fact until confirmed). The lists below remain as historical context; §17 is the live tracker.

### 9.1 Content Questions (Need Iris Input)
- [ ] What is Iris's full background and story?
- [ ] What certifications does she hold? (PADI Instructor? SSI? Level?)
- [ ] How long has she been diving/teaching?
- [ ] What specific courses does she offer?
- [ ] What are the prices for courses?
- [ ] What trips does she organize? (Destinations, frequency)
- [ ] What's included in trips? (Accommodation, dives, meals, transfers?)
- [ ] What are trip prices?
- [ ] What's her preferred contact method? (WhatsApp number? Email?)
- [ ] Does she have photos we can use?
- [ ] Does she have a logo, or should we create one?

### 9.2 Design Questions
- [ ] Any color preferences beyond ocean blue?
- [ ] Any brand guidelines to follow?
- [ ] Any websites she likes for inspiration?
- [ ] Should we add testimonials/reviews?

### 9.3 Business Questions
- [ ] Target launch date?
- [ ] Budget for domain/hosting later?
- [ ] Will Iris update content herself, or should we maintain it?
- [ ] Any legal requirements? (Terms, privacy policy)

---

## 10. Technical Decisions Log

### Decision 1: Static HTML/CSS vs Framework
**Date:** 2026-01-XX  
**Decision:** Use static HTML/CSS (no framework)  
**Rationale:** 
- Simpler to maintain
- No build process needed
- Free hosting on Vercel/GitHub Pages
- Fast load times
- Easy to hand off to non-technical users

### Decision 2: Content Management
**Date:** 2026-01-XX  
**Decision:** Static files for now, CMS migration later if needed  
**Rationale:**
- Keep it simple initially
- Can add CMS (like Decap CMS) later if Iris needs self-updates
- Reduces complexity and maintenance overhead

### Decision 3: Hosting Platform
**Date:** 2026-01-XX  
**Decision:** Vercel (free tier)  
**Rationale:**
- Free for static sites
- Auto-deploys from GitHub
- Fast CDN
- Easy custom domain setup later

### Decision 4: Full Next.js migration (supersedes Decision 1 for the app)
**Date:** 2026-11-18\
**Decision:** Migrate the entire static site to Next.js 14 App Router + TypeScript (option A), one codebase; preserve the approved design, bilingual i18n, motion, and accessibility.\
**Rationale:**
- Booking portal, magic-link auth, and Postgres require a server runtime; static export cannot support them
- Owner chose one codebase over a separate portal app (option B) despite higher migration effort
- Existing Next/React deps were vestigial; this makes them real
- Design is ported verbatim (CSS reuse), not redesigned; parity verified per page before removing static files

### Decision 5: Portal scope expansion + one record book
**Date:** 2026-11-18\
**Decision:** Add instructor portal, trip booking (one diver per booking), read-only My Okim, Okim Points ledger, and versioned policy pages. Neon Postgres is the single source of truth; `data/trips/*.json` becomes seed data.\
**Rationale:**
- Iris runs a one-person company; inquiries, bookings, payments, and loyalty must live in one record book
- Points are a transaction ledger (earned/redeemed/expired/reversed), never an editable balance
- External payments only; slot confirmed only after instructor deposit verification with availability re-check
- Courses stay inquiry-only in v1; Phase 2 targets one bookable course via product-agnostic schema

### Decision 6: Currency and points base
**Date:** 2026-11-18\
**Decision:** Iris sets currency per trip (MYR/SGD/USD/etc.); Okim Points are calculated in RM using an Iris-set per-trip conversion rate snapshotted on each ledger entry.\
**Rationale:**
- Trips span multiple countries with different payment requirements
- RM base reflects Iris's Malaysia base; snapshots keep history correct when rates/rules change

### Decision 7: Email provider and domain
**Date:** 2026-11-18\
**Decision:** Resend free tier + a purchased email-only domain (~SGD 15/yr). Brevo rejected after verification.\
**Rationale:**
- Brevo rewrites free sender addresses to its own sending domains and adds mandatory branding — unsuitable for trustworthy magic links
- Gmail/Yahoo/Microsoft sender rules (2024/2025) make domain authentication effectively required
- Resend: clean API, Auth.js provider, 3,000/mo free, no forced branding; domain is a one-time annual cost, not a platform subscription
- Site hosting stays on the free Vercel subdomain; email APIs remain swappable (portability)

### Decision 8: Hashmeta AI dropped
**Date:** 2026-11-18\
**Decision:** Do not use Hashmeta AI for the website; owner accepts the risk to the hackathon's 15% criterion. Eligibility confirmation from organizers is outstanding.\
**Rationale:**
- Owner refuses recurring platform fees and requires code ownership for production use
- QwenWork is the build workspace and back-end operations engine, not an embedded product API; AI use is shown as a stated manual handoff

### Decision 9: Manual payment evidence (WhatsApp), R2 deferred
**Date:** 2026-11-20\
**Decision:** No in-app payment claim form or screenshot upload in v1. The diver pays externally with the Booking ID as reference and sends the transfer screenshot to Iris via WhatsApp; Iris records and verifies the payment in the portal. Cloudflare R2 is deferred out of v1.\
**Rationale:**
- Owner chose the simplest honest flow for a one-person business already run over WhatsApp
- Removes upload/storage/retention surface from the MVP; verification stays a human act against the bank record
- MVP-SPEC §6/§12/§13/§14 updated; decision #20 in the spec's change-control log

---

## 11. Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-01-XX | 0.1 | Initial draft | Vega |
| 2026-11-18 | 0.2 | Portal scope expansion; Next.js migration (Decisions 4–8); routes, stack, roadmap updated; companion MVP-SPEC v1.0 approved as source of truth | QwenWork (owner: Jeff) |
| 2026-11-20 | 0.3 | Decision 9: manual WhatsApp payment evidence, R2 deferred out of v1; M4 roadmap updated; companion MVP-SPEC v1.1 (decisions #20–21) | QwenWork (owner: Jeff) |

---

## 12. Approval

**Product Owner:** Jeff\
**Developer:** Vega (website foundation); QwenWork (portal MVP + migration)\
**Client:** Iris (pending review of business facts)

**Status:** v0.2 approved for build on branch `QwenWork-refactor` per `MVP-SPEC.md` v1.0. Iris confirmation outstanding on prices, deposit/refund rules, eligibility requirements, RM rates, and legal text (MVP-SPEC §17) — these gate publication, not build.

---

## Appendix A: Competitor Analysis

### Tioman Dive Centers
- **Dive Tioman (B&J):** PADI 5★ CDC, established 1986, full resort
- **Tioman Dive Centre:** SSI Diamond, multiple locations
- **Tioman Dive Buddy:** PADI 5★ IDC, 21 dive sites, bilingual site
- **Marine Monkees:** Unknown details

### Gap Analysis
**Okim Dive Advantages:**
- Personalized, small-group instruction
- Bilingual content (if we add Chinese)
- Freelance flexibility (custom trips)
- Modern, clean website (most competitors have dated sites)

**Okim Dive Challenges:**
- New brand, no established reputation
- Solo operator (limited capacity)
- No resort/accommodation (just instruction/trips)

---

## Appendix B: User Stories

### As a beginner diver, I want to...
- Find out what courses are available
- Understand what's included in each course
- See pricing information
- Contact Iris easily
- Learn about Iris's experience and credentials

### As an experienced diver, I want to...
- Find dive trip offerings
- See trip details (destination, duration, cost)
- Understand what's included
- Contact Iris for booking
- See photos of dive sites

### As a Chinese-speaking tourist, I want to...
- Find dive services in Chinese
- Use WeChat/WhatsApp to contact
- See trip packages
- Understand pricing in my currency

---

## Appendix C: Content Inventory

### Existing Assets
- Instagram: @okim_dive (photos, posts)
- Facebook: OKIM Dive page
- XiaoHongShu: 小红书 account
- Photos: TBD (need to collect from Iris)

### Needed Assets
- [ ] Professional headshot of Iris
- [ ] Underwater action shots
- [ ] Course photos (students)
- [ ] Trip destination photos
- [ ] Logo (if exists)
- [ ] Course descriptions
- [ ] Trip descriptions
- [ ] Pricing details
- [ ] Contact information
- [ ] Bio/story content

---

**Next Steps:**
1. Review this PRD with Jeff
2. Get Iris input on open questions
3. Finalize content requirements
4. Begin Phase 2 (content gathering)
5. Iterate on design as needed
