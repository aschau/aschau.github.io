# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required. The live site serves from the `master` branch. Development happens on `develop`. After pushing, a hard refresh (`Ctrl+Shift+R`) may be needed to bust browser cache.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html`, `404.html` — all top-level.
- **Project detail pages**: Two sets, both modernized with shared components, `page-body` class, and `stylesheet.css`:
  - `projects/work/` — per-project pages in subdirectories (e.g., `projects/work/nbaAR/nbaAR.html`). Reference `components.js` via `../../../js/components.js` and CSS via `../../../css/stylesheet.css`.
  - `projects/personal/` — flat directory of personal project pages (e.g., `projects/personal/spookyspoils.html`, `projects/personal/dateordie.html`). Reference `components.js` via `../../js/components.js` and CSS via `../../css/stylesheet.css`. Images use `../../img/personal-projects/` paths.
- **Shared components** (`js/components.js`): Dynamically injects the navbar and footer into all pages. Auto-detects the base path from its own `src` attribute so nav links work from any directory depth. Also handles: loading screen (once per session via `sessionStorage`), click burst particle effect, game-inspired floating particles, and loading `gamification.js`. Footer includes LPC sprite attribution. To update nav links or footer, edit this file only.
- **Gamification** (`js/gamification.js`): Achievement system with toast notifications, exploration progress bar, and page visit tracking. Achievements persist in `localStorage`. Locked achievements show hint text instead of "???". Loaded dynamically by `components.js`.
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`. Font Awesome 5.15.4 via CDN is loaded on `aboutMe.html` for social icons.
- **Design system**: Dark theme with glassmorphism — semi-transparent cards/navbar/footer/sidebar with `backdrop-filter: blur()`. Background is a dark navy-to-black CSS gradient. Game-inspired floating particles (card shapes, diamonds, AR grid dots, D-pad crosses) replace the old starfield — spawned by JS in `components.js` (90 particles). Cards have hover effects (lift + blue glow). Custom SVG reticle cursor site-wide with click burst particle effect. All custom classes are in `css/stylesheet.css`. Design tokens (colors, opacities, transitions, blur values, gradients, focus styles) are centralized as CSS custom properties in `:root`.
- **Character sprite**: Two LPC spritesheets — `img/character-spritesheet.png` (with jacket) and `img/character-spritesheet-no-jacket.png`. Both are 832x3456, 64x64 frames. On the timeline, the no-jacket sprite is used for early career entries (indices 0-3: UCI through Trigger) and the jacket sprite for later entries (indices 4-7: MobilityWare onward). The `.no-jacket` CSS class toggles the background-image. Also used on the 404 page (2x scaled, looks around confused). Licensed CC-BY-SA 3.0 / OGA-BY 3.0, attributed in footer. CSS paths to sprites must use `../img/` since the stylesheet is in `css/`. When using at 2x scale (128px), background-size and position offsets must both be doubled.
- **Home page**: Hero section with typing animation cycling through role titles, tagline, and an interactive career timeline with 8 nodes (UCI → Super Toy Box → Sega Atlus → Trigger → MobilityWare → Waxheart → Friend Castle → Blizzard). Each node has a brand color via `--node-color` CSS variable and company initials. Friend Castle and Waxheart are separate, independent projects (not related to each other). Each node expands on click to show an image slideshow and description. On desktop, Blizzard (last entry, index 7) auto-expands with character positioned there. On mobile, UCI (first entry, index 0) auto-expands instead since the timeline is vertical and starts at the top. Character walks to clicked nodes and goes idle (front-facing) on arrival. Clicking inside an expanded detail popup does not close it. Character positioning waits for `window.load` and recalculates after loading screen removal to avoid race conditions.
- **Loading screen**: Game-style full-screen overlay with progress bar and rotating tips (mix of personal facts and game dev humor). Shows once per browser session via `sessionStorage`. Implemented in `components.js`. Hidden entirely when `prefers-reduced-motion` is active.
- **404 page**: Custom 404 with 2x character sprite looking around confused, "404" heading, flavor text, and "Return to Base" button. GitHub Pages automatically serves `404.html`.
- **Responsive layout**: Work and personal project pages use a sidebar+tabs layout wrapped in `.container-fluid` > `.row`, stacking vertically on mobile (`col-12 col-md-4` / `col-12 col-md-8`). The body uses flexbox (`display: flex; flex-direction: column; min-height: 100vh`) with `.content-wrapper { flex: 1 }` to keep the footer at the bottom. Mobile breakpoint (`max-width: 767px`) adjusts: text sizing, card padding, skill layout (centered single column), container spacing, timeline (vertical centered with character using walk-up/walk-down instead of walk-left/walk-right), achievement button/panel/toasts moved to bottom-right, and gamification element z-indexes dropped below navbar.
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Carousel images use `object-fit: contain` with a 16:9 aspect ratio to letterbox without cropping.
- **Personal projects content**: The personal projects page has three tabs:
  - **Friend Castle** — intro card + shipped projects (Schedazzle with App Store/Google Play links and promo image, Box Dog with Steam widget embed) + contract work section (Gnome Hunt and Fairy Finder with embedded YouTube videos — AR games built for Niantic's Lightship SDK).
  - **Waxheart** — intro card with website link, followed by individual image cards for Jenkins pipeline, Discord bot, and QA test case sheet (no carousels — one card per image).
  - **The College Years** — card deck of 8 college projects, each with "View Details" linking to detail pages under `projects/personal/`.
- **SEO**: Each main page has a unique `<title>`, `<meta name="description">`, Open Graph tags, Twitter Card tags, and `<link rel="canonical">`. OG images point to `img/about-me/me.JPG`. The `aboutMe.html` page includes JSON-LD `Person` structured data. `sitemap.xml` and `robots.txt` are at the root. The 404 page has `<meta name="robots" content="noindex">`. All external links (`target="_blank"`) include `rel="noopener noreferrer"`.

## CSS Design Tokens

Colors, surfaces, transitions, and other recurring values are centralized as CSS custom properties in `:root`:

- **Colors**: `--color-primary` (#4a5aff), `--color-primary-light` (#8b9aff), `--color-primary-rgb` (100, 120, 255), `--color-text`, `--color-text-muted`, `--color-text-soft`, `--color-text-softer`, `--color-text-subtle`, `--color-bg-dark`, `--color-bg-mid`
- **Glass surfaces**: `--glass-bg`, `--glass-bg-hover`, `--glass-bg-active`, `--glass-bg-sidebar`, `--glass-bg-overlay`, `--glass-bg-panel`, `--glass-border`, `--glass-border-light`, `--glass-border-accent`, `--glass-border-accent-strong`, `--glass-blur` (12px), `--glass-blur-strong` (16px)
- **Transitions**: `--transition-fast` (0.2s), `--transition-normal` (0.3s), `--transition-slow` (0.5s)
- **Focus**: `--focus-ring`, `--focus-outline`
- **Gradients**: `--gradient-bg`, `--gradient-accent`

When adding new styles, use these tokens instead of hardcoding values.

## Z-Index Layer System

All z-index values are managed through CSS custom properties in `:root` to prevent chaos:

| Variable | Value | Purpose |
|---|---|---|
| `--z-particles` | 0 | Floating background particles |
| `--z-content` | 1 | General page content |
| `--z-timeline-node` | 2 | Timeline node circles |
| `--z-timeline-char` | 3 | Walking sprite character |
| `--z-timeline-detail` | 10 | Timeline detail popups |
| `--z-nav` | 1030 | Navbar (Bootstrap default) |
| `--z-progress` | 1031 | Exploration progress bar |
| `--z-toast` | 1040 | Achievement toast notifications |
| `--z-toggle` | 1041 | Achievement toggle button |
| `--z-panel` | 1041 | Achievement panel |
| `--z-burst` | 1050 | Click burst particles |
| `--z-loading` | 1060 | Loading screen overlay |

On mobile, gamification elements (`#exploration-progress`, `#achievement-toggle`, `#achievement-panel`) drop to `--z-nav` so the navbar dropdown stays above them.

