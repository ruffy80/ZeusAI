// ADI-Core Self-Improvement — prune stale providers, compute avg score
const registry = require('./registry');
const STALE_MS = 24 * 60 * 60 * 1000;

async function improve() {
  const reg = registry.load();
  const now = Date.now();
  let pruned = 0, sumScore = 0;
  const ids = Object.keys(reg.models || {});
  for (const id of ids) {
    const m = reg.models[id];
    if (!m) continue;
    sumScore += m.score || 0;
    if (now - (m.lastSeen || 0) > STALE_MS) { delete reg.models[id]; pruned++; }
  }
  const active = Object.keys(reg.models || {}).length;
  const avgScore = active ? Math.round(sumScore / Math.max(1, ids.length)) : 0;
  registry.save(reg);
  return { improvedAt: now, pruned, activeModels: active, avgScore, note: pruned ? `Pruned ${pruned} stale providers` : 'No stale providers' };
}

module.exports = { improve };
