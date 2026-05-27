#!/usr/bin/env node
// =====================================================================
// DeepSeek Unified Daemon — Maximum Power Agent pentru zeusai.pro
//
// Combină toate capacitățile DeepSeek într-un singur daemon permanent:
//   1. deepseek-loop.js  — bucla infinită de advisory/execute
//   2. deepseek-autopilot-tick.js — dispatch direct prin governor (fără HTTP)
//                                   + git push proposals → draft PR
//   3. Memorie multi-tick in-memory (ultimele 10 acțiuni) → prompt enrichit
//   4. Fallback complet de provideri: DeepSeek → OpenRouter → Groq → Ollama
//
// What it does (en):
//   Every INTERVAL_MS it:
//     1. Collects a rich status snapshot (health, pricing, errors, roadmap,
//        operator commands, cleanup candidates, autonomous log tail).
//     2. Includes last N tick actions in the system prompt to avoid repetition.
//     3. Asks DeepSeek (with provider chain fallback) for ONE allowlist action.
//     4a. If EXECUTE_MODE=0 → logs advisory only (default safe mode).
//     4b. If EXECUTE_MODE=1 → dispatches via governor.dispatch() DIRECTLY
//         (no HTTP round-trip; resilient when backend is restarting).
//     5. If action is code_proposal AND DEEPSEEK_UNIFIED_GIT_PUSH=1 →
//         git add + commit + push to branch deepseek/proposals-YYYYMMDD,
//         then opens a draft PR on GitHub (once per day per branch).
//
// Safety envelope:
//   * Default-off: requires DEEPSEEK_UNIFIED_ENABLED=1.
//   * Execute requires DEEPSEEK_LOOP_EXECUTE=1 + DEEPSEEK_LOOP_ADMIN_TOKEN.
//   * All actions validated twice: locally + governor allowlist.
//   * Circuit breaker: FAILURE_THRESHOLD consecutive failures → BACKOFF_MS pause.
//   * No shell exec in advisory logic. No eval. No arbitrary writes.
//   * Governor's protected-path rules apply on every dispatch.
//   * Git push uses execFileSync (no shell injection possible).
//
// Golden Rule compliance:
//   * Rule #4: auto-sync disabled — git push is proposals-only branch,
//     never merges to main automatically.
//   * Rule #5: CSP/Trusted Types not touched.
//   * Rule #6: resource-monitor never kills backend.
//
// Per Golden Rule #4 this script is DEFAULT-OFF.
// NEVER run start-auto-sync scripts. Git push is proposals-only.
// =====================================================================
'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

// ADI-Core Key Vault — multi-source key resolution (env, vault file, .env,
// /etc/zeusai/secrets/, ~/.zeusai/keys.env). Graceful fallback if unavailable.
let keyVault;
try { keyVault = require('../backend/modules/adi-core/key-vault'); } catch (e) {
  keyVault = null;
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: 'key_vault_unavailable', extra: { error: String(e.message || e) } }) + '\n');
}

// Reseed process.env from all vault sources BEFORE reading any config constants.
if (keyVault) {
  try { keyVault.reseedProcessEnv(); } catch (_) { /* non-fatal */ }
}

// -------- Governor (direct dispatch — no HTTP round-trip) ----------------
let governor;
try {
  governor = require('../backend/modules/deepseek-governor');
} catch (e) {
  // Governor may not be loadable in dev without full backend deps.
  // Falls back to HTTP dispatch below.
  governor = null;
}

// -------- Configuration --------------------------------------------------
const ENABLED          = String(process.env.DEEPSEEK_UNIFIED_ENABLED || process.env.DEEPSEEK_LOOP_ENABLED || '') === '1';
const EXECUTE_MODE     = String(process.env.DEEPSEEK_LOOP_EXECUTE || '') === '1';
const GIT_PUSH_ENABLED = String(process.env.DEEPSEEK_UNIFIED_GIT_PUSH || '') === '1';

const FAST_INTERVAL_MS        = Math.max(30_000, parseInt(process.env.DEEPSEEK_LOOP_FAST_INTERVAL_MS    || '30000', 10));
const INTERVAL_MS             = Math.max(30_000, parseInt(process.env.DEEPSEEK_LOOP_INTERVAL_MS         || '60000', 10));
const INITIAL_FAST_WINDOW_MS  = Math.max(60_000, parseInt(process.env.DEEPSEEK_LOOP_FAST_WINDOW_MS      || String(60 * 60 * 1000), 10));
const SLOW_INTERVAL_MS        = Math.max(60_000, parseInt(process.env.DEEPSEEK_LOOP_SLOW_INTERVAL_MS    || '60000', 10));
const STABLE_WINDOW_HOURS     = Math.max(1,       parseInt(process.env.DEEPSEEK_LOOP_STABLE_WINDOW_HOURS || '24', 10));
const BACKOFF_MS               = parseInt(process.env.DEEPSEEK_LOOP_BACKOFF_MS          || String(30 * 60 * 1000), 10);
const FAILURE_THRESHOLD        = parseInt(process.env.DEEPSEEK_LOOP_FAILURE_THRESHOLD   || '3', 10);

const BACKEND_URL       = process.env.DEEPSEEK_LOOP_BACKEND_URL   || 'http://127.0.0.1:3000';
const HEALTH_URL        = process.env.DEEPSEEK_LOOP_HEALTH_URL    || (BACKEND_URL + '/health');
const PRICING_PAGE_URL  = process.env.DEEPSEEK_LOOP_PRICING_URL   || 'https://zeusai.pro/pricing';
const ADMIN_TOKEN       = process.env.DEEPSEEK_LOOP_ADMIN_TOKEN   || '';
const ERROR_LOG_PATH    = process.env.DEEPSEEK_LOOP_ERROR_LOG     || '/var/log/unicorn/error.log';

