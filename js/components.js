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
      { href: "games/parsed/index.html", label: "Parsed", desc: "Daily code puzzle" },
      { href: "games/philosophy/index.html", label: "Examined", desc: "Philosophy alignment quiz" }
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

    var loadingContent = document.createElement("div");
    loadingContent.className = "loading-content";

    var loadingTitle = document.createElement("h1");
    loadingTitle.className = "loading-title";
    loadingTitle.textContent = "Andrew Steven Chau";
    loadingContent.appendChild(loadingTitle);

    var barTrack = document.createElement("div");
    barTrack.className = "loading-bar-track";
    var barFill = document.createElement("div");
    barFill.className = "loading-bar-fill";
    barFill.id = "loading-bar-fill";
    barTrack.appendChild(barFill);
    loadingContent.appendChild(barTrack);

    var tipEl = document.createElement("p");
    tipEl.className = "loading-tip";
    tipEl.id = "loading-tip";
    tipEl.textContent = tips[0];
    loadingContent.appendChild(tipEl);

    overlay.appendChild(loadingContent);
    document.body.insertBefore(overlay, document.body.firstChild);

    // Cycle tips
    var tipIndex = 0;
    var tipInterval = setInterval(function () {
      tipIndex = (tipIndex + 1) % tips.length;
      tipEl.style.opacity = "0";
      setTimeout(function () {
        tipEl.textContent = tips[tipIndex];
        tipEl.style.opacity = "1";
      }, 200);
    }, 800);

    // Animate progress bar
    setTimeout(function () { barFill.style.width = "100%"; }, 50);

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
  function buildNavLinks() {
    var fragment = document.createDocumentFragment();

    navItems.forEach(function (item) {
      var li = document.createElement("li");

      if (item.dropdown) {
        var isAnyActive = item.dropdown.some(function (d) {
          return window.location.pathname.indexOf(d.href.replace("index.html", "")) !== -1;
        });
        li.className = "nav-item dropdown" + (isAnyActive ? " active" : "");

        var toggle = document.createElement("a");
        toggle.className = "nav-link dropdown-toggle";
        toggle.href = "#";
        toggle.role = "button";
        toggle.setAttribute("data-bs-toggle", "dropdown");
        toggle.setAttribute("aria-haspopup", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = item.label;
        li.appendChild(toggle);

        var menu = document.createElement("div");
        menu.className = "dropdown-menu dropdown-menu-end";

        item.dropdown.forEach(function (d) {
          var a = document.createElement("a");
          a.className = "dropdown-item";
          a.href = basePath + d.href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = d.label;
          var small = document.createElement("small");
          small.className = "text-muted ms-2";
          small.textContent = d.desc;
          a.appendChild(small);
          menu.appendChild(a);
        });

        li.appendChild(menu);
      } else {
        var isActive = currentPage === item.href;
        li.className = "nav-item" + (isActive ? " active" : "");

        var link = document.createElement("a");
        link.className = "nav-link";
        link.href = basePath + item.href;
        link.textContent = item.label;

        if (isActive) {
          var sr = document.createElement("span");
          sr.className = "visually-hidden";
          sr.textContent = "(current)";
          link.appendChild(sr);
        }

        li.appendChild(link);
      }

      fragment.appendChild(li);
    });

    return fragment;
  }

  var nav = document.createElement("nav");
  nav.className = "navbar fixed-top navbar-expand-lg navbar-dark";

  var brand = document.createElement("a");
  brand.className = "navbar-brand link";
  brand.href = basePath + "index.html";
  brand.textContent = "Andrew Steven Chau";
  nav.appendChild(brand);

  var toggler = document.createElement("button");
  toggler.className = "navbar-toggler";
  toggler.type = "button";
  toggler.setAttribute("data-bs-toggle", "collapse");
  toggler.setAttribute("data-bs-target", "#header-content");
  var togglerIcon = document.createElement("span");
  togglerIcon.className = "navbar-toggler-icon";
  toggler.appendChild(togglerIcon);
  nav.appendChild(toggler);

  var collapseDiv = document.createElement("div");
  collapseDiv.className = "navbar-collapse collapse";
  collapseDiv.id = "header-content";

  var navUl = document.createElement("ul");
  navUl.className = "navbar-nav ms-auto";
  navUl.appendChild(buildNavLinks());
  collapseDiv.appendChild(navUl);
  nav.appendChild(collapseDiv);

  var placeholder = document.getElementById("navbar-placeholder");
  if (placeholder) {
    placeholder.appendChild(nav);
  }

  // Load Bootstrap JS bundle and inject footer.
  // Call this at the end of <body>.
  window.loadCommonScripts = function (callback) {
    // Inject footer
    var footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
      var footer = document.createElement("footer");
      footer.className = "site-footer";

      var copyright = document.createElement("p");
      copyright.textContent = "\u00A9 " + new Date().getFullYear() + " Andrew Steven Chau. All rights reserved.";
      footer.appendChild(copyright);

      var attribution = document.createElement("p");
      attribution.style.fontSize = "0.7rem";
      attribution.style.opacity = "0.5";
      attribution.textContent = "Character sprite by LPC contributors via ";
      var attrLink = document.createElement("a");
      attrLink.href = "https://opengameart.org/content/lpc-character-bases";
      attrLink.style.color = "#8b9aff";
      attrLink.textContent = "OpenGameArt.org";
      attribution.appendChild(attrLink);
      attribution.appendChild(document.createTextNode(", licensed under CC-BY-SA 3.0 / OGA-BY 3.0"));
      footer.appendChild(attribution);

      footerPlaceholder.appendChild(footer);
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
