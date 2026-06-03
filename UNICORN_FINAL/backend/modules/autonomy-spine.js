// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * AUTONOMY SPINE — Coloana de autonomie demonstrabilă / Trustworthy Autonomy Core
 * =============================================================================
 * EN: A single decision brain that turns the existing autonomous organs into a
 *     closed, *trustworthy* loop:
 *
 *        SENSE → SCORE → DECIDE(governance mode) → ATTEST(ed25519 chain) → GATE
 *          ▲                                                                │
 *          └────────────────────── learns from outcome ◄───────────────────┘
 *
 *     The differentiator (what nobody ships as one coherent product): every
 *     autonomous decision is REVERSIBLE, CRYPTOGRAPHICALLY PROVABLE and CANNOT
 *     REGRESS production. The spine never mutates the OS/process itself — it
 *     reads the real organs, computes a governance posture, signs it into an
 *     append-only ed25519 hash-chain, and exposes a GATE that the profit /
 *     experiment loops consult before they act.
 *
 * REAL ORGANS WIRED (no mocks, no stubs):
 *   - unicornMeshOrchestrator   → fleet health (totalModules / healthyModules)
 *   - slo-tracker               → p99 latency + error-budget per route
 *   - profit-attribution        → avg profit / event, baseline, reward signal
 *   - control-plane-agent       → healthScore (immutable self-healing)
 *   - circuit-breaker           → innovation gate (open/closed)
 *
 * SAFETY ENVELOPE (golden rules — the brain CANNOT cross these):
 *   - Never spawns processes, never calls pm2/kill/exit. Pure read + sign.
 *   - Memory pressure (RSS) is a first-class hard constraint → FREEZE mode.
 *   - When SLO is breached or health < floor → governance = PROTECT (no
 *     experiments allowed), regardless of how good the profit signal looks.
 *   - Append-only ledger: data/autonomy/decisions.jsonl (forward-only, never
 *     rewritten), ed25519 signature with SHA-256 hash-chain (tamper-evident).
 *
 * GOVERNANCE MODES (the posture every cycle resolves to):
 *   - EXPLORE  : everything healthy + budget healthy → experiments allowed,
 *                higher exploration rate.
 *   - EXPLOIT  : healthy but profit flat / low budget → keep winners, minimal
 *                experimentation.
 *   - PROTECT  : SLO breach or health below floor → freeze experiments, only
 *                healing runs (which is immutable anyway).
 *   - FREEZE   : resource pressure (RSS over soft cap) → freeze everything
 *                experimental until pressure clears.
 *
 * The spine is OBSERVE-AND-ATTEST by default (AUTONOMY_SPINE_ENFORCE=0). When
 * enforcement is enabled, callers MUST honor canExperiment()/getGate(); the
 * spine itself still never touches the process. Bilingual logs by design.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ── Real organs (graceful require — never crash the host on a missing dep) ──
function safeRequire(p) { try { return require(p); } catch (_) { return null; } }
const mesh           = safeRequire('./unicornMeshOrchestrator');
const sloTracker     = safeRequire('./slo-tracker');
const profitService  = safeRequire('./profit-attribution');
const controlPlane   = safeRequire('./control-plane-agent');
const circuitBreaker = safeRequire('./circuit-breaker');

// ── Config (env-overridable; safe production defaults) ──────────────────────
const TICK_MS           = parseInt(process.env.AUTONOMY_SPINE_TICK_MS || '60000', 10);   // 1 min
const ENFORCE           = String(process.env.AUTONOMY_SPINE_ENFORCE || '0') === '1';
const HEALTH_FLOOR      = parseFloat(process.env.AUTONOMY_HEALTH_FLOOR || '90');          // healthScore floor
const MESH_HEALTH_FLOOR = parseFloat(process.env.AUTONOMY_MESH_FLOOR || '0.95');          // 95% modules healthy
const RSS_SOFT_CAP_MB   = parseInt(process.env.AUTONOMY_RSS_SOFT_CAP_MB || '2300', 10);   // < PM2 2560M ceiling
const MAX_LEDGER_BYTES  = parseInt(process.env.AUTONOMY_MAX_LEDGER_BYTES || '5242880', 10); // 5MB rotate
const MAX_DECISION_LOG  = 200;

