// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-15T07:00:14.369Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// ADI-Core World Scanner
// Vaneaza permanent AI-uri din internetul public: pulează liste de modele,
// probeaza endpoint-uri OpenAI-compatible, invata provideri noi si ii persista
// pe disc in .data/learned-providers.json (ramane peste restart-uri).
//
// Sursele scanate (toate publice, fara cheie):
//   - OpenRouter models list   (~250+ modele rutabile)
//   - Pollinations models list (~10+ modele keyless)
//   - HuggingFace trending     (text-generation)
//   - Probe endpoint candidates (din ADI_CORE_PROBE_URLS env sau lista builtin)
//
// Apel: const ws = require('./world-scanner'); await ws.scan();

const fs   = require('fs');
const path = require('path');

const DATA_DIR     = path.join(__dirname, '..', '..', '..', '.data');
const LEARNED_FILE = path.join(DATA_DIR, 'learned-providers.json');
const SCAN_FILE    = path.join(DATA_DIR, 'world-scan.json');
const SCAN_TIMEOUT = 12000;

// Endpoint-uri publice care expun /v1/models fara cheie (best effort).
// Operatorul poate adauga prin env: ADI_CORE_PROBE_URLS=url1,url2,...
const DEFAULT_PROBE_URLS = [
  'https://text.pollinations.ai/openai',          // pollinations (deja in catalog static)
  'https://openrouter.ai/api/v1',                 // openrouter (deja in catalog static)
  'https://api.groq.com/openai/v1',               // groq (needs key for inference)
  'https://api.deepinfra.com/v1/openai',          // deepinfra
  'https://api.together.xyz/v1',                  // together (needs key)
  'https://api.fireworks.ai/inference/v1',        // fireworks (needs key)
  'https://api.sambanova.ai/v1',                  // sambanova (needs key)
  'https://api.cerebras.ai/v1',                   // cerebras (needs key)
  'https://api.featherless.ai/v1',                // featherless
  'https://api.lambdalabs.com/v1',                // lambda labs
  'https://api.lepton.ai/v1',                     // lepton ai
];

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

function loadLearned() {
  try {
    if (!fs.existsSync(LEARNED_FILE)) return [];
    const raw = fs.readFileSync(LEARNED_FILE, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.providers) ? j.providers : [];
  } catch { return []; }
}

function saveLearned(arr) {
  ensureDir();
  try {
    fs.writeFileSync(LEARNED_FILE, JSON.stringify({
      updatedAt: new Date().toISOString(),
      providers: arr,
    }, null, 2));
    return true;
  } catch { return false; }
}

function loadScanReport() {
  try {
    if (!fs.existsSync(SCAN_FILE)) return null;
    return JSON.parse(fs.readFileSync(SCAN_FILE, 'utf8'));
  } catch { return null; }
}

function saveScanReport(report) {
  ensureDir();
  try { fs.writeFileSync(SCAN_FILE, JSON.stringify(report, null, 2)); } catch {}
}

async function fetchJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || SCAN_TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: opts.headers || {} });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, url };
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) return { ok: true, status: r.status, url, json: await r.json() };
    return { ok: true, status: r.status, url, text: await r.text() };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: String(e && e.message || e), url };
  }
}

// 1) Pollinations: GET https://text.pollinations.ai/models → array of model objects
async function scanPollinations() {
  const r = await fetchJSON('https://text.pollinations.ai/models');
  if (!r.ok) return { source: 'pollinations', ok: false, error: r.error || ('http ' + r.status) };
  const arr = Array.isArray(r.json) ? r.json : [];
  const names = arr.map(m => (typeof m === 'string' ? m : (m.name || m.id || m.model))).filter(Boolean);
  return { source: 'pollinations', ok: true, modelCount: names.length, sampleModels: names.slice(0, 20) };
}

// 2) OpenRouter: GET https://openrouter.ai/api/v1/models → { data: [...] }
async function scanOpenRouter() {
  const r = await fetchJSON('https://openrouter.ai/api/v1/models');
  if (!r.ok) return { source: 'openrouter', ok: false, error: r.error || ('http ' + r.status) };
  const data = (r.json && r.json.data) || [];
  const free = data.filter(m => /:free$/.test(m.id || '') || (m.pricing && Number(m.pricing.prompt) === 0));
  return {
    source: 'openrouter',
    ok: true,
    modelCount: data.length,
    freeModelCount: free.length,
    sampleFree: free.slice(0, 12).map(m => m.id),
  };
}

