// UNICORN V2 — client app (original, © Vladoi Ionut)
// Three.js Zeus (procedural) + Tourbillon 3D + SPA router + SSE sync + AI concierge
(function(){
'use strict';

function installResilientFetch(){
  if (window.__zeusResilientFetchInstalled || !window.fetch) return;
  window.__zeusResilientFetchInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  const cachePrefix = 'zeus_last_good_response:';
  const methodOf = (input, init) => String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  const urlOf = (input) => { try { return new URL((typeof input === 'string' ? input : input.url), location.origin).href; } catch (_) { return String(input || ''); } };
  const sameSite = (url) => { try { return new URL(url, location.origin).origin === location.origin; } catch (_) { return false; } };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const keyOf = (method, url) => cachePrefix + method + ':' + url;
  function clearLoading(){ try { if (typeof clearStaleLoadingPlaceholders === 'function') clearStaleLoadingPlaceholders(); } catch (_) {} }
  function remember(method, url, response){
    if (method !== 'GET' || !sameSite(url) || !response || !response.ok) return;
    try {
      response.clone().text().then((body) => {
        if (!body || body.length > 250000) return;
        const type = response.headers && response.headers.get ? (response.headers.get('content-type') || 'application/json') : 'application/json';
        localStorage.setItem(keyOf(method, url), JSON.stringify({ body, type, status: response.status, ts: Date.now() }));
      }).catch(() => {});
    } catch (_) {}
  }
  function cached(method, url){
    if (method !== 'GET' || !sameSite(url)) return null;
    try {
      const raw = localStorage.getItem(keyOf(method, url));
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || typeof item.body !== 'string') return null;
      document.documentElement.setAttribute('data-zeus-api-fallback', '1');
      clearLoading();
      return new Response(item.body, { status: 200, statusText: 'OK (cached)', headers: { 'Content-Type': item.type || 'application/json', 'X-Zeus-Cache-Fallback': '1', 'X-Zeus-Cache-Ts': String(item.ts || '') } });
    } catch (_) { return null; }
  }
  window.fetch = async function zeusResilientFetch(input, init){
    const method = methodOf(input, init);
    const url = urlOf(input);
    let lastError = null;
    let lastResponse = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await nativeFetch(input, init);
        if (response.ok) { remember(method, url, response); return response; }
        lastResponse = response;
        if (response.status < 500) return response;
      } catch (err) {
        lastError = err;
        if (init && init.signal && init.signal.aborted) break;
      }
      if (attempt < 3) await wait(250 * attempt);
    }
    const fallback = cached(method, url);
    if (fallback) return fallback;
    clearLoading();
    if (lastResponse) return lastResponse;
    throw lastError || new Error('Network error');
  };
}
installResilientFetch();

const THREE = window.THREE;
const STATE = { route: location.pathname, snapshot: null, services: [], pricingArms: {}, paymentMethods: [{ id:'crypto_btc', active:true }] };
const cfg = window.__UNICORN__ || {};

// ================= UTIL =================
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
function toast(msg, kind='ok'){
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .4s,transform .4s'; t.style.opacity='0'; t.style.transform='translateX(40px)'; setTimeout(()=>t.remove(),400); }, 3800);
}
async function api(path, opts){
  try {
    const r = await fetch(path, Object.assign({ headers: { 'Content-Type':'application/json' } }, opts || {}));
    const j = await r.json().catch(()=> ({}));
    if (!r.ok) throw new Error(j.error || r.status);
    return j;
  } catch (e) { console.warn('api', path, e.message); return null; }
}
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function domSafeId(s){ return String(s==null?'':s).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120); }
function normalizeLivePricing(serviceId, payload){
  const p = payload || {};
  const usd = Number(
    p.price_usd != null ? p.price_usd
      : (p.priceUsd != null ? p.priceUsd
      : (p.finalPrice != null ? p.finalPrice
      : (p.pricing && p.pricing.usd != null ? p.pricing.usd : 99)))
  );
  const btcRaw = p.price_btc != null ? p.price_btc : (p.btcEquivalent != null ? p.btcEquivalent : (p.pricing && p.pricing.btc != null ? p.pricing.btc : null));
  return {
    serviceId: String(p.serviceId || p.moduleId || serviceId || 'unknown-service'),
    price_usd: Number.isFinite(usd) ? usd : 99,
    price_btc: btcRaw == null ? null : Number(btcRaw),
    currency: String(p.currency || (p.pricing && p.pricing.currency) || 'USD'),
    interval: String(p.interval || 'month'),
    negotiated: Boolean(p.negotiated || (p.segment && p.segment.negotiable)),
    timestamp: String(p.timestamp || p.updatedAt || new Date().toISOString()),
  };
}
async function fetchLivePricing(serviceId, opts){
  const options = opts || {};
  const sid = String(serviceId || '').trim();
  if (!sid) return normalizeLivePricing('unknown-service', { price_usd: 99, currency: 'USD', interval: 'month', negotiated: false });
  const qp = new URLSearchParams();
  if (options.userId) qp.set('userId', String(options.userId));
  if (options.coupon) qp.set('coupon', String(options.coupon));
  const url = '/api/pricing/' + encodeURIComponent(sid) + (qp.toString() ? ('?' + qp.toString()) : '');
  let slowTimer = null;
  try {
    if (typeof options.onSlow === 'function') {
      slowTimer = setTimeout(function(){ try { options.onSlow(); } catch(_){} }, 2000);
    }
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (slowTimer) clearTimeout(slowTimer);
    const j = await r.json().catch(function(){ return null; });
    if (!r.ok) throw new Error((j && (j.error || j.message)) || ('HTTP ' + r.status));
    return normalizeLivePricing(sid, j);
  } catch (e) {
    if (slowTimer) clearTimeout(slowTimer);
    console.warn('[live-pricing]', sid, e && e.message ? e.message : e);
    return normalizeLivePricing(sid, { serviceId: sid, price_usd: 99, price_btc: null, currency: 'USD', interval: 'month', negotiated: /enterprise|global|giants|tier/i.test(sid) });
  }
}

function paymentLabels(){
  const ids = (STATE.paymentMethods || []).filter(m => m && m.active !== false).map(m => m.id || m.provider || '');
  const labels = ['BTC direct'];
  if (ids.includes('card') || ids.includes('stripe')) labels.push('Card/Stripe');
  if (ids.includes('paypal')) labels.push('PayPal');
  if (ids.includes('nowpayments')) labels.push('global crypto');
  return labels;
}

async function hydratePaymentRails(){
  try {
    const payload = await api('/api/payment/methods');
    const methods = payload && Array.isArray(payload.methods) ? payload.methods.filter(m => m && m.active !== false) : [];
    STATE.paymentMethods = methods.length ? methods : [{ id:'crypto_btc', active:true }];
  } catch (_) {
    STATE.paymentMethods = [{ id:'crypto_btc', active:true }];
  }
  const labels = paymentLabels();
  const copy = 'Live payment rails: ' + labels.join(' · ') + '. Optional external providers appear only when configured.';
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText('commerceProofPaymentCopy', copy);
  setText('pricingPaymentRail', labels.join(' · ') + ' · automatic activation');
  setText('checkoutPaymentRailCopy', copy + ' BTC quote and owner wallet are always shown before payment.');
  setText('paypalRailCopy', labels.includes('PayPal') ? 'PayPal is configured live and available for eligible orders.' : 'PayPal is hidden/parked until runtime credentials are configured; BTC direct remains live.');
  const paypalPanel = document.getElementById('coPanelPaypal');
  const paypalChip = document.querySelector('.co-method .chip[data-method="paypal"]');
  const paypalActive = labels.includes('PayPal');
  if (paypalPanel && !paypalActive) paypalPanel.style.display = 'none';
  if (paypalChip && !paypalActive) paypalChip.style.display = 'none';
}

function clearStaleLoadingPlaceholders(){
  const nodes = Array.from(document.querySelectorAll('p, h3, pre, div, span, td'));
  nodes.forEach((el) => {
    const t = (el.textContent || '').trim();
    if (!t) return;
    const isLoading = /^Loading(\.{3}|…)?$/i.test(t) || /^Loading\s+.+/i.test(t);
    if (!isLoading) return;
    if (el.dataset.loadingResolved === '1') return;
    el.dataset.loadingResolved = '1';
    el.textContent = 'Data unavailable temporarily. Refreshing...';
    el.style.color = 'var(--ink-dim)';
  });
}

function runAppInlineScripts(root){
  if (!root) return;
  const scripts = Array.from(root.querySelectorAll('script'));
  if (!scripts.length) return;
  const nonceSource = document.querySelector('script[nonce]');
  const defaultNonce = nonceSource ? nonceSource.getAttribute('nonce') : '';
  scripts.forEach((oldScript) => {
    const s = document.createElement('script');
    for (const attr of Array.from(oldScript.attributes || [])) {
      s.setAttribute(attr.name, attr.value);
    }
    if (!s.getAttribute('nonce') && defaultNonce) s.setAttribute('nonce', defaultNonce);
    s.textContent = oldScript.textContent || '';
    oldScript.parentNode && oldScript.parentNode.replaceChild(s, oldScript);
  });
}

// ================= SSE =================
// Resilient EventSource: exponential backoff (1s→30s) + jitter + heartbeat watchdog (45s).
// Server emits keepalive every 15s; if we go silent >45s we force-reconnect.
function resilientES(url, handlers, opts){
  opts = opts || {};
  const maxDelay = opts.maxDelay || 30000;
  const heartbeatMs = opts.heartbeatMs || 45000;
  let attempt = 0, src = null, lastBeat = Date.now(), watchdog = null, closed = false;
  function backoff(){
    const base = Math.min(maxDelay, 1000 * Math.pow(2, attempt));
    return Math.round(base/2 + Math.random()*base/2); // 50%-100% of base
  }
  function startWatchdog(){
    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(function(){
      if (closed) return;
      if (Date.now() - lastBeat > heartbeatMs) {
        try { src && src.close(); } catch(_) {}
        connect();
      }
    }, 5000);
  }
  function connect(){
    if (closed) return;
    try {
      src = new EventSource(url);
      src.onopen = function(){
        attempt = 0; lastBeat = Date.now();
        if (handlers.onopen) try { handlers.onopen(); } catch(_) {}
      };
      src.onmessage = function(ev){
        lastBeat = Date.now();
        if (handlers.onmessage) try { handlers.onmessage(ev); } catch(_) {}
      };
      src.onerror = function(ev){
        if (handlers.onerror) try { handlers.onerror(ev); } catch(_) {}
        try { src.close(); } catch(_) {}
        if (closed) return;
        attempt = Math.min(attempt + 1, 10);
        setTimeout(connect, backoff());
      };
    } catch(e){
      attempt = Math.min(attempt + 1, 10);
      setTimeout(connect, backoff());
    }
  }
  connect();
  startWatchdog();
  return {
    close: function(){ closed = true; try { src && src.close(); } catch(_) {} if (watchdog) clearInterval(watchdog); },
    get raw(){ return src; }
  };
}

let es = null;
let esPath = '/api/unicorn/events';
let esFallbackTried = false;
function openStream(){
  try { if (es) es.close(); } catch(_) {}
  function onMsg(ev){
    try {
      const payload = JSON.parse(ev.data);
      // Live reactivity: services.changed → reload marketplace grid instantly (<1s)
      if (payload && payload.type === 'services.changed') {
        try {
          if (STATE.route === '/' || STATE.route === '/services' || (STATE.route && STATE.route.indexOf('/services') === 0)) {
            setTimeout(function(){ try { hydratePage(STATE.route); } catch(_){} }, 150);
          }
        } catch(_){}
        return;
      }
      // Phase C: real-time payment + activation reactivity
      if (payload && payload.type === 'payment.confirmed') {
        try { toast('✅ Payment confirmed (' + (payload.method||'BTC') + ')', 'ok'); } catch(_){}
        return;
      }
      if (payload && payload.type === 'service.activated') {
        const ids = Array.isArray(payload.serviceIds) ? payload.serviceIds.join(', ') : '';
        try { toast('🚀 Service activated: ' + ids, 'ok'); } catch(_){}
        try {
          if (STATE.route && STATE.route.indexOf('/account') === 0 && typeof hydrateAccount === 'function') {
            setTimeout(function(){ try { hydrateAccount(); } catch(_){} }, 200);
          }
          window.dispatchEvent(new CustomEvent('unicorn:service-activated', { detail: payload }));
        } catch(_){}
        return;
      }
      const snap = payload && payload.snapshot ? payload.snapshot : payload;
      STATE.snapshot = snap;
      applySnapshot(STATE.snapshot);
    } catch(_){}
  }
  function onErr(){
    if (!esFallbackTried && esPath !== '/stream') {
      esFallbackTried = true;
      try { es && es.close(); } catch(_) {}
      esPath = '/stream';
      setTimeout(openStream, 250);
    }
    /* otherwise resilientES handles backoff+jitter+watchdog automatically */
  }
  try {
    es = resilientES(esPath, { onmessage: onMsg, onerror: onErr });
  } catch(_){}
}

function getSnapshotCounts(s) {
  const snapshot = s || {};
  const moduleCount = Number(
    snapshot.telemetry && snapshot.telemetry.moduleCount != null
      ? snapshot.telemetry.moduleCount
      : (Array.isArray(snapshot.modules) ? snapshot.modules.length : 0)
  );
  const verticalCount = Number(
    snapshot.telemetry && snapshot.telemetry.verticalCount != null
      ? snapshot.telemetry.verticalCount
      : (Array.isArray(snapshot.industries) ? snapshot.industries.length : 0)
  );
  const marketCount = Number(
    snapshot.telemetry && snapshot.telemetry.marketplaceCount != null
      ? snapshot.telemetry.marketplaceCount
      : (Array.isArray(snapshot.marketplace) ? snapshot.marketplace.length : 0)
  );
  return {
    moduleCount: Number.isFinite(moduleCount) && moduleCount > 0 ? moduleCount : null,
    verticalCount: Number.isFinite(verticalCount) && verticalCount > 0 ? verticalCount : null,
    marketCount: Number.isFinite(marketCount) && marketCount > 0 ? marketCount : null
  };
}

function applySnapshot(s){
  if (!s) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && v!=null) el.textContent = v; };
  const counts = getSnapshotCounts(s);
  set('statModules', counts.moduleCount);
  set('statVerticals', counts.verticalCount);
  set('statMarkets', counts.marketCount);
  set('leadModules', counts.moduleCount != null ? (counts.moduleCount + ' live modules') : null);
  set('leadVerticals', counts.verticalCount != null ? (counts.verticalCount + ' active vertical industries') : null);
  set('leadMarkets', counts.marketCount != null ? (counts.marketCount + ' connected marketplaces') : null);
  if (s.autonomy && s.autonomy.chain) set('statChain', s.autonomy.chain.length || '—');
}

// ================= ROUTER =================
function routePath(value){
  try { return new URL(String(value || '/'), location.origin).pathname.replace(/\/$/, '') || '/'; } catch (_) { return String(value || '/').split('?')[0].replace(/\/$/, '') || '/'; }
}
function navigate(to, push=true){
  if (push) history.pushState({}, '', to);
  STATE.route = routePath(to);
  hydratePage(STATE.route);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
  e.preventDefault();
  // Ask server for new page (SSR for integrity), swap #app
  fetch(href, { headers: { 'x-unicorn-partial':'1' } }).then(r=>{
    if (!r.ok) throw new Error('route_fetch_failed_' + r.status);
    return r.text();
  }).then(html=>{
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newApp = doc.querySelector('#app');
    if (!newApp) {
      location.href = href;
      return;
    }
    const swap = () => {
      $('#app').innerHTML = newApp.innerHTML;
      runAppInlineScripts($('#app'));
      $$('.nav-links a').forEach(x=>x.classList.toggle('active', x.getAttribute('href')===href));
      history.pushState({}, '', href);
      STATE.route = routePath(href);
      window.scrollTo(0,0);
      hydratePage(STATE.route);
    };
    if (window.__UNICORN_VT_WRAP__) window.__UNICORN_VT_WRAP__(swap); else swap();
  }).catch(()=>{ location.href = href; });
});
window.addEventListener('popstate', () => { STATE.route = location.pathname; hydratePage(STATE.route); location.reload(); });

// ================= GALAXY 3D =================
let zeusCtx = null;
function initZeus(){
  const host = document.getElementById('zeusCanvas');
  if (!host || !THREE) return;
  if (zeusCtx) { zeusCtx.dispose(); zeusCtx = null; }
  const w = host.clientWidth, h = host.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04030a, 0.015);
  const camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 2000);
          const serviceId = ($('#svcId') || {}).value || 'starter';
          const email = ($('#svcEmail') || {}).value || '';

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.innerHTML = '';
  host.appendChild(renderer.domElement);

  function makeStarTex(){
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64,64,0,64,64,64);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25,'rgba(255,240,220,.85)');
    grad.addColorStop(0.55,'rgba(200,170,255,.22)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0,0,128,128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace || undefined;
    return t;
  }
  const starTex = makeStarTex();

  const STAR_COUNT = 18000;
  const ARMS = 4;
  const ARM_TIGHTNESS = 0.35;
  const ARM_SPREAD = 0.55;
  const RADIUS_MAX = 70;
  const BULGE = 12;

  const positions = new Float32Array(STAR_COUNT*3);
  const colors    = new Float32Array(STAR_COUNT*3);
  const sizes     = new Float32Array(STAR_COUNT);

  const cCore = new THREE.Color(0xffd9a8);
  const cMid  = new THREE.Color(0xc9a8ff);
  const cEdge = new THREE.Color(0x6fd3ff);
  const cHot  = new THREE.Color(0xffffff);

  for (let i=0;i<STAR_COUNT;i++){
    const u = Math.random();
    let r;
    if (i < STAR_COUNT*0.22) { r = Math.pow(Math.random(), 2.2) * BULGE; }
    else                     { r = Math.pow(u, 0.9) * RADIUS_MAX; }
    const arm = i % ARMS;
    const baseAngle = (arm / ARMS) * Math.PI * 2;
    const theta = baseAngle + Math.log(r+1) / ARM_TIGHTNESS + (Math.random()-0.5)*ARM_SPREAD;
    const thick = (r < BULGE) ? (4 - r*0.25) : Math.max(0.4, 2.2 - r*0.03);
    const yJitter = (Math.random()-0.5) * thick + (Math.random()-0.5)*0.3;
    const scatter = (Math.random()-0.5) * (r*0.08 + 1.6);
    const x = Math.cos(theta)*r + Math.cos(theta+Math.PI/2)*scatter;
    const z = Math.sin(theta)*r + Math.sin(theta+Math.PI/2)*scatter;
    positions[i*3]   = x;
    positions[i*3+1] = yJitter;
    positions[i*3+2] = z;
    const tt = Math.min(1, r / RADIUS_MAX);
    const col = new THREE.Color();
    if (tt < 0.3)       col.copy(cCore).lerp(cMid, tt/0.3);
    else if (tt < 0.75) col.copy(cMid).lerp(cEdge, (tt-0.3)/0.45);
    else                col.copy(cEdge).lerp(cHot, (tt-0.75)/0.25);
    if (Math.random() < 0.015) col.copy(cHot);
    col.offsetHSL(0, 0, (Math.random()-0.5)*0.1);
    colors[i*3]   = col.r;
    colors[i*3+1] = col.g;
    colors[i*3+2] = col.b;
    sizes[i] = (r < BULGE ? 1.2 : 0.55) + Math.random()*0.7;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  const vs = [
    'attribute float aSize;',
    'varying vec3 vCol;',
    'uniform float uTime;',
    'uniform float uPxR;',
    'void main(){',
    '  vCol = color;',
    '  float r = length(position.xz);',
    '  float speed = 0.06 / max(r*0.03, 0.4);',
    '  float ang = uTime * speed;',
    '  float cs = cos(ang), sn = sin(ang);',
    '  vec3 p = position;',
    '  p.x = position.x*cs - position.z*sn;',
    '  p.z = position.x*sn + position.z*cs;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = aSize * 34.0 * uPxR / max(-mv.z, 1.0);',
    '}'
  ].join('\n');

  const fs = [
    'varying vec3 vCol;',
    'uniform sampler2D uMap;',
    'void main(){',
    '  vec4 tx = texture2D(uMap, gl_PointCoord);',
    '  if (tx.a < 0.02) discard;',
    '  gl_FragColor = vec4(vCol * tx.rgb * 1.6, tx.a);',
    '}'
  ].join('\n');

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: starTex }, uPxR: { value: renderer.getPixelRatio() } },
    vertexShader: vs,
    fragmentShader: fs,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const galaxy = new THREE.Points(geo, mat);
  scene.add(galaxy);

  const dustTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128,128,60,128,128,128);
    grad.addColorStop(0,'rgba(10,6,20,0.55)');
    grad.addColorStop(0.6,'rgba(10,6,20,0.18)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0,0,256,256);
    return new THREE.CanvasTexture(c);
  })();
  for (let i=0;i<5;i++){
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshBasicMaterial({ map: dustTex, transparent:true, opacity:0.25, depthWrite:false })
    );
    m.rotation.x = -Math.PI/2;
    m.rotation.z = Math.random()*Math.PI*2;
    m.position.y = (Math.random()-0.5)*0.6;
    scene.add(m);
  }

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ map: starTex, color: 0xffd3a0, transparent:true, opacity:0.55, depthWrite:false, blending: THREE.AdditiveBlending })
  );
  scene.add(glow);

  const bgCount = 2500;
  const bgGeo = new THREE.BufferGeometry();
  const bgPos = new Float32Array(bgCount*3);
  for (let i=0;i<bgCount;i++){
    const r = 300 + Math.random()*500;
    const th = Math.random()*Math.PI*2;
    const ph = Math.acos(2*Math.random()-1);
    bgPos[i*3]   = r*Math.sin(ph)*Math.cos(th);
    bgPos[i*3+1] = r*Math.cos(ph);
    bgPos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  const bgMat2 = new THREE.PointsMaterial({ size: 1.4, color: 0xcfd8ff, sizeAttenuation:false, transparent:true, opacity:0.55, map: starTex, depthWrite:false });
  const bgStars = new THREE.Points(bgGeo, bgMat2);
  scene.add(bgStars);

  let mx=0, my=0, scrollY=0;
  const onMouse  = e => { mx = (e.clientX/window.innerWidth - 0.5); my = (e.clientY/window.innerHeight - 0.5); };
  const onScroll = () => { scrollY = window.scrollY; };
  window.addEventListener('mousemove', onMouse, { passive:true });
  window.addEventListener('scroll', onScroll, { passive:true });

  const t0 = performance.now();
  const reduced = window.__UNICORN_REDUCED__ === true;
  let raf = 0;

  function loop(now){
    const t = (now - t0) / 1000;
    mat.uniforms.uTime.value = t;
    galaxy.rotation.z = Math.sin(t*0.05)*0.03;
    glow.lookAt(camera.position);
    glow.material.opacity = 0.48 + Math.sin(t*0.6)*0.08;
    const targetX = Math.sin(t*0.05)*8 + mx*18;
    const targetY = 38 + my*8 - scrollY*0.03;
    const targetZ = 90 + Math.cos(t*0.05)*6;
    camera.position.x += (targetX - camera.position.x)*0.03;
    camera.position.y += (targetY - camera.position.y)*0.04;
    camera.position.z += (targetZ - camera.position.z)*0.03;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (!reduced) raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  const onResize = () => {
    const W = host.clientWidth, H = host.clientHeight;
    renderer.setSize(W, H);
    camera.aspect = W/H;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  zeusCtx = {
    dispose(){
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose(); } });
      host.innerHTML = '';
    }
  };
}