const DIR        = path.join(__dirname, '..', '..', 'data', 'autonomy');
const LEDGER     = path.join(DIR, 'decisions.jsonl');
const STATE_FILE = path.join(DIR, 'spine-state.json');
const KEY_FILE   = path.join(DIR, 'spine-ed25519.json');

const MODES = Object.freeze({ EXPLORE: 'EXPLORE', EXPLOIT: 'EXPLOIT', PROTECT: 'PROTECT', FREEZE: 'FREEZE' });

class AutonomySpine {
  constructor() {
    // NOTE: deliberately NOT extending EventEmitter. A CI code-injector adds a
    // `this.cache = new Map()` line as the first statement of every constructor;
    // in a derived class that lands before super() and crashes. Composition
    // (internal _bus) is injector-proof — this is available immediately here.
    this._bus = new EventEmitter();
    this._bus.setMaxListeners(50);
    this.name        = 'autonomy-spine';
    this.startedAt   = Date.now();
    this.seq         = 0;
    this.prevHash    = 'GENESIS';
    this.mode        = MODES.EXPLOIT;     // conservative until first real reading
    this.lastDecision = null;
    this.decisionLog = [];
    this.counts      = { EXPLORE: 0, EXPLOIT: 0, PROTECT: 0, FREEZE: 0 };
    this._timer      = null;
    this._keypair    = null;
    this._running    = false;
  }

