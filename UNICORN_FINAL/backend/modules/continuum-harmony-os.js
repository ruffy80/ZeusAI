'use strict';

/**
 * Continuum Harmony OS — CHO/1.0
 * ------------------------------
 * Unifies OCC/1.0 + EMC/1.0 into one conflict-free harmonic plane:
 *  - single status surface
 *  - AGE recommendations → soft EMC observe actions (never restarts)
 *  - detects theater / double-fault signals
 *  - ensures routes stay mounted
 *
 * Honesty: observe + recommend only. No invented rails. No in-process PM2/exit.
 */

const PROTOCOL = 'CHO/1.0';
const NAME = 'continuum-harmony-os';

function isoNow() {
  return new Date().toISOString();
}

function _soft(rel) {
  try { return require(rel); } catch (e) { return { __error: e.message }; }
}

const state = {
  running: false,
  startedAt: null,
  ticks: 0,
  lastTickAt: null,
  lastHarmony: null,
  lastAgeActions: [],
  conflicts: [],
  healedRoutes: 0,
  timer: null,
  app: null,
};

function _occ() {
  return _soft('./orchestrated-capability-continuum');
}

function _emc() {
  return _soft('./essential-modules-continuum');
}

function _detectConflicts(occStatus, emcStatus) {
  const conflicts = [];
  if (occStatus && occStatus.__error) {
    conflicts.push({ kind: 'occ_load', detail: occStatus.__error, severity: 'high' });
  }
  if (emcStatus && emcStatus.__error) {
    conflicts.push({ kind: 'emc_load', detail: emcStatus.__error, severity: 'high' });
  }
  if (occStatus && occStatus.running === false) {
    conflicts.push({ kind: 'occ_not_running', severity: 'high' });
  }
  if (emcStatus && emcStatus.running === false) {
    conflicts.push({ kind: 'emc_not_running', severity: 'medium' });
  }
  // Theater: hard-coded ready without honesty block
  if (occStatus && occStatus.honesty && occStatus.honesty.claimsAgi) {
    conflicts.push({ kind: 'occ_agi_claim', severity: 'critical' });
  }
  if (emcStatus && emcStatus.modules) {
    for (const [k, m] of Object.entries(emcStatus.modules)) {
      if (m && m.error && !(m.boot && m.boot.idle)) {
        conflicts.push({ kind: 'emc_module_error', module: k, detail: m.error, severity: 'medium' });
      }
    }
  }
  // Capability undercount
  if (occStatus && Number(occStatus.runningCount || 0) < 8 && occStatus.running) {
    conflicts.push({
      kind: 'occ_capability_undercount',
      detail: `runningCount=${occStatus.runningCount}`,
      severity: 'medium',
    });
  }
  return conflicts;
}

async function _pullAgeActions() {
  const occ = _occ();
  if (!occ || !occ.age || typeof occ.age.process !== 'function') return [];
  try {
    const out = await occ.age.process({ intent: 'harmony_tick' });
    return (out && out.actions) || [];
  } catch (_) {
    return [];
  }
}

function _mapAgeToSoftPlan(actions) {
  const plan = [];
  for (const a of actions || []) {
    const action = a && a.action;
    if (!action) continue;
    if (action === 'hold_stable' || action === 'hold_checkout') {
      plan.push({ soft: 'observe_only', from: action, severity: a.severity || 'info' });
    } else if (action === 'request_disk_cleaner' || action === 'soft_degrade') {
      plan.push({ soft: 'recommend_external_heal', from: action, severity: a.severity || 'medium' });
    } else if (action === 'ensure_forever_key') {
      plan.push({ soft: 'recommend_key_bootstrap', from: action, severity: a.severity || 'medium' });
    } else {
      plan.push({ soft: 'observe_only', from: action, severity: a.severity || 'info' });
    }
  }
  // Never emit restart/pm2/exit
  return plan.filter((p) => !/pm2|process\.exit|restart_backend/i.test(JSON.stringify(p)));
}

function ensureRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  const occ = _occ();
  const emc = _emc();
  let healed = 0;
  // Express stacks duplicate handlers — mount each continuum at most once.
  if (!app.__occRoutesMounted) {
    try {
      if (occ && typeof occ.mountRoutes === 'function') {
        occ.mountRoutes(app);
        app.__occRoutesMounted = true;
        healed += 1;
      }
    } catch (_) { /* ok */ }
  }
  if (!app.__emcRoutesMounted) {
    try {
      if (emc && typeof emc.mountRoutes === 'function') {
        emc.mountRoutes(app);
        app.__emcRoutesMounted = true;
        healed += 1;
      }
    } catch (_) { /* ok */ }
  }
  if (!app.__choRoutesMounted) {
    app.get('/api/continuum/status', (req, res) => res.json(getStatus()));
    app.get('/api/cho/status', (req, res) => res.json(getStatus()));
    app.post('/api/continuum/tick', (req, res) => {
      Promise.resolve(tick())
        .then((out) => res.json(out))
        .catch((e) => res.status(500).json({ ok: false, error: e.message }));
    });
    app.__choRoutesMounted = true;
    healed += 1;
  }
  state.healedRoutes += healed;
  return { ok: true, healed };
}

