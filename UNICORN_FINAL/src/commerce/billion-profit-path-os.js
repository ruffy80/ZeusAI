'use strict';

/**
 * Billion Profit Path OS (BPPOS/1.0)
 *
 * Honest readiness map for paths that CAN compound toward large-scale revenue.
 * Never invents GMV. Scenario math is opt-in only (explicit gmvUsd / scenario=1).
 *
 * Paths:
 *  1. Instant digital self-serve (BTC · PayPal · NOW)
 *  2. Professional reserve / human build
 *  3. Enterprise / billion-scale deal desk (contact)
 *  4. Dropship AUTO-SHIP (requires CJ + dispatchable vids)
 *  5. Marketplace take-rate franchise (scenario economics)
 *  6. Social tips / creator rails
 */

const PROTOCOL = 'BPPOS/1.0';
const BILLION = 1e9;

function _paymentHonesty() {
  try {
    // Prefer site helper when available; otherwise env probe.
    const paypal = !!(
      String(process.env.PAYPAL_CLIENT_ID || '').trim()
      && String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
      && String(process.env.PAYPAL_WEBHOOK_ID || '').trim()
    );
    const now = !!(
      String(process.env.NOWPAYMENTS_API_KEY || '').trim()
      && String(process.env.NOWPAYMENTS_IPN_SECRET || '').trim()
    );
    const email = !!(
      String(process.env.SMTP_URL || process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || '').trim()
    );
    const cj = !!String(process.env.ZACC_CJ_API_KEY || process.env.CJ_API_KEY || '').trim();
    return {
      btc: { armed: true, settleReady: true, primary: true },
      paypal: { armed: paypal, settleReady: paypal },
      nowpayments: { armed: now, settleReady: now },
      emailConfigured: email,
      cjDropshipping: cj,
      cardArmed: false,
    };
  } catch (_) {
    return {
      btc: { armed: true, settleReady: true, primary: true },
      paypal: { armed: false, settleReady: false },
      nowpayments: { armed: false, settleReady: false },
      emailConfigured: false,
      cjDropshipping: false,
      cardArmed: false,
    };
  }
}

function _dropshipStats() {
  try {
    const zacc = require('../../backend/modules/zacc');
    const list = (zacc.publisher && typeof zacc.publisher.list === 'function')
      ? zacc.publisher.list({ limit: 200, includeHidden: false })
      : [];
    const dispatchable = list.filter((p) => p && p.dispatchable === true).length;
    const desk = list.filter((p) => p && p.dispatchable === false).length;
    const paid = (zacc.orders && zacc.orders.status && zacc.orders.status().counts)
      ? Number(zacc.orders.status().counts.paid || 0)
      : 0;
    return {
      published: list.length,
      dispatchable,
      deskPreview: desk,
      ordersPaid: paid,
      autoShipReady: dispatchable > 0 && !!String(process.env.ZACC_CJ_API_KEY || process.env.CJ_API_KEY || '').trim(),
    };
  } catch (_) {
    return { published: 0, dispatchable: 0, deskPreview: 0, ordersPaid: 0, autoShipReady: false };
  }
}

function _catalogBands() {
  try {
    const buyability = require('./commerce-buyability');
    // Prefer injected catalog from caller; else empty.
    return { buyabilityLoaded: !!buyability };
  } catch (_) {
    return { buyabilityLoaded: false };
  }
}

function _moduleInventory() {
  const modules = [
    { id: 'billionScaleRevenueEngine', path: 'src/modules/billionScaleRevenueEngine.js', role: 'strategic_packages_deal_desk', ready: true },
    { id: 'billionScaleActivationOrchestrator', path: 'src/modules/billionScaleActivationOrchestrator.js', role: 'activation_graph', ready: true },
    { id: 'autonomousMoneyMachine', path: 'backend/modules/autonomousMoneyMachine.js', role: 'revenue_commander_ledgers', ready: true },
    { id: 'closedLoopCommerceOs', path: 'backend/modules/closed-loop-commerce-os.js', role: 'paid_to_delivered_cycles', ready: true },
    { id: 'ownerRevenueDashboard', path: 'backend/modules/owner-revenue-dashboard.js', role: 'observed_gmv_from_paid', ready: true },
    { id: 'universalPaymentRails', path: 'src/commerce/universal-payment-rails.js', role: 'multi_rail_checkout', ready: true },
    { id: 'paymentInnovationOs', path: 'src/commerce/payment-innovation-os.js', role: 'pay_pack_failover', ready: true },
    { id: 'zaccDropship', path: 'backend/modules/zacc/index.js', role: 'physical_commerce', ready: true },
    { id: 'autoRevenue', path: 'backend/modules/autoRevenue.js', role: 'affiliate_idle_until_receipts', ready: true },
    { id: 'billionAutonomyLoopOs', path: 'src/commerce/billion-autonomy-loop-os.js', role: 'digital_flywheel_indexnow_enterprise_cj_watch', ready: true },
  ];
  return { protocol: PROTOCOL, count: modules.length, modules };
}

/**
 * Scenario math — ONLY when caller passes gmvUsd or scenario=1.
 * Default observed path never claims $1B.
 */
