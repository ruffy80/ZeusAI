'use strict';

const crypto = require('crypto');
const { publicKeyBase64 } = require('../witness/signer');

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || '') + '|' + publicKeyBase64()).digest('hex');
}

function allow(db, ipHash) {
  const max = Math.max(1, Number(process.env.SCORE_MAX_PER_IP_PER_DAY || 3));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = db.prepare(
    'SELECT COUNT(*) AS n FROM viral_events WHERE event_type = ? AND ip_hash = ? AND created_at >= ?'
  ).get('score_created', ipHash, since);
  return { ok: (row && row.n || 0) < max, used: row && row.n || 0, max };
}

module.exports = { hashIp, allow };
