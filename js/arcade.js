var cabinets = document.querySelectorAll('.cabinet');
  var panelIds = ['home','about','journey','work','personal','play'];
  var character = document.getElementById('character');
  var strip = document.getElementById('world-strip');
  var modeLabel = document.getElementById('ctrl-mode-label');

  // Navigation state
  var contentSprite = document.getElementById('content-sprite');
  var ambientEl = document.getElementById('screen-ambient');
  var patternEl = document.getElementById('screen-pattern');
  var currentCab = 0;     // which cabinet
  var currentCard = 0;    // which card in carousel
  var currentTab = 0;     // which tab
  var layer = 0;          // 0=world, 1=cards, 2=tabs

  var ambients = {
    home: 'radial-gradient(ellipse at 40% 30%, #4a90d9, transparent 70%)',
    about: 'radial-gradient(ellipse at 50% 30%, #50e3a4, transparent 70%)',
    journey: 'radial-gradient(ellipse at 50% 40%, #4ecdc4, transparent 70%)',
    work: 'radial-gradient(ellipse at 60% 30%, #ff8a50, transparent 70%)',
    personal: 'radial-gradient(ellipse at 40% 50%, #ff6b9d, transparent 70%)',
    play: 'radial-gradient(ellipse at 50% 30%, #9b6dff, transparent 70%)'
  };

  // Themed subtle patterns per section
  var patterns = {
    home: 'radial-gradient(circle at 30% 70%, rgba(74,144,217,0.03) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(122,184,255,0.02) 0%, transparent 50%)',
    about: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(80,227,164,0.015) 50px, rgba(80,227,164,0.015) 52px), repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(80,227,164,0.015) 50px, rgba(80,227,164,0.015) 52px)',
    journey: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(78,205,196,0.02) 40px, rgba(78,205,196,0.02) 42px)',
    work: 'repeating-linear-gradient(-45deg, transparent, transparent 30px, rgba(255,138,80,0.02) 30px, rgba(255,138,80,0.02) 32px), repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,138,80,0.015) 30px, rgba(255,138,80,0.015) 32px)',
    personal: 'radial-gradient(circle at 20% 80%, rgba(255,107,157,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,107,157,0.03) 0%, transparent 50%)',
    play: 'repeating-linear-gradient(60deg, transparent, transparent 25px, rgba(155,109,255,0.02) 25px, rgba(155,109,255,0.02) 27px), repeating-linear-gradient(-60deg, transparent, transparent 25px, rgba(155,109,255,0.015) 25px, rgba(155,109,255,0.015) 27px)'
  };

  // Stars
  (function() {
    var c = document.getElementById('stars');
    for (var i = 0; i < 50; i++) {
      var s = document.createElement('div'); s.className = 'star';
      s.style.width = s.style.height = (Math.random()*1.5+0.5)+'px';
      s.style.left = Math.random()*100+'%'; s.style.top = Math.random()*60+'%';
      s.style.setProperty('--d', (Math.random()*4+2)+'s');
      s.style.setProperty('--o', (Math.random()*0.4+0.1).toFixed(2));
      s.style.animationDelay = (Math.random()*5)+'s';
      c.appendChild(s);
    }
  })();

  // Typing — starts when home section is loaded and #typing-text exists
  var typingStarted = false;
  function startTyping() {
    if (typingStarted) return;
    var el = document.getElementById("typing-text");
    if (!el) return;
    typingStarted = true;
    var roles = ["Senior Software Engineer","AR/XR Developer","Game Developer","Indie Developer"];
    var ri=0,ci=0,del=false;
    function tick() {
      var el2 = document.getElementById("typing-text");
      if (!el2) return; // stop if element removed (navigated away)
      if(!del){el2.textContent=roles[ri].substring(0,ci+1);ci++;if(ci===roles[ri].length){del=true;setTimeout(tick,1800);return;}setTimeout(tick,80);}
      else{el2.textContent=roles[ri].substring(0,ci-1);ci--;if(ci===0){del=false;ri=(ri+1)%roles.length;setTimeout(tick,400);return;}setTimeout(tick,40);}
    }
    tick();
  }

  // Get cards in the active carousel of current section
  function getCards() {
    if (!contentEl) return [];
    var activeTab = contentEl.querySelector('.tab-panel.active');
    var container = activeTab || contentEl;
    return Array.from(container.querySelectorAll('.gc'));
  }

  // Get tabs in current section
  function getTabs() {
    if (!contentEl) return [];
    return Array.from(contentEl.querySelectorAll('.tab-btn'));
  }

  // Highlight active card — scrolls the card to center
  function highlightCard(idx) {
    var cards = getCards();
    cards.forEach(function(c, i) { c.classList.toggle('card-active', i === idx); });
    if (cards[idx]) {
      cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    // Journey section: swap jacket at MobilityWare (index 4)
    if (panelIds[currentCab] === 'journey' && contentSprite) {
      contentSprite.classList.toggle('no-jacket', idx < 4);
    }
  }

  function clearCardHighlight() {
    document.querySelectorAll('.gc.card-active').forEach(function(c) { c.classList.remove('card-active'); });
  }

  // Sprite stays centered — cards scroll to it
  function positionSpriteBottom() {
    if (!contentSprite) return;
    // Position just below the active card (tight gap)
    var activeCard = document.querySelector('.gc.card-active');
    if (activeCard) {
      var rect = activeCard.getBoundingClientRect();
      contentSprite.style.bottom = (window.innerHeight - rect.bottom - 54) + 'px';
    } else {
      // Fallback: just above the world strip
      var world = document.querySelector('.world');
      if (world) {
        var rect = world.getBoundingClientRect();
        contentSprite.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
      }
    }
  }

  function showContentSprite() {
    character.style.opacity = '0.3';
    contentSprite.classList.remove('walk-right','walk-left','no-jacket');
    contentSprite.classList.add('idle');
    // Journey: start with jacket state based on current card
    if (panelIds[currentCab] === 'journey') {
      contentSprite.classList.toggle('no-jacket', currentCard < 4);
    }
    // Position first (hidden), then show after positioned
    contentSprite.style.transition = 'none';
    contentSprite.style.opacity = '0';
    setTimeout(function() {
      positionSpriteBottom();
      contentSprite.style.transition = '';
      contentSprite.classList.add('visible');
      contentSprite.style.opacity = '';
    }, 400);
  }

  function hideContentSprite() {
    character.style.opacity = '1';
    contentSprite.classList.remove('visible','walk-right','walk-left','no-jacket');
    contentSprite.classList.add('idle');
  }

  // Brief walk animation when scrolling cards
  function spriteWalkBrief(goingRight) {
    contentSprite.classList.remove('idle','walk-right','walk-left');
    contentSprite.classList.add(goingRight ? 'walk-right' : 'walk-left');
    setTimeout(function() {
      contentSprite.classList.remove('walk-right','walk-left');
      contentSprite.classList.add('idle');
    }, 500);
  }

  // Highlight active tab
  function highlightTab(idx) {
    var tabs = getTabs();
    tabs.forEach(function(t, i) { t.classList.toggle('tab-focused', i === idx); });
  }

  function clearTabHighlight() {
    document.querySelectorAll('.tab-btn.tab-focused').forEach(function(t) { t.classList.remove('tab-focused'); });
  }

  function updateModeLabel() {
    var labels = ['WORLD', 'CARDS', 'TABS'];
    if (modeLabel) modeLabel.textContent = labels[layer] || 'WORLD';
  }

  // Switch cabinet (layer 0 left/right)
  // Navigate to a specific cabinet and optionally activate a tab
  function goToSection(cabId, tabId) {
    var cabIdx = panelIds.indexOf(cabId);
    if (cabIdx < 0) return;
    goToCab(cabIdx);
    if (tabId) {
      // Wait for section to load + inject, then click the tab
      setTimeout(function() {
        var btn = contentEl.querySelector('[data-tab="' + tabId + '"]');
        if (btn) btn.click();
      }, 800);
    }
  }

  // Section content cache
  var sectionCache = {};
  var contentEl = document.getElementById('section-content');

  function loadSection(id, callback) {
    if (sectionCache[id]) { callback(sectionCache[id]); return; }
    // Try fetch first (works on http), fall back to inline (file://)
    fetch('sections/' + id + '.html')
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(html) { sectionCache[id] = html; callback(html); })
      .catch(function() {
        // Fallback: section not available
        callback('<div class="p-tag">// ' + id + '</div><h2 class="p-title">' + id.charAt(0).toUpperCase() + id.slice(1) + '</h2><div class="p-desc">Section loading...</div>');
      });
  }

  // Bind event handlers on freshly injected section content
  function bindSectionHandlers() {
    contentEl.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabId = btn.dataset.tab;
        var bar = btn.closest('.tab-bar') || btn.parentElement;
        var tabs = Array.from(bar.querySelectorAll('.tab-btn'));
        tabs.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        contentEl.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
        var target = document.getElementById(tabId);
        if (target) target.classList.add('active');
        currentTab = tabs.indexOf(btn);
        currentCard = 0;
        if (layer === 1) { highlightCard(0); }
      });
    });

    contentEl.querySelectorAll('.gc a, .gc iframe').forEach(function(el) {
      el.addEventListener('click', function(e) { e.stopPropagation(); });
    });

    startTyping();

    if ('ontouchstart' in window || window.innerWidth <= 768) {
      contentEl.querySelectorAll('.gc-flip-hint').forEach(function(el) {
        el.textContent = 'tap to flip';
      });
    }
  }

  function injectSection(html, goingRight) {
    contentEl.style.transform = goingRight ? 'translateX(-40px)' : 'translateX(40px)';
    contentEl.style.opacity = '0';

    setTimeout(function() {
      contentEl.innerHTML = html;
      contentEl.style.transition = 'none';
      contentEl.style.transform = goingRight ? 'translateX(40px)' : 'translateX(-40px)';
      contentEl.offsetHeight;
      contentEl.style.transition = '';
      contentEl.style.transform = '';
      contentEl.style.opacity = '';

      bindSectionHandlers();

      // Peek flip on first visit
      if (!peeked[currentCab]) {
        peeked[currentCab] = true;
        var firstCard = contentEl.querySelector('.gc');
        if (firstCard) {
          setTimeout(function() {
            firstCard.classList.add('peek');
            firstCard.addEventListener('animationend', function() { firstCard.classList.remove('peek'); }, { once: true });
          }, 400);
        }
      }
    }, 300);
  }

  // Page titles per section
  var titles = {
    home: 'Andrew Steven Chau | Senior Software Engineer & Game Developer',
    about: 'Andrew Steven Chau | About Me',
    journey: 'Andrew Steven Chau | Career Journey',
    work: 'Andrew Steven Chau | Work Projects',
    personal: 'Andrew Steven Chau | Personal Projects',
    play: 'Andrew Steven Chau | Games & Tools'
  };

  function updateRoute(id, push) {
    var path = id === 'home' ? '/' : '/' + id;
    if (push) {
      history.pushState({ section: id }, '', path);
    }
    document.title = titles[id] || titles.home;
  }

  function goToCab(idx, skipPush) {
    if (idx < 0 || idx >= cabinets.length || idx === currentCab) return;

    // Reset to world layer
    layer = 0;
    hideContentSprite();
    clearCardHighlight();
    clearTabHighlight();
    updateModeLabel();

    var oldIdx = currentCab;
    var goingRight = idx > oldIdx;
    var sectionId = panelIds[idx];

    cabinets.forEach(function(c,i) { c.classList.toggle('active', i === idx); });

    var cab = cabinets[idx];
    var cabCenter = cab.offsetLeft + cab.offsetWidth / 2;
    var viewCenter = window.innerWidth / 2;
    strip.style.transform = 'translateX(' + (-(cabCenter - viewCenter)) + 'px)';

    var charTarget = cabCenter + (-(cabCenter - viewCenter)) - 32;
    character.classList.remove('idle','walk-right','walk-left');
    character.classList.add('walking', goingRight ? 'walk-right' : 'walk-left');
    character.style.left = charTarget + 'px';
    function onWalkEnd(e) {
      if (e && e.propertyName !== 'left') return;
      character.removeEventListener('transitionend', onWalkEnd);
      character.classList.remove('walking','walk-right','walk-left');
      character.classList.add('idle');
    }
    character.addEventListener('transitionend', onWalkEnd);
    setTimeout(function() {
      character.removeEventListener('transitionend', onWalkEnd);
      character.classList.remove('walking','walk-right','walk-left');
      character.classList.add('idle');
    }, 1800);

    currentCab = idx;
    currentCard = 0;
    currentTab = 0;

    // Update URL and title
    if (!skipPush) updateRoute(sectionId, true);

    // Update ambient
    if (ambientEl) ambientEl.style.background = ambients[sectionId] || ambients.home;
    if (patternEl) { patternEl.style.background = patterns[sectionId] || ''; patternEl.classList.toggle('visible', !!patterns[sectionId]); }

    // Load and inject section content
    loadSection(sectionId, function(html) {
      injectSection(html, goingRight);
    });
  }

  // Navigate up a layer
  function goUp() {
    if (layer === 0) {
      var cards = getCards();
      if (cards.length === 0) return;
      layer = 1;
      currentCard = 0;
      highlightCard(0);
      showContentSprite();
    } else if (layer === 1) {
      // Cards → Tabs (if tabs exist)
      var tabs = getTabs();
      if (tabs.length === 0) return;
      layer = 2;
      // Find the currently active tab
      currentTab = tabs.findIndex(function(t) { return t.classList.contains('active'); });
      if (currentTab < 0) currentTab = 0;
      highlightTab(currentTab);
      clearCardHighlight();
    }
    updateModeLabel();
  }

  // Navigate down a layer
  function goDown() {
    if (layer === 2) {
      layer = 1;
      clearTabHighlight();
      currentCard = 0;
      highlightCard(0);
      showContentSprite();
    } else if (layer === 1) {
      layer = 0;
      clearCardHighlight();
      clearTabHighlight();
      hideContentSprite();
    }
    updateModeLabel();
  }

  // Left/right based on current layer
  function goLeft() {
    if (layer === 0) {
      goToCab(currentCab - 1);
    } else if (layer === 1) {
      var cards = getCards();
      if (currentCard > 0) { currentCard--; highlightCard(currentCard); spriteWalkBrief(false); }
    } else if (layer === 2) {
      var tabs = getTabs();
      if (currentTab > 0) {
        currentTab--;
        highlightTab(currentTab);
        tabs[currentTab].click();
      }
    }
  }

  function goRight() {
    if (layer === 0) {
      goToCab(currentCab + 1);
    } else if (layer === 1) {
      var cards = getCards();
      if (currentCard < cards.length - 1) { currentCard++; highlightCard(currentCard); spriteWalkBrief(true); }
    } else if (layer === 2) {
      var tabs = getTabs();
      if (currentTab < tabs.length - 1) {
        currentTab++;
        highlightTab(currentTab);
        tabs[currentTab].click();
      }
    }
  }

  // Flip active card
  function flipActive() {
    if (layer !== 1) return;
    var cards = getCards();
    if (cards[currentCard] && !cards[currentCard].classList.contains('no-flip')) {
      cards[currentCard].classList.toggle('flipped');
      // Sprite jump
      if (contentSprite) {
        contentSprite.classList.add('jumping');
        contentSprite.addEventListener('animationend', function() {
          contentSprite.classList.remove('jumping');
        }, { once: true });
      }
    }
  }

  var peeked = {};

  // Cabinet clicks — go to cab and enter card layer
  cabinets.forEach(function(cab, i) {
    cab.addEventListener('click', function() {
      if (currentCab !== i) { layer = 0; updateModeLabel(); goToCab(i); }
    });
  });

  // Control buttons
  function pressBtn(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      el.classList.add('pressed');
      setTimeout(function() { el.classList.remove('pressed'); }, 150);
      fn();
    });
  }
  pressBtn('ctrl-left', goLeft);
  pressBtn('ctrl-right', goRight);
  pressBtn('ctrl-up', goUp);
  pressBtn('ctrl-down', goDown);
  pressBtn('ctrl-action', flipActive);

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); goRight(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goLeft(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goUp(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); goDown(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipActive(); }
  });

  // Card clicks — set as active and flip
  document.addEventListener('click', function(e) {
    var card = e.target.closest('.gc');
    if (!card) return;
    if (e.target.closest('a') || e.target.closest('iframe')) return;
    var cards = getCards();
    var idx = cards.indexOf(card);
    if (idx >= 0) {
      var wasWorld = layer === 0;
      var prevCard = currentCard;
      if (wasWorld) { layer = 1; updateModeLabel(); }
      currentCard = idx;
      highlightCard(idx);
      if (!card.classList.contains('no-flip')) card.classList.toggle('flipped');

      if (wasWorld) {
        // Entering card mode — show sprite after scroll settles
        setTimeout(function() { showContentSprite(); }, 350);
      } else if (idx !== prevCard) {
        // Moving between cards — walk animation
        spriteWalkBrief(idx > prevCard);
        positionSpriteBottom();
      }
    }
  });

  // popstate handler for back/forward
  window.addEventListener('popstate', function(e) {
    var section = (e.state && e.state.section) || pathToSection();
    var idx = panelIds.indexOf(section);
    if (idx >= 0 && idx !== currentCab) {
      goToCab(idx, true); // skipPush=true to avoid pushing again
    }
  });

  // Parse current URL path to section ID
  function pathToSection() {
    // Check for ?route= redirect from 404 page
    var params = new URLSearchParams(location.search);
    var route = params.get('route');
    if (route) {
      var section = route.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
      if (panelIds.indexOf(section) >= 0) {
        // Clean up the URL
        history.replaceState({ section: section }, '', '/' + section);
        return section;
      }
    }
    var path = location.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
    // Also support hash fallback for file:// protocol
    if (!path && location.hash) path = location.hash.replace('#', '');
    return panelIds.indexOf(path) >= 0 ? path : 'home';
  }

  // Init
  (function() {
    var startSection = pathToSection();
    var startIdx = panelIds.indexOf(startSection);
    if (startIdx < 0) startIdx = 0;

    // Set initial cabinet active state
    cabinets.forEach(function(c,i) { c.classList.toggle('active', i === startIdx); });
    currentCab = startIdx;

    // Set initial ambient
    if (ambientEl) ambientEl.style.background = ambients[startSection] || ambients.home;
    if (patternEl && patterns[startSection]) { patternEl.style.background = patterns[startSection]; patternEl.classList.add('visible'); }

    // Update title
    document.title = titles[startSection] || titles.home;

    // Start loading bar
    requestAnimationFrame(function() {
      var fill = document.getElementById('load-fill');
      if (fill) fill.style.width = '100%';
    });

    function positionInit() {
      var cab = cabinets[startIdx];
      var cabCenter = cab.offsetLeft + cab.offsetWidth / 2;
      var viewCenter = window.innerWidth / 2;
      var offset = -(cabCenter - viewCenter);
      strip.style.transition = 'none';
      strip.style.transform = 'translateX(' + offset + 'px)';
      character.style.transition = 'none';
      character.style.left = (cabCenter + offset - 32) + 'px';
      character.classList.add('idle');
      setTimeout(function() { strip.style.transition = ''; character.style.transition = ''; }, 50);
    }

    var loaded = false;
    function finishLoad() {
      if (loaded) return;
      loaded = true;
      try { positionInit(); } catch(e) { console.error('positionInit:', e); }
      try { updateModeLabel(); } catch(e) { console.error('updateModeLabel:', e); }

      // Load initial section content
      loadSection(startSection, function(html) {
        contentEl.innerHTML = html;
        bindSectionHandlers();

        // Fade out loading screen
        setTimeout(function() {
          var ls = document.getElementById('load-screen');
          if (ls) {
            ls.classList.add('fade-out');
            setTimeout(function() { ls.remove(); }, 500);
          }
        }, 300);
      });

      // Replace state with proper section
      history.replaceState({ section: startSection }, '', startSection === 'home' ? '/' : '/' + startSection);
    }

    if (document.readyState === 'complete') finishLoad();
    else window.addEventListener('load', finishLoad);
    setTimeout(finishLoad, 3000);
  })();

  window.addEventListener('resize', function() {
    var cab = cabinets[currentCab];
    var cabCenter = cab.offsetLeft + cab.offsetWidth / 2;
    var viewCenter = window.innerWidth / 2;
    var offset = -(cabCenter - viewCenter);
    strip.style.transform = 'translateX(' + offset + 'px)';
    character.style.left = (cabCenter + offset - 32) + 'px';
  });

  // Lightbox — click any card image to expand
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
  document.addEventListener('click', function(e) {
    var img = e.target;
    if (!img.matches('.gc-art, .gc-art-contain, .gc-back-gallery img')) return;
    if (!img.src) return;
    e.stopPropagation();
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    lightbox.classList.add('open');
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) {
      lightbox.classList.remove('open');
      e.stopPropagation();
    }
  });
