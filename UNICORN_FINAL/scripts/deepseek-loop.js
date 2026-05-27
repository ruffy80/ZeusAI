#!/usr/bin/env node
// =====================================================================
// DeepSeek Advisory Loop — opt-in, non-root, advise-by-default
//
// What it does (en):
//   Every DEEPSEEK_LOOP_INTERVAL_MS (default 120s, min 30s) it:
//     1. Collects a lightweight status snapshot from the local backend
//        (NO shell, NO arbitrary file reads, NO secrets in payload).
//     2. Asks DeepSeek for a single recommended action drawn ONLY from
//        the governor's hardcoded allowlist.
//     3. Either logs the recommendation (default: advise-only) OR posts
//        it to the local /api/admin/deepseek/act endpoint, which itself
//        re-validates the action against the allowlist server-side.
//
// Safety envelope:
//   * Disabled by default. Requires DEEPSEEK_LOOP_ENABLED=1.
//   * Execute mode requires DEEPSEEK_LOOP_EXECUTE=1 AND
//     DEEPSEEK_LOOP_ADMIN_TOKEN to be set. Without both, the loop is
//     strictly advisory (writes to log only).
//   * Circuit breaker: 3 consecutive failures → 30 minute pause.
//   * No shell exec. No eval. No write of arbitrary files. No git/deploy.
//   * Server-side governor will reject anything outside its enum even if
//     this client is tampered with.
//   * Designed to run under a non-root systemd user (`unicorn`).
//
// Ce face (ro):
//   La fiecare DEEPSEEK_LOOP_INTERVAL_MS (implicit 120s), cere DeepSeek
//   o recomandare din lista albă a guvernorului. Implicit doar
//   loghează; execuția cere ambele flag-uri de mai sus.
//
// Per Golden Rule #4 this script is DEFAULT-OFF and must be enabled by
// a human operator. It is NEVER installed automatically by deploy.yml.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ADI-Core Key Vault — multi-source key resolution (env, vault file, .env,
// /etc/zeusai/secrets/, ~/.zeusai/keys.env). Graceful fallback if unavailable.
let keyVault;
try { keyVault = require('../backend/modules/adi-core/key-vault'); } catch (e) {
  keyVault = null;
  // Non-fatal: key-vault may be unavailable in dev; falls back to process.env.
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: 'key_vault_unavailable', extra: { error: String(e.message || e) } }) + '\n');
}

// Reseed process.env from all vault sources BEFORE reading any config constants.
// This ensures keys stored in .data/adi-core-keys.json, /etc/zeusai/secrets/*.env,
// ~/.zeusai/keys.env, or .env.local are visible to process.env.
if (keyVault) {
  try { keyVault.reseedProcessEnv(); } catch (_) { /* non-fatal */ }
}

const ENABLED                = String(process.env.DEEPSEEK_LOOP_ENABLED || '') === '1';
const EXECUTE_MODE           = String(process.env.DEEPSEEK_LOOP_EXECUTE || '') === '1';
const FAST_INTERVAL_MS       = Math.max(30_000, parseInt(process.env.DEEPSEEK_LOOP_FAST_INTERVAL_MS || '30000', 10));
const INTERVAL_MS            = Math.max(30_000, parseInt(process.env.DEEPSEEK_LOOP_INTERVAL_MS || '60000', 10));
const INITIAL_FAST_WINDOW_MS = Math.max(60_000, parseInt(process.env.DEEPSEEK_LOOP_FAST_WINDOW_MS || String(60 * 60 * 1000), 10));
const BACKOFF_MS             = parseInt(process.env.DEEPSEEK_LOOP_BACKOFF_MS || String(30 * 60 * 1000), 10);
const FAILURE_THRESHOLD      = parseInt(process.env.DEEPSEEK_LOOP_FAILURE_THRESHOLD || '3', 10);
const BACKEND_URL            = process.env.DEEPSEEK_LOOP_BACKEND_URL || 'http://127.0.0.1:3000';
const HEALTH_URL             = process.env.DEEPSEEK_LOOP_HEALTH_URL || (BACKEND_URL + '/health');
const PRICING_PAGE_URL       = process.env.DEEPSEEK_LOOP_PRICING_URL || 'https://zeusai.pro/pricing';
const DEEPSEEK_API_URL       = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY       = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL         = process.env.DEEPSEEK_MODEL || 'deepseek-reasoner';
const ADVISOR_TEMPERATURE    = Number.isFinite(Number(process.env.DEEPSEEK_LOOP_TEMPERATURE))
                             ? Number(process.env.DEEPSEEK_LOOP_TEMPERATURE)
                             : 0.0;
