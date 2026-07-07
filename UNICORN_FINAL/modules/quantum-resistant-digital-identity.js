'use strict';

function getStatus() {
  return { ok: true, module: 'quantum-resistant-digital-identity', active: true, ts: new Date().toISOString() };
}

module.exports = { getStatus };
