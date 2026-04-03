// Fetch all live data (status, incidents, Bluesky, Reddit) locally for dev testing.
// Run: node tools/misery-index/discord-bot/fetch-local-data.js

var fs = require("fs");
var path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

var DATA_FILE = path.join(__dirname, "../data/current.json");
var REMOTE_DATA = "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/current.json";
var STATUS_API = "https://status.claude.com/api/v2/summary.json";
var INCIDENTS_API = "https://status.claude.com/api/v2/incidents.json";
var REDDIT_USER_AGENT = "MiseryBot/1.0 (by u/raggedydoc)";

var REDDIT_SEARCHES = [
  { sub: "ClaudeAI", q: "megathread", t: "month" },
  { sub: "ClaudeAI", q: "down OR outage OR broken OR error", t: "week" },
  { sub: "ClaudeAI", q: "rate limit OR slow OR overloaded OR unusable", t: "week" },
  { sub: "ClaudeAI", q: "not working OR crashing OR degraded OR bug", t: "week" },
  { sub: "ChatGPT", q: "claude down OR claude outage", t: "day" }
];

var MEGA_KEYWORDS = ["megathread", "mega thread", "weekly thread", "discussion thread"];
var MEGA_TOPICS = ["performance", "bug", "limit", "usage", "outage", "issue", "error", "down"];

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

var STRONG_OUTAGE = [
  "is down", "went down", "goes down", "going down",
  "outage", "not working",
  "can't use", "cant use", "won't work", "doesn't work", "stopped working",
  "keeps crashing", "keeps failing",
  "overloaded", "500 error", "502", "503", "504",
  "please fix", "is it just me"
];

var WEAK_OUTAGE = [
  "unavailable", "degraded", "so slow", "broken", "nerfed", "bug", "buggy"
];

var USAGE_SIGNALS = [
  "rate limit", "token limit", "usage limit", "message limit",
  "limit reached", "hit the limit", "out of messages",
  "throttl", "capped", "usage cap", "daily limit",
  "pro limit", "max limit", "too many requests"
];

var SHOWCASE = ["i built", "i made", "i created", "introducing", "announcing",
  "check out", "open source", "open-source", "new tool", "new project",
  "released", "launching", "just shipped", "show r/",
  "tips", "guide", "tutorial", "how to use", "how i use",
  "my setup", "my workflow", "pipeline", "changed how",
  "i gave", "i tested", "i tried", "experiment", "benchmark",
  "review", "comparison", "versus", "vs "];

var META = ["against tos", "against the tos", "terms of service", "compliance",
  "policy", "allowed to", "is it okay to", "is it ok to",
  "follow-up on", "follow up on", "discussion about", "thoughts on"];

function truncate(str, len) {
  if (!str) return "";
  var clean = str.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.substring(0, len) + "..." : clean;
}

// Returns false (reject), "outage", or "usage"
function filterRedditPost(post, subreddit) {
  var text = (post.title + " " + (post.selftext || "")).toLowerCase();
  var titleLower = (post.title || "").toLowerCase();
  var isClaudeSub = subreddit === "ClaudeAI";
  if (!isClaudeSub) {
    if (!text.includes("claude") && !text.includes("anthropic")) return false;
  }
  if (EXCLUSIONS.some(function (w) { return text.includes(w); })) return false;
  if (SHOWCASE.some(function (w) { return titleLower.includes(w); })) return false;
  if (META.some(function (w) { return titleLower.includes(w); })) return false;

  var hasFrustration = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful|ridiculous|forcing|ruining|unusable|unbearable|fed up|absurd|insane|unacceptable|rethink|give up|giving up)\b/i.test(text)
    || /[!?]{2,}/.test(post.title || "");
  var isUserCode = /\b(my |i |we |our )(code|app|script|pipeline|project|build|setup)\b/.test(text)
    && !(/\bclaude.*(broke|broken|bug|crash)/i.test(text));

  var negated = text.replace(/\b(not a|not the|not an|isn't|isnt|is not|no |this is not|this isn't)\s*\w*\s*(bug|broken|error|outage|slow|degraded|unusable|unavailable)\b/gi, "");

  if (STRONG_OUTAGE.some(function (w) { return negated.includes(w); })) return "outage";

  var usageCount = USAGE_SIGNALS.filter(function (w) { return negated.includes(w); }).length;
  if (usageCount >= 1 && (hasFrustration || (post.score || 0) >= 5)) return "usage";
  if (usageCount >= 2) return "usage";

  if (!isUserCode) {
    var weakCount = WEAK_OUTAGE.filter(function (w) { return negated.includes(w); }).length;
    if (weakCount >= 2 || (weakCount >= 1 && hasFrustration)) return "outage";
  }

  return false;
}

