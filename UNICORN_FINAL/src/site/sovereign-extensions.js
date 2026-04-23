// SOVEREIGN EXTENSIONS — 30Y-LTS upgrade layer for ZeusAI
// Original work © Vladoi Ionut. Adds: SEO discovery, Prometheus metrics,
// green-score, archive, intent bus, payment router, verifiable receipts,
// Accept-Language i18n detection, dedup headers, stablecoin-agnostic routing.
// Additive: all routes return EARLY before the legacy dispatcher.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OWNER = {
  name: process.env.OWNER_NAME || 'Vladoi Ionut',
  email: process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
  btc: process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  paypal: process.env.PAYPAL_ME || process.env.PAYPAL_EMAIL || 'vladoi_ionut@yahoo.com',
  domain: process.env.PUBLIC_APP_URL || 'https://zeusai.pro'
};

// ── Metrics registry ────────────────────────────────────────────────────────
const METRICS = {
  startedAt: Date.now(),
  requests: { total: 0, byRoute: new Map(), byStatus: new Map() },
  gco2: 0,           // grams CO2e — estimate
  bytesOut: 0,
  lastPath: null,
};
function recordMetric(path, status, bytes) {
  METRICS.requests.total++;
  METRICS.requests.byRoute.set(path, (METRICS.requests.byRoute.get(path) || 0) + 1);
  METRICS.requests.byStatus.set(status, (METRICS.requests.byStatus.get(status) || 0) + 1);
  METRICS.bytesOut += bytes || 0;
  // Rough estimate: 0.00006 gCO2 per KB served (globally averaged 2026 mix)
  METRICS.gco2 += ((bytes || 0) / 1024) * 0.00006;
  METRICS.lastPath = path;
}

// ── Archive (content-addressable snapshot history) ──────────────────────────
const ARCHIVE = new Map(); // id -> { at, sha, payload }
function archivePush(payload) {
  const json = JSON.stringify(payload);
  const sha = crypto.createHash('sha256').update(json).digest('hex');
  const id = Date.now().toString(36) + '-' + sha.slice(0, 12);
  ARCHIVE.set(id, { at: Date.now(), sha, payload });
  // Cap archive at 500 entries
  if (ARCHIVE.size > 500) {
    const firstKey = ARCHIVE.keys().next().value;
    ARCHIVE.delete(firstKey);
  }
  return { id, sha };
}

// ── Signing (Ed25519, reuses global key) ────────────────────────────────────
function getSigningKey() {
  try {
    if (global.__SITE_SIGN_KEY__) return global.__SITE_SIGN_KEY__;
    const kp = crypto.generateKeyPairSync('ed25519');
    global.__SITE_SIGN_KEY__ = kp.privateKey;
    return kp.privateKey;
  } catch (_) { return null; }
}
function signPayload(obj) {
  try {
    const key = getSigningKey();
    if (!key) return null;
    const json = JSON.stringify(obj);
    const sig = crypto.sign(null, Buffer.from(json), key).toString('base64');
    return sig;
  } catch (_) { return null; }
}

