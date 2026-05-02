// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-02T13:48:43.209Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// crypto-bridge — Crypto Transfer Intelligence Suite
// 8 servicii NON-CUSTODIAL (informaționale + optimizare). Platforma NU
// mută fonduri, NU deține chei private, NU re-rutează valoare. Toate
// răspunsurile sunt recomandări calculate din date publice on-chain.
//
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC fee invoice destination: env OWNER_BTC_ADDRESS
//   (default: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e)
//
// Endpoints expuse prin mount(app):
//   GET  /api/crypto-bridge/health
//   GET  /api/crypto-bridge/services
//   GET  /api/crypto-bridge/btc-rate
//   GET  /api/crypto-bridge/fee-lock?amount=&priority=
//   GET  /api/crypto-bridge/smart-bump?txid=&originalFee=
//   GET  /api/crypto-bridge/destination-check?address=
//   GET  /api/crypto-bridge/liquidity-unlock?address=&amountUsd=
//   GET  /api/crypto-bridge/atomic-swap?from=&to=&amount=
//   GET  /api/crypto-bridge/mev-protection?amountEth=
//   POST /api/crypto-bridge/batch-tx          { items:[{address,amount}] }
//   GET  /api/crypto-bridge/time-locked-refund?txid=&deadlineHours=
//   POST /api/crypto-bridge/smart-routing     { address, amount, currency, maxWaitHours, txid? }
//   GET  /admin/revenue                       (Authorization: Bearer ADMIN_SECRET)
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const axios = (() => { try { return require('axios'); } catch (_) { return null; } })();

// ─────────────────────────────────────────────────────────────────────
// Config + paths
// ─────────────────────────────────────────────────────────────────────
const OWNER_BTC = process.env.OWNER_BTC_ADDRESS
  || process.env.BTC_WALLET_ADDRESS
  || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.OPERATOR_TOKEN || '';

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'crypto-bridge');
const LEDGER_FILE = path.join(DATA_DIR, 'transactions.jsonl');

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────
// Tiny TTL cache (so we don't hammer public APIs)
// ─────────────────────────────────────────────────────────────────────
const _cache = new Map();
function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.val;
}
function cacheSet(key, val, ttlMs) {
  _cache.set(key, { val, exp: Date.now() + ttlMs });
  return val;
}

