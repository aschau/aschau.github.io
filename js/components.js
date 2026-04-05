// Shared components to reduce duplication across pages.
// Usage: add <div id="navbar-placeholder"></div> where the nav should appear,
// then include this script. It auto-detects the current page for the active state.

(function () {
  // Detect base path from this script's src so links work from any directory depth
  var scripts = document.getElementsByTagName("script");
  var thisScript = scripts[scripts.length - 1];
  var scriptSrc = thisScript.getAttribute("src") || "";
  var basePath = scriptSrc.replace(/js\/components\.js$/, "");

  var navItems = [
    { href: "index.html", label: "Home" },
    { href: "aboutMe.html", label: "About" },
    { href: "workprojects.html", label: "Work" },
    { href: "personalprojects.html", label: "Personal" },
    { label: "Games", dropdown: [
      { href: "games/beamlab/index.html", label: "Beamlab", desc: "Daily laser puzzle" },
      { href: "games/parsed/index.html", label: "Parsed", desc: "Daily code puzzle" }
    ]},
    { label: "Tools", dropdown: [
      { href: "tools/snaplayout/index.html", label: "SnapLayout", desc: "Room layout planner" },
      { href: "tools/misery-index/index.html", label: "Misery Index", desc: "Claude developer misery tracker" }
    ]}
  ];

  // Inject favicon + apple touch icon if not already present
  if (!document.querySelector('link[rel="icon"]')) {
    var favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = basePath + "img/favicon.png";
    document.head.appendChild(favicon);
    var apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = basePath + "img/favicon-apple.png";
    document.head.appendChild(apple);
  }

  var path = window.location.pathname;
  var currentPage = path.substring(path.lastIndexOf("/") + 1) || "index.html";

  // === Game-inspired floating particles ===
  (function () {
    var shapes = ["card-shape", "diamond-shape", "grid-dot", "cross-shape", "card-shape", "diamond-shape", "grid-dot"];
    var container = document.createElement("div");
    container.className = "game-particles";
    document.body.appendChild(container);

    for (var i = 0; i < 90; i++) {
      var p = document.createElement("div");
      p.className = "game-particle " + shapes[i % shapes.length];
      p.style.left = (Math.random() * 100) + "%";
      p.style.animationDuration = (25 + Math.random() * 40) + "s";
      p.style.animationDelay = -(Math.random() * 60) + "s";
      container.appendChild(p);
    }
  })();

  // === Click burst effect ===
  document.addEventListener("click", function (e) {
    // Skip if clicking interactive elements
    if (e.target.closest("a, button, input, select, textarea, .list-group-item, .nav-link, .carousel, #achievement-toggle, #achievement-panel")) return;

    var burst = document.createElement("div");
    burst.className = "click-burst";
    burst.style.left = e.clientX + "px";
    burst.style.top = e.clientY + "px";

    var count = 8;
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var dist = 20 + Math.random() * 15;
      var p = document.createElement("div");
      p.className = "click-burst-particle";
      p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      burst.appendChild(p);
    }

    document.body.appendChild(burst);
    setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 600);
  });

  // === Loading screen (once per session) ===
  var loadingShown = false;
  try { loadingShown = sessionStorage.getItem("loading_shown") === "true"; } catch (e) {}

  if (!loadingShown) {
    var tips = [
      "Augmenting your reality...",
      "Shuffling the deck...",
      "Deploying to the field...",
      "Dealing a fresh hand...",
      "Scanning the environment...",
      "Patching things up...",
      "Calibrating the looking glass...",
      "Building from the ground up...",
      "Stitching worlds together...",
      "Reading the room...",
      "Polishing the final build...",
      "Warming up the engine...",
      "Syncing realities...",
      "Flipping through the archives...",
      "Spawning into the world...",
      "Placing the last piece...",
      "Bridging dimensions...",
      "Rendering a new perspective...",
      "Running the pipeline...",
      "Anchoring to the real world...",
      "Opening the tavern doors...",
      "Drawing from the top...",
      "Tracking every surface...",
      "Compiling the scene...",
      "Checking every edge case...",
      "Overlaying the impossible...",
      "Shipping to the store...",
      "Setting up courtside...",
      "Stacking the deck in your favor...",
      "Reproducing on all devices..."
    ];
    // Shuffle tips so each load feels different
    for (var i = tips.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = tips[i]; tips[i] = tips[j]; tips[j] = tmp;
    }

    var overlay = document.createElement("div");
    overlay.id = "loading-screen";
    overlay.innerHTML =
      '<div class="loading-content">' +
        '<h1 class="loading-title">Andrew Steven Chau</h1>' +
        '<div class="loading-bar-track">' +
          '<div class="loading-bar-fill" id="loading-bar-fill"></div>' +
        '</div>' +
        '<p class="loading-tip" id="loading-tip">' + tips[0] + '</p>' +
      '</div>';
    document.body.insertBefore(overlay, document.body.firstChild);

    // Cycle tips
    var tipIndex = 0;
    var tipEl = document.getElementById("loading-tip");
    var tipInterval = setInterval(function () {
      tipIndex = (tipIndex + 1) % tips.length;
      tipEl.style.opacity = "0";
      setTimeout(function () {
        tipEl.textContent = tips[tipIndex];
        tipEl.style.opacity = "1";
      }, 200);
    }, 800);

    // Animate progress bar
    var fill = document.getElementById("loading-bar-fill");
    setTimeout(function () { fill.style.width = "100%"; }, 50);

    // Fade out after bar fills
    setTimeout(function () {
      clearInterval(tipInterval);
      overlay.classList.add("loading-fade-out");
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
      try { sessionStorage.setItem("loading_shown", "true"); } catch (e) {}
    }, 2800);
  }

  // === Navbar ===
  var navLinksHtml = navItems.map(function (item) {
    if (item.dropdown) {
      var isAnyActive = item.dropdown.some(function (d) {
        return window.location.pathname.indexOf(d.href.replace('index.html', '')) !== -1;
      });
      var dropdownItems = item.dropdown.map(function (d) {
        return '<a class="dropdown-item" href="' + basePath + d.href + '" target="_blank" rel="noopener noreferrer">' +
          d.label + '<small class="text-muted ms-2">' + d.desc + '</small></a>';
      }).join('');
      return (
        '<li class="nav-item dropdown' + (isAnyActive ? ' active' : '') + '">' +
        '<a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
        item.label + '</a>' +
        '<div class="dropdown-menu dropdown-menu-end">' + dropdownItems + '</div>' +
        '</li>'
      );
    }
    var isActive = currentPage === item.href;
    var activeClass = isActive ? " active" : "";
    var srOnly = isActive ? ' <span class="visually-hidden">(current)</span>' : "";
    return (
      '<li class="nav-item' + activeClass + '">' +
      '<a class="nav-link" href="' + basePath + item.href + '">' + item.label + srOnly + "</a>" +
      "</li>"
    );
  }).join("\n                ");

  var navbarHtml =
    '<nav class="navbar fixed-top navbar-expand-lg navbar-dark">' +
    '  <a class="navbar-brand link" href="' + basePath + 'index.html">Andrew Steven Chau</a>' +
    '  <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#header-content">' +
    '    <span class="navbar-toggler-icon"></span>' +
    "  </button>" +
    '  <div class="navbar-collapse collapse" id="header-content">' +
    '    <ul class="navbar-nav ms-auto">' +
    "                " + navLinksHtml +
    "    </ul>" +
    "  </div>" +
    "</nav>";

  var placeholder = document.getElementById("navbar-placeholder");
  if (placeholder) {
    placeholder.innerHTML = navbarHtml;
  }

  // Load common footer scripts (jQuery slim, Popper.js, Bootstrap JS).
  // Also injects the footer. Call this at the end of <body>.
  window.loadCommonScripts = function (callback) {
    // Inject footer (placeholder exists by this point)
    var footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
      footerPlaceholder.innerHTML =
        '<footer class="site-footer">' +
        '  <p>&copy; ' + new Date().getFullYear() + ' Andrew Steven Chau. All rights reserved.</p>' +
        '  <p style="font-size:0.7rem;opacity:0.5;">Character sprite by LPC contributors via <a href="https://opengameart.org/content/lpc-character-bases" style="color:#8b9aff;">OpenGameArt.org</a>, licensed under CC-BY-SA 3.0 / OGA-BY 3.0</p>' +
        '</footer>';
    }

    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js";
    s.integrity = "sha512-HvOjJrdwNpDbkGJIG2ZNqDlVqMo77qbs4Me4cah0HoDrfhrbA+8SBlZn1KrvAQw7cILLPFJvdwIgphzQmMm+Pw==";
    s.crossOrigin = "anonymous";
    s.onload = function () {
      // Activate tab from URL hash (e.g. #GamesTools) and sync hash on tab click
      var hash = window.location.hash;
      if (hash) {
        var tab = document.querySelector('[data-bs-toggle="list"][href="' + hash + '"]');
        if (tab) new bootstrap.Tab(tab).show();
      }
      document.querySelectorAll('[data-bs-toggle="list"]').forEach(function (t) {
        t.addEventListener("shown.bs.tab", function (e) {
          history.replaceState(null, null, e.target.getAttribute("href"));
        });
      });
      if (callback) callback();
    };
    document.body.appendChild(s);

    // Load gamification features
    var gamScript = document.createElement("script");
    gamScript.src = basePath + "js/gamification.js";
    document.body.appendChild(gamScript);
  };
})();
