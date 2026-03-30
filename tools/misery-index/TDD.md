# Claude Developer Misery Index — Technical Design Document

## Overview
A real-time dashboard that quantifies developer suffering during Claude AI outages and degradations. Combines official Anthropic status data, recent incident history, and Reddit complaint volume to produce a single "Misery Index" score (0–10), displayed with escalating visual drama. Data is collected by a GitHub Action every 15 minutes and committed as static JSON — the frontend is pure client-side.

## Core Concept
The official status page tells you *if* Claude is down. The Misery Index tells you *how much developers are suffering about it*. Status pages are famously slow to update; Reddit is not. The gap between "All Systems Operational" and a subreddit on fire is where the real story lives.

## Data Sources

### Anthropic Status Page
- **Endpoint**: `https://status.claude.com/api/v2/summary.json`
- **Provider**: Atlassian StatusPage (standard across the industry)
- **Data**: system-level indicator (`none`, `minor`, `major`, `critical`) + per-component status for claude.ai, Claude API, Claude Code, platform.claude.com, Claude for Government
- **Role**: Ground truth anchor. When this says something's wrong, it's confirmed.

### Anthropic Incidents
- **Endpoint**: `https://status.claude.com/api/v2/incidents.json`
- **Data**: incident name, status (investigating/identified/monitoring/resolved/postmortem), impact level, timestamped updates with descriptions
- **Window**: Last 3 days, up to 10 incidents, with the 3 most recent updates per incident
- **Role**: Provides context and timeline for recent issues. Shown on the dashboard alongside current status.

### Reddit (Public JSON Endpoints)
- **No authentication required** — uses Reddit's public `.json` suffix endpoints (~10 requests/min rate limit)
- **Search endpoint**: `https://www.reddit.com/search.json?q=...&sort=new&t=day` — global search for outage/degradation keywords
- **Subreddit endpoints**: `https://www.reddit.com/r/{sub}/new.json` — targeted scan of r/ClaudeAI, r/anthropic
- **Search queries**: `"claude down"`, `"claude outage"`, `"claude not working"`, `"claude broken"`, `"claude error"`, `"claude overloaded"`, `"claude slow"`, `"claude nerfed"`, `"claude rate limit"`, `"claude unusable"`, `"claude token limit"`, `"claude usage limit"`, `"claude message limit"`
- **Complaint keywords** (for subreddit scanning): down, outage, error, broken, not working, overloaded, slow, 500, unavailable, rate limit, token limit, nerfed, degraded, worse, unusable, usage limit, message limit, throttl, capped
- **False positive filter**: search results are post-filtered to require "claude" or "anthropic" in the title
- **Role**: Human suffering signal. Reddit lights up before status pages update. Also captures degradation complaints (rate limits, token limits, usage caps, quality regressions) that the status page doesn't reflect.

### Reddit Megathreads
- **Endpoint**: `https://www.reddit.com/r/ClaudeAI/search.json?q=megathread&sort=new&restrict_sr=on&t=month`
- Searches for complaint aggregation posts (megathreads) by keyword matching: title must contain a megathread keyword (megathread, mega thread, weekly thread, discussion thread) AND a relevant topic (performance, bug, limit, usage, outage, issue, error, down)
- Includes threads created within the last week, or stickied (ongoing) threads
- Comment counts from megathreads feed into the comment amplifier — a megathread with 300+ comments is strong signal
- Megathreads are shown with a "MEGATHREAD" badge in the Reddit section and sorted to the top

### Live Frontend Fetches
- The frontend also attempts direct fetches to `status.claude.com` on page load for both status and incidents
- Provides real-time data between Action runs (CORS permitting)
- Falls back to committed data if blocked

## Misery Index Calculation