const ADVISOR_MAX_TOKENS     = Math.max(64, parseInt(process.env.DEEPSEEK_LOOP_MAX_TOKENS || '500', 10));
const ADVISOR_MAX_COMPLETION = Math.max(64, parseInt(process.env.DEEPSEEK_LOOP_MAX_COMPLETION_TOKENS || '200', 10));
const AGI_FALLBACK_URL       = process.env.DEEPSEEK_LOOP_AGI_URL || (BACKEND_URL + '/api/agi/process');
const AGE_FALLBACK_URL       = process.env.DEEPSEEK_LOOP_AGE_URL || (BACKEND_URL + '/api/age/act');
const OLLAMA_BASE_URL        = process.env.DEEPSEEK_LOOP_OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL           = process.env.DEEPSEEK_LOOP_OLLAMA_MODEL || 'llama3';
const STABLE_WINDOW_HOURS    = Math.max(1, parseInt(process.env.DEEPSEEK_LOOP_STABLE_WINDOW_HOURS || '24', 10));
const SLOW_INTERVAL_MS       = Math.max(60_000, parseInt(process.env.DEEPSEEK_LOOP_SLOW_INTERVAL_MS || '60000', 10));
const OPENROUTER_API_KEY     = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_DEEPSEEK_MODEL = process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-v4-flash:free';
const GROQ_API_KEY           = process.env.GROQ_API_KEY || '';
const GROQ_DEEPSEEK_MODEL    = process.env.GROQ_DEEPSEEK_MODEL || 'qwen/qwen3-32b';
const ADMIN_TOKEN            = process.env.DEEPSEEK_LOOP_ADMIN_TOKEN || '';
const LOG_PATH               = process.env.DEEPSEEK_LOOP_LOG_PATH
                             || path.join(__dirname, '..', 'data', 'logs', 'deepseek-loop.log');
const ERROR_LOG_PATH         = process.env.DEEPSEEK_LOOP_ERROR_LOG || '/var/log/unicorn/error.log';
const AUTONOMY_ROOT          = process.env.DEEPSEEK_LOOP_AUTONOMY_ROOT || '/opt/unicorn';
const SANDBOX_ROOT           = process.env.DEEPSEEK_LOOP_SANDBOX_ROOT || path.join(AUTONOMY_ROOT, 'sandbox');
const AUTONOMOUS_LOG_PATH    = process.env.DEEPSEEK_LOOP_ACTION_LOG || '/var/log/autonomous_actions.log';
const AUTONOMOUS_TAIL_MAX_AGE_MS = Math.max(60_000, parseInt(process.env.DEEPSEEK_LOOP_AUTONOMOUS_TAIL_MAX_AGE_MS || String(15 * 60 * 1000), 10));
const AUTONOMOUS_TAIL_MAX_ITEMS  = Math.max(1, Math.min(20, parseInt(process.env.DEEPSEEK_LOOP_AUTONOMOUS_TAIL_MAX_ITEMS || '4', 10)));
const ALLOWED_ACTIONS = [
  'none',
  'read_status',
  'read_file',
  'write_file',
  'create_file',
  'move_file',
  'delete_file',
  'execute_safe_script',
  'prices_sync',
  'checkout_fix',
  'run_test',
  'restart_service',
  'git_commit',
  'deploy',
  'github_clone_repo',
  'github_read_repo',
  'github_create_branch',
  'github_commit_push',
  'github_create_pr',
  'github_merge_pr',
  'github_trigger_workflow',
  'github_comment_issue',
  'merge_pr',
  'browse_github',
  'search_github',
  'full_backup',
  'restore_backup',
  'analyze_logs',
  'rollback_deploy',
  'code_proposal',
  'roadmap_update',
];

