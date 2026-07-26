'use strict';

// ===========================================================================
// Fulfillment AI Eternal OS — inventie ZeusAI / Unicorn
//
// Problema pe care o rezolva (inca nu exista in industrie ca produs):
//   "AI-ul de fulfillment se dezarmeaza silentios dupa deploy / PM2 reload
//    pentru ca ecosystem.config.js pinuie string-uri goale peste cheile din
//    .env, iar flag-ul FULFILLMENT_AI_ENABLED=0 din spawn blocheaza banii."
//
// Inventii:
//   1. KEY CONTINUUM — FULFILLMENT_AI_ENABLED=auto (default): armat IFF exista
//      cel putin o cheie LLM reala. `1` force-on, `0` force-off.
//   2. SANCTUM RELOAD — la fiecare decizie de arm, completeaza cheile lipsa
//      din planele durable pe disc (.env, shared/.env, /etc/zeusai/secrets/*)
//      FARA a loga valori. PM2 empty-string nu mai poate omori AI-ul.
//   3. ETERNAL ARM LEDGER — scrie un attestation fara secrete
//      (data/fulfillment-ai-eternal.json) ca AI-ul a fost armat; fail-soft.
//   4. CASCADE HONESTY — status public: mode/armed/providersConfigured,
//      zero leak de chei.
//
// Contract: never throw into the money path. Deterministic packs remain the
// fallback when AI is off or providers fail.
// ===========================================================================

const fs = require('fs');
const path = require('path');

const AI_ENV_KEYS = [
  'OPENAI_API_KEY',
  'DEEPSEEK_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'MISTRAL_API_KEY',
  'COHERE_API_KEY',
  'XAI_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
  'HF_API_KEY',
  'HUGGINGFACE_API_KEY',
  'PERPLEXITY_API_KEY',
  'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY',
  'SAMBANOVA_API_KEY',
  'NVIDIA_NIM_API_KEY',
];

const PLACEHOLDER_RX = /^(your[_-].*|changeme|todo|placeholder|example|xxxx+|\*+|none|null|undefined|n\/a|tbd|skip|<.*>)$/i;
const MIN_KEY_LEN = 20;

let _health = null;
try { _health = require('./ai-provider-health'); } catch (_) { _health = null; }

function _strip(v) {
  return String(v == null ? '' : v).trim().replace(/^['"]|['"]$/g, '').trim();
}

function isRealKey(value) {
  const v = _strip(value);
  if (v.length < MIN_KEY_LEN) return false;
  if (PLACEHOLDER_RX.test(v)) return false;
  if (/(your[_-]?|changeme|placeholder|example|xxxx|\.\.\.)/i.test(v)) return false;
  return true;
}

function keyConfigured(envKey) {
  if (_health && typeof _health._keyConfigured === 'function') {
    try { return !!_health._keyConfigured(envKey); } catch (_) { /* fall through */ }
  }
  return isRealKey(process.env[envKey]);
}

function sanctumFiles() {
  const root = path.join(__dirname, '..', '..');
  const files = [
    path.join(root, '.env'),
    path.join(root, '.env.local'),
    '/var/www/unicorn/shared/.env',
    '/etc/zeusai/secrets/ai-keys.env',
    '/etc/zeusai/social.env',
  ];
  try {
    const dir = '/etc/zeusai/secrets';
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.env')) continue;
        files.push(path.join(dir, name));
      }
    }
  } catch (_) { /* non-fatal */ }
  return [...new Set(files)];
}

/**
 * Fill empty / placeholder AI keys from durable secret planes on disk.
 * Never logs values. Returns count of restored keys.
 */
function reloadKeysFromSanctum() {
  let restored = 0;
  for (const file of sanctumFiles()) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!AI_ENV_KEYS.includes(key)) continue;
      const val = _strip(line.slice(eq + 1));
      if (!isRealKey(val)) continue;
      if (!isRealKey(process.env[key])) {
        process.env[key] = val;
        restored++;
      }
    }
  }
  return restored;
}

function configuredProviderSnapshot() {
  reloadKeysFromSanctum();
  // Prefer _keyConfigured from ai-provider-health — never call snapshot() here
  // (snapshot may compose Eternal OS status and would recurse).
  if (_health && typeof _health._keyConfigured === 'function') {
    try {
      const FALLBACK = [
        { name: 'groq', envKey: 'GROQ_API_KEY' },
        { name: 'deepseek', envKey: 'DEEPSEEK_API_KEY' },
        { name: 'mistral', envKey: 'MISTRAL_API_KEY' },
        { name: 'together', envKey: 'TOGETHER_API_KEY' },
        { name: 'fireworks', envKey: 'FIREWORKS_API_KEY' },
        { name: 'gemini', envKey: 'GEMINI_API_KEY' },
        { name: 'cohere', envKey: 'COHERE_API_KEY' },
        { name: 'huggingface', envKey: 'HUGGINGFACE_API_KEY' },
        { name: 'sambanova', envKey: 'SAMBANOVA_API_KEY' },
        { name: 'nvidia-nim', envKey: 'NVIDIA_NIM_API_KEY' },
        { name: 'openai', envKey: 'OPENAI_API_KEY' },
        { name: 'perplexity', envKey: 'PERPLEXITY_API_KEY' },
        { name: 'openrouter', envKey: 'OPENROUTER_API_KEY' },
        { name: 'claude', envKey: 'ANTHROPIC_API_KEY' },
      ];
      const names = [];
      for (const p of FALLBACK) {
        if (_health._keyConfigured(p.envKey)) names.push(p.name);
      }
      return { configured: names.length, configuredNames: names, total: FALLBACK.length };
    } catch (_) { /* fall through */ }
  }
  const names = [];
  for (const k of AI_ENV_KEYS) {
    if (keyConfigured(k)) names.push(k.replace(/_API_KEY$/, '').toLowerCase());
  }
  return { configured: names.length, configuredNames: [...new Set(names)], total: AI_ENV_KEYS.length };
}

