'use strict';
const fs = require('fs');
const path = require('path');
const m = require('../backend/modules/performance-100y-v2');

// ── Static assertions: file presence + wiring + UI marker ──
const repoRoot = path.join(__dirname, '..');
const indexJs = fs.readFileSync(path.join(repoRoot, 'src', 'index.js'), 'utf8');
const shellJs = fs.readFileSync(path.join(repoRoot, 'src', 'site', 'v2', 'shell.js'), 'utf8');

let staticFail = 0;
function assert(cond, label) {
  if (cond) { console.log('  ✅', label); } else { staticFail++; console.error('  ❌', label); }
}
assert(indexJs.includes("require('../backend/modules/performance-100y-v2')"), 'src/index.js requires performance-100y-v2');
assert(indexJs.includes('perf100v2.handle'), 'src/index.js dispatches perf100v2.handle');
assert(shellJs.includes('id="zeusperf100yv2"'), 'shell.js has zeusperf100yv2 section anchor');
assert(shellJs.includes('/api/v100/perf/v2/manifest'), 'shell.js links to v2 manifest');
assert(shellJs.includes('/api/v100/perf/v2/causal-render-graph'), 'shell.js links to causal-render-graph');
assert(shellJs.includes('/api/v100/perf/v2/joint-receipt'), 'shell.js links to joint-receipt');
assert(typeof m.handle === 'function', 'module exports handle()');

const paths = [
  '/api/v100/perf/v2/manifest',
  '/api/v100/perf/v2/causal-render-graph',
  '/api/v100/perf/v2/frame-budget',
  '/api/v100/perf/v2/energy-per-interaction',
  '/api/v100/perf/v2/latency-equity-map',
  '/api/v100/perf/v2/tail-latency-pledge',
  '/api/v100/perf/v2/cold-start-budget',
  '/api/v100/perf/v2/hydration-cost',
  '/api/v100/perf/v2/network-adaptivity',
  '/api/v100/perf/v2/perceptual-quality',
  '/api/v100/perf/v2/anti-layout-thrash',
  '/api/v100/perf/v2/predictability-index',
  '/api/v100/perf/v2/critical-path-diet',
  '/api/v100/perf/v2/speculative-render',
  '/api/v100/perf/v2/joint-receipt',
  '/api/v100/perf/v2/inp-attribution'
];

(async () => {
  let pass = 0, fail = 0;
  for (const p of paths) {
    const req = { url: p, method: 'GET' };
    let status, body = '', headers = null;
    const res = {
      headersSent: false,
      writeHead(s, h) { status = s; headers = h; this.headersSent = true; },
      end(b) { body = b; }
    };
    const handled = await m.handle(req, res);
    const ok = handled === true && status === 200 && typeof body === 'string' && body.length > 50
      && headers && headers['X-Performance-100Y-V2'] === '1.0.0';
    if (ok) {
      try {
        const j = JSON.parse(body);
        if (j.pack === 'zeus-performance-100y-v2' && j.version === '1.0.0' && j.horizonYear === 2076) {
          pass++;
        } else { fail++; console.error('FAIL envelope', p, j); }
      } catch (e) { fail++; console.error('FAIL JSON parse', p, e.message); }
    } else {
      fail++;
      console.error('FAIL', p, 'handled=', handled, 'status=', status, 'bodyLen=', body && body.length);
    }
  }
  // dispatcher discipline: unknown path under same prefix → false
  const r2 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignored = await m.handle({ url: '/api/v100/perf/v2/__nope__', method: 'GET' }, r2);
  if (ignored !== false) { fail++; console.error('FAIL unknown subpath: got', ignored); }
  // unrelated path returns false fast
  const r3 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredOther = await m.handle({ url: '/health', method: 'GET' }, r3);
  if (ignoredOther !== false) { fail++; console.error('FAIL /health: got', ignoredOther); }
  // POST is rejected
  const r4 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredPost = await m.handle({ url: '/api/v100/perf/v2/manifest', method: 'POST' }, r4);
  if (ignoredPost !== false) { fail++; console.error('FAIL POST: got', ignoredPost); }

  console.log('performance-100y-v2 smoke:', pass, 'pass /', fail, 'fail · static:', staticFail, 'fail');
  process.exit(fail === 0 && staticFail === 0 ? 0 : 1);
})();
