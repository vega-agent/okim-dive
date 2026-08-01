# Okim Dive - Brand Guide

**Version:** 1.0  
**Created:** 2026-01-XX  
**Last Updated:** 2026-01-XX

---

## 1. Brand Essence

### Core Identity
- **Personality:** Gentle, authentic, approachable, nature-loving
- **Voice:** Warm, personal, educational, not corporate
- **Values:** Personalized instruction, safety, marine appreciation, simplicity
- **Differentiator:** Freelance flexibility with personal touch (vs corporate dive centers)

### Brand Promise
"Personalized diving experiences with a gentle, authentic touch"

---

## 2. Visual Identity

### 2.1 Design Style: Watercolor & Soft

**Inspiration:** Watercolor paintings, ocean washes, soft natural textures
**Mood:** Calm, inviting, organic, handmade feel
**Avoid:** Corporate, harsh, overly digital, aggressive marketing

### 2.2 Color Palette

**Primary Colors**
```
Ocean Mist      #A8DADC  (soft blue-green)
Sea Foam        #B8E0D2  (light aqua)
Sand            #F1FAEE  (warm off-white)
Deep Water      #457B9D  (muted blue)
```

**Accent Colors**
```
Coral           #E63946  (warm coral - use sparingly for CTAs)
Sunset          #F4A261  (warm orange - highlights)
Kelp            #2A9D8F  (teal green - secondary)
```

**Neutral Colors**
```
Cloud           #FEFAE0  (background)
Driftwood       #6C757D  (text)
Deep Sea        #264653  (headings)
```

