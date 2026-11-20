// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:29:34.662Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * btcPaymentVerifier — polls mempool.space for incoming transactions to
 * ADMIN_OWNER_BTC and matches them against pending invoices by exact sats value.
 *
 * Match rule: transaction output to PAYOUT_ADDRESS with value === invoice.amountSats.
 * Marks invoice as paid after >=1 confirmation (or 0 conf if BTC_ACCEPT_UNCONFIRMED=1).
 *
 * Emits via callback so backend / ZAC / mesh can react (e.g. activate service,
 * fire Discord alert).
 */
const https = require('https');

const ledger = require('./btcInvoiceLedger');

const MEMPOOL_API   = process.env.BTC_MEMPOOL_API || 'https://mempool.space/api';
const FALLBACK_APIS = (process.env.BTC_MEMPOOL_FALLBACKS || 'https://blockstream.info/api,https://mempool.emzy.de/api')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const PROVIDER_URLS = Array.from(new Set([MEMPOOL_API.replace(/\/+$/, ''), ...FALLBACK_APIS]));
const POLL_INTERVAL = parseInt(process.env.BTC_POLL_INTERVAL || '30000', 10); // 30s
const MIN_CONF      = parseInt(process.env.BTC_MIN_CONFIRMATIONS || '1', 10);
const ACCEPT_UNCONF = process.env.BTC_ACCEPT_UNCONFIRMED === '1';

function fetchJSON(url, timeoutMs = 8000, { silent = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const req = https.get(url, {
      timeout: timeoutMs,
      agent: false, // Dedicated fresh socket prevents stale keep-alive 'socket hang up'
      headers: {
        'User-Agent': 'ZeusAI-BTC-Verifier/2.0 (+https://zeusai.pro)',
        'Accept': 'application/json',
        'Connection': 'close',
      },
    }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        res.resume();
        return finish(null);
      }
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { try { finish(JSON.parse(buf)); } catch { finish(null); } });
      res.on('error', () => finish(null));
    });
    req.on('timeout', () => {
      req.destroy();
      finish(null);
    });
    req.on('error', (e) => {
      if (!settled && !silent) {
        console.warn('[btcPaymentVerifier] fetchJSON network error:', e.message);
      }
      finish(null);
    });
  });
}

async function fetchAddressTxs(address, stats) {
  let lastFail = null;
  for (let i = 0; i < PROVIDER_URLS.length; i++) {
    const base = PROVIDER_URLS[i];
    const isLast = i === PROVIDER_URLS.length - 1;
    const confirmed = await fetchJSON(`${base}/address/${address}/txs`, 8000, { silent: !isLast });
    if (Array.isArray(confirmed)) {
      if (stats) {
        stats.activeProvider = base;
        if (i > 0) stats.providerFailovers = (stats.providerFailovers || 0) + 1;
      }
      return confirmed;
    }
    lastFail = base;
  }
  if (stats) stats.lastFailedProvider = lastFail;
  return [];
}

function txOutputsToAddress(tx, address) {
  if (!tx || !Array.isArray(tx.vout)) return [];
  return tx.vout.filter((o) => o && o.scriptpubkey_address === address);
}

function createPaymentVerifier({
  address  = ledger.PAYOUT_ADDRESS,
  onPaid   = () => {},
  onError  = () => {},
  intervalMs = POLL_INTERVAL,
} = {}) {
  let timer = null;
  const stats = { polls: 0, matches: 0, errors: 0, providerFailovers: 0, activeProvider: PROVIDER_URLS[0], lastPoll: null, lastMatch: null };

  async function tick() {
    stats.polls += 1;
    stats.lastPoll = new Date().toISOString();
    const pending = ledger.listPending();
    if (pending.length === 0) return;

    const txs = await fetchAddressTxs(address, stats);
    if (!txs.length) return;

    // Build sats -> [tx] map for fast lookup
    const matches = new Map(); // amountSats -> { tx, vout }
    for (const tx of txs) {
      for (const out of txOutputsToAddress(tx, address)) {
        if (!matches.has(out.value)) matches.set(out.value, { tx, vout: out });
      }
    }

    for (const inv of pending) {
      const m = matches.get(inv.amountSats);
      if (!m) continue;
      const conf = (m.tx.status && m.tx.status.confirmed) ? 1 : 0;
      if (!ACCEPT_UNCONF && conf < MIN_CONF) continue;
      const updated = ledger.markPaid(inv.id, { txid: m.tx.txid, confirmations: conf });
      if (updated && updated.status === 'paid') {
        stats.matches += 1;
        stats.lastMatch = new Date().toISOString();
        try { onPaid(updated); } catch (e) { try { onError(e); } catch (cbErr) { console.error('[btcPaymentVerifier] onError callback threw:', cbErr.message); } }
      }
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { tick().catch((e) => { stats.errors += 1; console.error('[btcPaymentVerifier] tick error:', e.message); try { onError(e); } catch (cbErr) { console.error('[btcPaymentVerifier] onError callback threw:', cbErr.message); } }); }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    tick().catch((e) => { stats.errors += 1; console.error('[btcPaymentVerifier] initial tick error:', e.message); try { onError(e); } catch (cbErr) { console.error('[btcPaymentVerifier] onError callback threw:', cbErr.message); } });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function getStatus() {
    return {
      running: !!timer,
      address,
      intervalMs,
      minConfirmations: MIN_CONF,
      acceptUnconfirmed: ACCEPT_UNCONF,
      stats,
    };
  }

  return { start, stop, tick, getStatus };
}

module.exports = { createPaymentVerifier };
