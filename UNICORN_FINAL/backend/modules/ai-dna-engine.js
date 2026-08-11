// =====================================================================
// ai-dna-engine.js — PROJECT AI DNA (DNA/1.0 · D/1.0)
//
// INVENTION: Adaptive personalization intelligence — NOT a user profile.
//
// AI DNA is a living layer that makes every AI interaction more useful over
// time using ONLY platform-available data + explicit user settings.
// It NEVER invents or assumes sensitive personal attributes (no gender,
// age, ethnicity, religion, precise location, health, politics, etc.).
//
// Maintains: customer continuum model, product relationships, workspace /
// notification / AI / automation preferences, feature adoption, learning
// progress, knowledge-graph links into Omega · Genome · Vault · Concierge.
//
// Architecture inventions evaluated:
//   A) Static CRM-style user profiles — rejected (surveillance + stale)
//   B) Hardcoded personalization rules per SKU — rejected (not extensible)
//   C) Trait Adapter Genome + Event Helix — SELECTED
//      Modular adapters, versioned schema, audit log, TTL cache, Future Mode
//
// Fail-soft. Never blocks settle. Kill-switch: ZEUS_DNA_DISABLED=1.
// Persist: /var/www/unicorn/shared/data/dna or ZEUS_DNA_DIR.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'ai-dna-engine';
const PROTOCOL = 'DNA/1.0';
const VERSION = 'D/1.0';
const SCHEMA_VERSION = 1;
const PRINCIPLE = 'Useful over time — never invasive. Only platform data + explicit consent.';
const DESIGN = 'Trait Adapter Genome + Event Helix';

const SITE = String(
  process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro'
).replace(/\/$/, '');

const DISABLED = String(process.env.ZEUS_DNA_DISABLED || '') === '1';
const CACHE_TTL_MS = Math.max(1_000, Number(process.env.ZEUS_DNA_CACHE_TTL_MS) || 15_000);

/** Forbidden inference categories — hard guard. */
const FORBIDDEN_TRAITS = [
  'gender', 'sex', 'age', 'birthdate', 'ethnicity', 'race', 'religion',
  'political', 'health', 'disability', 'sexual_orientation', 'precise_location',
  'government_id', 'biometric', 'income_guess',
];

/** Extensible trait adapters — future products push new adapters without core rewrite. */
const TRAIT_ADAPTERS = [
  { id: 'products', title: 'Products owned', source: 'orders' },
  { id: 'features', title: 'Enabled features', source: 'platform' },
  { id: 'workspace', title: 'Workspace configuration', source: 'explicit+inferred_safe' },
  { id: 'interactions', title: 'Interaction history', source: 'events' },
  { id: 'language', title: 'Preferred language', source: 'explicit|accept_language' },
  { id: 'communication', title: 'Communication preferences', source: 'explicit' },
  { id: 'automation', title: 'Automation preferences', source: 'explicit+usage' },
  { id: 'usage', title: 'Usage patterns', source: 'events' },
  { id: 'feedback', title: 'Feedback provided', source: 'explicit' },
  { id: 'settings', title: 'Explicit user settings', source: 'explicit' },
];

/** Ecosystem bond targets. */
const ECOSYSTEM_BONDS = [
  'vault', 'workspace', 'concierge', 'delivery', 'memory',
  'knowledge', 'genome', 'marketplace', 'workflow', 'omega',
];

function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/dna';
  try { if (fs.existsSync('/var/www/unicorn/shared')) return shared; } catch (_) { /* ignore */ }
  return path.join(__dirname, '..', '..', 'data', 'dna');
}

const DATA_DIR = process.env.ZEUS_DNA_DIR || _defaultDataDir();
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DNA_FILE = path.join(DATA_DIR, 'strands.json');
const AUDIT = path.join(DATA_DIR, 'audit.jsonl');
const MIGRATIONS_FILE = path.join(DATA_DIR, 'migrations.json');

let _started = false;
let _timer = null;

const state = {
  startedAt: null,
  strandsBorn: 0,
  observations: 0,
  personalizations: 0,
  learnings: 0,
  settingsUpdates: 0,
  cacheHits: 0,
  cacheMisses: 0,
  migrationsPlanned: 0,
  errors: 0,
  lastLearnAt: null,
};

