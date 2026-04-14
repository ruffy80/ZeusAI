// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== ERROR PATTERN DETECTOR ====================
// Detectează tipare de erori repetitive în sistem:
// - Erori recurente (același mesaj în ferestre de timp)
// - Cascade failures (erori multiple în lanț)
// - Erori sistematice (apar regulat la interval fix)
// - Semnalizează recovery engine-ul când detectează pattern periculos

const _state = {
  name:          'error-pattern-detector',
  label:         'Error Pattern Detector',
  startedAt:     null,
  analyzeCount:  0,
  lastAnalysis:  null,
  lastError:     null,
  health:        'good',
  running:       false,
  intervalHandle: null,
  patterns:      [],     // tipare detectate activ
  errorBuffer:   [],     // buffer cirular cu ultimele 500 erori
  detections:    [],     // ultimele 20 detecții
  stats: {
    totalErrors:    0,
    patternsFound:  0,
    cascadesFound:  0,
    suppressedRuns: 0,
  },
};

const ANALYZE_INTERVAL_MS  = parseInt(process.env.ERROR_PATTERN_INTERVAL_MS || '60000', 10);
const BUFFER_MAX           = 500;
const RECURRENCE_WINDOW_MS = 300000; // 5 min
const RECURRENCE_THRESHOLD = 5;      // 5 apariții identice în 5 min → pattern
const CASCADE_WINDOW_MS    = 10000;  // 10s
const CASCADE_THRESHOLD    = 3;      // 3 erori diferite în 10s → cascade

// ── Adăugare eroare în buffer ─────────────────────────────────────────────────
function recordError(source, message, level = 'error') {
  const entry = {
    ts:      Date.now(),
    source:  String(source).slice(0, 100),
    message: String(message).slice(0, 500),
    level,
    key:     _fingerprint(source, message),
  };
  _state.errorBuffer.unshift(entry);
  if (_state.errorBuffer.length > BUFFER_MAX) _state.errorBuffer.length = BUFFER_MAX;
  _state.stats.totalErrors++;
}

// ── Fingerprint simplu: primele 80 de caractere normalizate ──────────────────
function _fingerprint(source, message) {
  return `${source}::${String(message).replace(/\d+/g, 'N').slice(0, 80)}`;
}

// ── Detectare erori recurente ────────────────────────────────────────────────
function _detectRecurrence() {
  const now = Date.now();
  const window = _state.errorBuffer.filter(e => (now - e.ts) < RECURRENCE_WINDOW_MS);

  // Contorizare per fingerprint
  const freq = {};
  for (const e of window) {
    freq[e.key] = (freq[e.key] || 0) + 1;
  }

  const found = [];
  for (const [key, count] of Object.entries(freq)) {
    if (count >= RECURRENCE_THRESHOLD) {
      found.push({ type: 'recurrence', key, count, window: RECURRENCE_WINDOW_MS });
    }
  }
  return found;
}

// ── Detectare cascade failures ────────────────────────────────────────────────
function _detectCascade() {
  const now = Date.now();
  const window = _state.errorBuffer.filter(e => (now - e.ts) < CASCADE_WINDOW_MS);

  const uniqueKeys = new Set(window.map(e => e.key));
  if (uniqueKeys.size >= CASCADE_THRESHOLD) {
    return [{ type: 'cascade', uniqueErrors: uniqueKeys.size, window: CASCADE_WINDOW_MS }];
  }
  return [];
}

// ── Ciclu complet de analiză ──────────────────────────────────────────────────
function analyze() {
  const recurrence = _detectRecurrence();
  const cascade    = _detectCascade();
  const allPatterns = [...recurrence, ...cascade];

  _state.analyzeCount++;
  _state.lastAnalysis = new Date().toISOString();
  _state.stats.patternsFound  += recurrence.length;
  _state.stats.cascadesFound  += cascade.length;

  if (allPatterns.length > 0) {
    _state.health = cascade.length > 0 ? 'critical' : 'degraded';
    for (const p of allPatterns) {
      const entry = { ts: new Date().toISOString(), ...p };
      _state.detections.unshift(entry);
      console.warn(`🔎 [error-pattern-detector] Pattern detectat: ${p.type} (${JSON.stringify(p)})`);
    }
    if (_state.detections.length > 20) _state.detections.length = 20;
  } else {
    _state.health = 'good';
  }

  _state.patterns = allPatterns;
  return allPatterns;
}

function start() {
  if (_state.running) return;
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    try { analyze(); } catch (e) { _state.lastError = e.message; }
  }, ANALYZE_INTERVAL_MS);

  console.log(`🔎 [error-pattern-detector] Pornit — interval: ${ANALYZE_INTERVAL_MS}ms`);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
}

function getStatus() {
  return {
    ..._state,
    bufferSize: _state.errorBuffer.length,
    memMB:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec:  Math.round(process.uptime()),
  };
}

async function run(input = {}) {
  if (input.error) recordError(input.source || 'api', input.error);
  const patterns = analyze();
  return {
    status:   'ok',
    module:   _state.name,
    patterns,
    stats:    _state.stats,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, recordError, analyze, name: 'error-pattern-detector' };
