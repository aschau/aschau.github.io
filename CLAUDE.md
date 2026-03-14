# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html` — all top-level. `contact.html` is a legacy page with a different layout (not Bootstrap).
- **Project detail pages**: `projects/work/` and `projects/personal/` contain per-project HTML pages (e.g., `projects/work/nbaAR/nbaAR.html`). These still use hardcoded navbars and haven't been modernized yet.
- **Shared components** (`js/components.js`): Dynamically injects the navbar and footer into all main pages. Auto-detects the current page for the active nav state. Also loads jQuery/Popper/Bootstrap JS via `loadCommonScripts()`. Footer injection happens inside `loadCommonScripts()` (not at script load time) since the footer placeholder doesn't exist yet when the script first runs at the top of `<body>`. To update nav links or footer, edit this file only.
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`.
- **Design system**: Dark theme with glassmorphism — semi-transparent cards/navbar/footer/sidebar with `backdrop-filter: blur()`. Background is a dark navy-to-black CSS gradient with animated CSS starfield particles (pure CSS, no JS). All custom classes are in `css/stylesheet.css`.
- **Responsive layout**: Work and personal project pages use a sidebar+tabs layout wrapped in `.container-fluid` > `.row`, stacking vertically on mobile (`col-12 col-md-4` / `col-12 col-md-8`). The body uses flexbox (`display: flex; flex-direction: column; min-height: 100vh`) with `.content-wrapper { flex: 1 }` to keep the footer at the bottom.
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Project detail pages also reference images from `projects/work/` subdirectories.

## Key CSS classes (`css/stylesheet.css`)

- `.page-body` — flexbox column body with gradient background and starfield particles
- `.img-center` — horizontally centers images (replaces inline margin auto)
- `.hr-grey` / `.hr-white` — border color for `<hr>` elements
- `.jumbotron-transparent` — transparent background with white text
- `.link-white` / `.lead-white` — white text for links and lead paragraphs on dark backgrounds
- `.content-wrapper` — `flex: 1` to push footer to bottom
- `.sidebar-sticky` — sticky sidebar offset below fixed navbar (`top: 56px`)
- `.card-narrow` — constrains single cards to `max-width: 33.5rem`

## Conventions

- No inline `style=` attributes on the main pages — use CSS classes in `stylesheet.css` instead.
- The Bootstrap CSS CDN link and `css/stylesheet.css` link must both appear in every page's `<head>`.
- Bootstrap `.row` elements must be inside a `.container` or `.container-fluid` — never directly in `<body>` (causes horizontal scroll from negative margins).
- The `#navbar-placeholder` is excluded from the `.page-body > *` z-index rule so the fixed navbar stays above scrolling content.
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