/** @type {Record<string, object>} customerKey → dna strand */
let strands = {};
/** @type {Array<object>} */
let migrations = [];
/** TTL cache: key → { at, value } */
const _cache = new Map();

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _load() {
  try {
    if (fs.existsSync(STATE_FILE)) Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch (_) { /* ignore */ }
  try {
    if (fs.existsSync(DNA_FILE)) strands = JSON.parse(fs.readFileSync(DNA_FILE, 'utf8')) || {};
  } catch (_) { strands = {}; }
  try {
    if (fs.existsSync(MIGRATIONS_FILE)) migrations = JSON.parse(fs.readFileSync(MIGRATIONS_FILE, 'utf8')) || [];
  } catch (_) { migrations = []; }
  if (!strands || typeof strands !== 'object') strands = {};
  if (!Array.isArray(migrations)) migrations = [];
}

function _save() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(DNA_FILE, JSON.stringify(strands, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(MIGRATIONS_FILE, JSON.stringify(migrations.slice(-40), null, 2));
  } catch (_) { /* ignore */ }
}

function _audit(obj) {
  _ensureDir();
  try { fs.appendFileSync(AUDIT, `${JSON.stringify({ ts: new Date().toISOString(), ...obj })}\n`); } catch (_) { /* ignore */ }
}

function _id(prefix, seed) {
  return `${prefix}_` + crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 18);
}

function _normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function _maskEmail(email) {
  const e = _normEmail(email);
  if (!e || e.indexOf('@') < 0) return null;
  const [user, domain] = e.split('@');
  return `${user.slice(0, Math.min(2, user.length))}…@${domain}`;
}

function _customerKey(email) {
  const e = _normEmail(email);
  if (!e) return null;
  return _id('dna', e);
}

/**
 * Word-boundary aware forbidden-key test. Plain substring matching would drop
 * innocent keys that merely contain a trait name ("language" contains "age",
 * "usage" contains "age"), so keys are normalised to underscore tokens first.
 */
function _isForbiddenKey(k) {
  const norm = String(k || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_');
  if (!norm) return false;
  return FORBIDDEN_TRAITS.some((f) => norm === f
    || norm.startsWith(`${f}_`)
    || norm.endsWith(`_${f}`)
    || norm.includes(`_${f}_`));
}

function _stripForbidden(obj) {
  if (!obj || typeof obj !== 'object') return {};
  if (Array.isArray(obj)) {
    return obj.map((v) => (v && typeof v === 'object' ? _stripForbidden(v) : v));
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (_isForbiddenKey(k)) continue;
    if (v && typeof v === 'object') out[k] = _stripForbidden(v);
    else out[k] = v;
  }
  return out;
}

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) { state.cacheMisses += 1; return null; }
  if (Date.now() - hit.at > CACHE_TTL_MS) { _cache.delete(key); state.cacheMisses += 1; return null; }
  state.cacheHits += 1;
  return hit.value;
}

function _cacheSet(key, value, owner) {
  _cache.set(key, { at: Date.now(), value, owner: owner || null });
}

/**
 * Drop every cached view of a strand. Entries are keyed by whatever lookup
 * string the caller used (raw email as well as strand id) and personalization
 * keys carry an intent/sku suffix, so exact-key deletes alone leave stale reads.
 */
function _cacheBump(customerKey) {
  const key = String(customerKey || '');
  if (!key) return;
  for (const [k, hit] of _cache) {
    if (hit && hit.owner === key) { _cache.delete(k); continue; }
    if (k === `dna:${key}` || k === `pers:${key}` || k.startsWith(`pers:${key}:`)) _cache.delete(k);
  }
}

function _emptyStrand(customerKey, email) {
  const now = new Date().toISOString();
  return {
    id: customerKey,
    protocol: PROTOCOL,
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    emailMasked: _maskEmail(email),
    living: true,
    createdAt: now,
    updatedAt: now,
    // Non-sensitive continuum model
    profile: {
      kind: 'adaptive_intelligence',
      notUserProfile: true,
      principle: PRINCIPLE,
    },
    products: [], // { sku, title, genomeId?, omegaInstanceId?, acquiredAt }
    productRelationships: [],
    workspace: { theme: null, density: null, defaultView: null, explicit: {} },
    notifications: { email: null, telegram: null, frequency: null, explicit: false },
    aiInteraction: { tone: null, verbosity: null, language: null, explicit: {} },
    automation: { aggressiveness: 'balanced', allowAutoApplySafe: true, explicit: {} },
    features: { enabled: [], adopted: {}, unusedHints: [] },
    learning: { progress: {}, friction: [], suggestions: [], history: [] },
    knowledgeLinks: [],
    ecosystem: ECOSYSTEM_BONDS.reduce((acc, k) => { acc[k] = { linked: false, href: null }; return acc; }, {}),
    interactions: [], // capped ring buffer
    feedback: [],
    settings: {}, // explicit only
    adapters: TRAIT_ADAPTERS.map((a) => a.id),
    hash: null,
  };
}

