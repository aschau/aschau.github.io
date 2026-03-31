// Quick test: fetch Reddit data and write it into local current.json
// Run: node tools/misery-index/discord-bot/test-reddit.js

var fs = require("fs");
var path = require("path");

var DATA_FILE = path.join(__dirname, "../data/current.json");
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

async function main() {
  var dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var seenIds = new Set();
  var allPosts = [];

  for (var i = 0; i < REDDIT_SEARCHES.length; i++) {
    var search = REDDIT_SEARCHES[i];
    console.log("Searching r/" + search.sub + ": " + search.q + " (t=" + search.t + ")");
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
      if (ageHours > 24 && !isMegathread && (post.num_comments || 0) < 5) return;

      allPosts.push({
        title: truncate(post.title, 120),
        author: post.author || "unknown",
        score: post.score || 0,
        numComments: post.num_comments || 0,
        url: "https://reddit.com" + post.permalink,
        created: new Date(post.created_utc * 1000).toISOString(),
        subreddit: post.subreddit,
        source: "reddit",
        isMegathread: isMegathread
      });

      console.log("  " + (isMegathread ? "[MEGA] " : "") + post.title.substring(0, 80) + " (" + post.num_comments + " comments, " + post.score + " score)");
    });

    await new Promise(function (r) { setTimeout(r, 2000); });
  }

  console.log("\nTotal: " + allPosts.length + " posts");

  // Write into local current.json
  var existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  var commentCount = allPosts.reduce(function (sum, p) { return sum + (p.numComments || 0); }, 0);
  existing.reddit = {
    lastFetched: new Date().toISOString(),
    recentPosts: allPosts.length,
    recentComments: commentCount,
    topPosts: allPosts.sort(function (a, b) { return b.score - a.score; }).slice(0, 10)
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));
  console.log("Written to " + DATA_FILE);
}

main();
