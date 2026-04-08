# raggedydoc.com

Personal portfolio and development playground for Andrew Steven Chau, hosted on GitHub Pages at [www.raggedydoc.com](https://www.raggedydoc.com).

## Overview

What started as a hand-built portfolio during my college years has evolved over time into both a professional showcase and a development playground. The site now serves as a space for prototyping ideas, exploring new concepts, and experimenting — enhanced by AI-assisted development.

Static site built with plain HTML, CSS, and JavaScript — no build system or frameworks. Features a dark glassmorphism theme, animated career timeline, and character sprite navigation.

### Pages

- **Home** — Career timeline with interactive detail cards and animated sprite
- **About Me** — Background and contact info
- **Work Projects** — Professional project showcase
- **Personal Projects** — Side projects and experiments

### Games

- **Beamlab** — Laser deflection puzzle game
- **Parsed** — Code-themed puzzle game
- **Examined** — Philosophy exploration game

### Tools

- **Misery Index** — Real-time Claude AI outage and sentiment tracker
- **SnapLayout** — Layout utility

## Tech Stack

- HTML5 / CSS3 / vanilla JavaScript
- Bootstrap 5.3 (CDN)
- GitHub Pages for hosting
- Jest for testing

## Development

Open any `.html` file in a browser to preview. No build step needed.

```bash
# Run tests (280+ tests)
npm test

# Verbose output
npm run test:verbose

# With coverage
npm run test:coverage
```

## Project Structure

```
├── index.html              # Home / career timeline
├── aboutMe.html            # About page
├── workprojects.html       # Work projects listing
├── personalprojects.html   # Personal projects listing
├── css/stylesheet.css      # Global styles + design tokens
├── js/
│   ├── components.js       # Shared navbar, footer, particles
│   ├── gamification.js     # Site gamification system
│   └── gamification.module.js
├── games/
│   ├── beamlab/            # Laser deflection puzzle
│   ├── parsed/             # Code puzzle game
│   └── philosophy/         # Philosophy exploration
├── tools/
│   ├── misery-index/       # Claude AI outage tracker
│   └── snaplayout/         # Layout utility
├── projects/               # Project detail pages
├── __tests__/              # Jest test suites
└── sitemap.xml
```

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — see [LICENSE](LICENSE) for details.

Character sprites use LPC spritesheets under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
