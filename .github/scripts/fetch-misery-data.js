#!/usr/bin/env node
// Fetches Reddit complaint data + Anthropic status, calculates misery index,
// and writes to tools/misery-index/data/current.json

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../tools/misery-index/data/current.json");
const MAX_HISTORY = 672; // 7 days at 15-min intervals
// Reddit requires a descriptive User-Agent following their bot format, otherwise
// it returns 403 from cloud IPs (GitHub Actions, AWS, etc.)
const USER_AGENT = "web:misery-index:v1.0 (by /u/RaggedyDocTV)";

// Complaint keywords for filtering subreddit posts
const COMPLAINT_KEYWORDS = [
  "down", "outage", "error", "broken", "not working", "overloaded",
  "slow", "500", "unavailable", "rate limit", "token limit",
  "nerfed", "degraded", "worse", "unusable", "usage limit",
  "message limit", "throttl", "capped"
];

// Subreddits to scan for complaint posts
const SUBREDDITS = ["ClaudeAI", "anthropic"];

// ── Reddit Public JSON API (no auth required) ───────────────
async function fetchRedditJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (!res.ok) {
    console.error(`Reddit fetch failed (${res.status}): ${url}`);
    return null;
  }

  return res.json();
}

async function searchReddit() {
  // Public search endpoint — no auth needed, ~10 req/min limit
  const query = '"claude down" OR "claude outage" OR "claude not working" OR "claude broken" OR "claude error" OR "claude overloaded" OR "claude slow" OR "claude nerfed" OR "claude rate limit" OR "claude unusable" OR "claude token limit" OR "claude usage limit" OR "claude message limit"';
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=day&limit=100&type=link`;

  const data = await fetchRedditJSON(url);
  if (!data) return [];

  return (data.data?.children || [])
    .filter(function (c) {
      // Filter out false positives — title must mention Claude or Anthropic
      var title = (c.data.title || "").toLowerCase();
      return title.includes("claude") || title.includes("anthropic");
    })
    .map(function (c) {
      return {
        title: c.data.title,
        subreddit: c.data.subreddit,
        score: c.data.score,
        numComments: c.data.num_comments,
        url: `https://reddit.com${c.data.permalink}`,
        created: new Date(c.data.created_utc * 1000).toISOString()
      };
    });
}