// ── Language detection from Accept-Language ─────────────────────────────────
const SUPPORTED_LANGS = ['en', 'ro', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ar', 'ru', 'hi'];
function detectLang(req) {
  const hdr = String(req.headers['accept-language'] || '').toLowerCase();
  if (!hdr) return 'en';
  const prefs = hdr.split(',').map(p => {
    const [code, q] = p.trim().split(';q=');
    return { code: code.split('-')[0], q: Number(q || 1) };
  }).sort((a, b) => b.q - a.q);
  for (const p of prefs) if (SUPPORTED_LANGS.includes(p.code)) return p.code;
  return 'en';
}

// ── Payment route (stablecoin-agnostic) ─────────────────────────────────────
const PAY_RAILS = [
  { id: 'btc_lightning', name: 'Bitcoin Lightning', feePct: 0.10, finalitySec: 3,  currency: 'BTC',  live: true,  address: OWNER.btc, network: 'lightning' },
  { id: 'btc_onchain',   name: 'Bitcoin On-Chain',  feePct: 0.80, finalitySec: 600,currency: 'BTC',  live: true,  address: OWNER.btc, network: 'bitcoin'   },
  { id: 'usdc_base',     name: 'USDC on Base',      feePct: 0.05, finalitySec: 2,  currency: 'USDC', live: false, network: 'base'      },
  { id: 'usdc_polygon',  name: 'USDC on Polygon',   feePct: 0.08, finalitySec: 4,  currency: 'USDC', live: false, network: 'polygon'   },
  { id: 'eurc_solana',   name: 'EURC on Solana',    feePct: 0.04, finalitySec: 1,  currency: 'EURC', live: false, network: 'solana'    },
  { id: 'paypal',        name: 'PayPal',             feePct: 3.49, finalitySec: 60, currency: 'USD',  live: !!process.env.PAYPAL_CLIENT_ID, network: 'paypal' },
  { id: 'sepa_instant',  name: 'SEPA Instant',      feePct: 0.00, finalitySec: 10, currency: 'EUR',  live: false, network: 'sepa' },
];
function selectRail(amount, currency) {
  const live = PAY_RAILS.filter(r => r.live);
  // Score = -feePct - finalitySec/30 (prefer lower fee AND faster)
  const scored = live.map(r => ({ ...r, score: -r.feePct - r.finalitySec / 30 })).sort((a, b) => b.score - a.score);
  return { recommended: scored[0] || null, candidates: scored, currency, amount };
}

// ── Verifiable receipt (W3C VC-like, Ed25519 signed) ────────────────────────
const RECEIPTS = new Map(); // id -> VC
function mintReceipt(order) {
  const id = 'rcpt-' + crypto.randomBytes(8).toString('hex');
  const vc = {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://zeusai.pro/contexts/receipt/v1'],
    id: `urn:zeusai:receipt:${id}`,
    type: ['VerifiableCredential', 'SovereignReceipt'],
    issuer: { id: 'did:web:zeusai.pro', name: OWNER.name },
    issuanceDate: new Date().toISOString(),
    credentialSubject: order,
    proof: {
      type: 'Ed25519Signature2020',
      proofPurpose: 'assertionMethod',
      created: new Date().toISOString(),
      verificationMethod: 'did:web:zeusai.pro#sig-1',
    }
  };
  vc.proof.jws = signPayload({
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate,
    credentialSubject: vc.credentialSubject,
  });
  RECEIPTS.set(id, vc);
  // Cap at 10k
  if (RECEIPTS.size > 10000) {
    const firstKey = RECEIPTS.keys().next().value;
    RECEIPTS.delete(firstKey);
  }
  return { id, vc };
}

// ── Body reader ─────────────────────────────────────────────────────────────
function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > maxBytes) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Unicorn-Sovereign': '1',
  });
  res.end(body);
  recordMetric(res.__pathForMetric || '/', code, Buffer.byteLength(body));
}

