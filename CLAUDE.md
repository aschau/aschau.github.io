# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required. The live site serves from the `master` branch. Development happens on `develop`. After pushing, a hard refresh (`Ctrl+Shift+R`) may be needed to bust browser cache.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html` — all top-level. `contact.html` is a legacy page with a different layout (not Bootstrap).
- **Project detail pages**: `projects/work/` contain per-project HTML pages (e.g., `projects/work/nbaAR/nbaAR.html`). These are now modernized with shared components, `page-body` class, and `stylesheet.css`. They reference `components.js` via relative paths (e.g., `../../../js/components.js`).
- **Shared components** (`js/components.js`): Dynamically injects the navbar and footer into all pages. Auto-detects the base path from its own `src` attribute so nav links work from any directory depth. Also handles: loading screen (once per session via `sessionStorage`), click burst particle effect, and loading `gamification.js`. Footer injection happens inside `loadCommonScripts()`. To update nav links or footer, edit this file only.
- **Gamification** (`js/gamification.js`): Achievement system with toast notifications, exploration progress bar, and page visit tracking. Achievements persist in `localStorage`. Loaded dynamically by `components.js`.
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`. Font Awesome 5.15.4 via CDN is loaded on `aboutMe.html` for social icons.
- **Design system**: Dark theme with glassmorphism — semi-transparent cards/navbar/footer/sidebar with `backdrop-filter: blur()`. Background is a dark navy-to-black CSS gradient with animated CSS starfield particles (pure CSS, no JS). Cards have hover effects (lift + blue glow). Custom SVG reticle cursor site-wide. All custom classes are in `css/stylesheet.css`.
- **Home page**: Hero section with typing animation cycling through role titles, tagline, and an interactive career timeline with 8 nodes (UCI → Super Toy Box → Sega Atlus → Trigger → MobilityWare → Blizzard → Friend Castle → Waxheart). Friend Castle and Waxheart are separate, independent projects (not related to each other). Each node expands on click to show an image slideshow and description. Blizzard auto-expands on load. Clicking inside an expanded detail popup does not close it.
- **Loading screen**: Game-style full-screen overlay with progress bar and rotating tips (mix of personal facts and game dev humor). Shows once per browser session via `sessionStorage`. Implemented in `components.js`.
- **Responsive layout**: Work and personal project pages use a sidebar+tabs layout wrapped in `.container-fluid` > `.row`, stacking vertically on mobile (`col-12 col-md-4` / `col-12 col-md-8`). The body uses flexbox (`display: flex; flex-direction: column; min-height: 100vh`) with `.content-wrapper { flex: 1 }` to keep the footer at the bottom. Mobile breakpoint (`max-width: 767px`) adjusts text sizing, card padding, skill layout, container spacing, and drops gamification element z-indexes below navbar.
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Carousel images use `object-fit: contain` with a 16:9 aspect ratio to letterbox without cropping.

## Key CSS classes (`css/stylesheet.css`)

- `.page-body` — flexbox column body with gradient background, starfield particles, and custom reticle cursor
- `.hero-section` / `.hero-name` / `.hero-typing` / `.hero-tagline` — home page hero with typing animation
- `.timeline-container` / `.timeline` / `.timeline-entry` / `.timeline-node` / `.timeline-detail` — interactive career timeline on home page
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
- `.click-burst` / `.click-burst-particle` — click particle effect
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
- **Trophy button**: Fixed top-right, shows badge count. Click to open achievement panel with clear progress option.
- **Click burst**: Particle burst effect when clicking empty space (skips interactive elements).

## Conventions

- No inline `style=` attributes on the main pages — use CSS classes in `stylesheet.css` instead.
- The Bootstrap CSS CDN link and `css/stylesheet.css` link must both appear in every page's `<head>`.
- Bootstrap `.row` elements must be inside a `.container` or `.container-fluid` — never directly in `<body>` (causes horizontal scroll from negative margins).
- The `#navbar-placeholder` is excluded from the `.page-body > *` z-index rule so the fixed navbar stays above scrolling content. Gamification elements (progress bar, toasts, achievement panel, click bursts, loading screen) are also excluded from this rule.
- YouTube embeds require `referrerpolicy="strict-origin-when-cross-origin"` to avoid Error 153 on GitHub Pages.
- Use past tense for previous roles (MobilityWare, Trigger, Sega, Super Toy Box) and present tense for current roles (Blizzard, Friend Castle, Waxheart).
- Proper capitalization: "Friend Castle" (two words), "Waxheart" (one word, lowercase h), "macOS" (Apple style), "Unity" (capitalized), "Vegas Golden Knights" (official NHL name).
- Nav links use relative paths calculated from the `components.js` script src, not absolute paths (absolute paths break on `file://`).
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