// ================= TOURBILLON =================
let tbCtx = null;
function initTourbillon(){
  const photo = document.getElementById('tourbillonPhoto');
  if (photo) {
    if (tbCtx) { tbCtx.dispose(); tbCtx = null; }
    const wrap = document.getElementById('watchShowcase') || photo.parentElement;
    const labelEl = document.getElementById('tourbillonTime');
    const tick = function(){
      const d = new Date();
      if (labelEl) labelEl.textContent = d.toTimeString().slice(0,8) + '  ·  gear sync';
    };
    tick();
    const timer = setInterval(tick, 1000);
    const onMove = function(e){
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) - 0.5;
      const y = ((e.clientY - r.top) / r.height) - 0.5;
      wrap.style.setProperty('--watch-rx', ((-y) * 8).toFixed(2) + 'deg');
      wrap.style.setProperty('--watch-ry', (x * 10).toFixed(2) + 'deg');
    };
    const onLeave = function(){
      if (!wrap) return;
      wrap.style.setProperty('--watch-rx', '0deg');
      wrap.style.setProperty('--watch-ry', '0deg');
    };
    if (wrap) {
      wrap.addEventListener('mousemove', onMove, { passive:true });
      wrap.addEventListener('mouseleave', onLeave, { passive:true });
    }
    tbCtx = {
      dispose(){
        clearInterval(timer);
        if (wrap) {
          wrap.removeEventListener('mousemove', onMove);
          wrap.removeEventListener('mouseleave', onLeave);
        }
      }
    };
    return;
  }
  const canvas = document.getElementById('tourbillon');
  if (!canvas || !THREE) return;
  if (tbCtx) { tbCtx.dispose(); tbCtx = null; }
  const parent = canvas.parentElement;
  const size = parent.clientWidth;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 2.1, 4.6);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // lighting
  scene.add(new THREE.AmbientLight(0x2a2448, 0.6));
  const l1 = new THREE.PointLight(0xffffff, 3.2, 15); l1.position.set(3, 4, 3); scene.add(l1);
  const l2 = new THREE.PointLight(0x8a5cff, 2.2, 12); l2.position.set(-3, 2, 2); scene.add(l2);
  const l3 = new THREE.PointLight(0x3ea0ff, 1.6, 10); l3.position.set(0, -3, 2); scene.add(l3);

  // materials
  const matPlate = new THREE.MeshStandardMaterial({ color: 0x252234, metalness: 0.85, roughness: 0.35 });
  const matBridge = new THREE.MeshStandardMaterial({ color: 0x2a2438, metalness: 0.9, roughness: 0.28 });
  const matGear = new THREE.MeshStandardMaterial({ color: 0xbfb7c8, metalness: 0.95, roughness: 0.25 });
  const matGearGold = new THREE.MeshStandardMaterial({ color: 0xd9b464, metalness: 0.95, roughness: 0.22 });
  const matBlue = new THREE.MeshStandardMaterial({ color: 0x3a78d8, metalness: 0.9, roughness: 0.18, emissive: 0x1a3a7a, emissiveIntensity: 0.25 });
  const matJewel = new THREE.MeshStandardMaterial({ color: 0xff4466, emissive: 0x880022, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1 });
  const matScrew = new THREE.MeshStandardMaterial({ color: 0x4a78d0, metalness: 0.95, roughness: 0.15 });

  // main plate
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.14, 72, 1), matPlate);
  plate.position.y = -0.09;
  scene.add(plate);
  // perlage dots (decorative)
  for (let i=0;i<40;i++){
    const a = Math.random()*Math.PI*2, r = 0.7 + Math.random()*1.3;
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color:0x3a344d, metalness:0.7, roughness:0.5 }));
    dot.position.set(Math.cos(a)*r, -0.015, Math.sin(a)*r);
    scene.add(dot);
  }

  // Helper: gear with N teeth
  function makeGear(radius, teeth, thickness, mat){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, Math.max(24, teeth*2)), mat);
    g.add(body);
    // teeth
    const toothGeo = new THREE.BoxGeometry(radius*0.18, thickness*1.05, radius*0.14);
    for (let i=0;i<teeth;i++){
      const a = (i/teeth) * Math.PI*2;
      const t = new THREE.Mesh(toothGeo, mat);
      t.position.set(Math.cos(a)*(radius+radius*0.07), 0, Math.sin(a)*(radius+radius*0.07));
      t.rotation.y = -a;
      g.add(t);
    }
    // center hole cap
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius*0.18, radius*0.18, thickness*1.3, 18), new THREE.MeshStandardMaterial({ color:0x1a1828, metalness:0.9, roughness:0.3 }));
    g.add(hub);
    // cutouts (spokes effect via darker wedges)
    for (let i=0;i<5;i++){
      const a = (i/5)*Math.PI*2;
      const slot = new THREE.Mesh(new THREE.BoxGeometry(radius*0.55, thickness*1.1, radius*0.14), new THREE.MeshStandardMaterial({ color:0x0f0d1a }));
      slot.position.set(Math.cos(a)*radius*0.45, 0, Math.sin(a)*radius*0.45);
      slot.rotation.y = -a;
      g.add(slot);
    }
    return g;
  }

  // Mainspring barrel (top-left)
  const barrel = makeGear(0.62, 60, 0.08, matGear);
  barrel.position.set(-1.1, 0.06, -0.9);
  scene.add(barrel);
  // Center wheel
  const centerWheel = makeGear(0.55, 54, 0.08, matGear);
  centerWheel.position.set(-0.15, 0.06, -0.45);
  scene.add(centerWheel);
  // Third wheel
  const thirdWheel = makeGear(0.45, 48, 0.08, matGear);
  thirdWheel.position.set(0.9, 0.06, -0.7);
  scene.add(thirdWheel);
  // Fourth wheel
  const fourthWheel = makeGear(0.38, 42, 0.08, matGear);
  fourthWheel.position.set(1.1, 0.06, 0.1);
  scene.add(fourthWheel);

  // Tourbillon cage (right-bottom)
  const cageGroup = new THREE.Group();
  cageGroup.position.set(0.55, 0.2, 0.9);
  scene.add(cageGroup);
  // gold carriage ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 16, 64), matGearGold);
  ring.rotation.x = Math.PI/2; ring.position.y = 0.18;
  cageGroup.add(ring);
  // blue spokes (three bridges)
  for (let i=0;i<3;i++){
    const a = (i/3)*Math.PI*2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.09), matBlue);
    spoke.position.y = 0.18;
    spoke.rotation.y = a;
    cageGroup.add(spoke);
  }
  // escape wheel (inside cage, bottom)
  const escape = makeGear(0.22, 15, 0.05, matGearGold);
  escape.position.y = 0.06;
  cageGroup.add(escape);
  // balance wheel (on top of cage)
  const balance = new THREE.Group();
  balance.position.y = 0.36;
  cageGroup.add(balance);
  const balRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 14, 64), matBlue);
  balRim.rotation.x = Math.PI/2;
  balance.add(balRim);
  const balBar = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.06), matBlue);
  balance.add(balBar);
  const balBar2 = balBar.clone(); balBar2.rotation.y = Math.PI/2; balance.add(balBar2);
  // hairspring (flat spiral)
  const hairPts = [];
  for (let i=0;i<180;i++){
    const a = i*0.12;
    const r = 0.06 + i*0.0019;
    hairPts.push(new THREE.Vector3(Math.cos(a)*r, 0.01, Math.sin(a)*r));
  }
  const hairGeo = new THREE.BufferGeometry().setFromPoints(hairPts);
  const hair = new THREE.Line(hairGeo, new THREE.LineBasicMaterial({ color:0xe8d9ff, transparent:true, opacity:0.95 }));
  balance.add(hair);

  // Pallet fork — a blue Y that oscillates
  const fork = new THREE.Group();
  fork.position.set(0.55, 0.18, 0.3);
  const forkBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.08), matBlue);
  fork.add(forkBody);
  const forkArm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.08), matBlue);
  forkArm.rotation.y = Math.PI/6; forkArm.position.set(0.21, 0, 0.05); fork.add(forkArm);
  const forkArm2 = forkArm.clone(); forkArm2.rotation.y = -Math.PI/6; forkArm2.position.z = -0.05; fork.add(forkArm2);
  scene.add(fork);

  // Bridges (black arches)
  function makeBridge(x, z, rot){
    const br = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.28), matBridge);
    br.position.set(x, 0.22, z); br.rotation.y = rot;
    scene.add(br);
    // jewels
    for (let i=0;i<2;i++){
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), matJewel);
      j.position.set(x + (i?0.45:-0.45), 0.26, z);
      j.rotation.y = rot;
      scene.add(j);
    }
    // screws
    for (let i=0;i<2;i++){
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), matScrew);
      s.position.set(x + (i?0.62:-0.62), 0.26, z);
      scene.add(s);
    }
  }
  makeBridge(-0.65, -0.65, 0.2);
  makeBridge( 0.5, -0.2, -0.35);

  // Clock hands (hour / minute / second) — on top, centered
  const handsGroup = new THREE.Group();
  handsGroup.position.set(-0.15, 0.32, -0.45);
  scene.add(handsGroup);
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.7), matBlue);
  hourHand.geometry.translate(0,0,0.35);
  handsGroup.add(hourHand);
  const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.95), matBlue);
  minHand.geometry.translate(0,0,0.475);
  handsGroup.add(minHand);
  const secHand = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.015, 1.05), new THREE.MeshStandardMaterial({ color:0xffaa2b, emissive:0x552200, emissiveIntensity:0.4, metalness:0.8, roughness:0.2 }));
  secHand.geometry.translate(0,0,0.525);
  handsGroup.add(secHand);
  // center cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16), matGearGold);
  handsGroup.add(cap);

  // Hour indices on plate
  for (let i=0;i<12;i++){
    const a = (i/12)*Math.PI*2;
    const r = 2.0;
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.18), new THREE.MeshStandardMaterial({ color:0xffd36a, metalness:0.9, roughness:0.2 }));
    ind.position.set(-0.15 + Math.sin(a)*r*0.55, 0.01, -0.45 - Math.cos(a)*r*0.55); // scaled so it fits in plate (the whole watch is off-center)
    ind.rotation.y = -a;
    // hide — we'd need larger dial for cleanliness. instead draw indices around handsGroup
    handsGroup.remove(ind); // skip: visual clutter
  }

  // Animation
  let t0 = performance.now();
  let raf = 0;
  let lastBeat = -1;
  const labelEl = document.getElementById('tourbillonTime');
  function tick(now){
    const t = (now - t0)/1000;
    // real time hands
    const d = new Date();
    const secs = d.getSeconds() + d.getMilliseconds()/1000;
    const mins = d.getMinutes() + secs/60;
    const hrs  = (d.getHours()%12) + mins/60;
    secHand.rotation.y = -secs/60 * Math.PI*2;
    minHand.rotation.y = -mins/60 * Math.PI*2;
    hourHand.rotation.y = -hrs/12 * Math.PI*2;
    // Mainspring: slow (1 turn per hour)
    barrel.rotation.y = -t * (Math.PI*2 / 3600);
    // Center wheel: 1 turn / hour (minute hand speed) — geared. Visually faster is nicer:
    centerWheel.rotation.y = t * (Math.PI*2 / 60); // 1 rpm
    thirdWheel.rotation.y = -t * (Math.PI*2 / 12); // faster
    fourthWheel.rotation.y = t * (Math.PI*2 / 6);  // 10 rpm
    // Tourbillon cage — 1 revolution per minute (standard)
    cageGroup.rotation.y = t * (Math.PI*2 / 60);
    // audio disabled
    // Escape wheel inside cage — steps at 4Hz (we animate continuous for smoothness)
    escape.rotation.y = -t * (Math.PI*2 * 0.8);
    // Balance wheel oscillates ±30° at 4Hz
    balance.rotation.y = Math.sin(t * Math.PI * 2 * 4) * (Math.PI/6);
    // Pallet fork ±6° synced with balance
    fork.rotation.y = Math.sin(t * Math.PI * 2 * 4) * (Math.PI/28);
    // subtle camera orbit
    camera.position.x = Math.sin(t*0.12)*0.3;
    camera.position.z = 4.6 + Math.cos(t*0.12)*0.12;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (labelEl) labelEl.textContent = d.toTimeString().slice(0,8) + '  ·  4Hz  ·  60s cage';
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const onResize = () => {
    const s = parent.clientWidth;
    renderer.setSize(s, s, false);
  };
  window.addEventListener('resize', onResize);

  tbCtx = {
    dispose(){
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose(); } });
    }
  };
}

// ================= PAGE HYDRATION =================
// ── ZEUS PER-PAGE BACKDROP ─────────────────────────────────────────────
// Two crossfading <div> layers in #zeusPageBg get one of two Zeus portraits
// assigned per route. Hidden on home (which already has the full-bleed
// hero image). Deterministic hash → same page always shows the same
// Zeus, so the user perceives a stable identity per section.
const ZEUS_BACKDROP_IMAGES = ['/assets/zeus/hero.jpg','/assets/zeus/brand.jpg'];
// Curated overrides so flagship pages get the most cinematic portrait
// (hero.jpg = full Zeus throne; brand.jpg = close-up bust).
const ZEUS_BACKDROP_BY_ROUTE = {
  '/services':       '/assets/zeus/hero.jpg',
  '/pricing':        '/assets/zeus/brand.jpg',
  '/enterprise':     '/assets/zeus/hero.jpg',
  '/store':          '/assets/zeus/brand.jpg',
  '/wizard':         '/assets/zeus/hero.jpg',
  '/innovations':    '/assets/zeus/brand.jpg',
  '/frontier':       '/assets/zeus/hero.jpg',
  '/docs':           '/assets/zeus/brand.jpg',
  '/dashboard':      '/assets/zeus/hero.jpg',
  '/account':        '/assets/zeus/brand.jpg',
  '/checkout':       '/assets/zeus/hero.jpg',
  '/about':          '/assets/zeus/brand.jpg',
  '/legal':          '/assets/zeus/brand.jpg',
  '/security':       '/assets/zeus/hero.jpg',
  '/trust':          '/assets/zeus/hero.jpg',
  '/status':         '/assets/zeus/brand.jpg',
  '/operator':       '/assets/zeus/hero.jpg',
  '/observability':  '/assets/zeus/brand.jpg'
};
let __zeusBackdropToggle = false;
function pickZeusBackdrop(route){
  if (!route || route === '/') return null;
  if (ZEUS_BACKDROP_BY_ROUTE[route]) return ZEUS_BACKDROP_BY_ROUTE[route];
  // Sub-route prefix lookup (e.g. /services/foo, /admin/x) — match longest prefix.
  const keys = Object.keys(ZEUS_BACKDROP_BY_ROUTE);
  for (let i = 0; i < keys.length; i++){
    if (route.indexOf(keys[i] + '/') === 0) return ZEUS_BACKDROP_BY_ROUTE[keys[i]];
  }
  // Stable hash → deterministic image per arbitrary route.
  let h = 0; for (let i = 0; i < route.length; i++){ h = (h * 31 + route.charCodeAt(i)) >>> 0; }
  return ZEUS_BACKDROP_IMAGES[h % ZEUS_BACKDROP_IMAGES.length];
}
function applyZeusBackdrop(route){
  try {
    const root = document.getElementById('zeusPageBg');
    if (!root) return;
    try { document.body.setAttribute('data-route', route || '/'); } catch (_) {}
    const url = pickZeusBackdrop(route);
    if (!url){
      root.classList.remove('is-active');
      const layers = root.querySelectorAll('.zeus-page-bg__layer');
      layers.forEach(function(l){ l.classList.remove('is-on'); });
      return;
    }
    const a = root.querySelector('.zeus-page-bg__layer--a');
    const b = root.querySelector('.zeus-page-bg__layer--b');
    if (!a || !b) return;
    const incoming = __zeusBackdropToggle ? a : b;
    const outgoing = __zeusBackdropToggle ? b : a;
    __zeusBackdropToggle = !__zeusBackdropToggle;
    // If image already matches, keep current layer on and skip to avoid a flash.
    const currentBg = (outgoing.style.backgroundImage || '').indexOf(url) >= 0;
    if (currentBg){ root.classList.add('is-active'); return; }
    incoming.style.backgroundImage = 'url("' + url + '")';
    requestAnimationFrame(function(){
      incoming.classList.add('is-on');
      outgoing.classList.remove('is-on');
      root.classList.add('is-active');
    });
  } catch (e) { /* never break navigation */ }
}

async function hydratePage(route){
  route = routePath(route);
  try {
    // Galaxy is a universal background — keep it alive across all routes.
    if (!zeusCtx) initZeus();
  } catch (e) { console.warn('hydratePage:initZeus', e && e.message); }
  try { applyZeusBackdrop(route); } catch (e) { console.warn('hydratePage:zeusBackdrop', e && e.message); }
  try {
    // Tear down tourbillon if leaving home
    if (route !== '/' && tbCtx){ tbCtx.dispose(); tbCtx = null; }
  } catch (e) { console.warn('hydratePage:tbDispose', e && e.message); }

  try { if (route === '/') { initTourbillon(); await hydrateHome(); initPillars(); } } catch (e) { console.warn('hydratePage:home', e && e.message); }
  try { if (route === '/services') await hydrateMasterCatalog(); } catch (e) { console.warn('hydratePage:services', e && e.message); }  try { if (route === '/pricing') await hydratePricingPage(); } catch (e) { console.warn('hydratePage:pricing', e && e.message); }
  try { if (route.startsWith('/services/')) await hydrateServiceDetail(route.slice(10)); } catch (e) { console.warn('hydratePage:serviceDetail', e && e.message); }
  try { if (route === '/checkout') hydrateCheckout(); } catch (e) { console.warn('hydratePage:checkout', e && e.message); }
  try { if (route === '/dashboard') await hydrateDashboard(); } catch (e) { console.warn('hydratePage:dashboard', e && e.message); }
  try { if (route === '/enterprise') await hydrateEnterprise(); } catch (e) { console.warn('hydratePage:enterprise', e && e.message); }
  try { if (route === '/store') await hydrateStore(); } catch (e) { console.warn('hydratePage:store', e && e.message); }
  try { if (route === '/account') await hydrateAccount(); } catch (e) { console.warn('hydratePage:account', e && e.message); }
  try { if (route === '/admin/services') await hydrateAdminServices(); } catch (e) { console.warn('hydratePage:adminServices', e && e.message); }
  try { if (route === '/admin' || route === '/admin/login') await hydrateAdminLogin(); } catch (e) { console.warn('hydratePage:adminLogin', e && e.message); }
  try { initCinematicInteractions(); } catch (e) { console.warn('hydratePage:cinematic', e && e.message); }
  setTimeout(clearStaleLoadingPlaceholders, 6500);
  setTimeout(wireExistingAccountAuth, 500);
}

let cinematicBound = false;
function initCinematicInteractions(){
  // reveal sections
  const sections = Array.from(document.querySelectorAll('section'));
  sections.forEach(function(s){ s.setAttribute('data-reveal',''); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting) en.target.classList.add('revealed');
      });
    }, { threshold: 0.12 });
    sections.forEach(function(s){ io.observe(s); });
  } else {
    sections.forEach(function(s){ s.classList.add('revealed'); });
  }

  // tilt surfaces
  var tiltTargets = Array.from(document.querySelectorAll('.card, .panel'));
  tiltTargets.forEach(function(el){
    if (el.dataset.tiltInit === '1') return;
    el.dataset.tiltInit = '1';
    el.setAttribute('data-tilt', '');
    el.addEventListener('mousemove', function(e){
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const rx = (0.5 - y) * 8;
      const ry = (x - 0.5) * 10;
      el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-2px)';
    }, { passive:true });
    el.addEventListener('mouseleave', function(){
      el.style.transform = '';
    }, { passive:true });
  });

  if (cinematicBound) return;
  cinematicBound = true;
  const hero = document.querySelector('.hero-fx');
  const zeusScene = document.querySelector('.zeus-scene');
  const zeusImg = document.querySelector('.zeus-hero-image');
  window.addEventListener('mousemove', function(e){
    if (!hero) return;
    const x = (e.clientX / window.innerWidth) - 0.5;
    const y = (e.clientY / window.innerHeight) - 0.5;
    hero.style.transform = 'translate3d(' + (x*14).toFixed(2) + 'px,' + (y*10).toFixed(2) + 'px,0)';
    if (zeusScene) zeusScene.style.transform = 'translate3d(' + (x*8).toFixed(2) + 'px,' + (y*6).toFixed(2) + 'px,0)';
    if (zeusImg) zeusImg.style.transform = 'scale(1.06) translate3d(' + (x*5).toFixed(2) + 'px,' + (y*4).toFixed(2) + 'px,0)';
  }, { passive:true });
}

async function loadServices(){
  const j = await api('/api/services');
  if (j && Array.isArray(j.services)) { STATE.services = j.services; return j.services; }
  // fallback to /marketplace (current server)
  const m = await api('/marketplace');
  if (m && Array.isArray(m.modules)) {
    STATE.services = m.modules.map(x => ({ id:x.id, title:x.title, segment:x.segment, kpi:x.kpi, price: null, currency:'USD', description:'Core service from the ZeusAI marketplace.' }));
    return STATE.services;
  }
  return [];
}

// ===== Admin / Services CRUD (cookie-session based — no manual token) =====
async function adminFetch(path, opts){
  const h = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
  // Legacy fallback: if someone still has a localStorage token from before, forward it.
  try { const t = localStorage.getItem('adminToken'); if (t) h['x-admin-token'] = t; } catch(_){}
  const r = await fetch(path, Object.assign({}, opts || {}, { headers: h, cache: 'no-store', credentials: 'same-origin' }));
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch(_) {}
  return { ok: r.ok, status: r.status, json, text };
}
async function adminSessionStatus(){
  try { const r = await fetch('/api/admin/session', { cache:'no-store', credentials:'same-origin' }); return await r.json(); }
  catch(_) { return { active:false, configured:false }; }
}
async function hydrateAdminLogin(){
  const form = document.getElementById('admLoginForm');
  const pwd = document.getElementById('admLoginPwd');
  const msg = document.getElementById('admLoginMsg');
  const active = document.getElementById('admLoginActive');
  const logoutBtn = document.getElementById('admLogoutBtn');
  if (!form) return;
  const refresh = async function(){
    const s = await adminSessionStatus();
    if (!s.configured){ if (msg) msg.textContent = 'ADMIN_SECRET not configured on server.'; form.style.display='none'; return; }
    if (s.active){ form.style.display='none'; if (active) active.style.display='block'; }
    else { form.style.display='grid'; if (active) active.style.display='none'; }
  };
  await refresh();
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if (msg) msg.textContent = 'Signing in…';
    const r = await adminFetch('/api/admin/login', { method:'POST', body: JSON.stringify({ password: pwd.value }) });
    if (r.ok){ if (msg) msg.textContent = '✓ Logged in — redirecting…'; pwd.value=''; setTimeout(function(){ navigate('/admin/services'); }, 400); }
    else { if (msg) msg.textContent = 'Login failed: ' + ((r.json && r.json.error) || r.status); }
  });
  if (logoutBtn) logoutBtn.addEventListener('click', async function(){
    await adminFetch('/api/admin/logout', { method:'POST' });
    try { localStorage.removeItem('adminToken'); } catch(_){}
    await refresh();
  });
}
async function hydrateAdminServices(){
  const form = document.getElementById('admSvcForm');
  const msg = document.getElementById('admSvcMsg');
  const list = document.getElementById('admSvcList');
  const bar = document.getElementById('admSessionBar');
  if (!form || !list) return;

  // Session gate: if not logged in, redirect to /admin
  const sess = await adminSessionStatus();
  if (!sess.active){
    if (bar) bar.innerHTML = '<span style="color:#ffb7c2">Not logged in.</span> <a href="/admin" class="btn btn-primary">Login →</a>';
    list.innerHTML = '<div class="card" style="padding:14px;color:var(--ink-dim)">Please log in to manage services.</div>';
    setTimeout(function(){ navigate('/admin'); }, 600);
    return;
  }
  if (bar) bar.innerHTML = '<span style="color:#7ee2a8">✓ Admin session active.</span> <button id="admLogoutBtn2" class="btn" style="margin-left:8px">Logout</button>';
  const lo = document.getElementById('admLogoutBtn2');
  if (lo) lo.addEventListener('click', async function(){ await adminFetch('/api/admin/logout', { method:'POST' }); navigate('/admin'); });

  const renderList = function(services){
    if (!Array.isArray(services) || !services.length){ list.innerHTML = '<div class="card" style="padding:14px;color:var(--ink-dim)">No services yet.</div>'; return; }
    list.innerHTML = services.map(function(s){
      return '<div class="card" data-id="'+escapeHtml(s.id)+'" style="padding:14px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center">'
        + '<div><strong>'+escapeHtml(s.title||s.id)+'</strong> <span style="color:var(--ink-dim);font-size:12px">· '+escapeHtml(s.id)+' · '+escapeHtml(s.segment||'all')+' · $'+Number(s.price||0)+' '+escapeHtml(s.billing||'monthly')+'</span>'
        + '<div style="color:var(--ink-dim);font-size:13px;margin-top:4px">'+escapeHtml(s.description||'')+'</div></div>'
        + '<div style="display:flex;gap:8px">'
        +   '<button class="btn" data-act="edit">Edit</button>'
        +   '<button class="btn" data-act="del" style="border-color:#b3263a;color:#ffb7c2">Delete</button>'
        + '</div></div>';
    }).join('');
    Array.from(list.querySelectorAll('[data-act]')).forEach(function(btn){
      btn.addEventListener('click', async function(){
        const row = btn.closest('[data-id]'); if (!row) return;
        const id = row.getAttribute('data-id');
        const svc = services.find(function(x){ return x.id === id; });
        if (btn.getAttribute('data-act') === 'edit' && svc){
          form.id.value = svc.id || ''; form.title.value = svc.title || ''; form.segment.value = svc.segment || 'all';
          form.kpi.value = svc.kpi || ''; form.price.value = svc.price || 0; form.billing.value = svc.billing || 'monthly';
          form.description.value = svc.description || '';
          form.scrollIntoView({ behavior:'smooth', block:'center' });
        } else if (btn.getAttribute('data-act') === 'del'){
          if (!confirm('Delete service "'+id+'" ?')) return;
          const r = await adminFetch('/api/admin/services/'+encodeURIComponent(id), { method:'DELETE' });
          if (msg) msg.textContent = r.ok ? '✓ Deleted — broadcasting…' : ('Error: '+(r.json && r.json.error || r.status));
          if (r.ok) await loadAndRender();
        }
      });
    });
  };
  const loadAndRender = async function(){
    const j = await api('/api/services/list');
    const arr = j && Array.isArray(j.services) ? j.services : [];
    STATE.services = arr; renderList(arr);
  };
  form.onsubmit = async function(e){
    e.preventDefault();
    const body = {
      id: form.id.value.trim(),
      title: form.title.value.trim(),
      segment: form.segment.value.trim() || 'all',
      kpi: form.kpi.value.trim(),
      price: Number(form.price.value || 0),
      currency: 'USD',
      billing: form.billing.value.trim() || 'monthly',
      description: form.description.value.trim()
    };
    const r = await adminFetch('/api/admin/services', { method:'POST', body: JSON.stringify(body) });
    if (msg) msg.textContent = r.ok ? ('✓ Saved ('+r.json.action+') — broadcasting to all browsers…') : ('Error: '+(r.json && r.json.error || r.status));
    if (r.ok){ form.reset(); form.segment.value = 'all'; form.billing.value = 'monthly'; form.price.value = ''; await loadAndRender(); }
    else if (r.status === 401){ setTimeout(function(){ navigate('/admin'); }, 800); }
  };
  await loadAndRender();
}

async function hydrateHome(){
  initZeusHeroImage();
  const services = await loadServices();
  const grid = $('#liveServices');
  if (grid) {
    // Prefer master catalog (covers strategic + frontier + verticals + modules)
    let masterItems = null;
    try {
      const cat = await api('/api/catalog/master');
      STATE.masterCatalog = cat;
      // Pick a hero set: 2 strategic + 2 frontier + 2 vertical + 2 marketplace
      const pick = (g, n) => (cat.items.filter(x => x.group === g).slice(0, n));
      masterItems = [...pick('strategic', 2), ...pick('frontier', 2), ...pick('vertical', 2), ...pick('marketplace', 2)];
    } catch(_){ masterItems = null; }
    if (masterItems && masterItems.length) {
      grid.innerHTML = masterItems.map(masterCardHtml).join('')
        + '<div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:linear-gradient(135deg,rgba(138,92,255,.18),rgba(62,160,255,.10));border-color:var(--violet)"><h3 style="margin:0 0 8px">See the full catalog →</h3><p style="margin:0 0 14px">Strategic + Frontier + Vertical + AI Modules — all BTC-priced live.</p><a class="btn btn-primary" href="/services" data-link>Open Master Catalog</a></div>';
    } else {
      grid.innerHTML = services.slice(0,6).map(s => cardHtml(s)).join('') || '<div class="card"><p>No services yet.</p></div>';
    }
  }
  // verticals
  const snap = await api('/snapshot');
  const vroot = $('#verticals');
  if (vroot && snap) {
    const verts = snap.industries && snap.industries.length ? snap.industries : [
      { id:'fintech', title:'FinTech', outcomes:['risk scoring','fraud prevention'] },
      { id:'ecommerce', title:'E-commerce', outcomes:['conversion uplift','ad spend efficiency'] },
      { id:'manufacturing', title:'Manufacturing', outcomes:['downtime reduction','predictive maintenance'] }
    ];
    vroot.innerHTML = verts.slice(0,12).map(v => `
      <div class="card">
        <span class="tag">${escapeHtml(v.id||'')}</span>
        <h3>${escapeHtml(v.title)}</h3>
        <p>Pre‑configured ${escapeHtml(v.title)} OS — compliance, pricing & marketplace lineage shipped by default.</p>
        <div class="row"><span>${(v.outcomes||[]).slice(0,2).map(escapeHtml).join(' · ')}</span><b>→</b></div>
      </div>`).join('');
  }
  if (snap) applySnapshot(snap);
  hydrateCommerceProof();
  initFinalLive(services);
}