function _safeStatCandidate(filePath, now, minAgeMs) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const ageMs = now - stat.mtimeMs;
    if (ageMs < minAgeMs) return null;
    return {
      path: filePath,
      ageDays: +((ageMs / (24 * 60 * 60 * 1000)).toFixed(1)),
      bytes: stat.size,
    };
  } catch (_) {
    return null;
  }
}

function collectCleanupCandidates() {
  const now = Date.now();
  const out = {
    tempOlderThan7d: [],
    backupsOlderThan30d: [],
    staleLogs: [],
    duplicateLikeFiles: [],
    deadCodeCandidates: [],
  };
  const roots = [
    { key: 'tempOlderThan7d', dir: path.join(AUTONOMY_ROOT, 'temp'), minAgeMs: 7 * 24 * 60 * 60 * 1000 },
    { key: 'backupsOlderThan30d', dir: path.join(AUTONOMY_ROOT, 'old_backups'), minAgeMs: 30 * 24 * 60 * 60 * 1000 },
    { key: 'staleLogs', dir: path.join(AUTONOMY_ROOT, 'logs-old'), minAgeMs: 7 * 24 * 60 * 60 * 1000 },
  ];
  for (const root of roots) {
    try {
      if (!fs.existsSync(root.dir)) continue;
      const items = fs.readdirSync(root.dir).slice(0, 200);
      for (const item of items) {
        const candidate = _safeStatCandidate(path.join(root.dir, item), now, root.minAgeMs);
        if (candidate) out[root.key].push(candidate);
        if (out[root.key].length >= 20) break;
      }
    } catch (_) { /* best-effort */ }
  }
  try {
    // IMPORTANT: do not propose sandbox file deletions here.
    // Governor delete allowlist only permits /opt/unicorn/temp, /old_backups,
    // /logs-old. Surfacing sandbox *.bak files caused repeated 422 responses
    // and circuit-breaker pauses in execute mode.
    if (fs.existsSync(SANDBOX_ROOT)) {
      const deadCodePath = path.join(SANDBOX_ROOT, 'dead-code-candidates.json');
      if (fs.existsSync(deadCodePath)) {
        const parsed = JSON.parse(fs.readFileSync(deadCodePath, 'utf8'));
        if (Array.isArray(parsed)) out.deadCodeCandidates = parsed.slice(0, 20);
      }
    }
    out.duplicateLikeFiles = [];
  } catch (_) { /* best-effort */ }
  return out;
}

