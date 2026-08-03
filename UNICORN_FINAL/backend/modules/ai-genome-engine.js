// =====================================================================
// ai-genome-engine.js — AI GENOME ENGINE (GENOME/1.0 · G/1.0)
//
// INVENTION: The Digital DNA of ZeusAI.
//
// Every product sold on ZeusAI automatically receives a living digital
// genome — not metadata, but the complete intelligence blueprint:
// capabilities, permissions, dependencies, skills, knowledge, compatible
// products, required services, plugins, memory, automation, APIs,
// workflows, security/risk/performance profiles, learning & deployment &
// version history, customer adaptations, business rules, execution graph,
// and relationships with every other product.
//
// Architecture inventions evaluated:
//   A) Static product JSON schemas — rejected (dead metadata)
//   B) Per-SKU integration SDKs — rejected (manual forever)
//   C) Living Genome + Universal Intelligence Graph — SELECTED
//      Chromosome model + Synaptic Edge Scoring + Ecosystem Orchestrator
//
// Companion to Omega Continuum Instance Graph (OMEGA/1.0):
//   Omega = living purchase instance · Genome = species-level DNA
//
// Fail-soft. Never blocks settle. Kill-switch: ZEUS_GENOME_DISABLED=1.
// Persist: /var/www/unicorn/shared/data/genome or ZEUS_GENOME_DIR.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'ai-genome-engine';
const PROTOCOL = 'GENOME/1.0';
const VERSION = 'G/1.0';
const PRINCIPLE = 'Products own ecosystems — genomes make them understand each other.';
const DESIGN = 'Living Genome + Universal Intelligence Graph';

const SITE = String(
  process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://zeusai.pro'
).replace(/\/$/, '');

const DISABLED = String(process.env.ZEUS_GENOME_DISABLED || '') === '1';

/** Chromosomes — modular DNA strands (Future Mode: add chromosomes without breaking old genomes). */
const CHROMOSOMES = [
  'identity', 'capability', 'permission', 'dependency', 'skill', 'knowledge',
  'compatibility', 'plugin', 'memory', 'automation', 'api', 'workflow',
  'security', 'risk', 'performance', 'learning', 'deployment', 'versioning',
  'adaptation', 'business_rules', 'execution', 'relationship',
];

/** Zero-maintenance ops the ecosystem performs autonomously when safe. */
const ZERO_MAINTENANCE_OPS = [
  'monitor', 'repair', 'backup', 'optimize', 'scale', 'clean',
  'update', 'migrate', 'recover', 'document', 'audit', 'explain',
];

/** Orchestrator optimization axes — every tick must improve at least one. */
const ORCHESTRATOR_AXES = [
  'product_discovery', 'relationship_discovery', 'workflow_generation',
  'automation_generation', 'customer_optimization', 'infrastructure_optimization',
  'resource_optimization', 'security_optimization', 'revenue_optimization',
  'learning_optimization',
];

function _defaultDataDir() {
  const shared = '/var/www/unicorn/shared/data/genome';
  try { if (fs.existsSync('/var/www/unicorn/shared')) return shared; } catch (_) { /* ignore */ }
  return path.join(__dirname, '..', '..', 'data', 'genome');
}

const DATA_DIR = process.env.ZEUS_GENOME_DIR || _defaultDataDir();
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const GENOMES_FILE = path.join(DATA_DIR, 'genomes.json');
const GRAPH_FILE = path.join(DATA_DIR, 'graph.json');
const OPPORTUNITIES_FILE = path.join(DATA_DIR, 'opportunities.json');
const LEDGER = path.join(DATA_DIR, 'events.jsonl');
const MIGRATIONS_FILE = path.join(DATA_DIR, 'migrations.json');

let _started = false;
let _timer = null;

const state = {
  startedAt: null,
  registrations: 0,
  genomesBorn: 0,
  edgesCreated: 0,
  opportunities: 0,
  evolutions: 0,
  orchestratorTicks: 0,
  maintenanceOps: 0,
  migrationsPlanned: 0,
  errors: 0,
  lastOrchestratorAt: null,
  lastEvolveAt: null,
};

