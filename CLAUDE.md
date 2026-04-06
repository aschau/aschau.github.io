# CLAUDE.md

Static portfolio website (GitHub Pages) for Andrew Steven Chau at `www.raggedydoc.com` (repo: `aschau.github.io`). Plain HTML/CSS/JS, no build system. Always use "Andrew Steven Chau" (not "Andrew Chau") for SEO differentiation.

## Development

- Live site serves from `master`. Dev branch is `develop`.
- Open any `.html` file in browser to preview. Hard refresh (`Ctrl+Shift+R`) to bust cache.
- Games and tools are self-contained in `games/` and `tools/` — they don't use the portfolio's navbar/footer/CSS. Each has its own `CLAUDE.md` with detailed docs.
- **Testing**: `npm test` runs Jest (280 tests). Each game/tool extracts pure logic into a `.module.js` file (UMD-compatible, used by both tests and browser). Tests live in `__tests__/`. CI runs on push/PR via `.github/workflows/tests.yml`.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html`, `404.html`
- **Project details**: `projects/work/<name>/` and `projects/personal/<name>.html`
- **Shared components** (`js/components.js`): navbar, footer, loading screen, particles, gamification. `js/gamification.module.js` extracts testable logic from `js/gamification.js`.
- **Styling**: Bootstrap 5.3.8 CDN (jsdelivr) + `css/stylesheet.css`. No jQuery dependency. Dark glassmorphism theme. Design tokens in `:root`.
- **Responsive**: Mobile breakpoint at 1024px (covers all iPads in portrait). Tablet landscape (1025-1200px) has compressed timeline. Navbar `expand-lg` (collapses to hamburger under 992px).
- **Timeline**: Career timeline on `index.html`. Detail cards clamped within viewport via JS. Character sprite repositions on resize/rotation.
- **Character sprite**: LPC spritesheets (64x64 frames). Jacket/no-jacket variants. CC-BY-SA 3.0.
- **SEO**: Per-page meta tags, OG/Twitter cards, `sitemap.xml`, `robots.txt`, JSON-LD on aboutMe. Domain is `www.raggedydoc.com`. Redirect shortcut pages (`/beamlab/`, `/parsed/`, `/misery/`, `/snaplayout/`) mirror destination OG tags for link previews but are excluded from the sitemap (canonical points to the real URL).

## Conventions

See `.claude/rules/conventions.md` for coding standards (loaded automatically when editing HTML/CSS/JS).

## Adding Games/Tools

1. Create `games/<name>/` or `tools/<name>/` with own HTML/CSS/JS (self-contained)
2. Add to `navItems` dropdown in `js/components.js`
3. Add to `sitemap.xml`
4. Create a `CLAUDE.md` in the subdirectory with game/tool-specific docs
5. Extract testable logic into a `.module.js` file, add tests in `__tests__/`, update `jest.config.js` coverage list