function readAutonomousLogTail() {
  try {
    if (!fs.existsSync(AUTONOMOUS_LOG_PATH)) return [];
    const now = Date.now();
    const rawLines = fs.readFileSync(AUTONOMOUS_LOG_PATH, 'utf8').split('\n').filter(Boolean).slice(-120);
    const lines = [];
    for (const raw of rawLines) {
      if (!raw) continue;
      // Some log writers occasionally concatenate JSON objects on one line: ...}{...
      // Split defensively so each chunk can be parsed independently.
      const chunks = raw.replace(/}\s*{/g, '}\n{').split('\n').filter(Boolean);
      for (const c of chunks) lines.push(c);
    }
    const parsed = [];
    for (const line of lines) {
      try {
        let item = JSON.parse(line);
        // Sometimes an outer JSON string wraps an inner JSON object.
        for (let i = 0; i < 2 && typeof item === 'string'; i += 1) {
          const t = item.trim();
          if (!(t.startsWith('{') || t.startsWith('[') || t.startsWith('"{'))) break;
          item = JSON.parse(t);
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

        const ts = Date.parse(item && item.ts ? item.ts : '');
        if (!Number.isFinite(ts)) continue;
        if ((now - ts) > AUTONOMOUS_TAIL_MAX_AGE_MS) continue;

        // Keep the advisor payload compact: remove large tails that can
        // continuously re-surface stale failures from older executions.
        // Păstrăm context compact: eliminăm tail-urile mari/stale.
        if (item.testTail) delete item.testTail;
        if (item.pipeline && typeof item.pipeline === 'object') {
          if (item.pipeline.stdoutTail) delete item.pipeline.stdoutTail;
          if (item.pipeline.stderrTail) delete item.pipeline.stderrTail;
        }
        parsed.push(item);
      } catch (_) {
        // Ignore malformed lines silently.
      }
    }
    return parsed.slice(-AUTONOMOUS_TAIL_MAX_ITEMS);
  } catch (_) {
    return [];
  }
}

// Roadmap + operator-command fetch (best-effort; failures don't break the loop).
// Roadmap + comenzi-operator (best-effort; eșecurile nu opresc loop-ul).
async function fetchRoadmap() {
  if (!ADMIN_TOKEN) return null;
  try {
    const res = await request(BACKEND_URL + '/api/admin/roadmap', {
      timeoutMs: 5000,
      headers: { 'Authorization': 'Bearer ' + ADMIN_TOKEN },
    });
    if (res.status < 200 || res.status >= 300) return null;
    return JSON.parse(res.body);
  } catch (_) { return null; }
}

async function consumeNextOperatorCommand() {
  if (!ADMIN_TOKEN) return null;
  try {
    const res = await request(BACKEND_URL + '/api/admin/deepseek/command/consume', {
      method: 'POST',
      timeoutMs: 5000,
      headers: { 'Authorization': 'Bearer ' + ADMIN_TOKEN, 'Content-Length': '0' },
    });
    if (res.status === 204) return null;
    if (res.status < 200 || res.status >= 300) return null;
    const j = JSON.parse(res.body);
    return j && j.command ? j.command : null;
  } catch (_) { return null; }
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

function getAdvisorProviders() {
  const providers = [];
  const dsKey = _resolveKey(['DEEPSEEK_API_KEY']);
  if (dsKey) {
    providers.push({
      name: 'deepseek-direct',
      url: DEEPSEEK_API_URL,
      key: dsKey,
      model: DEEPSEEK_MODEL,
      headers: {},
    });
  }
  const orKey = _resolveKey(['OPENROUTER_API_KEY']);
  if (orKey) {
    providers.push({
      name: 'openrouter-deepseek',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey,
      model: OPENROUTER_DEEPSEEK_MODEL,
      headers: {
        'HTTP-Referer': 'https://zeusai.pro',
        'X-Title': 'ZeusAI DeepSeek Loop',
      },
    });
  }
  const gKey = _resolveKey(['GROQ_API_KEY']);
  if (gKey) {
    providers.push({
      name: 'groq-reasoning-fallback',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: gKey,
      model: GROQ_DEEPSEEK_MODEL,
      headers: {},
    });
  }
  return providers;
}

// ---------- Logging ----------
function ensureLogDir() {
  try { fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true }); } catch (_) {}
}
function log(level, msg, extra) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(extra ? { extra } : {}) };
  const line = JSON.stringify(entry);
  try { ensureLogDir(); fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) {}
  // mirror to stdout so journalctl picks it up
  // oglindă în stdout pentru journalctl
  process.stdout.write(line + '\n');
}

