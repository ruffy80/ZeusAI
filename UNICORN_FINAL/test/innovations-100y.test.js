'use strict';
const m = require('../backend/modules/innovations-100y');
const paths = [
  '/.well-known/civilization-protocol.json',
  '/.well-known/ai-rights.json',
  '/.well-known/earth-standard.json',
  '/.well-known/zeus-attestation.json',
  '/api/v100/manifest',
  '/api/v100/pq-readiness',
  '/api/v100/carbon-budget',
  '/api/v100/data-sovereignty',
  '/api/v100/reversibility-manifest',
  '/api/v100/ontology',
  '/api/v100/provenance',
  '/api/v100/digital-equity',
  '/api/v100/longevity-pledge',
  '/api/v100/explain/abc-123',
  '/api/v100/timelock/deadbeefcafebabe',
  '/api/v100/timelock/' // expect 400
];
(async () => {
  let pass = 0, fail = 0;
  for (const p of paths) {
    const req = { url: p, method: 'GET' };
    let status, body = '';
    const res = {
      headersSent: false,
      writeHead(s) { status = s; this.headersSent = true; },
      end(b) { body = b; }
    };
    const handled = await m.handle(req, res);
    const expectStatus = p.endsWith('/timelock/') ? 400 : 200;
    const ok = handled === true && status === expectStatus && typeof body === 'string' && body.length > 10;
    if (ok) { pass++; } else {
      fail++;
      console.error('FAIL', p, 'handled=', handled, 'status=', status, 'bodyLen=', body && body.length);
    }
  }
  // dispatcher discipline
  const r2 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredUnknown = await m.handle({ url: '/health', method: 'GET' }, r2);
  if (ignoredUnknown !== false) { fail++; console.error('FAIL unknown-path: got', ignoredUnknown); }
  const r3 = { headersSent: false, writeHead() { this.headersSent = true; }, end() {} };
  const ignoredPost = await m.handle({ url: '/api/v100/manifest', method: 'POST' }, r3);
  if (ignoredPost !== false) { fail++; console.error('FAIL POST not ignored: got', ignoredPost); }

  console.log('innovations-100y smoke:', pass, 'pass /', fail, 'fail');
  process.exit(fail === 0 ? 0 : 1);
})();
