// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Protocol: CEGE/1.0 — Cognitive Evolution Genome & Self-Innovation Engine
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'CEGE/1.0';
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const DOMAIN = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');

// 6 core IT & Autonomous Engineering Domains managed by the Cognitive Evolution Genome
const SEED_DOMAINS = {
  llm_architecture_synthesis: {
    label: 'Distributed Systems & Frontier LLM Synthesis',
    objective: 'Maximize technical depth, concrete metrics, zero-fluff precision, and sub-second frontier routing across Groq 120B, OpenRouter 550B, and local Ollama.',
    champions: [
      {
        id: 'gen_llm_v1',
        generation: 1,
        directive: 'Synthesize executable, production-hardened architecture plans with explicit failure modes, latency budgets, security invariants, verification commands, and zero filler.',
        pillars: { depth: 18, precision: 18, security: 17, autonomy: 18, zeroRegression: 18 },
        alpha: 9,
        beta: 1,
        samples: 8,
        meanQuality: 89.0,
        avgLatencyMs: 680,
      },
      {
        id: 'gen_llm_v2_challenger',
        generation: 1,
        directive: 'Apply first-principles distributed-systems design: state exact invariants, deterministic fallback rails, cryptographic proofs, measurable KPIs, and automated rollback gates.',
        pillars: { depth: 19, precision: 19, security: 19, autonomy: 18, zeroRegression: 18 },
        alpha: 6,
        beta: 1,
        samples: 5,
        meanQuality: 91.5,
        avgLatencyMs: 740,
      },
    ],
  },
  autonomous_service_execution: {
    label: 'Autonomous Post-Payment Service Provisioning (ASPE/1.0)',
    objective: 'Transform every confirmed payment across all 55+ services into live, self-healing, auditable execution workspaces with continuous value compounding.',
    champions: [
      {
        id: 'gen_aspe_v1',
        generation: 1,
        directive: 'Provision isolated multi-module workspaces immediately upon verified settlement, attach scoped API credentials, execute first live cycle automatically, and sign Ed25519 execution proofs.',
        pillars: { depth: 18, precision: 18, security: 19, autonomy: 19, zeroRegression: 18 },
        alpha: 10,
        beta: 1,
        samples: 9,
        meanQuality: 92.0,
        avgLatencyMs: 210,
      },
    ],
  },
  conversion_proof_magnet: {
    label: 'Proof-Before-Pay Diagnostic & Viral Flywheel (ACME/1.0)',
    objective: 'Prove measurable value before checkout via real live domain diagnostics, transparent gap scoring, and cryptographic 10%/10% referral loops.',
    champions: [
      {
        id: 'gen_acme_v1',
        generation: 1,
        directive: 'Run SSRF-hardened real-time diagnostics on buyer domains, surface verifiable SEO/AEO/GEO/HSTS gaps with exact remediation impact, and link directly to BTC (-10%), PayPal, and NOWPayments rails.',
        pillars: { depth: 17, precision: 19, security: 19, autonomy: 18, zeroRegression: 18 },
        alpha: 8,
        beta: 1,
        samples: 7,
        meanQuality: 90.5,
        avgLatencyMs: 290,
      },
    ],
  },
  seo_aeo_geo_authority: {
    label: 'Tri-Layer Search, Answer & Generative Citation Engine (SAGS/1.0)',
    objective: 'Maximize organic crawlability, structured JSON-LD density, RAG semantic chunk retrievability, and verifiable AI citation authority across search and answer engines.',
    champions: [
      {
        id: 'gen_sags_v1',
        generation: 1,
        directive: 'Maintain canonical Schema.org JSON-LD, bilingual EN/RO answer capsules, dense /llms-full.txt corpora, and deterministic Ed25519-signed citation matrices without fabricated traffic claims.',
        pillars: { depth: 18, precision: 18, security: 18, autonomy: 19, zeroRegression: 18 },
        alpha: 9,
        beta: 1,
        samples: 8,
        meanQuality: 91.0,
        avgLatencyMs: 140,
      },
    ],
  },
  security_runtime_immunity: {
    label: 'Zero-CVE Supply-Chain & Zero-Restart Immunity (ASRI/1.0)',
    objective: 'Preserve 0 npm vulnerabilities, nanosecond V8 event-loop health, strict CSP/Trusted Types hygiene, and cryptographic provenance.',
    champions: [
      {
        id: 'gen_asri_v1',
        generation: 1,
        directive: 'Enforce zero-CVE dependency locks, V8 heap_size_limit telemetry, strict Trusted Types DOM sanitization, SSRF private-IP blocking, and Ed25519 runtime attestation.',
        pillars: { depth: 18, precision: 19, security: 20, autonomy: 18, zeroRegression: 19 },
        alpha: 11,
        beta: 1,
        samples: 10,
        meanQuality: 94.0,
        avgLatencyMs: 45,
      },
    ],
  },
  agentic_commerce_negotiation: {
    label: 'Universal MCP & A2A Autonomous Agent Commerce (UMAP/1.0)',
    objective: 'Enable external AI agents (Claude, ChatGPT, Gemini, Cursor, A2A) to discover, audit, quote, and settle Unicorn autonomous services with machine-verifiable receipts.',
    champions: [
      {
        id: 'gen_umap_v1',
        generation: 1,
        directive: 'Expose standard MCP 2025-03-26 JSON-RPC 2.0 tools, Google A2A Agent Card, and unified OpenAPI 3.1 contracts with strict JSON Schema validation and honest real-time telemetry.',
        pillars: { depth: 18, precision: 19, security: 19, autonomy: 19, zeroRegression: 18 },
        alpha: 8,
        beta: 1,
        samples: 7,
        meanQuality: 93.0,
        avgLatencyMs: 120,
      },
    ],
  },
};