The index is a composite score from 0 (everything's fine) to 10 (digital apocalypse).

### Status Page Component (0–8 points)

| Indicator | Points |
|-----------|--------|
| `none` (All Operational) | 0 |
| `minor` | +2 |
| `major` | +4 |
| `critical` | +6 |

**Plus**: +0.5 per degraded/outaged component (capped at +2). This catches partial outages where the top-level indicator hasn't escalated yet but individual services are struggling.

### Reddit Volume Component (0–4 points)

Based on outage-related posts found in the last 24 hours:

| Posts (24h) | Points |
|-------------|--------|
| 0 | 0 |
| 1 | +0.5 |
| 2–4 | +1 |
| 5–9 | +2 |
| 10–19 | +3 |
| 20+ | +4 |

### Comment Amplifier (0–2 points)

Total comments across complaint posts — measures depth of engagement, not just post count:

| Comments (24h) | Points |
|----------------|--------|
| 0–4 | 0 |
| 5–19 | +0.5 |
| 20–49 | +1 |
| 50–99 | +1.5 |
| 100+ | +2 |

### Why This Formula

- **Status page is weighted heaviest** because confirmed outages are the most reliable signal. A `critical` indicator alone gets you to 6/10.
- **Reddit volume is secondary** because it's noisy — people complain about slow responses, billing, and feature requests too. The keyword filter helps but isn't perfect.
- **Comments amplify rather than dominate** because a single viral complaint post with 200 comments isn't the same as 20 independent reports. But it does indicate widespread frustration.
- **The cap is 10** because the index should saturate during genuine catastrophic outages, not creep above them.

## Misery Levels

| Range | Level | Label | Visual Treatment |
|-------|-------|-------|-----------------|
| 0–1 | Calm | ALL CLEAR | Blue (#3b82f6), steady, no animation |
| 1–3 | Mild | MINOR GRUMBLING | Yellow (#eab308), subtle color shift |
| 3–5 | Moderate | GROWING UNREST | Orange (#f97316), moderate pulse |
| 5–7 | Severe | FULL MELTDOWN | Red (#ef4444), gauge shake, pulsing card borders |
| 7–10 | Apocalypse | APOCALYPSE | Purple (#a855f7), screen shake, background pulse, full glow |

Each level has a pool of sarcastic commentary strings that rotate randomly on each page load.

### Time Range Toggle
A global toggle (24h / 3d / 7d) in the timeline section filters time-sensitive sections:
- **Chart**: shows history for the selected window
- **Incidents**: filters by `createdAt` timestamp

The misery score and Reddit data are always based on the last 24 hours (the Action's search window). The gauge shows "Based on the last 24 hours" to make this clear. The toggle only affects the historical context sections below it.

### Colorblind Safety
The scale uses blue → yellow → orange → red → purple rather than the traditional green → red. Blue is clearly distinct from red/orange/yellow across all common forms of colorblindness (deuteranopia, protanopia, tritanopia). Text labels ("ALL CLEAR", "FULL MELTDOWN", etc.) provide redundant non-color differentiation.

## Visual Design

### Theme
- **Dark/light mode** toggle with OS preference detection (`prefers-color-scheme`)
- Persisted via `localStorage` key `misery_theme`
- Dark: glassmorphism on deep blue-black gradient (`#0a0a1a` → `#1a1a3e`)
- Light: muted lavender-gray (`#e4e5ef` → `#d8dae6`) — deliberately not blinding white
- CSS custom properties follow portfolio pattern (`--color-bg`, `--color-surface`, `--glass-bg`, `--glass-border`, etc.)

### Gauge
- SVG circle ring (r=88, circumference=553) with `stroke-dashoffset` animation
- Fill percentage = `miseryIndex / 10`
- Stroke color transitions through misery levels
- Drop-shadow glow intensifies with severity

### Cards
- Glassmorphism: `backdrop-filter: blur(12px)` with semi-transparent backgrounds
- Border glow animation on severe+ levels
- **Status card**: per-component breakdown with color-coded dots, links to status.claude.com
- **Reddit card**: post/comment counts, top 8 posts with subreddit, score, and time ago, links to r/ClaudeAI
- **Incidents card**: last 3 days of incidents with impact badges, status labels, and latest update text

### History Chart
- Canvas-based sparkline (no external charting library)
- 48-hour rolling window
- Color-coded background zones matching misery level thresholds
- Gradient fill under the line
- Responsive to container width via `devicePixelRatio` scaling
- Redraws on theme toggle to pick up new colors

### Escalation Animations
- **Shake**: CSS `transform: translate()` keyframes on the gauge at severe+
- **Background pulse**: Alternating background gradient at apocalypse level (adapts to light/dark theme)
- **Card glow**: `box-shadow` pulse on cards at severe+
- **Scanlines**: Fixed overlay with repeating gradient for CRT monitor aesthetic

## Data Pipeline

### GitHub Action (`fetch-misery-data.yml`)
- **Schedule**: Every 15 minutes (`*/15 * * * *`) + manual `workflow_dispatch`
- **Runner**: `ubuntu-latest` with Node.js 20
- **No secrets required** — uses public endpoints only
- **Data isolation**: data is committed to an orphan branch (`misery-data`) to avoid polluting `master`/`develop` git history

### Fetch Script (`fetch-misery-data.js`)
1. Restore existing `current.json` from `misery-data` branch (preserves history)
2. Fetch Anthropic status + incidents in parallel
3. Search Reddit via public JSON endpoints (with 2-second pauses between requests to respect rate limits)
4. Post-filter Reddit results: title must contain "claude" or "anthropic" to eliminate false positives
5. Scan r/ClaudeAI and r/anthropic for complaint-keyword posts
6. Search for megathreads (complaint aggregation posts) and pull their comment counts
7. Calculate misery index (posts + all comment sources including megathreads)
8. Append history entry (timestamp, index, status indicator, post/comment counts)
9. Trim history to 672 entries (7 days at 15-min intervals)
10. Write `current.json`

### Data Branch (`misery-data`)
- Orphan branch containing a single file: `current.json`
- Force-pushed each run (single commit, no history buildup)
- Frontend fetches from `https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/current.json`
- Commit message includes live stats: `misery: 2/10 | All Systems Operational | 2 reddit posts (status.claude.com + reddit public JSON)`

## Data Schema (`current.json`)

```json
{
  "lastUpdated": "2026-03-30T12:13:10.950Z",
  "miseryIndex": 2,
  "status": {
    "page": { "id": "...", "name": "Claude", "url": "..." },
    "status": { "indicator": "none", "description": "All Systems Operational" },
    "components": [
      { "name": "claude.ai", "status": "operational" },
      { "name": "Claude API (api.anthropic.com)", "status": "operational" }
    ]
  },
  "reddit": {
    "recentPosts": 2,
    "recentComments": 24,
    "topPosts": [
      {
        "title": "Claude è impossibile da usare",
        "subreddit": "ClaudeAI",
        "score": 0,
        "url": "https://reddit.com/r/ClaudeAI/...",
        "created": "2026-03-29T14:57:57.000Z"
      }
    ]
  },
  "incidents": [
    {
      "name": "Dispatch sessions not responding in Claude Desktop",
      "status": "resolved",
      "impact": "major",
      "createdAt": "2026-03-29T00:53:21.503Z",
      "updatedAt": "2026-03-29T04:44:46.932Z",
      "url": "https://stspg.io/jvrqr2005k9r",
      "updates": [
        { "status": "resolved", "body": "The issue has been resolved...", "createdAt": "..." }
      ]
    }
  ],
  "history": [
    {
      "timestamp": "2026-03-30T12:13:10.950Z",
      "miseryIndex": 2,
      "statusIndicator": "none",
      "postCount": 2,
      "commentCount": 24
    }
  ]
}
```

## Frontend Fallback

When no Action data exists (first deploy, or data fetch fails), the frontend renders in **demo mode**. It still attempts live fetches for status and incidents, so real incident data may appear even without the Action running. The last-updated field shows "demo mode — set up GitHub Action for live data."

## Setup

No configuration required. The GitHub Action uses only public APIs:
1. Push to trigger the Action (or run manually from the Actions tab)
2. Data commits go to the `misery-data` orphan branch — zero noise in main branches
3. Test locally with `node .github/scripts/fetch-misery-data.js`

## Architecture

| File | Purpose |
|------|---------|
| `index.html` | Page shell, meta tags, semantic structure |
| `style.css` | Light/dark theme, glassmorphism, misery-level color transitions, animations |
| `app.js` | Data fetching, gauge rendering, incidents, chart, theme toggle, commentary |
| `about.html` | Public-facing methodology explainer |
| `og-image.html` | 1200x630 social preview card (screenshot to generate og-image.png) |
| `data/current.json` | Local placeholder; live data served from `misery-data` branch via raw.githubusercontent.com |
| `.github/workflows/fetch-misery-data.yml` | Action schedule + commit logic |
| `.github/scripts/fetch-misery-data.js` | Node.js fetch/calculate/write script |
| `CLAUDE.md` | Dev reference for working on this tool |
| `TDD.md` | This document |

## Known Limitations
- **Reddit noise**: results are post-filtered to require "claude" or "anthropic" in the title, but some edge cases may still slip through.
- **15-minute granularity**: short blips between polls may be missed entirely.
- **No severity distinction**: "Claude is down for everyone" and "Claude is slow for some users" both generate Reddit posts but have very different severity. The index treats them equally.
- **Public Reddit rate limits**: ~10 requests/min. The script uses 3-4 requests per run with 2-second pauses, well within limits.

## Future Considerations
- **Hacker News**: Algolia HN Search API is free — could add as a third signal source
- **Downdetector**: Aggressive bot protection, no public API — not currently feasible
- **Historical incident correlation**: Tag known outages in history for context
- **Notifications**: Browser push notifications when misery crosses a threshold
- **Embeddable widget**: Compact badge version for READMEs or blog posts
- **Reddit OAuth**: If API access becomes available again, could improve search quality and rate limits