## Key CSS classes (`css/stylesheet.css`)

- `.page-body` — flexbox column body with gradient background and custom reticle cursor
- `.hero-section` / `.hero-name` / `.hero-typing` / `.hero-tagline` — home page hero with typing animation
- `.timeline-container` / `.timeline` / `.timeline-entry` / `.timeline-node` / `.timeline-detail` — interactive career timeline with brand-colored nodes
- `.timeline-character` / `.timeline-character.idle` / `.timeline-character.no-jacket` — animated sprite on timeline (walks, then idles; no-jacket variant for early career)
- `.timeline-slideshow` / `.timeline-slideshow-img` / `.timeline-nav-btn` — image carousel in timeline detail popups
- `.game-particles` / `.game-particle` — floating game-themed background particles (card, diamond, grid-dot, cross shapes)
- `.sprite-404` — 2x scaled character sprite for 404 page
- `.click-burst` / `.click-burst-particle` — click particle effect
- `.img-center` — horizontally centers images
- `.hr-grey` / `.hr-white` — border color for `<hr>` elements
- `.jumbotron-transparent` — transparent background with white text
- `.link-white` / `.lead-white` — white text for links and lead paragraphs on dark backgrounds
- `.content-wrapper` — `flex: 1` to push footer to bottom
- `.sidebar-sticky` — sticky sidebar offset below fixed navbar (`top: 56px`)
- `.card-narrow` — constrains single cards to `max-width: 33.5rem`
- `.skill-badge` / `.skill-category` / `.skill-row` — skills grid with pill badges on aboutMe.html
- `.social-icon` / `.social-links` — circular icon links for social profiles
- `.carousel-item` — fixed 16:9 aspect ratio with flexbox centering for consistent image display
- `#loading-screen` — game-style loading overlay
- `#exploration-progress` / `.exploration-progress-fill` — progress bar below navbar
- `.achievement-toast` / `#achievement-toggle` / `#achievement-panel` — achievement notification system

