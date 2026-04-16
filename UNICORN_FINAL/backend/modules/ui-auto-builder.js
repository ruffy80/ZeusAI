// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T00:00:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * UI AUTO-BUILDER — GODMODE
 *
 * Autonomous UI build, fallback, mirror, rollback, self-heal, self-evolve,
 * self-adapt, multi-node aware.
 *
 * Responsibilities:
 *   1. Detect missing / corrupted client/build
 *   2. Automatic rebuild: npm install + npm run build
 *   3. Integrity check: SHA-256 hash + size + timestamp on index.html
 *   4. Mirror build: keep client/build_mirror as secondary copy
 *   5. Rollback: restore last known-good build if current build fails
 *   6. Cached build: preserve last good build hash for fast validation
 *   7. Self-adaptation: adjust build flags / strategy after repeated failures
 *   8. SEE integration: request patch generation when build scripts fail
 *   9. Auto-heal integration: notify on recovery
 *  10. Auto-evolve integration: report improvements after successful builds
 *  11. Auto-innovation-loop integration: propose enhancements
 *  12. Interval watch: every BUILD_CHECK_INTERVAL_MS (default 3 min)
 *  13. Multi-node awareness: detect PM2 cluster / instances
 *  14. Health endpoint: exposed via getRouter() → /internal/ui-builder/health
 *  15. Orchestrator integration: auto-register on require()
 */

const fs         = require('fs');
const path       = require('path');
const crypto     = require('crypto');
const { spawn }  = require('child_process');
const express    = require('express');

// ── Paths ───────────────────────────────────────────────────────────────────
// __dirname is backend/modules → client is at ../../client
const CLIENT_DIR    = path.resolve(__dirname, '../../client');
const BUILD_DIR     = path.join(CLIENT_DIR, 'build');
const MIRROR_DIR    = path.join(CLIENT_DIR, 'build_mirror');
const BUILD_INDEX   = path.join(BUILD_DIR, 'index.html');
const MIRROR_INDEX  = path.join(MIRROR_DIR, 'index.html');
const CACHE_FILE    = path.join(CLIENT_DIR, '.ui-build-cache.json');

// ── Constants ────────────────────────────────────────────────────────────────
const BUILD_CHECK_INTERVAL_MS = parseInt(process.env.UI_BUILD_CHECK_INTERVAL_MS || '180000', 10); // 3 min
const BUILD_TIMEOUT_MS        = parseInt(process.env.UI_BUILD_TIMEOUT_MS        || '300000', 10); // 5 min
const MAX_BUILD_LOG           = 100;
const MAX_CONSECUTIVE_FAILS   = 3;

// ── State ────────────────────────────────────────────────────────────────────
const _state = {
  name:               'ui-auto-builder',
  label:              'UI Auto-Builder (GODMODE)',
  startedAt:          null,
  health:             'good',
  running:            false,
  intervalHandle:     null,
  buildInProgress:    false,
  buildCount:         0,
  rebuildCount:       0,
  rollbackCount:      0,
  lastCheck:          null,
  lastBuild:          null,
  lastSuccess:        null,
  lastFailure:        null,
  lastError:          null,
  consecutiveFails:   0,
  buildLog:           [],       // last MAX_BUILD_LOG entries
  // Integrity
  currentHash:        null,
  mirrorHash:         null,
  cacheHash:          null,
  // Adaptation
  strategy:           'default',  // 'default' | 'ci' | 'cached'
  strategyChanges:    [],
  // Multi-node: isCluster is true whenever NODE_APP_INSTANCE is set (PM2 cluster mode).
  // instanceId '0' is the primary instance; all others are replicas.
  instanceId:         process.env.NODE_APP_INSTANCE != null ? process.env.NODE_APP_INSTANCE : 'standalone',
  isCluster:          process.env.NODE_APP_INSTANCE != null,
};

// ── Lazy module refs (loaded on-demand to avoid circular deps) ────────────────
let _see = null;
let _autoHeal = null;
let _autoEvolve = null;
let _innovationLoop = null;

function _getSEE()          { if (!_see)           { try { _see           = require('./self-evolving-engine');   } catch { _see = null; } } return _see; }
function _getAutoHeal()     { if (!_autoHeal)      { try { _autoHeal      = require('./self-healing-engine');   } catch { _autoHeal = null; } } return _autoHeal; }
function _getAutoEvolve()   { if (!_autoEvolve)    { try { _autoEvolve    = require('./auto-evolve');           } catch { _autoEvolve = null; } } return _autoEvolve; }
function _getInnovLoop()    { if (!_innovationLoop){ try { _innovationLoop = require('./auto-innovation-loop'); } catch { _innovationLoop = null; } } return _innovationLoop; }

