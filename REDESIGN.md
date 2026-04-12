# Redesign Document — Arcade TCG Portfolio

Design direction, rules, decisions, and production checklist for the arcade cabinet + TCG card portfolio redesign.

## Concept

**"Arcade TCG"** — The portfolio is an arcade floor. You walk a pixel character between glowing cabinets, each representing a section. The content screen above shows TCG-style flippable cards. Navigation feels like playing a game, not reading a resume.

### Core Elements
- **Arcade world strip** (bottom) — pixel character walks between cabinets with starfield sky
- **CRT screen frame** (top) — content area with bezel border, inner screen rim, ambient glow, CRT static/flicker
- **TCG cards** — every piece of content is a trading card with front/back, flippable
- **Three-layer navigation** — World (cabinets) → Cards (browse/flip) → Tabs (if section has sub-categories)
- **Physical controls** — D-pad buttons, FLIP action button, keyboard arrows + space/enter
- **Loading screen** — walking sprite + progress bar, arcade-themed
- **Pixel character** — LPC spritesheet, jacket/no-jacket variants, walks between cabinets and appears under active card

### Sections (Cabinet Order)
1. **Home** — Hero with name, typing animation, role badges
2. **About** — Character card (photo + bio + skills on back) + Connect card (social links, no-flip)
3. **Journey** — Career timeline as cards (UCI → STB → SA → TG → MW → WH → FC → Blizzard), each links to Work/Personal tabs. Character switches from no-jacket (cards 0-3) to jacket (cards 4+) at MobilityWare.
4. **Work** — Tabbed by company (Blizzard, MobilityWare, Sega Atlus, Trigger Global, Super Toy Box)
5. **Personal** — Tabbed (Friend Castle, Waxheart, Games & Tools, This Website, College Years)
6. **Play** — Quick-access cards for games and tools with og-images

## Design Rules

### Readability
- **No scrolling on card backs** — all content must fit in one view. If it doesn't fit, shorten the text or remove the gallery, never add scroll.
- **Card text minimum sizes** (desktop): front name 0.85rem, type 0.65rem, flavor 0.82rem. Back title 1.05rem, role 0.75rem, body 1rem, links 0.7rem.
- **"click to flip"** hint must be visible on every flippable card. On touch devices, JS replaces with **"tap to flip"**. Minimum font size 0.45rem.
- **Links on both sides** — every card with a back link also shows the link on the front face.
- **No-flip cards** (`.no-flip`) don't show flip hint and ignore flip interactions. Used for: social links card, skill-only cards.

### Arcade Feel
- **Double border framing** — outer bezel border (`2px solid rgba(74,144,217,0.12)`) + inner screen rim (`1px solid rgba(74,144,217,0.1)` with `inset box-shadow`). The gap between them is the "monitor housing."
- **Inner screen rim** uses `position: absolute; inset: 5px` with `border-radius: 6px` — visible on all four sides including bottom.
- **Screen glow lines** — thin blue gradient lines along top and bottom edges of inner screen (`::before` and `::after`).
- **CRT effects inside screen** — flicker overlay (scanlines, 0.02 opacity), static noise (SVG fractal noise, 0.015 opacity).
- **Per-section ambient glow** — colored radial gradient (0.1 opacity) that transitions when navigating. Each section has its own color.
- **Per-section pattern overlay** — subtle geometric patterns (diagonal lines, grid, bokeh) varying by section.
- **Star twinkle** in world strip — gentle pulse (not fade-from-invisible).
- **Bezel label** — "raggedydoc · model asc-2026" at bottom center of bezel (hidden on mobile).
- **Corner brackets** on bezel — L-shaped lines at TR, BL, BR corners. TL hidden due to Chrome clipping bug.
- **Loading screen** — pixel character walking with progress bar and "Preparing the arcade..." hint. Fades out after content loads.

### Card Design Rules
- **Fixed size per breakpoint** — cards don't change size when switching sections. Consistent height across all screens.
- **Desktop**: 300×480px
- **Tablet** (769-1024px): 240×responsive height (calc(100vh - 370px), min 320, max 480)
- **Mobile** (≤768px): min(280px, 72vw) × calc(100vh - 330px), min 260, max 400
- **iPhone SE** (≤400px): 200×calc(100vh - 400px), min 180, max 280
- **Floating bob animation** with staggered timing (`--float-dur`, `--float-del` CSS vars). Pauses when card is flipped.
- **Peek-flip animation** on first visit to a section — first card briefly rotates 35deg to hint at flippability.
- **Active card glow** — brighter border + box-shadow when selected in card navigation mode.
- **Emblem cards** (no image) use `.gc-emblem` with: large abbreviation text, company name subtitle, inner pixel border, corner dots, diagonal hatching pattern, pulsing glow animation.
- **Gallery images on back** — use `max-width: 100%; max-height: 100%; object-fit: contain`. Never clip, never scroll.
- **Lightbox** — clicking any card image opens it fullscreen. Click or Escape to close.

