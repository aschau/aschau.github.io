# Misery Index Discord Bot

Discord bot that fetches all data sources, calculates the misery score, pushes to GitHub, and alerts a channel when the misery level changes. The GitHub Action serves as a degraded fallback when the bot is offline.

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Bot tab → copy the token
3. Invite to your server with bot + message permissions:
   `https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=2048&scope=bot`

### 2. Create a GitHub PAT

1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
2. Scope to the `aschau/aschau.github.io` repo
3. Grant `Contents: Read and write` and `Actions: Read and write` permissions

### 3. Create a Bluesky App Password

1. Bluesky → Settings → App Passwords → Add
2. Copy the generated password

### 4. Configure

Create `discord-bot/.env` (gitignored):

```
DISCORD_TOKEN=your-discord-bot-token
GITHUB_PAT=github_pat_your-token
DISCORD_CHANNEL_ID=123456789012345678
BSKY_HANDLE=you.bsky.social
BSKY_APP_PASSWORD=your-app-password
```

Get the channel ID: enable Developer Mode in Discord settings, right-click the channel → Copy Channel ID.

### 5. Run

```bash
cd tools/misery-index/discord-bot
npm install
npm start
```

## Commands (Slash)

| Command | Description |
|---------|-------------|
| `/misery` | Current misery score, thermometer, status, and post counts |
| `/incidents` | Recent Claude incidents with timestamps and emoji indicators |
| `/social` | Top Bluesky complaint posts (up to 5) |
| `/reddit` | Top Reddit complaint posts (up to 5, with top comments) |

## Behavior

- Polls every 15 minutes — bot handles ALL data fetching:
  1. Fetches Reddit (r/ClaudeAI, r/ChatGPT) + top comments for megathreads
  2. Fetches Bluesky (authenticated search with multi-layer filtering)
  3. Fetches status page + incidents from status.claude.com
  4. Calculates misery score with breakdown
  5. Pushes unified `current.json` to `misery-data` branch
  6. Checks for level changes and alerts the Discord channel
- If a source returns 0 results (rate limited), existing data is preserved
- First poll on startup is silent (sets baseline, no alert)
- GitHub Action is a fallback only — runs on cron if bot is offline

## Local Development

Fetch all live data (status, incidents, Bluesky, Reddit) into `data/current.json` for local testing:

```bash
node tools/misery-index/discord-bot/fetch-local-data.js
```

The frontend automatically uses the local file on `localhost` instead of fetching from the remote `misery-data` branch.

## Misery Levels

| Range | Level | Embed Color |
|-------|-------|-------------|
| 0-1 | ALL CLEAR | Blue |
| 1-3 | MINOR GRUMBLING | Yellow |
| 3-6 | GROWING UNREST | Orange |
| 6-8 | FULL MELTDOWN | Red |
| 8-10 | APOCALYPSE | Purple |
