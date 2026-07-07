'use strict';

function validateSnapshot(snapshot) {
  const required = ['ok', 'ts'];
  const missing = [];
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
  for (const key of required) {
    if (!(key in s)) missing.push(key);
  }
  return { ok: missing.length === 0, missing };
}

module.exports = { validateSnapshot };
