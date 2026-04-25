// UNICORN V2 — SSR shell + per-route HTML fragments
// Original work, © Vladoi Ionut. Cinematic single-page portal synced with Unicorn backend.
'use strict';

const { CSS } = require('./styles');

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
  return `<!doctype html>
<html lang="${lang}" data-route="${route}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#05040a"/>
<title>${title} — ZEUSAI</title>
<meta name="description" content="ZeusAI — autonomous AI operating system. Cinematic, sovereign, self-evolving. Every outcome signed, every cent routed."/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:site_name" content="ZeusAI — Sovereign AI OS"/>
<meta property="og:title" content="${title} — ZeusAI"/>
<meta property="og:description" content="Autonomous SaaS operating system. 18 verticals, 41 marketplaces, cryptographic receipts."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title} — ZeusAI"/>
<meta name="twitter:description" content="Sovereign AI Operating System. Cryptographic receipts, BTC-native commerce."/>
<meta name="twitter:image" content="${ogImage}"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"/>
<link rel="stylesheet" href="/assets/app.css"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop offset='0' stop-color='%238a5cff'/%3E%3Cstop offset='0.5' stop-color='%233ea0ff'/%3E%3Cstop offset='1' stop-color='%23ffd36a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M32 4l8 14h14l-12 10 5 18-15-10-15 10 5-18L10 18h14z'/%3E%3C/svg%3E"/>
</head>
<body>
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
  return `<nav class="nav">
