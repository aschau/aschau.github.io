#!/usr/bin/env node
// Fetches Bluesky complaint data + Anthropic status, calculates misery index,
// and writes to tools/misery-index/data/current.json

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../tools/misery-index/data/current.json");
const FEED_FILE = path.join(__dirname, "../../tools/misery-index/data/feed.xml");
const OFFICIAL_FEED_FILE = path.join(__dirname, "../../tools/misery-index/data/feed-official.xml");
const MAX_HISTORY = 672; // 7 days at 15-min intervals
const USER_AGENT = "MiseryIndex/1.0 (https://www.raggedydoc.com/misery)";

// Search queries for Bluesky — focused on active outage/degradation, not general discussion
const SEARCH_QUERIES = [
  "claude is down", "claude outage", "claude not working",
  "claude broken", "claude rate limit", "claude usage limit",
  "claude overloaded", "claude unusable", "anthropic outage",
  "claude down again", "claude so slow", "can't use claude",
  "claude keeps crashing", "claude keeps failing",
  "#claudedown", "#claudeai outage", "#claudeai down",
  "#anthropic outage",
  "@anthropic.com down", "@anthropic.com outage"
];

// ── Bluesky API (authenticated) ──────────────────────────────
let bskyToken = null;

async function bskyLogin() {
  const handle = process.env.BSKY_HANDLE;
  const password = process.env.BSKY_APP_PASSWORD;

  if (!handle || !password) {
    console.log("No Bluesky credentials found — skipping social data");
    return false;
  }

  try {
    const res = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ identifier: handle, password: password })
    });

    if (!res.ok) {
      console.error("Bluesky login failed:", res.status, await res.text());
      return false;
    }

    const data = await res.json();
    bskyToken = data.accessJwt;
    console.log("Bluesky authenticated as", data.handle);
    return true;
  } catch (e) {
    console.error("Bluesky login error:", e.message);
    return false;
  }
}

