#!/usr/bin/env node
// Fetches Bluesky complaint data + Anthropic status, calculates misery index,
// and writes to tools/misery-index/data/current.json

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../tools/misery-index/data/current.json");
const MAX_HISTORY = 672; // 7 days at 15-min intervals
const USER_AGENT = "MiseryIndex/1.0 (https://raggedydoc.com/misery)";

// Complaint keywords for filtering posts
const COMPLAINT_KEYWORDS = [
  "down", "outage", "error", "broken", "not working", "overloaded",
  "slow", "500", "unavailable", "rate limit", "token limit",
  "nerfed", "degraded", "worse", "unusable", "usage limit",
  "message limit", "throttl", "capped"
];

// Search queries for Bluesky — focused on complaints, not general discussion
const SEARCH_QUERIES = [
  "claude is down", "claude outage", "claude not working",
  "claude broken", "claude rate limit", "claude usage limit",
  "claude overloaded", "claude unusable", "anthropic outage",
  "claude down again", "claude so slow", "claude bug",
  "claude limit", "claude frustrat", "can't use claude",
  "claude keeps", "claude won't", "gave up on claude",
  "switched from claude", "claude sucks", "claude worse",
  "#claudedown", "#claudeai outage", "#claudeai limit",
  "#claudeai down", "#anthropic outage",
  "#claude down", "#claude limit", "#claude bug",
  "@anthropic.com down", "@anthropic.com outage",
  "@anthropic.com limit", "@anthropic.com broken"
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

      // Must express a complaint, outage, or dependency sentiment — strict matching
      var COMPLAINT_SIGNALS = [
        "is down", "went down", "goes down", "going down",
        "outage", "broken", "not working", "unusable", "unavailable",
        "rate limit", "token limit", "usage limit", "message limit", "limit reached",
        "hit the limit", "hit my limit", "out of messages", "throttl", "capped",
        "overloaded", "nerfed", "degraded", "bug", "buggy",
        "can't use", "cant use", "won't work", "doesn't work", "stopped working",
        "keeps crashing", "keeps failing", "keeps breaking",
        "frustrated", "annoying", "painful", "miserable", "suffering", "struggling",
        "sucks", "worse", "terrible", "garbage", "useless",
        "dependent", "dependency", "addicted", "withdrawal", "lost without",
        "forgot how", "can't code", "cant code", "without claude",
        "gave up", "switched to", "switching to", "going back to",
        "come back", "please fix", "is it just me"
      ];
      // Complaint signal must appear within 100 chars of "claude" or "anthropic"
      var hasComplaint = COMPLAINT_SIGNALS.some(function (w) {
        var idx = text.indexOf(w);
        while (idx !== -1) {
          var nearby = text.substring(Math.max(0, idx - 100), idx + w.length + 100);
          if (nearby.includes("claude") || nearby.includes("anthropic")) return true;
          idx = text.indexOf(w, idx + 1);
        }
        return false;
      });
      if (!hasComplaint) return;

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
function calculateMisery(statusData, postCount, commentCount) {
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

  // Social post volume contribution (0-4)
  if (postCount >= 20) score += 4;
  else if (postCount >= 10) score += 3;
  else if (postCount >= 5) score += 2;
  else if (postCount >= 2) score += 1;
  else if (postCount >= 1) score += 0.5;

  // Comment/reply volume as amplifier (0-2)
  if (commentCount >= 100) score += 2;
  else if (commentCount >= 50) score += 1.5;
  else if (commentCount >= 20) score += 1;
  else if (commentCount >= 5) score += 0.5;

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
  const miseryIndex = calculateMisery(statusData, postCount, commentCount);

  console.log(`Status: ${statusData?.status?.description || "unknown"}`);
  console.log(`Incidents (7d): ${incidents.length}`);
  console.log(`Bluesky: ${postCount} posts, ${commentCount} replies`);
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