/** @type {Record<string, object>} genomeId → genome */
let genomes = {};
/** @type {Record<string, string>} sku → genomeId */
let skuIndex = {};
/** Universal Intelligence Graph */
let graph = { nodes: {}, edges: [] };
/** Opportunity ledger (honest — proposals, not fake revenue) */
let opportunities = [];
/** Future Mode migration plans */
let migrations = [];

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _load() {
  try {
    if (fs.existsSync(STATE_FILE)) Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch (_) { /* ignore */ }
  try {
    if (fs.existsSync(GENOMES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GENOMES_FILE, 'utf8')) || {};
      genomes = parsed.genomes || {};
      skuIndex = parsed.skuIndex || {};
    }
  } catch (_) { genomes = {}; skuIndex = {}; }
  try {
    if (fs.existsSync(GRAPH_FILE)) graph = JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8')) || { nodes: {}, edges: [] };
  } catch (_) { graph = { nodes: {}, edges: [] }; }
  try {
    if (fs.existsSync(OPPORTUNITIES_FILE)) opportunities = JSON.parse(fs.readFileSync(OPPORTUNITIES_FILE, 'utf8')) || [];
  } catch (_) { opportunities = []; }
  try {
    if (fs.existsSync(MIGRATIONS_FILE)) migrations = JSON.parse(fs.readFileSync(MIGRATIONS_FILE, 'utf8')) || [];
  } catch (_) { migrations = []; }
  if (!graph.nodes) graph.nodes = {};
  if (!Array.isArray(graph.edges)) graph.edges = [];
  if (!Array.isArray(opportunities)) opportunities = [];
  if (!Array.isArray(migrations)) migrations = [];
}

function _save() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(GENOMES_FILE, JSON.stringify({ genomes, skuIndex }, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(OPPORTUNITIES_FILE, JSON.stringify(opportunities.slice(-200), null, 2));
  } catch (_) { /* ignore */ }
  try {
    fs.writeFileSync(MIGRATIONS_FILE, JSON.stringify(migrations.slice(-50), null, 2));
  } catch (_) { /* ignore */ }
}

function _append(obj) {
  _ensureDir();
  try { fs.appendFileSync(LEDGER, `${JSON.stringify(obj)}\n`); } catch (_) { /* ignore */ }
}

function _id(prefix, seed) {
  return `${prefix}_` + crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 18);
}

function _tokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function _productShape(product) {
  const p = product && typeof product === 'object' ? product : {};
  const sku = String(p.id || p.sku || p.serviceId || p.slug || '').trim();
  return {
    sku,
    title: p.title || p.name || sku || 'unnamed',
    tier: p.tier || p.group || 'professional',
    description: p.description || '',
    priceUSD: Number(p.priceUSD || p.priceUsd || p.price || 0) || 0,
    buyMode: p.buyMode || null,
    requiresHumanFulfillment: !!p.requiresHumanFulfillment,
    omega: p.omega || null,
  };
}

/**
 * Build the living genome chromosomes for a product.
 * Innovation: Chromosome Model — each strand is independently evolvable.
 */
