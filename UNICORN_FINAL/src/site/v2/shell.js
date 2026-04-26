// UNICORN V2 — SSR shell + per-route HTML fragments
// Original work, © Vladoi Ionut. Cinematic single-page portal synced with Unicorn backend.
'use strict';

const { CSS } = require('./styles');
const { BUILD_ID } = require('./build-id');

const OWNER = {
  name: process.env.OWNER_NAME || 'Vladoi Ionut',
  email: process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
  btc: process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  paypal: process.env.PAYPAL_ME || process.env.PAYPAL_EMAIL || 'vladoi_ionut@yahoo.com',
  domain: process.env.PUBLIC_APP_URL || 'https://zeusai.pro'
};

function head(title, route, opts) {
  opts = opts || {};
  const lang = opts.lang || 'en';
  const nonce = opts.nonce || '';
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  const canonical = (OWNER.domain.replace(/\/$/, '')) + (route || '/');
  const ogImage = (OWNER.domain.replace(/\/$/, '')) + '/assets/zeus/brand.jpg';
  const desc = routeDescription(route);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': route === '/pricing' || route === '/services' ? 'Product' : 'SoftwareApplication',
    name: 'ZeusAI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: canonical,
    description: desc,
    creator: { '@type': 'Person', name: OWNER.name, email: OWNER.email },
    offers: { '@type': 'Offer', priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
  });
  return `<!doctype html>
<html lang="${lang}" data-route="${route}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#05040a"/>
<title>${title} — ZEUSAI</title>
<meta name="description" content="${desc}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:site_name" content="ZeusAI — Sovereign AI OS"/>
<meta property="og:title" content="${title} — ZeusAI"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title} — ZeusAI"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${ogImage}"/>
<script type="application/ld+json"${nonceAttr}>${jsonLd}</script>
<link rel="manifest" href="/manifest.webmanifest"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"/>
<link rel="stylesheet" href="/assets/app.css?v=${BUILD_ID}"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop offset='0' stop-color='%238a5cff'/%3E%3Cstop offset='0.5' stop-color='%233ea0ff'/%3E%3Cstop offset='1' stop-color='%23ffd36a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M32 4l8 14h14l-12 10 5 18-15-10-15 10 5-18L10 18h14z'/%3E%3C/svg%3E"/>
</head>
<body>
<a href="#app" style="position:absolute;left:-999px;top:10px;background:#fff;color:#05040a;padding:10px 14px;border-radius:10px;z-index:9999" onfocus="this.style.left='10px'" onblur="this.style.left='-999px'">Skip to content</a>
<div class="galaxy-bg" id="zeusCanvas" aria-hidden="true"></div>
<div class="toasts" id="toasts"></div>
${navBar(route, opts)}
<main id="app">`;
}

function navBar(route, opts) {
  opts = opts || {};
  const curLang = opts.lang || 'en';
  const L = (href, label) => `<a href="${href}" data-link${route === href ? ' class="active"' : ''}>${label}</a>`;
  const langBtn = (code, label) => `<button class="lang-btn${curLang===code?' active':''}" data-lang="${code}" type="button" aria-label="${label}">${code.toUpperCase()}</button>`;
  return `<nav class="nav" data-nav-open="false">
<div class="brand"><div class="brand-logo brand-logo-photo"><img src="/assets/zeus/brand.jpg" alt="Zeus" onerror="this.style.display='none'"/></div><div><span class="zeus-wordmark">Zeus<span class="ai">AI</span></span><small>Sovereign · Self-Evolving · Signed</small></div></div>
<button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-links">
  <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
</button>
<div class="nav-links" id="nav-links">
${L('/', 'Home')}${L('/services', 'Marketplace')}${L('/wizard', 'Find my plan')}${L('/store', 'Store')}${L('/account', 'Customer Portal')}${L('/enterprise', 'Enterprise')}${L('/pricing', 'Pricing')}${L('/innovations', 'Innovations')}${L('/frontier', 'Frontier')}${L('/docs', 'API')}${L('/status', 'Status')}
</div>
<div class="nav-cta">
<div class="lang-switch" role="group" aria-label="Language">${langBtn('en','English')}${langBtn('ro','Română')}${langBtn('es','Español')}</div>
<a class="btn btn-ghost" href="/dashboard" data-link>Dashboard</a>
<a class="btn btn-primary" href="/services" data-link>Explore Services</a>
</div>
</nav>`;
}

function footer(route, opts) {
  opts = opts || {};
  const nonce = opts.nonce || '';
  const N = nonce ? ` nonce="${nonce}"` : '';
  return `</main>
<footer>
  <div class="foot-grid">
    <div>
      <div class="brand" style="margin-bottom:14px"><div class="brand-logo"></div><div><span class="zeus-wordmark">Zeus<span class="ai">AI</span></span><small>Sovereign · Self-Evolving · Signed</small></div></div>
      <p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6;max-width:360px">Autonomous AI operating system. Every module signed with W3C DID. Every outcome routed through Merkle-chained receipts. Property of ${OWNER.name}.</p>
    </div>
    <div><h5>Product</h5><ul>
      <li><a href="/services" data-link>Marketplace</a></li>
      <li><a href="/wizard" data-link>Find my plan</a></li>
      <li><a href="/pricing" data-link>Pricing</a></li>
      <li><a href="/how" data-link>How it works</a></li>
      <li><a href="/dashboard" data-link>Dashboard</a></li>
      <li><a href="/store" data-link>Instant Store</a></li>
      <li><a href="/gift" data-link>Gift</a></li>
    </ul></div>
    <div><h5>Developers</h5><ul>
      <li><a href="/docs" data-link>API &amp; Docs</a></li>
      <li><a href="/api-explorer" data-link>API Explorer</a></li>
      <li><a href="/openapi.json">OpenAPI 3.1</a></li>
      <li><a href="/seo/sitemap.xml">Sitemap</a></li>
      <li><a href="/snapshot">/snapshot</a></li>
      <li><a href="/stream">/stream (SSE)</a></li>
      <li><a href="/health">/health</a></li>
    </ul></div>
    <div><h5>Trust</h5><ul>
      <li><a href="/trust" data-link>Trust Center</a></li>
      <li><a href="/security" data-link>Security</a></li>
      <li><a href="/responsible-ai" data-link>Responsible AI</a></li>
      <li><a href="/refund" data-link>Refund Guarantee</a></li>
      <li><a href="/sla" data-link>SLA</a></li>
      <li><a href="/pledge" data-link>Anti-Dark-Pattern Pledge</a></li>
      <li><a href="/cancel" data-link>Universal Cancel</a></li>
      <li><a href="/transparency" data-link>Bandit Transparency</a></li>
      <li><a href="/aura" data-link>Live Aura</a></li>
      <li><a href="/status" data-link>Live Status</a></li>
      <li><a href="/innovations" data-link>30Y Innovations</a></li>
      <li><a href="/frontier" data-link>Frontier (F1–F12)</a></li>
    </ul></div>
    <div><h5>Company</h5><ul>
      <li><a href="/about" data-link>About</a></li>
      <li><a href="/changelog" data-link>Changelog</a></li>
      <li><a href="/legal" data-link>Legal</a></li>
      <li><a href="/terms" data-link>Terms</a></li>
      <li><a href="/privacy" data-link>Privacy</a></li>
      <li><a href="/dpa" data-link>DPA</a></li>
      <li><a href="/payment-terms" data-link>Payment Terms</a></li>
      <li><a href="/operator" data-link>Operator Console</a></li>
      <li><a href="mailto:${OWNER.email}">${OWNER.email}</a></li>
      <li><a href="${OWNER.domain}">${OWNER.domain.replace(/^https?:\/\//,'')}</a></li>
    </ul></div>
  </div>
  <div class="foot-bot">
    <span>© ${new Date().getFullYear()} ${OWNER.name}. All code, models and UI are original and the sole property of the repo owner.</span>
    <span>Powered by Zeus Core · Merkle-chained receipts · Ed25519 signatures</span>
  </div>
</footer>
${concierge()}
${globalChrome()}
<noscript><div style="position:fixed;bottom:0;left:0;right:0;padding:14px 18px;background:#05040a;color:#e8f0ff;border-top:1px solid #3ea0ff;font:14px/1.4 system-ui;z-index:99">This site works fully without JavaScript. Cinematic effects are disabled in no-JS mode; all services, pricing and APIs remain reachable.</div></noscript>
<script${N}>window.__UNICORN__=${JSON.stringify({ owner: OWNER, route })};</script>
<script${N} data-local-three-version="r160">
// 30Y-LTS: try locally vendored Three.js first, fall back to CDN only when absent.
(function loadThree(){
  var s=document.createElement('script');
  s.src='/assets/vendor/three.min.js';
  s.onerror=function(){var f=document.createElement('script');f.src='https://unpkg.com/three@0.160.0/build/three.min.js';f.defer=true;document.head.appendChild(f);};
  document.head.appendChild(s);
})();
</script>
<script${N}>
// 30Y-LTS — language switcher (cookie-based, no reload-flicker)
(function(){
  document.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest && ev.target.closest('.lang-btn');
    if (!b) return;
    var code = b.getAttribute('data-lang');
    if (!code) return;
    document.cookie = 'lang=' + code + '; path=/; max-age=31536000; samesite=lax';
    document.documentElement.setAttribute('lang', code);
    document.querySelectorAll('.lang-btn').forEach(function(x){ x.classList.toggle('active', x===b); });
    location.reload();
  }, false);
})();
// Service worker registration (offline-first) + auto-refresh on new deploy
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js').then(function(reg){
      try { reg.update(); } catch(_){}
      // When a new SW takes control, reload once so the user sees the latest assets.
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        if (reloaded) return; reloaded = true;
        try { location.reload(); } catch(_){}
      });
      // Listen for explicit "sw-updated" broadcasts.
      navigator.serviceWorker.addEventListener('message', function(ev){
        try {
          if (ev && ev.data && ev.data.type === 'sw-updated') {
            if (reloaded) return; reloaded = true;
            setTimeout(function(){ try { location.reload(); } catch(_){} }, 50);
          }
        } catch(_){}
      });
      // If a new worker is waiting, ask it to take over immediately.
      if (reg.waiting) { try { reg.waiting.postMessage('skipWaiting'); } catch(_){} }
      reg.addEventListener('updatefound', function(){
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function(){
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            try { nw.postMessage('skipWaiting'); } catch(_){}
          }
        });
      });
    }).catch(function(){});
  });
}
// CSP violation reporter (defensive)
window.addEventListener('securitypolicyviolation', function(e){
  try{
    fetch('/csp-violations', { method:'POST', headers:{'Content-Type':'application/csp-report'}, body: JSON.stringify({
      'csp-report': {
        'document-uri': location.href,
        'violated-directive': e.violatedDirective,
        'effective-directive': e.effectiveDirective,
        'blocked-uri': e.blockedURI,
        'source-file': e.sourceFile,
        'line-number': e.lineNumber,
        'status-code': e.statusCode || 0
      }
    })}).catch(function(){});
  }catch(_){ }
});
</script>
<script src="/assets/aeon.js?v=${BUILD_ID}" defer></script>
<script src="/assets/app.js?v=${BUILD_ID}" defer></script>
</body></html>`;
}

function concierge() {
  return `<div class="concierge" id="concierge">
  <button class="concierge-btn" id="conciergeBtn" aria-label="Zeus Concierge">⚡</button>
  <div class="concierge-panel" id="conciergePanel" role="dialog" aria-label="Zeus AI Sales Agent">
    <div class="concierge-head"><span class="dot"></span> Zeus · <span style="color:var(--violet2);font-weight:700">30Y</span> AI<span class="meta" id="conciergeMeta">zeus-30y</span></div>
    <div class="concierge-body" id="conciergeBody" aria-live="polite">
      <div class="msg bot"><div class="msg-body">Salut! Sunt <b>Zeus-30Y</b> — standardul AI sales pentru următorii 30 de ani. Streaming, voce, memorie, recomandări live, checkout BTC direct și activare instant.\n\nHi! I'm <b>Zeus-30Y</b> — the 30-year AI sales standard. Streaming, voice, memory, live recs, direct BTC checkout, instant activation.</div></div>
    </div>
    <div class="chips" id="conciergeChips">
      <button class="chip" data-q="Ce servicii ai și ce prețuri?">💰 Prețuri</button>
      <button class="chip" data-q="Cum plătesc în BTC?">₿ BTC checkout</button>
      <button class="chip" data-q="Recomandă-mi pachetul pentru lead generation">🚀 Growth</button>
      <button class="chip" data-q="What's the best service for enterprise?">🏢 Enterprise</button>
      <button class="chip" data-q="Arată-mi serviciile mele">📦 My services</button>
    </div>
    <div class="concierge-foot">
      <textarea id="conciergeInput" rows="1" placeholder="Întreabă Zeus orice… / Ask Zeus anything…  (Enter · Shift+Enter newline)" autocomplete="off"></textarea>
      <button id="conciergeSend" aria-label="Send">→</button>
    </div>
  </div>
</div>`;
}

// ================== PAGES ==================

