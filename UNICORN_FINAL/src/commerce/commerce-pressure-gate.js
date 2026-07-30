'use strict';

/**
 * Commerce Pressure Gate — CPG/1.0
 * Fail-closed checkout when disk/RAM is critical (shared immortality signal
 * or local statfs). Prevents silent order/DB corruption under full disk.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'CPG/1.0';

function _diskUsedPct() {
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync('/');
      const total = s.blocks * s.bsize;
      const free = s.bfree * s.bsize;
      if (total > 0) return Math.round(((total - free) / total) * 100);
    }
  } catch (_) { /* tolerate */ }
  return 0;
}

function _readSharedPressure() {
  const candidates = [
    process.env.COMMERCE_PRESSURE_FILE,
    path.join(process.env.UNICORN_DATA_DIR || '', 'immortality', 'commerce-pressure.json'),
    path.resolve(__dirname, '..', '..', 'data', 'immortality', 'commerce-pressure.json'),
    '/var/www/unicorn/shared/data/immortality/commerce-pressure.json',
  ].filter(Boolean);
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) { /* next */ }
  }
  return null;
}

function assess() {
  const diskAct = Math.max(85, Number(process.env.NDK_DISK_ACT_PCT || process.env.CPG_DISK_ACT_PCT || 92));
  const shared = _readSharedPressure();
  const diskUsedPct = (shared && shared.diskUsedPct != null) ? Number(shared.diskUsedPct) : _diskUsedPct();
  const reasons = [];
  if (shared && shared.commerceBlocked) {
    for (const r of (shared.reasons || ['shared_pressure'])) reasons.push(r);
  }
  if (diskUsedPct >= diskAct) reasons.push('disk_critical');

  // Optional: refuse when SQLite/data dir is not writable
  try {
    const dataDir = process.env.COMMERCE_DATA_DIR
      || path.join(process.env.UNICORN_DATA_DIR || path.resolve(__dirname, '..', '..', 'data'), 'commerce');
    fs.mkdirSync(dataDir, { recursive: true });
    const probe = path.join(dataDir, '.cpg-write-probe');
    fs.writeFileSync(probe, String(Date.now()));
    try { fs.unlinkSync(probe); } catch (_) { /* ok */ }
  } catch (_) {
    reasons.push('commerce_data_not_writable');
  }

  const unique = [...new Set(reasons)];
  const blocked = unique.includes('disk_critical')
    || unique.includes('ram_critical')
    || unique.includes('commerce_data_not_writable');

  return {
    ok: true,
    protocol: PROTOCOL,
    commerceBlocked: blocked,
    reasons: unique,
    diskUsedPct,
    diskActPct: diskAct,
    shared: shared ? { updatedAt: shared.updatedAt || null, health: shared.health || null } : null,
  };
}

function refusePayload(assessment) {
  return {
    error: 'commerce_paused',
    reason: (assessment && assessment.reasons && assessment.reasons[0]) || 'pressure',
    reasons: (assessment && assessment.reasons) || [],
    mode: 'unavailable',
    status: 503,
    honesty: 'Checkout refused under critical disk/RAM or unwritable commerce data — prevents silent order loss. Retry when pressure clears.',
    contactHref: '/status',
  };
}

module.exports = {
  PROTOCOL,
  assess,
  refusePayload,
};
