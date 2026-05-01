// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * PREDICTIVE-HEALING BRIDGE (complementary)
 *
 * Connects the existing predictive-healing module (predictions only) to
 * the existing self-healing-engine (action) WITHOUT modifying either.
 * Subscribes to predictive-healing's 'prediction' bus events, persists
 * a JSON-lines log, and forwards a 'preempt' suggestion to self-healing
 * via its public emit method (if available). Falls back to logging.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '..', '..', '..', 'data', 'predictive-healing');
const LOG_FILE = path.join(LOG_DIR, 'predictions.jsonl');

const _state = {
  name: 'predictive-healing-bridge',
  startedAt: null,
  forwarded: 0,
  lastPrediction: null,
  lastError: null,
};

function _persist(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) { _state.lastError = e && e.message; }
}

function _forwardToHealer(prediction) {
  try {
    const healer = require('../self-healing-engine');
    if (healer && typeof healer.emit === 'function') {
      healer.emit('predictive:warning', prediction);
    } else if (healer && typeof healer.handlePredictiveWarning === 'function') {
      healer.handlePredictiveWarning(prediction);
    }
    _state.forwarded += 1;
  } catch (e) { _state.lastError = e && e.message; }
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();

  try {
    const predictive = require('../predictive-healing');
    if (predictive && typeof predictive.on === 'function') {
      predictive.on('prediction', (p) => {
        const entry = { at: new Date().toISOString(), prediction: p };
        _state.lastPrediction = entry;
        _persist(entry);
        if (p && (p.severity === 'high' || p.severity === 'critical')) {
          _forwardToHealer(p);
        }
      });
      if (typeof predictive.init === 'function') {
        try { predictive.init(); } catch (_) { /* may already be running */ }
      }
    }
  } catch (e) { _state.lastError = e && e.message; }

  if (app && typeof app.get === 'function') {
    app.get('/api/healing/predictions', (_req, res) => {
      let recent = [];
      try {
        const data = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-50);
        recent = data.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
      } catch (_) { /* file may not exist yet */ }
      res.json({ ok: true, state: _state, recent });
    });
  }
}

function getStatus() { return { ..._state }; }

module.exports = { name: 'predictive-healing-bridge', init, getStatus };