function _bondEcosystem(strand, sku, extras) {
  const now = new Date().toISOString();
  const x = extras || {};
  strand.ecosystem.omega = {
    linked: true,
    href: `${SITE}/omega`,
    lastAt: now,
  };
  strand.ecosystem.genome = {
    linked: true,
    href: x.genomeId ? `${SITE}/genome/${encodeURIComponent(x.genomeId)}` : `${SITE}/genome`,
    genomeId: x.genomeId || null,
    lastAt: now,
  };
  strand.ecosystem.vault = {
    linked: true,
    href: strand.emailMasked ? `${SITE}/omega/vault` : `${SITE}/omega`,
    lastAt: now,
  };
  strand.ecosystem.workspace = { linked: true, href: `${SITE}/omega`, sku, lastAt: now };
  strand.ecosystem.concierge = { linked: true, href: `${SITE}/api/concierge`, lastAt: now };
  strand.ecosystem.delivery = { linked: true, href: `${SITE}/api/delivery`, lastAt: now };
  strand.ecosystem.memory = { linked: true, href: null, lastAt: now };
  strand.ecosystem.knowledge = { linked: true, href: `${SITE}/genome`, lastAt: now };
  strand.ecosystem.marketplace = { linked: true, href: `${SITE}/services`, lastAt: now };
  strand.ecosystem.workflow = { linked: true, href: null, lastAt: now };

  if (x.genomeId) {
    strand.knowledgeLinks.push({
      at: now, kind: 'genome', genomeId: x.genomeId, sku,
    });
  }
  if (x.omegaInstanceId) {
    strand.knowledgeLinks.push({
      at: now, kind: 'omega_instance', instanceId: x.omegaInstanceId, sku,
    });
  }
  // Cap knowledge links
  strand.knowledgeLinks = (strand.knowledgeLinks || []).slice(-80);
}

function _rehash(strand) {
  strand.hash = crypto.createHash('sha256').update(JSON.stringify({
    id: strand.id,
    products: strand.products,
    settings: strand.settings,
    schemaVersion: strand.schemaVersion,
    updatedAt: strand.updatedAt,
  })).digest('hex').slice(0, 24);
}

function _publicStrand(strand) {
  if (!strand) return null;
  return {
    id: strand.id,
    protocol: strand.protocol,
    version: strand.version,
    schemaVersion: strand.schemaVersion,
    emailMasked: strand.emailMasked,
    living: strand.living,
    productCount: (strand.products || []).length,
    products: (strand.products || []).map((p) => ({
      sku: p.sku, title: p.title, acquiredAt: p.acquiredAt, genomeId: p.genomeId || null,
    })),
    language: (strand.aiInteraction && strand.aiInteraction.language)
      || (strand.settings && strand.settings.language) || null,
    automation: {
      aggressiveness: strand.automation && strand.automation.aggressiveness,
      allowAutoApplySafe: strand.automation && strand.automation.allowAutoApplySafe,
    },
    notifications: {
      frequency: strand.notifications && strand.notifications.frequency,
      email: strand.notifications && strand.notifications.email,
      explicit: !!(strand.notifications && strand.notifications.explicit),
    },
    featureAdoption: strand.features && strand.features.adopted,
    unusedHints: (strand.features && strand.features.unusedHints) || [],
    suggestions: (strand.learning && strand.learning.suggestions || []).slice(-10),
    ecosystem: strand.ecosystem,
    adapters: strand.adapters,
    createdAt: strand.createdAt,
    updatedAt: strand.updatedAt,
    hash: strand.hash,
    href: `${SITE}/dna/${encodeURIComponent(strand.id)}`,
    principle: PRINCIPLE,
  };
}

function ensureDna(emailOrKey) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const email = _normEmail(emailOrKey);
  const key = email.includes('@') ? _customerKey(email) : String(emailOrKey || '');
  if (!key || !String(key).startsWith('dna_')) {
    // allow passing dna_ key directly
    if (strands[key]) return { ok: true, dna: _publicStrand(strands[key]), strand: strands[key] };
    if (!email) return { ok: false, reason: 'email_required' };
  }
  const customerKey = key.startsWith('dna_') ? key : _customerKey(email);
  if (!customerKey) return { ok: false, reason: 'email_required' };

  if (!strands[customerKey]) {
    strands[customerKey] = _emptyStrand(customerKey, email);
    state.strandsBorn += 1;
    _rehash(strands[customerKey]);
    _audit({ type: 'strand_born', id: customerKey });
    _save();
  }
  return { ok: true, dna: _publicStrand(strands[customerKey]), strand: strands[customerKey] };
}

