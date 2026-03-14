# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html` — all top-level. `contact.html` is a legacy page with a different layout (not Bootstrap).
- **Project detail pages**: `projects/work/` and `projects/personal/` contain per-project HTML pages (e.g., `projects/work/nbaAR/nbaAR.html`). These still use hardcoded navbars and haven't been modernized yet.
- **Shared components** (`js/components.js`): Dynamically injects the navbar and footer into all main pages. Auto-detects the current page for the active nav state. Also loads jQuery/Popper/Bootstrap JS via `loadCommonScripts()`. To update nav links or footer, edit this file only.
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`.
- **Design system**: Dark theme with glassmorphism — semi-transparent cards/navbar/footer with `backdrop-filter: blur()`. Background is a dark navy-to-black CSS gradient with animated CSS starfield particles (no JS). All custom classes are in `css/stylesheet.css` (`.page-body`, `.img-center`, `.hr-grey`, `.jumbotron-transparent`, `.link-white`, etc.).
- **Responsive layout**: Work and personal project pages use a sidebar+tabs layout that stacks vertically on mobile (`col-12 col-md-4` / `col-12 col-md-8`).
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Project detail pages also reference images from `projects/work/` subdirectories.

## Conventions

- No inline `style=` attributes on the main pages — use CSS classes in `stylesheet.css` instead.
- The Bootstrap CSS CDN link and `css/stylesheet.css` link must both appear in every page's `<head>`.
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
