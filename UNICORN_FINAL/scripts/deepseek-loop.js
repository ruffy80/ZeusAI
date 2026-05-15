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
const OPENROUTER_DEEPSEEK_MODEL = process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-r1:free';
const GROQ_API_KEY           = process.env.GROQ_API_KEY || '';
const GROQ_DEEPSEEK_MODEL    = process.env.GROQ_DEEPSEEK_MODEL || 'deepseek-r1-distill-llama-70b';
const ADMIN_TOKEN            = process.env.DEEPSEEK_LOOP_ADMIN_TOKEN || '';
const LOG_PATH               = process.env.DEEPSEEK_LOOP_LOG_PATH
                             || path.join(__dirname, '..', 'data', 'logs', 'deepseek-loop.log');
const ERROR_LOG_PATH         = process.env.DEEPSEEK_LOOP_ERROR_LOG || '/var/log/unicorn/error.log';
const ALLOWED_ACTIONS = ['none', 'read_status', 'read_file', 'prices_sync', 'checkout_fix', 'run_test', 'restart_service'];

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
      name: 'groq-deepseek',
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
  return out;
}

// ---------- DeepSeek call ----------
async function askDeepSeek(status) {
  const providers = getAdvisorProviders();
  if (!providers.length) throw new Error('missing_deepseek_advisor_provider_key');
  const systemPrompt =
    'You are the DeepSeek operations advisor for the Unicorn platform. ' +
    'Based on the given status JSON, choose EXACTLY ONE action from this hardcoded allowlist: ' +
    ALLOWED_ACTIONS.join(', ') + '. ' +
    'You MUST return ONLY a JSON object with shape: ' +
    '{"action":"<one-of-allowlist>","params":{...},"reason":"<short string>"}. ' +
    'For restart_service, params.service MUST be one of: unicorn-backend, unicorn-frontend, unicorn-site, pricing-module. ' +
    'If unsure, return action="none". Never invent actions outside the allowlist.';
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
      if (res.status < 200 || res.status >= 300) throw new Error(provider.name + '_http_' + res.status);
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
      log('warn', 'advisor_provider_failed', { provider: provider.name, error: String(e && e.message || e).slice(0, 200) });
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