  // EventEmitter passthrough (composition) — injector-proof public API.
  on(ev, fn) { this._bus.on(ev, fn); return this; }
  once(ev, fn) { this._bus.once(ev, fn); return this; }
  off(ev, fn) { this._bus.off(ev, fn); return this; }
  emit(ev, payload) { return this._bus.emit(ev, payload); }
  getBus() { return this._bus; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start() {
    if (this._running) return;
    this._running = true;
    this._ensureDir();
    this._loadState();
    this._loadOrCreateKeypair();
    // First reading shortly after boot, then steady cadence. unref so we never
    // hold the event loop open / block a clean shutdown.
    const t0 = setTimeout(() => this._safeTick(), 8000);
    if (t0 && t0.unref) t0.unref();
    this._timer = setInterval(() => this._safeTick(), TICK_MS);
    if (this._timer && this._timer.unref) this._timer.unref();
    console.log(`🧠 AutonomySpine pornit — observe+attest (enforce=${ENFORCE ? 'ON' : 'OFF'}, tick=${TICK_MS}ms)`);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._running = false;
  }

  _safeTick() {
    try { return this._tick(); }
    catch (e) { console.error('[AutonomySpine] tick error:', e && e.message); }
  }

  // ── SENSE: read the real organs (never throws) ────────────────────────────
  _sense() {
    const signals = { ts: Date.now() };

    // Mesh fleet health
    try {
      const m = mesh && typeof mesh.getStatus === 'function' ? mesh.getStatus() : null;
      if (m) {
        signals.mesh = {
          total: m.totalModules || 0,
          healthy: m.healthyModules || 0,
          ratio: m.totalModules ? (m.healthyModules / m.totalModules) : 1,
          meshHealthy: !!m.meshHealthy,
        };
      }
    } catch (_) { /* tolerate */ }

    // SLO — worst route in the window drives the posture
    try {
      const stats = sloTracker && typeof sloTracker.getAllStats === 'function' ? sloTracker.getAllStats() : [];
      let breached = false; let worstP99 = 0; let minBudget = 1;
      for (const s of stats) {
        if (!s) continue;
        if (s.healthy === false) breached = true;
        if (Number(s.p99) > worstP99) worstP99 = Number(s.p99) || 0;
        if (Number(s.budgetRemaining) < minBudget) minBudget = Number(s.budgetRemaining);
      }
      signals.slo = { routes: stats.length, breached, worstP99, minBudgetRemaining: stats.length ? minBudget : 1 };
    } catch (_) { /* tolerate */ }

    // Profit signal (reward = avg - baseline)
    try {
      const p = profitService && typeof profitService.getMetrics === 'function' ? profitService.getMetrics() : null;
      if (p) {
        const reward = (Number(p.averageProfitPerEvent) || 0) - (Number(p.baseline) || 0);
        signals.profit = {
          avgPerEvent: Number(p.averageProfitPerEvent) || 0,
          baseline: Number(p.baseline) || 0,
          reward,
          recentEvents: Number(p.recentEvents) || 0,
          activeExperiments: Number(p.activeExperiments) || 0,
        };
      }
    } catch (_) { /* tolerate */ }

    // Control plane health score (immutable self-healing)
    try {
      const cp = controlPlane && typeof controlPlane.getStatus === 'function' ? controlPlane.getStatus() : null;
      if (cp) signals.healthScore = Number(cp.healthScore);
    } catch (_) { /* tolerate */ }

    // Innovation circuit — getStatus() returns { state: CLOSED|OPEN|HALF_OPEN }
    try {
      const cb = circuitBreaker && typeof circuitBreaker.getStatus === 'function' ? circuitBreaker.getStatus() : null;
      if (cb) signals.circuitOpen = String(cb.state || '').toUpperCase() === 'OPEN';
    } catch (_) { /* tolerate */ }

    // Resource pressure — hard constraint
    try {
      const mu = process.memoryUsage();
      signals.rssMb = Math.round(mu.rss / 1048576);
    } catch (_) { signals.rssMb = 0; }

    return signals;
  }

  // ── DECIDE: resolve governance posture from real signals ──────────────────
  _decide(s) {
    const reasons = [];

    // 1) Resource pressure is the hardest gate → FREEZE everything experimental.
    if (s.rssMb && s.rssMb >= RSS_SOFT_CAP_MB) {
      reasons.push(`rss ${s.rssMb}MB ≥ soft cap ${RSS_SOFT_CAP_MB}MB`);
      return { mode: MODES.FREEZE, reasons, canExperiment: false };
    }

    // 2) SLO breach or fleet/health below floor → PROTECT (heal only).
    const meshRatio = s.mesh ? s.mesh.ratio : 1;
    const healthScore = Number.isFinite(s.healthScore) ? s.healthScore : 100;
    if (s.slo && s.slo.breached) reasons.push('slo breached on ≥1 route');
    if (meshRatio < MESH_HEALTH_FLOOR) reasons.push(`mesh ${(meshRatio * 100).toFixed(1)}% < floor ${(MESH_HEALTH_FLOOR * 100).toFixed(0)}%`);
    if (healthScore < HEALTH_FLOOR) reasons.push(`healthScore ${healthScore} < floor ${HEALTH_FLOOR}`);
    if (reasons.length) {
      return { mode: MODES.PROTECT, reasons, canExperiment: false };
    }

    // 3) Healthy. Innovation circuit open → EXPLOIT (keep winners, don't push).
    if (s.circuitOpen) {
      reasons.push('innovation circuit OPEN — consolidating');
      return { mode: MODES.EXPLOIT, reasons, canExperiment: false };
    }

    // 4) Healthy + circuit closed. Reward decides explore vs exploit.
    const reward = s.profit ? s.profit.reward : 0;
    const budgetOk = !s.slo || s.slo.minBudgetRemaining > 0.2; // keep 20% error budget in reserve
    if (reward > 0 && budgetOk) {
      reasons.push(`reward ${reward.toFixed(4)} > 0, budget healthy → explore`);
      return { mode: MODES.EXPLORE, reasons, canExperiment: true };
    }

    reasons.push(`reward ${reward.toFixed(4)} ≤ 0 or budget tight → exploit`);
    return { mode: MODES.EXPLOIT, reasons, canExperiment: true };
  }

  // ── ATTEST: append-only ed25519 hash-chain (tamper-evident) ───────────────
  _attest(signals, decision) {
    this.seq++;
    const ts = Date.now();
    const payload = {
      v: 1,
      ts,
      seq: this.seq,
      prevHash: this.prevHash,
      mode: decision.mode,
      canExperiment: decision.canExperiment,
      reasons: decision.reasons,
      signals,
    };
    const payloadJson = JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256').update(payloadJson).digest('hex');
    let signature = null; let alg = 'sha256-chain';
    if (this._keypair && this._keypair.privateKey) {
      try {
        signature = crypto.sign(null, Buffer.from(payloadJson), this._keypair.privateKey).toString('base64');
        alg = 'ed25519';
      } catch (_) { signature = null; }
    }
    const attestation = { ...payload, payloadHash, alg, signature };
    try {
      this._rotateIfNeeded();
      fs.appendFileSync(LEDGER, JSON.stringify(attestation) + '\n');
    } catch (e) { console.warn('[AutonomySpine] ledger append failed:', e && e.message); }

    this.prevHash = payloadHash;
    this.lastDecision = { seq: this.seq, ts, mode: decision.mode, canExperiment: decision.canExperiment, reasons: decision.reasons, payloadHash, alg };
    this.decisionLog.push(this.lastDecision);
    if (this.decisionLog.length > MAX_DECISION_LOG) this.decisionLog.shift();
    this._persistState();
    return attestation;
  }

  // ── Full cycle ────────────────────────────────────────────────────────────
  _tick() {
    const signals  = this._sense();
    const decision = this._decide(signals);
    const prevMode = this.mode;
    this.mode = decision.mode;
    this.counts[decision.mode] = (this.counts[decision.mode] || 0) + 1;

    const att = this._attest(signals, decision);

    if (prevMode !== decision.mode) {
      console.log(`🧠 AutonomySpine: ${prevMode} → ${decision.mode} (${decision.reasons.join('; ')})`);
      try { this.emit('mode:change', { from: prevMode, to: decision.mode, reasons: decision.reasons, ts: att.ts }); } catch (_) {}
    }
    try { this.emit('decision', this.lastDecision); } catch (_) {}
    return this.lastDecision;
  }

  // ── GATE: what the profit / experiment loops consult ──────────────────────
  /**
   * Returns whether an experiment/mutation is currently permitted.
   * In observe mode (ENFORCE=0) this is advisory; in enforce mode callers
   * MUST honor it. The spine never acts on its own.
   */
  canExperiment() {
    if (!this.lastDecision) return false;
    const allowed = this.lastDecision.canExperiment === true;
    return ENFORCE ? allowed : allowed; // value identical; ENFORCE governs caller obligation, documented for clarity
  }

  getGate() {
    return {
      enforce: ENFORCE,
      mode: this.mode,
      canExperiment: this.canExperiment(),
      reasons: this.lastDecision ? this.lastDecision.reasons : ['no reading yet'],
      ts: this.lastDecision ? this.lastDecision.ts : null,
    };
  }

  // ── Public status / proof API ─────────────────────────────────────────────
  getStatus() {
    return {
      module: 'autonomy-spine',
      running: this._running,
      enforce: ENFORCE,
      mode: this.mode,
      seq: this.seq,
      prevHash: this.prevHash,
      uptimeMs: Date.now() - this.startedAt,
      tickMs: TICK_MS,
      modeCounts: this.counts,
      gate: this.getGate(),
      lastDecision: this.lastDecision,
      organs: {
        mesh: !!mesh,
        sloTracker: !!sloTracker,
        profitService: !!profitService,
        controlPlane: !!controlPlane,
        circuitBreaker: !!circuitBreaker,
      },
      thresholds: {
        healthFloor: HEALTH_FLOOR,
        meshHealthFloor: MESH_HEALTH_FLOOR,
        rssSoftCapMb: RSS_SOFT_CAP_MB,
      },
      publicKey: this.getPublicKey(),
    };
  }

  getDecisions(limit = 50) {
    return this.decisionLog.slice(-Math.min(limit, MAX_DECISION_LOG));
  }

  getPublicKey() {
    try {
      return this._keypair && this._keypair.publicKeyPem ? this._keypair.publicKeyPem : null;
    } catch (_) { return null; }
  }

  /** Verify the entire signed chain. Returns { ok, length, head, breaks }. */
  verifyChain() {
    try {
      if (!fs.existsSync(LEDGER)) return { ok: true, length: 0, head: 'GENESIS', breaks: [] };
      const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
      let prev = 'GENESIS';
      const breaks = [];
      let pub = null;
      try { pub = this._keypair && this._keypair.publicKey ? this._keypair.publicKey : null; } catch (_) {}
      for (let i = 0; i < lines.length; i++) {
        let a;
        try { a = JSON.parse(lines[i]); } catch (_) { breaks.push({ at: i, reason: 'parse' }); continue; }
        const recomputed = crypto.createHash('sha256')
          .update(JSON.stringify({ v: a.v, ts: a.ts, seq: a.seq, prevHash: a.prevHash, mode: a.mode, canExperiment: a.canExperiment, reasons: a.reasons, signals: a.signals }))
          .digest('hex');
        const hashOk = recomputed === a.payloadHash;
        const linkOk = a.prevHash === prev;
        let sigOk = true;
        if (a.alg === 'ed25519' && a.signature && pub) {
          try {
            const { v, ts, seq, prevHash, mode, canExperiment, reasons, signals } = a;
            const json = JSON.stringify({ v, ts, seq, prevHash, mode, canExperiment, reasons, signals });
            sigOk = crypto.verify(null, Buffer.from(json), pub, Buffer.from(a.signature, 'base64'));
          } catch (_) { sigOk = false; }
        }
        if (!hashOk || !linkOk || !sigOk) breaks.push({ at: i, seq: a.seq, ts: a.ts, hashOk, linkOk, sigOk });
        prev = a.payloadHash;
      }
      return { ok: breaks.length === 0, length: lines.length, head: prev, breaks, alg: pub ? 'ed25519' : 'sha256-chain' };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  // ── Persistence helpers ───────────────────────────────────────────────────
  _ensureDir() { try { fs.mkdirSync(DIR, { recursive: true }); } catch (_) {} }

  _loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (st && typeof st === 'object') {
          this.seq = Number(st.seq) || 0;
          this.prevHash = st.prevHash || 'GENESIS';
          this.mode = st.mode || this.mode;
        }
      }
      // Source of truth for the chain head is the last ledger line (forward-only).
      if (fs.existsSync(LEDGER)) {
        const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
        if (lines.length) {
          const last = JSON.parse(lines[lines.length - 1]);
          if (last && last.payloadHash) { this.prevHash = last.payloadHash; this.seq = Number(last.seq) || this.seq; }
        }
      }
    } catch (_) { /* fresh start */ }
  }

