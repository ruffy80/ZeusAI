'use strict';

async function notify(score) {
  if (score.opt_in !== true) return { ok: false, reason: 'not_opted_in' };
  try {
    const snm = require('../notificationMesh');
    const result = await snm.deliver({
      type: 'business_score',
      userId: score.public_slug,
      email: null,
      orderId: score.id,
      subject: 'Business score ' + score.score_total + '/100',
      text: score.domain + ' scored ' + score.score_total + '/100. ' + score.report_url,
      private: false,
    });
    return { ok: !!(result && result.delivered), channel: result && result.channel, attempts: result && result.attempts };
  } catch (err) {
    console.warn('[score] SNM notification failed:', err && err.message);
    return { ok: false, error: err && err.message };
  }
}

async function publishNostr(score) {
  try {
    const nostr = require('../notificationMesh/channels/nostr');
    const { signContract } = require('../witness/signer');
    const signed = signContract({
      type: 'business_score',
      domain: score.domain,
      score_total: score.score_total,
      scored_at: score.created_at,
    });
    const ok = await nostr.send(signed);
    return { ok: ok === true };
  } catch (err) {
    console.warn('[score] Nostr publish failed:', err && err.message);
    return { ok: false, error: err && err.message };
  }
}

module.exports = { notify, publishNostr };
