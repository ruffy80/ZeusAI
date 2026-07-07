'use strict';

const crypto = require('crypto');

const records = [];

function _hash(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function latest(limit = 50) {
  const l = Math.max(1, Number(limit) || 50);
  return records.slice(-l).reverse();
}

function computeAnchor() {
  const joined = records.map((r) => r.hash).join('|');
  return {
    root: _hash(joined || 'empty-anchor'),
    count: records.length,
    ts: new Date().toISOString(),
  };
}

function append(payload = {}) {
  const row = {
    ts: new Date().toISOString(),
    payload,
  };
  row.hash = _hash(JSON.stringify(row));
  records.push(row);
  return row;
}

append({ type: 'bootstrap' });

module.exports = { latest, computeAnchor, append };
