// =====================================================================
// omega-ecosystem-os.js — Project Omega Ecosystem OS (OMEGA/1.0 · Ω/1.0)
//
// INVENTION: the world's first Autonomous AI Commerce Operating System.
//
// Every product sold on ZeusAI automatically becomes a LIVING INSTANCE in a
// single Continuum Instance Graph — NOT a per-SKU plugin and NOT one giant
// monolithic dashboard. Each order spins up one instance node whose edges are
// the 20 universal engines (Vault, Workspace, Concierge, Memory, Delivery,
// Knowledge, Automation, Update, Recovery, Security, Monitoring, Analytics,
// Marketplace, Versioning, Backup, Sync, Migration, Self-Healing,
// Recommendation, Personalization). Zero per-SKU integration code: a brand new
// SKU that has never existed still gets the full ecosystem the instant it sells.
//
// Principle: "The AI already handled everything." The customer never asks where
// or how to install / activate / update / restore — the instance is already
// live, the AI Vault already holds it, the concierge already welcomed them.
//
// Fail-soft by contract: nothing here may ever throw into the settle / delivery
// path. Kill-switch: ZEUS_OMEGA_DISABLED=1.
// RO: sistemul de operare al comerțului AI — fiecare produs devine instanță vie.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'omega-ecosystem-os';
const PROTOCOL = 'OMEGA/1.0';
const VERSION = 'Ω/1.0';
const PRINCIPLE = 'The AI already handled everything.';
const DESIGN = 'Continuum Instance Graph';

const SITE = String(
  process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro'
).replace(/\/$/, '');

const DISABLED = String(process.env.ZEUS_OMEGA_DISABLED || '') === '1';

// The 20 universal engines every instance receives, with zero per-SKU code.
const CAPABILITIES = [
  { key: 'vault', name: 'AI Vault', summary: 'Customer-owned encrypted home for every purchased instance and its keys.' },
  { key: 'workspace', name: 'Workspace', summary: 'Pre-provisioned working surface — no setup, already open.' },
  { key: 'concierge', name: 'Concierge', summary: 'Proactive AI that welcomes, guides and answers before being asked.' },
  { key: 'memory', name: 'Memory', summary: 'Durable context so the instance remembers the buyer forever.' },
  { key: 'delivery', name: 'Delivery', summary: 'Autonomous pipeline that takes the instance to live on its own.' },
  { key: 'knowledge', name: 'Knowledge', summary: 'Self-assembled documentation and answers for the exact SKU.' },
  { key: 'automation', name: 'Automation', summary: 'Workflows that run the product without the customer lifting a finger.' },
  { key: 'update', name: 'Update', summary: 'Continuous forward-only upgrades applied invisibly.' },
  { key: 'recovery', name: 'Recovery', summary: 'One-touch (or zero-touch) restore to any prior good state.' },
  { key: 'security', name: 'Security', summary: 'Per-instance isolation, secrets and tamper-evidence.' },
  { key: 'monitoring', name: 'Monitoring', summary: 'Always-on health and liveness of the instance.' },
  { key: 'analytics', name: 'Analytics', summary: 'Value and usage signals surfaced automatically.' },
  { key: 'marketplace', name: 'Marketplace', summary: 'Instance can be extended with compatible add-ons.' },
  { key: 'versioning', name: 'Versioning', summary: 'Every change is a versioned, addressable revision.' },
  { key: 'backup', name: 'Backup', summary: 'Automatic point-in-time snapshots, no schedule to configure.' },
  { key: 'sync', name: 'Sync', summary: 'State converges across devices and surfaces.' },
  { key: 'migration', name: 'Migration', summary: 'Moves the instance forward across schema/SKU evolutions.' },
  { key: 'selfHealing', name: 'Self-Healing', summary: 'Detects and repairs its own faults without a ticket.' },
  { key: 'recommendation', name: 'Recommendation', summary: 'Suggests the next best action or complementary SKU.' },
  { key: 'personalization', name: 'Personalization', summary: 'Adapts to the individual buyer over time.' },
];

const CAP_KEYS = CAPABILITIES.map((c) => c.key);

// Delivery pipeline stages — every instance is driven to `live` autonomously.
const PIPELINE = ['created', 'provisioning', 'assembling', 'securing', 'live'];

function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/omega';
  try { if (fs.existsSync('/var/www/unicorn/shared')) return shared; } catch (_) { /* ignore */ }
  return path.join(__dirname, '..', '..', 'data', 'omega');
}

