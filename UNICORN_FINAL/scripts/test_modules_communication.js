#!/usr/bin/env node
// =====================================================================
// test_modules_communication.js — proba de comunicare între module.
// RO: importă fiecare modul-cheie, apelează funcțiile principale și
// validează formatul răspunsurilor. Rulează identic local și pe server:
//   node scripts/test_modules_communication.js
// Exit 0 = totul comunică; exit 1 = cel puțin un FAIL.
// Nu scrie nimic în ledgerul real (createOrder rulează cu dryRun:true).
// =====================================================================
'use strict';

const path = require('path');
const M = (rel) => path.resolve(__dirname, '..', 'backend', 'modules', rel);

let pass = 0, fail = 0, skip = 0;
const out = [];
function P(name, detail) { pass++; out.push(`PASS ${name}${detail ? ' — ' + detail : ''}`); }
function F(name, detail) { fail++; out.push(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
function S(name, detail) { skip++; out.push(`SKIP ${name}${detail ? ' — ' + detail : ''}`); }

async function main() {
  // ── 1. priceNegotiator — marjă de profit 30%, prețuri dinamice ─────────
  try {
    const pn = require(M('priceNegotiator.js'));
    const q = await pn.getPrice('website-audit');
    if (q && q.usd > 0 && typeof q.btc === 'string' && q.profitMargin === 1.3) {
      P('priceNegotiator.getPrice(website-audit)', `usd=${q.usd} btc=${q.btc} margin=${q.profitMargin}`);
    } else F('priceNegotiator.getPrice', JSON.stringify(q));
    const q2 = await pn.getPrice('adaptive-ai', { btcRate: 90000 });
    if (q2 && q2.usd > 0 && Number(q2.btc) > 0) P('priceNegotiator with btcRate', `usd=${q2.usd} btc=${q2.btc}`);
    else F('priceNegotiator with btcRate', JSON.stringify(q2));
  } catch (e) { F('priceNegotiator load', e.message); }

  // ── 2. serviceCatalog — fațada canonică ────────────────────────────────
  try {
    const sc = require(M('serviceCatalog.js'));
    const st = sc.getStatus();
    if (st && st.module === 'serviceCatalog') P('serviceCatalog.getStatus()', `inProcess=${st.inProcessSource}`);
    else F('serviceCatalog.getStatus()', JSON.stringify(st));
    const items = await sc.list({ limit: 5 });
    if (Array.isArray(items)) {
      if (items.length > 0) P('serviceCatalog.list()', `${items.length} items, first=${items[0] && items[0].id}`);
      else S('serviceCatalog.list()', 'empty (backend offline in standalone mode — OK la rulare fără server)');
    } else F('serviceCatalog.list()', 'not an array');
  } catch (e) { F('serviceCatalog load', e.message); }

  // ── 3. btcInvoiceLedger — registrul de facturi ─────────────────────────
  try {
    const ledger = require(M('btcInvoiceLedger.js'));
    const st = ledger.getStatus();
    if (st && typeof st === 'object') P('btcInvoiceLedger.getStatus()', JSON.stringify(st).slice(0, 120));
    else F('btcInvoiceLedger.getStatus()', String(st));
    if (typeof ledger.PAYOUT_ADDRESS === 'string' && ledger.PAYOUT_ADDRESS.startsWith('bc1')) {
      P('btcInvoiceLedger.PAYOUT_ADDRESS', ledger.PAYOUT_ADDRESS.slice(0, 12) + '…');
    } else F('btcInvoiceLedger.PAYOUT_ADDRESS', String(ledger.PAYOUT_ADDRESS));
  } catch (e) { F('btcInvoiceLedger load', e.message); }

  // ── 4. btcPaymentVerifier — verificatorul on-chain (fără start) ────────
  try {
    const bv = require(M('btcPaymentVerifier.js'));
    const v = bv.createPaymentVerifier({});
    const st = v.getStatus();
    if (st && st.running === false && st.address) P('btcPaymentVerifier.getStatus()', `addr=${String(st.address).slice(0, 12)}… interval=${st.intervalMs}ms`);
    else F('btcPaymentVerifier.getStatus()', JSON.stringify(st));
  } catch (e) { F('btcPaymentVerifier load', e.message); }

  // ── 5. salesOrchestrator — pipeline-ul complet (dryRun, fără side-effects)
  try {
    const so = require(M('salesOrchestrator.js'));
    const q = await so.quote('website-audit');
    if (q.ok && q.usd > 0) P('salesOrchestrator.quote()', `usd=${q.usd}`);
    else F('salesOrchestrator.quote()', JSON.stringify(q));
    const ord = await so.createOrder({ serviceId: 'website-audit', email: 'test@test.local', dryRun: true });
    if (ord.ok && ord.dryRun && ord.order && ord.order.totalUsd > 0) P('salesOrchestrator.createOrder(dryRun)', `total=${ord.order.totalUsd} margin=${ord.order.profitMargin}`);
    else F('salesOrchestrator.createOrder(dryRun)', JSON.stringify(ord).slice(0, 160));
    const act = so.handlePaid({ id: 'inv_test_' + Date.now(), service: 'website-audit', customerEmail: 'test@test.local', txid: 'simulated' });
    if (act.ok && act.activation && act.activation.apiKey && act.activation.apiKey.startsWith('zk_')) {
      P('salesOrchestrator.handlePaid()→activation', `license=${act.activation.licenseId}`);
    } else F('salesOrchestrator.handlePaid()', JSON.stringify(act).slice(0, 160));
    const st = so.getStatus();
    if (st && st.profitMargin === 1.3) P('salesOrchestrator.getStatus()', `activations=${st.activationsPersisted}`);
    else F('salesOrchestrator.getStatus()', JSON.stringify(st).slice(0, 120));
  } catch (e) { F('salesOrchestrator load', e.message); }

  // ── 6. global-api-gateway ───────────────────────────────────────────────
  try {
    const gw = require(M('global-api-gateway.js'));
    const st = gw.getStatus();
    if (st && typeof st === 'object') P('globalApiGateway.getStatus()', JSON.stringify(st).slice(0, 100));
    else F('globalApiGateway.getStatus()', String(st));
  } catch (e) { F('globalApiGateway load', e.message); }

  // ── 7. auto-marketing ───────────────────────────────────────────────────
  try {
    const am = require(M('auto-marketing.js'));
    const st = am.getStatus();
    if (st && typeof st === 'object') P('autoMarketing.getStatus()', JSON.stringify(st).slice(0, 100));
    else F('autoMarketing.getStatus()', String(st));
    const alloc = am.allocateBudget ? am.allocateBudget({ budget: 1000, channels: [{ name: 'seo', roi: 3 }, { name: 'ads', roi: 1.5 }] }) : null;
    if (alloc) P('autoMarketing.allocateBudget()', JSON.stringify(alloc).slice(0, 100));
    else S('autoMarketing.allocateBudget()', 'helper indisponibil');
  } catch (e) { F('autoMarketing load', e.message); }

  // ── 8. unicornMeshOrchestrator — registrul mesh (fără start) ───────────
  try {
    const mesh = require(M('unicornMeshOrchestrator.js'));
    const st = mesh.getStatus();
    if (st && typeof st === 'object') P('meshOrchestrator.getStatus()', `modules=${(st.modules && Object.keys(st.modules).length) || st.registered || 'n/a'}`);
    else F('meshOrchestrator.getStatus()', String(st));
  } catch (e) { F('meshOrchestrator load', e.message); }

  // ── 9. dynamic-pricing — motorul de prețuri ─────────────────────────────
  try {
    const dp = require(M('dynamic-pricing.js'));
    const p = dp.getPrice('adaptive-ai', { basePrice: 99 });
    if (p && p.finalPrice > 0) P('dynamicPricing.getPrice()', `final=${p.finalPrice} base=${p.basePrice}`);
    else F('dynamicPricing.getPrice()', JSON.stringify(p));
  } catch (e) { F('dynamicPricing load', e.message); }

  // ── 10. ZAC — Zeus Autonomous Core (scan, fără bootstrap) ──────────────
  try {
    const zac = require(M('zeusAutonomousCore/index.js'));
    const st = zac.getStatus();
    if (st && st.version) P('zac.getStatus()', `v${st.version} running=${st.running}`);
    else F('zac.getStatus()', JSON.stringify(st).slice(0, 100));
    const scan = zac.scan({});
    if (scan && (scan.moduleCount > 100)) P('zac.scan()', `modules=${scan.moduleCount} profit=${scan.profitCount}`);
    else F('zac.scan()', JSON.stringify(scan).slice(0, 120));
  } catch (e) { F('zac load', e.message); }

  // ── 11. central-orchestrator ────────────────────────────────────────────
  try {
    const co = require(M('central-orchestrator.js'));
    const st = (typeof co.getStatus === 'function') ? co.getStatus() : co;
    if (st && typeof st === 'object') P('centralOrchestrator.getStatus()', JSON.stringify(st).slice(0, 100));
    else F('centralOrchestrator.getStatus()', String(st));
  } catch (e) { F('centralOrchestrator load', e.message); }

  // ── 12. Dependență transversală: salesOrchestrator → priceNegotiator →
  //        dynamic-pricing — prețul din order == prețul din quote ─────────
  try {
    const so = require(M('salesOrchestrator.js'));
    const pn = require(M('priceNegotiator.js'));
    const [a, b] = await Promise.all([so.quote('pro'), pn.getPrice('pro')]);
    if (a.ok && Math.abs(a.usd - b.usd) < 0.02) P('cross-module price coherence (sales↔negotiator)', `both=${a.usd}`);
    else F('cross-module price coherence', `sales=${a.usd} negotiator=${b.usd}`);
  } catch (e) { F('cross-module coherence', e.message); }

  out.forEach((l) => console.log(l));
  console.log('');
  console.log(`RESULT: pass=${pass} fail=${fail} skip=${skip}`);
  if (fail > 0) { console.log('❌ MODULES COMMUNICATION: FAILURES DETECTED'); process.exit(1); }
  console.log('✅ TOATE MODULELE COMUNICĂ EFICIENT (modules communicate correctly)');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
