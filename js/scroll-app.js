/* Scroll-variant portfolio app — render + interactions.
   Reads window.PORTFOLIO_DATA (see js/scroll-data.js). */
(function(){
  var D = window.PORTFOLIO_DATA;
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function html(strings){
    var out = strings.raw ? strings.raw[0] : strings[0];
    for (var i = 1; i < arguments.length; i++){
      out += arguments[i] + (strings.raw ? strings.raw[i] : strings[i]);
    }
    return out;
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  var TWEAKS = window.__TWEAKS_DEFAULTS || { spineCharacter:true, jacket:'auto' };

  /* ---------- Marquee cabinets ---------- */
  function renderMarquee(){
    var m = $('#marquee-cabs');
    if (!m) return;
    m.innerHTML = D.cabinets.map(function(c){
      return '<button class="cab" data-target="' + c.id + '" data-name="' + esc(c.name) +
             '" style="--cc:' + c.cc + ';" aria-label="Jump to ' + esc(c.name) + '">' +
             '<div class="cab-screen">' + esc(c.name.charAt(0)) + '</div>' +
             '<div class="cab-base"></div>' +
             '<div class="cab-label">' + esc(c.name) + '</div>' +
             '</button>';
    }).join('');
    m.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('.cab') : null;
      if (!b) return;
      var t = document.getElementById('s-' + b.dataset.target);
      if (t) t.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  /* ---------- TCG Card renderer ---------- */
  function gcCard(c){
    var noflip = !c.back ? 'true' : 'false';
    var front;
    if (c.kind === 'emblem') {
      var short = (c.abbr || '').length <= 3;
      front = '<div class="emblem" data-short="' + short + '">' + esc(c.abbr) + '</div>';
    } else if (c.img) {
      front = '<div class="art' + (c.contain ? ' contain' : '') + '"><img src="' + esc(c.img) +
              '" alt="' + esc(c.name) + ' cover" loading="lazy"></div>';
    } else {
      front = '';
    }
    var links = c.links || [];
    var flinks = links.slice(0, 2).map(function(p){
      return '<a class="ln" href="' + esc(p[1]) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + esc(p[0]) + '</a>';
    }).join('');
    var blinks = links.map(function(p){
      return '<a class="ln" href="' + esc(p[1]) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + esc(p[0]) + '</a>';
    }).join('');
    var out = '<article class="gc" data-noflip="' + noflip + '"' +
              ' style="--cc:' + esc(c.cc || '') +
              '; --float-dur:' + (3.6 + Math.random() * 1.0).toFixed(2) + 's' +
              '; --float-del:' + (Math.random() * 1.5).toFixed(2) + 's;" ' +
              'aria-label="' + esc(c.name) + (noflip === 'false' ? ' \u2014 click or press Enter to flip' : '') + '"' +
              ' tabindex="' + (noflip === 'false' ? '0' : '-1') + '">' +
              '<div class="inner">' +
              '<div class="face front">' +
                front +
                '<div class="nameplate"><div class="name">' + esc(c.name) + '</div><div class="type">' + esc(c.type || '') + '</div></div>' +
                (c.flavor ? '<div class="flavor">' + esc(c.flavor) + '</div>' : '') +
                (flinks ? '<div class="row">' + flinks + '</div>' : '') +
                (noflip === 'false' ? '<div class="hint">click to flip</div>' : '') +
              '</div>';
    if (c.back) {
      out += '<div class="face back">' +
               '<div class="nameplate"><div class="name">' + esc(c.back.title) + '</div><div class="type">\u21BA</div></div>' +
               (c.back.role ? '<div class="role">' + esc(c.back.role) + '</div>' : '') +
               '<div class="body">' + esc(c.back.body || '') + '</div>' +
               (blinks ? '<div class="row">' + blinks + '</div>' : '') +
             '</div>';
    }
    out += '</div></article>';
    return out;
  }

  /* ---------- About: commander board ---------- */
  function renderAbout(){
    var cm = D.commander;
    var abilities = (cm.abilities || []).map(function(a){
      return '<div class="ability"><b>' + esc(a[0]) + '</b> \u2014 ' + esc(a[1]) + '</div>';
    }).join('');
    var stats = (cm.stats || []).map(function(s){
      return '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>';
    }).join('');
    var cmCard =
      '<article class="gc commander-card" data-noflip="true" style="--cc:#50e3a4;" aria-label="' + esc(cm.name) + ' commander card">' +
        '<div class="inner"><div class="face front">' +
          '<div class="me"><img src="img/about-me/me.JPG" alt="Andrew Steven Chau"></div>' +
          '<div class="nameplate"><div class="name">' + esc(cm.name) + '</div><div class="type">' + esc(cm.type || '') + '</div></div>' +
          '<div class="flavor">' + esc(cm.flavor) + '</div>' +
          (abilities ? '<div class="abilities">' + abilities + '</div>' : '') +
          (stats ? '<div class="stats">' + stats + '</div>' : '') +
          (cm.pt ? '<div class="pt">' + esc(cm.pt) + '</div>' : '') +
        '</div></div>' +
      '</article>';

    var battle = D.battlefield.map(function(b){
      return gcCard({
        kind:'emblem', abbr:b.name, name:b.role, type:b.when, flavor:'', cc:b.cc,
        back:{ title:b.name, role:b.role + ' \u00B7 ' + b.when, body:b.body }
      });
    }).join('');

    var socials = D.socials.map(function(s){
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
             '<span class="dot" aria-hidden="true"></span>' +
             esc(s.svc) + ' \u00B7 ' + esc(s.handle) + '</a>';
    }).join('');

    var ongoing = D.emblemOngoing
      ? '<div class="ongoing"><span class="ongoing-label">ONGOING</span><span class="ongoing-text">' + esc(D.emblemOngoing) + '</span></div>'
      : '';
    var location = D.emblemLocation
      ? '<div class="location">' + esc(D.emblemLocation) + '</div>'
      : '';
    var social =
      '<article class="gc emblem-card" data-noflip="true" style="--cc:#9b6dff;" aria-label="Connect">' +
        '<div class="inner"><div class="face front">' +
          '<div class="nameplate"><div class="name">Connect</div><div class="type">Social Links</div></div>' +
          '<div class="socials">' + socials + '</div>' +
          ongoing + location +
        '</div></div>' +
      '</article>';

    $('#about-board').innerHTML =
      '<div class="zone commander"><div class="zone-label">COMMANDER</div>' + cmCard + '</div>' +
      '<div class="zone"><div class="zone-label">BATTLEFIELD</div><div class="battlefield">' + battle + '</div></div>' +
      '<div class="zone emblem"><div class="zone-label">EMBLEM</div>' + social + '</div>';

    $('#about-lands').innerHTML = D.lands.map(function(l){
      return '<div class="land" style="--lc:' + l.c + ';">' +
             '<div class="ic">' + esc(l.ic) + '</div>' +
             '<div class="nm">' + esc(l.nm) + '</div>' +
             '<div class="li">' + l.li + '</div>' +
             '</div>';
    }).join('');
  }

  /* ---------- Journey chapters ---------- */
  function renderJourney(){
    var el = $('#journey-list');
    if (!el) return;
    el.innerHTML = D.chapters.map(function(c, i){
      return '<article class="chapter" id="ch-' + i + '" style="--cc:' + c.cc + ';">' +
             '<div class="when">' + esc(c.when) + '</div>' +
             '<div><h3>' + esc(c.title) + '</h3>' +
             '<div class="where">' + esc(c.where) + '</div>' +
             '<p>' + esc(c.body) + '</p></div>' +
             '</article>';
    }).join('');
  }

  /* ---------- Tabs (work / personal) ---------- */
  function renderTabs(rootId, deckTitleId, tabs){
    var root = $('#' + rootId);
    if (!root || !tabs || !tabs.length) return;
    var titleEl = $('#' + deckTitleId);
    var bar = '<div class="tab-bar" role="tablist">' +
      tabs.map(function(t, i){
        return '<button role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '"' +
               ' data-tab="' + t.id + '" style="--cc:' + t.cc + ';"' +
               ' class="' + (i === 0 ? 'active' : '') + '">' +
               '<span class="ab">' + esc(t.abbr) + '</span>' +
               '<span>' + esc(t.name) + '</span>' +
               '</button>';
      }).join('') + '</div>';
    var panels = tabs.map(function(t, i){
      return '<div class="deck-panel ' + (i === 0 ? 'active' : '') + '" data-panel="' + t.id + '" role="tabpanel">' +
             '<div class="hand">' + t.cards.map(function(c){
               var merged = {};
               for (var k in c) merged[k] = c[k];
               merged.cc = t.cc;
               return gcCard(merged);
             }).join('') + '</div></div>';
    }).join('');
    root.innerHTML = bar + panels;
    if (titleEl) { titleEl.textContent = tabs[0].name; titleEl.style.setProperty('--cc', tabs[0].cc); }

    root.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
      if (!b) return;
      var id = b.dataset.tab;
      $$('button[role="tab"]', root).forEach(function(x){
        var on = x === b;
        x.classList.toggle('active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      $$('.deck-panel', root).forEach(function(p){
        p.classList.toggle('active', p.dataset.panel === id);
      });
      var tt;
      for (var i = 0; i < tabs.length; i++){
        if (tabs[i].id === id) { tt = tabs[i]; break; }
      }
      if (titleEl && tt) { titleEl.textContent = tt.name; titleEl.style.setProperty('--cc', tt.cc); }
    });
  }

  /* ---------- Play row ---------- */
  function renderPlay(){
    var el = $('#play-row');
    if (!el) return;
    el.innerHTML = D.arcadeRow.map(function(c){
      var href = c.url || '#';
      var tgt  = c.url ? ' target="_blank" rel="noopener"' : '';
      return '<a class="arcade-cab" href="' + esc(href) + '"' + tgt + ' style="--cc:' + c.cc + ';">' +
             '<div class="marquee-strip">' + esc(c.name).toUpperCase() + '</div>' +
             '<div class="crt"><div class="glyph">' + esc(c.glyph) + '</div></div>' +
             '<div class="joy" aria-hidden="true"></div>' +
             '<div class="nm">' + esc(c.name) + '</div>' +
             '<div class="desc">' + esc(c.desc) + '</div>' +
             '</a>';
    }).join('');
  }

  /* ---------- Card flip wiring (delegated) ---------- */
  function wireFlips(){
    document.addEventListener('click', function(e){
      var card = e.target.closest ? e.target.closest('.gc') : null;
      if (!card || card.dataset.noflip === 'true') return;
      if (e.target.closest('a, button')) return;
      card.classList.toggle('flipped');
    });
    document.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = document.activeElement && document.activeElement.closest && document.activeElement.closest('.gc');
      if (!card || card.dataset.noflip === 'true') return;
      e.preventDefault();
      card.classList.toggle('flipped');
    });
    if (matchMedia('(pointer: coarse)').matches){
      $$('.gc .hint').forEach(function(h){ h.textContent = 'tap to flip'; });
    }
  }

  /* ---------- Hero typing ---------- */
  function typing(){
    var lines = [
      '> running portfolio.exe ...',
      '> 30+ titles loaded',
      '> ready_'
    ];
    var el = $('#typing');
    if (!el) return;
    var li = 0, ci = 0, mode = 'type';
    function tick(){
      var cur = lines[li];
      if (mode === 'type'){
        ci++; el.textContent = cur.slice(0, ci);
        if (ci >= cur.length){ mode = 'hold'; setTimeout(tick, 1400); return; }
        setTimeout(tick, 36 + Math.random() * 40);
      } else if (mode === 'hold'){ mode = 'erase'; setTimeout(tick, 600); }
      else if (mode === 'erase'){
        ci--; el.textContent = cur.slice(0, ci);
        if (ci <= 0){ mode = 'type'; li = (li + 1) % lines.length; setTimeout(tick, 250); return; }
        setTimeout(tick, 22);
      }
    }
    tick();
  }

  /* ---------- Spine: scroll-following character + section dots ---------- */
  function buildSpine(){
    var rail = $('#spine');
    if (!rail) return;
    var dotsAndLabels = D.cabinets.map(function(c){
      return '<div class="stop" data-target="' + c.id + '" style="--cc:' + c.cc + ';"></div>' +
             '<div class="label" data-target="' + c.id + '">' + esc(c.name) + '</div>';
    }).join('');
    rail.innerHTML = '<div class="track"></div>' + dotsAndLabels +
      '<div class="spine-sprite walk-down" id="spine-sprite" aria-hidden="true"></div>';
    rail.addEventListener('click', function(e){
      var lab = e.target.closest ? e.target.closest('.label') : null;
      if (!lab) return;
      var t = document.getElementById('s-' + lab.dataset.target);
      if (t) t.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  function positionSpineStops(){
    var rail = $('#spine');
    if (!rail) return;
    var ids = D.cabinets.map(function(c){ return c.id; });
    var stops = $$('.stop', rail);
    var labels = $$('.label', rail);
    ids.forEach(function(_, i){
      var t = (i / (ids.length - 1)) * 100;
      if (stops[i]) stops[i].style.top = t + '%';
      if (labels[i]) labels[i].style.top = t + '%';
    });
  }

  var lastScrollY = window.scrollY;
  function updateSpine(){
    var rail = $('#spine');
    if (!rail) return;
    var cs = getComputedStyle(rail);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var ids = D.cabinets.map(function(c){ return c.id; });
    var sprite = $('#spine-sprite');
    var stops = $$('.stop', rail);
    var center = window.innerHeight * 0.4;
    var activeIdx = 0;
    ids.forEach(function(id, i){
      var sec = document.getElementById('s-' + id);
      if (!sec) return;
      var r = sec.getBoundingClientRect();
      if (r.top <= center) activeIdx = i;
    });
    stops.forEach(function(s, i){ s.classList.toggle('on', i === activeIdx); });

    var pct = activeIdx / (ids.length - 1);
    if (sprite){
      sprite.style.top = (pct * 100) + '%';
      var dy = window.scrollY - lastScrollY;
      if (Math.abs(dy) > 2){
        sprite.classList.remove('walk-up', 'walk-down');
        sprite.classList.add(dy >= 0 ? 'walk-down' : 'walk-up');
        sprite.classList.add('walking');
        clearTimeout(sprite._idleT);
        sprite._idleT = setTimeout(function(){ sprite.classList.remove('walking'); }, 400);
      }
    }
    var cabs = $$('.cab', $('#marquee-cabs'));
    cabs.forEach(function(c, i){ c.classList.toggle('active', i === activeIdx); });
    lastScrollY = window.scrollY;
  }

  /* ---------- Optional tweaks panel (dev convenience) ---------- */
  function setupTweaks(){
    var panel = $('#tweaks');
    if (!panel) return;
    window.addEventListener('message', function(e){
      var d = e.data || {};
      if (d.type === '__activate_edit_mode') panel.classList.add('open');
      if (d.type === '__deactivate_edit_mode') panel.classList.remove('open');
    });
    var spineCb = $('#tw-spine');
    if (spineCb) spineCb.addEventListener('change', function(e){
      TWEAKS.spineCharacter = e.target.checked;
      var sp = $('#spine'); if (sp) sp.style.display = e.target.checked ? '' : 'none';
    });
    var jacketSel = $('#tw-jacket');
    if (jacketSel) jacketSel.addEventListener('change', function(e){
      TWEAKS.jacket = e.target.value;
      applyJacket();
    });
  }

  function applyJacket(){
    var sprites = $$('#spine-sprite, .hero-sprite');
    var url = 'img/character-spritesheet.png';
    if (TWEAKS.jacket === 'no') url = 'img/character-spritesheet-no-jacket.png';
    sprites.forEach(function(s){ s.style.backgroundImage = "url('" + url + "')"; });
  }

  /* ---------- Init ---------- */
  function safe(fn, label){ try { fn(); } catch(err){ console.error('[scroll] ' + label + ':', err); } }
  function init(){
    safe(renderMarquee,  'marquee');
    safe(renderAbout,    'about');
    safe(renderJourney,  'journey');
    safe(function(){ renderTabs('work-deck', 'work-title', D.workTabs); }, 'work');
    safe(function(){ renderTabs('personal-deck', 'personal-title', D.personalTabs); }, 'personal');
    safe(renderPlay,     'play');
    safe(buildSpine,     'buildSpine');
    safe(positionSpineStops, 'positionSpineStops');
    safe(wireFlips,      'wireFlips');
    safe(typing,         'typing');
    safe(setupTweaks,    'setupTweaks');

    if (TWEAKS.spineCharacter === false && $('#spine')) $('#spine').style.display = 'none';
    if (TWEAKS.jacket && TWEAKS.jacket !== 'auto') safe(applyJacket, 'jacket');
    var spineCb = $('#tw-spine'); if (spineCb) spineCb.checked = TWEAKS.spineCharacter !== false;
    var jacketSel = $('#tw-jacket'); if (jacketSel) jacketSel.value = TWEAKS.jacket || 'auto';

    var ticking = false;
    function onScroll(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){ safe(updateSpine, 'updateSpine'); ticking = false; });
    }
    window.addEventListener('scroll', onScroll, { passive:true });
    document.addEventListener('scroll', onScroll, { passive:true });
    window.addEventListener('resize', function(){
      safe(positionSpineStops, 'resize-pos');
      safe(updateSpine, 'resize-upd');
    });
    safe(updateSpine, 'init-update');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
