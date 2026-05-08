#!/usr/bin/env node
/**
 * route-coverage.js — Walks Express/Node routes in backend/index.js + src/index.js
 * and cross-references with fetch('...') / EventSource('...') usages in
 * src/site/template.js. Emits docs/route-coverage.md.
 *
 * Pure read-only analysis. No external deps. Safe to run in CI.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  path.join(ROOT, 'backend', 'index.js'),
  path.join(ROOT, 'src', 'index.js'),
];
const CLIENT = path.join(ROOT, 'src', 'site', 'template.js');
const OUT = path.join(ROOT, '..', 'docs', 'route-coverage.md');

const ROUTE_RX =
  /\bapp\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*(\[[^\]]+\]|['"`][^'"`]+['"`])/g;
const FETCH_RX = /\bfetch\s*\(\s*['"`]([^'"`?#]+)/g;
const ES_RX = /\bnew\s+EventSource\s*\(\s*['"`]([^'"`?#]+)/g;
const ADMIN_MW_RX = /adminTokenMiddleware|requireAdmin|requireRole\(/;

function extractRoutes(file) {
  const src = fs.readFileSync(file, 'utf8');
  const routes = [];
  let m;
  while ((m = ROUTE_RX.exec(src))) {
    const method = m[1].toUpperCase();
    const raw = m[2];
    const tail = src.slice(m.index, m.index + 400);
    const adminGuarded = ADMIN_MW_RX.test(tail);
    const paths = raw.startsWith('[')
      ? raw
          .replace(/[\[\]'"`\s]/g, '')
          .split(',')
          .filter(Boolean)
      : [raw.replace(/['"`]/g, '')];
    for (const p of paths) {
      routes.push({ method, path: p, file: path.relative(ROOT, file), adminGuarded });
    }
  }
  return routes;
}

function extractClientRefs(file) {
  if (!fs.existsSync(file)) return new Set();
  const src = fs.readFileSync(file, 'utf8');
  const refs = new Set();
  let m;
  while ((m = FETCH_RX.exec(src))) refs.add(m[1]);
  while ((m = ES_RX.exec(src))) refs.add(m[1]);
  return refs;
}

function classify(routes, clientRefs) {
  const referenced = [];
  const orphaned = [];
  const adminOnly = [];
  for (const r of routes) {
    if (r.adminGuarded) adminOnly.push(r);
    const usedByClient = [...clientRefs].some(
      (c) => c === r.path || c.startsWith(r.path) || r.path.startsWith(c)
    );
    if (usedByClient) referenced.push(r);
    else if (!r.adminGuarded) orphaned.push(r);
  }
  return { referenced, orphaned, adminOnly };
}

function md(routes, clientRefs, summary) {
  const ts = new Date().toISOString();
  const lines = [];
  lines.push('# Route coverage');
  lines.push('');
  lines.push(`Generated: ${ts}`);
  lines.push('');
  lines.push(`- Total server routes: **${routes.length}**`);
  lines.push(`- Client-referenced (template.js): **${summary.referenced.length}**`);
  lines.push(`- Admin-guarded: **${summary.adminOnly.length}**`);
  lines.push(`- Orphaned (no client ref, not admin): **${summary.orphaned.length}**`);
  lines.push(`- Distinct client fetch/EventSource paths: **${clientRefs.size}**`);
  lines.push('');
  lines.push('## Orphaned public routes');
  lines.push('| METHOD | path | file |');
  lines.push('|---|---|---|');
  for (const r of summary.orphaned.slice(0, 200)) {
    lines.push(`| ${r.method} | \`${r.path}\` | ${r.file} |`);
  }
  lines.push('');
  lines.push('## Admin-guarded routes');
  lines.push('| METHOD | path | file |');
  lines.push('|---|---|---|');
  for (const r of summary.adminOnly.slice(0, 200)) {
    lines.push(`| ${r.method} | \`${r.path}\` | ${r.file} |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const all = [];
  for (const f of SOURCES) {
    if (fs.existsSync(f)) all.push(...extractRoutes(f));
  }
  const refs = extractClientRefs(CLIENT);
  const summary = classify(all, refs);
  const out = md(all, refs, summary);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log(`route-coverage written → ${path.relative(process.cwd(), OUT)}`);
  console.log(
    `total=${all.length} referenced=${summary.referenced.length} admin=${summary.adminOnly.length} orphan=${summary.orphaned.length}`
  );
}

if (require.main === module) main();
module.exports = { extractRoutes, extractClientRefs, classify };
