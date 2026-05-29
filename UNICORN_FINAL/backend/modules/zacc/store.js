// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — durable state store.
// RO: persistă starea ZACC pe disc (UNICORN_FINAL/data/zacc-state.json) ca
// sistemul să NU repornească de la zero la fiecare deploy / pm2 reload.
// Scriere atomică (tmp + rename), citire fail-soft. Nu aruncă NICIODATĂ în
// bucla autonomă — dacă disk-ul nu e disponibil, ZACC continuă in-memory.

'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('./util');

const log = logger('store');

// modules/zacc → ../../../data == UNICORN_FINAL/data (same dir family the
// revenue ledger already uses). Overridable for tests via ZACC_STATE_FILE.
const STATE_FILE = process.env.ZACC_STATE_FILE
  || path.join(__dirname, '..', '..', '..', 'data', 'zacc-state.json');

const SCHEMA_VERSION = 1;

function load() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    if (!raw || !raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema !== SCHEMA_VERSION) {
      log.warn('state schema mismatch — ignoring snapshot (had', parsed && parsed.schema, ')');
      return null;
    }
    log.info('restored state from disk · saved', parsed.savedAt || 'unknown');
    return parsed.state || null;
  } catch (e) {
    log.warn('load skipped:', e.message);
    return null;
  }
}

function save(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      schema: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state: state || {},
    });
    const tmp = STATE_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, STATE_FILE); // atomic on same filesystem
    return true;
  } catch (e) {
    log.warn('save skipped:', e.message);
    return false;
  }
}

module.exports = { load, save, STATE_FILE, SCHEMA_VERSION };
