// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/index.js
//
// World-standard marketing layer that wraps and amplifies the existing
// `autoViralGrowth` module without modifying it. Strictly additive:
// every endpoint is new under /api/marketing/* and /go/* (short links).
//
// Sub-engines:
//   - content-multichannel   → platform-tailored content variants
//   - bandit-optimizer       → Thompson-Sampling A/B/n
//   - seo-engine             → keywords + meta + JSON-LD
//   - attribution            → multi-touch + LTV/CAC + viral k-factor
//   - affiliate-revenue      → affiliate program → BTC payouts to OWNER
//   - outreach-sentiment     → outreach drafts, sentiment, experiments
//
// Wiring:
//   const mkt = require('./modules/marketing-innovations');
//   app.use(mkt.middleware());                      // Express
//   // OR (raw http server, like improvements-pack):
//   if (await mkt.handle(req, res)) return;
//
// Disable globally with MARKETING_PACK_DISABLED=1.
// Token-gate write endpoints with AUDIT_50Y_TOKEN (or OWNER_DASHBOARD_TOKEN).
// =====================================================================

'use strict';

const content = require('./content-multichannel');
const bandit  = require('./bandit-optimizer');
const seo     = require('./seo-engine');
const attrib  = require('./attribution');
const affil   = require('./affiliate-revenue');
const outreach = require('./outreach-sentiment');

const DISABLED = process.env.MARKETING_PACK_DISABLED === '1';
const VERSION = '1.0.0';

function _ownerOk(req) {
  const required = process.env.AUDIT_50Y_TOKEN || process.env.OWNER_DASHBOARD_TOKEN || '';
  if (!required) return false;
  const tok = (req.headers && (req.headers['x-owner-token'] || req.headers['authorization'] || ''));
  const provided = String(tok).replace(/^Bearer\s+/i, '');
  return provided === required;
}

function _send(res, status, payload, headers) {
  if (res.headersSent) return;
  const body = (typeof payload === 'string') ? payload : JSON.stringify(payload, null, 2);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Marketing-Pack': VERSION,
  }, headers || {}));
  res.end(body);
}

