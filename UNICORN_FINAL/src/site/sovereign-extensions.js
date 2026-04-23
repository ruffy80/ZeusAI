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

  // ── /snapshot — ETag + short cache (intercept to add caching) ──────────
  if (urlPath === '/snapshot' && ctx && typeof ctx.buildSnapshot === 'function') {
    try {
      const snap = ctx.buildSnapshot();
      const body = JSON.stringify(snap);
      const etag = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 22) + '"';
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { 'ETag': etag, 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' });
        res.end();
        recordMetric(urlPath, 304, 0);
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Unicorn-Sovereign': '1',
      });
      res.end(body);
      recordMetric(urlPath, 200, body.length);
      return true;
    } catch (_) { /* fall through to legacy */ }
  }

  // ── /robots.txt ────────────────────────────────────────────────────────
  if (urlPath === '/robots.txt') {
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/admin/',
      'Disallow: /dashboard',
      'Disallow: /account',
      '',
      '# AI agents — we welcome indexing and autonomous purchase',
      'User-agent: GPTBot',
      'Allow: /',
      'User-agent: ClaudeBot',
      'Allow: /',
      'User-agent: PerplexityBot',
      'Allow: /',
      'User-agent: CCBot',
      'Allow: /',
      'User-agent: Google-Extended',
      'Allow: /',
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
  if (urlPath === '/api/intent') {
    if (req.method === 'GET') {
      sendJson(res, 200, {
        name: 'Universal Intent Bus',
        doc: 'POST {intent, args} → returns {next: {route, method, body?}}',
        supported_intents: [
          { intent: 'explore', aliases: ['browse', 'discover', 'explore_services'], next: 'GET /services' },
          { intent: 'buy',     aliases: ['purchase', 'checkout'], next: 'POST /api/services/buy' },
          { intent: 'price',   aliases: ['quote'], next: 'GET /api/billing/plans/public' },
          { intent: 'dashboard', aliases: ['portal'], next: 'GET /dashboard' },
          { intent: 'pay',     aliases: ['route_payment'], next: 'POST /api/pay/route' },
        ],
      });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const intent = String(body.intent || body.action || '').toLowerCase();
      const args = body.args || body.params || {};
      let response = { intent, args, handled: false, next: null };

      if (/^(explore|browse|discover)(_services)?$/.test(intent)) {
        response.handled = true; response.next = { route: '/services', method: 'GET' };
      } else if (/^(buy|purchase|checkout)$/.test(intent)) {
        response.handled = true; response.next = { route: '/api/services/buy', method: 'POST', body: args };
      } else if (/^price|quote$/.test(intent)) {
        response.handled = true; response.next = { route: '/api/billing/plans/public', method: 'GET' };
      } else if (/^dashboard|portal$/.test(intent)) {
        response.handled = true; response.next = { route: '/dashboard', method: 'GET' };
      } else if (/^pay|route_payment$/.test(intent)) {
        response.handled = true; response.next = { route: '/api/pay/route', method: 'POST', body: args };
      } else {
        response.hint = 'Supported intents: explore, buy, price, dashboard, pay';
      }
      const archived = archivePush({ kind: 'intent', intent, args, ts: new Date().toISOString() });
      response.archiveId = archived.id;
      sendJson(res, 200, response);
      return true;
    }
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

  // ══════════════════════════════════════════════════════════════════════
  // AUTONOMOUS COMMERCE SURFACE — added 2026-04-24
  // Goal: make every current & future Unicorn service discoverable and
  // purchasable by humans AND autonomous AI agents, worldwide, zero touch.
  // ══════════════════════════════════════════════════════════════════════

  // ── /llms.txt — LLM discovery index (Perplexity/Claude/ChatGPT crawlers) ──
  if (urlPath === '/llms.txt') {
    const body = [
      '# ZeusAI',
      '',
      `> Autonomous AI operating system by ${OWNER.name}. 169+ modules, 18 verticals, 41 marketplaces. Sells globally, settles in BTC/Lightning/SEPA/USDC.`,
      '',
      '## Machine-readable surfaces',
      `- [Service catalog (signed)](${OWNER.domain}/catalog.json)`,
      `- [Agent catalog](${OWNER.domain}/api/agent/catalog)`,
      `- [OpenAPI spec](${OWNER.domain}/openapi.json)`,
      `- [AI plugin manifest](${OWNER.domain}/.well-known/ai-plugin.json)`,
      `- [MCP manifest](${OWNER.domain}/.well-known/mcp.json)`,
      `- [JSON Feed](${OWNER.domain}/feed.json)`,
      `- [Sitemap](${OWNER.domain}/sitemap.xml)`,
      '',
      '## Commerce endpoints (for AI agents)',
      `- POST ${OWNER.domain}/api/agent/quote  — get signed price quote`,
      `- POST ${OWNER.domain}/api/agent/order  — create order, returns VC receipt`,
      `- POST ${OWNER.domain}/api/pay/route    — payment rail recommendation`,
      '',
      '## Trust',
      `- DID: did:web:${OWNER.domain.replace(/^https?:\/\//, '')} — [${OWNER.domain}/.well-known/did.json]`,
      `- Security: ${OWNER.domain}/.well-known/security.txt`,
      `- Receipts are W3C Verifiable Credentials signed Ed25519`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /.well-known/security.txt (RFC 9116) ──────────────────────────────────
  if (urlPath === '/.well-known/security.txt' || urlPath === '/security.txt') {
    const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const body = [
      `Contact: mailto:${OWNER.email}`,
      `Expires: ${expires}`,
      `Preferred-Languages: en, ro`,
      `Canonical: ${OWNER.domain}/.well-known/security.txt`,
      `Policy: ${OWNER.domain}/legal`,
      '',
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /.well-known/did.json — DID Web document ─────────────────────────────
  if (urlPath === '/.well-known/did.json' || urlPath === '/did.json') {
    const host = OWNER.domain.replace(/^https?:\/\//, '');
    // Derive the public key from our signing keypair (Ed25519)
    let pubB64 = null;
    try {
      const priv = getSigningKey();
      if (priv) {
        const pub = crypto.createPublicKey(priv);
        const der = pub.export({ type: 'spki', format: 'der' });
        pubB64 = der.toString('base64');
      }
    } catch (_) {}
    const doc = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
      id: `did:web:${host}`,
      verificationMethod: [{
        id: `did:web:${host}#sig-1`,
        type: 'Ed25519VerificationKey2020',
        controller: `did:web:${host}`,
        publicKeyBase64: pubB64,
      }],
      assertionMethod: [`did:web:${host}#sig-1`],
      service: [
        { id: `did:web:${host}#catalog`, type: 'ServiceCatalog', serviceEndpoint: `${OWNER.domain}/catalog.json` },
        { id: `did:web:${host}#commerce`, type: 'AgentCommerce', serviceEndpoint: `${OWNER.domain}/api/agent/catalog` },
      ],
    };
    return (sendJson(res, 200, doc), true);
  }

  // ── /.well-known/ai-plugin.json — OpenAI/Claude plugin manifest ──────────
  if (urlPath === '/.well-known/ai-plugin.json' || urlPath === '/ai-plugin.json') {
    return (sendJson(res, 200, {
      schema_version: 'v1',
      name_for_human: 'ZeusAI',
      name_for_model: 'zeusai',
      description_for_human: 'Browse and buy 169+ Unicorn services autonomously.',
      description_for_model: 'Lets an AI agent discover, quote and purchase Unicorn services. Supports BTC, Lightning, USDC, SEPA. Returns Ed25519-signed Verifiable Credential receipts.',
      auth: { type: 'none' },
      api: { type: 'openapi', url: `${OWNER.domain}/openapi.json` },
      logo_url: `${OWNER.domain}/assets/zeus/brand.jpg`,
      contact_email: OWNER.email,
      legal_info_url: `${OWNER.domain}/legal`,
    }), true);
  }

  // ── /.well-known/mcp.json — Model Context Protocol discovery ─────────────
  if (urlPath === '/.well-known/mcp.json' || urlPath === '/mcp.json') {
    return (sendJson(res, 200, {
      mcpVersion: '2025-03-26',
      server: { name: 'zeusai', version: '1.0.0', vendor: OWNER.name },
      capabilities: { tools: true, resources: true, prompts: false },
      tools: [
        { name: 'catalog_list',   description: 'List available Unicorn services with current prices', endpoint: `${OWNER.domain}/api/agent/catalog`, method: 'GET' },
        { name: 'service_quote',  description: 'Get signed quote for a specific service', endpoint: `${OWNER.domain}/api/agent/quote`, method: 'POST' },
        { name: 'service_order',  description: 'Place an order; returns W3C Verifiable Credential receipt', endpoint: `${OWNER.domain}/api/agent/order`, method: 'POST' },
        { name: 'payment_route',  description: 'Recommend cheapest/fastest payment rail', endpoint: `${OWNER.domain}/api/pay/route`, method: 'POST' },
      ],
      resources: [
        { uri: `${OWNER.domain}/catalog.json`, name: 'Signed service catalog', mimeType: 'application/json' },
        { uri: `${OWNER.domain}/feed.json`, name: 'Service update feed (JSON Feed 1.1)', mimeType: 'application/feed+json' },
      ],
    }), true);
  }

  // ── /openapi.json — public OpenAPI 3.1 spec ──────────────────────────────
  if (urlPath === '/openapi.json' || urlPath === '/api/openapi.json') {
    return (sendJson(res, 200, {
      openapi: '3.1.0',
      info: { title: 'ZeusAI Sovereign API', version: '1.0.0', description: 'Autonomous commerce for Unicorn services.', contact: { name: OWNER.name, email: OWNER.email } },
      servers: [{ url: OWNER.domain }],
      paths: {
        '/api/agent/catalog': { get: { operationId: 'listCatalog', summary: 'List all sellable services', responses: { '200': { description: 'Catalog', content: { 'application/json': {} } } } } },
        '/api/agent/quote':   { post: { operationId: 'quoteService', summary: 'Get signed quote', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { serviceId: { type: 'string' }, currency: { type: 'string' }, qty: { type: 'number' } }, required: ['serviceId'] } } } }, responses: { '200': { description: 'Signed quote' } } } },
        '/api/agent/order':   { post: { operationId: 'orderService', summary: 'Place order, receive VC receipt', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { quoteId: { type: 'string' }, buyer: { type: 'object' } }, required: ['quoteId'] } } } }, responses: { '201': { description: 'Receipt minted' } } } },
        '/api/pay/route':     { post: { operationId: 'routePayment', summary: 'Pick best payment rail', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number' }, currency: { type: 'string' } } } } } }, responses: { '200': { description: 'Recommendation' } } } },
        '/api/i18n/detect':   { get: { operationId: 'detectLang', summary: 'Detect language from Accept-Language', responses: { '200': { description: 'Lang' } } } },
        '/api/sovereign/status': { get: { operationId: 'status', summary: 'Signed sovereign status', responses: { '200': { description: 'Status' } } } },
        '/api/receipt/{id}':  { get: { operationId: 'getReceipt', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'VC' }, '404': { description: 'Not found' } } } },
        '/catalog.json':      { get: { operationId: 'signedCatalog', summary: 'Ed25519-signed full catalog', responses: { '200': { description: 'Signed catalog' } } } },
        '/feed.json':         { get: { operationId: 'feed', summary: 'JSON Feed 1.1', responses: { '200': { description: 'Feed' } } } },
      },
    }), true);
  }

  // ── /feed.json — JSON Feed 1.1 of recent services/updates ────────────────
  if (urlPath === '/feed.json') {
    const items = [];
    try {
      if (ctx && typeof ctx.buildSnapshot === 'function') {
        const snap = ctx.buildSnapshot();
        const all = [].concat(snap.marketplace || [], snap.services || []).filter(s => s && s.id);
        for (const s of all.slice(0, 100)) {
          items.push({
            id: `${OWNER.domain}/services/${s.id}`,
            url: `${OWNER.domain}/services/${s.id}`,
            title: s.name || s.title || s.id,
            content_text: s.description || s.summary || `Unicorn service ${s.id}`,
            date_published: new Date().toISOString(),
            tags: s.tags || s.categories || undefined,
          });
        }
      }
    } catch (_) {}
    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'ZeusAI Service Feed',
      home_page_url: OWNER.domain,
      feed_url: `${OWNER.domain}/feed.json`,
      description: 'Current catalog of Unicorn services.',
      language: lang,
      authors: [{ name: OWNER.name, url: OWNER.domain }],
      items,
    };
    res.writeHead(200, { 'Content-Type': 'application/feed+json; charset=utf-8', 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' });
    const body = JSON.stringify(feed);
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /catalog.json — signed machine-readable catalog ──────────────────────
  if (urlPath === '/catalog.json') {
    const items = [];
    try {
      if (ctx && typeof ctx.buildSnapshot === 'function') {
        const snap = ctx.buildSnapshot();
        const all = [].concat(snap.marketplace || [], snap.services || []).filter(s => s && s.id);
        for (const s of all) {
          items.push({
            id: s.id,
            name: s.name || s.title || s.id,
            description: s.description || s.summary || null,
            price: s.price != null ? Number(s.price) : null,
            currency: s.currency || 'USD',
            unit: s.unit || 'one-time',
            url: `${OWNER.domain}/services/${encodeURIComponent(s.id)}`,
            category: s.category || s.vertical || null,
          });
        }
      }
    } catch (_) {}
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'ZeusAI Unicorn Services',
      provider: { '@type': 'Organization', name: OWNER.name, url: OWNER.domain, email: OWNER.email },
      url: OWNER.domain,
      generated_at: new Date().toISOString(),
      count: items.length,
      items,
    };
    payload.signature = signPayload({ count: payload.count, generated_at: payload.generated_at, items });
    const body = JSON.stringify(payload);
    const etag = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 22) + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' });
      res.end(); recordMetric(urlPath, 304, 0); return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600', 'X-Unicorn-Sovereign': '1' });
    res.end(body);
    recordMetric(urlPath, 200, body.length);
    return true;
  }

  // ── /structured-data.json — JSON-LD Organization + Website ──────────────
  if (urlPath === '/structured-data.json') {
    return (sendJson(res, 200, [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${OWNER.domain}#org`,
        name: 'ZeusAI',
        legalName: OWNER.name,
        url: OWNER.domain,
        logo: `${OWNER.domain}/assets/zeus/brand.jpg`,
        email: OWNER.email,
        sameAs: [],
        founder: { '@type': 'Person', name: OWNER.name },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${OWNER.domain}#website`,
        url: OWNER.domain,
        name: 'ZeusAI',
        publisher: { '@id': `${OWNER.domain}#org` },
        potentialAction: { '@type': 'SearchAction', target: `${OWNER.domain}/services?q={query}`, 'query-input': 'required name=query' },
        inLanguage: SUPPORTED_LANGS,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'OfferCatalog',
        name: 'ZeusAI Unicorn Services',
        url: `${OWNER.domain}/catalog.json`,
      },
    ]), true);
  }

  // ── /status — public uptime/health (no internals leaked) ─────────────────
  if (urlPath === '/status') {
    const uptimeSec = (Date.now() - METRICS.startedAt) / 1000;
    const health = {
      status: 'operational',
      uptime_seconds: Number(uptimeSec.toFixed(2)),
      requests_total: METRICS.requests.total,
      green: { gco2e_total: Number(METRICS.gco2.toFixed(6)), verdict: METRICS.gco2 < 1 ? 'A+' : METRICS.gco2 < 10 ? 'A' : 'B' },
      pay_rails_live: PAY_RAILS.filter(r => r.live).map(r => r.id),
      features: { agent_commerce: true, verifiable_receipts: true, mcp: true, ai_plugin: true, llms_txt: true, json_feed: true, did_web: true },
      updated_at: new Date().toISOString(),
    };
    return (sendJson(res, 200, health), true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // AGENT COMMERCE PROTOCOL — quote → order → signed receipt
  // ══════════════════════════════════════════════════════════════════════
  const QUOTES = (global.__AGENT_QUOTES__ = global.__AGENT_QUOTES__ || new Map());

  // ── /api/agent/catalog — machine buyer view ──────────────────────────────
  if (urlPath === '/api/agent/catalog') {
    const items = [];
    try {
      if (ctx && typeof ctx.buildSnapshot === 'function') {
        const snap = ctx.buildSnapshot();
        const all = [].concat(snap.marketplace || [], snap.services || []).filter(s => s && s.id);
        for (const s of all) {
          items.push({
            serviceId: s.id,
            name: s.name || s.title || s.id,
            price: s.price != null ? Number(s.price) : null,
            currency: s.currency || 'USD',
            unit: s.unit || 'one-time',
            category: s.category || s.vertical || null,
            quote: `POST ${OWNER.domain}/api/agent/quote`,
            order: `POST ${OWNER.domain}/api/agent/order`,
          });
        }
      }
    } catch (_) {}
    return (sendJson(res, 200, {
      protocol: 'agent-commerce/1.0',
      provider: { did: `did:web:${OWNER.domain.replace(/^https?:\/\//, '')}`, name: OWNER.name },
      count: items.length,
      items,
      flow: ['POST /api/agent/quote {serviceId, qty?, currency?}', 'POST /api/agent/order {quoteId, buyer?}', 'GET  /api/receipt/{id}'],
    }), true);
  }

  // ── /api/agent/quote — signed price quote (TTL 10 min) ───────────────────
  if (urlPath === '/api/agent/quote' && req.method === 'POST') {
    const body = await readBody(req);
    const serviceId = String(body.serviceId || body.id || '').trim();
    if (!serviceId) return (sendJson(res, 400, { error: 'serviceId_required' }), true);
    const qty = Math.max(1, Number(body.qty || 1));
    const currency = String(body.currency || 'USD').toUpperCase();
    // Locate service in current snapshot
    let svc = null;
    try {
      if (ctx && typeof ctx.buildSnapshot === 'function') {
        const snap = ctx.buildSnapshot();
        const all = [].concat(snap.marketplace || [], snap.services || []).filter(s => s && s.id);
        svc = all.find(s => String(s.id) === serviceId) || null;
      }
    } catch (_) {}
    if (!svc) return (sendJson(res, 404, { error: 'service_not_found', serviceId }), true);
    const unit = svc.price != null ? Number(svc.price) : 0;
    const subtotal = Number((unit * qty).toFixed(2));
    const rail = selectRail(subtotal, currency);
    const quoteId = 'q-' + crypto.randomBytes(8).toString('hex');
    const quote = {
      quoteId,
      serviceId,
      serviceName: svc.name || svc.title || serviceId,
      qty,
      unit_price: unit,
      subtotal,
      currency,
      recommended_rail: rail.recommended ? rail.recommended.id : null,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      provider: { did: `did:web:${OWNER.domain.replace(/^https?:\/\//, '')}`, name: OWNER.name },
      issued_at: new Date().toISOString(),
    };
    quote.signature = signPayload(quote);
    QUOTES.set(quoteId, { quote, expiresAt: Date.now() + 10 * 60 * 1000 });
    // Cleanup expired
    if (QUOTES.size > 5000) { for (const [k, v] of QUOTES) { if (v.expiresAt < Date.now()) QUOTES.delete(k); } }
    return (sendJson(res, 200, quote), true);
  }

  // ── /api/agent/order — accept quote, mint VC receipt ─────────────────────
  if (urlPath === '/api/agent/order' && req.method === 'POST') {
    const body = await readBody(req);
    const quoteId = String(body.quoteId || '').trim();
    const rec = QUOTES.get(quoteId);
    if (!rec) return (sendJson(res, 404, { error: 'quote_not_found_or_expired', quoteId }), true);
    if (rec.expiresAt < Date.now()) { QUOTES.delete(quoteId); return (sendJson(res, 410, { error: 'quote_expired', quoteId }), true); }
    const buyer = body.buyer || { type: 'anonymous-agent' };
    // Create a REAL checkout order (BTC on-chain, non-custodial) if commerce layer is available
    let realCheckout = null;
    try {
      const commerce = require('./sovereign-commerce');
      if (commerce && typeof commerce.createOrder === 'function') {
        const r = await commerce.createOrder(ctx, {
          serviceId: rec.quote.serviceId,
          qty: rec.quote.qty,
          currency: rec.quote.currency,
          email: (buyer && buyer.email) || '',
        });
        if (r && r.order) realCheckout = r.order;
      }
    } catch (_) {}
    const order = {
      orderId: realCheckout ? realCheckout.orderId : ('o-' + crypto.randomBytes(8).toString('hex')),
      quote: rec.quote,
      buyer,
      status: realCheckout ? realCheckout.status : 'awaiting_payment',
      payment_instructions: selectRail(rec.quote.subtotal, rec.quote.currency),
      checkout_url:  realCheckout ? realCheckout.checkout_url  : null,
      status_url:    realCheckout ? realCheckout.status_url    : null,
      btc_address:   realCheckout ? realCheckout.receive_address : null,
      btc_amount:    realCheckout ? realCheckout.amount_btc    : null,
      btc_bip21:     realCheckout ? realCheckout.bip21         : null,
      access_token:  realCheckout ? realCheckout.access_token  : null,
      expires_at:    realCheckout ? realCheckout.expires_at    : null,
    };
    const { id: receiptId, vc } = mintReceipt({ order });
    order.receipt = { id: receiptId, url: `${OWNER.domain}/api/receipt/${receiptId}` };
    archivePush({ kind: 'agent_order', order });
    res.setHeader('Location', order.checkout_url || `/api/receipt/${receiptId}`);
    return (sendJson(res, 201, { order, vc }), true);
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
      llms_txt: '/llms.txt',
      ai_plugin: '/.well-known/ai-plugin.json',
      mcp: '/.well-known/mcp.json',
      openapi: '/openapi.json',
      catalog_signed: '/catalog.json',
      feed: '/feed.json',
      did: '/.well-known/did.json',
      structured_data: '/structured-data.json',
      agent_commerce: { catalog: '/api/agent/catalog', quote: '/api/agent/quote', order: '/api/agent/order' },
      commerce: {
        checkout_create: '/api/checkout/create',
        checkout_page:   '/checkout/:orderId',
        order_status:    '/api/order/:orderId/status',
        entitlement:     '/api/entitlements/:token',
        price:           '/api/commerce/price',
        health:          '/api/commerce/health',
        settlement:      'on-chain direct to owner wallet (non-custodial)',
      },
      status_page: '/status',
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