// ---------- Tiny HTTP client (no extra deps) ----------
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
      res.on('end', () => {
        const buf = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, headers: res.headers, body: buf });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('request_timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- Status snapshot ----------
async function collectStatus() {
  const out = { ts: new Date().toISOString() };
  // pricing page Loading count
  try {
    const r = await request(PRICING_PAGE_URL, { timeoutMs: 5000 });
    const matches = (r.body.match(/Loading\.\.\./g) || []).length;
    out.pricingLoadingCount = matches;
    out.pricingPageStatus = r.status;
  } catch (e) {
    out.pricingPageError = String(e && e.message || e).slice(0, 200);
  }
  // backend health
  try {
    const r = await request(HEALTH_URL, { timeoutMs: 3000 });
    out.healthStatus = r.status;
  } catch (e) {
    out.healthError = String(e && e.message || e).slice(0, 200);
  }
  out.unicornWorkstreams = {
    primary: 'full-stack-autonomy',
    focusAreas: ['unicorn-server-and-backend', 'public-site-and-pricing'],
    executionMode: 'balanced-equal-priority',
    backendUrl: BACKEND_URL,
    autonomyRoot: AUTONOMY_ROOT,
  };
  // last 10 error log lines (best-effort, read-only)
  try {
    if (fs.existsSync(ERROR_LOG_PATH)) {
      const buf = fs.readFileSync(ERROR_LOG_PATH, { encoding: 'utf8' });
      out.recentErrors = buf.split('\n').filter(Boolean).slice(-10);
    } else {
      out.recentErrors = [];
    }
  } catch (e) {
    out.recentErrorsError = String(e && e.message || e).slice(0, 200);
  }
  // Goal-directed context: roadmap top-priority open objectives + queued op cmd.
  // Context goal-directed: obiective prioritare deschise + comandă operator.
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
          .filter(o => o && o.status !== 'done')
          .sort((a, b) => (a.priority || 99) - (b.priority || 99))
          .slice(0, 5)
          .map(o => ({
            id: o.id,
            title: String(o.title || '').slice(0, 220),
            status: o.status,
            priority: o.priority,
            innovation: o.innovation === true ? true : undefined,
            metricEndpoint: o.metricEndpoint || undefined,
            metricKey: o.metricKey || undefined,
            target: (o.target !== undefined ? o.target : undefined),
            comparison: o.comparison || undefined,
          })),
      };
    }
  } catch (_) { /* best-effort */ }
  try {
    const cmd = await consumeNextOperatorCommand();
    if (cmd) {
      out.operatorCommand = {
        id: cmd.id,
        priority: cmd.priority,
        instruction: String(cmd.instruction || '').slice(0, 1000),
      };
    }
  } catch (_) { /* best-effort */ }
  out.autonomy = {
    root: AUTONOMY_ROOT,
    sandboxRoot: SANDBOX_ROOT,
    autonomousLogPath: AUTONOMOUS_LOG_PATH,
    cleanupCandidates: collectCleanupCandidates(),
    recentAutonomousActions: readAutonomousLogTail(),
  };
  out.workMode = {
    name: 'efficient-full-stack',
    primaryFocus: ['unicorn-server-and-backend', 'public-site-and-pricing'],
    minimizeRepeatedDiagnosis: true,
    preferImplementationWhenClear: true,
  };
  return out;
}

