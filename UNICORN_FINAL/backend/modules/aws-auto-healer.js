'use strict';

async function status() {
  return { ok: true, provider: 'aws', healthy: true, ts: new Date().toISOString() };
}

module.exports = { status };
