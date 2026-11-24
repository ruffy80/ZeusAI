// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Protocol: ATRO/1.0 — Autonomous Treasury, Net-Profit Reconciler & Recovery Plane
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'ATRO/1.0';
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const DOMAIN = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');
const OWNER_BTC = (process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e')
  .replace(/^['"]|['"]$/g, '')
  .trim();
const SWEEP_THRESHOLD_USD = Math.max(50, Number(process.env.TREASURY_SWEEP_THRESHOLD_USD || 250));

const EXPLORERS = [
  'https://mempool.space/api',
  'https://blockstream.info/api',
  'https://mempool.emzy.de/api',
];

const ONCHAIN_TXID = /^[0-9a-f]{64}$/i;
const TEST_EMAIL = /^(smoke@zeusai\.pro|test@test\.com|example@example\.com)$/i;

const RAIL_FEES = {
  btc: { pct: 0, fixedUsd: 0 },
  bitcoin: { pct: 0, fixedUsd: 0 },
  paypal: { pct: 0.0349, fixedUsd: 0.49 },
  nowpayments: { pct: 0.01, fixedUsd: 0 },
  stripe: { pct: 0.029, fixedUsd: 0.30 },
  card: { pct: 0.029, fixedUsd: 0.30 },
};

function resolveCommerceDir() {
  return process.env.ATRO_COMMERCE_DIR
    || process.env.COMMERCE_DATA_DIR
    || path.join(process.env.UNICORN_DATA_DIR || path.join(APP_ROOT, 'data'), 'commerce');
}

function resolveDataDir() {
  const dir = process.env.ATRO_DATA_DIR
    || (process.env.ZEUS_STATE_DIR ? path.join(process.env.ZEUS_STATE_DIR, 'treasury-reconciler') : null)
    || path.join(APP_ROOT, 'data', 'treasury-reconciler');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function readJsonlSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
    const out = [];
    for (const line of lines) {
      try { out.push(JSON.parse(line)); } catch (_) {}
    }
    return out;
  } catch (_) {
    return [];
  }
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

function loadEd25519Keypair() {
  const keyFile = process.env.SITE_SIGN_KEY_FILE
    || path.join(os.homedir(), '.unicorn-keys', 'site-sign.pem');
  try {
    if (fs.existsSync(keyFile)) {
      const pem = fs.readFileSync(keyFile, 'utf8');
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      return {
        privateKey,
        publicKey,
        publicKeyBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        keySource: 'site_persistent_ed25519',
      };
    }
  } catch (_) {}
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    keySource: 'ephemeral_ed25519',
  };
}

function computeRailFeeUsd(rail, grossUsd) {
  const r = String(rail || 'btc').toLowerCase();
  const cfg = RAIL_FEES[r] || { pct: 0, fixedUsd: 0 };
  if (!(grossUsd > 0)) return 0;
  return Number((grossUsd * cfg.pct + cfg.fixedUsd).toFixed(2));
}

function readAiFulfillmentCostUsd() {
  try {
    const p = path.join(APP_ROOT, 'data', 'ai-cost', 'ledger.json');
    if (!fs.existsSync(p)) return 0;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (typeof raw.totalCostUsd === 'number') return Number(raw.totalCostUsd.toFixed(4));
    if (Array.isArray(raw.entries)) {
      return Number(raw.entries.reduce((s, e) => s + Number((e && e.costUsd) || 0), 0).toFixed(4));
    }
  } catch (_) {}
  return 0;
}

class AutonomousTreasuryReconciler {
  constructor() {
    this.protocol = PROTOCOL;
    this.startedAt = new Date().toISOString();
    this.keys = loadEd25519Keypair();
    this.lastReconcile = null;
    this.lastOnChainAudit = null;
    this.lastRecoverySweep = null;
    this.reconciledOrderIds = new Set();
    this.sweepsExecuted = 0;
  }

  _signPayload(payloadObj) {
    const raw = Buffer.from(canonicalJson(payloadObj), 'utf8');
    return crypto.sign(null, raw, this.keys.privateKey).toString('base64');
  }

  /**
   * 1. Single Source of Truth Deduplicated Multi-Rail Net-Profit Reconciliation
   * Strictly separates REAL verified settlements from smoke/test orders. Never invents GMV.
   */
  reconcileLedger() {
    const commerceDir = resolveCommerceDir();
    const ordersRows = readJsonlSafe(path.join(commerceDir, 'orders.jsonl'));
    const receiptsRows = readJsonlSafe(path.join(commerceDir, 'uaic-receipts.jsonl'));

    // Keep latest state per orderId
    const latestOrders = new Map();
    for (const row of ordersRows) {
      if (row && row.orderId) latestOrders.set(row.orderId, row);
    }

    const dedupPaid = new Map();
    let testPaidOrders = 0;
    let pendingOrders = 0;
    let expiredOrders = 0;
    const nowMs = Date.now();
    const thirtyDaysAgoMs = nowMs - (30 * 24 * 60 * 60 * 1000);

    for (const o of latestOrders.values()) {
      if (!o) continue;
      if (o.status === 'pending') { pendingOrders += 1; continue; }
      if (o.status === 'expired') { expiredOrders += 1; continue; }
      if (o.status !== 'paid') continue;

      const email = String((o.buyer && o.buyer.email) || '');
      const rail = String(o.paid_via || 'btc').toLowerCase();
      const isTest = TEST_EMAIL.test(email) || Boolean(o.mock) || rail === 'loopback';
      const hasBtcProof = Array.isArray(o.txids) && o.txids.some((t) => ONCHAIN_TXID.test(String(t || '')));
      const hasAltProof = ['paypal', 'nowpayments', 'stripe', 'card'].includes(rail)
        && Boolean((o.provider_settle && o.provider_settle.providerRef) || (Array.isArray(o.provider_refs) && o.provider_refs.length > 0));
      const grossUsd = Number(o.subtotal_fiat || 0);

      if (!isTest && (hasBtcProof || hasAltProof) && grossUsd > 0) {
        const feeUsd = computeRailFeeUsd(rail, grossUsd);
        const affiliateUsd = Number((o.affiliate && o.affiliate.redemption && o.affiliate.redemption.payoutUsd) || 0);
        const netUsd = Number(Math.max(0, grossUsd - feeUsd - affiliateUsd).toFixed(2));
        dedupPaid.set(o.orderId, {
          orderId: o.orderId,
          serviceId: o.serviceId || 'unknown',
          rail: rail === 'bitcoin' ? 'btc' : rail,
          grossUsd,
          feeUsd,
          affiliateUsd,
          netUsd,
          sats: (rail === 'btc' || rail === 'bitcoin') ? Number(o.paid_sats_observed || o.amount_sats || 0) : 0,
          paidAt: o.paid_at || o.created_at || null,
          lateSettled: Boolean(o.late_settled),
        });
      } else {
        testPaidOrders += 1;
      }
    }

    // Merge legacy uaic-receipts.jsonl not already present in orders.jsonl
    for (const r of receiptsRows) {
      if (!r || r.status !== 'paid') continue;
      const oid = String(r.orderId || r.id || '').trim();
      if (!oid || dedupPaid.has(oid)) continue;
      const conf = r.confirmation || {};
      const email = String(r.email || '');
      const isLoopback = String(conf.by || '') === 'loopback' || String(conf.txid || '') === 'smoke-test-loopback';
      const isTest = isLoopback || TEST_EMAIL.test(email);
      const hasTx = ONCHAIN_TXID.test(String(conf.txid || ''));
      const rail = String(r.paid_via || r.provider || 'btc').toLowerCase();
      const hasProvider = ['paypal', 'nowpayments', 'stripe'].includes(rail) && Boolean(r.providerRef);
      const grossUsd = Number(r.amount || 0);
      if (!isTest && (hasTx || hasProvider) && grossUsd > 0) {
        const feeUsd = computeRailFeeUsd(rail, grossUsd);
        dedupPaid.set(oid, {
          orderId: oid,
          serviceId: r.serviceId || 'legacy',
          rail: rail === 'bitcoin' ? 'btc' : rail,
          grossUsd,
          feeUsd,
          affiliateUsd: 0,
          netUsd: Number(Math.max(0, grossUsd - feeUsd).toFixed(2)),
          sats: rail === 'btc' ? Number(r.amount_sats || 0) : 0,
          paidAt: r.paidAt || r.paid_at || null,
          lateSettled: false,
        });
      } else {
        testPaidOrders += 1;
      }
    }

    const byRail = {
      btc: { orders: 0, grossUsd: 0, feeUsd: 0, netUsd: 0, sats: 0, custody: 'direct_owner_self_custody' },
      paypal: { orders: 0, grossUsd: 0, feeUsd: 0, netUsd: 0, sats: 0, custody: 'merchant_balance_sweep_eligible' },
      nowpayments: { orders: 0, grossUsd: 0, feeUsd: 0, netUsd: 0, sats: 0, custody: 'gateway_balance_sweep_eligible' },
      stripe: { orders: 0, grossUsd: 0, feeUsd: 0, netUsd: 0, sats: 0, custody: 'merchant_balance_sweep_eligible' },
    };

    let totalGrossUsd = 0;
    let totalFeeUsd = 0;
    let totalAffiliateUsd = 0;
    let totalNetBeforeAiUsd = 0;
    let trailing30dGrossUsd = 0;
    let trailing30dNetUsd = 0;
    let newlyReconciled = 0;

    for (const rec of dedupPaid.values()) {
      const bucket = byRail[rec.rail] || byRail.btc;
      bucket.orders += 1;
      bucket.grossUsd = Number((bucket.grossUsd + rec.grossUsd).toFixed(2));
      bucket.feeUsd = Number((bucket.feeUsd + rec.feeUsd).toFixed(2));
      bucket.netUsd = Number((bucket.netUsd + rec.netUsd).toFixed(2));
      bucket.sats += rec.sats;

      totalGrossUsd += rec.grossUsd;
      totalFeeUsd += rec.feeUsd;
      totalAffiliateUsd += rec.affiliateUsd;
      totalNetBeforeAiUsd += rec.netUsd;

      const paidMs = Date.parse(rec.paidAt || 0);
      if (paidMs && paidMs >= thirtyDaysAgoMs) {
        trailing30dGrossUsd += rec.grossUsd;
        trailing30dNetUsd += rec.netUsd;
      }

      if (!this.reconciledOrderIds.has(rec.orderId)) {
        this.reconciledOrderIds.add(rec.orderId);
        newlyReconciled += 1;
        // Close the loop into CEGE/1.0 so evolution learns from REAL settled net profit
        try {
          const cege = require('../cognitive-evolution-genome');
          if (cege && typeof cege.recordOutcome === 'function') {
            cege.recordOutcome({
              domain: 'conversion_proof_magnet',
              qualityScore: 95,
              latencyMs: 100,
              success: true,
              lesson: `Real verified settlement via ${rec.rail} for ${rec.serviceId} yielded $${rec.netUsd} net profit.`,
              source: 'atro_verified_settlement',
            });
          }
        } catch (_) {}
      }
    }

    const aiCostUsd = readAiFulfillmentCostUsd();
    const trueNetProfitUsd = Number((totalNetBeforeAiUsd - aiCostUsd).toFixed(2));
    const marginPct = totalGrossUsd > 0 ? Number(((trueNetProfitUsd / totalGrossUsd) * 100).toFixed(2)) : null;

    // Treasury sweep recommendations when custodial rail balances exceed threshold
    const sweepAlerts = [];
    for (const railKey of ['paypal', 'nowpayments', 'stripe']) {
      if (byRail[railKey].netUsd >= SWEEP_THRESHOLD_USD) {
        sweepAlerts.push({
          rail: railKey,
          availableNetUsd: byRail[railKey].netUsd,
          thresholdUsd: SWEEP_THRESHOLD_USD,
          action: `Sweep $${byRail[railKey].netUsd} from ${railKey} into owner cold Bitcoin self-custody (${OWNER_BTC}).`,
        });
      }
    }

    const report = {
      ok: true,
      protocol: PROTOCOL,
      reconciledAt: new Date().toISOString(),
      inventsRevenue: false,
      ownerBtcAddress: OWNER_BTC,
      totals: {
        realPaidOrders: dedupPaid.size,
        newlyReconciled,
        testOrSmokeOrdersExcluded: testPaidOrders,
        pendingOrders,
        expiredOrders,
        grossRevenueUsd: Number(totalGrossUsd.toFixed(2)),
        paymentRailFeesUsd: Number(totalFeeUsd.toFixed(2)),
        affiliateLiabilityUsd: Number(totalAffiliateUsd.toFixed(2)),
        aiFulfillmentCostUsd: aiCostUsd,
        trueNetProfitUsd,
        netMarginPct: marginPct,
        trailing30dGrossUsd: Number(trailing30dGrossUsd.toFixed(2)),
        trailing30dNetUsd: Number(trailing30dNetUsd.toFixed(2)),
      },
      byRail,
      sweepThresholdUsd: SWEEP_THRESHOLD_USD,
      sweepAlerts,
    };

    this.lastReconcile = report;
    return report;
  }

  /**
   * 2. Live Multi-Explorer On-Chain Bitcoin Treasury Audit
   * Cross-checks live blockchain balance of OWNER_BTC and feeds real health into ASRI/1.0.
   */
  async reconcileOnChainBtc({ dryRunStats = null } = {}) {
    const t0 = Date.now();
    let stats = dryRunStats;
    let explorerUsed = dryRunStats ? 'dry_run' : null;
    let lastError = null;

    if (!stats && process.env.NODE_ENV !== 'test') {
      for (const base of EXPLORERS) {
        try {
          const r = await fetch(`${base}/address/${OWNER_BTC}`, {
            method: 'GET',
            headers: { 'User-Agent': 'ZeusAI-ATRO/1.0', Connection: 'close' },
            signal: AbortSignal.timeout(6500),
          });
          if (!r.ok) throw new Error('http_' + r.status);
          const data = await r.json();
          if (data && data.chain_stats) {
            stats = data;
            explorerUsed = base;
            break;
          }
        } catch (e) {
          lastError = String((e && e.message) || e).slice(0, 120);
        }
      }
    }

    const latencyMs = Date.now() - t0;
    const ok = Boolean(stats && stats.chain_stats);

    // Feed real live rail telemetry into ASRI/1.0!
    try {
      const asri = require('../autonomous-runtime-immunity');
      if (asri && typeof asri.recordRailProbe === 'function') {
        asri.recordRailProbe('btc_mempool', { ok, latencyMs, error: ok ? null : lastError });
      }
    } catch (_) {}

    const ledger = this.lastReconcile || this.reconcileLedger();
    const confirmedReceivedSats = ok ? Number(stats.chain_stats.funded_txo_sum || 0) : null;
    const confirmedSpentSats = ok ? Number(stats.chain_stats.spent_txo_sum || 0) : null;
    const confirmedBalanceSats = ok ? (confirmedReceivedSats - confirmedSpentSats) : null;
    const mempoolReceivedSats = ok ? Number((stats.mempool_stats && stats.mempool_stats.funded_txo_sum) || 0) : null;
    const ledgerBtcSats = ledger.byRail.btc.sats || 0;

    const audit = {
      ok,
      protocol: PROTOCOL,
      auditedAt: new Date().toISOString(),
      ownerBtcAddress: OWNER_BTC,
      explorerUsed,
      latencyMs,
      error: ok ? null : (lastError || 'offline_or_test_mode'),
      onChain: ok ? {
        confirmedReceivedSats,
        confirmedSpentSats,
        confirmedBalanceSats,
        mempoolReceivedSats,
        txCount: Number(stats.chain_stats.tx_count || 0),
      } : null,
      ledgerBtcSats,
      varianceSats: ok ? (confirmedReceivedSats - ledgerBtcSats) : null,
    };

    this.lastOnChainAudit = audit;
    return audit;
  }

  /**
   * 3. Autonomous Multi-Stage Abandoned-Checkout Recovery Coordinator
   * Identifies pending (>15m) & recently expired (60m–24h) checkouts and prepares fresh
   * multi-rail Resume Checkout links (NEVER resending dead expired BTC sat quotes!).
   */
  runRecoverySweep() {
    const commerceDir = resolveCommerceDir();
    const rows = readJsonlSafe(path.join(commerceDir, 'orders.jsonl'));
    const latest = new Map();
    for (const r of rows) {
      if (r && r.orderId) latest.set(r.orderId, r);
    }

    const nowMs = Date.now();
    const candidates = [];

    for (const o of latest.values()) {
      if (!o || o.status === 'paid') continue;
      const email = String((o.buyer && o.buyer.email) || '').trim();
      if (!email || TEST_EMAIL.test(email) || Boolean(o.mock)) continue;

      const createdMs = Date.parse(o.created_at || 0) || Number(o.created_at_ms || 0);
      if (!createdMs) continue;
      const ageMin = Math.round((nowMs - createdMs) / 60000);
      if (ageMin < 15 || ageMin > 24 * 60) continue;

      const stage = o.status === 'pending' ? 'stage_1_live_nudge' : 'stage_2_fresh_remint';
      const resumeUrl = `${DOMAIN}/checkout/?plan=${encodeURIComponent(o.serviceId || 'instant-website-audit')}&resume=${encodeURIComponent(o.orderId)}`;
      candidates.push({
        orderId: o.orderId,
        serviceId: o.serviceId,
        status: o.status,
        ageMin,
        stage,
        resumeUrl,
        freshQuoteRequired: o.status === 'expired',
      });
    }

    this.sweepsExecuted += 1;
    const sweep = {
      ok: true,
      protocol: PROTOCOL,
      sweptAt: new Date().toISOString(),
      sweepsExecuted: this.sweepsExecuted,
      candidatesFound: candidates.length,
      neverResendsExpiredBtcQuote: true,
      candidates: candidates.slice(0, 25),
    };

    this.lastRecoverySweep = sweep;
    try {
      const p = path.join(resolveDataDir(), 'recovery-sweeps.jsonl');
      fs.appendFileSync(p, JSON.stringify({ at: sweep.sweptAt, candidatesFound: sweep.candidatesFound }) + '\n', 'utf8');
    } catch (_) {}
    return sweep;
  }

  /**
   * 4. Public Zero-PII Ed25519-Signed Sovereign Treasury & Autonomy Attestation
   * Served at /.well-known/treasury-autonomy.json
   */
  getTreasurySnapshot() {
    const ledger = this.reconcileLedger();
    const payload = {
      protocol: PROTOCOL,
      name: 'ZeusAI Autonomous Treasury, Net-Profit & Self-Healing Revenue Plane',
      domain: DOMAIN,
      issuedAt: new Date().toISOString(),
      inventsRevenue: false,
      ownerBtcSelfCustody: OWNER_BTC,
      paymentRailsLive: ['Bitcoin Direct (-10%, 0% fee)', 'PayPal Live', 'NOWPayments Live (Multi-Crypto + Card)'],
      totals: ledger.totals,
      byRail: ledger.byRail,
      sweepAlertsCount: ledger.sweepAlerts.length,
      onChainAudit: this.lastOnChainAudit ? {
        ok: this.lastOnChainAudit.ok,
        auditedAt: this.lastOnChainAudit.auditedAt,
        explorerUsed: this.lastOnChainAudit.explorerUsed,
        confirmedBalanceSats: this.lastOnChainAudit.onChain ? this.lastOnChainAudit.onChain.confirmedBalanceSats : null,
      } : null,
      recoveryCoordinator: {
        sweepsExecuted: this.sweepsExecuted,
        neverResendsExpiredBtcQuote: true,
      },
    };

    const payloadHash = crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
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
    const ledger = this.lastReconcile || this.reconcileLedger();
    return {
      ok: true,
      module: 'autonomous-treasury-reconciler',
      protocol: PROTOCOL,
      startedAt: this.startedAt,
      totals: ledger.totals,
      sweepAlerts: ledger.sweepAlerts,
      lastOnChainAudit: this.lastOnChainAudit,
      lastRecoverySweep: this.lastRecoverySweep,
    };
  }

  health() {
    const ledger = this.lastReconcile || this.reconcileLedger();
    return {
      ok: Boolean(ledger && ledger.ok),
      protocol: PROTOCOL,
      realPaidOrders: ledger.totals.realPaidOrders,
      trueNetProfitUsd: ledger.totals.trueNetProfitUsd,
      sweepAlertsCount: ledger.sweepAlerts.length,
    };
  }
}

const reconciler = new AutonomousTreasuryReconciler();
module.exports = reconciler;
