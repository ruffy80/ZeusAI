'use strict';

/**
 * TAAC/1.0 — Total Autonomy Activation Continuum
 *
 * Owner ask: turn the Unicorn ON — every honest organ running forever.
 *
 * Rules (never break):
 *   - Never invent GMV, SERP, social reach, or press placements
 *   - Never enable file mutators / self-construction apply / UEE rewrite
 *   - Credential-gated outbound: skip with reason when keys missing
 *   - Safe to run under UNICORN_RUNTIME_PROFILE=stable
 *
 * Arms (idempotent, fail-soft):
 *   TCC → TAOS.armSafe → BALOS → traffic → growth-brain → AACOS →
 *   AGDE → RIVOS → AMOS/MDSP → lead-hunter (when TG/email) →
 *   auto-marketing (when forced/keys) → social viralizer ensure
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'TAAC/1.0';
const INVENTION = 'Total Autonomy Activation Continuum';
const DATA_DIR = process.env.TAAC_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'taac');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TICK_MS = Math.max(60_000, Number(process.env.TAAC_TICK_MS || 5 * 60_000));
const ENABLED = process.env.TAAC_DISABLED !== '1';

const _counts = {
  ticks: 0,
  arms: 0,
  rearmed: 0,
  skips: 0,
  errors: 0,
};

let _timer = null;
let _state = {
  protocol: PROTOCOL,
  startedAt: null,
  lastTickAt: null,
  lastArm: null,
  organs: {},
};

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _persist() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      protocol: PROTOCOL,
      updatedAt: new Date().toISOString(),
      startedAt: _state.startedAt,
      lastTickAt: _state.lastTickAt,
      lastArm: _state.lastArm,
      organs: _state.organs,
      counts: _counts,
    }, null, 2));
  } catch (_) { /* ignore */ }
}

function _safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function _envOn(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').toLowerCase());
}

function _record(id, result) {
  _state.organs[id] = Object.assign({ at: new Date().toISOString() }, result || {});
  return _state.organs[id];
}

function _try(id, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then((v) => _record(id, v || { ok: true })).catch((e) => {
        _counts.errors += 1;
        return _record(id, { ok: false, error: String(e && e.message || e).slice(0, 120) });
      });
    }
    return Promise.resolve(_record(id, r || { ok: true }));
  } catch (e) {
    _counts.errors += 1;
    return Promise.resolve(_record(id, { ok: false, error: String(e && e.message || e).slice(0, 120) }));
  }
}

function telegramReady() {
  try {
    const tcc = _safeRequire('./telegram-credential-continuum');
    if (tcc && typeof tcc.ensureArmed === 'function') {
      const s = tcc.ensureArmed();
      return !!(s && (s.readyForOwnerAlert || s.readyForGroupMoney));
    }
  } catch (_) { /* ignore */ }
  return !!(
    (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.ZAC_TELEGRAM_TOKEN)
    && (process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID || process.env.ZEUS_TG_GROUP_CHAT_ID || process.env.ZAC_TELEGRAM_CHAT_ID)
  );
}

function emailReady() {
  const smtpTriplet = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return !!(
    process.env.RESEND_API_KEY
    || process.env.SMTP_PASS
    || process.env.MAILGUN_API_KEY
    || process.env.BREVO_API_KEY
    || process.env.MAILERSEND_API_KEY
    || smtpTriplet
  );
}

/**
 * One full arm pass — idempotent.
 */
