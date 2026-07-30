'use strict';

/**
 * World-Standard Inventions Pack — WSI/1.0
 * Loads and starts the 10 inventions; mounts HTTP routes; registers on IAK mesh.
 */

const poop = require('./proof-of-outcome-protocol');
const ace = require('./agent-capability-exchange');
const arc = require('./attention-revenue-continuum');
const dpak = require('./dual-plane-autonomy-kernel');
const eiq = require('./external-immortality-quorum');
const ctp = require('./commerce-twin-portable');
const ark = require('./armed-rails-continuum');
const dps = require('./delivery-passport-standard');
const mbe = require('./mutation-boundary-enforcer');
const vom = require('./vertical-outcome-machines');

const PROTOCOL = 'WSI/1.0';
const NAME = 'world-standard-inventions';

const MODULES = {
  poop, ace, arc, dpak, eiq, ctp, ark, dps, mbe, vom,
};

const state = {
  startedAt: null,
  running: false,
};

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || new Date().toISOString();
  for (const mod of Object.values(MODULES)) {
    try {
      if (mod && typeof mod.start === 'function') mod.start();
    } catch (_) { /* isolate */ }
  }
  return getStatus();
}

function getStatus() {
  const inventions = {};
  for (const [key, mod] of Object.entries(MODULES)) {
    try {
      inventions[key] = mod.getStatus ? mod.getStatus() : { ok: false };
    } catch (e) {
      inventions[key] = { ok: false, error: e.message };
    }
  }
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'World-Standard Inventions Pack',
    running: !!state.running,
    startedAt: state.startedAt,
    count: Object.keys(MODULES).length,
    inventions,
    timestamp: new Date().toISOString(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    catalog: Object.values(MODULES).map((m) => {
      try { return m.discovery ? m.discovery() : m.getStatus(); } catch (e) {
        return { ok: false, error: e.message };
      }
    }),
  };
}

function registerOnMesh(mesh) {
  if (!mesh || typeof mesh.register !== 'function') return { ok: false };
  const specs = [
    ['proofOfOutcomeProtocol', poop],
    ['agentCapabilityExchange', ace],
    ['attentionRevenueContinuum', arc],
    ['dualPlaneAutonomyKernel', dpak],
    ['externalImmortalityQuorum', eiq],
    ['commerceTwinPortable', ctp],
    ['armedRailsContinuum', ark],
    ['deliveryPassportStandard', dps],
    ['mutationBoundaryEnforcer', mbe],
    ['verticalOutcomeMachines', vom],
    ['worldStandardInventions', module.exports],
  ];
  let n = 0;
  for (const [name, inst] of specs) {
    try {
      mesh.register(name, inst, {
        statusFn: 'getStatus',
        tier: 'infra',
        honestyClass: 'infra',
        bootPriority: 15,
        capability: name,
      });
      n += 1;
    } catch (_) { /* continue */ }
  }
  return { ok: true, registered: n };
}

