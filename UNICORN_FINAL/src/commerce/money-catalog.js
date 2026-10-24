'use strict';

/**
 * Money lanes Unicorn can actually issue after payment.
 * The file is the product. A parcel, an installed operating system,
 * orbital compute, a neural implant, and a quantum channel are not in it.
 */

const INDUSTRY_NOTE = 'Payment issues the architecture pack: outcomes, workflow, the KPI focus, a phase plan, and the handoff. The listed price is the price of that file. The pack does not install an operating system and does not certify HIPAA, SOX, or a regulator.';
const INDUSTRY_WHEN = 'Architecture pack after payment · the file does not install an operating system';
const FRONTIER_NOTE = 'Payment issues this tool pack. The file names the live route and what that route already does. It does not sell orbital compute, a neural implant, or a quantum channel.';
const FRONTIER_WHEN = 'Tool pack after payment · the live route is named in the file';
const LISTING_NOTE = 'Payment issues the listing desk file: every curated listing sheet, with cost and shipping. A parcel ships only when a CJ, Printful, or Printify key is armed and that row is dispatchable. This file does not dispatch a parcel.';
const LISTING_WHEN = 'Listing desk file after payment · a parcel waits for an armed supplier key';
const LISTING_DESK_USD = 49;
const REFUND_CLOSES = 'The refund closes once this file is issued.';

const FRONTIER = [
  { id: 'frontier-refund-shield', title: 'Crypto Refund Guarantee Shield', priceUSD: 199, route: '/refund', kpi: 'refund-trust', tool: 'The public refund page records a signed intent. Settlement of that intent stays owner-processed. This file does not move Bitcoin.' },
  { id: 'frontier-aura-feed', title: 'Live Conversion Aura Feed', priceUSD: 149, route: '/aura', kpi: 'social-proof', tool: 'The aura page reads the public aura endpoint. This file does not invent visitors, orders, or GMV.' },
  { id: 'frontier-outcome-pricing', title: 'Outcome-Anchored Pricing Engine', priceUSD: 399, route: '/api/outcome/list', kpi: 'value-share', tool: 'The outcome list is the live inspector. A price in this file is the shelf price of this pack, not a measured customer outcome.' },
  { id: 'frontier-checkout-cascade', title: 'Self-Healing Checkout Cascade', priceUSD: 249, route: '/checkout/', kpi: 'conversion', tool: 'Bitcoin is the live rail. Card and PayPal appear on checkout when they are configured. This file does not invent a rail.' },
  { id: 'frontier-timelock-discounts', title: 'Time-Locked Discount Vault', priceUSD: 99, route: '/frontier#frWorkshop', kpi: 'urgency', tool: 'The workshop on /frontier mints a time-locked code. This file is the pack for that tool.' },
  { id: 'frontier-receipt-nft', title: 'Sovereign Receipt NFT Issuer', priceUSD: 299, route: '/frontier#frWorkshop', kpi: 'audit-trail', tool: 'Receipt lookup runs on the frontier workshop. This file does not mint a token on a public chain by itself.' },
  { id: 'frontier-email-proof', title: 'Provable Email Delivery', priceUSD: 79, route: '/frontier#frWorkshop', kpi: 'deliverability', tool: 'The workshop records a signed email manifest when the tool is used. This file does not send a campaign.' },
  { id: 'frontier-gift-capability', title: 'Gift-as-Capability Token', priceUSD: 49, route: '/gift', kpi: 'virality', tool: 'The gift page mints and redeems a capability token. This file is the pack for that page.' },
  { id: 'frontier-bandit-transparency', title: 'Pricing Bandit Transparency Console', priceUSD: 179, route: '/transparency', kpi: 'fairness', tool: 'The transparency page shows the bandit snapshot the endpoint returns. This file does not invent a conversion rate.' },
  { id: 'frontier-carbon-checkout', title: 'Carbon-Inclusive Checkout', priceUSD: 39, route: '/frontier#frWorkshop', kpi: 'esg', tool: 'The workshop estimates grams of CO2 for a checkout. This file does not purchase an offset.' },
];