  _persistState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ seq: this.seq, prevHash: this.prevHash, mode: this.mode, ts: Date.now() }));
    } catch (_) {}
  }

  _loadOrCreateKeypair() {
    try {
      if (fs.existsSync(KEY_FILE)) {
        const saved = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
        if (saved && saved.publicKeyPem && saved.privateKeyPem) {
          this._keypair = {
            publicKeyPem: saved.publicKeyPem,
            publicKey: crypto.createPublicKey(saved.publicKeyPem),
            privateKey: crypto.createPrivateKey(saved.privateKeyPem),
          };
          return;
        }
      }
    } catch (_) { /* regenerate below */ }
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const publicKeyPem  = publicKey.export({ type: 'spki', format: 'pem' });
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
      this._keypair = { publicKey, privateKey, publicKeyPem, privateKeyPem };
      try { fs.writeFileSync(KEY_FILE, JSON.stringify({ publicKeyPem, privateKeyPem }), { mode: 0o600 }); } catch (_) {}
      console.log('🔐 AutonomySpine: ed25519 keypair generated');
    } catch (e) {
      this._keypair = null;
      console.warn('[AutonomySpine] keypair generation failed, falling back to sha256-chain:', e && e.message);
    }
  }

  _rotateIfNeeded() {
    try {
      if (!fs.existsSync(LEDGER)) return;
      const sz = fs.statSync(LEDGER).size;
      if (sz < MAX_LEDGER_BYTES) return;
      // Forward-only rotation: archive, never delete the proof.
      const archived = path.join(DIR, `decisions-${Date.now()}.jsonl`);
      fs.renameSync(LEDGER, archived);
    } catch (_) {}
  }
}

const spine = new AutonomySpine();
// Module-level auto-start so the spine begins observing + attesting as soon as
// the backend requires it (mirrors the pattern of the other autonomous organs).
spine.start();

module.exports = spine;
module.exports.AutonomySpine = AutonomySpine;
module.exports.MODES = MODES;
