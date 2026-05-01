/**
 * 🦄 UNICORN AUTONOMOUS ORCHESTRATOR
 * Coordinates: Innovation Engine + Revenue Engine + Deployment Pipeline
 * + Platform Connectivity (GitHub ↔ Hetzner keep-alive)
 * Runs independently from the backend HTTP server
 */

'use strict';

const path = require('path');
const { exec } = require('child_process');

// ─── Config ─────────────────────────────────────────────────────────────────
const BASE = path.join(__dirname, 'backend/modules');
const BACKEND_PORT          = parseInt(process.env.PORT || process.env.BACKEND_PORT || '3000', 10);
const BACKEND_BASE_URL      = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const INNOVATION_INTERVAL   = parseInt(process.env.INNOVATION_INTERVAL   || '30',  10) * 1000;
const REVENUE_INTERVAL      = parseInt(process.env.REVENUE_INTERVAL      || '15',  10) * 1000;
const VIRAL_INTERVAL        = parseInt(process.env.VIRAL_INTERVAL        || '20',  10) * 1000;
const DEPLOY_INTERVAL       = parseInt(process.env.DEPLOYMENT_INTERVAL   || '120', 10) * 1000;
const PLATFORM_INTERVAL     = parseInt(process.env.PLATFORM_INTERVAL     || '300', 10) * 1000;
const MONITOR_INTERVAL      = parseInt(process.env.MONITOR_INTERVAL      || '60',  10) * 1000;
const DECISION_INTERVAL     = parseInt(process.env.DECISION_INTERVAL     || '45',  10) * 1000;
const HEALTH_INTERVAL       = 15 * 1000;
const BACKEND_HEAL_CMD      = process.env.BACKEND_HEAL_CMD || '';
const EDGE_HEALTH_URL       = process.env.EDGE_HEALTH_URL || process.env.PUBLIC_APP_URL || '';
const GH_PULL_INTERVAL      = parseInt(process.env.GH_PULL_INTERVAL  || '600', 10) * 1000; // 10 min
const GH_BRANCH             = process.env.GITHUB_DEFAULT_BRANCH || 'main';

let innovationEngine, revenueEngine, viralEngine, controlPlaneAgent, profitControlLoop, githubOps;

// ─── Load engines gracefully (modules export singleton instances) ────────────
try {
  innovationEngine = require(path.join(BASE, 'autonomousInnovation'));
  console.log('🤖 [ORCHESTRATOR] Innovation Engine loaded');
} catch (e) {
  console.warn('⚠️  [ORCHESTRATOR] Innovation Engine unavailable:', e.message);
}

try {
  revenueEngine = require(path.join(BASE, 'autoRevenue'));
  console.log('💰 [ORCHESTRATOR] Revenue Engine loaded');
} catch (e) {
  console.warn('⚠️  [ORCHESTRATOR] Revenue Engine unavailable:', e.message);
}

try {
  viralEngine = require(path.join(BASE, 'autoViralGrowth'));
  console.log('📣 [ORCHESTRATOR] Viral Growth Engine loaded');
} catch (e) {
  console.warn('⚠️  [ORCHESTRATOR] Viral Growth Engine unavailable:', e.message);
}

try {
  controlPlaneAgent = require(path.join(BASE, 'control-plane-agent'));
  console.log('🤖 [ORCHESTRATOR] Control Plane Agent (Auto-Decision AI) loaded');
} catch (e) {
  console.warn('⚠️  [ORCHESTRATOR] Control Plane Agent unavailable:', e.message);
}

try {
  profitControlLoop = require(path.join(BASE, 'profit-control-loop'));
  console.log('🎯 [ORCHESTRATOR] Profit Control Loop (Auto-Decision AI) loaded');
} catch (e) {
  console.warn('⚠️  [ORCHESTRATOR] Profit Control Loop unavailable:', e.message);
}

try {
  githubOps = require(path.join(BASE, 'github-ops'));
  console.log('🔧 [ORCHESTRATOR] GitHub Ops loaded');
} catch (e) {
  console.warn('⚠️  [ORCHESTRATOR] GitHub Ops unavailable:', e.message);
}

