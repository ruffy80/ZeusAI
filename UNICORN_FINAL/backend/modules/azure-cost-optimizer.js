'use strict';

async function status() {
  return { ok: true, provider: 'azure', estimatedSavingsUsdMonth: 0, ts: new Date().toISOString() };
}

module.exports = { status };
