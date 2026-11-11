'use strict';

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('smtp_timeout')), ms);
    Promise.resolve(promise).then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function send(signedNotification) {
  const payload = signedNotification && signedNotification.payload ? signedNotification.payload : {};
  const to = payload.email;
  if (!to) return false;
  const mailer = require('../../../backend/email');
  const text = payload.text || [
    'type: ' + (payload.type || ''),
    'order: ' + (payload.orderId || ''),
    'signature: ' + signedNotification.signature,
  ].join('\n');
  const result = await withTimeout(mailer.sendMail({
    to: String(to),
    subject: payload.subject || ('ZeusAI ' + (payload.type || 'notification')),
    text,
    html: payload.html || undefined,
    direct: true,
  }), 10000);
  return !!(result && (result.ok === true || result.messageId));
}

module.exports = { send };