async function redditSearch(query, subreddit, timeRange) {
  var url = "https://www.reddit.com/r/" + subreddit + "/search.json?q=" +
    encodeURIComponent(query) + "&sort=new&t=" + (timeRange || "day") + "&restrict_sr=on&limit=25";
  try {
    var res = await fetch(url, { headers: { "User-Agent": REDDIT_USER_AGENT } });
    if (!res.ok) { console.error("  FAIL (" + res.status + "): r/" + subreddit + " q=" + query); return []; }
    var data = await res.json();
    return (data.data && data.data.children) || [];
  } catch (e) { console.error("  ERROR:", e.message); return []; }
}

async function fetchJSON(url) {
  var res = await fetch(url, { headers: { "User-Agent": REDDIT_USER_AGENT } });
  if (!res.ok) throw new Error(url + " returned " + res.status);
  return res.json();
}

async function fetchReddit() {
  var dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var seenIds = new Set();
  var allPosts = [];

  for (var i = 0; i < REDDIT_SEARCHES.length; i++) {
    var search = REDDIT_SEARCHES[i];
    console.log("  r/" + search.sub + ": " + search.q + " (t=" + search.t + ")");
    var results = await redditSearch(search.q, search.sub, search.t);
    var cutoff = search.t === "month" ? monthAgo : search.t === "week" ? weekAgo : dayAgo;

    results.forEach(function (child) {
      var post = child.data;
      if (!post || seenIds.has(post.id)) return;
      seenIds.add(post.id);
      if (post.created_utc * 1000 < cutoff) return;

      var title = (post.title || "").toLowerCase();
      var hasMegaKeyword = MEGA_KEYWORDS.some(function (kw) { return title.includes(kw); });
      var hasMegaTopic = MEGA_TOPICS.some(function (t) { return title.includes(t); });
      var isMegathread = (hasMegaKeyword && hasMegaTopic) || post.stickied;

      var category = filterRedditPost(post, search.sub);
      if (!isMegathread && !category) return;
      if (!category) {
        var titleText = (post.title || "").toLowerCase();
        var isUsage = ["rate limit", "usage limit", "token limit", "message limit",
          "throttl", "capped", "usage cap", "daily limit", "pro limit"].some(function (w) { return titleText.includes(w); });
        category = isUsage ? "usage" : "outage";
      }

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
        isMegathread: isMegathread,
        category: category
      });

      console.log("    " + (isMegathread ? "[MEGA] " : "") + post.title.substring(0, 80) + " (" + post.num_comments + " comments)");
    });

    await new Promise(function (r) { setTimeout(r, 2000); });
  }

  // Fetch top comments for megathreads and high-engagement posts
  for (var j = 0; j < allPosts.length; j++) {
    var p = allPosts[j];
    if (p.isMegathread || p.numComments >= 10) {
      console.log("    Fetching comments for: " + p.title.substring(0, 50) + "...");
      try {
        var url = "https://www.reddit.com" + p.permalink + ".json?sort=top&limit=5";
        var cRes = await fetch(url, { headers: { "User-Agent": REDDIT_USER_AGENT } });
        if (cRes.ok) {
          var cData = await cRes.json();
          var comments = (cData[1] && cData[1].data && cData[1].data.children) || [];
          p.topComments = comments
            .filter(function (c) { return c.kind === "t1" && c.data && c.data.score >= 5; })
            .slice(0, 3)
            .map(function (c) {
              return {
                author: c.data.author || "unknown",
                score: c.data.score || 0,
                body: truncate(c.data.body || "", 150),
                created: new Date((c.data.created_utc || 0) * 1000).toISOString()
              };
            });
          console.log("      " + p.topComments.length + " top comments");
        }
      } catch (e) { console.log("      Comment fetch failed:", e.message); }
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
  }

  return allPosts;
}

