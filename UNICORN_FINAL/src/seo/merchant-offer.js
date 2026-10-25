'use strict';

/**
 * Merchant listing fields for a digital file ZeusAI actually sells.
 *
 * Search Console's merchant-listing report treats a priced Product as invalid
 * until the offer names a shipping rate and a return policy. Product snippets
 * do not. The public contract is a file delivered online, not a parcel:
 * shipping charge 0 USD, no warehouse, no street address. The refund at
 * /refund stays open only until the file is issued. Once the buyer has the
 * file, license, or work, the refund is closed. An unissued order can be
 * reported within 30 days and is settled by the owner. Bitcoin is not pulled
 * back on-chain. The buyer keeps an issued file, so the return method is
 * KeepProduct. There is no mail, store, or kiosk return, and no free
 * buyer's-remorse return.
 *
 * Google has no worldwide country code and caps applicableCountry at 50.
 * DELIVERY_COUNTRIES is the explicit list of places the file can be delivered
 * electronically. Checkout is not limited to this list.
 */

const RETURN_DAYS = 30;
const RETURN_PATH = '/refund';

const DELIVERY_COUNTRIES = Object.freeze([
  'US', 'CA', 'MX', 'BR', 'GB', 'IE', 'FR', 'DE', 'NL', 'BE',
  'AT', 'CH', 'IT', 'ES', 'PT', 'SE', 'NO', 'DK', 'FI', 'PL',
  'CZ', 'RO', 'HU', 'GR', 'AU', 'NZ', 'JP', 'SG', 'AE', 'KR',
]);

function originOf(origin) {
  return String(origin || 'https://zeusai.pro').replace(/\/+$/, '');
}

function priceAmount(item) {
  const raw = item && (item.priceUsd != null ? item.priceUsd : (item.priceUSD != null ? item.priceUSD : item.price));
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function priceContent(item) {
  return priceAmount(item).toFixed(2);
}

function isMerchantOffer(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.notForSale === true || item.demoOnly === true) return false;
  const mode = String(item.mode || '');
  if (mode === 'contact' || mode === 'unavailable') return false;
  if (item.buyable !== true) return false;
  return priceAmount(item) > 0;
}

function handlingWindow(item) {
  const days = Number(item && item.deliveryDays);
  if (Number.isFinite(days) && days > 0) {
    return { min: 0, max: Math.min(60, Math.max(1, Math.round(days))) };
  }
  return { min: 0, max: 1 };
}

function _dayValue(n) {
  return {
    '@type': 'QuantitativeValue',
    minValue: n.min,
    maxValue: n.max,
    unitCode: 'DAY',
  };
}

function shippingDetails(item) {
  const window = handlingWindow(item);
  // One policy. The rate and the window are the same for every country,
  // so the destination is a list rather than a copied block per card.
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: DELIVERY_COUNTRIES.slice(),
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: _dayValue({ min: window.min, max: window.max }),
      transitTime: _dayValue({ min: 0, max: 0 }),
    },
  };
}

function returnPolicy(origin) {
  const base = originOf(origin);
  return {
    '@type': 'MerchantReturnPolicy',
    '@id': base + RETURN_PATH + '#merchant-return',
    applicableCountry: DELIVERY_COUNTRIES.slice(),
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: RETURN_DAYS,
    returnMethod: 'https://schema.org/KeepProduct',
    returnFees: 'https://schema.org/FreeReturn',
    refundType: 'https://schema.org/FullRefund',
    merchantReturnLink: base + RETURN_PATH,
    url: base + RETURN_PATH,
  };
}

function organizationId(origin) {
  return originOf(origin) + '/#organization';
}

function policyDocument(origin) {
  return Object.assign({ '@context': 'https://schema.org' }, returnPolicy(origin));
}

function offerFields(item, origin) {
  return {
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': organizationId(origin) },
    shippingDetails: shippingDetails(item),
    hasMerchantReturnPolicy: returnPolicy(origin),
  };
}