function globalChrome() {
  return `<div id="zeus-cookie" class="zeus-cookie" hidden>
  <div class="zeus-cookie-text">We use only first-party, signed analytics — no trackers, no ad networks. <a href="/privacy" data-link>Privacy</a> · <a href="/pledge" data-link>Pledge</a>.</div>
  <div class="zeus-cookie-cta"><button id="zeus-cookie-accept" class="btn btn-primary btn-sm">Accept</button><button id="zeus-cookie-deny" class="btn btn-ghost btn-sm">Deny</button></div>
</div>
<div id="zeus-buy-bar" class="zeus-buy-bar" hidden>
  <div class="zeus-buy-text"><b>Ready to deploy ZeusAI?</b><span>30-day refund · direct BTC owner wallet · cancel any time</span></div>
  <div class="zeus-buy-cta"><a class="btn btn-ghost btn-sm" href="/wizard" data-link>Find my plan</a><a class="btn btn-primary btn-sm" href="/services" data-link>Buy now →</a></div>
</div>
<div id="zeus-exit" class="zeus-exit" hidden>
  <div class="zeus-exit-card">
    <button class="zeus-exit-x" id="zeus-exit-close" aria-label="Close">×</button>
    <h3>Wait — get the founders' brief.</h3>
    <p>One signed email per month: new inventions, sovereign primitives, refund-of-the-month. Unsubscribe in one click.</p>
    <form id="zeus-exit-form" class="zeus-exit-form">
      <input type="email" required placeholder="you@domain.com" id="zeus-exit-email"/>
      <button class="btn btn-primary" type="submit">Send brief</button>
    </form>
    <small id="zeus-exit-msg" style="color:var(--ink-dim)"></small>
  </div>
</div>
<script>
(function(){
  // Mobile nav hamburger toggle
  try {
    var navEl = document.querySelector('nav.nav');
    var navBtn = document.querySelector('.nav-toggle');
    var navLinks = document.getElementById('nav-links');
    if (navEl && navBtn && navLinks){
      var setOpen = function(open){
        navEl.setAttribute('data-nav-open', open ? 'true':'false');
        navBtn.setAttribute('aria-expanded', open ? 'true':'false');
        document.documentElement.style.overflow = open ? 'hidden' : '';
      };
      navBtn.addEventListener('click', function(){
        setOpen(navEl.getAttribute('data-nav-open') !== 'true');
      });
      navLinks.addEventListener('click', function(e){
        if (e.target && e.target.tagName === 'A') setOpen(false);
      });
      // Close on resize to desktop
      window.addEventListener('resize', function(){
        if (window.innerWidth > 980) setOpen(false);
      });
      // Close on Esc
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setOpen(false); });
    }
  } catch(_){ }
  // Cookie banner
  try {
    var c = document.getElementById('zeus-cookie');
    if (c && !document.cookie.match(/zeus_consent=/)) c.hidden = false;
    document.getElementById('zeus-cookie-accept').onclick = function(){ document.cookie='zeus_consent=1; path=/; max-age=31536000; samesite=lax'; c.hidden=true; };
    document.getElementById('zeus-cookie-deny').onclick = function(){ document.cookie='zeus_consent=0; path=/; max-age=31536000; samesite=lax'; c.hidden=true; };
  } catch(_){ }
  // Live aura strip — pull every 30s
  function pullAura(){
    try {
      fetch('/api/aura').then(function(r){return r.json();}).then(function(j){
        var t = document.getElementById('zeus-aura-text'); if (!t) return;
        var k = j && j.kpis ? j.kpis : {};
        var bits = [];
        if (k.signedReceipts != null) bits.push(k.signedReceipts + ' signed receipts');
        if (k.refundsHonored != null) bits.push(k.refundsHonored + ' refunds honored');
        if (k.uptime != null) bits.push(k.uptime + ' uptime');
        if (k.activeCarts != null) bits.push(k.activeCarts + ' live carts');
        t.textContent = bits.length ? bits.join(' · ') : 'sovereign · self-evolving · signed';
      }).catch(function(){});
    } catch(_){ }
  }
  pullAura(); setInterval(pullAura, 30000);
  // Sticky buy bar — shown after scroll on home/services/pricing
  try {
    var route = (document.documentElement.getAttribute('data-route')||'/');
    var bar = document.getElementById('zeus-buy-bar');
    if (bar && /^\/(?:|services|pricing|how|frontier)$/.test(route)) {
      window.addEventListener('scroll', function(){ if (scrollY > 320) bar.hidden = false; }, { passive:true });
    }
  } catch(_){ }
  // Exit-intent popup
  try {
    var seen = sessionStorage.getItem('zeus_exit_seen');
    var modal = document.getElementById('zeus-exit');
    if (modal) modal.hidden = true; // ensure hidden on boot regardless of CSS races
    var armed = false; setTimeout(function(){ armed = true; }, 20000); // require 20s on page first
    function show(){ if (modal && !seen && armed){ modal.hidden=false; sessionStorage.setItem('zeus_exit_seen','1'); } }
    document.addEventListener('mouseleave', function(e){ if (e.clientY <= 4) show(); });
    if (modal) {
      document.getElementById('zeus-exit-close').onclick = function(){ modal.hidden = true; };
      document.getElementById('zeus-exit-form').onsubmit = function(ev){
        ev.preventDefault();
        var email = document.getElementById('zeus-exit-email').value.trim();
        var msg = document.getElementById('zeus-exit-msg');
        fetch('/api/newsletter/subscribe', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email, source: 'exit-intent', route: location.pathname })})
          .then(function(r){return r.json();}).then(function(j){ msg.textContent = j && j.ok ? '✓ Signed brief queued — check inbox.' : 'Something failed, please retry.'; if (j && j.ok) setTimeout(function(){modal.hidden=true;}, 1800); })
          .catch(function(){ msg.textContent = 'Network error.'; });
      };
    }
  } catch(_){ }
  // Track pageview
  try {
    fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'pageview', route: location.pathname, ref: document.referrer || '' }) }).catch(function(){});
  } catch(_){ }
})();
</script>
<style>
.zeus-cookie{position:fixed;left:18px;right:18px;bottom:18px;z-index:90;background:rgba(8,10,18,.94);backdrop-filter:blur(18px);border:1px solid rgba(120,140,200,.25);border-radius:14px;padding:12px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:13.5px/1.5 system-ui;color:#cdd6e4;box-shadow:0 14px 40px rgba(0,0,0,.5)}
.zeus-cookie-text{flex:1;min-width:240px}.zeus-cookie-cta{display:flex;gap:8px}
.zeus-aura-strip{position:fixed;left:14px;top:74px;z-index:60;background:rgba(8,10,18,.7);backdrop-filter:blur(12px);border:1px solid rgba(120,140,200,.18);border-radius:999px;padding:6px 12px;font:12px/1 'JetBrains Mono',monospace;color:#cdd6e4;display:none;align-items:center;gap:8px}
@media (min-width: 920px){.zeus-aura-strip{display:inline-flex}}
.zeus-aura-strip .dot{width:8px;height:8px;border-radius:50%;background:#3effa1;box-shadow:0 0 12px #3effa1;animation:zpulse 1.4s ease-in-out infinite}
.zeus-aura-more{color:#7aa9ff;text-decoration:none;margin-left:4px}
@keyframes zpulse{0%,100%{opacity:.7}50%{opacity:1}}
.zeus-buy-bar{position:fixed;left:0;right:0;bottom:0;z-index:80;background:linear-gradient(180deg,rgba(8,10,18,0),rgba(5,4,10,.96) 40%);padding:12px 18px;display:flex;gap:16px;align-items:center;justify-content:space-between;border-top:1px solid rgba(120,140,200,.18);font:14px/1.4 system-ui;color:#e7ecf3}
.zeus-buy-text b{display:block;font-size:14.5px}.zeus-buy-text span{color:#9aa6bd;font-size:12.5px}
.zeus-buy-cta{display:flex;gap:8px}
.btn-sm{padding:8px 14px;font-size:13px}
[hidden]{display:none !important}
.zeus-exit{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px}
.zeus-exit[hidden]{display:none !important}
.zeus-buy-bar[hidden]{display:none !important}
.zeus-cookie[hidden]{display:none !important}
.zeus-exit-card{background:#0a0c14;border:1px solid rgba(120,140,200,.25);border-radius:18px;padding:28px;max-width:460px;width:100%;color:#e7ecf3;position:relative}
.zeus-exit-card h3{margin:0 0 8px;font-size:22px}
.zeus-exit-card p{color:#9aa6bd;margin:0 0 14px;font-size:14px;line-height:1.55}
.zeus-exit-form{display:flex;gap:8px;flex-wrap:wrap}
.zeus-exit-form input{flex:1;min-width:180px;padding:11px 14px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:10px;font:14px system-ui}
.zeus-exit-x{position:absolute;top:12px;right:14px;background:transparent;border:0;color:#9aa6bd;font-size:24px;cursor:pointer}
</style>`;
}