// ── Bluesky ──────────────────────────────────────────────────
var BSKY_USER_AGENT = "MiseryBot/1.0 (https://www.raggedydoc.com/misery)";
var BSKY_QUERIES = [
  "claude is down", "claude outage", "claude not working",
  "claude broken", "claude rate limit", "claude usage limit",
  "claude overloaded", "claude unusable", "anthropic outage",
  "claude down again", "claude so slow", "can't use claude",
  "claude keeps crashing", "claude keeps failing",
  "#claudedown", "#claudeai outage", "#claudeai down",
  "#anthropic outage",
  "@anthropic.com down", "@anthropic.com outage"
];

var bskyToken = null;

async function bskyLogin() {
  var handle = process.env.BSKY_HANDLE;
  var password = process.env.BSKY_APP_PASSWORD;
  if (!handle || !password) { console.log("  No Bluesky credentials — skipping"); return false; }
  try {
    var res = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": BSKY_USER_AGENT },
      body: JSON.stringify({ identifier: handle, password: password })
    });
    if (!res.ok) { console.error("  Bluesky login failed:", res.status); return false; }
    var data = await res.json();
    bskyToken = data.accessJwt;
    console.log("  Bluesky authenticated as " + data.handle);
    return true;
  } catch (e) { console.error("  Bluesky login error:", e.message); return false; }
}

async function bskySearch(query) {
  if (!bskyToken) return [];
  try {
    var url = "https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=" + encodeURIComponent(query) + "&limit=30&sort=latest";
    var res = await fetch(url, {
      headers: { "Authorization": "Bearer " + bskyToken, "User-Agent": BSKY_USER_AGENT }
    });
    if (!res.ok) return [];
    var data = await res.json();
    return data.posts || [];
  } catch (e) { return []; }
}

function bskyPostUrl(uri) {
  var parts = uri.replace("at://", "").split("/");
  if (parts.length >= 3) return "https://bsky.app/profile/" + parts[0] + "/post/" + parts[2];
  return "https://bsky.app";
}

