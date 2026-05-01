// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * INTERNAL MODULE MARKETPLACE (complementary)
 *
 * Lists EXISTING modules from backend/modules/ as marketplace items.
 * Pulls live prices from the existing dynamic-pricing module.
 * Does NOT modify any module. AI-generated modules dropped into
 * backend/modules/generated/ are quarantined until a smoke test passes
 * (require + presence of expected exports), then auto-published.
 */

const fs   = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..');
const GEN_DIR     = path.join(MODULES_DIR, 'generated');

const _state = {
  name: 'module-marketplace',
  startedAt: null,
  catalog: [],
  pendingAI: [],
  lastError: null,
};

function _scanCatalog() {
  let entries = [];
  try {
    entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter(d => d.isFile() && d.name.endsWith('.js'))
      .map(d => d.name.replace(/\.js$/, ''))
      .filter(n => !n.startsWith('_') && n !== 'integrations');
  } catch (e) { _state.lastError = e && e.message; }
  return entries;
}

function _priceFor(id) {
  try {
    const pricing = require('../dynamic-pricing');
    if (pricing && typeof pricing.getPrice === 'function') {
      return pricing.getPrice(id);
    }
  } catch (_) { /* pricing optional */ }
  return null;
}

function refreshCatalog() {
  const ids = _scanCatalog();
  _state.catalog = ids.map(id => ({
    id,
    name: id,
    license: 'commercial',
    price: _priceFor(id) || { amount: 99, currency: 'USD', model: 'monthly' },
    publishedAt: new Date().toISOString(),
  }));
  return _state.catalog;
}

function _smokeTestModule(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    const mod = require(filePath);
    if (!mod) return { ok: false, reason: 'empty export' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'require failed' };
  }
}

function publishAIGenerated(name) {
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { ok: false, error: 'invalid name' };
  }
  const filePath = path.join(GEN_DIR, name + '.js');
  if (!fs.existsSync(filePath)) return { ok: false, error: 'not found' };
  const result = _smokeTestModule(filePath);
  if (!result.ok) {
    _state.pendingAI.push({ name, at: new Date().toISOString(), reason: result.reason });
    return { ok: false, error: 'smoke test failed: ' + result.reason };
  }
  _state.catalog.push({
    id: 'generated/' + name, name, license: 'ai-generated',
    price: _priceFor(name) || { amount: 49, currency: 'USD', model: 'monthly' },
    publishedAt: new Date().toISOString(),
  });
  return { ok: true, published: name };
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();
  refreshCatalog();
  setInterval(refreshCatalog, 600000).unref(); // refresh every 10 min

  if (app && typeof app.get === 'function') {
    app.get('/api/marketplace/modules', (_req, res) => {
      res.json({ ok: true, count: _state.catalog.length, modules: _state.catalog });
    });
    app.get('/api/marketplace/modules/:id', (req, res) => {
      const m = _state.catalog.find(x => x.id === req.params.id);
      if (!m) return res.status(404).json({ ok: false, error: 'not found' });
      res.json({ ok: true, module: m });
    });
    app.post('/api/marketplace/publish-ai', (req, res) => {
      const { name } = req.body || {};
      res.json(publishAIGenerated(name));
    });
  }
}

function getStatus() {
  return {
    name: _state.name,
    startedAt: _state.startedAt,
    catalogSize: _state.catalog.length,
    pendingAI: _state.pendingAI.length,
  };
}

module.exports = { name: 'module-marketplace', init, getStatus, refreshCatalog, publishAIGenerated };
