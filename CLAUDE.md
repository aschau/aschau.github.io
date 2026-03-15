# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required. The live site serves from the `master` branch. Development happens on `develop`. After pushing, a hard refresh (`Ctrl+Shift+R`) may be needed to bust browser cache.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html`, `404.html` — all top-level. `contact.html` is a legacy page with a different layout (not Bootstrap).
- **Project detail pages**: `projects/work/` contain per-project HTML pages (e.g., `projects/work/nbaAR/nbaAR.html`). These are modernized with shared components, `page-body` class, and `stylesheet.css`. They reference `components.js` via relative paths (e.g., `../../../js/components.js`).
- **Shared components** (`js/components.js`): Dynamically injects the navbar and footer into all pages. Auto-detects the base path from its own `src` attribute so nav links work from any directory depth. Also handles: loading screen (once per session via `sessionStorage`), click burst particle effect, game-inspired floating particles, and loading `gamification.js`. Footer includes LPC sprite attribution. To update nav links or footer, edit this file only.
- **Gamification** (`js/gamification.js`): Achievement system with toast notifications, exploration progress bar, and page visit tracking. Achievements persist in `localStorage`. Loaded dynamically by `components.js`.
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`. Font Awesome 5.15.4 via CDN is loaded on `aboutMe.html` for social icons.
- **Design system**: Dark theme with glassmorphism — semi-transparent cards/navbar/footer/sidebar with `backdrop-filter: blur()`. Background is a dark navy-to-black CSS gradient. Game-inspired floating particles (card shapes, diamonds, AR grid dots, D-pad crosses) replace the old starfield — spawned by JS in `components.js` (90 particles). Cards have hover effects (lift + blue glow). Custom SVG reticle cursor site-wide with click burst particle effect. All custom classes are in `css/stylesheet.css`.
- **Character sprite**: LPC spritesheet at `img/character-spritesheet.png` (832x3456, 64x64 frames). Used on the timeline (walks between nodes, idles facing forward), and 404 page (2x scaled, looks around confused). Licensed CC-BY-SA 3.0 / OGA-BY 3.0, attributed in footer. CSS paths to the sprite must use `../img/` since the stylesheet is in `css/`. When using at 2x scale (128px), background-size and position offsets must both be doubled.
- **Home page**: Hero section with typing animation cycling through role titles, tagline, and an interactive career timeline with 8 nodes (UCI → Super Toy Box → Sega Atlus → Trigger → MobilityWare → Waxheart → Friend Castle → Blizzard). Each node has a brand color via `--node-color` CSS variable and company initials. Friend Castle and Waxheart are separate, independent projects (not related to each other). Each node expands on click to show an image slideshow and description. On desktop, Blizzard (last entry, index 7) auto-expands with character positioned there. On mobile, UCI (first entry, index 0) auto-expands instead since the timeline is vertical and starts at the top. Character walks to clicked nodes and goes idle (front-facing) on arrival. Clicking inside an expanded detail popup does not close it.
- **Loading screen**: Game-style full-screen overlay with progress bar and rotating tips (mix of personal facts and game dev humor). Shows once per browser session via `sessionStorage`. Implemented in `components.js`.
- **404 page**: Custom 404 with 2x character sprite looking around confused, "404" heading, flavor text, and "Return to Base" button. GitHub Pages automatically serves `404.html`.
- **Responsive layout**: Work and personal project pages use a sidebar+tabs layout wrapped in `.container-fluid` > `.row`, stacking vertically on mobile (`col-12 col-md-4` / `col-12 col-md-8`). The body uses flexbox (`display: flex; flex-direction: column; min-height: 100vh`) with `.content-wrapper { flex: 1 }` to keep the footer at the bottom. Mobile breakpoint (`max-width: 767px`) adjusts: text sizing, card padding, skill layout (centered single column), container spacing, timeline (vertical centered with character using walk-up/walk-down instead of walk-left/walk-right), achievement button/panel/toasts moved to bottom-right, and gamification element z-indexes dropped below navbar.
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Carousel images use `object-fit: contain` with a 16:9 aspect ratio to letterbox without cropping.

## Key CSS classes (`css/stylesheet.css`)

- `.page-body` — flexbox column body with gradient background and custom reticle cursor
- `.hero-section` / `.hero-name` / `.hero-typing` / `.hero-tagline` — home page hero with typing animation
- `.timeline-container` / `.timeline` / `.timeline-entry` / `.timeline-node` / `.timeline-detail` — interactive career timeline with brand-colored nodes
- `.timeline-character` / `.timeline-character.idle` — animated sprite on timeline (walks, then idles)
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
- **Achievements** (5 total, persisted in `localStorage`):
  - Explorer — visited all 4 main pages
  - Curious — clicked an external link
  - Night Owl — visited after 10 PM
  - Speed Reader — scrolled to bottom within 5 seconds
  - Deep Diver — visited a project detail page
- **Trophy button**: Fixed top-right below navbar, shows badge count. Click to open achievement panel with clear progress option.
- **Click burst**: Particle burst effect when clicking empty space (skips interactive elements).
- **Game particles**: 90 floating shapes (cards, diamonds, AR dots, D-pad crosses) replacing the old CSS starfield.

## Sprite System

- **Spritesheet**: `img/character-spritesheet.png` — LPC format, 832x3456px, 64x64 frames, 13 columns
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

## Conventions

- No inline `style=` attributes on the main pages — use CSS classes in `stylesheet.css` instead. Exception: `--node-color` CSS variables on timeline entries.
- The Bootstrap CSS CDN link and `css/stylesheet.css` link must both appear in every page's `<head>`.
- Bootstrap `.row` elements must be inside a `.container` or `.container-fluid` — never directly in `<body>` (causes horizontal scroll from negative margins).
- The `#navbar-placeholder` is excluded from the `.page-body > *` z-index rule so the fixed navbar stays above scrolling content. Gamification elements, click bursts, loading screen, and game particles are also excluded.
- YouTube embeds require `referrerpolicy="strict-origin-when-cross-origin"` to avoid Error 153 on GitHub Pages.
- Use past tense for previous roles (MobilityWare, Trigger, Sega, Super Toy Box) and present tense for current roles (Blizzard, Friend Castle, Waxheart).
- Proper capitalization: "Friend Castle" (two words), "Waxheart" (one word, lowercase h), "macOS" (Apple style), "Unity" (capitalized), "Vegas Golden Knights" (official NHL name).
- Nav links use relative paths calculated from the `components.js` script src, not absolute paths (absolute paths break on `file://`).
- CSS paths to images use `../img/` since the stylesheet is in `css/`.
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
  <script src="../../../js/components.js"></script>
  ```