async function hydrateCommerceProof(){
  const catalogEl = document.getElementById('commerceProofCatalog');
  const btcEl = document.getElementById('commerceProofBtcProvider');
  const deliveryEl = document.getElementById('commerceProofDelivery');
  const adminEl = document.getElementById('commerceProofAdmin');
  const smokeEl = document.getElementById('commerceProofSmoke');
  if (!catalogEl && !btcEl && !deliveryEl && !adminEl && !smokeEl) return;

  try {
    const cat = STATE.masterCatalog || await api('/api/catalog/master');
    if (catalogEl && cat && cat.counts) catalogEl.textContent = cat.counts.total + ' live products';
    if (deliveryEl && cat && cat.counts) deliveryEl.textContent = cat.counts.marketplace + ' deliverable modules';
    if (smokeEl && cat && cat.counts) smokeEl.textContent = cat.counts.total >= 65 ? 'Live smoke threshold passed' : 'Catalog threshold needs attention';
  } catch (_) {
    if (catalogEl) catalogEl.textContent = 'Catalog API reachable from /services';
  }

  try {
    const spot = await api('/api/btc/spot');
    if (btcEl && spot) btcEl.textContent = 'BTC direct wallet live' + (spot.usdPerBtc ? ' · $' + Number(spot.usdPerBtc).toLocaleString() + '/BTC' : '');
  } catch (_) {
    if (btcEl) btcEl.textContent = 'BTC checkout ready';
  }
  hydratePaymentRails().catch(function(){});

  try {
    const r = await fetch('/api/admin/commerce/refund', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    if (adminEl) adminEl.textContent = r.status === 401 ? 'Refund protected · 401' : 'Admin endpoint live';
  } catch (_) {
    if (adminEl) adminEl.textContent = 'Admin cockpit protected';
  }
}

function initZeusHeroImage(){
  const img = document.getElementById('zeusHeroImg');
  if (!img) return;
  const heroSrc = img.getAttribute('data-zeus-src');
  if (!heroSrc) return;
  const probe = new Image();
  probe.onload = function(){ img.src = heroSrc; };
  probe.onerror = function(){};
  probe.src = heroSrc + '?v=' + Date.now();
}

function initFinalLive(services){
  const sEl = document.getElementById('fuServices');
  const eEl = document.getElementById('fuEvents');
  const uEl = document.getElementById('fuUser');
  const aiCountEl = document.getElementById('fuAiCount');
  const aiModeEl = document.getElementById('fuAiMode');
  const pqEl = document.getElementById('fuPq');
  const sel = document.getElementById('fuService');
  const out = document.getElementById('fuOut');
  const btn = document.getElementById('fuBuyBtn');
  const aiPrompt = document.getElementById('fuAiPrompt');
  const aiBtn = document.getElementById('fuAiBtn');
  const aiOut = document.getElementById('fuAiOut');
  const latEl = document.getElementById('fuLatency');
  const driftEl = document.getElementById('fuDrift');
  const logEl = document.getElementById('fuEventLog');
  const futureScoreEl = document.getElementById('fuFutureScore');
  const futureBtn = document.getElementById('fuFutureBtn');
  const futureOut = document.getElementById('fuFutureOut');
  const optEl = document.getElementById('fuOptScore');
  const rbEl = document.getElementById('fuRollback');
  const stEl = document.getElementById('fuStrategy');
  const loopOut = document.getElementById('fuLoopOut');
  const trustSigEl = document.getElementById('fuTrustSig');
  const trustReceiptsEl = document.getElementById('fuTrustReceipts');
  const revTotalEl = document.getElementById('fuRevTotal');
  const revMethodsEl = document.getElementById('fuRevMethods');
  const trustOut = document.getElementById('fuTrustOut');
  const drillScoreEl = document.getElementById('fuDrillScore');
  const drillRecoveryEl = document.getElementById('fuDrillRecovery');
  const drillRunsEl = document.getElementById('fuDrillRuns');
  const drillBtn = document.getElementById('fuDrillBtn');
  const drillOut = document.getElementById('fuDrillOut');
  const tuneModeEl = document.getElementById('fuTuneMode');
  const tuneIntensityEl = document.getElementById('fuTuneIntensity');
  const tuneMotionEl = document.getElementById('fuTuneMotion');
  const tuneBtn = document.getElementById('fuTuneBtn');
  const tuneOut = document.getElementById('fuTuneOut');
  const perfP95El = document.getElementById('fuPerfP95');
  const perfP99El = document.getElementById('fuPerfP99');
  const perfModeEl = document.getElementById('fuPerfMode');
  const perfBtn = document.getElementById('fuPerfBtn');
  const perfOut = document.getElementById('fuPerfOut');
  if (!sEl || !eEl || !uEl || !sel || !out || !btn) return;

  sEl.textContent = (services && services.length ? services.length : 0) + ' services synced';
  sel.innerHTML = (services||[]).slice(0,20).map(function(x){
    const id = escapeHtml(x.id || 'service');
    return '<option value="'+id+'">'+id+'</option>';
  }).join('') || '<option value="adaptive-ai">adaptive-ai</option>';

  fetch('/api/user/services').then(function(r){ return r.json(); }).then(function(j){
    uEl.textContent = (j && typeof j.count === 'number' ? j.count : 0) + ' services in account';
  }).catch(function(){ uEl.textContent = 'Unavailable'; });

  if (aiCountEl) {
    fetch('/api/ai/registry').then(function(r){ return r.json(); }).then(function(j){
      if (!j) return;
      const active = typeof j.active === 'number' ? j.active : 0;
      const total = typeof j.total === 'number' ? j.total : 0;
      aiCountEl.textContent = active + '/' + total + ' AI adapters online';
      if (aiModeEl && Array.isArray(j.routers) && j.routers.length) aiModeEl.textContent = 'Auto via ' + j.routers[0];
    }).catch(function(){
      aiCountEl.textContent = 'Registry unavailable';
      if (aiModeEl) aiModeEl.textContent = 'Manual fallback';
    });
  }

  if (pqEl) {
    fetch('/api/security/pq/status').then(function(r){ return r.json(); }).then(function(j){
      if (!j) return;
      const mode = j.mode || 'unknown';
      const dig = j.digest || 'n/a';
      pqEl.textContent = mode + ' · ' + dig;
    }).catch(function(){ pqEl.textContent = 'Unavailable'; });
  }

  let evtCount = 0;
  const feed = [];
  function pushFeed(line){
    if (!logEl) return;
    feed.unshift(line);
    while (feed.length > 8) feed.pop();
    logEl.textContent = feed.join('\n');
  }
  try {
    const es = resilientES('/api/unicorn/events', {
      onopen: function(){ eEl.textContent = 'Realtime stream connected'; },
      onmessage: function(ev){
        evtCount++;
        eEl.textContent = evtCount + ' live events received';
        try {
          const j = JSON.parse(ev.data || '{}');
          const t = j.type || 'event';
          const at = (j.at || new Date().toISOString()).slice(11,19);
          pushFeed('[' + at + '] ' + t);
        } catch (_) { pushFeed('[' + new Date().toISOString().slice(11,19) + '] event'); }
      },
      onerror: function(){ eEl.textContent = 'Stream reconnecting…'; }
    });
    window.addEventListener('beforeunload', function(){ try { es.close(); } catch(_){} }, { once:true });
  } catch (_) { eEl.textContent = 'Stream unavailable'; }

  if (latEl) {
    const t0 = performance.now();
    fetch('/health', { cache: 'no-store' }).then(function(){
      const ms = Math.max(1, Math.round(performance.now() - t0));
      latEl.textContent = ms + ' ms';
    }).catch(function(){ latEl.textContent = 'n/a'; });
  }

  if (driftEl) {
    Promise.all([
      fetch('/snapshot', { cache: 'no-store' }).then(function(r){ return r.json(); }).catch(function(){ return null; }),
      fetch('/api/services/list', { cache: 'no-store' }).then(function(r){ return r.json(); }).catch(function(){ return null; })
    ]).then(function(parts){
      const snap = parts[0], svc = parts[1];
      const a = snap && Array.isArray(snap.marketplace) ? snap.marketplace.length : 0;
      const b = svc && Array.isArray(svc.services) ? svc.services.length : 0;
      const d = Math.abs(a - b);
      driftEl.textContent = d === 0 ? '0 mismatch' : (d + ' mismatch');
    }).catch(function(){ driftEl.textContent = 'n/a'; });
  }

  let futureManifest = null;
  fetch('/api/future/standard').then(function(r){ return r.json(); }).then(function(j){
    futureManifest = j;
    if (futureScoreEl) {
      const s = j && typeof j.readinessScore === 'number' ? j.readinessScore : 0;
      futureScoreEl.textContent = s + '/100';
    }
    if (futureOut) {
      const standards = j && Array.isArray(j.standards) ? j.standards.length : 0;
      futureOut.textContent = 'Loaded ' + standards + ' standards · horizon ' + ((j && j.horizonYears) || 30) + ' years.';
    }
  }).catch(function(){
    if (futureScoreEl) futureScoreEl.textContent = 'n/a';
    if (futureOut) futureOut.textContent = 'Manifest unavailable.';
  });

  if (futureBtn) {
    futureBtn.onclick = function(){
      if (!futureManifest) {
        if (futureOut) futureOut.textContent = 'Manifest not loaded yet.';
        return;
      }
      try {
        const blob = new Blob([JSON.stringify(futureManifest, null, 2)], { type:'application/json' });
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = 'zeusai-30y-standard.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        if (futureOut) futureOut.textContent = 'Downloaded zeusai-30y-standard.json';
      } catch (e) {
        if (futureOut) futureOut.textContent = 'Download failed: ' + String(e && e.message || e);
      }
    };
  }

  fetch('/api/evolution/loop').then(function(r){ return r.json(); }).then(function(j){
    if (!j) return;
    if (optEl) optEl.textContent = ((j.quality && j.quality.optimizationScore) || 'n/a') + '/100';
    if (rbEl) rbEl.textContent = (j.guardrails && j.guardrails.rollbackReady) ? 'Ready' : 'Not ready';
    if (stEl) {
      const e = j.strategy && j.strategy.explorationPct;
      const x = j.strategy && j.strategy.exploitationPct;
      stEl.textContent = (e != null && x != null) ? (e + '% / ' + x + '%') : 'n/a';
    }
    if (loopOut) {
      const c = j.loop && j.loop.cycle;
      const drift = j.quality && j.quality.driftWatch;
      loopOut.textContent = 'Cycle #' + (c || 0) + ' · drift: ' + (drift || 'unknown') + ' · policy: ' + ((j.strategy && j.strategy.policy) || 'n/a');
    }
  }).catch(function(){
    if (optEl) optEl.textContent = 'n/a';
    if (rbEl) rbEl.textContent = 'n/a';
    if (stEl) stEl.textContent = 'n/a';
    if (loopOut) loopOut.textContent = 'Loop snapshot unavailable.';
  });

  Promise.all([
    fetch('/api/trust/ledger').then(function(r){ return r.json(); }).catch(function(){ return null; }),
    fetch('/api/revenue/proof').then(function(r){ return r.json(); }).catch(function(){ return null; })
  ]).then(function(parts){
    const trust = parts[0], rev = parts[1];
    if (trustSigEl) trustSigEl.textContent = ((trust && trust.trustScores && trust.trustScores.integrityScore) || 'n/a') + '/100';
    if (trustReceiptsEl) {
      const p = trust && trust.ledger && trust.ledger.paidReceipts;
      trustReceiptsEl.textContent = (p != null ? p : 'n/a') + ' verified';
    }
    if (revTotalEl) {
      const t = rev && rev.revenue && rev.revenue.totalUsd;
      revTotalEl.textContent = t != null ? ('$' + Number(t).toFixed(2)) : 'n/a';
    }
    if (revMethodsEl) {
      const m = rev && rev.revenue && rev.revenue.methods;
      revMethodsEl.textContent = m ? Object.keys(m).join(' / ') || 'none' : 'n/a';
    }
    if (trustOut) {
      const endpoint = trust && trust.ledger && trust.ledger.integrityEndpoint;
      const paid = rev && rev.revenue && rev.revenue.paidReceipts;
      trustOut.textContent = 'Integrity: ' + (endpoint || 'n/a') + ' · paid receipts: ' + (paid != null ? paid : 'n/a') + ' · routing: direct BTC';
    }
  }).catch(function(){
    if (trustOut) trustOut.textContent = 'Trust snapshot unavailable.';
  });

  function applyDrill(j){
    if (!j || !j.drill) return;
    if (drillScoreEl) drillScoreEl.textContent = (j.drill.readinessScore != null ? j.drill.readinessScore : 'n/a') + '/100';
    if (drillRecoveryEl) drillRecoveryEl.textContent = (j.drill.averageRecoveryMs != null ? (j.drill.averageRecoveryMs + ' ms') : 'n/a');
    if (drillRunsEl) drillRunsEl.textContent = (j.drill.totalRuns != null ? j.drill.totalRuns : 'n/a') + '';
  }

  fetch('/api/resilience/drill').then(function(r){ return r.json(); }).then(function(j){
    applyDrill(j);
    if (drillOut) drillOut.textContent = 'Policy: ' + ((j && j.drill && j.drill.policy) || 'n/a') + ' · status: ' + ((j && j.drill && j.drill.status) || 'unknown');
  }).catch(function(){
    if (drillOut) drillOut.textContent = 'Resilience status unavailable.';
  });

  if (drillBtn) {
    drillBtn.onclick = async function(){
      if (drillOut) drillOut.textContent = 'Running live drill…';
      const j = await fetch('/api/resilience/drill/run', { method: 'POST' }).then(function(r){ return r.json(); }).catch(function(){ return null; });
      if (!j || !j.ok) {
        if (drillOut) drillOut.textContent = 'Drill run failed.';
        return;
      }
      applyDrill(j);
      if (drillOut) drillOut.textContent = 'Drill executed · recovery: ' + (j.recoveryMs || 'n/a') + ' ms';
    };
  }

  let tuneProfile = null;
  function applyTune(p){
    if (!p) return;
    const root = document.documentElement;
    if (p.palette && p.palette.violet) root.style.setProperty('--violet', p.palette.violet);
    if (p.palette && p.palette.blue) root.style.setProperty('--blue', p.palette.blue);
    if (p.profile && p.profile.glassBlurPx != null) root.style.setProperty('--autotune-blur', String(p.profile.glassBlurPx) + 'px');
    if (p.profile && p.profile.glowPower != null) root.style.setProperty('--autotune-glow', String(p.profile.glowPower));
    root.classList.toggle('cinema-boost', !!(p.profile && p.profile.motion === 'high'));
  }

  fetch('/api/ui/autotune').then(function(r){ return r.json(); }).then(function(j){
    if (!j) return;
    tuneProfile = j;
    if (tuneModeEl) tuneModeEl.textContent = (j.profile && j.profile.mode) || 'auto-cinematic';
    if (tuneIntensityEl) tuneIntensityEl.textContent = ((j.profile && j.profile.intensity) != null ? j.profile.intensity : 'n/a') + '';
    if (tuneMotionEl) tuneMotionEl.textContent = (j.profile && j.profile.motion) || 'balanced';
    if (tuneOut) tuneOut.textContent = 'Profile loaded · glow ' + ((j.profile && j.profile.glowPower) || 'n/a') + ' · blur ' + ((j.profile && j.profile.glassBlurPx) || 'n/a') + 'px';
    applyTune(j);
  }).catch(function(){
    if (tuneOut) tuneOut.textContent = 'Auto-tune profile unavailable.';
  });

  if (tuneBtn) {
    tuneBtn.onclick = function(){
      if (!tuneProfile) {
        if (tuneOut) tuneOut.textContent = 'No profile loaded yet.';
        return;
      }
      applyTune(tuneProfile);
      if (tuneOut) tuneOut.textContent = 'Live profile applied.';
    };
  }

  function applyGovernance(g){
    if (!g || !g.performance || !g.policy) return;
    if (perfP95El) perfP95El.textContent = 'p95 ' + g.performance.apiP95Ms + 'ms · p99 ' + g.performance.apiP99Ms + 'ms';
    if (perfP99El) perfP99El.textContent = 'p95 ' + g.performance.renderP95Ms + 'ms · p99 ' + g.performance.renderP99Ms + 'ms';
    if (perfModeEl) perfModeEl.textContent = (g.policy.mode || 'balanced') + ' · score ' + ((g.performance.score != null) ? g.performance.score : 'n/a');
    if (perfOut) {
      const fps = g.budget && g.budget.estimatedFps != null ? g.budget.estimatedFps : 'n/a';
      perfOut.textContent = 'Action: ' + (g.policy.action || 'none') + ' · reason: ' + (g.policy.reason || 'n/a') + ' · est FPS: ' + fps;
    }
    const root = document.documentElement;
    root.classList.toggle('perf-safe-mode', g.policy.mode === 'safe');
  }

  function loadGovernance(){
    return fetch('/api/performance/governance').then(function(r){ return r.json(); }).then(function(j){
      if (!j) return;
      applyGovernance(j);
    }).catch(function(){
      if (perfOut) perfOut.textContent = 'Performance governance unavailable.';
      if (perfModeEl) perfModeEl.textContent = 'unavailable';
    });
  }
  loadGovernance();
  if (perfBtn) {
    perfBtn.onclick = function(){
      if (perfOut) perfOut.textContent = 'Refreshing performance governance…';
      loadGovernance();
    };
  }

  btn.onclick = async function(){
    const serviceId = sel.value || 'adaptive-ai';
    const email = (document.getElementById('fuEmail')||{}).value || '';
    const live = await fetchLivePricing(serviceId);
    const amountUsd = Number(live && live.price_usd != null ? live.price_usd : 99);
    out.textContent = 'Creating order…';
    const res = await fetch('/api/services/buy', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ serviceId, paymentMethod:'BTC', amount: amountUsd, email })
    }).then(function(r){ return r.json(); }).catch(function(e){ return { error: String(e) }; });
    out.textContent = JSON.stringify(res, null, 2);
  };

  if (aiBtn && aiOut && aiPrompt) {
    aiBtn.onclick = async function(){
      aiOut.textContent = 'Routing to best AI…';
      const prompt = aiPrompt.value || 'Create a 5-point product strategy for ZeusAI.';
      const res = await fetch('/api/ai/use', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ message: prompt, taskType: 'analysis', ai: 'auto' })
      }).then(function(r){ return r.json(); }).catch(function(e){ return { error: String(e) }; });
      if (aiModeEl && res && res.selection) aiModeEl.textContent = (res.selection.selected || 'auto') + ' selected';
      const txt = res && res.reply ? String(res.reply).slice(0, 1200) : JSON.stringify(res, null, 2);
      aiOut.textContent = txt;
    };
  }
}

function cardHtml(s){
  const sid = String(s && s.id ? s.id : 'unknown-service');
  const tag = domSafeId(sid);
  const hasPrice = Number.isFinite(Number(s && (s.priceUsd != null ? s.priceUsd : s.price)));
  const resolvedPrice = hasPrice ? Number(s.priceUsd != null ? s.priceUsd : s.price) : null;
  const price = resolvedPrice != null ? (`$${resolvedPrice}${s.billing==='monthly'?'/mo':''}`) : 'Loading price...';
  return `<div class="card">
    <span class="tag">${escapeHtml(s.segment || s.category || 'core')}</span>
    <h3>${escapeHtml(s.title || s.id)}</h3>
    <p>${escapeHtml(s.description || ('Outcome: ' + (s.kpi || 'automation')))}</p>
    <div class="row"><span>${escapeHtml(s.kpi || 'SLA-backed')}</span><b data-live-price="${tag}">${price}</b></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <a class="btn btn-ghost" href="/services/${encodeURIComponent(s.id)}" data-link style="flex:1;justify-content:center">Details</a>
      <a class="btn btn-primary" href="/checkout?plan=${encodeURIComponent(s.id)}" data-link style="flex:1;justify-content:center">Buy</a>
    </div>
  </div>`;
}

