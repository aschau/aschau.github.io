// ============================================
// Gamification — Arcade Edition
// Achievement tracking, toast notifications, panel, and progress bar.
// Hooks into arcade.js via DOM events (no direct coupling).
// ── Logic must stay in sync with js/gamification.module.js ──
// ============================================

(function () {
  'use strict';

  // ── Achievement Definitions (mirror of module) ──

  var ACHIEVEMENTS = {
    'cabinet-crawler':  { title: 'Cabinet Crawler',  desc: 'Visited all 5 sections',        hint: 'Visit every cabinet in the arcade...', icon: '\uD83D\uDD79\uFE0F' },
    'card-collector':   { title: 'Card Collector',   desc: 'Flipped a card',                hint: 'There\'s something on the back...',    icon: '\uD83C\uDCCF' },
    'pixel-walker':     { title: 'Pixel Walker',     desc: 'Used keyboard navigation',      hint: 'Try the arrow keys...',                icon: '\u2328\uFE0F' },
    curious:            { title: 'Curious',          desc: 'Clicked an external link',      hint: 'Follow a link to the outside...',      icon: '\uD83D\uDD0D' },
    'night-owl':        { title: 'Night Owl',        desc: 'Visited after 10 PM',           hint: 'Come back when the moon is out...',    icon: '\uD83C\uDF19' },
    'deep-diver':       { title: 'Deep Diver',       desc: 'Visited a project detail page', hint: 'Go deeper into a project...',          icon: '\uD83E\uDD3F' },
    'social-butterfly': { title: 'Social Butterfly', desc: 'Clicked a social profile link', hint: 'Connect on social media...',           icon: '\uD83E\uDD8B' },
    'player-one':       { title: 'Player One',       desc: 'Visited the Play section',      hint: 'Ready Player One...',                  icon: '\uD83C\uDFAE' },
    commander:          { title: 'Commander',        desc: 'Met the commander',             hint: 'Step into the command zone...',        icon: '\uD83D\uDC51' },
    'first-draw':       { title: 'Starter Deck',     desc: 'Opened your first deck',        hint: 'Visit Work or Personal...',            icon: '\uD83C\uDFB4' },
    'full-hand':        { title: 'Set Mastery',      desc: 'Opened every deck in a section', hint: 'Play every deck in Work or Personal...', icon: '\u270B' }
  };

  var SECTIONS = ['home', 'about', 'work', 'personal', 'play'];
  var WORK_DECKS = ['w-blizzard', 'w-mw', 'w-sega', 'w-trigger', 'w-stb'];
  var PERSONAL_DECKS = ['pp-fc', 'pp-wh', 'pp-ai', 'pp-web', 'pp-col'];
  var ALL_TABS = WORK_DECKS.concat(PERSONAL_DECKS);

  var STORAGE_KEY = 'arcade_achievements';
  var SECTIONS_KEY = 'arcade_sections_visited';
  var CARDS_KEY = 'arcade_cards_flipped';
  var TABS_KEY = 'arcade_tabs_clicked';

  // ── Storage helpers ──

  function getJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // ── Core unlock logic ──

  function isUnlocked(id) {
    return !!getJSON(STORAGE_KEY, {})[id];
  }

  function unlockCount() {
    return Object.keys(getJSON(STORAGE_KEY, {})).length;
  }

  function unlock(id) {
    var data = getJSON(STORAGE_KEY, {});
    if (data[id]) return false;
    data[id] = { unlocked: true, date: new Date().toISOString() };
    setJSON(STORAGE_KEY, data);
    showToast(id);
    updateBadge();
    if (panelOpen) renderPanelContent();
    return true;
  }

  // ── UI: Toast ──

  var toastContainer;

  function createToastContainer() {
    toastContainer = document.createElement('div');
    toastContainer.className = 'ach-toast-container';
    document.body.appendChild(toastContainer);
  }

  function showToast(id) {
    var ach = ACHIEVEMENTS[id];
    if (!ach || !toastContainer) return;
    var el = document.createElement('div');
    el.className = 'ach-toast';
    el.innerHTML = '<span class="ach-toast-icon">' + ach.icon + '</span>' +
      '<div class="ach-toast-label">Achievement Unlocked</div>' +
      '<div class="ach-toast-title">' + ach.title + '</div>' +
      '<div class="ach-toast-desc">' + ach.desc + '</div>';
    toastContainer.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 400);
    }, 4000);
  }

  // ── UI: Toggle + Panel ──

  var panelOpen = false;
  var toggleBtn, panel;

  function createToggle() {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'ach-toggle';
    toggleBtn.setAttribute('aria-label', 'Achievements');
    toggleBtn.innerHTML = '\uD83C\uDFC6<span class="ach-badge" id="ach-badge"></span>';
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      panelOpen = !panelOpen;
      panel.classList.toggle('open', panelOpen);
      if (panelOpen) renderPanelContent();
    });

    // Close panel when clicking outside
    document.addEventListener('click', function (e) {
      if (!panelOpen) return;
      if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
      panelOpen = false;
      panel.classList.remove('open');
    });
    var bezel = document.querySelector('.screen-bezel');
    (bezel || document.body).appendChild(toggleBtn);
    updateBadge();
  }

  function createPanel() {
    panel = document.createElement('div');
    panel.className = 'ach-panel';
    panel.setAttribute('aria-label', 'Achievements panel');
    document.body.appendChild(panel);
  }

  function renderPanelContent() {
    var count = unlockCount();
    var total = Object.keys(ACHIEVEMENTS).length;
    var html = '<div class="ach-panel-header">Achievements (' + count + '/' + total + ')</div>';

    var ids = Object.keys(ACHIEVEMENTS);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var ach = ACHIEVEMENTS[id];
      var got = isUnlocked(id);
      html += '<div class="ach-tile ' + (got ? 'unlocked' : 'locked') + '">' +
        '<span class="ach-tile-icon">' + ach.icon + '</span>' +
        '<div class="ach-tile-info">' +
        '<div class="ach-tile-title">' + ach.title + '</div>' +
        '<div class="ach-tile-desc">' + (got ? ach.desc : ach.hint) + '</div>' +
        '</div></div>';
    }

    html += '<button class="ach-clear" id="ach-clear">Clear All Progress</button>';
    panel.innerHTML = html;

    document.getElementById('ach-clear').addEventListener('click', function () {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SECTIONS_KEY);
      localStorage.removeItem(CARDS_KEY);
      localStorage.removeItem(TABS_KEY);
      renderPanelContent();
      updateBadge();
      updateProgress();
    });
  }

  function updateBadge() {
    var badge = document.getElementById('ach-badge');
    if (badge) {
      var c = unlockCount();
      badge.textContent = c > 0 ? c : '';
    }
  }

  // ── UI: Progress bar ──

  function updateProgress() {
    var fill = document.getElementById('ach-progress-fill');
    if (!fill) return;
    var visited = getJSON(SECTIONS_KEY, []);
    var pct = Math.round((visited.length / SECTIONS.length) * 100);
    fill.style.width = pct + '%';
  }

  // ── Tracking: Section visits ──

  function trackSection(sectionId) {
    if (SECTIONS.indexOf(sectionId) === -1) return;
    var visited = getJSON(SECTIONS_KEY, []);
    if (visited.indexOf(sectionId) === -1) {
      visited.push(sectionId);
      setJSON(SECTIONS_KEY, visited);
      updateProgress();
    }

    if (visited.length >= SECTIONS.length) unlock('cabinet-crawler');
    if (sectionId === 'play') unlock('player-one');
    if (sectionId === 'about') unlock('commander');
    if (sectionId === 'work' || sectionId === 'personal') unlock('first-draw');
  }

  // ── Tracking: Card flips ──

  var flippableCounts = {};

  function trackCardFlip(key, cardIndex) {
    var flipped = getJSON(CARDS_KEY, {});
    if (!flipped[key]) flipped[key] = [];
    if (flipped[key].indexOf(cardIndex) === -1) {
      flipped[key].push(cardIndex);
      setJSON(CARDS_KEY, flipped);
    }
    unlock('card-collector');
  }

  // ── Tracking: Tabs ──

  // Counts the deck that's already active when a section loads (so Set Mastery
  // doesn't require you to click back to the first deck after opening all others).
  function trackActiveDeck() {
    var active = document.querySelector('.hand-card.active');
    if (active && active.dataset.tab) trackTab(active.dataset.tab);
  }

  function trackTab(tabId) {
    var clicked = getJSON(TABS_KEY, []);
    if (clicked.indexOf(tabId) === -1) {
      clicked.push(tabId);
      setJSON(TABS_KEY, clicked);
    }
    unlock('first-draw');
    var workDone = WORK_DECKS.every(function(id) { return clicked.indexOf(id) !== -1; });
    var personalDone = PERSONAL_DECKS.every(function(id) { return clicked.indexOf(id) !== -1; });
    if (workDone || personalDone) unlock('full-hand');
  }

  // ── Helpers ──

  function getCurrentSection() {
    var params = new URLSearchParams(location.search);
    var route = params.get('route');
    if (route) {
      var s = route.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
      if (SECTIONS.indexOf(s) >= 0) return s;
    }
    var path = location.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
    return SECTIONS.indexOf(path) >= 0 ? path : 'home';
  }

  function updateFlippableCounts() {
    var activeCab = document.querySelector('.cabinet.active');
    if (!activeCab) return;
    var sectionId = activeCab.dataset.id;
    var contentEl = document.getElementById('section-content');
    if (!contentEl) return;

    var tabPanels = contentEl.querySelectorAll('.tab-panel');
    if (tabPanels.length > 0) {
      for (var i = 0; i < tabPanels.length; i++) {
        var tp = tabPanels[i];
        var key = sectionId + ':' + tp.id;
        flippableCounts[key] = tp.querySelectorAll('.gc:not(.no-flip)').length;
      }
    } else {
      flippableCounts[sectionId] = contentEl.querySelectorAll('.gc:not(.no-flip)').length;
    }
  }

  // ── Event listeners ──

  function initListeners() {
    // Keyboard → Pixel Walker
    document.addEventListener('keydown', function (e) {
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].indexOf(e.key) !== -1) {
        unlock('pixel-walker');
      }
    });

    // External links → Curious. Use capture phase so .gc a's stopPropagation() doesn't block us.
    document.addEventListener('click', function (e) {
      if (e.target.closest('a[target="_blank"]')) unlock('curious');
    }, true);

    // Social buttons → Social Butterfly (both .soc-btn on commander and .gc-social-link on emblem)
    document.addEventListener('click', function (e) {
      if (e.target.closest('.soc-btn, .gc-social-link')) unlock('social-butterfly');
    }, true);

    // Detail page links → Deep Diver
    document.addEventListener('click', function (e) {
      if (e.target.closest('a[href*="projects/"]')) unlock('deep-diver');
    }, true);

    // Card flips
    document.addEventListener('click', function (e) {
      var card = e.target.closest('.gc');
      if (!card || card.classList.contains('no-flip')) return;
      if (e.target.closest('a') || e.target.closest('iframe') || e.target.closest('.gallery-arrow') || e.target.closest('.gallery-dots')) return;
      if (e.target.matches('.gc-art, .gc-art-contain, .gc-back-gallery img')) return;

      var activeCab = document.querySelector('.cabinet.active');
      if (!activeCab) return;
      var sectionId = activeCab.dataset.id;
      var contentEl = document.getElementById('section-content');
      if (!contentEl) return;
      var activeTab = contentEl.querySelector('.tab-panel.active');
      var container = activeTab || contentEl;
      var cards = Array.from(container.querySelectorAll('.gc:not(.no-flip)'));
      var idx = cards.indexOf(card);
      if (idx >= 0) {
        var key = sectionId;
        if (activeTab) key = sectionId + ':' + activeTab.id;
        trackCardFlip(key, idx);
      }
    });

    // Tab clicks
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn, .hand-card');
      if (btn && btn.dataset.tab) trackTab(btn.dataset.tab);
    });

    // Home is always "visible" when the arcade loads; also track the URL section if different.
    var current = getCurrentSection();
    trackSection('home');
    if (current !== 'home') trackSection(current);

    function afterSectionLoad() {
      setTimeout(function() { updateFlippableCounts(); trackActiveDeck(); }, 500);
    }

    var origPush = history.pushState;
    history.pushState = function () {
      origPush.apply(history, arguments);
      trackSection(getCurrentSection());
      afterSectionLoad();
    };

    window.addEventListener('popstate', function () {
      trackSection(getCurrentSection());
      afterSectionLoad();
    });
  }

  // ── Init ──

  function init() {
    createToastContainer();
    createToggle();
    createPanel();

    // Night Owl
    var hour = new Date().getHours();
    if (hour >= 22 || hour < 5) unlock('night-owl');

    // Wait for arcade to finish loading
    setTimeout(function () {
      initListeners();
      updateProgress();
      updateFlippableCounts();
      trackActiveDeck();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