### Sprite Rules
- **World character** — 64×64 sprite at bottom of world strip, walks between cabinets with `transitionend` detection.
- **Content sprite** — appears centered below the active card when in card mode (Layer 1). Fixed horizontal center (`left: 50%; transform: translateX(-50%)`), vertical position calculated from active card bottom.
- **Sprite shows TAP/SPACE label** below it via `::after` pseudo-element. Shows "SPACE" on desktop, "TAP" on mobile.
- **Sprite is hidden until positioned** — `opacity: 0` during the 400ms scroll-settle delay, then fades in at correct position.
- **Jacket swap** — Journey section only. Cards 0-3 (UCI through Trigger) use `character-spritesheet-no-jacket.png`. Cards 4+ use `character-spritesheet.png`.
- **Walking animation** — brief walk-right/walk-left when scrolling between cards (500ms), then idle.
- **Jump animation** on card flip (400ms).

### Spacing Rules (Mobile)
- **Title area** — `// tag` and section title need visible gap from the inner screen rim top edge. Panel padding-top ≥ 0.4rem.
- **Title to tabs gap** — title `margin-bottom` ≥ 0.2rem so tabs don't feel jammed against the title.
- **Tabs to cards gap** — minimal. Tab bar margin-bottom ≤ 0.15rem, card carousel padding-top 0.
- **Card to sprite gap** — card must be short enough that sprite + label + gap all fit above the inner screen rim bottom edge.
- **Tab layout on phones** — wraps into rows. For 5 tabs, target 3+2 layout via `min-width: 27-28%` on each tab button.
- **Tab layout on tablets** — all tabs on one line.

### Navigation
- **Layer 0 (WORLD)**: Left/right moves character between cabinets. Click cabinet to navigate.
- **Layer 1 (CARDS)**: Up enters card mode. Left/right scrolls carousel with center-snap. Space/Enter flips active card. Sprite appears below active card.
- **Layer 2 (TABS)**: Up again enters tab bar (Work/Personal sections only). Left/right switches tabs. Down returns to cards.
- **Down** always goes back one layer. Escape closes lightbox.
- **Mode label** in control bar shows "WORLD" / "CARDS" / "TABS".
- **Cross-section navigation** — Journey card backs have "View Projects →" links that call `goToSection(cabId, tabId)` to navigate to the matching Work/Personal tab.

### Controls
- **D-pad** — Up/Down/Left/Right buttons
- **FLIP button** — round, purple accent, triggers flipActive()
- **Mode label** — shows current layer
- **Keyboard hints** — shown on desktop ("SPACE/ENTER=FLIP · ARROWS=MOVE · UP/DOWN=LAYER"), hidden on mobile/tablet
- **Control bar height**: desktop 48px, tablet 44px, mobile 36px, SE 36px

## Architecture: SPA with pushState

### Current State (implemented)
```
index.html              ← Arcade shell (81 lines HTML)
css/arcade.css          ← All styles (900+ lines)
js/arcade.js            ← All interaction + routing (620+ lines)
sections/
  home.html             ← Home content fragment
  about.html            ← About cards fragment
  journey.html          ← Journey cards fragment
  work.html             ← Work tabs + cards fragment
  personal.html         ← Personal tabs + cards fragment
  play.html             ← Play cards fragment
404-arcade.html         ← SPA redirect + arcade-themed 404
index-old.html          ← Backup of original portfolio homepage
```

### How it works
1. `index.html` loads the arcade shell (world strip, CRT bezel, controls, loading screen)
2. JS reads URL path (`/work`, `/about`, etc.) or `?route=` param from 404 redirect — defaults to `/` (home)
3. Fetches `sections/{path}.html` and injects into `#section-content`
4. Character positions at the matching cabinet
5. Loading screen fades out

### On navigation
1. Character walks to new cabinet (animation)
2. `history.pushState({}, '', '/work')` — URL bar updates, no reload
3. `fetch('sections/work.html')` — loads section content
4. Old content slides out, new content slides in (directional)
5. `<title>` updates per section
6. Tab click handlers and link stopPropagation re-bound on injected content
7. Section cached in memory for instant revisit

### On browser back/forward
1. `popstate` event fires
2. Character walks to previous/next cabinet
3. Section content swaps via cached content

### GitHub Pages routing
Using **Option B: Redirect trick** — `404-arcade.html` redirects known paths to `/?route=/work`. Shell reads `?route=` param, calls `replaceState` to set clean URL.

### Content caching
Section fragments cached in `sectionCache` object after first fetch. Navigation to previously visited sections is instant.

## Production Checklist

