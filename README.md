# raggedydoc.com

Personal portfolio and development playground for Andrew Steven Chau, hosted on GitHub Pages at [www.raggedydoc.com](https://www.raggedydoc.com).

## Overview

What started as a hand-built college portfolio has evolved into a card-game-themed arcade showcase and a playground for prototyping new ideas. Plain HTML / CSS / vanilla JavaScript — no build system, no frameworks.

The site is framed as an **arcade cabinet**: a CRT bezel wraps a content panel, a pixel character walks between 5 cabinets at the bottom, and each section is themed after a different card-game mechanic.

### Sections

- **Home** — Landing card with name, current role, and short pitch
- **About** — MTG commander-board layout: a central "commander" card for me, a battlefield of company cards (career history), an emblem card for socials, and a row of skill "land" cards
- **Work Projects** — Five company deck-boxes at the bottom of the screen. Play a deck to reveal its cards.
- **Personal Projects** — Same deck pattern: Friend Castle, Waxheart, Games & Tools, Website (era-by-era screenshots), College
- **Play** — Carousel of games and tools

### Games

- **Beamlab** — Laser deflection puzzle
- **Parsed** — Daily code puzzle
- **Examined** — Philosophy alignment quiz

### Tools

- **Misery Index** — Real-time Claude AI outage and sentiment tracker
- **SnapLayout** — Room layout planner

## Tech Stack

- HTML5 / CSS3 / vanilla JavaScript
- Bootstrap 5.3 (CDN) for detail pages; arcade shell is pure CSS
- LPC character spritesheets (CC BY-SA 3.0)
- GitHub Pages hosting
- Jest for testing

## Development

Open `index.html` in a browser to preview, or serve locally:

```bash
npx http-server -p 8080 -c-1
```

Hard-refresh (`Ctrl+Shift+R`) to bust the cache.

```bash
# Run tests (285 tests)
npm test

# Verbose output
npm run test:verbose

# With coverage
npm run test:coverage
```

## Project Structure

```
├── index.html                # Arcade shell (CRT bezel + cabinets + content panel)
├── about/, work/, personal/  # SEO redirect pages → arcade routes
├── play/                     #   (each is a thin HTML page)
├── privacy.html              # Standalone privacy policy (detail-page style)
├── sections/
│   ├── home.html             # Landing section
│   ├── about.html            # MTG commander board
│   ├── work.html             # Work decks + carousel
│   ├── personal.html         # Personal decks + carousel
│   └── play.html             # Games & tools carousel
├── css/
│   ├── arcade.css            # Arcade shell + section styles
│   ├── detail.css            # Standalone detail/privacy pages
│   └── achievements.css      # Shared achievement UI (toasts, panel, badge)
├── js/
│   ├── arcade.js             # Arcade shell: navigation, sprite, sections
│   ├── components.js         # Legacy shared nav/footer (unused on arcade)
│   ├── gamification.js       # Achievement tracking + UI
│   └── gamification.module.js # Testable pure logic
├── games/                    # Beamlab, Parsed, Examined (each self-contained)
├── tools/                    # Misery Index, SnapLayout
├── projects/                 # Project detail pages (linked from decks)
│   ├── work/<name>/<name>.html
│   └── personal/<name>.html
├── img/                      # Assets including character-spritesheet.png
├── __tests__/                # Jest test suites
└── sitemap.xml
```

## Achievements

11 achievements track exploration and interaction. Progress is local-storage only — no server tracking. See `js/gamification.module.js` for the canonical list.

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — see [LICENSE](LICENSE) for details.

Character sprites use LPC spritesheets under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
