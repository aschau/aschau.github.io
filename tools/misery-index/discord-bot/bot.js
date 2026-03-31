require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");

// ── Config ──────────────────────────────────────────────────
var DATA_URL = "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/current.json";
var CONTENTS_API = "https://api.github.com/repos/aschau/aschau.github.io/contents/current.json?ref=misery-data";
var WORKFLOW_URL = "https://api.github.com/repos/aschau/aschau.github.io/actions/workflows/fetch-misery-data.yml/dispatches";
var DASHBOARD_URL = "https://raggedydoc.com/tools/misery-index/";
var POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes
var REDDIT_USER_AGENT = "MiseryBot/1.0 (by u/raggedydoc)";

var REDDIT_SUBREDDITS = ["ClaudeAI"];
var REDDIT_SEARCH_QUERIES = [
  "claude down OR outage OR broken",
  "claude \"not working\" OR unusable OR overloaded",
  "claude \"rate limit\" OR error OR slow"
];

// ── Misery Levels ───────────────────────────────────────────
var LEVELS = [
  { max: 1,  label: "ALL CLEAR",       color: 0x4FC3F7, emoji: "\uD83D\uDD35" },
  { max: 3,  label: "MINOR GRUMBLING", color: 0xFFD54F, emoji: "\uD83D\uDFE1" },
  { max: 5,  label: "GROWING UNREST",  color: 0xFFA726, emoji: "\uD83D\uDFE0" },
  { max: 7,  label: "FULL MELTDOWN",   color: 0xEF5350, emoji: "\uD83D\uDD34" },
  { max: 10, label: "APOCALYPSE",      color: 0xAB47BC, emoji: "\uD83D\uDFE3" },
];

function getLevel(index) {
  for (var i = 0; i < LEVELS.length; i++) {
    if (index <= LEVELS[i].max) return LEVELS[i];
  }
  return LEVELS[LEVELS.length - 1];
}

function timeAgo(isoString) {
  var diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

// ── State ───────────────────────────────────────────────────
var previousLevel = null;
var previousScore = null;
var lastData = null;

// ── Data Fetching ───────────────────────────────────────────
async function fetchData() {
  var res = await fetch(DATA_URL + "?t=" + Date.now());
  if (!res.ok) throw new Error("Data fetch failed: " + res.status);
  return res.json();
}

async function triggerWorkflow() {
  var res = await fetch(WORKFLOW_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.GITHUB_PAT,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "MiseryDiscordBot/1.0",
    },
    body: JSON.stringify({ ref: "master" }),
  });
  if (!res.ok && res.status !== 204) {
    var text = await res.text();
    console.error("Workflow dispatch failed (" + res.status + "): " + text);
    return false;
  }
  console.log("Workflow dispatched");
  return true;
}

// ── Reddit Fetching ─────────────────────────────────────────
async function redditSearch(query, subreddit) {
  var url = "https://www.reddit.com/r/" + subreddit + "/search.json?q=" +
    encodeURIComponent(query) + "&sort=new&t=day&restrict_sr=on&limit=25";
  try {
    var res = await fetch(url, {
      headers: { "User-Agent": REDDIT_USER_AGENT }
    });
    if (!res.ok) {
      console.error("Reddit search failed (" + res.status + "): r/" + subreddit + " q=" + query);
      return [];
    }
    var data = await res.json();
    return (data.data && data.data.children) || [];
  } catch (e) {
    console.error("Reddit search error:", e.message);
    return [];
  }
}

