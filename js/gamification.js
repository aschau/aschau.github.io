(function () {
  // === Configuration ===
  var MAIN_PAGES = ["index.html", "aboutMe.html", "workprojects.html", "personalprojects.html", "deep-dive"];
  var STORAGE_ACHIEVEMENTS = "portfolio_achievements";
  var STORAGE_PAGES = "portfolio_pages_visited";

  var ACHIEVEMENTS = {
    explorer:     { title: "Explorer",      desc: "Visited all 4 pages",              icon: "\uD83E\uDDED" },
    curious:      { title: "Curious",       desc: "Clicked an external link",         icon: "\uD83D\uDD0D" },
    "night-owl":  { title: "Night Owl",     desc: "Visited after 10 PM",              icon: "\uD83C\uDF19" },
    "speed-reader": { title: "Speed Reader", desc: "Scrolled to the bottom in under 5s", icon: "\u26A1" },
    "deep-diver":   { title: "Deep Diver",   desc: "Visited a project detail page",     icon: "\uD83E\uDD3F" }
  };

  // === Storage Helpers ===
  function getJSON(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function getAchievements() {
    return getJSON(STORAGE_ACHIEVEMENTS, {});
  }

  function saveAchievements(data) {
    setJSON(STORAGE_ACHIEVEMENTS, data);
  }

  function getPagesVisited() {
    return getJSON(STORAGE_PAGES, []);
  }

  function savePagesVisited(pages) {
    setJSON(STORAGE_PAGES, pages);
  }

  // === Toast System ===
  var toastContainer = null;

  function createToastContainer() {
    toastContainer = document.createElement("div");
    toastContainer.id = "achievement-toast-container";
    document.body.appendChild(toastContainer);
  }

  function showToast(id) {
    if (!toastContainer) return;
    var ach = ACHIEVEMENTS[id];
    if (!ach) return;

    var toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.innerHTML =
      '<span class="achievement-icon">' + ach.icon + '</span>' +
      '<div>' +
        '<div class="achievement-label">Achievement Unlocked!</div>' +
        '<div class="achievement-title">' + ach.title + '</div>' +
        '<div class="achievement-desc">' + ach.desc + '</div>' +
      '</div>';

    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add("toast-exit");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 500);
    }, 4000);
  }

  function unlockAchievement(id) {
    var data = getAchievements();
    if (data[id]) return;
    data[id] = { unlocked: true, date: new Date().toISOString() };
    saveAchievements(data);
    showToast(id);
    updateToggleBadge();
    if (panel && panel.classList.contains("open")) renderPanel();
  }

  // === Progress Bar ===
  function createProgressBar() {
    var bar = document.createElement("div");
    bar.id = "exploration-progress";
    var fill = document.createElement("div");
    fill.className = "exploration-progress-fill";
    var label = document.createElement("span");
    label.className = "exploration-progress-label";
    fill.appendChild(label);
    bar.appendChild(fill);
    document.body.appendChild(bar);
  }

  function updateProgress() {
    var pages = getPagesVisited();
    var fill = document.querySelector(".exploration-progress-fill");
    var label = document.querySelector(".exploration-progress-label");
    if (!fill) return;
    var pct = Math.round((pages.length / MAIN_PAGES.length) * 100);
    if (label) {
      label.textContent = pct + "% Explored";
    }
    // Delay slightly so the transition animates on page load
    setTimeout(function () {
      fill.style.width = pct + "%";
    }, 100);
  }

  // === Page Visit Tracking ===
  function trackPageVisit() {
    var path = window.location.pathname;
    var page = path.substring(path.lastIndexOf("/") + 1) || "index.html";
    var pages = getPagesVisited();

    if (MAIN_PAGES.indexOf(page) !== -1 && pages.indexOf(page) === -1) {
      pages.push(page);
      savePagesVisited(pages);
    }

    // Check Explorer achievement (4 main pages, excluding deep-dive)
    var mainCount = 0;
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] !== "deep-dive") mainCount++;
    }
    if (mainCount >= 4) {
      unlockAchievement("explorer");
    }
  }

  // === Achievement Triggers ===
  function checkNightOwl() {
    var hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      unlockAchievement("night-owl");
    }
  }

  function initSpeedReader() {
    // Only on pages that are actually scrollable
    if (document.body.offsetHeight <= window.innerHeight + 100) return;

    var startTime = Date.now();
    var unlocked = false;

    function onScroll() {
      if (unlocked) return;
      var atBottom = (window.innerHeight + window.pageYOffset) >= (document.body.offsetHeight - 100);
      if (atBottom && (Date.now() - startTime) < 5000) {
        unlocked = true;
        unlockAchievement("speed-reader");
        window.removeEventListener("scroll", onScroll);
      }
    }

    window.addEventListener("scroll", onScroll);

    // Clean up listener after 5 seconds if not triggered
    setTimeout(function () {
      if (!unlocked) {
        window.removeEventListener("scroll", onScroll);
      }
    }, 5000);
  }

  function checkDeepDiver() {
    var path = window.location.pathname;
    if (path.indexOf("projects/") !== -1) {
      unlockAchievement("deep-diver");
      // Track for progress bar
      var pages = getPagesVisited();
      if (pages.indexOf("deep-dive") === -1) {
        pages.push("deep-dive");
        savePagesVisited(pages);
        updateProgress();
      }
    }
  }

  function initCuriousClick() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest('a[target="_blank"]');
      if (link) {
        unlockAchievement("curious");
      }
    });
  }

  // === Achievement Panel & Toggle ===
  var panel = null;
  var toggleBtn = null;

  function createAchievementToggle() {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "achievement-toggle";
    toggleBtn.setAttribute("aria-label", "View achievements");
    toggleBtn.innerHTML = '\uD83C\uDFC6<span class="badge-count">0</span>';
    document.body.appendChild(toggleBtn);

    panel = document.createElement("div");
    panel.id = "achievement-panel";
    document.body.appendChild(panel);

    toggleBtn.addEventListener("click", function () {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) renderPanel();
    });

    // Close panel when clicking outside
    document.addEventListener("click", function (e) {
      if (panel.classList.contains("open") &&
          !panel.contains(e.target) &&
          e.target !== toggleBtn &&
          !toggleBtn.contains(e.target)) {
        panel.classList.remove("open");
      }
    });

    updateToggleBadge();
  }

  function updateToggleBadge() {
    if (!toggleBtn) return;
    var data = getAchievements();
    var count = 0;
    for (var key in data) {
      if (data[key]) count++;
    }
    var badge = toggleBtn.querySelector(".badge-count");
    badge.textContent = count;
    badge.style.display = count > 0 ? "flex" : "none";
  }

  function renderPanel() {
    if (!panel) return;
    var data = getAchievements();
    var keys = Object.keys(ACHIEVEMENTS);
    var total = keys.length;
    var unlocked = 0;
    for (var k in data) { if (data[k]) unlocked++; }

    var html = '<h6>Achievements (' + unlocked + '/' + total + ')</h6>';

    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var ach = ACHIEVEMENTS[id];
      var isUnlocked = !!data[id];
      var cls = isUnlocked ? "achievement-panel-item" : "achievement-panel-item locked";
      html +=
        '<div class="' + cls + '">' +
          '<span class="achievement-icon">' + ach.icon + '</span>' +
          '<div>' +
            '<div class="achievement-title">' + ach.title + '</div>' +
            '<div class="achievement-desc">' + (isUnlocked ? ach.desc : "???") + '</div>' +
          '</div>' +
        '</div>';
    }

    html += '<button id="achievement-clear">Clear All Progress</button>';
    panel.innerHTML = html;

    document.getElementById("achievement-clear").addEventListener("click", function () {
      try {
        localStorage.removeItem(STORAGE_ACHIEVEMENTS);
        localStorage.removeItem(STORAGE_PAGES);
      } catch (e) {}
      updateToggleBadge();
      updateProgress();
      renderPanel();
    });
  }

  // === Init ===
  createToastContainer();
  createProgressBar();
  createAchievementToggle();
  trackPageVisit();
  updateProgress();
  checkNightOwl();
  initSpeedReader();
  initCuriousClick();
  checkDeepDiver();
})();