/**
 * Event-driven update — observe platform signals.
 * event: { email|customerKey, type, sku?, feature?, language?, feedback?, meta? }
 */
function observeEvent(event) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const e = event && typeof event === 'object' ? event : {};
    const ensured = ensureDna(e.email || e.customerKey);
    if (!ensured.ok) return ensured;
    const strand = ensured.strand;
    const now = new Date().toISOString();
    const type = String(e.type || 'signal').slice(0, 64);

    strand.interactions.push({
      at: now,
      type,
      sku: e.sku || null,
      feature: e.feature || null,
    });
    strand.interactions = strand.interactions.slice(-120);

    if (e.language && typeof e.language === 'string') {
      // Safe: language from Accept-Language or explicit setting
      if (!strand.aiInteraction.language || e.explicit) {
        strand.aiInteraction.language = String(e.language).slice(0, 16).toLowerCase();
      }
    }

    if (e.feature) {
      const f = String(e.feature).slice(0, 80);
      strand.features.adopted[f] = (strand.features.adopted[f] || 0) + 1;
      if (!strand.features.enabled.includes(f)) strand.features.enabled.push(f);
      strand.features.enabled = strand.features.enabled.slice(-60);
    }

    if (e.feedback && typeof e.feedback === 'object') {
      const fb = _stripForbidden(e.feedback);
      strand.feedback.push({ at: now, ...fb });
      strand.feedback = strand.feedback.slice(-40);
    }

    if (e.sku && type === 'product_view') {
      strand.learning.history.push({ at: now, event: 'product_view', sku: e.sku });
    }

    strand.updatedAt = now;
    state.observations += 1;
    _rehash(strand);
    _cacheBump(strand.id);
    _audit({ type: 'observe', id: strand.id, eventType: type });
    _save();
    return { ok: true, dna: _publicStrand(strand) };
  } catch (err) {
    state.errors += 1;
    return { ok: false, error: String(err && err.message || err).slice(0, 160) };
  }
}

/** Explicit settings only — never merge forbidden traits. */
function updateSettings(email, settings) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const ensured = ensureDna(email);
    if (!ensured.ok) return ensured;
    const strand = ensured.strand;
    const clean = _stripForbidden(settings || {});
    strand.settings = { ...strand.settings, ...clean };
    if (clean.language) {
      strand.aiInteraction.language = String(clean.language).slice(0, 16).toLowerCase();
      strand.aiInteraction.explicit.language = true;
    }
    if (clean.tone) {
      strand.aiInteraction.tone = String(clean.tone).slice(0, 32);
      strand.aiInteraction.explicit.tone = true;
    }
    if (clean.verbosity) {
      strand.aiInteraction.verbosity = String(clean.verbosity).slice(0, 32);
      strand.aiInteraction.explicit.verbosity = true;
    }
    if (clean.notificationFrequency) {
      strand.notifications.frequency = String(clean.notificationFrequency).slice(0, 32);
      strand.notifications.explicit = true;
    }
    if (clean.emailNotifications != null) {
      strand.notifications.email = !!clean.emailNotifications;
      strand.notifications.explicit = true;
    }
    if (clean.automationAggressiveness) {
      strand.automation.aggressiveness = String(clean.automationAggressiveness).slice(0, 32);
      strand.automation.explicit.aggressiveness = true;
    }
    if (clean.allowAutoApplySafe != null) {
      strand.automation.allowAutoApplySafe = !!clean.allowAutoApplySafe;
    }
    if (clean.workspace && typeof clean.workspace === 'object') {
      strand.workspace.explicit = { ...strand.workspace.explicit, ..._stripForbidden(clean.workspace) };
      if (clean.workspace.theme) strand.workspace.theme = String(clean.workspace.theme).slice(0, 32);
      if (clean.workspace.density) strand.workspace.density = String(clean.workspace.density).slice(0, 32);
      if (clean.workspace.defaultView) strand.workspace.defaultView = String(clean.workspace.defaultView).slice(0, 48);
    }
    strand.updatedAt = new Date().toISOString();
    state.settingsUpdates += 1;
    _rehash(strand);
    _cacheBump(strand.id);
    _audit({ type: 'settings', id: strand.id, keys: Object.keys(clean) });
    _save();
    return { ok: true, dna: _publicStrand(strand) };
  } catch (err) {
    state.errors += 1;
    return { ok: false, error: String(err && err.message || err).slice(0, 160) };
  }
}

