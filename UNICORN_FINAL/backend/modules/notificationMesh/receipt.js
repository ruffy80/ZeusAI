'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { STATE_DIR } = require('./signing');

const RECEIPT_FILE = path.join(STATE_DIR, 'snm_receipts.jsonl');

function ensureFile() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(RECEIPT_FILE)) fs.writeFileSync(RECEIPT_FILE, '');
}

function saveReceipt(signed, meta) {
  ensureFile();
  const encoded = JSON.stringify(signed);
  const hash = crypto.createHash('sha256').update(encoded).digest('hex');
  const row = {
    hash,
    signed,
    at: new Date().toISOString(),
    delivered: meta && meta.delivered === true,
    channel: meta && meta.channel ? meta.channel : null,
    attempts: meta && Array.isArray(meta.attempts) ? meta.attempts : [],
  };
  fs.appendFileSync(RECEIPT_FILE, JSON.stringify(row) + '\n');
  return hash;
}

function getReceipt(hash) {
  if (!hash || !fs.existsSync(RECEIPT_FILE)) return null;
  const lines = fs.readFileSync(RECEIPT_FILE, 'utf8').split(/\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const row = JSON.parse(lines[i]);
      if (row && row.hash === hash) return row;
    } catch (_) { /* skip a torn line */ }
  }
  return null;
}

function listReceipts() {
  if (!fs.existsSync(RECEIPT_FILE)) return [];
  return fs.readFileSync(RECEIPT_FILE, 'utf8').split(/\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch (_) { return null; }
  }).filter(Boolean);
}

module.exports = { saveReceipt, getReceipt, listReceipts, RECEIPT_FILE };