### Done
- [x] SPA architecture with pushState routing
- [x] Section content extraction into fragments
- [x] CSS/JS extracted to separate files
- [x] 404 fallback page with SPA redirect
- [x] Loading screen with fallback timeout
- [x] Three-layer keyboard navigation
- [x] Card flip with peek animation
- [x] Lightbox for image expansion
- [x] Jacket/no-jacket sprite swap on Journey
- [x] Cross-section navigation from Journey cards
- [x] "tap to flip" on touch devices
- [x] Mobile breakpoint (≤768px)
- [x] Small phone breakpoint (≤400px / iPhone SE)
- [x] Tablet breakpoint (769-1024px)
- [x] Inner screen rim (double border)
- [x] CRT effects (flicker, static, ambient glow)
- [x] Original index.html preserved as index-old.html

### Must-have before launch
- [ ] **SEO**: Static SEO pages per route (`about/index.html`, `work/index.html`, etc.) with unique meta tags + noscript content
- [ ] **SEO**: Update `sitemap.xml` with new URLs
- [ ] **SEO**: Canonical URL handling
- [ ] **Accessibility**: ARIA roles on cards, tabs, controls
- [ ] **Accessibility**: Screen reader announcements on section change
- [ ] **Accessibility**: Focus management + visible focus rings
- [ ] **Accessibility**: Skip-to-content link
- [ ] **Accessibility**: Reduced-motion: disable all animations, show content statically
- [ ] **Mobile**: Touch swipe for card carousel
- [ ] **Mobile**: Verify all card content fits without clipping on all breakpoints
- [ ] **Performance**: Add `width`/`height` to all `<img>` tags
- [ ] **Performance**: lite-youtube-embed for YouTube iframes
- [ ] **Privacy**: Link to `privacy.html` from controls area
- [ ] **Content**: Verify all project descriptions are current
- [ ] **Content**: Verify all external links work
- [ ] **Content**: Image audit — no clipping, no overflow on any card front/back
- [ ] **Content**: Portfolio evolution screenshots (Wayback Machine captures)
- [ ] **Browser**: Test Firefox, Safari, Edge

### Nice-to-have
- [ ] Sound effects (cabinet select, card flip, sprite walk) with mute toggle
- [ ] Card rarity system (common/rare/legendary)
- [ ] Card back pattern design (visible when face-down before flip)
- [ ] Parallax depth on cards (3D tilt on mouse hover)
- [ ] Touch swipe gestures (left/right for cabinets, up for cards)
- [ ] Screen static/glitch transition between cabinets
- [ ] Cabinet screen previews (tiny thumbnails on the cabinet screens)
- [ ] Portfolio evolution cards with screenshots

### Redirects needed
| Old URL | New URL |
|---|---|
| `/aboutMe.html` | `/about` |
| `/workprojects.html` | `/work` |
| `/personalprojects.html` | `/personal` |
| `/workprojects.html#Blizzard` | `/work` (Blizzard tab auto-selected) |
| `/workprojects.html#Trigger` | `/work` (Trigger tab) |
| `/personalprojects.html#FriendCastle` | `/personal` (FC tab) |

Old pages should remain accessible with a banner linking to the new site.

## Known Issues

- **TL bezel corner**: Chrome border-radius clipping bug. Workaround: `display: none` on `.bezel-corner.tl`.
- **Sprite positioning delay**: Uses 400ms delay after `scrollIntoView`. Can misalign if scroll is slow.
- **YouTube iframes**: Blocked by ad blockers. Non-critical — cards work, just no video preview.
- **Dark band at bezel/world boundary**: Caused by transparent elements in the world strip. Fixed by setting opaque `background: #0e1430` on `.world` and matching sky gradient top color. Mountains removed entirely (they used transparent gradients that bled through).
- **Card flip twitch**: Fixed by `animation-play-state: paused` when flipped.
- **Double flip on click**: Inline `onclick` + document listener both toggled flip. Fixed by removing all inline onclick handlers.
- **Sprite flash on show**: Fixed by hiding sprite (`opacity: 0`) until positioned, then fading in.
- **Loading screen stuck**: Fixed with try/catch on positionInit + 3s fallback timeout + runs-once guard.
- **Missing `</div>`**: Screen-bezel closing tag was missing, causing world/controls to nest inside bezel. Fixed.
- **CSS image paths**: When CSS extracted to `css/arcade.css`, relative paths needed `../img/` prefix.

## Files

### Production
| File | Description |
|---|---|
| `index.html` | Arcade shell — 81 lines, links to CSS/JS |
| `css/arcade.css` | All styles — 900+ lines |
| `js/arcade.js` | All interaction + routing — 620+ lines |
| `sections/*.html` | 6 content fragments |
| `404-arcade.html` | SPA redirect + arcade-themed 404 |
| `index-old.html` | Backup of original homepage |

### Preview (reference only)
| File | Description |
|---|---|
| `redesign-preview.html` | Preview 1: Art Deco / editorial |
| `redesign-preview-2.html` | Preview 2: Game dev scroll |
| `redesign-preview-3.html` | Preview 3: Arcade TCG (evolved into production) |

All files on `feature/design-test` branch.
