// commerce/enterprise-catalog.js
// Loads enterprise products from data/commerce/enterprise-products.json (with a
// built-in seed fallback so the server is always serviceable on first boot).
//
// Exports: byId(id), publicView(), summarize(), all()

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const FILE = path.join(DATA_DIR, 'enterprise-products.json');

const ENGAGEMENT_PACK_NOTE = 'The license, the source, and a private cloud are milestones in the pack. They are not in the download.';
const ENGAGEMENT_PACK_WHEN = 'Engagement pack after payment · the license, source, and cloud stay milestones in the pack';
const ENGAGEMENT_PACK_LINE = 'Payment buys the engagement pack: MSA, statement of work, technical appendix, security pack, timeline, and payment schedule. The listed figure is the contract value named in that pack. ' + ENGAGEMENT_PACK_NOTE + ' The refund closes once the pack is issued.';

const SEED = [
  {
    id: 'ent-platform-license',
    title: 'Unicorn Platform — Enterprise License',
    tier: 'enterprise',
    priceUSD: 250000,
    billing: 'annual',
    currency: 'USD',
    description: ENGAGEMENT_PACK_LINE,
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
    title: 'Unicorn Acquisition Pack',
    tier: 'enterprise',
    priceUSD: 4000000,
    billing: 'one-time',
    currency: 'USD',
    description: ENGAGEMENT_PACK_LINE,
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
    description: ENGAGEMENT_PACK_LINE,
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
    description: ENGAGEMENT_PACK_LINE,
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
    description: ENGAGEMENT_PACK_LINE,
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
    description: ENGAGEMENT_PACK_LINE,
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
    description: ENGAGEMENT_PACK_LINE,
    sla: 'on-prem dedicated SRE',
    inputs: [
      { key: 'legalEntity', label: 'Legal Entity', required: true },
      { key: 'jurisdiction', label: 'Sovereign jurisdiction', required: true },
      { key: 'contactName', label: 'Authorized Signatory', required: true },
      { key: 'contactEmail', label: 'Signatory Email', required: true }
    ]
  },
  // Self-serve cash-close SKU — not full ACV. Unlocks autonomous proposal + SOW (AECOS).
  {
    id: 'ent-engagement-kickoff',
    title: 'Enterprise Engagement Kickoff',
    tier: 'enterprise',
    group: 'enterprise-kickoff',
    priceUSD: 2500,
    billing: 'one-time',
    currency: 'USD',
    description:
      'The file is the discovery brief, the commercial proposal, and a draft statement of work. The amount is credited toward a signed engagement. It does not deliver the license, the source, or a private cloud.',
    sla: 'proposal pack ≤ 24h after payment',
    inputs: [
      { key: 'contactEmail', label: 'Work Email', required: true },
      { key: 'legalEntity', label: 'Legal Entity', required: false },
      { key: 'contactName', label: 'Primary Contact', required: false }
    ]
  }
];

function honestRow(row) {
  if (!row || row.id === 'ent-engagement-kickoff' || !/^ent-/.test(String(row.id || ''))) return row;
  const title = row.id === 'ent-acquisition-pack' ? 'Unicorn Acquisition Pack' : row.title;
  return Object.assign({}, row, { title, description: ENGAGEMENT_PACK_LINE });
}

function _ensureKickoff(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (!arr.some((p) => p && p.id === 'ent-engagement-kickoff')) {
    const seed = SEED.find((p) => p.id === 'ent-engagement-kickoff');
    if (seed) arr.unshift(seed);
  }
  return arr;
}

function loadAll() {
  try {
    if (fs.existsSync(FILE)) {
      const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Array.isArray(j) && j.length) return _ensureKickoff(j);
    }
  } catch (e) { console.warn('[enterprise-catalog] load failed:', e.message); }
  // Seed file on first run so it's editable.
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(SEED, null, 2)); }
  catch (_) {}
  return SEED.slice();
}

let _all = loadAll();

function all() { return _all.map(honestRow); }
function byId(id) {
  const row = _all.find(p => p.id === id) || null;
  return row ? honestRow(row) : null;
}
function publicView() {
  return all().map(p => ({
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

module.exports = {
  all, byId, publicView, summarize,
  ENGAGEMENT_PACK_NOTE, ENGAGEMENT_PACK_WHEN, ENGAGEMENT_PACK_LINE,
};
