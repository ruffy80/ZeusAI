#!/usr/bin/env node
/**
 * 🔗 UNICORN PLATFORM CONNECTOR
 * Keeps the GitHub ↔ Hetzner autonomous runtime connected.
 *
 * Responsibilities:
 *   1. Periodically verify public edge endpoint is reachable.
 *   2. Periodically verify local backend (Hetzner) is healthy.
 *   3. If either is unhealthy, trigger a GitHub Actions Hetzner redeploy via API.
 *   4. Report connectivity status to console (visible in pm2 logs).
 *
 * Env vars:
 *   PLATFORM_CHECK_INTERVAL_MS  — how often to run a full check (default 5 min)
 *   EDGE_HEALTH_URL             — Public edge health URL (https://zeusai.pro/health)
 *   HETZNER_HEALTH_URL          — local backend health URL (default localhost)
 *   GITHUB_TOKEN                — PAT with `repo` + `workflow` scopes
 *   GITHUB_REPO_OWNER           — e.g. "ruffy80"
 *   GITHUB_REPO_NAME            — e.g. "ZeusAI"
 *   GITHUB_WORKFLOW_ID          — workflow file name (default "deploy-hetzner.yml")
 *   GITHUB_BRANCH               — branch to dispatch on (default "main")
 */

'use strict';

require('dotenv').config();
const https = require('https');
const http  = require('http');

// ─── Config ──────────────────────────────────────────────────────────────────
const CHECK_INTERVAL  = Math.max(parseInt(process.env.PLATFORM_CHECK_INTERVAL_MS || '300000', 10), 60000);
const EDGE_URL        = process.env.EDGE_HEALTH_URL || process.env.PUBLIC_APP_URL || '';
const HETZNER_URL     = process.env.HETZNER_HEALTH_URL  || 'http://127.0.0.1:3000/api/health';
const GH_TOKEN        = process.env.GITHUB_TOKEN        || '';
const GH_OWNER        = process.env.GITHUB_REPO_OWNER   || '';
const GH_REPO         = process.env.GITHUB_REPO_NAME    || '';
const GH_WORKFLOW     = process.env.GITHUB_WORKFLOW_ID  || 'deploy-hetzner.yml';
const GH_BRANCH       = process.env.GITHUB_BRANCH       || 'main';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  startTime:         new Date(),
  checkCount:        0,
  edgeFailures:      0,
  hetznerFailures:   0,
  redeployCount:     0,
  lastRedeployAt:    null,
  lastEdgeStatus:    'UNKNOWN',
  lastHetznerStatus: 'UNKNOWN',
};

const REDEPLOY_COOLDOWN_MS = 10 * 60 * 1000; // 10 min between redeploy triggers

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(emoji, msg, extra) {
  const ts = new Date().toISOString();
  const line = `[PlatformConnector] ${ts}  ${emoji}  ${msg}`;
  if (extra) {
    console.log(line, JSON.stringify(extra));
  } else {
    console.log(line);
  }
}

/**
 * HTTP/HTTPS GET returning { ok, statusCode, body }.
 * Resolves to { ok: false } on network error or timeout.
 */
function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve({ ok: res.statusCode === 200, statusCode: res.statusCode, body }));
      });
      req.on('error', (e) => resolve({ ok: false, statusCode: 0, body: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, statusCode: 0, body: 'timeout' }); });
    } catch (e) {
      resolve({ ok: false, statusCode: 0, body: e.message });
    }
  });
}

/**
 * Trigger a GitHub Actions workflow_dispatch event.
 * Returns { success, message }.
 */
function triggerGitHubDeploy() {
  return new Promise((resolve) => {
    if (!GH_TOKEN || !GH_OWNER || !GH_REPO) {
      return resolve({ success: false, message: 'Missing GITHUB_TOKEN / GITHUB_REPO_OWNER / GITHUB_REPO_NAME' });
    }

    // Enforce cooldown to avoid a redeploy storm
    if (state.lastRedeployAt) {
      const elapsed = Date.now() - state.lastRedeployAt;
      if (elapsed < REDEPLOY_COOLDOWN_MS) {
        const wait = Math.ceil((REDEPLOY_COOLDOWN_MS - elapsed) / 60000);
        return resolve({ success: false, message: `Cooldown active — ${wait}m remaining` });
      }
    }

    const payload = JSON.stringify({ ref: GH_BRANCH, inputs: { force_deploy: 'true' } });
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
      method: 'POST',
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Accept':        'application/vnd.github.v3+json',
        'User-Agent':    'unicorn-platform-connector/1.0',
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          state.redeployCount++;
          state.lastRedeployAt = Date.now();
          resolve({ success: true, message: `Workflow dispatch sent (HTTP ${res.statusCode})` });
        } else {
          resolve({ success: false, message: `GitHub API returned ${res.statusCode}: ${body.slice(0, 200)}` });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.write(payload);
    req.end();
  });
}

