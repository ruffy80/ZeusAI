// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * AB-TEST ENGINE (complementary)
 *
 * Runs in PARALLEL with the existing UI shell (src/site/v2/shell.js).
 * Does NOT replace any rendering logic. Stores variant impressions and
 * conversions in memory; every WINDOW_MS picks the winner and exposes
 * it at /api/ui/ab-test/winner. The shell can subscribe at any time.
 */

const WINDOW_MS = parseInt(process.env.AB_TEST_WINDOW_MS || '86400000', 10); // 24h

const _state = {
  name: 'ab-test-engine',
  variants: new Map(),  // variantId -> { id, impressions, conversions, page, since }
  winners: [],          // history of { at, page, variantId, conversionRate }
  startedAt: null,
};

function _ensure(page, variantId) {
  const key = `${page}::${variantId}`;
  if (!_state.variants.has(key)) {
    _state.variants.set(key, {
      id: variantId, page, impressions: 0, conversions: 0,
      since: new Date().toISOString(),
    });
  }
  return _state.variants.get(key);
}

function trackImpression(page, variantId) {
  const v = _ensure(page || 'home', variantId || 'A');
  v.impressions += 1;
  return v;
}

function trackConversion(page, variantId) {
  const v = _ensure(page || 'home', variantId || 'A');
  v.conversions += 1;
  return v;
}

function _pickWinners() {
  const byPage = new Map();
  for (const v of _state.variants.values()) {
    if (!byPage.has(v.page)) byPage.set(v.page, []);
    byPage.get(v.page).push(v);
  }
  const winners = [];
  for (const [page, list] of byPage.entries()) {
    let best = null; let bestRate = -1;
    for (const v of list) {
      const rate = v.impressions > 0 ? v.conversions / v.impressions : 0;
      if (rate > bestRate) { bestRate = rate; best = v; }
    }
    if (best) winners.push({
      at: new Date().toISOString(), page, variantId: best.id,
      conversionRate: Number(bestRate.toFixed(4)),
      impressions: best.impressions, conversions: best.conversions,
    });
  }
  // Reset window
  for (const v of _state.variants.values()) { v.impressions = 0; v.conversions = 0; }
  _state.winners.unshift(...winners);
  if (_state.winners.length > 200) _state.winners.length = 200;
  return winners;
}

function getCurrentWinners() {
  return _state.winners.slice(0, 20);
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();
  setInterval(_pickWinners, WINDOW_MS).unref();

  if (app && typeof app.get === 'function') {
    app.post('/api/ui/ab-test/impression', (req, res) => {
      const { page, variantId } = req.body || {};
      const v = trackImpression(page, variantId);
      res.json({ ok: true, variant: v });
    });
    app.post('/api/ui/ab-test/conversion', (req, res) => {
      const { page, variantId } = req.body || {};
      const v = trackConversion(page, variantId);
      res.json({ ok: true, variant: v });
    });
    app.get('/api/ui/ab-test/winner', (_req, res) => {
      res.json({ ok: true, winners: getCurrentWinners() });
    });
    app.get('/api/ui/ab-test/state', (_req, res) => {
      res.json({
        ok: true,
        variants: Array.from(_state.variants.values()),
        winners: getCurrentWinners(),
      });
    });
  }
}

function getStatus() {
  return {
    name: _state.name,
    startedAt: _state.startedAt,
    variantCount: _state.variants.size,
    winnerCount: _state.winners.length,
  };
}

module.exports = { name: 'ab-test-engine', init, getStatus, trackImpression, trackConversion, getCurrentWinners, _pickWinners };
