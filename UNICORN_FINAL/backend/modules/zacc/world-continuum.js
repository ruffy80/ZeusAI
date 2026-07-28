'use strict';

/**
 * world-continuum.js — World Dropship Continuum OS (WDOS/1.0)
 * ==========================================================
 * Permanent worldwide product-feed heartbeat. Sites still lack a public,
 * always-on continuum that keeps a dropship shelf stocked from global
 * free+keyed sources without waiting for a 6h scrape throttle.
 *
 * Hard safety:
 *   - Observe/publish only — never invent payment rails or CJ keys
 *   - World-feed SKUs stay desk-fulfill (honesty doctrine unchanged)
 *   - Fail-soft; never throws into the ZACC loop
 */

const worldFeeds = require('./world-feeds');

const PROTOCOL = 'WDOS/1.0';
const NAME = 'world-dropship-continuum';
const HORIZON_YEAR = 2066;

/** Default: feed every 12 minutes so /dropship never starves. */
const CONTINUUM_MS = Math.max(
  60_000,
  Number(process.env.ZACC_WORLD_CONTINUUM_MS || 12 * 60 * 1000) || 12 * 60 * 1000
);

const REGIONS = Object.freeze([
  { id: 'americas', label: 'Americas', weight: 1 },
  { id: 'emea', label: 'EMEA', weight: 1 },
  { id: 'apac', label: 'APAC', weight: 1 },
  { id: 'global', label: 'Global CDN', weight: 1.2 },
]);

function continuumMeta() {
  return {
    protocol: PROTOCOL,
    invention: NAME,
    horizonYear: HORIZON_YEAR,
    intervalMs: CONTINUUM_MS,
    intervalMin: Math.round(CONTINUUM_MS / 60000),
    regions: REGIONS,
    pledge: [
      'World continuum pulls forever while ZACC is enabled',
      'Additive catalog only — forward-only shelf evolution',
      'Honesty: world-feed SKUs remain desk-fulfill until a real supplier rail is armed',
      'Accessible worldwide via /dropship + public APIs',
    ],
    discovery: {
      page: '/dropship',
      status: '/api/dropship/status',
      continuum: '/api/dropship/world-continuum',
      products: '/api/dropship/products',
      wellKnown: '/.well-known/world-dropship.json',
    },
  };
}

/**
 * Inject world-feed products into the scraper cache without waiting for the
 * 6h marketplace scrape throttle, then rank + publish into the live shelf.
 */
async function pulse(zacc, trigger) {
  const t0 = Date.now();
  const meta = continuumMeta();
  if (!zacc || !zacc.scraper || !zacc.profit || !zacc.publisher) {
    return { ok: false, error: 'zacc_unavailable', ...meta };
  }
  let pulled = [];
  try {
    pulled = await worldFeeds.pullWorldFeeds();
  } catch (e) {
    return { ok: false, error: e.message, durationMs: Date.now() - t0, ...meta };
  }

  // Merge into scraper cache (newest first), dedupe by name.
  const seen = new Set(
    (zacc.scraper.products || []).map((p) => String(p.name || p.title || '').toLowerCase())
  );
  const { now, slug, shortId } = require('./util');
  const { coverPath } = require('./product-cover');
  const enriched = [];
  for (const p of pulled) {
    if (!p || !p.name || !(p.costUsd > 0)) continue;
    const key = String(p.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const s = slug((p.source || 'world') + '-' + p.name);
    enriched.push(Object.assign({}, p, {
      id: 'scrape-' + s + '-' + shortId('').slice(-6),
      image: String(p.image || '').trim() || coverPath(s),
      scrapedAt: now(),
      continuum: true,
      region: p.originCountry === 'GLOBAL' ? 'global' : 'global',
    }));
  }
  if (enriched.length) {
    zacc.scraper.products = enriched.concat(zacc.scraper.products || []).slice(0, zacc.scraper.maxProducts || 800);
    zacc.scraper.lastScrapeAt = Date.now();
    zacc.scraper.scrapes = (zacc.scraper.scrapes || 0) + 1;
  }

  let qualified = [];
  let published = [];
  try {
    qualified = zacc.profit.rank(zacc.scraper.recent(400));
    published = zacc.publisher.publish(qualified, Math.max(16, Number(process.env.ZACC_CONTINUUM_PUBLISH || 24)));
    if (typeof zacc.publisher.purgeJunk === 'function') zacc.publisher.purgeJunk();
  } catch (_) { /* fail-soft */ }

  let shelf = null;
  try {
    if (zacc.shelf && typeof zacc.shelf.runTournament === 'function') {
      shelf = zacc.shelf.runTournament(zacc.publisher);
    }
  } catch (_) { /* fail-soft */ }

  try { if (typeof zacc._persist === 'function') zacc._persist(); } catch (_) { /* fail-soft */ }

  const result = {
    ok: true,
    protocol: PROTOCOL,
    invention: NAME,
    trigger: trigger || 'interval',
    pulled: pulled.length,
    injected: enriched.length,
    qualified: qualified.length,
    published: Array.isArray(published) ? published.length : 0,
    listed: (zacc.publisher.published || []).length,
    shelfHash: shelf && shelf.ledgerHash ? shelf.ledgerHash : null,
    durationMs: Date.now() - t0,
    at: new Date().toISOString(),
    nextDueMs: CONTINUUM_MS,
    regions: REGIONS,
    horizonYear: HORIZON_YEAR,
  };
  zacc._worldContinuum = result;
  return result;
}

function status(zacc) {
  const last = (zacc && zacc._worldContinuum) || null;
  return {
    ok: true,
    ...continuumMeta(),
    last,
    listed: zacc && zacc.publisher ? (zacc.publisher.published || []).length : 0,
    scraperCached: zacc && zacc.scraper ? (zacc.scraper.products || []).length : 0,
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  HORIZON_YEAR,
  CONTINUUM_MS,
  REGIONS,
  continuumMeta,
  pulse,
  status,
};
