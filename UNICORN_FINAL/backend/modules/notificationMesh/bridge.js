'use strict';

function adapt(result) {
  const attempts = result && result.attempts ? result.attempts : [];
  if (result && result.delivered === true) {
    return {
      ok: true,
      provider: 'snm:' + result.channel,
      channel: result.channel,
      receipt: result.receipt || null,
      messageId: result.receipt || null,
      attempts,
    };
  }
  return {
    ok: false,
    provider: 'snm',
    reason: 'snm_undelivered',
    error: 'snm_undelivered',
    receipt: result && result.receipt ? result.receipt : null,
    attempts,
    queued: false,
  };
}

function meshEnabled() {
  try {
    const snm = require('./index');
    return !!(snm && typeof snm.enabled === 'function' && snm.enabled());
  } catch (_) {
    return false;
  }
}

async function deliverMail(fields) {
  if (!meshEnabled()) return null;
  const to = fields && fields.to;
  if (!to) return { ok: false, error: 'missing_to' };
  const snm = require('./index');
  const note = {
    type: fields.type || 'email',
    userId: fields.userId || to,
    email: to,
    orderId: fields.orderId || null,
    subject: fields.subject || '',
    text: fields.text || '',
    html: fields.html || '',
    private: fields.private === true,
  };
  const result = await snm.deliver(note);
  return adapt(result);
}

module.exports = { deliverMail, adapt, meshEnabled };