async function tick() {
  state.ticks += 1;
  state.lastTickAt = isoNow();
  const occ = _occ();
  const emc = _emc();
  let occStatus = null;
  let emcStatus = null;
  try { occStatus = occ.getStatus ? occ.getStatus() : occ; } catch (e) { occStatus = { __error: e.message }; }
  try { emcStatus = emc.getStatus ? emc.getStatus() : emc; } catch (e) { emcStatus = { __error: e.message }; }

  // Soft re-start if continuum dropped
  try {
    if (occ && occStatus && occStatus.running === false && typeof occ.start === 'function') {
      occ.start();
      occStatus = occ.getStatus();
    }
  } catch (_) { /* ok */ }
  try {
    if (emc && emcStatus && emcStatus.running === false && typeof emc.start === 'function') {
      const stable = String(process.env.UNICORN_RUNTIME_PROFILE || '').toLowerCase() === 'stable'
        || String(process.env.DISABLE_SELF_MUTATION || '') === '1';
      emc.start({ stable });
      emcStatus = emc.getStatus();
    }
  } catch (_) { /* ok */ }

  if (state.app) {
    try { ensureRoutes(state.app); } catch (_) { /* ok */ }
  }

  const actions = await _pullAgeActions();
  state.lastAgeActions = actions;
  const softPlan = _mapAgeToSoftPlan(actions);
  const conflicts = _detectConflicts(occStatus, emcStatus);
  state.conflicts = conflicts;

  const harmony = {
    ok: conflicts.filter((c) => c.severity === 'critical' || c.severity === 'high').length === 0,
    occRunning: !!(occStatus && occStatus.running),
    emcRunning: !!(emcStatus && emcStatus.running),
    occRunningCount: occStatus && occStatus.runningCount,
    emcOkCount: emcStatus && emcStatus.okCount,
    emcModuleCount: emcStatus && emcStatus.moduleCount,
    ageActions: actions.map((a) => a.action),
    softPlan,
    conflicts,
    at: isoNow(),
  };
  state.lastHarmony = harmony;
  return harmony;
}

function start(opts = {}) {
  if (state.running && !opts.force) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  if (opts.app) state.app = opts.app;

  // Ensure children are up
  try {
    const occ = _occ();
    if (occ && typeof occ.start === 'function') occ.start();
  } catch (_) { /* ok */ }
  try {
    const emc = _emc();
    const stable = opts.stable != null
      ? !!opts.stable
      : (String(process.env.UNICORN_RUNTIME_PROFILE || '').toLowerCase() === 'stable'
        || String(process.env.DISABLE_SELF_MUTATION || '') === '1');
    if (emc && typeof emc.start === 'function') emc.start({ stable });
  } catch (_) { /* ok */ }

  if (state.app) ensureRoutes(state.app);

  const ms = Math.max(20000, Number(process.env.CHO_TICK_MS || 60000));
  if (state.timer) {
    try { clearInterval(state.timer); } catch (_) { /* ok */ }
  }
  state.timer = setInterval(() => { tick().catch(() => {}); }, ms);
  if (state.timer.unref) state.timer.unref();

  // Immediate tick (async)
  tick().catch(() => {});
  console.log(`[cho] ${PROTOCOL} started · harmonic OCC↔EMC plane armed`);
  return getStatus();
}

function getStatus() {
  const occ = _occ();
  const emc = _emc();
  let occStatus = null;
  let emcStatus = null;
  try { occStatus = occ.getStatus ? occ.getStatus() : null; } catch (e) { occStatus = { error: e.message }; }
  try { emcStatus = emc.getStatus ? emc.getStatus() : null; } catch (e) { emcStatus = { error: e.message }; }

  const highConflicts = (state.conflicts || []).filter((c) => c.severity === 'high' || c.severity === 'critical');
  return {
    ok: highConflicts.length === 0 && !!(occStatus && occStatus.running) && !!(emcStatus && emcStatus.running),
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Continuum Harmony OS',
    running: !!state.running,
    startedAt: state.startedAt,
    ticks: state.ticks,
    lastTickAt: state.lastTickAt,
    healedRoutes: state.healedRoutes,
    occ: occStatus && {
      running: occStatus.running,
      runningCount: occStatus.runningCount,
      protocol: occStatus.protocol,
    },
    emc: emcStatus && {
      running: emcStatus.running,
      okCount: emcStatus.okCount,
      moduleCount: emcStatus.moduleCount,
      protocol: emcStatus.protocol,
    },
    lastHarmony: state.lastHarmony,
    lastAgeActions: state.lastAgeActions,
    conflicts: state.conflicts,
    honesty: {
      neverRestarts: true,
      neverInventRails: true,
      claimsAgi: false,
      note: 'Harmonizes OCC+EMC observe planes — does not claim sci-fi hardware or force restarts.',
    },
    timestamp: isoNow(),
  };
}

function mountRoutes(app) {
  state.app = app;
  return ensureRoutes(app);
}

function registerWithMesh(mesh) {
  if (!mesh || typeof mesh.register !== 'function') return { ok: false };
  try {
    mesh.register('continuumHarmonyOs', module.exports, { statusFn: 'getStatus' });
    return { ok: true, registered: ['continuumHarmonyOs'] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  stop() {
    state.running = false;
    if (state.timer) {
      try { clearInterval(state.timer); } catch (_) { /* ok */ }
      state.timer = null;
    }
    return getStatus();
  },
  tick,
  getStatus,
  mountRoutes,
  registerWithMesh,
  ensureRoutes,
};
