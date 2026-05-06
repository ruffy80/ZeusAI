'use strict';
const fs = require('fs');
const path = require('path');
const m = require('../backend/modules/performance-100y');

// ── Static assertions: file presence + wiring + UI marker ──
const repoRoot = path.join(__dirname, '..');
const indexJs = fs.readFileSync(path.join(repoRoot, 'src', 'index.js'), 'utf8');
const shellJs = fs.readFileSync(path.join(repoRoot, 'src', 'site', 'v2', 'shell.js'), 'utf8');

let staticFail = 0;
function assert(cond, label) {
  if (cond) { console.log('  ✅', label); } else { staticFail++; console.error('  ❌', label); }
}
assert(indexJs.includes("require('../backend/modules/performance-100y')"), 'src/index.js requires performance-100y');
assert(indexJs.includes('perf100.handle'), 'src/index.js dispatches perf100.handle');
assert(shellJs.includes('id="zeusperf100y"'), 'shell.js has zeusperf100y section anchor');
assert(shellJs.includes('/.well-known/perf-budget.json'), 'shell.js links to perf-budget.json');
assert(shellJs.includes('/api/v100/perf/manifest'), 'shell.js links to /api/v100/perf/manifest');
assert(typeof m.handle === 'function', 'module exports handle()');

// ── A11y/perf regression guards from PageSpeed pass-2 ──
assert(shellJs.includes('class="zeus-hero-image"') && shellJs.includes('fetchpriority="high"'), 'hero image has fetchpriority=high');
assert(/zeus-hero-image[^>]*width="1600"[^>]*height="900"/.test(shellJs), 'hero image has explicit width/height');
assert(/brand-88\.jpg[^<]*width="44"[^<]*height="44"[^<]*loading="lazy"/.test(shellJs), 'brand logo has explicit dimensions + lazy loading');
assert(!/<h4|<h5|<h6/.test(shellJs), 'no <h4>/<h5>/<h6> headings (descending order preserved)');
assert(shellJs.includes('.pillar-title{') && shellJs.includes('.footer-col-title{'), 'pillar-title + footer-col-title CSS present');

const paths = [
  '/.well-known/perf-budget.json',
  '/.well-known/web-vitals-attestation.json',
  '/api/v100/perf/manifest',
  '/api/v100/perf/render-budget',
  '/api/v100/perf/dom-budget',
  '/api/v100/perf/main-thread-budget',
  '/api/v100/perf/animation-policy',
  '/api/v100/perf/image-policy',
  '/api/v100/perf/font-policy',
  '/api/v100/perf/cache-policy',
  '/api/v100/perf/preload-policy',
  '/api/v100/perf/zero-energy-pledge',
  '/api/v100/perf/longevity-perf-pledge'
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
      && headers && headers['X-Performance-100Y'] === '1.0.0';
    if (ok) {
      // sanity-check JSON parse + envelope
      try {
        const j = JSON.parse(body);
        if (j.pack === 'zeus-performance-100y' && j.version === '1.0.0' && j.horizonYear === 2076) {
          pass++;
        } else { fail++; console.error('FAIL envelope mismatch', p, j); }
      } catch (e) { fail++; console.error('FAIL JSON parse', p, e.message); }
    } else {
      fail++;
      console.error('FAIL', p, 'handled=', handled, 'status=', status, 'bodyLen=', body && body.length);
    }
  }
  // dispatcher discipline: unknown path → false
  const r2 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredUnknown = await m.handle({ url: '/health', method: 'GET' }, r2);
  if (ignoredUnknown !== false) { fail++; console.error('FAIL unknown-path: got', ignoredUnknown); }
  // POST is rejected
  const r3 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredPost = await m.handle({ url: '/api/v100/perf/manifest', method: 'POST' }, r3);
  if (ignoredPost !== false) { fail++; console.error('FAIL POST not ignored: got', ignoredPost); }

  console.log('performance-100y smoke:', pass, 'pass /', fail, 'fail · static:', staticFail, 'fail');
  process.exit(fail === 0 && staticFail === 0 ? 0 : 1);
})();