function _readBody(req, max) {
  return new Promise((resolve, reject) => {
    const limit = Number(max) || 65536;
    let len = 0;
    const chunks = [];
    req.on('data', (c) => {
      len += c.length;
      if (len > limit) { reject(new Error('payload_too_large')); try { req.destroy(); } catch (_) {} return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(Buffer.concat(chunks).toString('utf8')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function _parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    const raw = await _readBody(req, 65536);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) { return {}; }
}

function _status() {
  return {
    pack: 'marketing-innovations',
    version: VERSION,
    disabled: DISABLED,
    timestamp: new Date().toISOString(),
    channels: content.listChannels(),
    bandits: bandit.overview(),
    affiliates: affil.listAffiliates().length,
    experiments: outreach.listExperiments().length,
    ownerBtcAddress: process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  };
}

/**
 * Raw-http dispatcher. Returns true if it handled the request.
 */
async function handle(req, res, _ctx) {
  if (DISABLED) return false;
  if (!req || !req.url) return false;

  let urlPath, params;
  try {
    const u = new URL(req.url, 'http://local');
    urlPath = u.pathname;
    params = u.searchParams;
  } catch (_) { return false; }

  if (!urlPath.startsWith('/api/marketing') && !urlPath.startsWith('/go/')) return false;

  try {
    // ── /go/<id>  short-link redirect ───────────────────────────────
    if (urlPath.startsWith('/go/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const id = urlPath.slice(4);
      const target = affil.resolve(id);
      if (!target) { _send(res, 404, { error: 'short_link_not_found' }); return true; }
      res.writeHead(302, { Location: target, 'X-Marketing-Pack': VERSION, 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }

    // ── /api/marketing/status ───────────────────────────────────────
    if (urlPath === '/api/marketing/status' && req.method === 'GET') {
      _send(res, 200, _status());
      return true;
    }

    // ── /api/marketing/channels ─────────────────────────────────────
    if (urlPath === '/api/marketing/channels' && req.method === 'GET') {
      _send(res, 200, { channels: content.listChannels() });
      return true;
    }

    // ── /api/marketing/content/variants ─────────────────────────────
    if (urlPath === '/api/marketing/content/variants' && req.method === 'GET') {
      const topic = params.get('topic') || 'Unicorn Automation';
      const channels = (params.get('channels') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const perChannel = Number(params.get('perChannel')) || 1;
      const seed = params.get('seed') || undefined;
      _send(res, 200, content.generateMultiChannel({ topic, channels, perChannel, seed }));
      return true;
    }
    if (urlPath === '/api/marketing/content/variants' && req.method === 'POST') {
      const body = await _parseBody(req);
      _send(res, 200, content.generateMultiChannel(body));
      return true;
    }

    // ── /api/marketing/bandit/* ─────────────────────────────────────
    if (urlPath === '/api/marketing/bandit/best' && req.method === 'GET') {
      const campaign = params.get('campaign') || 'default';
      const best = bandit.pickBest(campaign);
      _send(res, 200, { campaign, best });
      return true;
    }
    if (urlPath === '/api/marketing/bandit/summary' && req.method === 'GET') {
      const campaign = params.get('campaign');
      _send(res, 200, campaign ? bandit.summary(campaign) : bandit.overview());
      return true;
    }
    if (urlPath === '/api/marketing/bandit/track' && req.method === 'POST') {
      const b = await _parseBody(req);
      const campaign = b.campaign || 'default';
      const armId = b.armId;
      if (!armId) { _send(res, 400, { error: 'armId_required' }); return true; }
      const evt = String(b.event || '').toLowerCase();
      let r;
      if (evt === 'impression') r = bandit.impression(campaign, armId, b.n);
      else if (evt === 'click') r = bandit.click(campaign, armId);
      else if (evt === 'no_click') r = bandit.noClick(campaign, armId, b.n);
      else if (evt === 'conversion') r = bandit.conversion(campaign, armId, { revenueUsd: b.revenueUsd });
      else { _send(res, 400, { error: 'unknown_event' }); return true; }
      _send(res, 200, { ok: true, arm: r });
      return true;
    }

    // ── /api/marketing/seo/* ────────────────────────────────────────
    if (urlPath === '/api/marketing/seo/keywords' && req.method === 'GET') {
      _send(res, 200, seo.expandKeywords(params.get('seed'), { max: Number(params.get('max')) || 30 }));
      return true;
    }
    if (urlPath === '/api/marketing/seo/meta' && req.method === 'GET') {
      _send(res, 200, seo.buildMetaTags({
        title: params.get('title'), description: params.get('description'),
        url: params.get('url'), image: params.get('image'),
        siteName: params.get('siteName'), twitter: params.get('twitter'), lang: params.get('lang'),
      }));
      return true;
    }
    if (urlPath === '/api/marketing/seo/jsonld' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, seo.buildJsonLd(b.type || 'Organization', b.data || {}));
      return true;
    }
    if (urlPath === '/api/marketing/seo/page-bundle' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, seo.buildPageBundle(b));
      return true;
    }

    // ── /api/marketing/attribution/* ────────────────────────────────
    if (urlPath === '/api/marketing/attribution/touch' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, attrib.recordTouch(b));
      return true;
    }
    if (urlPath === '/api/marketing/attribution/conversion' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, attrib.recordConversion(b));
      return true;
    }
    if (urlPath === '/api/marketing/attribution/summary' && req.method === 'GET') {
      _send(res, 200, attrib.summary({
        model: params.get('model'),
        sinceMs: Number(params.get('sinceMs')) || 0,
        halfLifeMs: Number(params.get('halfLifeMs')) || undefined,
      }));
      return true;
    }
    if (urlPath === '/api/marketing/ltv-cac' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, attrib.ltvCac(b));
      return true;
    }
    if (urlPath === '/api/marketing/viral/k-factor' && req.method === 'GET') {
      _send(res, 200, attrib.kFactor({
        users: params.get('users'),
        invitesSent: params.get('invitesSent'),
        invitesAccepted: params.get('invitesAccepted'),
        cycleDays: params.get('cycleDays'),
      }));
      return true;
    }

    // ── /api/marketing/affiliate/* ──────────────────────────────────
    if (urlPath === '/api/marketing/affiliate/create' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, affil.createAffiliate(b));
      return true;
    }
    if (urlPath === '/api/marketing/affiliate/list' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, { affiliates: affil.listAffiliates() });
      return true;
    }
    if (urlPath === '/api/marketing/affiliate/link' && req.method === 'POST') {
      const b = await _parseBody(req);
      const link = affil.buildLink(b);
      if (!link.ok) { _send(res, 400, link); return true; }
      const sh = affil.shorten(link.url);
      _send(res, 200, { ...link, ...(sh.ok ? sh : {}) });
      return true;
    }
    if (urlPath === '/api/marketing/affiliate/track' && req.method === 'POST') {
      const b = await _parseBody(req);
      if (b.event === 'click') _send(res, 200, affil.trackClick(b.code, { ip: b.ip, ua: b.ua }));
      else if (b.event === 'conversion') _send(res, 200, affil.trackConversion(b));
      else _send(res, 400, { error: 'unknown_event' });
      return true;
    }
    if (urlPath === '/api/marketing/affiliate/ledger' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, affil.ledgerSummary({ sinceMs: Number(params.get('sinceMs')) || 0 }));
      return true;
    }
    if (urlPath === '/api/marketing/owner/payout' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, affil.ownerPayout({ sinceMs: Number(params.get('sinceMs')) || 0 }));
      return true;
    }

    // ── /api/marketing/outreach/* ───────────────────────────────────
    if (urlPath === '/api/marketing/outreach/email' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, outreach.draftEmail(b));
      return true;
    }
    if (urlPath === '/api/marketing/outreach/dm' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, outreach.draftDM(b));
      return true;
    }
    if (urlPath === '/api/marketing/outreach/press-release' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, outreach.draftPressRelease(b));
      return true;
    }

    // ── /api/marketing/sentiment ────────────────────────────────────
    if (urlPath === '/api/marketing/sentiment' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, outreach.score(b.text));
      return true;
    }

    // ── /api/marketing/experiments/* ────────────────────────────────
    if (urlPath === '/api/marketing/experiments' && req.method === 'GET') {
      _send(res, 200, { experiments: outreach.listExperiments() });
      return true;
    }
    if (urlPath === '/api/marketing/experiments/register' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, outreach.register(b));
      return true;
    }
    if (urlPath === '/api/marketing/experiments/observe' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, outreach.recordObservation(b.id, b));
      return true;
    }
    if (urlPath === '/api/marketing/experiments/close' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, outreach.closeExperiment(b.id, b.status));
      return true;
    }
  } catch (e) {
    _send(res, 500, { error: 'marketing_pack_failure', message: e && e.message });
    return true;
  }

  return false;
}

/**
 * Express middleware factory. Equivalent to:
 *   app.use(async (req, res, next) => { if (!(await handle(req,res))) next(); });
 */
function middleware() {
  return async function marketingPackMw(req, res, next) {
    try {
      if (await handle(req, res)) return;
    } catch (e) {
      try { console.warn('[marketing-pack] handler error:', e && e.message); } catch (_) {}
    }
    return next();
  };
}

/** Mesh-orchestrator-friendly status function. */
function getStatus() { return _status(); }

module.exports = {
  handle,
  middleware,
  getStatus,
  // Sub-engines (also exported for tests / direct use)
  content,
  bandit,
  seo,
  attribution: attrib,
  affiliate: affil,
  outreach,
  DISABLED,
  VERSION,
};