function onOrderPaid(order) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const o = order && typeof order === 'object' ? order : {};
    const email = _normEmail(
      (o.buyer && o.buyer.email) || o.email || o.customerEmail || ''
    );
    if (!email) return { ok: false, reason: 'email_required' };
    const ensured = ensureDna(email);
    if (!ensured.ok) return ensured;
    const strand = ensured.strand;
    const sku = String(o.serviceId || o.sku || o.plan || 'unknown').trim();
    const title = o.serviceName || o.title || sku;
    const now = new Date().toISOString();

    // Link Genome / Omega if already computed upstream (post-pay result) or look up
    let genomeId = (o.genome && (o.genome.genomeId || (o.genome.genome && o.genome.genome.id))) || null;
    let omegaInstanceId = (o.omega && (o.omega.instanceId || (o.omega.instance && o.omega.instance.id))) || null;
    try {
      if (!genomeId) {
        const g = require('./ai-genome-engine');
        const got = g.getGenome && g.getGenome(sku);
        if (got && got.ok && got.genome) genomeId = got.genome.id;
      }
    } catch (_) { /* optional */ }

    let product = strand.products.find((p) => p.sku === sku);
    if (!product) {
      product = {
        sku, title, genomeId, omegaInstanceId,
        acquiredAt: now, orderId: o.orderId || o.id || null,
      };
      strand.products.push(product);
    } else {
      product.title = title || product.title;
      product.genomeId = genomeId || product.genomeId;
      product.omegaInstanceId = omegaInstanceId || product.omegaInstanceId;
      product.lastOrderId = o.orderId || o.id || null;
      product.updatedAt = now;
    }

    strand.productRelationships.push({
      at: now, sku, kind: 'owns', genomeId, omegaInstanceId,
    });
    strand.productRelationships = strand.productRelationships.slice(-100);

    // Feature adoption seed from purchase
    strand.features.enabled.push(`owned:${sku}`);
    strand.features.adopted[`owned:${sku}`] = (strand.features.adopted[`owned:${sku}`] || 0) + 1;

    _bondEcosystem(strand, sku, { genomeId, omegaInstanceId });

    strand.learning.history.push({
      at: now, event: 'purchase', sku, note: 'Product joined AI DNA model',
    });
    strand.learning.history = strand.learning.history.slice(-80);

    // Language from order locale if explicit
    if (o.locale || o.lang) {
      strand.aiInteraction.language = String(o.locale || o.lang).slice(0, 16).toLowerCase();
    }

    strand.updatedAt = now;
    _rehash(strand);
    _cacheBump(strand.id);
    _audit({ type: 'order_paid', id: strand.id, sku, orderId: o.orderId || o.id || null });
    _save();

    // Continuous learning pass
    learnOnce(strand.id);

    return {
      ok: true,
      dnaId: strand.id,
      dna: _publicStrand(strand),
      personalization: personalize({ email, intent: 'post_purchase', sku }),
    };
  } catch (err) {
    state.errors += 1;
    return { ok: false, error: String(err && err.message || err).slice(0, 160) };
  }
}

/**
 * Continuous learning — used vs unused, friction, onboarding improvements.
 * Honest suggestions only.
 */
