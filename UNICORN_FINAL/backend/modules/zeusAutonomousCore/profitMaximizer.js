// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:05:59.244Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * ProfitMaximizer — hourly loop.
 * Computes per-module revenue (best-effort from /api/profit-attribution and
 * /api/payments), tags non-earning modules for review, and emits price-tuning
 * suggestions for priceNegotiator. Pure read + suggest — never mutates pricing
 * unless ZAC_AUTO_APPLY=1.
 */
const http = require('http');

function fetchJSON(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function createProfitMaximizer({
  backendBase = process.env.ZAC_BACKEND_BASE || 'http://127.0.0.1:3000',
  intervalMs = 60 * 60 * 1000,
  autoApply = process.env.ZAC_AUTO_APPLY === '1',
} = {}) {
  let timer = null;
  let lastReport = null;
  const history = [];

  async function tick() {
    const ts = new Date().toISOString();
    const profit = await fetchJSON(backendBase + '/api/profit-attribution') || {};
    const catalog = await fetchJSON(backendBase + '/api/catalog/master') || {};
    const payments = await fetchJSON(backendBase + '/api/payments/list') || {};

    const items = (catalog && catalog.items) || (catalog && catalog.products) || [];
    const idleModules = [];
    const suggestions = [];
    for (const it of Array.isArray(items) ? items : []) {
      const rev = (it && (it.revenue || it.totalRevenue || 0)) || 0;
      if (!rev) idleModules.push(it.id || it.slug || it.name);
      if (typeof it.price === 'number' && it.price < 1000 && (it.demand || 0) > 50) {
        suggestions.push({ target: it.id || it.name, action: 'increase-price', factor: 1.1 });
      }
    }

    lastReport = {
      ts,
      autoApply,
      catalogItems: items.length,
      payments: (payments && payments.total) || (payments && payments.count) || 0,
      idleModules: idleModules.slice(0, 25),
      idleCount: idleModules.length,
      suggestions: suggestions.slice(0, 25),
      profitSummary: profit && profit.summary ? profit.summary : profit,
    };
    history.push({ ts, idle: idleModules.length, suggestions: suggestions.length });
    if (history.length > 24) history.shift();
    return lastReport;
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { tick().catch(() => {}); }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    tick().catch(() => {});
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function getStatus() {
    return { running: !!timer, intervalMs, autoApply, lastReport, history: history.slice(-12) };
  }

  return { start, stop, tick, getStatus };
}

module.exports = { createProfitMaximizer };