function filterRedditPost(post) {
  var text = (post.title + " " + (post.selftext || "")).toLowerCase();

  // Must mention Claude or Anthropic
  var hasClaude = text.includes("claude");
  var hasAnthropic = text.includes("anthropic");
  if (!hasClaude && !hasAnthropic) return false;

  // AI context check (same as Bluesky)
  var AI_CONTEXT = ["ai", "api", "llm", "chatbot", "model", "token", "prompt", "code",
    "sonnet", "opus", "haiku", "anthropic", "claude.ai", "cursor",
    "copilot", "chatgpt", "openai", "gemini", "developer", "programming",
    "agentic", "context window", "rate limit", "usage limit"];
  if (hasClaude && !hasAnthropic) {
    if (!AI_CONTEXT.some(function (w) { return text.includes(w); })) return false;
  }

  // Exclusions
  var EXCLUSIONS = [
    "was down", "were down", "was broken", "was unusable",
    "remember when", "last week", "last month", "yesterday",
    "used to be", "months ago", "back when",
    "fixed the bug", "fixed a bug", "helped me",
    "love claude", "claude is great", "claude is amazing",
    "works great", "working great", "working well",
    "back up", "is back", "working again", "resolved",
    "addicted", "withdrawal", "forgot how to code", "lost without",
    "switched to", "switching to", "going back to", "gave up on",
    "worse than", "better than", "compared to",
    "sucks", "terrible", "garbage", "useless"
  ];
  if (EXCLUSIONS.some(function (w) { return text.includes(w); })) return false;

  // Strong signals
  var STRONG = [
    "is down", "went down", "goes down", "going down",
    "outage", "not working", "unavailable",
    "can't use", "cant use", "won't work", "doesn't work", "stopped working",
    "keeps crashing", "keeps failing",
    "overloaded", "500 error", "502", "503", "504",
    "please fix", "is it just me"
  ];

  // Weak signals
  var WEAK = [
    "rate limit", "token limit", "usage limit", "message limit",
    "limit reached", "hit the limit", "out of messages",
    "throttl", "capped", "degraded", "so slow", "unusable", "broken",
    "nerfed", "bug", "buggy"
  ];

  var hasStrong = STRONG.some(function (w) { return text.includes(w); });
  if (hasStrong) return true;

  var weakCount = WEAK.filter(function (w) { return text.includes(w); }).length;
  var hasFrustration = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful)\b/i.test(text);
  return weakCount >= 2 || (weakCount >= 1 && hasFrustration);
}

async function fetchReddit() {
  var dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  var seenIds = new Set();
  var allPosts = [];

  for (var s = 0; s < REDDIT_SUBREDDITS.length; s++) {
    for (var q = 0; q < REDDIT_SEARCH_QUERIES.length; q++) {
      var results = await redditSearch(REDDIT_SEARCH_QUERIES[q], REDDIT_SUBREDDITS[s]);

      results.forEach(function (child) {
        var post = child.data;
        if (!post || seenIds.has(post.id)) return;
        seenIds.add(post.id);

        if (post.created_utc * 1000 < dayAgo) return;
        if (!filterRedditPost(post)) return;

        allPosts.push({
          title: truncate(post.title, 120),
          author: post.author || "unknown",
          score: post.score || 0,
          numComments: post.num_comments || 0,
          url: "https://reddit.com" + post.permalink,
          created: new Date(post.created_utc * 1000).toISOString(),
          subreddit: post.subreddit,
          source: "reddit"
        });
      });

      // Pause to avoid Reddit rate limiting
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
  }

  console.log("  Reddit: " + allPosts.length + " posts found");
  return allPosts;
}

// ── Push Reddit Data to GitHub ──────────────────────────────
async function pushRedditData(redditPosts) {
  // Get current file SHA from the misery-data branch
  var shaRes = await fetch(CONTENTS_API, {
    headers: {
      "Authorization": "Bearer " + process.env.GITHUB_PAT,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "MiseryDiscordBot/1.0",
    }
  });
  if (!shaRes.ok) {
    console.error("Failed to get file SHA:", shaRes.status);
    return;
  }
  var shaData = await shaRes.json();
  var fileSha = shaData.sha;

  // Decode the existing content
  var existing = JSON.parse(Buffer.from(shaData.content, "base64").toString("utf-8"));

  // Update reddit section
  var commentCount = redditPosts.reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);
  existing.reddit = {
    lastFetched: new Date().toISOString(),
    recentPosts: redditPosts.length,
    recentComments: commentCount,
    topPosts: redditPosts
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 10)
      .map(function (p) {
        return {
          title: p.title, author: p.author, score: p.score,
          url: p.url, created: p.created, subreddit: p.subreddit, source: p.source
        };
      })
  };

  // Push updated file
  var updateRes = await fetch("https://api.github.com/repos/aschau/aschau.github.io/contents/current.json", {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + process.env.GITHUB_PAT,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "MiseryDiscordBot/1.0",
    },
    body: JSON.stringify({
      message: "bot: reddit " + redditPosts.length + " posts",
      content: Buffer.from(JSON.stringify(existing, null, 2)).toString("base64"),
      sha: fileSha,
      branch: "misery-data"
    })
  });

  if (!updateRes.ok) {
    var errText = await updateRes.text();
    console.error("Failed to push reddit data (" + updateRes.status + "): " + errText);
  } else {
    console.log("  Reddit data pushed to misery-data branch");
  }
}

