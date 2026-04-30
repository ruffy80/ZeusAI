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
process.env.MARKETING_INNOVATION_LEDGER = path.join(tmpRoot, 'innovation-ledger.jsonl');
// Disable the auto-running self-innovation loop during tests; we drive
// it manually via tick() to keep results deterministic.
process.env.MARKETING_INNOVATION_LOOP_DISABLED = '1';
// Disable v1.2 background timers so tests don't keep the process alive.
process.env.MARKETING_SCHEDULER_DISABLED = '1';
process.env.MARKETING_VIRAL_MONITOR_DISABLED = '1';
// Use tmp paths for v1.2 ledgers.
process.env.MARKETING_OUTBOUND_LEDGER = path.join(tmpRoot, 'outbound-ledger.jsonl');
process.env.MARKETING_OUTBOUND_RSS = path.join(tmpRoot, 'rss.xml');
process.env.MARKETING_OG_CACHE = path.join(tmpRoot, 'og-cache');
process.env.MARKETING_SCHEDULER_QUEUE = path.join(tmpRoot, 'scheduler-queue.jsonl');
process.env.MARKETING_ENGAGEMENT_LEDGER = path.join(tmpRoot, 'engagement-ledger.jsonl');
process.env.MARKETING_WAITLIST_FILE = path.join(tmpRoot, 'waitlist.jsonl');
process.env.MARKETING_PSEO_SITEMAP = path.join(tmpRoot, 'pseo-sitemap.xml');
process.env.MARKETING_INFLUENCER_FILE = path.join(tmpRoot, 'influencer.jsonl');
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

  // ── 9. Viral amplifier ──────────────────────────────────────────────
  {
    mkt.viral._resetForTests();
    const loops = mkt.viral.listLoops();
    assert.ok(loops.length >= 6, 'default viral loops should be seeded');
    for (const l of loops) {
      assert.ok(l.id && l.name && typeof l.healthScore === 'number');
    }

    const newLoop = mkt.viral.registerLoop({ name: 'Test loop', kind: 'custom', strength: 0.9, kFactorTarget: 1.5 });
    assert.ok(newLoop.id);
    const upd = mkt.viral.recordLoopOutcome({ id: newLoop.id, kFactor: 1.4, ctr: 0.12, shares: 10 });
    assert.ok(upd.ok);
    assert.strictEqual(upd.loop.observations, 1);

    const sa = mkt.viral.buildShareAssets({ url: 'https://unicorn.example/launch', title: 'Try Unicorn', hashtag: 'UnicornTest' });
    assert.ok(sa.id.startsWith('SH-'));
    assert.ok(sa.channels.length >= 8);
    const xShare = sa.channels.find((c) => c.channel === 'X');
    assert.ok(xShare.shareUrl.includes('twitter.com/intent/tweet'));
    assert.ok(xShare.shareUrl.includes('hashtags=UnicornTest'));

    const proof = mkt.viral.socialProof({ users: 1234, kFactor: 1.2, satsPaid: 9999999 });
    assert.ok(proof.badges.length >= 3);
    assert.ok(proof.badges.some((b) => b.label.includes('self-sustaining')));

    const ampl = mkt.viral.launchAmplify({
      topic: 'Launch Day',
      url: 'https://unicorn.example/launch',
      channels: ['X', 'LinkedIn'],
      perChannel: 2,
      affiliateCode: '',
    });
    assert.ok(ampl.id.startsWith('AMPL-'));
    assert.strictEqual(ampl.variants.length, 4);
    assert.ok(ampl.shareBundle.id);
    assert.ok(ampl.boost.factor >= 0 && ampl.boost.factor <= 10);

    const recent = mkt.viral.recentAmplifications(5);
    assert.ok(recent.length === 1);
    assert.strictEqual(recent[0].id, ampl.id);

    const boost = mkt.viral.boostFactor();
    assert.ok(boost.factor >= 0 && boost.factor <= 10);
    console.log(`[OK] viral-amplifier · boost ${boost.factor}/10`);
  }

  // ── 10. Self-innovation loop ────────────────────────────────────────
  {
    mkt.innovationLoop._resetForTests();
    const seedStatus = mkt.innovationLoop.getStatus();
    assert.ok(seedStatus.totalStrategies >= 6, 'should seed >=6 initial strategies');
    assert.strictEqual(seedStatus.cyclesRun, 0);

    const all = mkt.innovationLoop.listStrategies({});
    assert.ok(all.length >= 6);
    // Feed observations to ALL seeds: a steep gradient so retire/spawn logic kicks in.
    for (let i = 0; i < all.length; i++) {
      const quality = 1 - i / all.length; // 1.0 → ~0
      for (let j = 0; j < 8; j++) {
        mkt.innovationLoop.observe(all[i].id, {
          kFactor: 0.05 + quality * 1.4,
          ctr: 0.005 + quality * 0.18,
          revenueUsd: quality * 500,
          shares: Math.round(quality * 50),
        });
      }
    }

    const cycle = mkt.innovationLoop.tick({ spawn: 4 });
    assert.ok(cycle.id.startsWith('CYC-'));
    assert.ok(cycle.spawned.length === 4, 'should spawn 4 candidates');
    assert.ok(cycle.totalStrategies >= all.length + 4);
    assert.ok(cycle.topScore >= cycle.medianScore, 'top must be at least the median');
    assert.ok(cycle.topScore > 0, 'top score should be > 0 with observations');
    assert.ok(cycle.retired.length >= 0);

    // Loser must have been retired (it's the strategy with lowest score and >=5 obs).
    const retiredList = mkt.innovationLoop.listStrategies({ status: 'retired' });
    assert.ok(Array.isArray(retiredList));
    // With 6 eligible @ 10% retire rate the floor is 0 — so retirement may
    // not occur in the first cycle. Run an additional cycle with more
    // observations to ensure retirement logic functions at scale.
    for (let extra = 0; extra < 15; extra++) {
      mkt.innovationLoop.addStrategy({});
      const all2 = mkt.innovationLoop.listStrategies({});
      mkt.innovationLoop.observe(all2[all2.length - 1].id, { kFactor: 0.01 });
    }
    // Bring all newly-added strategies up to >=5 observations so they are eligible.
    const newcomers = mkt.innovationLoop.listStrategies({}).filter((s) => s.observations.length < 5 && s.status === 'active');
    for (const n of newcomers) {
      for (let j = 0; j < 6; j++) mkt.innovationLoop.observe(n.id, { kFactor: 0.02, ctr: 0.001 });
    }
    const cycleScale = mkt.innovationLoop.tick({ spawn: 2 });
    assert.ok(cycleScale.retired.length >= 1, 'with >=20 eligible strategies retirement must occur');
    const retiredAfter = mkt.innovationLoop.listStrategies({ status: 'retired' });
    assert.ok(retiredAfter.length >= retiredList.length + cycleScale.retired.length,
      'retired list must grow by the number of strategies retired this cycle');

    // Candidates exist with parentId pointing at top performer.
    const candidates = mkt.innovationLoop.listStrategies({ status: 'candidate' });
    assert.ok(candidates.length >= 4);
    assert.ok(candidates.every((c) => c.parentId), 'candidates must reference parent');
    assert.ok(candidates.every((c) => c.generation >= 1), 'candidates must have generation >= 1');

    // Run a second cycle to verify monotonic operation.
    const cycle2 = mkt.innovationLoop.tick({ spawn: 2 });
    assert.ok(mkt.innovationLoop.getStatus().cyclesRun >= 3);
    assert.ok(cycle2.spawned.length === 2);

    // observe() flips a candidate to active.
    const cand = candidates[0];
    mkt.innovationLoop.observe(cand.id, { kFactor: 1.0, ctr: 0.1 });
    const after = mkt.innovationLoop.listStrategies({}).find((s) => s.id === cand.id);
    assert.strictEqual(after.status, 'active');

    console.log(`[OK] self-innovation-loop · ${seedStatus.totalStrategies}→${cycle2.totalStrategies} strategies, 2 cycles, top ${cycle2.topScore}`);
  }

  // ── 11. Pack getStatus() exposes new additive fields ────────────────
  {
    const s = mkt.getStatus();
    // Existing fields preserved.
    for (const k of ['pack', 'version', 'channels', 'bandits', 'affiliates', 'experiments', 'ownerBtcAddress']) {
      assert.ok(k in s, 'getStatus must keep field: ' + k);
    }
    // New additive fields present.
    assert.ok('viralBoostFactor' in s, 'viralBoostFactor must be exposed');
    assert.ok('viralLoops' in s);
    assert.ok('innovation' in s);
    assert.ok(typeof s.viralBoostFactor.factor === 'number');
    assert.ok(typeof s.innovation.totalStrategies === 'number');
    console.log('[OK] pack status exposes viral + innovation fields');
  }

  // ── 12. HTTP integration for new routes ─────────────────────────────
  {
    const server = http.createServer(async (req, res) => {
      if (await mkt.handle(req, res)) return;
      res.writeHead(404); res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));

    const v = await reqJson(server, 'GET', '/api/marketing/viral/status');
    assert.strictEqual(v.status, 200);
    assert.ok(v.body.boost && typeof v.body.boost.factor === 'number');

    const sa = await reqJson(server, 'POST', '/api/marketing/viral/share-assets',
      { url: 'https://unicorn.example/p', title: 'Hello' });
    assert.strictEqual(sa.status, 200);
    assert.ok(Array.isArray(sa.body.channels));

    const ampl = await reqJson(server, 'POST', '/api/marketing/viral/amplify',
      { topic: 'HTTP Launch', url: 'https://unicorn.example/p', channels: ['X'], perChannel: 1 });
    assert.strictEqual(ampl.status, 200);
    assert.ok(ampl.body.id.startsWith('AMPL-'));

    const proof = await reqJson(server, 'GET', '/api/marketing/viral/social-proof?users=1000&kFactor=1.5&satsPaid=12345');
    assert.strictEqual(proof.status, 200);
    assert.ok(proof.body.badges.length >= 2);

    const denied = await reqJson(server, 'POST', '/api/marketing/innovation/tick', {});
    assert.strictEqual(denied.status, 401);

    const tick = await reqJson(server, 'POST', '/api/marketing/innovation/tick', { spawn: 2 },
      { 'x-owner-token': process.env.AUDIT_50Y_TOKEN });
    assert.strictEqual(tick.status, 200);
    assert.ok(tick.body.id.startsWith('CYC-'));

    const innStatus = await reqJson(server, 'GET', '/api/marketing/innovation/status');
    assert.strictEqual(innStatus.status, 200);
    assert.ok(innStatus.body.cyclesRun >= 1);

    server.close();
    console.log('[OK] HTTP integration · viral + innovation routes');
  }

  // ── 13. v1.2 — outbound publisher (dry-run) ─────────────────────────
  {
    mkt.outbound._resetForTests();
    const r = await mkt.outbound.publish({ platform: 'rss', body: 'Hello world', title: 'Test' });
    assert.ok(r.ok, 'rss publish must succeed');
    const r2 = await mkt.outbound.publish({ platform: 'unknown' });
    assert.ok(!r2.ok && r2.reason === 'unknown_platform');
    const b = await mkt.outbound.broadcast({ platforms: ['rss'], body: 'B', title: 'T' });
    assert.ok(b.ok && b.dryRun);
    const st = mkt.outbound.status();
    assert.ok(Array.isArray(st.adapters) && st.adapters.includes('rss'));
    console.log('[OK] outbound-publisher · dry-run safe');
  }

  // ── 14. v1.2 — AI copywriter fallback ───────────────────────────────
  {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    mkt.aiCopy._resetForTests();
    const out = await mkt.aiCopy.generate({ topic: 'Unicorn', channels: ['X'], perChannel: 2, seed: 'fixed' });
    assert.strictEqual(out.provider, 'fallback');
    assert.ok(typeof out.text === 'string' && out.text.length > 0);
    assert.ok(Array.isArray(out.variants) && out.variants.length === 2);
    const out2 = await mkt.aiCopy.generate({ topic: 'Unicorn', channels: ['X'], perChannel: 2, seed: 'fixed' });
    assert.ok(out2.cached, 'second call must hit cache');
    console.log('[OK] ai-copywriter · fallback + cache');
  }

  // ── 15. v1.2 — media forge SVG ──────────────────────────────────────
  {
    const r = mkt.mediaForge.buildAndCache({ title: 'Unicorn', subtitle: 'Hello', cta: 'Try' });
    assert.ok(r.ok && r.svg.includes('<svg') && r.svg.includes('</svg>'));
    assert.ok(r.svg.includes('Unicorn'));
    const cached = mkt.mediaForge.loadCached(r.hash);
    assert.strictEqual(cached, r.svg);
    console.log('[OK] media-forge · SVG cached');
  }

  // ── 16. v1.2 — scheduler best-time + queue ──────────────────────────
  {
    mkt.scheduler._resetForTests();
    const slot = mkt.scheduler.bestNextSlot('LinkedIn', Date.now());
    assert.ok(slot.atMs > Date.now());
    assert.ok(slot.hourUtc >= 0 && slot.hourUtc <= 23);
    const item = mkt.scheduler.schedule({ platform: 'rss', body: 'x', atMs: Date.now() + 60_000 });
    assert.ok(item.id.startsWith('SCH-'));
    const drip = mkt.scheduler.scheduleDrip({ platforms: ['rss'], body: 'dr', steps: 3, everyMs: 60_000 });
    assert.ok(drip.ok && drip.count === 3);
    const cancelled = mkt.scheduler.cancel(item.id);
    assert.ok(cancelled.ok);
    console.log('[OK] scheduler · best-time + drip + cancel');
  }

  // ── 17. v1.2 — engagement-bot sentiment routing ─────────────────────
  {
    mkt.engagement._resetForTests();
    const pos = mkt.engagement.processInbound({ platform: 'X', actor: 'a', text: 'I love it, amazing job!' });
    assert.ok(pos.ok && pos.action.startsWith('auto_reply'));
    assert.ok(typeof pos.reply === 'string' && pos.reply.length > 0);
    const neg = mkt.engagement.processInbound({ platform: 'X', actor: 'b', text: 'This is awful and horrible terrible bad' });
    assert.ok(neg.ok && neg.action === 'escalate_owner' && neg.reply === null);
    mkt.engagement.blacklist('spammer');
    const blk = mkt.engagement.processInbound({ platform: 'X', actor: 'spammer', text: 'I love this' });
    assert.strictEqual(blk.action, 'ignore');
    console.log('[OK] engagement-bot · sentiment + escalation + blacklist');
  }

  // ── 18. v1.2 — growth-experiments ───────────────────────────────────
  {
    mkt.growthExperiments._resetForTests();
    const ex = mkt.growthExperiments.create({ name: 'hero', variants: [{ armId: 'A', payload: { h: 'a' } }, { armId: 'B', payload: { h: 'b' } }] });
    assert.ok(ex.ok && ex.experiment.id);
    const id = ex.experiment.id;
    for (let i = 0; i < 30; i++) mkt.growthExperiments.track(id, { armId: 'A', event: 'click' });
    for (let i = 0; i < 30; i++) mkt.growthExperiments.track(id, { armId: 'A', event: 'no_click' });
    for (let i = 0; i < 30; i++) mkt.growthExperiments.track(id, { armId: 'B', event: 'no_click' });
    const pick = mkt.growthExperiments.pickVariant(id);
    assert.ok(pick.ok);
    const close = mkt.growthExperiments.close(id);
    assert.ok(close.ok && close.experiment.status === 'closed');
    console.log('[OK] growth-experiments · A/B with bandit');
  }

  // ── 19. v1.2 — viral-coefficient-monitor ────────────────────────────
  {
    mkt.viralMonitor._resetForTests();
    mkt.viralMonitor.sampleNow();
    mkt.viralMonitor.sampleNow();
    mkt.viralMonitor.sampleNow();
    const e = mkt.viralMonitor.evaluate();
    assert.ok(typeof e.triggered === 'boolean');
    assert.ok(typeof mkt.viralMonitor.status().samples === 'number');
    console.log('[OK] viral-coefficient-monitor');
  }

  // ── 20. v1.2 — waitlist mechanic with referral jump ─────────────────
  {
    mkt.waitlist._resetForTests();
    const a = mkt.waitlist.join({ email: 'a@example.com' });
    assert.ok(a.ok && a.entry.position === 1);
    const b = mkt.waitlist.join({ email: 'b@example.com' });
    assert.ok(b.entry.position === 2);
    const c = mkt.waitlist.join({ email: 'c@example.com', referredByCode: a.entry.code });
    assert.ok(c.ok);
    const lookup = mkt.waitlist.lookup(a.entry.code);
    assert.ok(lookup.ok && lookup.entry.referrals === 1);
    const lb = mkt.waitlist.leaderboard(10);
    assert.ok(Array.isArray(lb) && lb.length >= 3);
    const dup = mkt.waitlist.join({ email: 'A@example.com' });
    assert.ok(dup.duplicate);
    const bad = mkt.waitlist.join({ email: 'not-an-email' });
    assert.ok(!bad.ok);
    console.log('[OK] waitlist-mechanic · referral jump + dedup');
  }

  // ── 21. v1.2 — programmatic SEO ─────────────────────────────────────
  {
    const p = mkt.pseo.buildPage({ category: 'Email Marketing', region: 'București' });
    assert.ok(p.ok && p.slug.includes('email-marketing'));
    assert.ok(p.jsonLd.mainEntity.length === 3);
    const batch = mkt.pseo.buildBatch({ categories: ['Email', 'SEO'], regions: ['București', 'Cluj'] });
    assert.ok(batch.ok && batch.count === 4);
    const sm = mkt.pseo.buildSitemap(batch.pages);
    assert.ok(sm.ok && sm.xml.includes('<urlset'));
    const idx = await mkt.pseo.indexNowPing({ host: 'unicorn.example', urls: ['https://unicorn.example/'] });
    assert.ok(idx.ok === false || idx.dryRun === true);
    console.log('[OK] programmatic-seo · pages + sitemap + indexnow');
  }

  // ── 22. v1.2 — influencer CRM ───────────────────────────────────────
  {
    mkt.influencer._resetForTests();
    const r = mkt.influencer.add({ handle: '@vip', platform: 'X', audience: 5_000_000, engagement: 0.08, fit: 0.9 });
    assert.ok(r.ok);
    assert.ok(r.record.score > 50);
    const small = mkt.influencer.add({ handle: '@small', platform: 'X', audience: 100, engagement: 0.05, fit: 0.5 });
    assert.ok(small.record.tier === 'bronze');
    const upd = mkt.influencer.setStatus(r.record.id, 'contacted');
    assert.ok(upd.ok && upd.record.status === 'contacted');
    const draft = mkt.influencer.draftOutreach(r.record.id, { topic: 'launch' });
    assert.ok(draft.ok && draft.draft);
    const list = mkt.influencer.list({});
    assert.ok(list.length === 2);
    console.log('[OK] influencer-crm · scoring + tiers + outreach');
  }

  // ── 23. v1.2 — abuse shield ─────────────────────────────────────────
  {
    mkt.abuseShield._resetForTests();
    for (let i = 0; i < 30; i++) mkt.abuseShield.record({ kind: 'click', code: 'C1', ip: '1.2.3.4', ua: 'bot/1.0' });
    const r = mkt.abuseShield.risk({ code: 'C1', ip: '1.2.3.4', ua: 'bot/1.0' });
    assert.ok(r.score >= 0.4, 'high concentration should flag risk: ' + r.score);
    assert.ok(r.reasons.includes('high_fp_concentration'));
    const self = mkt.abuseShield.record({
      kind: 'conversion', code: 'C2', ip: '5.6.7.8', ua: 'mozilla', signupIp: '5.6.7.8', signupUa: 'mozilla',
    });
    assert.ok(self.suspect && self.reason === 'self_referral');
    console.log('[OK] abuse-shield · concentration + self-referral');
  }

  // ── 24. v1.2 — i18n amplifier ───────────────────────────────────────
  {
    assert.strictEqual(mkt.i18n.t('sign_up_free', 'ro'), 'Înregistrează-te gratuit');
    assert.strictEqual(mkt.i18n.t('try_now', 'fr'), 'Essayer maintenant');
    assert.strictEqual(mkt.i18n.t('unknown_key', 'ro'), 'unknown_key');
    assert.strictEqual(mkt.i18n.pickLocale('ro,en;q=0.5'), 'ro');
    assert.strictEqual(mkt.i18n.pickLocale('xx,en;q=0.8'), 'en');
    const v = mkt.i18n.localizeVariant({ cta: 'Try Now', body: 'hello' }, 'es');
    assert.strictEqual(v.cta, 'Pruébalo ahora');
    assert.strictEqual(v.body, 'hello');
    console.log('[OK] i18n-amplifier · 7 locales');
  }

  // ── 25. v1.2 — metrics + dashboard + admin-toggle ──────────────────
  {
    const snap = mkt.metricsEngine.snapshot();
    assert.ok(snap.metrics && typeof snap.metrics.viral_loops === 'number');
    const prom = mkt.metricsEngine.toProm(snap);
    assert.ok(prom.includes('marketing_viral_loops') && prom.includes('# TYPE'));
    const html = mkt.dashboard.render();
    assert.ok(html.includes('<table') && html.includes('Unicorn Marketing Dashboard'));
    mkt.adminToggle._resetForTests();
    const set1 = mkt.adminToggle.set('outbound', false);
    assert.ok(set1.ok);
    assert.strictEqual(mkt.adminToggle.get('outbound'), false);
    assert.strictEqual(mkt.adminToggle.isEnabled('outbound', false), false);
    const setBad = mkt.adminToggle.set('nope', true);
    assert.ok(!setBad.ok);
    console.log('[OK] metrics + dashboard + admin-toggle');
  }

  // ── 26. v1.2 — HTTP integration sample for new routes ──────────────
  {
    const server = http.createServer(async (req, res) => {
      if (await mkt.handle(req, res)) return;
      res.writeHead(404); res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));

    // Public route: copy/generate via fallback.
    const cg = await reqJson(server, 'POST', '/api/marketing/copy/generate', { topic: 'X', channels: ['X'], perChannel: 1, seed: 'k' });
    assert.strictEqual(cg.status, 200);
    assert.strictEqual(cg.body.provider, 'fallback');

    // Public route: waitlist join.
    const wj = await reqJson(server, 'POST', '/api/marketing/waitlist/join', { email: 'http-' + process.pid + '@example.com' });
    assert.strictEqual(wj.status, 200);
    assert.ok(wj.body.entry && wj.body.entry.code);

    // Public route: i18n translate.
    const tr = await reqJson(server, 'GET', '/api/marketing/i18n/translate?key=try_now&locale=ro');
    assert.strictEqual(tr.status, 200);
    assert.strictEqual(tr.body.text, 'Încearcă acum');

    // Owner-only route: outbound publish denied without token.
    const opub = await reqJson(server, 'POST', '/api/marketing/outbound/publish', { platform: 'rss', body: 'x' });
    assert.strictEqual(opub.status, 401);
    const opubOk = await reqJson(server, 'POST', '/api/marketing/outbound/publish',
      { platform: 'rss', body: 'x', title: 't' },
      { 'x-owner-token': process.env.AUDIT_50Y_TOKEN });
    assert.strictEqual(opubOk.status, 200);

    // Public: prom metrics text.
    const m = await new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: server.address().port, path: '/api/marketing/metrics?format=prom', method: 'GET' }, (res) => {
        let buf = ''; res.on('data', (c) => { buf += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
      }); r.on('error', reject); r.end();
    });
    assert.strictEqual(m.status, 200);
    assert.ok(/^text\/plain/.test(m.headers['content-type'] || ''));
    assert.ok(m.body.includes('marketing_'));

    // Owner-only: dashboard.
    const dash = await new Promise((resolve, reject) => {
      const r = http.request({
        host: '127.0.0.1', port: server.address().port, path: '/internal/marketing/dashboard',
        method: 'GET', headers: { 'x-owner-token': process.env.AUDIT_50Y_TOKEN },
      }, (res) => { let buf = ''; res.on('data', (c) => { buf += c; }); res.on('end', () => resolve({ status: res.statusCode, body: buf, headers: res.headers })); });
      r.on('error', reject); r.end();
    });
    assert.strictEqual(dash.status, 200);
    assert.ok(/^text\/html/.test(dash.headers['content-type'] || ''));
    assert.ok(dash.body.includes('<table'));

    server.close();
    console.log('[OK] HTTP integration · v1.2 routes');
  }

  // Stop the self-innovation loop interval if any test enabled it.
  try { mkt.innovationLoop.stop(); } catch (_) {}
  // Stop autoViralGrowth interval so the test process can exit.
  try { autoViralGrowth.stop(); } catch (_) {}
  // v1.2 background timers (already disabled via env).
  try { mkt.scheduler.stop(); } catch (_) {}
  try { mkt.viralMonitor.stop(); } catch (_) {}
  console.log('\n✅ marketing-innovations.test.js — all checks passed');
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
