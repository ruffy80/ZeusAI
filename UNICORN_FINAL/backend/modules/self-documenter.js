// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============== SELF-DOCUMENTER ENGINE (REAL) ==============
// Analizează cod sursă JavaScript real: extrage funcții, clase, exporturi,
// acoperirea cu comentarii (JSDoc), și generează un sumar de documentație.
// Parsing real prin regex robuste (fără dependențe externe).

const { createEngine } = require('./engine-core');

function analyzeSource(code = '') {
  const src = String(code);
  const lines = src.split('\n');
  const total = lines.length;

  const functions = [];
  const fnRe = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)/g;
  const arrowRe = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
  let m;
  while ((m = fnRe.exec(src))) functions.push({ name: m[1], params: m[2].split(',').map(s => s.trim()).filter(Boolean), kind: 'function' });
  while ((m = arrowRe.exec(src))) functions.push({ name: m[1], params: m[2].split(',').map(s => s.trim()).filter(Boolean), kind: 'arrow' });

  const classes = [...src.matchAll(/(?:^|\n)\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/g)].map(x => x[1]);
  const exportsList = [...src.matchAll(/module\.exports\s*=\s*{([^}]*)}/g)]
    .flatMap(x => x[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean));

  const commentLines = lines.filter(l => /^\s*(\/\/|\*|\/\*)/.test(l)).length;
  const jsdocBlocks = (src.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
  const documented = functions.filter(f => new RegExp(`\\*/\\s*(?:export\\s+)?(?:async\\s+)?(?:function\\s+${f.name}|const\\s+${f.name})`).test(src)).length;

  const docCoverage = functions.length ? documented / functions.length : 1;
  return {
    totalLines: total,
    functions: functions.length,
    classes: classes.length,
    exports: exportsList.length,
    commentLines,
    commentRatio: total ? Number((commentLines / total).toFixed(3)) : 0,
    jsdocBlocks,
    documentedFunctions: documented,
    docCoverage: Number((docCoverage * 100).toFixed(1)),
    grade: docCoverage >= 0.8 ? 'A' : docCoverage >= 0.5 ? 'B' : docCoverage >= 0.25 ? 'C' : 'D',
    symbols: { functions: functions.map(f => f.name), classes, exports: exportsList },
    suggestions: [
      ...(docCoverage < 0.5 ? ['Adaugă JSDoc pentru funcțiile publice'] : []),
      ...(jsdocBlocks === 0 && functions.length ? ['Niciun bloc JSDoc găsit'] : []),
      ...(commentLines / (total || 1) < 0.05 ? ['Densitate scăzută de comentarii'] : []),
    ],
  };
}

function docWork(input = {}) {
  const code = input.code || input.source || '';
  return analyzeSource(code);
}

const engine = createEngine('self-documenter', { label: 'Self-Documenter Engine', category: 'autonomy', work: docWork });
module.exports = {
  name: 'self-documenter',
  process: (input, ctx) => engine.process(input, ctx),
  analyzeSource,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