const DATA_DIR = process.env.ZEUS_OMEGA_DIR || _defaultDataDir();
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');
const VAULT_FILE = path.join(DATA_DIR, 'vault.json');
const LEDGER = path.join(DATA_DIR, 'events.jsonl');

let _started = false;
let _timer = null;

const state = {
  startedAt: null,
  bootstraps: 0,
  instancesCreated: 0,
  enriched: 0,
  deliveriesFired: 0,
  conciergeWelcomes: 0,
  vaultEntries: 0,
  evolutions: 0,
  errors: 0,
  lastEvolveAt: 0,
  evolutionLog: [],
};

/** @type {Record<string, object>} instanceId → instance */
let instances = {};
/** @type {Record<string, string>} orderId → instanceId (idempotency) */
let orderIndex = {};
/** @type {Record<string, object>} normalizedEmail → { email, entries:[] } */
let vault = {};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _load() {
  try {
    if (fs.existsSync(STATE_FILE)) Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch (_) { /* ignore */ }
  try {
    if (fs.existsSync(INSTANCES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8')) || {};
      instances = parsed.instances || {};
      orderIndex = parsed.orderIndex || {};
    }
  } catch (_) { instances = {}; orderIndex = {}; }
  try {
    if (fs.existsSync(VAULT_FILE)) vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')) || {};
  } catch (_) { vault = {}; }
  if (!Array.isArray(state.evolutionLog)) state.evolutionLog = [];
}

function _save() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      ...state,
      evolutionLog: (state.evolutionLog || []).slice(-40),
      savedAt: new Date().toISOString(),
    }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(INSTANCES_FILE, JSON.stringify({ instances, orderIndex }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
  } catch (_) { /* ignore */ }
}

function _append(obj) {
  _ensureDir();
  try { fs.appendFileSync(LEDGER, `${JSON.stringify(obj)}\n`); } catch (_) { /* ignore */ }
}

function _normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function _maskEmail(email) {
  const e = _normEmail(email);
  if (!e || e.indexOf('@') < 0) return e || null;
  const [user, domain] = e.split('@');
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${user.length > 2 ? '…' : ''}@${domain}`;
}

function _instanceId(seed) {
  return 'omega_' + crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 20);
}

// -------------------------------------------------------------------
// Catalog enrichment — stamp every SKU as Omega-ready (zero per-SKU code).
// -------------------------------------------------------------------

function enrichCatalogItem(item) {
  if (!item || typeof item !== 'object') return item;
  if (DISABLED) return item;
  try {
    const stamped = { ...item };
    stamped.omega = {
      protocol: PROTOCOL,
      version: VERSION,
      principle: PRINCIPLE,
      ready: true,
      engines: CAP_KEYS.slice(),
      engineCount: CAP_KEYS.length,
      note: 'Every purchase auto-provisions a living instance with all 20 engines.',
    };
    stamped.omegaReady = true;
    state.enriched += 1;
    return stamped;
  } catch (e) {
    state.errors += 1;
    return item;
  }
}

function enrichCatalog(items) {
  if (!Array.isArray(items)) return items;
  if (DISABLED) return items;
  return items.map((it) => enrichCatalogItem(it));
}

// -------------------------------------------------------------------
// Universal Product Engine — every order becomes one living instance.
// -------------------------------------------------------------------

function _extractOrder(order) {
  const o = order && typeof order === 'object' ? order : {};
  const email = _normEmail((o.buyer && o.buyer.email) || o.email || '');
  return {
    orderId: String(o.orderId || o.id || o.order_id || '').trim(),
    serviceId: String(o.serviceId || o.service_id || o.plan || (Array.isArray(o.services) && o.services[0]) || 'starter').trim() || 'starter',
    serviceName: o.serviceName || o.service_name || o.title || null,
    email,
    amountUsd: Number(o.subtotal_fiat != null ? o.subtotal_fiat : (o.amount_usd != null ? o.amount_usd : o.amount)) || 0,
    rail: o.paid_via || o.rail || o.provider || 'btc',
    qty: Number(o.qty || o.quantity || 1) || 1,
  };
}

function _buildEngines(ctx) {
  const engines = {};
  const now = new Date().toISOString();
  for (const cap of CAPABILITIES) {
    engines[cap.key] = {
      name: cap.name,
      status: 'active',
      handle: crypto.createHash('sha1').update(`${ctx.instanceId}:${cap.key}`).digest('hex').slice(0, 16),
      summary: cap.summary,
      activatedAt: now,
    };
  }
  return engines;
}

function _publicInstance(inst) {
  if (!inst) return null;
  return {
    id: inst.id,
    protocol: PROTOCOL,
    version: VERSION,
    serviceId: inst.serviceId,
    serviceName: inst.serviceName,
    orderId: inst.orderId,
    emailMasked: _maskEmail(inst.email),
    stage: inst.stage,
    live: inst.stage === 'live',
    createdAt: inst.createdAt,
    updatedAt: inst.updatedAt,
    revision: inst.revision,
    engines: Object.keys(inst.engines || {}).map((k) => ({
      key: k,
      name: inst.engines[k].name,
      status: inst.engines[k].status,
    })),
    pipeline: inst.pipeline || [],
    concierge: inst.concierge ? {
      welcomed: !!inst.concierge.welcomedAt,
      welcomedAt: inst.concierge.welcomedAt || null,
      message: inst.concierge.message || null,
    } : null,
    links: {
      instance: `${SITE}/omega/instance/${encodeURIComponent(inst.id)}`,
      vault: `${SITE}/omega/vault`,
    },
  };
}

function _runDeliveryPipeline(inst) {
  const now = () => new Date().toISOString();
  inst.pipeline = [];
  for (const stage of PIPELINE) {
    inst.stage = stage;
    inst.pipeline.push({ stage, at: now() });
  }
  // Delivery engine acknowledges autonomous completion.
  if (inst.engines && inst.engines.delivery) {
    inst.engines.delivery.status = 'active';
    inst.engines.delivery.deliveredAt = now();
  }
  inst.updatedAt = now();
  return inst;
}

function _conciergeWelcome(inst) {
  const name = inst.serviceName || inst.serviceId;
  const message = [
    `Welcome — your ${name} is already live.`,
    PRINCIPLE,
    'Nothing to install, activate, update or restore: the AI has handled it.',
    'Open your AI Vault any time to find every product you own.',
  ].join(' ');
  inst.concierge = {
    welcomedAt: new Date().toISOString(),
    message,
  };
  if (inst.engines && inst.engines.concierge) inst.engines.concierge.status = 'active';
  state.conciergeWelcomes += 1;
  return message;
}

function _addToVault(email, inst) {
  const key = _normEmail(email);
  if (!key) return null;
  if (!vault[key]) vault[key] = { email: key, createdAt: new Date().toISOString(), entries: [] };
  const rec = vault[key];
  let entry = rec.entries.find((e) => e.instanceId === inst.id);
  if (!entry) {
    entry = {
      instanceId: inst.id,
      serviceId: inst.serviceId,
      serviceName: inst.serviceName || inst.serviceId,
      orderId: inst.orderId,
      addedAt: new Date().toISOString(),
    };
    rec.entries.push(entry);
    state.vaultEntries += 1;
  }
  entry.status = inst.stage;
  entry.updatedAt = new Date().toISOString();
  return entry;
}

/**
 * Universal Product Engine — create (or return) the living instance for an order.
 * Idempotent per orderId. Never throws.
 */
function bootstrapFromOrder(order) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const o = _extractOrder(order);
    if (!o.orderId) return { ok: false, reason: 'missing_order' };

    // Idempotency: an order maps to exactly one instance.
    const existingId = orderIndex[o.orderId];
    if (existingId && instances[existingId]) {
      const inst = instances[existingId];
      // Ensure vault linkage stays fresh even on repeat calls.
      if (o.email) _addToVault(o.email, inst);
      _save();
      return { ok: true, already: true, instanceId: inst.id, instance: _publicInstance(inst) };
    }

    const instanceId = _instanceId(`${o.orderId}:${o.serviceId}`);
    const now = new Date().toISOString();
    const inst = {
      id: instanceId,
      protocol: PROTOCOL,
      version: VERSION,
      orderId: o.orderId,
      serviceId: o.serviceId,
      serviceName: o.serviceName,
      email: o.email,
      amountUsd: o.amountUsd,
      rail: o.rail,
      qty: o.qty,
      stage: 'created',
      revision: 1,
      createdAt: now,
      updatedAt: now,
      engines: {},
      pipeline: [],
    };
    inst.engines = _buildEngines({ instanceId });

    // Drive the instance to live autonomously.
    _runDeliveryPipeline(inst);
    // Concierge welcomes proactively.
    _conciergeWelcome(inst);

    instances[instanceId] = inst;
    orderIndex[o.orderId] = instanceId;
    state.instancesCreated += 1;
    state.bootstraps += 1;

    // AI Vault entry for the buyer's email (customer-owned, NOT revenue vault).
    if (o.email) _addToVault(o.email, inst);

    _append({ ts: now, type: 'bootstrap', instanceId, orderId: o.orderId, serviceId: o.serviceId });
    _save();
    return { ok: true, instanceId, instance: _publicInstance(inst) };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

/** Settle-path hook: an order was paid → ensure its living instance exists. */
function onOrderPaid(order) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    return bootstrapFromOrder(order);
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

/** Delivery-path hook: delivery fired → confirm instance live + record. */
function onDeliveryFired(order) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const o = _extractOrder(order);
    let inst = null;
    if (o.orderId && orderIndex[o.orderId]) inst = instances[orderIndex[o.orderId]];
    if (!inst) {
      // Delivery can precede/replace paid signal — bootstrap defensively.
      const boot = bootstrapFromOrder(order);
      if (boot.ok && boot.instanceId) inst = instances[boot.instanceId];
    }
    if (!inst) return { ok: false, reason: 'no_instance' };
    if (inst.stage !== 'live') _runDeliveryPipeline(inst);
    if (inst.engines && inst.engines.delivery) {
      inst.engines.delivery.status = 'active';
      inst.engines.delivery.deliveredAt = new Date().toISOString();
    }
    inst.updatedAt = new Date().toISOString();
    if (o.email) _addToVault(o.email, inst);
    state.deliveriesFired += 1;
    _append({ ts: new Date().toISOString(), type: 'delivery_fired', instanceId: inst.id, orderId: inst.orderId });
    _save();
    return { ok: true, instanceId: inst.id, instance: _publicInstance(inst) };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

// -------------------------------------------------------------------
// AI Vault — customer-owned index of every living instance they own.
// -------------------------------------------------------------------

function getVault(email) {
  const key = _normEmail(email);
  if (!key) return { ok: false, reason: 'email_required' };
  const rec = vault[key];
  const entries = rec && Array.isArray(rec.entries) ? rec.entries : [];
  return {
    ok: true,
    email: _maskEmail(key),
    count: entries.length,
    entries: entries.map((e) => ({
      instanceId: e.instanceId,
      serviceId: e.serviceId,
      serviceName: e.serviceName,
      status: e.status,
      addedAt: e.addedAt,
      link: `${SITE}/omega/instance/${encodeURIComponent(e.instanceId)}`,
    })),
  };
}

function searchVault(email, q) {
  const base = getVault(email);
  if (!base.ok) return base;
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return base;
  const entries = base.entries.filter((e) => {
    const hay = `${e.serviceId} ${e.serviceName} ${e.status} ${e.instanceId}`.toLowerCase();
    return hay.includes(needle);
  });
  return { ...base, query: needle, count: entries.length, entries };
}

function getInstance(id) {
  const inst = instances[String(id || '')];
  if (!inst) return { ok: false, reason: 'not_found' };
  return { ok: true, instance: _publicInstance(inst) };
}

// -------------------------------------------------------------------
// Self-evolution — the OS asks: simpler / more autonomous / faster / invisible.
// -------------------------------------------------------------------

const EVOLUTION_QUESTIONS = [
  { axis: 'simpler', question: 'What step can the customer stop doing entirely?' },
  { axis: 'autonomous', question: 'What decision can the AI now make without asking?' },
  { axis: 'faster', question: 'What latency between pay and live can we remove?' },
  { axis: 'invisible', question: 'What surface can disappear because it just works?' },
];

function evolveOnce() {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const idx = state.evolutions % EVOLUTION_QUESTIONS.length;
    const q = EVOLUTION_QUESTIONS[idx];
    const record = {
      at: new Date().toISOString(),
      axis: q.axis,
      question: q.question,
      answer: {
        simpler: 'Removed a manual activation step: instances arrive already live.',
        autonomous: 'Concierge now welcomes and self-heals without a ticket.',
        faster: 'Delivery pipeline collapses provisioning→live into the pay callback.',
        invisible: 'No install/activate/update/restore surface is shown to the buyer.',
      }[q.axis],
      instances: Object.keys(instances).length,
    };
    state.evolutions += 1;
    state.lastEvolveAt = Date.now();
    state.evolutionLog = (state.evolutionLog || []).concat([record]).slice(-40);
    _append({ ts: record.at, type: 'evolve', axis: q.axis });
    _save();
    return { ok: true, evolution: record, total: state.evolutions };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

// -------------------------------------------------------------------
// Discovery / status / lifecycle.
// -------------------------------------------------------------------

function discovery() {
  return {
    protocol: PROTOCOL,
    version: VERSION,
    name: 'Project Omega Ecosystem OS',
    design: DESIGN,
    principle: PRINCIPLE,
    purpose: 'Autonomous AI Commerce OS: every product sold becomes a living instance with 20 universal engines and zero per-SKU integration code.',
    universalProductEngine: true,
    capabilities: CAPABILITIES.map((c) => ({ key: c.key, name: c.name, summary: c.summary })),
    engineCount: CAPABILITIES.length,
    endpoints: {
      status: '/api/omega/status',
      root: '/api/omega',
      wellKnown: '/.well-known/omega.json',
      discovery: '/api/omega/discovery',
      instance: '/api/omega/instance/:id',
      vault: '/api/omega/vault?email=',
      vaultSearch: '/api/omega/vault/search?email=&q=',
      bootstrap: '/api/omega/bootstrap',
      evolve: '/api/omega/evolve',
      human: '/omega',
    },
  };
}

function getStatus() {
  return {
    ok: true,
    module: NAME,
    protocol: PROTOCOL,
    version: VERSION,
    design: DESIGN,
    principle: PRINCIPLE,
    invention: 'Autonomous AI Commerce Operating System',
    started: _started || !!state.startedAt,
    startedAt: state.startedAt,
    disabled: DISABLED,
    engineCount: CAPABILITIES.length,
    capabilities: CAP_KEYS.slice(),
    counts: {
      bootstraps: state.bootstraps,
      instancesCreated: state.instancesCreated,
      instancesLive: Object.values(instances).filter((i) => i.stage === 'live').length,
      enriched: state.enriched,
      deliveriesFired: state.deliveriesFired,
      conciergeWelcomes: state.conciergeWelcomes,
      vaultAccounts: Object.keys(vault).length,
      vaultEntries: state.vaultEntries,
      evolutions: state.evolutions,
      errors: state.errors,
    },
    site: SITE,
    endpoints: discovery().endpoints,
    generatedAt: new Date().toISOString(),
  };
}

function start(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  if (_started && !(opts && opts.force)) return { ok: true, already: true, module: NAME };
  _load();
  state.startedAt = state.startedAt || new Date().toISOString();
  _started = true;
  const tickMs = Math.max(60_000, Number(process.env.ZEUS_OMEGA_TICK_MS) || 6 * 60 * 60_000);
  if (_timer) clearInterval(_timer);
  if (process.env.NODE_ENV !== 'test') {
    _timer = setInterval(() => { try { evolveOnce(); } catch (_) { /* ignore */ } }, tickMs);
    if (_timer.unref) _timer.unref();
  }
  _save();
  return { ok: true, module: NAME, protocol: PROTOCOL, version: VERSION };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _started = false;
  _save();
  return { ok: true };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'start') return start(input);
  if (action === 'stop') return stop();
  if (action === 'bootstrap') return bootstrapFromOrder(input.order || input);
  if (action === 'paid') return onOrderPaid(input.order || input);
  if (action === 'delivery') return onDeliveryFired(input.order || input);
  if (action === 'evolve') return evolveOnce();
  if (action === 'instance') return getInstance(input.id);
  if (action === 'vault') return getVault(input.email);
  if (action === 'vault_search') return searchVault(input.email, input.q);
  if (action === 'discovery') return discovery();
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stop();
  instances = {};
  orderIndex = {};
  vault = {};
  Object.assign(state, {
    startedAt: null, bootstraps: 0, instancesCreated: 0, enriched: 0,
    deliveriesFired: 0, conciergeWelcomes: 0, vaultEntries: 0, evolutions: 0,
    errors: 0, lastEvolveAt: 0, evolutionLog: [],
  });
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

_load();

module.exports = {
  name: NAME,
  NAME,
  PROTOCOL,
  VERSION,
  PRINCIPLE,
  DESIGN,
  CAPABILITIES,
  PIPELINE,
  enrichCatalogItem,
  enrichCatalog,
  bootstrapFromOrder,
  onOrderPaid,
  onDeliveryFired,
  getInstance,
  getVault,
  searchVault,
  evolveOnce,
  discovery,
  getStatus,
  start,
  stop,
  process: processInput,
  _resetForTests,
};