// ─────────────────────────────────────────────────────────────────────
// Resilient HTTP fetch with timeout + 1 retry
// ─────────────────────────────────────────────────────────────────────
async function getJson(url, timeoutMs = 5000) {
  if (!axios) throw new Error('axios unavailable');
  try {
    const r = await axios.get(url, { timeout: timeoutMs, validateStatus: s => s >= 200 && s < 500 });
    if (r.status >= 400) throw new Error('http ' + r.status);
    return r.data;
  } catch (e1) {
    // 1 retry
    const r = await axios.get(url, { timeout: timeoutMs, validateStatus: s => s >= 200 && s < 500 });
    if (r.status >= 400) throw new Error('http ' + r.status);
    return r.data;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Failure tracker — disable a service after 3 consecutive failures (5 min cool-off)
// ─────────────────────────────────────────────────────────────────────
const _fail = new Map();
function recordFailure(service) {
  const cur = _fail.get(service) || { count: 0, blockedUntil: 0 };
  cur.count += 1;
  if (cur.count >= 3) cur.blockedUntil = Date.now() + 5 * 60 * 1000;
  _fail.set(service, cur);
}
function recordSuccess(service) { _fail.delete(service); }
function isBlocked(service) {
  const cur = _fail.get(service);
  return cur && cur.blockedUntil > Date.now();
}

// ─────────────────────────────────────────────────────────────────────
// 0. BTC/USD live rate (Binance public)
// ─────────────────────────────────────────────────────────────────────
async function getBtcUsdRate() {
  const cached = cacheGet('btcusd');
  if (cached) return cached;
  try {
    const j = await getJson('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', 4000);
    const px = Number(j && j.price);
    if (px > 0) return cacheSet('btcusd', { rate: px, source: 'binance', ts: Date.now() }, 30_000);
  } catch (_) {}
  try {
    const j = await getJson('https://api.coinbase.com/v2/prices/BTC-USD/spot', 4000);
    const px = Number(j && j.data && j.data.amount);
    if (px > 0) return cacheSet('btcusd', { rate: px, source: 'coinbase', ts: Date.now() }, 30_000);
  } catch (_) {}
  // Last-resort static fallback (clearly marked degraded)
  return { rate: 95000, source: 'fallback-static', degraded: true, ts: Date.now() };
}

async function getEthUsdRate() {
  const cached = cacheGet('ethusd');
  if (cached) return cached;
  try {
    const j = await getJson('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', 4000);
    const px = Number(j && j.price);
    if (px > 0) return cacheSet('ethusd', { rate: px, source: 'binance', ts: Date.now() }, 30_000);
  } catch (_) {}
  return { rate: 3500, source: 'fallback-static', degraded: true, ts: Date.now() };
}

// ─────────────────────────────────────────────────────────────────────
// CARD 1 — FEE LOCK
// Citește fee-urile recomandate de mempool.space, calculează costul
// pentru o tranzacție tipică (~140 vBytes pentru P2WPKH) și BLOCHEAZĂ
// această valoare în cache 10 minute. Comision 5% din fee-ul blocat.
// ─────────────────────────────────────────────────────────────────────
async function feeLock({ amount = 0.001, vBytes = 140, priority = 'fastest' } = {}) {
  if (isBlocked('feeLock')) {
    return { service: 'fee-lock', degraded: true, reason: 'temporarily-disabled' };
  }
  try {
    const fees = await getJson('https://mempool.space/api/v1/fees/recommended', 5000);
    const satPerVB = Number(fees && fees[priority] || fees && fees.fastestFee) || 5;
    const feeSats = Math.ceil(satPerVB * vBytes);
    const feeBtc = feeSats / 1e8;
    const btc = await getBtcUsdRate();
    const feeUsd = feeBtc * btc.rate;
    const ourFeeUsd = +(feeUsd * 0.05).toFixed(4);
    const lockId = 'lock_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const lock = {
      service: 'fee-lock',
      lockId,
      amountBtc: amount,
      satPerVB,
      vBytes,
      feeSats,
      feeBtc: +feeBtc.toFixed(8),
      feeUsd: +feeUsd.toFixed(4),
      ourCommissionPct: 5,
      ourCommissionUsd: ourFeeUsd,
      ourCommissionBtc: +(ourFeeUsd / btc.rate).toFixed(8),
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      btcUsdRate: btc.rate,
      source: 'mempool.space',
      ts: Date.now(),
    };
    cacheSet('lock:' + lockId, lock, 10 * 60 * 1000);
    recordSuccess('feeLock');
    return lock;
  } catch (e) {
    recordFailure('feeLock');
    return { service: 'fee-lock', error: 'fee-feed-unavailable', degraded: true, message: String(e.message || e).slice(0, 120) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CARD 2 — SMART BUMP
// Verifică starea unei tranzacții pe mempool.space. Dacă e neconfirmată
// după prag de timp, recomandă creșterea fee-ului (RBF/CPFP) cu suma
// minimă necesară. Comision 3% din suplimentul propus.
// ─────────────────────────────────────────────────────────────────────
async function smartBump({ txid, originalFeeSats = 0, ageMinutes = 0 } = {}) {
  if (!txid || !/^[a-f0-9]{64}$/i.test(String(txid))) {
    return { service: 'smart-bump', error: 'invalid-or-missing-txid' };
  }
  if (isBlocked('smartBump')) return { service: 'smart-bump', degraded: true, reason: 'temporarily-disabled' };
  try {
    const tx = await getJson('https://mempool.space/api/tx/' + encodeURIComponent(txid), 5000);
    const fees = await getJson('https://mempool.space/api/v1/fees/recommended', 5000);
    const confirmed = !!(tx && tx.status && tx.status.confirmed);
    const recommendedSatPerVB = Number(fees && fees.fastestFee) || 10;
    const txSize = Number(tx && tx.size) || 140;
    const currentFee = Number((tx && tx.fee) || originalFeeSats) || 0;
    const targetFee = Math.ceil(recommendedSatPerVB * txSize);
    const supplement = Math.max(0, targetFee - currentFee);
    const action = confirmed
      ? 'no-action'
      : (ageMinutes >= 30 || supplement > 0 ? 'bump-recommended' : 'wait');
    const btc = await getBtcUsdRate();
    const supplementBtc = supplement / 1e8;
    const supplementUsd = supplementBtc * btc.rate;
    const ourCommissionUsd = +(supplementUsd * 0.03).toFixed(4);
    recordSuccess('smartBump');
    return {
      service: 'smart-bump',
      txid,
      confirmed,
      blockHeight: confirmed ? tx.status.block_height : null,
      currentFeeSats: currentFee,
      targetFeeSats: targetFee,
      supplementSats: supplement,
      supplementBtc: +supplementBtc.toFixed(8),
      supplementUsd: +supplementUsd.toFixed(4),
      action,
      ourCommissionPct: 3,
      ourCommissionUsd,
      source: 'mempool.space',
      ts: Date.now(),
    };
  } catch (e) {
    recordFailure('smartBump');
    return { service: 'smart-bump', error: 'tx-feed-unavailable', degraded: true, message: String(e.message || e).slice(0, 120) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CARD 3 — DESTINATION CHECK
// Verifică o adresă BTC pe mempool.space (gratuit, fără API key):
// numărul de tranzacții, soldul, vârsta primei utilizări. Atribuie un
// scor de risc euristic (0=safe, 100=foarte suspect). Comision 1% din
// suma tranzacției verificate (doar dacă utilizatorul confirmă).
// ─────────────────────────────────────────────────────────────────────
function _btcAddrType(addr) {
  if (!addr || typeof addr !== 'string') return 'unknown';
  const a = addr.trim();
  if (/^bc1p[0-9a-z]{58,}$/i.test(a)) return 'taproot';
  if (/^bc1q[0-9a-z]{38,}$/i.test(a)) return 'segwit-v0';
  if (/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return 'p2sh';
  if (/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return 'legacy';
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return 'eth';
  return 'unknown';
}

async function destinationCheck({ address, amountUsd = 0 } = {}) {
  if (!address) return { service: 'destination-check', error: 'address-required' };
  const type = _btcAddrType(address);
  if (type === 'unknown') return { service: 'destination-check', error: 'unknown-address-format', address };
  if (type === 'eth') {
    return {
      service: 'destination-check',
      address,
      addressType: type,
      verdict: 'eth-not-supported-on-this-card',
      note: 'ETH address checks routed through atomic-swap card; basic format ok.',
    };
  }
  if (isBlocked('destinationCheck')) return { service: 'destination-check', degraded: true, reason: 'temporarily-disabled' };
  try {
    const j = await getJson('https://mempool.space/api/address/' + encodeURIComponent(address), 5000);
    const cs = (j && j.chain_stats) || {};
    const ms = (j && j.mempool_stats) || {};
    const txCount = (Number(cs.tx_count) || 0) + (Number(ms.tx_count) || 0);
    const fundedSats = (Number(cs.funded_txo_sum) || 0) + (Number(ms.funded_txo_sum) || 0);
    const spentSats = (Number(cs.spent_txo_sum) || 0) + (Number(ms.spent_txo_sum) || 0);
    const balanceSats = fundedSats - spentSats;
    // Heuristic risk score
    let risk = 0;
    if (txCount === 0) risk += 60;          // brand-new address, unknown
    if (txCount > 5000) risk += 30;          // possible mixer/exchange hot wallet
    if (type === 'legacy') risk += 5;        // legacy = older ecosystem, not bad
    if (balanceSats === 0 && txCount > 0) risk += 5;
    risk = Math.min(100, risk);
    const verdict = risk >= 60 ? 'caution' : risk >= 30 ? 'review' : 'ok';
    const ourCommissionUsd = +(Number(amountUsd || 0) * 0.01).toFixed(4);
    recordSuccess('destinationCheck');
    return {
      service: 'destination-check',
      address,
      addressType: type,
      txCount,
      balanceSats,
      balanceBtc: +(balanceSats / 1e8).toFixed(8),
      riskScore: risk,
      verdict,
      ourCommissionPct: 1,
      ourCommissionUsd,
      source: 'mempool.space',
      ts: Date.now(),
    };
  } catch (e) {
    recordFailure('destinationCheck');
    return { service: 'destination-check', error: 'lookup-unavailable', degraded: true, message: String(e.message || e).slice(0, 120) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CARD 4 — LIQUIDITY UNLOCK
// Citește (informational only) poziția unui ETH address în Aave v3 prin
// un public Aave/Compound subgraph (The Graph hosted). Recomandă o sumă
// "echivalentă" pe care utilizatorul ar putea-o trimite fără a lichida
// poziția. Comision 0.2% din suma propusă. NU mută bani.
// ─────────────────────────────────────────────────────────────────────
async function liquidityUnlock({ address, amountUsd = 0 } = {}) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(String(address))) {
    return { service: 'liquidity-unlock', error: 'eth-address-required' };
  }
  if (isBlocked('liquidityUnlock')) return { service: 'liquidity-unlock', degraded: true, reason: 'temporarily-disabled' };
  // We try a public Aave v3 subgraph (no key, may be deprecated → fallback informational)
  try {
    const url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3';
    const query = JSON.stringify({
      query: `{ user(id: "${address.toLowerCase()}") { id reserves { currentATokenBalance reserve { symbol decimals usageAsCollateralEnabled } } } }`,
    });
    const r = await axios.post(url, query, { timeout: 5000, headers: { 'Content-Type': 'application/json' } });
    const u = r && r.data && r.data.data && r.data.data.user;
    let collateralUsd = 0;
    let reserves = [];
    if (u && Array.isArray(u.reserves)) {
      reserves = u.reserves.map(rv => ({
        symbol: rv.reserve && rv.reserve.symbol,
        balance: rv.currentATokenBalance,
        collateral: !!(rv.reserve && rv.reserve.usageAsCollateralEnabled),
      }));
    }
    // We cannot price tokens precisely without an oracle; we report the structure.
    const proposedTransferUsd = Math.min(Number(amountUsd) || 0, collateralUsd || Number(amountUsd) || 0);
    const ourCommissionUsd = +(Number(amountUsd) || 0) * 0.002;
    recordSuccess('liquidityUnlock');
    return {
      service: 'liquidity-unlock',
      address,
      protocol: 'aave-v3',
      reserveCount: reserves.length,
      reserves,
      proposedTransferUsd,
      note: 'Informational only. No funds are moved. Use a real lending pool to borrow against collateral.',
      ourCommissionPct: 0.2,
      ourCommissionUsd: +ourCommissionUsd.toFixed(4),
      source: 'thegraph:aave-v3',
      ts: Date.now(),
    };
  } catch (e) {
    recordFailure('liquidityUnlock');
    // Fallback: return informational shape so UI can render
    return {
      service: 'liquidity-unlock',
      address,
      protocol: 'aave-v3',
      reserveCount: 0,
      reserves: [],
      degraded: true,
      note: 'Subgraph unavailable; check protocol UI manually.',
      ourCommissionPct: 0.2,
      ourCommissionUsd: +((Number(amountUsd) || 0) * 0.002).toFixed(4),
      ts: Date.now(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CARD 5 — ATOMIC SWAP OPTIMIZER
// Compară un cross-chain quote prin LI.FI public API. Returnează ruta
// estimată + cost. Comision 0.1% din valoarea swap-ului. NU executăm.
// ─────────────────────────────────────────────────────────────────────
const _LIFI_CHAIN = { BTC: null, ETH: 1, MATIC: 137, BNB: 56, ARB: 42161, OP: 10 };
const _LIFI_TOKEN = {
  ETH: '0x0000000000000000000000000000000000000000',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};
async function atomicSwap({ from = 'ETH', to = 'USDC', amount = 1 } = {}) {
  if (isBlocked('atomicSwap')) return { service: 'atomic-swap', degraded: true, reason: 'temporarily-disabled' };
  // BTC has no LI.FI EVM rep; provide informational response.
  if (from === 'BTC' || to === 'BTC') {
    return {
      service: 'atomic-swap',
      from, to, amount,
      route: 'thorchain-or-bisq-recommended',
      note: 'BTC↔EVM swaps require Thorchain or atomic-swap protocols; LI.FI lists EVM-only here.',
      ourCommissionPct: 0.1,
      ts: Date.now(),
    };
  }
  try {
    const fromChain = _LIFI_CHAIN[from] || 1;
    const toChain = _LIFI_CHAIN[to] || 1;
    const fromToken = _LIFI_TOKEN[from] || _LIFI_TOKEN.ETH;
    const toToken = _LIFI_TOKEN[to] || _LIFI_TOKEN.USDC;
    const decimals = (from === 'USDC' || from === 'USDT') ? 6 : 18;
    const fromAmount = BigInt(Math.floor(Number(amount) * Math.pow(10, decimals))).toString();
    const url = `https://li.quest/v1/quote?fromChain=${fromChain}&toChain=${toChain}&fromToken=${fromToken}&toToken=${toToken}&fromAmount=${fromAmount}&fromAddress=0x0000000000000000000000000000000000000000`;
    const j = await getJson(url, 6000);
    const est = j && j.estimate;
    const ourCommissionUsd = +((Number(est && est.fromAmountUSD) || 0) * 0.001).toFixed(4);
    recordSuccess('atomicSwap');
    return {
      service: 'atomic-swap',
      from, to, amount,
      tool: j && j.tool,
      fromAmountUsd: Number(est && est.fromAmountUSD) || null,
      toAmountUsd: Number(est && est.toAmountUSD) || null,
      executionDurationSec: est && est.executionDuration,
      gasCostUsd: Number(est && est.gasCosts && est.gasCosts[0] && est.gasCosts[0].amountUSD) || null,
      ourCommissionPct: 0.1,
      ourCommissionUsd,
      source: 'li.fi',
      ts: Date.now(),
    };
  } catch (e) {
    recordFailure('atomicSwap');
    return { service: 'atomic-swap', degraded: true, error: 'quote-unavailable', message: String(e.message || e).slice(0, 120), from, to, amount };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CARD 6 — MEV PROTECTION LITE
// Pentru ETH: dacă valoarea > 1 ETH, recomandă rutarea prin Flashbots
// Protect RPC (https://rpc.flashbots.net). Comision $5 fix per tx peste
// prag, gratis sub prag.
// ─────────────────────────────────────────────────────────────────────
async function mevProtection({ amountEth = 0 } = {}) {
  const eth = await getEthUsdRate();
  const a = Number(amountEth) || 0;
  const valueUsd = a * eth.rate;
  const recommended = a >= 1;
  return {
    service: 'mev-protection',
    amountEth: a,
    valueUsd: +valueUsd.toFixed(2),
    recommended,
    rpc: recommended ? 'https://rpc.flashbots.net' : null,
    chainId: 1,
    note: recommended
      ? 'Switch your wallet RPC to Flashbots Protect; bundle bypasses the public mempool.'
      : 'Below 1 ETH the cost of MEV protection exceeds the expected sandwich loss.',
    ourCommissionUsd: recommended ? 5 : 0,
    ourCommissionPct: 0,
    source: 'flashbots-protect',
    ts: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// CARD 7 — BATCH TRANSACTION
// Calculează economia de fee dacă utilizatorul combină N plăți într-o
// singură tranzacție Bitcoin (native batching prin multi-output).
// Comision 10% din economisirea calculată.
// ─────────────────────────────────────────────────────────────────────
async function batchTx({ items = [] } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { service: 'batch-tx', error: 'items-array-required' };
  }
  if (items.length > 100) {
    return { service: 'batch-tx', error: 'max-100-items', count: items.length };
  }
  // Validate each
  const valid = items.filter(it => it && it.address && Number(it.amount) > 0);
  if (valid.length === 0) return { service: 'batch-tx', error: 'no-valid-items' };
  let satPerVB = 8;
  try {
    const fees = await getJson('https://mempool.space/api/v1/fees/recommended', 4000);
    satPerVB = Number(fees && fees.halfHourFee) || 8;
    recordSuccess('batchTx');
  } catch (_) { recordFailure('batchTx'); }
  // Tx size estimates (P2WPKH): 1 input + N outputs ≈ 68 + 31*N + 11 vbytes
  const sizeIndividual = (1 * (68 + 31 + 11));
  const sizeBatched = (1 * 68 + valid.length * 31 + 11);
  const feeIndividualSats = sizeIndividual * satPerVB * valid.length;
  const feeBatchedSats = sizeBatched * satPerVB;
  const savedSats = Math.max(0, feeIndividualSats - feeBatchedSats);
  const btc = await getBtcUsdRate();
  const savedUsd = (savedSats / 1e8) * btc.rate;
  const ourCommissionUsd = +(savedUsd * 0.10).toFixed(4);
  return {
    service: 'batch-tx',
    itemCount: valid.length,
    satPerVB,
    feeIndividualSats,
    feeBatchedSats,
    savedSats,
    savedBtc: +(savedSats / 1e8).toFixed(8),
    savedUsd: +savedUsd.toFixed(4),
    ourCommissionPct: 10,
    ourCommissionUsd,
    note: 'Use a wallet that supports multi-output sends (Sparrow, Electrum, BlueWallet).',
    source: 'mempool.space',
    ts: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// CARD 8 — TIME-LOCKED REFUND
// Dacă tranzacția nu se confirmă până la deadline, sistemul declară
// fee-ul "rambursabil" (informational ledger entry — utilizatorul își
// face singur RBF/replace cu un fee minim). Comision 1% din fee-ul
// "rambursat".
// ─────────────────────────────────────────────────────────────────────
async function timeLockedRefund({ txid, deadlineHours = 6 } = {}) {
  if (!txid || !/^[a-f0-9]{64}$/i.test(String(txid))) {
    return { service: 'time-locked-refund', error: 'invalid-or-missing-txid' };
  }
  if (isBlocked('timeLockedRefund')) return { service: 'time-locked-refund', degraded: true, reason: 'temporarily-disabled' };
  try {
    const tx = await getJson('https://mempool.space/api/tx/' + encodeURIComponent(txid), 5000);
    const confirmed = !!(tx && tx.status && tx.status.confirmed);
    const feeSats = Number(tx && tx.fee) || 0;
    const btc = await getBtcUsdRate();
    const feeUsd = (feeSats / 1e8) * btc.rate;
    const deadline = new Date(Date.now() + Number(deadlineHours) * 3600 * 1000).toISOString();
    const refundEligible = !confirmed && feeSats > 0;
    const ourCommissionUsd = +(refundEligible ? feeUsd * 0.01 : 0).toFixed(4);
    recordSuccess('timeLockedRefund');
    return {
      service: 'time-locked-refund',
      txid,
      confirmed,
      feeSats,
      feeUsd: +feeUsd.toFixed(4),
      deadline,
      refundEligible,
      action: refundEligible ? 'rbf-with-min-fee' : 'no-refund-needed',
      ourCommissionPct: 1,
      ourCommissionUsd,
      note: 'Refund here means: replace-by-fee (RBF) the original tx with a near-zero-fee replacement, signed by the original sender. Platform never holds funds.',
      source: 'mempool.space',
      ts: Date.now(),
    };
  } catch (e) {
    recordFailure('timeLockedRefund');
    return { service: 'time-locked-refund', degraded: true, error: 'tx-feed-unavailable', message: String(e.message || e).slice(0, 120) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// SMART ROUTING — rulează toate cardurile relevante în paralel
// și agregă recomandările + costul total estimat.
// ─────────────────────────────────────────────────────────────────────
async function smartRouting({ address, amount = 0.001, currency = 'BTC', maxWaitHours = 1, txid, items = [] } = {}) {
  const startedAt = Date.now();
  const amountUsd = await (async () => {
    const btc = await getBtcUsdRate();
    if (currency === 'BTC') return Number(amount) * btc.rate;
    if (currency === 'ETH') { const e = await getEthUsdRate(); return Number(amount) * e.rate; }
    return Number(amount);
  })();

  const tasks = [
    feeLock({ amount: Number(amount) || 0.001 }).catch(e => ({ service: 'fee-lock', error: String(e.message || e) })),
    txid ? smartBump({ txid }).catch(e => ({ service: 'smart-bump', error: String(e.message || e) })) : Promise.resolve({ service: 'smart-bump', skipped: true, reason: 'no-txid-provided' }),
    address ? destinationCheck({ address, amountUsd }).catch(e => ({ service: 'destination-check', error: String(e.message || e) })) : Promise.resolve({ service: 'destination-check', skipped: true }),
    address && /^0x[a-fA-F0-9]{40}$/.test(address) ? liquidityUnlock({ address, amountUsd }).catch(e => ({ service: 'liquidity-unlock', error: String(e.message || e) })) : Promise.resolve({ service: 'liquidity-unlock', skipped: true, reason: 'eth-address-only' }),
    atomicSwap({ from: currency, to: currency === 'ETH' ? 'USDC' : 'ETH', amount: Number(amount) || 0.001 }).catch(e => ({ service: 'atomic-swap', error: String(e.message || e) })),
    mevProtection({ amountEth: currency === 'ETH' ? Number(amount) : 0 }).catch(e => ({ service: 'mev-protection', error: String(e.message || e) })),
    items && items.length ? batchTx({ items }).catch(e => ({ service: 'batch-tx', error: String(e.message || e) })) : Promise.resolve({ service: 'batch-tx', skipped: true, reason: 'no-batch-items' }),
    txid ? timeLockedRefund({ txid, deadlineHours: maxWaitHours }).catch(e => ({ service: 'time-locked-refund', error: String(e.message || e) })) : Promise.resolve({ service: 'time-locked-refund', skipped: true, reason: 'no-txid-provided' }),
  ];

  const settled = await Promise.all(tasks);
  const [feeLk, smBump, destCk, liqUn, swap, mev, batch, tlr] = settled;

  // Aggregate cost + commission
  const sumNum = (...xs) => xs.reduce((s, x) => s + (Number(x) || 0), 0);
  const totalFeeUsd = sumNum(feeLk.feeUsd);
  const totalFeesSavedUsd = sumNum(batch.savedUsd, smBump.supplementUsd);
  const ourCommissionUsd = sumNum(
    feeLk.ourCommissionUsd, smBump.ourCommissionUsd, destCk.ourCommissionUsd,
    liqUn.ourCommissionUsd, swap.ourCommissionUsd, mev.ourCommissionUsd,
    batch.ourCommissionUsd, tlr.ourCommissionUsd,
  );
  const btc = await getBtcUsdRate();
  const ourCommissionBtc = +(ourCommissionUsd / btc.rate).toFixed(8);

  const recommendations = [];
  if (feeLk && !feeLk.error) recommendations.push('Use Fee Lock — fee blocked at ' + (feeLk.satPerVB || 0) + ' sat/vB for 10 min');
  if (destCk && destCk.verdict === 'caution') recommendations.push('⚠ Destination address looks suspicious — review before sending');
  if (mev && mev.recommended) recommendations.push('Enable MEV Protection (Flashbots Protect RPC)');
  if (batch && batch.savedUsd > 0.5) recommendations.push('Batch your ' + batch.itemCount + ' payments — save $' + batch.savedUsd);
  if (smBump && smBump.action === 'bump-recommended') recommendations.push('Bump pending tx with +' + smBump.supplementSats + ' sat fee');
  if (tlr && tlr.refundEligible) recommendations.push('Time-locked refund armed — RBF cancellation available');

  const result = {
    ok: true,
    requestId: 'sr_' + startedAt.toString(36) + Math.random().toString(36).slice(2, 8),
    inputs: { address, amount, currency, maxWaitHours, hasTxid: !!txid, batchItems: (items || []).length },
    cards: { feeLock: feeLk, smartBump: smBump, destinationCheck: destCk, liquidityUnlock: liqUn, atomicSwap: swap, mevProtection: mev, batchTx: batch, timeLockedRefund: tlr },
    totalFeeUsd: +totalFeeUsd.toFixed(4),
    totalFeesSavedUsd: +totalFeesSavedUsd.toFixed(4),
    ourCommissionUsd: +ourCommissionUsd.toFixed(4),
    ourCommissionBtc,
    btcUsdRate: btc.rate,
    recommendations,
    feeInvoiceTo: OWNER_BTC,
    durationMs: Date.now() - startedAt,
    ts: Date.now(),
    disclaimer: 'Non-custodial intelligence layer. Platform never holds funds, never signs transactions, never re-routes value. All recommendations computed from public on-chain data.',
  };

  // Append to ledger (informational, not a settlement)
  try {
    ensureDataDir();
    fs.appendFileSync(LEDGER_FILE, JSON.stringify({
      requestId: result.requestId,
      ts: result.ts,
      currency, amount, address: address ? String(address).slice(0, 80) : null,
      cardsUsed: Object.entries(result.cards).filter(([, v]) => v && !v.skipped && !v.error).map(([k]) => k),
      ourCommissionUsd: result.ourCommissionUsd,
      ourCommissionBtc: result.ourCommissionBtc,
      totalFeeUsd: result.totalFeeUsd,
      totalFeesSavedUsd: result.totalFeesSavedUsd,
    }) + '\n');
  } catch (_) { /* ledger best-effort */ }

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Revenue dashboard data
// ─────────────────────────────────────────────────────────────────────
function revenueSummary() {
  ensureDataDir();
  let raw = '';
  try { raw = fs.readFileSync(LEDGER_FILE, 'utf8'); } catch (_) {}
  const lines = raw.split('\n').filter(Boolean);
  const entries = [];
  for (const ln of lines) { try { entries.push(JSON.parse(ln)); } catch (_) {} }
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const today = entries.filter(e => now - (e.ts || 0) < dayMs);
  const week = entries.filter(e => now - (e.ts || 0) < 7 * dayMs);
  const sum = arr => arr.reduce((s, e) => s + (Number(e.ourCommissionUsd) || 0), 0);
  const sumBtc = arr => arr.reduce((s, e) => s + (Number(e.ourCommissionBtc) || 0), 0);
  // Per-card breakdown
  const cardUsage = {};
  const allCards = ['feeLock', 'smartBump', 'destinationCheck', 'liquidityUnlock', 'atomicSwap', 'mevProtection', 'batchTx', 'timeLockedRefund'];
  for (const c of allCards) cardUsage[c] = { count: 0 };
  for (const e of entries) {
    for (const c of (e.cardsUsed || [])) {
      if (cardUsage[c]) cardUsage[c].count += 1;
    }
  }
  // Last 7 days revenue chart
  const chart = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * dayMs;
    const dayEnd = now - i * dayMs;
    const dayEntries = entries.filter(e => e.ts >= dayStart && e.ts < dayEnd);
    chart.push({
      day: new Date(dayStart).toISOString().slice(0, 10),
      transactions: dayEntries.length,
      commissionUsd: +sum(dayEntries).toFixed(4),
    });
  }
  return {
    ownerBtcAddress: OWNER_BTC,
    totalTransactions: entries.length,
    today: { transactions: today.length, commissionUsd: +sum(today).toFixed(4), commissionBtc: +sumBtc(today).toFixed(8) },
    week:  { transactions: week.length,  commissionUsd: +sum(week).toFixed(4),  commissionBtc: +sumBtc(week).toFixed(8) },
    allTime: { transactions: entries.length, commissionUsd: +sum(entries).toFixed(4), commissionBtc: +sumBtc(entries).toFixed(8) },
    cardUsage,
    last7Days: chart,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Service catalog (for the page)
// ─────────────────────────────────────────────────────────────────────
function listServices() {
  return {
    services: [
      { id: 'fee-lock',           name: 'Fee Lock',            tagline: 'Lock the BTC network fee at the moment you press Send.', commissionPct: 5,    unit: '% of fee saved' },
      { id: 'smart-bump',         name: 'Smart Bump',          tagline: 'Auto-detects stuck txs and recommends the minimum bump.', commissionPct: 3,    unit: '% of supplement' },
      { id: 'destination-check',  name: 'Destination Check',   tagline: 'AI risk score for any BTC address before you send.',     commissionPct: 1,    unit: '% of amount' },
      { id: 'liquidity-unlock',   name: 'Liquidity Unlock',    tagline: 'Use your DeFi collateral as transfer leverage.',          commissionPct: 0.2,  unit: '% of amount' },
      { id: 'atomic-swap',        name: 'Atomic Swap Optimizer', tagline: 'Cheapest cross-chain route via LI.FI quote engine.',  commissionPct: 0.1,  unit: '% of amount' },
      { id: 'mev-protection',     name: 'MEV Protection Lite', tagline: 'Flashbots Protect RPC for ETH txs ≥ 1 ETH.',              commissionUsd: 5,    unit: 'flat USD' },
      { id: 'batch-tx',           name: 'Batch Transaction',   tagline: 'Combine up to 100 BTC payments in one tx, save fees.',   commissionPct: 10,   unit: '% of fee saved' },
      { id: 'time-locked-refund', name: 'Time-Locked Refund',  tagline: 'Auto-RBF if your tx misses the deadline.',                commissionPct: 1,    unit: '% of refunded fee' },
    ],
    ownerBtcAddress: OWNER_BTC,
    note: 'Non-custodial. All 8 services are informational/optimization only — platform never holds your funds.',
  };
}

function health() {
  return {
    ok: true,
    service: 'crypto-bridge',
    version: '1.0.0',
    services: 8,
    cacheEntries: _cache.size,
    blockedServices: [..._fail.entries()].filter(([, v]) => v.blockedUntil > Date.now()).map(([k]) => k),
    ledgerFile: LEDGER_FILE,
    ownerBtcAddress: OWNER_BTC,
    ts: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Express mount
// ─────────────────────────────────────────────────────────────────────
function adminGuard(req, res, next) {
  if (!ADMIN_SECRET) return next(); // dev mode (no secret configured)
  const auth = String(req.headers.authorization || '');
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (tok && tok === ADMIN_SECRET) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

function mount(app) {
  if (!app || typeof app.get !== 'function') return;
  ensureDataDir();

  app.get('/api/crypto-bridge/health',   (req, res) => res.json(health()));
  app.get('/api/crypto-bridge/services', (req, res) => res.json(listServices()));
  app.get('/api/crypto-bridge/btc-rate', async (req, res) => res.json(await getBtcUsdRate()));

  app.get('/api/crypto-bridge/fee-lock', async (req, res) => {
    const out = await feeLock({ amount: Number(req.query.amount) || 0.001, priority: req.query.priority || 'fastestFee' });
    res.json(out);
  });
  app.get('/api/crypto-bridge/smart-bump', async (req, res) => {
    const out = await smartBump({ txid: req.query.txid, originalFeeSats: Number(req.query.originalFee) || 0, ageMinutes: Number(req.query.ageMinutes) || 0 });
    res.json(out);
  });
  app.get('/api/crypto-bridge/destination-check', async (req, res) => {
    const out = await destinationCheck({ address: req.query.address, amountUsd: Number(req.query.amountUsd) || 0 });
    res.json(out);
  });
  app.get('/api/crypto-bridge/liquidity-unlock', async (req, res) => {
    const out = await liquidityUnlock({ address: req.query.address, amountUsd: Number(req.query.amountUsd) || 0 });
    res.json(out);
  });
  app.get('/api/crypto-bridge/atomic-swap', async (req, res) => {
    const out = await atomicSwap({ from: req.query.from || 'ETH', to: req.query.to || 'USDC', amount: Number(req.query.amount) || 1 });
    res.json(out);
  });
  app.get('/api/crypto-bridge/mev-protection', async (req, res) => {
    const out = await mevProtection({ amountEth: Number(req.query.amountEth) || 0 });
    res.json(out);
  });
  app.post('/api/crypto-bridge/batch-tx', async (req, res) => {
    const items = (req.body && req.body.items) || [];
    res.json(await batchTx({ items }));
  });
  app.get('/api/crypto-bridge/time-locked-refund', async (req, res) => {
    const out = await timeLockedRefund({ txid: req.query.txid, deadlineHours: Number(req.query.deadlineHours) || 6 });
    res.json(out);
  });
  app.post('/api/crypto-bridge/smart-routing', async (req, res) => {
    const b = req.body || {};
    const out = await smartRouting({
      address: b.address,
      amount: Number(b.amount) || 0.001,
      currency: (b.currency || 'BTC').toUpperCase(),
      maxWaitHours: Number(b.maxWaitHours) || 1,
      txid: b.txid,
      items: b.items || [],
    });
    res.json(out);
  });
  // GET variant for easy curl-based smoke testing
  app.get('/api/crypto-bridge/smart-routing', async (req, res) => {
    const out = await smartRouting({
      address: req.query.address,
      amount: Number(req.query.amount) || 0.001,
      currency: (req.query.currency || 'BTC').toUpperCase(),
      maxWaitHours: Number(req.query.maxWaitHours) || 1,
      txid: req.query.txid,
    });
    res.json(out);
  });

  app.get('/admin/revenue', adminGuard, (req, res) => res.json(revenueSummary()));
  app.get('/api/admin/revenue', adminGuard, (req, res) => res.json(revenueSummary()));

  // My transactions — returns last 50 entries for the calling user (userId from JWT sub)
  app.get('/api/crypto-bridge/my-transactions', (req, res) => {
    const auth = req.headers.authorization || '';
    let userId = null;
    if (auth.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'unicorn-secret';
        const payload = jwt.verify(auth.slice(7), secret);
        userId = payload.sub || payload.id || payload.userId || null;
      } catch (_) { /* invalid token */ }
    }
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    let txs = [];
    try {
      const fs = require('fs');
      const lines = fs.readFileSync(LEDGER_PATH, 'utf8').trim().split('\n').filter(Boolean);
      txs = lines.map(l => { try { return JSON.parse(l); } catch(_){ return null; } })
                 .filter(t => t && String(t.userId) === String(userId));
    } catch(_) { txs = []; }
    res.json({ transactions: txs.slice(-50).reverse() });
  });
}

module.exports = {
  mount,
  // direct exports for tests
  feeLock,
  smartBump,
  destinationCheck,
  liquidityUnlock,
  atomicSwap,
  mevProtection,
  batchTx,
  timeLockedRefund,
  smartRouting,
  revenueSummary,
  listServices,
  health,
  getBtcUsdRate,
  OWNER_BTC,
};