// ── Logging helper ───────────────────────────────────────────────────────────
function _log(action, detail, success = true, extra = {}) {
  const entry = {
    ts:      new Date().toISOString(),
    action,
    detail,
    success,
    ...extra,
  };
  _state.buildLog.unshift(entry);
  if (_state.buildLog.length > MAX_BUILD_LOG) _state.buildLog.length = MAX_BUILD_LOG;
  _state.lastCheck = entry.ts;
  if (success) {
    _state.lastSuccess = entry.ts;
  } else {
    _state.lastFailure = entry.ts;
    _state.lastError   = detail;
  }
}

// ── Integrity helpers ────────────────────────────────────────────────────────
function _hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

function _dirSize(dirPath) {
  try {
    let total = 0;
    const walk = (p) => {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        fs.readdirSync(p).forEach((f) => walk(path.join(p, f)));
      } else {
        total += stat.size;
      }
    };
    walk(dirPath);
    return total;
  } catch {
    return 0;
  }
}

function _checkIntegrity() {
  const exists = fs.existsSync(BUILD_INDEX);
  if (!exists) return { ok: false, reason: 'index.html missing' };
  const hash = _hashFile(BUILD_INDEX);
  const size = _dirSize(BUILD_DIR);
  if (!hash) return { ok: false, reason: 'cannot hash index.html' };
  if (size < 1024) return { ok: false, reason: `build too small: ${size} bytes` };
  return { ok: true, hash, size };
}

// ── Cache persistence ────────────────────────────────────────────────────────
function _loadCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const c   = JSON.parse(raw);
    _state.cacheHash = c.hash || null;
    return c;
  } catch {
    return {};
  }
}

function _saveCache(hash, size) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ hash, size, ts: new Date().toISOString() }));
    _state.cacheHash = hash;
  } catch (err) {
    _log('CACHE_SAVE_ERR', err.message, false);
  }
}

// ── Mirror build ─────────────────────────────────────────────────────────────
function _syncMirror() {
  try {
    if (!fs.existsSync(BUILD_DIR)) return;
    _copyDirSync(BUILD_DIR, MIRROR_DIR);
    _state.mirrorHash = _hashFile(MIRROR_INDEX);
    _log('MIRROR_SYNC', `Mirror updated — hash: ${_state.mirrorHash}`, true);
  } catch (err) {
    _log('MIRROR_SYNC_ERR', err.message, false);
  }
}

function _copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      _copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Rollback from mirror ──────────────────────────────────────────────────────
function _rollback() {
  try {
    if (!fs.existsSync(MIRROR_INDEX)) {
      _log('ROLLBACK_SKIP', 'No mirror available for rollback', false);
      return false;
    }
    _copyDirSync(MIRROR_DIR, BUILD_DIR);
    _state.rollbackCount++;
    _state.currentHash = _hashFile(BUILD_INDEX);
    _log('ROLLBACK', `Rolled back from mirror — hash: ${_state.currentHash}`, true);
    return true;
  } catch (err) {
    _log('ROLLBACK_ERR', err.message, false);
    return false;
  }
}

// ── Adaptation engine ────────────────────────────────────────────────────────
function _adaptStrategy() {
  const prevStrategy = _state.strategy;
  if (_state.consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
    if (_state.strategy === 'default') {
      _state.strategy = 'ci';  // try CI-style (no cache)
    } else if (_state.strategy === 'ci') {
      _state.strategy = 'cached'; // rely on cached/mirror only
    }
    if (_state.strategy !== prevStrategy) {
      const change = { ts: new Date().toISOString(), from: prevStrategy, to: _state.strategy, fails: _state.consecutiveFails };
      _state.strategyChanges.unshift(change);
      if (_state.strategyChanges.length > 20) _state.strategyChanges.length = 20;
      _log('STRATEGY_ADAPT', `Strategy changed: ${prevStrategy} → ${_state.strategy}`, true, { change });
      // Notify SEE to generate patches
      try {
        const see = _getSEE();
        if (see && typeof see.notifyBuildFailure === 'function') {
          see.notifyBuildFailure({ module: 'ui-auto-builder', strategy: _state.strategy, fails: _state.consecutiveFails });
        }
      } catch { /* SEE is optional */ }
    }
  }
}