const EXPERT_MUTATION_TEMPLATES = [
  {
    tag: 'zero_trust_verification',
    suffix: 'Attach deterministic SHA-256 verification checksums, explicit error-recovery playbooks, and zero-trust input validation boundaries to every automated output.',
    bonusHint: 'Hardens security and auditability with deterministic cryptographic proofs.',
  },
  {
    tag: 'latency_pareto_routing',
    suffix: 'Enforce strict p95 latency budgets with streaming progressive disclosure, automatic multi-rail circuit breaking, and cache-coherent fallback execution.',
    bonusHint: 'Improves responsiveness and resilience under high concurrency.',
  },
  {
    tag: 'compounding_memory_rag',
    suffix: 'Retrieve top-3 high-scoring semantic lessons from prior verified executions before synthesis and distill newly validated insights back into long-term vector memory.',
    bonusHint: 'Turns every real interaction into compounding institutional intelligence.',
  },
  {
    tag: 'agentic_interoperability',
    suffix: 'Emit structured machine-readable JSON-LD + MCP/A2A action affordances alongside human executive summaries so both people and AI agents can execute next steps in one call.',
    bonusHint: 'Bridges human conversion UX and autonomous AI-to-AI commerce seamlessly.',
  },
];

function resolveDataDir() {
  const dir = process.env.CEGE_DATA_DIR
    || (process.env.ZEUS_STATE_DIR ? path.join(process.env.ZEUS_STATE_DIR, 'cognitive-evolution') : null)
    || path.join(APP_ROOT, 'data', 'cognitive-evolution');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function loadEd25519Keypair() {
  const keyFile = process.env.SITE_SIGN_KEY_FILE
    || path.join(os.homedir(), '.unicorn-keys', 'site-sign.pem');
  try {
    if (fs.existsSync(keyFile)) {
      const pem = fs.readFileSync(keyFile, 'utf8');
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      const pubDer = publicKey.export({ type: 'spki', format: 'der' });
      return {
        privateKey,
        publicKey,
        publicKeyBase64: pubDer.toString('base64'),
        keySource: 'site_persistent_ed25519',
      };
    }
  } catch (_) {}
  const pair = crypto.generateKeyPairSync('ed25519');
  const pubDer = pair.publicKey.export({ type: 'spki', format: 'der' });
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyBase64: pubDer.toString('base64'),
    keySource: 'ephemeral_ed25519',
  };
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(String(str || '')).digest('hex');
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

class CognitiveEvolutionGenomeEngine {
  constructor() {
    this.protocol = PROTOCOL;
    this.startedAt = new Date().toISOString();
    this.keys = loadEd25519Keypair();
    this.generation = 1;
    this.totalObservations = 0;
    this.totalPromotions = 0;
    this.totalRollbacks = 0;
    this.totalDistilledLessons = 0;
    this.domains = new Map();
    this.previousChampions = new Map();
    this.ledger = [];
    this.innovationRfcs = [];
    this.distilledLessons = [];
    this._seedDomains();
    this._loadState();
  }

  _seedDomains() {
    for (const domainKey of Object.keys(SEED_DOMAINS)) {
      const cfg = SEED_DOMAINS[domainKey];
      const genomes = cfg.champions.map((g) => Object.assign({
        domain: domainKey,
        status: 'active',
        createdAt: this.startedAt,
      }, g));
      genomes[0].isChampion = true;
      for (let i = 1; i < genomes.length; i++) genomes[i].isChampion = false;
      this.domains.set(domainKey, {
        id: domainKey,
        label: cfg.label,
        objective: cfg.objective,
        championId: genomes[0].id,
        genomes,
      });
    }
  }

  _ledgerPath() {
    return path.join(resolveDataDir(), 'ledger.jsonl');
  }

  _lessonsPath() {
    return path.join(resolveDataDir(), 'lessons.jsonl');
  }

  _statePath() {
    return path.join(resolveDataDir(), 'state.json');
  }

  _persistState() {
    try {
      const dest = this._statePath();
      const tmp = `${dest}.${process.pid}.tmp`;
      const snapshot = {
        protocol: PROTOCOL,
        savedAt: new Date().toISOString(),
        generation: this.generation,
        ledgerSeq: this.ledgerSeq || this.ledger.length,
        totalObservations: this.totalObservations,
        totalPromotions: this.totalPromotions,
        totalRollbacks: this.totalRollbacks,
        domains: Array.from(this.domains.values()),
        innovationRfcs: this.innovationRfcs.slice(0, 25),
      };
      fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
      fs.renameSync(tmp, dest);
    } catch (_) {}
  }

  _rotateLedgerIfLarge() {
    try {
      const lp = this._ledgerPath();
      if (!fs.existsSync(lp)) return;
      const st = fs.statSync(lp);
      if (st.size < 2 * 1024 * 1024) return; // keep under 2MB
      const lines = fs.readFileSync(lp, 'utf8').split('\n').filter(Boolean).slice(-150);
      const tmp = `${lp}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf8');
      fs.renameSync(tmp, lp);
    } catch (_) {}
  }

  _loadState() {
    this.ledgerSeq = 0;
    try {
      const sp = this._statePath();
      if (fs.existsSync(sp)) {
        const snap = JSON.parse(fs.readFileSync(sp, 'utf8'));
        if (snap && typeof snap === 'object') {
          if (typeof snap.generation === 'number' && snap.generation > this.generation) this.generation = snap.generation;
          if (typeof snap.ledgerSeq === 'number' && snap.ledgerSeq > this.ledgerSeq) this.ledgerSeq = snap.ledgerSeq;
          if (typeof snap.totalObservations === 'number') this.totalObservations = snap.totalObservations;
          if (typeof snap.totalPromotions === 'number') this.totalPromotions = snap.totalPromotions;
          if (typeof snap.totalRollbacks === 'number') this.totalRollbacks = snap.totalRollbacks;
          if (Array.isArray(snap.domains)) {
            for (const d of snap.domains) {
              if (d && d.id && Array.isArray(d.genomes) && d.genomes.length > 0 && this.domains.has(d.id)) {
                this.domains.set(d.id, d);
              }
            }
          }
          if (Array.isArray(snap.innovationRfcs)) {
            this.innovationRfcs = snap.innovationRfcs.slice(0, 25);
          }
        }
      }
    } catch (_) {}

    try {
      const lp = this._ledgerPath();
      if (fs.existsSync(lp)) {
        const lines = fs.readFileSync(lp, 'utf8').split('\n').filter(Boolean);
        for (const line of lines.slice(-100)) {
          try {
            const entry = JSON.parse(line);
            if (entry && entry.entryHash && entry.signature) {
              this.ledger.push(entry);
              if (typeof entry.generation === 'number' && entry.generation > this.generation) {
                this.generation = entry.generation;
              }
              if (typeof entry.index === 'number' && entry.index > this.ledgerSeq) {
                this.ledgerSeq = entry.index;
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    try {
      const kp = this._lessonsPath();
      if (fs.existsSync(kp)) {
        const lines = fs.readFileSync(kp, 'utf8').split('\n').filter(Boolean);
        for (const line of lines.slice(-60)) {
          try {
            const row = JSON.parse(line);
            if (row && row.id) {
              this.distilledLessons.push(row);
              this.totalDistilledLessons += 1;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  _signPayload(payloadObj) {
    const raw = Buffer.from(canonicalJson(payloadObj), 'utf8');
    return crypto.sign(null, raw, this.keys.privateKey).toString('base64');
  }

  _syncLedgerFromDisk() {
    try {
      const lp = this._ledgerPath();
      if (!fs.existsSync(lp)) return;
      const st = fs.statSync(lp);
      if (this._lastLedgerMtimeMs && st.mtimeMs <= this._lastLedgerMtimeMs && this._lastLedgerSize === st.size) {
        return;
      }
      this._lastLedgerMtimeMs = st.mtimeMs;
      this._lastLedgerSize = st.size;
      const lines = fs.readFileSync(lp, 'utf8').split('\n').filter(Boolean).slice(-100);
      const loaded = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry && entry.entryHash && entry.signature) {
            loaded.push(entry);
            if (typeof entry.generation === 'number' && entry.generation > this.generation) {
              this.generation = entry.generation;
            }
            if (typeof entry.index === 'number' && entry.index > (this.ledgerSeq || 0)) {
              this.ledgerSeq = entry.index;
            }
          }
        } catch (_) {}
      }
      if (loaded.length > 0) this.ledger = loaded;
    } catch (_) {}
  }

  _appendSignedLedgerEntry(eventType, details) {
    // Sync latest tail from disk before appending (with lightweight advisory lockfile)
    // so concurrent processes (backend + orchestrator) never fork prevHash in shared ledger.jsonl.
    const lockPath = path.join(resolveDataDir(), '.ledger.lock');
    let lockHeld = false;
    try {
      const st = fs.existsSync(lockPath) ? fs.statSync(lockPath) : null;
      if (st && (Date.now() - st.mtimeMs) > 5000) {
        try { fs.unlinkSync(lockPath); } catch (_) {}
      }
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      lockHeld = true;
    } catch (_) {}

    try {
      this._syncLedgerFromDisk();
      const prevHash = this.ledger.length > 0
        ? this.ledger[this.ledger.length - 1].entryHash
        : '0'.repeat(64);
      this.ledgerSeq = Math.max(this.ledgerSeq || 0, this.ledger.length) + 1;
      const body = {
        index: this.ledgerSeq,
        protocol: PROTOCOL,
        generation: this.generation,
        eventType: String(eventType || 'EVOLUTION_EVENT'),
        at: new Date().toISOString(),
        prevHash,
        mutatesSource: false,
        inventsGmv: false,
        details: details || {},
      };
      const entryHash = sha256Hex(canonicalJson(body));
      const signature = this._signPayload({ entryHash, body });
      const signedEntry = Object.assign({}, body, {
        entryHash,
        signature,
        publicKeyBase64: this.keys.publicKeyBase64,
      });
      this.ledger.push(signedEntry);
      if (this.ledger.length > 150) this.ledger.shift();
      try {
        fs.appendFileSync(this._ledgerPath(), JSON.stringify(signedEntry) + '\n', 'utf8');
        this._rotateLedgerIfLarge();
        const st = fs.statSync(this._ledgerPath());
        this._lastLedgerMtimeMs = st.mtimeMs;
        this._lastLedgerSize = st.size;
      } catch (_) {}
      this._persistState();
      return signedEntry;
    } finally {
      if (lockHeld) {
        try { fs.unlinkSync(lockPath); } catch (_) {}
      }
    }
  }

  /**
   * 1. UCB1 / Bayesian Multi-Armed Bandit Genome Selector
   * Balances proven Champion exploitation with disciplined Challenger exploration.
   */
  selectGenome(domainKey) {
    const dom = this.domains.get(domainKey) || this.domains.get('llm_architecture_synthesis');
    if (!dom || !dom.genomes.length) return null;

    const totalSamples = dom.genomes.reduce((acc, g) => acc + Math.max(1, g.samples || 0), 0);
    let best = dom.genomes[0];
    let bestUcb = -1;

    for (const g of dom.genomes) {
      const n = Math.max(1, g.samples || 0);
      const meanNorm = Math.max(0, Math.min(1, (g.meanQuality || 75) / 100));
      const posteriorMean = (g.alpha || 1) / ((g.alpha || 1) + (g.beta || 1));
      const blendedMean = meanNorm * 0.65 + posteriorMean * 0.35;
      const exploration = 0.14 * Math.sqrt(Math.log(totalSamples + 2) / n);
      const ucbScore = Number((blendedMean + exploration).toFixed(4));
      if (ucbScore > bestUcb) {
        bestUcb = ucbScore;
        best = g;
      }
    }

    return {
      domain: dom.id,
      genomeId: best.id,
      generation: best.generation,
      isChampion: best.id === dom.championId,
      directive: best.directive,
      meanQuality: best.meanQuality,
      ucbScore: bestUcb,
    };
  }

  /**
   * 2. Deterministic 5-Pillar Shadow Benchmark Rubric (0–100)
   * Evaluates candidate strategy directives strictly before promotion.
   */
  benchmarkDirective(directiveText, domainKey) {
    const text = String(directiveText || '').trim();
    const len = text.length;
    const lower = text.toLowerCase();

    let depth = 0;
    if (len >= 90) depth += 10;
    if (len >= 160) depth += 5;
    if (/(invariant|failover|rollback|telemetry|architecture|multi-rail|protocol|circuit|rag|semantic)/i.test(lower)) depth += 5;

    let precision = 0;
    if (/(sha-256|ed25519|json-ld|p95|latency|schema|checksum|budget|kpi|metric|55|10%)/i.test(lower)) precision += 12;
    if (/(deterministic|verifiable|measurable|exact|concrete|strict)/i.test(lower)) precision += 8;

    let security = 0;
    if (/(zero-trust|ssrf|cve|ed25519|trusted types|sanitiz|validation|cryptographic|proof|audit)/i.test(lower)) security += 14;
    if (!/(disable security|bypass|eval\(|ignore auth|fabricate|fake revenue)/i.test(lower)) security += 6;

    let autonomy = 0;
    if (/(autonom|self-heal|auto|continuous|closed-loop|bandit|distill|agent|mcp|a2a)/i.test(lower)) autonomy += 15;
    if (/(proactive|compounding|adaptive|memory|evolution)/i.test(lower)) autonomy += 5;

    let zeroRegression = 20;
    if (/(rewrite source|delete baseline|bypass guard|fake gmv|invent visitors)/i.test(lower)) {
      zeroRegression = 0;
    }

    const total = Math.min(100, depth + precision + security + autonomy + zeroRegression);
    return {
      domain: domainKey,
      score: total,
      safe: zeroRegression === 20 && security >= 12,
      pillars: { depth, precision, security, autonomy, zeroRegression },
    };
  }

  /**
   * 3. Closed-Loop Live Outcome Recorder + Semantic Vector RAG Distillation + Auto-Rollback
   */
  recordOutcome({
    domain = 'llm_architecture_synthesis',
    genomeId = null,
    qualityScore = 80,
    latencyMs = 200,
    success = true,
    lesson = '',
    source = 'runtime',
  } = {}) {
    const dom = this.domains.get(domain);
    if (!dom) return { ok: false, error: 'unknown_domain' };

    const targetId = genomeId || dom.championId;
    const genome = dom.genomes.find((g) => g.id === targetId) || dom.genomes[0];
    if (!genome) return { ok: false, error: 'genome_not_found' };

    const score = Math.max(0, Math.min(100, Number(qualityScore) || 0));
    const lat = Math.max(1, Number(latencyMs) || 1);
    const prevSamples = genome.samples || 0;
    genome.samples = prevSamples + 1;
    genome.meanQuality = Number((((genome.meanQuality || score) * prevSamples + score) / genome.samples).toFixed(2));
    genome.avgLatencyMs = Math.round(((genome.avgLatencyMs || lat) * prevSamples + lat) / genome.samples);

    if (success && score >= 75) {
      genome.alpha = (genome.alpha || 1) + 1;
    } else {
      genome.beta = (genome.beta || 1) + 1;
    }

    this.totalObservations += 1;
    let rolledBack = false;
    let distilled = null;

    // Automatic instant rollback guard if a promoted champion degrades live quality
    const prevChamp = this.previousChampions.get(domain);
    if (
      prevChamp
      && genome.id === dom.championId
      && genome.samples >= 3
      && genome.meanQuality < (prevChamp.meanQuality - 8)
    ) {
      genome.isChampion = false;
      genome.status = 'rolled_back';
      prevChamp.isChampion = true;
      prevChamp.status = 'active';
      dom.championId = prevChamp.id;
      this.totalRollbacks += 1;
      rolledBack = true;
      this._appendSignedLedgerEntry('AUTO_ROLLBACK', {
        domain,
        demotedGenomeId: genome.id,
        demotedMeanQuality: genome.meanQuality,
        restoredChampionId: prevChamp.id,
        restoredMeanQuality: prevChamp.meanQuality,
        reason: 'live_quality_regression_exceeded_8pt_threshold',
      });
    }

    // Distill high-scoring lessons into long-term vector RAG memory
    const cleanLesson = String(lesson || '').trim();
    if (success && score >= 82 && cleanLesson.length >= 20) {
      distilled = this.distillLesson({
        domain,
        genomeId: genome.id,
        qualityScore: score,
        lesson: cleanLesson,
        source,
      });
    }

    return {
      ok: true,
      protocol: PROTOCOL,
      domain,
      genomeId: genome.id,
      samples: genome.samples,
      meanQuality: genome.meanQuality,
      rolledBack,
      distilled: !!distilled,
    };
  }

  distillLesson({ domain, genomeId, qualityScore, lesson, source = 'runtime' }) {
    const id = 'lesson_' + sha256Hex(domain + '|' + lesson).slice(0, 12);
    if (this.distilledLessons.some((l) => l.id === id)) {
      return this.distilledLessons.find((l) => l.id === id);
    }
    const rec = {
      id,
      at: new Date().toISOString(),
      domain,
      genomeId: genomeId || 'seed',
      qualityScore,
      source,
      lesson: String(lesson).slice(0, 500),
    };
    this.distilledLessons.unshift(rec);
    if (this.distilledLessons.length > 80) this.distilledLessons.length = 80;
    this.totalDistilledLessons += 1;

    try {
      fs.appendFileSync(this._lessonsPath(), JSON.stringify(rec) + '\n', 'utf8');
    } catch (_) {}

    // Mirror into Unicorn's real 256-dim vector RAG semantic memory if available
    try {
      const rag = require('../ai-semantic-memory');
      if (rag && typeof rag.upsert === 'function') {
        rag.upsert({
          id: 'cege:' + id,
          text: `[CEGE/${domain}] ${rec.lesson}`,
          meta: { protocol: PROTOCOL, domain, qualityScore, source },
        });
      }
    } catch (_) {}

    return rec;
  }

  recallKnowledge(query, topK = 3) {
    const q = String(query || '').trim();
    if (!q) return [];
    const results = [];
    try {
      const rag = require('../ai-semantic-memory');
      if (rag && typeof rag.search === 'function') {
        const hits = rag.search(q, Math.max(1, Math.min(10, Number(topK) || 3)));
        if (Array.isArray(hits)) {
          for (const h of hits) {
            results.push({
              id: h.id,
              score: Number((h.score || 0).toFixed(4)),
              text: h.text,
              meta: h.meta || {},
            });
          }
        }
      }
    } catch (_) {}

    if (results.length > 0) return results;

    // Deterministic lexical fallback over local distilled lessons
    const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    return this.distilledLessons
      .map((l) => {
        const hay = (l.domain + ' ' + l.lesson).toLowerCase();
        const hits = tokens.filter((t) => hay.includes(t)).length;
        return { id: l.id, score: tokens.length ? Number((hits / tokens.length).toFixed(4)) : 0, text: l.lesson, meta: { domain: l.domain, qualityScore: l.qualityScore } };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 4. Collect Real Cross-Module Live Telemetry Snapshot (Zero Fabrication)
   */
  collectLiveSystemTelemetry() {
    const snap = {
      at: new Date().toISOString(),
      immunityScore: null,
      supplyChainVulnerabilities: null,
      llmActiveRails: 0,
      llmPrimaryModel: null,
      llmRefinements: 0,
      sagsCapsules: 0,
      aspeMappedServices: 0,
      acmeTeasersRun: 0,
      acmeReferrals: 0,
    };

    try {
      const asri = require('../autonomous-runtime-immunity');
      const cert = asri.getImmunityCertificate();
      if (cert && cert.payload && cert.payload.immunityScore) {
        snap.immunityScore = cert.payload.immunityScore.total;
      }
      const sc = asri.auditSupplyChain();
      if (sc && typeof sc.knownVulnerabilities === 'number') {
        snap.supplyChainVulnerabilities = sc.knownVulnerabilities;
      }
    } catch (_) {}

    try {
      const nsc = require('../neural-swarm-llm-cascade');
      const h = nsc.health();
      snap.llmActiveRails = h.activeRailsCount || 0;
      snap.llmPrimaryModel = h.primaryModel || null;
      snap.llmRefinements = nsc.totalRefinements || 0;
    } catch (_) {}

    try {
      const sags = require('../seo-aeo-geo-singularity');
      const a = sags.auditTriLayerMatrix();
      snap.sagsCapsules = (a.aeoCapsules || 0) + (a.geoCapsules || 0);
    } catch (_) {}

    try {
      const aspe = require('../autonomous-service-provisioning');
      const st = aspe.getStatus();
      snap.aspeMappedServices = st.mappedServicesCount || 0;
    } catch (_) {}

    try {
      const acme = require('../autonomous-client-magnet');
      const h = acme.health();
      snap.acmeTeasersRun = h.teasersRun || 0;
      snap.acmeReferrals = h.activeReferralCodes || 0;
    } catch (_) {}

    return snap;
  }

  /**
   * 5. Execute Shadow-Verified Autonomous Evolution Generation
   * - Synthesizes candidate mutation & signed architectural Innovation RFC
   * - Benchmarks Challenger vs Champion on 5-pillar rubric
   * - Promotes ONLY on strict score gain >= +2.0 with zero safety regression
   * - Never mutates source files directly (safe under UNICORN_RUNTIME_PROFILE=stable)
   */
  async evolveGeneration({ domain = null, allowLiveLlm = false } = {}) {
    this.generation += 1;
    const telemetry = this.collectLiveSystemTelemetry();

    // Pick lowest-scoring domain (weakest-link optimization) unless explicitly specified
    let targetDomainKey = domain;
    if (!targetDomainKey || !this.domains.has(targetDomainKey)) {
      let lowest = Infinity;
      for (const [k, d] of this.domains.entries()) {
        const champ = d.genomes.find((g) => g.id === d.championId) || d.genomes[0];
        const champScore = champ ? this.benchmarkDirective(champ.directive, k).score : 0;
        if (champScore < lowest) {
          lowest = champScore;
          targetDomainKey = k;
        }
      }
    }

    const dom = this.domains.get(targetDomainKey);
    const champion = dom.genomes.find((g) => g.id === dom.championId) || dom.genomes[0];
    const championBench = this.benchmarkDirective(champion.directive, targetDomainKey);

    const template = EXPERT_MUTATION_TEMPLATES[(this.generation - 1) % EXPERT_MUTATION_TEMPLATES.length];
    let mutatedDirective = champion.directive.includes(template.suffix)
      ? champion.directive
      : `${champion.directive} ${template.suffix}`;
    let synthesizer = 'deterministic_expert_mutator';

    // Optional live frontier swarm co-synthesis (Groq 120B + OpenRouter 550B) when enabled outside test mode
    if (allowLiveLlm && process.env.NODE_ENV !== 'test') {
      try {
        const nsc = require('../neural-swarm-llm-cascade');
        const res = await nsc.synthesizeWithSwarm({
          system: 'You are ZeusAI CEGE/1.0 Principal Evolution Architect. Return ONLY one crisp, concrete 2-sentence engineering directive (<=320 chars) that elevates the incumbent strategy with zero safety regressions.',
          prompt: `Domain: ${dom.label}\nObjective: ${dom.objective}\nIncumbent directive: ${champion.directive}\nTelemetry: immunity=${telemetry.immunityScore}, llmRails=${telemetry.llmActiveRails}, services=${telemetry.aspeMappedServices}\nPropose a strictly stronger, zero-trust, measurable evolution directive:`,
          maxTokens: 140,
          timeoutMs: 9000,
        });
        if (res && res.ok && res.content && res.content.length >= 60 && res.content.length <= 480) {
          const llmCandidateBench = this.benchmarkDirective(res.content, targetDomainKey);
          const tplCandidateBench = this.benchmarkDirective(mutatedDirective, targetDomainKey);
          if (llmCandidateBench.safe && llmCandidateBench.score >= tplCandidateBench.score) {
            mutatedDirective = res.content.replace(/\s+/g, ' ').trim();
            synthesizer = `${res.provider}:${res.model}`;
          }
        }
      } catch (_) {}
    }

    const challengerId = `gen_${targetDomainKey.slice(0, 6)}_g${this.generation}_${template.tag.slice(0, 6)}`;
    const challengerBench = this.benchmarkDirective(mutatedDirective, targetDomainKey);
    const delta = Number((challengerBench.score - championBench.score).toFixed(2));
    const promoted = challengerBench.safe && delta >= 2.0;

    const challenger = {
      id: challengerId,
      domain: targetDomainKey,
      generation: this.generation,
      directive: mutatedDirective,
      pillars: challengerBench.pillars,
      alpha: promoted ? 4 : 2,
      beta: 1,
      samples: 1,
      meanQuality: challengerBench.score,
      avgLatencyMs: champion.avgLatencyMs,
      status: promoted ? 'active' : 'shadow_rejected',
      isChampion: promoted,
      createdAt: new Date().toISOString(),
    };

    if (promoted) {
      champion.isChampion = false;
      this.previousChampions.set(targetDomainKey, champion);
      dom.championId = challenger.id;
      dom.genomes.push(challenger);
      if (dom.genomes.length > 6) {
        dom.genomes = [challenger, champion].concat(dom.genomes.filter((g) => g.id !== challenger.id && g.id !== champion.id).slice(-4));
      }
      this.totalPromotions += 1;
      this.distillLesson({
        domain: targetDomainKey,
        genomeId: challenger.id,
        qualityScore: challengerBench.score,
        lesson: `Generation #${this.generation} promoted ${challenger.id} (+${delta} pts over ${champion.id}) via ${template.tag}: ${template.bonusHint}`,
        source: 'cege_shadow_evolution',
      });
    }

    // Generate concrete signed Innovation RFC for operator & autonomous roadmap visibility
    const rfc = {
      id: `rfc_g${this.generation}_${sha256Hex(targetDomainKey + '|' + this.generation).slice(0, 8)}`,
      generation: this.generation,
      at: new Date().toISOString(),
      domain: targetDomainKey,
      title: `Autonomous Evolution Gen #${this.generation}: ${dom.label} (${template.tag})`,
      synthesizer,
      championScore: championBench.score,
      challengerScore: challengerBench.score,
      delta,
      decision: promoted ? 'PROMOTED_TO_CHAMPION' : 'RETAINED_INCUMBENT_CHAMPION',
      rationale: promoted
        ? `Challenger ${challengerId} outperformed incumbent ${champion.id} by +${delta} pts on 5-pillar shadow benchmark with zero safety regressions.`
        : `Incumbent ${champion.id} (${championBench.score}/100) retained; challenger (${challengerBench.score}/100) did not exceed +2.0 pt promotion gate.`,
      telemetrySnapshot: telemetry,
    };
    this.innovationRfcs.unshift(rfc);
    if (this.innovationRfcs.length > 25) this.innovationRfcs.length = 25;

    const ledgerEntry = this._appendSignedLedgerEntry(
      promoted ? 'GENOME_PROMOTED' : 'SHADOW_EVALUATION_RETAINED',
      {
        rfcId: rfc.id,
        domain: targetDomainKey,
        championId: dom.championId,
        challengerId,
        championScore: championBench.score,
        challengerScore: challengerBench.score,
        delta,
        synthesizer,
      }
    );

    return {
      ok: true,
      protocol: PROTOCOL,
      generation: this.generation,
      domain: targetDomainKey,
      promoted,
      delta,
      championId: dom.championId,
      rfc,
      ledgerEntryHash: ledgerEntry.entryHash,
    };
  }

  /**
   * 6. Verify Cryptographic Hash-Chain & Ed25519 Signatures
   */
  verifyLedgerChain() {
    this._syncLedgerFromDisk();
    let valid = true;
    const issues = [];
    for (let i = 0; i < this.ledger.length; i++) {
      const entry = this.ledger[i];
      const expectedPrev = i === 0 ? '0'.repeat(64) : this.ledger[i - 1].entryHash;
      if (i > 0 && entry.prevHash !== expectedPrev) {
        valid = false;
        issues.push(`chain_break_at_index_${entry.index}`);
      }
      const body = {
        index: entry.index,
        protocol: entry.protocol,
        generation: entry.generation,
        eventType: entry.eventType,
        at: entry.at,
        prevHash: entry.prevHash,
        mutatesSource: entry.mutatesSource,
        inventsGmv: entry.inventsGmv,
        details: entry.details,
      };
      const recomputedHash = sha256Hex(canonicalJson(body));
      if (recomputedHash !== entry.entryHash) {
        valid = false;
        issues.push(`hash_mismatch_at_index_${entry.index}`);
      }
      try {
        const pubKey = crypto.createPublicKey({
          key: Buffer.from(entry.publicKeyBase64 || this.keys.publicKeyBase64, 'base64'),
          format: 'der',
          type: 'spki',
        });
        const okSig = crypto.verify(
          null,
          Buffer.from(canonicalJson({ entryHash: entry.entryHash, body }), 'utf8'),
          pubKey,
          Buffer.from(entry.signature, 'base64')
        );
        if (!okSig) {
          valid = false;
          issues.push(`signature_invalid_at_index_${entry.index}`);
        }
      } catch (_) {
        valid = false;
        issues.push(`signature_verify_error_at_index_${entry.index}`);
      }
    }
    return {
      ok: valid,
      protocol: PROTOCOL,
      entriesChecked: this.ledger.length,
      issues,
      keySource: this.keys.keySource,
    };
  }

  getEvolutionLedger() {
    const domainSummaries = [];
    for (const d of this.domains.values()) {
      const champ = d.genomes.find((g) => g.id === d.championId) || d.genomes[0];
      domainSummaries.push({
        domain: d.id,
        label: d.label,
        championId: d.championId,
        championDirective: champ ? champ.directive : '',
        championScore: champ ? this.benchmarkDirective(champ.directive, d.id).score : 0,
        meanLiveQuality: champ ? champ.meanQuality : 0,
        samples: champ ? champ.samples : 0,
        activeGenomesCount: d.genomes.length,
      });
    }

    const payload = {
      protocol: PROTOCOL,
      name: 'ZeusAI Cognitive Evolution Genome & Self-Innovation Ledger',
      domain: DOMAIN,
      issuedAt: new Date().toISOString(),
      generation: this.generation,
      safetyInvariants: {
        mutatesSourceDirectly: false,
        inventsGmvOrTraffic: false,
        shadowBenchmarkGateDelta: 2.0,
        autoRollbackRegressionThresholdPts: 8.0,
      },
      totals: {
        domainsManaged: this.domains.size,
        observations: this.totalObservations,
        promotions: this.totalPromotions,
        rollbacks: this.totalRollbacks,
        distilledLessons: this.totalDistilledLessons,
        ledgerEntries: this.ledger.length,
      },
      chainIntegrity: this.verifyLedgerChain(),
      domains: domainSummaries,
      recentRfcs: this.innovationRfcs.slice(0, 8),
      recentDistilledLessons: this.distilledLessons.slice(0, 8),
      recentLedgerEntries: this.ledger.slice(-8).reverse(),
    };

    const payloadHash = sha256Hex(canonicalJson(payload));
    const signature = this._signPayload({ payloadHash, payload });

    return {
      ok: true,
      payload,
      attestation: {
        algorithm: 'Ed25519',
        keySource: this.keys.keySource,
        payloadHash,
        signature,
        publicKeyBase64: this.keys.publicKeyBase64,
      },
    };
  }

  getStatus() {
    const led = this.getEvolutionLedger();
    return {
      ok: true,
      protocol: PROTOCOL,
      startedAt: this.startedAt,
      generation: this.generation,
      domainsManaged: this.domains.size,
      totals: led.payload.totals,
      chainIntegrity: led.payload.chainIntegrity,
      domains: led.payload.domains,
      recentRfcs: led.payload.recentRfcs.slice(0, 5),
    };
  }

  health() {
    const chain = this.verifyLedgerChain();
    return {
      ok: chain.ok && this.domains.size === 6,
      protocol: PROTOCOL,
      generation: this.generation,
      domainsManaged: this.domains.size,
      chainValid: chain.ok,
      ledgerEntries: this.ledger.length,
      distilledLessons: this.totalDistilledLessons,
    };
  }
}

const engine = new CognitiveEvolutionGenomeEngine();
module.exports = engine;
