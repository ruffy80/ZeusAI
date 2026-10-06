'use strict';

/**
 * Frontier Continuum — FCO/1.0
 *
 * One cycle binds the five local engines to the commercial signals that
 * already exist: confirmed cash (Earn-Then-Lease) and the listed strategic
 * packages. A listed price is not a sale. No spacecraft, implant, or
 * quantum channel is claimed.
 */

const PROTOCOL = 'FCO/1.0';

let last = null;

function _sense(override) {
  const extra = override && typeof override === 'object' ? override : {};
  let lane = 'free';
  let confirmedUsd = 0;
  let paidHumans = 0;
  try {
    const rung = require('./earn-then-lease').rung();
    lane = rung && rung.lane === 'earned' ? 'earned' : 'free';
    confirmedUsd = Number(rung && rung.confirmedUsd) || 0;
    paidHumans = Number(rung && rung.paidHumans) || 0;
  } catch (_) { /* cash stays zero */ }
  let freeMemPct = 100;
  try {
    const space = require('./AutonomousSpaceComputing').getStatus();
    if (space && space.freeMemPct != null) freeMemPct = Number(space.freeMemPct);
  } catch (_) { /* treat compute as nominal */ }
  const sense = {
    lane,
    confirmedUsd,
    paidHumans,
    freeMemPct,
  };
  if (extra.lane === 'earned' || extra.lane === 'free') sense.lane = extra.lane;
  if (extra.confirmedUsd != null) sense.confirmedUsd = Number(extra.confirmedUsd) || 0;
  if (extra.paidHumans != null) sense.paidHumans = Number(extra.paidHumans) || 0;
  if (extra.freeMemPct != null) sense.freeMemPct = Number(extra.freeMemPct);
  sense.stressed = sense.freeMemPct < 15;
  return sense;
}

function _shelf() {
  try {
    const engine = require('../../src/modules/billionScaleRevenueEngine');
    const packages = engine.buildStrategicPackages({})
      .filter((pkg) => pkg && pkg.id && Number(pkg.priceUsd) > 0)
      .slice()
      .sort((a, b) => a.priceUsd - b.priceUsd);
    const next = packages[0] || null;
    const lastPkg = packages[packages.length - 1] || null;
    return {
      count: packages.length,
      minUsd: next ? next.priceUsd : 0,
      maxUsd: lastPkg ? lastPkg.priceUsd : 0,
      next: next ? {
        id: next.id,
        title: next.title,
        priceUsd: next.priceUsd,
        sold: false,
        checkoutPath: '/checkout/?plan=' + encodeURIComponent(next.id),
      } : null,
    };
  } catch (e) {
    return { count: 0, minUsd: 0, maxUsd: 0, next: null };
  }
}

function _action(sense) {
  if (sense.stressed) return 'defer_heavy';
  if (sense.lane === 'earned') return 'earned_lane_open';
  return 'offer_listed_package';
}

function cycle(input) {
  const body = input && typeof input === 'object' ? input : {};
  const sense = _sense(body.sense);
  const shelf = _shelf();
  const action = _action(sense);

  const twins = require('./DecentralizedDigitalTwinNetwork');
  twins.upsert('fco-lane', {
    lane: sense.lane,
    confirmedUsd: sense.confirmedUsd,
    paidHumans: sense.paidHumans,
  });
  twins.upsert('fco-shelf', {
    count: shelf.count,
    nextOfferId: shelf.next ? shelf.next.id : null,
    sold: false,
  });
  twins.link('fco-lane', 'fco-shelf');
  const laneNode = twins.snapshot().nodes.find((node) => node.id === 'fco-lane');

  const qnet = require('./QuantumInternetProtocol');
  qnet.createNode('fco-lane');
  qnet.createNode('fco-shelf');
  const link = qnet.openLink('fco-lane', 'fco-shelf');
  const sent = qnet.send('fco-lane', 'fco-shelf', {
    hash: laneNode && laneNode.hash,
    lane: sense.lane,
    confirmedUsd: sense.confirmedUsd,
  });
  const got = qnet.receive('fco-shelf');
  const packet = got.packets[0] || null;
  const sealed = !!(sent.ok && packet && packet.payload && packet.payload.hash === (laneNode && laneNode.hash));

  const qml = require('./QuantumMachineLearningCore');
  qml.train([
    { features: [0, 0], label: 0 },
    { features: [1, 0], label: 0 },
    { features: [0, 1], label: 1 },
    { features: [1, 1], label: 1 },
  ]);
  const features = [sense.lane === 'earned' ? 1 : 0, sense.stressed ? 1 : 0];
  const prediction = qml.predict(features);
  const modelAgrees = (prediction.label === 1) === sense.stressed;

  const space = require('./AutonomousSpaceComputing');
  const job = space.submit({
    id: 'frontier-cycle',
    payload: action + ':' + (shelf.next ? shelf.next.id : 'none'),
  });

  try {
    require('./usi-memory').remember('frontier', {
      action,
      lane: sense.lane,
      confirmedUsd: sense.confirmedUsd,
      offer: shelf.next ? shelf.next.id : null,
    });
  } catch (_) { /* memory is optional */ }

  last = {
    ok: !!(sealed && job.ok && modelAgrees),
    protocol: PROTOCOL,
    at: new Date().toISOString(),
    inventsSales: false,
    inventsHardware: false,
    claimsOrbital: false,
    claimsPlanetaryGrid: false,
    claimsNeuralImplant: false,
    claimsQuantumChannel: false,
    claimsQuantumHardware: false,
    lane: sense.lane,
    confirmedUsd: sense.confirmedUsd,
    paidHumans: sense.paidHumans,
    stressed: sense.stressed,
    freeMemPct: sense.freeMemPct,
    action,
    dispatch: action !== 'defer_heavy',
    nextOffer: shelf.next,
    shelf: { count: shelf.count, minUsd: shelf.minUsd, maxUsd: shelf.maxUsd },
    seal: {
      ok: sealed,
      channel: link.channel || null,
      mac: sent.mac || null,
    },
    model: {
      label: prediction.label,
      agrees: modelAgrees,
      backend: 'statevector+perceptron',
    },
    job: job.ok ? { id: job.job.id, checksum: job.job.checksum } : { ok: false, reason: job.reason },
  };
  return last;
}

function getStatus() {
  return last || {
    ok: true,
    protocol: PROTOCOL,
    ran: false,
    inventsSales: false,
    inventsHardware: false,
  };
}

function discovery() {
  return cycle();
}

module.exports = {
  PROTOCOL,
  cycle,
  getStatus,
  discovery,
  name: 'frontier-continuum',
};