// 3) HuggingFace: GET https://huggingface.co/api/models?pipeline_tag=text-generation&sort=trending&limit=20
async function scanHuggingFace() {
  const r = await fetchJSON('https://huggingface.co/api/models?pipeline_tag=text-generation&sort=trending&limit=20');
  if (!r.ok) return { source: 'huggingface', ok: false, error: r.error || ('http ' + r.status) };
  const arr = Array.isArray(r.json) ? r.json : [];
  return {
    source: 'huggingface',
    ok: true,
    modelCount: arr.length,
    sampleModels: arr.slice(0, 12).map(m => m.modelId || m.id),
  };
}

// 4) Probe candidate /v1/models endpoints. If 200 keyless => keyless-experimental candidate.
//    Daca 401/403 => OpenAI-compatible dar cere cheie.
async function probeCandidates() {
  const extra = (process.env.ADI_CORE_PROBE_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const urls = Array.from(new Set([...DEFAULT_PROBE_URLS, ...extra]));
  const results = [];
  for (const base of urls) {
    const probe = base.replace(/\/$/, '') + '/models';
    const r = await fetchJSON(probe, { timeoutMs: 8000 });
    let status = r.status || 0;
    let needsKey = (status === 401 || status === 403);
    let keyless = (r.ok && status === 200);
    results.push({
      base, probeUrl: probe, status,
      reachable: !!status, keyless, needsKey,
      modelCount: keyless && r.json && Array.isArray(r.json.data) ? r.json.data.length : null,
    });
  }
  return results;
}

// Materializeaza learned providers: pentru orice probe keyless reachable care nu e deja
// in static catalog, genereaza o intrare keyless-experimental.
function deriveLearned(staticIds, probeResults) {
  const learned = [];
  for (const p of probeResults) {
    if (!p.keyless) continue;
    // id derivat din host
    let id;
    try {
      const u = new URL(p.base);
      id = 'world:' + u.host.replace(/[^a-z0-9.-]/gi, '');
    } catch { continue; }
    if (staticIds.has(id)) continue;
    learned.push({
      id,
      keyless: true,
      flavor: 'openai',
      probeUrl: p.probeUrl,
      chatUrl: p.base.replace(/\/$/, '') + '/chat/completions',
      defaultModel: null,
      tags: ['llm', 'world-scan', 'keyless-experimental'],
      signupUrl: null,
      notes: 'Discovered by world-scanner. Public OpenAI-compatible /v1/models.',
      discoveredAt: new Date().toISOString(),
    });
  }
  return learned;
}

async function scan(staticCatalog = []) {
  const t0 = Date.now();
  const [poll, orouter, hf] = await Promise.all([
    scanPollinations().catch(e => ({ source: 'pollinations', ok: false, error: String(e) })),
    scanOpenRouter().catch(e => ({ source: 'openrouter', ok: false, error: String(e) })),
    scanHuggingFace().catch(e => ({ source: 'huggingface', ok: false, error: String(e) })),
  ]);
  const probes = await probeCandidates();
  const staticIds = new Set(staticCatalog.map(p => p.id));
  const learned = deriveLearned(staticIds, probes);

  // Merge cu learned-ul vechi (sa nu pierdem provideri descoperiti acum 3 cicluri).
  const existing = loadLearned();
  const byId = new Map();
  for (const p of existing) byId.set(p.id, p);
  for (const p of learned) byId.set(p.id, { ...byId.get(p.id), ...p });
  const merged = Array.from(byId.values());
  saveLearned(merged);

  const report = {
    ok: true,
    ts: Date.now(),
    durationMs: Date.now() - t0,
    sources: { pollinations: poll, openrouter: orouter, huggingface: hf },
    probes,
    learnedCount: merged.length,
    learnedDelta: learned.length,
    totalReachableModels:
      (poll.modelCount || 0) + (orouter.modelCount || 0) + (hf.modelCount || 0),
  };
  saveScanReport(report);
  return report;
}

function getReport() { return loadScanReport(); }
function getLearned() { return loadLearned(); }

module.exports = { scan, getReport, getLearned, LEARNED_FILE, SCAN_FILE };
