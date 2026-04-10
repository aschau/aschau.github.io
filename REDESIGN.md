# Redesign Document — Preview 3: Arcade TCG

Design direction, decisions, and production checklist for the arcade cabinet + TCG card portfolio redesign.

## Concept

**"Arcade TCG"** — The portfolio is an arcade floor. You walk a pixel character between glowing cabinets, each representing a section. The content screen above shows TCG-style flippable cards. Navigation feels like playing a game, not reading a resume.

### Core Elements
- **Arcade world strip** (bottom) — pixel character walks between cabinets with starfield sky
- **CRT screen frame** (top) — content area with bezel, corner brackets, scanlines, ambient glow
- **TCG cards** — every piece of content is a trading card with front (art + name + flavor) and back (details + links)
- **Three-layer navigation** — World (cabinets) → Cards (browse/flip) → Tabs (if section has sub-categories)
- **Physical controls** — D-pad buttons, FLIP action button, keyboard arrows + space/enter
- **Loading screen** — walking sprite + progress bar, arcade-themed

### Sections (Cabinet Order)
1. **Home** — Hero card with name, typing animation, role badges
2. **About** — Character card (photo + bio + stats + skills) + Connect card (social links)
3. **Journey** — Career timeline as cards (UCI → STB → SA → TG → MW → WH → FC → Blizzard), each links to its Work/Personal tab
4. **Work** — Tabbed by company (Blizzard, MobilityWare, Sega Atlus, Trigger Global, Super Toy Box), project cards with images
5. **Personal** — Tabbed (Friend Castle, Waxheart, Games & Tools, This Website, College Years), project cards
6. **Play** — Quick-access cards for games and tools with og-images

## Design Decisions

### Why single-page arcade?
- **Memorable** — nobody else has a portfolio that feels like walking through an arcade
- **Game-dev identity** — pixel sprites, TCG cards, cabinets, CRT screen — every element says "I make games"
- **Interactive** — visitors explore rather than scroll, which creates engagement

### Card design
- Fixed size (300×480 desktop, 220×380 mobile)
- Front: art/emblem + nameplate + type + flavor text + links
- Back: title + role + description + gallery + links
- Flip via click/space/enter, peek animation on first visit
- Floating bob animation with staggered timing
- `no-flip` class for cards that don't need a back (social links, skills)
- Every card with a back link also has the link on the front

### Navigation layers
- **Layer 0 (WORLD)**: Left/right moves character between cabinets
- **Layer 1 (CARDS)**: Up enters, left/right scrolls carousel with center-snap, space/enter flips
- **Layer 2 (TABS)**: Up again enters tab bar (Work/Personal), left/right switches tabs, down returns to cards

### Visual effects
- CRT flicker overlay (scanlines inside screen)
- TV static noise (SVG fractal noise, subtle)
- Per-section ambient glow (colored radial gradient, transitions on navigate)
- Per-section pattern overlay (diagonal lines, grid, bokeh — varies by section)
- Star twinkle animation in world strip
- Card emblem pulse glow for cards without images
- Pixel corner brackets on screen bezel
- Character sprite walk/idle animations from LPC spritesheet

## Content Mapping

### Current site → Redesign
| Current Page | Redesign Location |
|---|---|
| `index.html` (home + timeline) | Home cabinet + Journey cabinet |
| `aboutMe.html` | About cabinet (character card) |
| `workprojects.html` | Work cabinet (tabbed by company) |
| `personalprojects.html` | Personal cabinet (tabbed by category) |
| Games & Tools pages | Play cabinet (quick links) + Personal > Games & Tools tab (details) |
| `privacy.html` | Linked from footer/controls area |
| `404.html` | Needs new arcade-themed 404 |

### Images used
All project images, screenshots, and og-images from the current site are referenced. No new images created. Character spritesheets reused from current site.

## Production Checklist