// ── Thermometer ─────────────────────────────────────────────
function buildThermometer(score) {
  var filled = Math.round(score);
  var empty = 10 - filled;
  var segments = [];
  for (var i = 0; i < filled; i++) {
    if (i < 3) segments.push("\uD83D\uDFE2");       // green
    else if (i < 5) segments.push("\uD83D\uDFE1");   // yellow
    else if (i < 7) segments.push("\uD83D\uDFE0");   // orange
    else segments.push("\uD83D\uDD34");               // red
  }
  for (var j = 0; j < empty; j++) segments.push("\u26AB");  // black
  return segments.join("") + " **" + score + "/10**";
}

// ── Embeds ──────────────────────────────────────────────────
function buildMiseryEmbed(data) {
  var level = getLevel(data.miseryIndex);
  var status = data.status && data.status.status ? data.status.status.description : "Unknown";
  var posts = data.social ? data.social.recentPosts : 0;
  var replies = data.social ? data.social.recentComments : 0;

  var reddit = data.reddit || {};
  var redditPosts = reddit.recentPosts || 0;
  var redditStale = "";
  if (reddit.lastFetched) {
    var redditAge = Math.round((Date.now() - new Date(reddit.lastFetched).getTime()) / 60000);
    if (redditAge > 30) redditStale = " \u26A0\uFE0F " + redditAge + "m ago";
  }

  var description = buildThermometer(data.miseryIndex) +
    "\n\n" +
    "\uD83D\uDCE1 **Status:** " + status + "\n" +
    "\uD83D\uDCAC **Bluesky:** " + posts + " posts, " + replies + " replies (24h)\n" +
    "\uD83D\uDFE0 **Reddit:** " + redditPosts + " posts (24h)" + redditStale;

  return new EmbedBuilder()
    .setTitle(level.emoji + "  " + level.label)
    .setDescription(description)
    .setColor(level.color)
    .setFooter({ text: "Claude Developer Misery Index \u2022 " + DASHBOARD_URL })
    .setTimestamp(new Date(data.lastUpdated));
}

function buildAlertEmbed(data, oldLabel, newLabel) {
  var level = getLevel(data.miseryIndex);
  var oldLevel = null;
  for (var i = 0; i < LEVELS.length; i++) {
    if (LEVELS[i].label === oldLabel) { oldLevel = LEVELS[i]; break; }
  }
  var arrow = data.miseryIndex > previousScore ? "\u2B06\uFE0F" : "\u2B07\uFE0F";
  var status = data.status && data.status.status ? data.status.status.description : "Unknown";
  var posts = data.social ? data.social.recentPosts : 0;

  var description = arrow + " " + (oldLevel ? oldLevel.emoji : "\u26AA") + " **" + oldLabel + "** \u2192 " + level.emoji + " **" + newLabel + "**" +
    "\n\n" +
    buildThermometer(data.miseryIndex) +
    "\n\n" +
    "\uD83D\uDCE1 **Status:** " + status + "\n" +
    "\uD83D\uDCAC **Bluesky:** " + posts + " complaint posts (24h)";

  return new EmbedBuilder()
    .setTitle("\uD83D\uDEA8 Misery Level Change")
    .setDescription(description)
    .setColor(level.color)
    .setFooter({ text: "Claude Developer Misery Index \u2022 " + DASHBOARD_URL })
    .setTimestamp(new Date(data.lastUpdated));
}

