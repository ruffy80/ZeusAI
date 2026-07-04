// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ================= A/B TESTING ENGINE (REAL) =================
// Atribuire deterministă de variante (hash FNV-1a → bucket ponderat),
// tracking de conversii și semnificație statistică reală (two-proportion
// z-test + interval de încredere 95%). No mock — statistică reală.

const { createEngine } = require('./engine-core');

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Atribuire deterministă: același subject → mereu aceeași variantă.
function assign(experiment, subjectId, variants) {
  const vs = Array.isArray(variants) && variants.length ? variants : ['control', 'treatment'];
  const weights = vs.map(v => (typeof v === 'object' && v.weight) ? Number(v.weight) : 1);
  const names = vs.map(v => (typeof v === 'object' ? v.name : v));
  const total = weights.reduce((a, b) => a + b, 0) || vs.length;
  const bucket = (fnv1a(`${experiment}:${subjectId}`) % 10000) / 10000 * total;
  let acc = 0;
  for (let i = 0; i < names.length; i++) {
    acc += weights[i];
    if (bucket < acc) return names[i];
  }
  return names[names.length - 1];
}

// Funcție de eroare (Abramowitz-Stegun) pentru CDF normal → p-value real.
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normalCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

// Two-proportion z-test real între control și treatment.
function significance(control, treatment) {
  const n1 = control.visitors || 0, c1 = control.conversions || 0;
  const n2 = treatment.visitors || 0, c2 = treatment.conversions || 0;
  if (n1 < 1 || n2 < 1) return { significant: false, reason: 'insufficient-data' };
  const p1 = c1 / n1, p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2)) || 1e-9;
  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const lift = p1 > 0 ? (p2 - p1) / p1 : 0;
  // CI 95% pentru diferența de proporții
  const seDiff = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  return {
    controlRate: Number(p1.toFixed(4)),
    treatmentRate: Number(p2.toFixed(4)),
    relativeLift: Number((lift * 100).toFixed(2)),
    zScore: Number(z.toFixed(4)),
    pValue: Number(pValue.toFixed(5)),
    significant: pValue < 0.05,
    confidence: Number(((1 - pValue) * 100).toFixed(2)),
    ci95: [Number(((p2 - p1) - 1.96 * seDiff).toFixed(4)), Number(((p2 - p1) + 1.96 * seDiff).toFixed(4))],
    winner: pValue < 0.05 ? (p2 > p1 ? 'treatment' : 'control') : 'inconclusive',
  };
}

function abWork(input = {}) {
  const { action = 'evaluate' } = input;
  if (action === 'assign') {
    const variant = assign(input.experiment || 'exp', String(input.subjectId || ''), input.variants);
    return { experiment: input.experiment, subjectId: input.subjectId, variant };
  }
  // evaluate: așteaptă {control:{visitors,conversions}, treatment:{...}}
  const control = input.control || {};
  const treatment = input.treatment || {};
  const sig = significance(control, treatment);
  const sampleAdvice = (!sig.significant && (control.visitors || 0) + (treatment.visitors || 0) < 1000)
    ? 'collect-more-samples' : sig.significant ? 'ship-winner' : 'no-effect-detected';
  return { ...sig, recommendation: sampleAdvice };
}

const engine = createEngine('ab-testing', { label: 'A/B Testing Engine', category: 'experimentation', work: abWork });
module.exports = {
  name: 'ab-testing',
  process: (input, ctx) => engine.process(input, ctx),
  assign, significance,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
