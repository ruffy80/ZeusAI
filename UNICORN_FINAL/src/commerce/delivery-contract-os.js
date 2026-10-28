'use strict';

/**
 * Delivery Contract OS — DCO/1.0
 *
 * One sheet for the files the census found and one contract for each
 * public shelf offer. A status is PASS only when every required stage
 * passed in this process. A drill payment is not a collected sale.
 * This module does not write an order, a license, or a price.
 */

const PROTOCOL = 'DCO/1.0';
const VERSION = 1;
const STATUSES = Object.freeze([
  'PASS',
  'FAIL',
  'BLOCKED',
  'NOT_IMPLEMENTED',
  'CONTRACT_UNDEFINED',
  'NOT_TESTED',
]);

function stage(id, status, evidence) {
  return {
    id,
    status: STATUSES.includes(status) ? status : 'NOT_TESTED',
    evidence: String(evidence || '').slice(0, 400),
  };
}

function rollup(stages) {
  const values = (stages || []).map((row) => row.status);
  if (values.includes('FAIL')) return 'FAIL';
  if (values.includes('NOT_IMPLEMENTED')) return 'NOT_IMPLEMENTED';
  if (values.includes('CONTRACT_UNDEFINED')) return 'CONTRACT_UNDEFINED';
  if (values.includes('BLOCKED')) return 'BLOCKED';
  if (values.includes('NOT_TESTED')) return 'NOT_TESTED';
  if (values.length && values.every((value) => value === 'PASS')) return 'PASS';
  return 'NOT_TESTED';
}

function envPresent(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0;
}

function credentials() {
  let providers = { configured: 0, configuredNames: [], total: 0 };
  let armed = false;
  try {
    const ai = require('../../backend/modules/fulfillment-ai-os');
    providers = ai.configuredProviderSnapshot();
    armed = ai.isArmed();
  } catch (_) { /* names stay empty */ }
  return {
    modelArmed: armed === true,
    modelProvidersConfigured: Number(providers.configured) || 0,
    modelProviderNames: Array.isArray(providers.configuredNames) ? providers.configuredNames : [],
    modelProvidersTotal: Number(providers.total) || 0,
    namesChecked: [
      { name: 'STRIPE_WEBHOOK_SECRET', present: envPresent('STRIPE_WEBHOOK_SECRET'), effect: 'Stripe webhook signature. Production refuses an unsigned payload.' },
      { name: 'PAYPAL_WEBHOOK_ID', present: envPresent('PAYPAL_WEBHOOK_ID'), effect: 'PayPal webhook verification. Production refuses a missing id.' },
      { name: 'SMTP', present: envPresent('SMTP_HOST') || envPresent('SMTP_URL'), effect: 'Buyer email. Without it, delivery mail stays in the local outbox.' },
    ],
  };
}

function contractFor(item, proof) {
  const description = item && item.description ? String(item.description).trim() : '';
  const defined = description.length >= 40;
  const fileOk = !!(proof && proof.pass);
  const wantsModel = /provider key|model/i.test(description);
  const creds = credentials();
  const stages = [
    stage(
      'contract',
      defined ? 'PASS' : 'CONTRACT_UNDEFINED',
      defined ? 'The shelf description states the file the buyer receives.' : 'The shelf description is missing or too short to be a contract.'
    ),
    stage(
      'promise_matches_file',
      fileOk ? 'PASS' : 'FAIL',
      fileOk
        ? 'Service integrity and delivery integrity agreed: ' + (proof.fileTitle || 'file') + ' (' + (proof.kind || 'unknown') + ').'
        : 'Integrity failures: ' + ((proof && proof.failures) || ['missing_proof']).join(', ')
    ),
    stage(
      'chain_payment',
      'NOT_TESTED',
      'No chain confirmation was executed here. A txid that starts with simulated- is a drill and is excluded from collected revenue.'
    ),
    stage(
      'buyer_isolation',
      'NOT_TESTED',
      'This process did not log a buyer out and back in, and it did not try a second buyer against the same file.'
    ),
  ];
  if (wantsModel) {
    stages.push(stage(
      'model_output',
      creds.modelArmed ? 'NOT_TESTED' : 'BLOCKED',
      creds.modelArmed
        ? 'A provider name is configured. This run did not grade a model reply against the contract.'
        : 'The contract fills a model section only when a provider key is armed. No provider is armed in this process. The deterministic file remains the entitled artifact.'
    ));
  }
  const status = rollup(stages);
  return {
    id: item.id,
    title: item.title || item.id,
    buyable: item.buyable === true,
    mode: item.mode || null,
    promise: description,
    entitledFile: proof && proof.fileTitle ? proof.fileTitle : null,
    fileKind: proof && proof.kind ? proof.kind : null,
    price: null,
    priceNote: 'Read GET /api/price/' + item.id + '. This contract does not copy a dollar amount.',
    stages,
    status,
    productionReady: status === 'PASS',
  };
}

