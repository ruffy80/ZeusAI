// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-15T07:00:14.369Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// ADI-Core Registry — persistent integration ledger
const fs = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '..', '..', '..', '.data');
const FILE_PATH = path.join(DATA_DIR, 'adi-core-registry.json');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }
function load() {
  try { return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')); }
  catch (_) { return { models: {}, history: [] }; }
}
function save(state) {
  try { ensureDir(); fs.writeFileSync(FILE_PATH, JSON.stringify(state, null, 2)); return true; }
  catch (_) { return false; }
}

async function integrate(evaluated) {
  const state = load();
  const now = Date.now();
  const integrated = [];
  for (const m of evaluated) {
    if (!m.healthy || m.score <= 0) continue;
    const prev = state.models[m.id];
    const entry = {
      id: m.id,
      type: m.type,
      flavor: m.flavor || null,
      url: m.url || null,
      chatUrl: m.chatUrl || null,
      defaultModel: m.defaultModel || null,
      envVar: m.envVar || null,
      keyless: !!m.keyless,
      meta: m.meta || {},
      score: m.score,
      latencyMs: m.latencyMs,
      httpStatus: m.httpStatus,
      firstSeen: prev?.firstSeen || now,
      lastSeen: now,
      integratedAt: prev?.integratedAt || now,
      runs: (prev?.runs || 0) + 1,
    };
    state.models[m.id] = entry;
    integrated.push(entry);
  }
  state.history.push({ ts: now, count: integrated.length });
  if (state.history.length > 200) state.history = state.history.slice(-200);
  save(state);
  return integrated;
}

function getAll() { return load(); }

module.exports = { integrate, getAll, load, save, FILE_PATH };