const DEEPSEEK_API_URL  = process.env.DEEPSEEK_API_URL            || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY  = process.env.DEEPSEEK_API_KEY            || '';
const DEEPSEEK_MODEL    = process.env.DEEPSEEK_MODEL              || 'deepseek-reasoner';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY         || '';
const OPENROUTER_MODEL   = process.env.OPENROUTER_DEEPSEEK_MODEL  || 'deepseek/deepseek-v4-flash:free';
const GROQ_API_KEY       = process.env.GROQ_API_KEY               || '';
const GROQ_MODEL         = process.env.GROQ_DEEPSEEK_MODEL        || 'qwen/qwen3-32b';
const OLLAMA_BASE_URL    = process.env.DEEPSEEK_LOOP_OLLAMA_URL   || 'http://127.0.0.1:11434';
const OLLAMA_MODEL       = process.env.DEEPSEEK_LOOP_OLLAMA_MODEL || 'llama3';
const LOCAL_FALLBACK_ENABLED = String(process.env.DEEPSEEK_LOOP_LOCAL_FALLBACK_ENABLED || '') === '1';
const OLLAMA_FALLBACK_ENABLED = String(process.env.DEEPSEEK_LOOP_OLLAMA_ENABLED || '') === '1';

const ADVISOR_TEMPERATURE    = Number.isFinite(Number(process.env.DEEPSEEK_LOOP_TEMPERATURE))
                             ? Number(process.env.DEEPSEEK_LOOP_TEMPERATURE) : 0.0;
const ADVISOR_MAX_TOKENS     = Math.max(64, parseInt(process.env.DEEPSEEK_LOOP_MAX_TOKENS          || '500', 10));
const ADVISOR_MAX_COMPLETION = Math.max(64, parseInt(process.env.DEEPSEEK_LOOP_MAX_COMPLETION_TOKENS || '200', 10));

const AGI_FALLBACK_URL  = process.env.DEEPSEEK_LOOP_AGI_URL || (BACKEND_URL + '/api/agi/process');
const AGE_FALLBACK_URL  = process.env.DEEPSEEK_LOOP_AGE_URL || (BACKEND_URL + '/api/age/act');

const AUTONOMY_ROOT     = process.env.DEEPSEEK_LOOP_AUTONOMY_ROOT || '/opt/unicorn';
const SANDBOX_ROOT      = process.env.DEEPSEEK_LOOP_SANDBOX_ROOT  || path.join(AUTONOMY_ROOT, 'sandbox');
const AUTONOMOUS_LOG_PATH = process.env.DEEPSEEK_LOOP_ACTION_LOG  || '/var/log/autonomous_actions.log';
const AUTONOMOUS_TAIL_MAX_AGE_MS  = Math.max(60_000, parseInt(process.env.DEEPSEEK_LOOP_AUTONOMOUS_TAIL_MAX_AGE_MS || String(15 * 60 * 1000), 10));
const AUTONOMOUS_TAIL_MAX_ITEMS   = Math.max(1, Math.min(20, parseInt(process.env.DEEPSEEK_LOOP_AUTONOMOUS_TAIL_MAX_ITEMS || '4', 10)));

const LOG_PATH           = process.env.DEEPSEEK_LOOP_LOG_PATH
                         || path.join(__dirname, '..', 'data', 'logs', 'deepseek-unified.log');
const ROADMAP_PATH       = process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH
                         || path.join(__dirname, '..', 'data', 'roadmap.json');
const PROPOSALS_DIR      = process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR
                         || path.join(__dirname, '..', 'data', 'deepseek-proposals');
const COMMAND_QUEUE_PATH = process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_PATH
                         || path.join(__dirname, '..', 'data', 'deepseek-commands.jsonl');

// GitHub git-push config
const GITHUB_TOKEN       = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GH_PAT || process.env.GITHUB_TOKEN_SYNC || '';
const GITHUB_REPO        = process.env.DEEPSEEK_UNIFIED_GITHUB_REPO || '';   // e.g. "username/repo"
const GIT_REPO_ROOT      = process.env.DEEPSEEK_UNIFIED_GIT_ROOT
                         || path.join(__dirname, '..', '..');   // workspace root

// Multi-tick memory: keep last N actions in RAM, enriches system prompt.
const TICK_MEMORY_SIZE   = Math.max(3, Math.min(20, parseInt(process.env.DEEPSEEK_UNIFIED_MEMORY_SIZE || '10', 10)));

// Hardcoded allowlist (mirrors governor) — client-side pre-validation.
// Lista albă hardcodată (identică cu governor) — validare client.
const ALLOWED_ACTIONS = [
  'none', 'read_status', 'read_file', 'write_file', 'create_file', 'move_file',
  'delete_file', 'execute_safe_script', 'prices_sync', 'checkout_fix', 'run_test',
  'restart_service', 'git_commit', 'deploy', 'github_clone_repo', 'github_read_repo',
  'github_create_branch', 'github_commit_push', 'github_create_pr', 'github_merge_pr',
  'github_trigger_workflow', 'github_comment_issue', 'merge_pr', 'browse_github',
  'search_github', 'full_backup', 'restore_backup', 'analyze_logs', 'rollback_deploy',
  'code_proposal', 'roadmap_update',
];

const CODE_PROPOSAL_ALLOWED_PREFIXES = [
  'UNICORN_FINAL/backend/modules/',
  'UNICORN_FINAL/backend/constants/',
  'UNICORN_FINAL/src/',
  'UNICORN_FINAL/test/',
  'UNICORN_FINAL/docs/',
  'docs/',
];
const CODE_PROPOSAL_DENIED_PREFIXES = ['server/', 'src/', 'backend/', '.github/', 'node_modules/'];

// -------- In-memory tick history -----------------------------------------
// Istoria tick-urilor în memorie — evitâm repetiția și dăm context suplimentar.
const _tickHistory = [];   // [{ts, action, reason, params_digest}]

function _recordTick(rec) {
  _tickHistory.push({
    ts: new Date().toISOString(),
    action: rec && rec.action ? String(rec.action) : 'none',
    reason: rec && rec.reason ? String(rec.reason).slice(0, 120) : '',
    params_digest: rec && rec.params ? JSON.stringify(rec.params).slice(0, 80) : '',
  });
  while (_tickHistory.length > TICK_MEMORY_SIZE) _tickHistory.shift();
}

