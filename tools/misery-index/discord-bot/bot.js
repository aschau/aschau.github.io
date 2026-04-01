require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");

// ── Config ──────────────────────────────────────────────────
var DATA_URL = "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/current.json";
var CONTENTS_API = "https://api.github.com/repos/aschau/aschau.github.io/contents/current.json?ref=misery-data";
var WORKFLOW_URL = "https://api.github.com/repos/aschau/aschau.github.io/actions/workflows/fetch-misery-data.yml/dispatches";
var DASHBOARD_URL = "https://raggedydoc.com/tools/misery-index/";
var OG_IMAGE = "https://raggedydoc.com/tools/misery-index/og-image.png";
var SITE_URL = "https://raggedydoc.com";
var BOT_AUTHOR = { name: "raggedydoc.com", url: SITE_URL, iconURL: "https://raggedydoc.com/img/favicon.png" };
var POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes
var REDDIT_USER_AGENT = "MiseryBot/1.0 (by u/raggedydoc)";

// r/ClaudeAI is Claude-specific so we can search more broadly there
// r/ChatGPT occasionally has Claude outage threads — one focused query
var REDDIT_SEARCHES = [
  { sub: "ClaudeAI", q: "megathread", t: "month" },
  { sub: "ClaudeAI", q: "down OR outage OR broken OR error", t: "week" },
  { sub: "ClaudeAI", q: "rate limit OR slow OR overloaded OR unusable", t: "week" },
  { sub: "ClaudeAI", q: "not working OR crashing OR degraded OR bug", t: "week" },
  { sub: "ChatGPT", q: "claude down OR claude outage", t: "day" }
];

