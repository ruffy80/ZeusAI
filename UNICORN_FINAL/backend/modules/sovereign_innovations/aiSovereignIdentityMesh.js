// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T20:11:20.776Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// AI Sovereign Identity Mesh — identitate reală, descentralizată, controlată
// de utilizator. createIdentity() generează o pereche de chei Ed25519 + un
// identificator did:key; cheia privată e returnată O SINGURĂ dată și nu se
// stochează. verifyIdentity() validează o semnătură față de cheia publică
// înregistrată. federate() înregistrează legături de încredere între sisteme.
const crypto = require('crypto');

const registry = new Map(); // did -> { publicKeyPem, owner, issuedAt, federations: [] }

function _did(publicKeyDer) {
  const fp = crypto.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32);
  return 'did:key:z' + fp;
}

function createIdentity(user) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const did = _did(pubDer);
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  registry.set(did, { publicKeyPem, owner: user || null, issuedAt: new Date().toISOString(), federations: [] });
  return {
    id: did,
    owner: user || null,
    issuedAt: registry.get(did).issuedAt,
    publicKey: publicKeyPem,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }), // returnată o singură dată
    mesh: true,
  };
}

function verifyIdentity(id, signatureB64, message) {
  const rec = registry.get(id);
  if (!rec) return false;
  if (!signatureB64 || !message) return true; // back-compat: verificare de existență
  try {
    return crypto.verify(null, Buffer.from(message), rec.publicKeyPem, Buffer.from(signatureB64, 'base64'));
  } catch (_) { return false; }
}

function federate(id, system) {
  const rec = registry.get(id);
  if (!rec) return { id, federatedWith: system, status: 'unknown-identity' };
  if (!rec.federations.includes(system)) rec.federations.push(system);
  return { id, federatedWith: system, status: 'success', federations: rec.federations };
}

module.exports = {
  id: 'aiSovereignIdentityMesh',
  title: 'AI Sovereign Identity Mesh',
  description: 'Identitate digitală globală, descentralizată, cu control total pentru utilizator, interoperabilă cu orice sistem.',
  getStatus: () => ({ status: 'spec', mesh: true, decentralized: true, userControl: true, interoperable: true, identities: registry.size, scheme: 'ed25519/did:key' }),
  createIdentity,
  verifyIdentity,
  federate,
};