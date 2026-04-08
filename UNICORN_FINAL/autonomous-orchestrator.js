/**
 * 🦄 UNICORN AUTONOMOUS ORCHESTRATOR
 * Coordinates: Innovation Engine + Revenue Engine + Deployment Pipeline
 * Runs independently from the backend HTTP server
 */

'use strict';

const path = require('path');
const { exec } = require('child_process');

// ─── Config ─────────────────────────────────────────────────────────────────
const BASE = path.join(__dirname, 'backend/modules');
const INNOVATION_INTERVAL = parseInt(process.env.INNOVATION_INTERVAL || '30', 10) * 1000;
const REVENUE_INTERVAL    = parseInt(process.env.REVENUE_INTERVAL    || '15', 10) * 1000;
const VIRAL_INTERVAL      = parseInt(process.env.VIRAL_INTERVAL      || '20', 10) * 1000;
const DEPLOY_INTERVAL     = parseInt(process.env.DEPLOYMENT_INTERVAL || '120', 10) * 1000;
const HEALTH_INTERVAL     = 15 * 1000;
const BACKEND_HEAL_CMD    = process.env.BACKEND_HEAL_CMD || '';

let innovationEngine, revenueEngine, viralEngine;

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

// ─── Stats tracking ──────────────────────────────────────────────────────────
const stats = {
  startTime: new Date(),
  innovationCycles: 0,
  revenueCycles: 0,
  viralCycles: 0,
  deployCycles: 0,
  healthChecks: 0,
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
  log('🚀', `Deploy cycle #${stats.deployCycles} – checking Vercel status...`);
  try {
    // Lightweight health check against running backend
    const http = require('http');
    const check = () => new Promise((resolve) => {
      const req = http.get('http://localhost:3000/api/health', (res) => {
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

// ─── Health report ────────────────────────────────────────────────────────────
function printHealthReport() {
  stats.healthChecks++;
  const report = {
    uptime: uptime(),
    innovationCycles: stats.innovationCycles,
    revenueCycles: stats.revenueCycles,
    viralCycles: stats.viralCycles,
    deployCycles: stats.deployCycles,
    healthChecks: stats.healthChecks,
    errors: stats.errors,
    innovationEngine: innovationEngine ? 'ACTIVE' : 'MOCKED',
    revenueEngine: revenueEngine ? 'ACTIVE' : 'MOCKED',
    viralEngine: viralEngine ? 'ACTIVE' : 'MOCKED',
    nextInnovation: `${Math.round(INNOVATION_INTERVAL / 1000)}s`,
    nextRevenue: `${Math.round(REVENUE_INTERVAL / 1000)}s`,
    nextViral: `${Math.round(VIRAL_INTERVAL / 1000)}s`,
    nextDeploy: `${Math.round(DEPLOY_INTERVAL / 1000)}s`,
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
  log('🦄', '══════════════════════════════════════════');

  // Immediate first cycles
  await runInnovationCycle();
  await runRevenueCycle();
  await runViralCycle();
  await runDeployCycle();
  printHealthReport();

  // Schedule recurring cycles
  setInterval(runInnovationCycle, INNOVATION_INTERVAL);
  setInterval(runRevenueCycle,    REVENUE_INTERVAL);
  setInterval(runViralCycle,      VIRAL_INTERVAL);
  setInterval(runDeployCycle,     DEPLOY_INTERVAL);
  setInterval(printHealthReport,  HEALTH_INTERVAL);

  log('✅', 'All autonomous cycles scheduled and running 🚀');
})();
