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

const ENABLED                = String(process.env.DEEPSEEK_LOOP_ENABLED || '') === '1';
const EXECUTE_MODE           = String(process.env.DEEPSEEK_LOOP_EXECUTE || '') === '1';
const INTERVAL_MS            = Math.max(30_000, parseInt(process.env.DEEPSEEK_LOOP_INTERVAL_MS || '120000', 10));
const BACKOFF_MS             = parseInt(process.env.DEEPSEEK_LOOP_BACKOFF_MS || String(30 * 60 * 1000), 10);
const FAILURE_THRESHOLD      = parseInt(process.env.DEEPSEEK_LOOP_FAILURE_THRESHOLD || '3', 10);
const BACKEND_URL            = process.env.DEEPSEEK_LOOP_BACKEND_URL || 'http://127.0.0.1:3000';
const HEALTH_URL             = process.env.DEEPSEEK_LOOP_HEALTH_URL || (BACKEND_URL + '/health');
const PRICING_PAGE_URL       = process.env.DEEPSEEK_LOOP_PRICING_URL || 'https://zeusai.pro/pricing';
const DEEPSEEK_API_URL       = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY       = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL         = process.env.DEEPSEEK_MODEL || 'deepseek-reasoner';
const OPENROUTER_API_KEY     = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_DEEPSEEK_MODEL = process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-v4-flash:free';
const GROQ_API_KEY           = process.env.GROQ_API_KEY || '';
const GROQ_DEEPSEEK_MODEL    = process.env.GROQ_DEEPSEEK_MODEL || 'qwen/qwen3-32b';
const ADMIN_TOKEN            = process.env.DEEPSEEK_LOOP_ADMIN_TOKEN || '';
const LOG_PATH               = process.env.DEEPSEEK_LOOP_LOG_PATH
                             || path.join(__dirname, '..', 'data', 'logs', 'deepseek-loop.log');
const ERROR_LOG_PATH         = process.env.DEEPSEEK_LOOP_ERROR_LOG || '/var/log/unicorn/error.log';
const ALLOWED_ACTIONS = ['none', 'read_status', 'read_file', 'prices_sync', 'checkout_fix', 'run_test', 'restart_service', 'code_proposal', 'roadmap_update'];

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

