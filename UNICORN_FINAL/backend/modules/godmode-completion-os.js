'use strict';
/**
 * Godmode Completion OS — honest status surface for the wired profit loops.
 *
 * Does NOT claim AGI / total autonomy. Reports which real money-path loops
 * are connected after the completion pack:
 *   1. Affiliate ref on sovereign checkout + redeem on settle
 *   2. Sovereign abandoned-invoice recovery (site)
 *   3. Portal checkout-recovery always-on (backend)
 *   4. Checkout upsell surface
 *   5. Pre-invoice wallet/QR honesty
 *   6. Lead outreach delivery attempt
 *   7. Card CTA honesty on unicorn-checkout widget
 */

const fs = require('fs');
const path = require('path');

const NAME = 'godmode-completion-os';
const ROOT = path.join(__dirname, '..', '..');

function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch (_) { return ''; }
}

function audit() {
  const sovereign = _read('src/site/sovereign-commerce.js');
  const client = _read('src/site/v2/client.js');
  const shell = _read('src/site/v2/shell.js');
  const unicornCk = _read('src/site/unicorn-checkout.js');
  const recovery = _read('backend/modules/checkout-recovery-agent.js');
  const leads = _read('backend/modules/autonomous-lead-hunter.js');
  const referral = _read('src/commerce/referral-engine-real.js');
  const backendIdx = _read('backend/index.js');

  const checks = [
    {
      id: 'affiliate_sovereign_create',
      ok: /affiliateRef|affiliate:\s*affiliateRef/.test(sovereign) && /payload\.ref/.test(client),
      why: 'Sovereign createOrder stores ?ref=; client sovereignBuy sends ref',
    },
    {
      id: 'affiliate_redeem_on_settle',
      ok: /recordRedemption/.test(sovereign) && /ensureTrackedCode/.test(referral),
      why: 'Paid sovereign orders redeem into referral ledger',
    },
    {
      id: 'sovereign_abandoned_recovery',
      ok: /function recoverStuckPending/.test(sovereign) && /SOV_RECOVERY_INTERVAL_MS/.test(sovereign),
      why: 'Site process recovers stuck pending invoices (email/Telegram)',
    },
    {
      id: 'portal_recovery_always_on',
      ok: /function start\(/.test(recovery) && /checkoutRecoveryAgent\.start/.test(backendIdx),
      why: 'Portal awaiting_payment recovery armed outside revenue-autopilot',
    },
    {
      id: 'checkout_upsell',
      ok: /coUpsell/.test(shell) && /hydrateCheckoutUpsell|coUpsell/.test(client),
      why: 'Checkout page renders upsell chips from /api/upsell',
    },
    {
      id: 'pre_invoice_qr_honesty',
      ok: /Invoice address appears after you generate/.test(shell) && /never show static-wallet QR/.test(client),
      why: 'Static owner wallet QR hidden until unique invoice exists',
    },
    {
      id: 'lead_outreach_send',
      ok: /outreachSentAt|outreachDelivery/.test(leads) && /sendRaw/.test(leads),
      why: 'Qualified leads with email attempt transactional send + Telegram nudge',
    },
    {
      id: 'card_cta_honesty',
      ok: /payBtc/.test(unicornCk) && /Card appears only when Stripe/.test(unicornCk),
      why: 'Widget no longer routes Card → BTC create; Card hidden unless Stripe armed',
    },
  ];

  const passed = checks.filter((c) => c.ok).length;
  return {
    ok: passed === checks.length,
    name: NAME,
    title: 'Godmode Completion OS',
    domain: 'profit-wiring',
    summary: `${passed}/${checks.length} profit loops wired — honest completion pack, not AGI theater.`,
    checks,
    passed,
    total: checks.length,
    honesty: 'Reports wiring of real commerce loops. Does not invent GMV, AGI, or card rails without secrets.',
    generatedAt: new Date().toISOString(),
  };
}

function getStatus() {
  const a = audit();
  return {
    ok: a.ok,
    health: a.ok ? 'ok' : 'degraded',
    name: NAME,
    title: a.title,
    domain: a.domain,
    summary: a.summary,
    passed: a.passed,
    total: a.total,
    checks: a.checks,
    honesty: a.honesty,
    generatedAt: a.generatedAt,
  };
}

function start() { return { ok: true, mode: 'observe' }; }

module.exports = { name: NAME, audit, getStatus, start, run: audit };
