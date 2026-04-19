# CLAUDE.md

Static portfolio website (GitHub Pages) for Andrew Steven Chau at `www.raggedydoc.com` (repo: `aschau.github.io`). Plain HTML/CSS/JS, no build system. Always use "Andrew Steven Chau" (not "Andrew Chau") for SEO differentiation.

## Development

- Live site serves from `master`. Dev branch is `develop`.
- Open `index.html` in browser to preview. Hard refresh (`Ctrl+Shift+R`) to bust cache. For local serving: `npx http-server -p 8080 -c-1`.
- Games and tools are self-contained in `games/` and `tools/` — they don't use the portfolio's arcade shell. Each has its own `CLAUDE.md` with detailed docs.
- **Testing**: `npm test` runs Jest (285 tests). Each game/tool extracts pure logic into a `.module.js` file (UMD-compatible, used by both tests and browser). Tests live in `__tests__/`. CI runs on push/PR via `.github/workflows/tests.yml`.

## Architecture

The portfolio uses an **arcade cabinet metaphor**: a single `index.html` contains a world strip with 5 cabinets, and each cabinet dynamically loads a section from `sections/<id>.html` into the content panel.

- **Entry**: `index.html` — arcade shell with CRT bezel, ambient backgrounds, content panel, world strip (cabinets + walking character sprite), and control panel. SEO redirect pages: `about/`, `work/`, `personal/`, `play/` — each is a thin HTML page that redirects to `/?route=/<section>`.
- **Sections** (`sections/*.html`, AJAX-loaded): `home`, `about`, `work`, `personal`, `play` (5 total; `journey` was folded into About's battlefield)
- **Project detail pages**: `projects/work/<name>/<name>.html` and `projects/personal/<name>.html`
- **Shared components** (`js/components.js`): loading screen, particles, gamification bootstrap. `js/gamification.module.js` extracts testable logic from `js/gamification.js`.
- **Styling**: Bootstrap 5.3.8 CDN (jsdelivr) + `css/arcade.css` + `css/stylesheet.css`. No jQuery. Dark glassmorphism + retro-arcade theme. Design tokens in `:root`.
- **Responsive**: Mobile breakpoint at 768px (phones), 400px (small phones / iPhone SE). Tablet landscape (769-1024px) adjusts spacing.

## Section Design

Each section is themed differently to feel unique. All use the shared `.gc` card component (flip, peek-in, float animation, back-side content, gallery slideshows).

- **Home** (`sections/home.html`): landing card with name, current role, short pitch.
- **About** (`sections/about.html`): **MTG board layout** — Commander (left, your personal card with keyword abilities + P/T box), Battlefield (center, 6 company `.gc` cards representing career history), Emblem (right, social-links card with "Ongoing" rules text + location), Skills (bottom row of skill "land" cards). On mobile: vertical scroll layout, 2-col battlefield grid, 3-col skills grid, sprite follows active card on scroll.
- **Work** (`sections/work.html`): **Deck-box hand** at the bottom (5 3D deck boxes for Blizzard, MobilityWare, Sega Atlus, Trigger Global, Super Toy Box) with a dynamic deck title above. Active deck "opens" (tilts forward with card peeking out) to show its cards in the carousel above.
- **Personal** (`sections/personal.html`): Same deck-box pattern, 5 decks: Friend Castle, Waxheart, Games & Tools, Website (3 era cards with screenshots), College.
- **Play** (`sections/play.html`): carousel of games/tools cards.

## Arcade Navigation (arcade.js)

3-layer depth system with keyboard/touch/click input:

- **Layer 0 (WORLD)**: cabinets visible, world character walks to cabinets. LEFT/RIGHT switches cabinet. Swipe/drag on the world strip also navigates cabinets on touch/mouse.
- **Layer 1**: context-dependent — **DECKS** on Work/Personal (hand-card boxes), **CARDS** elsewhere (card carousel). UP enters this layer from world. On Work/Personal, the pixel sprite sits on top of the active deck and walks between decks when navigating.
- **Layer 2 (CARDS)**: only on Work/Personal — UP again from decks moves sprite up to the active card in the carousel.

Key functions in `js/arcade.js`:
- `layer1IsTabs()` — returns true on Work/Personal (hand-cards present)
- `getCards()`, `getTabs()` — layer-aware element queries
- `highlightCard()`, `highlightTab()` — active-state + sprite positioning. `highlightCard` also toggles `.on-no-flip` on the sprite to hide the SPACE hint for no-flip cards.
- `positionSpriteAtCard(card, above)` — unified sprite positioning (used for board layout cards and deck boxes). When `above=true`, sprite stands on top of the element (used for deck boxes).
- `positionSpriteBottom()` — default "sprite under active card" positioning
- `updateDeckTitle()` — updates the deck title on Work/Personal when tab/hand changes
- Board-layout scroll listener in `bindSectionHandlers()` keeps the sprite stuck to the active card while the About board scrolls on mobile.

## Character Sprite

LPC spritesheets (CC-BY-SA 3.0): `img/character-spritesheet.png` (64x64 frames) + `character-spritesheet-no-jacket.png` variant. Two instances:

- **World character** (`.character`, 64px): walks along the cabinet strip
- **Content sprite** (`.content-sprite`, 48px): appears in content area, moves between interactive elements (cards, deck boxes). Has a SPACE/TAP text hint via `::after`; hidden on mobile (`display: none`) and when on decks layer (`.on-decks`) or no-flip cards (`.on-no-flip`).

## Achievements (gamification.js + gamification.module.js)

11 achievements. Keys are stable — titles/descs have been renamed without breaking existing user progress. Listeners are attached in **capture phase** on the document to bypass `.gc a` handlers that call `stopPropagation()`.

- **cabinet-crawler** — Visit all 5 sections. Home is auto-tracked on init even if user lands on another URL.
- **card-collector** — Flip any card (simplified from "flip every card").
- **pixel-walker** — Use keyboard arrows.
- **curious** — Click any external `a[target="_blank"]`.
- **night-owl** — Visit between 10 PM–5 AM.
- **deep-diver** — Click a project-detail link.
- **social-butterfly** — Click any `.soc-btn` or `.gc-social-link`.
- **player-one** — Visit Play.
- **commander** — Visit About.
- **first-draw** (Starter Deck) — Visit Work or Personal (since both auto-open a deck).
- **full-hand** (Set Mastery) — Click every deck in one section (all 5 Work decks or all 5 Personal decks). Also auto-counts the default-active deck via `trackActiveDeck()` on section load.

## SEO

Per-page meta tags, OG/Twitter cards, `sitemap.xml`, `robots.txt`, JSON-LD on About. Domain is `www.raggedydoc.com`. Redirect shortcut pages for `/beamlab/`, `/parsed/`, `/misery/`, `/snaplayout/` mirror destination OG tags but are excluded from sitemap.

## Conventions

See `.claude/rules/conventions.md` for coding standards (loaded automatically when editing HTML/CSS/JS).

## Adding Games/Tools

1. Create `games/<name>/` or `tools/<name>/` with own HTML/CSS/JS (self-contained)
2. Add a card to the Play section and/or the Personal → Games & Tools deck
3. Add to `sitemap.xml`
4. Create a `CLAUDE.md` in the subdirectory with game/tool-specific docs
5. Extract testable logic into a `.module.js` file, add tests in `__tests__/`, update `jest.config.js` coverage list