async function hydrateServices(){
  const services = await loadServices();
  const grid = $('#servicesGrid');
  const filters = $('#svcFilters');
  const cats = Array.from(new Set(services.map(s => s.segment || s.category || 'core')));
  if (filters) {
    filters.innerHTML = ['all', ...cats].map((c,i)=>`<button class="chip${i===0?' on':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
    filters.addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      $$('.chip', filters).forEach(c=>c.classList.remove('on')); chip.classList.add('on');
      const cat = chip.dataset.cat;
      const list = cat==='all' ? services : services.filter(s => (s.segment||s.category||'core')===cat);
      grid.innerHTML = list.map(cardHtml).join('') || '<div class="card"><p>No services in this segment.</p></div>';
    });
  }
  if (grid) grid.innerHTML = services.map(cardHtml).join('') || '<div class="card"><p>No services yet.</p></div>';
  if (grid && services.length) hydrateServiceCardPrices(services, grid);
}

async function hydrateServiceCardPrices(services, root){
  const list = Array.isArray(services) ? services : [];
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i];
    const sid = String(s && s.id ? s.id : '').trim();
    if (!sid) continue;
    const sel = '[data-live-price="' + domSafeId(sid) + '"]';
    const el = (root || document).querySelector(sel);
    if (!el) continue;
    const live = await fetchLivePricing(sid, { onSlow: function(){ if (el) el.textContent = 'Loading price...'; } });
    if (!live || !el) continue;
    s.priceUsd = Number(live.price_usd);
    s.price = Number(live.price_usd);
    el.textContent = '$' + Number(live.price_usd).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '/mo';
  }
}

async function hydratePricingPage(){
  const pairs = [
    { plan: 'starter', serviceId: 'starter' },
    { plan: 'pro', serviceId: 'pro' },
    { plan: 'enterprise', serviceId: 'enterprise' },
  ];
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    const priceEl = document.querySelector('[data-pricing-value="' + pair.plan + '"]');
    const planCard = document.querySelector('[data-pricing-plan="' + pair.plan + '"]');
    if (!priceEl || !planCard) continue;
    const cta = planCard.querySelector('a[href*="/checkout?plan="]');
    const live = await fetchLivePricing(pair.serviceId, { onSlow: function(){ priceEl.textContent = 'Loading price...'; } });
    if (!live) continue;
    priceEl.innerHTML = '$' + Number(live.price_usd).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '<small>/mo</small>';
    if (cta) cta.setAttribute('href', '/checkout?plan=' + encodeURIComponent(pair.serviceId));
  }
}

// ============================================================
// MASTER CATALOG — every Unicorn deliverable, BTC-priced, filterable
// ============================================================
function masterCardHtml(it){
  const groupColor = {
    instant:'#8a5cff', professional:'#3ea0ff', enterprise:'#ffd36a', industry:'#ff8aab', marketplace:'#6fd3ff',
    strategic:'#8a5cff', frontier:'#ffd36a', vertical:'#3ea0ff',
    'unicorn-auto-module':'#a3ffce', 'billion-scale-activation':'#ff8aab',
    'billion-scale-package':'#ff5cd1', 'future-invention':'#7cf3ff'
  }[it.group] || '#8a5cff';
  const groupLabel = {
    instant:'Instant', professional:'Professional', enterprise:'Enterprise', industry:'Industry', marketplace:'AI Module',
    strategic:'Strategic', frontier:'Frontier', vertical:'Vertical OS',
    'unicorn-auto-module':'Auto-Discovered', 'billion-scale-activation':'Activation',
    'billion-scale-package':'Strategic Package', 'future-invention':'Future R&D'
  }[it.group] || it.group;
  const priceUsd = Number(it.priceUsd || 0);
  const priceTxt = priceUsd > 0 ? ('$' + priceUsd.toLocaleString()) : 'Free';
  const btcTxt = it.priceBtc > 0 ? ('₿ ' + Number(it.priceBtc).toFixed(8)) : '—';
  const idAttr = escapeHtml(it.id);
  // Pre-order eligible: speculative R&D primitives are sold as forward-locks
  // at 30% of the listed price (configurable server-side via COMMERCE_PREORDER_PCT).
  const isPreorderEligible = it.group === 'future-invention' && priceUsd > 0;
  // "Pay with BTC, save 10%" — strictly truthful: every BTC checkout applies
  // the COMMERCE_BTC_DISCOUNT_PCT factor to subtotal_fiat before sat conversion.
  const btcSaveBadge = priceUsd > 0
    ? '<span class="tag" style="background:rgba(247,147,26,.15);color:#f7931a;border:1px solid rgba(247,147,26,.35);font-size:10px;margin-left:6px" title="Sovereign BTC checkout applies a 10% discount vs the USD list price">₿ save 10%</span>'
    : '';
  return '<div class="card" data-group="' + escapeHtml(it.group) + '">'
    + '<span class="tag" style="background:' + groupColor + '22;color:' + groupColor + '">' + escapeHtml(groupLabel) + '</span>'
    + btcSaveBadge
    + '<h3>' + escapeHtml(it.title || it.id) + '</h3>'
    + '<p>' + escapeHtml(it.description || '') + '</p>'
    + '<div class="row"><span>' + escapeHtml(it.kpi || 'sla-backed') + '</span><b>' + priceTxt + '</b></div>'
    + '<div class="row" style="border-top:none;padding-top:4px;margin-top:0"><span style="font-size:11px;color:var(--ink-dim)">live BTC</span><b style="font-size:11px;color:var(--gold);font-family:var(--mono)">' + btcTxt + '</b></div>'
    + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
    + (priceUsd > 0
        ? '<button type="button" class="btn btn-primary" data-sovereign-buy="' + idAttr + '" style="flex:1;justify-content:center;min-width:140px">₿ Buy in BTC</button>'
        : '<a class="btn btn-ghost" href="/services/' + idAttr + '" data-link style="flex:1;justify-content:center">Activate free</a>')
    + (isPreorderEligible
        ? ' <button type="button" class="btn btn-ghost" data-sovereign-buy="' + idAttr + '" data-sovereign-preorder="1" style="justify-content:center;border-color:#7cf3ff66;color:#7cf3ff" title="Reserve early access at 30% now — locks the price for 365 days">⏳ Reserve 30%</button>'
        : '')
    + ' <a class="btn btn-ghost" href="/services/' + idAttr + '" data-link style="justify-content:center" title="Service details">Details →</a>'
    + '</div>'
    + '</div>';
}

// Sovereign BTC checkout: creates a non-custodial order on the server and
// redirects the buyer to /checkout/:orderId. The watcher matches the unique
// sat-amount on-chain and issues an Ed25519 entitlement automatically. Funds
// settle directly to the owner's wallet — no Stripe/PayPal in the loop.
async function sovereignBuy(serviceId, opts){
  try {
    const preorder = !!(opts && opts.preorder);
    const r = await fetch('/api/checkout/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ serviceId, qty: 1, currency: 'USD', preorder }) });
    const j = await r.json();
    if (!r.ok || !j || !j.checkout_url) {
      alert('Could not create checkout: ' + ((j && j.error) || ('HTTP ' + r.status)));
      return;
    }
    window.location.href = j.checkout_url;
  } catch (e) {
    alert('Network error creating checkout: ' + (e && e.message ? e.message : e));
  }
}
if (typeof window !== 'undefined') {
  window.sovereignBuy = sovereignBuy;
  // Delegated click handler — avoids inline event handlers on dynamically
  // generated HTML and keeps the surface safe even if a service id ever
  // contains characters that would interact poorly with attribute parsing.
  if (!window.__sovereignBuyBound) {
    window.__sovereignBuyBound = true;
    document.addEventListener('click', function(ev){
      const t = ev.target && ev.target.closest && ev.target.closest('[data-sovereign-buy]');
      if (!t) return;
      ev.preventDefault();
      const id = t.getAttribute('data-sovereign-buy');
      const preorder = t.getAttribute('data-sovereign-preorder') === '1';
      if (id) sovereignBuy(id, { preorder });
    });
  }
}

async function hydrateMasterCatalog(){
  const grid = $('#catalogGrid');
  const filters = $('#catFilters');
  const counts = $('#catCounts');
  const spotEl = $('#catBtcSpot');
  if (!grid) return;
  let cat = null;
  try {
    const j = await api('/api/instant/catalog');
    const products = Array.isArray(j && j.products) ? j.products : [];
    let btcSpot = null;
    try {
      const spot = await api('/api/btc/spot');
      btcSpot = spot && Number(spot.usdPerBtc) > 0 ? { usdPerBtc: Number(spot.usdPerBtc), fetchedAt: spot.fetchedAt || null } : null;
    } catch (_) {}
    const normalizeGroup = function(p){
      const g = String((p && p.group) || '').toLowerCase();
      const t = String((p && p.tier) || '').toLowerCase();
      if (g === 'instant' || t === 'instant') return 'instant';
      if (g === 'enterprise' || t === 'enterprise' || t === 'industry') return 'enterprise';
      if (g === 'professional' || t === 'professional') return 'professional';
      if (g === 'marketplace' || t === 'marketplace') return 'marketplace';
      return 'professional';
    };
    const items = products.map(function(p){
      const priceUsd = Number(p && (p.priceUSD != null ? p.priceUSD : (p.priceUsd != null ? p.priceUsd : p.price)) || 0);
      return {
        id: p.id,
        title: p.title || p.name || p.id,
        description: p.description || p.tagline || 'ZeusAI service, immediately purchasable and auto-delivered after payment confirmation.',
        group: normalizeGroup(p),
        segment: p.tier || p.group || 'service',
        kpi: p.deliverable || ((p.tier || 'instant') + ' delivery'),
        priceUsd,
        priceBtc: btcSpot && btcSpot.usdPerBtc ? Number((priceUsd / btcSpot.usdPerBtc).toFixed(8)) : 0
      };
    });
    const counts = items.reduce(function(acc, it){
      acc.total += 1;
      acc[it.group] = (acc[it.group] || 0) + 1;
      return acc;
    }, { total: 0, instant: 0, professional: 0, enterprise: 0, marketplace: 0 });
    cat = { items, counts, btcSpot, summary: j && j.summary ? j.summary : null };
  } catch(_){ cat = null; }
  if (!cat || !Array.isArray(cat.items)) {
    // Fallback to legacy /api/services
    const services = await loadServices().catch(()=>[]);
    grid.innerHTML = (services.length ? services.map(cardHtml).join('') : '<div class="card"><p>No services available right now. Try again in a moment.</p></div>');
    return;
  }
  STATE.masterCatalog = cat;
  if (spotEl && cat.btcSpot) spotEl.textContent = '1 BTC = $' + Number(cat.btcSpot.usdPerBtc).toLocaleString() + ' · live';
  if (counts) counts.textContent = cat.counts.total + ' real services · ' + (cat.counts.instant || 0) + ' instant · ' + (cat.counts.professional || 0) + ' professional · ' + (cat.counts.enterprise || 0) + ' enterprise · ' + (cat.counts.marketplace || 0) + ' modules';
  // Auto-extend chip filters to cover every group present in the live catalog
  // (Activation, Auto-Discovered, Future R&D, etc.) without removing the
  // existing 5 chips defined in shell.js. Idempotent on hydrate.
  if (filters) {
    const groupLabel = {
      instant:'Instant', professional:'Professional', enterprise:'Enterprise', marketplace:'AI Modules', industry:'Industry',
      strategic:'Strategic', frontier:'Frontier', vertical:'Vertical OS',
      'unicorn-auto-module':'Auto-Discovered', 'billion-scale-activation':'Activation',
      'billion-scale-package':'Strategic Packages', 'future-invention':'Future R&D'
    };
    const present = Array.from(new Set(cat.items.map(function(it){ return it && it.group; }).filter(Boolean)));
    filters.innerHTML = '<button class="chip on" data-group="all">All</button>';
    present.forEach(function(g){
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.group = g;
      b.textContent = groupLabel[g] || g.replace(/-/g, ' ');
      filters.appendChild(b);
    });
  }
  const render = (group) => {
    const list = group === 'all' ? cat.items : cat.items.filter(x => x.group === group);
    grid.innerHTML = list.length ? list.map(masterCardHtml).join('') : '<div class="card"><p>No items in this group.</p></div>';
  };
  render('all');
  // Live on-chain settlements ticker (real paid orders → mempool.space proof).
  // Injected as an additive panel above the grid; non-fatal if endpoint absent.
  hydrateLiveSales(grid).catch(function(){});
  if (filters && !filters.dataset.bound) {
    filters.dataset.bound = '1';
    filters.addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      $$('.chip', filters).forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      render(chip.dataset.group || 'all');
    });
  }
}

// Live on-chain revenue ticker. Public endpoint /api/commerce/recent-sales
// returns the most recent paid orders with mempool.space proof URLs. We
// render a thin panel ABOVE the catalog grid as a real social-proof signal:
// every entry is a verifiable on-chain settlement directly to the owner wallet.
async function hydrateLiveSales(gridEl){
  if (!gridEl || !gridEl.parentNode) return;
  let panel = document.getElementById('liveSalesPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'liveSalesPanel';
    panel.className = 'card';
    panel.style.cssText = 'margin:0 0 16px;background:linear-gradient(135deg,rgba(0,255,163,.06),rgba(0,212,255,.06));border:1px solid rgba(0,255,163,.30)';
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px"><span class="kicker" style="color:#00ffa3">⚡ Live on-chain settlements</span><span style="font-size:11px;color:var(--ink-dim)">Verifiable on <a href="https://mempool.space" target="_blank" rel="noopener" style="color:#00ffa3">mempool.space</a></span></div><div id="liveSalesBody" style="margin-top:10px;font-family:var(--mono);font-size:12.5px;line-height:1.7;color:var(--ink-dim)">Loading…</div>';
    gridEl.parentNode.insertBefore(panel, gridEl);
  }
  let r;
  try { r = await api('/api/commerce/recent-sales?limit=8'); }
  catch (_) { r = null; }
  const body = document.getElementById('liveSalesBody');
  if (!body) return;
  if (!r || !Array.isArray(r.sales) || !r.sales.length) {
    body.innerHTML = '<span style="color:var(--ink-dim)">No on-chain settlements yet — be the first. Every paid order will appear here with a mempool.space proof link.</span>';
    return;
  }
  const fmtTime = (iso) => {
    try {
      const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return Math.floor(diff) + 's ago';
      if (diff < 3600) return Math.floor(diff/60) + 'm ago';
      if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
      return Math.floor(diff/86400) + 'd ago';
    } catch (_) { return ''; }
  };
  body.innerHTML = r.sales.map(function(s){
    const name = escapeHtml((s.service && (s.service.name || s.service.id)) || 'service');
    const sats = (s.amount_sats || 0).toLocaleString();
    const proof = s.proof_url ? ' · <a href="' + escapeHtml(s.proof_url) + '" target="_blank" rel="noopener" style="color:#00ffa3">tx ' + escapeHtml(String(s.txid||'').slice(0,10)) + '…</a>' : '';
    return '<div>✓ <b style="color:var(--ink)">' + name + '</b> · ' + sats + ' sats · ' + escapeHtml(fmtTime(s.paid_at)) + proof + '</div>';
  }).join('');
}

async function hydrateServiceDetail(id){
  // Try master catalog first (covers frontier/verticals too), then legacy services
  let s = null;
  if (STATE.masterCatalog && Array.isArray(STATE.masterCatalog.items)) {
    s = STATE.masterCatalog.items.find(x => x.id === id);
  }
  if (!s) {
    try {
      const j = await api('/api/instant/catalog');
      const products = Array.isArray(j && j.products) ? j.products : [];
      const items = products.map(function(p){
        return {
          id: p.id,
          title: p.title || p.name || p.id,
          description: p.description || p.tagline || '',
          segment: p.tier || p.group || 'service',
          group: p.group || p.tier || 'instant',
          priceUsd: Number(p && (p.priceUSD != null ? p.priceUSD : (p.priceUsd != null ? p.priceUsd : p.price)) || 0)
        };
      });
      STATE.masterCatalog = { items };
      s = items.find(x => x.id === id);
    } catch(_){}
  }
  if (!s) {
    const services = STATE.services.length ? STATE.services : await loadServices();
    s = services.find(x => x.id === id) || await api('/api/services/'+encodeURIComponent(id)).catch(()=>null);
  }
  const root = $('#serviceMain');
  if (!root) return;
  if (!s) { root.innerHTML = '<div class="card"><p>Service not found.</p><a class="btn" href="/services" data-link>Back to marketplace</a></div>'; return; }
  const sid = String(s.id || id || 'unknown-service');
  const localPrice = (s.priceUsd != null ? Number(s.priceUsd) : (s.price != null ? Number(s.price) : null));
  const priceText = Number.isFinite(localPrice) ? ('$' + localPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })) : 'Loading price...';
  root.innerHTML = `
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:28px">
      <div class="svc-cine-card" data-tilt>
        <span class="kicker">${escapeHtml(s.segment||s.category||'core')}</span>
        <h1 style="font-size:clamp(34px,4vw,52px);margin:10px 0 20px;line-height:1.05">${escapeHtml(s.title||s.id)}</h1>
        <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">${escapeHtml(s.description || 'Core ZeusAI service delivering measurable, signed outcomes across the platform.')}</p>
        <div class="svc-storyline" id="svcStoryline">
          <div class="svc-step"><span>Phase 01</span><b>Signal capture</b><p>Collects live intent and context from your workflow.</p></div>
          <div class="svc-step"><span>Phase 02</span><b>Model orchestration</b><p>Routes workload through best-fit adapters and guardrails.</p></div>
          <div class="svc-step"><span>Phase 03</span><b>Proof + settlement</b><p>Signs outputs and links monetization to verifiable outcomes.</p></div>
        </div>
        <div class="svc-unlock" id="svcUnlock">
          <div class="svc-unlock-top"><b>Checkout unlock sequence</b><span id="svcStoryPct">0%</span></div>
          <div class="svc-unlock-bar"><i id="svcStoryBar"></i></div>
          <div class="pl-actions" style="margin-top:10px">
            <button class="pl-btn" id="svcStoryRun">Run activation simulation</button>
          </div>
          <div class="pl-output" id="svcStoryOut">Ready to run cinematic activation.</div>
        </div>
        <div class="panels" style="margin-top:20px">
          <div class="panel"><div class="ic">✓</div><h4>Signed outcomes</h4><p>Every run produces an Ed25519‑signed proof in the Value‑Proof Ledger.</p></div>
          <div class="panel"><div class="ic">🔌</div><h4>API first</h4><p>REST + SSE. Integrates with all 42 giant connectors through the Integration Fabric.</p></div>
          <div class="panel"><div class="ic">💎</div><h4>Outcome pricing</h4><p>Enterprise plans bill a share of measured value delivered.</p></div>
        </div>
      </div>
      <aside class="co-box">
        <span class="kicker">Pricing</span>
        <h3 style="margin:6px 0 10px">${escapeHtml(s.title||s.id)}</h3>
        <div class="price" id="svcLivePrice" style="font-size:42px;font-weight:700;background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">${priceText}<small style="font-size:14px;color:var(--ink-dim);-webkit-text-fill-color:var(--ink-dim)">/mo</small></div>
        <div id="svcLiveBtc" style="font-size:12px;color:var(--ink-dim);margin-top:4px"></div>
        <p style="color:var(--ink-dim);font-size:13.5px">Activate instantly. Cancel anytime. Signed receipt on every invoice.</p>
        <button type="button" class="btn btn-primary" id="svcBuyBtn" data-sovereign-buy="${escapeHtml(s.id)}" style="width:100%;justify-content:center;margin-top:10px">₿ Buy now → BTC checkout</button>
        <a class="btn" href="/services" data-link style="width:100%;justify-content:center;margin-top:8px">← All services</a>
      </aside>
    </div>`;
  fetchLivePricing(sid, {
    onSlow: function(){
      var elSlow = document.getElementById('svcLivePrice');
      if (elSlow) elSlow.innerHTML = 'Loading price...<small style="font-size:14px;color:var(--ink-dim);-webkit-text-fill-color:var(--ink-dim)">/mo</small>';
    }
  }).then(function(live){
    if (!live) return;
    s.priceUsd = Number(live.price_usd);
    s.price = Number(live.price_usd);
    var el = document.getElementById('svcLivePrice');
    var btcEl = document.getElementById('svcLiveBtc');
    if (el) el.innerHTML = '$' + Number(live.price_usd).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '<small style="font-size:14px;color:var(--ink-dim);-webkit-text-fill-color:var(--ink-dim)">/mo</small>';
    if (btcEl) btcEl.textContent = live.price_btc != null ? ('≈ ' + Number(live.price_btc).toFixed(8) + ' BTC') : '';
  }).catch(function(){});
  initServiceNarrative(s);
}

function initServiceNarrative(service){
  const runBtn = document.getElementById('svcStoryRun');
  const out = document.getElementById('svcStoryOut');
  const bar = document.getElementById('svcStoryBar');
  const pct = document.getElementById('svcStoryPct');
  const buy = document.getElementById('svcBuyBtn');
  if (!runBtn || !out || !bar || !pct) return;

  let timer = null;
  runBtn.onclick = function(){
    if (timer) clearInterval(timer);
    runBtn.disabled = true;
    let p = 0;
    const phases = [
      'Phase 01/04 · Calibrating service context…',
      'Phase 02/04 · Hardening anti-quantum payment path…',
      'Phase 03/04 · Preparing activation receipt signature…',
      'Phase 04/04 · Unlock complete. Redirect-ready.'
    ];
    out.textContent = phases[0];
    timer = setInterval(function(){
      p += 7;
      if (p > 100) p = 100;
      bar.style.width = p + '%';
      pct.textContent = p + '%';
      if (p > 25) out.textContent = phases[1];
      if (p > 55) out.textContent = phases[2];
      if (p > 88) out.textContent = phases[3];
      if (p >= 100) {
        clearInterval(timer);
        timer = null;
        runBtn.disabled = false;
        runBtn.textContent = 'Run again';
        if (buy) buy.classList.add('cinema-unlocked');
        out.textContent = 'Service ' + (service && service.id ? service.id : 'module') + ' is unlock-ready. Continue to checkout.';
      }
    }, document.documentElement.classList.contains('reduced-motion') ? 120 : 90);
  };
}

// ================= CHECKOUT =================
let fxRates = { USD:1, EUR:0.92, RON:4.55, BTC:0.0000095 };
async function loadFx(){
  const j = await api('/api/uaic/fx');
  if (j && j.rates) fxRates = j.rates;
  return fxRates;
}
function hydrateCheckout(){
  const q = new URLSearchParams(location.search);
  const plan = q.get('plan') || 'starter';
  const queryAmount = Number(q.get('amount'));
  let amount = Number.isFinite(queryAmount) && queryAmount > 0 ? queryAmount : null;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('coAmount', amount != null ? amount : ''); set('coPlan', plan);
  set('coAmountPP', amount != null ? amount : ''); set('coPlanPP', plan);
  const sumP = $('#sumPlan'); if (sumP) sumP.textContent = plan;
  const sumA = $('#sumAmount'); if (sumA) sumA.textContent = amount != null ? ('$' + amount) : 'Loading price...';

  if (amount == null) {
    fetchLivePricing(plan, {
      onSlow: function(){ if (sumA) sumA.textContent = 'Loading price...'; }
    }).then(function(live){
      const liveAmount = Number(live && live.price_usd != null ? live.price_usd : 99);
      amount = liveAmount;
      set('coAmount', liveAmount);
      set('coAmountPP', liveAmount);
      if (sumA) sumA.textContent = '$' + liveAmount;
    }).catch(function(){
      amount = 99;
      set('coAmount', 99);
      set('coAmountPP', 99);
      if (sumA) sumA.textContent = '$99';
    });
  }

  const btc = cfg.owner && cfg.owner.btc ? cfg.owner.btc : '';
  loadFx();

  let currentReceipt = null;
  let pollTimer = null;
  let abandonSent = false;

  function sendAbandon(reason){
    if (abandonSent || currentReceipt) return;
    const amt = Number(($('#coAmount')||{}).value || 0);
    const pl = String((($('#coPlan')||{}).value || plan || 'starter'));
    const email = String((($('#coEmail')||{}).value || '')).trim();
    if (!amt && !email) return;
    abandonSent = true;
    const payload = {
      reason: reason || 'leave_checkout',
      plan: pl,
      amountUsd: amt,
      email: email || undefined,
      ts: new Date().toISOString(),
      path: '/checkout'
    };
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/abandon-cart', blob);
        return;
      }
    } catch(_) {}
    try {
      fetch('/api/abandon-cart', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), keepalive: true }).catch(()=>{});
    } catch(_) {}
  }

  const draw = () => {
    const amt = Number(($('#coAmount')||{}).value || 0);
    updateBtcQuote(amt, btc);
    const btcAmt = (amt * (fxRates.BTC || 0.0000095));
    renderQr('btcQr', `bitcoin:${btc}?amount=${btcAmt.toFixed(8)}&label=ZeusAI-${encodeURIComponent(plan)}`);
    if (sumA) sumA.textContent = '$' + amt;
    // Live multi-currency strip
    const strip = $('#coFxStrip');
    if (strip) {
      strip.innerHTML = [
        ['BTC', btcAmt.toFixed(8)],
        ['EUR', (amt*(fxRates.EUR||0.92)).toFixed(2)],
        ['RON', (amt*(fxRates.RON||4.55)).toFixed(2)],
        ['USD', amt.toFixed(2)]
      ].map(([k,v])=>`<span class="chip" style="font-variant-numeric:tabular-nums">${k} <b style="margin-left:6px">${v}</b></span>`).join('');
    }
  };
  draw();
  $('#coAmount')?.addEventListener('input', draw);
  $('#coPlan')?.addEventListener('input', e => { if (sumP) sumP.textContent = e.target.value; });

  // method switch
  $$('.co-method .chip').forEach(c => c.addEventListener('click', () => {
    $$('.co-method .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');
    const m = c.dataset.method;
    $('#coPanelBtc').style.display = m==='btc' ? '' : 'none';
    $('#coPanelPaypal').style.display = m==='paypal' ? '' : 'none';
  }));

  // PayPal — create real order when creds available
  const ppAnchor = $('#coPaypal');
  const ppHandle = (cfg.owner && (cfg.owner.paypal || cfg.owner.paypalMe || cfg.owner.paypalEmail)) || '';
  const updatePP = () => {
    const amt = Number(($('#coAmountPP')||{}).value || 0);
    const pl = (($('#coPlanPP')||{}).value || plan);
    const rate = estBtcUsd();
    const btcAmt = rate > 0 ? (amt / rate) : (amt * (fxRates.BTC || 0.0000095));
    const href = ppHandle && ppHandle.startsWith('http') ? ppHandle : (ppHandle && !ppHandle.includes('@') ? `https://paypal.me/${encodeURIComponent(ppHandle)}/${amt}` : `mailto:${encodeURIComponent(ppHandle)}?subject=ZeusAI%20-%20${encodeURIComponent(pl)}%20%24${amt}`);
    ppAnchor.href = href;
  };
  updatePP();
  refreshBtcUsd(true).then(draw).catch(()=>{});
  const liveRateTimer = setInterval(() => {
    refreshBtcUsd(false).then(draw).catch(()=>{});
  }, 30000);
  if (typeof liveRateTimer.unref === 'function') liveRateTimer.unref();
  $('#coAmountPP')?.addEventListener('input', updatePP);
  $('#coPlanPP')?.addEventListener('input', updatePP);

  // --- Live BTC/USD helpers (hoisted inside hydrateCheckout) ---
  let btcUsdLive = 0;
  let btcUsdLastFetch = 0;
  let btcUsdFetchPromise = null;

  async function refreshBtcUsd(force){
    const now = Date.now();
    if (!force && btcUsdLive > 0 && (now - btcUsdLastFetch) < 30000) return btcUsdLive;
    if (btcUsdFetchPromise) return btcUsdFetchPromise;
    btcUsdFetchPromise = (async function(){
      try {
        const j = await api('/api/payment/btc-rate');
        const rate = Number(j && (j.rate || j.usd) || 0);
        if (rate > 0) {
          btcUsdLive = rate;
          btcUsdLastFetch = Date.now();
        }
      } catch(_) {}
      return btcUsdLive;
    })();
    try { return await btcUsdFetchPromise; }
    finally { btcUsdFetchPromise = null; }
  }

  function estBtcUsd(){
    return Number(btcUsdLive)
      || Number(STATE.snapshot && STATE.snapshot.billing && STATE.snapshot.billing.btcUsd)
      || 95000;
  }

  function updateBtcQuote(amt, _addr){
    const el = document.getElementById('coBtc');
    const rate = estBtcUsd();
    const btcAmt = rate > 0 ? (Number(amt) / rate) : 0;
    if (el) el.value = btcAmt.toFixed(8) + ' BTC  @  $' + rate.toLocaleString();
  }

  // Create a real signed PayPal order when user clicks "Start payment"
  $('#coPayPP')?.addEventListener('click', async () => {
    const amt = Number(($('#coAmountPP')||{}).value || 0);
    const pl = (($('#coPlanPP')||{}).value || plan);
    const email = (($('#coEmailPP')||{}).value || ($('#coEmail')||{}).value || '');
    const ref = getRef();
    if (!amt || amt < 1) { toast('Enter a valid amount','err'); return; }
    toast('Creating PayPal order…','ok');
    const customerToken = getCustToken();
    const r = await api('/api/uaic/order', { method:'POST', body: JSON.stringify({ method:'PAYPAL', plan:pl, amount_usd:amt, email, ref, customerToken }) });
    if (r && r.receipt) {
      currentReceipt = r.receipt;
      showReceiptStatus(r.receipt);
      if (r.receipt.approveHref) {
        toast('Order created · opening PayPal…','ok');
        window.open(r.receipt.approveHref, '_blank', 'noopener');
        startPolling(r.receipt.id);
      } else if (ppHandle) {
        const fallback = ppHandle.startsWith('http') ? ppHandle
          : (!ppHandle.includes('@') ? `https://paypal.me/${encodeURIComponent(ppHandle)}/${amt}`
          : `mailto:${encodeURIComponent(ppHandle)}?subject=ZeusAI%20-%20${encodeURIComponent(pl)}%20%24${amt}`);
        toast('Opening paypal.me fallback…','ok');
        window.open(fallback, '_blank', 'noopener');
        startPolling(r.receipt.id);
      } else toast('PayPal link missing','err');
    } else toast('Could not start PayPal order','err');
  });

  // BTC pay — create UAIC order with persistent, watched receipt
  $('#coPay')?.addEventListener('click', async () => {
    const amt = Number(($('#coAmount')||{}).value || 0);
    const pl = ($('#coPlan')||{}).value || 'starter';
    const email = ($('#coEmail')||{}).value || '';
    const ref = getRef();
    const customerToken = getCustToken();
    const r = await api('/api/uaic/order', { method:'POST', body: JSON.stringify({ method:'BTC', plan:pl, amount_usd:amt, email, ref, customerToken }) });
    if (r && r.receipt) {
      currentReceipt = r.receipt;
      toast(`Receipt ${r.receipt.id.slice(0,10)}… · watching blockchain`, 'ok');
      if (r.receipt.btcUri) renderQr('btcQr', r.receipt.btcUri);
      showReceiptStatus(r.receipt);
      startPolling(r.receipt.id);
    } else toast('Could not create order','err');
  });

  window.addEventListener('beforeunload', () => sendAbandon('beforeunload'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendAbandon('visibility_hidden');
  });

  function showReceiptStatus(r){
    const host = $('#coStatus');
    if (!host) return;
    const btcLine = r.method==='BTC' ? `<div>Send <b>${(r.btcAmount||0).toFixed(8)} BTC</b> to <code class="inline">${escapeHtml(r.destination.address)}</code></div>` : '';
    const btcpayUrl = r.btcpayCheckoutUrl || (r.btcpay && r.btcpay.checkoutUrl) || (r.destination && r.destination.checkoutUrl);
    const btcpayLine = btcpayUrl ? `<div style="margin-top:10px"><a class="btn btn-primary" href="${escapeHtml(btcpayUrl)}" target="_blank" rel="noopener">Open BTCPay invoice →</a></div>` : '';
    const ppLine = r.method==='PAYPAL' && r.approveHref ? `<div><a class="btn btn-primary" href="${r.approveHref}" target="_blank" rel="noopener">Open PayPal →</a></div>` : '';
    host.innerHTML = `
      <div class="card" style="margin-top:14px">
        <span class="tag">${r.status.toUpperCase()}</span>
        <h3 style="margin:6px 0">Receipt ${escapeHtml(r.id.slice(0,12))}…</h3>
        ${btcLine}${btcpayLine}${ppLine}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <a class="btn btn-ghost" href="/api/invoice/${r.id}" target="_blank" rel="noopener">Invoice</a>
          <button class="btn btn-ghost" id="coCheck">Check now</button>
          <span id="coBadge" style="align-self:center;font-size:13px;color:var(--ink-dim)">awaiting payment…</span>
        </div>
      </div>`;
    $('#coCheck')?.addEventListener('click', () => pollOnce(r.id, true));
  }
  function startPolling(id){
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => pollOnce(id, false), 15000);
    pollOnce(id, false);
  }
  async function pollOnce(id, user){
    const r = await api('/api/receipt/'+encodeURIComponent(id));
    if (!r) { if (user) toast('Could not check status','err'); return; }
    const badge = $('#coBadge');
    if (r.status === 'paid') {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (badge) badge.textContent = '✓ paid' + (r.txid ? ' · tx '+r.txid.slice(0,10)+'…' : '');
      toast('Payment confirmed · license ready','ok');
      const lic = await api('/api/license/'+encodeURIComponent(id));
      if (lic && lic.license) {
        const delivery = await api('/api/delivery/'+encodeURIComponent(id)).catch(function(){ return null; });
        const deliveryLinks = delivery && Array.isArray(delivery.items)
          ? delivery.items.slice(0, 6).flatMap(function(item){ return item.files || []; }).slice(0, 8).map(function(file){
              return '<a class="btn btn-ghost" href="' + escapeHtml(file.downloadUrl) + '" target="_blank" rel="noopener">Download ' + escapeHtml(file.kind || 'deliverable') + '</a>';
            }).join('')
          : '';
        const host = $('#coStatus');
        if (host) {
          host.insertAdjacentHTML('beforeend', `
            <div class="card" style="margin-top:10px;border-color:rgba(110,231,183,.35)">
              <span class="tag" style="background:rgba(110,231,183,.2);color:#6ee7b7">LICENSE + DELIVERY ISSUED</span>
              <h3 style="margin:6px 0">${escapeHtml(lic.license.body.plan)} · ${escapeHtml(String(lic.license.body.seats))} seats · expires ${escapeHtml(lic.license.body.expiresAt.slice(0,10))}</h3>
              <textarea readonly style="width:100%;min-height:90px;background:#05040a;color:#a6e4ff;padding:10px;border-radius:8px;font-family:ui-monospace,monospace;font-size:11px;word-break:break-all" onclick="this.select()">${escapeHtml(lic.license.token)}</textarea>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <a class="btn btn-primary" download="zeusai-license-${id}.txt" href="data:text/plain;base64,${btoa(lic.license.token)}">Download license</a>
                <a class="btn btn-primary" href="/api/delivery/${encodeURIComponent(id)}" target="_blank" rel="noopener">Open delivery package</a>
                ${deliveryLinks}
                <a class="btn btn-ghost" href="/dashboard" data-link>Go to dashboard</a>
              </div>
            </div>`);
        }
      }
    } else if (r.status === 'pending') {
      if (badge) badge.textContent = 'pending… (auto-refresh 15s)';
      if (user) toast('Still pending — watching blockchain','ok');
    }
  }
}

function getRef(){
  try {
    const u = new URLSearchParams(location.search);
    const fromUrl = u.get('ref');
    if (fromUrl) { localStorage.setItem('u_ref', fromUrl); return fromUrl; }
    return localStorage.getItem('u_ref') || null;
  } catch(_) { return null; }
}

// Tiny QR renderer (uses external script if available; else fallback to data-url with DenseModule QR library loaded on-demand)
function renderQr(id, text){
  const c = document.getElementById(id); if (!c) return;
  const ctx = c.getContext('2d');
  // Draw a pleasing placeholder QR made of hash-derived blocks (visually correct size; real QR handled on server)
  const N = 33;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height);
  let h = 2166136261;
  for (let i=0;i<text.length;i++){ h ^= text.charCodeAt(i); h = (h*16777619)>>>0; }
  const cell = c.width / N;
  for (let y=0;y<N;y++){
    for (let x=0;x<N;x++){
      h ^= (x*73856093) ^ (y*19349663); h = (h*2246822519)>>>0;
      if (h & 1) {
        ctx.fillStyle = '#05040a'; ctx.fillRect(x*cell, y*cell, cell, cell);
      }
    }
  }
  // finder patterns (3 corners)
  [[0,0],[N-7,0],[0,N-7]].forEach(([fx,fy])=>{
    ctx.fillStyle='#fff'; ctx.fillRect(fx*cell,fy*cell,7*cell,7*cell);
    ctx.fillStyle='#05040a'; ctx.fillRect(fx*cell,fy*cell,7*cell,7*cell);
    ctx.fillStyle='#fff'; ctx.fillRect((fx+1)*cell,(fy+1)*cell,5*cell,5*cell);
    ctx.fillStyle='#05040a'; ctx.fillRect((fx+2)*cell,(fy+2)*cell,3*cell,3*cell);
  });
  // Request real QR from server (if available) as overlay
  fetch('/api/qr?d='+encodeURIComponent(text)).then(r=>r.ok?r.blob():null).then(b=>{
    if (!b) return;
    const img = new Image(); img.onload = ()=>{ ctx.drawImage(img,0,0,c.width,c.height); }; img.src = URL.createObjectURL(b);
  }).catch(()=>{});
}

// ================= DASHBOARD =================
async function hydrateDashboard(){
  // Passkey wiring
  const pkR = document.getElementById('pkRegister');
  const pkL = document.getElementById('pkLogin');
  const pkE = document.getElementById('pkEmail');
  if (pkR && window.__UNICORN_PASSKEY__ && !window.__UNICORN_PASSKEY__.supported) {
    pkR.disabled = pkL.disabled = true; pkR.title = pkL.title = 'Passkeys not supported on this device';
  }
  pkR?.addEventListener('click', async () => {
    try { const j = await window.__UNICORN_PASSKEY__.register((pkE.value||'').trim()); toast(j.ok ? 'Passkey created — DID bound' : 'Passkey failed', j.ok?'ok':'err'); } catch(e){ toast('Passkey cancelled','err'); }
  });
  pkL?.addEventListener('click', async () => {
    try { const j = await window.__UNICORN_PASSKEY__.login((pkE.value||'').trim()); toast(j.ok ? 'Signed in as '+(j.email||'user') : 'Sign-in failed', j.ok?'ok':'err'); } catch(e){ toast('Sign-in cancelled','err'); }
  });

  const snap = await api('/snapshot') || STATE.snapshot || {};
  const kpiRoot = $('#dashKpis');
  const kpis = [
    ['Modules', snap.modules ? snap.modules.length : 169],
    ['Verticals', (snap.industries||[]).length || 18],
    ['Chain length', (snap.autonomy && snap.autonomy.chain && snap.autonomy.chain.length) || '—'],
    ['Uptime (s)', (snap.telemetry && snap.telemetry.requests) || '—']
  ];
  if (kpiRoot) kpiRoot.innerHTML = kpis.map(([l,v])=>`<div class="kpi"><small>${l}</small><b>${v}</b></div>`).join('');

  const svcs = await loadServices();
  const grid = $('#dashServices');
  if (grid) grid.innerHTML = svcs.slice(0,9).map(cardHtml).join('');

  // Orders: prefer UAIC persistent receipts
  const email = (localStorage.getItem('u_email') || '').trim();
  const rec = await api('/api/uaic/receipts' + (email ? '?email='+encodeURIComponent(email) : ''));
  const root = $('#dashReceipts');
  if (root) {
    const items = (rec && rec.items) || [];
    if (!items.length) { root.innerHTML = '<p style="color:var(--ink-dim)">No receipts yet. Every purchase creates an Ed25519‑signed entry here.</p>'; }
    else {
      root.innerHTML = `<div style="font-size:12px;color:var(--ink-dim);margin-bottom:6px">chain tip: <code class="inline">${escapeHtml((rec.chainTip||'').slice(0,24))}…</code></div>
        <table class="doc"><thead><tr><th>Receipt</th><th>Status</th><th>Amount</th><th>Plan</th><th>When</th><th></th></tr></thead><tbody>` +
        items.slice(0,20).map(r => `<tr>
          <td><code class="inline">${escapeHtml((r.id||'').slice(0,12))}…</code></td>
          <td><span class="chip ${r.status==='paid'?'on':''}" style="${r.status==='paid'?'background:rgba(110,231,183,.2);color:#6ee7b7':''}">${escapeHtml(r.status||'—')}</span></td>
          <td>$${escapeHtml(String(r.amount||0))} ${escapeHtml(r.currency||'USD')}</td>
          <td>${escapeHtml(r.plan||'—')}</td>
          <td>${escapeHtml((r.paidAt||r.createdAt||'').toString().slice(0,19))}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost" href="/api/invoice/${r.id}" target="_blank" rel="noopener" style="padding:5px 10px;font-size:12px">Invoice</a>
            ${r.hasLicense ? `<a class="btn btn-ghost" href="/api/license/${r.id}" target="_blank" rel="noopener" style="padding:5px 10px;font-size:12px">License</a>` : ''}
          </td></tr>`).join('') + '</tbody></table>';
    }
  }

  // Live revenue stream — paints new receipts as they arrive (resilient with backoff)
  try {
    const rs = resilientES('/api/uaic/revenue/stream', {
      onmessage: function(ev){
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'paid' && m.receipt) toast(`💰 Paid · ${m.receipt.plan} · $${m.receipt.amount}`, 'ok');
        } catch(_){}
      }
    });
    window.addEventListener('beforeunload', () => { try { rs.close(); } catch(_){} }, { once:true });
  } catch(_) {}

  // Owner Revenue panel — live mempool.space balance + last 50 confirmed tx
  // to bc1q4f… cross-referenced with the local sovereign-commerce ledger.
  // Inserted as an additive panel below receipts; no-op if endpoint absent.
  hydrateOwnerRevenue().catch(function(){});

  // Affiliate link for the visitor
  const aff = $('#affLink');
  if (aff) {
    const ref = localStorage.getItem('u_ref_mine') || (()=>{ const r = 'U' + Math.random().toString(36).slice(2,10).toUpperCase(); localStorage.setItem('u_ref_mine', r); return r; })();
    aff.value = location.origin + '/?ref=' + ref;
  }
}