/**
 * Resolve operator intent:
 *   auto / unset / empty  → arm when ≥1 real provider key
 *   1 / true / on / yes   → force on (still needs a key at call time)
 *   0 / false / off / no  → force off
 */
function resolveMode(raw) {
  const v = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!v || v === 'auto') return 'auto';
  if (['1', 'true', 'on', 'yes', 'enabled', 'eternal'].includes(v)) return 'on';
  if (['0', 'false', 'off', 'no', 'disabled'].includes(v)) return 'off';
  return 'auto';
}

/**
 * Operational "will actually generate" — mode not force-off AND ≥1 real key.
 * Force-on without a key is NOT armed (engine may still attempt and fail-soft).
 */
function isArmed(opts = {}) {
  const mode = resolveMode(opts.mode != null ? opts.mode : process.env.FULFILLMENT_AI_ENABLED);
  if (mode === 'off') return false;
  return configuredProviderSnapshot().configured > 0;
}

function defaultSkuAllowlist() {
  return [
    'instant-website-audit',
    'instant-seo-content-pack',
    'instant-landing-page',
    'instant-pitch-deck',
    'instant-email-sequence',
  ];
}

function skuAllowlist() {
  const raw = String(process.env.FULFILLMENT_AI_SKUS || '').trim();
  if (!raw) return new Set(defaultSkuAllowlist());
  if (raw === '*' || raw.toLowerCase() === 'all') return null;
  return new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

/**
 * Should the money path ATTEMPT AI for this SKU?
 *   off  → never
 *   auto → only when ≥1 real key (Key Continuum)
 *   on   → allowlisted SKUs (chat fail-softs if key missing)
 */
function shouldUseAiForSku(serviceId) {
  const mode = resolveMode(process.env.FULFILLMENT_AI_ENABLED);
  if (mode === 'off') return false;
  if (mode === 'auto' && configuredProviderSnapshot().configured < 1) return false;
  const allow = skuAllowlist();
  if (allow == null) return true;
  return allow.has(String(serviceId || '').trim());
}

function ledgerPath() {
  const dataDir = process.env.UNICORN_DATA_DIR
    || path.join(__dirname, '..', '..', 'data');
  return path.join(dataDir, 'fulfillment-ai-eternal.json');
}

function persistArmLedger(status) {
  try {
    const p = ledgerPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const prev = fs.existsSync(p)
      ? (() => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; } })()
      : {};
    const next = {
      invention: 'fulfillment-ai-eternal-os',
      mode: status.mode,
      armed: status.armed,
      providersConfigured: status.providersConfigured,
      configuredNames: status.configuredNames,
      skuPolicy: status.skuPolicy,
      updatedAt: status.timestamp,
      firstArmedAt: status.armed
        ? (prev.firstArmedAt || status.timestamp)
        : (prev.firstArmedAt || null),
      armCount: Number(prev.armCount || 0) + (status.armed && !prev.armed ? 1 : 0),
    };
    fs.writeFileSync(p, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  } catch (_) { /* never break money path */ }
}

function getStatus() {
  const mode = resolveMode(process.env.FULFILLMENT_AI_ENABLED);
  const snap = configuredProviderSnapshot();
  const armed = isArmed();
  const allow = skuAllowlist();
  const status = {
    ok: true,
    invention: 'fulfillment-ai-eternal-os',
    module: 'fulfillment-ai-os',
    mode,
    armed,
    providersConfigured: snap.configured,
    configuredNames: snap.configuredNames,
    providersTotal: snap.total,
    skuPolicy: allow == null ? 'all' : 'allowlist',
    skuAllowlist: allow == null ? ['*'] : [...allow],
    envFlag: process.env.FULFILLMENT_AI_ENABLED == null
      ? null
      : String(process.env.FULFILLMENT_AI_ENABLED),
    sanctumPlanes: [
      '.env',
      'shared/.env',
      '/etc/zeusai/secrets/ai-keys.env',
    ],
    note: armed
      ? 'AI fulfillment armed — cascade will generate allowlisted digital SKUs; human/enterprise stays kickoff/proposal.'
      : (mode === 'off'
        ? 'Force-off via FULFILLMENT_AI_ENABLED=0'
        : 'Waiting for at least one real LLM provider key in sanctum / .env'),
    timestamp: new Date().toISOString(),
  };
  persistArmLedger(status);
  return status;
}

function expressRouter(express) {
  const r = express.Router();
  r.get('/', (_req, res) => {
    try { res.json(getStatus()); }
    catch (e) { res.status(500).json({ ok: false, error: String(e && e.message || e) }); }
  });
  r.post('/reload-sanctum', (_req, res) => {
    try {
      const restored = reloadKeysFromSanctum();
      res.json({ ok: true, restored, status: getStatus() });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });
  return r;
}

module.exports = {
  AI_ENV_KEYS,
  isRealKey,
  keyConfigured,
  reloadKeysFromSanctum,
  configuredProviderSnapshot,
  resolveMode,
  isArmed,
  shouldUseAiForSku,
  skuAllowlist,
  defaultSkuAllowlist,
  getStatus,
  persistArmLedger,
  expressRouter,
};
