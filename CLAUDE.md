# CLAUDE.md

Static portfolio website (GitHub Pages) for Andrew Steven Chau at `raggedydoc.com` (repo: `aschau.github.io`). Plain HTML/CSS/JS, no build system. Always use "Andrew Steven Chau" (not "Andrew Chau") for SEO differentiation.

## Development

- Live site serves from `master`. Dev branch is `develop`.
- Open any `.html` file in browser to preview. Hard refresh (`Ctrl+Shift+R`) to bust cache.
- Games and tools are self-contained in `games/` and `tools/` — they don't use the portfolio's navbar/footer/CSS. Each has its own `CLAUDE.md` with detailed docs.

## Architecture

- **Pages**: `index.html` (home), `aboutMe.html`, `workprojects.html`, `personalprojects.html`, `404.html`
- **Project details**: `projects/work/<name>/` and `projects/personal/<name>.html`
- **Shared components** (`js/components.js`): navbar, footer, loading screen, particles, gamification
- **Styling**: Bootstrap 4.3.1 CDN + `css/stylesheet.css`. Dark glassmorphism theme. Design tokens in `:root`.
- **Responsive**: Mobile breakpoint at 1024px (covers all iPads in portrait). Tablet landscape (1025-1200px) has compressed timeline. Navbar `expand-lg` (collapses to hamburger under 992px).
- **Timeline**: Career timeline on `index.html`. Detail cards clamped within viewport via JS. Character sprite repositions on resize/rotation.
- **Character sprite**: LPC spritesheets (64x64 frames). Jacket/no-jacket variants. CC-BY-SA 3.0.
- **SEO**: Per-page meta tags, OG/Twitter cards, `sitemap.xml`, `robots.txt`, JSON-LD on aboutMe. Domain is `raggedydoc.com`.

## Conventions

See `.claude/rules/conventions.md` for coding standards (loaded automatically when editing HTML/CSS/JS).

## Adding Games/Tools

1. Create `games/<name>/` or `tools/<name>/` with own HTML/CSS/JS (self-contained)
2. Add to `navItems` dropdown in `js/components.js`
3. Add to `sitemap.xml`
4. Create a `CLAUDE.md` in the subdirectory with game/tool-specific docs