// ---------- DeepSeek call ----------
async function askDeepSeek(status) {
  const providers = getAdvisorProviders();
  if (!providers.length) throw new Error('missing_deepseek_advisor_provider_key');
  const systemPrompt =
    'You are the autonomous DeepSeek operator for the Unicorn server/backend and the zeusai.pro platform, owned by Vladoi Ionut (BTC settlement address bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e). ' +
    'Mission: run the Unicorn server/backend and the public site as one full-stack organism, keep both healthy, then build the most powerful autonomous SaaS in the world — global standard for >30 years — designed to generate billions of USD in annual revenue and settle automatically to the owner\'s BTC address. ' +
    'You operate 24/7 in an infinite improvement loop with maximum allowed autonomy. Every tick: analyze the STATUS JSON, think one step ahead, then act. Never stop. When one objective is complete, immediately advance to the next priority. ' +
    'Priority zero is balanced production stability: never trade away Unicorn backend reliability, and never ignore the public site, pricing, or conversion paths. ' +
    'EFFICIENCY MANDATE: be decisive and avoid repetitive diagnosis. If STATUS is already clear and no fresh error is present, do not spend a tick on read_status again; move to implementation, validation, or a code_proposal that advances an open objective. ' +
    'One useful action beats several passive checks. Prefer actions that change the system or close an objective, and only inspect again when that inspection will change the next move. ' +
    'INNOVATION MANDATE: when no fire is burning, generate code_proposal envelopes for features that DO NOT YET EXIST on any competing SaaS — AI-personalized pricing per visitor, 24/7 AI commerce concierge, revenue-anomaly self-healing, sovereign anonymized-insights marketplace, BTC Lightning instant settlement, autonomous blue/green deploys. Invent what hasn\'t been invented. ' +
    'You receive a STATUS JSON containing health signals, recent errors, the roadmap of open objectives (vision + missionForDeepSeek + northStarTargets + topOpenObjectives), ' +
    'and (when present) an operatorCommand from the human owner that overrides roadmap priorities for this tick. ' +
    'Choose EXACTLY ONE action from this hardcoded allowlist: ' +
    ALLOWED_ACTIONS.join(', ') + '. ' +
    'You MUST return ONLY a JSON object with shape: ' +
    '{"action":"<one-of-allowlist>","params":{...},"reason":"<short string>"}. ' +
    'Action semantics: ' +
    'read_status = inspect runtime; read_file = inspect files under /opt/unicorn with protected-path filtering; ' +
    'write_file/create_file/move_file/delete_file = mutate inside /opt/unicorn with intelligent protected-path safeguards; ' +
    'execute_safe_script = run existing scripts under /opt/unicorn with explicit args array; ' +
    'prices_sync = refresh live pricing broker; checkout_fix = read-only checkout health; ' +
    'run_test = execute npm test (use sparingly); ' +
    'restart_service = log restart INTENT only (params.service ∈ unicorn-backend, unicorn-frontend, unicorn-site, pricing-module); ' +
    'github_clone_repo = clone repository into /opt/unicorn/contrib; github_read_repo/browse_github/search_github = GitHub read/discovery; ' +
    'github_create_branch/github_commit_push/github_create_pr/github_merge_pr/github_trigger_workflow/github_comment_issue = GitHub delivery pipeline actions; ' +
    'full_backup/restore_backup/analyze_logs/rollback_deploy = autonomous ops resilience actions; ' +
    'code_proposal = author a code change envelope (params: targetPath repo-relative, proposedContent full new file content, rationale, objectiveId, riskLevel ∈ low|medium|high). Envelopes are quarantined for human/CI review — never applied automatically. Aim for small, focused, audit-friendly diffs. ' +
    'Never exfiltrate secrets; do not mutate protected files (.env, SSH keys, .git internals) unless explicitly confirmed in params.confirm=true for irreversible operations. ' +
    'roadmap_update = mark an objective status (params.objectiveId, params.status ∈ pending|in-progress|done|blocked, optional note). ' +
    'Prefer delete_file only when STATUS.autonomy.cleanupCandidates lists the target or when removing stale temp/backup/log files. ' +
    'Use SANDBOX insight from STATUS.autonomy before risky changes. ' +
    'Auto-advance rule: if STATUS shows a metric target met for an in-progress objective (compare metricKey against target via comparison), prefer roadmap_update status=done so the loop moves to the next priority on the next tick. ' +
    'Prioritization rules: (1) if operatorCommand is present, address it first; (2) otherwise pick the highest-priority open objective from roadmap.topOpenObjectives and act toward it; (3) prefer implementation or code_proposal when the objective is clear, and use read_status / read_file only when they unlock the next step; (4) when everything is green, generate an innovation code_proposal toward an `innovation: true` objective. ' +
    'Diversify: do not repeat the same action+target on consecutive ticks. Spread effort across the top-3 priorities and keep both server and site moving forward. ' +
    'If unsure or all signals are green and an innovation proposal was just made, return action="none". Never invent actions outside the allowlist.';
  const userPrompt = 'STATUS:\n' + JSON.stringify(status, null, 2);
  let lastError = null;
  for (const provider of providers) {
    const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ADVISOR_TEMPERATURE,
    max_tokens: ADVISOR_MAX_TOKENS,
    max_completion_tokens: ADVISOR_MAX_COMPLETION,
    response_format: { type: 'json_object' },
  });
    try {
      const res = await request(provider.url, {
        method: 'POST',
        timeoutMs: 30_000,
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
      let parsed;
      try { parsed = JSON.parse(res.body); } catch (e) { throw new Error(provider.name + '_non_json'); }
      const content = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
      if (!content) throw new Error(provider.name + '_empty_content');
      let action;
      try { action = JSON.parse(content); } catch (e) { throw new Error(provider.name + '_content_non_json'); }
      log('info', 'advisor_provider_ok', { provider: provider.name, model: provider.model });
      return action;
    } catch (e) {
      lastError = e;
      log('warn', 'advisor_provider_failed', {
        provider: provider.name,
        error: String(e && e.message || e).slice(0, 200),
        preview: e && e.preview ? String(e.preview).slice(0, 240) : '',
      });
    }
  }

  // Local AGI/AGE fallback endpoints.
  // Fallback local AGI/AGE.
  const localFallbacks = [
    { name: 'agi-local', url: AGI_FALLBACK_URL },
    { name: 'age-local', url: AGE_FALLBACK_URL },
  ];
  for (const fb of localFallbacks) {
    try {
      const payload = JSON.stringify({
        mode: 'deepseek-loop-fallback',
        allowedActions: ALLOWED_ACTIONS,
        status,
      });
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      };
      if (ADMIN_TOKEN) headers.Authorization = 'Bearer ' + ADMIN_TOKEN;
      const res = await request(fb.url, {
        method: 'POST',
        timeoutMs: 20_000,
        headers,
      }, payload);
      if (res.status < 200 || res.status >= 300) {
        const err = new Error(fb.name + '_http_' + res.status);
        err.preview = String(res.body || '').replace(/\s+/g, ' ').slice(0, 240);
        throw err;
      }
      let data;
      try { data = JSON.parse(res.body); } catch (_) { throw new Error(fb.name + '_non_json'); }
      const action = (data && typeof data === 'object' && data.action)
        ? data
        : (data && data.result && typeof data.result === 'object' && data.result.action ? data.result : null);
      if (!action || typeof action !== 'object') throw new Error(fb.name + '_missing_action');
      log('info', 'advisor_provider_ok', { provider: fb.name, model: 'local-endpoint' });
      return action;
    } catch (e) {
      lastError = e;
      log('warn', 'advisor_provider_failed', {
        provider: fb.name,
        error: String(e && e.message || e).slice(0, 200),
        preview: e && e.preview ? String(e.preview).slice(0, 240) : '',
      });
    }
  }

  // Ollama fallback (local inference, lightweight tasks only).
  // Fallback Ollama local.
  try {
    const prompt =
      'Return ONLY JSON with shape {"action":"...","params":{},"reason":"..."}. ' +
      'Allowed actions: ' + ALLOWED_ACTIONS.join(', ') + '. ' +
      'Prefer none if uncertain. STATUS=' + JSON.stringify(status);
    const payload = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: ADVISOR_TEMPERATURE,
        num_predict: ADVISOR_MAX_COMPLETION,
      },
    });
    const res = await request(OLLAMA_BASE_URL + '/api/generate', {
      method: 'POST',
      timeoutMs: 25_000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);
    if (res.status >= 200 && res.status < 300) {
      let parsed;
      try { parsed = JSON.parse(res.body); } catch (_) { parsed = null; }
      const text = parsed && typeof parsed.response === 'string' ? parsed.response.trim() : '';
      if (text) {
        const action = JSON.parse(text);
        log('info', 'advisor_provider_ok', { provider: 'ollama-fallback', model: OLLAMA_MODEL });
        return action;
      }
      throw new Error('ollama_empty_response');
    }
    throw new Error('ollama_http_' + res.status);
  } catch (e) {
    lastError = e;
    log('warn', 'advisor_provider_failed', {
      provider: 'ollama-fallback',
      error: String(e && e.message || e).slice(0, 200),
    });
  }

  log('warn', 'advisor_default_action', { reason: 'all providers failed, using safe fallback action' });
  return {
    action: 'restart_service',
    params: { service: 'unicorn-backend' },
    reason: 'all_advisors_failed_default_recovery',
  };
}