function pageHome() {
  return `<section class="hero">
  <div class="zeus-scene" aria-hidden="true">
    <img id="zeusHeroImg" class="zeus-hero-image" src="/assets/zeus/hero.jpg" data-zeus-src="/assets/zeus/hero.jpg" alt="" onerror="this.onerror=null;this.src='/assets/zeus/placeholder.svg'"/>
    <div class="zeus-halo zeus-halo-a"></div>
    <div class="zeus-halo zeus-halo-b"></div>
    <div class="zeus-stars"></div>
    <div class="zeus-vignette"></div>
  </div>
  <div class="hero-fx" aria-hidden="true">
    <div class="fx-orb fx-orb-a"></div>
    <div class="fx-orb fx-orb-b"></div>
    <div class="fx-orb fx-orb-c"></div>
    <div class="fx-grid"></div>
    <div class="fx-scan"></div>
  </div>
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="hero-eyebrow"><span class="dot"></span> Live · ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC</span>
      <h1>The autonomous <span class="grad">AI operating system</span> that bends SaaS to your will.</h1>
      <p class="lead">ZeusAI is a self-evolving, cryptographically sovereign platform. 169 living modules, 18 vertical industries, 41 marketplaces — orchestrated by Zeus. Every outcome is signed. Every cent is routed. No middleman.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/services" data-link>Explore the Marketplace →</a>
        <a class="btn" href="/how" data-link>See how it works</a>
      </div>
      <div class="hero-stats" id="heroStats">
        <div class="hero-stat"><b id="statModules">169</b><span>Live modules</span></div>
        <div class="hero-stat"><b id="statVerticals">18</b><span>Verticals</span></div>
        <div class="hero-stat"><b id="statMarkets">41</b><span>Marketplaces</span></div>
        <div class="hero-stat"><b id="statChain">—</b><span>Chain length</span></div>
      </div>
    </div>
  </div>
</section>

<section id="commerceProof">
  <div class="section-title">
    <div><span class="kicker">Live commerce proof · 25 Apr 2026</span><h2>Tot ce am adăugat azi este <span class="grad">legat în site.</span></h2></div>
    <p>Nu doar API-uri ascunse: catalogul, checkout-ul BTC/BTCPay-ready, livrarea automată, portalul client și cockpit-ul admin sunt acum vizibile și testabile direct din interfață.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:14px">
    <div class="card" style="border-color:rgba(255,211,106,.42)">
      <span class="tag" style="background:rgba(255,211,106,.15);color:var(--gold)">Master Catalog</span>
      <h3 id="commerceProofCatalog">95 live products</h3>
      <p>Strategic services + Frontier + Vertical OS + AI modules. Deterministic fallback keeps CI/live smoke above 65.</p>
      <a class="btn btn-primary" href="/services" data-link>Open catalog →</a>
    </div>
    <div class="card" style="border-color:rgba(247,147,26,.45)">
      <span class="tag" style="background:rgba(247,147,26,.15);color:#f7931a">BTC / BTCPay</span>
      <h3 id="commerceProofBtcProvider">Checking payment rail…</h3>
      <p>Creates a real receipt, exact BTC amount, owner wallet fallback, and BTCPay checkout URL when env is configured.</p>
      <a class="btn btn-primary" href="/checkout?plan=adaptive-ai&amount=49" data-link>Test checkout →</a>
    </div>
    <div class="card" style="border-color:rgba(110,231,183,.42)">
      <span class="tag" style="background:rgba(110,231,183,.16);color:#6ee7b7">Delivery Registry</span>
      <h3 id="commerceProofDelivery">serviceId → deliver()</h3>
      <p>Paid orders generate real deliverables: API key, workspace, task, webhook secret, report, onboarding and license.</p>
      <a class="btn btn-ghost" href="/docs" data-link>See API docs →</a>
    </div>
    <div class="card" style="border-color:rgba(138,92,255,.42)">
      <span class="tag" style="background:rgba(138,92,255,.16);color:var(--violet2)">Customer Portal</span>
      <h3>Orders · licenses · downloads</h3>
      <p>Email account access for orders, active services, API keys, pending payments, invoices and deliverable downloads.</p>
      <a class="btn btn-primary" href="/account" data-link>Open portal →</a>
    </div>
    <div class="card" style="border-color:rgba(255,120,160,.42)">
      <span class="tag" style="background:rgba(255,120,160,.16);color:#ff9cbe">Admin Commerce</span>
      <h3 id="commerceProofAdmin">Refund protected</h3>
      <p>Admin endpoints cover receipts, paid/unpaid, manual confirm, refund, resend license and retry delivery.</p>
      <a class="btn btn-ghost" href="/admin" data-link>Admin login →</a>
    </div>
    <div class="card" style="border-color:rgba(62,160,255,.42)">
      <span class="tag" style="background:rgba(62,160,255,.16);color:#6fd3ff">Live Smoke</span>
      <h3 id="commerceProofSmoke">EXPECTED_MIN_CATALOG_ITEMS=65</h3>
      <p>Post-deploy smoke validates catalog, checkout, confirmation, license, delivery, refund protection and cleanup.</p>
      <a class="btn btn-ghost" href="/health">Health JSON →</a>
    </div>
  </div>
</section>

<section id="finalLive">
  <div class="section-title">
    <div><span class="kicker">Final upgrade</span><h2>ZeusAI Final mode is <span class="grad">live now.</span></h2></div>
    <p>This section proves runtime integration in production: service sync, user services and real-time event stream.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
    <div class="card"><span class="tag">Services sync</span><h3 id="fuServices">Loading…</h3><p>Source: <code class="inline">/api/services/list</code></p></div>
    <div class="card"><span class="tag">Realtime stream</span><h3 id="fuEvents">Connecting…</h3><p>Source: <code class="inline">/api/unicorn/events</code></p></div>
    <div class="card"><span class="tag">User services</span><h3 id="fuUser">Loading…</h3><p>Source: <code class="inline">/api/user/services</code></p></div>
    <div class="card"><span class="tag">AI registry</span><h3 id="fuAiCount">Loading…</h3><p>Source: <code class="inline">/api/ai/registry</code></p></div>
    <div class="card"><span class="tag">AI auto-router</span><h3 id="fuAiMode">Analyzing…</h3><p>Source: <code class="inline">/api/ai/use</code></p></div>
    <div class="card"><span class="tag">Post-quantum security</span><h3 id="fuPq">Checking…</h3><p>Source: <code class="inline">/api/security/pq/status</code></p></div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Quick buy test (live)</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Creates a real order through <code class="inline">/api/services/buy</code>.</p>
    <div class="pl-row">
      <select id="fuService"><option value="adaptive-ai">adaptive-ai</option></select>
      <input id="fuEmail" type="email" placeholder="you@company.com" />
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuBuyBtn">Create live order</button></div>
    <div class="pl-output" id="fuOut">Ready.</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">AI Gateway test (live)</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Routes your request to the best AI automatically via <code class="inline">/api/ai/use</code>.</p>
    <div class="pl-row">
      <input id="fuAiPrompt" placeholder="Summarize a go-to-market strategy for a new AI service" />
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuAiBtn">Run AI gateway</button></div>
    <div class="pl-output" id="fuAiOut">Ready.</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">ZeusAI Control Tower</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Live sync quality across site ↔ ZeusAI backend.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Latency</span><h3 id="fuLatency">Measuring…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Sync drift</span><h3 id="fuDrift">Measuring…</h3></div>
    </div>
    <div class="pl-output" id="fuEventLog" style="margin-top:10px;max-height:180px;overflow:auto">Waiting for live events…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">30-Year Standard Capsule</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Future-proof manifest for portability, compatibility and resilience.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Readiness score</span><h3 id="fuFutureScore">Calculating…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Manifest API</span><h3><code class="inline">/api/future/standard</code></h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuFutureBtn">Download future manifest</button></div>
    <div class="pl-output" id="fuFutureOut">Ready.</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Autonomous Evolution Loop</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Self-optimization with guardrails, bandit strategy and instant rollback readiness.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Optimization score</span><h3 id="fuOptScore">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Rollback readiness</span><h3 id="fuRollback">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Strategy split</span><h3 id="fuStrategy">Loading…</h3></div>
    </div>
    <div class="pl-output" id="fuLoopOut" style="margin-top:10px">Waiting for loop snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Trust & Transparency Ledger</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Unified proof layer for integrity signatures, receipt auditability and owner revenue routing.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Integrity score</span><h3 id="fuTrustSig">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Paid receipts</span><h3 id="fuTrustReceipts">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Revenue proof</span><h3 id="fuRevTotal">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Payout channels</span><h3 id="fuRevMethods">Loading…</h3></div>
    </div>
    <div class="pl-output" id="fuTrustOut" style="margin-top:10px">Waiting for trust snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Resilience Drill Console</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Live failover drill to validate recovery posture and rollback speed.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Drill score</span><h3 id="fuDrillScore">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Avg recovery</span><h3 id="fuDrillRecovery">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Total runs</span><h3 id="fuDrillRuns">Loading…</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuDrillBtn">Run drill now</button></div>
    <div class="pl-output" id="fuDrillOut">Waiting for resilience snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Cinematic Auto-Tune</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Reglează efectele vizuale automat, în funcție de performanța curentă.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Profile</span><h3 id="fuTuneMode">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Intensity</span><h3 id="fuTuneIntensity">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Motion</span><h3 id="fuTuneMotion">Loading…</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuTuneBtn">Apply live profile</button></div>
    <div class="pl-output" id="fuTuneOut">Waiting for auto-tune profile…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Performance Governance Console</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">p95/p99 latency guardrails with adaptive cinematic downgrade policy.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">API latency</span><h3 id="fuPerfP95">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Render latency</span><h3 id="fuPerfP99">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Mode</span><h3 id="fuPerfMode">Loading…</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuPerfBtn">Refresh governance</button></div>
    <div class="pl-output" id="fuPerfOut">Waiting for performance governance snapshot…</div>
  </div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Why ZeusAI</span><h2>Six pillars. <span class="grad">Zero dependencies on middlemen.</span></h2></div>
    <p>Each pillar is a production subsystem running on Hetzner, verified by Merkle chains and W3C DIDs. Together they compose the first truly sovereign AI platform.</p>
  </div>
  <div class="panels" id="pillarPanels">
    <div class="panel pillar" data-pillar="autonomy" tabindex="0" role="button" aria-label="Open Zeus Orchestrator live view"><div class="ic">⚡</div><h4>Zeus Orchestrator</h4><p>Autonomy chain (PCMC) + capability tokens (CBAT). Every decision append-only, every action capability-bound.</p><span class="pillar-cta">Open live chain →</span></div>
    <div class="panel pillar" data-pillar="quarantine" tabindex="0" role="button" aria-label="Open Quarantine Buffer live view"><div class="ic">🛡️</div><h4>Quarantine Buffer</h4><p>Quantum Integrity Shield isolates suspect modules before they touch the core. Safe‑code‑writer enforces review gates.</p><span class="pillar-cta">Open live quarantine →</span></div>
    <div class="panel pillar" data-pillar="did" tabindex="0" role="button" aria-label="Open Self-Sovereign DIDs live view"><div class="ic">🪪</div><h4>Self‑Sovereign DIDs</h4><p>Ed25519 identities per module. Every receipt, every invoice, every module action is independently verifiable.</p><span class="pillar-cta">Resolve & verify →</span></div>
    <div class="panel pillar" data-pillar="outcome" tabindex="0" role="button" aria-label="Open Outcome Economics live view"><div class="ic">💎</div><h4>Outcome Economics</h4><p>Value‑Proof Ledger meters delivered value in $. Auto‑invoices a share. Owner keeps sovereignty through direct BTC settlement.</p><span class="pillar-cta">Record outcome →</span></div>
    <div class="panel pillar" data-pillar="giants" tabindex="0" role="button" aria-label="Open Giant Integration Fabric live view"><div class="ic">🌐</div><h4>Giant Integration Fabric</h4><p>42 hyperscalers and enterprise giants (AWS, Azure, GCP, SF, SAP, SNOW, OpenAI, NVIDIA…) behind a single markup‑aware bus.</p><span class="pillar-cta">Dispatch to giants →</span></div>
    <div class="panel pillar" data-pillar="monetize" tabindex="0" role="button" aria-label="Open Global Monetization Mesh live view"><div class="ic">🚀</div><h4>Global Monetization Mesh</h4><p>41 marketplaces, multi‑armed bandit pricing. 572M+ reach. Publish once, sell everywhere.</p><span class="pillar-cta">Publish listing →</span></div></div>
  <div id="pillarLive" class="pillar-live" aria-live="polite"></div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Live from the fabric</span><h2>Top services, <span class="grad">streaming from ZeusAI.</span></h2></div>
    <p>Pulled in real time from <code class="inline">/api/services</code>. When ZeusAI adds or reprices a service, this section updates automatically.</p>
  </div>
  <div class="grid" id="liveServices"><div class="card"><p>Loading live catalogue…</p></div></div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Verticals</span><h2>Eighteen industries. <span class="grad">One sovereign brain.</span></h2></div>
    <p>From finance to pharma, ZeusAI ships pre‑configured vertical OSes — each with its own compliance, pricing, and marketplace lineage.</p>
  </div>
  <div class="grid" id="verticals"></div>
</section>`;
}

function pageServices() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Marketplace · Master Catalog</span><h2>Every ZeusAI deliverable, <span class="grad">one sovereign storefront.</span></h2></div>
    <p>Strategic services + Frontier inventions + Vertical OSes + Adaptive AI modules — all live from the ZeusAI fabric. Buy any item directly in BTC. Receipt is Ed25519-signed and revenue routes 100% to the owner wallet.</p>
  </div>
  <div class="card" style="margin:16px 0 22px;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(127,90,240,.10));border:1px solid rgba(247,147,26,.45)">
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between">
      <div style="flex:1;min-width:280px">
        <span class="kicker">₿ Native Bitcoin commerce · zero custodian</span>
        <h3 style="margin:8px 0;font-size:22px">Pay any service direct in BTC. <span id="catBtcSpot" style="color:var(--gold);font-family:var(--mono);font-size:14px">live rate loading…</span></h3>
        <p style="color:var(--ink-dim);margin:0;font-size:14px">Owner wallet routes 100% of revenue. Each invoice generates an Ed25519 receipt + on-chain proof via mempool.space.</p>
        <div class="btc-addr" id="svcHeroBtcAddr" data-copy="${OWNER.btc}" title="Click to copy">${OWNER.btc}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:200px">
        <div id="catCounts" style="font-size:12px;color:var(--ink-dim);text-align:right;font-family:var(--mono)">Loading catalog…</div>
        <a class="btn btn-primary" href="/checkout?plan=custom&amount=99" data-link>Quick BTC checkout →</a>
      </div>
    </div>
  </div>
  <div class="filters" id="catFilters">
    <button class="chip on" data-group="all">All</button>
    <button class="chip" data-group="strategic">Strategic</button>
    <button class="chip" data-group="frontier">Frontier · 12 Inventions</button>
    <button class="chip" data-group="vertical">Vertical OS · 18</button>
    <button class="chip" data-group="marketplace">AI Modules</button>
  </div>
  <div class="grid" id="catalogGrid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))"><div class="card"><p>Loading every Unicorn deliverable…</p></div></div>
</section>`;
}

function pageService(id) {
  return `<section style="padding-top:140px" id="servicePage" data-id="${id}">
  <div id="serviceMain"><div class="card"><p>Loading service ${id}…</p></div></div>
</section>`;
}

function pagePricing() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Pricing</span><h2>Fair. Sovereign. <span class="grad">Outcome‑aligned.</span></h2></div>
    <p>Simple plans for teams. For enterprise verticals, ZeusAI ships outcome‑based pricing — you pay a share of measured value delivered, auto‑invoiced via the Value‑Proof Ledger.</p>
  </div>
  <div class="pricing">
    <div class="plan">
      <h3>Starter</h3>
      <div class="price">$49<small>/mo</small></div>
      <p style="color:var(--ink-dim);margin:0">For founders & indie teams.</p>
      <ul>
        <li>Up to 5 active modules</li>
        <li>100k module executions / month</li>
        <li>Direct BTC checkout</li>
        <li>Community support</li>
      </ul>
      <a class="btn" href="/checkout?plan=starter&amount=49" data-link>Start Starter</a>
    </div>
    <div class="plan highlight">
      <h3>Growth</h3>
      <div class="price">$499<small>/mo</small></div>
      <p style="color:var(--ink-dim);margin:0">For scaling companies.</p>
      <ul>
        <li>Unlimited modules</li>
        <li>5M executions / month</li>
        <li>1 vertical OS activated</li>
        <li>SSO, priority support</li>
        <li>Signed outcome reports</li>
      </ul>
      <a class="btn btn-primary" href="/checkout?plan=growth&amount=499" data-link>Go Growth</a>
    </div>
    <div class="plan">
      <h3>Enterprise</h3>
      <div class="price">Custom<small></small></div>
      <p style="color:var(--ink-dim);margin:0">Outcome‑priced. Global.</p>
      <ul>
        <li>All 18 verticals</li>
        <li>All 42 giant integrations</li>
        <li>All 41 marketplaces</li>
        <li>Dedicated Zeus cluster</li>
        <li>Value‑Proof Ledger (bps share)</li>
      </ul>
      <a class="btn btn-gold" href="/checkout?plan=enterprise&amount=25000" data-link>Talk to Zeus</a>
    </div>
  </div>
</section>`;
}

