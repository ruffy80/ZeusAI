// ADI-Core Evaluator — health probe + scoring pentru providerii din catalog.
const HEALTH_TIMEOUT_MS = 5000;

function authHeaders(model) {
  const h = {};
  if (!model || !model.envVar) return h;
  const key = process.env[model.envVar];
  if (!key) return h;
  if (model.flavor === 'anthropic') {
    h['x-api-key'] = key;
    h['anthropic-version'] = '2023-06-01';
  } else if (model.flavor === 'gemini') {
    // key sent via ?key= in URL
  } else {
    h['Authorization'] = `Bearer ${key}`;
  }
  return h;
}

function buildProbeUrl(model) {
  if (model.flavor === 'gemini' && model.envVar) {
    const key = process.env[model.envVar] || '';
    return model.url + (model.url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
  }
  return model.url;
}

async function probeRemote(model) {
  if (!model || !model.url) return { healthy: false, latencyMs: 0, status: 0 };
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    const r = await fetch(buildProbeUrl(model), { method: 'GET', headers: authHeaders(model), signal: ctrl.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    const healthy = r.ok || r.status === 401 || r.status === 403;
    return { healthy, latencyMs, status: r.status };
  } catch (e) {
    return { healthy: false, latencyMs: Date.now() - t0, status: 0, error: String(e && e.message || e) };
  }
}

function probeLocal() { return { healthy: true, latencyMs: 0, status: 200 }; }

function score(model, probe) {
  if (!probe.healthy) return 0;
  const latencyScore = Math.max(0, 100 - Math.floor((probe.latencyMs || 0) / 50));
  const tagBonus = Math.min(20, (model.meta?.tags?.length || 0) * 4);
  const statusBonus = probe.status === 200 ? 10 : 0;
  let total = Math.round(latencyScore * 0.7 + tagBonus + statusBonus);
  if (model.keyless) total = Math.min(100, total + 3);
  if (model.envVar && process.env[model.envVar]) total = Math.min(100, total + 8);
  return Math.min(100, total);
}

async function evaluate(discovered) {
  const tasks = discovered.map(async (m) => {
    if (m.type === 'awaiting-key') {
      return { ...m, healthy: false, latencyMs: 0, httpStatus: 0, score: 0, probedAt: Date.now() };
    }
    const probe = m.type === 'remote-api' ? await probeRemote(m) : probeLocal();
    return { ...m, healthy: probe.healthy, latencyMs: probe.latencyMs, httpStatus: probe.status, score: score(m, probe), probedAt: Date.now() };
  });
  const settled = await Promise.allSettled(tasks);
  return settled.filter(s => s.status === 'fulfilled').map(s => s.value);
}

module.exports = { evaluate, score };