async function getSubredditComplaints() {
  let totalComments = 0;

  for (const sub of SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=50`;
      const data = await fetchRedditJSON(url);
      if (!data) continue;

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      const recentPosts = (data.data?.children || []).filter(function (c) {
        var created = c.data.created_utc * 1000;
        var title = (c.data.title || "").toLowerCase();
        return created >= dayAgo && COMPLAINT_KEYWORDS.some(function (kw) {
          return title.includes(kw);
        });
      });

      recentPosts.forEach(function (c) {
        totalComments += c.data.num_comments || 0;
      });

      // Brief pause between subreddit requests to respect rate limits
      if (SUBREDDITS.indexOf(sub) < SUBREDDITS.length - 1) {
        await new Promise(function (r) { setTimeout(r, 2000); });
      }
    } catch (e) {
      console.error(`Error fetching r/${sub}:`, e.message);
    }
  }

  return totalComments;
}

// ── Reddit Megathreads ───────────────────────────────────────
const MEGATHREAD_KEYWORDS = ["megathread", "mega thread", "weekly thread", "discussion thread"];
const MEGATHREAD_TOPICS = ["performance", "bug", "limit", "usage", "outage", "issue", "error", "down"];

async function getMegathreads() {
  await new Promise(function (r) { setTimeout(r, 2000); });

  // Search r/ClaudeAI for megathreads — they're typically pinned or recent
  const url = "https://www.reddit.com/r/ClaudeAI/search.json?q=megathread&sort=new&restrict_sr=on&t=month&limit=10";
  const data = await fetchRedditJSON(url);
  if (!data) return { posts: [], commentCount: 0 };

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const threads = (data.data?.children || [])
    .filter(function (c) {
      var title = (c.data.title || "").toLowerCase();
      var created = c.data.created_utc * 1000;
      var isMegathread = MEGATHREAD_KEYWORDS.some(function (kw) { return title.includes(kw); });
      var isRelevant = MEGATHREAD_TOPICS.some(function (t) { return title.includes(t); });
      // Include if it's a relevant megathread created in the last week, OR if it's stickied (ongoing)
      return isMegathread && isRelevant && (created >= weekAgo || c.data.stickied);
    })
    .map(function (c) {
      return {
        title: c.data.title,
        subreddit: c.data.subreddit,
        score: c.data.score,
        numComments: c.data.num_comments,
        url: `https://reddit.com${c.data.permalink}`,
        created: new Date(c.data.created_utc * 1000).toISOString(),
        isMegathread: true
      };
    });

  var commentCount = threads.reduce(function (sum, t) { return sum + (t.numComments || 0); }, 0);
  console.log(`Megathreads: ${threads.length} found, ${commentCount} total comments`);
  return { posts: threads, commentCount: commentCount };
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
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

    return (data.incidents || [])
      .filter(function (inc) {
        return new Date(inc.created_at).getTime() >= threeDaysAgo;
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

  // Reddit post volume contribution (0-4)
  if (postCount >= 20) score += 4;
  else if (postCount >= 10) score += 3;
  else if (postCount >= 5) score += 2;
  else if (postCount >= 2) score += 1;
  else if (postCount >= 1) score += 0.5;

  // Comment volume as amplifier (0-2)
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

  // Fetch status + incidents in parallel, then Reddit sequentially (rate limits)
  const [statusData, incidents] = await Promise.all([
    getAnthropicStatus(),
    getRecentIncidents()
  ]);

  // Reddit requests spaced out to respect public API rate limits
  console.log("Fetching Reddit data (public JSON, no auth)...");
  const posts = await searchReddit();

  // Brief pause before subreddit scan
  await new Promise(function (r) { setTimeout(r, 2000); });
  const subredditComments = await getSubredditComplaints();

  // Fetch megathreads (complaint aggregation posts)
  const megathreads = await getMegathreads();

  // Deduplicate by URL and title — megathreads first so they keep their badge
  const seenUrls = new Set();
  const seenTitles = new Set();
  const allPosts = megathreads.posts.concat(posts).filter(function (p) {
    var titleKey = (p.title || "").toLowerCase().trim();
    if (seenUrls.has(p.url) || seenTitles.has(titleKey)) return false;
    seenUrls.add(p.url);
    seenTitles.add(titleKey);
    return true;
  });
  const postCount = allPosts.filter(function (p) { return !p.isMegathread; }).length;
  // Comment count: regular posts + subreddit scan + megathreads (no double-counting)
  var megaUrls = new Set(megathreads.posts.map(function (p) { return p.url; }));
  const regularPostComments = posts
    .filter(function (p) { return !megaUrls.has(p.url); })
    .reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);
  const commentCount = subredditComments + megathreads.commentCount + regularPostComments;
  const miseryIndex = calculateMisery(statusData, postCount, commentCount);

  console.log(`Status: ${statusData?.status?.description || "unknown"}`);
  console.log(`Incidents (3d): ${incidents.length}`);
  console.log(`Reddit: ${postCount} posts, ${commentCount} comments (incl. megathreads)`);
  console.log(`Misery Index: ${miseryIndex}`);

  // Build output — megathreads sorted to top, then by score
  const now = new Date().toISOString();
  const topPosts = allPosts
    .sort(function (a, b) {
      if (a.isMegathread && !b.isMegathread) return -1;
      if (!a.isMegathread && b.isMegathread) return 1;
      return b.score - a.score;
    })
    .slice(0, 10)
    .map(function (p) {
      return {
        title: p.title, subreddit: p.subreddit, score: p.score,
        url: p.url, created: p.created, isMegathread: p.isMegathread || false
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
    reddit: {
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
