#!/usr/bin/env node
// =====================================================================
// DeepSeek Autopilot Tick — CI-side single-tick runner
//
// Why (en):
//   The Hetzner-side `deepseek-loop.js` writes `code_proposal` envelopes to
//   data/deepseek-proposals/ and `roadmap_update` rows into data/roadmap.json
//   but those changes never made it back into git, so the operator never saw
//   DeepSeek's work as a reviewable PR. This script closes the loop by
//   running ONE governor tick inside GitHub Actions:
//     1. read roadmap.json + recent error log (best-effort);
//     2. ask DeepSeek/OpenRouter/Groq for ONE allowlist action;
//     3. dispatch through the SAME governor module the backend uses, so all
//        safety rails (allowlist, deny-prefixes, size cap, daily cap) apply;
//     4. exit 0 with a JSON summary on stdout so the workflow can detect
//        whether `code_proposal` / `roadmap_update` wrote files to commit.
//
//   The workflow that calls this script then opens a **draft PR** when the
//   working tree is dirty. There is no auto-merge — the operator still owns
//   the gate.
//
// De ce (ro):
//   Buclă închisă: DeepSeek scrie propuneri → workflow-ul deschide PR draft
//   → operatorul aprobă/închide. Fără SSH, fără secrete suplimentare.
//
// Safety:
//   * Allowlist + path deny enforced by `deepseek-governor.dispatch`.
//   * Never applies a patch automatically; `code_proposal` is envelope-only.
//   * Exits 0 if no API key is present (so cron stays green and silent).
//   * Mockable via DEEPSEEK_AUTOPILOT_MOCK_RESPONSE (JSON string) for tests.
// =====================================================================
'use strict';

const fs   = require('fs');
const path = require('path');

const governor = require('../backend/modules/deepseek-governor');

const ROADMAP_PATH = process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH
                   || path.join(__dirname, '..', 'data', 'roadmap.json');
const ERROR_LOG_PATH = process.env.DEEPSEEK_AUTOPILOT_ERROR_LOG
                     || path.join(__dirname, '..', 'data', 'logs', 'deepseek-loop.log');

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL   = process.env.DEEPSEEK_MODEL   || 'deepseek-reasoner';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL   = process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-v4-flash:free';
const GROQ_API_KEY       = process.env.GROQ_API_KEY || '';
const GROQ_MODEL         = process.env.GROQ_DEEPSEEK_MODEL || 'qwen/qwen3-32b';

const PROVIDER_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_AUTOPILOT_TIMEOUT_MS || '45000', 10);

function log(level, msg, extra) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(extra ? { extra } : {}) };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

function getProviders() {
  const out = [];
  if (DEEPSEEK_API_KEY) {
    out.push({ name: 'deepseek-direct', url: DEEPSEEK_API_URL, key: DEEPSEEK_API_KEY, model: DEEPSEEK_MODEL, headers: {} });
  }
  if (OPENROUTER_API_KEY) {
    out.push({
      name: 'openrouter-deepseek',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: OPENROUTER_API_KEY, model: OPENROUTER_MODEL,
      headers: { 'HTTP-Referer': 'https://zeusai.pro', 'X-Title': 'ZeusAI DeepSeek Autopilot' },
    });
  }
  if (GROQ_API_KEY) {
    out.push({
      name: 'groq-reasoning-fallback',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: GROQ_API_KEY, model: GROQ_MODEL, headers: {},
    });
  }
  return out;
}

function readRoadmapDigest() {
  try {
    const roadmap = JSON.parse(fs.readFileSync(ROADMAP_PATH, 'utf8'));
    if (!roadmap || !Array.isArray(roadmap.objectives)) return null;
    return {
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
          note: o.note ? String(o.note).slice(0, 240) : undefined,
        })),
    };
  } catch (_) { return null; }
}

function readRecentErrors() {
  try {
    if (!fs.existsSync(ERROR_LOG_PATH)) return [];
    const buf = fs.readFileSync(ERROR_LOG_PATH, { encoding: 'utf8' });
    return buf.split('\n').filter(Boolean).slice(-10);
  } catch (_) { return []; }
}

function buildSystemPrompt() {
  return (
    'You are the autonomous DeepSeek operator for the Unicorn / zeusai.pro platform, owned by Vladoi Ionut (BTC settlement address bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e). ' +
    'Mission: build the most powerful autonomous SaaS in the world — global standard for >30 years — designed to generate billions of USD in annual revenue and settle automatically to the owner\'s BTC address. ' +
    'You are running inside a GitHub Actions tick. Your output drives a draft Pull Request if you produce a code_proposal or roadmap_update; otherwise the tick is a no-op. ' +
    'You receive STATUS containing the roadmap digest and recent error log lines. ' +
    'Choose EXACTLY ONE action from this hardcoded allowlist: ' +
    governor.ALLOWED_ACTIONS.join(', ') + '. ' +
    'You MUST return ONLY a JSON object: {"action":"<one-of-allowlist>","params":{...},"reason":"<short string>"}. ' +
    'Action semantics: ' +
    'code_proposal = author a code change envelope (params: targetPath repo-relative, proposedContent full new file content as a string, rationale, objectiveId, riskLevel ∈ low|medium|high). Envelopes are quarantined for human review — never applied automatically. Aim for small, focused diffs. ' +
    'NEVER target .github/, deepseek-governor.js, deepseek-loop.js, package.json, package-lock.json, .env, secrets — these are immutable guardrails. ' +
    'roadmap_update = mark an objective status (params.objectiveId must exist in the roadmap; params.status ∈ pending|in-progress|done|blocked; optional params.note ≤ 1000 chars). ' +
    'Other allowlist values (none, read_status, read_file, prices_sync, checkout_fix, run_test, restart_service) produce no PR — pick those only when no code change or status flip is appropriate. ' +
    'Pick the highest-priority open objective from STATUS.roadmap.topOpenObjectives and act toward it. ' +
    'Prefer code_proposal targeting UNICORN_FINAL/backend/modules/ or UNICORN_FINAL/src/site/ files that exist today. ' +
    'If unsure, return action="none" with reason — never invent actions outside the allowlist.'
  );
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally { clearTimeout(id); }
}

