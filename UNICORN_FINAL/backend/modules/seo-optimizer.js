// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ==================== SEO OPTIMIZER (REAL) ====================
// Analizează conținut și întoarce scor SEO real + remedii acționabile.
// Real on-page SEO scorer: title, meta, headings, keyword density, links,
// image alt, readability (Flesch). Deterministic, no external calls.

const { createEngine } = require('./engine-core');

const TITLE_MIN = 30, TITLE_MAX = 60;
const DESC_MIN = 70, DESC_MAX = 160;
const STOP = new Set(['the','a','an','and','or','but','of','to','in','on','for','with','is','are','was','this','that','it','as','at','by','be']);

function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}
function keywordDensity(content, keyword) {
  const words = tokenize(content);
  if (!words.length || !keyword) return 0;
  const kw = String(keyword).toLowerCase().trim();
  const hits = words.filter(w => w === kw).length;
  return Number(((hits / words.length) * 100).toFixed(2));
}
function topKeywords(content, n = 5) {
  const freq = new Map();
  for (const w of tokenize(content)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count }));
}
function readability(content) {
  const text = String(content || '');
  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const words = (text.match(/\b\w+\b/g) || []);
  const wordCount = words.length || 1;
  const syllables = words.reduce((s, w) => s + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length), 0);
  const score = 206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount);
  return Number(Math.max(0, Math.min(100, score)).toFixed(1));
}

const SEV = { critical: 0, high: 1, warn: 2, low: 3 };

function seoWork(input = {}) {
  const { title = '', description = '', content = '', keyword = '', url = '', headings = {}, images = [] } = input;
  const issues = []; const wins = []; let score = 100;

  const tlen = String(title).trim().length;
  if (!tlen) { score -= 20; issues.push({ field: 'title', severity: 'critical', msg: 'Missing <title>' }); }
  else if (tlen < TITLE_MIN) { score -= 8; issues.push({ field: 'title', severity: 'warn', msg: `Title too short (${tlen}<${TITLE_MIN})` }); }
  else if (tlen > TITLE_MAX) { score -= 6; issues.push({ field: 'title', severity: 'warn', msg: `Title too long (${tlen}>${TITLE_MAX})` }); }
  else wins.push('Title length optimal');

  const dlen = String(description).trim().length;
  if (!dlen) { score -= 12; issues.push({ field: 'description', severity: 'high', msg: 'Missing meta description' }); }
  else if (dlen < DESC_MIN) { score -= 5; issues.push({ field: 'description', severity: 'warn', msg: `Meta short (${dlen}<${DESC_MIN})` }); }
  else if (dlen > DESC_MAX) { score -= 4; issues.push({ field: 'description', severity: 'warn', msg: `Meta long (${dlen}>${DESC_MAX})` }); }
  else wins.push('Meta description optimal');

  const h1 = Array.isArray(headings.h1) ? headings.h1.length : (headings.h1 ? 1 : 0);
  if (h1 === 0) { score -= 10; issues.push({ field: 'h1', severity: 'high', msg: 'No H1 heading' }); }
  else if (h1 > 1) { score -= 5; issues.push({ field: 'h1', severity: 'warn', msg: `Multiple H1 (${h1})` }); }
  else wins.push('Exactly one H1');

  const wc = tokenize(content).length;
  if (wc < 300) { score -= 10; issues.push({ field: 'content', severity: 'warn', msg: `Thin content (${wc}<300 words)` }); }
  else wins.push(`Content depth ok (${wc} words)`);

  let density = 0;
  if (keyword) {
    density = keywordDensity(content, keyword);
    if (!String(title).toLowerCase().includes(String(keyword).toLowerCase())) { score -= 6; issues.push({ field: 'keyword', severity: 'warn', msg: 'Focus keyword not in title' }); }
    if (density === 0) { score -= 8; issues.push({ field: 'keyword', severity: 'high', msg: 'Focus keyword absent from content' }); }
    else if (density > 3.5) { score -= 6; issues.push({ field: 'keyword', severity: 'warn', msg: `Keyword stuffing risk (${density}%)` }); }
    else wins.push(`Keyword density healthy (${density}%)`);
  }

  const imgs = Array.isArray(images) ? images : [];
  const missingAlt = imgs.filter(i => !i || !i.alt).length;
  if (missingAlt > 0) { score -= Math.min(8, missingAlt * 2); issues.push({ field: 'images', severity: 'warn', msg: `${missingAlt} image(s) missing alt` }); }

  if (url && /[A-Z]|_|\s/.test(url)) { score -= 3; issues.push({ field: 'url', severity: 'low', msg: 'URL has uppercase/underscore/space' }); }

  const read = readability(content);
  if (read < 30) { score -= 5; issues.push({ field: 'readability', severity: 'warn', msg: `Hard to read (Flesch ${read})` }); }

  score = Math.max(0, Math.round(score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return {
    score, grade, wordCount: wc, keywordDensity: density, readability: read,
    topKeywords: topKeywords(content, 5), wins,
    issues: issues.sort((a, b) => SEV[a.severity] - SEV[b.severity]), fixCount: issues.length,
  };
}

const engine = createEngine('seo-optimizer', { label: 'SEO Optimizer', category: 'growth', work: seoWork });
module.exports = {
  name: 'seo-optimizer',
  process: (input, ctx) => engine.process(input, ctx),
  analyze: (input) => seoWork(input),
  keywordDensity, topKeywords, readability,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
