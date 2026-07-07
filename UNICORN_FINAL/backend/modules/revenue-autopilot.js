'use strict';

let runs = 0;

function runOnce() {
  runs += 1;
  return { ok: true, runs, ts: new Date().toISOString() };
}

function status() {
  return { ok: true, runs, intervalMs: 300000, ts: new Date().toISOString() };
}

module.exports = { runOnce, status };
