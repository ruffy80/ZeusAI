// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-14T11:18:56.170Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== UNICORN SUPER INTELLIGENCE — MEMORY MODULE ====================
// Gestionează memoria pe termen scurt și lung a unicornului

const _state = {
  name: 'usi-memory',
  label: 'USI Memory',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'good',
  shortTermMemory: [],
  longTermMemory: [],
};

function init() {
  _state.startedAt = new Date().toISOString();
  console.log('🦄 USI Memory Module activat.');
}

function store(key, value, type = 'short') {
  const entry = { key, value, ts: new Date().toISOString() };
  if (type === 'long') {
    _state.longTermMemory.push(entry);
    if (_state.longTermMemory.length > 1000) _state.longTermMemory.shift();
  } else {
    _state.shortTermMemory.push(entry);
    if (_state.shortTermMemory.length > 100) _state.shortTermMemory.shift();
  }
  return entry;
}

function recall(key) {
  return [..._state.shortTermMemory, ..._state.longTermMemory].filter(e => e.key === key);
}

async function process(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  if (input.store) store(input.key || 'default', input.value, input.type);
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    input,
    processCount: _state.processCount,
    shortTermSize: _state.shortTermMemory.length,
    longTermSize: _state.longTermMemory.length,
    timestamp: _state.lastRun,
  };
}

function getStatus() {
  return { ..._state, shortTermSize: _state.shortTermMemory.length, longTermSize: _state.longTermMemory.length };
}

init();

module.exports = { process, getStatus, init, store, recall, name: 'usi-memory' };
