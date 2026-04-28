/**
 * marketing-innovations.test.js — strict additive verification.
 *
 * Asserts that:
 *   1. Each sub-engine (content, bandit, seo, attribution, affiliate,
 *      outreach) is loadable and produces well-shaped output.
 *   2. The dispatcher serves new endpoints behind a tiny http server.
 *   3. The pre-existing autoViralGrowth.getViralStatus() shape is
 *      preserved (no regression).
 *
 * Strictly additive: persistence files are redirected to os.tmpdir().
 */

'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketing-pack-'));
process.env.MARKETING_BANDIT_FILE = path.join(tmpRoot, 'bandit.jsonl');
process.env.MARKETING_TOUCH_FILE = path.join(tmpRoot, 'touchpoints.jsonl');
process.env.MARKETING_AFFILIATE_FILE = path.join(tmpRoot, 'affiliate-ledger.jsonl');
process.env.MARKETING_AFFILIATE_SECRET = 'test-secret-' + process.pid;
process.env.MARKETING_BTC_USD = '50000';
process.env.PLATFORM_FEE_PCT = '0.3';
process.env.AUDIT_50Y_TOKEN = 'mkt-token-' + process.pid;
process.env.LEGAL_OWNER_BTC = 'bc1qowner_test_address';
delete process.env.MARKETING_PACK_DISABLED;

const mkt = require('../backend/modules/marketing-innovations');
const autoViralGrowth = require('../backend/modules/autoViralGrowth');

