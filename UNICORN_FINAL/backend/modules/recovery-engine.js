// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== RECOVERY ENGINE MODULE ====================
// Motor central de recuperare autonomă:
// - Primește semnale de la error-pattern-detector, log-monitor, resource-monitor
// - Execută planuri de recuperare standardizate (restart, rollback, heal)
// - Coordonează recuperarea cu orchestratorul
// - Menține un jurnal complet al acțiunilor de recuperare

const { execFile } = require('child_process');
const http  = require('http');
const https = require('https');
const path  = require('path');

const HEALTH_URL      = process.env.ORCH_HEALTH_URL     || 'http://127.0.0.1:3000/api/health';
const COOLDOWN_MS     = parseInt(process.env.RECOVERY_COOLDOWN_MS || '120000', 10); // 2 min între recuperări
const MAX_RECOVERIES  = parseInt(process.env.RECOVERY_MAX         || '50',     10);

const _state = {
  name:            'recovery-engine',
  label:           'Recovery Engine',
  startedAt:       null,
  recoveryCount:   0,
  failCount:       0,
  lastRecovery:    null,
  lastError:       null,
  health:          'good',
  running:         false,
  inRecovery:      false,
  recoveryLog:     [],
  lastCooldownEnd: 0,
  plans: {
    backend_down:    { steps: ['pm2_restart_unicorn', 'wait_5s', 'health_check'],           priority: 1 },
    high_error_rate: { steps: ['pm2_restart_unicorn', 'wait_5s', 'health_check'],           priority: 2 },
    cascade_failure: { steps: ['pm2_restart_all_critical', 'wait_10s', 'health_check'],     priority: 1 },
    high_memory:     { steps: ['trigger_gc', 'wait_2s', 'health_check'],                    priority: 3 },
    high_cpu:        { steps: ['trigger_gc', 'health_check'],                               priority: 3 },
    high_disk:       { steps: ['log_cleanup', 'health_check'],                              priority: 2 },
    rollback:        { steps: ['rollback_last_backup', 'wait_10s', 'pm2_restart_unicorn', 'health_check'], priority: 1 },
  },
};

// ── Acțiuni atomice de recuperare ─────────────────────────────────────────────
const ACTIONS = {
  pm2_restart_unicorn: () => _pm2(['restart', 'unicorn']),
  pm2_restart_all_critical: () => _pm2([
    'restart',
    'unicorn', 'unicorn-orchestrator', 'unicorn-health-guardian',
  ]),
  wait_2s:  () => new Promise(r => setTimeout(r, 2000)),
  wait_5s:  () => new Promise(r => setTimeout(r, 5000)),
  wait_10s: () => new Promise(r => setTimeout(r, 10000)),
  health_check: async () => {
    const ok = await _httpGet(HEALTH_URL);
    if (!ok) throw new Error('Health check eșuat după recuperare');
    return true;
  },
  trigger_gc: () => {
    if (global.gc) global.gc();
    return true;
  },
  log_cleanup: () => {
    // Semnalizăm auto-optimize prin event sau direct
    try {
      const opt = require('./auto-optimize');
      if (opt && opt.runOptimizeCycle) opt.runOptimizeCycle().catch(() => {});
    } catch { /* opcional */ }
    return true;
  },
  rollback_last_backup: () => _execSh(['bash', 'scripts/rollback-last-backup.sh']),
};

function _pm2(args) {
  return new Promise((resolve) => {
    const allowed = ['restart', 'start', 'stop'];
    if (!allowed.includes(args[0])) return resolve(false);
    execFile('pm2', args, { timeout: 20000 }, (err) => resolve(!err));
  });
}

function _execSh(args) {
  return new Promise((resolve) => {
    execFile(args[0], args.slice(1), { timeout: 30000, cwd: path.join(__dirname, '..', '..') }, (err) => resolve(!err));
  });
}

function _httpGet(url) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { timeout: 5000 }, (res) => resolve(res.statusCode < 500));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch { resolve(false); }
  });
}

// ── Execuție plan de recuperare ───────────────────────────────────────────────
async function executeRecovery(trigger, planName) {
  if (_state.inRecovery) {
    console.warn(`[recovery-engine] Deja în recuperare — ignorăm ${trigger}`);
    return false;
  }
  if (Date.now() < _state.lastCooldownEnd) {
    console.warn(`[recovery-engine] Cooldown activ — ignorăm ${trigger}`);
    _state.stats && (_state.stats.suppressedRuns = (_state.stats?.suppressedRuns || 0) + 1);
    return false;
  }
  if (_state.recoveryCount >= MAX_RECOVERIES) {
    console.warn('[recovery-engine] Limită recuperări atinsă');
    return false;
  }

  const plan = _state.plans[planName] || _state.plans.backend_down;
  _state.inRecovery = true;
  _state.health     = 'recovering';

  const entry = {
    ts:       new Date().toISOString(),
    trigger,
    plan:     planName,
    steps:    [],
    success:  false,
  };

  console.log(`🚑 [recovery-engine] Recuperare: ${planName} (trigger: ${trigger})`);

  let allOk = true;
  for (const step of plan.steps) {
    const action = ACTIONS[step];
    if (!action) continue;
    try {
      await action();
      entry.steps.push({ step, ok: true });
    } catch (e) {
      entry.steps.push({ step, ok: false, error: e.message });
      allOk = false;
      _state.lastError = e.message;
      console.error(`❌ [recovery-engine] Step "${step}" eșuat: ${e.message}`);
      break;
    }
  }

  entry.success  = allOk;
  entry.duration = Date.now() - new Date(entry.ts).getTime();
  _state.recoveryLog.unshift(entry);
  if (_state.recoveryLog.length > 20) _state.recoveryLog.length = 20;

  if (allOk) {
    _state.recoveryCount++;
    console.log(`✅ [recovery-engine] Recuperare completă: ${planName}`);
  } else {
    _state.failCount++;
    console.error(`❌ [recovery-engine] Recuperare EȘUATĂ: ${planName}`);
  }

  _state.lastRecovery  = new Date().toISOString();
  _state.lastCooldownEnd = Date.now() + COOLDOWN_MS;
  _state.inRecovery    = false;
  _state.health        = 'good';
  return allOk;
}

function start() {
  if (_state.running) return;
  _state.running   = true;
  _state.startedAt = new Date().toISOString();
  console.log(`🚑 [recovery-engine] Pornit — cooldown: ${COOLDOWN_MS}ms`);
}

function stop() {
  _state.running = false;
}

function getStatus() {
  return {
    ..._state,
    availablePlans: Object.keys(_state.plans),
    memMB:          Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec:      Math.round(process.uptime()),
  };
}

async function run(input = {}) {
  const { trigger = 'manual', plan = 'backend_down' } = input;
  const ok = await executeRecovery(trigger, plan);
  return {
    status:    ok ? 'recovered' : 'failed',
    module:    _state.name,
    trigger,
    plan,
    timestamp: new Date().toISOString(),
  };
}

start();

module.exports = { start, stop, run, getStatus, executeRecovery, name: 'recovery-engine' };
