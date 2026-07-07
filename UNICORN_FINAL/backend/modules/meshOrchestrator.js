'use strict';

function getStatus() {
  return { ok: true, mesh: 'active', nodes: 1, ts: new Date().toISOString() };
}

module.exports = { getStatus };
