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
const viral   = require('./viral-amplifier');
const innovationLoop = require('./self-innovation-loop');

// ── v1.2 additive sub-engines ─────────────────────────────────────────
const outbound = require('./outbound-publisher');
const aiCopy   = require('./ai-copywriter');
const mediaForge = require('./media-forge');
const scheduler = require('./scheduler');
const engagement = require('./engagement-bot');
const experiments = require('./growth-experiments');
const viralMonitor = require('./viral-coefficient-monitor');
const waitlist = require('./waitlist-mechanic');
const pseo = require('./programmatic-seo');
const influencer = require('./influencer-crm');
const abuseShield = require('./abuse-shield');
const i18n = require('./i18n-amplifier');
const metricsEngine = require('./metrics');
const dashboard = require('./dashboard');
const viralFeed = require('./viral-feed-sse');
const adminToggle = require('./admin-toggle');

const DISABLED = process.env.MARKETING_PACK_DISABLED === '1';
const VERSION = '1.2.0';

function _ownerOk(req) {
  const required = process.env.AUDIT_50Y_TOKEN || process.env.OWNER_DASHBOARD_TOKEN || '';
  if (!required) return false;
  const tok = (req.headers && (req.headers['x-owner-token'] || req.headers['authorization'] || ''));
  const provided = String(tok).replace(/^Bearer\s+/i, '');
  return provided === required;
}

