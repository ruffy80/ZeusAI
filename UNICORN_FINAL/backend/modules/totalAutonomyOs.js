'use strict';

/**
 * totalAutonomyOs.js — Total Autonomy OS (TAOS/1.0)
 * =================================================
 * Unified sense → score → decide → act-safe loop for ZeusAI Unicorn.
 *
 * Innovation: one sovereign control plane over the existing organs
 * (NDK, autonomy-spine, pre-keys, TPG, QIS, commerce, innovation-ship)
 * so "total autonomy" is measurable, gated, and never suicidal.
 *
 * Hard safety envelope (cannot be crossed by this module):
 *   - Never process.exit / kill / pm2 restart
 *   - Never enable file mutators or self-construction apply
 *   - Never invent payment/email secrets
 *   - Safe arm only starts observe/heal/business loops already in-repo
 *
 * Doctrine: automate execution + recovery; owner stays sovereign for
 * secrets, legal, and high-risk mutation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const NAME = 'total-autonomy-os';
const PROTOCOL = 'TAOS/1.0';

const TICK_MS = Math.max(15000, parseInt(process.env.TAOS_TICK_MS || '60000', 10));
const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'autonomy');
const STATE_FILE = path.join(STATE_DIR, 'os-state.json');
const HISTORY_MAX = 40;

function safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function envTruthy(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function gradeFor(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

class TotalAutonomyOs {
  constructor() {
    this._bus = new EventEmitter();
    this._bus.setMaxListeners(40);
    this.name = NAME;
    this.protocol = PROTOCOL;
    this.startedAt = null;
    this._running = false;
    this._timer = null;
    this._tickCount = 0;
    this._lastSnapshot = null;
    this._history = [];
    this._armedSafe = false;
    this._lastArm = null;
    this._actions = [];
  }

  on(ev, fn) { this._bus.on(ev, fn); return this; }
  emit(ev, payload) { return this._bus.emit(ev, payload); }

  start(opts = {}) {
    if (this._running) return this.getStatus();
    this._running = true;
    this.startedAt = Date.now();
    this._ensureDir();
    this._loadState();

    // Boot spine if present — observe/attest only; never mutates process.
    try {
      const spine = safeRequire('./autonomy-spine');
      if (spine && typeof spine.start === 'function' && !spine._running) {
        spine.start();
        this._recordAction({ kind: 'spine_start', ok: true });
      }
    } catch (e) {
      this._recordAction({ kind: 'spine_start', ok: false, error: e && e.message });
    }

    if (opts.immediate !== false) {
      try { this.tick(); } catch (_) { /* never throw on boot */ }
    }

    if (process.env.NODE_ENV !== 'test' && process.env.TAOS_DISABLED !== '1') {
      this._timer = setInterval(() => {
        try { this.tick(); } catch (e) {
          this._recordAction({ kind: 'tick_error', ok: false, error: e && e.message });
        }
      }, TICK_MS);
      if (this._timer.unref) this._timer.unref();
    }

    // Optional auto-arm of SAFE business loops (still no file mutators).
    if (envTruthy('TOTAL_AUTONOMY_SAFE_ARM', false) || envTruthy('TAOS_SAFE_ARM', false)) {
      try { this.armSafe({ source: 'env' }); } catch (_) { /* ignore */ }
    }

    console.log(`[${NAME}] ${PROTOCOL} started · tick=${TICK_MS}ms`);
    return this.getStatus();
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    return { ok: true, stopped: true };
  }

  _ensureDir() {
    try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch (_) { /* tolerate */ }
  }

  _loadState() {
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (raw && Array.isArray(raw.history)) this._history = raw.history.slice(0, HISTORY_MAX);
      if (raw && raw.armedSafe) this._armedSafe = !!raw.armedSafe;
    } catch (_) { /* tolerate corrupt state */ }
  }

  _persist(snapshot) {
    this._ensureDir();
    try {
      const payload = {
        protocol: PROTOCOL,
        updatedAt: new Date().toISOString(),
        armedSafe: this._armedSafe,
        score: snapshot.score,
        grade: snapshot.grade,
        mode: snapshot.mode,
        snapshot,
        history: this._history,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2));
    } catch (e) {
      this._recordAction({ kind: 'persist', ok: false, error: e && e.message });
    }
  }

  _recordAction(entry) {
    this._actions.unshift(Object.assign({ ts: new Date().toISOString() }, entry));
    if (this._actions.length > 60) this._actions.length = 60;
  }

  _pillar(id, weight, ok, detail, scoreOverride) {
    const pass = !!ok;
    const score = scoreOverride != null ? clamp(scoreOverride, 0, 100) : (pass ? 100 : 0);
    return {
      id,
      weight,
      ok: pass,
      score,
      weighted: Math.round((weight * score) / 100),
      detail: detail || (pass ? 'ok' : 'not_ready'),
    };
  }

  _sensePillars() {
    const pillars = [];

    // 1) Never-Down Kernel
    let ndkOk = false;
    let ndkDetail = 'unavailable';
    let ndkScore = 0;
    try {
      const ndk = safeRequire('./never-down-kernel');
      const st = ndk && typeof ndk.getStatus === 'function' ? ndk.getStatus() : null;
      if (st) {
        ndkOk = st.neverKill === true && st.health !== 'critical';
        ndkScore = st.health === 'good' ? 100 : st.health === 'degraded' ? 60 : 20;
        ndkDetail = `health=${st.health};lagP95=${st.lagP95Ms || 0}ms`;
      }
    } catch (e) { ndkDetail = e && e.message; }
    pillars.push(this._pillar('never_down', 18, ndkOk, ndkDetail, ndkScore));

    // 2) Autonomy spine governance
    let spineOk = false;
    let spineDetail = 'unavailable';
    let spineScore = 40;
    let spineMode = 'UNKNOWN';
    try {
      const spine = safeRequire('./autonomy-spine');
      const st = spine && typeof spine.getStatus === 'function' ? spine.getStatus() : null;
      if (st) {
        spineMode = st.mode || st.governance || 'EXPLOIT';
        spineOk = ['EXPLORE', 'EXPLOIT', 'PROTECT', 'FREEZE'].includes(String(spineMode));
        spineScore = spineMode === 'EXPLORE' ? 100 : spineMode === 'EXPLOIT' ? 85
          : spineMode === 'PROTECT' ? 55 : 30;
        spineDetail = `mode=${spineMode};seq=${st.seq || 0}`;
      }
    } catch (e) { spineDetail = e && e.message; }
    pillars.push(this._pillar('spine', 14, spineOk, spineDetail, spineScore));

    // 3) Mutator safety (must stay OFF for total safe autonomy)
    const mutOff = envTruthy('DISABLE_SELF_MUTATION', true)
      && !envTruthy('ENABLE_FILE_MUTATORS', false)
      && !envTruthy('SELF_CONSTRUCTION_APPLY', false);
    pillars.push(this._pillar(
      'mutator_safety',
      12,
      mutOff,
      mutOff ? 'file_mutators_off' : 'MUTATORS_ARMED_UNSAFE',
      mutOff ? 100 : 0
    ));

    // 4) Commerce baseline (BTC + catalog presence)
    let commerceOk = false;
    let commerceDetail = 'checking';
    let commerceScore = 0;
    try {
      const btc = !!(process.env.BTC_OWNER_WALLET || process.env.BTC_WALLET_ADDRESS
        || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
      let catalogN = 0;
      try {
        const cat = safeRequire('../../src/commerce/unified-catalog');
        const all = cat && typeof cat.all === 'function' ? cat.all() : [];
        catalogN = Array.isArray(all) ? all.length : 0;
      } catch (_) { /* optional */ }
      commerceOk = btc && catalogN > 0;
      commerceScore = commerceOk ? Math.min(100, 50 + Math.min(50, catalogN)) : (btc ? 40 : 10);
      commerceDetail = `btc=${btc ? 'armed' : 'missing'};catalog=${catalogN}`;
    } catch (e) { commerceDetail = e && e.message; }
    pillars.push(this._pillar('commerce', 14, commerceOk, commerceDetail, commerceScore));

    // 5) Pre-keys agent rails
    let pkOk = false;
    let pkDetail = 'unavailable';
    let pkScore = 0;
    try {
      const preKeys = safeRequire('./pre-keys-activation');
      const st = preKeys && typeof preKeys.getStatus === 'function' ? preKeys.getStatus() : null;
      if (st) {
        const rails = [
          st.neverDown && st.neverDown.ok,
          st.funnel && st.funnel.ok,
          st.wacp && st.wacp.ed25519,
          st.disasterRecovery && st.disasterRecovery.ok,
          st.telegram && st.telegram.tokenArmed,
        ];
        const armed = rails.filter(Boolean).length;
        pkOk = armed >= 3;
        pkScore = Math.round((armed / rails.length) * 100);
        pkDetail = `agent_rails=${armed}/${rails.length}`;
      }
    } catch (e) { pkDetail = e && e.message; }
    pillars.push(this._pillar('pre_keys', 12, pkOk, pkDetail, pkScore));

    // 6) Telegram Profit Group OS
    let tpgOk = false;
    let tpgDetail = 'unavailable';
    let tpgScore = 0;
    try {
      const tpg = safeRequire('./telegram-profit-group-os')
        || safeRequire('./telegramProfitGroupOs')
        || safeRequire('./telegram-group-os');
      const st = tpg && typeof tpg.getStatus === 'function' ? tpg.getStatus()
        : (tpg && typeof tpg.status === 'function' ? tpg.status() : null);
      if (st) {
        const started = !!(st.started || st.ok || st.running);
        const dual = !!(st.dualRail || st.dual_rail || (st.group && st.group.bound));
        tpgOk = started;
        tpgScore = started ? (dual ? 100 : 70) : 20;
        tpgDetail = `started=${started};dualRail=${dual}`;
      } else if (process.env.TELEGRAM_BOT_TOKEN) {
        tpgOk = true;
        tpgScore = 55;
        tpgDetail = 'token_present_module_status_unknown';
      }
    } catch (e) { tpgDetail = e && e.message; }
    pillars.push(this._pillar('tpg', 8, tpgOk, tpgDetail, tpgScore));

    // 7) Innovation ship gate (data-only)
    let innOk = false;
    let innDetail = 'idle';
    let innScore = 50;
    try {
      const gate = safeRequire('./innovation-ship-gate');
      const st = gate && typeof gate.getStatus === 'function' ? gate.getStatus() : null;
      if (st) {
        innOk = st.enabled !== false && st.codeApply !== true;
        innScore = innOk ? 90 : 40;
        innDetail = `enabled=${st.enabled !== false};codeApply=${!!st.codeApply}`;
      } else {
        innOk = String(process.env.INNOVATION_AUTO_SHIP || '1') !== '0';
        innScore = innOk ? 75 : 30;
        innDetail = innOk ? 'auto_ship_default_on' : 'auto_ship_off';
      }
    } catch (e) { innDetail = e && e.message; }
    pillars.push(this._pillar('innovation_ship', 6, innOk, innDetail, innScore));

    // 8) Process / host posture
    const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const rssCap = parseInt(process.env.AUTONOMY_RSS_SOFT_CAP_MB || '2300', 10);
    const rssOk = rssMb < rssCap;
    const load = os.loadavg()[0];
    const cpus = Math.max(1, os.cpus().length);
    const loadOk = load < cpus * 2.5;
    const hostOk = rssOk && loadOk;
    const hostScore = hostOk ? 100 : (!rssOk ? 25 : 55);
    pillars.push(this._pillar(
      'host',
      8,
      hostOk,
      `rssMb=${rssMb};load1=${load.toFixed(2)};cpus=${cpus}`,
      hostScore
    ));

    // 9) Runtime profile honesty
    const profile = String(process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase();
    const profileSafe = profile === 'stable' || profile === 'safe' || profile === 'growth';
    pillars.push(this._pillar(
      'runtime_profile',
      8,
      profileSafe,
      `profile=${profile};armedSafe=${this._armedSafe}`,
      profile === 'growth' || this._armedSafe ? 95 : profile === 'stable' || profile === 'safe' ? 80 : 40
    ));

    return { pillars, spineMode };
  }

  _recommend(pillars, score, mode) {
    const next = [];
    const byId = Object.fromEntries(pillars.map((p) => [p.id, p]));

    if (byId.mutator_safety && !byId.mutator_safety.ok) {
      next.push({ priority: 1, action: 'disable_file_mutators', text: 'Turn OFF ENABLE_FILE_MUTATORS / SELF_CONSTRUCTION_APPLY — keep DISABLE_SELF_MUTATION=1.' });
    }
    if (byId.tpg && byId.tpg.score < 100) {
      next.push({ priority: 2, action: 'bind_telegram_group', text: 'Owner: /bindgroup in a real Telegram group to arm TPG dual-rail.' });
    }
    if (byId.pre_keys && byId.pre_keys.score < 80) {
      next.push({ priority: 3, action: 'owner_keys_later', text: 'Optional owner keys (NOW/Stripe/PayPal/email) unlock extra rails — never invent them.' });
    }
    if (!this._armedSafe && score >= 55 && (mode === 'EXPLORE' || mode === 'EXPLOIT' || mode === 'UNKNOWN')) {
      next.push({ priority: 4, action: 'arm_safe_business', text: 'POST /api/autonomy/os/arm (admin) to start SAFE business heal/orchestrator loops without mutators.' });
    }
    if (byId.host && !byId.host.ok) {
      next.push({ priority: 1, action: 'relieve_pressure', text: 'RSS/load high — keep profile stable; do not arm full growth until pressure clears.' });
    }
    if (score >= 80) {
      next.push({ priority: 5, action: 'keep_forward_deploy', text: 'Keep OOB/canary forward deploys; healer kill-switch stays until GH Actions unblocked.' });
    }
    if (!next.length) {
      next.push({ priority: 9, action: 'hold_course', text: 'Autonomy OS healthy — continue observe + heal + commerce.' });
    }
    return next.sort((a, b) => a.priority - b.priority).slice(0, 6);
  }

  _selfSmoke() {
    const probes = [];
    const push = (name, ok, note) => probes.push({ name, ok: !!ok, note: note || '' });

    try {
      const ndk = safeRequire('./never-down-kernel');
      const st = ndk && ndk.getStatus && ndk.getStatus();
      push('never-down', !!(st && st.neverKill), st && st.health);
    } catch (e) { push('never-down', false, e.message); }

    try {
      const spine = safeRequire('./autonomy-spine');
      const st = spine && spine.getStatus && spine.getStatus();
      push('spine', !!st, st && st.mode);
    } catch (e) { push('spine', false, e.message); }

    try {
      const preKeys = safeRequire('./pre-keys-activation');
      const st = preKeys && preKeys.getStatus && preKeys.getStatus();
      push('pre-keys', !!st, st && st.protocol);
    } catch (e) { push('pre-keys', false, e.message); }

    try {
      const qis = safeRequire('./quantumIntegrityShield');
      const st = qis && qis.getStatus && qis.getStatus();
      push('qis', !!st, st && (st.active != null ? `active=${st.active}` : 'present'));
    } catch (e) { push('qis', false, e.message); }

    const passed = probes.filter((p) => p.ok).length;
    return {
      ok: passed === probes.length,
      passed,
      total: probes.length,
      probes,
    };
  }

  tick() {
    this._tickCount += 1;
    const { pillars, spineMode } = this._sensePillars();
    const weightSum = pillars.reduce((s, p) => s + p.weight, 0) || 1;
    const score = Math.round(pillars.reduce((s, p) => s + p.weighted, 0) * (100 / weightSum));
    const grade = gradeFor(score);
    const smoke = this._selfSmoke();
    const next = this._recommend(pillars, score, spineMode);
    const mode = spineMode || 'EXPLOIT';

    const snapshot = {
      ok: true,
      protocol: PROTOCOL,
      name: NAME,
      ts: new Date().toISOString(),
      tick: this._tickCount,
      score,
      grade,
      mode,
      armedSafe: this._armedSafe,
      doctrine: 'Automate execution and recovery; never invent secrets; never self-mutate source; forward-only canary deploys.',
      pillars,
      smoke,
      next,
      actions: this._actions.slice(0, 12),
      lastArm: this._lastArm,
      runtime: {
        profile: process.env.UNICORN_RUNTIME_PROFILE || 'stable',
        disableSelfMutation: envTruthy('DISABLE_SELF_MUTATION', true),
        fileMutators: envTruthy('ENABLE_FILE_MUTATORS', false),
        autoRestart: envTruthy('ENABLE_AUTO_RESTART', false),
        uptimeSec: Math.floor(process.uptime()),
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      },
      links: {
        status: '/api/autonomy/os',
        score: '/api/autonomy/score',
        spine: '/api/spine/status',
        preKeys: '/api/pre-keys/status',
        health: '/api/health',
        cockpit: '/status',
      },
    };

    this._lastSnapshot = snapshot;
    this._history.unshift({
      ts: snapshot.ts,
      score,
      grade,
      mode,
      smokeOk: smoke.ok,
    });
    if (this._history.length > HISTORY_MAX) this._history.length = HISTORY_MAX;
    this._persist(snapshot);
    this.emit('tick', snapshot);
    return snapshot;
  }

  /**
   * Arm SAFE business autonomy: orchestrator + healers + profit loop.
   * Explicitly refuses file mutators / auto-restart / self-construction apply.
   */
  armSafe(opts = {}) {
    if (envTruthy('ENABLE_FILE_MUTATORS', false) || envTruthy('SELF_CONSTRUCTION_APPLY', false)) {
      return {
        ok: false,
        refused: true,
        reason: 'file_mutators_or_self_construction_apply_enabled',
        hint: 'Disable ENABLE_FILE_MUTATORS and SELF_CONSTRUCTION_APPLY first.',
      };
    }

    const results = [];
    const tryStart = (label, fn) => {
      try {
        fn();
        results.push({ module: label, armed: true });
      } catch (e) {
        results.push({ module: label, armed: false, error: e && e.message });
      }
    };

    tryStart('autonomy-spine', () => {
      const spine = safeRequire('./autonomy-spine');
      if (spine && typeof spine.start === 'function') spine.start();
    });

    tryStart('central-orchestrator', () => {
      const orch = safeRequire('./central-orchestrator');
      if (!orch) return;
      const s = typeof orch.getStatus === 'function' ? orch.getStatus() : {};
      if (!s.running && typeof orch.start === 'function') orch.start();
    });

    tryStart('self-healing-engine', () => {
      const sh = safeRequire('./self-healing-engine');
      const orch = safeRequire('./central-orchestrator');
      if (!sh) return;
      const s = typeof sh.getStatus === 'function' ? sh.getStatus() : {};
      if (!s.active && typeof sh.start === 'function') {
        sh.start();
        if (orch && typeof sh.attachOrchestrator === 'function') sh.attachOrchestrator(orch);
      }
    });

    tryStart('quantumIntegrityShield', () => {
      const qis = safeRequire('./quantumIntegrityShield');
      if (!qis) return;
      const s = typeof qis.getStatus === 'function' ? qis.getStatus() : {};
      if (!s.active && typeof qis.start === 'function') qis.start();
    });

    tryStart('profit-control-loop', () => {
      const pl = safeRequire('./profit-control-loop') || safeRequire('./profitControlLoop');
      if (!pl || typeof pl.start !== 'function') return;
      const s = typeof pl.getStatus === 'function' ? pl.getStatus() : {};
      if (!s.active && !s.running) pl.start();
    });

    tryStart('ai-self-healing', () => {
      const ai = safeRequire('./ai-self-healing');
      if (ai && typeof ai.init === 'function') ai.init();
    });

    // Explicitly do NOT start autoInnovationLoop file-mutation path,
    // autoDeploy, auto-restart, or selfConstruction.apply.

    this._armedSafe = true;
    this._lastArm = {
      ts: new Date().toISOString(),
      source: opts.source || 'api',
      armed: results.filter((r) => r.armed).length,
      total: results.length,
      results,
    };
    this._recordAction({ kind: 'arm_safe', ok: true, ...this._lastArm });
    const snap = this.tick();
    return { ok: true, refused: false, arm: this._lastArm, score: snap.score, grade: snap.grade };
  }

  getScore() {
    const snap = this._lastSnapshot || this.tick();
    return {
      ok: true,
      protocol: PROTOCOL,
      score: snap.score,
      grade: snap.grade,
      mode: snap.mode,
      armedSafe: this._armedSafe,
      ts: snap.ts,
    };
  }

  getStatus() {
    if (!this._lastSnapshot) {
      try { return this.tick(); } catch (e) {
        return { ok: false, protocol: PROTOCOL, error: e && e.message };
      }
    }
    return Object.assign({}, this._lastSnapshot, {
      running: this._running,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      tickMs: TICK_MS,
    });
  }

  getHistory(limit = 20) {
    return this._history.slice(0, Math.min(HISTORY_MAX, Math.max(1, limit)));
  }
}

const singleton = new TotalAutonomyOs();

module.exports = singleton;
module.exports.TotalAutonomyOs = TotalAutonomyOs;
module.exports.PROTOCOL = PROTOCOL;
module.exports.NAME = NAME;
module.exports.gradeFor = gradeFor;