async function fetchBluesky() {
  var loggedIn = await bskyLogin();
  if (!loggedIn) return [];

  var dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  var seenUris = new Set();
  var allPosts = [];

  for (var i = 0; i < BSKY_QUERIES.length; i++) {
    var results = await bskySearch(BSKY_QUERIES[i]);

    results.forEach(function (post) {
      if (seenUris.has(post.uri)) return;
      seenUris.add(post.uri);

      var createdAt = new Date(post.indexedAt || (post.record && post.record.createdAt)).getTime();
      if (createdAt < dayAgo) return;

      var text = ((post.record && post.record.text) || "").toLowerCase();
      var hasAnthropic = text.includes("anthropic");
      var hasClaude = text.includes("claude");
      if (!hasClaude && !hasAnthropic) return;

      var AI_CONTEXT = ["ai", "api", "llm", "chatbot", "model", "token", "prompt", "code",
        "coding", "sonnet", "opus", "haiku", "anthropic", "claude.ai", "cursor",
        "copilot", "chatgpt", "openai", "gemini", "developer", "programming",
        "vibe cod", "agentic", "context window", "rate limit", "usage limit"];
      if (hasClaude && !hasAnthropic) {
        if (!AI_CONTEXT.some(function (w) { return text.includes(w); })) return;
      }

      var BSKY_EXCLUSIONS = [
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
      var isExcluded = BSKY_EXCLUSIONS.some(function (w) {
        var idx = text.indexOf(w);
        while (idx !== -1) {
          var nearby = text.substring(Math.max(0, idx - 60), idx + w.length + 60);
          if (nearby.includes("claude") || nearby.includes("anthropic")) return true;
          idx = text.indexOf(w, idx + 1);
        }
        return false;
      });
      if (isExcluded) return;

      var BSKY_STRONG_OUTAGE = ["is down", "went down", "goes down", "going down",
        "outage", "not working",
        "can't use", "cant use", "won't work", "doesn't work", "stopped working",
        "keeps crashing", "keeps failing",
        "overloaded", "500 error", "502", "503", "504",
        "please fix", "is it just me"];
      var BSKY_WEAK_OUTAGE = ["unavailable", "degraded", "so slow", "broken",
        "nerfed", "bug", "buggy", "unusable"];
      var BSKY_USAGE = ["rate limit", "token limit", "usage limit", "message limit",
        "limit reached", "hit the limit", "hit my limit", "out of messages",
        "throttl", "capped", "usage cap", "daily limit", "pro limit"];

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

      var bskyFrustration = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful|ridiculous|forcing|ruining|unusable|unbearable|fed up|absurd|insane|unacceptable|rethink|give up|giving up)\b/i.test(text);
      var bskyCategory = false;

      if (hasSignalNearby(BSKY_STRONG_OUTAGE, 80)) {
        bskyCategory = "outage";
      } else if (hasSignalNearby(BSKY_USAGE, 80)) {
        var usageCount = BSKY_USAGE.filter(function (w) { return text.includes(w); }).length;
        if (usageCount >= 2 || bskyFrustration || (post.likeCount || 0) >= 5) bskyCategory = "usage";
      }
      if (!bskyCategory && hasSignalNearby(BSKY_WEAK_OUTAGE, 80)) {
        var weakCount = BSKY_WEAK_OUTAGE.filter(function (w) { return text.includes(w); }).length;
        if (weakCount >= 2 || bskyFrustration) bskyCategory = "outage";
      }
      if (!bskyCategory) return;

      allPosts.push({
        title: truncate((post.record && post.record.text) || "", 120),
        author: (post.author && post.author.handle) || "unknown",
        score: post.likeCount || 0,
        numComments: post.replyCount || 0,
        url: bskyPostUrl(post.uri),
        created: post.indexedAt || (post.record && post.record.createdAt) || new Date().toISOString(),
        source: "bluesky",
        category: bskyCategory
      });
    });

    await new Promise(function (r) { setTimeout(r, 500); });
  }

  console.log("  Bluesky: " + allPosts.length + " posts found");
  return allPosts;
}