const FREE_TOOLS = [
  { id: 'frontier-pledge-pack', title: 'Anti-Dark-Pattern Pledge Pack', priceUSD: 0, route: '/pledge', kpi: 'trust', description: 'Public pledge page. Free. It is not a checkout product.' },
  { id: 'frontier-universal-cancel', title: 'Universal 1-Click Cancel', priceUSD: 0, route: '/cancel', kpi: 'retention', description: 'Public cancel page. Free. It is not a checkout product.' },
];

function frontierSellable() {
  return FRONTIER.map((row) => ({
    id: row.id,
    title: row.title,
    priceUSD: row.priceUSD,
    tier: 'frontier',
    group: 'frontier',
    deliveryMinutes: 5,
    kpi: row.kpi,
    route: row.route,
    reason: 'frontier_tool',
    ctaLabel: 'Buy the tool pack →',
    fileTitle: 'Tool Pack',
    deliverableType: 'frontier-pack',
    sections: ['Tool contract', 'Live route', 'What stays outside this file'],
    when: FRONTIER_WHEN,
    note: FRONTIER_NOTE,
    description: 'Payment issues the tool pack for ' + row.title + '. The file names the live route ' + row.route + '. ' + FRONTIER_NOTE,
    tool: row.tool,
  }));
}

function industrySellable() {
  let list = [];
  try {
    list = require('../../backend/modules/programmatic-seo-engine').listVerticals() || [];
  } catch (_) { list = []; }
  return list.filter((v) => v && v.id && Number(v.priceUsd) > 0).map((v) => ({
    id: v.id,
    title: v.title + ' Architecture Pack',
    priceUSD: Number(v.priceUsd),
    tier: 'industry',
    group: 'industry',
    deliveryMinutes: 5,
    kpi: v.kpi,
    reason: 'industry_pack',
    ctaLabel: 'Buy the architecture pack →',
    fileTitle: 'Architecture Pack',
    deliverableType: 'industry-pack',
    sections: ['Outcomes', 'Workflow', 'Phase plan', 'Handoff'],
    when: INDUSTRY_WHEN,
    note: INDUSTRY_NOTE,
    description: INDUSTRY_NOTE + ' Page focus: ' + v.kpi + '.',
  }));
}

function listingDesk() {
  return {
    id: 'dropship-listing-desk',
    title: 'Dropship Listing Desk',
    priceUSD: LISTING_DESK_USD,
    tier: 'dropship',
    group: 'dropship',
    deliveryMinutes: 5,
    kpi: 'listing-file',
    reason: 'listing_desk',
    ctaLabel: 'Buy the listing desk →',
    fileTitle: 'Listing Desk',
    deliverableType: 'listing-desk',
    sections: ['Listing sheets', 'Supplier status', 'What this file does not ship'],
    when: LISTING_WHEN,
    note: LISTING_NOTE,
    description: LISTING_NOTE,
  };
}

function shelfRows() {
  return frontierSellable().concat(industrySellable(), [listingDesk()]);
}

function byId(id) {
  const key = String(id || '');
  return shelfRows().find((row) => row.id === key) || null;
}

function frontierMasterRows() {
  return frontierSellable().concat(FREE_TOOLS).map((row) => ({
    id: row.id,
    title: row.title,
    priceUsd: row.priceUSD,
    group: 'frontier',
    kpi: row.kpi || 'frontier',
    description: row.description,
  }));
}

function industryMasterRows() {
  return industrySellable().map((row) => ({
    id: row.id,
    title: row.title,
    priceUsd: row.priceUSD,
    group: 'industry',
    kpi: row.kpi,
    description: row.description,
    deliveryKind: 'architecture-pack',
  }));
}