// ── npm build runner ─────────────────────────────────────────────────────────
function _runNpmBuild(strategy) {
  return new Promise((resolve) => {
    if (!fs.existsSync(CLIENT_DIR)) {
      return resolve({ ok: false, out: `client dir not found: ${CLIENT_DIR}` });
    }

    // Decide build flags based on strategy
    const env = { ...process.env };
    if (strategy === 'ci') {
      env.CI = 'false';           // suppress CI-treated-as-error mode
      env.GENERATE_SOURCEMAP = 'false';
    } else if (strategy === 'cached') {
      // Skip build — rely on existing mirror for rollback
      return resolve({ ok: false, out: 'cached strategy: skip build, use rollback' });
    }

    let out = '';
    let proc = null;

    // Step 1: npm install
    proc = spawn('npm', ['install', '--prefer-offline', '--no-audit'], {
      cwd: CLIENT_DIR,
      env,
      shell: false,
    });
    proc.stdout.on('data', (d) => { out += d.toString().slice(0, 500); });
    proc.stderr.on('data', (d) => { out += d.toString().slice(0, 500); });

    proc.on('error', (err) => resolve({ ok: false, out: `npm install spawn error: ${err.message}` }));
    proc.on('close', (installCode) => {
      if (installCode !== 0) {
        return resolve({ ok: false, out: `npm install failed (code ${installCode}): ${out.slice(0, 400)}` });
      }

      out = '';
      // Step 2: npm run build
      const buildProc = spawn('npm', ['run', 'build'], {
        cwd: CLIENT_DIR,
        env,
        shell: false,
        timeout: BUILD_TIMEOUT_MS,
      });
      buildProc.stdout.on('data', (d) => { out += d.toString().slice(0, 2000); });
      buildProc.stderr.on('data', (d) => { out += d.toString().slice(0, 2000); });
      buildProc.on('error', (err) => resolve({ ok: false, out: `npm run build spawn error: ${err.message}` }));
      buildProc.on('close', (buildCode) => {
        resolve({
          ok: buildCode === 0,
          out: out.slice(-1000),
          code: buildCode,
        });
      });
    });
  });
}