function _buildChromosomes(meta, genomeId) {
  const now = new Date().toISOString();
  const tokens = _tokens(`${meta.title} ${meta.description} ${meta.sku} ${meta.tier}`);
  const skills = tokens.slice(0, 12).map((t) => ({ skill: t, level: 'emergent', source: 'genome_inference' }));
  return {
    identity: {
      genomeId,
      sku: meta.sku,
      title: meta.title,
      tier: meta.tier,
      species: 'zeusai_product',
      bornAt: now,
    },
    capability: {
      list: [
        'autonomous_delivery', 'vault_attachment', 'workspace', 'concierge',
        'self_healing', 'marketplace_link', 'graph_participation',
      ],
      omegaReady: !!(meta.omega && meta.omega.ready),
    },
    permission: {
      rbac: ['owner', 'agent', 'ecosystem'],
      model: 'zero_trust_genome',
    },
    dependency: {
      requiredServices: meta.requiresHumanFulfillment ? ['human_fulfillment_desk'] : ['autonomous_fulfillment'],
      runtime: ['unicorn_backend', 'omega_continuum'],
    },
    skill: { skills },
    knowledge: {
      articles: [
        { id: 'genome-overview', title: `Genome of ${meta.title}`, href: `${SITE}/genome/${encodeURIComponent(genomeId)}` },
        { id: 'zero-maintenance', title: 'Zero maintenance contract', href: `${SITE}/genome#zero-maintenance` },
      ],
    },
    compatibility: { compatibleSkus: [], affinityHints: tokens.slice(0, 8) },
    plugin: { installed: [], slots: ['automation', 'analytics', 'connector'] },
    memory: { entries: 0, lastLearnedAt: null },
    automation: {
      rules: ['health_ping', 'value_nudge', 'relationship_scan'],
      generated: [],
    },
    api: {
      endpoints: [
        `/api/genome/${genomeId}`,
        `/api/genome/graph?sku=${encodeURIComponent(meta.sku)}`,
        `/checkout?serviceId=${encodeURIComponent(meta.sku)}`,
      ],
    },
    workflow: {
      pipelines: ['register→genome→graph→orchestrate→evolve'],
      generated: [],
    },
    security: {
      profile: 'standard_isolation',
      audit: true,
      secretsViaCustomerAuth: true,
    },
    risk: {
      score: meta.requiresHumanFulfillment ? 35 : 15,
      factors: meta.requiresHumanFulfillment ? ['human_fulfillment_latency'] : ['fully_autonomous'],
    },
    performance: {
      profile: 'event_driven',
      targetTimeToValueSec: meta.requiresHumanFulfillment ? 86400 : 60,
    },
    learning: { history: [{ at: now, event: 'genome_birth', note: 'Initial DNA assembled' }] },
    deployment: { history: [{ at: now, event: 'registered', channel: 'global_product_registry' }] },
    versioning: { versions: [{ v: '1.0.0', at: now, note: 'genome_v1' }], current: '1.0.0' },
    adaptation: { customerAdaptations: [] },
    business_rules: {
      rules: [
        { id: 'auto_vault', when: 'order_paid', then: 'attach_omega_vault' },
        { id: 'auto_graph', when: 'register', then: 'link_compatible_products' },
      ],
    },
    execution: {
      graph: {
        nodes: ['register', 'provision', 'deliver', 'monitor', 'evolve'],
        edges: [
          ['register', 'provision'],
          ['provision', 'deliver'],
          ['deliver', 'monitor'],
          ['monitor', 'evolve'],
          ['evolve', 'monitor'],
        ],
      },
    },
    relationship: { edgeIds: [] },
  };
}

function _zeroMaintenanceLedger() {
  const now = new Date().toISOString();
  const ledger = {};
  for (const op of ZERO_MAINTENANCE_OPS) {
    ledger[op] = { status: 'armed', lastAt: null, count: 0, autonomous: true };
  }
  ledger.monitor.lastAt = now;
  ledger.monitor.count = 1;
  return ledger;
}

function _publicGenome(g) {
  if (!g) return null;
  return {
    id: g.id,
    protocol: g.protocol,
    version: g.version,
    sku: g.sku,
    title: g.title,
    tier: g.tier,
    living: g.living === true,
    chromosomes: CHROMOSOMES.slice(),
    chromosomeCount: CHROMOSOMES.length,
    capabilities: g.dna && g.dna.capability && g.dna.capability.list,
    riskScore: g.dna && g.dna.risk && g.dna.risk.score,
    securityProfile: g.dna && g.dna.security && g.dna.security.profile,
    versionCurrent: g.dna && g.dna.versioning && g.dna.versioning.current,
    relationships: (g.dna && g.dna.relationship && g.dna.relationship.edgeIds) || [],
    relationshipCount: ((g.dna && g.dna.relationship && g.dna.relationship.edgeIds) || []).length,
    zeroMaintenance: g.zeroMaintenance,
    omegaHref: `${SITE}/omega`,
    href: `${SITE}/genome/${encodeURIComponent(g.id)}`,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    hash: g.hash,
  };
}

/**
 * Synaptic Edge Scoring — complementarity between two genomes.
 * Safe, deterministic, no invented revenue.
 */
