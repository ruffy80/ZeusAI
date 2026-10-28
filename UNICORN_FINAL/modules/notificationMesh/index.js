'use strict';

const { signNotification, verifyNotification, getPublicKey } = require('./signing');
const { saveReceipt, listReceipts } = require('./receipt');

const CHAIN = ['websocket', 'webpush', 'nostr', 'smtp-fallback'];

function enabled() {
  const flag = String(process.env.SNM_ENABLED || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  return process.env.NODE_ENV !== 'test';
}

async function deliver(notification) {
  const note = notification || {};
  const signed = signNotification(note);
  const attempts = [];
  if (!enabled()) {
    const receipt = saveReceipt(signed, { delivered: false, channel: null, attempts });
    return { delivered: false, receipt, attempts, reason: 'disabled' };
  }
  for (const channel of CHAIN) {
    try {
      const ok = await require('./channels/' + channel).send(signed, note.userId);
      attempts.push({ channel, ok: ok === true });
      if (ok === true) {
        const receipt = saveReceipt(signed, { delivered: true, channel, attempts });
        return { delivered: true, channel, receipt, attempts };
      }
    } catch (err) {
      attempts.push({ channel, ok: false, error: err && err.message ? err.message : String(err) });
    }
  }
  const receipt = saveReceipt(signed, { delivered: false, channel: null, attempts });
  return { delivered: false, receipt, attempts };
}

function getStatus() {
  const rows = listReceipts();
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  const recent = rows.filter((row) => row && row.at && Date.parse(row.at) >= cutoff);
  return {
    channels_active: CHAIN.slice(),
    delivered_last_24h: recent.filter((row) => row.delivered === true).length,
    failed_last_24h: recent.filter((row) => row.delivered !== true).length,
    last_5_deliveries: rows.slice(-5).reverse().map((row) => ({
      hash: row.hash,
      at: row.at,
      delivered: row.delivered === true,
      channel: row.channel || null,
      type: row.signed && row.signed.payload ? row.signed.payload.type : null,
    })),
    smtp: 'last_fallback',
  };
}

module.exports = {
  deliver,
  verify: verifyNotification,
  verifyNotification,
  getStatus,
  getPublicKey,
  signNotification,
  CHAIN,
  enabled,
};
