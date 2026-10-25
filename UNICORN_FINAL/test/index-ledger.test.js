'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const ledger = require('../src/seo/index-ledger');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function main() {
  await check('the retired matrix is five hundred ghost addresses', () => {
    assert.strictEqual(ledger.MATRIX_VERTICALS.length, 10);
    assert.strictEqual(ledger.MATRIX_INDUSTRIES.length, 50);
    assert.strictEqual(ledger.matrixSize(), 500);
    assert.strictEqual(ledger.isGhost('/solutions/ai-revenue-os/for/fintech'), true);
    assert.strictEqual(ledger.isGhost('/solutions/ai-revenue-os/for/fintech/'), true);
    assert.strictEqual(ledger.isGhost('/solutions/ai-self-healing'), false);
    assert.strictEqual(ledger.isGhost('/solutions/model-routing'), false);
    assert.strictEqual(ledger.isGhost('/solutions/self-healing'), false);
    assert.strictEqual(ledger.isGhost('/solutions/autonomous-agents'), false);
    assert.strictEqual(ledger.isGhost('/solutions/ai-pricing'), false);
    assert.strictEqual(ledger.isGhost('/solutions/not-a-vertical/for/fintech'), false);
  });

  await check('the ledger does not invent a search-engine count', () => {
    const doc = ledger.document();
    assert.strictEqual(doc.inventsGoogleCounts, false);
    assert.strictEqual(doc.retired.http, 410);
    assert.strictEqual(doc.retired.robots, null);
    assert.strictEqual(doc.retired.urls, 500);
    const text = JSON.stringify(doc);
    assert.ok(!/417|indexed count|pages indexed/i.test(text));
    const html = ledger.goneHtml('/solutions/ai-revenue-os/for/fintech');
    assert.ok(!/noindex/i.test(html));
    assert.ok(html.includes('has no page'));
    assert.ok(html.includes('/services'));
  });

  await check('the api sitemap no longer lists the matrix or private paths', () => {
    const xml = require('../backend/modules/growth-engine').buildSitemap();
    assert.ok(xml.includes('<urlset'));
    assert.ok(xml.includes('/solutions/model-routing</loc>'));
    assert.ok(!xml.includes('/services/instant-resume-makeover</loc>'));
    assert.ok(!xml.includes('/origin</loc>'));
    assert.ok(!xml.includes('/status</loc>'));
    assert.ok(!xml.includes('/api/'));
    assert.ok(!xml.includes('/for/'));
    assert.ok(!xml.includes('/dashboard</loc>'));
    assert.ok(!xml.includes('/account</loc>'));
    assert.strictEqual(require('../backend/modules/growth-engine').listProgrammaticRoutes().length, 0);
  });

  await check('a ghost request is 410 and the ledger is json', async () => {
    const sov = require('../src/site/sovereign-extensions');
    const gone = await capture(sov, '/solutions/ai-revenue-os/for/fintech');
    assert.strictEqual(gone.status, 410);
    assert.ok(!gone.headers['X-Robots-Tag']);
    assert.ok(!/noindex/i.test(gone.body));
    assert.ok(gone.body.includes('has no page'));
    const live = await capture(sov, '/indexing.json');
    assert.strictEqual(live.status, 200);
    const doc = JSON.parse(live.body);
    assert.strictEqual(doc.inventsGoogleCounts, false);
    assert.strictEqual(doc.retired.urls, 500);
  });

  await check('IndexNow does not submit a checkout or a ghost', () => {
    const urls = require('../backend/modules/traffic-engine').urlsToSubmit();
    assert.ok(urls.some((u) => u.includes('/solutions/autonomous-agents')));
    assert.ok(!urls.some((u) => u.includes('/services/instant-resume-makeover')));
    assert.ok(!urls.some((u) => u.endsWith('/services')));
    assert.ok(!urls.some((u) => u.includes('/checkout')));
    assert.ok(!urls.some((u) => u.includes('/for/')));
    assert.ok(!urls.some((u) => u.includes('/api/')));
  });

  console.log('index-ledger: ' + passed + ' checks passed');
  process.exit(0);
}

function capture(sov, url) {
  return new Promise((resolve) => {
    let status = 0;
    let headers = {};
    let body = '';
    const res = {
      setHeader() {},
      writeHead(code, h) { status = code; headers = h || {}; },
      end(b) { body = b || ''; resolve({ status, headers, body }); },
    };
    sov.handle({ url, method: 'GET', headers: {} }, res, {});
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
