# Claude Developer Misery Index

Real-time dashboard tracking Claude AI outage and degradation sentiment by combining official status data, incident history, and Bluesky social chatter.

## Architecture

- **Frontend**: `index.html` + `style.css` + `app.js` — self-contained, no build system, light/dark mode
- **Data pipeline**: GitHub Action (`.github/workflows/fetch-misery-data.yml`) runs every 15 minutes, executes `.github/scripts/fetch-misery-data.js` which fetches all sources, calculates misery index, and force-pushes to `misery-data` orphan branch
- **Live fallback**: Frontend fetches from `misery-data` branch, falls back to local `data/current.json`, and also fetches `status.claude.com` live for real-time status/incidents

## Data Sources

1. **Anthropic Status Page** (`status.claude.com/api/v2/summary.json`) — official component status
2. **Anthropic Incidents** (`status.claude.com/api/v2/incidents.json`) — last 7 days of incidents with updates
3. **Bluesky** (authenticated API via GitHub Action) — searches for Claude outage/degradation/limit posts. Requires `BSKY_HANDLE` and `BSKY_APP_PASSWORD` GitHub secrets.
4. **Reddit** (via Discord bot) — searches r/ClaudeAI and r/ChatGPT. Reddit blocks cloud IPs, so this runs from the Discord bot and pushes data to the `misery-data` branch. The Action preserves Reddit data across runs; it goes stale (displayed but not scored) after 30 minutes.

## Bluesky Post Filtering (Human-Level Analysis)

Posts go through a multi-layer filter to avoid red herrings:

1. **AI context gate**: Posts mentioning "claude" (without "anthropic") must also contain AI context words (api, llm, sonnet, opus, etc.) to filter out people named Claude
2. **Exclusion layer**: Posts matching false-positive patterns are rejected immediately:
   - Past tense / historical ("was down", "remember when", "last week")
   - Positive sentiment ("fixed the bug", "works great", "love claude")
   - Dependency humor / memes ("addicted", "withdrawal", "forgot how to code")
   - Competitive switching ("switched to", "gave up on") — opinion, not outage
   - Generic hot takes ("worse than", "sucks", "terrible")
3. **Signal strength**: Two tiers of complaint signals, checked within 80 chars of "claude"/"anthropic":
   - **Strong** (counts alone): "is down", "outage", "not working", "stopped working", "keeps crashing", HTTP errors, etc.
   - **Weak** (needs corroboration): "rate limit", "so slow", "broken", "bug" — must have 2+ distinct weak signals OR explicit frustration emoji/language (wtf, ugh, 😡, etc.)

## Misery Index Calculation (0-10)

- Status page indicator: none=0, minor=+2, major=+4, critical=+6
- Degraded components: +0.5 each (max +2)
- Reddit posts (24h, if fresh <30m): 1-2=+0.5, 3-4=+1, 5-9=+1.5, 10-19=+2, 20+=+3
- Bluesky posts (24h): 1-4=+0.5, 5-14=+1, 15-29=+2, 30-49=+3, 50+=+4
- Bluesky reply volume: 10-29=+0.5, 30-74=+1, 75-149=+1.5, 150+=+2

## Misery Levels

| Range | Level | Visual |
|-------|-------|--------|
| 0-1 | ALL CLEAR | Blue, calm |
| 1-3 | MINOR GRUMBLING | Yellow, slight pulse |
| 3-5 | GROWING UNREST | Orange, moderate pulse |
| 5-7 | FULL MELTDOWN | Red, shaking gauge |
| 7-10 | APOCALYPSE | Purple, screen shake + pulse |

## Setup

1. Create a Bluesky app password: Settings > App Passwords > Add
2. Add `BSKY_HANDLE` and `BSKY_APP_PASSWORD` as GitHub repo secrets
3. Push to trigger the Action, or run manually via Actions tab
4. Test locally: `BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxx node .github/scripts/fetch-misery-data.js`

## Files

- `index.html` — page shell, meta tags, structure
- `style.css` — light/dark theme, glassmorphism, misery-level transitions, sticky footer
- `app.js` — data fetching, rendering, gauge, incidents, social chatter, history chart, theme toggle
- `about.html` — public-facing methodology explainer
- `og-image.html` — 1200x630 social preview (screenshot to generate og-image.png)
- `favicon.svg` — custom SVG favicon (purple gauge with M)
- `data/current.json` — local placeholder; live data on `misery-data` branch
- `TDD.md` — full technical design document
- `.github/workflows/fetch-misery-data.yml` — Action workflow
- `.github/scripts/fetch-misery-data.js` — Node.js fetch/calculate/write script
