// ADI-Core Router — picks best model per tag (score desc), failover chain
const { generateAdapter } = require('./adapter-gen');

const _routes = new Map();

async function updateRoutes(integrated) {
  _routes.clear();
  for (const m of integrated) {
    const adapter = generateAdapter(m);
    const tags = (m.meta && m.meta.tags) || ['default'];
    for (const tag of tags) {
      if (!_routes.has(tag)) _routes.set(tag, []);
      _routes.get(tag).push({ model: m, adapter, score: m.score || 0 });
    }
  }
  for (const arr of _routes.values()) arr.sort((a, b) => b.score - a.score);
  const summary = {};
  for (const [tag, arr] of _routes.entries()) {
    summary[tag] = arr.map(x => ({ id: x.model.id, score: x.score, latencyMs: x.model.latencyMs }));
  }
  return summary;
}

async function call(tag, prompt, opts = {}) {
  const bucket = _routes.get(tag) || _routes.get('default') || [];
  if (!bucket.length) return { ok: false, reason: 'no-route-for-tag', tag };
  for (const entry of bucket) {
    const r = await entry.adapter(prompt, opts);
    if (r && r.ok) return { ...r, via: entry.model.id, tag };
  }
  return { ok: false, reason: 'all-providers-failed', tag };
}

function getRoutes() {
  const out = {};
  for (const [tag, arr] of _routes.entries()) out[tag] = arr.map(x => ({ id: x.model.id, score: x.score }));
  return out;
}

module.exports = { updateRoutes, call, getRoutes };