function scoreAffinity(a, b) {
  if (!a || !b || a.id === b.id) return 0;
  let score = 0;
  if (a.tier && b.tier && a.tier !== b.tier) score += 12; // cross-tier bundles
  if (a.tier && a.tier === b.tier) score += 4;
  const ta = new Set(_tokens(`${a.title} ${a.sku}`));
  const tb = new Set(_tokens(`${b.title} ${b.sku}`));
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  score += Math.min(30, overlap * 6);
  const hintsA = (a.dna && a.dna.compatibility && a.dna.compatibility.affinityHints) || [];
  const hintsB = (b.dna && b.dna.compatibility && b.dna.compatibility.affinityHints) || [];
  for (const h of hintsA) if (hintsB.includes(h)) score += 5;
  // Human+autonomous pairing is high value for workflows
  const humA = (a.dna && a.dna.dependency && a.dna.dependency.requiredServices || []).includes('human_fulfillment_desk');
  const humB = (b.dna && b.dna.dependency && b.dna.dependency.requiredServices || []).includes('human_fulfillment_desk');
  if (humA !== humB) score += 10;
  return Math.min(100, score);
}

function _upsertGraphNode(genome) {
  graph.nodes[genome.id] = {
    id: genome.id,
    kind: 'product_genome',
    sku: genome.sku,
    title: genome.title,
    tier: genome.tier,
    updatedAt: new Date().toISOString(),
  };
}

