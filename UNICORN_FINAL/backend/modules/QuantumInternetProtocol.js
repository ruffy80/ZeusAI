'use strict';

/**
 * QuantumInternetProtocol — classical authenticated packet links.
 * Nodes exchange an X25519 secret and seal payloads with HMAC-SHA256.
 * No quantum channel is opened.
 */

const crypto = require('crypto');

const nodes = new Map();
const links = new Map();
const mail = new Map();
const MAX_MAIL = 50;

function createNode(id) {
  const nodeId = String(id || '').slice(0, 80);
  if (!nodeId) return { ok: false, reason: 'missing_id', claimsQuantumChannel: false };
  const pair = crypto.generateKeyPairSync('x25519');
  const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  nodes.set(nodeId, { id: nodeId, publicDer, publicKey: pair.publicKey, privateKey: pair.privateKey });
  return { ok: true, id: nodeId, publicKey: publicDer, channel: 'x25519-hmac-sha256', claimsQuantumChannel: false };
}

function openLink(a, b) {
  const A = nodes.get(String(a || ''));
  const B = nodes.get(String(b || ''));
  if (!A || !B || A.id === B.id) return { ok: false, reason: 'unknown_node', claimsQuantumChannel: false };
  const secret = crypto.diffieHellman({ privateKey: B.privateKey, publicKey: A.publicKey });
  const key = crypto.createHash('sha256').update(secret).digest();
  const linkId = [A.id, B.id].sort().join('|');
  links.set(linkId, key);
  return { ok: true, linkId, channel: 'x25519-hmac-sha256', claimsQuantumChannel: false };
}

function _key(from, to) {
  return links.get([String(from || ''), String(to || '')].sort().join('|')) || null;
}

function send(from, to, payload) {
  const key = _key(from, to);
  if (!key) return { ok: false, reason: 'link_closed', claimsQuantumChannel: false };
  const body = Buffer.from(JSON.stringify(payload == null ? {} : payload));
  const mac = crypto.createHmac('sha256', key).update(body).digest('hex');
  const packet = { from: String(from), to: String(to), body: body.toString('base64'), mac, at: new Date().toISOString() };
  const box = mail.get(packet.to) || [];
  box.push(packet);
  mail.set(packet.to, box.slice(-MAX_MAIL));
  return { ok: true, to: packet.to, mac, claimsQuantumChannel: false };
}

function verify(packet) {
  const row = packet && typeof packet === 'object' ? packet : {};
  const key = _key(row.from, row.to);
  if (!key || !row.body || !row.mac) return { ok: false, reason: 'unverifiable', claimsQuantumChannel: false };
  const body = Buffer.from(String(row.body), 'base64');
  const mac = crypto.createHmac('sha256', key).update(body).digest('hex');
  if (mac !== row.mac) return { ok: false, reason: 'bad_mac', claimsQuantumChannel: false };
  let payload = null;
  try { payload = JSON.parse(body.toString('utf8')); } catch (_) { payload = null; }
  return { ok: true, from: row.from, payload, claimsQuantumChannel: false };
}

function receive(id) {
  const box = mail.get(String(id || '')) || [];
  mail.set(String(id || ''), []);
  const packets = [];
  let rejected = 0;
  for (const packet of box) {
    const checked = verify(packet);
    if (checked.ok) packets.push({ from: checked.from, payload: checked.payload });
    else rejected += 1;
  }
  return { ok: true, packets, rejected, claimsQuantumChannel: false };
}

function process(body) {
  const input = body && typeof body === 'object' ? body : {};
  if (input.op === 'create') return createNode(input.id);
  if (input.op === 'link') return openLink(input.a, input.b);
  if (input.op === 'receive') return receive(input.id);
  if (input.op === 'send') return send(input.from, input.to, input.payload);
  return { ok: false, reason: 'unknown_op', claimsQuantumChannel: false };
}

function getStatus() {
  return {
    ok: true,
    name: 'QuantumInternetProtocol',
    nodes: nodes.size,
    links: links.size,
    channel: 'x25519-hmac-sha256',
    claimsQuantumChannel: false,
  };
}

module.exports = {
  createNode, openLink, send, receive, verify, process, getStatus,
  name: 'QuantumInternetProtocol',
};