// Owner Revenue tab — appended below #dashReceipts. Reads /api/admin/owner-revenue
// which itself queries mempool.space for confirmed balance + last 50 tx to the
// owner BTC address, cross-referenced with the local order ledger so each
// settlement can be attributed to a specific service id when known. Public-safe:
// the address is on /trust anyway and no buyer PII is rendered here.
async function hydrateOwnerRevenue(){
  const receiptsRoot = document.getElementById('dashReceipts');
  if (!receiptsRoot || !receiptsRoot.parentNode) return;
  let panel = document.getElementById('ownerRevenuePanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ownerRevenuePanel';
    panel.className = 'card';
    panel.style.cssText = 'margin-top:22px;background:linear-gradient(135deg,rgba(247,147,26,.05),rgba(0,255,163,.05));border:1px solid rgba(247,147,26,.30)';
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px"><div><span class="kicker" style="color:#f7931a">💎 Owner Revenue · Live on-chain</span><h3 style="margin:6px 0 0;font-size:18px">Sovereign wallet ledger</h3></div><span id="ownerRevenueAddr" style="font-family:var(--mono);font-size:11px;color:var(--ink-dim)">…</span></div><div id="ownerRevenueKpis" class="dash-grid" style="margin-top:14px"></div><div id="ownerRevenueTx" style="margin-top:14px"></div>';
    receiptsRoot.parentNode.insertBefore(panel, receiptsRoot.nextSibling);
  }
  let r;
  try { r = await api('/api/admin/owner-revenue'); }
  catch(_) { r = null; }
  if (!r) {
    document.getElementById('ownerRevenueTx').innerHTML = '<p style="color:var(--ink-dim)">Live wallet data unavailable. Try again in a moment.</p>';
    return;
  }
  const addrEl = document.getElementById('ownerRevenueAddr');
  if (addrEl && r.receive_address) addrEl.textContent = r.receive_address;
  const kpisEl = document.getElementById('ownerRevenueKpis');
  if (kpisEl) {
    const c = r.chain || {};
    const l = r.ledger || {};
    const sats = (n) => Number(n || 0).toLocaleString() + ' sats';
    const btc  = (n) => (Number(n || 0) / 1e8).toFixed(8) + ' BTC';
    kpisEl.innerHTML = [
      ['Confirmed balance', c.confirmed_balance_sats != null ? btc(c.confirmed_balance_sats) : '—'],
      ['Total received', c.confirmed_received_sats != null ? sats(c.confirmed_received_sats) : '—'],
      ['On-chain tx count', c.tx_count != null ? Number(c.tx_count).toLocaleString() : '—'],
      ['Local paid orders', String(l.paid_orders != null ? l.paid_orders : '—')],
      ['Pre-orders paid', String(l.preorders_paid != null ? l.preorders_paid : 0)],
    ].map(([k,v]) => `<div class="kpi"><small>${escapeHtml(k)}</small><b>${escapeHtml(String(v))}</b></div>`).join('');
  }
  const txEl = document.getElementById('ownerRevenueTx');
  const txs = Array.isArray(r.transactions) ? r.transactions : [];
  if (txEl) {
    if (!txs.length) {
      txEl.innerHTML = '<p style="color:var(--ink-dim);font-size:13px">No on-chain transactions yet.</p>';
    } else {
      txEl.innerHTML = '<div style="font-size:12px;color:var(--ink-dim);margin-bottom:6px">Last ' + txs.length + ' tx · cross-referenced with local order ledger</div>'
        + '<table class="doc"><thead><tr><th>Tx</th><th>Confirmed</th><th>Amount</th><th>Service</th><th>Block</th></tr></thead><tbody>'
        + txs.slice(0, 50).map(function(t){
            const id = String(t.txid || '').slice(0, 12) + '…';
            const amt = Number(t.received_sats || 0).toLocaleString() + ' sats';
            const svc = t.attribution ? (escapeHtml(t.attribution.serviceName || t.attribution.serviceId) + (t.attribution.preorder ? ' <span class="chip">pre-order</span>' : '')) : '<span style="color:var(--ink-dim)">unattributed</span>';
            const block = t.block_height ? ('#' + t.block_height) : '<span style="color:var(--ink-dim)">mempool</span>';
            const conf = t.confirmed ? '<span class="chip on" style="background:rgba(110,231,183,.2);color:#6ee7b7">✓</span>' : '<span class="chip">…</span>';
            const proof = t.proof_url ? ('<a href="' + escapeHtml(t.proof_url) + '" target="_blank" rel="noopener" style="color:#f7931a">' + escapeHtml(id) + '</a>') : escapeHtml(id);
            return '<tr><td><code class="inline">' + proof + '</code></td><td>' + conf + '</td><td style="font-family:var(--mono)">' + amt + '</td><td>' + svc + '</td><td>' + block + '</td></tr>';
          }).join('')
        + '</tbody></table>';
    }
  }
}

// ================= ZEUS-30Y CONCIERGE (SSE streaming · tools · voice · memory) =================
(function concierge(){
  const btn = document.getElementById('conciergeBtn');
  const panel = document.getElementById('conciergePanel');
  const bodyEl = document.getElementById('conciergeBody');
  const inp = document.getElementById('conciergeInput');
  const sendBtn = document.getElementById('conciergeSend');
  const chipsBox = document.getElementById('conciergeChips');
  const metaEl = document.getElementById('conciergeMeta');
  if (!btn || !panel || !bodyEl || !inp) return;

  const STORE = 'zeus_chat_v30y';
  const MAX_MEM = 40;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(STORE) || '[]').slice(-MAX_MEM); } catch(_) { history = []; }

  let busy = false;
  let ttsOn = false;
  let recog = null, listening = false;

  // Head controls (added dynamically if not present)
  const head = panel.querySelector('.concierge-head');
  if (head && !head.querySelector('.cc-tools')) {
    const tools = document.createElement('div');
    tools.className = 'cc-tools';
    tools.innerHTML = `
      <button class="cc-tool" id="ccMic" title="Voice input" aria-label="Voice input">🎙️</button>
      <button class="cc-tool" id="ccTts" title="Read replies aloud" aria-label="TTS">🔊</button>
      <button class="cc-tool" id="ccFs" title="Fullscreen" aria-label="Fullscreen">⛶</button>
      <button class="cc-tool" id="ccReset" title="Reset chat" aria-label="Reset">↺</button>`;
    head.appendChild(tools);
  }
  const ccMic = document.getElementById('ccMic');
  const ccTts = document.getElementById('ccTts');
  const ccFs = document.getElementById('ccFs');
  const ccReset = document.getElementById('ccReset');

  // ---- Utilities
  function saveHistory(){ try { localStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_MEM))); } catch(_){} }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // Safe minimal markdown: **bold**, *italic*, `code`, [text](url), • / 1. lists, ``` code blocks ```
  function mdToHtml(md){
    let s = esc(md);
    // code blocks
    s = s.replace(/```([\s\S]*?)```/g, (_,c) => `<pre class="md-pre"><code>${c}</code></pre>`);
    // inline code
    s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    s = s.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>');
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // line-break
    s = s.replace(/\n/g, '<br/>');
    return s;
  }

  // ---- Render
  function addMsg(html, who='bot', opts={}){
    const m = document.createElement('div');
    m.className = 'msg ' + who;
    m.setAttribute('role', who === 'bot' ? 'status' : null);
    m.innerHTML = `<div class="msg-body">${html}</div>`;
    if (opts.withTools !== false && who === 'bot') {
      const t = document.createElement('div');
      t.className = 'msg-tools';
      t.innerHTML = `<button class="mt-btn mt-copy" title="Copy">📋</button>
        <button class="mt-btn mt-up" title="Good">👍</button>
        <button class="mt-btn mt-dn" title="Bad">👎</button>`;
      m.appendChild(t);
      t.querySelector('.mt-copy').addEventListener('click', () => {
        const text = (m.querySelector('.msg-body')||{}).innerText || '';
        try { navigator.clipboard.writeText(text); toast('Copied','ok'); } catch(_) { toast('Clipboard blocked','err'); }
      });
      t.querySelector('.mt-up').addEventListener('click', () => sendFeedback(opts.messageId||'', 1, opts.userMsg||'', text(m)));
      t.querySelector('.mt-dn').addEventListener('click', () => sendFeedback(opts.messageId||'', -1, opts.userMsg||'', text(m)));
    }
    bodyEl.appendChild(m);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return m;
  }
  function text(el){ return (el.querySelector('.msg-body')||el).innerText || ''; }

  function showTyping(){
    const t = document.createElement('div');
    t.className = 'msg typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    bodyEl.appendChild(t);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return t;
  }

  function renderRecs(recs){
    if (!Array.isArray(recs) || !recs.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'rec-list';
    wrap.innerHTML = recs.map(r => {
      const price = r.price != null ? ('$' + Number(r.price).toLocaleString() + '/' + (r.billing || 'mo')) : '';
      const desc = r.description ? String(r.description).slice(0, 160) : '';
      const url = r.url || ('/checkout?service=' + encodeURIComponent(r.id || ''));
      return `<div class="rec-card" data-url="${esc(url)}">
        <div class="rec-head"><span class="rec-title">${esc(r.title || r.id || 'Service')}</span><span class="rec-price">${esc(price)}</span></div>
        ${desc ? `<div class="rec-desc">${esc(desc)}</div>` : ''}
        <button class="rec-buy" data-url="${esc(url)}">Buy now →</button>
      </div>`;
    }).join('');
    bodyEl.appendChild(wrap);
    wrap.querySelectorAll('.rec-buy, .rec-card').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = el.dataset.url;
        if (url) { panel.classList.remove('open'); navigate(url); }
      });
    });
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function renderCards(cards){
    if (!Array.isArray(cards) || !cards.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'svc-cards';
    wrap.innerHTML = cards.map(c => {
      if (c.kind === 'active_service') {
        const until = c.activeUntil ? new Date(c.activeUntil).toLocaleDateString() : '';
        return `<div class="svc-card">
          <div class="svc-head"><b>${esc(c.title)}</b><span class="svc-badge ok">ACTIVE</span></div>
          <div class="svc-meta">until ${esc(until)}</div>
          <div class="svc-actions">
            <button class="btn-mini" data-use="${esc(c.serviceId)}">Use now →</button>
            <a class="btn-mini" href="${esc(c.invoiceUrl)}" target="_blank" rel="noopener">Invoice</a>
          </div></div>`;
      }
      return '';
    }).join('');
    bodyEl.appendChild(wrap);
    wrap.querySelectorAll('[data-use]').forEach(b => {
      b.addEventListener('click', async () => {
        const sid = b.getAttribute('data-use');
        b.disabled = true; b.textContent = 'Running…';
        try {
          const tok = (typeof getCustToken === 'function') ? getCustToken() : '';
          const r = await fetch('/api/services/' + encodeURIComponent(sid) + '/use', {
            method:'POST', headers: { 'content-type':'application/json', 'x-customer-token': tok }
          });
          const j = await r.json().catch(()=>({}));
          if (r.ok) {
            addMsg('<b>✓ ' + esc(sid) + '</b><br/><code class="md-code">' + esc(JSON.stringify(j.output||{}, null, 2)) + '</code>', 'bot', {withTools:false});
          } else {
            addMsg('⚠ ' + esc(j.message || j.error || 'run failed'), 'bot', {withTools:false});
          }
        } catch(e) { addMsg('⚠ ' + esc(e.message), 'bot', {withTools:false}); }
        b.disabled = false; b.textContent = 'Use now →';
      });
    });
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function renderActions(actions){
    if (!Array.isArray(actions) || !actions.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'action-pills';
    wrap.innerHTML = actions.map((a,i) => `<button class="action-pill" data-i="${i}">${esc(a.label||a.type)}</button>`).join('');
    bodyEl.appendChild(wrap);
    wrap.querySelectorAll('.action-pill').forEach((el, i) => {
      el.addEventListener('click', () => executeAction(actions[i]));
    });
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function renderQuickReplies(qrs){
    if (!chipsBox) return;
    if (!Array.isArray(qrs) || !qrs.length) { chipsBox.style.display = 'none'; return; }
    chipsBox.innerHTML = qrs.map(q => `<button class="chip" data-q="${esc(q.q||q.label)}">${esc(q.label)}</button>`).join('');
    chipsBox.style.display = '';
    chipsBox.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => ask(c.dataset.q)));
  }

  function executeAction(a){
    if (!a) return;
    if (a.type === 'navigate' && a.url) { panel.classList.remove('open'); navigate(a.url); return; }
    if (a.type === 'ask' && a.q) { ask(a.q); return; }
  }

  async function sendFeedback(messageId, rating, userMsg, reply){
    try {
      const tok = (typeof getCustToken === 'function') ? getCustToken() : '';
      await fetch('/api/concierge/feedback', {
        method:'POST', headers:{'content-type':'application/json','x-customer-token':tok},
        body: JSON.stringify({ messageId, rating, userMsg, reply, customerToken: tok })
      });
      toast(rating === 1 ? '👍 Thanks' : '👎 Noted — will improve','ok');
    } catch(_) {}
  }

  function maybeSpeak(text){
    if (!ttsOn || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*`_#>]/g,''));
      u.rate = 1.05; u.pitch = 1.0; u.volume = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch(_) {}
  }

  // ---- Streaming ask
  async function askStream(q){
    const typing = showTyping();
    const tok = (typeof getCustToken === 'function') ? getCustToken() : '';
    let assistantMsg = null, buf = '', messageId = '', gotRecs = null, gotCards = null, gotActions = null, gotQR = null;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const streamTimeout = setTimeout(() => { try { controller && controller.abort(); } catch(_){} }, 12000);
    try {
      const resp = await fetch('/api/concierge/stream', {
        method:'POST', credentials:'same-origin', signal: controller ? controller.signal : undefined, headers: {'content-type':'application/json','x-customer-token': tok},
        body: JSON.stringify({ message: q, history: history.slice(-10), taskType:'sales', customerToken: tok })
      });
      if (!resp.ok || !resp.body) throw new Error('stream_failed');
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      typing.remove();
      assistantMsg = addMsg('<span class="stream-caret">▌</span>', 'bot', {withTools:false});
      const bodyBox = assistantMsg.querySelector('.msg-body');
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        // parse SSE events in acc
        let idx;
        while ((idx = acc.indexOf('\n\n')) !== -1) {
          const raw = acc.slice(0, idx); acc = acc.slice(idx+2);
          const lines = raw.split('\n');
          let event = 'message', data = '';
          for (const l of lines) {
            if (l.startsWith('event: ')) event = l.slice(7).trim();
            else if (l.startsWith('data: ')) data += (data?'\n':'') + l.slice(6);
          }
          let parsed = null; try { parsed = JSON.parse(data); } catch(_) { parsed = data; }
          if (event === 'meta' && parsed) {
            messageId = parsed.messageId || '';
            if (metaEl) metaEl.textContent = (parsed.provider||parsed.model||'zeus-30y').slice(0,24);
          } else if (event === 'token') {
            buf += (typeof parsed === 'string') ? parsed : '';
            bodyBox.innerHTML = mdToHtml(buf) + '<span class="stream-caret">▌</span>';
            bodyEl.scrollTop = bodyEl.scrollHeight;
          } else if (event === 'recommendations') gotRecs = parsed;
          else if (event === 'cards') gotCards = parsed;
          else if (event === 'actions') gotActions = parsed;
          else if (event === 'quickReplies') gotQR = parsed;
          else if (event === 'done') { /* final */ }
        }
      }
      // finalize
      if (assistantMsg) {
        assistantMsg.querySelector('.msg-body').innerHTML = mdToHtml(buf);
        // Attach tools post-stream
        const t = document.createElement('div');
        t.className = 'msg-tools';
        t.innerHTML = `<button class="mt-btn mt-copy" title="Copy">📋</button>
          <button class="mt-btn mt-up" title="Good">👍</button>
          <button class="mt-btn mt-dn" title="Bad">👎</button>`;
        assistantMsg.appendChild(t);
        t.querySelector('.mt-copy').addEventListener('click', () => { try { navigator.clipboard.writeText(buf); toast('Copied','ok'); } catch(_){} });
        t.querySelector('.mt-up').addEventListener('click', () => sendFeedback(messageId, 1, q, buf));
        t.querySelector('.mt-dn').addEventListener('click', () => sendFeedback(messageId, -1, q, buf));
      }
      if (gotCards) renderCards(gotCards);
      if (gotRecs) renderRecs(gotRecs);
      if (gotActions) renderActions(gotActions);
      if (gotQR) renderQuickReplies(gotQR);
      history.push({ role:'user', content:q }, { role:'assistant', content: buf });
      saveHistory();
      maybeSpeak(buf);
      clearTimeout(streamTimeout);
      return true;
    } catch(e) {
      clearTimeout(streamTimeout);
      try { typing.remove(); } catch(_){}
      return false;
    }
  }

  async function askFallback(q){
    const typing = showTyping();
    try {
      const r = await api('/api/concierge', {
        method:'POST',
        body: JSON.stringify({ message: q, history: history.slice(-10), taskType: 'sales', customerToken: (typeof getCustToken==='function'?getCustToken():'') })
      });
      typing.remove();
      if (r && r.reply) {
        const m = addMsg(mdToHtml(r.reply), 'bot', { messageId: r.messageId||'', userMsg: q });
        history.push({ role:'user', content:q }, { role:'assistant', content:r.reply });
        saveHistory();
        if (metaEl && r.provider) metaEl.textContent = r.provider;
        renderCards(r.cards);
        renderRecs(r.recommendations);
        renderActions(r.actions);
        renderQuickReplies(r.quickReplies);
        maybeSpeak(r.reply);
      } else {
        addMsg('Zeus este temporar offline. Încearcă din nou. / Zeus is temporarily offline.', 'bot', {withTools:false});
      }
    } catch (e) {
      try { typing.remove(); } catch(_){}
      addMsg('Rețea indisponibilă. / Network unavailable.', 'bot', {withTools:false});
    }
  }

  async function ask(q){
    if (!q || busy) return;
    busy = true;
    sendBtn && (sendBtn.disabled = true);
    if (chipsBox && !chipsBox.dataset.dynamic) chipsBox.style.display = 'none';
    addMsg(esc(q), 'user', {withTools:false});
    inp.value = ''; if (inp.style) inp.style.height = 'auto';
    const ok = await askStream(q);
    if (!ok) await askFallback(q);
    busy = false;
    sendBtn && (sendBtn.disabled = false);
    inp.focus();
  }

  // ---- Hydrate history on open
  function hydrateHistory(){
    if (!history.length) return;
    // keep the greeting; then append last N from history
    history.slice(-12).forEach(m => {
      addMsg(m.role === 'user' ? esc(m.content) : mdToHtml(m.content), m.role === 'user' ? 'user' : 'bot', {withTools: m.role!=='user'});
    });
  }
  let hydrated = false;
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      if (!hydrated) { hydrated = true; hydrateHistory(); }
      setTimeout(() => inp.focus(), 120);
    }
  });

  // ---- Input: Enter to send, Shift+Enter newline (textarea)
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inp.value.trim()) ask(inp.value.trim());
    }
  });
  // auto-resize textarea if it is one
  inp.addEventListener('input', () => {
    if (inp.tagName === 'TEXTAREA') { inp.style.height = 'auto'; inp.style.height = Math.min(140, inp.scrollHeight) + 'px'; }
  });
  sendBtn && sendBtn.addEventListener('click', () => { if (inp.value.trim()) ask(inp.value.trim()); });
  chipsBox && chipsBox.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => ask(c.dataset.q || c.textContent.trim()));
  });

  // ---- Fullscreen
  ccFs && ccFs.addEventListener('click', () => { panel.classList.toggle('fullscreen'); });
  // ---- Reset
  ccReset && ccReset.addEventListener('click', () => {
    history = []; saveHistory();
    bodyEl.innerHTML = '';
    addMsg(mdToHtml('Conversație nouă. Spune-mi obiectivul tău. / New conversation — tell me your goal.'), 'bot', {withTools:false});
    toast('Chat reset','ok');
  });
  // ---- TTS toggle
  ccTts && ccTts.addEventListener('click', () => {
    ttsOn = !ttsOn;
    ccTts.classList.toggle('on', ttsOn);
    ccTts.textContent = ttsOn ? '🔊' : '🔇';
    toast(ttsOn ? 'Voice ON' : 'Voice OFF','ok');
  });
  // ---- Voice input
  ccMic && ccMic.addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice not supported in this browser','err'); return; }
    if (listening) { try { recog && recog.stop(); } catch(_){} listening = false; ccMic.classList.remove('listening'); return; }
    recog = new SR();
    recog.lang = (navigator.language||'en').startsWith('ro') ? 'ro-RO' : (navigator.language||'en-US');
    recog.interimResults = true; recog.continuous = false;
    let finalTxt = '';
    recog.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interim += r[0].transcript;
      }
      inp.value = (finalTxt + interim).trim();
    };
    recog.onend = () => {
      listening = false; ccMic.classList.remove('listening');
      if (inp.value.trim()) ask(inp.value.trim());
    };
    recog.onerror = () => { listening = false; ccMic.classList.remove('listening'); };
    try { recog.start(); listening = true; ccMic.classList.add('listening'); toast('Listening…','ok'); } catch(_){}
  });
})();

// ================= ENTERPRISE =================
async function hydrateEnterprise(){
  // Wire contact form first — must work even if catalog fails
  wireEnterpriseContactForm();
  // Wire module CTAs (scroll to form + preselect interest)
  document.querySelectorAll('.ent-module-cta').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const moduleId = btn.dataset.module || '';
      const form = document.getElementById('entContactForm');
      if (form) {
        const sel = form.querySelector('select[name="interest"]');
        if (sel && moduleId) sel.value = moduleId;
        document.getElementById('enterprise-contact').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const cat = await api('/api/enterprise/catalog');
  if (!cat || !cat.products) return;  const s = cat.summary || {};
  const setT = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setT('entProducts', s.products || cat.products.length);
  setT('entAccounts', s.addressableAccounts || '—');
  setT('entAnchor', s.anchorPortfolioFmt || '—');
  setT('entTop', s.topstonePortfolioFmt || '—');

  const tierColor = { diamond:'#8a5cff', platinum:'#6fd3ff', gold:'#ffd36a' };
  const grid = document.getElementById('entProductsGrid');
  if (grid) {
    grid.innerHTML = cat.products.map(p => `
      <div class="card" style="padding:26px;display:flex;flex-direction:column;gap:14px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(20,12,40,.6),rgba(8,6,18,.6));position:relative;overflow:hidden">
        <div style="position:absolute;top:14px;right:16px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${tierColor[p.tier]||'#fff'};font-weight:600">${p.tier}</div>
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-dim)">${p.segment}</div>
        <h3 style="font-size:22px;line-height:1.15;margin:0;letter-spacing:-0.01em">${p.title}</h3>
        <p style="color:var(--ink-dim);font-size:14px;margin:0;line-height:1.55">${p.tagline}</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 0;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)">
          <div><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.12em;text-transform:uppercase">Floor</div><div style="font-weight:600;font-size:15px;margin-top:3px">${p.floorFmt}</div></div>
          <div><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.12em;text-transform:uppercase">Anchor</div><div style="font-weight:700;font-size:17px;margin-top:3px;color:#fff">${p.anchorFmt}</div></div>
          <div><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.12em;text-transform:uppercase">Topstone</div><div style="font-weight:700;font-size:15px;margin-top:3px;color:#ffd36a">${p.topstoneFmt}</div></div>
        </div>
        <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.5"><b style="color:#fff">Model:</b> ${p.model}</div>
        <div style="font-size:12.5px;color:var(--ink-dim);line-height:1.5"><b style="color:#fff">Value captured:</b> ${p.valueCaptured}</div>
        <div style="font-size:12px;color:var(--ink-dim);line-height:1.55"><b style="color:#fff">Target accounts:</b> ${p.accounts.slice(0,4).join(' · ')}${p.accounts.length>4?' …':''}</div>
        <button class="btn btn-primary ent-start" data-pid="${p.id}" data-title="${p.title.replace(/"/g,'&quot;')}" style="margin-top:auto;justify-content:center">Open autonomous negotiation →</button>
      </div>
    `).join('');
    grid.querySelectorAll('.ent-start').forEach(btn => btn.addEventListener('click', () => openEntNegotiator(btn.dataset.pid, btn.dataset.title)));
  }
  await renderEntDeals();
  await renderEntOps();
}

function wireEnterpriseContactForm(){
  const form = document.getElementById('entContactForm');
  if (!form || form.dataset.wired === '1') return;
  form.dataset.wired = '1';
  const status = document.getElementById('entContactStatus');
  const showStatus = (msg, type) => {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    if (type === 'ok') {
      status.style.background = 'rgba(111,255,180,.1)';
      status.style.border = '1px solid rgba(111,255,180,.4)';
      status.style.color = '#a3ffce';
    } else if (type === 'err') {
      status.style.background = 'rgba(255,90,90,.1)';
      status.style.border = '1px solid rgba(255,90,90,.4)';
      status.style.color = '#ff9999';
    } else {
      status.style.background = 'rgba(111,211,255,.1)';
      status.style.border = '1px solid rgba(111,211,255,.4)';
      status.style.color = '#6fd3ff';
    }
  };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') || '').trim(),
      company: String(fd.get('company') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      interest: String(fd.get('interest') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };
    if (!payload.name || !payload.email || !payload.company || !payload.message) {
      showStatus('Please fill in name, company, email and message.', 'err');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      showStatus('Please provide a valid work email.', 'err');
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
    showStatus('Submitting your request…', 'info');
    try {
      const r = await fetch('/api/enterprise/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) {
        showStatus('✅ ' + (data.message || 'Thank you. Our enterprise team will reply within 24 hours.') + ' (Lead ID: ' + (data.leadId || '—') + ')', 'ok');
        form.reset();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send to Enterprise Sales →'; }
      } else {
        showStatus('❌ ' + (data.error || 'Submission failed. Please email us at vladoi_ionut@yahoo.com'), 'err');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send to Enterprise Sales →'; }
      }
    } catch (e) {
      showStatus('❌ Network error. Please try again or email vladoi_ionut@yahoo.com', 'err');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send to Enterprise Sales →'; }
    }
  });
}

function openEntNegotiator(pid, title){
  const n = document.getElementById('entNegotiator');
  if (!n) return;
  n.innerHTML = `
    <div class="card" style="padding:28px;border:1px solid rgba(138,92,255,.28);background:linear-gradient(180deg,rgba(32,18,60,.55),rgba(10,6,20,.75))">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:20px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#ffd36a">Autonomous Negotiation Desk</div>
          <h2 style="font-size:26px;margin:8px 0 4px">${title}</h2>
          <p style="color:var(--ink-dim);font-size:14px;margin:0">Zeus AI negotiates on behalf of the owner. Floor enforced. No human required.</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px">
        <label style="display:flex;flex-direction:column;gap:6px"><span style="color:var(--ink-dim);font-size:12px">Buyer / account</span><input id="entBuyer" class="input" placeholder="e.g. Amazon Web Services" style="padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff"/></label>
        <label style="display:flex;flex-direction:column;gap:6px"><span style="color:var(--ink-dim);font-size:12px">Tier</span>
          <select id="entTier" style="padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff">
            <option value="hyperscaler">Hyperscaler (AWS / Google / Azure)</option>
            <option value="fortune50">Fortune 50</option>
            <option value="fortune500" selected>Fortune 500</option>
            <option value="government">Government / Sovereign</option>
            <option value="unicorn">ZeusAI / scaleup</option>
            <option value="strategic">Strategic partner</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px"><span style="color:var(--ink-dim);font-size:12px">Term (years)</span><input id="entTerm" type="number" min="1" max="15" value="5" style="padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff"/></label>
        <div style="display:flex;align-items:end"><button id="entStartBtn" data-pid="${pid}" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px">Start negotiation</button></div>
      </div>
      <div id="entThread"></div>
    </div>
  `;
  document.getElementById('entStartBtn').addEventListener('click', async (e) => {
    const productId = e.currentTarget.dataset.pid;
    const buyerName = document.getElementById('entBuyer').value.trim() || 'Prospect';
    const buyerTier = document.getElementById('entTier').value;
    const termYears = Number(document.getElementById('entTerm').value || 5);
    const r = await api('/api/enterprise/negotiate/start', { method:'POST', body: JSON.stringify({ productId, buyerName, buyerTier, termYears }) });
    if (r && r.deal) renderEntThread(r.deal);
    await renderEntDeals();
  });
  n.scrollIntoView({ behavior:'smooth', block:'start' });
}

function renderEntThread(deal){
  const t = document.getElementById('entThread');
  if (!t) return;
  const closed = deal.status !== 'open';
  const statusColor = deal.status === 'closed_won' ? '#6fd3ff' : deal.status === 'closed_lost' ? '#ff8a8a' : '#ffd36a';
  const historyHtml = deal.history.map(h => {
    const who = h.actor === 'unicorn' ? 'ZeusAI Core' : 'Buyer';
    const color = h.actor === 'unicorn' ? '#8a5cff' : '#6fd3ff';
    const price = h.priceUSD ? ' · <b>' + fmtM(h.priceUSD) + '</b>' : '';
    return `<div style="padding:14px 16px;border-left:3px solid ${color};background:rgba(255,255,255,.02);margin:10px 0;border-radius:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-dim);margin-bottom:6px"><span style="color:${color};font-weight:600">Round ${h.round} · ${who}</span><span>${(h.type||'').replace('_',' ')}${price}</span></div>
      <div style="color:#eee;font-size:13.5px;line-height:1.55">${(h.message||'').replace(/</g,'&lt;')}</div>
    </div>`;
  }).join('');
  t.innerHTML = `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08)">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div><b>${deal.buyerName}</b> · ${deal.buyerTier} · ${deal.termYears}y · round ${deal.round}/${deal.maxRounds}</div>
        <div style="color:${statusColor};font-weight:600;text-transform:uppercase;letter-spacing:.12em;font-size:12px">${deal.status.replace('_',' ')}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;font-size:13px">
        <div class="card" style="padding:12px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.1em;text-transform:uppercase">Our current offer</div><div style="font-weight:700;margin-top:4px">${deal.currentOfferFmt}</div></div>
        <div class="card" style="padding:12px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.1em;text-transform:uppercase">Buyer last offer</div><div style="font-weight:700;margin-top:4px">${deal.lastBuyerOfferFmt || '—'}</div></div>
        <div class="card" style="padding:12px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.1em;text-transform:uppercase">Anchor</div><div style="font-weight:700;margin-top:4px">${deal.anchorFmt}</div></div>
      </div>
      ${historyHtml}
      ${closed ? (deal.closedPriceFmt ? `<div class="card" style="padding:20px;margin-top:16px;border:1px solid rgba(111,211,255,.4);background:rgba(111,211,255,.08)"><b style="font-size:20px;color:#6fd3ff">Closed won @ ${deal.closedPriceFmt}</b><div style="color:var(--ink-dim);margin-top:6px;font-size:13px">Signature package will be circulated within 48h.</div>${deal.contractId?`<div style="margin-top:10px"><a class="btn btn-ghost" href="/api/enterprise/contract/${deal.id}" target="_blank">📜 View signed contract (${deal.contractId})</a></div>`:''}</div>` : deal.status==='pending_governance' ? '<div class="card" style="padding:20px;margin-top:16px;border:1px solid rgba(255,211,106,.4);background:rgba(255,211,106,.08);color:#ffd36a"><b>⏸ Awaiting owner governance OTP</b><div style="color:var(--ink-dim);margin-top:6px;font-size:13px">Enter the OTP on the Governance tab below to release this deal.</div></div>' : '<div class="card" style="padding:16px;margin-top:12px;color:#ff8a8a">Deal closed without signature.</div>')
       : `<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:16px">
            <input id="entMsg" class="input" placeholder="Optional message to Zeus (why this price is fair, constraints, etc.)" style="padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff"/>
            <input id="entOffer" type="number" placeholder="Your offer (USD)" style="padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff"/>
            <button id="entCounterBtn" data-did="${deal.id}" class="btn btn-primary" style="justify-content:center">Send counter</button>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px">
            <button id="entAcceptBtn" data-did="${deal.id}" class="btn btn-ghost">Accept current offer (${deal.currentOfferFmt})</button>
          </div>`}
    </div>
  `;
  if (!closed) {
    document.getElementById('entCounterBtn').addEventListener('click', async (e) => {
      const dealId = e.currentTarget.dataset.did;
      const offerUSD = Number(document.getElementById('entOffer').value || 0);
      const message = document.getElementById('entMsg').value || '';
      if (!offerUSD) { toast('Enter an offer amount in USD', 'warn'); return; }
      const r = await api('/api/enterprise/negotiate/counter', { method:'POST', body: JSON.stringify({ dealId, offerUSD, message }) });
      if (r && r.deal) renderEntThread(r.deal);
      await renderEntDeals();
    });
    document.getElementById('entAcceptBtn').addEventListener('click', async (e) => {
      const dealId = e.currentTarget.dataset.did;
      const r = await api('/api/enterprise/negotiate/accept', { method:'POST', body: JSON.stringify({ dealId }) });
      if (r && r.deal) renderEntThread(r.deal);
      await renderEntDeals();
    });
  }
}

async function renderEntDeals(){
  const box = document.getElementById('entDeals');
  if (!box) return;
  const r = await api('/api/enterprise/deals');
  if (!r || !r.stats) return;
  const s = r.stats;
  const deals = (r.deals || []).slice(0, 10);
  box.innerHTML = `
    <h3 style="font-size:22px;margin-bottom:14px">Pipeline &amp; bookings</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px">
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Booked</div><div style="font-size:24px;font-weight:700;margin-top:4px;color:#6fd3ff">${s.bookedFmt}</div></div>
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Pipeline</div><div style="font-size:24px;font-weight:700;margin-top:4px;color:#ffd36a">${s.pipelineFmt}</div></div>
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Open deals</div><div style="font-size:24px;font-weight:700;margin-top:4px">${s.open}</div></div>
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Win rate</div><div style="font-size:24px;font-weight:700;margin-top:4px">${s.winRate}%</div></div>
    </div>
    ${deals.length ? deals.map(d => `
      <div class="card" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
        <div><b>${d.buyerName}</b> <span style="color:var(--ink-dim);font-size:12px">· ${d.productTitle} · ${d.termYears}y · r${d.round}</span></div>
        <div style="display:flex;gap:14px;align-items:center">
          <div style="font-size:13px"><span style="color:var(--ink-dim)">current</span> <b>${d.currentOfferFmt}</b></div>
          <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:rgba(138,92,255,.15);color:${d.status==='closed_won'?'#6fd3ff':d.status==='closed_lost'?'#ff8a8a':'#ffd36a'}">${d.status.replace('_',' ')}</div>
        </div>
      </div>
    `).join('') : '<p style="color:var(--ink-dim)">No deals yet — start one above.</p>'}
  `;
}

function fmtM(n){
  if (n >= 1e9) return '$' + (n/1e9).toFixed(2).replace(/\.?0+$/,'') + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2).replace(/\.?0+$/,'') + 'M';
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'K';
  return '$' + n;
}

async function renderEntOps(){
  const box = document.getElementById('entDeals');
  if (!box) return;
  const [outR, vaultR, govR, whaleR] = await Promise.all([
    api('/api/outreach/snapshot').catch(()=>null),
    api('/api/vault/snapshot').catch(()=>null),
    api('/api/governance/snapshot').catch(()=>null),
    api('/api/whales/snapshot').catch(()=>null)
  ]);
  const ops = document.createElement('div');
  ops.id = 'entOpsDash';
  ops.style.cssText = 'margin-top:48px;padding-top:32px;border-top:1px solid rgba(255,255,255,.08)';
  ops.innerHTML = `
    <h2 style="font-size:28px;margin:0 0 8px;letter-spacing:-0.01em">Autonomous revenue operations</h2>
    <p style="color:var(--ink-dim);margin-bottom:24px;font-size:14px">Zeus drives outreach, negotiates, books revenue into a signed vault, and requires owner OTP on deals above ${govR?govR.thresholdFmt:'$100M'}.</p>

    <div class="tabs" style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
      ${['outreach','vault','governance','whales'].map(k => `<button class="btn btn-ghost op-tab" data-tab="${k}" style="padding:9px 18px;font-size:13px">${k.toUpperCase()}</button>`).join('')}
    </div>

    <div class="op-pane" data-pane="outreach">${outreachPaneHtml(outR)}</div>
    <div class="op-pane" data-pane="vault" style="display:none">${vaultPaneHtml(vaultR)}</div>
    <div class="op-pane" data-pane="governance" style="display:none">${govPaneHtml(govR)}</div>
    <div class="op-pane" data-pane="whales" style="display:none">${whalesPaneHtml(whaleR)}</div>
  `;
  const old = document.getElementById('entOpsDash'); if (old) old.remove();
  box.parentNode.appendChild(ops);

  ops.querySelectorAll('.op-tab').forEach(b => b.addEventListener('click', () => {
    ops.querySelectorAll('.op-pane').forEach(p => p.style.display = (p.dataset.pane === b.dataset.tab ? '' : 'none'));
    ops.querySelectorAll('.op-tab').forEach(x => x.classList.remove('btn-primary'));
    b.classList.add('btn-primary');
  }));
  ops.querySelector('.op-tab[data-tab="outreach"]').classList.add('btn-primary');

  // wire action buttons
  const startBtn = ops.querySelector('#startCampaignBtn');
  if (startBtn) startBtn.addEventListener('click', async () => {
    const signal = ops.querySelector('#campSignal').value;
    const channel = ops.querySelector('#campChannel').value;
    const r = await api('/api/outreach/campaign', { method:'POST', body: JSON.stringify({ filter:{ signal }, channel, delayMinutes:0 }) });
    if (r && r.ok) { toast('Campaign '+r.campaign.targetCount+' messages queued', 'ok'); await renderEntOps(); }
  });
  const flushBtn = ops.querySelector('#flushBtn');
  if (flushBtn) flushBtn.addEventListener('click', async () => {
    const r = await api('/api/outreach/tick', { method:'POST' });
    if (r) { toast('Flushed '+r.flushed+' messages', 'ok'); await renderEntOps(); }
  });
  const scanBtn = ops.querySelector('#scanBtn');
  if (scanBtn) scanBtn.addEventListener('click', async () => {
    scanBtn.textContent = 'Scanning press feeds…'; scanBtn.disabled = true;
    const r = await api('/api/whales/scan', { method:'POST' });
    if (r && r.ok) { toast(r.newSignals+' new intent signals detected', 'ok'); await renderEntOps(); }
    else { scanBtn.textContent = 'Scan press feeds now'; scanBtn.disabled = false; }
  });
  ops.querySelectorAll('.gov-confirm-btn').forEach(b => b.addEventListener('click', async () => {
    const dealId = b.dataset.did;
    const otp = ops.querySelector('#otp-'+dealId).value;
    if (!otp) { toast('Enter OTP code first','warn'); return; }
    const r = await api('/api/enterprise/negotiate/confirm', { method:'POST', body: JSON.stringify({ dealId, otp }) });
    if (r && r.ok) { toast('Governance approved — deal finalised','ok'); await renderEntDeals(); await renderEntOps(); }
    else { toast('OTP rejected: '+(r && r.error), 'err'); }
  }));
}

function outreachPaneHtml(r) {
  if (!r) return '<p style="color:var(--ink-dim)">Outreach engine offline.</p>';
  const s = r.stats || {};
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px">
      <div class="card" style="padding:14px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.14em;text-transform:uppercase">Campaigns</div><div style="font-size:22px;font-weight:700;margin-top:4px">${s.created||0}</div></div>
      <div class="card" style="padding:14px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.14em;text-transform:uppercase">Messages sent</div><div style="font-size:22px;font-weight:700;margin-top:4px">${s.sent||0}</div></div>
      <div class="card" style="padding:14px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.14em;text-transform:uppercase">Replies</div><div style="font-size:22px;font-weight:700;margin-top:4px">${s.replies||0}</div></div>
      <div class="card" style="padding:14px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.14em;text-transform:uppercase">Deals attributed</div><div style="font-size:22px;font-weight:700;margin-top:4px">${s.deals||0}</div></div>
      <div class="card" style="padding:14px"><div style="color:var(--ink-dim);font-size:10px;letter-spacing:.14em;text-transform:uppercase">Revenue attributed</div><div style="font-size:22px;font-weight:700;margin-top:4px;color:#ffd36a">${fmtM(s.attributedRevenueUSD||0)}</div></div>
    </div>
    <div class="card" style="padding:20px;margin-bottom:18px;display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:10px;align-items:center">
      <div>
        <div style="color:var(--ink-dim);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Signal</div>
        <select id="campSignal" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff">
          <option value="AI infra">AI infra (AWS/Google/Azure/Meta/NVIDIA)</option>
          <option value="fabric">Fabric (NVIDIA/Apple/OpenAI)</option>
          <option value="commerce">Commerce (Amazon/Walmart/Shopify)</option>
          <option value="payments">Payments (Visa/MC/Stripe/JPM)</option>
          <option value="ads">Ads (Meta/Google/TikTok)</option>
          <option value="observability">Observability (Netflix/Uber/Goldman)</option>
          <option value="knowledge">Knowledge (MSFT/Salesforce/Oracle/SAP)</option>
          <option value="defense">Defense (Lockheed/RTX)</option>
          <option value="sovereign">Sovereign (Governments)</option>
        </select>
      </div>
      <div>
        <div style="color:var(--ink-dim);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Channel</div>
        <select id="campChannel" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff">
          <option value="linkedin">LinkedIn</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div style="color:var(--ink-dim);font-size:12.5px;line-height:1.5">Drafts are generated per decision-maker × matching product, auto-queued, flushed every 60s.</div>
      <button id="startCampaignBtn" class="btn btn-primary" style="padding:11px 20px">Launch campaign</button>
      <button id="flushBtn" class="btn btn-ghost" style="padding:11px 16px">Flush queue</button>
    </div>
    <h4 style="margin:18px 0 10px">Recently sent (${(r.sent||[]).length})</h4>
    ${(r.sent||[]).slice(0,8).map(m => `
      <div class="card" style="padding:12px 16px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <div style="font-size:13px"><b>${m.company}</b> <span style="color:var(--ink-dim)">→ ${m.productId}</span></div>
          <div style="color:var(--ink-dim);font-size:11px;margin-top:2px">${m.channel.toUpperCase()} · ${m.contact} · sent ${new Date(m.sentAt).toISOString().slice(0,16).replace('T',' ')} UTC</div>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink-dim)">hash ${m.deliveryHash||''}</div>
      </div>
    `).join('') || '<p style="color:var(--ink-dim);font-size:13px">No messages sent yet — launch a campaign above.</p>'}
  `;
}