async function bskySearch(query) {
  if (!bskyToken) return [];

  try {
    const url = `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=30&sort=latest`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${bskyToken}`,
        "User-Agent": USER_AGENT
      }
    });

    if (!res.ok) {
      console.error(`Bluesky search failed (${res.status}) for: ${query}`);
      return [];
    }

    const data = await res.json();
    return data.posts || [];
  } catch (e) {
    console.error("Bluesky search error:", e.message);
    return [];
  }
}

function bskyPostUrl(uri) {
  // Convert at:// URI to web URL
  // at://did:plc:xxx/app.bsky.feed.post/yyy -> https://bsky.app/profile/did:plc:xxx/post/yyy
  var parts = uri.replace("at://", "").split("/");
  if (parts.length >= 3) {
    return "https://bsky.app/profile/" + parts[0] + "/post/" + parts[2];
  }
  return "https://bsky.app";
}

async function searchBluesky() {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const seenUris = new Set();
  const allPosts = [];

  for (const query of SEARCH_QUERIES) {
    const results = await bskySearch(query);

    results.forEach(function (post) {
      // Deduplicate
      if (seenUris.has(post.uri)) return;
      seenUris.add(post.uri);

      var createdAt = new Date(post.indexedAt || post.record?.createdAt).getTime();
      if (createdAt < dayAgo) return;

      var text = (post.record?.text || "").toLowerCase();
      // Must mention Claude in an AI context — filter out posts about people named Claude, etc.
      var hasAnthropic = text.includes("anthropic");
      var hasClaude = text.includes("claude");
      if (!hasClaude && !hasAnthropic) return;

      // Must be AI-related (not a person named Claude)
      var AI_CONTEXT = ["ai", "api", "llm", "chatbot", "model", "token", "prompt", "code",
        "coding", "sonnet", "opus", "haiku", "anthropic", "claude.ai", "cursor",
        "copilot", "chatgpt", "openai", "gemini", "developer", "programming",
        "vibe cod", "agentic", "context window", "rate limit", "usage limit"];
      if (hasClaude && !hasAnthropic) {
        var hasContext = AI_CONTEXT.some(function (w) { return text.includes(w); });
        if (!hasContext) return;
      }

      // ── Strong outage signals (count alone) ──
      var STRONG_OUTAGE = [
        "is down", "went down", "goes down", "going down",
        "outage", "not working",
        "can't use", "cant use", "won't work", "doesn't work", "stopped working",
        "keeps crashing", "keeps failing",
        "overloaded", "500 error", "502", "503", "504",
        "please fix", "is it just me"
      ];

      // ── Usage frustration signals ──
      var USAGE_SIGNALS = [
        "rate limit", "token limit", "usage limit", "message limit",
        "limit reached", "hit the limit", "hit my limit", "out of messages",
        "throttl", "capped", "usage cap", "daily limit", "pro limit",
        "token usage", "burning my usage", "burning usage", "save token",
        "burn through token", "eating my token", "eating token",
        "wasting token", "draining token", "token drain"
      ];

      // ── Weak outage signals (need 2+ or frustration) ──
      var WEAK_OUTAGE = [
        "unavailable", "degraded", "so slow", "broken",
        "nerfed", "bug", "buggy", "unusable"
      ];

      // ── False-positive exclusions (synced with bot.js BSKY_EXCLUSIONS) ──
      var EXCLUSIONS = [
        "was down", "were down", "was broken", "was unusable",
        "remember when", "last week", "last month", "yesterday",
        "used to be", "months ago", "back when",
        "fixed the bug", "fixed a bug", "found the bug", "helped me",
        "love claude", "claude is great", "claude is amazing",
        "impressed", "works great", "working great", "working well",
        "back up", "is back", "working again", "resolved",
        "addicted", "withdrawal", "forgot how to code", "lost without",
        "can't code without", "dependent on", "dependency on",
        "switched to", "switching to", "going back to", "gave up on",
        "switched from", "moved to",
        "worse than", "better than", "compared to",
        "sucks", "terrible", "garbage", "useless"
      ];

      // Check exclusions first — if any match near "claude", skip this post
      var isExcluded = EXCLUSIONS.some(function (w) {
        var idx = text.indexOf(w);
        while (idx !== -1) {
          var nearby = text.substring(Math.max(0, idx - 60), idx + w.length + 60);
          if (nearby.includes("claude") || nearby.includes("anthropic")) return true;
          idx = text.indexOf(w, idx + 1);
        }
        return false;
      });
      if (isExcluded) return;

      // Check for strong signal within 80 chars of "claude" or "anthropic"
      function hasSignalNearby(signals, radius) {
        return signals.some(function (w) {
          var idx = text.indexOf(w);
          while (idx !== -1) {
            var nearby = text.substring(Math.max(0, idx - radius), idx + w.length + radius);
            if (nearby.includes("claude") || nearby.includes("anthropic")) return true;
            idx = text.indexOf(w, idx + 1);
          }
          return false;
        });
      }

      var hasFrustration = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful|ridiculous|forcing|ruining|unusable|unbearable|fed up|absurd|insane|unacceptable|rethink|give up|giving up)\b/i.test(text);
      var bskyCategory = false;

      // Strong outage → immediate "outage"
      if (hasSignalNearby(STRONG_OUTAGE, 80)) {
        bskyCategory = "outage";
      // Usage signals → "usage" with corroboration
      } else if (hasSignalNearby(USAGE_SIGNALS, 80)) {
        var usageCount = USAGE_SIGNALS.filter(function (w) { return text.includes(w); }).length;
        if (usageCount >= 2 || hasFrustration || (post.likeCount || 0) >= 5) bskyCategory = "usage";
      }
      // Weak outage → "outage" with corroboration
      if (!bskyCategory && hasSignalNearby(WEAK_OUTAGE, 80)) {
        var weakCount = WEAK_OUTAGE.filter(function (w) { return text.includes(w); }).length;
        if (weakCount >= 2 || hasFrustration) bskyCategory = "outage";
      }
      if (!bskyCategory) return;

      allPosts.push({
        title: truncateText(post.record?.text || "", 120),
        author: post.author?.handle || "unknown",
        score: post.likeCount || 0,
        numComments: post.replyCount || 0,
        url: bskyPostUrl(post.uri),
        created: post.indexedAt || post.record?.createdAt || new Date().toISOString(),
        source: "bluesky",
        category: bskyCategory
      });
    });

    // Brief pause between searches to be polite
    await new Promise(function (r) { setTimeout(r, 500); });
  }

  console.log(`Bluesky: ${allPosts.length} posts found`);
  return allPosts;
}

function truncateText(text, len) {
  // Clean up newlines for display
  var clean = text.replace(/\n+/g, " ").trim();
  if (clean.length <= len) return clean;
  return clean.substring(0, len) + "...";
}

// ── Anthropic Status ─────────────────────────────────────────
async function getAnthropicStatus() {
  try {
    const res = await fetch("https://status.claude.com/api/v2/summary.json", {
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      console.error("Status fetch failed:", res.status);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error("Status fetch error:", e.message);
    return null;
  }
}

// ── Anthropic Incidents ──────────────────────────────────────
async function getRecentIncidents() {
  try {
    const res = await fetch("https://status.claude.com/api/v2/incidents.json", {
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      console.error("Incidents fetch failed:", res.status);
      return [];
    }

    const data = await res.json();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return (data.incidents || [])
      .filter(function (inc) {
        return new Date(inc.created_at).getTime() >= sevenDaysAgo;
      })
      .slice(0, 10)
      .map(function (inc) {
        return {
          name: inc.name,
          status: inc.status,
          impact: inc.impact,
          createdAt: inc.created_at,
          updatedAt: inc.updated_at,
          url: inc.shortlink || ("https://status.claude.com/incidents/" + inc.id),
          updates: (inc.incident_updates || []).slice(0, 3).map(function (u) {
            return { status: u.status, body: u.body, createdAt: u.created_at };
          })
        };
      });
  } catch (e) {
    console.error("Incidents fetch error:", e.message);
    return [];
  }
}

// ── Misery Levels ───────────────────────────────────────────
var MISERY_LEVELS = [
  { max: 1, label: "ALL CLEAR" },
  { max: 3, label: "MINOR GRUMBLING" },
  { max: 6, label: "GROWING UNREST" },
  { max: 8, label: "FULL MELTDOWN" },
  { max: 10, label: "APOCALYPSE" }
];

function getMiseryLevel(index) {
  for (var i = 0; i < MISERY_LEVELS.length; i++) {
    if (index <= MISERY_LEVELS[i].max) return MISERY_LEVELS[i].label;
  }
  return MISERY_LEVELS[MISERY_LEVELS.length - 1].label;
}

// ── Misery Calculation ───────────────────────────────────────
var REDDIT_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function calculateMisery(statusData, bskyPosts, bskyComments, redditData) {
  var statusScore = 0;
  var redditScore = 0;
  var bskyScore = 0;
  var bskyReplyScore = 0;

  // Status page (0-8)
  if (statusData?.status) {
    const indicator = statusData.status.indicator;
    if (indicator === "minor") statusScore += 2;
    else if (indicator === "major") statusScore += 4;
    else if (indicator === "critical") statusScore += 6;

    if (statusData.components) {
      const badComponents = statusData.components.filter(function (c) {
        return c.status !== "operational" &&
          c.name !== "Visit https://status.claude.com for more information";
      });
      statusScore += Math.min(badComponents.length * 0.5, 2);
    }
  }

  // Reddit (0-5) — only if data is fresh, split by outage/usage
  var redditOutageScore = 0;
  var redditUsageScore = 0;
  if (redditData && redditData.lastFetched) {
    var redditAge = Date.now() - new Date(redditData.lastFetched).getTime();
    if (redditAge < REDDIT_STALE_MS) {
      var megathreads = (redditData.topPosts || []).filter(function (p) { return p.isMegathread; }).length;
      var rPosts = (redditData.recentPosts || 0) + (megathreads * 4);
      if (rPosts >= 30) redditScore = 5;
      else if (rPosts >= 20) redditScore = 4;
      else if (rPosts >= 10) redditScore = 3;
      else if (rPosts >= 5) redditScore = 2;
      else if (rPosts >= 3) redditScore = 1;
      else if (rPosts >= 1) redditScore = 0.5;

      var outageN = redditData.outagePosts || 0;
      var usageN = redditData.usagePosts || 0;
      var totalN = outageN + usageN;
      if (totalN > 0) {
        redditOutageScore = Math.round(redditScore * (outageN / totalN) * 10) / 10;
        redditUsageScore = Math.round(redditScore * (usageN / totalN) * 10) / 10;
      } else {
        redditOutageScore = redditScore;
      }
    }
  }

  // Bluesky posts (0-2)
  if (bskyPosts >= 30) bskyScore = 2;
  else if (bskyPosts >= 15) bskyScore = 1.5;
  else if (bskyPosts >= 5) bskyScore = 1;
  else if (bskyPosts >= 1) bskyScore = 0.5;

  // Bluesky replies (0-1)
  if (bskyComments >= 75) bskyReplyScore = 1;
  else if (bskyComments >= 30) bskyReplyScore = 0.5;

  var total = Math.min(Math.round((statusScore + bskyScore + bskyReplyScore + redditScore) * 10) / 10, 10);

  return {
    total: total,
    breakdown: {
      status: statusScore,
      bluesky: bskyScore + bskyReplyScore,
      redditOutage: redditOutageScore,
      redditUsage: redditUsageScore
    }
  };
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("Fetching misery data...");

  // Load existing data
  let existing = { history: [] };
  try {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!Array.isArray(existing.history)) existing.history = [];
  } catch (e) {
    console.log("No existing data file, starting fresh");
  }

  // Fetch status + incidents + Bluesky auth in parallel
  const [statusData, incidents, bskyLoggedIn] = await Promise.all([
    getAnthropicStatus(),
    getRecentIncidents(),
    bskyLogin()
  ]);

  // Fetch Bluesky posts
  const posts = bskyLoggedIn ? await searchBluesky() : [];

  const postCount = posts.length;
  const commentCount = posts.reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);

  // Preserve Reddit data from existing file (written by Discord bot)
  const redditData = existing.reddit || null;
  const miseryResult = calculateMisery(statusData, postCount, commentCount, redditData);
  const miseryIndex = miseryResult.total;

  console.log(`Status: ${statusData?.status?.description || "unknown"}`);
  console.log(`Incidents (7d): ${incidents.length}`);
  console.log(`Bluesky: ${postCount} posts, ${commentCount} replies`);
  if (redditData) {
    var redditAge = Math.round((Date.now() - new Date(redditData.lastFetched).getTime()) / 60000);
    console.log(`Reddit: ${redditData.recentPosts} posts (${redditAge}m old)`);
  }
  console.log(`Misery Index: ${miseryIndex}`);

  // Build output — sort by score
  const now = new Date().toISOString();
  const topPosts = posts
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 10)
    .map(function (p) {
      return {
        title: p.title, author: p.author, score: p.score,
        url: p.url, created: p.created, source: p.source,
        category: p.category
      };
    });

  // Append to history
  existing.history.push({
    timestamp: now,
    miseryIndex: miseryIndex,
    statusIndicator: statusData?.status?.indicator || "unknown",
    postCount: postCount,
    commentCount: commentCount
  });

  // Trim history to max size
  if (existing.history.length > MAX_HISTORY) {
    existing.history = existing.history.slice(-MAX_HISTORY);
  }

  // Track when misery levels last changed (for stable RSS GUIDs/pubDates)
  var currentLevel = getMiseryLevel(miseryIndex);
  var prevLevel = existing.lastLevel || null;
  var lastLevelChangeTime = (currentLevel !== prevLevel)
    ? now
    : (existing.lastLevelChangeTime || now);

  var officialScore = miseryResult.breakdown.status;
  var currentOfficialLevel = getMiseryLevel(officialScore);
  var prevOfficialLevel = existing.lastOfficialLevel || null;
  var lastOfficialLevelChangeTime = (currentOfficialLevel !== prevOfficialLevel)
    ? now
    : (existing.lastOfficialLevelChangeTime || now);

  const output = {
    lastUpdated: now,
    miseryIndex: miseryIndex,
    lastLevel: currentLevel,
    lastLevelChangeTime: lastLevelChangeTime,
    lastOfficialLevel: currentOfficialLevel,
    lastOfficialLevelChangeTime: lastOfficialLevelChangeTime,
    officialScore: officialScore,
    status: statusData || null,
    social: {
      recentPosts: postCount,
      recentComments: commentCount,
      topPosts: topPosts
    },
    reddit: redditData,
    incidents: incidents,
    history: existing.history
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  console.log("Data written to", DATA_FILE);

  // Generate RSS feeds (all sources + official only)
  generateRssFeeds(output);
}

// ── RSS Feed Generation ─────────────────────────────────────
function generateRssFeeds(data) {

  function escapeXml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function buildIncidentItems(incidents) {
    var items = [];
    (incidents || []).slice(0, 5).forEach(function (inc) {
      var incDate = inc.updatedAt || inc.createdAt;
      items.push(
        "    <item>\n" +
        "      <title>[" + escapeXml((inc.impact || "info").toUpperCase()) + "] " + escapeXml(inc.name) + "</title>\n" +
        "      <link>" + escapeXml(inc.url || "https://status.claude.com") + "</link>\n" +
        "      <guid isPermaLink=\"false\">incident-" + escapeXml(inc.url || inc.name) + "</guid>\n" +
        "      <pubDate>" + new Date(incDate).toUTCString() + "</pubDate>\n" +
        "      <description>" + escapeXml(
          "Status: " + (inc.status || "unknown") + ". Impact: " + (inc.impact || "none") + "." +
          (inc.updates && inc.updates[0] ? " Latest: " + inc.updates[0].body : "")
        ) + "</description>\n" +
        "      <category>incident</category>\n" +
        "    </item>"
      );
    });
    return items;
  }

  function buildFeed(opts) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
      '  <channel>\n' +
      '    <title>' + escapeXml(opts.title) + '</title>\n' +
      '    <link>https://www.raggedydoc.com/tools/misery-index/</link>\n' +
      '    <description>' + escapeXml(opts.description) + '</description>\n' +
      '    <language>en-us</language>\n' +
      '    <lastBuildDate>' + new Date(opts.now).toUTCString() + '</lastBuildDate>\n' +
      '    <ttl>15</ttl>\n' +
      '    <atom:link href="' + opts.selfUrl + '" rel="self" type="application/rss+xml"/>\n' +
      '    <image>\n' +
      '      <url>https://www.raggedydoc.com/tools/misery-index/favicon.png</url>\n' +
      '      <title>' + escapeXml(opts.title) + '</title>\n' +
      '      <link>https://www.raggedydoc.com/tools/misery-index/</link>\n' +
      '    </image>\n' +
      opts.items.join("\n") + "\n" +
      '  </channel>\n' +
      '</rss>\n';
  }

  var now = data.lastUpdated || new Date().toISOString();
  var statusDesc = data.status && data.status.status ? data.status.status.description : "Unknown";
  var incidentItems = buildIncidentItems(data.incidents);

  // ── All Sources feed ────────────────────────────────────────
  var allLevel = data.lastLevel;
  var allLevelChangeTime = data.lastLevelChangeTime;
  var allItems = [];

  var apiStatus = "Unknown";
  if (data.status && data.status.components) {
    var apiComp = data.status.components.find(function (c) {
      return c.name.toLowerCase().indexOf("api") !== -1;
    });
    if (apiComp) apiStatus = apiComp.status.replace(/_/g, " ");
  }

  allItems.push(
    "    <item>\n" +
    "      <title>Misery Index: " + escapeXml(data.miseryIndex.toFixed(1)) + "/10 — " + escapeXml(allLevel) + "</title>\n" +
    "      <link>https://www.raggedydoc.com/tools/misery-index/</link>\n" +
    "      <guid isPermaLink=\"false\">misery-" + escapeXml(allLevel) + "</guid>\n" +
    "      <pubDate>" + new Date(allLevelChangeTime).toUTCString() + "</pubDate>\n" +
    "      <description>" + escapeXml(
      "Score: " + data.miseryIndex.toFixed(1) + "/10 (" + allLevel + "). " +
      "Status: " + statusDesc + ". " +
      "API: " + apiStatus + ". " +
      "Bluesky: " + (data.social ? data.social.recentPosts : 0) + " posts. " +
      (data.reddit ? "Reddit: " + (data.reddit.recentPosts || 0) + " posts." : "")
    ) + "</description>\n" +
    "      <category>misery-score</category>\n" +
    "    </item>"
  );

  fs.writeFileSync(FEED_FILE, buildFeed({
    title: "Claude Developer Misery Index",
    description: "Real-time Claude AI reliability tracking — misery score, API status, and incident alerts. Updated every 15 minutes.",
    selfUrl: "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/feed.xml",
    now: now,
    items: allItems.concat(incidentItems)
  }));
  console.log("RSS feed written to", FEED_FILE);

  // ── Official Only feed ──────────────────────────────────────
  var officialScore = data.officialScore;
  var officialLevel = data.lastOfficialLevel;
  var officialLevelChangeTime = data.lastOfficialLevelChangeTime;
  var officialItems = [];

  officialItems.push(
    "    <item>\n" +
    "      <title>Official Status: " + escapeXml(officialScore.toFixed(1)) + "/10 — " + escapeXml(officialLevel) + "</title>\n" +
    "      <link>https://www.raggedydoc.com/tools/misery-index/</link>\n" +
    "      <guid isPermaLink=\"false\">official-" + escapeXml(officialLevel) + "</guid>\n" +
    "      <pubDate>" + new Date(officialLevelChangeTime).toUTCString() + "</pubDate>\n" +
    "      <description>" + escapeXml(
      "Official score: " + officialScore.toFixed(1) + "/10 (" + officialLevel + "). " +
      "Status: " + statusDesc + "."
    ) + "</description>\n" +
    "      <category>official-status</category>\n" +
    "    </item>"
  );

  fs.writeFileSync(OFFICIAL_FEED_FILE, buildFeed({
    title: "Claude Developer Misery Index — Official Only",
    description: "Claude AI reliability based on official Anthropic status page only. No social chatter. Updated every 15 minutes.",
    selfUrl: "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/feed-official.xml",
    now: now,
    items: officialItems.concat(incidentItems)
  }));
  console.log("Official RSS feed written to", OFFICIAL_FEED_FILE);
}

main().catch(function (e) {
  console.error("Fatal error:", e);
  process.exit(1);
});