// Safe JSON serializer: escapes HTML-significant characters so that a
// response body can never be reinterpreted as HTML even if a downstream
// proxy strips Content-Type. The output is still valid JSON.
const _ESCAPE_MAP = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\'': '\\u0027',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};
function _safeJsonStringify(payload) {
  return JSON.stringify(payload, null, 2)
    .replace(/[<>&'\u2028\u2029]/g, (ch) => _ESCAPE_MAP[ch]);
}

function _send(res, status, payload, headers) {
  if (res.headersSent) return;
  // Always serialize through the safe JSON path so that any user-controlled
  // input that flows into `payload` is unicode-escaped and can never be
  // interpreted as HTML even if Content-Type is stripped by a proxy.
  const body = _safeJsonStringify(payload);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
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
    // ── Additive fields (v1.1) ─────────────────────────────────────
    viralBoostFactor: viral.boostFactor(),
    viralLoops: viral.listLoops().length,
    innovation: innovationLoop.getStatus(),
    // ── Additive fields (v1.2) ─────────────────────────────────────
    outbound: outbound.status(),
    aiCopy: aiCopy.status(),
    mediaForge: mediaForge.status(),
    scheduler: scheduler.status(),
    engagement: engagement.status(),
    growthExperiments: experiments.status(),
    viralMonitor: viralMonitor.status(),
    waitlist: waitlist.summary(),
    pseo: pseo.status(),
    influencer: influencer.status(),
    abuseShield: abuseShield.status(),
    i18n: i18n.status(),
    metrics: metricsEngine.status(),
    dashboard: dashboard.status(),
    viralFeed: viralFeed.status(),
    adminToggle: adminToggle.status(),
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

  if (!urlPath.startsWith('/api/marketing') && !urlPath.startsWith('/go/') && !urlPath.startsWith('/internal/marketing')) return false;

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

    // ── /api/marketing/viral/* — viral amplifier ────────────────────
    if (urlPath === '/api/marketing/viral/status' && req.method === 'GET') {
      _send(res, 200, viral.getStatus());
      return true;
    }
    if (urlPath === '/api/marketing/viral/boost' && req.method === 'GET') {
      _send(res, 200, viral.boostFactor());
      return true;
    }
    if (urlPath === '/api/marketing/viral/amplify' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, viral.launchAmplify(b));
      return true;
    }
    if (urlPath === '/api/marketing/viral/share-assets' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, viral.buildShareAssets(b));
      return true;
    }
    if (urlPath === '/api/marketing/viral/social-proof' && req.method === 'GET') {
      _send(res, 200, viral.socialProof({
        users: params.get('users'),
        referralSignups: params.get('referralSignups'),
        partnerMentions: params.get('partnerMentions'),
        estimatedReach: params.get('estimatedReach'),
        satsPaid: params.get('satsPaid'),
        kFactor: params.get('kFactor'),
      }));
      return true;
    }
    if (urlPath === '/api/marketing/viral/loops' && req.method === 'GET') {
      _send(res, 200, { loops: viral.listLoops() });
      return true;
    }
    if (urlPath === '/api/marketing/viral/loops/register' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, viral.registerLoop(b));
      return true;
    }
    if (urlPath === '/api/marketing/viral/loops/observe' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, viral.recordLoopOutcome(b));
      return true;
    }
    if (urlPath === '/api/marketing/viral/recent' && req.method === 'GET') {
      _send(res, 200, { recent: viral.recentAmplifications(Number(params.get('limit')) || 20) });
      return true;
    }

    // ── /api/marketing/innovation/* — self-innovation loop ──────────
    if (urlPath === '/api/marketing/innovation/status' && req.method === 'GET') {
      _send(res, 200, innovationLoop.getStatus());
      return true;
    }
    if (urlPath === '/api/marketing/innovation/strategies' && req.method === 'GET') {
      _send(res, 200, {
        strategies: innovationLoop.listStrategies({
          status: params.get('status'),
          limit: Number(params.get('limit')) || 100,
        }),
      });
      return true;
    }
    if (urlPath === '/api/marketing/innovation/observe' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, innovationLoop.observe(b.id, b));
      return true;
    }
    if (urlPath === '/api/marketing/innovation/tick' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, innovationLoop.tick(b));
      return true;
    }
    if (urlPath === '/api/marketing/innovation/strategies/add' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, innovationLoop.addStrategy(b));
      return true;
    }

    // ── v1.2 ── /api/marketing/outbound/* — outbound publisher ─────
    if (urlPath === '/api/marketing/outbound/status' && req.method === 'GET') {
      _send(res, 200, outbound.status()); return true;
    }
    if (urlPath === '/api/marketing/outbound/publish' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, await outbound.publish(b)); return true;
    }
    if (urlPath === '/api/marketing/outbound/broadcast' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, await outbound.broadcast(b)); return true;
    }
    if (urlPath === '/api/marketing/outbound/recent' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, { recent: outbound.recent(Number(params.get('limit')) || 50) }); return true;
    }

    // ── v1.2 ── /api/marketing/copy/generate — AI copywriter ───────
    if (urlPath === '/api/marketing/copy/generate' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, await aiCopy.generate(b)); return true;
    }
    if (urlPath === '/api/marketing/copy/status' && req.method === 'GET') {
      _send(res, 200, aiCopy.status()); return true;
    }

    // ── v1.2 ── /api/marketing/og/* — media forge ──────────────────
    if (urlPath === '/api/marketing/og/build' && req.method === 'POST') {
      const b = await _parseBody(req);
      const r = mediaForge.buildAndCache(b);
      if (!r.ok) { _send(res, 400, r); return true; }
      _send(res, 200, { ok: true, hash: r.hash, file: r.file, bytes: r.bytes });
      return true;
    }
    if (urlPath === '/api/marketing/og/svg' && req.method === 'GET') {
      const hash = params.get('hash') || '';
      const svg = mediaForge.loadCached(hash);
      if (!svg) { _send(res, 404, { error: 'not_found' }); return true; }
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
          'X-Marketing-Pack': VERSION,
        });
        res.end(svg);
      }
      return true;
    }

    // ── v1.2 ── /api/marketing/scheduler/* ─────────────────────────
    if (urlPath === '/api/marketing/scheduler/schedule' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, scheduler.schedule(b)); return true;
    }
    if (urlPath === '/api/marketing/scheduler/drip' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, scheduler.scheduleDrip(b)); return true;
    }
    if (urlPath === '/api/marketing/scheduler/cancel' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, scheduler.cancel(b.id)); return true;
    }
    if (urlPath === '/api/marketing/scheduler/pending' && req.method === 'GET') {
      _send(res, 200, { pending: scheduler.listPending() }); return true;
    }
    if (urlPath === '/api/marketing/scheduler/best-time' && req.method === 'GET') {
      _send(res, 200, scheduler.bestNextSlot(params.get('channel') || 'X')); return true;
    }
    if (urlPath === '/api/marketing/scheduler/status' && req.method === 'GET') {
      _send(res, 200, scheduler.status()); return true;
    }

    // ── v1.2 ── /api/marketing/engagement/* ────────────────────────
    if (urlPath === '/api/marketing/engagement/inbound' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, engagement.processInbound(b)); return true;
    }
    if (urlPath === '/api/marketing/engagement/whitelist' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, engagement.whitelist(b.actor)); return true;
    }
    if (urlPath === '/api/marketing/engagement/blacklist' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, engagement.blacklist(b.actor)); return true;
    }
    if (urlPath === '/api/marketing/engagement/recent' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, { recent: engagement.recent(Number(params.get('limit')) || 50) }); return true;
    }

    // ── v1.2 ── /api/marketing/growth-experiments/* ────────────────
    if (urlPath === '/api/marketing/growth-experiments/create' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, experiments.create(b)); return true;
    }
    if (urlPath === '/api/marketing/growth-experiments/pick' && req.method === 'GET') {
      _send(res, 200, experiments.pickVariant(params.get('id'))); return true;
    }
    if (urlPath === '/api/marketing/growth-experiments/track' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, experiments.track(b.id, b)); return true;
    }
    if (urlPath === '/api/marketing/growth-experiments/close' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, experiments.close(b.id)); return true;
    }
    if (urlPath === '/api/marketing/growth-experiments/list' && req.method === 'GET') {
      _send(res, 200, { experiments: experiments.list() }); return true;
    }

    // ── v1.2 ── /api/marketing/viral-monitor/* ─────────────────────
    if (urlPath === '/api/marketing/viral-monitor/status' && req.method === 'GET') {
      _send(res, 200, viralMonitor.status()); return true;
    }
    if (urlPath === '/api/marketing/viral-monitor/tick' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, viralMonitor.tick()); return true;
    }

    // ── v1.2 ── /api/marketing/waitlist/* ──────────────────────────
    if (urlPath === '/api/marketing/waitlist/join' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, waitlist.join(b)); return true;
    }
    if (urlPath === '/api/marketing/waitlist/lookup' && req.method === 'GET') {
      _send(res, 200, waitlist.lookup(params.get('code'))); return true;
    }
    if (urlPath === '/api/marketing/waitlist/leaderboard' && req.method === 'GET') {
      _send(res, 200, { leaderboard: waitlist.leaderboard(Number(params.get('limit')) || 50) }); return true;
    }
    if (urlPath === '/api/marketing/waitlist/summary' && req.method === 'GET') {
      _send(res, 200, waitlist.summary()); return true;
    }

    // ── v1.2 ── /api/marketing/pseo/* ──────────────────────────────
    if (urlPath === '/api/marketing/pseo/page' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, pseo.buildPage(b)); return true;
    }
    if (urlPath === '/api/marketing/pseo/batch' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, pseo.buildBatch(b)); return true;
    }
    if (urlPath === '/api/marketing/pseo/sitemap' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, pseo.buildSitemap(b && b.items)); return true;
    }
    if (urlPath === '/api/marketing/pseo/indexnow' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, await pseo.indexNowPing(b)); return true;
    }
    if (urlPath === '/api/marketing/pseo/status' && req.method === 'GET') {
      _send(res, 200, pseo.status()); return true;
    }

    // ── v1.2 ── /api/marketing/influencer/* ────────────────────────
    if (urlPath === '/api/marketing/influencer/add' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, influencer.add(b)); return true;
    }
    if (urlPath === '/api/marketing/influencer/list' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, { records: influencer.list({ status: params.get('status'), tier: params.get('tier') }) }); return true;
    }
    if (urlPath === '/api/marketing/influencer/status-update' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, influencer.setStatus(b.id, b.status)); return true;
    }
    if (urlPath === '/api/marketing/influencer/draft-outreach' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, influencer.draftOutreach(b.id, b)); return true;
    }

    // ── v1.2 ── /api/marketing/abuse/* ─────────────────────────────
    if (urlPath === '/api/marketing/abuse/record' && req.method === 'POST') {
      const b = await _parseBody(req);
      _send(res, 200, abuseShield.record(b)); return true;
    }
    if (urlPath === '/api/marketing/abuse/risk' && req.method === 'GET') {
      _send(res, 200, abuseShield.risk({
        code: params.get('code'),
        ip: params.get('ip'),
        ua: params.get('ua'),
      }));
      return true;
    }
    if (urlPath === '/api/marketing/abuse/status' && req.method === 'GET') {
      _send(res, 200, abuseShield.status()); return true;
    }

    // ── v1.2 ── /api/marketing/i18n/* ──────────────────────────────
    if (urlPath === '/api/marketing/i18n/locales' && req.method === 'GET') {
      _send(res, 200, { locales: i18n.listLocales(), keys: i18n.dictKeys(), defaultLocale: i18n.status().defaultLocale }); return true;
    }
    if (urlPath === '/api/marketing/i18n/translate' && req.method === 'GET') {
      _send(res, 200, { key: params.get('key'), locale: params.get('locale') || i18n.pickLocale((req.headers && req.headers['accept-language']) || ''), text: i18n.t(params.get('key'), params.get('locale')) }); return true;
    }
    if (urlPath === '/api/marketing/i18n/localize' && req.method === 'POST') {
      const b = await _parseBody(req);
      const loc = b.locale || i18n.pickLocale((req.headers && req.headers['accept-language']) || '');
      _send(res, 200, { locale: loc, variant: i18n.localizeVariant(b.variant || {}, loc) }); return true;
    }

    // ── v1.2 ── /api/marketing/metrics ─────────────────────────────
    if (urlPath === '/api/marketing/metrics' && req.method === 'GET') {
      const fmt = (params.get('format') || 'json').toLowerCase();
      if (fmt === 'prom' || fmt === 'prometheus' || fmt === 'text') {
        const text = metricsEngine.toProm();
        if (!res.headersSent) {
          res.writeHead(200, {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Marketing-Pack': VERSION,
          });
          res.end(text);
        }
      } else {
        _send(res, 200, metricsEngine.snapshot());
      }
      return true;
    }

    // ── v1.2 ── /internal/marketing/dashboard ──────────────────────
    if (urlPath === '/internal/marketing/dashboard' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const html = dashboard.render();
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Marketing-Pack': VERSION,
        });
        res.end(html);
      }
      return true;
    }

    // ── v1.2 ── /api/marketing/viral/stream — SSE feed ─────────────
    if (urlPath === '/api/marketing/viral/stream' && req.method === 'GET') {
      viralFeed.attach(req, res);
      return true;
    }

    // ── v1.2 ── /api/marketing/admin/* — runtime toggles ───────────
    if (urlPath === '/api/marketing/admin/toggle' && req.method === 'POST') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      const b = await _parseBody(req);
      _send(res, 200, adminToggle.set(b.name, b.enabled)); return true;
    }
    if (urlPath === '/api/marketing/admin/flags' && req.method === 'GET') {
      if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
      _send(res, 200, { flags: adminToggle.listFlags() }); return true;
    }
  } catch (e) {
    try { console.warn('[marketing-pack] dispatcher error:', e && e.message); } catch (_) {}
    _send(res, 500, { error: 'marketing_pack_failure' });
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
  viral,
  innovationLoop,
  // ── v1.2 sub-engines ──
  outbound,
  aiCopy,
  mediaForge,
  scheduler,
  engagement,
  growthExperiments: experiments,
  viralMonitor,
  waitlist,
  pseo,
  influencer,
  abuseShield,
  i18n,
  metricsEngine,
  dashboard,
  viralFeed,
  adminToggle,
  DISABLED,
  VERSION,
};
