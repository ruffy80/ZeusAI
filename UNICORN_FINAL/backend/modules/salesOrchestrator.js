// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

/**
 * salesOrchestrator — end-to-end sale pipeline, one module:
 *   quote → invoice (BTC) → payment (btcPaymentVerifier, real mempool.space)
 *   → activation (API key + license, persisted).
 *
 * RO: pipeline-ul complet de vânzare. Prețul vine din priceNegotiator
 * (marjă de profit 30%), factura din btcInvoiceLedger (sats unici per
 * comandă), confirmarea din btcPaymentVerifier (on-chain real), iar la
 * plată se emite automat cheia API + licența — zero intervenție umană.
 *
 * Wire-up (backend/index.js):
 *   - POST /api/order                      → createOrder()
 *   - GET  /api/order/:id                  → getOrder()
 *   - POST /api/order/:id/simulate-payment → admin/test only (mock pay)
 *   - _onPaidInvoice(invoice)              → handlePaid() auto-activation
 *
 * Never throws to the caller — every public fn returns { ok, ... }.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const priceNegotiator = require('./priceNegotiator');
const btcLedger = require('./btcInvoiceLedger');
const serviceCatalog = require('./serviceCatalog');

const DATA_DIR = path.resolve(__dirname, '../../data/sales');
const ACTIVATIONS_FILE = path.join(DATA_DIR, 'activations.jsonl');

const stats = { orders: 0, dryRuns: 0, activations: 0, failures: 0, lastOrderAt: null, lastActivationAt: null };

function _ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

function _persistActivation(act) {
  try {
    _ensureDir();
    fs.appendFileSync(ACTIVATIONS_FILE, JSON.stringify(act) + '\n');
    return true;
  } catch (e) {
    stats.failures += 1;
    console.warn('[salesOrchestrator] persist failed:', e.message);
    return false;
  }
}

function _loadActivations() {
  try {
    if (!fs.existsSync(ACTIVATIONS_FILE)) return [];
    return fs.readFileSync(ACTIVATIONS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(Boolean);
  } catch (_) { return []; }
}

/** Live quote — same engine the storefront uses (profit margin 1.30 floor). */
async function quote(serviceId, context = {}) {
  try {
    const q = await priceNegotiator.getPrice(serviceId, context);
    if (!q || !(Number(q.usd) > 0)) return { ok: false, error: 'unpriceable', serviceId };
    return { ok: true, ...q };
  } catch (e) {
    return { ok: false, error: e.message, serviceId };
  }
}

/**
 * createOrder — full order: validate service (soft), quote, mint BTC invoice.
 * dryRun:true → no ledger write (used by test_modules_communication.js so
 * tests never pollute the real invoice ledger). RO: testele nu murdăresc
 * registrul real de facturi.
 */
async function createOrder({ serviceId, email = null, qty = 1, metadata = {}, dryRun = false } = {}) {
  const sid = String(serviceId || '').trim();
  if (!sid) return { ok: false, error: 'serviceId_required' };
  const q = Math.max(1, Math.min(100, Number(qty) || 1));

  // Soft catalog validation: a known catalog item enriches the order; an
  // unknown id is still sellable if priceNegotiator can price it (the
  // negotiator enforces the profit floor either way).
  let catalogItem = null;
  try { catalogItem = await serviceCatalog.byId(sid); } catch (e) { console.warn('[salesOrchestrator] catalog lookup failed for', sid, e.message); }

  const pq = await quote(sid);
  if (!pq.ok) return { ok: false, error: 'unpriceable', serviceId: sid };

  const totalUsd = Math.round(pq.usd * q * 100) / 100;
  const orderBase = {
    serviceId: sid,
    serviceTitle: (catalogItem && (catalogItem.title || catalogItem.name)) || sid,
    knownCatalogItem: !!catalogItem,
    qty: q,
    unitUsd: pq.usd,
    totalUsd,
    profitMargin: pq.profitMargin,
    priceSource: pq.source,
    email: email ? String(email).slice(0, 200) : null,
    createdAt: new Date().toISOString(),
  };

  if (dryRun) {
    stats.dryRuns += 1;
    return { ok: true, dryRun: true, order: { ...orderBase, id: 'dry_' + crypto.randomBytes(6).toString('hex'), status: 'simulated' } };
  }

  try {
    const inv = await btcLedger.createInvoice({
      service: sid,
      priceUsd: totalUsd,
      customerEmail: orderBase.email,
      metadata: { ...metadata, qty: q, unitUsd: pq.usd, via: 'salesOrchestrator' },
    });
    stats.orders += 1;
    stats.lastOrderAt = orderBase.createdAt;
    return {
      ok: true,
      order: {
        ...orderBase,
        id: inv.id,
        status: inv.status || 'pending',
        amountSats: inv.amountSats,
        amountBtc: inv.amountBtc,
        payoutAddress: inv.payoutAddress,
        bip21: `bitcoin:${inv.payoutAddress}?amount=${inv.amountBtc}&label=${encodeURIComponent('ZeusAI ' + inv.id)}`,
        // /api/invoice/:id e rutat public de nginx direct la backend (3000),
        // pe când /api/order/:id e revendicat de sovereign-commerce pe site.
        statusUrl: '/api/invoice/' + encodeURIComponent(inv.id),
      },
      invoice: inv,
    };
  } catch (e) {
    stats.failures += 1;
    return { ok: false, error: e.message, serviceId: sid };
  }
}

