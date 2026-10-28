'use strict';

process.env.SNM_ENABLED = 'true';
process.env.NODE_ENV = 'test';

const WebSocket = require('ws');
const mesh = require('./index');
const wsChannel = require('./channels/websocket');

function line(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' ' + detail : ''));
  return ok;
}

async function main() {
  const userId = 'snm-test-user';
  wsChannel.ensureServer();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const client = new WebSocket('ws://127.0.0.1:' + wsChannel.port());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ws_client_timeout')), 2000);
    client.once('open', () => {
      client.send(JSON.stringify({ type: 'bind', userId }));
      clearTimeout(timer);
      setTimeout(resolve, 50);
    });
    client.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const notification = {
    type: 'order_created',
    orderId: 'snm-test-order',
    userId,
    email: 'snm-test@example.com',
    productName: 'instant-website-audit',
  };
  const signed = mesh.signNotification(notification);
  const direct = {};
  for (const name of mesh.CHAIN) {
    try {
      direct[name] = await require('./channels/' + name).send(signed, userId) === true;
    } catch (err) {
      direct[name] = false;
      direct[name + '_error'] = err && err.message ? err.message : String(err);
    }
  }
  let passed = 0;
  if (line('websocket', direct.websocket === true)) passed += 1;
  if (line('webpush', direct.webpush === true, direct.webpush ? '' : 'no push subscription')) passed += 1;
  if (line('nostr', direct.nostr === true, direct.nostr ? '' : (direct.nostr_error || 'relays did not accept'))) passed += 1;
  if (line('smtp-fallback', direct['smtp-fallback'] === true, direct['smtp-fallback'] ? '' : (direct['smtp-fallback_error'] || 'smtp not configured'))) passed += 1;

  const result = await mesh.deliver(notification);
  line('fallback-stops-at-websocket', result.delivered === true && result.channel === 'websocket' && result.attempts.length === 1);

  const valid = mesh.verify(signed);
  line('verify', valid === true);
  const tampered = Object.assign({}, signed, { nonce: 'dead' });
  line('verify-rejects-tamper', mesh.verify(tampered) === false);

  const row = require('./receipt').getReceipt(result.receipt);
  line('receipt', !!(row && row.hash === result.receipt));
  console.log('delivered', result.delivered, 'channel', result.channel || 'none');
  console.log('attempts', JSON.stringify(result.attempts));
  console.log('pubkey20', mesh.getPublicKey().slice(0, 20));
  console.log('receipts', require('./receipt').listReceipts().length);
  console.log('channels_passed', passed + '/4');
  client.close();
  wsChannel.closeServer();
  if (!valid || !row) process.exit(1);
}

main().catch((err) => {
  console.error('TEST_ERROR', err && err.stack ? err.stack : err);
  process.exit(1);
});
