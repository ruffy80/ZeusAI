'use strict';

/**
 * Homepage Sync Drift — forever contract.
 * Control Tower must compare the public storefront aliases (same SoT),
 * never /snapshot.marketplace vs a backend-routed /api/services/list.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

async function main() {
  await check('client Sync Drift compares /api/services ↔ /api/services/list (not marketplace)', () => {
    const client = read('src/site/v2/client.js');
    assert.ok(client.includes("fetch('/api/services'"), 'must fetch /api/services');
    assert.ok(client.includes("fetch('/api/services/list'"), 'must fetch /api/services/list');
    assert.ok(!/snap\.marketplace\.length/.test(client), 'must not use marketplace.length');
    assert.ok(client.includes('idsA') || client.includes('data-sync'), 'must use ID-set / sync marker');
  });

  await check('site uses one public storefront builder for both aliases', () => {
    const site = read('src/index.js');
    assert.ok(site.includes('buildPublicStorefrontServices'), 'shared builder required');
    assert.ok(/urlPath === '\/api\/services\/list' \|\| urlPath === '\/api\/services'/.test(site)
      || /urlPath === '\/api\/services' \|\| urlPath === '\/api\/services\/list'/.test(site),
    'both routes must share the handler');
  });

  await check('nginx pins /api/services/list to unicorn_site', () => {
    const nginx = read('scripts/nginx-unicorn.conf');
    assert.ok(/location\s+=\s+\/api\/services\/list/.test(nginx), 'exact list pin required');
    const idx = nginx.indexOf('location = /api/services/list');
    const window = nginx.slice(idx, idx + 400);
    assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(window), 'list must hit site');
  });

  await check('deploy wires idempotent nginx services-list patcher', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'scripts/nginx-patch-services-list-route.py')));
    const wf = fs.readFileSync(path.join(ROOT, '..', '.github/workflows/deploy.yml'), 'utf8');
    assert.ok(wf.includes('nginx-patch-services-list-route.py'));
  });

  await check('shell Control Tower documents public-catalog sync sources', () => {
    const shell = read('src/site/v2/shell.js');
    assert.ok(shell.includes('fuDrift'));
    assert.ok(shell.includes('/api/services/list'));
    assert.ok(shell.includes('/api/services'));
  });

  // Live shape against site process (no nginx).
  process.env.PORT = process.env.PORT || '31993';
  process.env.BIND_HOST = '127.0.0.1';
  const { createServer } = require('../src/index');
  const app = createServer();
  const port = Number(process.env.PORT);
  await new Promise((resolve) => app.listen(port, '127.0.0.1', resolve));

  async function get(p) {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  try {
    await check('site /api/services and /api/services/list have identical ID sets', async () => {
      let matched = false;
      let last = {};
      for (let i = 0; i < 5; i++) {
        const a = await get('/api/services');
        const b = await get('/api/services/list');
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        const idsA = new Set((a.body.services || []).map((s) => s && s.id).filter(Boolean));
        const idsB = new Set((b.body.services || []).map((s) => s && s.id).filter(Boolean));
        let d = 0;
        for (const id of idsA) if (!idsB.has(id)) d++;
        for (const id of idsB) if (!idsA.has(id)) d++;
        last = { d, a: idsA.size, b: idsB.size, srcA: a.body.source, srcB: b.body.source };
        if (d === 0 && idsA.size > 0) { matched = true; break; }
        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
      }
      assert.ok(matched, 'expected 0 ID drift, got ' + JSON.stringify(last));
      assert.equal(last.srcA, 'zeusai-site');
      assert.equal(last.srcB, 'zeusai-site');
    });
  } finally {
    await new Promise((resolve) => {
      try { app.close(() => resolve()); } catch (_) { resolve(); }
    });
  }

  console.log(`\n✅ homepage-sync-drift: ${passed} tests passed\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