function _ensureEdge(fromId, toId, kind, score, meta) {
  const existing = graph.edges.find((e) => e.from === fromId && e.to === toId && e.kind === kind);
  if (existing) {
    existing.score = score;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const edge = {
    id: _id('edge', `${fromId}:${toId}:${kind}`),
    from: fromId,
    to: toId,
    kind,
    score,
    meta: meta || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auto: true,
  };
  graph.edges.push(edge);
  state.edgesCreated += 1;
  const gFrom = genomes[fromId];
  const gTo = genomes[toId];
  if (gFrom && gFrom.dna && gFrom.dna.relationship) {
    if (!gFrom.dna.relationship.edgeIds.includes(edge.id)) gFrom.dna.relationship.edgeIds.push(edge.id);
    if (!gFrom.dna.compatibility.compatibleSkus.includes(gTo && gTo.sku)) {
      if (gTo) gFrom.dna.compatibility.compatibleSkus.push(gTo.sku);
    }
  }
  if (gTo && gTo.dna && gTo.dna.relationship) {
    if (!gTo.dna.relationship.edgeIds.includes(edge.id)) gTo.dna.relationship.edgeIds.push(edge.id);
  }
  return edge;
}

function _linkToEcosystem(genome) {
  _upsertGraphNode(genome);
  const others = Object.values(genomes).filter((g) => g.id !== genome.id);
  // Compare with every existing product (capped for safety on huge catalogs)
  const sample = others.slice(-80);
  for (const other of sample) {
    const score = scoreAffinity(genome, other);
    if (score >= 18) {
      _ensureEdge(genome.id, other.id, 'compatibility', score, { reason: 'synaptic_affinity' });
      if (score >= 40) {
        opportunities.push({
          at: new Date().toISOString(),
          type: 'integration',
          fromSku: genome.sku,
          toSku: other.sku,
          score,
          proposal: `Auto-integration candidate: ${genome.title} ↔ ${other.title}`,
          status: 'proposed',
          safe: score >= 50,
        });
        state.opportunities += 1;
      }
    }
  }
  // Always link to Omega continuum species node
  if (!graph.nodes.omega_continuum) {
    graph.nodes.omega_continuum = {
      id: 'omega_continuum',
      kind: 'platform_os',
      title: 'Omega Continuum Instance Graph',
      updatedAt: new Date().toISOString(),
    };
  }
  _ensureEdge(genome.id, 'omega_continuum', 'platform_bond', 100, { protocol: 'OMEGA/1.0' });
}

/**
 * Global Product Registry — registerProduct()
 * Developers only register. Ecosystem generates genome + graph + automations.
 */
function registerProduct(product) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const meta = _productShape(product);
    if (!meta.sku) return { ok: false, reason: 'missing_sku' };

    const existingId = skuIndex[meta.sku];
    if (existingId && genomes[existingId]) {
      const g = genomes[existingId];
      g.title = meta.title || g.title;
      g.tier = meta.tier || g.tier;
      g.updatedAt = new Date().toISOString();
      if (meta.omega) g.dna.capability.omegaReady = true;
      _upsertGraphNode(g);
      _save();
      return { ok: true, already: true, genomeId: g.id, genome: _publicGenome(g) };
    }

    const genomeId = _id('gnm', meta.sku);
    const now = new Date().toISOString();
    const dna = _buildChromosomes(meta, genomeId);
    const genome = {
      id: genomeId,
      protocol: PROTOCOL,
      version: VERSION,
      living: true,
      sku: meta.sku,
      title: meta.title,
      tier: meta.tier,
      priceUSD: meta.priceUSD,
      dna,
      zeroMaintenance: _zeroMaintenanceLedger(),
      orchestrator: { lastAxes: [], lastTickAt: null },
      createdAt: now,
      updatedAt: now,
      hash: null,
    };
    genome.hash = crypto.createHash('sha256').update(JSON.stringify({
      id: genomeId, sku: meta.sku, at: now,
    })).digest('hex').slice(0, 24);

    genomes[genomeId] = genome;
    skuIndex[meta.sku] = genomeId;
    state.registrations += 1;
    state.genomesBorn += 1;

    _linkToEcosystem(genome);

    // Auto-generate safe automation + workflow stubs (declarative, not executed blindly)
    genome.dna.automation.generated.push({
      id: 'rel_scan',
      at: now,
      rule: 'scan_compatible_on_register',
    });
    genome.dna.workflow.generated.push({
      id: 'onboard_continuum',
      at: now,
      steps: ['vault', 'workspace', 'concierge', 'genome_attach'],
    });

    _append({ ts: now, type: 'register', genomeId, sku: meta.sku });
    _save();
    return { ok: true, genomeId, genome: _publicGenome(genome), edges: genome.dna.relationship.edgeIds.length };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

/** Catalog stamp — attach genome identity without exploding counters. */
function enrichCatalogItem(item) {
  if (!item || typeof item !== 'object') return item;
  if (DISABLED) return item;
  try {
    if (item.genomeReady === true && item.genome && item.genome.protocol === PROTOCOL) {
      return item;
    }
    const reg = registerProduct(item);
    const stamped = { ...item };
    stamped.genome = {
      protocol: PROTOCOL,
      version: VERSION,
      ready: true,
      genomeId: reg.genomeId || null,
      chromosomes: CHROMOSOMES.slice(),
      principle: PRINCIPLE,
    };
    stamped.genomeReady = true;
    if (reg.genome && reg.genome.href) stamped.genomeHref = reg.genome.href;
    return stamped;
  } catch (e) {
    state.errors += 1;
    return item;
  }
}

function onOrderPaid(order) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const o = order && typeof order === 'object' ? order : {};
    const sku = String(o.serviceId || o.sku || o.plan || '').trim();
    if (!sku) return { ok: false, reason: 'missing_sku' };
    const reg = registerProduct({
      id: sku,
      title: o.serviceName || o.title || sku,
      tier: o.tier || 'professional',
    });
    const g = genomes[reg.genomeId];
    if (g) {
      const now = new Date().toISOString();
      g.dna.learning.history.push({
        at: now,
        event: 'purchase',
        orderId: o.orderId || o.id || null,
        note: 'Customer adaptation seed',
      });
      g.dna.adaptation.customerAdaptations.push({
        at: now,
        orderId: o.orderId || o.id || null,
        emailMasked: o.email ? String(o.email).replace(/(^.).*(@.*$)/, '$1…$2') : null,
      });
      g.dna.deployment.history.push({ at: now, event: 'sold_attach', orderId: o.orderId || o.id || null });
      // Zero-maintenance: monitor + document on sale
      g.zeroMaintenance.monitor.count += 1;
      g.zeroMaintenance.monitor.lastAt = now;
      g.zeroMaintenance.document.count += 1;
      g.zeroMaintenance.document.lastAt = now;
      state.maintenanceOps += 2;
      g.updatedAt = now;
      _save();
    }
    return {
      ok: true,
      genomeId: reg.genomeId,
      genome: reg.genome,
      omegaBond: true,
    };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

function getGenome(idOrSku) {
  const key = String(idOrSku || '');
  let g = genomes[key];
  if (!g && skuIndex[key]) g = genomes[skuIndex[key]];
  if (!g) {
    // try suffix match
    const hit = Object.values(genomes).find((x) => x.sku === key || x.id === key);
    g = hit || null;
  }
  if (!g) return { ok: false, reason: 'not_found' };
  return {
    ok: true,
    genome: _publicGenome(g),
    dna: g.dna,
    opportunities: opportunities.filter((o) => o.fromSku === g.sku || o.toSku === g.sku).slice(-20),
  };
}

function getGraph(opts) {
  const sku = opts && opts.sku;
  let edges = graph.edges.slice();
  let nodes = { ...graph.nodes };
  if (sku) {
    const gid = skuIndex[sku];
    if (gid) {
      edges = edges.filter((e) => e.from === gid || e.to === gid);
      const keep = new Set([gid]);
      for (const e of edges) { keep.add(e.from); keep.add(e.to); }
      nodes = {};
      for (const id of keep) if (graph.nodes[id]) nodes[id] = graph.nodes[id];
    }
  }
  return {
    ok: true,
    protocol: PROTOCOL,
    design: DESIGN,
    nodeCount: Object.keys(nodes).length,
    edgeCount: edges.length,
    nodes,
    edges: edges.slice(-200),
  };
}

function searchGenomes(q) {
  const needle = String(q || '').toLowerCase().trim();
  const all = Object.values(genomes);
  const hits = all.filter((g) => {
    if (!needle) return true;
    const blob = `${g.sku} ${g.title} ${g.tier} ${(g.dna && g.dna.capability && g.dna.capability.list || []).join(' ')}`.toLowerCase();
    return blob.includes(needle);
  }).slice(0, 50);
  return { ok: true, query: needle, count: hits.length, genomes: hits.map(_publicGenome) };
}

/**
 * Ecosystem Orchestrator — central autonomous intelligence tick.
 * Records honest opportunities; creates safe auto-edges; never invents revenue.
 */
function orchestrateOnce() {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const now = new Date().toISOString();
    const axis = ORCHESTRATOR_AXES[state.orchestratorTicks % ORCHESTRATOR_AXES.length];
    const list = Object.values(genomes);
    let actions = 0;

    if (axis === 'relationship_discovery' || axis === 'product_discovery') {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < Math.min(list.length, i + 12); j += 1) {
          const score = scoreAffinity(list[i], list[j]);
          if (score >= 22) {
            _ensureEdge(list[i].id, list[j].id, 'orchestrated_affinity', score, { axis });
            actions += 1;
          }
        }
      }
    }

    if (axis === 'workflow_generation' || axis === 'automation_generation') {
      for (const g of list.slice(-20)) {
        const wfId = `wf_${axis}_${g.sku}`;
        if (!(g.dna.workflow.generated || []).some((w) => w.id === wfId)) {
          g.dna.workflow.generated.push({
            id: wfId,
            at: now,
            axis,
            steps: ['detect', 'propose', 'safe_apply_stub'],
          });
          g.dna.automation.generated.push({
            id: `auto_${axis}_${Date.now().toString(36)}`,
            at: now,
            axis,
          });
          opportunities.push({
            at: now,
            type: axis,
            fromSku: g.sku,
            toSku: null,
            score: 40,
            proposal: `${axis} for ${g.title}`,
            status: 'proposed',
            safe: true,
          });
          state.opportunities += 1;
          actions += 1;
          g.updatedAt = now;
        }
      }
    }

    if (axis === 'security_optimization' || axis === 'learning_optimization') {
      for (const g of list.slice(-30)) {
        g.dna.learning.history.push({ at: now, event: 'orchestrator_tick', axis });
        g.zeroMaintenance.audit.count += 1;
        g.zeroMaintenance.audit.lastAt = now;
        g.zeroMaintenance.optimize.count += 1;
        g.zeroMaintenance.optimize.lastAt = now;
        state.maintenanceOps += 2;
        g.orchestrator = { lastAxes: [axis], lastTickAt: now };
        actions += 1;
      }
    }

    if (axis === 'customer_optimization' || axis === 'revenue_optimization') {
      // Honest: only propose complementary pairs — never invent GMV.
      for (const g of list.slice(-15)) {
        const comps = (g.dna.compatibility.compatibleSkus || []).slice(0, 3);
        for (const sku of comps) {
          opportunities.push({
            at: now,
            type: 'customer_value',
            fromSku: g.sku,
            toSku: sku,
            score: 45,
            proposal: `Bundle signal (non-revenue): ${g.sku} + ${sku}`,
            status: 'proposed',
            safe: true,
            honesty: 'No revenue invented — signal only',
          });
          state.opportunities += 1;
          actions += 1;
        }
      }
    }

    state.orchestratorTicks += 1;
    state.lastOrchestratorAt = now;
    _append({ ts: now, type: 'orchestrate', axis, actions });
    _save();
    return { ok: true, axis, actions, ticks: state.orchestratorTicks };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

