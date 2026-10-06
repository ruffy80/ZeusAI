'use strict';

/**
 * usi-memory — bounded in-process memory for the super-intelligence names.
 * remember/recall/forget are real. Nothing is written to disk.
 */

const MAX = 200;
const store = new Map();

function remember(key, value) {
  const id = String(key || '').slice(0, 160);
  if (!id) return { ok: false, reason: 'missing_key' };
  if (store.size >= MAX && !store.has(id)) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(id, { value, at: new Date().toISOString() });
  return { ok: true, key: id, size: store.size };
}

function recall(key) {
  const id = String(key || '');
  const row = store.get(id);
  if (!row) return { ok: false, found: false, key: id };
  return { ok: true, found: true, key: id, value: row.value, at: row.at };
}

function forget(key) {
  const id = String(key || '');
  const removed = store.delete(id);
  return { ok: true, removed, size: store.size };
}

function getStatus() {
  return {
    ok: true,
    name: 'usi-memory',
    size: store.size,
    max: MAX,
    persistent: false,
    inventsMemory: false,
  };
}

module.exports = { remember, recall, forget, getStatus, name: 'usi-memory' };