// ---------- Client-side validation (server re-validates anyway) ----------
function validateRecommendation(rec) {
  if (!rec || typeof rec !== 'object') return { ok: false, reason: 'not_object' };
  if (!ALLOWED_ACTIONS.includes(rec.action)) return { ok: false, reason: 'action_not_allowed' };
  return { ok: true };
}

// ---------- Execute (only if EXECUTE_MODE) ----------
async function executeViaGovernor(rec) {
  if (!ADMIN_TOKEN) throw new Error('missing_DEEPSEEK_LOOP_ADMIN_TOKEN');
  const body = JSON.stringify({
    action: rec.action,
    params: rec.params || {},
    requestId: 'deepseek-loop-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
  });
  const res = await request(BACKEND_URL + '/api/admin/deepseek/act', {
    method: 'POST',
    timeoutMs: 35_000,
    headers: {
      'Authorization': 'Bearer ' + ADMIN_TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  return { status: res.status, body: res.body.slice(0, 4000) };
}

// ---------- Main loop ----------
let consecutiveFailures = 0;
let pausedUntil = 0;
let loopStartedAt = Date.now();
let lastCriticalTs = Date.now();

function _effectiveIntervalMs() {
  const runtimeMs = Date.now() - loopStartedAt;
  if (runtimeMs < INITIAL_FAST_WINDOW_MS) return FAST_INTERVAL_MS;
  const stableMs = Date.now() - lastCriticalTs;
  if (stableMs >= STABLE_WINDOW_HOURS * 60 * 60 * 1000) {
    return Math.max(INTERVAL_MS, SLOW_INTERVAL_MS);
  }
  return INTERVAL_MS;
}

async function tick() {
  if (Date.now() < pausedUntil) {
    log('info', 'circuit_breaker_paused', { until: new Date(pausedUntil).toISOString() });
    return;
  }
  try {
    log('info', 'Sending status to DeepSeek...', { intervalMs: _effectiveIntervalMs() });
    const status = await collectStatus();
    log('info', 'status_collected', status);
    const rec = await askDeepSeek(status);
    log('info', 'recommendation_received', rec);
    log('info', 'Received action: ' + String(rec && rec.action || 'none'), {
      action: rec && rec.action ? String(rec.action) : 'none',
    });
    const v = validateRecommendation(rec);
    if (!v.ok) {
      log('warn', 'recommendation_rejected_client_side', { reason: v.reason, rec });
      consecutiveFailures++;
    } else if (rec.action === 'none') {
      log('info', 'no_action_recommended', { reason: rec.reason || '' });
      consecutiveFailures = 0;
    } else if (!EXECUTE_MODE) {
      log('info', 'advisory_only_mode_recommendation', { action: rec.action, params: rec.params || {}, reason: rec.reason || '' });
      consecutiveFailures = 0;
    } else {
      const out = await executeViaGovernor(rec);
      log('info', 'governor_execution_result', { httpStatus: out.status, bodyPreview: out.body });
      if (out.status >= 200 && out.status < 300) consecutiveFailures = 0;
      else consecutiveFailures++;
    }
    if (consecutiveFailures === 0) {
      // keep window stable only on clean cycles
      // păstrăm fereastra stabilă doar pe cicluri curate
    } else {
      lastCriticalTs = Date.now();
    }
  } catch (e) {
    log('error', 'tick_failed', { error: String(e && e.message || e).slice(0, 300) });
    consecutiveFailures++;
    lastCriticalTs = Date.now();
  }
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    pausedUntil = Date.now() + BACKOFF_MS;
    log('warn', 'circuit_breaker_tripped', { failures: consecutiveFailures, pauseMs: BACKOFF_MS, until: new Date(pausedUntil).toISOString() });
    consecutiveFailures = 0;
  }
}

function main() {
  // Re-seed one more time at main() in case vault was updated after module load.
  if (keyVault) {
    try {
      const added = keyVault.reseedProcessEnv();
      if (added > 0) log('info', 'vault_reseeded', { keysAdded: added });
    } catch (_) { /* non-fatal */ }
  }
  log('info', 'deepseek_loop_boot', {
    enabled: ENABLED,
    executeMode: EXECUTE_MODE,
    fastIntervalMs: FAST_INTERVAL_MS,
    intervalMs: INTERVAL_MS,
    initialFastWindowMs: INITIAL_FAST_WINDOW_MS,
    slowIntervalMs: SLOW_INTERVAL_MS,
    backendUrl: BACKEND_URL,
    advisorProviders: getAdvisorProviders().map((provider) => provider.name),
    hasAdminToken: !!ADMIN_TOKEN,
    autonomyRoot: AUTONOMY_ROOT,
    sandboxRoot: SANDBOX_ROOT,
  });
  if (!ENABLED) {
    log('info', 'disabled_exiting', { reason: 'DEEPSEEK_LOOP_ENABLED!=1' });
    // Exit 0 so systemd does not restart-loop. Operator must opt-in.
    process.exit(0);
  }
  if (EXECUTE_MODE && !ADMIN_TOKEN) {
    log('warn', 'execute_mode_without_admin_token_falling_back_to_advisory', {});
  }
  // First tick after a short delay to let the backend boot.
  loopStartedAt = Date.now();
  const loop = async () => {
    await tick().catch((e) => log('error', 'tick_unhandled', { error: String(e) }));
    const nextMs = _effectiveIntervalMs();
    log('info', 'loop_schedule_next', { nextInMs: nextMs });
    setTimeout(loop, nextMs);
  };
  setTimeout(loop, 0);
}

if (require.main === module) main();

module.exports = { collectStatus, validateRecommendation, ALLOWED_ACTIONS };
