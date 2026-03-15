# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required. The live site serves from the `master` branch. Development happens on `develop`. After pushing, a hard refresh (`Ctrl+Shift+R`) may be needed to bust browser cache.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html` — all top-level. `contact.html` is a legacy page with a different layout (not Bootstrap).
- **Project detail pages**: `projects/work/` and `projects/personal/` contain per-project HTML pages (e.g., `projects/work/nbaAR/nbaAR.html`). These still use hardcoded navbars and haven't been modernized yet.
- **Shared components** (`js/components.js`): Dynamically injects the navbar and footer into all main pages. Auto-detects the current page for the active nav state. Also loads jQuery/Popper/Bootstrap JS via `loadCommonScripts()`. Footer injection happens inside `loadCommonScripts()` (not at script load time) since the footer placeholder doesn't exist yet when the script first runs at the top of `<body>`. To update nav links or footer, edit this file only.
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`. Font Awesome 5.15.4 via CDN is loaded on `aboutMe.html` for social icons.
- **Design system**: Dark theme with glassmorphism — semi-transparent cards/navbar/footer/sidebar with `backdrop-filter: blur()`. Background is a dark navy-to-black CSS gradient with animated CSS starfield particles (pure CSS, no JS). Cards have hover effects (lift + blue glow). All custom classes are in `css/stylesheet.css`.
- **Home page hero**: Typing animation on `index.html` cycles through role titles via inline JS. Uses `.hero-section`, `.hero-name`, `.hero-typing`, `.hero-cursor`, `.hero-tagline` classes.
- **Responsive layout**: Work and personal project pages use a sidebar+tabs layout wrapped in `.container-fluid` > `.row`, stacking vertically on mobile (`col-12 col-md-4` / `col-12 col-md-8`). The body uses flexbox (`display: flex; flex-direction: column; min-height: 100vh`) with `.content-wrapper { flex: 1 }` to keep the footer at the bottom. Mobile breakpoint (`max-width: 767px`) adjusts text sizing, card padding, skill layout, and container spacing.
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Project detail pages also reference images from `projects/work/` subdirectories. Carousel images use `object-fit: contain` with a 16:9 aspect ratio to letterbox without cropping.

## Key CSS classes (`css/stylesheet.css`)

- `.page-body` — flexbox column body with gradient background and starfield particles
- `.hero-section` / `.hero-name` / `.hero-typing` / `.hero-tagline` — home page hero with typing animation
- `.img-center` — horizontally centers images (replaces inline margin auto)
- `.hr-grey` / `.hr-white` — border color for `<hr>` elements
- `.jumbotron-transparent` — transparent background with white text
- `.link-white` / `.lead-white` — white text for links and lead paragraphs on dark backgrounds
- `.content-wrapper` — `flex: 1` to push footer to bottom
- `.sidebar-sticky` — sticky sidebar offset below fixed navbar (`top: 56px`)
- `.card-narrow` — constrains single cards to `max-width: 33.5rem`
- `.skill-badge` / `.skill-category` / `.skill-row` — skills grid with pill badges on aboutMe.html
- `.social-icon` / `.social-links` — circular icon links for social profiles
- `.carousel-item` — fixed 16:9 aspect ratio with flexbox centering for consistent image display

## Conventions

- No inline `style=` attributes on the main pages — use CSS classes in `stylesheet.css` instead.
- The Bootstrap CSS CDN link and `css/stylesheet.css` link must both appear in every page's `<head>`.
- Bootstrap `.row` elements must be inside a `.container` or `.container-fluid` — never directly in `<body>` (causes horizontal scroll from negative margins).
- The `#navbar-placeholder` is excluded from the `.page-body > *` z-index rule so the fixed navbar stays above scrolling content.
- Use past tense for previous roles (MobilityWare, Trigger, Sega, Super Toy Box) and present tense for current roles (Blizzard, Friend Castle, Waxheart).
- Proper capitalization: "Friend Castle" (two words), "Waxheart" (one word, lowercase h), "macOS" (Apple style), "Unity" (capitalized), "Vegas Golden Knights" (official NHL name).
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