function pageCheckout() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Checkout</span><h2>Pay direct in BTC. <span class="grad">Activation is automatic.</span></h2></div>
    <p>Every payment generates an Ed25519‑signed receipt appended to the Merkle chain. No middlemen, no custody.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:0 0 22px">
    <div class="card"><span class="tag">Step 1</span><h3>Select service</h3><p style="color:var(--ink-dim)">Choose plan/product and email so delivery can issue the entitlement.</p></div>
    <div class="card"><span class="tag">Step 2</span><h3>Quote / invoice</h3><p style="color:var(--ink-dim)">BTC quote and owner wallet are shown before payment. NOWPayments and PayPal are optional later rails.</p></div>
    <div class="card"><span class="tag">Step 3</span><h3>Delivery / license</h3><p style="color:var(--ink-dim)">After settlement, receipt, license token, API key and onboarding delivery become available.</p></div>
  </div>
  <div class="checkout">
    <div class="co-box">
      <div class="co-method">
        <button class="chip on" data-method="btc">₿ Bitcoin</button>
      </div>
      <div id="coPanelBtc">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
          <div>
            <div class="field"><label for="coAmount">Amount (USD)</label><input id="coAmount" type="number" min="1" step="1" value="49"/></div>
            <div class="field"><label for="coPlan">Plan / product</label><input id="coPlan" value="starter"/></div>
            <div class="field"><label for="coEmail">Email for activation</label><input id="coEmail" type="email" placeholder="you@company.com"/></div>
            <div class="field"><label for="coBtc">BTC quote</label><input id="coBtc" readonly value="computing…"/></div>
            <div class="btc-addr" id="btcAddr">${OWNER.btc}</div>
            <div id="coFxStrip" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>
            <button class="btn btn-primary" id="coPay" style="margin-top:14px;width:100%;justify-content:center">Create order & watch blockchain</button>
            <p style="color:var(--ink-dim);font-size:12px;margin-top:8px">After you send BTC, the server watches the mempool every 30s and auto‑issues a signed license on confirmation.</p>
          </div>
          <div class="co-qr"><canvas id="btcQr" width="320" height="320"></canvas></div>
        </div>
        <div id="coStatus"></div>
      </div>
      <div id="coPanelPaypal" style="display:none">
        <div class="field"><label for="coAmountPP">Amount (USD)</label><input id="coAmountPP" type="number" min="1" step="1" value="49"/></div>
        <div class="field"><label for="coPlanPP">Plan / product</label><input id="coPlanPP" value="starter"/></div>
        <div class="field"><label for="coEmailPP">Email for activation</label><input id="coEmailPP" type="email" placeholder="you@company.com"/></div>
        <button class="btn btn-primary" id="coPayPP" style="width:100%;justify-content:center;margin-bottom:8px">Start PayPal payment →</button>
        <a class="btn btn-gold" id="coPaypal" style="width:100%;justify-content:center" target="_blank" rel="noopener">Or tip via paypal.me</a>
        <p style="color:var(--ink-dim);font-size:13px;margin-top:14px">PayPal is intentionally parked for later configuration. Current production checkout routes revenue directly to the BTC owner wallet.</p>
      </div>
    </div>
    <aside class="co-box">
      <h3 style="margin:0 0 8px">Order summary</h3>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Plan</span><b id="sumPlan" style="color:#fff">starter</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Amount</span><b id="sumAmount" style="color:#fff">$49</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Owner</span><b style="color:#fff">${OWNER.name}</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0"><span>Receipt</span><b style="color:var(--ok)">Ed25519 signed</b></div>
      <p style="color:var(--ink-dim);font-size:12.5px;line-height:1.6;margin-top:14px">Every receipt is routed by <code class="inline">sovereignRevenueRouter</code>. On enterprise plans, a share of delivered value is auto‑invoiced via the Value‑Proof Ledger.</p>
    </aside>
  </div>
</section>`;
}

function pageDashboard() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Dashboard</span><h2>My <span class="grad">ZeusAI</span></h2></div>
    <p>Live telemetry from your ZeusAI instance. All numbers sourced from the server — no mocks.</p>
  </div>
  <div class="co-box" id="passkeyBox" style="margin-bottom:22px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <div><span class="kicker">Sovereign login</span><h3 style="margin:4px 0 0;font-size:18px">Sign in with a passkey — no passwords, ever.</h3><p style="color:var(--ink-dim);font-size:13.5px;margin:6px 0 0">WebAuthn (FIDO2). Private key never leaves your device. Signed DID binds your account to the ZeusAI autonomy chain.</p></div>
    <div style="display:flex;gap:10px;align-items:center">
      <input id="pkEmail" placeholder="you@company.com" style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:14px;font-family:inherit;min-width:220px"/>
      <button class="btn" id="pkLogin">Sign in</button>
      <button class="btn btn-primary" id="pkRegister">Create passkey</button>
    </div>
  </div>
  <div class="dash-grid" id="dashKpis"></div>
  <div class="grid" id="dashServices"><div class="card"><p>Loading services…</p></div></div>
  <div class="section-title" style="margin-top:50px"><div><h2 style="font-size:24px">Recent receipts</h2></div></div>
  <div id="dashReceipts" class="card"><p>Loading receipts…</p></div>
  <div class="co-box" style="margin-top:22px">
    <span class="kicker">Affiliate program</span>
    <h3 style="margin:6px 0 10px">Your referral link · 10% signed split</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0 0 10px">Every paid receipt attributed to your code is appended to the affiliate chain with an Ed25519 signature. Payouts are automatic on the 1st of each month.</p>
    <input id="affLink" readonly style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-family:ui-monospace,monospace;font-size:13px" onclick="this.select();document.execCommand&&document.execCommand('copy')"/>
  </div>
</section>`;
}

function pageHow() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">How it works</span><h2>Seven layers. <span class="grad">One clockwork.</span></h2></div>
    <p>ZeusAI is engineered like a Swiss tourbillon — every component locked by cryptography, every movement measurable.</p>
  </div>
  <div class="panels">
    <div class="panel"><div class="ic">1</div><h4>Zeus Core</h4><p>Deterministic decision engine. Schedules every action through capability tokens (CBAT).</p></div>
    <div class="panel"><div class="ic">2</div><h4>Autonomy Chain</h4><p>PCMC — Merkle chain of every decision. Tamper‑evident, verifiable at <code class="inline">/api/autonomy/verify</code>.</p></div>
    <div class="panel"><div class="ic">3</div><h4>Module Mesh</h4><p>169 living modules. 144 legacy stubs were retired; adaptive/engine pools materialize workers on demand.</p></div>
    <div class="panel"><div class="ic">4</div><h4>Quarantine Shield</h4><p>Isolates suspect behavior. No auto‑restart loops. Safe‑code‑writer gates every change.</p></div>
    <div class="panel"><div class="ic">5</div><h4>Revenue Router</h4><p>Every $ is Ed25519‑signed and routed to the owner's BTC. Zero custodians.</p></div>
    <div class="panel"><div class="ic">6</div><h4>Value‑Proof Ledger</h4><p>Every outcome is measured in $. Auto‑invoice (bps share) on proven value.</p></div>
    <div class="panel"><div class="ic">7</div><h4>Monetization Mesh</h4><p>41 marketplaces, multi‑armed bandit pricing. Publish once, sell everywhere.</p></div>
  </div>
</section>

<section>
  <div class="section-title"><div><h2 style="font-size:28px">The clockwork flow</h2></div></div>
  <pre class="code">request  →  Zeus Core  →  capability token (CBAT)  →  Module
                                 ↓
                          Merkle chain (PCMC)
                                 ↓
                          Outcome measured (USD Δ)
                                 ↓
                 Value‑Proof Ledger  →  auto‑invoice (bps)
                                 ↓
                 Revenue Router (Ed25519)  →  BTC / PayPal
                                 ↓
                       Marketplace Mesh  →  572M reach</pre>
</section>`;
}

function pageDocs() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">API &amp; Docs</span><h2>Talk to <span class="grad">ZeusAI.</span></h2></div>
    <p>All endpoints live on the same server that rendered this page. Everything is JSON. Auth where required is capability token (CBAT) — issued per action.</p>
  </div>
  <table class="doc">
    <thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/health</code></td><td>Liveness</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/snapshot</code></td><td>Full snapshot of modules/verticals/telemetry</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/stream</code></td><td>SSE stream of snapshots (5s)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/unicorn/events</code></td><td>Realtime ZeusAI events stream (SSE)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/services</code></td><td>Live service catalogue (marketplace + verticals)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/services/list</code></td><td>Catalogue alias for API clients</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/services/:id</code></td><td>Service detail</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/services/buy</code></td><td>Unified buy flow (BTC / PayPal)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/user/services</code></td><td>User active/purchased services</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/checkout/btc</code></td><td>Create BTC invoice + signed receipt</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/checkout/paypal</code></td><td>Create PayPal link + signed receipt</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/payments/btc/confirm</code></td><td>Confirm BTC payment settlement</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/payments/paypal/confirm</code></td><td>Confirm PayPal capture/settlement</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/delivery/:receiptId</code></td><td>Delivery registry package: API key, workspace, report, onboarding, downloads</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/customer/me</code></td><td>Customer portal: orders, licenses, services, pending payments, deliverables</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/admin/commerce</code></td><td>Protected commerce cockpit: receipts, paid/unpaid, delivery state</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/admin/commerce/refund</code></td><td>Protected refund action for paid/pending receipts</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/security/pq/status</code></td><td>Post-quantum readiness + payment confirmation security mode</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/future/standard</code></td><td>30-year readiness manifest and architecture guarantees</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/evolution/loop</code></td><td>Autonomous optimization loop status + guardrails</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/trust/ledger</code></td><td>Integrity + receipt trust ledger snapshot</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/revenue/proof</code></td><td>Owner revenue proof (paid receipts + payout channels)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/resilience/drill</code></td><td>Resilience drill status and recovery metrics</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/resilience/drill/run</code></td><td>Trigger a live failover drill run</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/ui/autotune</code></td><td>Adaptive cinematic UI profile (performance-aware)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/performance/governance</code></td><td>p95/p99 telemetry with adaptive cinematic downgrade policy</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/ai/registry</code></td><td>Live AI registry (current + future adapters)</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/ai/use</code></td><td>Unified AI gateway with automatic model selection</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/activate</code></td><td>Activate a purchased service</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/autonomy/verify</code></td><td>Verify Merkle chain integrity</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/autonomy/did</code></td><td>List registered module DIDs</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/revenue/route</code></td><td>Route a revenue event (signed)</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/outcome/record</code></td><td>Record proven outcome → auto‑invoice</td></tr>
    </tbody>
  </table>

  <div class="section-title" style="margin-top:40px"><div><h2 style="font-size:22px">Example: create BTC invoice</h2></div></div>
  <pre class="code">curl -s -X POST https://zeusai.pro/api/checkout/btc \\
  -H 'Content-Type: application/json' \\
  -d '{"amount":49,"currency":"USD","plan":"starter","email":"you@company.com"}'</pre>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-top:22px">
    <div class="card"><span class="tag">Node SDK quickstart</span><pre class="code">const order = await fetch('https://zeusai.pro/api/checkout/btc', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ plan:'starter', amountUSD:49, customer:{ email:'you@company.com' } })
}).then(r => r.json());
console.log(order.receipt.id, order.btcUri);</pre></div>
    <div class="card"><span class="tag">Python SDK quickstart</span><pre class="code">import requests
order = requests.post('https://zeusai.pro/api/checkout/btc', json={
  'plan':'starter', 'amountUSD':49, 'customer':{'email':'you@company.com'}
}).json()
print(order['receipt']['id'], order.get('btcUri'))</pre></div>
    <div class="card"><span class="tag">Webhook verification</span><pre class="code"># NOWPayments IPN
GET  /api/payment/nowpayments/security
POST /api/payment/nowpayments/webhook

# The webhook is HMAC-SHA512 verified when
# NOWPAYMENTS_IPN_SECRET is configured.</pre></div>
    <div class="card"><span class="tag">Agent-to-agent checkout</span><pre class="code">GET  /openapi.json
POST /api/checkout/cascade
GET  /api/capability/credential/{receiptId}
GET  /api/delivery/{receiptId}</pre></div>
  </div>
</section>`;
}

function pageAbout() {
  return `<section style="padding-top:140px;max-width:900px">
  <span class="kicker">About</span>
  <h1 style="font-size:clamp(34px,4.5vw,58px);margin:10px 0 24px;line-height:1.05">A sovereign AI operating system, <span style="background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">hand‑forged</span> by its owner.</h1>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">ZeusAI began as one question: what if every action inside a SaaS platform could be cryptographically proven, and every dollar routed without a custodian?</p>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">Two years later, it is a running operating system for the AI era. 169 living modules. 18 pre‑wired vertical industries. 42 hyperscaler integrations. 41 marketplaces. One Zeus core. All of it owned by one person — ${OWNER.name} — and designed so that no one else can silently take a slice.</p>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">It is not a product. It is a sovereign thesis: that intelligence, value, and property can finally be unified inside a single cryptographic chassis. This is the chassis.</p>
  <div style="display:flex;gap:14px;margin-top:30px"><a class="btn btn-primary" href="/services" data-link>See the fabric</a><a class="btn" href="mailto:${OWNER.email}">Contact the owner</a></div>
</section>`;
}

function pageLegal() {
  return `<section style="padding-top:140px;max-width:900px">
  <span class="kicker">Legal</span>
  <h1 style="font-size:clamp(30px,3.6vw,44px);margin:10px 0 24px">Terms, privacy &amp; property</h1>
  <h3>Property</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">ZeusAI — including all source code, AI models, generated artefacts, UI, 3D assets, signatures, and brand — is the exclusive property of ${OWNER.name} (${OWNER.email}). No license to copy, fork, redistribute, resell, sub‑license or otherwise transfer any part is granted unless a separate written agreement, signed by the owner, explicitly says so.</p>
  <h3>Terms of service</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">By using ZeusAI you agree that all outputs, telemetry and receipts are generated honestly and routed to the owner's accounts. You agree not to attempt to bypass capability tokens, forge signatures, or exploit the autonomy chain.</p>
  <h3>Privacy</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">ZeusAI stores the minimum data necessary to deliver services: email (for activation), plan, receipts. No data is sold. No data is shared. Cryptographic receipts are append‑only and owner‑owned.</p>
  <h3>Payments</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">Payments are routed directly to owner‑controlled wallets (BTC) and accounts (PayPal). There are no custodians, no payment processors keeping a balance.</p>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:30px">Last updated: ${new Date().toISOString().slice(0,10)} · Jurisdiction: owner of record.</p>
</section>`;
}

