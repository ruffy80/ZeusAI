'use strict';

/**
 * SERVICE INTEGRITY — SIO/1.0
 *
 * The public shelf is the only customer advertisement. Every row must agree
 * with its checkout button and its fulfillment file. A backend module file
 * is an internal organ: its name is not a customer delivery.
 *
 * Checkout calls proofFor and refuses a shelf id that fails. Nothing here
 * writes an order, a file, or a customer.
 */

const PROTOCOL = 'SIO/1.0';

function shelfApi() {
  return require('./public-shelf');
}

function previewOf(item) {
  const engine = require('../site/v2/fulfillment-engine');
  return engine.offerPreview(item.id, {
    mode: item.mode,
    clock: item.clock,
    tier: item.tier,
  });
}

function evaluate(item, preview) {
  const failures = [];
  if (!item || !item.id) failures.push('no_shelf_offer');
  const mode = item && item.mode;
  const href = item && item.ctaHref ? String(item.ctaHref) : '';
  const file = preview || null;
  if (mode === 'contact' && href.indexOf('/checkout') !== -1) failures.push('contact_mode_opened_a_cart');
  if (mode !== 'contact' && mode !== 'unavailable' && !href) failures.push('missing_checkout_href');
  if (!file || !file.fileTitle) failures.push('missing_delivery_file');
  if (file && (mode === 'contact' || mode === 'unavailable') && file.kind !== 'proposal') {
    failures.push('preview_disagrees');
  } else if (file && mode !== 'contact' && mode !== 'unavailable') {
    const human = mode === 'reserve' || (item && (item.clock === 'days' || item.clock === 'contract'));
    if (human && file.kind !== 'kickoff') failures.push('preview_disagrees');
    if (!human && file.kind !== 'activation' && file.kind !== 'generated') failures.push('preview_disagrees');
  }
  if (item && item.buyable === true) {
    if (!(Number(item.priceUsd) > 0)) failures.push('buyable_without_price');
    if (href.indexOf('/checkout') === -1) failures.push('buyable_without_checkout');
  } else if (href.indexOf('/checkout') !== -1) {
    failures.push('unbuyable_opened_a_cart');
  }
  return {
    onShelf: !!(item && item.id),
    pass: failures.length === 0,
    failures,
    fileTitle: file && file.fileTitle || null,
    kind: file && file.kind || null,
  };
}

function proofFor(serviceId) {
  const shelf = shelfApi();
  const item = serviceId && typeof serviceId === 'object' ? serviceId : shelf.byId(serviceId);
  if (!item) return { onShelf: false, pass: false, failures: ['no_shelf_offer'], fileTitle: null, kind: null };
  return evaluate(item, previewOf(item));
}

function audit() {
  const shelf = shelfApi();
  const rows = shelf.publicShelf();
  const offers = rows.map((item) => {
    const proof = evaluate(item, previewOf(item));
    return {
      id: item.id,
      mode: item.mode,
      clock: item.clock,
      buyable: item.buyable === true,
      pass: proof.pass,
      failures: proof.failures,
      fileTitle: proof.fileTitle,
      kind: proof.kind,
    };
  });
  const failing = offers.filter((row) => !row.pass);
  let kickoffOk = false;
  try {
    const advice = shelf.advise('We are AWS and we want a private cloud and the platform license');
    const primary = advice && advice.primary;
    kickoffOk = !!(primary
      && primary.id === 'ent-engagement-kickoff'
      && String(primary.strategy || '').indexOf('does not deliver the license') !== -1);
  } catch (_) {
    kickoffOk = false;
  }
  if (!kickoffOk) failing.push({ id: 'ent-engagement-kickoff', failures: ['kickoff_overclaims'] });
  return {
    ok: failing.length === 0,
    protocol: PROTOCOL,
    orchestrator: 'integrated-autonomy-kernel',
    inventsDelivery: false,
    modulesAdvertiseCustomerDelivery: false,
    offers: offers.length,
    delivering: offers.length - offers.filter((row) => !row.pass).length,
    failing,
    kickoffOk,
    rows: offers,
  };
}

function status() {
  const report = audit();
  return {
    ok: report.ok,
    protocol: report.protocol,
    orchestrator: report.orchestrator,
    inventsDelivery: false,
    modulesAdvertiseCustomerDelivery: false,
    offers: report.offers,
    delivering: report.delivering,
    failing: report.failing,
    kickoffOk: report.kickoffOk,
  };
}

module.exports = {
  PROTOCOL,
  evaluate,
  proofFor,
  audit,
  status,
};