async function armAll(opts) {
  const o = opts || {};
  const dryRun = !!o.dryRun;
  _counts.arms += 1;
  const results = {};

  if (dryRun) {
    results.plan = [
      'tcc', 'taos_armSafe', 'balos', 'traffic', 'growth_brain', 'aacos',
      'agde', 'rivos', 'amos_mdsp', 'lead_hunter', 'auto_marketing', 'social_viralizer',
    ];
    results.ok = true;
    results.dryRun = true;
    results.telegramReady = telegramReady();
    results.emailReady = emailReady();
    _state.lastArm = results;
    _persist();
    return results;
  }

  // 1) Telegram Credential Continuum
  results.tcc = await _try('tcc', () => {
    const tcc = _safeRequire('./telegram-credential-continuum');
    if (!tcc || typeof tcc.reloadFromSanctum !== 'function') return { ok: false, reason: 'unavailable' };
    const snap = tcc.reloadFromSanctum();
    return {
      ok: true,
      tokenArmed: !!snap.tokenArmed,
      chatArmed: !!(snap.ownerChatArmed || snap.groupChatArmed),
      restored: snap.restored,
      mirrored: snap.mirrored,
    };
  });

  // 2) TAOS safe arm (orchestrator + healers — never mutators)
  results.taos = await _try('taos_armSafe', () => {
    if (process.env.TAOS_DISABLED === '1') return { ok: false, reason: 'taos_disabled', skipped: true };
    const taos = _safeRequire('./totalAutonomyOs');
    if (!taos) return { ok: false, reason: 'unavailable' };
    const api = taos.armSafe ? taos : (taos.default || taos);
    if (typeof api.armSafe === 'function') {
      const out = api.armSafe({ source: 'taac' });
      return Object.assign({ ok: !!(out && out.ok !== false) }, out || {});
    }
    if (typeof api.start === 'function') {
      api.start();
      return { ok: true, started: true };
    }
    return { ok: false, reason: 'no_armSafe' };
  });

  // 3) BALOS — IndexNow money flywheel
  results.balos = await _try('balos', () => {
    if (process.env.DISABLE_BILLION_AUTONOMY_LOOP === '1' && !_envOn('BILLION_AUTONOMY_LOOP_FORCE')) {
      _counts.skips += 1;
      return { ok: false, reason: 'disabled_by_env', skipped: true };
    }
    // Soft-clear park when FORCE or TAAC asks
    if (process.env.DISABLE_BILLION_AUTONOMY_LOOP === '1' && _envOn('BILLION_AUTONOMY_LOOP_FORCE')) {
      process.env.DISABLE_BILLION_AUTONOMY_LOOP = '0';
    }
    const balos = _safeRequire('../../src/commerce/billion-autonomy-loop-os');
    if (!balos || typeof balos.start !== 'function') return { ok: false, reason: 'unavailable' };
    const st = balos.start({ bootDelayMs: Number(o.balosBootDelayMs || 45000) });
    return Object.assign({ ok: !!(st && st.ok) }, st || {});
  });

  // 4) Traffic engine
  results.traffic = await _try('traffic', () => {
    if (process.env.TRAFFIC_ENGINE_DISABLED === '1') {
      _counts.skips += 1;
      return { ok: false, reason: 'disabled', skipped: true };
    }
    const te = _safeRequire('./traffic-engine');
    if (!te || typeof te.start !== 'function') return { ok: false, reason: 'unavailable' };
    te.start();
    return { ok: true, started: true };
  });

  // 5) Growth brain
  results.growthBrain = await _try('growth_brain', () => {
    if (process.env.GROWTH_STACK_DISABLED === '1') {
      _counts.skips += 1;
      return { ok: false, reason: 'growth_stack_disabled', skipped: true };
    }
    const gb = _safeRequire('./growth-brain');
    if (!gb) return { ok: false, reason: 'unavailable' };
    if (typeof gb.start === 'function') gb.start();
    return { ok: true, started: true };
  });

  // 6) AACOS
  results.aacos = await _try('aacos', () => {
    if (process.env.AACOS_DISABLED === '1') {
      _counts.skips += 1;
      return { ok: false, reason: 'disabled', skipped: true };
    }
    const aacos = _safeRequire('./autonomy-action-continuum-os');
    if (!aacos || typeof aacos.start !== 'function') return { ok: false, reason: 'unavailable' };
    aacos.start();
    return { ok: true, started: true };
  });

  // 7) AGDE
  results.agde = await _try('agde', () => {
    if (process.env.AGDE_DISABLED === '1') {
      _counts.skips += 1;
      return { ok: false, reason: 'disabled', skipped: true };
    }
    const agde = _safeRequire('./autonomousGlobalDominanceEngine');
    if (!agde || typeof agde.start !== 'function') return { ok: false, reason: 'unavailable' };
    agde.start();
    return { ok: true, started: true };
  });

  // 8) RIVOS
  results.rivos = await _try('rivos', () => {
    if (process.env.RIVOS_DISABLED === '1') {
      _counts.skips += 1;
      return { ok: false, reason: 'disabled', skipped: true };
    }
    const rivos = _safeRequire('../../src/commerce/revenue-invention-continuum-os');
    if (!rivos || typeof rivos.start !== 'function') return { ok: false, reason: 'unavailable' };
    rivos.start();
    return { ok: true, started: true };
  });

  // 9) Money Dial Swarm Pulse (dry or live via RIVOS)
  results.mdsp = await _try('amos_mdsp', async () => {
    const rivos = _safeRequire('../../src/commerce/revenue-invention-continuum-os');
    if (rivos && typeof rivos.moneyDialSwarmPulse === 'function') {
      const pulse = await rivos.moneyDialSwarmPulse({
        dryRun: !telegramReady(),
        force: !!o.forceMdsp,
        limit: 3,
      });
      return Object.assign({ ok: !!(pulse && pulse.ok) }, pulse || {});
    }
    const amos = _safeRequire('../../src/commerce/autonomy-money-surface-os');
    if (amos && typeof amos.postMoneyOffers === 'function') {
      const sent = await amos.postMoneyOffers(null, { dryRun: !telegramReady(), force: !!o.forceMdsp });
      return Object.assign({ ok: !!(sent && sent.ok) }, sent || {});
    }
    return { ok: false, reason: 'unavailable' };
  });

  // 10) Lead hunter — only when outbound can fire
  results.leadHunter = await _try('lead_hunter', () => {
    const force = _envOn('LEAD_HUNTER_FORCE') || o.forceLeadHunter;
    const ready = telegramReady() || emailReady();
    if (!force && !ready) {
      _counts.skips += 1;
      return { ok: false, reason: 'no_outbound_credentials', skipped: true };
    }
    const lh = _safeRequire('./autonomous-lead-hunter');
    if (!lh || typeof lh.start !== 'function') return { ok: false, reason: 'unavailable' };
    lh.start();
    return { ok: true, started: true, via: force ? 'force' : 'credentials' };
  });

  // 11) Auto marketing — credential-gated / force
  results.autoMarketing = await _try('auto_marketing', () => {
    const force = _envOn('AUTO_MARKETING_FORCE') || o.forceMarketing;
    if (!force && !telegramReady()) {
      _counts.skips += 1;
      return { ok: false, reason: 'not_forced_and_no_tg', skipped: true };
    }
    const am = _safeRequire('./auto-marketing') || _safeRequire('./autoMarketing');
    if (!am) return { ok: false, reason: 'unavailable' };
    if (typeof am.init === 'function') am.init();
    if (typeof am.start === 'function') am.start();
    return { ok: true, started: true };
  });

  // 12) Social viralizer ensure (constructor usually already started)
  results.social = await _try('social_viralizer', () => {
    const sv = _safeRequire('./socialMediaViralizer');
    if (!sv) return { ok: false, reason: 'unavailable' };
    if (typeof sv.startAutoPosting === 'function') sv.startAutoPosting();
    if (typeof sv.startAutoViral === 'function') sv.startAutoViral();
    let providers = null;
    try {
      if (typeof sv.getProviderStatus === 'function') providers = sv.getProviderStatus();
    } catch (_) { /* ignore */ }
    return { ok: true, ensured: true, providers };
  });

  // 13) Never start UEE / file mutators — attest refusal
  results.refused = {
    uee_eternal: 'parked_by_policy',
    file_mutators: 'parked_by_policy',
    self_construction_apply: 'parked_by_policy',
    innovation_auto_ship: 'parked_by_policy',
    honesty: 'TAAC never arms mutators or UEE rewrite loops',
  };

  const armedOk = Object.values(results).filter((r) => r && r.ok === true).length;
  results.ok = armedOk > 0;
  results.armedOk = armedOk;
  results.telegramReady = telegramReady();
  results.emailReady = emailReady();
  _state.lastArm = {
    at: new Date().toISOString(),
    armedOk,
    telegramReady: results.telegramReady,
    emailReady: results.emailReady,
  };
  _persist();
  return results;
}