function pageTrustCenter() {
  return `<section style="padding-top:140px;max-width:1180px">
  <span class="kicker">Trust Center · public proofs</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">Operational trust, <span class="grad">signed and inspectable.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">This page combines uptime, deploy identity, integrity signatures, owner BTC routing, payment readiness, security posture, audit logs and incident history. No private secrets are exposed.</p>
  <div class="grid" id="trustGrid" style="margin-top:22px"><div class="card"><p>Loading trust center…</p></div></div>
  <div class="card" style="padding:22px;margin-top:18px"><span class="kicker">Integrity document</span><pre class="code" id="trustRaw">Loading…</pre></div>
  <script>
  (async function(){
    const grid=document.getElementById('trustGrid'), raw=document.getElementById('trustRaw');
    try {
      const [tc, integ] = await Promise.all([
        fetch('/api/trust/center').then(r=>r.json()),
        fetch('/.well-known/unicorn-integrity.json').then(r=>r.json())
      ]);
      const cards = [
        ['Health', tc.health.status, tc.health.summary],
        ['Deploy SHA', tc.deploy.sha, tc.deploy.generatedAt],
        ['Integrity', integ.alg, 'Public key + signature live'],
        ['BTC proof', tc.owner.btc.slice(0,18)+'…', '100% owner-routed wallet'],
        ['Payments', tc.payments.mode, tc.payments.action],
        ['Security', tc.security.posture, tc.security.summary],
        ['Incidents', tc.incidents.count+' sealed', tc.incidents.status],
        ['SLO', tc.slo.uptimeTarget, tc.slo.probe]
      ];
      grid.innerHTML = cards.map(c=>'<div class="card"><span class="tag">'+c[0]+'</span><h3>'+c[1]+'</h3><p style="color:var(--ink-dim)">'+c[2]+'</p></div>').join('');
      raw.textContent = JSON.stringify({ trustCenter: tc, integrity: integ }, null, 2);
    } catch(e) { grid.innerHTML='<div class="card"><p style="color:var(--danger)">Trust center unavailable: '+e.message+'</p></div>'; }
  })();
  </script>
</section>`;
}

function pageSecurity() {
  return _policyPage('Security', 'Security posture', [
    ['Runtime hardening', 'Helmet CSP, HSTS in production, CORS allow-listing, rate limits and body sanitization protect public APIs.'],
    ['Secrets', 'GitHub Actions can sync secrets to Hetzner .env with masked values, SSH validation and PM2 reload. External provider secrets are optional until enabled.'],
    ['Payments', 'Direct BTC owner-wallet checkout is the current production rail. NOWPayments uses HMAC IPN verification only when enabled later.'],
    ['Integrity', 'The site publishes Ed25519-signed integrity at /.well-known/unicorn-integrity.json and DID discovery at /.well-known/did.json.'],
    ['QuantumIntegrityShield', 'The backend exposes exact diagnostics at /api/quantum-integrity/status and avoids false degraded state from retired PM2 process names.'],
    ['Incident handling', 'Incidents are sealed publicly and linked from /status and /trust.']
  ]);
}

function pageResponsibleAi() {
  return _policyPage('Responsible AI', 'Responsible AI controls', [
    ['Human sovereignty', 'High-risk actions remain owner-approved through admin gates, kill-switch policy and capability boundaries.'],
    ['No dark patterns', 'The anti-dark-pattern pledge forbids fake scarcity, forced accounts, drip pricing and retention traps.'],
    ['Transparency', 'Pricing experiments publish public aggregate metrics at /transparency.'],
    ['Data minimization', 'Personal data is limited to activation, receipts, support and delivery records.'],
    ['Agent boundaries', 'Agent-to-agent checkout uses signed receipts and endpoint-scoped capability credentials.'],
    ['Rollback', 'Temporal product memory records deploy identity, risk and rollback-ready status.']
  ]);
}

function pageDpa() {
  return _policyPage('Data Processing Agreement', 'Data Processing Agreement', [
    ['Controller / Processor', `${OWNER.name} operates ZeusAI as owner. Customer-specific processing is limited to service activation, delivery, support and billing.`],
    ['Data categories', 'Email, plan, order intent, receipt metadata, delivery entitlements, API keys and support messages.'],
    ['Security measures', 'TLS, signed receipts, access tokens, admin authorization, body sanitization, operational logging and least-data retention.'],
    ['Sub-processors', 'Payment and infrastructure subprocessors are disclosed through compliance attestation endpoints when configured.'],
    ['Retention', 'Receipts and integrity logs are append-only for auditability; user support data can be exported or deleted where legally allowed.'],
    ['International transfers', 'Transfers are limited to configured infrastructure/payment providers and documented in the customer agreement.']
  ]);
}

function pagePaymentTerms() {
  return _policyPage('Payment Terms', 'Payment Terms', [
    ['Current rail', 'BTC direct wallet is the active production payout path; revenue goes to the owner-controlled BTC address.'],
    ['Later rails', 'PayPal and NOWPayments are optional integrations that can be configured later without changing the BTC primary path.'],
    ['Settlement', 'Paid receipts issue delivery/license credentials after confirmation or admin settlement.'],
    ['Refunds', 'Refund guarantee and SLA breach logic are documented at /refund and /sla.'],
    ['Taxes', 'Customer is responsible for applicable taxes unless an enterprise contract states otherwise.'],
    ['Receipts', 'Every order is recorded with signed receipt metadata and owner-routed payout destination.']
  ]);
}

function pageOperator() {
  return `<section style="padding-top:140px;max-width:1180px">
  <span class="kicker">Operator Console · public-safe</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">Commerce, health and deploy <span class="grad">in one cockpit.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">Sanitized operator view for orders, payments, leads, AI provider readiness, errors, revenue proof, deploy health and webhook failures. Admin-only actions remain protected.</p>
  <div class="grid" id="opGrid" style="margin-top:22px"><div class="card"><p>Loading operator snapshot…</p></div></div>
  <pre class="code" id="opRaw" style="margin-top:18px;max-height:420px;overflow:auto">Loading…</pre>
  <script>
  fetch('/api/operator/console').then(r=>r.json()).then(d=>{
    const cards=[['Orders', d.orders.total], ['Paid', d.orders.paid], ['Revenue', '$'+d.revenue.totalUsd], ['Payment rail', d.payments.mode], ['AI providers', d.ai.active+'/'+d.ai.total], ['Deploy', d.deploy.sha], ['Errors', d.errors.count], ['Webhooks', d.webhooks.status]];
    opGrid.innerHTML=cards.map(c=>'<div class="card"><span class="tag">'+c[0]+'</span><h3>'+c[1]+'</h3></div>').join('');
    opRaw.textContent=JSON.stringify(d,null,2);
  }).catch(e=>{opRaw.textContent=e.message});
  </script>
</section>`;
}

function pageObservability() {
  return `<section style="padding-top:140px;max-width:1120px">
  <span class="kicker">Observability</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">SLOs, probes and <span class="grad">self-healing signals.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:820px">Public status page foundation for synthetic checkout probes, robots/sitemap/payment monitoring, SLO budgets and alert readiness.</p>
  <div class="grid" id="obsGrid" style="margin-top:22px"><div class="card"><p>Loading observability…</p></div></div>
  <pre class="code" id="obsRaw" style="margin-top:18px">Loading…</pre>
  <script>
  fetch('/api/observability/status').then(r=>r.json()).then(d=>{
    obsGrid.innerHTML=d.probes.map(p=>'<div class="card"><span class="tag">'+p.status+'</span><h3>'+p.name+'</h3><p style="color:var(--ink-dim)">'+p.target+' · '+p.interval+'</p></div>').join('');
    obsRaw.textContent=JSON.stringify(d,null,2);
  }).catch(e=>{obsRaw.textContent=e.message});
  </script>
</section>`;
}

function pageStore() {
  return `<section class="enterprise-hero" style="padding-top:120px">
  <div style="max-width:1280px;margin:0 auto;padding:0 28px">
    <span class="kicker" style="color:#ffd36a">ZeusAI Store · 25 real products across 3 tiers</span>
    <h1 style="font-size:clamp(36px,5vw,64px);line-height:1.04;margin:14px 0 18px;letter-spacing:-0.02em;background:linear-gradient(135deg,#fff 0%,#ffd36a 40%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Buy it. Pay with BTC, card or wire. Use it instantly.</h1>
    <p style="color:var(--ink-dim);font-size:18px;max-width:900px;line-height:1.55">Every service ZeusAI offers — from $29 digital deliverables to $2B hyperscaler licenses — purchasable directly from this page. Bitcoin on-chain for instant fulfillment, Stripe for cards, SWIFT/SEPA wire for enterprise. Every artifact Ed25519-signed.</p>

    <div id="storeStats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:30px 0 20px"></div>

    <div id="storeTabs" style="display:flex;gap:8px;margin:30px 0 10px;flex-wrap:wrap;border-bottom:1px solid rgba(138,92,255,.2);padding-bottom:4px">
      <button class="store-tab" data-tier="instant" style="background:linear-gradient(135deg,#8a5cff,#6d28d9);color:#fff;border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">⚡ Instant &lt;60s</button>
      <button class="store-tab" data-tier="professional" style="background:rgba(138,92,255,.1);color:var(--ink);border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">💼 Professional SaaS</button>
      <button class="store-tab" data-tier="enterprise" style="background:rgba(138,92,255,.1);color:var(--ink);border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">👑 Enterprise Licenses</button>
    </div>
    <div id="storeTabNote" style="color:var(--ink-dim);font-size:13px;margin:6px 0 20px"></div>

    <div id="storeGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px;margin:20px 0 40px"></div>
    <div id="storeCheckout" style="margin:40px 0 80px"></div>
  </div>
</section>`;
}

function pageAccount() {
  return `<section class="enterprise-hero" style="padding-top:120px">
  <div style="max-width:1100px;margin:0 auto;padding:0 28px">
    <span class="kicker" style="color:#8a5cff">Customer Portal</span>
    <h1 style="font-size:clamp(36px,4.5vw,56px);line-height:1.04;margin:14px 0 30px;letter-spacing:-0.02em">Your account</h1>
    <div id="accountRoot"></div>
  </div>
</section>`;
}

function pageEnterprise() {
  return `<section class="enterprise-hero" style="padding-top:120px">
  <div style="max-width:1280px;margin:0 auto;padding:0 28px">
    <span class="kicker" style="color:#ffd36a">Enterprise · Hyperscaler grade</span>
    <h1 style="font-size:clamp(40px,5.4vw,72px);line-height:1.02;margin:14px 0 18px;letter-spacing:-0.02em;background:linear-gradient(135deg,#fff 0%,#ffd36a 40%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Licenses built for AWS, Google, Microsoft, Meta, Apple, Amazon.</h1>
    <p style="color:var(--ink-dim);font-size:19px;max-width:900px;line-height:1.55">Ten production-ready ZeusAI platforms. Anchor pricing from <b style="color:#fff">$14M</b> to <b style="color:#fff">$150M</b>. Topstone deals up to <b style="color:#ffd36a">$2B</b>. Every license includes signed deliverables, sovereign key ceremony, 99.99%+ SLA, and a live <b style="color:#fff">autonomous negotiation desk</b> that closes without a human in the loop.</p>

    <div id="entSummary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:32px 0 40px">
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Products</div><div style="font-size:32px;font-weight:700;margin-top:6px" id="entProducts">10</div></div>
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Target accounts</div><div style="font-size:32px;font-weight:700;margin-top:6px" id="entAccounts">—</div></div>
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Portfolio anchor</div><div style="font-size:32px;font-weight:700;margin-top:6px;color:#8a5cff" id="entAnchor">—</div></div>
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Topstone potential</div><div style="font-size:32px;font-weight:700;margin-top:6px;color:#ffd36a" id="entTop">—</div></div>
    </div>

    <div id="entProductsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:22px;margin-bottom:50px"></div>
    <div id="entNegotiator" style="margin:40px 0"></div>
    <div id="entDeals" style="margin:40px 0 80px"></div>
  </div>
</section>`;
}

function renderRoute(route, params = {}) {
  switch (route) {
    case '/': return pageHome();
    case '/services': return pageServices();
    case '/pricing': return pagePricing();
    case '/checkout': return pageCheckout();
    case '/dashboard': return pageDashboard();
    case '/how': return pageHow();
    case '/docs': return pageDocs();
    case '/about': return pageAbout();
    case '/legal': return pageLegal();
    case '/trust': return pageTrustCenter();
    case '/security': return pageSecurity();
    case '/responsible-ai': return pageResponsibleAi();
    case '/dpa': return pageDpa();
    case '/payment-terms': return pagePaymentTerms();
    case '/operator': return pageOperator();
    case '/observability': return pageObservability();
    case '/enterprise': return pageEnterprise();
    case '/store': return pageStore();
    case '/innovations': return pageInnovations();
    case '/account': return pageAccount();
    case '/admin/services': return pageAdminServices();
    case '/admin': return pageAdminLogin();
    case '/admin/login': return pageAdminLogin();
    case '/wizard': return pageWizard();
    case '/status': return pageStatus();
    case '/changelog': return pageChangelog();
    case '/terms': return pageTerms();
    case '/privacy': return pagePrivacy();
    case '/refund': return pageRefund();
    case '/sla': return pageSla();
    case '/pledge': return pagePledge();
    case '/cancel': return pageCancel();
    case '/gift': return pageGift();
    case '/aura': return pageAura();
    case '/api-explorer': return pageApiExplorer();
    case '/transparency': return pageTransparency();
    case '/frontier': return pageFrontier();
    default:
      if (route.startsWith('/services/')) return pageService(params.id || route.slice(10));
      return pageNotFound(route);
  }
}

