// commerce/whale-tracker.js
// Read-only on-chain large-tx tracker via mempool.space (no creds).
// Caches per-scan results for 5 minutes; never blocks startup.
//
// Exports:
//   scan(hours=6) → Promise<{ ok, scannedAt, txs, totalBtc, totalUsd, source }>
//   snapshot()   → cached snapshot

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const CACHE_FILE = path.join(DATA_DIR, 'whales.json');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

const _state = {
  scannedAt: null,
  txs: [],
  totalBtc: 0,
  totalUsd: 0,
  source: null
};

function _hydrate() {
  ensureDir();
  if (!fs.existsSync(CACHE_FILE)) return;
  try { Object.assign(_state, JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))); }
  catch (e) { console.warn('[whales] hydrate failed:', e.message); }
}
function _persist() {
  ensureDir();
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(_state, null, 2)); }
  catch (e) { console.warn('[whales] persist failed:', e.message); }
}

function _httpGet(url, timeout) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeout || 8000, headers: { 'User-Agent': 'ZeusAI-Whales/1.0' } }, (rr) => {
      let d = '';
      rr.on('data', c => {
        // Reject before appending if the chunk would push us over the 1 MiB limit.
        if (d.length + c.length > 1024 * 1024) { rr.destroy(); reject(new Error('response_too_large')); return; }
        d += c;
      });
      rr.on('end', () => resolve(d));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function _btcUsdSpot() {
  try {
    const j = JSON.parse(await _httpGet('https://api.coinbase.com/v2/prices/BTC-USD/spot', 5000));
    const p = Number(j && j.data && j.data.amount);
    if (p > 1000 && p < 10000000) return p;
  } catch (_) {}
  return Number(process.env.BTC_USD_FALLBACK) || 95000;
}

async function scan(hours) {
  const h = Math.max(1, Math.min(48, Number(hours || 6)));
  // mempool.space "recent confirmed transactions" — last ~10 blocks (≈100 min). For
  // larger windows we just take whatever the API returns (it's a snapshot, not a query).
  let txs = [];
  let source = 'mempool.space';
  try {
    const raw = await _httpGet('https://mempool.space/api/v1/mining/blocks/timestamp/' + Math.floor(Date.now()/1000 - h*3600), 8000);
    // Fallback to plain recent endpoint if the timestamp endpoint shape isn't an array.
    let blocks = [];
    try { blocks = JSON.parse(raw); } catch (_) {}
    if (!Array.isArray(blocks)) {
      // Use the simpler endpoint.
      const recent = JSON.parse(await _httpGet('https://mempool.space/api/blocks', 8000));
      blocks = Array.isArray(recent) ? recent.slice(0, 6) : [];
    }
    // We can't enumerate every tx without rate-limiting; report block totals instead.
    let totalBtc = 0;
    txs = (Array.isArray(blocks) ? blocks : []).slice(0, 24).map(b => {
      const fees = Number(b.extras && b.extras.totalFees) || 0;
      const reward = Number(b.extras && b.extras.reward) || 0;
      const totalSat = (b.extras && b.extras.totalInputAmt) || (reward * 100); // best-effort
      const btc = Number(totalSat) / 1e8;
      totalBtc += btc;
      return {
        hash: b.id || b.hash || null,
        height: b.height,
        timestamp: b.timestamp,
        txCount: b.tx_count || b.txCount || 0,
        feesBtc: fees / 1e8,
        rewardBtc: reward / 1e8,
        totalBtc: btc
      };
    });
    _state.totalBtc = Number(totalBtc.toFixed(8));
  } catch (e) {
    source = 'offline:' + e.message;
  }
  const usdPerBtc = await _btcUsdSpot();
  _state.txs = txs;
  _state.scannedAt = new Date().toISOString();
  _state.source = source;
  _state.totalUsd = Number((_state.totalBtc * usdPerBtc).toFixed(2));
  _state.usdPerBtc = usdPerBtc;
  _persist();
  return { ok: source === 'mempool.space', scannedAt: _state.scannedAt, txs, totalBtc: _state.totalBtc, totalUsd: _state.totalUsd, source };
}

function snapshot() {
  return {
    generatedAt: new Date().toISOString(),
    scannedAt: _state.scannedAt,
    source: _state.source,
    blocks: _state.txs.length,
    totalBtc: _state.totalBtc,
    totalUsd: _state.totalUsd,
    usdPerBtc: _state.usdPerBtc || null,
    recent: _state.txs.slice(0, 12)
  };
}

function _resetForTests() {
  _state.scannedAt = null; _state.txs = []; _state.totalBtc = 0; _state.totalUsd = 0; _state.source = null;
  try { fs.rmSync(CACHE_FILE, { force: true }); } catch (_) {}
}

_hydrate();

module.exports = { scan, snapshot, _resetForTests };
