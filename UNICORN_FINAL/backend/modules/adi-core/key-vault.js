// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-15T07:00:14.368Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// ADI-Core Key Vault — multi-source resolution + runtime intake.
// Sources scanned (in this order, last write wins):
//   1) process.env (live)
//   2) <repo>/.data/adi-core-keys.json (persisted, writable via API)
//   3) <repo>/.env, <repo>/.env.local
//   4) /etc/zeusai/secrets/*.env
//   5) ~/.zeusai/keys.env
// Writes go to (2) so they survive restarts AND are reflected in process.env.
//
// Bilingual note: cheile sunt NICIODATA loggate in clar; doar masca "sk-***abc".

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR  = path.join(REPO_ROOT, '.data');
const VAULT_FILE = path.join(DATA_DIR, 'adi-core-keys.json');

const DOTENV_FILES = [
  path.join(REPO_ROOT, '.env'),
  path.join(REPO_ROOT, '.env.local'),
  path.join(REPO_ROOT, '.env.production'),
];
const EXTRA_DIRS = ['/etc/zeusai/secrets'];
const EXTRA_FILES = [path.join(os.homedir(), '.zeusai', 'keys.env')];

function maskKey(k) {
  if (!k) return '';
  const s = String(k);
  if (s.length < 10) return '***';
  return s.slice(0, 4) + '***' + s.slice(-3);
}

function parseDotenv(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function readEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return {};
    return parseDotenv(fs.readFileSync(file, 'utf8'));
  } catch { return {}; }
}

function readEnvDir(dir) {
  const out = {};
  try {
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.env')) continue;
      Object.assign(out, readEnvFile(path.join(dir, f)));
    }
  } catch {}
  return out;
}

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {} }

function loadVault() {
  try { return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')); }
  catch { return { keys: {}, updatedAt: 0 }; }
}
function saveVault(state) {
  try {
    ensureDir();
    fs.writeFileSync(VAULT_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
    try { fs.chmodSync(VAULT_FILE, 0o600); } catch {}
    return true;
  } catch (e) { return false; }
}

// Build the merged env view: file sources first, then process.env overrides.
function buildMergedEnv() {
  const merged = {};
  for (const f of DOTENV_FILES) Object.assign(merged, readEnvFile(f));
  for (const d of EXTRA_DIRS)  Object.assign(merged, readEnvDir(d));
  for (const f of EXTRA_FILES) Object.assign(merged, readEnvFile(f));
  // vault file (persisted runtime keys)
  const v = loadVault();
  Object.assign(merged, v.keys || {});
  // process.env wins
  for (const k of Object.keys(process.env)) {
    if (process.env[k] != null && process.env[k] !== '') merged[k] = process.env[k];
  }
  return merged;
}

// Reseed process.env from file sources so subsequent code in this process sees them.
function reseedProcessEnv() {
  const merged = buildMergedEnv();
  let added = 0;
  for (const [k, v] of Object.entries(merged)) {
    if (!process.env[k] && v) { process.env[k] = v; added++; }
  }
  return added;
}

function findKey(envAliases) {
  if (!Array.isArray(envAliases) || !envAliases.length) return null;
  const merged = buildMergedEnv();
  for (const alias of envAliases) {
    const v = merged[alias];
    if (v && String(v).length >= 8) return { alias, value: v };
  }
  return null;
}

// Add or update a key for a provider. Writes vault file + sets all aliases on process.env.
function setKey({ provider, key, aliases }) {
  if (!provider || !key) return { ok: false, error: 'provider+key required' };
  const list = Array.isArray(aliases) && aliases.length ? aliases : [String(provider).toUpperCase() + '_API_KEY'];
  const state = loadVault();
  state.keys = state.keys || {};
  for (const a of list) {
    state.keys[a] = String(key);
    process.env[a] = String(key);
  }
  state.updatedAt = Date.now();
  const ok = saveVault(state);
  return { ok, provider, aliases: list, masked: maskKey(key) };
}

// List which providers have keys vs. need keys.
function summarize(catalog) {
  const out = { withKeys: [], withoutKeys: [], keyless: [] };
  for (const p of catalog) {
    if (p.keyless) { out.keyless.push({ id: p.id, tags: p.tags || [], notes: p.notes || '' }); continue; }
    const aliases = p.envAliases || [String(p.id).toUpperCase() + '_API_KEY'];
    const found = findKey(aliases);
    if (found) out.withKeys.push({ id: p.id, alias: found.alias, masked: maskKey(found.value), tags: p.tags || [] });
    else out.withoutKeys.push({ id: p.id, aliases, signupUrl: p.signupUrl || null, tags: p.tags || [], notes: p.notes || '' });
  }
  return out;
}

module.exports = {
  VAULT_FILE,
  reseedProcessEnv,
  findKey,
  setKey,
  summarize,
  maskKey,
  loadVault,
};
