'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-live-'));
process.env.ROADMAP_STATE_DIR = dir;
process.env.REFERRAL_DB_FILE = path.join(dir, 'referrals.sqlite');
delete process.env.ZEUS_REGION;
delete process.env.SITE_REGION;
delete process.env.ZEUS_REPLICA_URLS;
process.env.SITE_CLUSTER_WORKER_ROLE = 'primary';

const desk = require('../src/commerce/roadmap-desk');
const shell = require('../src/site/v2/shell');
const seo = require('../src/seo/sitemap-helpers');

let passed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    passed += 1;
    console.log('✓', name);
  });
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; },
    end(buf) { this.body = buf == null ? '' : String(buf); },
    get headersSent() { return this.statusCode > 0; },
  };
}

(async () => {
  await check('empty funnel promotes nothing and /go returns to the funnel', async () => {
    desk._resetForTests();
    const status = desk.funnelStatus();
    assert.strictEqual(status.recordedVisits, 0);
    assert.strictEqual(status.promoted, null);
    assert.ok(status.note.includes('No visits recorded'));
    const res = mockRes();
    await desk.handle({ method: 'GET', url: '/go', headers: {} }, res);
    assert.strictEqual(res.statusCode, 302);
    assert.strictEqual(res.headers.Location, '/funnel');
  });

  await check('yield ranks recorded URLs and /go follows the winner', async () => {
    desk._resetForTests();
    desk.noteVisit('/pricing');
    assert.strictEqual(desk.funnelStatus().promoted, null);
    assert.ok(desk.funnelStatus().note.includes('Nothing is promoted'));
    desk.noteVisit('/services');
    desk.noteVisit('/services');
    desk.noteConversion('/services');
    desk.noteConversion('/services/instant-website-audit');
    const status = desk.funnelStatus();
    assert.strictEqual(status.ranked[0].path, '/services');
    assert.strictEqual(status.ranked[0].yield, 0.5);
    assert.strictEqual(status.promoted, '/services');
    assert.strictEqual(status.conversionsWithoutVisits, 1);
    const res = mockRes();
    await desk.handle({ method: 'GET', url: '/go', headers: {} }, res);
    assert.strictEqual(res.headers.Location, '/services');
  });

  await check('recovery resumes an opened checkout and does not send mail', () => {
    desk._resetForTests();
    desk.noteCheckoutOpen('instant-website-audit');
    desk.noteCheckoutOpen('instant-website-audit');
    const back = desk.resume('instant-website-audit');
    assert.strictEqual(back.ok, true);
    assert.ok(back.checkoutPath.includes('plan=instant-website-audit'));
    const counts = desk.recoveryStatus();
    assert.strictEqual(counts.stillOpen, 0);
    assert.strictEqual(counts.resumed, 2);
    assert.ok(counts.note.includes('This page does not send a message'));
    assert.strictEqual(desk.resume('nope').ok, false);
    const html = desk.page('/recovery');
    assert.ok(html.includes('This page does not send a message'));
  });

  await check('machine quote stays on the catalog list price', () => {
    const refused = desk.negotiate({ serviceId: 'instant-website-audit', qty: 1, offerUsd: 1 });
    assert.strictEqual(refused.ok, true);
    assert.strictEqual(refused.listUsd, 49);
    assert.strictEqual(refused.accepted, false);
    assert.strictEqual(refused.counterUsd, 49);
    assert.strictEqual(refused.signatureVerified, true);
    const accepted = desk.negotiate({ serviceId: 'instant-website-audit', qty: 2, offerUsd: 98 });
    assert.strictEqual(accepted.accepted, true);
    assert.strictEqual(accepted.counterUsd, 98);
    const missing = desk.negotiate({ serviceId: 'not-a-real-offer', offerUsd: 10 });
    assert.strictEqual(missing.ok, false);
    assert.ok(!JSON.stringify(refused).includes('PRIVATE KEY'));
    assert.ok(!JSON.stringify(refused).includes('secretKey'));
  });

  await check('hybrid sample verifies and a changed statement does not', () => {
    const sample = desk.publicSample();
    assert.strictEqual(sample.ok, true);
    assert.strictEqual(sample.verified.ed25519, true);
    assert.strictEqual(sample.verified.mlDsa65, true);
    assert.strictEqual(sample.mlDsa65.signatureBytes, 3309);
    assert.ok(sample.statement.includes('not a paid-order receipt'));
    assert.ok(sample.note.includes('simulated dilithium provider is not used'));
    const tampered = desk.verifyHybrid(sample.statement + 'x', sample);
    assert.strictEqual(tampered.mlDsa65, false);
    assert.strictEqual(tampered.ed25519, false);
    const dumped = JSON.stringify(sample);
    assert.ok(!dumped.includes('PRIVATE KEY'));
    assert.ok(!dumped.includes('secretKey'));
    const html = shell.getHtml('/pq');
    assert.ok(html.includes('ML-DSA-65'));
    assert.ok(html.includes('not a paid-order receipt'));
    assert.ok(!html.includes('dilithium-simulated'));
  });

  await check('replicas name only this process until the environment says otherwise', () => {
    delete process.env.ZEUS_REGION;
    delete process.env.ZEUS_REPLICA_URLS;
    const alone = desk.replicaStatus();
    assert.deepStrictEqual(alone.knownRegions, []);
    assert.strictEqual(alone.count, 1);
    assert.strictEqual(alone.replicas[0].id, 'this-process');
    assert.ok(alone.note.includes('No extra region is invented'));
    process.env.ZEUS_REGION = 'eu-central';
    process.env.ZEUS_REPLICA_URLS = 'https://user:pass@hidden.example,https://replica.example/health,not a url';
    const named = desk.replicaStatus();
    assert.deepStrictEqual(named.knownRegions, ['eu-central']);
    assert.strictEqual(named.count, 2);
    assert.strictEqual(named.replicas[1].origin, 'https://replica.example');
    assert.strictEqual(named.replicas[1].probed, false);
    delete process.env.ZEUS_REGION;
    delete process.env.ZEUS_REPLICA_URLS;
    const html = shell.getHtml('/replicas');
    assert.ok(html.includes('No extra region is invented'));
  });

  await check('BYO runbook does not install an OS and has no secrets', async () => {
    const file = desk.byoFile('fintech-os');
    assert.ok(file);
    assert.ok(file.includes('does not install an operating system'));
    assert.ok(!/API_KEY=|SECRET=|PRIVATE KEY/.test(file));
    assert.strictEqual(desk.byoFile('not-a-pack'), null);
    const res = mockRes();
    await desk.handle({ method: 'GET', url: '/byo/fintech-os.txt', headers: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('does not install an operating system'));
    const html = shell.getHtml('/byo');
    assert.ok(html.includes('does not install an operating system'));
    assert.ok(html.includes('href="/byo/fintech-os.txt"'));
  });

  await check('module registry starts empty and stores only a submitted address', async () => {
    desk._resetForTests();
    const empty = desk.listModules();
    assert.strictEqual(empty.empty, true);
    assert.ok(empty.note.includes('No third-party module is registered'));
    const bad = desk.registerModule({ name: 'Pack One', payout: 'not-an-address' });
    assert.strictEqual(bad.ok, false);
    const mailed = desk.registerModule({ name: 'Pack One', payout: 'bc1q000000000000000000000000000000000000000', note: 'me@example.com' });
    assert.strictEqual(mailed.error, 'email_not_stored');
    const res = mockRes();
    await desk.handle({
      method: 'POST',
      url: '/api/roadmap/modules',
      headers: { 'content-type': 'application/json' },
      body: { name: 'Pack One', payout: 'bc1q000000000000000000000000000000000000000', note: 'runbook only' },
    }, res);
    assert.strictEqual(res.statusCode, 201);
    const listed = desk.listModules();
    assert.strictEqual(listed.modules.length, 1);
    assert.strictEqual(listed.modules[0].payout, 'bc1q000000000000000000000000000000000000000');
    assert.ok(!JSON.stringify(listed).includes('@'));
  });

  await check('affiliate desk shows a stored txid and hides the buyer email', () => {
    const ref = require('../src/commerce/referral-engine-real');
    ref._resetForTests();
    ref.ensureTrackedCode('ROADMAPTEST');
    const rec = ref.recordRedemption({
      code: 'ROADMAPTEST',
      referredEmail: 'buyer@example.com',
      orderId: 'ord-roadmap-1',
      amountUsd: 49,
    });
    let view = desk.affiliateDesk('ROADMAPTEST');
    assert.strictEqual(view.found, true);
    assert.strictEqual(view.proofs.length, 0);
    assert.ok(view.note.includes('No on-chain payout proof is stored'));
    assert.ok(!JSON.stringify(view).includes('buyer@example.com'));
    ref.markPaid(rec.id, { txid: 'a'.repeat(64) });
    view = desk.affiliateDesk('ROADMAPTEST');
    assert.strictEqual(view.proofs.length, 1);
    assert.strictEqual(view.proofs[0].txid, 'a'.repeat(64));
    assert.ok(view.note.includes('does not query the Bitcoin network'));
    assert.ok(!JSON.stringify(view).includes('buyer@example.com'));
    const unknown = desk.affiliateDesk('NOSUCHCODE');
    assert.strictEqual(unknown.found, false);
  });

  await check('roadmap page links every shipped desk and the marketing sitemap stays at seven', () => {
    const html = shell.getHtml('/roadmap');
    ['/funnel', '/recovery', '/affiliate/desk', '/agents/quote', '/pq', '/replicas', '/byo', '/module-registry'].forEach((href) => {
      assert.ok(html.includes('href="' + href + '"'), href);
    });
    assert.ok(html.includes('Nothing is queued'));
    assert.ok(!html.includes('<li>Self-optimizing'));
    const funnel = shell.getHtml('/funnel');
    assert.ok(funnel.includes('No visits recorded'));
    assert.ok(funnel.includes('href="/go"'));
    const paths = seo.MARKETING_PAGES.map((row) => row.path);
    assert.strictEqual(paths.length, 7);
    ['/funnel', '/recovery', '/pq', '/replicas', '/byo', '/module-registry'].forEach((href) => {
      assert.ok(!paths.includes(href), href);
    });
    const index = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
    const backend = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
    const commerce = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'sovereign-commerce.js'), 'utf8');
    const chain = require('../package.json').scripts['test:chain'];
    assert.ok(index.includes("'/funnel', '/recovery', '/affiliate/desk', '/pq', '/replicas', '/byo', '/module-registry'"));
    assert.ok(index.includes('roadmap-desk'));
    assert.ok(backend.includes("app.use('/api/roadmap'"));
    assert.ok(commerce.includes('noteConversion'));
    assert.strictEqual(chain.split('roadmap-live.test.js').length, 2);
  });

  console.log(passed + ' passed');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
