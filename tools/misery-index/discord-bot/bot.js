require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

// ── Config ──────────────────────────────────────────────────
var DATA_URL = "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/current.json";
var WORKFLOW_URL = "https://api.github.com/repos/aschau/aschau.github.io/actions/workflows/fetch-misery-data.yml/dispatches";
var DASHBOARD_URL = "https://raggedydoc.com/tools/misery-index/";
var POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes
var POST_DISPATCH_WAIT = 60 * 1000; // 60 seconds for Action to complete

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

  var description = buildThermometer(data.miseryIndex) +
    "\n\n" +
    "\uD83D\uDCE1 **Status:** " + status + "\n" +
    "\uD83D\uDCAC **Bluesky Posts:** " + posts + " posts, " + replies + " replies (24h)";

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
    .setTitle("Recent Incidents")
    .setColor(0x546E7A)
    .setFooter({ text: "Claude Developer Misery Index" })
    .setTimestamp(new Date(data.lastUpdated));

  if (incidents.length === 0) {
    embed.setDescription("No recent incidents. Smooth sailing.");
    return embed;
  }

  incidents.slice(0, 5).forEach(function (inc) {
    var impactBadge = inc.impact ? "[" + inc.impact.toUpperCase() + "] " : "";
    var latestUpdate = inc.updates && inc.updates.length > 0 ? inc.updates[0] : null;
    var value = "Status: " + (inc.status || "unknown");
    if (latestUpdate && latestUpdate.body) {
      value += "\n" + truncate(latestUpdate.body, 200);
    }
    if (inc.url) value += "\n[View](" + inc.url + ")";
    embed.addFields({ name: impactBadge + inc.name, value: value });
  });

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

// ── Poll Loop ───────────────────────────────────────────────
async function pollAndAlert(client) {
  console.log("[" + new Date().toISOString() + "] Polling...");

  // Trigger the workflow
  try {
    await triggerWorkflow();
  } catch (e) {
    console.error("Workflow trigger error:", e.message);
  }

  // Wait for Action to complete
  await new Promise(function (r) { setTimeout(r, POST_DISPATCH_WAIT); });

  // Fetch fresh data
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

// ── Command Handlers ────────────────────────────────────────
async function handleMisery(message) {
  var data = lastData;
  if (!data) {
    try {
      data = await fetchData();
      lastData = data;
    } catch (e) {
      return message.reply("Couldn't fetch misery data: " + e.message);
    }
  }
  return message.reply({ embeds: [buildMiseryEmbed(data)] });
}

async function handleIncidents(message) {
  var data = lastData;
  if (!data) {
    try {
      data = await fetchData();
      lastData = data;
    } catch (e) {
      return message.reply("Couldn't fetch misery data: " + e.message);
    }
  }
  return message.reply({ embeds: [buildIncidentsEmbed(data)] });
}

async function handleSocial(message) {
  var data = lastData;
  if (!data) {
    try {
      data = await fetchData();
      lastData = data;
    } catch (e) {
      return message.reply("Couldn't fetch misery data: " + e.message);
    }
  }
  return message.reply({ embeds: [buildSocialEmbed(data)] });
}

// ── Client Setup ────────────────────────────────────────────
var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", function () {
  console.log("Logged in as " + client.user.tag);
  console.log("Alert channel: " + process.env.DISCORD_CHANNEL_ID);
  console.log("Poll interval: " + (POLL_INTERVAL / 60000) + " minutes");

  // Initial poll, then every POLL_INTERVAL
  pollAndAlert(client);
  setInterval(function () { pollAndAlert(client); }, POLL_INTERVAL);
});

client.on("messageCreate", async function (message) {
  if (message.author.bot) return;

  if (message.content === "!misery") return handleMisery(message);
  if (message.content === "!incidents") return handleIncidents(message);
  if (message.content === "!social") return handleSocial(message);
});

// ── Graceful Shutdown ───────────────────────────────────────
process.on("SIGINT", function () {
  console.log("Shutting down...");
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
