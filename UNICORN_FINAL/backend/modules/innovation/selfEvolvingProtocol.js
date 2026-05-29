// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T19:23:05.068Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Self-Evolving Protocol Layer — negociere reală de versiuni + capabilități.
// Urmărește versiunile suportate, alege cea mai bună versiune comună cu un
// peer și înregistrează fiecare adaptare, ca platforma să-și poată evolua
// contractul fără redeploy.
const SUPPORTED_VERSIONS = ['1.0', '1.1', '2.0'];
const BASE_CAPABILITIES = ['json', 'sse', 'btc-direct', 'hash-chain-receipts', 'ed25519-sign'];

let current = { version: SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1], capabilities: [...BASE_CAPABILITIES] };
let adaptations = [];

function negotiate(peer = {}) {
  const peerVersions = Array.isArray(peer.versions) ? peer.versions : SUPPORTED_VERSIONS;
  const common = SUPPORTED_VERSIONS.filter(v => peerVersions.includes(v));
  const chosen = common.length ? common[common.length - 1] : '1.0';
  const peerCaps = Array.isArray(peer.capabilities) ? peer.capabilities : BASE_CAPABILITIES;
  const caps = current.capabilities.filter(c => peerCaps.includes(c));
  return { version: chosen, capabilities: caps, fallback: chosen === '1.0' };
}

function adapt(protocolContext = {}) {
  const negotiated = negotiate(protocolContext);
  adaptations.push({ ts: new Date().toISOString(), context: protocolContext, negotiated });
  if (adaptations.length > 500) adaptations = adaptations.slice(-500);
  if (Array.isArray(protocolContext.capabilities)) {
    for (const c of protocolContext.capabilities) {
      if (typeof c === 'string' && /^[a-z0-9-]{2,40}$/.test(c) && !current.capabilities.includes(c)) {
        current.capabilities.push(c);
      }
    }
  }
  return { ok: true, method: 'self-evolving', negotiated, currentCapabilities: current.capabilities };
}

module.exports = {
  isActive: true,
  getStatus() {
    return {
      status: 'active',
      selfEvolving: true,
      currentVersion: current.version,
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: current.capabilities,
      adaptations: adaptations.length,
    };
  },
  negotiate,
  adapt,
};