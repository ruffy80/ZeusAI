'use strict';

function quote(offsetKg = 0) {
  const kg = Number(offsetKg) || 0;
  return { ok: true, offsetKg: kg, usd: Math.round(kg * 0.02 * 100) / 100, ts: new Date().toISOString() };
}

module.exports = { quote };