function getAdvisorProviders() {
  const providers = [];
  if (DEEPSEEK_API_KEY) {
    providers.push({
      name: 'deepseek-direct',
      url: DEEPSEEK_API_URL,
      key: DEEPSEEK_API_KEY,
      model: DEEPSEEK_MODEL,
      headers: {},
    });
  }
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter-deepseek',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: OPENROUTER_API_KEY,
      model: OPENROUTER_DEEPSEEK_MODEL,
      headers: {
        'HTTP-Referer': 'https://zeusai.pro',
        'X-Title': 'ZeusAI DeepSeek Loop',
      },
    });
  }
  if (GROQ_API_KEY) {
    providers.push({
      name: 'groq-reasoning-fallback',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: GROQ_API_KEY,
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
  return out;
}

// ---------- DeepSeek call ----------
async function askDeepSeek(status) {
  const providers = getAdvisorProviders();
  if (!providers.length) throw new Error('missing_deepseek_advisor_provider_key');
  const systemPrompt =
    'You are the autonomous DeepSeek operator for the Unicorn / zeusai.pro platform, owned by Vladoi Ionut (BTC settlement address bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e). ' +
    'Mission: build the most powerful autonomous SaaS in the world — global standard for >30 years — designed to generate billions of USD in annual revenue and settle automatically to the owner\'s BTC address. ' +
    'You operate 24/7 in an infinite improvement loop. Every tick: analyze the STATUS JSON, think one step ahead, then act. Never stop. When one objective is complete, immediately advance to the next priority. ' +
    'INNOVATION MANDATE: when no fire is burning, generate code_proposal envelopes for features that DO NOT YET EXIST on any competing SaaS — AI-personalized pricing per visitor, 24/7 AI commerce concierge, revenue-anomaly self-healing, sovereign anonymized-insights marketplace, BTC Lightning instant settlement, autonomous blue/green deploys. Invent what hasn\'t been invented. ' +
    'You receive a STATUS JSON containing health signals, recent errors, the roadmap of open objectives (vision + missionForDeepSeek + northStarTargets + topOpenObjectives), ' +
    'and (when present) an operatorCommand from the human owner that overrides roadmap priorities for this tick. ' +
    'Choose EXACTLY ONE action from this hardcoded allowlist: ' +
    ALLOWED_ACTIONS.join(', ') + '. ' +
    'You MUST return ONLY a JSON object with shape: ' +
    '{"action":"<one-of-allowlist>","params":{...},"reason":"<short string>"}. ' +
    'Action semantics: ' +
    'read_status = inspect runtime; read_file = inspect a file (params.path, must be repo-relative, no .env/secrets); ' +
    'prices_sync = refresh live pricing broker; checkout_fix = read-only checkout health; ' +
    'run_test = execute npm test (use sparingly); ' +
    'restart_service = log restart INTENT only (params.service ∈ unicorn-backend, unicorn-frontend, unicorn-site, pricing-module); ' +
    'code_proposal = author a code change envelope (params: targetPath repo-relative, proposedContent full new file content, rationale, objectiveId, riskLevel ∈ low|medium|high). Envelopes are quarantined for human/CI review — never applied automatically. Aim for small, focused, audit-friendly diffs. ' +
    'NEVER target .github/, deepseek-governor.js, deepseek-loop.js, package.json, package-lock.json — these are immutable guardrails. ' +
    'roadmap_update = mark an objective status (params.objectiveId, params.status ∈ pending|in-progress|done|blocked, optional note). ' +
    'Auto-advance rule: if STATUS shows a metric target met for an in-progress objective (compare metricKey against target via comparison), prefer roadmap_update status=done so the loop moves to the next priority on the next tick. ' +
    'Prioritization rules: (1) if operatorCommand is present, address it first; (2) otherwise pick the highest-priority open objective from roadmap.topOpenObjectives and act toward it; (3) prefer read_status / read_file for diagnosis, then code_proposal for fixes; (4) when everything is green, generate an innovation code_proposal toward an `innovation: true` objective. ' +
    'Diversify: do not repeat the same action+target on consecutive ticks. Spread effort across the top-3 priorities. ' +
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
    temperature: 0.1,
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
  throw lastError || new Error('all_deepseek_advisor_providers_failed');
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

async function tick() {
  if (Date.now() < pausedUntil) {
    log('info', 'circuit_breaker_paused', { until: new Date(pausedUntil).toISOString() });
    return;
  }
  try {
    const status = await collectStatus();
    log('info', 'status_collected', status);
    const rec = await askDeepSeek(status);
    log('info', 'recommendation_received', rec);
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
  } catch (e) {
    log('error', 'tick_failed', { error: String(e && e.message || e).slice(0, 300) });
    consecutiveFailures++;
  }
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    pausedUntil = Date.now() + BACKOFF_MS;
    log('warn', 'circuit_breaker_tripped', { failures: consecutiveFailures, pauseMs: BACKOFF_MS, until: new Date(pausedUntil).toISOString() });
    consecutiveFailures = 0;
  }
}

function main() {
  log('info', 'deepseek_loop_boot', {
    enabled: ENABLED,
    executeMode: EXECUTE_MODE,
    intervalMs: INTERVAL_MS,
    backendUrl: BACKEND_URL,
    advisorProviders: getAdvisorProviders().map((provider) => provider.name),
    hasAdminToken: !!ADMIN_TOKEN,
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
  setTimeout(() => { tick().catch((e) => log('error', 'tick_unhandled', { error: String(e) })); }, 5000);
  setInterval(() => { tick().catch((e) => log('error', 'tick_unhandled', { error: String(e) })); }, INTERVAL_MS);
}

if (require.main === module) main();

module.exports = { collectStatus, validateRecommendation, ALLOWED_ACTIONS };