## Gamification Features

- **Progress bar**: Thin gradient bar below navbar tracking pages visited (5 milestones: 4 main pages + a project detail page). Expands on hover to show "X% Explored" label.
- **Achievements** (8 total, persisted in `localStorage`):
  - Explorer — visited all 4 main pages
  - Curious — clicked an external link
  - Night Owl — visited after 10 PM (before 5 AM)
  - Speed Reader — scrolled to bottom within 10 seconds
  - Deep Diver — visited a project detail page (any page under `projects/`)
  - Timeline Historian — expanded all 8 timeline entries on the home page
  - Skill Scout — visited the About page
  - Social Butterfly — clicked a social profile link
- **Achievement hints**: Locked achievements display a contextual hint (e.g., "Come back when the moon is out...") instead of "???".
- **Trophy button**: Fixed top-right below navbar, shows badge count. Click to open achievement panel with clear progress option.
- **Click burst**: Particle burst effect when clicking empty space (skips interactive elements).
- **Game particles**: 90 floating shapes (cards, diamonds, AR dots, D-pad crosses) replacing the old CSS starfield.

## Accessibility

- **`prefers-reduced-motion`**: When the user's OS has reduced motion enabled, all animations and transitions are effectively disabled, floating particles are hidden, and the loading screen is skipped entirely.
- **Focus states**: Interactive elements (`.social-icon`, `.link-white`, `.timeline-detail a`, `.site-footer a`, `#achievement-toggle`, `#achievement-clear`, `.timeline-nav-btn`, `.skill-badge`) have visible focus outlines for keyboard navigation.

## Sprite System

- **Spritesheets**: `img/character-spritesheet.png` (jacket) and `img/character-spritesheet-no-jacket.png` (no jacket) — both LPC format, 832x3456px, 64x64 frames, 13 columns
- **Jacket logic**: Timeline entries 0-3 (UCI, Super Toy Box, Sega Atlus, Trigger) use no-jacket; entries 4-7 (MobilityWare, Waxheart, Friend Castle, Blizzard) use jacket. Toggled via `.no-jacket` CSS class in the `updateJacket()` JS function.
- **Key row offsets** (at 1x / 64px):
  - Walk up: y=-512px
  - Walk left: y=-576px
  - Walk down (idle/front-facing): y=-640px
  - Walk right: y=-704px
