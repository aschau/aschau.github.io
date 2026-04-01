// Fetch all live data (status, incidents, Bluesky from remote + Reddit locally)
// and write to local current.json for dev testing.
// Run: node tools/misery-index/discord-bot/fetch-local-data.js

var fs = require("fs");
var path = require("path");

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

var STRONG = [
  "is down", "went down", "goes down", "going down",
  "outage", "not working", "unavailable",
  "can't use", "cant use", "won't work", "doesn't work", "stopped working",
  "keeps crashing", "keeps failing",
  "overloaded", "500 error", "502", "503", "504",
  "please fix", "is it just me"
];

var WEAK = [
  "rate limit", "token limit", "usage limit", "message limit",
  "limit reached", "hit the limit", "out of messages",
  "throttl", "capped", "degraded", "so slow", "unusable", "broken",
  "nerfed", "bug", "buggy"
];

function truncate(str, len) {
  if (!str) return "";
  var clean = str.replace(/\n+/g, " ").trim();
  return clean.length > len ? clean.substring(0, len) + "..." : clean;
}

function filterRedditPost(post, subreddit) {
  var text = (post.title + " " + (post.selftext || "")).toLowerCase();
  var isClaudeSub = subreddit === "ClaudeAI";
  if (!isClaudeSub) {
    if (!text.includes("claude") && !text.includes("anthropic")) return false;
  }
  if (EXCLUSIONS.some(function (w) { return text.includes(w); })) return false;
  var titleLower = (post.title || "").toLowerCase();
  var SHOWCASE = ["i built", "i made", "i created", "introducing", "announcing",
    "check out", "open source", "open-source", "new tool", "new project",
    "released", "launching", "just shipped", "show r/"];
  if (SHOWCASE.some(function (w) { return titleLower.includes(w); })) return false;
  var hasStrong = STRONG.some(function (w) { return text.includes(w); });
  if (hasStrong) return true;
  var weakCount = WEAK.filter(function (w) { return text.includes(w); }).length;
  var hasFrustration = /\b(wtf|omg|ugh|smh|seriously|annoying|frustrat|painful)\b/i.test(text);
  return weakCount >= 2 || (weakCount >= 1 && hasFrustration);
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

      if (!isMegathread && !filterRedditPost(post, search.sub)) return;

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

async function main() {
  var now = new Date().toISOString();

  // 1. Pull remote data as base (has Bluesky + history)
  console.log("Fetching remote data...");
  var data;
  try {
    data = await fetchJSON(REMOTE_DATA + "?t=" + Date.now());
    console.log("  Remote: misery " + data.miseryIndex + "/10, " + (data.social ? data.social.recentPosts : 0) + " Bluesky posts");
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

  // 4. Fetch Reddit
  console.log("Fetching Reddit...");
  var redditPosts = await fetchReddit();
  var commentCount = redditPosts.reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);
  data.reddit = {
    lastFetched: now,
    recentPosts: redditPosts.length,
    recentComments: commentCount,
    topPosts: redditPosts.sort(function (a, b) { return b.score - a.score; }).slice(0, 10)
  };
  console.log("  Reddit: " + redditPosts.length + " posts, " + commentCount + " comments");

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

  data.miseryIndex = Math.min(Math.round((statusScore + bskyScore + bskyReplyScore + redditScore) * 10) / 10, 10);
  data.breakdown = { status: statusScore, bluesky: bskyScore + bskyReplyScore, reddit: redditScore };
  data.lastUpdated = now;

  console.log("  Misery: " + data.miseryIndex + "/10");
  console.log("    Status: +" + statusScore + " | Bluesky: +" + (bskyScore + bskyReplyScore) + " | Reddit: +" + redditScore);
  console.log("    Megathreads: " + megathreads + " (" + effectiveReddit + " effective posts)");
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log("\nWritten to " + DATA_FILE);
}

main();
