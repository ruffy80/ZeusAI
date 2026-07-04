// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-06T14:29:22.957Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// blockchainAdapter.js — acces real de citire + coadă onestă de broadcast.
// getLatestBlock() citește un explorer live. Difuzarea unei tranzacții BTC
// semnate necesită cheia privată a proprietarului (niciodată stocată aici),
// deci sendTransaction() înregistrează o INTENȚIE de broadcast verificabilă
// într-o coadă și, dacă BLOCKCHAIN_PUSH_URL e configurat, relayează hex-ul
// brut către el. Fără ID-uri „mock”.
const axios = require('axios');
const crypto = require('crypto');

const BLOCKCHAIN_API = process.env.BLOCKCHAIN_API || 'https://api.blockcypher.com/v1/btc/main';
const PUSH_URL = process.env.BLOCKCHAIN_PUSH_URL || '';

const pending = [];

async function getLatestBlock() {
  const res = await axios.get(BLOCKCHAIN_API, { timeout: 5000 });
  return res.data.height;
}

async function sendTransaction(txData) {
  const ref = 'tx-' + crypto.createHash('sha256')
    .update(JSON.stringify(txData || {}) + Date.now()).digest('hex').slice(0, 24);
  const rawHex = txData && txData.rawHex;
  if (rawHex && PUSH_URL) {
    try {
      const res = await axios.post(PUSH_URL, { tx: rawHex }, { timeout: 8000 });
      return { ref, status: 'broadcasted', relay: PUSH_URL, providerResponse: res.data };
    } catch (e) {
      pending.push({ ref, txData, status: 'relay-failed', error: e.message, ts: Date.now() });
      return { ref, status: 'queued', reason: 'relay-failed', error: e.message };
    }
  }
  pending.push({ ref, txData, status: rawHex ? 'no-push-url' : 'awaiting-signature', ts: Date.now() });
  return { ref, status: 'queued', reason: rawHex ? 'no-push-url-configured' : 'unsigned-tx', requiresOwnerSignature: !rawHex };
}

function pendingQueue() { return pending.slice(-100); }

module.exports = { getLatestBlock, sendTransaction, pendingQueue };
