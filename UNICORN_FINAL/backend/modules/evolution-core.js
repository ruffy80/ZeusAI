// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
// ==================== EVOLUTION CORE ====================
// Tracks the evolution of the Unicorn platform over time.
// Computes a fingerprint of the codebase (modules + routes + version)
// each cycle, detects diffs vs. the previous fingerprint, and persists
// "evolution events" to a JSONL ledger. Designed to feed the innovation
// dashboard with a real, auditable timeline of platform changes.
//
// Storage: <repo>/UNICORN_FINAL/data/evolution/evolution-ledger.jsonl
//          (auto-created; appended one event per detected diff)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const SCAN_INTERVAL_MS = 5 * 60_000; // 5 minutes
const LEDGER_DIR  = path.join(__dirname, '..', '..', 'data', 'evolution');
const LEDGER_FILE = path.join(LEDGER_DIR, 'evolution-ledger.jsonl');
const FINGERPRINT_FILE = path.join(LEDGER_DIR, 'last-fingerprint.json');
const MODULES_DIR = path.join(__dirname);   // .../backend/modules
const PKG_FILE    = path.join(__dirname, '..', '..', 'package.json');

const _state = {
  name: 'evolution-core',
  label: 'Evolution Core',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'unknown',
  generation: 0,
  fingerprint: null,
  lastDiff: null,
  events: [],
  timer: null,
};

const _bus = new EventEmitter();

function _ensureDir() {
  try { fs.mkdirSync(LEDGER_DIR, { recursive: true }); } catch (_) { /* noop */ }
}

function _readPackage() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_FILE, 'utf8'));
    return { name: pkg.name, version: pkg.version };
  } catch (_) { return { name: 'unknown', version: '0.0.0' }; }
}

function _listModules() {
  try {
    return fs.readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.js'))
      .map(e => e.name)
      .sort();
  } catch (_) { return []; }
}

function _hashModulesShallow(modules) {
  // Hash module names + sizes (cheap, no full content read).
  const h = crypto.createHash('sha256');
  for (const name of modules) {
    let size = 0;
    try { size = fs.statSync(path.join(MODULES_DIR, name)).size; } catch (_) { /* noop */ }
    h.update(`${name}:${size}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

function _computeFingerprint() {
  const pkg = _readPackage();
  const modules = _listModules();
  const moduleHash = _hashModulesShallow(modules);
  const fp = {
    at: new Date().toISOString(),
    pkgVersion: pkg.version,
    moduleCount: modules.length,
    moduleHash,
    modules, // full list — small enough; used for diffs
  };
  fp.fingerprint = crypto.createHash('sha256')
    .update(`${fp.pkgVersion}|${fp.moduleCount}|${fp.moduleHash}`).digest('hex').slice(0, 16);
  return fp;
}

function _loadLastFingerprint() {
  try { return JSON.parse(fs.readFileSync(FINGERPRINT_FILE, 'utf8')); }
  catch (_) { return null; }
}

function _saveFingerprint(fp) {
  try { fs.writeFileSync(FINGERPRINT_FILE, JSON.stringify(fp, null, 2)); }
  catch (_) { /* noop */ }
}

function _diff(prev, curr) {
  if (!prev) return { firstRun: true };
  const prevSet = new Set(prev.modules || []);
  const currSet = new Set(curr.modules || []);
  const added = [...currSet].filter(m => !prevSet.has(m));
  const removed = [...prevSet].filter(m => !currSet.has(m));
  const versionChanged = prev.pkgVersion !== curr.pkgVersion;
  const hashChanged = prev.moduleHash !== curr.moduleHash;
  if (!added.length && !removed.length && !versionChanged && !hashChanged) return null;
  return {
    addedModules: added,
    removedModules: removed,
    versionFrom: prev.pkgVersion,
    versionTo: curr.pkgVersion,
    moduleHashFrom: prev.moduleHash,
    moduleHashTo: curr.moduleHash,
  };
}

function _appendLedger(event) {
  try { fs.appendFileSync(LEDGER_FILE, JSON.stringify(event) + '\n'); }
  catch (_) { /* noop */ }
}

function _scan() {
  try {
    _ensureDir();
    const fp = _computeFingerprint();
    const prev = _state.fingerprint || _loadLastFingerprint();
    const diff = _diff(prev, fp);

    _state.fingerprint = fp;

    if (diff) {
      _state.generation += 1;
      const event = {
        type: diff.firstRun ? 'genesis' : 'evolution',
        generation: _state.generation,
        at: fp.at,
        fingerprint: fp.fingerprint,
        moduleCount: fp.moduleCount,
        diff,
      };
      _state.lastDiff = event;
      _state.events.push(event);
      if (_state.events.length > 200) _state.events.shift();
      _appendLedger(event);
      _saveFingerprint(fp);
      _bus.emit('evolution', event);
    }

    _state.health = 'good';
    _state.lastRun = fp.at;
  } catch (err) {
    _state.health = 'error';
    _state.lastError = err.message;
  }
}

function init() {
  if (_state.timer) return;
  _state.startedAt = new Date().toISOString();
  _scan(); // immediate scan to establish baseline
  _state.timer = setInterval(_scan, SCAN_INTERVAL_MS);
  if (typeof _state.timer.unref === 'function') _state.timer.unref();
  console.log('🦄 Evolution Core activat (real codebase fingerprinting + ledger).');
}

function stop() {
  if (_state.timer) { clearInterval(_state.timer); _state.timer = null; }
}

async function process(input = {}) {
  _state.processCount++;
  if (input && input.forceScan) _scan();
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    processCount: _state.processCount,
    health: _state.health,
    generation: _state.generation,
    fingerprint: _state.fingerprint && _state.fingerprint.fingerprint,
    lastDiff: _state.lastDiff,
    timestamp: _state.lastRun || new Date().toISOString(),
  };
}

function getStatus() {
  return {
    name: _state.name,
    label: _state.label,
    startedAt: _state.startedAt,
    lastRun: _state.lastRun,
    processCount: _state.processCount,
    health: _state.health,
    generation: _state.generation,
    fingerprint: _state.fingerprint && _state.fingerprint.fingerprint,
    moduleCount: _state.fingerprint && _state.fingerprint.moduleCount,
    pkgVersion: _state.fingerprint && _state.fingerprint.pkgVersion,
    eventsTotal: _state.events.length,
    ledgerFile: LEDGER_FILE,
  };
}

function getRecentEvents(limit = 20) { return _state.events.slice(-limit); }
function on(event, listener) { _bus.on(event, listener); return () => _bus.off(event, listener); }

init();

module.exports = { process, getStatus, getRecentEvents, init, stop, on, name: 'evolution-core' };