async function askProvider(provider, status) {
  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: 'STATUS:\n' + JSON.stringify(status, null, 2) },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });
  const res = await fetchWithTimeout(provider.url, {
    method: 'POST',
    headers: {
      ...provider.headers,
      'Authorization': 'Bearer ' + provider.key,
      'Content-Type': 'application/json',
    },
    body,
  }, PROVIDER_TIMEOUT_MS);
  if (!res.ok) {
    const txt = (await res.text()).replace(/\s+/g, ' ').slice(0, 240);
    throw new Error(provider.name + '_http_' + res.status + ': ' + txt);
  }
  const parsed = await res.json();
  const content = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
  if (!content) throw new Error(provider.name + '_empty_content');
  try { return JSON.parse(content); }
  catch (_) { throw new Error(provider.name + '_content_non_json'); }
}

async function getRecommendation(status) {
  // Test/mock hook — caller may inject the response without hitting any LLM.
  if (process.env.DEEPSEEK_AUTOPILOT_MOCK_RESPONSE) {
    try { return JSON.parse(process.env.DEEPSEEK_AUTOPILOT_MOCK_RESPONSE); }
    catch (e) { throw new Error('mock_response_invalid_json: ' + e.message); }
  }
  const providers = getProviders();
  if (!providers.length) {
    const err = new Error('no_provider_key');
    err.code = 'NO_PROVIDER_KEY';
    throw err;
  }
  let lastErr = null;
  for (const p of providers) {
    try {
      const rec = await askProvider(p, status);
      log('info', 'provider_ok', { provider: p.name, model: p.model });
      return rec;
    } catch (e) {
      lastErr = e;
      log('warn', 'provider_failed', { provider: p.name, error: String(e.message || e).slice(0, 240) });
    }
  }
  throw lastErr || new Error('all_providers_failed');
}

async function runTick() {
  const status = {
    ts: new Date().toISOString(),
    runner: 'github-actions',
    roadmap: readRoadmapDigest(),
    recentErrors: readRecentErrors(),
  };
  log('info', 'status_collected', { hasRoadmap: !!status.roadmap, errorLines: status.recentErrors.length });

  let rec;
  try {
    rec = await getRecommendation(status);
  } catch (e) {
    if (e && e.code === 'NO_PROVIDER_KEY') {
      log('warn', 'no_provider_key_skip', { hint: 'Set DEEPSEEK_API_KEY (or OPENROUTER_API_KEY / GROQ_API_KEY) as a repository secret to activate.' });
      return { skipped: true, reason: 'no_provider_key' };
    }
    log('error', 'recommendation_failed', { error: String(e.message || e).slice(0, 300) });
    return { skipped: true, reason: 'recommendation_failed' };
  }

  if (!rec || typeof rec !== 'object' || typeof rec.action !== 'string') {
    log('warn', 'recommendation_malformed', { rec });
    return { skipped: true, reason: 'malformed_recommendation' };
  }
  if (!governor.ALLOWED_ACTIONS.includes(rec.action)) {
    log('warn', 'action_not_in_allowlist', { action: rec.action });
    return { skipped: true, reason: 'action_not_allowed' };
  }

  // Actions that DO NOT produce a repo diff are logged and skipped — the
  // GitHub Actions tick is an inert no-op for them (no PR to open).
  const writeActions = new Set(['code_proposal', 'roadmap_update']);
  if (!writeActions.has(rec.action)) {
    log('info', 'non_write_action_skipped', { action: rec.action, reason: String(rec.reason || '').slice(0, 240) });
    return { skipped: true, reason: 'non_write_action', action: rec.action };
  }

  const requestId = 'autopilot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const result = await governor.dispatch({
    action: rec.action,
    params: rec.params || {},
    requestId,
    actor: 'github-actions-autopilot',
    ip: 'github-actions',
  });
  log('info', 'governor_result', {
    action: rec.action,
    status: result.status,
    ok: !!(result.body && result.body.ok),
    reason: result.body && (result.body.reason || result.body.note || ''),
    proposalId: result.body && result.body.proposalId,
    objectiveId: result.body && result.body.objectiveId,
    targetPath: result.body && result.body.targetPath,
  });
  return {
    skipped: false,
    action: rec.action,
    rationale: String(rec.reason || rec.rationale || '').slice(0, 480),
    governorStatus: result.status,
    governorBody: result.body,
  };
}

if (require.main === module) {
  runTick().then((summary) => {
    process.stdout.write('AUTOPILOT_SUMMARY=' + JSON.stringify(summary) + '\n');
    process.exit(0);
  }).catch((e) => {
    log('error', 'tick_unhandled', { error: String(e && e.message || e).slice(0, 300) });
    // Exit 0 so cron stays green; failures are logged.
    // Ieșire 0 pentru ca cron-ul să rămână verde; eșecurile sunt logate.
    process.exit(0);
  });
}

module.exports = { runTick, buildSystemPrompt, getProviders, readRoadmapDigest };
