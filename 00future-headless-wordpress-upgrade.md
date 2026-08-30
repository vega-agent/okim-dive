# Future Upgrade: Headless WordPress Content Management

**Status:** Future consideration — no implementation yet  
**Owner:** Jeff / Iris  
**Frontend:** Existing static Okim Dive site on Vercel  
**CMS:** WordPress as a headless content-management system

## Summary

Move editable business content into WordPress while keeping the current Okim Dive frontend and visual design on Vercel.

Iris would edit content in the WordPress dashboard. The Vercel website would retrieve published content through the WordPress REST API and render it using the existing frontend.

This is a future upgrade, not a reason to migrate the current site immediately.

## Why This Approach

The current site is a static multi-page HTML/CSS/JavaScript website. It is fast, inexpensive, and easy to deploy, but Iris cannot safely update content without editing files.

A headless WordPress setup separates:

- Content management — WordPress
- Presentation and design — the existing Vercel frontend
- Deployment — Vercel and GitHub
- Long-term code maintenance — the repository and Vega

This preserves the current design instead of forcing a rebuild in a WordPress theme or page builder.

## Target Architecture

```text
Iris
  ↓ edits content
WordPress Admin
  ↓ publishes content through REST API
Okim Dive frontend on Vercel
  ↓ renders content
Visitors
```

The frontend remains responsible for:

- layout
- typography
- watercolor visual system
- responsive behavior
- animations
- navigation
- accessibility
- SEO metadata defaults

WordPress becomes responsible for:

- courses
- trips
- prices
- schedules
- FAQs
- testimonials
- gallery items
- announcements

## Proposed Content Model

### Courses

- Title
- Slug
- Short description
- Full description
- Duration
- Depth
- Prerequisites
- What's included
- Price or price label
- Hero/image assets
- Published status
- Sort order

### Trips

- Destination
- Slug
- Short description
- Full description
- Dates or availability
- Duration
- Dive sites
- Accommodation
- Inclusions
- Price
- Image gallery
- Booking notes
- Published status
- Sort order

### FAQs

- Question
- Answer
- Category
- Sort order
- Published status

### Testimonials

- Student name or display name
- Testimonial text
- Optional location
- Optional avatar/photo
- Published status
- Sort order

### Gallery Items

- Image
- Caption
- Destination/category
- Alt text
- Published status
- Sort order

### Site Settings

- WhatsApp link
- Email address
- Instagram link
- Facebook link
- XiaoHongShu link
- Business location
- Default social sharing image
- Contact response-time text

## Editorial Workflow

```text
1. Iris signs into WordPress
2. Iris creates or edits a course/trip/content item
3. Iris previews the content
4. Iris publishes it
5. Vercel frontend retrieves the published content
6. Visitors see the updated content
```

The first version should use published content only. Draft and preview workflows can be added later.

## Recommended Implementation Phases

### Phase 0 — Validate the need

- Confirm Iris wants to update content regularly
- Identify which content changes most often
- Confirm WordPress hosting and domain strategy
- Decide whether WordPress is self-hosted or managed
- Confirm whether content should be bilingual from the start

**Exit criteria:** Iris agrees that a CMS is worth the operational cost.

### Phase 1 — WordPress content foundation

- Create a private WordPress installation
- Configure administrator/editor roles
- Add custom post types for Courses and Trips
- Add structured fields
- Configure media and alt-text workflow
- Add initial content
- Enable REST API access for published content

**Exit criteria:** Iris can create and publish a course and trip without editing code.

### Phase 2 — Read-only frontend integration

- Add a small frontend API client
- Fetch published courses and trips
- Render API data using existing visual components
- Add loading and error states
- Add fallback content if WordPress is temporarily unavailable
- Cache responses where appropriate
- Keep the current static content until API data is verified

**Exit criteria:** The frontend renders real WordPress content without visual regressions.

### Phase 3 — Editorial experience

- Add a clear CMS link to the internal documentation, not the public navigation
- Document Iris's publishing workflow
- Add preview instructions
- Add image-size and alt-text guidance
- Establish content ownership and publishing rules

**Exit criteria:** Iris can safely maintain normal content without technical assistance.

