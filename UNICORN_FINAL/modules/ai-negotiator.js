'use strict';

function negotiate(input = {}) {
  return { ok: true, accepted: true, input, ts: new Date().toISOString() };
}

module.exports = { negotiate };
