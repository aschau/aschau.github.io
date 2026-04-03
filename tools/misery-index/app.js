// Developer Misery Index — Frontend
(function () {
  "use strict";

  var DATA_URL_REMOTE = "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/current.json";
  var DATA_URL_LOCAL = "data/current.json";
  var STATUS_API = "https://status.claude.com/api/v2/summary.json";
  var THEME_KEY = "misery_theme";

  // ── Theme ──────────────────────────────────────────────────
  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var themeBtn = document.getElementById("theme-btn");
    if (saved === "light") {
      document.documentElement.classList.add("light-theme");
      document.documentElement.classList.remove("dark-theme");
      themeBtn.innerHTML = "&#9728;";
    } else if (saved === "dark") {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.classList.remove("light-theme");
      themeBtn.innerHTML = "&#9790;";
    } else {
      // OS preference — update icon to match
      var isLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      themeBtn.innerHTML = isLight ? "&#9728;" : "&#9790;";
    }
  }

  function toggleTheme() {
    var themeBtn = document.getElementById("theme-btn");
    var isLight = document.documentElement.classList.contains("light-theme") ||
      (!document.documentElement.classList.contains("dark-theme") &&
        window.matchMedia("(prefers-color-scheme: light)").matches);

    if (isLight) {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.classList.remove("light-theme");
      localStorage.setItem(THEME_KEY, "dark");
      themeBtn.innerHTML = "&#9790;";
    } else {
      document.documentElement.classList.add("light-theme");
      document.documentElement.classList.remove("dark-theme");
      localStorage.setItem(THEME_KEY, "light");
      themeBtn.innerHTML = "&#9728;";
    }
    // Redraw chart with new theme colors
    if (lastHistory) renderHistory(lastHistory);
  }

  var lastHistory = null;
  var lastSocialData = null;
  var lastIncidents = null;
  var lastData = null;
  var rangeHours = 24;
  var FILTER_KEY = "misery_source_filter";
  var sourceFilter = localStorage.getItem(FILTER_KEY) || "all";


  // ── Misery levels ──────────────────────────────────────────
  var LEVELS = [
    { max: 1,  key: "calm",       label: "ALL CLEAR",        dot: "operational" },
    { max: 3,  key: "mild",       label: "MINOR GRUMBLING",  dot: "operational" },
    { max: 6,  key: "moderate",   label: "GROWING UNREST",   dot: "degraded"    },
    { max: 8,  key: "severe",     label: "FULL MELTDOWN",    dot: "major"       },
    { max: 10, key: "apocalypse", label: "APOCALYPSE",       dot: "major"       }
  ];

  var COMMENTARY = {
    calm: [
      "All systems go. Developers are happily shipping code they mostly didn't write.",
      "Claude is up. Keyboards are clacking. The illusion of productivity is intact.",
      "Everything works. Developers everywhere are pretending they could do this without AI.",
      "Zero complaints. The beautiful codependent relationship continues undisturbed."
    ],
    mild: [
      "A few grumbles in the distance. Developers nervously glance at their AI crutch.",
      "Some developers are refreshing their browser tabs with increasing urgency.",
      "The first 'is it just me or...' posts have appeared. The ritual begins.",
      "Scattered reports. Developers are starting to remember that Stack Overflow exists."
    ],
    moderate: [
      "The timeline is heating up. Developers are realizing how dependent they've become.",
      "Multiple developers spotted opening a competitor's tab. The betrayal arc begins.",
      "Productivity is plummeting. Turns out the AI was doing more heavy lifting than anyone admitted.",
      "Developers worldwide are having an existential crisis about their own coding abilities."
    ],
    severe: [
      "Developers everywhere are being forced to read documentation. The horror.",
      "Entire teams are discovering that nobody actually knows how the codebase works without AI.",
      "The dependency is real. Developers are writing their first unassisted for-loop in months.",
      "Senior engineers are pretending they don't need AI while secretly panicking the hardest."
    ],
    apocalypse: [
      "Somewhere, a developer just tried to ask Claude how to fix Claude being down.",
      "Developers are staring at their terminals. The terminals are staring back. Nobody remembers how to code.",
      "The real AI apocalypse isn't robots taking over. It's robots going offline and us realizing we forgot everything.",
      "Breaking: developer productivity drops 90%. Remaining 10% was copy-pasting from Stack Overflow all along.",
      "An entire generation of developers is learning what 'writing code from scratch' means. It's not going well."
    ]
  };

  // ── Helpers ────────────────────────────────────────────────
  function getLevel(index) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (index <= LEVELS[i].max) return LEVELS[i];
    }
    return LEVELS[LEVELS.length - 1];
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function timeAgo(isoString) {
    var diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  }

  function formatTime(isoString) {
    var d = new Date(isoString);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ── Rendering ──────────────────────────────────────────────
  function setMiseryLevel(index) {
    var level = getLevel(index);

    // Body class
    document.body.className = "";
    document.body.classList.add("misery-" + level.key);

    // Gauge value + ring
    var gaugeValue = document.getElementById("gauge-value");
    var gaugeLabel = document.getElementById("gauge-label");
    gaugeValue.textContent = index.toFixed(1);
    gaugeLabel.textContent = level.label;

    // Gauge ring fill (553 = full circumference of r=88)
    var fillPercent = index / 10;
    var offset = 553 - (553 * fillPercent);
    document.querySelector(".gauge-fill").style.strokeDashoffset = offset;

    // Commentary
    document.getElementById("commentary-text").textContent = pickRandom(COMMENTARY[level.key]);
  }

  function computeBreakdown(data) {
    var statusScore = 0;
    var bskyScore = 0;
    var redditScore = 0;

    if (data.status && data.status.status) {
      var ind = data.status.status.indicator;
      if (ind === "minor") statusScore += 2;
      else if (ind === "major") statusScore += 4;
      else if (ind === "critical") statusScore += 6;
      if (data.status.components) {
        var bad = data.status.components.filter(function (c) {
          return c.status !== "operational" &&
            c.name !== "Visit https://status.claude.com for more information";
        });
        statusScore += Math.min(bad.length * 0.5, 2);
      }
    }

    if (sourceFilter !== "official") {
      var bskyPosts = data.social ? data.social.recentPosts : 0;
      var bskyComments = data.social ? data.social.recentComments : 0;
      if (bskyPosts >= 30) bskyScore += 2;
      else if (bskyPosts >= 15) bskyScore += 1.5;
      else if (bskyPosts >= 5) bskyScore += 1;
      else if (bskyPosts >= 1) bskyScore += 0.5;
      if (bskyComments >= 75) bskyScore += 1;
      else if (bskyComments >= 30) bskyScore += 0.5;

      if (data.reddit && data.reddit.lastFetched) {
        var megas = (data.reddit.topPosts || []).filter(function (p) { return p.isMegathread; }).length;
        var rPosts = (data.reddit.recentPosts || 0) + (megas * 4);
        if (rPosts >= 30) redditScore = 5;
        else if (rPosts >= 20) redditScore = 4;
        else if (rPosts >= 10) redditScore = 3;
        else if (rPosts >= 5) redditScore = 2;
        else if (rPosts >= 3) redditScore = 1;
        else if (rPosts >= 1) redditScore = 0.5;
      }
    }

    return { status: statusScore, bluesky: bskyScore, reddit: redditScore };
  }

  function renderBreakdown(breakdown) {
    if (!breakdown) return;
    var max = 10;

    function pct(v) { return Math.max((v / max) * 100, v > 0 ? 2 : 0) + "%"; }

    document.getElementById("breakdown-status").style.width = pct(breakdown.status);
    document.getElementById("breakdown-reddit").style.width = pct(breakdown.reddit);
    document.getElementById("breakdown-bluesky").style.width = pct(breakdown.bluesky);

    document.getElementById("breakdown-status-val").textContent = "+" + (breakdown.status || 0);
    document.getElementById("breakdown-reddit-val").textContent = "+" + (breakdown.reddit || 0);
    document.getElementById("breakdown-bluesky-val").textContent = "+" + (breakdown.bluesky || 0);
  }

  function renderStatus(statusData) {
    var dot = document.getElementById("status-dot");
    var desc = document.getElementById("status-description");
    var components = document.getElementById("status-components");

    if (!statusData) {
      desc.textContent = "Unable to fetch status";
      return;
    }

    var indicator = statusData.status ? statusData.status.indicator : "none";
    var description = statusData.status ? statusData.status.description : "Unknown";

    dot.className = "status-dot";
    if (indicator === "none") dot.classList.add("operational");
    else if (indicator === "minor" || indicator === "maintenance") dot.classList.add("degraded");
    else dot.classList.add("major");

    desc.textContent = description;

    // Components
    if (statusData.components) {
      components.innerHTML = "";
      var shown = statusData.components.filter(function (c) {
        return c.name !== "Visit https://status.claude.com for more information";
      }).slice(0, 5);

      shown.forEach(function (c) {
        var row = document.createElement("div");
        row.className = "status-component";

        var statusColor = c.status === "operational" ? "var(--calm)" :
                          c.status === "degraded_performance" ? "var(--mild)" :
                          c.status === "partial_outage" ? "var(--moderate)" :
                          c.status === "major_outage" ? "var(--severe)" : "var(--text-dim)";

        var displayName = c.name.replace(/\s*\(formerly[^)]*\)/gi, "");
        row.innerHTML = '<span><span class="status-component-indicator" style="background:' + statusColor + '"></span>' +
                        displayName + '</span><span>' + c.status.replace(/_/g, " ") + '</span>';
        components.appendChild(row);
      });
    }
  }

  function renderIncidents(incidents) {
    var list = document.getElementById("incidents-list");
    var title = document.getElementById("incidents-title");
    var rangeLabel = rangeHours <= 24 ? "24h" : rangeHours <= 72 ? "3 days" : "7 days";
    if (title) title.textContent = "Recent Incidents (" + rangeLabel + ")";

    // Filter incidents to selected range
    var cutoff = Date.now() - rangeHours * 60 * 60 * 1000;
    var filtered = (incidents || []).filter(function (inc) {
      return new Date(inc.createdAt || inc.created_at).getTime() >= cutoff;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div class="incidents-empty">No incidents in the last ' + rangeLabel + '. Smooth sailing.</div>';
      return;
    }

    list.innerHTML = "";
    filtered.forEach(function (inc) {
      var el = document.createElement("div");
      el.className = "incident";

      var impactClass = "impact-" + (inc.impact || "none");
      var impactLabel = inc.impact || "info";

      var latestUpdate = inc.updates && inc.updates.length > 0 ? inc.updates[0] : null;
      var updateHtml = "";
      if (latestUpdate && latestUpdate.body) {
        updateHtml = '<div class="incident-update">' + escapeHtml(truncate(latestUpdate.body, 200)) + '</div>';
      }

      var statusLabel = inc.status || "unknown";
      var timeStr = inc.updatedAt ? timeAgo(inc.updatedAt) : "";

      el.innerHTML =
        '<div class="incident-header">' +
          '<span class="incident-impact ' + impactClass + '">' + escapeHtml(impactLabel) + '</span>' +
          '<div class="incident-name"><a href="' + sanitizeUrl(inc.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(inc.name) + '</a></div>' +
        '</div>' +
        '<div class="incident-meta">' +
          '<span class="incident-status">' + escapeHtml(statusLabel) + '</span>' +
          (timeStr ? '<span>&middot; ' + timeStr + '</span>' : '') +
        '</div>' +
        updateHtml;

      list.appendChild(el);
    });
  }

  function renderSocial(socialData) {
    var postCount = document.getElementById("social-post-count");
    var commentCount = document.getElementById("social-comment-count");
    var postsList = document.getElementById("social-posts");

    if (!socialData) {
      postCount.textContent = "?";
      commentCount.textContent = "?";
      return;
    }

    postCount.textContent = socialData.recentPosts || 0;
    commentCount.textContent = socialData.recentComments || 0;

    postsList.innerHTML = "";
    if (socialData.topPosts && socialData.topPosts.length > 0) {
      socialData.topPosts.slice(0, 8).forEach(function (post) {
        var el = document.createElement("div");
        el.className = "social-post";
        var scoreText = post.score != null ? post.score : "--";
        var meta = "@" + escapeHtml(post.author || "?");
        if (post.created) meta += " \u00b7 " + timeAgo(post.created);
        el.innerHTML = '<span class="social-post-score">' + scoreText + ' \u2665</span>' +
                       '<div class="social-post-body">' +
                         '<a href="' + sanitizeUrl(post.url) + '" target="_blank" rel="noopener noreferrer">' +
                         escapeHtml(truncate(post.title, 100)) + '</a>' +
                         '<span class="social-post-meta">' + meta + '</span>' +
                       '</div>';
        postsList.appendChild(el);
      });
    }

    if (!socialData.topPosts || socialData.topPosts.length === 0) {
      postsList.innerHTML = '<div class="social-post" style="color:var(--color-text-soft)">No recent complaint posts found</div>';
    }
  }

  function renderReddit(redditData) {
    var postCount = document.getElementById("reddit-post-count");
    var commentCount = document.getElementById("reddit-comment-count");
    var postsList = document.getElementById("reddit-posts");
    var staleBadge = document.getElementById("reddit-stale-badge");

    if (!redditData || !redditData.lastFetched) {
      postCount.textContent = "--";
      commentCount.textContent = "--";
      if (staleBadge) staleBadge.textContent = "awaiting bot";
      postsList.innerHTML = '<div class="social-post" style="color:var(--color-text-soft)">Reddit data is provided by the Discord bot — no data yet</div>';
      return;
    }

    postCount.textContent = redditData.recentPosts || 0;
    commentCount.textContent = redditData.recentComments || 0;

    // Show stale badge if data is older than 30 min
    var ageMs = Date.now() - new Date(redditData.lastFetched).getTime();
    var ageMin = Math.round(ageMs / 60000);
    if (staleBadge) {
      if (ageMin > 30) {
        staleBadge.textContent = timeAgo(redditData.lastFetched);
        staleBadge.style.display = "inline";
      } else {
        staleBadge.style.display = "none";
      }
    }

    postsList.innerHTML = "";
    if (redditData.topPosts && redditData.topPosts.length > 0) {
      redditData.topPosts.slice(0, 8).forEach(function (post) {
        var el = document.createElement("div");
        el.className = "social-post";
        var scoreText = post.score != null ? post.score : "--";
        var sub = post.subreddit ? "r/" + escapeHtml(post.subreddit) : "";
        var meta = "u/" + escapeHtml(post.author || "?");
        if (sub) meta = sub + " \u00b7 " + meta;
        if (post.created) meta += " \u00b7 " + timeAgo(post.created);
        var megaBadge = post.isMegathread ? '<span class="megathread-badge">megathread</span>' : '';
        var commentsHtml = '';
        if (post.topComments && post.topComments.length > 0) {
          commentsHtml = '<div class="top-comments">';
          post.topComments.forEach(function (c) {
            commentsHtml += '<div class="top-comment">' +
              '<span class="top-comment-score">' + c.score + ' \u2B06</span>' +
              '<span class="top-comment-body">' + escapeHtml(truncate(c.body, 120)) + '</span>' +
              '<span class="top-comment-author">u/' + escapeHtml(c.author) + '</span>' +
              '</div>';
          });
          commentsHtml += '</div>';
        }
        el.innerHTML = '<span class="social-post-score">' + scoreText + ' \u2B06</span>' +
                       '<div class="social-post-body">' +
                         megaBadge +
                         '<a href="' + sanitizeUrl(post.url) + '" target="_blank" rel="noopener noreferrer">' +
                         escapeHtml(truncate(post.title, 100)) + '</a>' +
                         '<span class="social-post-meta">' + meta + '</span>' +
                         commentsHtml +
                       '</div>';
        postsList.appendChild(el);
      });
    }

    if (!redditData.topPosts || redditData.topPosts.length === 0) {
      postsList.innerHTML = '<div class="social-post" style="color:var(--color-text-soft)">No recent complaint posts found on Reddit</div>';
    }
  }

  function renderHistory(history) {
    lastHistory = history;
    var canvas = document.getElementById("history-chart");
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var isMobile = window.innerWidth <= 600;
    var pad = { top: 10, bottom: 32, left: isMobile ? 24 : 30, right: 0 };

    if (!history || history.length < 2) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-text-soft").trim() || "#3a3a50";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Not enough data yet — check back after a few Action runs", w / 2, h / 2);
      return;
    }

    // Filter to selected time window
    var now = Date.now();
    var cutoff = now - rangeHours * 60 * 60 * 1000;
    var points = history.filter(function (p) { return new Date(p.timestamp).getTime() >= cutoff; });
    if (points.length < 2) points = history.slice(-10);

    var drawW = w - pad.left - pad.right;
    var drawH = h - pad.top - pad.bottom;

    // Draw threshold zones
    var zones = [
      { y: 0, h: 1, color: "rgba(34,197,94,0.05)" },
      { y: 1, h: 2, color: "rgba(234,179,8,0.05)" },
      { y: 3, h: 2, color: "rgba(249,115,22,0.05)" },
      { y: 5, h: 2, color: "rgba(239,68,68,0.05)" },
      { y: 7, h: 3, color: "rgba(168,85,247,0.05)" }
    ];

    zones.forEach(function (z) {
      var y1 = pad.top + drawH - (z.y / 10) * drawH;
      var y2 = pad.top + drawH - ((z.y + z.h) / 10) * drawH;
      ctx.fillStyle = z.color;
      ctx.fillRect(pad.left, y2, drawW, y1 - y2);
    });

    // Draw Y-axis ticks and grid lines
    var axisColor = getComputedStyle(document.documentElement).getPropertyValue("--color-text-soft").trim() || "#6a6a80";
    ctx.fillStyle = axisColor;
    ctx.strokeStyle = axisColor;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [0, 2, 4, 6, 8, 10].forEach(function (v) {
      var y = pad.top + drawH - (v / 10) * drawH;
      ctx.fillText(v, pad.left - 6, y);
      ctx.beginPath();
      ctx.globalAlpha = 0.15;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + drawW, y);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Draw X-axis time labels
    var xTickCount = isMobile ? 3 : 5;
    var tStart = new Date(points[0].timestamp).getTime();
    var tEnd = new Date(points[points.length - 1].timestamp).getTime();
    var xFmt = isMobile
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
    ctx.fillStyle = axisColor;
    ctx.font = "10px Inter, sans-serif";
    ctx.textBaseline = "top";
    for (var ti = 0; ti < xTickCount; ti++) {
      var frac = ti / (xTickCount - 1);
      var tx = pad.left + frac * drawW;
      var tVal = new Date(tStart + frac * (tEnd - tStart));
      var label = tVal.toLocaleString(undefined, xFmt);
      if (ti === 0) ctx.textAlign = "left";
      else if (ti === xTickCount - 1) ctx.textAlign = "right";
      else ctx.textAlign = "center";
      ctx.fillText(label, tx, pad.top + drawH + 4);
    }

    // Draw line
    ctx.beginPath();
    points.forEach(function (p, i) {
      var x = pad.left + (i / (points.length - 1)) * drawW;
      var y = pad.top + drawH - (Math.min(p.miseryIndex, 10) / 10) * drawH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--misery-color").trim();
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Gradient fill under line
    var gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + drawH);
    gradient.addColorStop(0, "rgba(168, 85, 247, 0.15)");
    gradient.addColorStop(1, "rgba(168, 85, 247, 0)");

    ctx.lineTo(pad.left + drawW, pad.top + drawH);
    ctx.lineTo(pad.left, pad.top + drawH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // ── Security helpers ───────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function sanitizeUrl(url) {
    if (!url) return "#";
    try {
      var parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
    } catch (e) { /* invalid URL */ }
    return "#";
  }

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  // ── Data Fetching ──────────────────────────────────────────
  var INCIDENTS_API = "https://status.claude.com/api/v2/incidents.json";

  function fetchData() {
    var isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      || window.location.protocol === "file:";

    // Local dev: use local data file directly; production: try remote first
    var dataPromise = isLocal
      ? fetch(DATA_URL_LOCAL).then(function (r) {
          if (!r.ok) throw new Error("Local data not found");
          return r.json();
        }).catch(function () { return null; })
      : fetch(DATA_URL_REMOTE + "?t=" + Date.now()).then(function (r) {
          if (!r.ok) throw new Error("Remote data not found");
          return r.json();
        }).catch(function () {
          return fetch(DATA_URL_LOCAL).then(function (r) {
            if (!r.ok) throw new Error("Local data not found");
            return r.json();
          });
        }).catch(function () { return null; });

    // Also try live status fetch (may fail due to CORS in local dev)
    var statusPromise = fetch(STATUS_API).then(function (r) {
      if (!r.ok) throw new Error("Status fetch failed");
      return r.json();
    }).catch(function () { return null; });

    // Try live incidents fetch
    var incidentsPromise = fetch(INCIDENTS_API).then(function (r) {
      if (!r.ok) throw new Error("Incidents fetch failed");
      return r.json();
    }).then(function (data) {
      var threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      return (data.incidents || [])
        .filter(function (inc) { return new Date(inc.created_at).getTime() >= threeDaysAgo; })
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
    }).catch(function () { return null; });

    Promise.all([dataPromise, statusPromise, incidentsPromise]).then(function (results) {
      var data = results[0];
      var liveStatus = results[1];
      var liveIncidents = results[2];

      if (!data) {
        renderDemo(liveStatus, liveIncidents);
        return;
      }

      // Use live data if available, otherwise use committed data
      var statusData = liveStatus || data.status || null;
      var incidents = liveIncidents || data.incidents || [];

      lastSocialData = data.social || null;
      lastIncidents = incidents;
      lastData = {
        status: statusData,
        social: lastSocialData,
        reddit: data.reddit || null,
        miseryIndex: data.miseryIndex != null ? data.miseryIndex : 0,
        breakdown: data.breakdown || null,
        history: data.history || []
      };

      renderWithFilter();

      if (data.lastUpdated) {
        document.getElementById("last-updated").textContent = timeAgo(data.lastUpdated);
      }
    });
  }

  function renderDemo(liveStatus, liveIncidents) {
    var statusData = liveStatus || {
      status: { indicator: "none", description: "All Systems Operational" },
      components: [
        { name: "claude.ai", status: "operational" },
        { name: "Claude API", status: "operational" },
        { name: "Claude Code", status: "operational" }
      ]
    };

    lastSocialData = { recentPosts: 0, recentComments: 0, topPosts: [] };
    lastIncidents = liveIncidents || [];
    lastData = {
      status: statusData,
      social: lastSocialData,
      reddit: null,
      miseryIndex: 0,
      breakdown: null,
      history: []
    };

    renderWithFilter();
    document.getElementById("last-updated").textContent = "demo mode — set up GitHub Action for live data";
  }

  // ── Render with current filter ─────────────────────────────
  function renderWithFilter() {
    if (!lastData) return;
    var isOfficial = sourceFilter === "official";
    var cardsEl = document.querySelector(".cards");
    if (cardsEl) {
      if (isOfficial) cardsEl.classList.add("official-only");
      else cardsEl.classList.remove("official-only");
    }

    renderStatus(lastData.status);
    renderIncidents(lastIncidents);

    // Hide/show social sections
    document.getElementById("social-card").style.display = isOfficial ? "none" : "";
    document.getElementById("reddit-card").style.display = isOfficial ? "none" : "";

    if (!isOfficial) {
      renderSocial(lastSocialData);
      renderReddit(lastData.reddit);
    }

    // Recalculate breakdown with filter
    var breakdown = computeBreakdown({ status: lastData.status, social: lastSocialData, reddit: lastData.reddit });
    var displayIndex = Math.min(breakdown.status + breakdown.bluesky + breakdown.reddit, 10);

    setMiseryLevel(displayIndex);
    renderBreakdown(breakdown);

    // Hide social breakdown segments in official mode
    document.getElementById("breakdown-reddit").style.display = isOfficial ? "none" : "";
    document.getElementById("breakdown-bluesky").style.display = isOfficial ? "none" : "";
    var labels = document.querySelectorAll(".breakdown-label");
    if (labels.length >= 3) {
      labels[1].style.display = isOfficial ? "none" : ""; // Reddit label
      labels[2].style.display = isOfficial ? "none" : ""; // Bluesky label
    }

    renderHistory(lastData.history);

    // Update gauge window text and RSS link for filter
    var windowEl = document.querySelector(".gauge-window");
    if (windowEl) {
      windowEl.textContent = isOfficial
        ? "Official status only \u2014 last 24 hours"
        : "Based on the last 24 hours";
    }
    var rssLink = document.getElementById("rss-link");
    if (rssLink) {
      var feedLabel = isOfficial ? "Official Only" : "All Sources";
      rssLink.href = isOfficial
        ? "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/feed-official.xml"
        : "https://raw.githubusercontent.com/aschau/aschau.github.io/misery-data/feed.xml";
      rssLink.title = "RSS Feed \u2014 " + feedLabel;
      rssLink.setAttribute("aria-label", "RSS Feed \u2014 " + feedLabel);
      var rssLabel = document.getElementById("rss-label");
      if (rssLabel) rssLabel.textContent = isOfficial ? "STATUS" : "ALL";
    }
  }

  // ── Product Filter Toggle ─────────────────────────────────
  var filterBtns = document.querySelectorAll(".source-filter-btn");
  filterBtns.forEach(function (btn) {
    var isActive = btn.getAttribute("data-filter") === sourceFilter;
    if (isActive) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      sourceFilter = btn.getAttribute("data-filter");
      localStorage.setItem(FILTER_KEY, sourceFilter);
      renderWithFilter();
    });
  });

  // ── Global Time Range Toggle ────────────────────────────────
  var timeRangeBtns = document.querySelectorAll(".time-range-btn");
  timeRangeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      timeRangeBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      rangeHours = parseInt(btn.getAttribute("data-hours"), 10);
      if (lastHistory) renderHistory(lastHistory);
      if (lastIncidents) renderIncidents(lastIncidents);
    });
  });

  // ── Init ───────────────────────────────────────────────────
  initTheme();
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  fetchData();
})();
