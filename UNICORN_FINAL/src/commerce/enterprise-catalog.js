// commerce/enterprise-catalog.js
// Loads enterprise products from data/commerce/enterprise-products.json (with a
// built-in seed fallback so the server is always serviceable on first boot).
//
// Exports: byId(id), publicView(), summarize(), all()

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const FILE = path.join(DATA_DIR, 'enterprise-products.json');

const SEED = [
  {
    id: 'ent-platform-license',
    title: 'Unicorn Platform — Enterprise License',
    tier: 'enterprise',
    priceUSD: 250000,
    billing: 'annual',
    currency: 'USD',
    description: 'Annual enterprise license: full platform, multi-tenant, SLAs, on-prem option.',
    sla: '99.99% / 1h response',
    seats: 'unlimited',
    inputs: [
      { key: 'legalEntity', label: 'Legal Entity', required: true },
      { key: 'contactName', label: 'Primary Contact', required: true },
      { key: 'contactEmail', label: 'Contact Email', required: true }
    ]
  },
  {
    id: 'ent-acquisition-pack',
    title: 'Unicorn Acquisition Pack — Source Code + IP',
    tier: 'enterprise',
    priceUSD: 4000000,
    billing: 'one-time',
    currency: 'USD',
    description: 'Full source code transfer, brand assets, IP assignment, 12-month transition support.',
    sla: 'priority engineering',
    inputs: [
      { key: 'legalEntity', label: 'Acquirer Legal Entity', required: true },
      { key: 'contactName', label: 'Authorized Signatory', required: true },
      { key: 'contactEmail', label: 'Signatory Email', required: true },
      { key: 'jurisdiction', label: 'Governing Jurisdiction', required: false }
    ]
  },
  {
    id: 'ent-revenue-share',
    title: 'Unicorn Revenue-Share Partnership',
    tier: 'enterprise',
    priceUSD: 50000,
    billing: 'one-time-setup',
    revenueShare: 0.20,
    currency: 'USD',
    description: 'Setup fee + 20% net revenue share. Co-branded deployment, joint GTM.',
    inputs: [
      { key: 'legalEntity', label: 'Partner Legal Entity', required: true },
      { key: 'contactEmail', label: 'Partner Contact Email', required: true }
    ]
  }
];

function loadAll() {
  try {
    if (fs.existsSync(FILE)) {
      const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Array.isArray(j) && j.length) return j;
    }
  } catch (e) { console.warn('[enterprise-catalog] load failed:', e.message); }
  // Seed file on first run so it's editable.
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(SEED, null, 2)); }
  catch (_) {}
  return SEED.slice();
}

let _all = loadAll();

function all() { return _all.slice(); }
function byId(id) { return _all.find(p => p.id === id) || null; }
function publicView() {
  return _all.map(p => ({
    id: p.id, title: p.title, tier: p.tier || 'enterprise',
    priceUSD: p.priceUSD, billing: p.billing, currency: p.currency || 'USD',
    description: p.description, sla: p.sla, seats: p.seats,
    revenueShare: p.revenueShare,
    inputs: p.inputs || []
  }));
}
function summarize() {
  const total = _all.length;
  const tvUSD = _all.reduce((s, p) => s + Number(p.priceUSD || 0), 0);
  const tiers = {};
  for (const p of _all) { const t = p.tier || 'enterprise'; tiers[t] = (tiers[t] || 0) + 1; }
  return { products: total, totalListedValueUSD: tvUSD, tiers };
}

module.exports = { all, byId, publicView, summarize };