### Phase 4 — Advanced features

Consider only after the basic CMS workflow is stable:

- bilingual English/Simplified Chinese fields
- scheduled publishing
- testimonials and gallery management
- announcements
- form submissions
- loyalty-program content
- booking availability
- webhook-triggered Vercel revalidation
- WordPress revision and editorial approval workflow

## Important Technical Decisions

### Do not expose WordPress as the public frontend

The public website should remain on Vercel. WordPress should be treated as an admin/content origin, ideally protected from unnecessary public access.

### Do not render unsanitized HTML blindly

The frontend must sanitize or carefully constrain rich text returned by WordPress. Content fields should be structured wherever possible.

### Use stable slugs and IDs

Courses and trips should have stable identifiers so editorial changes do not break links or SEO URLs.

### Add fallback behavior

If WordPress is down or the API request fails, the website should show a graceful fallback rather than a blank page. The current site should remain usable during CMS outages.

### Avoid excessive client-side requests

Prefer build-time or server-side fetching where the architecture allows it. If the static site fetches at runtime, cache API responses and avoid one request per card.

### Treat media as a first-class concern

Define image dimensions, compression rules, filenames, alt text, and focal-point guidance before Iris starts uploading images.

## Headless WordPress vs Full WordPress Migration

### Headless WordPress — recommended if this upgrade proceeds

- Preserves the current Vercel frontend
- Iris gets a familiar CMS dashboard
- Keeps design control in the repository
- Requires API integration and caching
- Requires WordPress hosting and maintenance

### Full WordPress theme migration — not recommended initially

- Iris gets visual page editing
- Less frontend integration work after migration
- Requires rebuilding the current design as a WordPress theme
- More difficult to preserve the existing custom visual behavior
- Adds builder/plugin dependency to the public site

## Hosting and Operations

Before implementation, choose one hosting model:

- managed WordPress hosting
- self-hosted WordPress on a small VPS
- WordPress hosting from the same provider as the domain

Required operational controls:

- automatic backups
- WordPress core/plugin update policy
- HTTPS
- strong admin authentication
- least-privilege user roles
- spam protection if forms are added
- monitoring for API availability
- documented recovery procedure

Do not store WordPress passwords, API keys, or deployment secrets in this repository or Cosmos Star.

## Loyalty Program Compatibility

Headless WordPress can later store or display:

- loyalty-program explanations
- reward descriptions
- redemption terms
- trip eligibility rules
- member FAQs

It should not automatically become the points ledger without choosing a proper loyalty or membership system. Points, transactions, balances, and redemptions need transactional storage and access control.

A future loyalty integration may use:

```text
Loyalty platform or dedicated backend
  ↓ API
WordPress content for public explanations and terms
  ↓ API
Okim Dive frontend on Vercel
```

Keep public reward information separate from private member balances.

## Risks

- WordPress security and maintenance become ongoing responsibilities
- API outages can affect dynamic content
- Poorly structured content can make the frontend harder to maintain
- Visual editing expectations may exceed what headless WordPress provides
- Bilingual content doubles editorial work
- Media uploads can become a performance problem
- A plugin-heavy setup can create version conflicts

## Decision Gate

Proceed only when all of the following are true:

- Iris needs to update content at least monthly
- The content types are stable enough to model
- Someone owns WordPress updates and backups
- Hosting cost is acceptable
- The API/fallback behavior is defined
- The current Vercel design must be preserved
- The first content scope is limited to courses and trips

## Definition of Done for the First Release

- Iris can log into WordPress
- Iris can create, edit, draft, and publish a course
- Iris can create, edit, draft, and publish a trip
- The Vercel frontend renders published data
- Draft content is not shown publicly
- API failure has a graceful fallback
- Images have usable alt text and reasonable file sizes
- Existing routes and visual design remain intact
- `npm run build` passes
- Browser QA passes on desktop and mobile
- WordPress backup and update ownership are documented

## Current Decision

Keep the current static Vercel website unchanged for now.

If Iris confirms that regular self-service content editing is important, prototype headless WordPress with only Courses and Trips first. Do not migrate the entire site or introduce loyalty/member accounts in the first CMS release.