<div class="brand"><div class="brand-logo brand-logo-photo"><img src="/assets/zeus/brand.jpg" alt="Zeus" onerror="this.style.display='none'"/></div><div>ZeusAI<small>SOVEREIGN OS</small></div></div>
<div class="nav-links">
${L('/', 'Home')}${L('/services', 'Marketplace')}${L('/store', 'Instant Store')}${L('/enterprise', 'Enterprise')}${L('/pricing', 'Pricing')}${L('/how', 'How it works')}${L('/docs', 'API')}${L('/account', 'Account')}
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
      <div class="brand" style="margin-bottom:14px"><div class="brand-logo"></div><div>ZeusAI<small>SOVEREIGN OS</small></div></div>
      <p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6;max-width:360px">Autonomous AI operating system. Every module signed with W3C DID. Every outcome routed through Merkle-chained receipts. Property of ${OWNER.name}.</p>
    </div>
    <div><h5>Product</h5><ul>
      <li><a href="/services" data-link>Marketplace</a></li>
      <li><a href="/pricing" data-link>Pricing</a></li>
      <li><a href="/how" data-link>How it works</a></li>
      <li><a href="/dashboard" data-link>Dashboard</a></li>
    </ul></div>
    <div><h5>Developers</h5><ul>
      <li><a href="/docs" data-link>API &amp; Docs</a></li>
      <li><a href="/snapshot">/snapshot</a></li>
      <li><a href="/stream">/stream (SSE)</a></li>
      <li><a href="/health">/health</a></li>
    </ul></div>
    <div><h5>Company</h5><ul>
      <li><a href="/about" data-link>About</a></li>
      <li><a href="/legal" data-link>Legal</a></li>
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
// Service worker registration (offline-first)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js').catch(function(){});
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
<script src="/assets/aeon.js" defer></script>
<script src="/assets/app.js" defer></script>
</body></html>`;
}

function concierge() {
  return `<div class="concierge" id="concierge">
  <button class="concierge-btn" id="conciergeBtn" aria-label="Zeus Concierge">⚡</button>
  <div class="concierge-panel" id="conciergePanel" role="dialog" aria-label="Zeus AI Sales Agent">
    <div class="concierge-head"><span class="dot"></span> Zeus · <span style="color:var(--violet2);font-weight:700">30Y</span> AI<span class="meta" id="conciergeMeta">zeus-30y</span></div>
    <div class="concierge-body" id="conciergeBody" aria-live="polite">
      <div class="msg bot"><div class="msg-body">Salut! Sunt <b>Zeus-30Y</b> — standardul AI sales pentru următorii 30 de ani. Streaming, voce, memorie, recomandări live, checkout BTC/PayPal și activare instant.\n\nHi! I'm <b>Zeus-30Y</b> — the 30-year AI sales standard. Streaming, voice, memory, live recs, BTC/PayPal checkout, instant activation.</div></div>
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
    <div class="panel pillar" data-pillar="outcome" tabindex="0" role="button" aria-label="Open Outcome Economics live view"><div class="ic">💎</div><h4>Outcome Economics</h4><p>Value‑Proof Ledger meters delivered value in $. Auto‑invoices a share. Owner keeps sovereignty on BTC + PayPal.</p><span class="pillar-cta">Record outcome →</span></div>
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
    <div><span class="kicker">Marketplace</span><h2>Every ZeusAI service, <span class="grad">one sovereign storefront.</span></h2></div>
    <p>All services below are synced live from the ZeusAI backend. Buy with BTC or PayPal — activation is automatic and cryptographically receipted.</p>
  </div>
  <div class="card" style="margin:16px 0 22px;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(127,90,240,.10));border:1px solid rgba(247,147,26,.45)">
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between">
      <div style="flex:1;min-width:280px">
        <span class="kicker">₿ Native Bitcoin commerce</span>
        <h3 style="margin:8px 0;font-size:22px">Pay any service direct in BTC. No middleman. Instant signed receipt.</h3>
        <p style="color:var(--ink-dim);margin:0;font-size:14px">Owner wallet routes 100% of revenue. Each invoice generates an Ed25519 receipt + on-chain proof.</p>
        <div class="btc-addr" id="svcHeroBtcAddr" data-copy="${CFG.btc}" title="Click to copy">${CFG.btc}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:180px">
        <a class="btn btn-primary" href="/checkout?plan=custom&amount=99" data-link>Quick BTC checkout →</a>
        <a class="btn" href="/api/commerce/health" target="_blank" rel="noopener" style="font-size:12px">Verify commerce engine</a>
      </div>
    </div>
  </div>
  <div class="filters" id="svcFilters"></div>
  <div class="grid" id="servicesGrid"><div class="card"><p>Loading…</p></div></div>
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
        <li>BTC & PayPal checkout</li>
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
    <div><span class="kicker">Checkout</span><h2>Pay in BTC or PayPal. <span class="grad">Activation is automatic.</span></h2></div>
    <p>Every payment generates an Ed25519‑signed receipt appended to the Merkle chain. No middlemen, no custody.</p>
  </div>
  <div class="checkout">
    <div class="co-box">
      <div class="co-method">
        <button class="chip on" data-method="btc">₿ Bitcoin</button>
        <button class="chip" data-method="paypal">PayPal</button>
      </div>
      <div id="coPanelBtc">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
          <div>
            <div class="field"><label>Amount (USD)</label><input id="coAmount" type="number" min="1" step="1" value="49"/></div>
            <div class="field"><label>Plan / product</label><input id="coPlan" value="starter"/></div>
            <div class="field"><label>Email for activation</label><input id="coEmail" type="email" placeholder="you@company.com"/></div>
            <div class="field"><label>BTC quote</label><input id="coBtc" readonly value="computing…"/></div>
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
        <div class="field"><label>Amount (USD)</label><input id="coAmountPP" type="number" min="1" step="1" value="49"/></div>
        <div class="field"><label>Plan / product</label><input id="coPlanPP" value="starter"/></div>
        <div class="field"><label>Email for activation</label><input id="coEmailPP" type="email" placeholder="you@company.com"/></div>
        <button class="btn btn-primary" id="coPayPP" style="width:100%;justify-content:center;margin-bottom:8px">Start PayPal payment →</button>
        <a class="btn btn-gold" id="coPaypal" style="width:100%;justify-content:center" target="_blank" rel="noopener">Or tip via paypal.me</a>
        <p style="color:var(--ink-dim);font-size:13px;margin-top:14px">Start PayPal payment uses the real PayPal Orders API when credentials are configured, otherwise falls back to paypal.me. The server auto‑captures the order and issues a signed license token.</p>
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
    case '/enterprise': return pageEnterprise();
    case '/store': return pageStore();
    case '/account': return pageAccount();
    case '/admin/services': return pageAdminServices();
    case '/admin': return pageAdminLogin();
    case '/admin/login': return pageAdminLogin();
    default:
      if (route.startsWith('/services/')) return pageService(params.id || route.slice(10));
      return pageHome();
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

function routeTitle(route) {
  if (route === '/') return 'Sovereign AI OS';
  if (route.startsWith('/services/')) return 'Service';
  const map = { '/services':'Marketplace', '/pricing':'Pricing', '/checkout':'Checkout', '/dashboard':'Dashboard', '/how':'How it works', '/docs':'API & Docs', '/about':'About', '/legal':'Legal', '/enterprise':'Enterprise Licenses', '/store':'Instant Store', '/account':'Account' };
  return map[route] || 'ZeusAI';
}

function getHtml(route = '/', params = {}) {
  // Backward-compat: accept either getHtml(url) or getHtml(url, { lang, nonce })
  return head(routeTitle(route), route, params) + renderRoute(route, params) + footer(route, params);
}

module.exports = { getHtml, CSS, OWNER };
