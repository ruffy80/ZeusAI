// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:56.957Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/csp-report.js · #8
//
// Persists CSP violation reports posted by browsers. Accepts both the
// classic `application/csp-report` body and the modern `application/reports+json`
// (Reporting API). Bounded body size, append-only JSONL.
//
// Pure additive · zero deps.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const REPORT_FILE = process.env.CSP_REPORT_FILE || path.join(DATA_DIR, 'csp-violations.jsonl');
const MAX_BYTES = 64 * 1024;

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true }); } catch (_) {}
}

function _readBody(req) {
  return new Promise((resolve, reject) => {
    let len = 0;
    const chunks = [];
    req.on('data', (c) => {
      len += c.length;
      if (len > MAX_BYTES) { reject(new Error('payload_too_large')); try { req.destroy(); } catch (_) {} return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(Buffer.concat(chunks).toString('utf8')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function _record(payload, ip, ua) {
  _ensureDir();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ip: ip || '',
    ua: ua ? String(ua).slice(0, 256) : '',
    report: payload
  });
  try { fs.appendFileSync(REPORT_FILE, line + '\n', 'utf8'); } catch (_) {}
}

/** Raw http handler for `/api/csp-report` and `/csp-violations`. */
async function handle(req, res) {
  if (!req || !res) return false;
  if (req.method !== 'POST') return false;
  const url = (req.url || '').split('?')[0];
  if (url !== '/api/csp-report' && url !== '/csp-violations') return false;
  try {
    const raw = await _readBody(req);
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : {}; } catch (_) { payload = { rawText: String(raw).slice(0, 1024) }; }
    const ip = (req.headers && (req.headers['x-forwarded-for'] || '')) || (req.socket && req.socket.remoteAddress) || '';
    _record(payload, String(ip).split(',')[0].trim(), req.headers && req.headers['user-agent']);
    res.writeHead(204, { 'Content-Type': 'text/plain' });
    res.end();
  } catch (e) {
    try {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'payload_too_large', message: e && e.message }));
    } catch (_) {}
  }
  return true;
}

/** Express-style middleware variant for `app.post('/api/csp-report', ...)`. */
function expressHandler(req, res) {
  try {
    const payload = req.body || {};
    const ip = (req.headers && (req.headers['x-forwarded-for'] || '')) || (req.ip || '');
    _record(payload, String(ip).split(',')[0].trim(), req.headers && req.headers['user-agent']);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'csp_record_failed', message: e && e.message });
  }
}

function status() {
  let lines = 0;
  try {
    const text = fs.readFileSync(REPORT_FILE, 'utf8');
    for (const _ of text.split('\n')) if (_) lines++;
  } catch (_) {}
  return { file: REPORT_FILE, lines };
}

module.exports = { handle, expressHandler, status, REPORT_FILE };