function buildIncidentsEmbed(data) {
  var incidents = data.incidents || [];
  var embed = new EmbedBuilder()
    .setTitle("\uD83D\uDCC3 Recent Incidents")
    .setColor(0x546E7A)
    .setFooter({ text: "Claude Developer Misery Index \u2022 " + DASHBOARD_URL })
    .setTimestamp(new Date(data.lastUpdated));

  if (incidents.length === 0) {
    embed.setDescription("\u2705 No recent incidents. Smooth sailing.");
    return embed;
  }

  var impactEmoji = { critical: "\uD83D\uDD34", major: "\uD83D\uDFE0", minor: "\uD83D\uDFE1", none: "\u26AA" };
  var statusEmoji = { resolved: "\u2705", monitoring: "\uD83D\uDC41\uFE0F", investigating: "\uD83D\uDD0D", identified: "\uD83D\uDCCC", postmortem: "\uD83D\uDCDD" };

  var lines = incidents.slice(0, 5).map(function (inc) {
    var emoji = impactEmoji[inc.impact] || "\u26AA";
    var sEmoji = statusEmoji[inc.status] || "\u2753";
    var created = inc.createdAt ? timeAgo(inc.createdAt) : "";
    var updated = inc.updatedAt ? timeAgo(inc.updatedAt) : "";

    var line = emoji + " **" + inc.name + "**";
    if (inc.url) line = emoji + " [**" + inc.name + "**](" + inc.url + ")";
    line += "\n" + sEmoji + " " + (inc.status || "unknown");
    if (created) line += " \u00b7 " + created;
    if (updated && updated !== created) line += " \u00b7 updated " + updated;

    var latestUpdate = inc.updates && inc.updates.length > 0 ? inc.updates[0] : null;
    if (latestUpdate && latestUpdate.body) {
      line += "\n> " + truncate(latestUpdate.body, 150).replace(/\n/g, " ");
    }

    return line;
  });

  embed.setDescription(lines.join("\n\n"));
  return embed;
}

function buildSocialEmbed(data) {
  var social = data.social || {};
  var posts = social.topPosts || [];
  var embed = new EmbedBuilder()
    .setTitle("Bluesky Chatter (24h)")
    .setColor(0x0085FF)
    .setFooter({ text: social.recentPosts + " posts, " + social.recentComments + " replies" })
    .setTimestamp(new Date(data.lastUpdated));

  if (posts.length === 0) {
    embed.setDescription("No recent complaint posts found.");
    return embed;
  }

  var lines = posts.slice(0, 5).map(function (post, i) {
    var score = post.score != null ? post.score : 0;
    var author = post.author || "unknown";
    var title = truncate(post.title, 80);
    var url = post.url || "#";
    return (i + 1) + ". " + score + " \u2665 — [" + title + "](" + url + ")\n   @" + author;
  });

  embed.setDescription(lines.join("\n\n"));
  return embed;
}

function buildRedditEmbed(data) {
  var reddit = data.reddit || {};
  var posts = reddit.topPosts || [];
  var staleMs = reddit.lastFetched ? Date.now() - new Date(reddit.lastFetched).getTime() : Infinity;
  var staleMin = Math.round(staleMs / 60000);
  var staleNote = staleMin > 30 ? " \u26A0\uFE0F stale (" + staleMin + "m ago)" : "";

  var embed = new EmbedBuilder()
    .setTitle("Reddit Chatter (24h)" + staleNote)
    .setColor(0xFF4500)
    .setFooter({ text: (reddit.recentPosts || 0) + " posts, " + (reddit.recentComments || 0) + " comments" })
    .setTimestamp(reddit.lastFetched ? new Date(reddit.lastFetched) : new Date());

  if (!reddit.lastFetched) {
    embed.setDescription("No Reddit data yet. Bot needs to run a poll cycle first.");
    return embed;
  }

  if (posts.length === 0) {
    embed.setDescription("No recent complaint posts found on Reddit.");
    return embed;
  }

  var lines = posts.slice(0, 5).map(function (post, i) {
    var score = post.score != null ? post.score : 0;
    var sub = post.subreddit ? "r/" + post.subreddit : "";
    var title = truncate(post.title, 80);
    var url = post.url || "#";
    return (i + 1) + ". " + score + " \u2B06 — [" + title + "](" + url + ")\n   " + sub + " \u00B7 u/" + (post.author || "unknown");
  });

  embed.setDescription(lines.join("\n\n"));
  return embed;
}