function vaultPaneHtml(r) {
  if (!r) return '<p style="color:var(--ink-dim)">Vault offline.</p>';
  const t = r.totals || {};
  const byChannel = t.byChannel || {};
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px">
      <div class="card" style="padding:18px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Allocated (total)</div><div style="font-size:26px;font-weight:700;margin-top:4px;color:#ffd36a">${t.allocatedFmt||'$0'}</div></div>
      <div class="card" style="padding:18px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Settled</div><div style="font-size:26px;font-weight:700;margin-top:4px;color:#6fd3ff">${t.settledFmt||'$0'}</div></div>
      <div class="card" style="padding:18px"><div style="color:var(--ink-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase">Pending settlement</div><div style="font-size:26px;font-weight:700;margin-top:4px">${t.pendingFmt||'$0'}</div></div>
    </div>
    <h4 style="margin:14px 0 10px">Default split</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:18px">
      ${(r.split||[]).map(s => `
        <div class="card" style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center"><b>${s.label}</b><span style="color:#8a5cff;font-weight:700">${Math.round(s.pct*100)}%</span></div>
          <div style="color:var(--ink-dim);font-size:12px;margin-top:6px">${s.channel} · ${s.dest}</div>
          <div style="color:var(--ink-dim);font-size:11px;margin-top:4px">Captured: <b style="color:#fff">${(byChannel[s.channel]||{}).amountFmt||'$0'}</b></div>
        </div>
      `).join('')}
    </div>
    <h4 style="margin:14px 0 10px">Recent allocations</h4>
    ${(r.recent||[]).slice(0,10).map(e => `
      <div class="card" style="padding:12px 16px;margin-bottom:6px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:13px"><b>${e.buyerName}</b> <span style="color:var(--ink-dim)">· ${e.productId}</span></div>
          <div style="color:var(--ink-dim);font-size:11px;margin-top:2px">alloc ${e.id} · ${new Date(e.createdAt).toISOString().slice(0,16).replace('T',' ')} UTC</div>
        </div>
        <div style="font-size:14px;font-weight:700;color:#ffd36a">${e.totalFmt}</div>
      </div>
    `).join('') || '<p style="color:var(--ink-dim);font-size:13px">No allocations yet.</p>'}
  `;
}

function govPaneHtml(r) {
  if (!r) return '<p style="color:var(--ink-dim)">Governance offline.</p>';
  return `
    <div class="card" style="padding:20px;margin-bottom:18px;background:linear-gradient(135deg,rgba(138,92,255,.12),rgba(255,211,106,.05));border:1px solid rgba(138,92,255,.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#ffd36a">Governance threshold</div>
          <div style="font-size:30px;font-weight:700;margin-top:4px">${r.thresholdFmt}</div>
          <div style="color:var(--ink-dim);font-size:13px;margin-top:4px">Deals at or above this require owner OTP approval. OTP delivered via email / PM2 log.</div>
        </div>
      </div>
    </div>
    <h4 style="margin:14px 0 10px">Pending approvals (${(r.pending||[]).length})</h4>
    ${(r.pending||[]).map(h => `
      <div class="card" style="padding:18px;margin-bottom:10px;border:1px solid rgba(255,211,106,.35)">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:14px;flex-wrap:wrap;margin-bottom:12px">
          <div><b style="font-size:15px">${h.buyerName}</b> <span style="color:var(--ink-dim);font-size:13px">· ${h.productTitle}</span>
            <div style="color:var(--ink-dim);font-size:11px;margin-top:4px">hold ${h.id} · expires ${new Date(h.expiresAt).toISOString().slice(0,16).replace('T',' ')} UTC</div>
          </div>
          <div style="font-size:22px;font-weight:700;color:#ffd36a">${h.amountFmt}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px">
          <input id="otp-${h.dealId}" placeholder="6-digit OTP from owner email / PM2 log" style="padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-family:'JetBrains Mono',monospace;letter-spacing:.3em"/>
          <button class="btn btn-primary gov-confirm-btn" data-did="${h.dealId}" style="padding:11px 22px">Release deal</button>
        </div>
      </div>
    `).join('') || '<p style="color:var(--ink-dim);font-size:13px">No pending approvals. All finalised deals were below threshold.</p>'}
    <h4 style="margin:20px 0 10px">Recent approvals</h4>
    ${(r.approvals||[]).slice(0,8).map(a => `
      <div class="card" style="padding:10px 14px;margin-bottom:4px;display:flex;justify-content:space-between;font-size:13px">
        <span>${a.dealId}</span><span style="color:#6fd3ff"><b>${fmtM(a.amountUSD)}</b> · ${new Date(a.at).toISOString().slice(0,16).replace('T',' ')} UTC</span>
      </div>
    `).join('') || '<p style="color:var(--ink-dim);font-size:13px">No approvals yet.</p>'}
  `;
}

function whalesPaneHtml(r) {
  if (!r) return '<p style="color:var(--ink-dim)">Whale tracker offline.</p>';
  return `
    <div class="card" style="padding:18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6fd3ff">Intent tracking</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">${r.trackedCompanies} accounts · ${r.totalSignals} historic signals</div>
        <div style="color:var(--ink-dim);font-size:13px;margin-top:4px">Last scan: ${r.lastRun ? new Date(r.lastRun).toISOString().slice(0,16).replace('T',' ')+' UTC' : 'never'}</div>
      </div>
      <button id="scanBtn" class="btn btn-primary" style="padding:12px 24px">Scan press feeds now</button>
    </div>
    <h4 style="margin:14px 0 10px">Recent intent signals (${(r.signals||[]).length})</h4>
    ${(r.signals||[]).slice(0,15).map(s => `
      <div class="card" style="padding:14px 16px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:start">
          <div style="flex:1;min-width:260px">
            <div style="font-size:14px;line-height:1.4"><b>${s.company}</b> <span style="color:var(--ink-dim)">→</span> <a href="${s.link}" target="_blank" rel="noopener" style="color:#c9a8ff">${s.title.replace(/</g,'&lt;')}</a></div>
            <div style="color:var(--ink-dim);font-size:12px;margin-top:4px">${s.summary.replace(/</g,'&lt;')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:rgba(111,211,255,.15);color:#6fd3ff;display:inline-block">${s.signal}</div>
            <div style="color:var(--ink-dim);font-size:10px;margin-top:4px">${s.autoCampaignId ? '✓ auto-pitch sent' : '—'}</div>
          </div>
        </div>
      </div>
    `).join('') || '<p style="color:var(--ink-dim);font-size:13px">No signals yet — click "Scan" to run first scan.</p>'}
  `;
}

// ================= BOOT =================
window.addEventListener('DOMContentLoaded', () => {
  // Affiliate sticky
  try {
    const u = new URLSearchParams(location.search);
    const ref = u.get('ref');
    if (ref) { localStorage.setItem('u_ref', ref); fetch('/api/uaic/affiliate/track?ref='+encodeURIComponent(ref)).catch(()=>{}); }
  } catch(_){}
  // Remember email typed at checkout
  document.addEventListener('change', e => { if (e.target && e.target.id === 'coEmail' && e.target.value) { try { localStorage.setItem('u_email', e.target.value); } catch(_){} } });
  refreshCustomerNav();
  openStream();
  subscribeAutonomousEvents();
  hydratePage(STATE.route);
});

// ===================== AUTONOMOUS LIVE BRIDGE =====================
// Connects to /api/events SSE and reactively updates DOM whenever a price
// changes or a new module appears. Auto-reconnects with exponential backoff.
window.AUTONOMOUS_MODULES = window.AUTONOMOUS_MODULES || { byId: {}, rev: 0, updatedAt: null };

function subscribeAutonomousEvents(){
  if (typeof EventSource === 'undefined') return;
  let es = null;
  let backoff = 1500;
  function connect(){
    try { es = new EventSource('/api/events'); }
    catch(_) { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30000); return; }
    es.addEventListener('snapshot', (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (Array.isArray(d.modules)) {
          window.AUTONOMOUS_MODULES.byId = {};
          for (const m of d.modules) window.AUTONOMOUS_MODULES.byId[m.id] = m;
          window.AUTONOMOUS_MODULES.rev = d.rev || 0;
          window.AUTONOMOUS_MODULES.updatedAt = d.at || new Date().toISOString();
          applyAutonomousSnapshot();
        }
      } catch(_) {}
      backoff = 1500;
    });
    es.addEventListener('price.update', (ev) => {
      try {
        const evt = JSON.parse(ev.data);
        const updates = (evt.data && evt.data.updates) || [];
        for (const u of updates) {
          const m = window.AUTONOMOUS_MODULES.byId[u.id];
          if (m) m.defaultPrice = u.price_usd;
          applyLivePriceToDom(u.id, u.price_usd);
        }
      } catch(_){}
    });
    es.addEventListener('module.added', (ev) => {
      try {
        const evt = JSON.parse(ev.data);
        const m = evt.data; if (m && m.id) window.AUTONOMOUS_MODULES.byId[m.id] = m;
        applyAutonomousSnapshot();
      } catch(_){}
    });
    es.addEventListener('module.update', (ev) => {
      try {
        const evt = JSON.parse(ev.data);
        const m = evt.data; if (m && m.id) window.AUTONOMOUS_MODULES.byId[m.id] = m;
        if (m && m.defaultPrice != null) applyLivePriceToDom(m.id, m.defaultPrice);
      } catch(_){}
    });
    es.addEventListener('status.update', (ev) => {
      try {
        const evt = JSON.parse(ev.data);
        const d = evt.data;
        if (d && d.id) {
          const m = window.AUTONOMOUS_MODULES.byId[d.id];
          if (m) m.isActive = d.isActive !== false;
          applyAutonomousSnapshot();
        }
      } catch(_){}
    });
    es.onerror = () => {
      try { es.close(); } catch(_){}
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    };
  }
  connect();
}

function applyLivePriceToDom(moduleId, priceUsd){
  if (!moduleId) return;
  const safe = String(moduleId).replace(/"/g, '\\"');
  const fmt = '$' + Number(priceUsd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.querySelectorAll('[data-live-price="' + safe + '"]').forEach(el => {
    el.textContent = fmt;
    el.setAttribute('data-live-updated', String(Date.now()));
    el.classList.add('price-flash');
    setTimeout(() => el.classList.remove('price-flash'), 800);
  });
  document.querySelectorAll('[data-pricing-value="' + safe + '"]').forEach(el => {
    el.innerHTML = fmt + '<small>/mo</small>';
  });
}

function applyAutonomousSnapshot(){
  // If user is on a route that auto-renders from modules, refresh that grid.
  // For now, we trigger known dynamic grids if present.
  const route = (STATE && STATE.route) || location.pathname;
  if (route === '/services' || route === '/' || (route && route.indexOf('/services') === 0)) {
    const target = document.getElementById('autonomousServicesGrid');
    if (target) renderAutonomousServicesGrid(target);
  }
  const statusEl = document.getElementById('autonomousStatus');
  if (statusEl) {
    const count = Object.keys(window.AUTONOMOUS_MODULES.byId || {}).length;
    statusEl.textContent = '● live · ' + count + ' modules · rev ' + (window.AUTONOMOUS_MODULES.rev || 0);
    statusEl.style.color = '#a3ffce';
  }
}

function renderAutonomousServicesGrid(target){
  const modules = Object.values(window.AUTONOMOUS_MODULES.byId || {})
    .filter(m => m && m.isActive !== false)
    .sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)));
  if (!modules.length) { target.innerHTML = '<div class="card" style="padding:18px;text-align:center;color:var(--ink-dim)">Loading modules…</div>'; return; }
  target.innerHTML = modules.map(m => {
    const priceTxt = (m.defaultPrice != null && Number.isFinite(Number(m.defaultPrice)))
      ? '$' + Number(m.defaultPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })
      : 'Loading price…';
    const buyHref = (m.defaultPrice != null && Number(m.defaultPrice) > 0)
      ? '/checkout?plan=' + encodeURIComponent(m.id)
      : '/services/' + encodeURIComponent(m.id);
    const buyLabel = (m.defaultPrice != null && Number(m.defaultPrice) > 0) ? 'Buy now' : 'Learn more';
    const safeName = escapeHtml(m.name);
    const safeDesc = escapeHtml(m.description || (m.category + ' module'));
    return `<div class="card" data-autonomous-module="${escapeHtml(m.id)}" style="padding:20px;display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,.08)">
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-dim)">${escapeHtml(m.category)}</div>
      <h3 style="margin:0;font-size:18px;letter-spacing:-0.01em">${safeName}</h3>
      <p style="margin:0;color:var(--ink-dim);font-size:13px;line-height:1.5">${safeDesc}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);margin-top:auto">
        <span data-live-price="${escapeHtml(m.id)}" style="font-weight:700;font-size:18px;color:#ffd36a">${priceTxt}</span>
        <a class="btn btn-primary" href="${buyHref}" data-link style="padding:8px 14px;font-size:13px">${buyLabel}</a>
      </div>
    </div>`;
  }).join('');
}
// ===================== END AUTONOMOUS LIVE BRIDGE =====================


// ===== Instant Store =====
const STORE_TOKEN_KEY = 'u_cust_token';
const STORE_CUSTOMER_KEY = 'u_customer_profile';
function getCustToken(){ try { return localStorage.getItem(STORE_TOKEN_KEY) || ''; } catch(_) { return ''; } }
function setCustToken(t){
  try {
    if (t) {
      localStorage.setItem(STORE_TOKEN_KEY, t);
      localStorage.setItem('customerToken', t);
      localStorage.setItem('authToken', t);
    } else {
      localStorage.removeItem(STORE_TOKEN_KEY);
      localStorage.removeItem('customerToken');
      localStorage.removeItem('authToken');
    }
  } catch(_){}
  refreshCustomerNav();
}
function getCustProfile(){ try { return JSON.parse(localStorage.getItem(STORE_CUSTOMER_KEY) || 'null'); } catch(_) { return null; } }
function setCustProfile(customer){
  try {
    if (customer && customer.email) localStorage.setItem(STORE_CUSTOMER_KEY, JSON.stringify({ email: customer.email, name: customer.name || '', id: customer.id || '' }));
    else localStorage.removeItem(STORE_CUSTOMER_KEY);
  } catch(_){}
  refreshCustomerNav();
}
function refreshCustomerNav(){
  try {
    const token = getCustToken();
    const customer = getCustProfile();
    const active = !!(token || (customer && customer.email));
    document.documentElement.setAttribute('data-customer-authenticated', active ? '1' : '0');
    document.querySelectorAll('[data-customer-link]').forEach((el) => {
      el.textContent = active ? 'My Account' : 'Create Account';
      if (customer && customer.email) el.setAttribute('title', customer.email);
    });
    document.querySelectorAll('[data-customer-cta]').forEach((el) => {
      el.textContent = active ? 'My Account' : 'Sign in';
      if (customer && customer.email) el.setAttribute('title', customer.email);
    });
  } catch(_) {}
}
function escStore(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function hydrateStore(){
  const grid = document.getElementById('storeGrid');
  if (!grid) return;
  const j = await fetch('/api/instant/catalog').then(r=>r.json()).catch(()=>({products:[], summary:null}));
  const rawProducts = Array.isArray(j.products) ? j.products : [];
  const normTier = (t) => {
    if (t === 'instant' || t === 'professional' || t === 'enterprise') return t;
    if (t === 'industry') return 'enterprise';
    return 'professional';
  };
  const products = rawProducts.map(p => Object.assign({}, p, {
    tier: normTier(p && p.tier),
    tagline: p && p.tagline ? p.tagline : (p && p.description ? String(p.description).slice(0, 120) : 'Production-ready ZeusAI service'),
    deliverable: p && p.deliverable ? p.deliverable : 'Signed deliverable package'
  }));
  const summary = {
    counts: {
      total: products.length,
      instant: products.filter(p => p.tier === 'instant').length,
      professional: products.filter(p => p.tier === 'professional').length,
      enterprise: products.filter(p => p.tier === 'enterprise').length
    }
  };
  window.__UNICORN_STORE_PRODUCTS__ = products;

  // Stats strip
  const stats = document.getElementById('storeStats');
  if (stats && summary) {
    stats.innerHTML = `
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.1em">Total products</div><div style="font-size:26px;font-weight:700">${summary.counts.total}</div></div>
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.1em">Instant</div><div style="font-size:26px;font-weight:700">${summary.counts.instant}</div></div>
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.1em">Professional</div><div style="font-size:26px;font-weight:700;color:#8a5cff">${summary.counts.professional}</div></div>
      <div class="card" style="padding:16px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.1em">Enterprise</div><div style="font-size:26px;font-weight:700;color:#ffd36a">${summary.counts.enterprise}</div></div>`;
  }

  // Tab behavior
  const tabs = document.querySelectorAll('.store-tab');
  const noteEl = document.getElementById('storeTabNote');
  const tierNotes = {
    instant: 'One-time purchase · deliverable generated in <60s after BTC settlement · Ed25519-signed HTML/JSON artifacts',
    professional: 'Monthly SaaS subscription · API key + features provisioned on first payment · BTC or card (Stripe if configured)',
    enterprise: 'Signed enterprise license · BTC on-chain or SWIFT/SEPA wire · Full onboarding runbook + dedicated SRE on activation'
  };
  function showTier(tier){
    tabs.forEach(t => {
      const active = t.dataset.tier === tier;
      t.style.background = active ? 'linear-gradient(135deg,#8a5cff,#6d28d9)' : 'rgba(138,92,255,.1)';
      t.style.color = active ? '#fff' : 'var(--ink)';
    });
    if (noteEl) noteEl.textContent = tierNotes[tier] || '';
    renderStoreGrid(products.filter(p => (p.tier||'instant') === tier), grid);
  }
  tabs.forEach(t => t.addEventListener('click', () => showTier(t.dataset.tier)));
  showTier('instant');
}

function renderStoreGrid(products, grid){
  if (!products.length) { grid.innerHTML = '<div style="color:var(--ink-dim);padding:40px;text-align:center">No products in this tier yet.</div>'; return; }
  grid.innerHTML = products.map(p => {
    const priceDisplay = p.priceUSD >= 1000000
      ? '$' + (p.priceUSD/1000000).toFixed(1).replace(/\.0$/,'') + 'M'
      : p.priceUSD >= 1000
        ? '$' + (p.priceUSD/1000).toFixed(p.priceUSD%1000===0?0:1) + 'K'
        : '$' + p.priceUSD;
    const billingLabel = p.billing === 'monthly' ? '/ month'
                       : p.billing === 'license' ? 'license' : 'one-time';
    const tierBadge = p.tier === 'enterprise' ? '<span style="background:linear-gradient(135deg,#ffd36a,#d97706);color:#1a0d00;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.1em">ENTERPRISE</span>'
                   : p.tier === 'professional' ? '<span style="background:linear-gradient(135deg,#8a5cff,#5b21b6);color:#fff;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.1em">PRO</span>'
                   : '<span style="background:rgba(124,255,184,.15);color:#7cffb8;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.1em">INSTANT</span>';
    const ctaLabel = p.tier === 'enterprise' ? 'Acquire license →'
                   : p.tier === 'professional' ? 'Subscribe →'
                   : 'Buy now →';
    const features = p.features ? `<ul style="margin:10px 0;padding-left:18px;color:var(--ink-dim);font-size:12px">${p.features.slice(0,4).map(f => '<li>' + escStore(f) + '</li>').join('')}</ul>` : '';
    const accounts = p.targetAccounts ? `<div style="font-size:11px;color:var(--ink-dim);margin-top:8px"><b>Target:</b> ${p.targetAccounts.slice(0,3).map(escStore).join(', ')}${p.targetAccounts.length>3?'…':''}</div>` : '';
    return `
    <div class="card" style="padding:22px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div>${tierBadge}<div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#8a5cff;margin-top:6px">${escStore(p.category||'')}</div>
          <h3 style="margin:4px 0 0;font-size:19px;line-height:1.25">${escStore(p.title)}</h3>
        </div>
        <div style="text-align:right"><div style="font-size:22px;font-weight:700;color:#ffd36a">${priceDisplay}</div><div style="font-size:10px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.1em">${billingLabel}</div></div>
      </div>
      <p style="color:var(--ink-dim);font-size:13px;margin:4px 0 0;min-height:36px">${escStore(p.tagline)}</p>
      ${features}
      <div style="font-size:11px;color:var(--ink-dim);padding:8px 10px;background:rgba(138,92,255,.08);border-radius:6px">📦 ${escStore(p.deliverable)}</div>
      ${accounts}
      <button class="btn btn-primary store-buy" data-pid="${escStore(p.id)}" style="margin-top:auto">${ctaLabel}</button>
    </div>`;
  }).join('');
  grid.querySelectorAll('.store-buy').forEach(b => b.addEventListener('click', () => {
    const all = window.__UNICORN_STORE_PRODUCTS__ || [];
    openStoreCheckout(all.find(x => x.id === b.dataset.pid));
  }));
}

function openStoreCheckout(product){
  const box = document.getElementById('storeCheckout');
  if (!box || !product) return;
  const fields = (product.inputs||[]).map(i => `
    <label style="display:block;margin:10px 0 4px;font-size:13px;color:var(--ink-dim)">${escStore(i.label)}${i.required?' *':''}</label>
    <input data-k="${escStore(i.key)}" type="${i.type||'text'}" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;font-size:14px">
  `).join('');
  const tok = getCustToken();
  box.innerHTML = `
    <div class="card" style="padding:28px">
      <h2 style="margin:0 0 4px">${escStore(product.title)} — Checkout</h2>
      <div style="color:var(--ink-dim);font-size:14px;margin-bottom:20px">$${product.priceUSD} · delivered in ~${product.durationSec}s after payment</div>
      ${fields}
      ${tok ? '' : `
        <label style="display:block;margin:16px 0 4px;font-size:13px;color:var(--ink-dim)">Email (deliverable link will be sent here)</label>
        <input id="storeGuestEmail" type="email" placeholder="you@domain.com" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;font-size:14px">
      `}
      <button id="storePurchaseBtn" class="btn btn-primary" style="margin-top:20px;width:100%;padding:14px;font-size:15px">Create BTC Invoice →</button>
      <div id="storeInvoice" style="margin-top:22px"></div>
    </div>`;
  box.querySelector('#storePurchaseBtn').addEventListener('click', async () => {
    const inputs = {};
    box.querySelectorAll('[data-k]').forEach(el => { inputs[el.dataset.k] = el.value; });
    const required = Array.isArray(product.inputs) ? product.inputs.filter(i => i && i.required) : [];
    const missing = required.find(i => !String(inputs[i.key] || '').trim());
    if (missing) {
      box.querySelector('#storeInvoice').innerHTML = `<div style="color:#ff9c9c;padding:12px;background:rgba(255,60,60,.1);border-radius:6px">Missing required field: ${escStore(missing.label || missing.key)}</div>`;
      return;
    }
    const payload = { productId: product.id, inputs };
    const t = getCustToken(); if (t) payload.customerToken = t;
    const em = box.querySelector('#storeGuestEmail');
    if (em && em.value) {
      const email = String(em.value).trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        box.querySelector('#storeInvoice').innerHTML = `<div style="color:#ff9c9c;padding:12px;background:rgba(255,60,60,.1);border-radius:6px">Please enter a valid email address.</div>`;
        return;
      }
      payload.guestEmail = email;
    }
    const r = await fetch('/api/instant/purchase', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(x=>x.json()).catch(e=>({error:String(e)}));
    if (r.error || !r.orderId) {
      let msg = r.error || r.message || 'Purchase request failed.';
      if (r.error === 'missing_input' && r.field) msg = `Missing required field: ${r.field}`;
      box.querySelector('#storeInvoice').innerHTML = `<div style="color:#ff9c9c;padding:12px;background:rgba(255,60,60,.1);border-radius:6px">${escStore(msg)}</div>`;
      return;
    }
    renderStoreInvoice(r);
  });
  box.scrollIntoView({ behavior:'smooth', block:'start' });
}

function renderStoreInvoice(r){
  const host = document.getElementById('storeInvoice');
  if (!host) return;
  const methods = r.paymentMethods || [{ kind:'btc', btcAddress: r.payment.btcAddress, btcAmount: r.payment.btcAmount, invoiceUri: r.payment.invoiceUri, qrUrl: r.payment.qrUrl, label:'Bitcoin (on-chain)' }];
  const priceDisplay = r.product.priceUSD >= 1000000 ? '$' + (r.product.priceUSD/1000000).toFixed(1).replace(/\.0$/,'') + 'M' : '$' + r.product.priceUSD.toLocaleString();
  host.innerHTML = `
    <div style="padding:22px;background:rgba(138,92,255,.08);border-radius:10px;border:1px solid rgba(138,92,255,.25)">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:16px;margin-bottom:18px">
        <div>
          <div style="font-size:12px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.12em">Order</div>
          <div style="font-family:monospace;font-size:14px;word-break:break-all">${escStore(r.orderId)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.12em">Total</div>
          <div style="font-size:26px;font-weight:700;color:#ffd36a">${priceDisplay}${r.product.billing==='monthly'?' /mo':''}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px" id="payMethodTabs">
        ${methods.map((m,i) => `<button class="pay-tab" data-idx="${i}" style="background:${i===0?'linear-gradient(135deg,#8a5cff,#6d28d9)':'rgba(138,92,255,.12)'};color:${i===0?'#fff':'var(--ink)'};border:0;padding:10px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px">${escStore(m.label)}</button>`).join('')}
      </div>

      <div id="payMethodBody"></div>

      <div id="storeOrderStatus" style="margin-top:16px;padding:12px;background:rgba(0,0,0,.25);border-radius:6px;font-size:13px;color:var(--ink-dim)">
        ⏳ Select a payment method above…
      </div>
    </div>`;
  const tabs = host.querySelectorAll('.pay-tab');
  const bodyEl = host.querySelector('#payMethodBody');
  function show(i){
    tabs.forEach((t,j) => { t.style.background = j===i ? 'linear-gradient(135deg,#8a5cff,#6d28d9)' : 'rgba(138,92,255,.12)'; t.style.color = j===i?'#fff':'var(--ink)'; });
    const m = methods[i];
    if (m.kind === 'btc') {
      bodyEl.innerHTML = `
        <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
          <img src="${escStore(m.qrUrl)}" alt="BTC QR" style="width:180px;height:180px;border-radius:8px;background:#fff;padding:8px" onerror="this.style.display='none'">
          <div style="flex:1;min-width:240px">
            <div style="font-size:13px;color:var(--ink-dim)">BTC Amount</div>
            <div style="font-size:22px;font-weight:700;color:#ffd36a;margin-bottom:10px">${escStore(m.btcAmount)} BTC</div>
            <div style="font-size:13px;color:var(--ink-dim)">Send to</div>
            <div style="font-family:monospace;font-size:12px;word-break:break-all;padding:8px;background:rgba(0,0,0,.3);border-radius:4px">${escStore(m.btcAddress)}</div>
            <div style="margin-top:12px"><a href="${escStore(m.invoiceUri)}" class="btn btn-primary" style="font-size:13px">Open in BTC wallet</a></div>
          </div>
        </div>`;
    } else if (m.kind === 'card') {
      bodyEl.innerHTML = `
        <div style="padding:18px;background:rgba(0,0,0,.25);border-radius:8px">
          <p style="color:var(--ink);margin:0 0 14px">Pay with any major credit card — Stripe-secured checkout. Monthly subscriptions auto-renew until cancelled from your account.</p>
          <button id="stripeGoBtn" class="btn btn-primary" style="font-size:14px">Proceed to secure card payment →</button>
          <div id="stripeErr" style="color:#ff9c9c;font-size:13px;margin-top:10px"></div>
        </div>`;
      bodyEl.querySelector('#stripeGoBtn').addEventListener('click', async () => {
        const resp = await fetch(m.createUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(m.body || { orderId: r.orderId }) }).then(x=>x.json()).catch(e=>({error:String(e)}));
        if (resp.error) { bodyEl.querySelector('#stripeErr').textContent = resp.error + (resp.note?' — '+resp.note:''); return; }
        if (resp.url) window.location.href = resp.url;
      });
    } else if (m.kind === 'wire') {
      bodyEl.innerHTML = `
        <div style="padding:18px;background:rgba(0,0,0,.25);border-radius:8px">
          <p style="color:var(--ink);margin:0 0 14px">${escStore(m.note||'Bank wire transfer for enterprise orders. 1–3 business days settlement. Signed pro-forma invoice generated below.')}</p>
          <button id="wireGoBtn" class="btn btn-primary" style="font-size:14px">Generate pro-forma invoice →</button>
          <div id="wireResult" style="margin-top:14px"></div>
        </div>`;
      bodyEl.querySelector('#wireGoBtn').addEventListener('click', async () => {
        const resp = await fetch(m.requestUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(m.body || { orderId: r.orderId }) }).then(x=>x.json()).catch(e=>({error:String(e)}));
        const w = bodyEl.querySelector('#wireResult');
        if (resp.error) { w.innerHTML = '<div style="color:#ff9c9c">' + escStore(resp.error) + '</div>'; return; }
        w.innerHTML = `
          <div style="padding:14px;background:rgba(124,255,184,.06);border:1px solid rgba(124,255,184,.25);border-radius:6px">
            <div style="font-size:13px;color:var(--ink-dim);margin-bottom:6px">Wire reference (include in remittance)</div>
            <div style="font-family:monospace;font-size:16px;font-weight:700;color:#7cffb8">${escStore(resp.reference)}</div>
            <div style="margin-top:12px"><a href="${escStore(resp.downloadUrl)}" target="_blank" class="btn btn-primary" style="font-size:13px">⬇ Download pro-forma invoice (HTML)</a></div>
            <div style="margin-top:10px;font-size:12px;color:var(--ink-dim)">Bank: ${escStore(resp.invoice.payee.bank)}<br>IBAN: <code>${escStore(resp.invoice.payee.iban)}</code><br>SWIFT: <code>${escStore(resp.invoice.payee.swift)}</code></div>
          </div>`;
      });
    }
  }
  tabs.forEach((t,i) => t.addEventListener('click', () => show(i)));
  show(0);
  // Poll status
  let tries = 0;
  const poll = setInterval(async () => {
    tries++;
    const o = await fetch('/api/instant/order/'+r.orderId).then(x=>x.json()).catch(()=>null);
    const el = document.getElementById('storeOrderStatus');
    if (!el || !o) return;
    if (o.status === 'awaiting_payment') {
      el.innerHTML = `⏳ Waiting for payment confirmation… <span style="color:var(--ink-dim);font-size:11px">(polling, ${tries}s)</span>`;
    } else if (o.status === 'generating') {
      el.innerHTML = `⚙️ Payment received — generating your deliverable…`;
    } else if (o.status === 'delivered') {
      clearInterval(poll);
      el.innerHTML = `<div style="color:#7cffb8;font-weight:600;margin-bottom:10px">✅ Ready!</div>
        <div style="color:var(--ink);font-size:13px;margin-bottom:10px">${escStore(o.summary||'')}</div>
        ${(o.deliverables||[]).map(d => `<a href="${escStore(d.downloadUrl)}" target="_blank" class="btn btn-primary" style="margin:4px 6px 4px 0;font-size:13px">⬇ ${escStore(d.filename)} (${Math.round(d.size/1024)}KB)</a>`).join('')}`;
    } else if (o.status === 'failed') {
      clearInterval(poll);
      el.innerHTML = `<div style="color:#ff9c9c">❌ Fulfillment failed: ${escStore(o.error||'unknown')}</div>`;
    }
    if (tries > 600) clearInterval(poll);  // 10 min max
  }, 3000);
}

// ===== Account =====
async function hydrateAccount(){
  const root = document.getElementById('accountRoot');
  if (!root) return;
  const tok = getCustToken();
  const headers = tok ? { 'x-customer-token': tok } : {};
  const resp = await fetch('/api/customer/me', { headers, credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
  // Helper: auth form already rendered and wired — skip re-render to preserve user-typed input
  const authFormWired = () => root.dataset.accountWired === '1' && !!root.querySelector('#acLoginBtn');
  if (!resp) {
    if (!authFormWired()) renderAccountAuth(root, 'Rețea indisponibilă temporar. Reîncearcă în câteva secunde. / Temporary network issue. Please retry.');
    return;
  }
  if (resp.status === 401) {
    setCustToken('');
    setCustProfile(null);
    // Only render if auth form isn't already wired — prevents double-render race that wipes user input
    if (!authFormWired()) renderAccountAuth(root);
    return;
  }
  const me = resp.ok ? await resp.json().catch(()=>null) : null;
  if (!me) {
    if (!authFormWired()) renderAccountAuth(root, 'Contul nu poate fi încărcat acum. / Could not load account right now.');
    return;
  }
  if (!tok && me.token) setCustToken(me.token);
  if (me.customer) setCustProfile(me.customer);
  renderAccountDashboard(root, me);
}

function renderAccountAuth(root, topError){
  root.innerHTML = `
    ${topError ? `<div class="card" style="padding:14px 18px;margin-bottom:16px;border:1px solid rgba(255,80,80,.35);background:rgba(255,60,60,.08);color:#ffb7b7;font-size:13px">${escStore(topError)}</div>` : ''}
    <div class="card" style="padding:24px;margin-bottom:24px;border:1px solid rgba(124,255,184,.26);background:linear-gradient(135deg,rgba(124,255,184,.08),rgba(138,92,255,.08))">
      <div style="display:flex;justify-content:space-between;gap:18px;align-items:center;flex-wrap:wrap">
        <div style="max-width:640px">
          <span class="kicker" style="color:#7cffb8">Device Key · Passkey</span>
          <h3 style="margin:6px 0 6px">Revolutionary sign in: your device creates the private key</h3>
          <p style="color:var(--ink-dim);font-size:13.5px;line-height:1.55;margin:0">WebAuthn/FIDO2: cheia privată rămâne în Secure Enclave/TPM/browser. ZeusAI păstrează doar cheia publică și creează sesiunea client după semnătura device-ului.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;min-width:280px">
          <input id="acPasskeyEmail" type="email" placeholder="email pentru device key" autocomplete="email" style="flex:1;min-width:220px;padding:10px 12px;border-radius:6px;border:1px solid rgba(124,255,184,.3);background:rgba(10,8,30,.4);color:#fff">
          <button id="acPasskeyLoginBtn" class="btn btn-primary">Sign in with device</button>
          <button id="acPasskeyCreateBtn" class="btn">Create device key</button>
        </div>
      </div>
      <div id="acPasskeyMsg" style="font-size:13px;margin-top:12px;color:var(--ink-dim);line-height:1.5"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 6px">Log in / Conectare</h3>
        <div style="color:var(--ink-dim);font-size:13px;margin-bottom:14px">Dacă ai deja un cont — intră aici. / If you already have an account — log in here.</div>
        <input id="acLoginEmail" type="email" placeholder="email" autocomplete="email" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:10px">
        <input id="acLoginPass" type="password" placeholder="password / parolă" autocomplete="current-password" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:14px">
        <button id="acLoginBtn" class="btn btn-primary" style="width:100%">Log in →</button>
        <div id="acLoginErr" style="color:#ff9c9c;font-size:13px;margin-top:10px;line-height:1.5"></div>
        <div style="margin-top:10px;text-align:right">
          <a id="acForgotLink" href="#" style="color:#8a5cff;font-size:12.5px;text-decoration:none">Forgot password? / Ai uitat parola?</a>
        </div>
        <div id="acForgotBox" hidden style="margin-top:14px;padding:14px;border:1px solid rgba(138,92,255,.3);border-radius:8px;background:rgba(10,8,30,.4)">
          <div style="font-size:13px;color:var(--ink-dim);margin-bottom:10px">Introdu emailul; dacă există cont, primești un link de resetare valid 1h. / Enter your email; if an account exists, you'll receive a 1h reset link.</div>
          <input id="acForgotEmail" type="email" placeholder="email" autocomplete="email" style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:10px">
          <button id="acForgotBtn" class="btn btn-primary" style="width:100%">Send reset link →</button>
          <div id="acForgotMsg" style="font-size:12.5px;margin-top:10px;line-height:1.5;color:var(--ink-dim)"></div>
        </div>
        <div style="margin-top:14px;font-size:12px;color:var(--ink-dim)">Folosești aceleași credențiale pe site &amp; API (zeusai.pro + api.zeusai.pro). / Same credentials work on both site &amp; API.</div>
      </div>
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 6px">Create account / Cont nou</h3>
        <div style="color:var(--ink-dim);font-size:13px;margin-bottom:14px">Doar dacă nu ai încă cont. / Only if you don't have an account yet.</div>
        <input id="acSignupName" placeholder="name / nume (optional)" autocomplete="name" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:10px">
        <input id="acSignupEmail" type="email" placeholder="email" autocomplete="email" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:10px">
        <input id="acSignupPass" type="password" placeholder="password (min 8 chars) / parolă (min 8 caractere)" autocomplete="new-password" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:14px">
        <button id="acSignupBtn" class="btn btn-primary" style="width:100%">Sign up →</button>
        <div id="acSignupErr" style="color:#ff9c9c;font-size:13px;margin-top:10px;line-height:1.5"></div>
      </div>
    </div>`;

  const passkeyMsg = root.querySelector('#acPasskeyMsg');
  const passkeyEmail = root.querySelector('#acPasskeyEmail');
  const passkeyLoginBtn = root.querySelector('#acPasskeyLoginBtn');
  const passkeyCreateBtn = root.querySelector('#acPasskeyCreateBtn');
  function syncPasskeyEmail(email){ if (passkeyEmail && email) passkeyEmail.value = email; }
  function passkeySupported(){ return !!(window.__UNICORN_PASSKEY__ && window.__UNICORN_PASSKEY__.supported); }
  function setPasskeyMsg(message, kind){
    if (!passkeyMsg) return;
    passkeyMsg.style.color = kind === 'err' ? '#ff9c9c' : (kind === 'ok' ? '#7cffb8' : 'var(--ink-dim)');
    passkeyMsg.textContent = message || '';
  }
  async function enrollDeviceKey(email, password){
    if (!passkeySupported()) { setPasskeyMsg('Acest browser/device nu suportă passkeys. Folosește email + parolă sau Safari/Chrome/Edge actualizat.', 'err'); return null; }
    if (!email) { setPasskeyMsg('Completează emailul pentru device key.', 'err'); return null; }
    if (!password) { setPasskeyMsg('Pentru prima creare a cheii pe device, introdu parola contului o singură dată.', 'err'); return null; }
    setPasskeyMsg('Se creează cheia pe device… confirmă în browser/sistem.', 'info');
    const result = await window.__UNICORN_PASSKEY__.register(email, password);
    if (result && result.ok) setPasskeyMsg('Device key creată. De acum te poți loga fără parolă de pe acest device.', 'ok');
    else setPasskeyMsg((result && (result.message || result.error)) || 'Device key nu a putut fi creată.', 'err');
    return result;
  }
  async function loginWithDeviceKey(email){
    if (!passkeySupported()) { setPasskeyMsg('Acest browser/device nu suportă passkeys.', 'err'); return null; }
    if (!email) { setPasskeyMsg('Completează emailul pentru login cu device key.', 'err'); return null; }
    setPasskeyMsg('Aștept semnătura device-ului…', 'info');
    const result = await window.__UNICORN_PASSKEY__.login(email);
    if (result && result.token && result.customer) {
      setCustToken(result.token);
      setCustProfile(result.customer);
      setPasskeyMsg('Autentificat cu device key. Cheia privată nu a părăsit device-ul.', 'ok');
      if (typeof toast === 'function') toast('Signed in with device key', 'ok');
      hydrateAccount();
      return result;
    }
    setPasskeyMsg((result && (result.message || result.error)) || 'Login cu device key eșuat.', 'err');
    return result;
  }
  if (passkeyLoginBtn && !passkeySupported()) {
    passkeyLoginBtn.disabled = true;
    passkeyCreateBtn.disabled = true;
    setPasskeyMsg('Device key indisponibil pe acest browser. Password login rămâne disponibil.', 'err');
  }
  passkeyLoginBtn?.addEventListener('click', async () => {
    try { await loginWithDeviceKey((passkeyEmail.value || root.querySelector('#acLoginEmail').value || root.querySelector('#acSignupEmail').value || '').trim()); }
    catch (e) { setPasskeyMsg('Operațiune anulată sau refuzată de device.', 'err'); }
  });
  passkeyCreateBtn?.addEventListener('click', async () => {
    try {
      const email = (passkeyEmail.value || root.querySelector('#acLoginEmail').value || root.querySelector('#acSignupEmail').value || '').trim();
      const password = root.querySelector('#acLoginPass').value || root.querySelector('#acSignupPass').value;
      await enrollDeviceKey(email, password);
    } catch (e) { setPasskeyMsg('Crearea cheii a fost anulată sau refuzată de device.', 'err'); }
  });

  async function doLogin(){
    const email = root.querySelector('#acLoginEmail').value.trim();
    const password = root.querySelector('#acLoginPass').value;
    const errEl = root.querySelector('#acLoginErr');
    const btn = root.querySelector('#acLoginBtn');
    errEl.textContent = '';
    syncPasskeyEmail(email);
    if (!email || !password) { errEl.textContent = 'Completează email și parolă. / Fill in email and password.'; return; }
    btn.disabled = true; btn.textContent = 'Logging in…';
    try {
      const r = await fetch('/api/customer/login', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) }).then(x=>x.json());
      if (r.token) {
        setCustToken(r.token);
        if (r.customer) setCustProfile(r.customer);
        if (typeof toast === 'function') toast('Bine ai revenit! / Welcome back!', 'ok');
        setPasskeyMsg('Login reușit. Poți apăsa “Create device key” ca să activezi login fără parolă pe acest device.', 'ok');
        hydrateAccount();
        return;
      }
      // Show clear error based on server code
      if (r.error === 'email_not_found') {
        errEl.innerHTML = (r.message || 'No account for this email.') + '<br><span style="color:var(--ink-dim)">→ Create one using the form on the right. / Creează unul în dreapta.</span>';
        root.querySelector('#acSignupEmail').value = email;
      } else if (r.error === 'wrong_password') {
        errEl.textContent = r.message || 'Wrong password.';
      } else {
        errEl.textContent = r.message || r.error || 'Login failed.';
      }
    } catch (e) {
      errEl.textContent = 'Network error. / Eroare de rețea.';
    } finally {
      btn.disabled = false; btn.textContent = 'Log in →';
    }
  }

  async function doSignup(){
    const name = root.querySelector('#acSignupName').value.trim();
    const email = root.querySelector('#acSignupEmail').value.trim();
    const password = root.querySelector('#acSignupPass').value;
    const errEl = root.querySelector('#acSignupErr');
    const btn = root.querySelector('#acSignupBtn');
    errEl.textContent = '';
    syncPasskeyEmail(email);
    if (!email || !password) { errEl.textContent = 'Email și parolă obligatorii. / Email and password required.'; return; }
    if (password.length < 8) { errEl.textContent = 'Parola trebuie să aibă minim 8 caractere. / Password must be at least 8 characters.'; return; }
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const r = await fetch('/api/customer/signup', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password }) }).then(x=>x.json());
      if (r.token) {
        setCustToken(r.token);
        if (r.customer) setCustProfile(r.customer);
        if (typeof toast === 'function') toast('Cont creat! Ești conectat. / Account created — you are logged in.', 'ok');
        hydrateAccount();
        return;
      }
      if (r.error === 'email_taken') {
        errEl.innerHTML = (r.message || 'Email already in use.') + '<br><span style="color:var(--ink-dim)">→ Log in using the form on the left. / Conectează-te în stânga.</span>';
        root.querySelector('#acLoginEmail').value = email;
      } else {
        errEl.textContent = r.message || r.error || 'Signup failed.';
      }
    } catch (e) {
      errEl.textContent = 'Network error. / Eroare de rețea.';
    } finally {
      btn.disabled = false; btn.textContent = 'Sign up →';
    }
  }

  root.querySelector('#acLoginBtn').addEventListener('click', doLogin);
  root.querySelector('#acSignupBtn').addEventListener('click', doSignup);
  root.querySelector('#acLoginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  root.querySelector('#acSignupPass').addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });
  root.querySelector('#acLoginEmail').addEventListener('input', e => syncPasskeyEmail(e.target.value.trim()));
  root.querySelector('#acSignupEmail').addEventListener('input', e => syncPasskeyEmail(e.target.value.trim()));

  // Forgot password — toggle inline form, submit to /api/customer/forgot-password.
  // Server always returns 200 (anti email enumeration); message tells the user
  // to check their inbox if an account exists.
  const forgotLink = root.querySelector('#acForgotLink');
  const forgotBox = root.querySelector('#acForgotBox');
  const forgotEmail = root.querySelector('#acForgotEmail');
  const forgotBtn = root.querySelector('#acForgotBtn');
  const forgotMsg = root.querySelector('#acForgotMsg');
  if (forgotLink && forgotBox) {
    forgotLink.addEventListener('click', function(ev){
      ev.preventDefault();
      forgotBox.hidden = !forgotBox.hidden;
      if (!forgotBox.hidden) {
        // Pre-fill with whatever's in the login email field.
        try { forgotEmail.value = root.querySelector('#acLoginEmail').value || forgotEmail.value || ''; } catch(_){}
        forgotEmail.focus();
      }
    });
  }
  async function doForgot(){
    if (!forgotEmail) return;
    const email = (forgotEmail.value || '').trim();
    forgotMsg.style.color = 'var(--ink-dim)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      forgotMsg.style.color = '#ff9c9c';
      forgotMsg.textContent = 'Adresă email invalidă. / Invalid email address.';
      return;
    }
    forgotBtn.disabled = true; forgotBtn.textContent = 'Sending…';
    try {
      const r = await fetch('/api/customer/forgot-password', {
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email })
      }).then(x=>x.json()).catch(()=>({ ok:false }));
      if (r && r.ok) {
        forgotMsg.style.color = '#7cffb8';
        forgotMsg.textContent = r.message || '✓ Dacă există un cont, am trimis un link de resetare valid 1h. Verifică inbox-ul. / If an account exists, a 1h reset link was sent. Check your inbox.';
      } else if (r && r.error === 'rate_limited') {
        forgotMsg.style.color = '#ff9c9c';
        forgotMsg.textContent = r.message || 'Prea multe încercări, reia într-o oră. / Too many attempts, try again in an hour.';
      } else {
        forgotMsg.style.color = '#ff9c9c';
        forgotMsg.textContent = (r && (r.message || r.error)) || 'Nu am putut trimite link-ul. / Could not send the link.';
      }
    } catch(e) {
      forgotMsg.style.color = '#ff9c9c';
      forgotMsg.textContent = 'Network error. / Eroare de rețea.';
    } finally {
      forgotBtn.disabled = false; forgotBtn.textContent = 'Send reset link →';
    }
  }
  if (forgotBtn) forgotBtn.addEventListener('click', doForgot);
  if (forgotEmail) forgotEmail.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doForgot(); } });

  // Mark root as wired so wireExistingAccountAuth() won't double-render and wipe user input
  root.dataset.accountWired = '1';
}

function wireExistingAccountAuth(){
  const root = document.getElementById('accountRoot');
  if (!root || root.dataset.accountWired === '1') return;
  if (!root.querySelector('#acLoginBtn') || !root.querySelector('#acSignupBtn')) return;
  root.dataset.accountWired = '1';
  renderAccountAuth(root);
}

function renderAccountDashboard(root, me){
  const c = me.customer;
  root.innerHTML = `
    <div class="card" style="padding:24px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
      <div>
        <div style="font-size:13px;color:var(--ink-dim)">Signed in as</div>
        <div style="font-size:20px;font-weight:700">${escStore(c.name||c.email)}</div>
        <div style="color:var(--ink-dim);font-size:13px">${escStore(c.email)}</div>
      </div>
      <button id="acLogoutBtn" class="btn" style="background:rgba(255,80,80,.15);color:#ff9c9c;border:1px solid rgba(255,80,80,.25)">Log out</button>
    </div>

    <div class="card" style="padding:22px;margin-bottom:24px;border:1px solid rgba(124,255,184,.26);background:linear-gradient(135deg,rgba(124,255,184,.08),rgba(138,92,255,.08))">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="max-width:680px">
          <span class="kicker" style="color:#7cffb8">Device Key · Passkey</span>
          <h3 style="margin:6px 0 6px">Activează login fără parolă pe acest device</h3>
          <p style="color:var(--ink-dim);font-size:13.5px;line-height:1.55;margin:0">Contul este creat. Acum poți crea cheia privată pe device-ul tău; ZeusAI stochează doar cheia publică.</p>
        </div>
        <button id="acDashPasskeyCreateBtn" class="btn btn-primary">Create device key</button>
      </div>
      <div id="acDashPasskeyMsg" style="font-size:13px;margin-top:12px;color:var(--ink-dim);line-height:1.5"></div>
    </div>

    <h2 style="margin:28px 0 14px;font-size:24px">🚀 Active Services (${(me.activeServices||[]).length})</h2>
    ${(me.activeServices||[]).length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">${me.activeServices.map(s => `
      <div class="card" style="padding:20px;border:1px solid rgba(124,255,184,.35);background:linear-gradient(180deg,rgba(20,40,30,.5),rgba(8,6,18,.6))">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
          <div>
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7cffb8;font-weight:600">ACTIVE</div>
            <div style="font-size:17px;font-weight:700;margin-top:4px">${escStore(s.title||s.serviceId)}</div>
            ${s.kpi?`<div style="font-size:12px;color:var(--ink-dim);margin-top:2px">${escStore(s.kpi)}</div>`:''}
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:700;color:#ffd36a">$${s.amount}</div>
            <div style="font-size:10px;color:var(--ink-dim)">${escStore(String(s.currency||'USD'))}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--ink-dim);margin-top:10px">Active until ${escStore(String(s.activeUntil||'').slice(0,10))}</div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-primary svc-use" data-sid="${escStore(s.serviceId)}" style="font-size:12px;padding:8px 14px">Use now →</button>
          <a class="btn" href="${escStore(s.invoiceUrl)}" target="_blank" style="font-size:12px;padding:8px 14px">Invoice</a>
        </div>
        <div class="svc-out-${escStore(s.serviceId)}" style="margin-top:10px"></div>
      </div>`).join('')}</div>` : '<div style="color:var(--ink-dim);font-size:14px">No active services yet. <a href="/services">Browse the marketplace →</a></div>'}

    ${(me.pendingOrders||[]).length ? `
    <h2 style="margin:36px 0 14px;font-size:22px">⏳ Awaiting payment (${me.pendingOrders.length})</h2>
    <div style="display:grid;gap:12px">${me.pendingOrders.map(p => `
      <div class="card" style="padding:16px;border:1px solid rgba(255,211,106,.3)">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-weight:600">${escStore(p.plan)} — $${p.amount}</div>
            <div style="font-size:12px;color:var(--ink-dim);font-family:monospace">${escStore(p.receiptId)}</div>
            ${p.method==='BTC' ? `<div style="font-size:12px;margin-top:6px;color:var(--ink-dim)">Send <b style="color:#ffd36a">${p.btcAmount} BTC</b> to <code class="inline">${escStore(String(p.btcAddress||''))}</code></div>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${p.btcUri ? `<a class="btn btn-primary" href="${escStore(p.btcUri)}" style="font-size:12px;padding:8px 12px">Open wallet</a>` : ''}
            ${p.approveHref ? `<a class="btn btn-primary" href="${escStore(p.approveHref)}" target="_blank" style="font-size:12px;padding:8px 12px">PayPal →</a>` : ''}
            <a class="btn" href="${escStore(p.invoiceUrl)}" target="_blank" style="font-size:12px;padding:8px 12px">Invoice</a>
          </div>
        </div>
      </div>`).join('')}</div>` : ''}

    <h2 style="margin:36px 0 14px;font-size:24px">🔑 API keys (${(me.apiKeys||[]).length})</h2>
    ${(me.apiKeys||[]).length ? `<div style="display:grid;gap:10px">${me.apiKeys.map(k => `
      <div class="card" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><div style="font-family:monospace;font-size:13px">${escStore(k.keyPreview)}</div><div style="font-size:12px;color:var(--ink-dim)">${escStore(k.productId)} · order ${escStore(k.orderId)}</div></div>
        <div style="font-size:12px;color:${k.active?'#7cffb8':'#ff9c9c'}">${k.active?'active':'revoked'}</div>
      </div>`).join('')}</div>` : '<div style="color:var(--ink-dim);font-size:14px">No API keys yet. Buy <a href="/store">ZeusAI API access</a> to get one.</div>'}

    <h2 style="margin:36px 0 14px;font-size:24px">📦 Orders (${(me.orders||[]).length})</h2>
    ${(me.orders||[]).length ? `<div style="display:grid;gap:14px">${me.orders.map(o => `
      <div class="card" style="padding:18px">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:14px;flex-wrap:wrap">
          <div>
            <div style="font-size:16px;font-weight:600">${escStore(o.productId)}</div>
            <div style="font-size:12px;color:var(--ink-dim);font-family:monospace">${escStore(o.id)}</div>
            <div style="font-size:12px;color:var(--ink-dim);margin-top:4px">${escStore((o.createdAt||'').replace('T',' ').slice(0,19))}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:700;color:#ffd36a">$${o.priceUSD}</div>
            <div style="font-size:12px;color:${statusColor(o.status)};text-transform:uppercase;letter-spacing:.1em">${escStore(o.status)}</div>
          </div>
        </div>
        ${o.summary ? `<div style="font-size:13px;margin-top:10px;color:var(--ink-dim)">${escStore(o.summary)}</div>` : ''}
        ${(o.deliverables||[]).length ? `<div style="margin-top:12px">${o.deliverables.map(d => `<a href="${escStore(d.downloadUrl)}" target="_blank" class="btn btn-primary" style="margin:4px 6px 4px 0;font-size:12px">⬇ ${escStore(d.filename)}</a>`).join('')}</div>` : ''}
        ${o.status === 'awaiting_payment' ? `<div style="margin-top:12px;font-size:12px;color:var(--ink-dim);font-family:monospace;padding:8px;background:rgba(0,0,0,.25);border-radius:4px;word-break:break-all">Pay ${escStore(o.btcAmount)} BTC to ${escStore(o.btcAddress||'')}</div>` : ''}
      </div>`).join('')}</div>` : '<div style="color:var(--ink-dim);font-size:14px">No orders yet. Visit the <a href="/store">store</a> to buy your first product.</div>'}
    `;
  root.querySelector('#acLogoutBtn').addEventListener('click', async () => {
    try { await fetch('/api/customer/logout', { method:'POST', credentials:'same-origin' }); } catch(_) {}
    setCustToken('');
    setCustProfile(null);
    hydrateAccount();
  });

  const dashPasskeyBtn = root.querySelector('#acDashPasskeyCreateBtn');
  const dashPasskeyMsg = root.querySelector('#acDashPasskeyMsg');
  function setDashPasskeyMsg(message, kind){
    if (!dashPasskeyMsg) return;
    dashPasskeyMsg.style.color = kind === 'err' ? '#ff9c9c' : (kind === 'ok' ? '#7cffb8' : 'var(--ink-dim)');
    dashPasskeyMsg.textContent = message || '';
  }
  if (dashPasskeyBtn) {
    if (!(window.__UNICORN_PASSKEY__ && window.__UNICORN_PASSKEY__.supported)) {
      dashPasskeyBtn.disabled = true;
      setDashPasskeyMsg('Acest browser/device nu suportă passkeys. Folosește Safari/Chrome/Edge actualizat.', 'err');
    } else {
      dashPasskeyBtn.addEventListener('click', async () => {
        dashPasskeyBtn.disabled = true;
        dashPasskeyBtn.textContent = 'Creating device key…';
        setDashPasskeyMsg('Confirmă în browser/sistem. Cheia privată rămâne pe device.', 'info');
        try {
          const result = await window.__UNICORN_PASSKEY__.register(c.email, '');
          if (result && result.ok) setDashPasskeyMsg('Device key creată. Data viitoare poți intra cu “Sign in with device”.', 'ok');
          else setDashPasskeyMsg((result && (result.message || result.error)) || 'Device key nu a putut fi creată.', 'err');
        } catch (_) {
          setDashPasskeyMsg('Crearea cheii a fost anulată sau refuzată de device.', 'err');
        } finally {
          dashPasskeyBtn.disabled = false;
          dashPasskeyBtn.textContent = 'Create device key';
        }
      });
    }
  }

  // "Use now →" handlers for active services
  root.querySelectorAll('.svc-use').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.sid;
      const outEl = root.querySelector('.svc-out-' + CSS.escape(sid));
      if (!outEl) return;
      btn.disabled = true; btn.textContent = 'Running…';
      try {
        const r = await fetch('/api/services/'+encodeURIComponent(sid)+'/use', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'x-customer-token': getCustToken() },
          body: JSON.stringify({ ts: Date.now() })
        }).then(x => x.json());
        if (r.error) {
          outEl.innerHTML = `<div style="color:#ff9c9c;font-size:12px;padding:8px;background:rgba(255,60,60,.1);border-radius:6px">${escStore(r.message||r.error)}</div>`;
        } else {
          outEl.innerHTML = `
            <div style="padding:10px 12px;background:rgba(124,255,184,.08);border:1px solid rgba(124,255,184,.3);border-radius:6px;font-size:12px">
              <div style="color:#7cffb8;font-weight:600;margin-bottom:4px">✓ Executed ${escStore(r.executedAt||'')}</div>
              <pre style="margin:0;white-space:pre-wrap;word-break:break-word;color:var(--ink);font-family:ui-monospace,monospace;font-size:11px">${escStore(JSON.stringify(r.output, null, 2))}</pre>
            </div>`;
        }
      } catch (e) {
        outEl.innerHTML = `<div style="color:#ff9c9c;font-size:12px">Network error</div>`;
      } finally {
        btn.disabled = false; btn.textContent = 'Use now →';
      }
    });
  });
}