**Usage Guidelines**
- Backgrounds: Use Sand (#F1FAEE) or Cloud (#FEFAE0)
- Headings: Deep Sea (#264653) for strong contrast
- Body text: Driftwood (#6C757D) for softness
- Links/CTAs: Coral (#E63946) for action, Deep Water (#457B9D) for secondary
- Accents: Use Sunset (#F4A261) and Kelp (#2A9D8F) sparingly for highlights

### 2.3 Typography

**Heading Font:** 
- **Primary:** 'Playfair Display' (serif, elegant, organic)
- **Fallback:** Georgia, serif
- **Usage:** Page titles, section headings
- **Weight:** Regular (400) or Light (300) for softness

**Body Font:**
- **Primary:** 'Lato' (sans-serif, clean, readable)
- **Fallback:** -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- **Usage:** Body text, buttons, navigation
- **Weight:** Light (300) or Regular (400)

**Font Sizes**
```
H1: 2.5rem (40px) - Page titles
H2: 2rem (32px) - Section headings
H3: 1.5rem (24px) - Card titles
Body: 1rem (16px) - Paragraphs
Small: 0.875rem (14px) - Captions, metadata
```

**Line Height**
```
Headings: 1.2
Body: 1.6 (generous for readability)
```

### 2.4 Logo

**Current:** Text-based with dive emoji
```
🤿 Okim Dive
```

**Future Direction:**
- Consider custom hand-drawn or watercolor-style logo
- Incorporate wave or ocean element
- Keep simple and recognizable at small sizes
- Should work in single color (for stamps/embossing)

### 2.5 Imagery Style

**Photography**
- Natural lighting, soft focus where appropriate
- Underwater shots with visible light rays, soft blues/greens
- Above water: landscapes, sunsets, beach scenes
- People: candid, smiling, not posed
- Color grading: Warm tones, slightly desaturated, film-like quality

**Watercolor Elements**
- Subtle watercolor washes as section backgrounds
- Soft-edged shapes (not hard geometric)
- Organic, flowing forms
- Transparency and layering effects

**Avoid**
- Stock photos that look generic
- Harsh filters or heavy saturation
- Overly corporate or staged imagery
- Clip art or cartoon graphics

---

## 3. Design Principles

### 3.1 Simplicity First
- Clean layouts with generous whitespace
- One clear message per section
- Minimal decorations
- Let content breathe

### 3.2 Soft & Organic
- Rounded corners (4-8px, not sharp)
- Soft shadows (not harsh drop shadows)
- Gentle transitions (200-300ms ease)
- Flowing, not rigid

### 3.3 Authentic & Personal
- Real photos over stock
- Personal voice in copy
- Show Iris's personality
- Highlight student experiences

### 3.4 Nature-Inspired
- Colors from ocean and sky
- Organic shapes and patterns
- Natural textures (watercolor, paper)
- Environmental awareness

---

## 4. UI Components

### 4.1 Buttons

**Primary Button**
```css
Background: #E63946 (Coral)
Text: White
Border-radius: 6px
Padding: 12px 24px
Shadow: 0 2px 4px rgba(0,0,0,0.1)
Hover: Darken 10%, lift 2px
```

**Secondary Button**
```css
Background: Transparent
Border: 2px solid #457B9D (Deep Water)
Text: #457B9D
Border-radius: 6px
Padding: 12px 24px
Hover: Fill with light blue, white text
```

**Text Link**
```css
Color: #457B9D (Deep Water)
Underline: None
Hover: Underline, darken color
```

### 4.2 Cards

**Style**
```css
Background: White
Border: 1px solid #E0E0E0 (very light)
Border-radius: 8px
Padding: 24px
Shadow: 0 2px 8px rgba(0,0,0,0.05) (very soft)
Hover: Lift 4px, shadow increases
```

**Usage**
- Course listings
- Trip cards
- Social media links
- Feature highlights

### 4.3 Navigation

**Desktop**
```css
Background: White or transparent
Height: 64px
Shadow: Very subtle on scroll
Links: Uppercase, letter-spacing 0.5px
Active state: Coral underline
```

**Mobile**
```css
Hamburger menu
Full-screen overlay on open
Large touch targets (44px minimum)
```

### 4.4 Forms

**Input Fields**
```css
Border: 1px solid #D0D0D0
Border-radius: 4px
Padding: 12px
Focus: Border turns Coral, subtle glow
```

**Labels**
```css
Color: #264653 (Deep Sea)
Font-weight: 500
Margin-bottom: 4px
```

---

## 5. Layout Patterns

### 5.1 Hero Section
- Full-width background image or watercolor wash
- Centered content
- Large heading, tagline, 1-2 CTA buttons
- Soft overlay for text readability
- Height: 60-80vh (not full screen to show scroll indicator)

### 5.2 Content Sections
- Max-width: 1200px, centered
- Padding: 64px vertical (generous whitespace)
- Alternating backgrounds (white / very light blue)
- Clear visual hierarchy

### 5.3 Grid System
- 12-column grid for desktop
- 2-column for cards on tablet
- 1-column (stacked) on mobile
- Gutter: 24px

### 5.4 Spacing Scale
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
3xl: 64px
4xl: 96px
```

---

## 6. Motion & Interaction

### 6.1 Transitions
- Duration: 200-300ms
- Easing: ease-out (natural deceleration)
- Use for: Hover states, page transitions, modal opens

### 6.2 Hover Effects
- Cards: Lift 4px, increase shadow
- Buttons: Darken 10%, lift 2px
- Links: Underline appears
- Images: Slight scale (1.02-1.05)

### 6.3 Scroll Behavior
- Smooth scrolling for anchor links
- Parallax on hero images (subtle, not distracting)
- Fade-in animations for content sections (optional)

---

## 7. Brand Voice & Tone

### 7.1 Writing Style
- **Conversational:** Write like you're talking to a friend
- **Warm:** Use "we" and "you", avoid corporate speak
- **Educational:** Explain diving concepts simply
- **Personal:** Share stories, not just facts
- **Encouraging:** Make diving feel accessible

### 7.2 Voice Examples

**Good:**
"Ready to explore what's beneath the waves? Whether it's your first dive or your fiftieth, we'll make it an experience you'll treasure."

**Avoid:**
"Okim Dive offers comprehensive scuba instruction services tailored to individual skill levels."

### 7.3 Key Phrases
- "Discover the underwater world"
- "Personalized diving experiences"
- "Your ocean adventure starts here"
- "Dive with confidence"
- "Explore Tioman's reefs"

---

## 8. Social Media Guidelines

### 8.1 Instagram
- Consistent color grading (warm, slightly desaturated)
- Mix of underwater, above water, people, landscapes
- Stories for daily updates, feed for highlights
- Use watercolor-style graphics for announcements

### 8.2 Facebook
- Share longer stories and trip reports
- Post event announcements
- Engage with comments personally
- Cross-post important Instagram content

### 8.3 XiaoHongShu
- Chinese language content
- Focus on trip packages and pricing
- Educational content about diving
- Testimonials from Chinese-speaking students

---

## 9. Implementation Notes

### 9.1 CSS Variables
Define all colors, spacing, and typography as CSS variables for easy updates:

```css
:root {
  /* Colors */
  --color-ocean-mist: #A8DADC;
  --color-sea-foam: #B8E0D2;
  --color-sand: #F1FAEE;
  --color-deep-water: #457B9D;
  --color-coral: #E63946;
  --color-sunset: #F4A261;
  --color-kelp: #2A9D8F;
  --color-cloud: #FEFAE0;
  --color-driftwood: #6C757D;
  --color-deep-sea: #264653;
  
  /* Typography */
  --font-heading: 'Playfair Display', Georgia, serif;
  --font-body: 'Lato', -apple-system, sans-serif;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  
  /* Shadows */
  --shadow-soft: 0 2px 8px rgba(0,0,0,0.05);
  --shadow-medium: 0 4px 12px rgba(0,0,0,0.1);
}
```

### 9.2 Responsive Breakpoints
```css
/* Mobile first */
--breakpoint-sm: 640px;   /* Tablet portrait */
--breakpoint-md: 768px;   /* Tablet landscape */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
```

### 9.3 Accessibility
- Color contrast: Minimum 4.5:1 for body text, 3:1 for large text
- Focus states: Visible outline for keyboard navigation
- Alt text: All images must have descriptive alt text
- Semantic HTML: Use proper heading hierarchy (h1-h6)

---

## 10. Assets Checklist

### Needed from Iris
- [ ] Professional headshot
- [ ] Underwater action photos
- [ ] Student/course photos
- [ ] Trip destination photos
- [ ] Any existing logo files
- [ ] Favorite color references (if different from palette)
- [ ] Examples of designs she likes

### To Create
- [ ] Logo (if custom needed)
- [ ] Watercolor texture backgrounds
- [ ] Social media templates
- [ ] Favicon
- [ ] Open Graph image (for social sharing)

---

## 11. Inspiration & References

### Design Inspirations
- Watercolor painting techniques
- Japanese minimalism (ma - negative space)
- Scandinavian design (simple, functional)
- Nature photography (National Geographic style)

### Color Inspirations
- Ocean gradients at different depths
- Sunset over water
- Coral reef colors (used sparingly)
- Tropical beaches

### Typography Inspirations
- Elegant serif for headings (editorial feel)
- Clean sans-serif for body (modern, readable)
- Hand-lettered accents (optional, for special sections)

---

## 12. Brand Evolution

### Current State (v1.0)
- Basic color palette defined
- Typography selected
- Design principles established
- Watercolor style direction set

### Future Considerations
- Custom illustrations (marine life, dive sites)
- Animated watercolor effects (subtle)
- Video background options
- Seasonal color variations (optional)
- Merchandise design (t-shirts, stickers)

---

**Usage:** This brand guide should be referenced for all design decisions. When in doubt, ask: "Does this feel soft, authentic, and ocean-inspired?"

**Questions?** Reach out to Jeff or Vega for clarification on brand application.
