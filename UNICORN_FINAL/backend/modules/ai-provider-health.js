// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-31T11:14:37.146Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =====================================================================
// AI PROVIDER HEALTH — Zeus AI Unicorn
//
// A single, honest answer to "how many AI providers are ACTUALLY usable
// right now?". The catalogue claims 15+ providers, but a provider is only
// real if its API key is present and well-formed. This module aggregates
// the provider lists from every router and reports the truth, so dashboards
// can stop showing "15 providers" when only 2 have keys.
//
//   • Pulls the canonical catalogue from multi-model-router (PROVIDER_CATALOG).
//   • A provider is "configured" iff its env key exists, is >= 20 chars and
//     is not an obvious placeholder ("your_", "changeme", "xxxx", "...").
//   • Optional live probe: probe() can run the router's own connectivity
//     test when available; default snapshot() is key-only (fast, no network).
// =====================================================================

const PLACEHOLDER_RX = /(your[_-]?|changeme|placeholder|example|xxxx|\.\.\.|<.*>)/i;
const MIN_KEY_LENGTH = 20;

function _keyConfigured(envKey) {
  const k = process.env[envKey];
  if (!k) return false;
  const v = String(k).trim();
  if (v.length < MIN_KEY_LENGTH) return false;
  if (PLACEHOLDER_RX.test(v)) return false;
  return true;
}

function _catalog() {
  try {
    const mmr = require('./multi-model-router');
    if (Array.isArray(mmr.PROVIDER_CATALOG) && mmr.PROVIDER_CATALOG.length) {
      return mmr.PROVIDER_CATALOG.map(p => ({
        name: p.name,
        envKey: p.envKey,
        tier: p.tier || 'standard',
      }));
    }
  } catch (e) {
    console.warn('[ai-provider-health] catalog load failed, using fallback:', e.message);
  }
  return FALLBACK_CATALOG.slice();
}

// Static fallback so the health count stays honest even when the router
// module cannot be imported (e.g. a transitive dependency is unavailable).
const FALLBACK_CATALOG = [
  { name: 'groq', envKey: 'GROQ_API_KEY', tier: 'cheap' },
  { name: 'deepseek', envKey: 'DEEPSEEK_API_KEY', tier: 'cheap' },
  { name: 'mistral', envKey: 'MISTRAL_API_KEY', tier: 'cheap' },
  { name: 'together', envKey: 'TOGETHER_API_KEY', tier: 'cheap' },
  { name: 'fireworks', envKey: 'FIREWORKS_API_KEY', tier: 'cheap' },
  { name: 'gemini', envKey: 'GEMINI_API_KEY', tier: 'balanced' },
  { name: 'cohere', envKey: 'COHERE_API_KEY', tier: 'balanced' },
  { name: 'huggingface', envKey: 'HUGGINGFACE_API_KEY', tier: 'balanced' },
  { name: 'sambanova', envKey: 'SAMBANOVA_API_KEY', tier: 'balanced' },
  { name: 'nvidia-nim', envKey: 'NVIDIA_NIM_API_KEY', tier: 'balanced' },
  { name: 'openai', envKey: 'OPENAI_API_KEY', tier: 'premium' },
  { name: 'perplexity', envKey: 'PERPLEXITY_API_KEY', tier: 'premium' },
  { name: 'openrouter', envKey: 'OPENROUTER_API_KEY', tier: 'premium' },
  { name: 'claude', envKey: 'ANTHROPIC_API_KEY', tier: 'premium' },
];

/**
 * Key-only health snapshot (no network calls). Fast and safe to call often.
 */
function snapshot() {
  const cat = _catalog();
  const providers = cat.map(p => ({
    name: p.name,
    tier: p.tier,
    envKey: p.envKey,
    configured: _keyConfigured(p.envKey),
  }));
  const configured = providers.filter(p => p.configured);
  return {
    ok: true,
    total: providers.length,
    configured: configured.length,
    missing: providers.length - configured.length,
    configuredNames: configured.map(p => p.name),
    missingKeys: providers.filter(p => !p.configured).map(p => p.envKey),
    providers,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Live probe — actually tests provider connectivity when the underlying
 * router exposes a test/connectivity method. Falls back to the key-only
 * snapshot for providers that cannot be probed. Never throws.
 * @param {object} [opts] { onlyConfigured=true }
 */
async function probe(opts = {}) {
  const onlyConfigured = opts.onlyConfigured !== false;
  const snap = snapshot();
  let uaic = null;
  try { uaic = require('./universalAIConnector'); } catch { uaic = null; }

  const results = [];
  for (const p of snap.providers) {
    if (onlyConfigured && !p.configured) {
      results.push({ name: p.name, configured: false, reachable: false, reason: 'no_key' });
      continue;
    }
    let reachable = null;
    let reason = 'not_probed';
    if (uaic && typeof uaic.testProvider === 'function') {
      try {
        const r = await uaic.testProvider(p.name);
        reachable = !!(r && r.ok);
        reason = (r && r.reason) || (reachable ? 'ok' : 'failed');
      } catch (e) {
        reachable = false;
        reason = e.message;
      }
    }
    results.push({ name: p.name, configured: p.configured, reachable, reason });
  }
  const reachableCount = results.filter(r => r.reachable === true).length;
  return {
    ok: true,
    total: snap.total,
    configured: snap.configured,
    reachable: reachableCount,
    results,
    timestamp: new Date().toISOString(),
  };
}

function getStatus() {
  const snap = snapshot();
  return {
    active: true,
    module: 'ai-provider-health',
    total: snap.total,
    configured: snap.configured,
    configuredNames: snap.configuredNames,
    timestamp: snap.timestamp,
  };
}

function router(express) {
  const r = express.Router();
  r.get('/', (req, res) => {
    const snap = snapshot();
    // Compose Eternal OS status here (not inside snapshot) to avoid require cycles.
    try {
      const eternal = require('./fulfillment-ai-os');
      const st = eternal.getStatus();
      snap.fulfillmentAi = {
        invention: st.invention,
        mode: st.mode,
        armed: st.armed,
        providersConfigured: st.providersConfigured,
        skuPolicy: st.skuPolicy,
        skuAllowlist: st.skuAllowlist,
      };
    } catch (_) { /* optional */ }
    res.json(snap);
  });
  r.get('/probe', async (req, res) => {
    try {
      res.json(await probe({ onlyConfigured: req.query.all !== '1' }));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return r;
}

module.exports = {
  snapshot,
  probe,
  getStatus,
  router,
  _keyConfigured,
};