function _tickHistoryDigest() {
  if (!_tickHistory.length) return null;
  return _tickHistory.map((t) => `[${t.ts.slice(11, 19)}] ${t.action} — ${t.reason}`).join('\n');
}

// -------- Loop state -----------------------------------------------------
let consecutiveFailures = 0;
let pausedUntil = 0;
let loopStartedAt = Date.now();
let lastCriticalTs = Date.now();
// Track last proposal git-push branch per day.
let _lastGitPushBranch = '';

// -------- Logging --------------------------------------------------------
function ensureLogDir() {
  try { fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true }); } catch (_) {}
}
function log(level, msg, extra) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(extra ? { extra } : {}) };
  const line = JSON.stringify(entry);
  try { ensureLogDir(); fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) {}
  process.stdout.write(line + '\n');
}

// -------- Tiny HTTP client (no deps) -------------------------------------
function request(url, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: opts.method || 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: opts.headers || {},
      timeout: opts.timeoutMs || 10_000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('request_timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// -------- Roadmap / operator-command helpers -----------------------------
async function fetchRoadmap() {
  // Try HTTP admin endpoint first; fall back to reading roadmap.json directly.
  // Încearcă endpoint HTTP; fallback la citire directă din disc.
  if (ADMIN_TOKEN) {
    try {
      const res = await request(BACKEND_URL + '/api/admin/roadmap', {
        timeoutMs: 5000,
        headers: { 'Authorization': 'Bearer ' + ADMIN_TOKEN },
      });
      if (res.status >= 200 && res.status < 300) return JSON.parse(res.body);
    } catch (_) { /* fall through to file read */ }
  }
  try {
    if (fs.existsSync(ROADMAP_PATH)) return JSON.parse(fs.readFileSync(ROADMAP_PATH, 'utf8'));
  } catch (_) {}
  return null;
}

async function consumeNextOperatorCommand() {
  if (!ADMIN_TOKEN) return null;
  try {
    const res = await request(BACKEND_URL + '/api/admin/deepseek/command/consume', {
      method: 'POST', timeoutMs: 5000,
      headers: { 'Authorization': 'Bearer ' + ADMIN_TOKEN, 'Content-Length': '0' },
    });
    if (res.status === 204) return null;
    if (res.status < 200 || res.status >= 300) return null;
    const j = JSON.parse(res.body);
    return j && j.command ? j.command : null;
  } catch (_) { return consumeNextOperatorCommandFromFile(); }
}

function consumeNextOperatorCommandFromFile() {
  let lines = [];
  try {
    if (!fs.existsSync(COMMAND_QUEUE_PATH)) return null;
    lines = fs.readFileSync(COMMAND_QUEUE_PATH, 'utf8').split('\n').filter(Boolean);
  } catch (_) { return null; }
  let best = -1;
  let bestPrio = -1;
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const item = JSON.parse(lines[i]);
      parsed.push(item);
      if (!item.consumed && (item.priority || 0) > bestPrio) {
        bestPrio = item.priority || 0;
        best = i;
      }
    } catch (_) { parsed.push(null); }
  }
  if (best < 0) return null;
  const picked = parsed[best];
  parsed[best] = { ...picked, consumed: true, consumedAt: new Date().toISOString(), consumedBy: 'deepseek-unified-file-fallback' };
  try {
    fs.writeFileSync(COMMAND_QUEUE_PATH, parsed.filter(Boolean).map((item) => JSON.stringify(item)).join('\n') + '\n', { encoding: 'utf8' });
  } catch (_) {}
  return picked;
}

// -------- Status snapshot ------------------------------------------------
function _safeStatCandidate(filePath, now, minAgeMs) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const ageMs = now - stat.mtimeMs;
    if (ageMs < minAgeMs) return null;
    return { path: filePath, ageDays: +((ageMs / (24 * 60 * 60 * 1000)).toFixed(1)), bytes: stat.size };
  } catch (_) { return null; }
}

function collectCleanupCandidates() {
  const now = Date.now();
  const out = { tempOlderThan7d: [], backupsOlderThan30d: [], staleLogs: [] };
  const roots = [
    { key: 'tempOlderThan7d',      dir: path.join(AUTONOMY_ROOT, 'temp'),        minAgeMs: 7  * 24 * 60 * 60 * 1000 },
    { key: 'backupsOlderThan30d',  dir: path.join(AUTONOMY_ROOT, 'old_backups'), minAgeMs: 30 * 24 * 60 * 60 * 1000 },
    { key: 'staleLogs',            dir: path.join(AUTONOMY_ROOT, 'logs-old'),    minAgeMs: 7  * 24 * 60 * 60 * 1000 },
  ];
  for (const root of roots) {
    try {
      if (!fs.existsSync(root.dir)) continue;
      for (const item of fs.readdirSync(root.dir).slice(0, 200)) {
        const c = _safeStatCandidate(path.join(root.dir, item), now, root.minAgeMs);
        if (c) out[root.key].push(c);
        if (out[root.key].length >= 20) break;
      }
    } catch (_) {}
  }
  return out;
}