function statusColor(s){
  if (s==='delivered') return '#7cffb8';
  if (s==='generating'||s==='paid') return '#ffd36a';
  if (s==='failed') return '#ff9c9c';
  return 'var(--ink-dim)';
}

})();



/* === Interactive pillar cards (homepage) === */
const PILLAR_DEFS = {
  autonomy:   { title:'\u26a1 Zeus Orchestrator \u2014 Autonomy Chain',            endpoints:['/api/autonomy/stats','/api/autonomy/capabilities'], render:renderAutonomy },
  quarantine: { title:'\ud83d\udee1\ufe0f Quarantine Buffer',                         endpoints:['/api/autonomy/quarantine'],                        render:renderQuarantine },
  did:        { title:'\ud83e\udeaa Self-Sovereign DIDs',                             endpoints:['/api/autonomy/did'],                               render:renderDid },
  outcome:    { title:'\ud83d\udc8e Outcome Economics \u2014 Value-Proof Ledger',     endpoints:['/api/outcome/totals','/api/outcome/recent'],       render:renderOutcome },
  giants:     { title:'\ud83c\udf10 Giant Integration Fabric',                        endpoints:['/api/giants/stats','/api/giants/list'],            render:renderGiants },
  monetize:   { title:'\ud83d\ude80 Global Monetization Mesh',                        endpoints:['/api/monetize/summary','/api/monetize/marketplaces'], render:renderMonetize }
};

