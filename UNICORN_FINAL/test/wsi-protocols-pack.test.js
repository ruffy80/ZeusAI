'use strict';

/**
 * wsi-protocols-pack.test.js — World-Standard Inventions Pack (10 protocols)
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.ENABLE_FILE_MUTATORS = '0';
process.env.WORLD_STANDARD_DATA_DIR = require('path').join(
  require('os').tmpdir(),
  'wsi-pack-test-' + process.pid
);

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => {
      passed++;
      console.log('  ✓', name);
    });
  }
  passed++;
  console.log('  ✓', name);
  return undefined;
}

async function main() {
  console.log('WSI Protocols Pack (PoOP/ACE/ARC/DPAK/EIQ/CTP/ARK/DPS/MBE/VOM)');

  const wsi = require('../backend/modules/world-standard-inventions');
  wsi.start();

  await check('pack exposes 10 inventions', () => {
    assert.strictEqual(Object.keys(wsi.MODULES).length, 10);
    const st = wsi.getStatus();
    assert.strictEqual(st.ok, true);
    assert.strictEqual(st.protocol, 'WSI/1.0');
    assert.strictEqual(st.running, true);
  });

  await check('DPAK safe plane armed under stable; growth idle', () => {
    const planes = wsi.dpak.currentPlanes();
    assert.strictEqual(planes.safe.armed, true);
    assert.strictEqual(planes.growth.armed, false);
    const rec = wsi.dpak.recommendIakMode();
    // Stable/safe plane → IAK owns TAAC + non-mutator heal (not bare monitor).
    assert.strictEqual(rec.mode, 'safe-autonomy');
    const denied = wsi.dpak.assertGrowthPlane('uee');
    assert.strictEqual(denied.ok, false);
  });

  await check('ARK never claims Stripe/email ready without keys', () => {
    const scan = wsi.ark.scanRails();
    assert.ok(scan.rails.some((r) => r.id === 'btc-direct' && r.armed));
    const stripe = scan.rails.find((r) => r.id === 'stripe');
    assert.ok(stripe);
    assert.strictEqual(stripe.armed, false);
    assert.ok(Array.isArray(scan.nextActions));
  });

  await check('MBE blocks backend mutation under stable', () => {
    const denied = wsi.mbe.enforce({
      type: 'module.replace',
      engine: 'test',
      targets: ['backend/modules/foo.js'],
    });
    assert.strictEqual(denied.ok, false);
    const allowed = wsi.mbe.enforce({
      type: 'innovation.generate',
      engine: 'test',
      targets: ['data/innovations/idea.json'],
    });
    assert.strictEqual(allowed.ok, true);
  });

  await check('PoOP open → deliver → probe → release', () => {
    const open = wsi.poop.openEscrow({
      orderId: 'ord_wsi_1',
      serviceId: 'instant-seo-content-pack',
      amountUsd: 49,
    });
    assert.strictEqual(open.ok, true);
    const escId = open.escrow.escrowId;
    const artifact = { ok: true, pack: 'seo' };
    const hash = crypto.createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
    assert.strictEqual(wsi.poop.attachDelivery({ escrowId: escId, deliveryHash: hash }).ok, true);
    const probe = wsi.poop.runProbes({ escrowId: escId, expectedHash: hash });
    assert.strictEqual(probe.passed, true);
    const rel = wsi.poop.release({ escrowId: escId });
    assert.strictEqual(rel.ok, true);
    assert.strictEqual(rel.escrow.status, 'released');
    assert.ok(String(rel.escrow.releaseAttestation.note || '').includes('owner wallet'));
  });

  await check('PoOP refund intent never claims clawback', () => {
    const open = wsi.poop.openEscrow({
      orderId: 'ord_wsi_refund',
      serviceId: 'instant-pitch-deck',
      amountUsd: 149,
    });
    const intent = wsi.poop.openRefundIntent({
      escrowId: open.escrow.escrowId,
      reason: 'probe_failed',
    });
    assert.strictEqual(intent.ok, true);
    assert.strictEqual(intent.intent.automaticClawback, false);
    assert.strictEqual(intent.intent.executed, false);
  });

  await check('ACE requires payment proof to fund credits', () => {
    const denied = wsi.ace.fundCredits({ agentId: 'agent-a', credits: 20 });
    assert.strictEqual(denied.ok, false);
    const funded = wsi.ace.fundCredits({
      agentId: 'agent-a',
      credits: 20,
      paymentProof: 'ord_paid_123',
    });
    assert.strictEqual(funded.ok, true);
    const listing = wsi.ace.listListings()[0];
    assert.ok(listing);
    const reserved = wsi.ace.reserve({
      buyerId: 'agent-a',
      listingId: listing.listingId,
      qty: 1,
    });
    assert.strictEqual(reserved.ok, true);
    assert.ok(reserved.credential.credentialId);
  });

  await check('ARC mints offer without inventing GMV', () => {
    const r = wsi.arc.recordAttention({
      actorId: 'user-1',
      weight: 5,
      channel: 'zeusai-social',
    });
    assert.strictEqual(r.ok, true);
    assert.ok(r.offer);
    assert.strictEqual(r.offer.bookedRevenue, false);
    assert.strictEqual(r.offer.live, false);
  });

  await check('DPS issue + verify passport', () => {
    const artifact = { hello: 'world' };
    const issued = wsi.dps.issuePassport({
      orderId: 'ord_dps_1',
      serviceId: 'instant-seo-content-pack',
      artifact,
    });
    assert.strictEqual(issued.ok, true);
    const v = wsi.dps.verifyPassport({ passportId: issued.passport.passportId });
    assert.strictEqual(v.ok, true);
  });

  await check('CTP issue + export + verify', () => {
    const issued = wsi.ctp.issueTwin({
      email: 'buyer@example.com',
      orderId: 'ord_ctp_1',
      serviceId: 'instant-seo-content-pack',
      amountUsd: 49,
      status: 'paid',
    });
    assert.strictEqual(issued.ok, true);
    const exp = wsi.ctp.exportTwin(issued.twin.twinId);
    assert.strictEqual(exp.ok, true);
    const v = wsi.ctp.verifyBundle(exp.bundle);
    assert.strictEqual(v.ok, true);
  });

  await check('VOM refuses open without real orderId', () => {
    const denied = wsi.vom.openCycle({ verticalId: 'seo-agency' });
    assert.strictEqual(denied.ok, false);
    const opened = wsi.vom.openCycle({
      verticalId: 'seo-agency',
      orderId: 'ord_vom_1',
      email: 'buyer@example.com',
      paid: true,
    });
    assert.strictEqual(opened.ok, true);
    const delivered = wsi.vom.advanceDelivery({ cycleId: opened.cycle.cycleId, release: true });
    assert.strictEqual(delivered.ok, true);
    const closed = wsi.vom.closeCycle({ cycleId: opened.cycle.cycleId });
    assert.strictEqual(closed.ok, true);
  });

  await check('EIQ checkQuorum returns structured snapshot', async () => {
    const snap = await wsi.eiq.checkQuorum();
    assert.ok(snap);
    assert.ok(typeof snap.quorum === 'boolean');
    assert.ok(Array.isArray(snap.peers));
    assert.ok(snap.peers.length >= 1);
  });

  await check('mountRoutes registers pack endpoints', () => {
    const routes = [];
    const app = {
      get(path) { routes.push(['GET', path]); },
      post(path) { routes.push(['POST', path]); },
    };
    const r = wsi.mountRoutes(app, { adminTokenMiddleware: (req, res, next) => next() });
    assert.strictEqual(r.ok, true);
    assert.ok(routes.some((x) => x[1] === '/api/wsi/status'));
    assert.ok(routes.some((x) => x[1] === '/api/poop/open'));
    assert.ok(routes.some((x) => x[1] === '/.well-known/world-standard.json'));
  });

  try { fs.rmSync(process.env.WORLD_STANDARD_DATA_DIR, { recursive: true, force: true }); } catch (_) {}

  console.log(`\n✅ wsi-protocols-pack: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
