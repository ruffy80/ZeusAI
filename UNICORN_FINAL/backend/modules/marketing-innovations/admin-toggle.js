// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/admin-toggle.js
//
// Runtime feature-flag store for the marketing pack. Allows the owner
// to flip individual sub-engines without restarting the process. Flags
// override the env-var kill-switches via `isEnabled(name)`.
// =====================================================================

'use strict';

const DISABLED = process.env.MARKETING_ADMIN_TOGGLE_DISABLED === '1';

// Map of submodule name → boolean (true = forced-on, false = forced-off,
// undefined = follow env var default).
const _flags = new Map();

const KNOWN = [
  'outbound', 'aiCopy', 'mediaForge', 'scheduler', 'engagement',
  'experiments', 'monitor', 'waitlist', 'pseo', 'influencer',
  'abuse', 'i18n', 'metrics', 'dashboard', 'viralFeed',
];

function set(name, enabled) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const key = String(name || '').trim();
  if (!KNOWN.includes(key)) return { ok: false, error: 'unknown_flag', known: KNOWN };
  if (enabled === null || enabled === undefined) _flags.delete(key);
  else _flags.set(key, !!enabled);
  return { ok: true, name: key, value: _flags.has(key) ? _flags.get(key) : null };
}

function get(name) {
  const key = String(name || '').trim();
  return _flags.has(key) ? _flags.get(key) : null;
}

function isEnabled(name, envDisabled) {
  // If admin override exists, honor it. Else fall back to env-var-driven default.
  const ov = get(name);
  if (ov === true) return true;
  if (ov === false) return false;
  return !envDisabled;
}

function listFlags() {
  return KNOWN.map((k) => ({ name: k, override: _flags.has(k) ? _flags.get(k) : null }));
}

function status() {
  return {
    disabled: DISABLED,
    knownFlags: KNOWN,
    overrides: Array.from(_flags.entries()).map(([k, v]) => ({ name: k, value: v })),
  };
}

function _resetForTests() { _flags.clear(); }

module.exports = { set, get, isEnabled, listFlags, status, KNOWN, _resetForTests };
