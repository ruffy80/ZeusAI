// test/commerce-stage567.test.js
// End-to-end coverage for stages 5-7:
//   enterprise-catalog, negotiation-engine, contract-generator,
//   revenue-vault, governance, whale-tracker, outreach-engine,
//   instant-catalog, unified-catalog, universal-site-engine.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'commerce');
for (const f of [
  'negotiation.jsonl','contracts.jsonl','revenue-vault.jsonl',
  'governance-audit.jsonl','outreach.jsonl','enterprise-products.json',
  'whales.json'
]) { try { fs.rmSync(path.join(DATA_DIR, f), { force: true }); } catch (_) {} }
try { fs.rmSync(path.join(DATA_DIR, 'contracts'), { recursive: true, force: true }); } catch (_) {}

const entCatalog       = require('../src/commerce/enterprise-catalog');
const negotiator       = require('../src/commerce/negotiation-engine');
const contractGen      = require('../src/commerce/contract-generator');
const vault            = require('../src/commerce/revenue-vault');
const governance       = require('../src/commerce/governance');
const outreach         = require('../src/commerce/outreach-engine');
const instantCatalog   = require('../src/commerce/instant-catalog');
const unifiedCatalog   = require('../src/commerce/unified-catalog');
const whales           = require('../src/commerce/whale-tracker');
const useFactory       = require('../src/engine/universal-site-engine');

negotiator._resetForTests();
contractGen._resetForTests();
vault._resetForTests();
governance._resetForTests();
outreach._resetForTests();
whales._resetForTests();