function report() {
  const census = require('../../backend/modules/module-census-os').summary();
  const integrity = require('./service-integrity').audit();
  const shelf = require('./public-shelf').publicShelf();
  const byId = new Map(shelf.map((item) => [item.id, item]));
  const offers = (integrity.rows || []).map((proof) => {
    const item = byId.get(proof.id) || { id: proof.id, description: '', buyable: proof.buyable, mode: proof.mode };
    return contractFor(item, proof);
  });
  const counts = {};
  for (const name of STATUSES) counts[name] = 0;
  for (const offer of offers) counts[offer.status] += 1;
  const creds = credentials();
  return {
    ok: true,
    protocol: PROTOCOL,
    version: VERSION,
    inventsDelivery: false,
    inventsMetrics: false,
    generatedAt: new Date().toISOString(),
    inventory: {
      location: 'backend/modules/module-census-os.js',
      contractLocation: 'src/commerce/delivery-contract-os.js',
      files: census.files,
      aliases: census.aliases,
      virtualWorkers: census.virtualWorkers,
      absent: census.absent,
      refused: census.refused,
      placeholders: census.placeholders,
      customerDutyFiles: census.customerDutyFiles,
      unicornFiles: census.unicornFiles,
      organStatus: 'NOT_TESTED',
      organEvidence: 'The census lists every backend module file. A file name is not a customer delivery, so those files are not marked PASS.',
    },
    offers: offers.length,
    counts,
    productionReady: offers.filter((offer) => offer.productionReady).map((offer) => offer.id),
    doNotAdvertiseAsFullyOperational: offers.filter((offer) => offer.buyable && !offer.productionReady).map((offer) => offer.id),
    credentials: creds,
    rows: offers,
  };
}

function esc(value) {
  return String(value == null ? '—' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function page() {
  let data = null;
  try { data = report(); } catch (err) {
    return '<section class="hero"><h1>Delivery contracts</h1><p class="lead">' + esc(err && err.message) + '</p></section>';
  }
  const rows = data.rows.map((offer) => '<tr><td><code>' + esc(offer.id) + '</code></td><td>' + esc(offer.status) + '</td><td>' + esc(offer.buyable ? 'buyable' : 'not buyable') + '</td><td>' + esc(offer.entitledFile) + '</td></tr>').join('');
  return `<section class="hero" style="min-height:auto;padding:48px 0 12px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Delivery contracts · ${esc(data.protocol)}</span>
    <h1>Every shelf promise has a status. <span class="grad">PASS means every required stage passed.</span></h1>
    <p class="lead">${esc(data.inventory.files)} backend files are inventoried. Their customer-delivery status is NOT_TESTED. ${esc(data.offers)} shelf offers have contracts. ${esc(data.productionReady.length)} are production-ready.</p>
    <p><a class="btn" href="/api/delivery-contracts" data-allow-raw="1">JSON</a> <a class="btn" href="/module-census" data-link>Module census</a></p>
  </div>
</section>
<section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px">
  ${STATUSES.map((name) => '<div class="card" style="padding:14px"><div style="font-size:12px;color:var(--ink-dim)">' + esc(name) + '</div><div style="font-size:28px;font-weight:800">' + esc(data.counts[name]) + '</div></div>').join('')}
</section>
<p style="color:var(--ink-dim);font-size:14px;line-height:1.6">Model providers armed: ${data.credentials.modelArmed ? 'yes' : 'no'} (${esc(data.credentials.modelProvidersConfigured)} of ${esc(data.credentials.modelProvidersTotal)} names). Chain payment and buyer isolation are NOT_TESTED. A simulated payment is not a sale.</p>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left">Offer</th><th style="text-align:left">Status</th><th style="text-align:left">Shelf</th><th style="text-align:left">File</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

module.exports = {
  PROTOCOL,
  VERSION,
  STATUSES,
  rollup,
  stage,
  report,
  page,
};
