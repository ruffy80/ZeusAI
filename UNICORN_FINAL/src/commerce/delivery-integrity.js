'use strict';

/**
 * DELIVERY INTEGRITY — DIP/1.0
 *
 * A shelf row is publishable only when the buyer-facing promise is inside
 * the file payment writes. The check runs before checkout. The writer keeps
 * every promised heading after payment.
 *
 * Cost is the deterministic file: no supplier spend and no model call.
 * That marginal cost is 0. A displayed price covers it when a buyable row
 * is priced above 0. This module does not invent a higher price. A promise
 * the file does not contain is not publishable until the promise is reduced
 * or the file implements it.
 */

const PROTOCOL = 'DIP/1.0';
const MARGINAL_USD = 0;

const EXCLUSION = /\b(does not|do not|did not|is not|are not|was not|not a|not an|not the|not in|not thirty|without)\b|\b(nu este|nu sunt|nu livreaz[aă]|nu vinde|nu instaleaz[aă]|nu expediaz[aă]|nu deschide)\b/i;

const UNDELIVERABLE = [
  /finished system (arrives|is delivered|is human)/i,
  /human-built system/i,
  /human milestone delivery/i,
  /engineers then build/i,
  /delivered by the team/i,
  /store-ready builds/i,
  /production storefront/i,
  /financial model/i,
  /team delivers the build/i,
  /team executes the actual/i,
  /underlying product is delivered/i,
  /sistemul finit ajunge/i,
  /echipa livreaz/i,
  /the finished system is delivered/i,
  /team builds across/i,
  /team delivery about/i,
  /human delivery on the stated/i,
];

const EXECUTION_OVERCLAIM = /\babout \d+ days\b|\bîn cam \d+ zile\b|\bteam delivery\b|\bhuman delivery\b/i;

// Named in a positive sentence, these are not in the paid file.
const NOT_DELIVERED = [
  /designed slide deck/i,
  /hosted site/i,
  /\bword file\b/i,
  /thirty finished posts/i,
  /running saas/i,
  /store-ready builds/i,
  /production storefront/i,
  /financial model/i,
  /orbital compute/i,
  /neural implant/i,
  /quantum channel/i,
  /dispatch a parcel/i,
];

// Longer needles first. A hit in a positive sentence must appear in a
// positive sentence of the file (an exclusion sentence does not deliver it).
const ANCHORS = [
  ['problem, solution, market, product, and ask', null],
  ['draft statement of work', 'draft statement of work'],
  ['commercial proposal', 'commercial proposal'],
  ['discovery brief', 'discovery brief'],
  ['credited toward a signed engagement', 'credited toward a signed engagement'],
  ['statement of work', 'statement of work'],
  ['technical appendix', 'technical appendix'],
  ['security pack', 'security pack'],
  ['payment schedule', 'payment schedule'],
  ['internal-link', 'internal link'],
  ['meta description', 'meta description'],
  ['name candidates', 'name candidates'],
  ['color and type', 'color and type'],
  ['seven text posts', 'seven text posts'],
  ['five emails', 'five emails'],
  ['eight name', 'eight name'],
  ['linkedin headline', 'linkedin headline'],
  ['about section', 'about section'],
  ['sample lines', 'sample lines'],
  ['call to action', 'call to action'],
  ['send timing', 'send timing'],
  ['architecture sketch', 'architecture sketch'],
  ['service activation pack', 'service activation pack'],
  ['project kickoff', 'project kickoff'],
  ['architecture pack', 'architecture pack'],
  ['pachetul de arhitectură', 'architecture pack'],
  ['pachetul de unealtă', 'tool pack'],
  ['listing sheet', 'listing sheet'],
  ['phase plan', 'phase plan'],
  ['live route', 'live route'],
  ['ruta live', 'live route'],
  ['tool pack', 'tool pack'],
  ['kpi focus', 'kpi focus'],
  ['30-day', '30-day'],
  ['self-contained', 'self-contained'],
  ['hashtags', 'hashtags'],
  ['scorecard', 'scorecard'],
  ['keywords', 'keywords'],
  ['positioning', 'positioning'],
  ['taglines', 'taglines'],
  ['milestones', 'milestones'],
  ['outcomes', 'outcomes'],
  ['workflow', 'workflow'],
  ['handoff', 'handoff'],
  ['audience', 'audience'],
  ['benefits', 'benefits'],
  ['timeline', 'timeline'],
  ['hero', 'hero'],
  ['tone', 'tone'],
  ['scope', 'scope'],
  ['seo', 'seo'],
  ['performance', 'performance'],
  ['accessibility', 'accessibility'],
  ['msa', 'msa'],
];

const PITCH_PARTS = ['problem', 'solution', 'market', 'product', 'ask'];

function shelfApi() {
  return require('./public-shelf');
}

function engineApi() {
  return require('../site/v2/fulfillment-engine');
}