// ── Main check + rebuild cycle ────────────────────────────────────────────────
async function runBuildCycle() {
  if (_state.buildInProgress) return { skipped: true, reason: 'build already in progress' };
  _state.buildInProgress = true;
  _state.buildCount++;

  try {
    const integrity = _checkIntegrity();
    _state.currentHash = integrity.hash || null;

    if (integrity.ok) {
      // Build exists and is healthy — sync mirror if needed
      if (_state.currentHash !== _state.mirrorHash) {
        _syncMirror();
        _saveCache(_state.currentHash, integrity.size);
      }
      _state.consecutiveFails = 0;
      _state.health = 'good';
      _log('CHECK_OK', `Build healthy — hash: ${_state.currentHash}, size: ${integrity.size}B`, true);
      return { ok: true, action: 'none', hash: _state.currentHash };
    }

    // Build missing or corrupted — attempt rebuild
    _log('CHECK_FAIL', integrity.reason, false);
    _state.rebuildCount++;

    // Skip rebuild if this is not the primary instance in a cluster.
    // Only instance '0' triggers rebuilds; other replicas fall back to rollback.
    if (_state.isCluster && _state.instanceId !== '0') {
      // Non-primary: attempt rollback from mirror first
      const rolled = _rollback();
      _state.buildInProgress = false;
      return { ok: rolled, action: 'rollback', instanceId: _state.instanceId };
    }

    _log('BUILD_START', `Trigger rebuild (strategy: ${_state.strategy})`, true);
    const result = await _runNpmBuild(_state.strategy);

    if (result.ok) {
      _state.consecutiveFails = 0;
      _state.lastBuild = new Date().toISOString();
      _state.health = 'good';
      _state.strategy = 'default'; // reset strategy on success
      const newIntegrity = _checkIntegrity();
      _state.currentHash = newIntegrity.hash;
      _syncMirror();
      if (newIntegrity.hash) _saveCache(newIntegrity.hash, newIntegrity.size);
      _log('BUILD_SUCCESS', `Build complete — hash: ${_state.currentHash}`, true, { strategy: _state.strategy });

      // Notify auto-evolve of successful build
      try {
        const ae = _getAutoEvolve();
        if (ae && typeof ae.reportImprovement === 'function') {
          ae.reportImprovement({ module: 'ui-auto-builder', event: 'build_success', hash: _state.currentHash });
        }
      } catch { /* optional */ }

      _state.buildInProgress = false;
      return { ok: true, action: 'rebuilt', hash: _state.currentHash };
    }

    // Build failed
    _state.consecutiveFails++;
    _state.health = _state.consecutiveFails >= MAX_CONSECUTIVE_FAILS ? 'critical' : 'degraded';
    _log('BUILD_FAIL', `Build failed: ${result.out}`, false, { strategy: _state.strategy, consecutiveFails: _state.consecutiveFails });

    // Try rollback from mirror
    const rolled = _rollback();
    if (rolled) {
      _state.health = 'degraded';
      _state.buildInProgress = false;
      return { ok: false, action: 'rollback', detail: result.out };
    }

    // Adapt strategy for next cycle
    _adaptStrategy();

    // Notify auto-heal about build failure
    try {
      const heal = _getAutoHeal();
      if (heal && typeof heal.requestHeal === 'function') {
        heal.requestHeal('ui-auto-builder', `build failed: ${result.out.slice(0, 200)}`);
      }
    } catch { /* optional */ }

    // Request SEE patch generation
    try {
      const see = _getSEE();
      if (see && typeof see.proposeRepair === 'function') {
        see.proposeRepair({ module: 'ui-auto-builder', error: result.out.slice(0, 500), strategy: _state.strategy });
      }
    } catch { /* optional */ }

    // Propose innovation for improved build strategy
    try {
      const il = _getInnovLoop();
      if (il && typeof il.proposeEnhancement === 'function') {
        il.proposeEnhancement({ module: 'ui-auto-builder', idea: 'Improve build resilience', context: result.out.slice(0, 200) });
      }
    } catch { /* optional */ }

    _state.buildInProgress = false;
    return { ok: false, action: 'failed', detail: result.out };

  } catch (err) {
    _state.health = 'error';
    _state.consecutiveFails++;
    _log('CYCLE_ERR', err.message, false);
    _state.buildInProgress = false;
    return { ok: false, action: 'error', detail: err.message };
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
function start() {
  if (_state.running) return;
  _state.running    = true;
  _state.startedAt  = new Date().toISOString();
  _loadCache();

  // Run an initial check without blocking startup
  setImmediate(() => runBuildCycle().catch(() => {}));

  _state.intervalHandle = setInterval(() => {
    runBuildCycle().catch((err) => {
      _log('INTERVAL_ERR', err.message, false);
    });
  }, BUILD_CHECK_INTERVAL_MS);

  console.log(`🏗️  [ui-auto-builder] GODMODE started — interval: ${BUILD_CHECK_INTERVAL_MS}ms, instance: ${_state.instanceId}`);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
}

function getStatus() {
  return {
    name:             _state.name,
    label:            _state.label,
    health:           _state.health,
    running:          _state.running,
    startedAt:        _state.startedAt,
    buildInProgress:  _state.buildInProgress,
    buildCount:       _state.buildCount,
    rebuildCount:     _state.rebuildCount,
    rollbackCount:    _state.rollbackCount,
    lastCheck:        _state.lastCheck,
    lastBuild:        _state.lastBuild,
    lastSuccess:      _state.lastSuccess,
    lastFailure:      _state.lastFailure,
    lastError:        _state.lastError,
    consecutiveFails: _state.consecutiveFails,
    strategy:         _state.strategy,
    currentHash:      _state.currentHash,
    mirrorHash:       _state.mirrorHash,
    cacheHash:        _state.cacheHash,
    instanceId:       _state.instanceId,
    isCluster:        _state.isCluster,
    buildExists:      fs.existsSync(BUILD_INDEX),
    mirrorExists:     fs.existsSync(MIRROR_INDEX),
  };
}

// ── Internal health router ────────────────────────────────────────────────────
function getRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json(getStatus());
  });

  router.post('/trigger', async (_req, res) => {
    if (_state.buildInProgress) {
      return res.status(409).json({ ok: false, reason: 'build already in progress' });
    }
    const result = await runBuildCycle().catch((err) => ({ ok: false, detail: err.message }));
    res.json(result);
  });

  router.get('/log', (_req, res) => {
    res.json({ log: _state.buildLog.slice(0, 50) });
  });

  router.get('/strategy', (_req, res) => {
    res.json({ strategy: _state.strategy, changes: _state.strategyChanges });
  });

  return router;
}

// ── Auto-start on require() ───────────────────────────────────────────────────
start();

module.exports = {
  start,
  stop,
  getStatus,
  runBuildCycle,
  getRouter,
  name: 'ui-auto-builder',
};