function mountRoutes(app, opts = {}) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  const admin = opts.adminTokenMiddleware || ((req, res, next) => next());

  // Pack
  app.get('/api/wsi/status', (req, res) => res.json(getStatus()));
  app.get('/api/wsi/discovery', (req, res) => res.json(discovery()));
  app.get('/.well-known/world-standard.json', (req, res) => res.json(discovery()));

  // PoOP
  app.get('/api/poop/status', (req, res) => res.json(poop.getStatus()));
  app.get('/api/poop/escrows', (req, res) => res.json({ ok: true, escrows: poop.listEscrows(req.query.limit) }));
  app.post('/api/poop/open', (req, res) => res.json(poop.openEscrow(req.body || {})));
  app.post('/api/poop/deliver', (req, res) => res.json(poop.attachDelivery(req.body || {})));
  app.post('/api/poop/probe', (req, res) => res.json(poop.runProbes(req.body || {})));
  app.post('/api/poop/release', (req, res) => res.json(poop.release(req.body || {})));
  app.post('/api/poop/refund-intent', (req, res) => res.json(poop.openRefundIntent(req.body || {})));

  // ACE
  app.get('/api/ace/status', (req, res) => res.json(ace.getStatus()));
  app.get('/api/ace/listings', (req, res) => res.json({ ok: true, listings: ace.listListings() }));
  app.post('/api/ace/list', (req, res) => res.json(ace.listCapability(req.body || {})));
  app.post('/api/ace/fund', (req, res) => res.json(ace.fundCredits(req.body || {})));
  app.post('/api/ace/reserve', (req, res) => res.json(ace.reserve(req.body || {})));

  // ARC
  app.get('/api/arc/status', (req, res) => res.json(arc.getStatus()));
  app.get('/api/arc/offers', (req, res) => res.json({ ok: true, offers: arc.listOffers(req.query.limit) }));
  app.post('/api/arc/attention', (req, res) => res.json(arc.recordAttention(req.body || {})));
  app.post('/api/arc/link-checkout', (req, res) => res.json(arc.linkCheckout(req.body || {})));
  app.post('/api/arc/convert', (req, res) => res.json(arc.observeConversion(req.body || {})));

  // DPAK
  app.get('/api/dpak/status', (req, res) => res.json(dpak.getStatus()));
  app.get('/api/dpak/planes', (req, res) => res.json(dpak.currentPlanes()));
  app.post('/api/dpak/assert-growth', (req, res) => res.json(dpak.assertGrowthPlane((req.body || {}).engine)));
  app.post('/api/dpak/tick-safe', (req, res) => res.json(dpak.tickSafe()));

  // EIQ
  app.get('/api/eiq/status', (req, res) => res.json(eiq.getStatus()));
  app.post('/api/eiq/check', admin, async (req, res) => {
    try { res.json(await eiq.checkQuorum()); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // CTP
  app.get('/api/ctp/status', (req, res) => res.json(ctp.getStatus()));
  app.get('/api/ctp/twin/:twinId', (req, res) => {
    const twin = ctp.getTwin(req.params.twinId);
    if (!twin) return res.status(404).json({ ok: false, reason: 'twin_not_found' });
    return res.json({ ok: true, twin });
  });
  app.post('/api/ctp/issue', (req, res) => res.json(ctp.issueTwin(req.body || {})));
  app.post('/api/ctp/export', (req, res) => res.json(ctp.exportTwin((req.body || {}).twinId)));
  app.post('/api/ctp/verify', (req, res) => res.json(ctp.verifyBundle((req.body || {}).bundle || req.body)));

  // ARK / rails
  app.get('/api/ark/status', (req, res) => res.json(ark.getStatus()));
  app.get('/api/ark/scan', (req, res) => res.json(ark.scanRails()));
  app.get('/api/rails/status', (req, res) => res.json(ark.scanRails()));

  // DPS
  app.get('/api/dps/status', (req, res) => res.json(dps.getStatus()));
  app.get('/api/dps/passports', (req, res) => res.json({ ok: true, passports: dps.listPassports(req.query.limit) }));
  app.post('/api/dps/issue', (req, res) => res.json(dps.issuePassport(req.body || {})));
  app.post('/api/dps/verify', (req, res) => res.json(dps.verifyPassport(req.body || {})));

  // MBE
  app.get('/api/mbe/status', (req, res) => res.json(mbe.getStatus()));
  app.get('/api/mbe/violations', (req, res) => res.json({ ok: true, violations: mbe.listViolations(req.query.limit) }));
  app.post('/api/mbe/enforce', (req, res) => res.json(mbe.enforce(req.body || {})));

  // VOM
  app.get('/api/vom/status', (req, res) => res.json(vom.getStatus()));
  app.get('/api/vom/verticals', (req, res) => res.json({ ok: true, verticals: vom.listVerticals() }));
  app.post('/api/vom/open', (req, res) => res.json(vom.openCycle(req.body || {})));
  app.post('/api/vom/deliver', (req, res) => res.json(vom.advanceDelivery(req.body || {})));
  app.post('/api/vom/close', (req, res) => res.json(vom.closeCycle(req.body || {})));

  return { ok: true, mounted: true };
}

/**
 * Hook helpers for commerce settle path — best-effort, never throws.
 */
function onPaymentConfirmed(payload = {}) {
  try {
    poop.openEscrow(payload);
  } catch (_) {}
  try {
    ctp.issueTwin(payload);
  } catch (_) {}
  try {
    if (payload.arcOfferId) {
      arc.linkCheckout({ offerId: payload.arcOfferId, orderId: payload.orderId });
      if (payload.paid) {
        arc.observeConversion({
          offerId: payload.arcOfferId,
          orderId: payload.orderId,
          amountUsd: payload.amountUsd,
        });
      }
    }
  } catch (_) {}
}

function onDeliveryCompleted(payload = {}) {
  try {
    const issued = dps.issuePassport(payload);
    if (issued && issued.ok && payload.orderId) {
      poop.attachDelivery({
        orderId: payload.orderId,
        deliveryHash: payload.artifactHash || issued.passport.artifactHash,
        passportId: issued.passport.passportId,
      });
    }
    return issued;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  PROTOCOL,
  NAME,
  MODULES,
  start,
  getStatus,
  discovery,
  registerOnMesh,
  mountRoutes,
  onPaymentConfirmed,
  onDeliveryCompleted,
  // re-exports
  poop,
  ace,
  arc,
  dpak,
  eiq,
  ctp,
  ark,
  dps,
  mbe,
  vom,
};