async function main() {
  var now = new Date().toISOString();

  // 1. Pull remote data as base (has history)
  console.log("Fetching remote data...");
  var data;
  try {
    data = await fetchJSON(REMOTE_DATA + "?t=" + Date.now());
    console.log("  Remote: misery " + data.miseryIndex + "/10");
  } catch (e) {
    console.log("  Remote unavailable (" + e.message + "), starting fresh");
    data = { history: [] };
  }

  // 2. Fetch live status
  console.log("Fetching status...");
  try {
    data.status = await fetchJSON(STATUS_API);
    console.log("  Status: " + (data.status.status ? data.status.status.description : "unknown"));
  } catch (e) {
    console.log("  Status fetch failed: " + e.message);
  }

  // 3. Fetch live incidents
  console.log("Fetching incidents...");
  try {
    var incData = await fetchJSON(INCIDENTS_API);
    var sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    data.incidents = (incData.incidents || [])
      .filter(function (inc) { return new Date(inc.created_at).getTime() >= sevenDaysAgo; })
      .slice(0, 10)
      .map(function (inc) {
        return {
          name: inc.name, status: inc.status, impact: inc.impact,
          createdAt: inc.created_at, updatedAt: inc.updated_at,
          url: inc.shortlink || ("https://status.claude.com/incidents/" + inc.id),
          updates: (inc.incident_updates || []).slice(0, 3).map(function (u) {
            return { status: u.status, body: u.body, createdAt: u.created_at };
          })
        };
      });
    console.log("  Incidents: " + data.incidents.length);
  } catch (e) {
    console.log("  Incidents fetch failed: " + e.message);
  }

  // 4. Fetch Bluesky
  console.log("Fetching Bluesky...");
  var bskyPosts = await fetchBluesky();
  if (bskyPosts.length > 0) {
    var bskyCommentCount = bskyPosts.reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);
    data.social = {
      recentPosts: bskyPosts.length,
      recentComments: bskyCommentCount,
      topPosts: bskyPosts.sort(function (a, b) { return b.score - a.score; }).slice(0, 10)
    };
  }

  // 5. Fetch Reddit
  console.log("Fetching Reddit...");
  var redditPosts = await fetchReddit();
  var commentCount = redditPosts.reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);
  var outagePosts = redditPosts.filter(function (p) { return p.category === "outage"; }).length;
  var usagePosts = redditPosts.filter(function (p) { return p.category === "usage"; }).length;
  data.reddit = {
    lastFetched: now,
    recentPosts: redditPosts.length,
    outagePosts: outagePosts,
    usagePosts: usagePosts,
    recentComments: commentCount,
    topPosts: redditPosts.sort(function (a, b) { return b.score - a.score; }).slice(0, 10)
  };
  console.log("  Reddit: " + redditPosts.length + " posts (" + outagePosts + " outage, " + usagePosts + " usage), " + commentCount + " comments");

  // Recalculate misery with all sources
  var bskyPosts = data.social ? data.social.recentPosts : 0;
  var bskyComments = data.social ? data.social.recentComments : 0;
  var statusScore = 0;
  var bskyScore = 0;
  var bskyReplyScore = 0;
  var redditScore = 0;

  if (data.status && data.status.status) {
    var indicator = data.status.status.indicator;
    if (indicator === "minor") statusScore = 2;
    else if (indicator === "major") statusScore = 4;
    else if (indicator === "critical") statusScore = 6;
    if (data.status.components) {
      var bad = data.status.components.filter(function (c) { return c.status !== "operational"; });
      statusScore += Math.min(bad.length * 0.5, 2);
    }
  }
  var megathreads = redditPosts.filter(function (p) { return p.isMegathread; }).length;
  var effectiveReddit = redditPosts.length + (megathreads * 4);
  if (effectiveReddit >= 30) redditScore = 5;
  else if (effectiveReddit >= 20) redditScore = 4;
  else if (effectiveReddit >= 10) redditScore = 3;
  else if (effectiveReddit >= 5) redditScore = 2;
  else if (effectiveReddit >= 3) redditScore = 1;
  else if (effectiveReddit >= 1) redditScore = 0.5;
  if (bskyPosts >= 30) bskyScore = 2;
  else if (bskyPosts >= 15) bskyScore = 1.5;
  else if (bskyPosts >= 5) bskyScore = 1;
  else if (bskyPosts >= 1) bskyScore = 0.5;
  if (bskyComments >= 75) bskyReplyScore = 1;
  else if (bskyComments >= 30) bskyReplyScore = 0.5;

  // Split reddit score by outage vs usage ratio
  var redditOutageScore = 0;
  var redditUsageScore = 0;
  var totalCat = outagePosts + usagePosts;
  if (totalCat > 0) {
    redditOutageScore = Math.round(redditScore * (outagePosts / totalCat) * 10) / 10;
    redditUsageScore = Math.round(redditScore * (usagePosts / totalCat) * 10) / 10;
  } else {
    redditOutageScore = redditScore;
  }

  data.miseryIndex = Math.min(Math.round((statusScore + bskyScore + bskyReplyScore + redditScore) * 10) / 10, 10);
  data.breakdown = { status: statusScore, bluesky: bskyScore + bskyReplyScore, redditOutage: redditOutageScore, redditUsage: redditUsageScore };
  data.lastUpdated = now;

  console.log("  Misery: " + data.miseryIndex + "/10");
  console.log("    Status: +" + statusScore + " | Bluesky: +" + (bskyScore + bskyReplyScore) + " | Reddit: +" + redditOutageScore + " outage, +" + redditUsageScore + " usage");
  console.log("    Megathreads: " + megathreads + " (" + effectiveReddit + " effective posts)");
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log("\nWritten to " + DATA_FILE);
}

main();
