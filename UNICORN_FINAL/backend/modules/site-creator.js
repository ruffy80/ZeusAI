// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============== SITE CREATOR ENGINE (REAL) ==============
// Generează HTML real, sigur (escape XSS), dintr-o specificație de pagină:
// titlu, secțiuni, listă, CTA. Output determinist, valid, gata de servire.

const { createEngine } = require('./engine-core');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderSection(sec = {}) {
  const parts = [];
  if (sec.heading) parts.push(`    <h2>${esc(sec.heading)}</h2>`);
  if (sec.text) parts.push(`    <p>${esc(sec.text)}</p>`);
  if (Array.isArray(sec.list) && sec.list.length) {
    parts.push('    <ul>');
    for (const item of sec.list) parts.push(`      <li>${esc(item)}</li>`);
    parts.push('    </ul>');
  }
  if (sec.cta && sec.cta.label) {
    const href = esc(sec.cta.href || '#');
    parts.push(`    <a class="cta" href="${href}">${esc(sec.cta.label)}</a>`);
  }
  return `  <section>\n${parts.join('\n')}\n  </section>`;
}

function buildPage(spec = {}) {
  const title = esc(spec.title || 'Pagină Nouă');
  const desc = esc(spec.description || '');
  const sections = (Array.isArray(spec.sections) ? spec.sections : []).map(renderSection).join('\n');
  const lang = esc(spec.lang || 'ro');
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${desc}">
  <title>${title}</title>
</head>
<body>
  <header><h1>${title}</h1></header>
  <main>
${sections}
  </main>
  <footer><small>Generat de Unicorn Site Creator</small></footer>
</body>
</html>`;
  return html;
}

function siteWork(input = {}) {
  const html = buildPage(input);
  return {
    title: input.title || 'Pagină Nouă',
    sections: Array.isArray(input.sections) ? input.sections.length : 0,
    bytes: Buffer.byteLength(html, 'utf8'),
    valid: /<!DOCTYPE html>/.test(html) && /<\/html>/.test(html),
    html,
  };
}

const engine = createEngine('site-creator', { label: 'Site Creator Engine', category: 'product', work: siteWork });
module.exports = {
  name: 'site-creator',
  process: (input, ctx) => engine.process(input, ctx),
  buildPage, esc,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