// ── Poll Loop ───────────────────────────────────────────────
async function pollAndAlert(client) {
  console.log("[" + new Date().toISOString() + "] Polling...");

  // Fetch Reddit from local machine (runs in parallel with Action)
  var redditPosts = [];
  try {
    redditPosts = await fetchReddit();
  } catch (e) {
    console.error("Reddit fetch error:", e.message);
  }

  // Trigger the GitHub Action (Bluesky + status)
  try {
    await triggerWorkflow();
  } catch (e) {
    console.error("Workflow trigger error:", e.message);
  }

  // Wait for Action to complete (90s to be safe)
  console.log("  Waiting 90s for Action to finish...");
  await new Promise(function (r) { setTimeout(r, 90 * 1000); });

  // Push Reddit data AFTER Action finishes (so it doesn't get overwritten)
  console.log("  Pushing Reddit data...");
  try {
    await pushRedditData(redditPosts);
  } catch (e) {
    console.error("Reddit push error:", e.message);
  }

  // Brief pause for GitHub CDN to propagate
  await new Promise(function (r) { setTimeout(r, 5000); });

  // Fetch fresh data (now includes both Bluesky from Action + Reddit from our push)
  var data;
  try {
    data = await fetchData();
  } catch (e) {
    console.error("Data fetch error:", e.message);
    return;
  }

  var newLevel = getLevel(data.miseryIndex);
  console.log("  Misery: " + data.miseryIndex + "/10 (" + newLevel.label + ")");

  // Check for level change
  if (previousLevel !== null && newLevel.label !== previousLevel) {
    console.log("  Level changed: " + previousLevel + " -> " + newLevel.label);
    var channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
    if (channel) {
      try {
        var embed = buildAlertEmbed(data, previousLevel, newLevel.label);
        await channel.send({ embeds: [embed] });
      } catch (e) {
        console.error("Failed to send alert:", e.message);
      }
    } else {
      console.error("Alert channel not found:", process.env.DISCORD_CHANNEL_ID);
    }
  }

  previousLevel = newLevel.label;
  previousScore = data.miseryIndex;
  lastData = data;
}

// ── Slash Command Definitions ───────────────────────────────
var commands = [
  new SlashCommandBuilder()
    .setName("misery")
    .setDescription("Current Claude Developer Misery Index score"),
  new SlashCommandBuilder()
    .setName("incidents")
    .setDescription("Recent Claude incidents from the status page"),
  new SlashCommandBuilder()
    .setName("social")
    .setDescription("Top Bluesky complaint posts about Claude (24h)"),
  new SlashCommandBuilder()
    .setName("reddit")
    .setDescription("Top Reddit complaint posts about Claude (24h)"),
];

async function registerCommands(clientId) {
  var rest = new REST().setToken(process.env.DISCORD_TOKEN);
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map(function (c) { return c.toJSON(); }),
    });
    console.log("Slash commands registered");
  } catch (e) {
    console.error("Failed to register commands:", e.message);
  }
}

// ── Command Handlers ────────────────────────────────────────
async function getData() {
  if (lastData) return lastData;
  var data = await fetchData();
  lastData = data;
  return data;
}

async function handleCommand(interaction) {
  await interaction.deferReply();
  var data;
  try {
    data = await getData();
  } catch (e) {
    return interaction.editReply("Couldn't fetch misery data: " + e.message);
  }

  if (interaction.commandName === "misery") {
    return interaction.editReply({ embeds: [buildMiseryEmbed(data)] });
  }
  if (interaction.commandName === "incidents") {
    return interaction.editReply({ embeds: [buildIncidentsEmbed(data)] });
  }
  if (interaction.commandName === "social") {
    return interaction.editReply({ embeds: [buildSocialEmbed(data)] });
  }
  if (interaction.commandName === "reddit") {
    return interaction.editReply({ embeds: [buildRedditEmbed(data)] });
  }
}

// ── Client Setup ────────────────────────────────────────────
var client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async function () {
  console.log("Logged in as " + client.user.tag);
  console.log("Alert channel: " + process.env.DISCORD_CHANNEL_ID);
  console.log("Poll interval: " + (POLL_INTERVAL / 60000) + " minutes");

  await registerCommands(client.user.id);

  // Initial poll, then every POLL_INTERVAL
  pollAndAlert(client);
  setInterval(function () { pollAndAlert(client); }, POLL_INTERVAL);
});

client.on("interactionCreate", async function (interaction) {
  if (!interaction.isChatInputCommand()) return;
  handleCommand(interaction);
});

// ── Graceful Shutdown ───────────────────────────────────────
process.on("SIGINT", function () {
  console.log("Shutting down...");
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
