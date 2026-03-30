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
  var rangeHours = 24;

  // ── Misery levels ──────────────────────────────────────────
  var LEVELS = [
    { max: 1,  key: "calm",       label: "ALL CLEAR",        dot: "operational" },
    { max: 3,  key: "mild",       label: "MINOR GRUMBLING",  dot: "operational" },
    { max: 5,  key: "moderate",   label: "GROWING UNREST",   dot: "degraded"    },
    { max: 7,  key: "severe",     label: "FULL MELTDOWN",    dot: "major"       },
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

        row.innerHTML = '<span><span class="status-component-indicator" style="background:' + statusColor + '"></span>' +
                        c.name + '</span><span>' + c.status.replace(/_/g, " ") + '</span>';
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
    var pad = { top: 10, bottom: 20, left: 0, right: 0 };

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

    var startLabel = document.getElementById("chart-label-start");
    startLabel.textContent = formatTime(points[0].timestamp);

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
    // Fetch committed JSON data — try remote first, fall back to local
    var dataPromise = fetch(DATA_URL_REMOTE).then(function (r) {
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

      renderStatus(statusData);
      renderSocial(lastSocialData);
      renderIncidents(lastIncidents);
      setMiseryLevel(data.miseryIndex != null ? data.miseryIndex : 0);
      renderHistory(data.history || []);

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

    renderStatus(statusData);
    renderSocial(lastSocialData);
    renderIncidents(lastIncidents);
    setMiseryLevel(0);
    renderHistory([]);
    document.getElementById("last-updated").textContent = "demo mode — set up GitHub Action for live data";
  }

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