function pathToBillionScenario(input = {}) {
  const explicit = input.gmvUsd != null || input.scenario === true || input.scenario === '1' || input.scenario === 1;
  if (!explicit) {
    return {
      ok: true,
      mode: 'observed',
      gmvUsd: Number(input.observedGmvUsd || 0),
      annualRevenueUsd: Number(input.observedRevenueUsd || 0),
      pathToBillionUsd: 'not_achieved — zero or observed only; pass scenario=1 or gmvUsd=… for model',
      honesty: 'never_invents_gmv',
    };
  }
  const gmvUsd = Number(input.gmvUsd != null ? input.gmvUsd : 5e9);
  const takeRate = Number(input.takeRate != null ? input.takeRate : 0.2);
  const annualRevenueUsd = Math.round(gmvUsd * takeRate);
  return {
    ok: true,
    mode: 'scenario',
    gmvUsd,
    takeRate,
    annualRevenueUsd,
    pathToBillionUsd: annualRevenueUsd >= BILLION
      ? 'scenario_achieved_at_this_scale'
      : `scenario_needs_${Math.ceil(BILLION / Math.max(1, annualRevenueUsd))}x`,
    honesty: 'scenario_model_only_not_live_gmv',
  };
}

function assessPaths(opts = {}) {
  const pay = opts.payments || _paymentHonesty();
  const ds = opts.dropship || _dropshipStats();
  const observedGmv = Number(opts.observedGmvUsd || 0);
  const observedPaid = Number(opts.observedPaidOrders || 0);

  const paths = [
    {
      id: 'instant-digital',
      title: 'Instant digital self-serve',
      ceilingLabel: 'high-volume SMB / creator',
      ready: !!(pay.btc && pay.btc.settleReady),
      settleRails: ['btc', pay.paypal.settleReady ? 'paypal' : null, pay.nowpayments.settleReady ? 'nowpayments' : null].filter(Boolean),
      blockers: [
        !pay.emailConfigured ? 'transactional_email_unarmed' : null,
        observedPaid === 0 ? 'no_paid_orders_yet' : null,
      ].filter(Boolean),
      action: 'Drive traffic to /services instant-* SKUs; first paid loop unlocks compounding.',
    },
    {
      id: 'professional-reserve',
      title: 'Professional reserve (human build)',
      ceilingLabel: 'mid-ticket services',
      ready: true,
      settleRails: ['btc'],
      blockers: ['requires_human_fulfillment'],
      action: 'Sell professional-* kickoffs; staff delivery margin.',
    },
    {
      id: 'enterprise-deal-desk',
      title: 'Enterprise / billion-scale packages',
      ceilingLabel: 'path_to_1B_via_deals',
      ready: true,
      settleRails: ['btc', 'deal-desk'],
      blockers: ['requires_sales_motion', 'requires_case_studies'],
      action: 'Use /api/billion-scale/deal-desk/proposal + enterprise contact; packages $25k–$1M live as SOW offers.',
      packagesEndpoint: '/api/billion-scale/packages',
    },
    {
      id: 'dropship-autoshop',
      title: 'Dropship AUTO-SHIP',
      ceilingLabel: 'physical_gmv_at_scale',
      ready: !!ds.autoShipReady,
      settleRails: ['btc'],
      blockers: [
        !pay.cjDropshipping && !ds.autoShipReady ? 'cj_api_key_missing' : null,
        ds.dispatchable === 0 ? 'zero_dispatchable_skus' : null,
      ].filter(Boolean),
      stats: ds,
      action: 'Arm ZACC_CJ_API_KEY, publish CJ vids only, purge desk luxury previews from buy path.',
    },
    {
      id: 'marketplace-take-rate',
      title: 'Marketplace franchise take-rate',
      ceilingLabel: 'scenario_1B_plus',
      ready: true,
      settleRails: ['btc'],
      blockers: ['requires_vendors_and_gmv', 'scenario_only_until_live_gmv'],
      action: 'Sell zeusai-marketplace-franchise; model via /api/billion-scale/marketplace-economics?scenario=1',
    },
    {
      id: 'social-tips',
      title: 'Social tip rails',
      ceilingLabel: 'creator_micro_gmv',
      ready: !!(pay.btc && pay.btc.settleReady),
      settleRails: ['btc', pay.paypal.settleReady ? 'paypal' : null, pay.nowpayments.settleReady ? 'nowpayments' : null].filter(Boolean),
      blockers: [],
      action: 'Promote social-tip: virtual SKUs on social surfaces.',
    },
  ];

  const readyCount = paths.filter((p) => p.ready).length;
  const criticalBlockers = [];
  if (observedPaid === 0) criticalBlockers.push('zero_confirmed_paid_settlements');
  if (!pay.emailConfigured) criticalBlockers.push('email_unarmed');
  if (!ds.autoShipReady) criticalBlockers.push('dropship_autoshop_not_armed');

  return {
    ok: true,
    protocol: PROTOCOL,
    generatedAt: new Date().toISOString(),
    honesty: 'Infrastructure readiness ≠ live GMV. Billion path requires customers + distribution + delivery proof.',
    observed: { gmvUsd: observedGmv, paidOrders: observedPaid },
    payments: pay,
    inventory: _moduleInventory(),
    catalog: _catalogBands(),
    paths,
    summary: {
      pathsReady: readyCount,
      pathsTotal: paths.length,
      grade: readyCount >= 4 && pay.btc.settleReady ? 'foundation-ready' : 'partial',
      criticalBlockers,
      nextToUnlockBillion: [
        'Autonomy loop (BALOS) submits money URLs via IndexNow — keep it running',
        'Close first real paid digital orders on instant-* SKUs',
        'Enterprise contact → Telegram notify + deal desk quotes',
        'Arm CJ when ready — BALOS pulses AUTO-SHIP publish automatically',
        'Grow marketplace vendors; use scenario economics only as model',
      ],
      autonomyLoop: '/api/billion-scale/autonomy-loop',
    },
    scenarioHint: '/api/billion-scale/marketplace-economics?scenario=1&gmvUsd=5000000000&takeRate=0.2',
  };
}

module.exports = {
  PROTOCOL,
  BILLION,
  pathToBillionScenario,
  assessPaths,
  _paymentHonesty,
  _dropshipStats,
};