// ─── Stats tracking ──────────────────────────────────────────────────────────
const stats = {
  startTime: new Date(),
  innovationCycles: 0,
  revenueCycles: 0,
  viralCycles: 0,
  deployCycles: 0,
  platformCycles: 0,
  monitorCycles: 0,
  decisionCycles: 0,
  healthChecks: 0,
  githubCycles: 0,
  errors: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(emoji, msg, data) {
  const ts = new Date().toISOString();
  if (data) {
    console.log(`${ts}  ${emoji}  ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${ts}  ${emoji}  ${msg}`);
  }
}

// ─── Viral growth cycle ──────────────────────────────────────────────────────
async function runViralCycle() {
  stats.viralCycles++;
  log('📣', `Viral cycle #${stats.viralCycles}`);
  try {
    if (viralEngine) {
      const result = viralEngine.executeGrowthLoop
        ? viralEngine.executeGrowthLoop()
        : viralEngine.getViralStatus
        ? viralEngine.getViralStatus()
        : { status: 'ok', cycle: stats.viralCycles };
      log('✅', 'Viral cycle complete', result);
    } else {
      log('📈', 'Viral Engine (mock) – cycle logged');
    }
  } catch (e) {
    stats.errors++;
    log('❌', 'Viral cycle error:', e.message);
  }
}

function uptime() {
  const s = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// ─── Innovation cycle ─────────────────────────────────────────────────────────
async function runInnovationCycle() {
  stats.innovationCycles++;
  log('🧠', `Innovation cycle #${stats.innovationCycles}`);
  try {
    if (innovationEngine) {
      const result = innovationEngine.generateInnovation
        ? await innovationEngine.generateInnovation()
        : { status: 'ok', cycle: stats.innovationCycles };
      log('✅', 'Innovation cycle complete', result);
    } else {
      log('💡', 'Innovation Engine (mock) – cycle logged');
    }
  } catch (e) {
    stats.errors++;
    log('❌', 'Innovation cycle error:', e.message);
  }
}

// ─── Revenue cycle ────────────────────────────────────────────────────────────
async function runRevenueCycle() {
  stats.revenueCycles++;
  log('💸', `Revenue cycle #${stats.revenueCycles}`);
  try {
    if (revenueEngine) {
      const result = revenueEngine.generateDeals
        ? await revenueEngine.generateDeals()
        : revenueEngine.getStatus
        ? revenueEngine.getStatus()
        : { status: 'ok', cycle: stats.revenueCycles };
      log('✅', 'Revenue cycle complete', result);
    } else {
      log('💰', 'Revenue Engine (mock) – cycle logged');
    }
  } catch (e) {
    stats.errors++;
    log('❌', 'Revenue cycle error:', e.message);
  }
}

// ─── Deploy cycle ─────────────────────────────────────────────────────────────
async function runDeployCycle() {
  stats.deployCycles++;
  log('🚀', `Deploy cycle #${stats.deployCycles} – checking autonomous runtime...`);
  try {
    // Lightweight health check against running backend
    const http = require('http');
    const check = () => new Promise((resolve) => {
      const req = http.get(`${BACKEND_BASE_URL}/api/health`, (res) => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', (e) => resolve({ status: 'error', message: e.message }));
      req.setTimeout(5000, () => { req.abort(); resolve({ status: 'timeout' }); });
    });
    const health = await check();
    if (health && health.status === 'ok') {
      log('✅', 'Backend health confirmed', health);
      return;
    }

    log('⚠️', 'Backend unhealthy detected', health);
    if (BACKEND_HEAL_CMD) {
      exec(BACKEND_HEAL_CMD, (err, stdout, stderr) => {
        if (err) {
          stats.errors++;
          log('❌', 'Auto-heal command failed', { message: err.message });
          return;
        }
        log('🛠️', 'Auto-heal command executed', {
          stdout: (stdout || '').trim().slice(0, 300),
          stderr: (stderr || '').trim().slice(0, 300),
        });
      });
    }
  } catch (e) {
    stats.errors++;
    log('❌', 'Deploy cycle error:', e.message);
  }
}

// ─── Platform connectivity cycle ─────────────────────────────────────────────
async function runPlatformCycle() {
  stats.platformCycles++;
  log('🔗', `Platform connectivity check #${stats.platformCycles}`);
  try {
    const http  = require('http');
    const https = require('https');

    // Helper: simple GET returning statusCode or 0 on error; drains body to avoid socket exhaustion
    const ping = (url, timeoutMs = 6000) => new Promise((resolve) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        res.resume(); // consume and discard body to free the socket
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(0); });
    });

    // 1. Local backend health
    const backendStatus = await ping(`${BACKEND_BASE_URL}/api/health`);
    if (backendStatus === 200) {
      log('✅', 'Backend reachable');
    } else {
      log('⚠️', `Backend not reachable (HTTP ${backendStatus}) — triggering heal`);
      if (BACKEND_HEAL_CMD) {
        exec(BACKEND_HEAL_CMD, (err) => {
          if (err) { stats.errors++; log('❌', 'Backend heal failed', { message: err.message }); }
          else { log('🛠️', 'Backend heal command executed'); }
        });
      }
    }

    // 2. Public edge health (optional)
    if (EDGE_HEALTH_URL) {
      const edgeStatus = await ping(EDGE_HEALTH_URL);
      if (edgeStatus === 200) {
        log('✅', `Edge URL reachable (HTTP ${edgeStatus})`);
      } else {
        log('⚠️', `Edge URL not reachable (HTTP ${edgeStatus})`);
      }
    }

    log('✅', 'Platform cycle complete');
  } catch (e) {
    stats.errors++;
    log('❌', 'Platform cycle error:', e.message);
  }
}

