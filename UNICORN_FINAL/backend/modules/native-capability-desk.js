'use strict';

/**
 * NATIVE CAPABILITY DESK — NCD/1.0
 *
 * One desk for the five operating jobs already named on the platform:
 * demand, product pack, revenue, governance, and a contest between those
 * organs. It calls the shelf, the competitor spy, the CFO, fulfillment
 * preview, and the spend gate. It does not start a second orchestrator,
 * write source, place an order, or invent a customer, a cost, or a margin.
 *
 * A hypothesis stays untested until a real paid order exists. This desk
 * never creates that order.
 */

const PROTOCOL = 'NCD/1.0';
const CANARY = 'port 3100, deploy-atomic-forward.sh';
const log = [];

function remember(row) {
  log.push(row);
  if (log.length > 40) log.shift();
}

function shelf() {
  return require('../../src/commerce/public-shelf');
}

function previewOf(serviceId, item) {
  const engine = require('../../src/site/v2/fulfillment-engine');
  return engine.offerPreview(serviceId, {
    mode: item && item.mode,
    clock: item && item.clock,
    tier: item && item.tier,
  });
}

function spyStatus() {
  try {
    const spy = require('./competitor-spy-agent');
    const status = spy.getStatus();
    return {
      armed: !!(status && status.armed),
      dataMode: status && status.dataMode || 'unarmed',
      monitored: Number(status && status.competitorsMonitored) || 0,
      source: 'competitor-spy-agent',
    };
  } catch (err) {
    return { armed: false, dataMode: 'unavailable', monitored: 0, source: 'competitor-spy-agent', error: err.message };
  }
}

function cfoStatus() {
  try {
    const cfo = require('./ai-cfo-agent');
    const status = cfo.getStatus();
    const live = !!(status && status.dataMode === 'live');
    return {
      dataMode: status && status.dataMode || 'unarmed',
      armed: !!(status && status.armed),
      revenue: live ? Number(status.revenue) : null,
      // The CFO keeps expenses at 0 because no cost API exists. That zero is
      // not a measured cost, so profit and margin stay unclaimed.
      expenses: null,
      profit: null,
      costMeasured: false,
      simulated: false,
      source: 'ai-cfo-agent',
    };
  } catch (err) {
    return { dataMode: 'unavailable', armed: false, revenue: null, expenses: null, profit: null, costMeasured: false, simulated: false, source: 'ai-cfo-agent', error: err.message };
  }
}

function aiArmed() {
  try {
    return !!require('./public-ai-spend-gate').hasBillableLlm();
  } catch (_) {
    return false;
  }
}

function demand(text) {
  const advice = shelf().advise(String(text || ''));
  const primary = advice && advice.primary;
  const spy = spyStatus();
  const risks = [];
  if (!spy.armed) risks.push('Competition is unmeasured. SERPAPI_KEY is not set, so no competitor list is invented.');
  risks.push('Acquisition cost is unmeasured.');
  if (!aiArmed()) risks.push('No billable model key is armed. Minute files still ship as the activation pack, and that pack includes the written brief. An allowlisted SKU uses a model only when a key exists.');
  if (advice && Array.isArray(advice.limits) && advice.limits.length) {
    risks.push(advice.limits[0].title || 'A shelf limit applies.');
  }
  const offer = primary ? {
    id: primary.id,
    title: primary.title,
    priceUsd: primary.priceUsd,
    mode: primary.mode,
    buyable: primary.buyable === true,
    strategy: primary.strategy,
  } : null;
  return {
    organ: 'demand',
    ok: true,
    offer,
    limits: (advice && advice.limits) || [],
    competition: spy,
    risks,
    hypothesis: {
      statement: offer
        ? 'The existing offer ' + offer.id + ' matches this request and can be checked out on the live Bitcoin rail.'
        : 'No public offer matches this request.',
      tested: false,
      confirmed: false,
      investment: 'none',
      reason: 'A hypothesis is confirmed only by a real paid order. This desk does not place one.',
    },
    evidence: [
      { source: 'public-shelf.advise', measured: true, value: offer ? offer.id : null },
      { source: spy.source, measured: spy.armed, value: spy.dataMode },
    ],
  };
}

