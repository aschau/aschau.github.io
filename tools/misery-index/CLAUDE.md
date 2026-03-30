# Claude Developer Misery Index

Real-time dashboard tracking Claude AI outage and degradation sentiment by combining official status data, incident history, Reddit complaint volume, and megathread activity.

## Architecture

- **Frontend**: `index.html` + `style.css` + `app.js` — self-contained, no build system, light/dark mode
- **Data pipeline**: GitHub Action (`.github/workflows/fetch-misery-data.yml`) runs every 15 minutes, executes `.github/scripts/fetch-misery-data.js` which fetches all sources, calculates misery index, and force-pushes to `misery-data` orphan branch
- **Live fallback**: Frontend fetches from `misery-data` branch, falls back to local `data/current.json`, and also fetches `status.claude.com` live for real-time status/incidents

## Data Sources

1. **Anthropic Status Page** (`status.claude.com/api/v2/summary.json`) — official component status
2. **Anthropic Incidents** (`status.claude.com/api/v2/incidents.json`) — last 3 days of incidents with updates
3. **Reddit Public JSON** (no auth) — searches for Claude outage/degradation/limit posts across r/ClaudeAI, r/anthropic, and global search. Includes megathread detection for complaint aggregation posts.

## Misery Index Calculation (0-10)

- Status page indicator: none=0, minor=+2, major=+4, critical=+6
- Degraded components: +0.5 each (max +2)
- Reddit posts (24h): 1=+0.5, 2-4=+1, 5-9=+2, 10-19=+3, 20+=+4
- Comment volume (incl. megathreads): 5-19=+0.5, 20-49=+1, 50-99=+1.5, 100+=+2

## Misery Levels

| Range | Level | Visual |
|-------|-------|--------|
| 0-1 | ALL CLEAR | Blue, calm |
| 1-3 | MINOR GRUMBLING | Yellow, slight pulse |
| 3-5 | GROWING UNREST | Orange, moderate pulse |
| 5-7 | FULL MELTDOWN | Red, shaking gauge |
| 7-10 | APOCALYPSE | Purple, screen shake + pulse |

## Setup

No API keys or secrets required. All data sources use public endpoints.
1. Push to trigger the Action, or run manually via Actions tab > "Fetch Misery Index Data" > "Run workflow"
2. Test locally: `node .github/scripts/fetch-misery-data.js`

## Files

- `index.html` — page shell, meta tags, structure
- `style.css` — light/dark theme, glassmorphism, misery-level transitions, sticky footer
- `app.js` — data fetching, rendering, gauge, incidents, megathreads, history chart, theme toggle
- `about.html` — public-facing methodology explainer
- `og-image.html` — 1200x630 social preview (screenshot to generate og-image.png)
- `favicon.svg` — custom SVG favicon (purple gauge with M)
- `data/current.json` — local placeholder; live data on `misery-data` branch
- `TDD.md` — full technical design document
- `.github/workflows/fetch-misery-data.yml` — Action workflow
- `.github/scripts/fetch-misery-data.js` — Node.js fetch/calculate/write script