function productJson(opts) {
  const o = opts || {};
  const item = o.item || {};
  const base = originOf(o.origin);
  const url = o.url || (base + '/services/' + encodeURIComponent(String(item.id || '')));
  const name = item.title || item.name || item.id || 'ZeusAI service';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': url + '#product',
    name,
    description: String(o.description || item.description || '').slice(0, 400),
    sku: String(item.id || ''),
    image: o.image,
    url,
    brand: { '@type': 'Brand', name: 'ZeusAI' },
    offers: Object.assign({
      '@type': 'Offer',
      '@id': url + '#offer',
      url,
      priceCurrency: 'USD',
      price: priceContent(item),
      availability: 'https://schema.org/InStock',
    }, offerFields(item, base)),
  };
}

function _countriesMeta(prop) {
  return DELIVERY_COUNTRIES.map((code) => '<meta itemprop="' + prop + '" content="' + code + '">').join('');
}

function offerMicrodataHtml(item, opts) {
  if (!isMerchantOffer(item)) return '';
  const window = handlingWindow(item);
  const refundUrl = originOf(opts && opts.origin) + RETURN_PATH;
  return '<meta itemprop="priceCurrency" content="USD">'
    + '<meta itemprop="price" content="' + priceContent(item) + '">'
    + '<link itemprop="availability" href="https://schema.org/InStock">'
    + '<link itemprop="itemCondition" href="https://schema.org/NewCondition">'
    + '<div itemprop="shippingDetails" itemscope itemtype="https://schema.org/OfferShippingDetails">'
    + '<div itemprop="shippingRate" itemscope itemtype="https://schema.org/MonetaryAmount">'
    + '<meta itemprop="value" content="0"><meta itemprop="currency" content="USD"></div>'
    + '<div itemprop="shippingDestination" itemscope itemtype="https://schema.org/DefinedRegion">'
    + _countriesMeta('addressCountry')
    + '</div>'
    + '<div itemprop="deliveryTime" itemscope itemtype="https://schema.org/ShippingDeliveryTime">'
    + '<div itemprop="handlingTime" itemscope itemtype="https://schema.org/QuantitativeValue">'
    + '<meta itemprop="minValue" content="' + window.min + '"><meta itemprop="maxValue" content="' + window.max + '"><meta itemprop="unitCode" content="DAY"></div>'
    + '<div itemprop="transitTime" itemscope itemtype="https://schema.org/QuantitativeValue">'
    + '<meta itemprop="minValue" content="0"><meta itemprop="maxValue" content="0"><meta itemprop="unitCode" content="DAY"></div>'
    + '</div></div>'
    + '<div itemprop="hasMerchantReturnPolicy" itemscope itemtype="https://schema.org/MerchantReturnPolicy">'
    + _countriesMeta('applicableCountry')
    + '<meta itemprop="merchantReturnDays" content="' + RETURN_DAYS + '">'
    + '<link itemprop="returnPolicyCategory" href="https://schema.org/MerchantReturnFiniteReturnWindow">'
    + '<link itemprop="returnMethod" href="https://schema.org/KeepProduct">'
    + '<link itemprop="returnFees" href="https://schema.org/FreeReturn">'
    + '<link itemprop="refundType" href="https://schema.org/FullRefund">'
    + '<link itemprop="merchantReturnLink" href="' + refundUrl + '">'
    + '<link itemprop="url" href="' + refundUrl + '">'
    + '</div>'
    + '<div itemprop="seller" itemid="' + originOf(opts && opts.origin) + '/#organization" itemscope itemtype="https://schema.org/Organization">'
    + '<meta itemprop="name" content="ZeusAI"><link itemprop="url" href="' + originOf(opts && opts.origin) + '/"></div>';
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function contractReport(origin) {
  const policy = returnPolicy(origin);
  return {
    ok: true,
    inventsRatings: false,
    inventsReviews: false,
    inventsAddresses: false,
    inventsTraffic: false,
    remorseRefund: false,
    closesWhenIssued: true,
    policyId: policy['@id'],
    sellerId: organizationId(origin),
    countries: DELIVERY_COUNTRIES.length,
    windowDays: RETURN_DAYS,
    returnMethod: policy.returnMethod,
    shippingRateUsd: 0,
    transitDays: 0,
    refused: [
      { field: 'gtin', because: 'These files have a sku. They do not have a GTIN.' },
      { field: 'aggregateRating', because: 'A rating is published only after a verified review exists.' },
      { field: 'review', because: 'No review is written here.' },
      { field: 'streetAddress', because: 'The file is delivered online. There is no warehouse address.' },
      { field: 'ReturnByMail', because: 'The buyer keeps the file. The return method is KeepProduct.' },
      { field: 'customerRemorseReturnFees', because: 'Using the file and then asking for the money back is refused. The refund closes when the file is issued.' },
      { field: 'itemDefectReturnFees', because: 'An issued file is not a free defect return. Only an order whose file was never issued can be settled.' },
      { field: 'priceValidUntil', because: 'The shelf price can change. No expiry date is claimed.' },
      { field: 'searchConsoleShippingSettings', because: 'The Search Console shipping and returns screen is an owner setting. The site cannot write it. These pages are the policy Google can read.' },
    ],
  };
}

function policyFactsHtml(origin) {
  const base = originOf(origin);
  return '<dl id="merchantReturnFacts" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:16px 0">'
    + '<div class="card" style="padding:14px"><dt class="kicker">Window</dt><dd style="margin:6px 0 0">' + RETURN_DAYS + ' days</dd></div>'
    + '<div class="card" style="padding:14px"><dt class="kicker">Closes</dt><dd style="margin:6px 0 0">When the file is issued</dd></div>'
    + '<div class="card" style="padding:14px"><dt class="kicker">Method</dt><dd style="margin:6px 0 0">You keep the file</dd></div>'
    + '<div class="card" style="padding:14px"><dt class="kicker">Refund</dt><dd style="margin:6px 0 0">Closed once the file is issued</dd></div>'
    + '<div class="card" style="padding:14px"><dt class="kicker">Policy</dt><dd style="margin:6px 0 0;overflow-wrap:anywhere"><a href="' + _esc(base + RETURN_PATH) + '" data-link>' + _esc(base + RETURN_PATH) + '</a></dd></div>'
    + '</dl>';
}

function contractHtml(origin) {
  const body = contractReport(origin);
  const refused = body.refused.map((row) => (
    '<li style="margin:0 0 8px"><strong>' + _esc(row.field) + '</strong> ' + _esc(row.because) + '</li>'
  )).join('');
  return '<section id="merchantContract" style="margin:8px 0 28px">'
    + '<span class="kicker">Merchant contract</span>'
    + '<h2 style="margin:8px 0 10px">What Google can read</h2>'
    + '<p style="color:var(--ink-dim);font-size:14px;max-width:46rem">Every buyable offer, the organization, and <a href="/refund" data-link>/refund</a> use one return policy. '
    + _esc(String(body.windowDays)) + ' days to report an order whose file was never issued. The refund is closed once the file is issued. Method KeepProduct, shipping 0 USD, transit '
    + _esc(String(body.transitDays)) + ' days, ' + _esc(String(body.countries)) + ' delivery countries. '
    + 'A rating, a review, a GTIN, and a street address stay unpublished.</p>'
    + '<ul style="margin:8px 0 0;padding-left:18px;color:var(--ink-dim);font-size:14px;line-height:1.55">' + refused + '</ul>'
    + '</section>';
}

module.exports = {
  DELIVERY_COUNTRIES,
  RETURN_DAYS,
  priceAmount,
  priceContent,
  isMerchantOffer,
  handlingWindow,
  shippingDetails,
  returnPolicy,
  organizationId,
  policyDocument,
  contractReport,
  policyFactsHtml,
  contractHtml,
  offerFields,
  productJson,
  offerMicrodataHtml,
};