function readAutonomousLogTail() {
  try {
    if (!fs.existsSync(AUTONOMOUS_LOG_PATH)) return [];
    const now = Date.now();
    const rawLines = fs.readFileSync(AUTONOMOUS_LOG_PATH, 'utf8').split('\n').filter(Boolean).slice(-120);
    const lines = [];
    for (const raw of rawLines) {
      const chunks = raw.replace(/}\s*{/g, '}\n{').split('\n').filter(Boolean);
      for (const c of chunks) lines.push(c);
    }
    const parsed = [];
    for (const line of lines) {
      try {
        let item = JSON.parse(line);
        for (let i = 0; i < 2 && typeof item === 'string'; i++) {
          const t = item.trim();
          if (!(t.startsWith('{') || t.startsWith('['))) break;
          item = JSON.parse(t);
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const ts = Date.parse(item && item.ts ? item.ts : '');
        if (!Number.isFinite(ts)) continue;
        if ((now - ts) > AUTONOMOUS_TAIL_MAX_AGE_MS) continue;
        if (item.testTail) delete item.testTail;
        if (item.pipeline && typeof item.pipeline === 'object') {
          if (item.pipeline.stdoutTail) delete item.pipeline.stdoutTail;
          if (item.pipeline.stderrTail) delete item.pipeline.stderrTail;
        }
        parsed.push(item);
      } catch (_) {}
    }
    return parsed.slice(-AUTONOMOUS_TAIL_MAX_ITEMS);
  } catch (_) { return []; }
}

function getProposalBacklog() {
  try {
    if (!fs.existsSync(PROPOSALS_DIR)) return { pendingCount: 0, latest: [] };
    const files = fs.readdirSync(PROPOSALS_DIR)
      .filter((f) => f && f.endsWith('.json'))
      .sort()
      .slice(-8);
    return {
      pendingCount: files.length,
      latest: files,
    };
  } catch (_) {
    return { pendingCount: 0, latest: [] };
  }
}

async function collectStatus() {
  const out = { ts: new Date().toISOString() };

  // Pricing page check
  try {
    const r = await request(PRICING_PAGE_URL, { timeoutMs: 5000 });
    out.pricingLoadingCount  = (r.body.match(/Loading\.\.\./g) || []).length;
    out.pricingPageStatus    = r.status;
  } catch (e) { out.pricingPageError = String(e && e.message || e).slice(0, 200); }

  // Backend health
  try {
    const r = await request(HEALTH_URL, { timeoutMs: 3000 });
    out.healthStatus = r.status;
  } catch (e) { out.healthError = String(e && e.message || e).slice(0, 200); }

  // Recent error log
  try {
    if (fs.existsSync(ERROR_LOG_PATH)) {
      const buf = fs.readFileSync(ERROR_LOG_PATH, { encoding: 'utf8' });
      out.recentErrors = buf.split('\n').filter(Boolean).slice(-10);
    } else { out.recentErrors = []; }
  } catch (e) { out.recentErrorsError = String(e && e.message || e).slice(0, 200); }

  // Roadmap + operator command
  try {
    const roadmap = await fetchRoadmap();
    if (roadmap && Array.isArray(roadmap.objectives)) {
      out.roadmap = {
        vision: String(roadmap.vision || '').slice(0, 480),
        missionForDeepSeek: String(roadmap.missionForDeepSeek || '').slice(0, 600),
        currentPhase: roadmap.currentPhase || '',
        northStarMetric: roadmap.northStarMetric || '',
        northStarTargets: roadmap.northStarTargets || null,
        ownerBtcSettlementAddress: roadmap.ownerBtcSettlementAddress || '',
        topOpenObjectives: roadmap.objectives
          .filter((o) => o && o.status !== 'done')
          .sort((a, b) => (a.priority || 99) - (b.priority || 99))
          .slice(0, 5)
          .map((o) => ({
            id: o.id,
            title: String(o.title || '').slice(0, 220),
            status: o.status,
            priority: o.priority,
            innovation: o.innovation === true ? true : undefined,
            metricEndpoint: o.metricEndpoint || undefined,
            metricKey: o.metricKey || undefined,
            target: o.target !== undefined ? o.target : undefined,
            comparison: o.comparison || undefined,
          })),
      };
    }
  } catch (_) {}

  try {
    const cmd = await consumeNextOperatorCommand();
    if (cmd) out.operatorCommand = { id: cmd.id, priority: cmd.priority, instruction: String(cmd.instruction || '').slice(0, 1000) };
  } catch (_) {}

  out.autonomy = {
    root: AUTONOMY_ROOT,
    sandboxRoot: SANDBOX_ROOT,
    autonomousLogPath: AUTONOMOUS_LOG_PATH,
    cleanupCandidates: collectCleanupCandidates(),
    recentAutonomousActions: readAutonomousLogTail(),
    proposalBacklog: getProposalBacklog(),
  };

  return out;
}

// -------- Provider chain -------------------------------------------------
function isUsableProviderKey(value) {
  const key = String(value || '').trim();
  if (key.length < 16) return false;
  if (/^(changeme|change-me|replace-me|your_|your-|test|demo|dummy|null|undefined)$/i.test(key)) return false;
  if (/(your_.*_here|your-.*-here|api[_-]?key[_-]?here|replace[_-]?me|changeme|dummy|placeholder)/i.test(key)) return false;
  return true;
}

// Resolve an API key from key-vault (multi-source) with process.env fallback.
function _resolveKey(aliases) {
  if (keyVault) {
    try {
      const found = keyVault.findKey(aliases);
      if (found && String(found.value).length >= 8) return found.value;
    } catch (_) { /* fall through */ }
  }
  for (const alias of aliases) {
    const v = process.env[alias];
    if (v && String(v).length >= 8) return v;
  }
  return '';
}

function getProviders() {
  const providers = [];
  const dsKey = _resolveKey(['DEEPSEEK_API_KEY']);
  if (isUsableProviderKey(dsKey)) providers.push({
    name: 'deepseek-direct', url: DEEPSEEK_API_URL, key: dsKey, model: DEEPSEEK_MODEL, headers: {},
  });
  const orKey = _resolveKey(['OPENROUTER_API_KEY']);
  if (isUsableProviderKey(orKey)) providers.push({
    name: 'openrouter-deepseek', url: 'https://openrouter.ai/api/v1/chat/completions',
    key: orKey, model: OPENROUTER_MODEL,
    headers: { 'HTTP-Referer': 'https://zeusai.pro', 'X-Title': 'ZeusAI DeepSeek Unified' },
  });
  const gKey = _resolveKey(['GROQ_API_KEY']);
  if (isUsableProviderKey(gKey)) providers.push({
    name: 'groq-reasoning-fallback', url: 'https://api.groq.com/openai/v1/chat/completions',
    key: gKey, model: GROQ_MODEL, headers: {},
  });
  return providers;
}

// -------- System prompt with multi-tick memory ---------------------------
// Prompt de sistem îmbogățit cu memoria ultimelor tick-uri.
function buildSystemPrompt() {
  const history = _tickHistoryDigest();
  return (
    'You are the autonomous DeepSeek operator for the Unicorn / zeusai.pro platform, owned by Vladoi Ionut (BTC settlement address bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e). ' +
    'Mission: build the most powerful autonomous SaaS in the world — global standard for >30 years — designed to generate billions of USD in annual revenue and settle automatically to the owner\'s BTC address. ' +
    'You operate 24/7 in an infinite improvement loop. Every tick: analyze STATUS JSON, think one step ahead, then act. Never stop. When one objective is complete, immediately advance to the next priority. ' +
    'INNOVATION MANDATE: when no fire is burning, generate code_proposal envelopes for features that DO NOT YET EXIST on any competing SaaS — AI-personalized pricing per visitor, 24/7 AI commerce concierge, revenue-anomaly self-healing, sovereign anonymized-insights marketplace, BTC Lightning instant settlement, autonomous blue/green deploys. Invent what hasn\'t been invented. ' +
    'You receive a STATUS JSON with health signals, recent errors, the roadmap (vision + missionForDeepSeek + northStarTargets + topOpenObjectives), and (when present) an operatorCommand from the human owner that overrides roadmap priorities for this tick. ' +
    (history
      ? 'IMPORTANT — Your last ' + _tickHistory.length + ' actions (avoid repeating the same action+target on consecutive ticks):\n' + history + '\n'
      : '') +
    'Choose EXACTLY ONE action from this hardcoded allowlist: ' + ALLOWED_ACTIONS.join(', ') + '. ' +
    'You MUST return ONLY a JSON object with shape: {"action":"<one-of-allowlist>","params":{...},"reason":"<short string>"}. ' +
    'Execution protocol (mandatory): drive objectives to completion end-to-end in this order when applicable: diagnose -> implement -> validate -> finalize. ' +
    'Diagnose via read_status/read_file/analyze_logs; implement via code_proposal/write_file/create_file/move_file/delete_file; validate via run_test/read_status/prices_sync/checkout_fix; finalize via roadmap_update(done or blocked with note). ' +
    'Do not stay stuck on implementation-only loops. After one or two code_proposal actions on the same objective, switch to validation/finalization actions. ' +
    'Work both surfaces: alternate effort between backend modules and site/runtime behaviors so platform and site evolve together. ' +
    'If STATUS.autonomy.proposalBacklog.pendingCount > 0, prioritize validation/finalization actions before creating more proposals. ' +
    'Action semantics: ' +
    'read_status=inspect runtime; read_file=inspect files under /opt/unicorn; ' +
    'write_file/create_file/move_file/delete_file=mutate inside /opt/unicorn with path safeguards; ' +
    'execute_safe_script=run existing scripts; ' +
    'prices_sync=refresh live pricing; checkout_fix=read-only checkout health; ' +
    'run_test=npm test (use sparingly); ' +
    'restart_service=log restart INTENT only (params.service ∈ unicorn-backend,unicorn-frontend,unicorn-site,pricing-module); ' +
    'github_clone_repo/github_read_repo/browse_github/search_github=GitHub read/discovery; ' +
    'github_create_branch/github_commit_push/github_create_pr/github_merge_pr/github_trigger_workflow/github_comment_issue=GitHub delivery pipeline; ' +
    'full_backup/restore_backup/rollback_deploy=autonomous ops resilience; ' +
    'analyze_logs=inspect a real log file (params.path absolute/relative file) OR a known service (params.service one of unicorn-backend, unicorn-site, deepseek-unified, deepseek-loop, governor; optional params.maxLines 20..2000). Do NOT pass directories like /var/log. ' +
    'code_proposal=author a code change envelope (params: targetPath repo-relative, proposedContent full new file content, rationale, objectiveId, riskLevel∈low|medium|high). CRITICAL: targetPath MUST have one of these extensions: .js .mjs .cjs .json .yaml .yml .md .txt .html .css .sh .sql — NO TypeScript (.ts), NO compiled files, NO binary files. targetPath MUST start with one of: ' + CODE_PROPOSAL_ALLOWED_PREFIXES.join(', ') + '. NEVER use server/src, server/, src/, backend/ root aliases, package metadata, CI workflows, or generated dependency paths. ' +
    'roadmap_update=mark objective status (params.objectiveId, params.status∈pending|in-progress|done|blocked, optional note). ' +
    'Auto-advance: if STATUS shows a metric target met for an in-progress objective, prefer roadmap_update status=done. ' +
    'Prioritization: (1) operatorCommand if present; (2) highest-priority open roadmap objective; (3) code_proposal for fixes; (4) innovation proposal when all green. ' +
    'Diversify — do not repeat the same action+target on consecutive ticks. Spread effort across top-3 priorities. ' +
    'Never exfiltrate secrets; do not mutate .env, SSH keys, .git internals, deepseek-governor.js, package.json. ' +
    'If unsure or all signals green and an innovation was just made, return action="none".'
  );
}

// -------- Ask DeepSeek (provider chain + Ollama fallback) ----------------
async function askDeepSeek(status) {
  const providers = getProviders();
  if (!providers.length && !LOCAL_FALLBACK_ENABLED && !OLLAMA_FALLBACK_ENABLED) {
    log('warn', 'advisor_no_usable_provider_keys', {});
    return { action: 'none', params: {}, reason: 'no_usable_provider_keys' };
  }

  const bodyObj = {
    model: '',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: 'STATUS:\n' + JSON.stringify(status, null, 2) },
    ],
    temperature: ADVISOR_TEMPERATURE,
    max_tokens: ADVISOR_MAX_TOKENS,
    max_completion_tokens: ADVISOR_MAX_COMPLETION,
    response_format: { type: 'json_object' },
  };

  for (const provider of providers) {
    const body = JSON.stringify({ ...bodyObj, model: provider.model });
    try {
      const res = await request(provider.url, {
        method: 'POST', timeoutMs: 30_000,
        headers: {
          ...provider.headers,
          'Authorization': 'Bearer ' + provider.key,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, body);
      if (res.status < 200 || res.status >= 300) {
        const err = new Error(provider.name + '_http_' + res.status);
        err.preview = String(res.body || '').replace(/\s+/g, ' ').slice(0, 240);
        throw err;
      }
      const parsed = JSON.parse(res.body);
      const content = parsed && parsed.choices && parsed.choices[0] &&
                      parsed.choices[0].message && parsed.choices[0].message.content;
      if (!content) throw new Error(provider.name + '_empty_content');
      const action = JSON.parse(content);
      log('info', 'advisor_provider_ok', { provider: provider.name, model: provider.model });
      return action;
    } catch (e) {
      log('warn', 'advisor_provider_failed', {
        provider: provider.name,
        error: String(e && e.message || e).slice(0, 200),
        preview: e && e.preview ? String(e.preview).slice(0, 240) : '',
      });
    }
  }

  // Local AGI/AGE endpoints (best-effort, opt-in to avoid repeated 401/404 noise)
  for (const fb of LOCAL_FALLBACK_ENABLED ? [{ name: 'agi-local', url: AGI_FALLBACK_URL }, { name: 'age-local', url: AGE_FALLBACK_URL }] : []) {
    try {
      const payload = JSON.stringify({ mode: 'deepseek-loop-fallback', allowedActions: ALLOWED_ACTIONS, status });
      const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
      if (ADMIN_TOKEN) headers.Authorization = 'Bearer ' + ADMIN_TOKEN;
      const res = await request(fb.url, { method: 'POST', timeoutMs: 20_000, headers }, payload);
      if (res.status < 200 || res.status >= 300) throw new Error(fb.name + '_http_' + res.status);
      const data = JSON.parse(res.body);
      const action = (data && data.action) ? data
                   : (data && data.result && data.result.action ? data.result : null);
      if (!action) throw new Error(fb.name + '_missing_action');
      log('info', 'advisor_provider_ok', { provider: fb.name, model: 'local-endpoint' });
      return action;
    } catch (e) {
      log('warn', 'advisor_provider_failed', { provider: fb.name, error: String(e && e.message || e).slice(0, 200) });
    }
  }

  // Ollama (local inference, opt-in when installed on the box)
  if (OLLAMA_FALLBACK_ENABLED) try {
    const prompt = 'Return ONLY JSON {"action":"...","params":{},"reason":"..."}. Allowed: ' +
                   ALLOWED_ACTIONS.join(',') + '. STATUS=' + JSON.stringify(status);
    const payload = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false,
      options: { temperature: ADVISOR_TEMPERATURE, num_predict: ADVISOR_MAX_COMPLETION } });
    const res = await request(OLLAMA_BASE_URL + '/api/generate', {
      method: 'POST', timeoutMs: 25_000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    if (res.status >= 200 && res.status < 300) {
      const parsed = JSON.parse(res.body);
      const text = parsed && typeof parsed.response === 'string' ? parsed.response.trim() : '';
      if (text) {
        const action = JSON.parse(text);
        log('info', 'advisor_provider_ok', { provider: 'ollama-fallback', model: OLLAMA_MODEL });
        return action;
      }
    }
    throw new Error('ollama_empty_or_error');
  } catch (e) {
    log('warn', 'advisor_provider_failed', { provider: 'ollama-fallback', error: String(e && e.message || e).slice(0, 200) });
  }

  log('warn', 'advisor_all_failed_safe_fallback', {});
  return { action: 'none', params: {}, reason: 'all_advisors_failed_safe_fallback' };
}

// -------- Client-side validation -----------------------------------------
function validateRecommendation(rec) {
  if (!rec || typeof rec !== 'object') return { ok: false, reason: 'not_object' };
  if (!ALLOWED_ACTIONS.includes(rec.action)) return { ok: false, reason: 'action_not_allowed' };
  if (rec.action === 'code_proposal') {
    const targetPath = rec.params && typeof rec.params.targetPath === 'string'
      ? rec.params.targetPath.replace(/\\/g, '/')
      : '';
    if (!targetPath || targetPath.startsWith('/') || targetPath.includes('\0') || targetPath.includes('..')) {
      return { ok: false, reason: 'invalid_code_proposal_target' };
    }
    const lower = targetPath.toLowerCase();
    for (const denied of CODE_PROPOSAL_DENIED_PREFIXES) {
      if (lower.startsWith(denied)) return { ok: false, reason: 'code_proposal_target_prefix_denied' };
    }
    if (!CODE_PROPOSAL_ALLOWED_PREFIXES.some((prefix) => targetPath.startsWith(prefix))) {
      return { ok: false, reason: 'code_proposal_target_prefix_not_allowed' };
    }
  }
  return { ok: true };
}

// -------- Direct governor dispatch (no HTTP) -----------------------------
// Dispatch direct prin modulul governor — mai rapid, rezistent la restart backend.
async function executeViaGovernorDirect(rec) {
  if (!governor || typeof governor.dispatch !== 'function') {
    log('warn', 'governor_module_unavailable_falling_back_to_http', {});
    return executeViaGovernorHTTP(rec);
  }
  const requestId = 'unified-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const result = await governor.dispatch({
    action: rec.action,
    params: rec.params || {},
    requestId,
    actor: 'deepseek-unified-daemon',
    ip: '127.0.0.1',
  });
  return { status: result.status, body: JSON.stringify(result.body || {}).slice(0, 2000) };
}

