// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * INTEGRATIONS AGGREGATOR
 *
 * Loads the 7 complementary integration modules. Each module is loaded
 * inside its own try/catch so a failure in one never blocks the others
 * or the rest of the backend.
 *
 * Existing modules they SUBSCRIBE TO (none are modified):
 *   1. auto-doc-semantic            ← src/frontier-engine.openApiSpec()
 *   2. ab-test-engine               ← src/site/v2/shell.js (UI variants)
 *   3. predictive-healing-bridge    ← predictive-healing + self-healing-engine
 *   4. evolution-executor           ← auto-innovation-loop
 *   5. module-marketplace           ← backend/modules/* + dynamic-pricing
 *   6. negotiation-chatbot          ← dynamic-pricing
 *   7. cloud-migration-wrapper      ← aws-auto-healer / gcp-cost-optimizer / azure
 */

const MODULES = [
  './auto-doc-semantic',
  './ab-test-engine',
  './predictive-healing-bridge',
  './evolution-executor',
  './module-marketplace',
  './negotiation-chatbot',
  './cloud-migration-wrapper',
];

const _loaded = [];

function init({ app } = {}) {
  for (const rel of MODULES) {
    try {
      const mod = require(rel);
      if (mod && typeof mod.init === 'function') {
        mod.init({ app });
        _loaded.push({ name: mod.name || rel, ok: true });
        console.log('[integrations] ✅ loaded ' + (mod.name || rel));
      }
    } catch (e) {
      _loaded.push({ name: rel, ok: false, error: e && e.message });
      console.warn('[integrations] ❌ ' + rel + ': ' + (e && e.message));
    }
  }

  if (app && typeof app.get === 'function') {
    app.get('/api/integrations/status', (_req, res) => {
      const status = _loaded.map(l => {
        if (!l.ok) return l;
        try {
          const mod = require(MODULES[_loaded.indexOf(l)]);
          return { name: l.name, ok: true, status: typeof mod.getStatus === 'function' ? mod.getStatus() : null };
        } catch (e) {
          return { name: l.name, ok: false, error: e && e.message };
        }
      });
      res.json({ ok: true, count: _loaded.length, integrations: status });
    });
  }
  return _loaded;
}

function getLoaded() { return _loaded.slice(); }

module.exports = { init, getLoaded, MODULES };
