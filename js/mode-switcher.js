/* Shared mode switcher — injected on all three portfolio entry points:
   index.html (arcade), scroll.html (single page), scroll.html?mode=clean (minimal).
   Auto-positions top-center on arcade, bottom-center on scroll variants
   (they have a sticky marquee at the top). */
(function(){
  'use strict';
  var script = document.currentScript || document.querySelector('script[src*="mode-switcher"]');
  var current = (script && script.getAttribute('data-mode')) || 'gamified';

  try { localStorage.setItem('portfolio-mode', current); } catch(e){}

  var modes = [
    { id:'gamified', label:'Arcade',      sub:'full experience', href:'index.html',  icon:'\u25C6\uFE0E' }, // ◆ text
    { id:'single',   label:'Single Page', sub:'one scroll',      href:'scroll.html', icon:'\u25A4\uFE0E' }  // ▤ text
  ];

  // Compute site root so this works both at raggedydoc.com/ and at a subpath deploy.
  function siteRoot() { return location.pathname.replace(/[^/]*$/, ''); }
  var base = siteRoot();

  var css = [
    '.pm-switch {',
    '  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);',
    '  z-index: 150;',
    '  display: inline-flex; gap: 0;',
    '  padding: 4px;',
    '  background: rgba(12,14,22,0.82);',
    '  backdrop-filter: blur(12px) saturate(140%);',
    '  -webkit-backdrop-filter: blur(12px) saturate(140%);',
    '  border: 1px solid rgba(255,255,255,0.12);',
    '  border-radius: 999px;',
    '  box-shadow: 0 10px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04) inset;',
    "  font-family: 'Silkscreen', 'JetBrains Mono', ui-monospace, monospace;",
    '  font-size: 10px;',
    '  letter-spacing: 0.08em;',
    '  text-transform: uppercase;',
    '  user-select: none;',
    '  max-width: calc(100vw - 24px);',
    '  font-variant-emoji: text;',
    '}',
    '.pm-switch[data-pos="bottom"] { top: auto; bottom: 18px; }',
    '.pm-switch button {',
    '  appearance: none; background: transparent; border: 0; cursor: pointer;',
    '  color: rgba(255,255,255,0.55);',
    '  padding: 8px 14px;',
    '  border-radius: 999px;',
    '  display: inline-flex; align-items: center; gap: 6px;',
    '  font: inherit;',
    '  transition: color .18s, background .18s, transform .18s;',
    '  white-space: nowrap;',
    '}',
    '.pm-switch button:hover { color: #fff; }',
    '.pm-switch button.active {',
    '  color: #0a0c14;',
    '  background: linear-gradient(180deg, #fff, #e6e8f0);',
    '  box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(0,0,0,0.35);',
    '}',
    '.pm-switch .pm-ico { font-size: 12px; opacity: .85; font-variant-emoji: text; }',
    '.pm-switch .pm-sub { opacity: .6; font-size: 8px; margin-left: 2px; }',
    '.pm-switch button.active .pm-sub { opacity: .7; color: rgba(10,12,20,0.7); }',
    '@media (max-width: 640px) {',
    '  .pm-switch { font-size: 9px; top: 8px; padding: 3px; }',
    '  .pm-switch button { padding: 6px 10px; gap: 4px; }',
    '  .pm-switch .pm-sub { display: none; }',
    '  .pm-switch .pm-ico { font-size: 10px; }',
    '  .pm-switch[data-pos="bottom"] { bottom: 10px; top: auto; }',
    '}',
    '@media (max-width: 400px) { .pm-switch button { padding: 6px 8px; } }',
    '@media print { .pm-switch { display: none !important; } }'
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  function build(){
    var nav = document.createElement('nav');
    nav.className = 'pm-switch';
    // Arcade keeps top-center (nothing competes). Scroll variants have a
    // sticky marquee at top, so the pill tucks to bottom.
    if (current === 'single') nav.setAttribute('data-pos','bottom');
    nav.setAttribute('role','tablist');
    nav.setAttribute('aria-label','Portfolio view');
    modes.forEach(function(m){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role','tab');
      btn.setAttribute('aria-selected', m.id === current ? 'true' : 'false');
      if (m.id === current) btn.classList.add('active');
      btn.innerHTML =
        '<span class="pm-ico" aria-hidden="true">' + m.icon + '</span>' +
        '<span>' + m.label + '</span>' +
        '<span class="pm-sub">' + m.sub + '</span>';
      btn.addEventListener('click', function(){
        if (m.id === current) return;
        try { localStorage.setItem('portfolio-mode', m.id); } catch(e){}
        window.location.href = base + m.href;
      });
      nav.appendChild(btn);
    });
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
