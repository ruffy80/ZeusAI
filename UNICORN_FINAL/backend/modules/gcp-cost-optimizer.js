'use strict';

async function status() {
  return { ok: true, provider: 'gcp', estimatedSavingsUsdMonth: 0, ts: new Date().toISOString() };
}

module.exports = { status };