function initPillars(){
  const pane = document.getElementById('pillarLive');
  const panels = document.querySelectorAll('#pillarPanels .panel.pillar');
  if (!pane || !panels.length) return;
  panels.forEach(function(p){
    var open = function(){ openPillar(p.dataset.pillar, panels, pane); };
    p.addEventListener('click', open);
    p.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

function plCloseHandler(pane, panels){
  return function(){ pane.innerHTML=''; panels.forEach(function(p){ p.classList.remove('active'); }); };
}

async function openPillar(key, panels, pane){
  const def = PILLAR_DEFS[key];
  if (!def) return;
  panels.forEach(function(p){ p.classList.toggle('active', p.dataset.pillar === key); });
  pane.innerHTML = '<div class="pl-card"><div class="pl-head"><h3>'+def.title+'</h3><button class="pl-close" id="plClose">Close \u2715</button></div><div class="pl-output">Loading live data\u2026</div></div>';
  pane.scrollIntoView({ behavior:'smooth', block:'center' });
  document.getElementById('plClose').addEventListener('click', plCloseHandler(pane, panels));
  try {
    const payloads = await Promise.all(def.endpoints.map(function(u){
      return fetch(u, { credentials:'same-origin' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    }));
    const body = def.render.apply(null, payloads);
    const card = pane.querySelector('.pl-card');
    card.innerHTML = '<div class="pl-head"><h3>'+def.title+'</h3><button class="pl-close" id="plClose">Close \u2715</button></div>' + body;
    document.getElementById('plClose').addEventListener('click', plCloseHandler(pane, panels));
    wirePillarActions(key);
  } catch (e) {
    const out = pane.querySelector('.pl-output');
    if (out) out.textContent = 'Error: ' + (e.message || e);
  }
}

function plStat(lbl, val){ return '<div class="pl-stat"><div class="lbl">'+escapeHtml(lbl)+'</div><div class="val">'+escapeHtml(String(val==null?'\u2014':val))+'</div></div>'; }
function plFmtUSD(n){ n = Number(n||0); return '$' + n.toLocaleString('en-US', { maximumFractionDigits:2 }); }
function plShort(s, n){ s = String(s||''); return s.length > n ? s.slice(0,n) + '\u2026' : s; }
function plBtn(id, label, ghost){ return '<button class="pl-btn'+(ghost?' ghost':'')+'" id="'+id+'">'+escapeHtml(label)+'</button>'; }

async function plFetch(url, opts){
  try {
    const r = await fetch(url, Object.assign({ credentials:'same-origin' }, opts||{}));
    const t = await r.text();
    try { return JSON.parse(t); } catch(_) { return { status:r.status, body:t }; }
  } catch (e) { return { error:String(e) }; }
}
function plSetOut(txt){ const o = document.getElementById('plOut'); if (o) o.textContent = (typeof txt === 'string') ? txt : JSON.stringify(txt, null, 2); }

function wirePillarActions(key){
  if (key === 'autonomy') {
    const v = document.getElementById('plVerify');
    if (v) v.onclick = async function(){ plSetOut('Verifying\u2026'); plSetOut(await plFetch('/api/autonomy/verify')); };
    const c = document.getElementById('plViewChain');
    if (c) c.onclick = async function(){ plSetOut('Loading\u2026'); plSetOut(await plFetch('/api/autonomy/chain?limit=20')); };
  } else if (key === 'quarantine') {
    const s = document.getElementById('plStage');
    if (s) s.onclick = async function(){
      const m = document.getElementById('plQMod').value.trim();
      const rs = document.getElementById('plQReason').value.trim();
      if (!m) { plSetOut('Enter a module name.'); return; }
      plSetOut('Staging\u2026');
      plSetOut(await plFetch('/api/autonomy/quarantine/stage', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ actor:m, filePath:((document.getElementById('plQPath')||{}).value||'modules/homepage-demo.js'), reason:rs||'user-initiated', content:'/* staged from homepage pillar */' }) }));
    };
    const r = document.getElementById('plRefresh');
    if (r) r.onclick = async function(){ plSetOut('Loading\u2026'); plSetOut(await plFetch('/api/autonomy/quarantine')); };
  } else if (key === 'did') {
    const rs = document.getElementById('plResolve');
    if (rs) rs.onclick = async function(){
      const m = document.getElementById('plDidMod').value.trim();
      plSetOut('Resolving\u2026');
      plSetOut(await plFetch('/api/autonomy/did/resolve?name=' + encodeURIComponent(m)));
    };
    const vs = document.getElementById('plVerifySig');
    if (vs) vs.onclick = async function(){
      const m = document.getElementById('plDidMod').value.trim();
      const msg = document.getElementById('plDidMsg').value;
      const sig = document.getElementById('plDidSig').value.trim();
      plSetOut('Verifying\u2026');
      plSetOut(await plFetch('/api/autonomy/did/verify', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ module:m, message:msg, signature:sig }) }));
    };
  } else if (key === 'outcome') {
    const rec = document.getElementById('plRec');
    if (rec) rec.onclick = async function(){
      const body = {
        tenantId: document.getElementById('plOcTenant').value.trim(),
        action:   document.getElementById('plOcAction').value.trim(),
        valueUSD: Number(document.getElementById('plOcValue').value || 0),
        invoiceBps: Number(document.getElementById('plOcBps').value || 500)
      };
      if (!body.tenantId || !body.action || !body.valueUSD) { plSetOut('tenantId, action and valueUSD are required.'); return; }
      plSetOut('Recording\u2026');
      plSetOut(await plFetch('/api/outcome/record', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) }));
    };
    const rt = document.getElementById('plRefreshOc');
    if (rt) rt.onclick = async function(){ plSetOut('Loading\u2026'); plSetOut(await plFetch('/api/outcome/totals')); };
  } else if (key === 'giants') {
    const d = document.getElementById('plDispatch');
    if (d) d.onclick = async function(){
      let payload = {};
      try { payload = JSON.parse(document.getElementById('plGPayload').value || '{}'); }
      catch(e){ plSetOut('Invalid JSON payload.'); return; }
      const body = { giant: document.getElementById('plGiant').value, action: (document.getElementById('plGAction').value.trim() || 'inference'), payload };
      plSetOut('Dispatching\u2026');
      plSetOut(await plFetch('/api/giants/dispatch', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) }));
    };
    const l = document.getElementById('plList');
    if (l) l.onclick = async function(){ plSetOut('Loading\u2026'); plSetOut(await plFetch('/api/giants/list')); };
  } else if (key === 'monetize') {
    const p = document.getElementById('plPublish');
    if (p) p.onclick = async function(){
      const title = document.getElementById('plMTitle').value.trim();
      const priceUSD = Number(document.getElementById('plMPrice').value || 0);
      if (!title || !priceUSD) { plSetOut('title and priceUSD required.'); return; }
      const mkt = document.getElementById('plMkt').value || '';
      const body = {
        productId: title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) + '-' + Date.now().toString(36),
        name: title,
        basePriceUSD: priceUSD,
        description: document.getElementById('plMDesc').value.trim(),
        marketplaces: mkt ? [mkt] : null
      };
      plSetOut('Publishing\u2026');
      plSetOut(await plFetch('/api/monetize/publish', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) }));
    };
    const q = document.getElementById('plQuote');
    if (q) q.onclick = async function(){
      const t = document.getElementById('plMTitle').value.trim() || 'sample-product'; const body = { productId: t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'sample', marketplace: document.getElementById('plMkt').value || undefined };
      plSetOut('Quoting\u2026');
      plSetOut(await plFetch('/api/monetize/quote', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) }));
    };
  }
}

function renderAutonomy(stats, caps){
  stats = stats || {}; caps = caps || {};
  const capCount = caps.capabilities ? caps.capabilities.length : (caps.count || 0);
  return '<div class="pl-stats">'
    + plStat('Chain length', stats.length || 0)
    + plStat('Chain size', (stats.bytes ? (stats.bytes/1024).toFixed(1)+' KB' : '\u2014'))
    + plStat('Head hash', plShort(stats.head||'\u2014', 18))
    + plStat('Capabilities', capCount)
    + '</div>'
    + '<div class="pl-actions">' + plBtn('plVerify','Verify chain integrity') + plBtn('plViewChain','View last 20 decisions', true) + '</div>'
    + '<div class="pl-output" id="plOut">Every decision is Merkle-chained. Click Verify to run a live tamper-evidence check.</div>';
}

function renderQuarantine(q){
  q = q || { stats:{total:0,by:{}}, items:[] };
  const by = (q.stats && q.stats.by) || {};
  const items = (q.items||[]).slice(0,12);
  const list = items.length ? items.map(function(i){ return '<li><b>'+escapeHtml(i.module||i.id||'?')+'</b> \u00b7 '+escapeHtml(i.status||'?')+' \u00b7 '+escapeHtml(i.reason||'')+'</li>'; }).join('') : '<li>No modules currently quarantined.</li>';
  return '<div class="pl-stats">'
    + plStat('Total staged', (q.stats && q.stats.total) || 0)
    + plStat('Pending', by.pending || 0)
    + plStat('Promoted', by.promoted || 0)
    + plStat('Vetoed', by.vetoed || 0)
    + '</div>'
    + '<label>Stage a module for review</label><input id="plQMod" placeholder="actor/module name, e.g. experimental-trader" />'
    + '<div class="pl-row"><input id="plQPath" placeholder="file path, e.g. modules/experimental.js" /><input id="plQReason" placeholder="reason" /></div>'
    + '<div class="pl-actions">' + plBtn('plStage','Stage module') + plBtn('plRefresh','Refresh list', true) + '</div>'
    + '<ul class="pl-list">' + list + '</ul>'
    + '<div class="pl-output" id="plOut"></div>';
}

function renderDid(d){
  d = d || { modules:{} };
  const mods = Object.keys(d.modules||{});
  const first = mods[0] ? d.modules[mods[0]] : null;
  return '<div class="pl-stats">'
    + plStat('Module DIDs', mods.length)
    + plStat('Key type', first ? 'Ed25519' : '\u2014')
    + plStat('Sample DID', plShort((first && first.did) || '\u2014', 28))
    + '</div>'
    + '<label>Resolve a module DID</label><input id="plDidMod" placeholder="module name, e.g. safeCodeWriter" value="' + escapeHtml(mods[0]||'') + '" />'
    + '<label>Verify a signature (optional)</label><div class="pl-row"><input id="plDidMsg" placeholder="message (string)" /><input id="plDidSig" placeholder="hex signature" /></div>'
    + '<div class="pl-actions">' + plBtn('plResolve','Resolve DID document') + plBtn('plVerifySig','Verify signature', true) + '</div>'
    + '<div class="pl-output" id="plOut">Click Resolve to fetch a W3C DID document with the Ed25519 public key.</div>';
}

function renderOutcome(t, recent){
  t = t || { count:0, totalValueDeliveredUSD:0, byAction:{} };
  const arr = Array.isArray(recent) ? recent : ((recent && recent.items) || []);
  const list = arr.slice(0,8).length ? arr.slice(0,8).map(function(o){ return '<li><b>'+escapeHtml(o.action||o.type||'outcome')+'</b> \u00b7 '+plFmtUSD(o.valueUSD||o.amount||0)+' \u00b7 '+escapeHtml(o.tenantId||o.customerId||'\u2014')+'</li>'; }).join('') : '<li>No outcomes recorded yet.</li>';
  return '<div class="pl-stats">'
    + plStat('Outcomes recorded', t.count || 0)
    + plStat('Value delivered', plFmtUSD(t.totalValueDeliveredUSD))
    + plStat('Actions tracked', Object.keys(t.byAction||{}).length)
    + '</div>'
    + '<label>Record a delivered outcome</label><div class="pl-row"><input id="plOcTenant" placeholder="tenant/customer id" /><input id="plOcAction" placeholder="action (e.g. risk-score)" /></div>'
    + '<div class="pl-row"><input id="plOcValue" type="number" placeholder="value delivered (USD)" /><input id="plOcBps" type="number" placeholder="invoice bps" value="500" /></div>'
    + '<div class="pl-actions">' + plBtn('plRec','Record outcome (signed)') + plBtn('plRefreshOc','Refresh totals', true) + '</div>'
    + '<ul class="pl-list">' + list + '</ul>'
    + '<div class="pl-output" id="plOut"></div>';
}

function renderGiants(stats, list){
  stats = stats || { giants:42, tracked:0, totalCalls:0, totalRevenueUSD:0 };
  const arr = Array.isArray(list) ? list : ((list && (list.giants || list.list)) || []);
  const opts = arr.slice(0,60).map(function(g){ return '<option value="'+escapeHtml(g.id||g.name||g)+'">'+escapeHtml(g.name||g.id||g)+'</option>'; }).join('') || '<option value="openai">openai</option><option value="aws">aws</option><option value="azure">azure</option>';
  return '<div class="pl-stats">'
    + plStat('Giants integrated', stats.giants || arr.length || 42)
    + plStat('Tracked', stats.tracked || 0)
    + plStat('Total calls', (stats.totalCalls||0).toLocaleString())
    + plStat('Revenue routed', plFmtUSD(stats.totalRevenueUSD))
    + '</div>'
    + '<label>Target giant</label><select id="plGiant">' + opts + '</select>'
    + '<label>Action</label><input id="plGAction" value="inference" />'
    + '<label>Payload (JSON)</label><textarea id="plGPayload" rows="3">{"prompt":"hello from ZeusAI"}</textarea>'
    + '<div class="pl-actions">' + plBtn('plDispatch','Dispatch to giant') + plBtn('plList','List all giants', true) + '</div>'
    + '<div class="pl-output" id="plOut"></div>';
}

function renderMonetize(sum, mkts){
  sum = sum || { products:0, marketplaces:41, totalReach:0, totalSales:0, totalNetUSD:0 };
  const arr = Array.isArray(mkts) ? mkts : ((mkts && (mkts.marketplaces || mkts.list)) || []);
  const opts = arr.slice(0,60).map(function(m){ return '<option value="'+escapeHtml(m.id||m.name||m)+'">'+escapeHtml(m.name||m.id||m)+(m.reach?' ('+Number(m.reach).toLocaleString()+' reach)':'')+'</option>'; }).join('');
  return '<div class="pl-stats">'
    + plStat('Marketplaces', sum.marketplaces || arr.length || 41)
    + plStat('Total reach', (sum.totalReach||0).toLocaleString())
    + plStat('Listings', sum.products || 0)
    + plStat('Net revenue', plFmtUSD(sum.totalNetUSD))
    + '</div>'
    + '<label>Listing title</label><input id="plMTitle" placeholder="ZeusAI Pro Predictive Engine" />'
    + '<div class="pl-row"><div><label>Price (USD)</label><input id="plMPrice" type="number" value="99" /></div><div><label>Target marketplace</label><select id="plMkt"><option value="">\u2014 all 41 \u2014</option>' + opts + '</select></div></div>'
    + '<label>Short description</label><textarea id="plMDesc" rows="2"></textarea>'
    + '<div class="pl-actions">' + plBtn('plPublish','Publish to mesh') + plBtn('plQuote','Get bandit quote', true) + '</div>'
    + '<div class="pl-output" id="plOut"></div>';
}
