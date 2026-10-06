'use strict';

/**
 * usi-reasoning — deterministic ranking of the options the caller supplies.
 * Longer text ranks higher. No random draw and no claimed probability.
 */

function rank(options) {
  const list = Array.isArray(options) ? options.map((item) => String(item == null ? '' : item)) : [];
  const ranked = list.map((text, index) => ({ text, score: text.length, index }));
  ranked.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return { ok: true, inventsCertainty: false, count: ranked.length, ranked };
}

function getStatus() {
  return { ok: true, name: 'usi-reasoning', method: 'length-rank', inventsCertainty: false };
}

module.exports = { rank, getStatus, name: 'usi-reasoning' };