function run() {
  // ── enterprise-catalog ──────────────────────────────────────────────
  const all = entCatalog.all();
  assert.ok(all.length >= 3);
  const license = entCatalog.byId('ent-platform-license');
  assert.ok(license && license.priceUSD > 0);
  const pub = entCatalog.publicView();
  assert.ok(Array.isArray(pub) && pub[0].inputs);
  const sum = entCatalog.summarize();
  assert.equal(sum.products, all.length);
  assert.ok(sum.totalListedValueUSD > 0);
  console.log('[ok] enterprise-catalog');

  // ── negotiation-engine + contract-generator + governance + vault ─────
  const deal = negotiator.startDeal({
    productId: 'ent-platform-license',
    buyer: { email: 'ceo@acme.com', legalEntity: 'Acme Inc', contactName: 'Jane Doe' },
    offerUSD: 100000,
    message: 'opening offer'
  });
  assert.ok(deal.id && deal.state === 'open');

  // Invalid product / buyer
  assert.throws(() => negotiator.startDeal({ productId: 'nope', buyer: { email: 'a@b.co' } }), /product_not_found/);
  assert.throws(() => negotiator.startDeal({ productId: 'ent-platform-license', buyer: { email: 'bad' } }), /buyer_email_invalid/);

  const c1 = negotiator.counter(deal.id, 150000, 'still low');
  assert.equal(c1.state, 'countered');
  assert.ok(c1.counterOfferUSD >= 125000);
  // history records both actor sides
  const actors = c1.history.map(h => h.actor);
  assert.ok(actors.includes('seller'));
  assert.ok(actors.includes('buyer'));

  const a1 = negotiator.accept(deal.id);
  assert.equal(a1.state, 'pending_governance');
  assert.ok(a1.acceptedPriceUSD > 0);

  // Wrong OTP
  assert.throws(() => negotiator.confirmGovernance(deal.id, '000000'), /otp_invalid/);
  const otp = negotiator._peekOtp(deal.id);
  assert.ok(/^\d{6}$/.test(otp));
  const final = negotiator.confirmGovernance(deal.id, otp);
  assert.equal(final.state, 'confirmed');
  assert.ok(final.contractId);

  // Idempotent confirm
  const final2 = negotiator.confirmGovernance(deal.id, otp);
  assert.equal(final2.state, 'confirmed');

  // Listing
  assert.ok(negotiator.listDeals().some(d => d.id === deal.id));
  assert.equal(negotiator.getDeal(deal.id).state, 'confirmed');

  // Contract verification
  const c = contractGen.byDealId(deal.id);
  assert.ok(c && c.signatureB64 && c.publicKeyPem);
  assert.equal(contractGen.verify(c), true);
  // Tampering breaks the signature.
  const tampered = Object.assign({}, c, { body: c.body + '\nTAMPER' });
  assert.equal(contractGen.verify(tampered), false);
  // HTML render
  const html = contractGen.html(c);
  assert.ok(html.includes(c.id) && html.includes('Ed25519'));

  // Governance recorded the audit chain
  const gov = governance.snapshot();
  assert.ok(gov.audit.total >= 2);
  assert.ok(gov.audit.kinds.deal_accept >= 1);
  assert.ok(gov.audit.kinds.deal_confirm >= 1);

  // Vault auto-allocated for the confirmed deal
  const vs = vault.snapshot();
  assert.ok(vs.allocations >= 1);
  assert.ok(vs.totalUSD > 0);
  assert.ok(vs.byChannel.BTC && vs.byChannel.PayPal);

  // findUnsettledSplit + settle
  const us = vault.findUnsettledSplit(deal.id, 'BTC');
  assert.ok(us && us.splitId);
  const settled = vault.settle(us.allocId, us.splitId, 'btc:tx-deadbeef');
  assert.equal(settled.settled, true);
  assert.equal(settled.txRef, 'btc:tx-deadbeef');

  console.log('[ok] negotiation + contracts + governance + vault');

  // ── outreach-engine ─────────────────────────────────────────────────
  const camp = outreach.createCampaign({
    name: 'April Launch',
    audience: ['a@x.com','b@x.com'],
    subject: 'Launch',
    body: 'Hello',
    consentVerified: true
  });
  assert.equal(camp.status, 'draft');
  assert.equal(camp.audienceSize, 2);
  const tickRes = outreach.tick();
  assert.ok(tickRes.scheduled >= 1);
  const snap = outreach.snapshot();
  assert.ok(snap.total >= 1);
  assert.ok(snap.byStatus.scheduled >= 1);
  // No-consent campaigns stay draft.
  outreach.createCampaign({ name: 'no consent', audience: [], consentVerified: false });
  outreach.tick();
  assert.ok(outreach.snapshot().byStatus.draft >= 1);
  console.log('[ok] outreach');

  // ── whales (offline-friendly) ───────────────────────────────────────
  const ws = whales.snapshot();
  assert.ok(ws.generatedAt);
  console.log('[ok] whales (snapshot)');

  // ── instant + unified catalogs ──────────────────────────────────────
  const ic = instantCatalog.publicView();
  assert.ok(ic.length >= 3);
  assert.ok(ic[0].inputs);
  unifiedCatalog.setRuntimeSources({ marketplace: [{ id: 'mp-x', title: 'Market X', priceUSD: 25 }], industries: [{ id: 'ind-y', title: 'Industry Y', priceUSD: 0 }] });
  const uall = unifiedCatalog.all();
  assert.ok(uall.find(p => p.id === 'mp-x'));
  assert.ok(uall.find(p => p.id === 'ind-y'));
  assert.ok(uall.find(p => p.id === 'instant-website-audit'));
  assert.ok(uall.find(p => p.id === 'ent-platform-license'));
  const usum = unifiedCatalog.summarize();
  assert.ok(usum.products >= 6);
  assert.ok(usum.byGroup.instant >= 3);
  assert.ok(usum.byGroup.enterprise >= 3);
  // Tier filter
  const onlyInstant = unifiedCatalog.publicView({ tier: 'instant' });
  assert.ok(onlyInstant.every(p => p.tier === 'instant'));
  console.log('[ok] instant + unified catalogs');

  // ── universal-site-engine ───────────────────────────────────────────
  const use = useFactory.create({ sources: null });
  assert.equal(use.matches('/api/anything'), false);
  assert.equal(use.observe({ url: '/health' }, {}, 0), false);
  // Setter mirrors into siteSync
  use.sources = { marketplace: [{ id: 'a' }], industries: [], modules: [] };
  assert.deepEqual(use.siteSync.sources, use.sources);
  assert.ok(use.siteSync.lastSyncAt);
  // onPayment fan-out
  let received = null;
  const unsub = use.subscribe(r => { received = r; });
  use.onPayment({ id: 'rcpt_x', amount: 49, status: 'paid', method: 'BTC' });
  assert.equal(received && received.id, 'rcpt_x');
  unsub();
  // Snapshot after activity
  const usnap = use.snapshot();
  assert.ok(usnap.counters.payments >= 1);
  assert.equal(usnap.marketplaceCount, 1);
  // start/stop are safe to call.
  use.start(60000);
  use.stop();
  // Probe blocking is opt-in via env
  process.env.USE_BLOCK_PROBES = '1';
  const use2 = useFactory.create({ sources: null });
  let blocked = false;
  const fakeRes = { writeHead: () => { blocked = true; }, end: () => {} };
  assert.equal(use2.observe({ url: '/.env' }, fakeRes, 0), true);
  assert.equal(blocked, true);
  delete process.env.USE_BLOCK_PROBES;
  console.log('[ok] universal-site-engine');

  console.log('commerce-stage567 test passed');
}

run();