/** getOrder — invoice + activation (if paid & activated). */
function getOrder(id) {
  const inv = btcLedger.getInvoice(String(id || ''));
  if (!inv) return { ok: false, error: 'not_found', id };
  const activation = getActivationByInvoice(inv.id);
  return { ok: true, order: inv, activation: activation || null };
}

/**
 * handlePaid — called from the backend's _onPaidInvoice (real on-chain
 * confirmation via btcPaymentVerifier) AND from the admin simulate-payment
 * test endpoint. Idempotent: one activation per invoice.
 * Issues: API key (zk_…), license id, 1-year validity. RO: după plată,
 * clientul primește instant acces — cheia API e activarea serviciului.
 */
function handlePaid(invoice) {
  if (!invoice || !invoice.id) return { ok: false, error: 'invoice_required' };
  const existing = getActivationByInvoice(invoice.id);
  if (existing) return { ok: true, activation: existing, idempotent: true };

  const activation = {
    activationId: 'act_' + crypto.randomBytes(9).toString('hex'),
    invoiceId: invoice.id,
    serviceId: invoice.service || invoice.serviceId || 'unknown',
    email: (invoice.customerEmail || (invoice.metadata && invoice.metadata.email)) || null,
    apiKey: 'zk_' + crypto.randomBytes(24).toString('hex'),
    licenseId: 'lic_' + crypto.randomBytes(9).toString('hex'),
    txid: invoice.txid || null,
    activatedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    issuer: 'salesOrchestrator',
  };
  _persistActivation(activation);
  stats.activations += 1;
  stats.lastActivationAt = activation.activatedAt;
  console.log('[salesOrchestrator] ✅ service activated:', activation.serviceId, 'invoice=' + invoice.id, 'license=' + activation.licenseId);
  return { ok: true, activation };
}

function getActivationByInvoice(invoiceId) {
  const target = String(invoiceId || '');
  if (!target) return null;
  const all = _loadActivations();
  // invoice.id e numeric în ledger dar string în query — compară normalizat.
  return all.find((a) => a && String(a.invoiceId) === target) || null;
}

function listActivations({ limit = 50 } = {}) {
  const all = _loadActivations();
  return all.slice(-Math.max(1, limit)).reverse();
}

function getStatus() {
  let activationCount = 0;
  try { activationCount = _loadActivations().length; } catch (e) { console.warn('[salesOrchestrator] activation count failed:', e.message); }
  return {
    module: 'salesOrchestrator',
    deps: { priceNegotiator: true, btcInvoiceLedger: true, serviceCatalog: true },
    profitMargin: priceNegotiator.PROFIT_MARGIN,
    activationsPersisted: activationCount,
    stats,
  };
}

module.exports = { quote, createOrder, getOrder, handlePaid, getActivationByInvoice, listActivations, getStatus };