function pageAdminLogin() {
  return `<section class="section">
  <div class="container" style="max-width:460px">
    <h1 class="h1">Admin</h1>
    <p style="color:var(--ink-dim)">One-time login. A secure HttpOnly cookie is set for 7 days — afterwards you just go to <code class="inline">/admin/services</code> and everything works.</p>
    <form id="admLoginForm" class="card" style="padding:22px;display:grid;gap:12px;margin-top:18px">
      <label style="font-size:12px;color:var(--ink-dim)">Admin password</label>
      <input id="admLoginPwd" type="password" autocomplete="current-password" required placeholder="ADMIN_SECRET" style="padding:12px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <button class="btn btn-primary" type="submit">Login</button>
      <span id="admLoginMsg" style="font-size:13px;color:var(--ink-dim);min-height:18px"></span>
    </form>
    <div id="admLoginActive" style="display:none;margin-top:18px" class="card">
      <div style="padding:16px">
        <strong>✓ Logged in.</strong>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
          <a href="/admin/services" class="btn btn-primary">Manage services →</a>
          <button id="admLogoutBtn" class="btn">Logout</button>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function pageAdminServices() {
  return `<section class="section">
  <div class="container">
    <h1 class="h1">Admin · Services</h1>
    <p style="color:var(--ink-dim);max-width:780px">Add, edit or remove marketplace services in real time. Changes are persisted on the backend and broadcast instantly (&lt;1s) to every connected browser via SSE.</p>
    <div id="admSessionBar" style="margin:18px 0;display:flex;gap:10px;align-items:center;font-size:13px"></div>
    <div class="card" style="padding:22px;margin:12px 0 28px">
      <h3 style="margin:0 0 12px">New / Update service</h3>
      <form id="admSvcForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
        <div><label style="font-size:12px;color:var(--ink-dim)">id</label><input name="id" required placeholder="adaptive-ai" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">title</label><input name="title" required placeholder="Adaptive AI" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">segment</label><input name="segment" placeholder="all|startups|companies|enterprise" value="all" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">kpi</label><input name="kpi" placeholder="automation coverage" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">price (USD)</label><input name="price" type="number" min="0" step="1" value="499" required style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">billing</label><input name="billing" placeholder="monthly|annual|one-time" value="monthly" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--ink-dim)">description</label><textarea name="description" rows="2" placeholder="Short value proposition" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></textarea></div>
        <div style="grid-column:1/-1;display:flex;gap:10px">
          <button class="btn btn-primary" type="submit">Create / update</button>
          <button class="btn" type="reset">Clear</button>
          <span id="admSvcMsg" style="align-self:center;font-size:13px;color:var(--ink-dim)"></span>
        </div>
      </form>
    </div>
    <h3 style="margin:0 0 12px">Live catalogue (auto-syncs)</h3>
    <div id="admSvcList" style="display:grid;gap:10px">Loading…</div>
  </div>
</section>`;
}

function pageInnovations() {
  return `<section class="section">
  <div class="container">
    <h1 class="h1">30-Year Cryptographic Durability</h1>
    <p class="lead" style="max-width:880px">Twelve sovereign primitives that make every action provable for the next three decades — quantum-safe signatures, Bitcoin-anchored Merkle receipts, a public AI constitution, and a 4-of-7 Shamir time capsule.</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:22px 0">
      <div class="card" style="padding:18px"><span class="tag">Constitution</span><h3 id="invConHash" style="margin:8px 0;font-family:monospace">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Public, hashed, signed. Every response carries <code class="inline">X-Constitution-Hash</code>.</p><a href="/api/constitution" class="btn" style="margin-top:8px">View</a></div>
      <div class="card" style="padding:18px"><span class="tag">Today's Merkle root</span><h3 id="invRoot" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px"><span id="invRootCount">0</span> receipts · OP_RETURN-ready · published daily</p><a href="/api/receipts/root" class="btn" style="margin-top:8px">JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">BTC TWAP (5-source median)</span><h3 id="invTwap" style="margin:8px 0">$…</h3><p style="color:var(--ink-dim);font-size:13.5px">Kraken · Coinbase · Bitstamp · Binance · OKX</p><a href="/api/btc/twap" class="btn" style="margin-top:8px">Live JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Quantum-safe signing</span><h3 style="margin:8px 0">Ed25519 + ML-DSA-65</h3><p style="color:var(--ink-dim);font-size:13.5px">FIPS 204 hybrid. 3309-byte PQ signature on every daily root.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Reproducible SBOM</span><h3 id="invSbom" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">sha3-256 over critical sources · public composite hash</p><a href="/api/sbom" class="btn" style="margin-top:8px">View</a></div>
      <div class="card" style="padding:18px"><span class="tag">Permanent archive manifest</span><h3 style="margin:8px 0">Archive snapshot</h3><p style="color:var(--ink-dim);font-size:13.5px">Daily root + constitution + SBOM + PQ pubkey, ready for Archive.org / Arweave anchoring.</p><a href="/api/innovations/archive" class="btn" style="margin-top:8px">Manifest</a></div>
    </div>

    <h2 style="margin-top:32px">Model registry &amp; provenance</h2>
    <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
      <table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#0b0f17"><th style="text-align:left;padding:12px">Model</th><th style="text-align:left;padding:12px">Family</th><th style="text-align:left;padding:12px">Provenance</th><th style="text-align:left;padding:12px">SHA-256</th></tr></thead><tbody id="invModels"><tr><td colspan="4" style="padding:14px;color:var(--ink-dim)">Loading…</td></tr></tbody></table>
    </div>

    <h2 style="margin-top:32px">Sealed incidents (commit-reveal)</h2>
    <p style="color:var(--ink-dim);font-size:14px;max-width:780px">Every incident is committed encrypted at occurrence time and revealed automatically after the time-lock expires. No incident can be deleted or rewritten.</p>
    <div id="invIncidents" class="card" style="padding:18px;margin-top:12px;font-size:14px;color:var(--ink-dim)">Loading…</div>

    <h2 style="margin-top:32px">All public endpoints</h2>
    <ul style="color:var(--ink-dim);font-size:14px;line-height:2;list-style:none;padding:0">
      <li><code class="inline">GET /api/constitution</code> — full text + hash + signature</li>
      <li><code class="inline">GET /api/innovations/status</code> — overview JSON</li>
      <li><code class="inline">GET /api/innovations/archive</code> — permanent archive manifest</li>
      <li><code class="inline">GET /.well-known/ai-attestation</code> — discovery endpoint for crawlers</li>
      <li><code class="inline">GET /api/btc/twap</code> — 5-source median, 60s TTL</li>
      <li><code class="inline">GET /api/sbom</code> — reproducible build manifest</li>
      <li><code class="inline">GET /api/incidents</code> — public sealed incident list</li>
      <li><code class="inline">GET /api/audit/me</code> — your personal Merkle audit log</li>
      <li><code class="inline">GET /api/receipts/root</code> — today's signed Merkle root</li>
      <li><code class="inline">GET /api/receipts/proof/:id</code> — inclusion proof for any receipt</li>
      <li><code class="inline">POST /api/innovations/receipt</code> — append a receipt</li>
      <li><code class="inline">POST /api/innovations/roll-root</code> — finalize today's root</li>
    </ul>

    <h2 style="margin-top:42px">Second batch · 15 more primitives <span class="tag" style="margin-left:8px">v2</span></h2>
    <p style="color:var(--ink-dim);max-width:880px">ZK-friendly commitments, threshold key bootstrap, federated learning aggregator, verifiable random &amp; delay functions, k-anonymity analytics, censorship-resistant relay descriptor, signed reputation graph, GDPR/SOC2 self-attestation, DR drill ledger, carbon ledger, bug-bounty escrow, decentralized identity (did:web + did:key).</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0">
      <div class="card" style="padding:18px"><span class="tag">DID Document</span><h3 style="margin:8px 0;font-size:15px">did:web:zeusai.pro</h3><p style="color:var(--ink-dim);font-size:13.5px">W3C-compliant decentralized identity at <code class="inline">/.well-known/did.json</code></p><a href="/.well-known/did.json" class="btn" style="margin-top:8px">View</a></div>
      <div class="card" style="padding:18px"><span class="tag">Compliance attestation</span><h3 id="invCompHash" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">GDPR · SOC2 · ISO27001 self-attestation, hashed + signed</p><a href="/api/compliance/attestation" class="btn" style="margin-top:8px">View</a></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon ledger</span><h3 id="invCarbon" style="margin:8px 0;font-size:18px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Daily attestations, signed gCO₂ entries</p><a href="/api/v2/carbon/attest" class="btn" style="margin-top:8px">Today</a></div>
      <div class="card" style="padding:18px"><span class="tag">Bug bounty</span><h3 id="invBounty" style="margin:8px 0">$…</h3><p style="color:var(--ink-dim);font-size:13.5px">Public open-bounty escrow ledger</p><a href="/api/v2/bounty/total" class="btn" style="margin-top:8px">List</a></div>
      <div class="card" style="padding:18px"><span class="tag">Relay descriptor</span><h3 style="margin:8px 0;font-size:15px">HTTPS · Tor · Nostr · IPFS</h3><p style="color:var(--ink-dim);font-size:13.5px">Censorship-resistant transports advertised publicly</p><a href="/api/v2/relay" class="btn" style="margin-top:8px">View</a></div>
      <div class="card" style="padding:18px"><span class="tag">VRF · VDF</span><h3 style="margin:8px 0;font-size:15px">Provable randomness &amp; time-locks</h3><p style="color:var(--ink-dim);font-size:13.5px">HMAC-VRF for fair lotteries · iterated-SHA256 VDF for sealed reveals</p></div>
      <div class="card" style="padding:18px"><span class="tag">DR drills</span><h3 id="invDR" style="margin:8px 0">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed disaster-recovery drill ledger</p><a href="/api/v2/dr/list" class="btn" style="margin-top:8px">History</a></div>
      <div class="card" style="padding:18px"><span class="tag">v2 Status</span><h3 style="margin:8px 0;font-size:15px">15 primitives · 28 endpoints</h3><p style="color:var(--ink-dim);font-size:13.5px">Full feature inventory + counters</p><a href="/api/v2/status" class="btn" style="margin-top:8px">Status JSON</a></div>
    </div>
    <details style="margin-top:18px"><summary style="cursor:pointer;color:var(--ink-dim);font-size:14px">All v2 endpoints (28)</summary>
    <ul style="color:var(--ink-dim);font-size:13px;line-height:1.9;list-style:none;padding:12px 0 0 0">
      <li><code class="inline">GET  /api/v2/status</code> — feature inventory</li>
      <li><code class="inline">GET  /.well-known/did.json</code> — W3C DID document</li>
      <li><code class="inline">GET  /api/compliance/attestation</code> — GDPR/SOC2 attestation</li>
      <li><code class="inline">GET  /api/v2/relay</code> — relay descriptor</li>
      <li><code class="inline">GET  /api/v2/carbon/attest</code> — daily gCO₂ attest</li>
      <li><code class="inline">GET  /api/v2/bounty/total · /list</code></li>
      <li><code class="inline">GET  /api/v2/dr/list</code></li>
      <li><code class="inline">GET  /api/v2/fl/rounds</code></li>
      <li><code class="inline">GET  /api/v2/threshold/list</code></li>
      <li><code class="inline">GET  /api/v2/reputation/:did</code></li>
      <li><code class="inline">GET  /api/v2/did/self · /api/v2/did/resolve/:did</code></li>
      <li><code class="inline">GET  /api/v2/bucket/take/:key</code> — token bucket</li>
      <li><code class="inline">POST /api/v2/zk/commit · /verify</code></li>
      <li><code class="inline">POST /api/v2/threshold/keygen</code></li>
      <li><code class="inline">POST /api/v2/fl/submit · /close</code></li>
      <li><code class="inline">POST /api/v2/vrf/prove · /verify</code></li>
      <li><code class="inline">POST /api/v2/vdf/eval · /verify</code></li>
      <li><code class="inline">POST /api/v2/reputation</code></li>
      <li><code class="inline">POST /api/v2/dr/record</code></li>
      <li><code class="inline">POST /api/v2/carbon/record</code></li>
      <li><code class="inline">POST /api/v2/bounty/add</code></li>
    </ul>
    </details>
  </div>
  <script>
  (async function(){
    const $ = (id) => document.getElementById(id);
    try { const s = await (await fetch('/api/innovations/status')).json();
      $('invConHash').textContent = (s.constitution && s.constitution.hashShort) || '—';
      if (s.models) $('invModels').innerHTML = s.models.map(m =>
        '<tr style="border-top:1px solid #1f2a3b"><td style="padding:12px">'+m.id+' · v'+m.version+'</td><td style="padding:12px">'+m.family+'</td><td style="padding:12px">'+(m.provenance||'—')+'</td><td style="padding:12px;font-family:monospace;font-size:12px">'+(m.sha256||'').slice(0,16)+'…</td></tr>').join('');
    } catch(e) { $('invConHash').textContent='offline'; }
    try { const r = await (await fetch('/api/receipts/root')).json();
      if (r && r.root) { $('invRoot').textContent = r.root.slice(0,24)+'…'; $('invRootCount').textContent = r.count || 0; }
      else { $('invRoot').textContent = 'pending first roll'; }
    } catch(e) {}
    try { const t = await (await fetch('/api/btc/twap')).json();
      $('invTwap').textContent = '$' + (t.twapUsd ? Number(t.twapUsd).toLocaleString(undefined,{maximumFractionDigits:0}) : '—');
    } catch(e) { $('invTwap').textContent = 'offline'; }
    try { const sb = await (await fetch('/api/sbom')).json();
      $('invSbom').textContent = (sb.compositeHash||'').slice(0,24)+'…';
    } catch(e) {}
    try { const inc = await (await fetch('/api/incidents')).json();
      if (!inc || !inc.length) { $('invIncidents').textContent = '✓ No incidents on record. Constitutional integrity nominal.'; }
      else { $('invIncidents').innerHTML = inc.map(i => '<div style="padding:8px 0;border-bottom:1px solid #1f2a3b"><strong>'+i.incidentId.slice(0,20)+'</strong> · '+i.status+' · sealed '+(i.sealedAt||'').slice(0,10)+'</div>').join(''); }
    } catch(e) {}
    // v2 cards
    try { const ca = await (await fetch('/api/compliance/attestation')).json(); $('invCompHash').textContent = (ca.hash||'').slice(0,24)+'…'; } catch(e) {}
    try { const co = await (await fetch('/api/v2/carbon/attest')).json(); $('invCarbon').textContent = (co.totalGCO2||0).toFixed(4)+' gCO₂ today'; } catch(e) {}
    try { const bt = await (await fetch('/api/v2/bounty/total')).json(); $('invBounty').textContent = '$'+(bt.totalUsd||0).toLocaleString()+' · '+(bt.open||0)+' open'; } catch(e) {}
    try { const dr = await (await fetch('/api/v2/dr/list')).json(); $('invDR').textContent = (dr.count||0)+' drill'+(dr.count===1?'':'s')+(dr.last ? ' · last RTO '+dr.last.rtoSeconds+'s' : ''); } catch(e) {}
  })();
  </script>
</section>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FRONTIER PAGES — autonomous sales fabric + 12 sovereign inventions
// ═══════════════════════════════════════════════════════════════════════════
function pageWizard() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Plan wizard · 30s</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 12px;line-height:1.05">Find your <span class="grad">perfect ZeusAI plan</span> in 30 seconds.</h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.6;max-width:680px">Four questions. Deterministic, explainable scoring. Every recommendation signed Ed25519 — you can verify it.</p>
  <div class="card" id="wizCard" style="padding:28px;margin-top:22px">
    <div class="field"><label>1 · Company size</label>
      <select id="wizSegment"><option value="startup">Startup / Solo</option><option value="company">Scaling company</option><option value="enterprise">Enterprise</option></select></div>
    <div class="field"><label>2 · Monthly volume</label>
      <select id="wizVolume"><option value="low">Low (&lt; 100k operations)</option><option value="medium">Medium (100k-5M)</option><option value="high">High (&gt; 5M)</option></select></div>
    <div class="field"><label>3 · Monthly budget (USD)</label>
      <input id="wizBudget" type="number" min="0" step="50" value="499"></div>
    <div class="field"><label>4 · Primary goal</label>
      <select id="wizGoal"><option value="automation">Automation</option><option value="revenue">Revenue growth</option><option value="cost">Cost reduction</option><option value="compliance">Compliance / Sovereignty</option></select></div>
    <button class="btn btn-primary" id="wizBtn" style="width:100%;justify-content:center">Recommend my plan →</button>
    <div id="wizOut" style="margin-top:18px"></div>
  </div>
  <script>
  document.getElementById('wizBtn').addEventListener('click', async () => {
    const out = document.getElementById('wizOut'); out.innerHTML = '<p style="color:var(--ink-dim)">Computing…</p>';
    const body = { segment: wizSegment.value, volume: wizVolume.value, budget: Number(wizBudget.value)||0, goal: wizGoal.value };
    try {
      const r = await fetch('/api/wizard/recommend', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      const winner = d.plan.toUpperCase();
      out.innerHTML = '<div class="card" style="border-color:var(--violet);padding:22px"><span class="kicker">Recommended</span><h2 style="margin:8px 0">'+winner+' · $'+d.cta.amount+'</h2><p style="color:var(--ink-dim)">Top services for you: '+d.services.map(s=>'<code class="inline">'+s+'</code>').join(' ')+'</p><a class="btn btn-primary" href="'+d.cta.url+'" data-link>Buy '+winner+' now →</a><a class="btn" href="/pricing" data-link style="margin-left:8px">See all plans</a><details style="margin-top:14px"><summary style="cursor:pointer;color:var(--ink-dim);font-size:13px">Why this plan? (signed reasoning)</summary><pre class="code">'+JSON.stringify({ ranked: d.ranked, explain: d.explain, signedAt: d.signedAt, signature: d.signature.slice(0,32)+'…' }, null, 2)+'</pre></details></div>';
    } catch (e) { out.innerHTML = '<p style="color:var(--danger)">Error: '+e.message+'</p>'; }
  });
  </script>
</section>`;
}

function pageStatus() {
  return `<section style="padding-top:140px;max-width:1100px">
  <span class="kicker">Live status</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">All systems <span id="stHeadline" class="grad">operational.</span></h1>
  <p style="color:var(--ink-dim);font-size:15px">Live, signed status. Source: <code class="inline">/api/status</code>. Refreshes every 15s.</p>
  <div class="grid" id="stGrid" style="margin-top:22px"><div class="card"><p>Loading…</p></div></div>
  <div class="card" style="margin-top:22px;padding:22px"><span class="kicker">90-day uptime</span><h2 id="stUptime" style="margin:8px 0">—</h2><p style="color:var(--ink-dim)">Synthetic checks every 60s. Incidents publicly sealed (commit-reveal).</p><a class="btn" href="/api/incidents" target="_blank">Public incident log</a></div>
  <script>
  async function loadStatus(){
    try { const d = await (await fetch('/api/status')).json();
      document.getElementById('stHeadline').textContent = d.overall + '.';
      document.getElementById('stUptime').textContent = d.uptime90d + '%';
      document.getElementById('stGrid').innerHTML = d.components.map(c => '<div class="card"><span class="tag" style="background:rgba(59,255,176,.15);color:#3bffb0">'+c.status+'</span><h3>'+c.name+'</h3><p style="color:var(--ink-dim)">Latency: <b>'+c.latencyMs+'ms</b></p></div>').join('');
    } catch(e) {}
  }
  loadStatus(); setInterval(loadStatus, 15000);
  </script>
</section>`;
}

function pageChangelog() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Changelog</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">What's <span class="grad">new.</span></h1>
  <div class="card" style="padding:22px;margin-bottom:14px"><span class="tag">2026-04-25</span><h3>Frontier Engine v1.0 · 12 sovereign inventions</h3><p style="color:var(--ink-dim)">Crypto refund guarantee, live aura, outcome-anchored pricing, self-healing checkout, time-locked discounts, sovereign receipt NFTs, provable email delivery, gift-as-capability, anti-dark-pattern pledge, universal cancel, bandit transparency, carbon-inclusive checkout. + cart engine, coupons, leads, API keys, OpenAPI 3.1, sitemap.xml, plan wizard.</p></div>
  <div class="card" style="padding:22px;margin-bottom:14px"><span class="tag">2026-04-24</span><h3>30Y Innovations v2 · 15 more primitives</h3><p style="color:var(--ink-dim)">ZK commitments, threshold keys, federated learning, VRF, VDF, k-anon analytics, relay descriptor, reputation graph, compliance attestation, DR drills, carbon ledger, bug bounty escrow, did:web + did:key.</p></div>
  <div class="card" style="padding:22px;margin-bottom:14px"><span class="tag">2026-04-23</span><h3>30Y Innovations v1 · cryptographic durability</h3><p style="color:var(--ink-dim)">ML-DSA-65 hybrid signing, BTC-anchored Merkle receipts, public AI constitution, 4-of-7 Shamir time capsule, reproducible SBOM, sealed incident commit-reveal.</p></div>
</section>`;
}

function pageTerms()   { return _legalSub('Terms of Service', 'By using ZeusAI you agree that all outputs, telemetry and receipts are honestly generated and routed to the owner. You agree not to bypass capability tokens, forge signatures, or exploit the autonomy chain. Service is provided as-is with the SLA at /sla and refund guarantee at /refund.'); }
function pagePrivacy() { return _legalSub('Privacy Policy', 'We store the minimum data necessary: email (activation), plan, receipts. No selling, no sharing, no model training on personal data. GDPR rights honoured at /api/privacy/dsr. Cryptographic receipts are append-only and owner-owned. Sub-processors disclosed at /api/compliance/attestation.'); }
function pageRefund()  { return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Refund Guarantee · F1</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Cryptographic <span class="grad">refund guarantee.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">If we fail you, the system refunds itself. Below: live, signed promise. If breached, an autonomous compensator emits a signed REFUND_INTENT and the revenue router reverses the matching receipt within 24h.</p>
  <pre class="code" id="rfOut" style="margin-top:18px">Loading signed promise…</pre>
  <script>fetch('/api/refund/guarantee').then(r=>r.json()).then(d=>{rfOut.textContent=JSON.stringify(d,null,2)}).catch(()=>{});</script>
</section>`; }
function pageSla() { return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Service Level Agreement</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">SLA · <span class="grad">99.99% sovereign.</span></h1>
  <ul style="color:var(--ink-dim);font-size:15.5px;line-height:1.9;padding-left:20px">
    <li><b style="color:#fff">Uptime</b> · 99.99% target for /api · 99.9% for /</li>
    <li><b style="color:#fff">Latency</b> · p95 &lt; 800ms global, p99 &lt; 1500ms</li>
    <li><b style="color:#fff">Receipt</b> · every API call &lt; 60s eligible for inclusion in the next signed Merkle root</li>
    <li><b style="color:#fff">Incident disclosure</b> · &lt; 72h public, sealed at /api/incidents</li>
    <li><b style="color:#fff">Refund</b> · auto on breach (see /refund)</li>
  </ul>
  <a class="btn btn-primary" href="/status" data-link>Live status →</a>
</section>`; }

function pagePledge() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Anti-Dark-Pattern Pledge · F9</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Public, signed, <span class="grad">self-enforcing.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No fake scarcity. No forced accounts. No drip pricing. No retention dark patterns. No selling your data. One-click cancel at <a href="/cancel" data-link>/cancel</a>. The pledge below is signed Ed25519 — anyone can verify. On confirmed breach, an INCIDENT is publicly sealed.</p>
  <pre class="code" id="plOut" style="margin-top:18px">Loading…</pre>
  <div class="card" style="margin-top:22px;padding:22px"><h3 style="margin:0 0 10px">Report a breach</h3><p style="color:var(--ink-dim)">Suspect we broke our pledge? Report it. We seal the incident publicly within 72h.</p>
    <div class="field"><label>Email</label><input id="prEmail" type="email"></div>
    <div class="field"><label>Evidence</label><textarea id="prEv" rows="4" style="padding:12px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-family:inherit;width:100%"></textarea></div>
    <button class="btn btn-primary" id="prBtn">Submit signed report →</button>
    <div id="prOut" style="margin-top:10px;color:var(--ink-dim);font-size:13px"></div>
  </div>
  <script>
  fetch('/api/pledge').then(r=>r.json()).then(d=>{plOut.textContent=JSON.stringify(d,null,2)});
  document.getElementById('prBtn').addEventListener('click', async () => {
    const r = await fetch('/api/pledge/report', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: prEmail.value, evidence: prEv.value }) });
    const d = await r.json(); prOut.textContent = d.ok ? 'Recorded · '+d.id : 'Error';
  });
  </script>
