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
    description: 'SOW engagement (not self-serve checkout): annual enterprise license — full platform, multi-tenant, SLAs, on-prem option. Contact Enterprise Sales to start.',
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
    description: 'SOW / M&A engagement only: full source transfer, brand assets, IP assignment, 12-month transition. Not available via instant BTC checkout — request a proposal.',
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
    description: 'Partnership SOW: setup fee + 20% net revenue share, co-branded deployment, joint GTM. Contact sales — not a self-serve cart item.',
    inputs: [
      { key: 'legalEntity', label: 'Partner Legal Entity', required: true },
      { key: 'contactEmail', label: 'Partner Contact Email', required: true }
    ]
  },
  {
    id: 'ent-private-cloud',
    title: 'Unicorn Private Cloud — Dedicated Tenant',
    tier: 'enterprise',
    priceUSD: 150000,
    billing: 'annual',
    currency: 'USD',
    description: 'Enterprise SOW: dedicated single-tenant cloud, isolated data plane, dedicated keys, 99.99% SLA, 24/7 support. Proposal via Enterprise Sales.',
    sla: '99.99% / 30min response',
    seats: 'unlimited',
    inputs: [
      { key: 'legalEntity', label: 'Legal Entity', required: true },
      { key: 'region', label: 'Preferred cloud region', required: true },
      { key: 'contactEmail', label: 'Operations Contact', required: true }
    ]
  },
  {
    id: 'ent-ai-transformation',
    title: 'Unicorn AI Transformation Programme (12 months)',
    tier: 'enterprise',
    priceUSD: 500000,
    billing: 'project',
    currency: 'USD',
    description: '12-month transformation programme under a signed SOW: discovery, roadmap, custom agents, copilots, change management. Contact Enterprise Sales.',
    sla: 'dedicated programme team',
    inputs: [
      { key: 'legalEntity', label: 'Legal Entity', required: true },
      { key: 'sponsor', label: 'Executive sponsor', required: true },
      { key: 'objectives', label: 'Top 3 transformation objectives', required: true },
      { key: 'contactEmail', label: 'Programme Contact', required: true }
    ]
  },
  {
    id: 'ent-white-label',
    title: 'Unicorn White-Label Platform',
    tier: 'enterprise',
    priceUSD: 350000,
    billing: 'annual',
    currency: 'USD',
    description: 'White-label partner SOW: your branding/domain, segregated catalog, partner revenue dashboard. Not self-serve — request a proposal.',
    sla: '99.95% / 2h response',
    inputs: [
      { key: 'legalEntity', label: 'Partner Legal Entity', required: true },
      { key: 'brand', label: 'White-label brand name', required: true },
      { key: 'contactEmail', label: 'Partner Contact Email', required: true }
    ]
  },
  {
    id: 'ent-sovereign-deployment',
    title: 'Unicorn Sovereign Deployment (on-prem + audit suite)',
    tier: 'enterprise',
    priceUSD: 1200000,
    billing: 'one-time',
    currency: 'USD',
    description: 'On-prem sovereign SOW: compliance audit suite, key custody, encrypted backups, 12-month onboarding. Contact Enterprise Sales to engage.',
    sla: 'on-prem dedicated SRE',
    inputs: [
      { key: 'legalEntity', label: 'Legal Entity', required: true },
      { key: 'jurisdiction', label: 'Sovereign jurisdiction', required: true },
      { key: 'contactName', label: 'Authorized Signatory', required: true },
      { key: 'contactEmail', label: 'Signatory Email', required: true }
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
