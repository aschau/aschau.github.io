#!/usr/bin/env node
// Fetches Bluesky complaint data + Anthropic status, calculates misery index,
// and writes to tools/misery-index/data/current.json

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../tools/misery-index/data/current.json");
const MAX_HISTORY = 672; // 7 days at 15-min intervals
const USER_AGENT = "MiseryIndex/1.0 (https://raggedydoc.com/misery)";

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

      // ── Outage/degradation signals (strong — actively experiencing a problem NOW) ──
      var STRONG_SIGNALS = [
        "is down", "went down", "goes down", "going down",
        "outage", "not working", "unavailable",
        "can't use", "cant use", "won't work", "doesn't work", "stopped working",
        "keeps crashing", "keeps failing",
        "overloaded", "500 error", "502", "503", "504",
        "please fix", "is it just me"
      ];

      // ── Degradation signals (weaker — could be normal grumbling, needs backup) ──
      var WEAK_SIGNALS = [
        "rate limit", "token limit", "usage limit", "message limit",
        "limit reached", "hit the limit", "hit my limit", "out of messages",
        "throttl", "capped", "degraded", "so slow", "unusable", "broken",
        "nerfed", "bug", "buggy"
      ];

      // ── False-positive exclusions — skip posts matching these patterns ──
      var EXCLUSIONS = [
        // Past tense / historical — not about a current issue
        "was down", "were down", "was broken", "was unusable",
        "remember when", "last week", "last month", "yesterday",
        "used to be", "months ago", "back when",
        // Positive sentiment that happens to contain complaint words
        "fixed the bug", "fixed a bug", "found the bug", "helped me",
        "love claude", "claude is great", "claude is amazing",
        "impressed", "works great", "working great", "working well",
        "back up", "is back", "working again", "resolved",
        // Dependency humor / memes (not actual complaints about current issues)
        "addicted", "withdrawal", "forgot how to code", "lost without",
        "can't code without", "dependent on", "dependency on",
        // Competitive switching (opinion, not outage)
        "switched to", "switching to", "going back to", "gave up on",
        "switched from", "moved to",
        // Generic hot takes / opinion pieces
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

      var hasStrong = hasSignalNearby(STRONG_SIGNALS, 80);
      var hasWeak = hasSignalNearby(WEAK_SIGNALS, 80);

      // Strong signal alone is enough. Weak signal needs at least 2 weak signals
      // or 1 weak signal + explicit frustration language to count.
      if (!hasStrong) {
        if (!hasWeak) return;
        // Count how many distinct weak signals appear
        var weakCount = WEAK_SIGNALS.filter(function (w) { return text.includes(w); }).length;
        var hasFrustration = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful|😡|🤬|💀)\b/i.test(text);
        if (weakCount < 2 && !hasFrustration) return;
      }

      allPosts.push({
        title: truncateText(post.record?.text || "", 120),
        author: post.author?.handle || "unknown",
        score: post.likeCount || 0,
        numComments: post.replyCount || 0,
        url: bskyPostUrl(post.uri),
        created: post.indexedAt || post.record?.createdAt || new Date().toISOString(),
        source: "bluesky"
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

// ── Misery Calculation ───────────────────────────────────────
var REDDIT_STALE_MS = 30 * 60 * 1000; // 30 minutes

function calculateMisery(statusData, bskyPosts, bskyComments, redditData) {
  let score = 0;

  // Status page contribution (0-8)
  if (statusData?.status) {
    const indicator = statusData.status.indicator;
    if (indicator === "minor") score += 2;
    else if (indicator === "major") score += 4;
    else if (indicator === "critical") score += 6;

    if (statusData.components) {
      const badComponents = statusData.components.filter(function (c) {
        return c.status !== "operational";
      });
      score += Math.min(badComponents.length * 0.5, 2);
    }
  }

  // Bluesky post volume contribution (0-4)
  if (bskyPosts >= 50) score += 4;
  else if (bskyPosts >= 30) score += 3;
  else if (bskyPosts >= 15) score += 2;
  else if (bskyPosts >= 5) score += 1;
  else if (bskyPosts >= 1) score += 0.5;

  // Bluesky comment/reply volume as amplifier (0-2)
  if (bskyComments >= 150) score += 2;
  else if (bskyComments >= 75) score += 1.5;
  else if (bskyComments >= 30) score += 1;
  else if (bskyComments >= 10) score += 0.5;

  // Reddit contribution — only if data is fresh (0-3)
  if (redditData && redditData.lastFetched) {
    var redditAge = Date.now() - new Date(redditData.lastFetched).getTime();
    if (redditAge < REDDIT_STALE_MS) {
      var rPosts = redditData.recentPosts || 0;
      if (rPosts >= 20) score += 3;
      else if (rPosts >= 10) score += 2;
      else if (rPosts >= 5) score += 1.5;
      else if (rPosts >= 3) score += 1;
      else if (rPosts >= 1) score += 0.5;
    }
  }

  return Math.min(Math.round(score * 10) / 10, 10);
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
  const miseryIndex = calculateMisery(statusData, postCount, commentCount, redditData);

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
        url: p.url, created: p.created, source: p.source
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

  const output = {
    lastUpdated: now,
    miseryIndex: miseryIndex,
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
}

main().catch(function (e) {
  console.error("Fatal error:", e);
  process.exit(1);
});
