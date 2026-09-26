'use strict';

/**
 * LAR/1.0 — Live Action Receipts
 * Public read-only merge of real autonomy ledgers. Never invents GMV,
 * visitors, social posts, or reach. Skips are first-class receipts.
 */

const PROTOCOL = 'LAR/1.0';

function _safe(rel, fn) {
  try {
    const mod = require(rel);
    return fn(mod);
  } catch (_) {
    return null;
  }
}

function _status(rel) {
  return _safe(rel, (m) => (typeof m.getStatus === 'function' ? m.getStatus() : null));
}

function snapshot(limit) {
  const cap = Math.min(80, Math.max(5, Number(limit) || 40));
  const generatedAt = new Date().toISOString();

  const aacos = _safe('./autonomy-action-continuum-os', (m) => {
    const st = typeof m.getStatus === 'function' ? m.getStatus() : null;
    const actions = typeof m.listActions === 'function' ? m.listActions(cap) : [];
    return {
      protocol: (st && st.protocol) || 'AACOS/1.0',
      armed: !!(st && st.armed),
      ticks: Number(st && st.ticks) || 0,
      published: Number(st && st.published) || 0,
      skipped: Number(st && st.skipped) || 0,
      lastTickAt: (st && st.lastTickAt) || null,
      lastSkipReason: (st && st.lastSkipReason) || null,
      whyYouSeeNothing: (st && st.whyYouSeeNothing) || null,
      configuredSocial: (st && st.configuredSocial) || [],
      configuredOutbound: (st && st.configuredOutbound) || [],
      actions,
    };
  });

  const spine = _safe('./autonomy-spine', (m) => {
    const st = typeof m.getStatus === 'function' ? m.getStatus() : null;
    if (!st) return null;
    return {
      running: !!st.running,
      mode: st.mode || null,
      canExperiment: !!(st.gate && st.gate.canExperiment),
      reasons: (st.gate && st.gate.reasons) || (st.lastDecision && st.lastDecision.reasons) || [],
      modeCounts: st.modeCounts || null,
    };
  });

  const healer = _status('./unicornSelfHealer');
  const brain = _status('./unicornBrain');
  const innovator = _status('./unicornInnovator');
  const growth = _status('./unicornGrowth');
  const guardian = _status('./unicornGuardian');
  const shipGateRaw = _status('./innovation-ship-gate');
  const viralRaw = _safe('./viral-unification-os', (m) => (
    typeof m.discovery === 'function' ? m.discovery() : (typeof m.getStatus === 'function' ? m.getStatus() : null)
  ));
  const visible = _safe('./visible-social-os', (m) => (
    typeof m.getStatus === 'function' ? m.getStatus() : (typeof m.discovery === 'function' ? m.discovery() : null)
  ));

  let platformTruth = null;
  try {
    const avg = require('./autoViralGrowth');
    if (avg && typeof avg.getViralStatus === 'function') platformTruth = avg.getViralStatus();
  } catch (_) { /* optional */ }

  const why = [];
  if (aacos && aacos.lastSkipReason === 'vuk_not_designated') {
    why.push('AACOS is a VUK client — socialMediaViralizer is the designated poster. AACOS ticks and records skips so it does not double-post.');
  }
  if (visible && Array.isArray(visible.gazeDark) && visible.gazeDark.length) {
    why.push('Facebook/X/Instagram/TikTok stay dark without those tokens. Armed rails are operator channels (telegram/discord/webhook), not the apps you open.');
  }
  if (shipGateRaw && (shipGateRaw.disableSelfMutation || shipGateRaw.autoShipEnabled === false)) {
    why.push('Innovation ship-gate is off: DISABLE_SELF_MUTATION=1 keeps the live tree from rewriting itself.');
  }
  if (healer && healer.idle) {
    why.push('Self-healer is idle under UNICORN_RUNTIME_PROFILE=stable — Boot Immortal: do not restart a healthy stack.');
  }
  if (spine && spine.mode === 'PROTECT') {
    why.push('Autonomy spine is PROTECT: ' + String((spine.reasons && spine.reasons[0]) || 'experiments held'));
  }

  return {
    ok: true,
    protocol: PROTOCOL,
    generatedAt,
    inventsGmv: false,
    inventsReach: false,
    inventsPosts: false,
    inventsHumans: false,
    whyYouSeeNothing: why,
    aacos,
    spine,
    supreme: {
      brain: brain && { cycles: Number(brain.cycles) || 0, ok: brain.ok !== false },
      healer,
      innovator: innovator && { cycles: Number(innovator.cycles) || 0, active: !!innovator.active, ok: innovator.ok !== false },
      growth: growth && { cycles: Number(growth.cycles) || 0, ok: growth.ok !== false },
      guardian: guardian && { cycles: Number(guardian.cycles) || 0, ok: guardian.ok !== false },
    },
    healer,
    shipGate: shipGateRaw && {
      autoShipEnabled: !!shipGateRaw.autoShipEnabled,
      disableSelfMutation: !!shipGateRaw.disableSelfMutation,
      autoRunning: !!shipGateRaw.autoRunning,
      metrics: shipGateRaw.metrics || null,
      lastCycleAt: shipGateRaw.lastCycleAt || null,
    },
    viral: viralRaw && {
      protocol: viralRaw.protocol || 'VUK/1.0',
      designatedExecutor: 'socialMediaViralizer',
      inventsReach: false,
    },
    visibleSocial: visible && {
      gazeDark: visible.gazeDark || [],
      gazeLit: visible.gazeLit || [],
      railsArmed: visible.railsArmed || visible.liveReady || [],
      visibleReceipts: Number(visible.visibleReceipts) || 0,
      whyYouSeeNothing: visible.whyYouSeeNothing || null,
    },
    viralLoop: platformTruth && {
      state: platformTruth.state || null,
      loopRunning: !!platformTruth.loopRunning,
      simulated: !!platformTruth.simulated,
      recentEvents: Array.isArray(platformTruth.recentEvents)
        ? platformTruth.recentEvents.slice(0, 8)
        : [],
    },
  };
}

module.exports = { PROTOCOL, snapshot };