async function tick(opts) {
  if (!ENABLED && !(opts && opts.force)) {
    return { ok: true, skipped: true, reason: 'taac_disabled' };
  }
  _counts.ticks += 1;
  _state.lastTickAt = new Date().toISOString();
  const arm = await armAll(opts || {});
  _counts.rearmed += 1;
  _persist();
  return {
    ok: true,
    protocol: PROTOCOL,
    at: _state.lastTickAt,
    arm,
    counts: Object.assign({}, _counts),
  };
}

function start(opts) {
  if (!ENABLED) return { ok: false, reason: 'taac_disabled' };
  if (_timer) return { ok: true, alreadyRunning: true };
  _state.startedAt = new Date().toISOString();
  const bootDelay = Number((opts && opts.bootDelayMs) || process.env.TAAC_BOOT_DELAY_MS || 20000);
  const kick = setTimeout(() => {
    Promise.resolve(tick({ source: 'boot' })).catch(() => {});
  }, bootDelay);
  if (kick.unref) kick.unref();
  _timer = setInterval(() => {
    Promise.resolve(tick({ source: 'interval' })).catch(() => {});
  }, TICK_MS);
  if (_timer.unref) _timer.unref();
  console.log(`[TAAC] ${PROTOCOL} started · tick=${Math.round(TICK_MS / 1000)}s · bootDelay=${bootDelay}ms`);
  _persist();
  return { ok: true, started: true, intervalMs: TICK_MS, bootDelayMs: bootDelay };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  return { ok: true, stopped: true };
}

function discovery() {
  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    enabled: ENABLED,
    running: !!_timer,
    startedAt: _state.startedAt,
    lastTickAt: _state.lastTickAt,
    lastArm: _state.lastArm,
    organs: _state.organs,
    counts: Object.assign({}, _counts),
    telegramReady: telegramReady(),
    emailReady: emailReady(),
    policy: {
      mutators: 'never',
      ueeEternal: 'never',
      inventGmv: 'never',
      outbound: 'credential_gated',
    },
    endpoints: {
      status: '/api/taac/status',
      wellKnown: '/.well-known/taac.json',
      arm: 'POST /api/taac/arm',
      tick: 'POST /api/taac/tick',
    },
    honesty: 'Arms only credential-honest autonomy organs. Never invents GMV, SERP, posts, or press placements. Never enables file mutators.',
  };
}

function status() { return discovery(); }

module.exports = {
  PROTOCOL,
  INVENTION,
  armAll,
  tick,
  start,
  stop,
  discovery,
  status,
  telegramReady,
  emailReady,
  _counts,
  _state,
};