function learnOnce(customerKey) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const keys = customerKey
      ? [customerKey]
      : Object.keys(strands).slice(0, 40);
    let learned = 0;
    const now = new Date().toISOString();

    for (const key of keys) {
      const strand = strands[key];
      if (!strand) continue;
      const suggestions = [];
      const owned = strand.products || [];
      const adopted = strand.features.adopted || {};

      // Unused owned products → gentle adoption nudge
      for (const p of owned) {
        const uses = adopted[`owned:${p.sku}`] || 0;
        const views = strand.interactions.filter((i) => i.sku === p.sku).length;
        if (uses <= 1 && views < 2) {
          suggestions.push({
            at: now,
            kind: 'feature_adoption',
            sku: p.sku,
            message: `You own ${p.title || p.sku} — open Concierge or Workspace to activate value.`,
            href: `${SITE}/omega`,
          });
          strand.features.unusedHints = Array.from(new Set([
            ...(strand.features.unusedHints || []),
            p.sku,
          ])).slice(-20);
        }
      }

      // Friction: many views without settings
      if ((strand.interactions || []).length >= 8 && !strand.notifications.explicit) {
        suggestions.push({
          at: now,
          kind: 'onboarding',
          message: 'Set notification preferences so AI DNA can pace updates to your taste.',
          href: `${SITE}/dna`,
        });
        strand.learning.friction.push({ at: now, signal: 'missing_notification_prefs' });
      }

      // Language unset
      if (!strand.aiInteraction.language) {
        suggestions.push({
          at: now,
          kind: 'ai_preference',
          message: 'Tell AI DNA your preferred language for clearer Concierge replies.',
        });
      }

      // Automation preference
      if (!strand.automation.explicit || !strand.automation.explicit.aggressiveness) {
        suggestions.push({
          at: now,
          kind: 'automation',
          message: 'Choose automation aggressiveness (gentle / balanced / assertive) for safer auto-workflows.',
        });
      }

      // Cross-product workflow suggestion from Genome relationships (safe)
      if (owned.length >= 2) {
        suggestions.push({
          at: now,
          kind: 'workflow',
          message: 'Multiple products detected — Genome can propose a cross-product workflow when safe.',
          href: `${SITE}/genome`,
        });
      }

      strand.learning.suggestions = suggestions.slice(-15);
      strand.learning.progress = {
        productsOwned: owned.length,
        interactions: (strand.interactions || []).length,
        explicitSettings: Object.keys(strand.settings || {}).length,
        suggestionCount: suggestions.length,
        at: now,
      };
      strand.learning.friction = (strand.learning.friction || []).slice(-30);
      strand.updatedAt = now;
      _rehash(strand);
      _cacheBump(strand.id);
      learned += 1;
    }

    state.learnings += learned;
    state.lastLearnAt = now;
    if (learned) _save();
    return { ok: true, learned };
  } catch (err) {
    state.errors += 1;
    return { ok: false, error: String(err && err.message || err).slice(0, 160) };
  }
}

/**
 * Personalization surface — adapts onboarding, recommendations, AI responses,
 * tutorials, docs, workflow/automation/product suggestions.
 */
function personalize(context) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const ctx = context && typeof context === 'object' ? context : {};
    const ensured = ensureDna(ctx.email || ctx.customerKey);
    if (!ensured.ok) return ensured;

    const cacheKey = `pers:${ensured.strand.id}:${ctx.intent || 'default'}:${ctx.sku || ''}`;
    const cached = _cacheGet(cacheKey);
    if (cached) return { ok: true, cached: true, ...cached };

    const strand = ensured.strand;
    const lang = strand.aiInteraction.language || ctx.language || 'en';
    const tone = strand.aiInteraction.tone || 'helpful_clear';
    const verbosity = strand.aiInteraction.verbosity || 'concise';
    const intent = String(ctx.intent || 'general');

    const adaptations = {
      onboarding: {
        skipBasics: (strand.products || []).length > 0,
        highlight: (strand.features.unusedHints || [])[0] || null,
        language: lang,
      },
      recommendations: (strand.learning.suggestions || [])
        .filter((s) => s.kind === 'feature_adoption' || s.kind === 'workflow')
        .slice(0, 5),
      aiResponseStyle: { language: lang, tone, verbosity },
      tutorials: (strand.features.unusedHints || []).slice(0, 3).map((sku) => ({
        sku,
        title: `Activate ${sku}`,
        href: `${SITE}/omega`,
      })),
      documentation: {
        preferShort: verbosity === 'concise',
        language: lang,
        deepLinks: (strand.knowledgeLinks || []).slice(-5),
      },
      workflowSuggestions: (strand.learning.suggestions || []).filter((s) => s.kind === 'workflow'),
      automationSuggestions: [{
        aggressiveness: strand.automation.aggressiveness,
        allowAutoApplySafe: strand.automation.allowAutoApplySafe,
        tip: strand.automation.allowAutoApplySafe
          ? 'Safe automations may apply without asking.'
          : 'Automations will propose only — you confirm.',
      }],
      productSuggestions: (strand.products || []).length
        ? [{ kind: 'complement', note: 'See Genome graph for compatible products', href: `${SITE}/genome` }]
        : [{ kind: 'first_product', note: 'Browse catalog to grow your AI DNA', href: `${SITE}/services` }],
    };

    // Intent-specific overlays
    if (intent === 'post_purchase' && ctx.sku) {
      adaptations.onboarding.welcome = `Your ${ctx.sku} is already in Omega + Genome + AI DNA.`;
      adaptations.tutorials.unshift({
        sku: ctx.sku,
        title: `First steps with ${ctx.sku}`,
        href: `${SITE}/omega`,
      });
    }

    const payload = {
      protocol: PROTOCOL,
      dnaId: strand.id,
      intent,
      adaptations,
      principle: PRINCIPLE,
      generatedAt: new Date().toISOString(),
    };
    state.personalizations += 1;
    _cacheSet(cacheKey, payload, strand.id);
    return { ok: true, cached: false, ...payload };
  } catch (err) {
    state.errors += 1;
    return { ok: false, error: String(err && err.message || err).slice(0, 160) };
  }
}