- **Mobile vs desktop**: JS detects `window.innerWidth <= 767` to switch between horizontal (left/right) and vertical (top/up/down) movement
- **At 2x / 128px** (404 page): double all offsets and use `background-size: 1664px 6912px`
- **Walk animation**: `@keyframes spriteWalk` cycles 9 frames (background-position-x: 0 to -576px)
- **Idle**: `.timeline-character.idle` sets `animation: none` and front-facing frame. JS must clear inline `backgroundPositionY` when going idle.
- **Attribution**: CC-BY-SA 3.0 / OGA-BY 3.0, credited in footer via `components.js`

## SEO

- **Meta tags**: Each main page has a unique `<title>`, `<meta name="description">`, Open Graph tags (`og:title`, `og:description`, `og:url`, `og:type`, `og:image`), and Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
- **Canonical URLs**: `<link rel="canonical">` on each main page pointing to `https://aschau.github.io/...`.
- **Structured data**: `aboutMe.html` includes JSON-LD `Person` schema (name, jobTitle, worksFor, alumniOf, knowsAbout, sameAs).
- **Sitemap & robots**: `sitemap.xml` lists all indexable pages with priority weights. `robots.txt` allows all crawlers and points to sitemap.
- **404**: Has `<meta name="robots" content="noindex">` to prevent indexing.
- **External links**: All `target="_blank"` links include `rel="noopener noreferrer"` for security.
- **OG image**: All pages use `img/about-me/me.JPG` as the social share image.

## Conventions

- No inline `style=` attributes on the main pages — use CSS classes in `stylesheet.css` instead. Exception: `--node-color` CSS variables on timeline entries.
- Use CSS design tokens from `:root` instead of hardcoding color, opacity, transition, blur, or gradient values.
- The Bootstrap CSS CDN link and `css/stylesheet.css` link must both appear in every page's `<head>`.
- Bootstrap `.row` elements must be inside a `.container` or `.container-fluid` — never directly in `<body>` (causes horizontal scroll from negative margins).
- The `#navbar-placeholder` is excluded from the `.page-body > *` z-index rule so the fixed navbar stays above scrolling content. Gamification elements, click bursts, loading screen, and game particles are also excluded.
- All z-index values must use the CSS custom properties defined in `:root` — never hardcode z-index numbers.
- YouTube embeds require `referrerpolicy="strict-origin-when-cross-origin"` to avoid Error 153 on GitHub Pages.
- Steam store widgets can be embedded via `<iframe src="https://store.steampowered.com/widget/{APP_ID}/">` — these work on GitHub Pages.
- Apple App Store and Google Play do not offer embeddable widgets — use button links instead.
- For portrait/non-standard images, use `img-fluid rounded img-center` with a `max-height` constraint rather than forcing a 16:9 aspect ratio container.
- Prefer individual image cards over carousels when images need to be examined closely (e.g., screenshots of tools, dashboards, spreadsheets).
- All external links with `target="_blank"` must include `rel="noopener noreferrer"`.
- Use past tense for previous roles (MobilityWare, Trigger, Sega, Super Toy Box) and present tense for current roles (Blizzard, Friend Castle, Waxheart).
- Proper capitalization: "Friend Castle" (two words), "Waxheart" (one word, lowercase h), "macOS" (Apple style), "Unity" (capitalized), "Vegas Golden Knights" (official NHL name).
- Nav links use relative paths calculated from the `components.js` script src, not absolute paths (absolute paths break on `file://`).
- CSS paths to images use `../img/` since the stylesheet is in `css/`.
- Personal project detail pages use `../../img/personal-projects/` for image paths (two levels up from `projects/personal/`).
- Work project detail pages use relative paths from their subdirectory (e.g., `../../../img/work-projects/` from `projects/work/nbaAR/`).
- Each page's `<body>` should use `class="page-body"` and include the navbar placeholder, components script, footer placeholder, and `loadCommonScripts()` call in this order:
  ```html
  <body class="page-body">
    <div id="navbar-placeholder"></div>
    <script src="js/components.js"></script>
    <!-- page content -->
    <div id="footer-placeholder"></div>
    <script>loadCommonScripts();</script>
  </body>
  ```
- For project detail pages at deeper paths, adjust the script src path accordingly:
  ```html
  <!-- projects/personal/ (2 levels deep) -->
  <script src="../../js/components.js"></script>
  <!-- projects/work/nbaAR/ (3 levels deep) -->
  <script src="../../../js/components.js"></script>
  ```
