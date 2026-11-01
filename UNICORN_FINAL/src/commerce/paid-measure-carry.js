'use strict';

/**
 * Paid Measure Carry — PMC/1.0
 *
 * Free scanners publish a score so the page gets shared. This protocol does
 * the other thing: the number stays in the paid file. The object that can
 * travel is a checkout link that names one public website and contains no
 * score. Opening that link is not a customer. paidHumans moves only after
 * a confirmed payment.
 */

const PROTOCOL = 'PMC/1.0';
const CHECKS = Object.freeze([
  'http_status_200',
  'title_present',
  'meta_description_present',
  'single_h1',
  'canonical_present',
  'html_lang_present',
]);

function publicOrigin() {
  return String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');
}

function listPriceUsd() {
  try {
    const quote = require('../../backend/modules/priceNegotiator').getPriceSync('instant-website-audit', {});
    const usd = Number(quote && quote.listUsd);
    if (usd > 0) return usd;
  } catch (_) { /* catalog floor below */ }
  try {
    const row = require('./instant-catalog').byId('instant-website-audit');
    const usd = Number(row && row.priceUSD);
    if (usd > 0) return usd;
  } catch (_) { /* price stays null */ }
  return null;
}

function paidHumans() {
  try {
    const honesty = require('../../backend/modules/live-honesty-os');
    const n = Number(honesty && honesty.paidHumansCount && honesty.paidHumansCount());
    if (Number.isFinite(n) && n >= 0) return n;
  } catch (_) { /* zero is the honest fallback */ }
  return 0;
}

function doorFor(raw) {
  const norm = require('./audit-scan').normalizePublicUrl(raw);
  if (!norm.ok) return { ok: false, reason: norm.reason, score: null, scoreBeforePayment: false };
  return {
    ok: true,
    url: norm.url,
    href: publicOrigin() + '/checkout/?plan=instant-website-audit&url=' + encodeURIComponent(norm.url),
    score: null,
    scoreBeforePayment: false,
  };
}

function carrySection() {
  return [
    '',
    '## The line that travels',
    'The number in the scorecard stays in this file. The line that travels names the next public website and does not include a score.',
    publicOrigin() + '/checkout/?plan=instant-website-audit&url=',
    'Put their public website after url=. They pay the list price. Their file scores only that URL. This file does not list a company as a customer.',
  ].join('\n');
}

function document() {
  return {
    protocol: PROTOCOL,
    name: 'paid-measure-carry',
    ok: true,
    scoreBeforePayment: false,
    listsCustomers: false,
    inventsVisitors: false,
    inventsUsers: false,
    scoreStaysIn: 'paid-file',
    travelingObject: 'named-checkout',
    checks: CHECKS.slice(),
    listPriceUsd: listPriceUsd(),
    paidHumans: paidHumans(),
    doorTemplate: publicOrigin() + '/checkout/?plan=instant-website-audit&url={publicUrl}',
    spec: '/.well-known/paid-measure.json',
    rule: 'Replace {publicUrl} with one public http or https website. The link does not contain a score. The file scores that URL only after payment. A company is not listed as a customer until that payment is recorded.',
  };
}

module.exports = {
  PROTOCOL,
  CHECKS,
  publicOrigin,
  listPriceUsd,
  paidHumans,
  doorFor,
  carrySection,
  document,
};