// ── Misery Levels ───────────────────────────────────────────
var LEVELS = [
  { max: 1,  label: "ALL CLEAR",       color: 0x4FC3F7, emoji: "\uD83D\uDD35" },
  { max: 3,  label: "MINOR GRUMBLING", color: 0xFFD54F, emoji: "\uD83D\uDFE1" },
  { max: 6,  label: "GROWING UNREST",  color: 0xFFA726, emoji: "\uD83D\uDFE0" },
  { max: 8,  label: "FULL MELTDOWN",   color: 0xEF5350, emoji: "\uD83D\uDD34" },
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
async function redditSearch(query, subreddit, timeRange) {
  var url = "https://www.reddit.com/r/" + subreddit + "/search.json?q=" +
    encodeURIComponent(query) + "&sort=new&t=" + (timeRange || "day") + "&restrict_sr=on&limit=25";
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

async function fetchTopComments(permalink, limit) {
  try {
    var url = "https://www.reddit.com" + permalink + ".json?sort=top&limit=" + (limit || 5);
    var res = await fetch(url, {
      headers: { "User-Agent": REDDIT_USER_AGENT }
    });
    if (!res.ok) return [];
    var data = await res.json();
    // Reddit returns [post, comments] — comments are in data[1]
    var comments = (data[1] && data[1].data && data[1].data.children) || [];
    return comments
      .filter(function (c) { return c.kind === "t1" && c.data && c.data.score >= 5; })
      .slice(0, limit || 5)
      .map(function (c) {
        return {
          author: c.data.author || "unknown",
          score: c.data.score || 0,
          body: truncate(c.data.body || "", 150),
          created: new Date((c.data.created_utc || 0) * 1000).toISOString()
        };
      });
  } catch (e) {
    console.error("Comment fetch error:", e.message);
    return [];
  }
}

function filterRedditPost(post, subreddit) {
  var text = (post.title + " " + (post.selftext || "")).toLowerCase();
  var isClaudeSub = subreddit === "ClaudeAI";

  // For non-Claude subreddits, must mention Claude or Anthropic
  if (!isClaudeSub) {
    var hasClaude = text.includes("claude");
    var hasAnthropic = text.includes("anthropic");
    if (!hasClaude && !hasAnthropic) return false;
  }

  // Exclusions
  var EXCLUSIONS = [
    "was down", "were down", "was broken", "was unusable",
    "remember when", "last week", "last month", "yesterday",
    "used to be", "months ago", "back when",
    "fixed the bug", "fixed a bug", "found the bug", "helped me",
    "love claude", "claude is great", "claude is amazing",
    "works great", "working great", "working well",
    "back up", "is back", "working again", "resolved",
    "addicted", "withdrawal", "forgot how to code", "lost without",
    "switched to", "switching to", "going back to", "gave up on",
    "worse than", "better than", "compared to",
    "sucks", "terrible", "garbage", "useless"
  ];
  if (EXCLUSIONS.some(function (w) { return text.includes(w); })) return false;

  // Skip showcase / project posts — not complaints
  var titleLower = (post.title || "").toLowerCase();
  var SHOWCASE = ["i built", "i made", "i created", "introducing", "announcing",
    "check out", "open source", "open-source", "new tool", "new project",
    "released", "launching", "just shipped", "show r/"];
  if (SHOWCASE.some(function (w) { return titleLower.includes(w); })) return false;

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
  var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var seenIds = new Set();
  var allPosts = [];

  for (var i = 0; i < REDDIT_SEARCHES.length; i++) {
    var search = REDDIT_SEARCHES[i];
    var results = await redditSearch(search.q, search.sub, search.t);
    var cutoff = search.t === "month" ? monthAgo : search.t === "week" ? weekAgo : dayAgo;

    results.forEach(function (child) {
      var post = child.data;
      if (!post || seenIds.has(post.id)) return;
      seenIds.add(post.id);

      if (post.created_utc * 1000 < cutoff) return;

      // Detect official megathreads by title keywords + stickied status
      var title = (post.title || "").toLowerCase();
      var MEGA_KEYWORDS = ["megathread", "mega thread", "weekly thread", "discussion thread"];
      var MEGA_TOPICS = ["performance", "bug", "limit", "usage", "outage", "issue", "error", "down"];
      var hasMegaKeyword = MEGA_KEYWORDS.some(function (kw) { return title.includes(kw); });
      var hasMegaTopic = MEGA_TOPICS.some(function (t) { return title.includes(t); });
      var isMegathread = (hasMegaKeyword && hasMegaTopic) || post.stickied;

      // Megathreads skip the complaint filter
      if (!isMegathread && !filterRedditPost(post, search.sub)) return;

      // For older posts: megathreads need at least 1 comment, regular posts need 5
      var ageHours = (Date.now() - post.created_utc * 1000) / 3600000;
      if (ageHours > 24 && isMegathread && (post.num_comments || 0) < 1) return;
      if (ageHours > 24 && !isMegathread && (post.num_comments || 0) < 5) return;

      allPosts.push({
        title: truncate(post.title, 120),
        author: post.author || "unknown",
        score: post.score || 0,
        numComments: post.num_comments || 0,
        url: "https://reddit.com" + post.permalink,
        permalink: post.permalink,
        created: new Date(post.created_utc * 1000).toISOString(),
        subreddit: post.subreddit,
        source: "reddit",
        isMegathread: isMegathread
      });
    });

    // Pause to avoid Reddit rate limiting
    await new Promise(function (r) { setTimeout(r, 2000); });
  }

  var megas = allPosts.filter(function (p) { return p.isMegathread; }).length;
  console.log("  Reddit: " + allPosts.length + " posts found (" + megas + " megathreads)");

  // Fetch top comments for megathreads and high-engagement posts
  for (var j = 0; j < allPosts.length; j++) {
    var post = allPosts[j];
    if (post.isMegathread || post.numComments >= 10) {
      console.log("    Fetching comments for: " + post.title.substring(0, 50) + "...");
      post.topComments = await fetchTopComments(post.permalink, 3);
      console.log("      " + post.topComments.length + " top comments found");
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
    console.log("    " + (post.isMegathread ? "[MEGA] " : "") + post.title.substring(0, 70) + " (" + post.numComments + " comments" + (post.topComments ? ", " + post.topComments.length + " highlighted" : "") + ")");
  }

  return allPosts;
}

// ── Misery Calculation (mirrors fetch-misery-data.js) ────────
function calculateMisery(data, redditData) {
  var statusScore = 0;
  var bskyScore = 0;
  var bskyReplyScore = 0;
  var redditScore = 0;

  // Status page (0-8)
  if (data.status && data.status.status) {
    var indicator = data.status.status.indicator;
    if (indicator === "minor") statusScore += 2;
    else if (indicator === "major") statusScore += 4;
    else if (indicator === "critical") statusScore += 6;

    if (data.status.components) {
      var bad = data.status.components.filter(function (c) { return c.status !== "operational"; });
      statusScore += Math.min(bad.length * 0.5, 2);
    }
  }

  // Reddit (0-5) — primary social signal, megathreads count as 5x
  if (redditData) {
    var megathreads = (redditData.topPosts || []).filter(function (p) { return p.isMegathread; }).length;
    var rPosts = (redditData.recentPosts || 0) + (megathreads * 4);
    if (rPosts >= 30) redditScore = 5;
    else if (rPosts >= 20) redditScore = 4;
    else if (rPosts >= 10) redditScore = 3;
    else if (rPosts >= 5) redditScore = 2;
    else if (rPosts >= 3) redditScore = 1;
    else if (rPosts >= 1) redditScore = 0.5;
  }

  // Bluesky posts (0-2) — secondary signal
  var bskyPosts = data.social ? data.social.recentPosts : 0;
  if (bskyPosts >= 30) bskyScore = 2;
  else if (bskyPosts >= 15) bskyScore = 1.5;
  else if (bskyPosts >= 5) bskyScore = 1;
  else if (bskyPosts >= 1) bskyScore = 0.5;

  // Bluesky replies (0-1) — minor amplifier
  var bskyComments = data.social ? data.social.recentComments : 0;
  if (bskyComments >= 75) bskyReplyScore = 1;
  else if (bskyComments >= 30) bskyReplyScore = 0.5;

  var total = Math.min(Math.round((statusScore + bskyScore + bskyReplyScore + redditScore) * 10) / 10, 10);

  return {
    total: total,
    breakdown: {
      status: statusScore,
      bluesky: bskyScore + bskyReplyScore,
      reddit: redditScore
    }
  };
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
        var post = {
          title: p.title, author: p.author, score: p.score,
          url: p.url, created: p.created, subreddit: p.subreddit,
          source: p.source, isMegathread: p.isMegathread || false
        };
        if (p.topComments && p.topComments.length > 0) post.topComments = p.topComments;
        return post;
      })
  };

  // Recalculate misery score with Reddit included
  var result = calculateMisery(existing, existing.reddit);
  existing.miseryIndex = result.total;
  existing.breakdown = result.breakdown;

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
function baseEmbed(data) {
  return new EmbedBuilder()
    .setAuthor(BOT_AUTHOR)
    .setFooter({ text: "Claude Developer Misery Index" })
    .setTimestamp(new Date(data.lastUpdated));
}

function buildMiseryEmbed(data) {
  var level = getLevel(data.miseryIndex);
  var status = data.status && data.status.status ? data.status.status.description : "Unknown";
  var bskyPosts = data.social ? data.social.recentPosts : 0;
  var bskyReplies = data.social ? data.social.recentComments : 0;

  var reddit = data.reddit || {};
  var redditPosts = reddit.recentPosts || 0;
  var redditStale = "";
  if (reddit.lastFetched) {
    var redditAge = Math.round((Date.now() - new Date(reddit.lastFetched).getTime()) / 60000);
    if (redditAge > 30) redditStale = " \u26A0\uFE0F " + redditAge + "m ago";
  }

  var description = buildThermometer(data.miseryIndex) +
    "\n\u200B";

  return baseEmbed(data)
    .setTitle(level.emoji + "  " + level.label)
    .setURL(DASHBOARD_URL)
    .setDescription(description)
    .setColor(level.color)
    .setThumbnail(OG_IMAGE)
    .addFields(
      { name: "\uD83D\uDCE1 Status", value: status, inline: true },
      { name: "\uD83D\uDFE0 Reddit", value: redditPosts + " posts" + redditStale, inline: true },
      { name: "\uD83E\uDD8B Bluesky", value: bskyPosts + " posts, " + bskyReplies + " replies", inline: true },
      { name: "\u200B", value: "[View Dashboard](" + DASHBOARD_URL + ") \u2022 [Methodology](" + DASHBOARD_URL + "about.html) \u2022 [raggedydoc.com](" + SITE_URL + ")", inline: false }
    );
}

function buildAlertEmbed(data, oldLabel, newLabel) {
  var level = getLevel(data.miseryIndex);
  var oldLevel = null;
  for (var i = 0; i < LEVELS.length; i++) {
    if (LEVELS[i].label === oldLabel) { oldLevel = LEVELS[i]; break; }
  }
  var arrow = data.miseryIndex > previousScore ? "\u2B06\uFE0F" : "\u2B07\uFE0F";
  var status = data.status && data.status.status ? data.status.status.description : "Unknown";
  var reddit = data.reddit || {};
  var redditPosts = reddit.recentPosts || 0;
  var bskyPosts = data.social ? data.social.recentPosts : 0;

  var description = arrow + " " + (oldLevel ? oldLevel.emoji : "\u26AA") + " **" + oldLabel + "** \u2192 " + level.emoji + " **" + newLabel + "**" +
    "\n\n" +
    buildThermometer(data.miseryIndex) +
    "\n\u200B";

  return baseEmbed(data)
    .setTitle("\uD83D\uDEA8 Misery Level Change")
    .setURL(DASHBOARD_URL)
    .setDescription(description)
    .setColor(level.color)
    .setThumbnail(OG_IMAGE)
    .addFields(
      { name: "\uD83D\uDCE1 Status", value: status, inline: true },
      { name: "\uD83D\uDFE0 Reddit", value: redditPosts + " posts", inline: true },
      { name: "\uD83E\uDD8B Bluesky", value: bskyPosts + " posts", inline: true },
      { name: "\u200B", value: "[View Dashboard](" + DASHBOARD_URL + ")", inline: false }
    );
}

function buildIncidentsEmbed(data) {
  var incidents = data.incidents || [];
  var embed = baseEmbed(data)
    .setTitle("\uD83D\uDCC3 Recent Incidents")
    .setURL("https://status.claude.com")
    .setColor(0x546E7A);

  if (incidents.length === 0) {
    embed.setDescription("\u2705 No recent incidents. Smooth sailing.\n\u200B");
    embed.addFields({ name: "\u200B", value: "[Status Page](https://status.claude.com) \u2022 [Dashboard](" + DASHBOARD_URL + ")", inline: false });
    return embed;
  }

  var impactEmoji = { critical: "\uD83D\uDD34", major: "\uD83D\uDFE0", minor: "\uD83D\uDFE1", none: "\u26AA" };
  var statusEmoji = { resolved: "\u2705", monitoring: "\uD83D\uDC41\uFE0F", investigating: "\uD83D\uDD0D", identified: "\uD83D\uDCCC", postmortem: "\uD83D\uDCDD" };

  incidents.slice(0, 5).forEach(function (inc) {
    var emoji = impactEmoji[inc.impact] || "\u26AA";
    var sEmoji = statusEmoji[inc.status] || "\u2753";
    var created = inc.createdAt ? timeAgo(inc.createdAt) : "";
    var updated = inc.updatedAt ? timeAgo(inc.updatedAt) : "";

    var title = emoji + " " + inc.name;
    var value = sEmoji + " " + (inc.status || "unknown");
    if (created) value += " \u00b7 " + created;
    if (updated && updated !== created) value += " \u00b7 updated " + updated;

    var latestUpdate = inc.updates && inc.updates.length > 0 ? inc.updates[0] : null;
    if (latestUpdate && latestUpdate.body) {
      value += "\n> " + truncate(latestUpdate.body, 150).replace(/\n/g, " ");
    }
    if (inc.url) value += "\n[View on Status Page](" + inc.url + ")";

    embed.addFields({ name: title, value: value });
  });

  embed.addFields({ name: "\u200B", value: "[Status Page](https://status.claude.com) \u2022 [Dashboard](" + DASHBOARD_URL + ")", inline: false });
  return embed;
}

function buildSocialEmbed(data) {
  var social = data.social || {};
  var posts = social.topPosts || [];
  var embed = baseEmbed(data)
    .setTitle("\uD83E\uDD8B Bluesky Chatter (24h)")
    .setURL("https://bsky.app/search?q=claude+outage")
    .setColor(0x0085FF);

  if (posts.length === 0) {
    embed.setDescription("No recent complaint posts found on Bluesky.\n\u200B");
    embed.addFields({ name: "\u200B", value: "[Dashboard](" + DASHBOARD_URL + ") \u2022 [raggedydoc.com](" + SITE_URL + ")", inline: false });
    return embed;
  }

  embed.setDescription("**" + (social.recentPosts || 0) + " posts** \u2022 **" + (social.recentComments || 0) + " total replies**\n\u200B");

  posts.slice(0, 5).forEach(function (post) {
    var score = post.score != null ? post.score : 0;
    var author = post.author || "unknown";
    var title = truncate(post.title, 60);
    var url = post.url || "#";
    embed.addFields({
      name: score + " \u2665 \u2014 @" + author,
      value: "[" + title + "](" + url + ")"
    });
  });

  embed.addFields({ name: "\u200B", value: "[Dashboard](" + DASHBOARD_URL + ") \u2022 [raggedydoc.com](" + SITE_URL + ")", inline: false });
  return embed;
}

function buildRedditEmbed(data) {
  var reddit = data.reddit || {};
  var posts = reddit.topPosts || [];
  var staleMs = reddit.lastFetched ? Date.now() - new Date(reddit.lastFetched).getTime() : Infinity;
  var staleMin = Math.round(staleMs / 60000);
  var staleNote = staleMin > 30 ? " \u26A0\uFE0F stale (" + staleMin + "m ago)" : "";

  var embed = baseEmbed(data)
    .setTitle("\uD83D\uDFE0 Reddit Chatter" + staleNote)
    .setURL("https://www.reddit.com/r/ClaudeAI/")
    .setColor(0xFF4500);

  if (!reddit.lastFetched) {
    embed.setDescription("No Reddit data yet. Bot needs to run a poll cycle first.\n\u200B");
    embed.addFields({ name: "\u200B", value: "[Dashboard](" + DASHBOARD_URL + ")", inline: false });
    return embed;
  }

  if (posts.length === 0) {
    embed.setDescription("No recent complaint posts found on Reddit.\n\u200B");
    embed.addFields({ name: "\u200B", value: "[Dashboard](" + DASHBOARD_URL + ") \u2022 [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/)", inline: false });
    return embed;
  }

  embed.setDescription("**" + (reddit.recentPosts || 0) + " posts** \u2022 **" + (reddit.recentComments || 0) + " total comments**\n\u200B");

  posts.slice(0, 5).forEach(function (post) {
    var score = post.score != null ? post.score : 0;
    var sub = post.subreddit ? "r/" + post.subreddit : "";
    var title = truncate(post.title, 60);
    var url = post.url || "#";
    var mega = post.isMegathread ? " \uD83D\uDFE3 `MEGA`" : "";
    var comments = post.numComments || 0;

    var value = "[" + title + "](" + url + ")\n" + comments + " comments \u2022 u/" + (post.author || "unknown");

    // Show top comments for megathreads and high-engagement posts
    if (post.topComments && post.topComments.length > 0) {
      value += "\n";
      post.topComments.slice(0, 2).forEach(function (c) {
        value += "\n> \uD83D\uDD25 **" + c.score + "** \u2022 u/" + c.author + "\n> " + c.body.replace(/\n/g, " ");
      });
    }

    embed.addFields({
      name: score + " \u2B06 \u2014 " + sub + mega,
      value: value
    });
  });

  embed.addFields({ name: "\u200B", value: "[Dashboard](" + DASHBOARD_URL + ") \u2022 [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/) \u2022 [raggedydoc.com](" + SITE_URL + ")", inline: false });
  return embed;
}

// ── Poll Loop ───────────────────────────────────────────────
async function pollAndAlert(client) {
  console.log("[" + new Date().toISOString() + "] Polling...");

  // Fetch Reddit (not available from cloud IPs, so the bot handles it)
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
