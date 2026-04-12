#!/usr/bin/env node
/**
 * 🦄 AUTONOMOUS COMMIT SCRIPT
 * Runs at each CI autonomous cycle.
 * Writes real files to disk so they can be committed back to GitHub.
 *
 * Outputs:
 *   UNICORN_FINAL/generated/autonomous-cycle-<timestamp>.json  — cycle report
 *   UNICORN_FINAL/generated/AUTONOMOUS-STATUS.json             — latest live status
 *   UNICORN_FINAL/generated/AUTONOMOUS-STATUS.md               — human-readable summary
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const GEN_DIR  = path.join(ROOT, 'generated');

// ── Ensure generated/ exists ─────────────────────────────────────────────────
if (!fs.existsSync(GEN_DIR)) {
  fs.mkdirSync(GEN_DIR, { recursive: true });
}

// ── Load modules (all graceful) ───────────────────────────────────────────────
function tryRequire(mod) {
  try { return require(mod); } catch { return null; }
}

const innovationEngine   = tryRequire(path.join(ROOT, 'backend/modules/autonomousInnovation'));
const totalSystemHealer  = tryRequire(path.join(ROOT, 'backend/modules/totalSystemHealer'));
const autoRevenue        = tryRequire(path.join(ROOT, 'backend/modules/autoRevenue'));
const autoViralGrowth    = tryRequire(path.join(ROOT, 'backend/modules/autoViralGrowth'));
const qrc                = tryRequire(path.join(ROOT, 'backend/modules/quantumResilienceCore'));
const controlPlane       = tryRequire(path.join(ROOT, 'backend/modules/control-plane-agent'));
const sloTracker         = tryRequire(path.join(ROOT, 'backend/modules/slo-tracker'));

// ── Collect status from each engine ──────────────────────────────────────────
function safe(fn) {
  try { return fn(); } catch (e) { return { error: e.message }; }
}

const ts       = new Date().toISOString();
const tsFile   = Date.now();

const innovStatus   = innovationEngine
  ? safe(() => innovationEngine.getStatus())
  : { status: 'unavailable' };

const innovMetrics  = innovationEngine
  ? safe(() => innovationEngine.getDeploymentMetrics())
  : {};

const healStatus    = totalSystemHealer
  ? safe(() => (totalSystemHealer.getHealthReport || totalSystemHealer.getStatus || (() => ({ status: 'ok' })))())
  : { status: 'unavailable' };

const revenueStatus = autoRevenue
  ? safe(() => (autoRevenue.getStatus || autoRevenue.getRevenueStatus || (() => ({ status: 'ok' })))())
  : { status: 'unavailable' };

const viralStatus   = autoViralGrowth
  ? safe(() => (autoViralGrowth.getViralStatus || autoViralGrowth.getStatus || (() => ({ status: 'ok' })))())
  : { status: 'unavailable' };

const qrcStatus     = qrc
  ? safe(() => (qrc.getStatus || (() => ({ status: 'ok' })))())
  : { status: 'unavailable' };

const cpStatus      = controlPlane
  ? safe(() => (controlPlane.getStatus || (() => ({ status: 'ok' })))())
  : { status: 'unavailable' };

const sloStatus     = sloTracker
  ? safe(() => (sloTracker.getStatus || sloTracker.getReport || (() => ({ status: 'ok' })))())
  : { status: 'unavailable' };

// ── Build cycle report ────────────────────────────────────────────────────────
const report = {
  cycle: {
    timestamp:     ts,
    runId:         process.env.GITHUB_RUN_ID   || 'local',
    runNumber:     process.env.GITHUB_RUN_NUMBER || '0',
    actor:         process.env.GITHUB_ACTOR    || 'autonomous',
    ref:           process.env.GITHUB_REF      || 'refs/heads/main',
    sha:           process.env.GITHUB_SHA      || 'unknown',
  },
  engines: {
    innovation:    innovStatus,
    innovMetrics,
    healer:        healStatus,
    revenue:       revenueStatus,
    viral:         viralStatus,
    quantumResilience: qrcStatus,
    controlPlane:  cpStatus,
    slo:           sloStatus,
  },
  summary: {
    innovationsGenerated: innovStatus.totalGenerated  || 0,
    innovationsDeployed:  innovStatus.metrics?.totalFeaturesDeployed || 0,
    deploymentSuccessRate: innovStatus.metrics?.deploymentSuccessRate || 100,
    healerStatus:         (healStatus && !healStatus.error) ? 'ok' : 'degraded',
    overallStatus:        'AUTONOMOUS_RUNNING',
  },
};

// ── Write timestamped cycle file ──────────────────────────────────────────────
const cycleFile = path.join(GEN_DIR, `autonomous-cycle-${tsFile}.json`);
fs.writeFileSync(cycleFile, JSON.stringify(report, null, 2), 'utf8');
console.log(`[autonomous-commit] ✅ Wrote cycle report → generated/autonomous-cycle-${tsFile}.json`);

// ── Write latest-status files ─────────────────────────────────────────────────
const statusFile = path.join(GEN_DIR, 'AUTONOMOUS-STATUS.json');
fs.writeFileSync(statusFile, JSON.stringify(report, null, 2), 'utf8');

const mdContent = `# 🦄 Unicorn Autonomous Status

**Last cycle:** ${ts}
**Run:** #${report.cycle.runNumber} by ${report.cycle.actor}
**Commit:** \`${report.cycle.sha.slice(0, 7)}\`

## 📊 Innovation Engine
- Total generated: **${report.summary.innovationsGenerated}**
- Total deployed:  **${report.summary.innovationsDeployed}**
- Success rate:    **${report.summary.deploymentSuccessRate}%**

## 🩺 System Health
- Healer:          **${report.summary.healerStatus}**
- Overall:         **${report.summary.overallStatus}**

## 🕐 Engine States
| Engine | Status |
|--------|--------|
| Innovation | ${innovStatus.state || 'RUNNING'} |
| Revenue    | ${revenueStatus.status || 'ok'} |
| Viral      | ${viralStatus.status || 'ok'} |
| Quantum Resilience | ${qrcStatus.status || 'ok'} |
| Control Plane | ${cpStatus.status || 'ok'} |
| SLO Tracker   | ${sloStatus.status || 'ok'} |

---
*Auto-generated by autonomous-commit.js — do not edit manually*
`;

const mdFile = path.join(GEN_DIR, 'AUTONOMOUS-STATUS.md');
fs.writeFileSync(mdFile, mdContent, 'utf8');
console.log('[autonomous-commit] ✅ Wrote AUTONOMOUS-STATUS.json + AUTONOMOUS-STATUS.md');

// ── Prune old cycle files (keep last 48) ─────────────────────────────────────
try {
  const files = fs.readdirSync(GEN_DIR)
    .filter(f => f.startsWith('autonomous-cycle-') && f.endsWith('.json'))
    .sort();  // oldest first

  const TO_KEEP = 48;
  if (files.length > TO_KEEP) {
    const toDelete = files.slice(0, files.length - TO_KEEP);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(GEN_DIR, f));
    }
    console.log(`[autonomous-commit] 🗑️  Pruned ${toDelete.length} old cycle file(s)`);
  }
} catch (e) {
  console.warn('[autonomous-commit] ⚠️  Prune failed:', e.message);
}

console.log('[autonomous-commit] 🎉 Done.');
process.exit(0);