### Must-have before launch
- [ ] **SEO**: Add `<noscript>` fallback with static content for crawlers
- [ ] **SEO**: Per-section meta tags (update `<title>`, OG tags when navigating via JS)
- [ ] **SEO**: Update `sitemap.xml` — either keep separate page URLs with redirects, or list hash URLs
- [ ] **SEO**: Canonical URL handling for hash-based navigation
- [ ] **Accessibility**: ARIA roles on cards (`role="button"`, `aria-pressed` for flipped state)
- [ ] **Accessibility**: ARIA on tabs (`role="tablist"`, `role="tab"`, `aria-selected`)
- [ ] **Accessibility**: Screen reader announcements on section change (`aria-live` region)
- [ ] **Accessibility**: Focus management — visible focus rings on cards/tabs/controls
- [ ] **Accessibility**: Skip-to-content link
- [ ] **Accessibility**: Reduced-motion: disable all animations, show all content statically
- [ ] **Mobile**: Test on iPhone SE (375×667) — card sizes, control bar, cabinet strip
- [ ] **Mobile**: Touch swipe for card carousel
- [ ] **Mobile**: Test hamburger/mobile nav (currently hidden on small screens)
- [ ] **Performance**: Add `width`/`height` to all `<img>` tags (prevent CLS)
- [ ] **Performance**: YouTube iframes — consider lite-youtube-embed facade for faster load
- [ ] **Privacy**: Link to `privacy.html` from controls or bezel label area
- [ ] **Content**: Verify all project descriptions are current
- [ ] **Content**: Verify all external links work
- [ ] **Content**: Add timeline progression images (see below)
- [ ] **Browser**: Test Firefox, Safari, Edge (currently tested Chrome only)
- [ ] **404 page**: Create arcade-themed 404 with confused sprite

### Nice-to-have
- [ ] Sound effects (cabinet select, card flip, sprite walk) — with mute toggle
- [ ] Card rarity system (common/rare/legendary based on project impact)
- [ ] Deck builder mode — visitors can "collect" cards they've viewed
- [ ] Card back design (pattern when face-down)
- [ ] Parallax depth on cards (slight 3D tilt on mouse hover)
- [ ] Touch gestures (swipe left/right for cabinets, swipe up for cards)
- [ ] Transition animation between cabinets (screen static/glitch effect)
- [ ] Cabinet screen previews (show tiny card thumbnails on the cabinet screen)

### Redirects needed
| Old URL | New URL |
|---|---|
| `/aboutMe.html` | `/#about` |
| `/workprojects.html` | `/#work` |
| `/personalprojects.html` | `/#personal` |
| `/workprojects.html#Blizzard` | `/#work` (Blizzard tab auto-selected) |
| `/workprojects.html#Trigger` | `/#work` (Trigger tab) |
| `/personalprojects.html#FriendCastle` | `/#personal` (FC tab) |

Old pages should remain accessible but show a banner: "This page has moved → View the new site"

## Timeline Progression Feature

Show the portfolio's visual evolution as cards in the Journey or About section:

### Versions to capture
1. **2016 — UCI Original** — Static HTML/CSS, space-themed background, basic student portfolio
2. **2017-2020 — Early Career** — Added work project pages, basic Bootstrap layout
3. **2021-2025 — MobilityWare Era** — Expanded project pages, more professional layout
4. **2026 — Glassmorphism** — Current live site: dark theme, glass cards, pixel sprite timeline, floating particles, achievements, loading screen
5. **2026 — Arcade TCG** — This redesign: arcade cabinets, TCG cards, CRT screen, layered navigation

### Implementation
- Add a "Portfolio Evolution" card or tab in the About or Personal section
- Each version gets a card with a screenshot of how the site looked at that time
- Front: screenshot + year + version name
- Back: what changed, what technology was used, what inspired the redesign
- Need: screenshots of each version (take from Wayback Machine or existing `projects/personal/portfolio.html` research page)

## Known Issues

- **TL bezel corner**: CSS border-radius clips elements in the top-left corner of the bezel (Chrome rendering bug). Workaround: hidden via `display: none`.
- **Card flip twitch**: Resolved by pausing float animation when flipped and using `overflow: hidden` instead of `auto` on back face.
- **Sprite positioning**: Uses 400ms delay after `scrollIntoView` to wait for scroll to settle. Occasional misalignment if scroll is slow.
- **YouTube iframes**: Blocked by ad blockers (ERR_BLOCKED_BY_CLIENT). Non-critical — cards still work, just no video preview.
- **`file://` protocol**: Some features (hash routing, font loading) may behave differently on `file://` vs `http://`. Test on a local server.

## Files

| File | Description |
|---|---|
| `redesign-preview.html` | Preview 1: Art Deco / editorial (gold, serif) |
| `redesign-preview-2.html` | Preview 2: Game dev (pixel fonts, starfield) |
| `redesign-preview-3.html` | **Preview 3: Arcade TCG (this design)** |
| `REDESIGN.md` | This document |

All preview files are on the `feature/design-test` branch.