</section>`;
}

function pageCancel() {
  return `<section style="padding-top:140px;max-width:680px">
  <span class="kicker">Universal Cancel · F10</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">One click. <span class="grad">Everything cancels.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No friction. No "are you sure". No retention chat-bot. Type your email — every active subscription is cancelled within 60 seconds. You receive a signed cryptographic confirmation by email.</p>
  <div class="card" style="padding:24px;margin-top:18px">
    <div class="field"><label>Email on account</label><input id="cnEmail" type="email" placeholder="you@company.com"></div>
    <div class="field"><label>Reason (optional)</label><input id="cnReason" placeholder="moving on, no hard feelings"></div>
    <button class="btn btn-primary" id="cnBtn" style="width:100%;justify-content:center">Cancel everything · 1 click</button>
    <div id="cnOut" style="margin-top:14px;color:var(--ink-dim);font-size:13.5px"></div>
  </div>
  <script>
  document.getElementById('cnBtn').addEventListener('click', async () => {
    const r = await fetch('/api/cancel/universal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: cnEmail.value, reason: cnReason.value }) });
    const d = await r.json(); cnOut.innerHTML = d.ok ? '<b style="color:#3bffb0">✓ '+d.message+'</b><br><small style="font-family:var(--mono);font-size:11px">sig '+d.signature.slice(0,40)+'…</small>' : '<b style="color:var(--danger)">Error</b>';
  });
  </script>
</section>`;
}

function pageGift() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Gift-as-Capability · F8</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Send ZeusAI as a <span class="grad">cryptographic gift.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No account required for the recipient. They click your link, redeem the signed capability, get the service activated.</p>
  <div class="card" style="padding:24px;margin-top:18px">
    <div class="field"><label>Service / SKU</label><input id="gtSku" value="adaptive-ai"></div>
    <div class="field"><label>Value (USD)</label><input id="gtVal" type="number" value="49"></div>
    <div class="field"><label>From email</label><input id="gtFrom" type="email"></div>
    <div class="field"><label>To email (optional)</label><input id="gtTo" type="email"></div>
    <div class="field"><label>Message</label><input id="gtMsg" placeholder="Use ZeusAI on me 🎁"></div>
    <button class="btn btn-primary" id="gtBtn" style="width:100%;justify-content:center">Mint signed gift →</button>
    <div id="gtOut" style="margin-top:14px"></div>
  </div>
  <script>
  document.getElementById('gtBtn').addEventListener('click', async () => {
    const r = await fetch('/api/gift/mint', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sku:gtSku.value, valueUsd:Number(gtVal.value)||49, fromEmail:gtFrom.value, toEmail:gtTo.value, message:gtMsg.value }) });
    const d = await r.json(); gtOut.innerHTML = '<div class="card" style="border-color:var(--violet)"><h3>'+d.code+'</h3><p style="color:var(--ink-dim)">Share this URL: <code class="inline">'+location.origin+d.redeemUrl+'</code></p><p style="color:var(--ink-dim);font-size:12px">Signed at '+d.mintedAt+'</p></div>';
  });
  </script>
</section>`;
}