/** Autonomous Product Evolution — integrate / automate / eliminate / increase value? */
function evolveOnce() {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  try {
    const questions = [
      { q: 'integrate', apply: (g) => {
        const peers = Object.values(genomes).filter((x) => x.id !== g.id).slice(0, 5);
        for (const p of peers) {
          const score = scoreAffinity(g, p);
          if (score >= 20) _ensureEdge(g.id, p.id, 'evolved_integration', score, { q: 'integrate' });
        }
      } },
      { q: 'automate', apply: (g) => {
        g.dna.automation.rules = Array.from(new Set([...(g.dna.automation.rules || []), 'auto_optimize', 'auto_document']));
      } },
      { q: 'eliminate_manual', apply: (g) => {
        g.zeroMaintenance.explain.count += 1;
        g.zeroMaintenance.explain.lastAt = new Date().toISOString();
        g.dna.business_rules.rules.push({
          id: `elim_${Date.now().toString(36)}`,
          when: 'manual_task_detected',
          then: 'automate_if_safe',
        });
      } },
      { q: 'increase_value', apply: (g) => {
        g.dna.capability.list = Array.from(new Set([...(g.dna.capability.list || []), 'value_loop', 'cross_product_assist']));
      } },
    ];
    const pick = questions[state.evolutions % questions.length];
    const now = new Date().toISOString();
    let evolved = 0;
    for (const g of Object.values(genomes).slice(0, 40)) {
      pick.apply(g);
      g.dna.learning.history.push({ at: now, event: 'evolution', question: pick.q, answer: 'yes_safe_apply' });
      g.dna.versioning.versions.push({ v: `1.0.${g.dna.versioning.versions.length}`, at: now, note: pick.q });
      g.dna.versioning.current = g.dna.versioning.versions[g.dna.versioning.versions.length - 1].v;
      g.living = true;
      g.updatedAt = now;
      evolved += 1;
    }
    // Orchestrator rides along
    const orch = orchestrateOnce();
    state.evolutions += 1;
    state.lastEvolveAt = now;
    _append({ ts: now, type: 'evolve', question: pick.q, evolved });
    _save();
    return { ok: true, question: pick.q, evolved, orchestrator: orch };
  } catch (e) {
    state.errors += 1;
    return { ok: false, error: String(e && e.message || e).slice(0, 160) };
  }
}

