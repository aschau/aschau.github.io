# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website (GitHub Pages) for Andrew Chau, hosted at `aschau.github.io`. There is no build system, bundler, or test framework — it's plain HTML/CSS/JS served directly.

## Development

Open any `.html` file in a browser to preview. No build or install step is required.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html`, `contact.html` — all top-level
- **Project detail pages**: `projects/work/` and `projects/personal/` contain per-project HTML pages (e.g., `projects/work/nbaAR/nbaAR.html`)
- **Styling**: Bootstrap 4.3.1 via CDN + custom overrides in `css/stylesheet.css`. Uses the custom font "Xolonium" loaded from `fonts/`
- **JS**: jQuery 3.3.1 (slim, via CDN) + Bootstrap JS via CDN. `js/autoScroll.js` provides smooth scroll behavior. `projects/personal/snake.js` is a standalone Snake game
- **Navigation**: Shared Bootstrap navbar is copy-pasted into each HTML file (no templating). Edits to nav must be replicated across all pages
- **Images**: `img/` with subdirectories `work-projects/`, `personal-projects/`, `about-me/`. Project detail pages also reference images from `projects/work/` subdirectories
