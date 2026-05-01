// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * AUTO-DOC SEMANTIC (complementary)
 *
 * Subscribes to the existing OpenAPI source served at /openapi.json (frontier)
 * and the autonomous registry. Does NOT modify the OpenAPI generator.
 * Produces a human-readable HTML index at /docs/semantic and a JSON snapshot
 * at /api/integrations/auto-doc/snapshot. Refreshes every REFRESH_MS.
 */

const fs   = require('fs');
const path = require('path');

const REFRESH_MS = parseInt(process.env.AUTO_DOC_REFRESH_MS || '86400000', 10); // 24h
const OUT_DIR    = path.join(__dirname, '..', '..', '..', 'public', 'docs', 'semantic');
const OUT_FILE   = path.join(OUT_DIR, 'index.html');

const _state = {
  name: 'auto-doc-semantic',
  startedAt: null,
  lastRun: null,
  lastSnapshot: null,
  lastError: null,
};

function _safeReadOpenApi() {
  // Try the in-process frontier first; fallback to empty schema.
  try {
    const frontier = require('../../../src/frontier-engine');
    if (frontier && typeof frontier.openApiSpec === 'function') {
      return frontier.openApiSpec();
    }
  } catch (e) { /* frontier may not be loaded */ }
  return { openapi: '3.0.0', info: { title: 'Unicorn API', version: '0.0.0' }, paths: {} };
}

function _enrich(spec) {
  const paths = spec && spec.paths ? spec.paths : {};
  const endpoints = [];
  for (const [route, methods] of Object.entries(paths)) {
    for (const [method, def] of Object.entries(methods || {})) {
      if (typeof def !== 'object' || !def) continue;
      const summary = def.summary || def.description || `${method.toUpperCase()} ${route}`;
      const tags    = Array.isArray(def.tags) ? def.tags.join(', ') : 'general';
      endpoints.push({ method: method.toUpperCase(), route, summary, tags });
    }
  }
  endpoints.sort((a, b) => a.route.localeCompare(b.route));
  return endpoints;
}

function _renderHtml(endpoints, info) {
  const rows = endpoints.map(e => `
    <tr>
      <td><code>${e.method}</code></td>
      <td><code>${e.route}</code></td>
      <td>${e.tags}</td>
      <td>${e.summary}</td>
    </tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${(info && info.title) || 'Unicorn API'} — Semantic Docs</title>
<meta name="generator" content="auto-doc-semantic"/>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#0b1020;color:#e8edf7}
  header{padding:24px;background:linear-gradient(90deg,#15224a,#1f3a8a);border-bottom:1px solid #2b3a6b}
  h1{margin:0;font-size:22px}
  main{padding:16px 24px}
  table{width:100%;border-collapse:collapse}
  th,td{padding:8px 10px;border-bottom:1px solid #1c2a55;text-align:left;vertical-align:top;font-size:13px}
  th{color:#9fb3ff;font-weight:600}
  code{background:#101733;padding:2px 6px;border-radius:4px;color:#9fb3ff}
  .meta{opacity:.7;font-size:12px;margin-top:6px}
</style></head>
<body>
<header>
  <h1>${(info && info.title) || 'Unicorn API'} — Semantic Documentation</h1>
  <div class="meta">Generated ${new Date().toISOString()} · ${endpoints.length} endpoints · auto-doc-semantic v1</div>
</header>
<main>
  <table>
    <thead><tr><th>Method</th><th>Route</th><th>Tags</th><th>Summary</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No endpoints discovered.</td></tr>'}</tbody>
  </table>
</main>
</body></html>`;
}

function _runOnce() {
  try {
    const spec = _safeReadOpenApi();
    const endpoints = _enrich(spec);
    const html = _renderHtml(endpoints, spec.info);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, html, 'utf8');
    _state.lastRun = new Date().toISOString();
    _state.lastSnapshot = { count: endpoints.length, endpoints: endpoints.slice(0, 50) };
    _state.lastError = null;
    return _state.lastSnapshot;
  } catch (e) {
    _state.lastError = e && e.message;
    return null;
  }
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();
  _runOnce();
  setInterval(_runOnce, REFRESH_MS).unref();

  if (app && typeof app.get === 'function') {
    app.get('/api/integrations/auto-doc/snapshot', (_req, res) => {
      res.json({ ok: true, state: _state });
    });
    app.get('/docs/semantic', (_req, res) => {
      try { res.type('html').send(fs.readFileSync(OUT_FILE, 'utf8')); }
      catch (e) { res.status(404).json({ ok: false, error: 'docs not yet generated' }); }
    });
  }
}

function getStatus() { return { ..._state }; }

module.exports = { name: 'auto-doc-semantic', init, getStatus, _runOnce };
