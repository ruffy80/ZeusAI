'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const shell = require('../src/site/v2/shell');
const merchant = require('../src/seo/merchant-offer');
const shelf = require('../src/commerce/public-shelf');
const dropship = require('../src/site/dropship-ssr');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]));
  return out;
}

function productBlocks(html) {
  return jsonLdBlocks(html).filter((block) => block && block['@type'] === 'Product');
}

function prominentUsd(html, id) {
  const m = html.match(/id="svcLivePrice"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(m, id + ' prominent price');
  const text = m[1].replace(/<[^>]+>/g, ' ');
  const num = text.match(/\$([0-9][0-9,]*(?:\.[0-9]+)?)/);
  assert.ok(num, id + ' prominent dollar ' + text);
  return Number(num[1].replace(/,/g, ''));
}

function assertSnippet(product, id, visibleUsd) {
  assert.equal(product['@type'], 'Product', id);
  assert.ok(product.name, id + ' name');
  assert.ok(String(product.image || '').startsWith('https://'), id + ' image');
  assert.equal(product.aggregateRating, undefined, id + ' no invented rating');
  assert.equal(product.review, undefined, id + ' no invented review');
  const offer = product.offers;
  assert.ok(offer && offer['@type'] === 'Offer', id + ' offer');
  assert.equal(offer.priceCurrency, 'USD', id + ' currency');
  assert.equal(offer.availability, 'https://schema.org/InStock', id + ' availability');
  assert.ok(!offer.priceValidUntil, id + ' no past priceValidUntil');
  const price = Number(offer.price);
  assert.ok(price > 0, id + ' price');
  assert.equal(offer.price, price.toFixed(2), id + ' dotted price');
  assert.ok(Math.abs(price - visibleUsd) < 0.001, id + ' schema ' + offer.price + ' vs page ' + visibleUsd);
  const specs = offer.priceSpecification || [];
  assert.ok(specs.length === 1, id + ' one price specification');
  specs.forEach((spec) => {
    assert.equal(spec.priceCurrency, 'USD', id + ' spec currency');
    assert.equal(spec.price, offer.price, id + ' spec matches offer');
  });
  assert.ok(!JSON.stringify(offer).includes('"BTC"'), id + ' offer has no BTC currency');
}

check('a priced file is one USD product snippet and a parcel is not a Product', () => {
  const withBtc = merchant.productJson({
    item: { id: 'instant-website-audit', title: 'Audit', priceUsd: 44.1, priceBtc: 0.00046421, buyable: true, mode: 'checkout' },
    url: 'https://zeusai.pro/services/instant-website-audit',
    image: 'https://zeusai.pro/assets/icons/og-default.png',
    origin: 'https://zeusai.pro',
  });
  assertSnippet(withBtc, 'unit', 44.1);
  const paused = dropship.jsonLdProduct({ id: 'dropship-demo-2', title: 'Margin Lamp', description: 'Bright', priceUsd: 49, image: 'https://example.com/lamp.jpg' });
  assert.ok(paused.includes('"@type":"WebPage"'));
  assert.ok(!paused.includes('"@type":"Product"'));
  assert.ok(!paused.includes('"offers"'));
});

check('every shelf file page matches its visible price and uses only USD', () => {
  const rows = shelf.publicShelf();
  assert.ok(rows.length >= 55, 'shelf count');
  let snippets = 0;
  rows.forEach((item) => {
    const html = shell.getHtml('/services/' + item.id);
    assert.ok(!html.includes('"priceCurrency":"BTC"'), item.id);
    assert.ok(!html.includes('content="BTC"'), item.id);
    assert.ok(!html.includes('aggregateRating'), item.id);
    const products = productBlocks(html);
    if (!merchant.isMerchantOffer(item)) {
      assert.equal(products.length, 0, item.id + ' is not a product snippet');
      return;
    }
    assert.equal(products.length, 1, item.id + ' one product');
    assertSnippet(products[0], item.id, prominentUsd(html, item.id));
    snippets += 1;
  });
  assert.ok(snippets >= 50, 'buyable snippets ' + snippets);
});

check('collection pages keep product cards and do not publish a BTC currency', () => {
  ['/', '/services', '/pricing', '/module-census'].forEach((route) => {
    const html = shell.getHtml(route);
    assert.ok(!html.includes('"priceCurrency":"BTC"'), route);
    assert.ok(!html.includes('content="BTC"'), route);
  });
  const listing = shell.getHtml('/services');
  assert.ok(listing.includes('itemtype="https://schema.org/Product"'));
  const card = listing.match(/<article[^>]*data-product-id="instant-website-audit"[\s\S]*?<\/article>/);
  assert.ok(card, 'audit card');
  const meta = card[0].match(/itemprop="price" content="([0-9]+\.[0-9]{2})"/);
  const shown = card[0].match(/data-pricing-value="instant-website-audit">\$([0-9,]+\.?[0-9]*)/);
  assert.ok(meta && shown, 'card price pair');
  assert.equal(Number(meta[1]), Number(shown[1].replace(/,/g, '')));
  const list = jsonLdBlocks(listing).find((block) => block && block['@type'] === 'ItemList');
  const row = (list.itemListElement || []).find((entry) => entry && entry.item && String(entry.item.url || '').endsWith('/instant-website-audit'));
  assert.ok(row, 'list row');
  assert.equal(row.item.offers.priceCurrency, 'USD');
  assert.equal(row.item.offers.price, meta[1]);
});

console.log('✅ product-snippet: ' + passed + ' tests passed');