function buildPack(serviceId) {
  const item = shelf().byId(serviceId);
  if (!item) {
    return {
      organ: 'factory',
      ok: false,
      serviceId: String(serviceId || ''),
      parts: {},
      filesWritten: [],
      applied: false,
    };
  }
  const preview = previewOf(item.id, item);
  return {
    organ: 'factory',
    ok: true,
    serviceId: item.id,
    applied: false,
    filesWritten: [],
    parts: {
      interface: { source: 'publicShelf', id: item.id, title: item.title, priceUsd: item.priceUsd, ctaHref: item.ctaHref, ctaLabel: item.ctaLabel, mode: item.mode },
      backend: { source: 'POST /api/checkout/create', invoked: false },
      documentation: { source: 'fulfillment.offerPreview', fileTitle: preview.fileTitle, kind: preview.kind, sections: preview.sections },
      tests: ['test/public-shelf.test.js', 'test/offer-preview.test.js'],
      commercialPage: ['/pricing', '/services', '/buy'],
      delivery: { source: 'fulfillment.offerPreview', kind: preview.kind, note: preview.note },
    },
  };
}

function verifyPack(pack) {
  const failures = [];
  if (!pack || !pack.ok) failures.push('no_shelf_offer');
  const face = pack && pack.parts && pack.parts.interface;
  const doc = pack && pack.parts && pack.parts.documentation;
  const delivery = pack && pack.parts && pack.parts.delivery;
  if (face && face.mode === 'contact' && face.ctaHref && String(face.ctaHref).indexOf('/checkout') !== -1) {
    failures.push('contact_mode_opened_a_cart');
  }
  if (face && face.mode !== 'contact' && face.mode !== 'unavailable' && !face.ctaHref) failures.push('missing_checkout_href');
  if (!doc || !doc.fileTitle) failures.push('missing_delivery_file');
  if (doc && delivery && doc.kind !== delivery.kind) failures.push('preview_disagrees');
  if (pack && pack.filesWritten && pack.filesWritten.length) failures.push('factory_wrote_files');
  const pass = failures.length === 0;
  return {
    organ: 'verifier',
    pass,
    failures,
    launch: false,
    applied: false,
    reason: pass
      ? 'The existing shelf card, checkout href, and delivery file agree. Nothing was launched or written.'
      : 'The pack is not a consistent existing offer.',
    evidence: [{ source: 'verifyPack', measured: true, value: pass }],
  };
}

function productPack(serviceId) {
  const pack = buildPack(serviceId);
  const verdict = verifyPack(pack);
  return Object.assign({}, pack, { verdict });
}

function retentionOf(customers) {
  if (!Array.isArray(customers) || !customers.length) {
    return { measured: false, cohorts: null, source: 'retention-engine', reason: 'No live customer list was supplied.' };
  }
  try {
    const engine = require('./retention-engine');
    const out = engine.analyze({ customers });
    return { measured: true, cohorts: out.cohorts, source: 'request_body', reason: 'Scores use only the rows in this request. They are not the live customer book.' };
  } catch (err) {
    return { measured: false, cohorts: null, source: 'retention-engine', reason: err.message };
  }
}

function revenue(opts) {
  const cfo = cfoStatus();
  const billable = aiArmed();
  const retention = retentionOf(opts && opts.customers);
  return {
    organ: 'revenue',
    ok: true,
    conversion: { measured: false, source: 'unwired_in_this_read', value: null },
    acquisitionCost: { measured: false, usd: null },
    aiCost: { measured: false, usd: null, billableKey: billable },
    retention,
    margin: {
      measured: false,
      profit: null,
      source: cfo.source,
      reason: 'Paid revenue can be read from the CFO snapshot. Cost is not measured, so margin is not claimed.',
    },
    ledger: cfo,
    stop: {
      recommended: false,
      applied: false,
      requiresHuman: true,
      reason: 'Acquisition cost and margin are unmeasured. No experiment is stopped or scaled.',
    },
    simulated: false,
    evidence: [
      { source: cfo.source, measured: cfo.dataMode === 'live', value: cfo.dataMode },
      { source: 'public-ai-spend-gate', measured: true, value: billable },
      { source: 'retention-engine', measured: retention.measured, value: retention.reason },
    ],
  };
}