// ─── Auto-Monitoring cycle ────────────────────────────────────────────────────
async function runMonitorCycle() {
  stats.monitorCycles++;
  log('📡', `Auto-Monitor cycle #${stats.monitorCycles}`);
  try {
    const http = require('http');
    const endpoints = [
      { url: `${BACKEND_BASE_URL}/api/health`,               label: 'health' },
      { url: `${BACKEND_BASE_URL}/api/slo/status`,           label: 'slo' },
      { url: `${BACKEND_BASE_URL}/api/orchestrator/status`,  label: 'orchestrator' },
    ];
    for (const ep of endpoints) {
      const status = await new Promise((resolve) => {
        const req = http.get(ep.url, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', () => resolve(0));
        req.setTimeout(4000, () => { req.destroy(); resolve(0); });
      });
      if (status !== 200) {
        log('⚠️', `Auto-Monitor: ${ep.label} degraded (HTTP ${status})`);
      }
    }
    log('✅', 'Auto-Monitor cycle complete');
  } catch (e) {
    stats.errors++;
    log('❌', 'Auto-Monitor cycle error:', e.message);
  }
}

// ─── Auto-Decision AI cycle ───────────────────────────────────────────────────
async function runDecisionCycle() {
  stats.decisionCycles++;
  log('🤖', `Auto-Decision AI cycle #${stats.decisionCycles}`);
  try {
    if (controlPlaneAgent && typeof controlPlaneAgent.getStatus === 'function') {
      const status = controlPlaneAgent.getStatus();
      const rollbacks = status.rollbackCount || 0;
      const emoji = rollbacks > 0 ? '⚠️' : '✅';
      log(emoji, 'Auto-Decision AI status', {
        decisions: status.decisionCount || 0,
        rollbacks,
      });
    } else {
      log('🤖', 'Auto-Decision AI (mock) — cycle logged');
    }
    if (profitControlLoop && typeof profitControlLoop.getStatus === 'function') {
      const loopStatus = profitControlLoop.getStatus();
      log('🎯', 'Profit Control Loop status', {
        cycles: loopStatus.cycleCount || 0,
        totalReward: loopStatus.totalReward || 0,
      });
    }
  } catch (e) {
    stats.errors++;
    log('❌', 'Auto-Decision AI cycle error:', e.message);
  }
}

// ─── GitHub Operations cycle ──────────────────────────────────────────────────
async function runGithubCycle() {
  stats.githubCycles++;
  log('🔧', `GitHub Ops cycle #${stats.githubCycles}`);
  if (!githubOps) {
    log('⚠️', 'GitHub Ops not loaded — skipping');
    return;
  }
  try {
    const status = githubOps.getStatus();
    if (!status.configured) {
      log('⚠️', 'GitHub Ops not configured (GITHUB_TOKEN/GITHUB_REPOSITORY missing)');
      return;
    }

    // 1. Pull latest from main branch
    try {
      const pullResult = await githubOps.pullLatest(GH_BRANCH);
      log('⬇️', `git pull ${GH_BRANCH}`, { summary: pullResult.summary });
    } catch (pullErr) {
      log('⚠️', `git pull failed: ${pullErr.message}`);
    }

    // 2. Check if last CI workflow run failed → consider rollback
    try {
      const runs = await githubOps.getWorkflowRuns('deploy-hetzner.yml', 3);
      const latestRun = runs[0];
      if (latestRun && latestRun.conclusion === 'failure') {
        log('🚨', 'Last deploy workflow FAILED — checking if rollback needed', { run: latestRun.id, sha: latestRun.sha });
        const GH_AUTO_ROLLBACK = String(process.env.GH_AUTO_ROLLBACK || 'false').toLowerCase() === 'true';
        if (GH_AUTO_ROLLBACK) {
          log('⏪', `Auto-rollback enabled — reverting ${latestRun.sha}`);
          await githubOps.rollback(latestRun.sha, GH_BRANCH);
        }
      } else if (latestRun) {
        log('✅', `Latest workflow run: ${latestRun.status}/${latestRun.conclusion || 'pending'}`, { id: latestRun.id });
      }
    } catch (ciErr) {
      log('⚠️', `CI status check failed: ${ciErr.message}`);
    }

    log('🔧', 'GitHub Ops cycle complete', githubOps.getStatus().ops);
  } catch (e) {
    stats.errors++;
    log('❌', 'GitHub Ops cycle error:', e.message);
  }
}


function printHealthReport() {
  stats.healthChecks++;
  const report = {
    uptime: uptime(),
    innovationCycles: stats.innovationCycles,
    revenueCycles: stats.revenueCycles,
    viralCycles: stats.viralCycles,
    deployCycles: stats.deployCycles,
    platformCycles: stats.platformCycles,
    monitorCycles: stats.monitorCycles,
    decisionCycles: stats.decisionCycles,
    healthChecks: stats.healthChecks,
    githubCycles: stats.githubCycles,
    errors: stats.errors,
    innovationEngine: innovationEngine ? 'ACTIVE' : 'MOCKED',
    revenueEngine: revenueEngine ? 'ACTIVE' : 'MOCKED',
    viralEngine: viralEngine ? 'ACTIVE' : 'MOCKED',
    controlPlaneAgent: controlPlaneAgent ? 'ACTIVE' : 'MOCKED',
    profitControlLoop: profitControlLoop ? 'ACTIVE' : 'MOCKED',
    githubOps: githubOps ? 'ACTIVE' : 'UNAVAILABLE',
    nextInnovation: `${Math.round(INNOVATION_INTERVAL / 1000)}s`,
    nextRevenue: `${Math.round(REVENUE_INTERVAL / 1000)}s`,
    nextViral: `${Math.round(VIRAL_INTERVAL / 1000)}s`,
    nextDeploy: `${Math.round(DEPLOY_INTERVAL / 1000)}s`,
    nextPlatform: `${Math.round(PLATFORM_INTERVAL / 1000)}s`,
    nextMonitor: `${Math.round(MONITOR_INTERVAL / 1000)}s`,
    nextDecision: `${Math.round(DECISION_INTERVAL / 1000)}s`,
  };
  log('📊', '══ ORCHESTRATOR HEALTH REPORT ══', report);
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT',  () => { log('🛑', 'Orchestrator shutting down (SIGINT)');  process.exit(0); });
process.on('SIGTERM', () => { log('🛑', 'Orchestrator shutting down (SIGTERM)'); process.exit(0); });
process.on('uncaughtException', (err) => {
  stats.errors++;
  log('💥', 'Uncaught exception:', err.message);
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
(async () => {
  log('🦄', '══════════════════════════════════════════');
  log('🦄', '  UNICORN AUTONOMOUS ORCHESTRATOR STARTED ');
  log('🦄', `  Innovation every ${INNOVATION_INTERVAL / 1000}s`);
  log('🦄', `  Revenue every    ${REVENUE_INTERVAL / 1000}s`);
  log('🦄', `  Viral every      ${VIRAL_INTERVAL / 1000}s`);
  log('🦄', `  Deploy check every ${DEPLOY_INTERVAL / 1000}s`);
  log('🦄', `  Platform check every ${PLATFORM_INTERVAL / 1000}s`);
  log('🦄', `  Auto-Monitor every ${MONITOR_INTERVAL / 1000}s`);
  log('🦄', `  Auto-Decision AI every ${DECISION_INTERVAL / 1000}s`);
  log('🦄', `  GitHub pull/rollback every ${GH_PULL_INTERVAL / 1000}s`);
  log('🦄', '══════════════════════════════════════════');

  // Immediate first cycles
  await runInnovationCycle();
  await runRevenueCycle();
  await runViralCycle();
  await runDeployCycle();
  await runPlatformCycle();
  await runMonitorCycle();
  await runDecisionCycle();
  await runGithubCycle();
  printHealthReport();

  // Schedule recurring cycles
  setInterval(runInnovationCycle, INNOVATION_INTERVAL);
  setInterval(runRevenueCycle,    REVENUE_INTERVAL);
  setInterval(runViralCycle,      VIRAL_INTERVAL);
  setInterval(runDeployCycle,     DEPLOY_INTERVAL);
  setInterval(runPlatformCycle,   PLATFORM_INTERVAL);
  setInterval(runMonitorCycle,    MONITOR_INTERVAL);
  setInterval(runDecisionCycle,   DECISION_INTERVAL);
  setInterval(runGithubCycle,     GH_PULL_INTERVAL);
  setInterval(printHealthReport,  HEALTH_INTERVAL);

  log('✅', 'All 9 autonomous cycles scheduled and running 🚀');
})();
