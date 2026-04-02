---
paths:
  - "**/*.html"
  - "**/*.css"
  - "**/*.js"
---

# Portfolio Conventions

- No inline `style=` attributes — use CSS classes in `stylesheet.css`. Exception: `--node-color` on timeline entries.
- Use CSS design tokens from `:root` instead of hardcoding colors, opacity, transitions, blur, gradients.
- Z-index values must use CSS custom properties (`--z-particles` through `--z-loading`). Never hardcode.
- All `target="_blank"` links must include `rel="noopener noreferrer"`.
- Bootstrap `.row` must be inside `.container` or `.container-fluid`.
- Nav links use relative paths from `components.js` src, not absolute paths (absolute breaks `file://`).
- Past tense for previous roles, present tense for current (Blizzard, Friend Castle, Waxheart).
- "Friend Castle" (two words), "Waxheart" (one word, lowercase h), "macOS", "Unity".
- Always use "Andrew Steven Chau" (not "Andrew Chau") for SEO differentiation.
- Domain is `www.raggedydoc.com` — use in all canonical/OG/meta tags. The GitHub raw URL (`raw.githubusercontent.com/aschau/aschau.github.io/...`) is the repo name, not the domain — don't replace it.
- Mobile breakpoint: 1024px. Navbar collapses at 992px (`expand-lg`).
- Always use `min-height: 100dvh` after `min-height: 100vh` as a progressive enhancement. Plain `100vh` causes a gap on mobile when the browser address bar hides (it uses the largest viewport height, not the dynamic one).
