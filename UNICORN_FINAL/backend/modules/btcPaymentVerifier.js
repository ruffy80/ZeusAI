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
const POLL_INTERVAL = parseInt(process.env.BTC_POLL_INTERVAL || '30000', 10); // 30s
const MIN_CONF      = parseInt(process.env.BTC_MIN_CONFIRMATIONS || '1', 10);
const ACCEPT_UNCONF = process.env.BTC_ACCEPT_UNCONFIRMED === '1';

function fetchJSON(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function fetchAddressTxs(address) {
  // Confirmed + mempool combined endpoint:
  const confirmed = await fetchJSON(`${MEMPOOL_API}/address/${address}/txs`);
  return Array.isArray(confirmed) ? confirmed : [];
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
  const stats = { polls: 0, matches: 0, errors: 0, lastPoll: null, lastMatch: null };

  async function tick() {
    stats.polls += 1;
    stats.lastPoll = new Date().toISOString();
    const pending = ledger.listPending();
    if (pending.length === 0) return;

    const txs = await fetchAddressTxs(address);
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
        try { onPaid(updated); } catch (e) { try { onError(e); } catch (_) {} }
      }
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { tick().catch((e) => { stats.errors += 1; try { onError(e); } catch (_) {} }); }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    tick().catch((e) => { stats.errors += 1; try { onError(e); } catch (_) {} });
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
