'use strict';

/**
 * neural-autonomy-os.js — Neural Autonomy OS (NAOS/1.0)
 * =====================================================
 * Composition plane over existing ZeusAI Unicorn organs:
 *   TAOS, Never-Down, Autonomy Spine, Boot Immortal, Buy Immortal,
 *   Fulfillment AI Eternal, commerce honesty, mutator safety.
 *
 * Innovations:
 *   1. Organ Continuum Map — posture live | idle_stable | unarmed | degraded
 *   2. Money-Path Honesty Delta — buy-immortal + buyability samples
 *   3. Stable-as-Feature attestation — idle under stable is SUCCESS, not failure
 *
 * Hard safety envelope:
 *   - Observe / score only — never armSafe, never start mutators/healers
 *   - Never process.exit / pm2 / ENABLE_FILE_MUTATORS
 *   - Never invent Stripe/PayPal/SMTP secrets
 */

const PROTOCOL = 'NAOS/1.0';
const NAME = 'neural-autonomy-os';

function safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function gradeFor(score) {
  if (score >= 92) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function organ(id, role, weight, posture, score, detail) {
  return {
    id,
    role,
    weight,
    posture, // live | idle_stable | unarmed | degraded
    score: clamp(score, 0, 100),
    pass: Number(score) >= 55,
    detail: String(detail || '').slice(0, 220),
  };
}

function senseMutatorSafety() {
  const mutatorsOff = String(process.env.ENABLE_FILE_MUTATORS || '0') !== '1'
    && String(process.env.SELF_CONSTRUCTION_APPLY || '0') !== '1'
    && String(process.env.DISABLE_SELF_MUTATION || '') === '1';
  const score = mutatorsOff ? 100 : 0;
  return organ(
    'mutator_safety',
    'sovereign_guard',
    15,
    mutatorsOff ? 'live' : 'degraded',
    score,
    mutatorsOff ? 'File mutators off · self-mutation disabled' : 'Mutators armed — sovereign risk'
  );
}

function senseBootImmortal() {
  const boot = safeRequire('./boot-immortal-os');
  if (!boot || typeof boot.getStatus !== 'function') {
    return organ('boot_immortal', 'event_loop_guard', 12, 'unarmed', 40, 'boot-immortal-os unavailable');
  }
  const st = boot.getStatus();
  const stable = !!st.stable;
  const mutOff = !!st.selfMutationDisabled;
  let score = 70;
  let posture = 'live';
  let detail = `profile=${st.profile}`;
  if (stable) {
    score = mutOff ? 100 : 85;
    posture = 'idle_stable';
    detail = 'Stable/safe idle is intentional — heavy loops paused (Boot Immortal)';
  } else if (st.growth) {
    score = mutOff ? 80 : 55;
    posture = 'live';
    detail = 'Growth profile — loops may arm; mutators still gated';
  }
  return organ('boot_immortal', 'event_loop_guard', 12, posture, score, detail);
}

function senseBuyImmortal() {
  const buy = safeRequire('../../src/commerce/buy-immortal');
  if (!buy || typeof buy.getStatus !== 'function') {
    return organ('buy_immortal', 'money_path', 14, 'unarmed', 35, 'buy-immortal unavailable');
  }
  const st = buy.getStatus();
  const immortal = st.immortal === true || st.ok === true;
  return organ(
    'buy_immortal',
    'money_path',
    14,
    immortal ? 'live' : 'degraded',
    immortal ? 100 : 30,
    immortal ? 'One-click Buy → BTC locked (BUY-IMMORTAL/1.0)' : 'Buy immortal checks failing'
  );
}

function senseCommerceHonesty() {
  const buyability = safeRequire('../../src/commerce/commerce-buyability');
  if (!buyability || typeof buyability.assessBuyability !== 'function') {
    return organ('commerce_honesty', 'storefront_truth', 12, 'unarmed', 40, 'commerce-buyability unavailable');
  }
  const samples = [
    { item: { id: 'instant-seo-content-pack', group: 'instant', priceUsd: 79 }, expect: { buyable: true, mode: 'btc' } },
    { item: { id: 'professional-saas-mvp', group: 'professional', priceUsd: 1999 }, expect: { buyable: true, mode: 'reserve' } },
    { item: { id: 'ent-platform-license', group: 'enterprise', priceUsd: 250000 }, expect: { buyable: false, mode: 'contact' } },
    { item: { id: 'zacc-demo-1', group: 'zacc', priceUsd: 99, synthetic: true }, expect: { buyable: false } },
  ];
  let ok = 0;
  for (const s of samples) {
    try {
      const a = buyability.assessBuyability(s.item);
      const buyableOk = a.buyable === s.expect.buyable;
      const modeOk = s.expect.mode == null || a.mode === s.expect.mode;
      if (buyableOk && modeOk) ok += 1;
    } catch (_) { /* count as fail */ }
  }
  const score = Math.round((ok / samples.length) * 100);
  return organ(
    'commerce_honesty',
    'storefront_truth',
    12,
    score >= 75 ? 'live' : 'degraded',
    score,
    `${ok}/${samples.length} honesty samples pass`
  );
}

function senseFulfillmentAi() {
  const ful = safeRequire('./fulfillment-ai-os');
  if (!ful || typeof ful.getStatus !== 'function') {
    return organ('fulfillment_ai', 'delivery_brain', 10, 'unarmed', 40, 'fulfillment-ai-os unavailable');
  }
  let st = {};
  try { st = ful.getStatus() || {}; } catch (_) { st = {}; }
  const mode = String(st.mode || st.enabled || '').toLowerCase();
  const armed = st.armed === true || st.active === true || mode === '1' || mode === 'on';
  const auto = mode === 'auto' || st.mode === 'auto';
  let score = 45;
  let posture = 'unarmed';
  let detail = 'Fulfillment AI idle';
  if (armed) {
    score = 100;
    posture = 'live';
    detail = `Armed · providers=${st.providersConfigured != null ? st.providersConfigured : 'n/a'}`;
  } else if (auto) {
    score = 70;
    posture = 'idle_stable';
    detail = 'Auto mode waiting for LLM keys (honest idle)';
  } else if (mode === '0' || mode === 'off' || mode === 'false') {
    score = 55;
    posture = 'idle_stable';
    detail = 'Force-off — intentional';
  }
  return organ('fulfillment_ai', 'delivery_brain', 10, posture, score, detail);
}

function senseTaos() {
  const taos = safeRequire('./totalAutonomyOs');
  if (!taos || typeof taos.getScore !== 'function') {
    return organ('taos', 'control_plane', 15, 'unarmed', 40, 'TAOS unavailable');
  }
  let sc = {};
  try { sc = taos.getScore() || {}; } catch (_) { sc = {}; }
  const score = clamp(sc.score != null ? sc.score : 0, 0, 100);
  return organ(
    'taos',
    'control_plane',
    15,
    score >= 50 ? 'live' : 'degraded',
    score,
    `TAOS ${sc.grade || '?'} · score=${score}`
  );
}

function senseNeverDown() {
  const ndk = safeRequire('./never-down-kernel');
  if (!ndk) {
    return organ('never_down', 'resilience', 10, 'unarmed', 40, 'NDK unavailable');
  }
  let st = {};
  try {
    st = (typeof ndk.getStatus === 'function' ? ndk.getStatus() : (typeof ndk.status === 'function' ? ndk.status() : {})) || {};
  } catch (_) { st = {}; }
  const ok = st.ok !== false && st.active !== false;
  const score = ok ? 90 : 40;
  return organ(
    'never_down',
    'resilience',
    10,
    ok ? 'live' : 'degraded',
    score,
    st.protocol || st.invention || 'Never-Down Kernel'
  );
}

function senseSpine() {
  const spine = safeRequire('./autonomy-spine');
  if (!spine) {
    return organ('spine', 'attest_observe', 8, 'unarmed', 40, 'autonomy-spine unavailable');
  }
  let st = {};
  try { st = (typeof spine.getStatus === 'function' ? spine.getStatus() : {}) || {}; } catch (_) { st = {}; }
  const running = st.running === true || st.active === true || spine._running === true;
  const score = running ? 88 : 60;
  return organ(
    'spine',
    'attest_observe',
    8,
    running ? 'live' : 'idle_stable',
    score,
    running ? 'Observe+attest running' : 'Spine idle (safe)'
  );
}

function senseCvr() {
  const cvr = safeRequire('./growthCausalitySentinel');
  if (!cvr || typeof cvr.getStatus !== 'function') {
    return organ('cvr', 'growth_signal', 4, 'unarmed', 50, 'CVR sentinel optional');
  }
  let st = {};
  try { st = cvr.getStatus() || {}; } catch (_) { st = {}; }
  const ok = st.ok !== false;
  return organ(
    'cvr',
    'growth_signal',
    4,
    ok ? 'live' : 'degraded',
    ok ? 75 : 40,
    st.stage || st.mode || 'Growth causality status'
  );
}

function composeOrgans() {
  return [
    senseMutatorSafety(),
    senseBootImmortal(),
    senseBuyImmortal(),
    senseCommerceHonesty(),
    senseFulfillmentAi(),
    senseTaos(),
    senseNeverDown(),
    senseSpine(),
    senseCvr(),
  ];
}

function weightedScore(organs) {
  let sumW = 0;
  let acc = 0;
  for (const o of organs) {
    const w = Number(o.weight) || 0;
    sumW += w;
    acc += w * (Number(o.score) || 0);
  }
  if (!(sumW > 0)) return 0;
  return Math.round(acc / sumW);
}

function getStatus() {
  const boot = safeRequire('./boot-immortal-os');
  const stable = boot && typeof boot.isStableProfile === 'function' ? boot.isStableProfile() : false;
  const mutatorsOff = String(process.env.ENABLE_FILE_MUTATORS || '0') !== '1'
    && String(process.env.DISABLE_SELF_MUTATION || '') === '1';
  const organs = composeOrgans();
  const score = weightedScore(organs);
  const grade = gradeFor(score);
  const stableIdleOk = !!(stable && mutatorsOff);
  const buy = organs.find((o) => o.id === 'buy_immortal');
  const continuum = {
    live: organs.filter((o) => o.posture === 'live').length,
    idle_stable: organs.filter((o) => o.posture === 'idle_stable').length,
    unarmed: organs.filter((o) => o.posture === 'unarmed').length,
    degraded: organs.filter((o) => o.posture === 'degraded').length,
  };
  return {
    ok: score >= 50 && (buy ? buy.pass : true),
    protocol: PROTOCOL,
    module: NAME,
    invention: 'neural-autonomy-os',
    score,
    grade,
    stableIdleOk,
    profile: boot && typeof boot.runtimeProfile === 'function' ? boot.runtimeProfile() : String(process.env.UNICORN_RUNTIME_PROFILE || ''),
    continuum,
    organs,
    pillars: organs.map((o) => ({
      id: o.id,
      name: o.id,
      pass: o.pass,
      ok: o.pass,
      detail: `${o.posture} · ${o.detail}`,
      weight: o.weight,
      score: o.score,
    })),
    innovations: [
      'organ_continuum_map',
      'money_path_honesty_delta',
      'stable_as_feature_attestation',
    ],
    doctrine: {
      line: 'Compose immortal organs · stable idle is a feature · never invent payment rails · owner stays sovereign for secrets',
      moneyPath: 'Buy Immortal + commerce honesty gate self-serve BTC',
      mutators: 'Observe-only under NAOS — Boot Immortal keeps thrash loops idle',
    },
    next: [
      stableIdleOk
        ? 'Stable profile attested — keep DISABLE_SELF_MUTATION=1 in production'
        : 'Arm Boot Immortal / DISABLE_SELF_MUTATION for sovereign safety',
      buy && buy.pass
        ? 'Buy Immortal green — one-click BTC remains locked'
        : 'Repair Buy Immortal CI invariants before promoting',
      'Owner may bind LLM/Telegram keys later — NAOS stays honest when unarmed',
    ],
    links: {
      neural: '/api/autonomy/neural',
      score: '/api/autonomy/neural/score',
      taos: '/api/autonomy/os',
      buy: '/api/commerce/health',
      fulfillment: '/api/fulfillment/ai',
      statusPage: '/status',
    },
    timestamp: new Date().toISOString(),
  };
}

function getScore() {
  const st = getStatus();
  return {
    ok: st.ok,
    protocol: PROTOCOL,
    score: st.score,
    grade: st.grade,
    stableIdleOk: st.stableIdleOk,
    continuum: st.continuum,
  };
}

function sense() {
  return getStatus();
}

module.exports = {
  PROTOCOL,
  NAME,
  getStatus,
  getScore,
  sense,
  gradeFor,
  composeOrgans,
};
