'use strict';
const fs = require('fs');
const path = require('path');
const m = require('../backend/modules/performance-100y-v3');

// ── Static assertions: file presence + wiring + UI marker ──
const repoRoot = path.join(__dirname, '..');
const indexJs = fs.readFileSync(path.join(repoRoot, 'src', 'index.js'), 'utf8');
const shellJs = fs.readFileSync(path.join(repoRoot, 'src', 'site', 'v2', 'shell.js'), 'utf8');

let staticFail = 0;
function assert(cond, label) {
  if (cond) { console.log('  ✅', label); } else { staticFail++; console.error('  ❌', label); }
}
assert(indexJs.includes("require('../backend/modules/performance-100y-v3')"), 'src/index.js requires performance-100y-v3');
assert(indexJs.includes('perf100v3.handle'), 'src/index.js dispatches perf100v3.handle');
assert(shellJs.includes('id="zeusperf100yv3"'), 'shell.js has zeusperf100yv3 section anchor');
assert(shellJs.includes('/api/v100/perf/v3/manifest'), 'shell.js links to v3 manifest');
assert(shellJs.includes('/api/v100/perf/v3/mobile-parity-pact'), 'shell.js links to mobile-parity-pact');
assert(shellJs.includes('/api/v100/perf/v3/content-provenance-chain'), 'shell.js links to content-provenance-chain');
assert(typeof m.handle === 'function', 'module exports handle()');

const paths = [
  '/api/v100/perf/v3/manifest',
  '/api/v100/perf/v3/semantic-stability-pact',
  '/api/v100/perf/v3/accessibility-equity-ledger',
  '/api/v100/perf/v3/cognitive-load-budget',
  '/api/v100/perf/v3/attention-economy-receipt',
  '/api/v100/perf/v3/data-minimization-proof',
  '/api/v100/perf/v3/offline-first-pledge',
  '/api/v100/perf/v3/time-to-meaningful-content',
  '/api/v100/perf/v3/interop-contract',
  '/api/v100/perf/v3/content-provenance-chain',
  '/api/v100/perf/v3/zero-knowledge-telemetry',
  '/api/v100/perf/v3/graceful-degradation-matrix',
  '/api/v100/perf/v3/mobile-parity-pact',
  '/api/v100/perf/v3/viewport-equity',
  '/api/v100/perf/v3/touch-target-equity',
  '/api/v100/perf/v3/battery-impact-budget'
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
      && headers && headers['X-Performance-100Y-V3'] === '1.0.0';
    if (ok) {
      try {
        const j = JSON.parse(body);
        if (j.pack === 'zeus-performance-100y-v3' && j.version === '1.0.0' && j.horizonYear === 2076) {
          pass++;
        } else { fail++; console.error('FAIL envelope', p, j); }
      } catch (e) { fail++; console.error('FAIL JSON parse', p, e.message); }
    } else {
      fail++;
      console.error('FAIL', p, 'handled=', handled, 'status=', status, 'bodyLen=', body && body.length);
    }
  }
  // dispatcher discipline
  const r2 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignored = await m.handle({ url: '/api/v100/perf/v3/__nope__', method: 'GET' }, r2);
  if (ignored !== false) { fail++; console.error('FAIL unknown subpath: got', ignored); }
  const r3 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredOther = await m.handle({ url: '/health', method: 'GET' }, r3);
  if (ignoredOther !== false) { fail++; console.error('FAIL /health: got', ignoredOther); }
  const r4 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredPost = await m.handle({ url: '/api/v100/perf/v3/manifest', method: 'POST' }, r4);
  if (ignoredPost !== false) { fail++; console.error('FAIL POST: got', ignoredPost); }

  console.log('performance-100y-v3 smoke:', pass, 'pass /', fail, 'fail · static:', staticFail, 'fail');
  process.exit(fail === 0 && staticFail === 0 ? 0 : 1);
})();
