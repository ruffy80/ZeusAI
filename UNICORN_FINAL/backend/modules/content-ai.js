// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ================== CONTENT AI ENGINE (REAL) ==================
// Analiză și generare reală de conținut fără modele externe: scor de
// lizibilitate (Flesch), structură (titluri/paragrafe/CTA), extragere
// cuvinte cheie (TF), generare meta + outline determinist. No mock.

const { createEngine } = require('./engine-core');

const STOP = new Set(('a an the and or but of to in on for with at by from up about into over after is are was were be been being this that these those it its as not no yes ' +
  'si sau dar de la in pe pentru cu prin este sunt era au fost fi acest acea aceasta aceste').split(/\s+/));

function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-zăâîșț0-9]+/gi) || [];
}
function sentences(text) {
  return String(text || '').split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
}
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-zăâîșț]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouyăâî]+/g);
  let count = groups ? groups.length : 1;
  if (w.length > 3 && w.endsWith('e')) count = Math.max(1, count - 1);
  return Math.max(1, count);
}

function readability(text) {
  const sents = sentences(text);
  const words = tokenize(text);
  if (!sents.length || !words.length) return { score: 0, grade: 'n/a' };
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const wps = words.length / sents.length;
  const spw = syl / words.length;
  const flesch = 206.835 - 1.015 * wps - 84.6 * spw;
  const score = Math.max(0, Math.min(100, Math.round(flesch)));
  const grade = score >= 70 ? 'easy' : score >= 50 ? 'medium' : 'hard';
  return { score, grade, wordsPerSentence: Number(wps.toFixed(1)), syllablesPerWord: Number(spw.toFixed(2)) };
}

function keywords(text, top = 8) {
  const words = tokenize(text).filter(w => w.length > 2 && !STOP.has(w));
  const tf = {};
  for (const w of words) tf[w] = (tf[w] || 0) + 1;
  const total = words.length || 1;
  return Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([term, count]) => ({ term, count, density: Number(((count / total) * 100).toFixed(2)) }));
}

function structureScore(text) {
  const t = String(text || '');
  const hasH = /(^|\n)#{1,6}\s|\<h[1-6]/i.test(t);
  const paragraphs = t.split(/\n{2,}/).filter(p => p.trim()).length;
  const hasList = /(^|\n)\s*[-*]\s|\<li\>/i.test(t);
  const hasCTA = /(buy|subscribe|sign ?up|get started|contact|cumpără|abonează|începe)/i.test(t);
  let score = 0;
  if (hasH) score += 30;
  if (paragraphs >= 3) score += 25; else score += paragraphs * 8;
  if (hasList) score += 20;
  if (hasCTA) score += 25;
  return { score: Math.min(100, score), hasHeadings: hasH, paragraphs, hasList, hasCTA };
}

// Generare deterministă de outline + meta pe baza subiectului + keywords.
function generate(topic, kws) {
  const base = String(topic || 'Subiect').trim();
  const terms = (kws && kws.length ? kws : keywords(base)).map(k => k.term || k);
  const title = `${base.charAt(0).toUpperCase() + base.slice(1)}: Ghid Complet`;
  const meta = `Descoperă tot despre ${base}. ${terms.slice(0, 3).join(', ')} și mai mult — explicat clar și aplicabil.`.slice(0, 160);
  const outline = [
    `Introducere în ${base}`,
    `De ce contează ${terms[0] || base}`,
    `Cum funcționează: ${terms.slice(0, 2).join(' & ') || base}`,
    `Greșeli frecvente și cum le eviți`,
    `Pași practici de implementare`,
    `Concluzie și următorii pași`,
  ];
  return { title, metaDescription: meta, outline };
}

function contentWork(input = {}) {
  const { action = 'analyze', text = '', topic = '' } = input;
  if (action === 'generate') {
    const kws = keywords(topic || text);
    return { topic: topic || text, keywords: kws, ...generate(topic || text, kws) };
  }
  const read = readability(text);
  const struct = structureScore(text);
  const kws = keywords(text);
  const words = tokenize(text);
  const overall = Math.round(read.score * 0.4 + struct.score * 0.6);
  return {
    wordCount: words.length,
    readability: read,
    structure: struct,
    keywords: kws,
    overallScore: overall,
    grade: overall >= 80 ? 'A' : overall >= 65 ? 'B' : overall >= 50 ? 'C' : 'D',
    suggestions: [
      ...(read.score < 50 ? ['simplifică frazele lungi'] : []),
      ...(!struct.hasHeadings ? ['adaugă titluri (H1-H3)'] : []),
      ...(!struct.hasCTA ? ['adaugă un call-to-action clar'] : []),
      ...(words.length < 300 ? ['extinde conținutul la 300+ cuvinte'] : []),
    ],
  };
}

const engine = createEngine('content-ai', { label: 'Content AI Engine', category: 'content', work: contentWork });
module.exports = {
  name: 'content-ai',
  process: (input, ctx) => engine.process(input, ctx),
  analyze: (text) => contentWork({ action: 'analyze', text }),
  generate: (topic) => contentWork({ action: 'generate', topic }),
  readability, keywords, structureScore,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