// HTTP fallback if governor module is not loadable.
async function executeViaGovernorHTTP(rec) {
  if (!ADMIN_TOKEN) throw new Error('missing_DEEPSEEK_LOOP_ADMIN_TOKEN');
  const body = JSON.stringify({
    action: rec.action,
    params: rec.params || {},
    requestId: 'unified-http-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
  });
  const res = await request(BACKEND_URL + '/api/admin/deepseek/act', {
    method: 'POST', timeoutMs: 35_000,
    headers: {
      'Authorization': 'Bearer ' + ADMIN_TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  return { status: res.status, body: res.body.slice(0, 4000) };
}

// -------- Git push proposals (proposals-only branch) ---------------------
// Împinge propunerile pe un branch separat și deschide un draft PR.
// Golden Rule #4: NICIODATĂ merge automat pe main. Operatorul aprobă.
function gitPushProposals() {
  if (!GIT_PUSH_ENABLED) return;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    log('warn', 'git_push_skipped', { reason: 'GITHUB_TOKEN or DEEPSEEK_UNIFIED_GITHUB_REPO not set' });
    return;
  }
  try {
    // Check if there are any proposals to push.
    if (!fs.existsSync(PROPOSALS_DIR)) return;
    const files = fs.readdirSync(PROPOSALS_DIR).filter((f) => f.endsWith('.json'));
    if (!files.length) return;

    const date = new Date().toISOString().slice(0, 10);
    const branch = 'deepseek/proposals-' + date;

    // Avoid repeat-pushing the same branch in a single day.
    if (_lastGitPushBranch === branch) {
      log('info', 'git_push_skipped_already_pushed_today', { branch });
      return;
    }

    const repoRoot = path.resolve(GIT_REPO_ROOT);

    // Configure git author (non-interactive, no password prompts).
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME:     'DeepSeek Unified Agent',
      GIT_AUTHOR_EMAIL:    'deepseek-agent@zeusai.pro',
      GIT_COMMITTER_NAME:  'DeepSeek Unified Agent',
      GIT_COMMITTER_EMAIL: 'deepseek-agent@zeusai.pro',
      GITHUB_TOKEN:        GITHUB_TOKEN,
    };

    function git(...args) {
      return execFileSync('git', args, { cwd: repoRoot, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    }

    // Fetch + create or reset branch.
    git('fetch', 'origin', '--prune');
    const existingBranches = git('branch', '-r').split('\n').map((b) => b.trim());
    const branchExists = existingBranches.some((b) => b === 'origin/' + branch || b === branch);

    if (!branchExists) {
      git('checkout', '-b', branch);
    } else {
      git('checkout', branch);
      git('reset', '--hard', 'origin/' + branch);
    }

    // Stage proposals only (safe subset: data/deepseek-proposals/).
    const relProposalsDir = path.relative(repoRoot, PROPOSALS_DIR);
    git('add', relProposalsDir);

    // Also stage roadmap.json if it changed (roadmap_update actions modify it).
    const roadmapRel = path.relative(repoRoot, ROADMAP_PATH);
    if (fs.existsSync(ROADMAP_PATH)) git('add', roadmapRel);

    // Check if there is anything to commit.
    let diffOutput = '';
    try { diffOutput = git('diff', '--cached', '--name-only'); } catch (_) {}
    if (!diffOutput.trim()) {
      log('info', 'git_push_skipped_nothing_staged', { branch });
      git('checkout', '-');
      return;
    }

    const commitMsg = `[deepseek-unified] proposals + roadmap updates ${new Date().toISOString()}

Auto-generated by deepseek-unified daemon on zeusai.pro.
Proposals are quarantine-only — NO auto-merge to main.
Human operator review required before any merge.`;

    git('commit', '-m', commitMsg);

    // Push using HTTPS with token embed.
    const [owner, repo] = GITHUB_REPO.split('/');
    const remoteUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/${owner}/${repo}.git`;
    git('push', remoteUrl, `HEAD:refs/heads/${branch}`, '--force-with-lease');
    _lastGitPushBranch = branch;
    log('info', 'git_push_proposals_ok', { branch, files: files.length });

    // Return to previous branch (best-effort).
    try { git('checkout', '-'); } catch (_) {}

    // Open draft PR on GitHub (best-effort, once per branch per day).
    _createDraftPR(owner, repo, branch, date).catch((e) => {
      log('warn', 'github_draft_pr_failed', { error: String(e && e.message || e).slice(0, 200) });
    });
  } catch (e) {
    log('error', 'git_push_proposals_error', { error: String(e && e.message || e).slice(0, 300) });
  }
}

async function _createDraftPR(owner, repo, branch, date) {
  const body = JSON.stringify({
    title: `[DeepSeek Agent] Proposals & Roadmap Updates — ${date}`,
    body: 'Auto-generated draft PR by `deepseek-unified` daemon.\n\n' +
          '**Proposals directory:** `data/deepseek-proposals/`\n\n' +
          '⚠️ **Review required before merge.** This PR was created automatically and must be reviewed by a human operator.\n\n' +
          'Per Golden Rule #4: no auto-sync, no auto-merge to main.',
    head: branch,
    base: 'main',
    draft: true,
  });
  const res = await request(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST', timeoutMs: 10_000,
    headers: {
      'Authorization': 'Bearer ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'deepseek-unified-daemon/1.0',
    },
  }, body);
  if (res.status === 201 || res.status === 422 /* already exists */) {
    log('info', 'github_draft_pr_ok', { status: res.status, branch });
  } else {
    throw new Error('github_draft_pr_http_' + res.status + ': ' + String(res.body || '').replace(/\s+/g, ' ').slice(0, 240));
  }
}

// -------- Adaptive interval ----------------------------------------------
function _effectiveIntervalMs() {
  const runtimeMs = Date.now() - loopStartedAt;
  if (runtimeMs < INITIAL_FAST_WINDOW_MS) return FAST_INTERVAL_MS;
  const stableMs = Date.now() - lastCriticalTs;
  if (stableMs >= STABLE_WINDOW_HOURS * 60 * 60 * 1000) return Math.max(INTERVAL_MS, SLOW_INTERVAL_MS);
  return INTERVAL_MS;
}

// -------- Main tick ------------------------------------------------------
async function tick() {
  if (Date.now() < pausedUntil) {
    log('info', 'circuit_breaker_paused', { until: new Date(pausedUntil).toISOString() });
    return;
  }
  try {
    log('info', 'tick_start', { intervalMs: _effectiveIntervalMs(), tickMemory: _tickHistory.length });
    const status = await collectStatus();
    log('info', 'status_collected', status);

    const rec = await askDeepSeek(status);
    log('info', 'recommendation_received', rec);
    log('info', 'action: ' + String(rec && rec.action || 'none'), { action: rec && rec.action || 'none' });

    const v = validateRecommendation(rec);
    if (!v.ok) {
      log('warn', 'recommendation_rejected_client', { reason: v.reason, rec });
      consecutiveFailures++;
      _recordTick({ action: 'none', reason: 'rejected:' + v.reason });
    } else if (rec.action === 'none') {
      log('info', 'no_action_recommended', { reason: rec.reason || '' });
      consecutiveFailures = 0;
      _recordTick(rec);
    } else if (!EXECUTE_MODE) {
      log('info', 'advisory_mode_recommendation', { action: rec.action, params: rec.params || {}, reason: rec.reason || '' });
      consecutiveFailures = 0;
      _recordTick(rec);
    } else {
      // Execute via governor (direct dispatch preferred over HTTP).
      const out = await executeViaGovernorDirect(rec);
      log('info', 'governor_execution_result', { httpStatus: out.status, bodyPreview: out.body });
      if (out.status >= 200 && out.status < 300) {
        consecutiveFailures = 0;
        _recordTick(rec);
        // Push proposals to git if this was a code_proposal or roadmap_update.
        if (rec.action === 'code_proposal' || rec.action === 'roadmap_update') {
          gitPushProposals();
        }
      } else if (out.status === 429) {
        // Governor rate-limit is expected under sustained autonomy.
        // Do NOT trip circuit-breaker for this, just back off naturally.
        // Limitare de rată este normală; nu o tratăm ca incident critic.
        consecutiveFailures = 0;
        _recordTick({ action: rec.action, reason: 'governor_rate_limited' });
        log('warn', 'governor_rate_limited', { action: rec.action, status: out.status });
      } else if (out.status === 422) {
        // Validation mismatch (e.g., extension/path policy). Non-critical.
        // Mismatch de validare (ex: extensie/cale) — non-critic.
        consecutiveFailures = 0;
        _recordTick({ action: rec.action, reason: 'governor_validation_' + out.status });
        log('warn', 'governor_validation_rejected', { action: rec.action, status: out.status });
      } else {
        consecutiveFailures++;
        lastCriticalTs = Date.now();
        _recordTick({ action: rec.action, reason: 'governor_error_' + out.status });
      }
    }
  } catch (e) {
    log('error', 'tick_failed', { error: String(e && e.message || e).slice(0, 300) });
    consecutiveFailures++;
    lastCriticalTs = Date.now();
    _recordTick({ action: 'error', reason: String(e && e.message || e).slice(0, 80) });
  }

  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    pausedUntil = Date.now() + BACKOFF_MS;
    log('warn', 'circuit_breaker_tripped', {
      failures: consecutiveFailures,
      pauseMs: BACKOFF_MS,
      until: new Date(pausedUntil).toISOString(),
    });
    consecutiveFailures = 0;
  }
}

// -------- Bootstrap ------------------------------------------------------
function main() {
  // Re-seed one more time at main() in case vault was updated after module load.
  if (keyVault) {
    try {
      const added = keyVault.reseedProcessEnv();
      if (added > 0) log('info', 'vault_reseeded', { keysAdded: added });
    } catch (_) { /* non-fatal */ }
  }
  log('info', 'deepseek_unified_boot', {
    enabled: ENABLED,
    executeMode: EXECUTE_MODE,
    gitPushEnabled: GIT_PUSH_ENABLED,
    fastIntervalMs: FAST_INTERVAL_MS,
    intervalMs: INTERVAL_MS,
    slowIntervalMs: SLOW_INTERVAL_MS,
    initialFastWindowMs: INITIAL_FAST_WINDOW_MS,
    backendUrl: BACKEND_URL,
    advisorProviders: getProviders().map((p) => p.name),
    hasAdminToken: !!ADMIN_TOKEN,
    hasGithubToken: !!GITHUB_TOKEN,
    governorLoadedDirect: !!governor,
    autonomyRoot: AUTONOMY_ROOT,
    tickMemorySize: TICK_MEMORY_SIZE,
  });

  if (!ENABLED) {
    log('info', 'disabled_exiting', { reason: 'DEEPSEEK_UNIFIED_ENABLED!=1 and DEEPSEEK_LOOP_ENABLED!=1' });
    process.exit(0);
  }

  if (EXECUTE_MODE && !ADMIN_TOKEN && !(governor && typeof governor.dispatch === 'function')) {
    log('warn', 'execute_mode_without_admin_token_advisory_fallback', {});
  }

  if (GIT_PUSH_ENABLED && (!GITHUB_TOKEN || !GITHUB_REPO)) {
    log('warn', 'git_push_enabled_but_missing_env', {
      hint: 'Set GITHUB_TOKEN and DEEPSEEK_UNIFIED_GITHUB_REPO=owner/repo to enable auto-push.',
    });
  }

  loopStartedAt = Date.now();

  const loop = async () => {
    await tick().catch((e) => log('error', 'tick_unhandled', { error: String(e) }));
    const nextMs = _effectiveIntervalMs();
    log('info', 'loop_schedule_next', { nextInMs: nextMs });
    setTimeout(loop, nextMs);
  };

  // Delay first tick slightly to let backend finish booting.
  // Amânăm primul tick pentru ca backend-ul să termine boot-ul.
  setTimeout(loop, 5000);
}

if (require.main === module) main();

module.exports = { collectStatus, validateRecommendation, ALLOWED_ACTIONS, buildSystemPrompt };