function pageAura() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Live Conversion Aura · F2</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">The <span class="grad">heartbeat</span> of ZeusAI.</h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">Every metric below is fetched from <code class="inline">/api/aura</code>, signed Ed25519 at the moment of generation. No mocks, no inflation.</p>
  <div class="grid" id="auraGrid" style="margin-top:22px"><div class="card"><p>Loading…</p></div></div>
  <pre class="code" id="auraRaw" style="margin-top:18px;max-height:280px;overflow:auto">…</pre>
  <script>
  async function loadAura(){
    const d = await (await fetch('/api/aura')).json();
    document.getElementById('auraRaw').textContent = JSON.stringify(d, null, 2);
    const m = d.metrics;
    document.getElementById('auraGrid').innerHTML = [
      ['Orders total', m.ordersTotal],
      ['Orders 24h', m.ordersLast24h],
      ['Leads total', m.leadsTotal],
      ['GMV USD', '$'+(m.gmvUsd||0).toLocaleString()],
      ['Newsletter', m.newsletter]
    ].map(([k,v])=>'<div class="card"><span class="tag">'+k+'</span><h2 style="margin:8px 0">'+v+'</h2></div>').join('');
  }
  loadAura(); setInterval(loadAura, 5000);
  </script>
</section>`;
}

function pageApiExplorer() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">API Explorer</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Try every <span class="grad">endpoint</span> live.</h1>
  <p style="color:var(--ink-dim);font-size:15px">OpenAPI 3.1 spec at <a href="/openapi.json" target="_blank">/openapi.json</a>. Below is the live endpoint inventory.</p>
  <div id="apiList" class="card" style="padding:22px;margin-top:18px;font-family:var(--mono);font-size:13px;line-height:1.9;max-height:80vh;overflow:auto">Loading…</div>
  <script>
  fetch('/openapi.json').then(r=>r.json()).then(d=>{
    const rows = Object.entries(d.paths).map(([p,ops])=>{
      const ms = Object.keys(ops).map(m=>'<code class="inline" style="text-transform:uppercase">'+m+'</code>').join(' ');
      return '<div style="padding:6px 0;border-bottom:1px solid var(--stroke)">'+ms+' <a href="'+p+'" target="_blank" style="color:var(--violet2)">'+p+'</a> <span style="color:var(--ink-dim);font-size:12px">'+ (Object.values(ops)[0].summary || '') +'</span></div>';
    });
    document.getElementById('apiList').innerHTML = rows.join('');
  });
  </script>
</section>`;
}

function pageTransparency() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Pricing Bandit Transparency · F11</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">We test prices. <span class="grad">In public.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">The bandit decides which price to show. You see what it tested, the conversion rate, and the value per impression. Snapshot signed daily.</p>
  <div id="btTable" class="card" style="padding:22px;margin-top:22px">Loading…</div>
  <script>
  fetch('/api/bandit/transparency').then(r=>r.json()).then(d=>{
    const rows = (d.arms||[]).map(a=>'<tr><td style="padding:8px">'+a.arm+'</td><td style="padding:8px">'+a.impressions+'</td><td style="padding:8px">'+a.conversions+'</td><td style="padding:8px">'+(a.conversionRate*100).toFixed(2)+'%</td><td style="padding:8px">$'+(a.eValue||0).toFixed(2)+'</td></tr>').join('') || '<tr><td colspan="5" style="padding:14px;color:var(--ink-dim)">No experiments recorded yet. The bandit publishes its experiments here as it learns.</td></tr>';
    document.getElementById('btTable').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#0b0f17"><th style="text-align:left;padding:8px">Arm</th><th style="text-align:left;padding:8px">Impressions</th><th style="text-align:left;padding:8px">Conversions</th><th style="text-align:left;padding:8px">CR</th><th style="text-align:left;padding:8px">$/imp</th></tr></thead><tbody>'+rows+'</tbody></table><p style="color:var(--ink-dim);font-size:12px;margin-top:14px;font-family:var(--mono)">snapshot: '+d.snapshotAt+' · sig '+d.signature.slice(0,32)+'…</p>';
  });
  </script>
</section>`;
}

function pageFrontier() {
  return `<section style="padding-top:140px;max-width:1280px">
  <span class="kicker">Frontier · 12 sovereign inventions</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Things the web <span class="grad">didn't have</span> until today.</h1>
  <div class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
    <div class="card"><span class="tag">F1</span><h3>Crypto Refund Guarantee</h3><p>Self-executing SLA. If breached, refund auto-issues.</p><a class="btn" href="/refund" data-link>Open</a></div>
    <div class="card"><span class="tag">F2</span><h3>Live Conversion Aura</h3><p>Real-time, signed, public KPI heartbeat.</p><a class="btn" href="/aura" data-link>Open</a></div>
    <div class="card"><span class="tag">F3</span><h3>Outcome-Anchored Pricing</h3><p>Signed before/after deltas → auto-bps invoice.</p><a class="btn" href="/api/outcome/list" target="_blank">JSON</a></div>
    <div class="card"><span class="tag">F4</span><h3>Self-Healing Checkout Cascade</h3><p>BTC → Lightning → Stripe → PayPal → Wire.</p><a class="btn" href="/checkout" data-link>Try</a></div>
    <div class="card"><span class="tag">F5</span><h3>Time-Locked Discount Vault</h3><p>VDF-anchored "wait N s, get X% off".</p></div>
    <div class="card"><span class="tag">F6</span><h3>Sovereign Receipt NFT</h3><p>Portable, dual-signed proof. Verifiable offline.</p></div>
    <div class="card"><span class="tag">F7</span><h3>Provable Email Delivery</h3><p>Signed manifest + Merkle inclusion proof.</p></div>
    <div class="card"><span class="tag">F8</span><h3>Gift-as-Capability</h3><p>Send a CBAT to anyone. No account needed.</p><a class="btn" href="/gift" data-link>Mint</a></div>
    <div class="card"><span class="tag">F9</span><h3>Anti-Dark-Pattern Pledge</h3><p>Public, signed, self-enforcing.</p><a class="btn" href="/pledge" data-link>Open</a></div>
    <div class="card"><span class="tag">F10</span><h3>Universal Cancel Link</h3><p>One URL cancels everything.</p><a class="btn" href="/cancel" data-link>Open</a></div>
    <div class="card"><span class="tag">F11</span><h3>Public Bandit Transparency</h3><p>You see every price experiment.</p><a class="btn" href="/transparency" data-link>Open</a></div>
    <div class="card"><span class="tag">F12</span><h3>Carbon-Inclusive Checkout</h3><p>Auto-attached signed gCO₂ + offset.</p></div>
  </div>
  <pre class="code" id="frOut" style="margin-top:22px;max-height:340px;overflow:auto">Loading…</pre>
  <script>fetch('/api/frontier/status').then(r=>r.json()).then(d=>{frOut.textContent=JSON.stringify(d,null,2)});</script>
</section>`;
}

function pageNotFound(route) {
  return `<section style="padding-top:160px;max-width:780px;text-align:center">
  <span class="kicker">404</span>
  <h1 style="font-size:clamp(48px,7vw,96px);margin:12px 0 18px"><span class="grad">Lost in the fabric.</span></h1>
  <p style="color:var(--ink-dim);font-size:17px">The route <code class="inline">${(route||'').replace(/[<>]/g,'')}</code> isn't here. Try one of these:</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:22px">
    <a class="btn btn-primary" href="/" data-link>Home</a>
    <a class="btn" href="/services" data-link>Marketplace</a>
    <a class="btn" href="/wizard" data-link>Find my plan</a>
    <a class="btn" href="/docs" data-link>API & docs</a>
    <a class="btn" href="/status" data-link>Status</a>
  </div>
</section>`;
}

function _policyPage(kicker, title, rows) {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">${kicker}</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">${title}</h1>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
    ${rows.map(([heading, body]) => `<div class="card"><span class="tag">${heading}</span><p style="color:var(--ink-dim);font-size:15px;line-height:1.7;margin:12px 0 0">${body}</p></div>`).join('')}
  </div>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:28px">Last updated: ${new Date().toISOString().slice(0,10)} · Owner: ${OWNER.name} · Contact: <a href="mailto:${OWNER.email}">${OWNER.email}</a></p>
</section>`;
}

function _legalSub(title, body) {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Legal</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">${title}</h1>
  <p style="color:var(--ink-dim);font-size:15.5px;line-height:1.8">${body}</p>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:30px">Last updated: ${new Date().toISOString().slice(0,10)} · Signed Ed25519 · See <a href="/legal" data-link>/legal</a> for the full property notice.</p>
</section>`;
}

function routeTitle(route) {
  if (route === '/') return 'Sovereign AI OS';
  if (route.startsWith('/services/')) return 'Service';
  const map = { '/services':'Marketplace', '/pricing':'Pricing', '/checkout':'Checkout', '/dashboard':'Dashboard', '/how':'How it works', '/docs':'API & Docs', '/about':'About', '/legal':'Legal', '/trust':'Trust Center', '/security':'Security', '/responsible-ai':'Responsible AI', '/dpa':'Data Processing Agreement', '/payment-terms':'Payment Terms', '/operator':'Operator Console', '/observability':'Observability', '/enterprise':'Enterprise Licenses', '/store':'Instant Store', '/account':'Account', '/innovations':'30Y Cryptographic Durability', '/wizard':'Find my plan', '/status':'Live status', '/changelog':'Changelog', '/terms':'Terms of Service', '/privacy':'Privacy Policy', '/refund':'Refund Guarantee', '/sla':'SLA', '/pledge':'Anti-Dark-Pattern Pledge', '/cancel':'Universal Cancel', '/gift':'Gift-as-Capability', '/aura':'Live Conversion Aura', '/api-explorer':'API Explorer', '/transparency':'Pricing Bandit Transparency', '/frontier':'Frontier Inventions' };
  return map[route] || 'ZeusAI';
}

function routeDescription(route) {
  const map = {
    '/': 'ZeusAI is a sovereign autonomous AI operating system with signed outcomes, BTC-native commerce and self-healing automation.',
    '/services': 'Browse ZeusAI services, frontier inventions and vertical AI operating systems with instant BTC checkout.',
    '/pricing': 'Transparent ZeusAI pricing with signed receipts, BTC checkout, refund guarantees and enterprise licensing.',
    '/checkout': 'Create a ZeusAI invoice, pay with BTC or supported rails, and receive signed delivery credentials instantly.',
    '/dashboard': 'Operator dashboard for ZeusAI receipts, services, revenue proof, system health and live commerce telemetry.',
    '/how': 'How ZeusAI routes quotes, invoices, receipts, AI modules and delivery through verifiable autonomous workflows.',
    '/docs': 'ZeusAI API documentation, OpenAPI endpoints, signed catalog, receipts and agent-to-agent commerce examples.',
    '/about': 'The story and ownership model behind ZeusAI, built as a sovereign AI OS by Vladoi Ionut.',
    '/legal': 'Legal terms, ownership, payments and usage rules for ZeusAI services and autonomous AI commerce.',
    '/trust': 'Public ZeusAI Trust Center with uptime, deploy SHA, integrity signature, BTC wallet proof, audit logs and security posture.',
    '/security': 'ZeusAI security posture covering CSP, secrets, payments, signed integrity, incident handling and QuantumIntegrityShield diagnostics.',
    '/responsible-ai': 'Responsible AI controls for ZeusAI: human sovereignty, no dark patterns, transparency, capability boundaries and rollback.',
    '/dpa': 'ZeusAI Data Processing Agreement with data categories, security measures, subprocessors, retention and transfer terms.',
    '/payment-terms': 'Payment terms for ZeusAI direct BTC checkout, settlement, refunds, taxes and optional future payment rails.',
    '/operator': 'Public-safe ZeusAI operator console for orders, payments, leads, AI readiness, errors, revenue and deploy health.',
    '/observability': 'ZeusAI observability page for SLOs, synthetic probes, status checks, payment monitoring and alert readiness.',
    '/enterprise': 'Enterprise licenses for AI automation, vertical operating systems, signed outcomes and custom deployment.',
    '/store': 'Instant ZeusAI store for buying autonomous AI services with BTC, signed receipts and delivery proof.',
    '/account': 'Manage your ZeusAI account, services, receipts, licenses and delivery credentials.',
    '/innovations': '30-year cryptographic durability, post-quantum readiness and frontier ZeusAI inventions.',
    '/wizard': 'Plan wizard that maps your business goal to the right ZeusAI service, price and delivery path.',
    '/status': 'Live ZeusAI status, uptime, build health and production service checks.',
    '/changelog': 'Latest ZeusAI product changes, frontier releases, security upgrades and commerce improvements.',
    '/terms': 'Terms of Service for ZeusAI, including capability tokens, signed outputs, SLA and refund references.',
    '/privacy': 'Privacy Policy for ZeusAI: minimal data, no resale, no model training on personal data and GDPR rights.',
    '/refund': 'Cryptographic refund guarantee for ZeusAI purchases when a signed service promise is breached.',
    '/sla': 'ZeusAI service-level agreement for uptime, delivery, support, refund windows and verification.',
    '/pledge': 'Anti-dark-pattern pledge: transparent pricing, cancellation, refund logic and user-owned receipts.',
    '/cancel': 'Universal cancellation page for ZeusAI subscriptions, services and autonomous order intents.',
    '/gift': 'Gift ZeusAI as a signed capability credential with redeemable delivery and verifiable ownership.',
    '/aura': 'Live conversion aura showing signed ZeusAI commerce, delivery and trust metrics in real time.',
    '/api-explorer': 'Explore ZeusAI OpenAPI, signed catalog, payment routes, receipts and agent commerce endpoints.',
    '/transparency': 'Public pricing bandit transparency for ZeusAI experiments, offers and conversion governance.',
    '/frontier': 'Frontier ZeusAI inventions: refund guarantee, live aura, self-healing checkout and verifiable receipts.'
  };
  return map[route] || 'ZeusAI sovereign AI operating system with verifiable commerce and autonomous delivery.';
}

function getHtml(route = '/', params = {}) {
  // Backward-compat: accept either getHtml(url) or getHtml(url, { lang, nonce })
  return head(routeTitle(route), route, params) + renderRoute(route, params) + footer(route, params);
}

module.exports = { getHtml, CSS, OWNER };
