// ADI-Core Main Entry — REAL self-discovering AI integration core
// Discovers → Evaluates → Integrates (persisted) → Routes → Self-improves
// Plus: runtime key intake (addKey), onboarding hints, hot re-run on key arrival.

const discovery   = require('./discovery');
const evaluator   = require('./evaluator');
const registry    = require('./registry');
const adapterGen  = require('./adapter-gen');
const router      = require('./router');
const selfImprove = require('./self-improve');
const vault       = require('./key-vault');
const catalog     = require('./provider-catalog');

const adiState = {
  startedAt: Date.now(),
  lastRunAt: 0,
  lastRunMs: 0,
  runs: 0,
  errors: 0,
  discovered: [],
  evaluated: [],
  integrated: [],
  routes: {},
  awaitingKey: [],
  lastImprovement: null,
};

let _running = false;

async function runADI() {
  if (_running) return { ok: false, reason: 'already-running' };
  _running = true;
  const t0 = Date.now();
  try {
    adiState.discovered  = await discovery.discover();
    adiState.evaluated   = await evaluator.evaluate(adiState.discovered);
    adiState.integrated  = await registry.integrate(adiState.evaluated);
    adiState.routes      = await router.updateRoutes(adiState.integrated);
    adiState.awaitingKey = adiState.discovered
      .filter(m => m.type === 'awaiting-key')
      .map(m => ({ id: m.id, aliases: m.envAliases || [], signupUrl: m.signupUrl || null, tags: (m.meta && m.meta.tags) || [] }));
    adiState.lastImprovement = await selfImprove.improve();
    adiState.runs++;
    adiState.lastRunAt = Date.now();
    adiState.lastRunMs = adiState.lastRunAt - t0;
    return {
      ok: true,
      durationMs: adiState.lastRunMs,
      integrated: adiState.integrated.length,
      tags: Object.keys(adiState.routes).length,
      awaitingKey: adiState.awaitingKey.length,
    };
  } catch (e) {
    adiState.errors++;
    return { ok: false, error: String(e && e.message || e) };
  } finally {
    _running = false;
  }
}

function getStatus() {
  return {
    ok: true,
    startedAt: adiState.startedAt,
    lastRunAt: adiState.lastRunAt,
    lastRunMs: adiState.lastRunMs,
    runs: adiState.runs,
    errors: adiState.errors,
    discoveredCount: adiState.discovered.length,
    integratedCount: adiState.integrated.length,
    awaitingKeyCount: adiState.awaitingKey.length,
    tags: Object.keys(adiState.routes),
    routes: adiState.routes,
    awaitingKey: adiState.awaitingKey,
    lastImprovement: adiState.lastImprovement,
    integrated: adiState.integrated.map(m => ({
      id: m.id, type: m.type, flavor: m.flavor, score: m.score,
      latencyMs: m.latencyMs, lastSeen: m.lastSeen, keyless: !!m.keyless,
    })),
  };
}

function getOnboarding() {
  const summary = vault.summarize(catalog.PROVIDERS);
  return {
    ok: true,
    ts: Date.now(),
    withKeys: summary.withKeys,
    withoutKeys: summary.withoutKeys,
    keyless: summary.keyless,
    instructions: {
      runtime: 'POST /api/adi-core/keys with { provider, key, aliases? } to add at runtime.',
      persistent: 'Write to /etc/zeusai/secrets/*.env or ~/.zeusai/keys.env then SIGHUP/restart.',
      vaultFile: vault.VAULT_FILE,
    },
  };
}

function listProviders() {
  return {
    ok: true,
    count: catalog.PROVIDERS.length,
    providers: catalog.PROVIDERS.map(p => ({
      id: p.id, flavor: p.flavor, keyless: !!p.keyless, tags: p.tags || [],
      envAliases: p.envAliases || [], signupUrl: p.signupUrl || null,
      defaultModel: p.defaultModel || null, notes: p.notes || '',
    })),
  };
}

// Adauga o cheie la runtime: persist in vault, set process.env, re-ruleaza ADI imediat.
async function addKey({ provider, key, aliases }) {
  const p = catalog.byId(provider);
  const list = Array.isArray(aliases) && aliases.length
    ? aliases
    : (p && p.envAliases) || [String(provider || '').toUpperCase() + '_API_KEY'];
  const res = vault.setKey({ provider, key, aliases: list });
  if (!res.ok) return res;
  // re-run imediat ca sa integram noul provider
  const run = await runADI();
  return { ok: true, provider, aliases: list, masked: res.masked, run };
}

async function call(tag, prompt, opts) { return router.call(tag, prompt, opts); }

module.exports = {
  runADI, getStatus, getOnboarding, listProviders, addKey, call,
  adiState, discovery, evaluator, registry, adapterGen, router, selfImprove, vault, catalog,
};