function moneyOf(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function listingLines() {
  let products = [];
  try {
    products = require('../../backend/modules/zacc/catalog-curated').getCuratedCatalog() || [];
  } catch (_) { products = []; }
  if (!products.length) {
    return ['The curated catalog did not load. No listing was invented in its place.'];
  }
  return products.map((p) => [
    '- ' + String(p.name || 'untitled'),
    'category ' + String(p.category || ''),
    'cost ' + moneyOf(p.costUsd),
    'shipping ' + moneyOf(p.shippingUsd),
    'weightKg ' + String(p.weightKg != null ? p.weightKg : ''),
    'supplier ' + String(p.supplier || 'manual'),
    'demoOnly ' + String(p.demoOnly === true),
    'dispatchable false until a supplier key accepts this row',
  ].join(' · '));
}

function render(row, receipt) {
  const orderId = receipt && (receipt.id || receipt.orderId) ? String(receipt.id || receipt.orderId) : 'unknown';
  const paid = receipt && (receipt.amount || receipt.amountUsd || receipt.amount_usd);
  const head = [
    '# ' + row.fileTitle + ': ' + row.title,
    '',
    'Generated: ' + new Date().toISOString(),
    'Order ID: ' + orderId,
    'Service ID: ' + row.id,
    'Listed price: ' + moneyOf(row.priceUSD),
    'Amount on the receipt: ' + (Number(paid) > 0 ? moneyOf(paid) : 'not recorded'),
    '',
    row.note,
    REFUND_CLOSES,
    '',
  ];
  if (row.tier === 'frontier') {
    return head.concat([
      '## Tool contract',
      row.tool,
      '',
      '## Live route',
      row.route,
      '',
      '## What stays outside this file',
      'Orbital compute, a neural implant, and a quantum channel are not in this download.',
      '',
    ]).join('\n');
  }
  if (row.tier === 'industry') {
    return head.concat([
      '## Outcomes',
      'The page focus is: ' + row.kpi + '.',
      'That phrase is the focus label. It is not a measured result and it is not a certification.',
      '',
      '## Workflow',
      '1. Intake — the buyer names the operation this focus applies to.',
      '2. Workflow — map the steps that would have to exist for that focus.',
      '3. Proof — only a result this engagement later records.',
      '4. Handoff — this file is the handoff.',
      '',
      '## Phase plan',
      'Week 1: confirm the focus label with the buyer.',
      'Week 2: write the workflow against that focus.',
      'Week 3: list the proof this file does not yet have.',
      'Week 4: close the open questions in this pack.',
      '',
      '## Handoff',
      'This document is the architecture pack. It does not install an operating system.',
      '',
    ]).join('\n');
  }
  return head.concat([
    '## Supplier status',
    'Auto-ship stays off until a CJ, Printful, or Printify key is armed and the row is dispatchable.',
    '',
    '## Listing sheets',
    ...listingLines(),
    '',
    '## What this file does not ship',
    'Review counts are not copied here. This file does not dispatch a parcel and it does not invent a tracking number.',
    '',
  ]).join('\n');
}

function artifact(receipt, row) {
  const item = row || null;
  if (!item) return null;
  const content = render(item, receipt || {});
  return {
    serviceId: item.id,
    recipe: item.tier,
    tier: item.tier,
    deliverableType: item.deliverableType,
    requiresHumanFulfillment: false,
    title: item.fileTitle,
    status: 'delivered',
    format: 'markdown',
    filename: item.id + '.md',
    generatedBy: 'money-catalog',
    fulfillmentMode: 'deterministic',
    bytes: Buffer.byteLength(content, 'utf8'),
    content,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  INDUSTRY_NOTE,
  INDUSTRY_WHEN,
  FRONTIER_NOTE,
  FRONTIER_WHEN,
  LISTING_NOTE,
  LISTING_WHEN,
  LISTING_DESK_USD,
  shelfRows,
  byId,
  frontierMasterRows,
  industryMasterRows,
  artifact,
  render,
};
