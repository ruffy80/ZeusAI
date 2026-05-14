// ADI-Core Evaluator — REAL health probe + scoring (Node 20+ fetch)
const HEALTH_TIMEOUT_MS = 4000;

async function probeRemote(model) {
  if (model.type !== 'remote-api' || !model.url) return { healthy: false, latencyMs: 0, status: 0 };
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    const key = process.env[model.envVar] || '';
    const headers = {};
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const r = await fetch(model.url, { method: 'GET', headers, signal: ctrl.signal });
    clearTimeout(t);
    // 401/403 means the endpoint is alive (auth fail counts as reachable).
    return { healthy: r.ok || r.status === 401 || r.status === 403, latencyMs: Date.now() - started, status: r.status };
  } catch (e) {
    return { healthy: false, latencyMs: Date.now() - started, status: 0, error: String(e && e.message || e) };
  }
}

function probeLocal() {
  return { healthy: true, latencyMs: 0, status: 200 };
}

function scoreModel(model, probe) {
  if (!probe.healthy) return 0;
  const latencyScore = Math.max(0, 100 - Math.floor((probe.latencyMs || 0) / 50));
  const tagBonus = Math.min(20, (model.meta?.tags?.length || 0) * 4);
  return Math.min(100, Math.round(latencyScore * 0.7 + tagBonus + (probe.status === 200 ? 10 : 0)));
}

async function evaluate(discovered) {
  const tasks = discovered.map(async (m) => {
    const probe = m.type === 'remote-api' ? await probeRemote(m) : probeLocal();
    return { ...m, healthy: probe.healthy, latencyMs: probe.latencyMs, httpStatus: probe.status, score: scoreModel(m, probe), probedAt: Date.now() };
  });
  const settled = await Promise.allSettled(tasks);
  return settled.filter(s => s.status === 'fulfilled').map(s => s.value);
}

module.exports = { evaluate, scoreModel };