// ─── Main check cycle ─────────────────────────────────────────────────────────
async function runCheck() {
  state.checkCount++;
  log('🔍', `Platform connectivity check #${state.checkCount}`);

  let needRedeploy = false;

  // 1. Check Hetzner (local backend)
  const hetzner = await httpGet(HETZNER_URL);
  if (hetzner.ok) {
    state.hetznerFailures = 0;
    state.lastHetznerStatus = 'OK';
    log('✅', `Hetzner backend healthy (HTTP ${hetzner.statusCode})`);
  } else {
    state.hetznerFailures++;
    state.lastHetznerStatus = `FAIL(${state.hetznerFailures})`;
    log('⚠️', `Hetzner backend unhealthy — ${hetzner.body || hetzner.statusCode} (failure #${state.hetznerFailures})`);
    if (state.hetznerFailures >= 3) {
      needRedeploy = true;
    }
  }

  // 2. Check public edge endpoint (only if URL is configured)
  if (EDGE_URL) {
    const edge = await httpGet(EDGE_URL);
    if (edge.ok) {
      state.edgeFailures = 0;
      state.lastEdgeStatus = 'OK';
      log('✅', `Public edge healthy (HTTP ${edge.statusCode})`);
    } else {
      state.edgeFailures++;
      state.lastEdgeStatus = `FAIL(${state.edgeFailures})`;
      log('⚠️', `Public edge unreachable — ${edge.body || edge.statusCode} (failure #${state.edgeFailures})`);
      if (state.edgeFailures >= 3) {
        needRedeploy = true;
      }
    }
  } else {
    log('ℹ️', 'EDGE_HEALTH_URL/PUBLIC_APP_URL not set — skipping public edge check');
  }

  // 3. Trigger redeploy if needed
  if (needRedeploy) {
    log('🚀', 'Triggering GitHub Actions redeploy to heal platform...');
    const result = await triggerGitHubDeploy();
    if (result.success) {
      log('✅', `Redeploy triggered: ${result.message}`);
      state.hetznerFailures = 0;
      state.edgeFailures    = 0;
    } else {
      log('❌', `Redeploy trigger failed: ${result.message}`);
    }
  }

  // 4. Status summary
  const upSecs = Math.floor((Date.now() - state.startTime) / 1000);
  log('📊', 'Platform status', {
    uptime: `${Math.floor(upSecs / 3600)}h ${Math.floor((upSecs % 3600) / 60)}m`,
    hetzner: state.lastHetznerStatus,
    edge:    EDGE_URL ? state.lastEdgeStatus : 'UNCONFIGURED',
    redeployCount: state.redeployCount,
    checkCount: state.checkCount,
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT',  () => { log('🛑', 'Platform Connector shutting down (SIGINT)');  process.exit(0); });
process.on('SIGTERM', () => { log('🛑', 'Platform Connector shutting down (SIGTERM)'); process.exit(0); });
process.on('uncaughtException', (err) => {
  log('💥', 'Uncaught exception', { message: err.message });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
log('🔗', '══════════════════════════════════════════════════');
log('🔗', '  UNICORN PLATFORM CONNECTOR STARTED               ');
log('🔗', `  Check interval: ${CHECK_INTERVAL / 1000}s         `);
log('🔗', `  Hetzner URL:    ${HETZNER_URL}                    `);
log('🔗', `  Edge URL:       ${EDGE_URL || '(not configured)'}`);
log('🔗', `  GitHub repo:    ${GH_OWNER}/${GH_REPO}            `);
log('🔗', `  Workflow:       ${GH_WORKFLOW} @ ${GH_BRANCH}     `);
log('🔗', '══════════════════════════════════════════════════');

// Run immediately on start, then on interval
runCheck();
setInterval(runCheck, CHECK_INTERVAL);