function sentences(text) {
  return String(text || '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isExclusion(sentence) {
  return EXCLUSION.test(sentence);
}

function positiveBlob(text) {
  return sentences(text).filter((sentence) => !isExclusion(sentence)).join('\n').toLowerCase();
}

function promiseText(item, preview) {
  let en = '';
  let ro = '';
  try {
    const shelf = shelfApi();
    en = shelf.strategy(item, 'en');
    ro = shelf.strategy(item, 'ro');
  } catch (_) { /* the description still counts */ }
  return [
    item && item.title,
    item && item.description,
    item && item.when,
    en,
    ro,
    preview && preview.note,
  ].filter(Boolean).join('\n');
}

function priceCovers(item) {
  const displayedUsd = Number(item && (item.priceUsd != null ? item.priceUsd : item.priceUSD)) || 0;
  const buyable = !!(item && item.buyable === true);
  const coversDelivery = displayedUsd >= MARGINAL_USD && (!buyable || displayedUsd > MARGINAL_USD);
  return {
    basis: 'deterministic-file',
    marginalUsd: MARGINAL_USD,
    displayedUsd,
    coversDelivery,
    remedy: coversDelivery ? null : 'raise_price',
  };
}

function executionOf(item) {
  const clock = item && item.clock ? String(item.clock) : 'minutes';
  const minutes = Number(item && item.deliveryMinutes);
  const days = Number(item && item.deliveryDays);
  if (clock === 'minutes') {
    return {
      clock,
      minutes: minutes > 0 ? minutes : null,
      fileAt: 'payment_settlement',
      feasible: minutes > 0 && minutes <= 60,
    };
  }
  if (clock === 'days') {
    return {
      clock,
      days: days > 0 ? days : null,
      fileAt: 'payment_settlement',
      feasible: false,
    };
  }
  return { clock: 'contract', fileAt: 'payment_settlement', feasible: true };
}

function resourcesFor(item) {
  const id = String(item && item.id || '');
  const resources = ['deterministic-writer'];
  if (/^ent-/i.test(id) && id !== 'ent-engagement-kickoff') resources.push('engagement-documents');
  try {
    if (require('./money-catalog').byId(id)) resources.push('money-catalog');
  } catch (_) { /* shelf file still counts */ }
  return resources;
}

function missingAnchors(promise, fileText) {
  const wanted = positiveBlob(promise);
  const have = positiveBlob(fileText);
  const missing = [];
  for (const pair of ANCHORS) {
    const needle = pair[0].toLowerCase();
    if (wanted.indexOf(needle) === -1) continue;
    if (pair[0] === 'problem, solution, market, product, and ask') {
      for (const part of PITCH_PARTS) {
        if (have.indexOf(part) === -1) missing.push(part);
      }
      continue;
    }
    const fileNeedle = String(pair[1] || needle).toLowerCase();
    if (have.indexOf(fileNeedle) === -1) missing.push(pair[0]);
  }
  return missing.filter((phrase, index) => missing.indexOf(phrase) === index);
}

function titleCovered(item, fileText) {
  const title = String(item && item.title || '').trim();
  if (title.length < 8) return true;
  const wanted = positiveBlob(promiseText(item, null));
  if (wanted.indexOf(title.toLowerCase()) === -1) return true;
  return positiveBlob(fileText).indexOf(title.toLowerCase()) !== -1;
}

function keepSections(content, sections, floor) {
  const body = String(content || '');
  const list = Array.isArray(sections) ? sections : [];
  const missing = list.filter((section) => body.toLowerCase().indexOf(String(section).toLowerCase()) === -1);
  if (!missing.length) return body;
  return body + '\n\n' + String(floor || '');
}

function review(item, preview) {
  const failures = [];
  const cost = priceCovers(item);
  const execution = executionOf(item);
  const resources = resourcesFor(item);
  if (!cost.coversDelivery) failures.push('price_does_not_cover_delivery');
  if (!execution.feasible) failures.push('execution_window_missing');
  let fileText = '';
  try {
    fileText = engineApi().buyerFile(item);
  } catch (_) {
    fileText = '';
  }
  if (!fileText || String(fileText).trim().length < 40) failures.push('file_missing');
  const promise = promiseText(item, preview);
  const positive = sentences(promise).filter((sentence) => !isExclusion(sentence)).join('\n');
  if (UNDELIVERABLE.some((pattern) => pattern.test(positive))) failures.push('undeliverable_promise');
  if (NOT_DELIVERED.some((pattern) => pattern.test(positive))) failures.push('undeliverable_promise');
  if (EXECUTION_OVERCLAIM.test(positive)) failures.push('execution_overclaim');
  const sections = preview && Array.isArray(preview.sections) ? preview.sections : [];
  const lower = String(fileText).toLowerCase();
  for (const section of sections) {
    if (lower.indexOf(String(section).toLowerCase()) === -1) {
      failures.push('section_missing:' + String(section).slice(0, 60));
      break;
    }
  }
  const anchors = fileText ? missingAnchors(promise, fileText) : [];
  if (anchors.length) failures.push('promise_missing:' + String(anchors[0]).slice(0, 60));
  if (fileText && !titleCovered(item, fileText)) failures.push('promise_missing:title');
  if (fileText && String(fileText).trim().length >= 40) {
    try {
      const finished = require('./finished-delivery').review(item, fileText);
      const extra = finished && Array.isArray(finished.failures) ? finished.failures : [];
      for (const failure of extra) {
        if (failures.indexOf(failure) === -1) failures.push(failure);
      }
    } catch (_) {
      failures.push('solution_missing');
    }
  }
  return {
    protocol: PROTOCOL,
    id: item && item.id || null,
    publishable: failures.length === 0,
    failures,
    feasible: execution.feasible && failures.indexOf('file_missing') === -1,
    cost,
    execution,
    resources,
    deliverableComplete: failures.length === 0,
    marginalUsd: MARGINAL_USD,
    inventsPrice: false,
  };
}

function audit(rows, previewOf) {
  const list = Array.isArray(rows) ? rows : [];
  const offers = list.map((item) => {
    let preview = null;
    try { preview = previewOf ? previewOf(item) : null; } catch (_) { preview = null; }
    return review(item, preview);
  });
  const failing = offers.filter((row) => !row.publishable);
  return {
    ok: failing.length === 0,
    protocol: PROTOCOL,
    marginalUsd: MARGINAL_USD,
    inventsPrice: false,
    offers: offers.length,
    publishable: offers.length - failing.length,
    failing,
  };
}

module.exports = {
  PROTOCOL,
  MARGINAL_USD,
  priceCovers,
  executionOf,
  keepSections,
  review,
  audit,
};
