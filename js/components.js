// Shared components to reduce duplication across pages.
// Usage: add <div id="navbar-placeholder"></div> where the nav should appear,
// then include this script. It auto-detects the current page for the active state.

(function () {
  var navItems = [
    { href: "index.html", label: "Home" },
    { href: "aboutMe.html", label: "About" },
    { href: "workprojects.html", label: "Work" },
    { href: "personalprojects.html", label: "Personal" }
  ];

  var path = window.location.pathname;
  var currentPage = path.substring(path.lastIndexOf("/") + 1) || "index.html";

  var navLinksHtml = navItems.map(function (item) {
    var isActive = currentPage === item.href;
    var activeClass = isActive ? " active" : "";
    var srOnly = isActive ? ' <span class="sr-only">(current)</span>' : "";
    return (
      '<li class="nav-item' + activeClass + '">' +
      '<a class="nav-link" href="' + item.href + '">' + item.label + srOnly + "</a>" +
      "</li>"
    );
  }).join("\n                ");

  var navbarHtml =
    '<nav class="navbar fixed-top navbar-expand-sm navbar-dark" style="background-color: #000000;">' +
    '  <a class="navbar-brand link" href="index.html">Andrew Chau | Portfolio</a>' +
    '  <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#header-content">' +
    '    <span class="navbar-toggler-icon"></span>' +
    "  </button>" +
    '  <div class="navbar-collapse collapse" id="header-content">' +
    '    <ul class="navbar-nav ml-auto">' +
    "                " + navLinksHtml +
    "    </ul>" +
    "  </div>" +
    "</nav>";

  var placeholder = document.getElementById("navbar-placeholder");
  if (placeholder) {
    placeholder.innerHTML = navbarHtml;
  }

  // Load common footer scripts (jQuery slim, Popper.js, Bootstrap JS).
  // Call this at the end of <body> to load them in order.
  window.loadCommonScripts = function (callback) {
    var scripts = [
      {
        src: "https://code.jquery.com/jquery-3.3.1.slim.min.js",
        integrity: "sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo"
      },
      {
        src: "https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js",
        integrity: "sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1"
      },
      {
        src: "https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js",
        integrity: "sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM"
      }
    ];

    function loadNext(i) {
      if (i >= scripts.length) {
        if (callback) callback();
        return;
      }
      var s = document.createElement("script");
      s.src = scripts[i].src;
      s.integrity = scripts[i].integrity;
      s.crossOrigin = "anonymous";
      s.onload = function () { loadNext(i + 1); };
      document.body.appendChild(s);
    }

    loadNext(0);
  };
})();