// ── Handler ─────────────────────────────────────────────────────────────────
async function handle(req, res, ctx) {
  const urlPath = (req.url || '/').split('?')[0];
  res.__pathForMetric = urlPath;
  const lang = detectLang(req);

  // Inject green score header on every sovereign route
  res.setHeader('X-Green-GCO2', METRICS.gco2.toFixed(6));
  res.setHeader('X-Unicorn-Lang', lang);

  // ── /robots.txt ────────────────────────────────────────────────────────
  if (urlPath === '/robots.txt') {
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/admin/',
      'Disallow: /dashboard',
      'Disallow: /account',
      '',
      `Sitemap: ${OWNER.domain}/sitemap.xml`,
      `Host: ${OWNER.domain.replace(/^https?:\/\//, '')}`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /sitemap.xml ───────────────────────────────────────────────────────
  if (urlPath === '/sitemap.xml') {
    const baseUrls = ['/', '/services', '/store', '/enterprise', '/pricing', '/how', '/docs', '/about', '/legal'];
    const now = new Date().toISOString();
    // Auto-discover all services from live snapshot so every current AND future
    // service is indexed by Google/Bing the moment it appears in /snapshot.
    let serviceUrls = [];
    try {
      if (ctx && typeof ctx.buildSnapshot === 'function') {
        const snap = ctx.buildSnapshot();
        const items = [].concat(snap.marketplace || [], snap.services || []);
        const seen = new Set();
        for (const s of items) {
          const id = s && (s.id || s.serviceId);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          serviceUrls.push(`/services/${encodeURIComponent(id)}`);
        }
      }
    } catch (_) {}
    const all = baseUrls.concat(serviceUrls);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url><loc>${OWNER.domain}${u}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>${u === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
    res.end(xml);
    recordMetric(urlPath, 200, xml.length);
    return true;
  }

  // ── /manifest.webmanifest ──────────────────────────────────────────────
  if (urlPath === '/manifest.webmanifest' || urlPath === '/site.webmanifest') {
    const manifest = {
      name: 'ZeusAI — Sovereign AI OS',
      short_name: 'ZeusAI',
      description: 'Autonomous AI operating system. 169 modules, 18 verticals, 41 marketplaces.',
      start_url: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#05040a',
      theme_color: '#05040a',
      lang,
      scope: '/',
      icons: [
        { src: '/assets/zeus/brand.jpg', sizes: '192x192', type: 'image/jpeg', purpose: 'any' },
        { src: '/assets/zeus/brand.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any' }
      ],
      categories: ['business', 'productivity', 'finance', 'ai']
    };
    res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    const body = JSON.stringify(manifest, null, 2);
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /metrics (Prometheus exposition) ───────────────────────────────────
  if (urlPath === '/metrics') {
    const uptimeSec = (Date.now() - METRICS.startedAt) / 1000;
    const lines = [];
    lines.push('# HELP unicorn_up Service up.');
    lines.push('# TYPE unicorn_up gauge');
    lines.push('unicorn_up 1');
    lines.push('# HELP unicorn_uptime_seconds Seconds since boot.');
    lines.push('# TYPE unicorn_uptime_seconds counter');
    lines.push(`unicorn_uptime_seconds ${uptimeSec.toFixed(2)}`);
    lines.push('# HELP unicorn_requests_total Total HTTP requests served by sovereign layer.');
    lines.push('# TYPE unicorn_requests_total counter');
    lines.push(`unicorn_requests_total ${METRICS.requests.total}`);
    lines.push('# HELP unicorn_bytes_out_total Total response bytes served.');
    lines.push('# TYPE unicorn_bytes_out_total counter');
    lines.push(`unicorn_bytes_out_total ${METRICS.bytesOut}`);
    lines.push('# HELP unicorn_gco2_total Estimated grams CO2e emitted.');
    lines.push('# TYPE unicorn_gco2_total counter');
    lines.push(`unicorn_gco2_total ${METRICS.gco2.toFixed(6)}`);
    lines.push('# HELP unicorn_requests_by_status HTTP responses by status code.');
    lines.push('# TYPE unicorn_requests_by_status counter');
    for (const [s, n] of METRICS.requests.byStatus) lines.push(`unicorn_requests_by_status{code="${s}"} ${n}`);
    const mem = process.memoryUsage();
    lines.push('# HELP unicorn_process_rss_bytes Resident set size.');
    lines.push('# TYPE unicorn_process_rss_bytes gauge');
    lines.push(`unicorn_process_rss_bytes ${mem.rss}`);
    lines.push('# HELP unicorn_archive_size Archive snapshot count.');
    lines.push('# TYPE unicorn_archive_size gauge');
    lines.push(`unicorn_archive_size ${ARCHIVE.size}`);
    lines.push('# HELP unicorn_receipts_total Verifiable receipts minted.');
    lines.push('# TYPE unicorn_receipts_total counter');
    lines.push(`unicorn_receipts_total ${RECEIPTS.size}`);
    const body = lines.join('\n') + '\n';
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /green — human-readable green score ────────────────────────────────
  if (urlPath === '/green' || urlPath === '/api/green') {
    const uptimeSec = (Date.now() - METRICS.startedAt) / 1000;
    return sendJson(res, 200, {
      gco2e_total: Number(METRICS.gco2.toFixed(6)),
      gco2e_per_request: METRICS.requests.total ? Number((METRICS.gco2 / METRICS.requests.total).toFixed(9)) : 0,
      bytes_out_total: METRICS.bytesOut,
      requests_total: METRICS.requests.total,
      uptime_seconds: Number(uptimeSec.toFixed(2)),
      grid_mix_assumption: '2026 global average, 475 gCO2/kWh',
      methodology: 'Website Carbon Calculator v3 approximation',
      verdict: METRICS.gco2 < 1 ? 'A+' : METRICS.gco2 < 10 ? 'A' : 'B',
    }) || true;
  }

  // ── /api/i18n/detect ───────────────────────────────────────────────────
  if (urlPath === '/api/i18n/detect') {
    sendJson(res, 200, { lang, supported: SUPPORTED_LANGS, accept: req.headers['accept-language'] || null });
    return true;
  }

  // ── /api/pay/route — stablecoin-agnostic rail recommendation ───────────
  if (urlPath === '/api/pay/route') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const amount = Number(body.amount || 0);
      const currency = String(body.currency || 'USD').toUpperCase();
      sendJson(res, 200, selectRail(amount, currency));
      return true;
    }
    sendJson(res, 200, { rails: PAY_RAILS });
    return true;
  }

  // ── /api/intent — Universal Intent Bus ─────────────────────────────────
  if (urlPath === '/api/intent' && req.method === 'POST') {
    const body = await readBody(req);
    const intent = String(body.intent || body.action || '').toLowerCase();
    const args = body.args || body.params || {};
    let response = { intent, args, handled: false, next: null };

    // Intent vocabulary
    if (/^(explore|browse|discover)(_services)?$/.test(intent)) {
      response.handled = true;
      response.next = { route: '/services', method: 'GET' };
    } else if (/^(buy|purchase|checkout)$/.test(intent)) {
      response.handled = true;
      response.next = { route: '/api/services/buy', method: 'POST', body: args };
    } else if (/^price|quote$/.test(intent)) {
      response.handled = true;
      response.next = { route: `/api/billing/plans/public`, method: 'GET' };
    } else if (/^dashboard|portal$/.test(intent)) {
      response.handled = true;
      response.next = { route: '/dashboard', method: 'GET' };
    } else if (/^pay|route_payment$/.test(intent)) {
      response.handled = true;
      response.next = { route: '/api/pay/route', method: 'POST', body: args };
    } else {
      response.hint = 'Supported intents: explore, buy, price, dashboard, pay';
    }
    const archived = archivePush({ kind: 'intent', intent, args, ts: new Date().toISOString() });
    response.archiveId = archived.id;
    sendJson(res, 200, response);
    return true;
  }

  // ── /api/receipt/:id ───────────────────────────────────────────────────
  if (urlPath.startsWith('/api/receipt/')) {
    const id = urlPath.slice('/api/receipt/'.length);
    if (id === 'mint' && req.method === 'POST') {
      const body = await readBody(req);
      const { id: rid, vc } = mintReceipt(body);
      res.setHeader('Location', `/api/receipt/${rid}`);
      sendJson(res, 201, { id: rid, vc });
      return true;
    }
    const rec = RECEIPTS.get(id);
    if (!rec) { sendJson(res, 404, { error: 'receipt_not_found', id }); return true; }
    sendJson(res, 200, rec);
    return true;
  }

  // ── /archive — list recent snapshots ───────────────────────────────────
  if (urlPath === '/archive' || urlPath === '/api/archive') {
    const list = [];
    for (const [id, e] of ARCHIVE) list.push({ id, at: new Date(e.at).toISOString(), sha: e.sha });
    sendJson(res, 200, { total: list.length, items: list.slice(-100).reverse() });
    return true;
  }

  // ── /archive/:id — retrieve by content hash ────────────────────────────
  if (urlPath.startsWith('/archive/') || urlPath.startsWith('/api/archive/')) {
    const id = urlPath.split('/').pop();
    const e = ARCHIVE.get(id);
    if (!e) { sendJson(res, 404, { error: 'archive_not_found', id }); return true; }
    sendJson(res, 200, { id, sha: e.sha, at: new Date(e.at).toISOString(), payload: e.payload });
    return true;
  }

  // ── /api/sovereign/status — public manifesto ───────────────────────────
  if (urlPath === '/api/sovereign/status') {
    const uptimeSec = (Date.now() - METRICS.startedAt) / 1000;
    const status = {
      brand: 'ZeusAI',
      owner: OWNER.name,
      domain: OWNER.domain,
      uptime_seconds: Number(uptimeSec.toFixed(2)),
      lang,
      supported_langs: SUPPORTED_LANGS,
      pay_rails: PAY_RAILS.map(r => ({ id: r.id, currency: r.currency, live: r.live, feePct: r.feePct, finalitySec: r.finalitySec })),
      post_quantum_ready: { kyber768: 'roadmap-2027', dilithium3: 'roadmap-2027', ed25519: 'live' },
      integrity: '/integrity.json',
      metrics: '/metrics',
      sitemap: '/sitemap.xml',
      receipts: '/api/receipt/:id',
      green: '/green',
      archive: '/archive',
      intent_bus: '/api/intent',
      payments: '/api/pay/route',
      generated_at: new Date().toISOString(),
    };
    status.signature = signPayload(status);
    sendJson(res, 200, status);
    return true;
  }

  // Not a sovereign route — let the legacy dispatcher handle it
  return false;
}

module.exports = {
  handle,
  recordMetric,
  METRICS,
  ARCHIVE,
  RECEIPTS,
  PAY_RAILS,
  OWNER,
  SUPPORTED_LANGS,
  detectLang,
  signPayload,
  mintReceipt,
  archivePush,
};