function reqJson(server, method, path, body, headers) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: Object.assign({
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(data),
    }, headers || {}) }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (_) { parsed = buf; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // ── 1. autoViralGrowth shape preserved ───────────────────────────────
  {
    const v = autoViralGrowth.getViralStatus();
    assert.ok(v && v.metrics, 'getViralStatus must still return metrics');
    for (const k of ['viralScore', 'referralCodesGenerated', 'referralSignups', 'socialMentions', 'partnerMentions', 'growthLoopsExecuted', 'estimatedReach']) {
      assert.ok(k in v.metrics, 'autoViralGrowth metrics must keep field: ' + k);
    }
    assert.strictEqual(v.state, 'AUTONOMOUS_VIRAL_GROWTH_ACTIVE');
    console.log('[OK] autoViralGrowth shape preserved');
  }

  // ── 2. content multi-channel ────────────────────────────────────────
  {
    const out = mkt.content.generateMultiChannel({ topic: 'AI marketing', channels: ['X', 'LinkedIn', 'Email'], perChannel: 2, seed: 'fixed-seed' });
    assert.strictEqual(out.requestedChannels.length, 3);
    assert.strictEqual(out.variants.length, 6);
    for (const v of out.variants) {
      assert.ok(v.id.startsWith('VAR-'));
      assert.ok(v.body.length > 0 && v.body.length <= v.maxChars, `variant ${v.id} length ${v.body.length} <= ${v.maxChars}`);
      assert.ok(v.cta && v.cta.length > 0);
    }
    // Determinism with same seed.
    const out2 = mkt.content.generateMultiChannel({ topic: 'AI marketing', channels: ['X'], perChannel: 1, seed: 'fixed-seed' });
    assert.strictEqual(out2.variants[0].body, mkt.content.generateMultiChannel({ topic: 'AI marketing', channels: ['X'], perChannel: 1, seed: 'fixed-seed' }).variants[0].body);
    console.log('[OK] content-multichannel');
  }

  // ── 3. bandit Thompson Sampling ─────────────────────────────────────
  {
    mkt.bandit._resetForTests();
    for (let i = 0; i < 50; i++) { mkt.bandit.click('camp1', 'A'); mkt.bandit.impression('camp1', 'A'); }
    for (let i = 0; i < 50; i++) { mkt.bandit.noClick('camp1', 'B'); mkt.bandit.impression('camp1', 'B'); }
    let winsA = 0;
    for (let i = 0; i < 100; i++) if (mkt.bandit.pickBest('camp1').armId === 'A') winsA += 1;
    assert.ok(winsA > 80, `Thompson Sampling should pick A clearly, got ${winsA}/100`);
    const sum = mkt.bandit.summary('camp1');
    assert.strictEqual(sum.arms[0].armId, 'A');
    console.log(`[OK] bandit picks the winner ${winsA}/100 times`);
  }

  // ── 4. SEO ───────────────────────────────────────────────────────────
  {
    const kw = mkt.seo.expandKeywords('AI marketing', { max: 25 });
    assert.ok(kw.keywords.length === 25, 'should produce 25 keywords');
    assert.ok(kw.keywords.every((k) => k.keyword && k.slug && k.intent));
    const meta = mkt.seo.buildMetaTags({ title: 'Unicorn', description: 'Hi', url: 'https://unicorn.example' });
    assert.ok(meta.html.includes('og:title') && meta.html.includes('twitter:card'));
    const jsonld = mkt.seo.buildJsonLd('Product', { name: 'P', price: 99 });
    assert.strictEqual(jsonld['@type'], 'Product');
    assert.strictEqual(jsonld.offers.price, '99');
    const faq = mkt.seo.buildJsonLd('FAQPage', { faqs: [{ q: 'Why?', a: 'Because.' }] });
    assert.strictEqual(faq.mainEntity.length, 1);
    console.log('[OK] seo-engine');
  }

  // ── 5. Attribution ──────────────────────────────────────────────────
  {
    mkt.attribution._resetForTests();
    mkt.attribution.recordTouch({ sessionId: 's1', channel: 'twitter', ts: '2026-01-01T00:00:00Z' });
    mkt.attribution.recordTouch({ sessionId: 's1', channel: 'email', ts: '2026-01-02T00:00:00Z' });
    mkt.attribution.recordTouch({ sessionId: 's1', channel: 'linkedin', ts: '2026-01-03T00:00:00Z' });
    const conv = mkt.attribution.recordConversion({ sessionId: 's1', value: 100, ts: '2026-01-04T00:00:00Z' });
    assert.ok(conv.attribution.models.first_touch.twitter === 100);
    assert.ok(conv.attribution.models.last_touch.linkedin === 100);
    const linearTotal = Object.values(conv.attribution.models.linear).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(linearTotal - 100) < 1e-6);
    const sum = mkt.attribution.summary({ model: 'time_decay' });
    assert.strictEqual(sum.conversions, 1);
    assert.strictEqual(sum.totalValue, 100);

    const ltv = mkt.attribution.ltvCac({ arpaMonthly: 100, grossMargin: 0.8, monthlyChurn: 0.05, totalSpend: 1000, customersAcquired: 10 });
    assert.strictEqual(ltv.cac, 100);
    assert.ok(ltv.ltv > 1000);
    assert.strictEqual(ltv.verdict, 'healthy');

    const k = mkt.attribution.kFactor({ users: 100, invitesSent: 200, invitesAccepted: 80, cycleDays: 7 });
    assert.ok(Math.abs(k.kFactor - 0.8) < 1e-9);
    assert.strictEqual(k.selfSustaining, false);
    console.log('[OK] attribution + ltv-cac + k-factor');
  }

  // ── 6. Affiliate revenue + BTC payout ───────────────────────────────
  {
    mkt.affiliate._resetForTests();
    const a = mkt.affiliate.createAffiliate({ ownerName: 'Alice', email: 'alice@example.com', btcAddress: 'bc1qaffiliatealice', defaultCommissionPct: 0.2 });
    assert.ok(a.ok);
    const verify = mkt.affiliate.verify(a.signed);
    assert.strictEqual(verify, a.affiliate.code);
    // Idempotent
    const a2 = mkt.affiliate.createAffiliate({ email: 'alice@example.com' });
    assert.strictEqual(a2.affiliate.code, a.affiliate.code);

    const link = mkt.affiliate.buildLink({ code: a.affiliate.code, target: 'https://unicorn.example/pricing', campaign: 'launch', source: 'twitter', medium: 'social' });
    assert.ok(link.ok && link.url.includes('utm_campaign=launch') && link.url.includes('ref=' + a.affiliate.code));
    const sh = mkt.affiliate.shorten(link.url);
    assert.ok(sh.ok && sh.shortPath.startsWith('/go/'));
    assert.strictEqual(mkt.affiliate.resolve(sh.shortId), link.url);

    mkt.affiliate.trackClick(a.affiliate.code);
    const conv = mkt.affiliate.trackConversion({ code: a.affiliate.code, amountUsd: 1000 });
    assert.ok(conv.ok);
    assert.ok(conv.event.ownerCutUsd > 0);
    assert.strictEqual(conv.event.ownerBtcAddress, process.env.LEGAL_OWNER_BTC);
    assert.ok(conv.event.ownerSats > 0);
    const ledger = mkt.affiliate.ledgerSummary({});
    assert.ok(ledger.affiliates.length === 1);
    assert.ok(ledger.ownerTotalUsd > 0);
    assert.strictEqual(ledger.ownerBtcAddress, process.env.LEGAL_OWNER_BTC);
    const payout = mkt.affiliate.ownerPayout({});
    assert.ok(payout.totalSats > 0);
    console.log(`[OK] affiliate · owner payout ${payout.totalUsd} USD = ${payout.totalSats} sats → ${payout.ownerBtcAddress}`);
  }

  // ── 7. Outreach + sentiment + experiments ───────────────────────────
  {
    const em = mkt.outreach.draftEmail({ toName: 'Bob', company: 'Acme', valueProp: 'cut CAC by 50%' });
    assert.ok(em.subject && em.body && em.body.includes('Bob'));
    assert.strictEqual(em.followUps.length, 2);
    const dm = mkt.outreach.draftDM({ handle: 'bob' });
    assert.ok(dm.text.startsWith('hey @bob'));
    const pr = mkt.outreach.draftPressRelease({ company: 'Unicorn', headline: 'Launches AI Agent' });
    assert.ok(pr.body.includes('Unicorn'));

    const pos = mkt.outreach.score('this is amazing and great');
    assert.ok(pos.score > 0 && pos.label === 'positive');
    const neg = mkt.outreach.score('this is terrible and awful');
    assert.ok(neg.score < 0 && neg.label === 'negative');

    mkt.outreach._resetForTests();
    const e = mkt.outreach.register({ name: 'CTA color', hypothesis: 'Orange beats blue', primaryMetric: 'ctr', targetLift: 0.05 });
    assert.ok(e.ok);
    mkt.outreach.recordObservation(e.experiment.id, { variant: 'orange', metricValue: 0.06 });
    mkt.outreach.recordObservation(e.experiment.id, { variant: 'blue', metricValue: 0.04 });
    const list = mkt.outreach.listExperiments();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].observationCount, 2);
    const closed = mkt.outreach.closeExperiment(e.experiment.id, 'won');
    assert.strictEqual(closed.experiment.status, 'won');
    console.log('[OK] outreach + sentiment + experiments');
  }

  // ── 8. HTTP dispatcher integration ──────────────────────────────────
  {
    const server = http.createServer(async (req, res) => {
      if (await mkt.handle(req, res)) return;
      res.writeHead(404); res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));

    const status = await reqJson(server, 'GET', '/api/marketing/status');
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.body.pack, 'marketing-innovations');

    const variants = await reqJson(server, 'GET', '/api/marketing/content/variants?topic=AI&channels=X,Email&perChannel=1');
    assert.strictEqual(variants.status, 200);
    assert.strictEqual(variants.body.variants.length, 2);

    const kw = await reqJson(server, 'GET', '/api/marketing/seo/keywords?seed=AI%20agents&max=15');
    assert.strictEqual(kw.status, 200);
    assert.strictEqual(kw.body.keywords.length, 15);

    const meta = await reqJson(server, 'GET', '/api/marketing/seo/meta?title=Unicorn&description=Test&url=https%3A%2F%2Funicorn.example');
    assert.strictEqual(meta.status, 200);
    assert.ok(meta.body.html.includes('og:title'));

    // Owner-only route should reject without token
    const denied = await reqJson(server, 'POST', '/api/marketing/affiliate/create', { email: 'denied@example.com' });
    assert.strictEqual(denied.status, 401);

    // With token it works
    const created = await reqJson(server, 'POST', '/api/marketing/affiliate/create',
      { email: 'http@example.com', ownerName: 'HTTP', btcAddress: 'bc1qhttp' },
      { 'x-owner-token': process.env.AUDIT_50Y_TOKEN });
    assert.strictEqual(created.status, 200);
    assert.ok(created.body.ok);
    const code = created.body.affiliate.code;

    const tracked = await reqJson(server, 'POST', '/api/marketing/affiliate/track', { event: 'conversion', code, amountUsd: 500 });
    assert.strictEqual(tracked.status, 200);
    assert.ok(tracked.body.ok);

    const payout = await reqJson(server, 'GET', '/api/marketing/owner/payout', null, { 'x-owner-token': process.env.AUDIT_50Y_TOKEN });
    assert.strictEqual(payout.status, 200);
    assert.ok(payout.body.totalUsd > 0);
    assert.strictEqual(payout.body.ownerBtcAddress, process.env.LEGAL_OWNER_BTC);

    // Short-link redirect via /go/<id>
    const linkResp = await reqJson(server, 'POST', '/api/marketing/affiliate/link',
      { code, target: 'https://unicorn.example/pricing', campaign: 'launch' });
    assert.strictEqual(linkResp.status, 200);
    const shortId = linkResp.body.shortId;
    assert.ok(shortId);
    const redir = await new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: server.address().port, path: '/go/' + shortId, method: 'GET' },
        (res) => { res.resume(); resolve(res); });
      r.on('error', reject); r.end();
    });
    assert.strictEqual(redir.statusCode, 302);
    assert.ok(redir.headers.location && redir.headers.location.includes('utm_campaign=launch'));

    // Bandit track + best
    await reqJson(server, 'POST', '/api/marketing/bandit/track', { campaign: 'http-c', armId: 'X', event: 'click' });
    await reqJson(server, 'POST', '/api/marketing/bandit/track', { campaign: 'http-c', armId: 'X', event: 'impression' });
    const best = await reqJson(server, 'GET', '/api/marketing/bandit/best?campaign=http-c');
    assert.strictEqual(best.status, 200);
    assert.strictEqual(best.body.best.armId, 'X');

    // 404 untouched
    const notFound = await reqJson(server, 'GET', '/api/does-not-exist');
    assert.strictEqual(notFound.status, 404);

    server.close();
    console.log('[OK] HTTP dispatcher integration');
  }

  // Stop autoViralGrowth interval so the test process can exit.
  try { autoViralGrowth.stop(); } catch (_) {}
  console.log('\n✅ marketing-innovations.test.js — all checks passed');
}

run().catch((e) => { console.error(e); process.exit(1); });