function getDna(emailOrId, opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const options = opts || {};
  const keyGuess = String(emailOrId || '').trim();
  if (!keyGuess) return { ok: false, reason: 'email_required' };
  const cacheKey = `dna:${keyGuess}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return { ok: true, cached: true, dna: cached };

  const normalized = _normEmail(keyGuess);
  const customerKey = keyGuess.startsWith('dna_')
    ? keyGuess
    : (normalized.includes('@') ? _customerKey(normalized) : null);
  if (customerKey && strands[customerKey]) {
    const pub = _publicStrand(strands[customerKey]);
    _cacheSet(`dna:${customerKey}`, pub, customerKey);
    _cacheSet(cacheKey, pub, customerKey);
    return {
      ok: true,
      cached: false,
      dna: pub,
      learning: strands[customerKey].learning,
      settingsKeys: Object.keys(strands[customerKey].settings || {}),
    };
  }
  if (options.create === false) return { ok: false, reason: 'not_found' };

  const ensured = ensureDna(emailOrId);
  if (!ensured.ok) return ensured;
  const pub = _publicStrand(ensured.strand);
  _cacheSet(`dna:${ensured.strand.id}`, pub, ensured.strand.id);
  if (ensured.strand.emailMasked) _cacheSet(cacheKey, pub, ensured.strand.id);
  return {
    ok: true,
    cached: false,
    dna: pub,
    learning: ensured.strand.learning,
    settingsKeys: Object.keys(ensured.strand.settings || {}),
  };
}

function searchDna(q) {
  const needle = String(q || '').toLowerCase().trim();
  const hits = Object.values(strands).filter((s) => {
    if (!needle) return true;
    const skus = (s.products || []).map((p) => p.sku).join(' ');
    const blob = `${s.id} ${s.emailMasked || ''} ${skus}`.toLowerCase();
    return blob.includes(needle);
  }).slice(0, 40);
  return { ok: true, query: needle, count: hits.length, strands: hits.map(_publicStrand) };
}

/** Future Mode — propose better personalization strategy without breaking data. */
function proposePersonalizationMigration(opts) {
  const o = opts || {};
  const plan = {
    id: _id('dna_mig', `${Date.now()}:${o.target || 'next'}`),
    at: new Date().toISOString(),
    fromSchema: SCHEMA_VERSION,
    to: o.target || 'dna_helix_v2',
    preserveCustomerData: true,
    minimizeDowntime: true,
    steps: [
      { step: 'snapshot_strands', safe: true },
      { step: 'dual_write_adapters', safe: true },
      { step: 'parity_check_personalize', safe: true },
      { step: 'cutover_read', safe: true, requiresApproval: true },
      { step: 'retire_legacy_traits', safe: true, requiresApproval: true },
    ],
    status: 'planned',
    applied: false,
    note: 'Never break existing customer DNA — migrate adapters, not identities.',
  };
  migrations.push(plan);
  state.migrationsPlanned += 1;
  _audit({ type: 'migration_planned', id: plan.id });
  _save();
  return { ok: true, plan };
}

/** Register a future trait adapter at runtime (extensibility). */
function registerAdapter(adapter) {
  if (!adapter || !adapter.id) return { ok: false, reason: 'invalid_adapter' };
  const id = String(adapter.id).slice(0, 64);
  if (!TRAIT_ADAPTERS.some((a) => a.id === id)) {
    TRAIT_ADAPTERS.push({
      id,
      title: String(adapter.title || id).slice(0, 80),
      source: String(adapter.source || 'extension').slice(0, 64),
    });
  }
  // Attach to all strands' adapter lists
  for (const s of Object.values(strands)) {
    if (!s.adapters.includes(id)) s.adapters.push(id);
  }
  _audit({ type: 'adapter_registered', id });
  _save();
  return { ok: true, adapters: TRAIT_ADAPTERS.map((a) => a.id) };
}

function discovery() {
  return {
    protocol: PROTOCOL,
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    name: 'AI DNA Engine',
    design: DESIGN,
    principle: PRINCIPLE,
    purpose: 'Adaptive intelligence layer — personalizes ZeusAI interactions without invasive profiling.',
    notAUserProfile: true,
    forbiddenTraits: FORBIDDEN_TRAITS.slice(),
    adapters: TRAIT_ADAPTERS.slice(),
    ecosystemBonds: ECOSYSTEM_BONDS.slice(),
    inventions: [
      'Trait Adapter Genome',
      'Event Helix observations',
      'Forbidden-trait hard guard',
      'TTL personalization cache',
      'Ecosystem bond mesh (Omega·Genome·Vault·…)',
      'Future Mode personalization migrations',
    ],
    endpoints: {
      status: '/api/dna/status',
      discovery: '/api/dna/discovery',
      dna: '/api/dna/strand?email=',
      personalize: '/api/dna/personalize',
      observe: '/api/dna/observe',
      settings: '/api/dna/settings',
      search: '/api/dna/search',
      learn: '/api/dna/learn',
      migrate: '/api/dna/migrate',
      wellKnown: '/.well-known/dna.json',
      human: '/dna',
    },
  };
}

function getStatus() {
  return {
    ok: true,
    module: NAME,
    protocol: PROTOCOL,
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    design: DESIGN,
    principle: PRINCIPLE,
    invention: 'AI DNA — adaptive personalization intelligence',
    notAUserProfile: true,
    started: _started || !!state.startedAt,
    startedAt: state.startedAt,
    disabled: DISABLED,
    adapterCount: TRAIT_ADAPTERS.length,
    adapters: TRAIT_ADAPTERS.map((a) => a.id),
    forbiddenTraitGuard: FORBIDDEN_TRAITS.length,
    counts: {
      strandsBorn: state.strandsBorn,
      strandsLive: Object.keys(strands).length,
      observations: state.observations,
      personalizations: state.personalizations,
      learnings: state.learnings,
      settingsUpdates: state.settingsUpdates,
      cacheHits: state.cacheHits,
      cacheMisses: state.cacheMisses,
      migrationsPlanned: state.migrationsPlanned,
      errors: state.errors,
    },
    lastLearnAt: state.lastLearnAt,
    cacheTtlMs: CACHE_TTL_MS,
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
  const tickMs = Math.max(60_000, Number(process.env.ZEUS_DNA_TICK_MS) || 2 * 60 * 60_000);
  if (_timer) clearInterval(_timer);
  if (process.env.NODE_ENV !== 'test') {
    _timer = setInterval(() => { try { learnOnce(); } catch (_) { /* ignore */ } }, tickMs);
    if (_timer.unref) _timer.unref();
  }
  _save();
  return { ok: true, module: NAME, protocol: PROTOCOL, version: VERSION, tickMs };
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
  if (action === 'ensure') return ensureDna(input.email || input.customerKey);
  if (action === 'observe') return observeEvent(input.event || input);
  if (action === 'settings') return updateSettings(input.email, input.settings || input);
  if (action === 'paid') return onOrderPaid(input.order || input);
  if (action === 'personalize') return personalize(input);
  if (action === 'learn') return learnOnce(input.customerKey || input.id);
  if (action === 'dna') return getDna(input.email || input.id);
  if (action === 'search') return searchDna(input.q);
  if (action === 'migrate') return proposePersonalizationMigration(input);
  if (action === 'register_adapter') return registerAdapter(input.adapter || input);
  if (action === 'discovery') return discovery();
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stop();
  strands = {};
  migrations = [];
  _cache.clear();
  Object.assign(state, {
    startedAt: null, strandsBorn: 0, observations: 0, personalizations: 0,
    learnings: 0, settingsUpdates: 0, cacheHits: 0, cacheMisses: 0,
    migrationsPlanned: 0, errors: 0, lastLearnAt: null,
  });
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

_load();

module.exports = {
  name: NAME,
  NAME,
  PROTOCOL,
  VERSION,
  SCHEMA_VERSION,
  PRINCIPLE,
  DESIGN,
  FORBIDDEN_TRAITS,
  TRAIT_ADAPTERS,
  ECOSYSTEM_BONDS,
  ensureDna,
  observeEvent,
  updateSettings,
  onOrderPaid,
  personalize,
  learnOnce,
  getDna,
  searchDna,
  proposePersonalizationMigration,
  registerAdapter,
  discovery,
  getStatus,
  start,
  stop,
  process: processInput,
  _resetForTests,
  _stripForbidden,
};