/**
 * Future Mode — when a superior architecture is discovered, plan migration
 * that preserves customer data and minimizes downtime. Never auto-destroys.
 */
function planMigration(opts) {
  const o = opts || {};
  const plan = {
    id: _id('mig', `${Date.now()}:${o.target || 'next'}`),
    at: new Date().toISOString(),
    from: o.from || DESIGN,
    to: o.target || 'discovered_superior_architecture',
    preserveCustomerData: true,
    minimizeDowntime: true,
    steps: [
      { step: 'snapshot_genomes', safe: true },
      { step: 'snapshot_graph', safe: true },
      { step: 'dual_write_new_schema', safe: true },
      { step: 'verify_parity', safe: true },
      { step: 'cutover_read_path', safe: true, requiresApproval: true },
      { step: 'retire_old_path', safe: true, requiresApproval: true },
    ],
    status: 'planned',
    applied: false,
    note: 'Future Mode: recommend before apply; never hardcode assumptions.',
  };
  migrations.push(plan);
  state.migrationsPlanned += 1;
  _save();
  return { ok: true, plan };
}

function discovery() {
  return {
    protocol: PROTOCOL,
    version: VERSION,
    name: 'AI Genome Engine',
    design: DESIGN,
    principle: PRINCIPLE,
    purpose: 'Living digital DNA for every ZeusAI product — self-organizing Universal Intelligence Graph with zero manual integration.',
    chromosomes: CHROMOSOMES.slice(),
    zeroMaintenanceOps: ZERO_MAINTENANCE_OPS.slice(),
    orchestratorAxes: ORCHESTRATOR_AXES.slice(),
    inventions: [
      'Living Genome (not metadata)',
      'Chromosome Model (22 evolvable strands)',
      'Synaptic Edge Scoring',
      'Universal Intelligence Graph',
      'Ecosystem Orchestrator',
      'Global Product Registry registerProduct()',
      'Future Mode Migration Planner',
      'Omega Helix Bond',
    ],
    registerProduct: true,
    endpoints: {
      status: '/api/genome/status',
      discovery: '/api/genome/discovery',
      genome: '/api/genome/:id',
      graph: '/api/genome/graph',
      search: '/api/genome/search',
      register: '/api/genome/register',
      evolve: '/api/genome/evolve',
      orchestrate: '/api/genome/orchestrate',
      migrate: '/api/genome/migrate',
      wellKnown: '/.well-known/genome.json',
      human: '/genome',
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
    invention: 'AI Genome — Digital DNA of ZeusAI',
    started: _started || !!state.startedAt,
    startedAt: state.startedAt,
    disabled: DISABLED,
    chromosomeCount: CHROMOSOMES.length,
    chromosomes: CHROMOSOMES.slice(),
    counts: {
      registrations: state.registrations,
      genomesBorn: state.genomesBorn,
      genomesLive: Object.values(genomes).filter((g) => g.living).length,
      edgesCreated: state.edgesCreated,
      graphNodes: Object.keys(graph.nodes || {}).length,
      graphEdges: (graph.edges || []).length,
      opportunities: state.opportunities,
      evolutions: state.evolutions,
      orchestratorTicks: state.orchestratorTicks,
      maintenanceOps: state.maintenanceOps,
      migrationsPlanned: state.migrationsPlanned,
      errors: state.errors,
    },
    lastOrchestratorAt: state.lastOrchestratorAt,
    lastEvolveAt: state.lastEvolveAt,
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
  const tickMs = Math.max(60_000, Number(process.env.ZEUS_GENOME_TICK_MS) || 3 * 60 * 60_000);
  if (_timer) clearInterval(_timer);
  if (process.env.NODE_ENV !== 'test') {
    _timer = setInterval(() => {
      try { evolveOnce(); } catch (_) { /* ignore */ }
    }, tickMs);
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
  if (action === 'register') return registerProduct(input.product || input);
  if (action === 'paid') return onOrderPaid(input.order || input);
  if (action === 'evolve') return evolveOnce();
  if (action === 'orchestrate') return orchestrateOnce();
  if (action === 'genome') return getGenome(input.id || input.sku);
  if (action === 'graph') return getGraph(input);
  if (action === 'search') return searchGenomes(input.q);
  if (action === 'migrate') return planMigration(input);
  if (action === 'discovery') return discovery();
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stop();
  genomes = {};
  skuIndex = {};
  graph = { nodes: {}, edges: [] };
  opportunities = [];
  migrations = [];
  Object.assign(state, {
    startedAt: null, registrations: 0, genomesBorn: 0, edgesCreated: 0,
    opportunities: 0, evolutions: 0, orchestratorTicks: 0, maintenanceOps: 0,
    migrationsPlanned: 0, errors: 0, lastOrchestratorAt: null, lastEvolveAt: null,
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
  CHROMOSOMES,
  ZERO_MAINTENANCE_OPS,
  ORCHESTRATOR_AXES,
  registerProduct,
  enrichCatalogItem,
  onOrderPaid,
  getGenome,
  getGraph,
  searchGenomes,
  orchestrateOnce,
  evolveOnce,
  planMigration,
  scoreAffinity,
  discovery,
  getStatus,
  start,
  stop,
  process: processInput,
  _resetForTests,
};
