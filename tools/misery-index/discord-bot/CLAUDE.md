# Misery Index Discord Bot

Discord bot that auto-refreshes the Claude Developer Misery Index and alerts a channel when the misery level changes.

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Bot tab → copy the token
3. Enable **Message Content Intent** under Privileged Gateway Intents
4. Invite to your server with bot + message permissions:
   `https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=2048&scope=bot`

### 2. Create a GitHub PAT

1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
2. Scope to the `aschau/aschau.github.io` repo
3. Grant `Actions: Read and write` permission

### 3. Configure

Create `discord-bot/.env` (gitignored):

```
DISCORD_TOKEN=your-discord-bot-token
GITHUB_PAT=github_pat_your-token
DISCORD_CHANNEL_ID=123456789012345678
```

Get the channel ID: enable Developer Mode in Discord settings, right-click the channel → Copy Channel ID.

### 4. Run

```bash
cd discord-bot
npm install
npm start
```

## Commands (Slash)

| Command | Description |
|---------|-------------|
| `/misery` | Current misery score, thermometer, status, and post counts |
| `/incidents` | Recent Claude incidents with timestamps and emoji indicators |
| `/social` | Top Bluesky complaint posts (up to 5) |
| `/reddit` | Top Reddit complaint posts (up to 5, with stale indicator) |

## Behavior

- Polls every 15 minutes:
  1. Fetches Reddit (r/ClaudeAI, r/ChatGPT) — bot handles this since Reddit blocks cloud IPs
  2. Triggers the GitHub Action (Bluesky + status page)
  3. Waits 90s for Action to complete
  4. Pushes Reddit data to `misery-data` branch via GitHub Contents API
  5. Fetches combined `current.json` and checks for level changes
- Posts an alert embed to the configured channel when the misery level changes (e.g. ALL CLEAR → GROWING UNREST)
- First poll on startup is silent (sets baseline, no alert)
- If the GitHub Action dispatch fails, still fetches data (the cron schedule is a fallback)
- Reddit data is preserved across Action runs — if the bot goes down, existing Reddit data stays but is marked stale

## Misery Levels

| Range | Level | Embed Color |
|-------|-------|-------------|
| 0-1 | ALL CLEAR | Blue |
| 1-3 | MINOR GRUMBLING | Yellow |
| 3-5 | GROWING UNREST | Orange |
| 5-7 | FULL MELTDOWN | Red |
| 7-10 | APOCALYPSE | Purple |