function actionKind(text) {
  const q = String(text || '').toLowerCase();
  if (/pay|refund|bitcoin|checkout|charge|plat|rambur/.test(q)) return 'financial';
  if (/deploy|production|migrate|restart|redeploy|promov/.test(q)) return 'production';
  if (/heal|recover|vindec|outage|error/.test(q)) return 'recover';
  return 'read';
}

function govern(text) {
  const kind = actionKind(text);
  const gated = kind === 'financial' || kind === 'production' || kind === 'recover';
  return {
    organ: 'governance',
    ok: true,
    kind,
    applied: false,
    requiresHuman: gated,
    isolated: CANARY,
    healer: 'self-healing-engine',
    proposal: gated
      ? 'Detect, propose, and wait. A financial action, a production change, or a service restart is not performed here.'
      : 'Read only. No service was changed.',
    evidence: [{ source: 'native-capability-desk.govern', measured: true, value: kind }],
  };
}

function scoreOf(organ) {
  const evidence = Array.isArray(organ && organ.evidence) ? organ.evidence : [];
  const measured = evidence.filter((row) => row && row.measured).length;
  return { organ: organ && organ.organ, measured, claims: evidence.length };
}

function contest(organs) {
  const rows = organs.filter(Boolean);
  const factory = rows.find((row) => row.organ === 'factory');
  const verifier = factory && factory.verdict;
  if (factory && verifier && verifier.pass === false) {
    return { winner: 'verifier', reason: verifier.reason, scores: rows.map(scoreOf) };
  }
  const ranked = rows.map(scoreOf).sort((a, b) => b.measured - a.measured);
  const winner = ranked[0] ? ranked[0].organ : 'none';
  return {
    winner,
    reason: 'The organ with measured evidence wins. An unmeasured cost does not outrank the shelf.',
    scores: ranked,
  };
}

function wants(text) {
  const q = String(text || '').toLowerCase();
  return {
    demand: /demand|compet|market|cerere|concur|ipotez|product|produs|offer|ofert/.test(q) || q.length > 0,
    factory: /build|factory|launch|produs|product|pack|lanse/.test(q),
    revenue: /revenue|margin|conversion|retention|cost|venit|marj|profit/.test(q),
    govern: /heal|recover|deploy|pay|refund|production|vindec|restart|plat/.test(q),
  };
}

function assign(input) {
  const body = input && typeof input === 'object' ? input : { text: input };
  const text = String(body.text || body.task || '');
  const flags = wants(text);
  if (!flags.factory && !flags.revenue && !flags.govern) flags.demand = true;
  const organs = [];
  let demandRow = null;
  if (flags.demand || flags.factory) demandRow = demand(text);
  if (demandRow) organs.push(demandRow);
  let pack = null;
  const serviceId = body.serviceId || (demandRow && demandRow.offer && demandRow.offer.id);
  if (flags.factory && serviceId) {
    pack = productPack(serviceId);
    organs.push(pack);
  }
  if (flags.revenue) organs.push(revenue({ customers: body.customers }));
  const gate = govern(text);
  organs.push(gate);
  const judged = contest(organs);
  const decision = {
    protocol: PROTOCOL,
    ok: true,
    text,
    winner: judged.winner,
    reason: judged.reason,
    scores: judged.scores,
    permission: gate.requiresHuman ? 'human_required' : 'read',
    applied: false,
    spent: false,
    filesWritten: [],
    externalModel: false,
    orchestrator: 'integrated-autonomy-kernel',
    organs: organs.map((row) => row.organ),
  };
  remember({ at: new Date().toISOString(), winner: decision.winner, permission: decision.permission });
  return Object.assign(decision, { demand: demandRow, pack, governance: gate, revenue: organs.find((row) => row.organ === 'revenue') || null });
}

function status() {
  return {
    ok: true,
    protocol: PROTOCOL,
    orchestrator: 'integrated-autonomy-kernel',
    organs: ['demand', 'factory', 'verifier', 'revenue', 'governance'],
    externalModel: false,
    applied: false,
    recent: log.slice(-10),
    isolated: CANARY,
  };
}

function resetForTests() {
  log.length = 0;
}

module.exports = {
  PROTOCOL,
  demand,
  productPack,
  verifyPack,
  revenue,
  govern,
  assign,
  status,
  resetForTests,
};
