'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'world-ai-commerce-protocol';
const VERSION = 'WACP/1.0';
const FALLBACK_HMAC_SECRET = 'zeusai-wacp-dev-fallback';

const state = {
  catalogsBuilt: 0,
  ordersBuilt: 0,
  deliveriesAttested: 0,
  verifications: 0,
  lastCatalogHash: null,
  lastEnvelopeHash: null,
  lastVerifiedAt: null,
  lastPersistedFiles: [],
};

function dataDir() {
  return process.env.WACP_DATA_DIR || path.resolve(__dirname, '..', '..', 'data', 'wacp');
}

function ensureDir() {
  fs.mkdirSync(dataDir(), { recursive: true });
}

function stableSortObject(input) {
  if (Array.isArray(input)) return input.map(stableSortObject);
  if (!input || typeof input !== 'object') return input;
  return Object.keys(input).sort().reduce((acc, key) => {
    acc[key] = stableSortObject(input[key]);
    return acc;
  }, {});
}

function stableStringify(input) {
  return JSON.stringify(stableSortObject(input));
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function isoNow(value) {
  return new Date(value || Date.now()).toISOString();
}

function hashEmail(email) {
  return sha256(String(email || '').trim().toLowerCase());
}

function writeExample(fileName, payload) {
  ensureDir();
  const fullPath = path.join(dataDir(), fileName);
  fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2));
  state.lastPersistedFiles = Array.from(new Set([fileName].concat(state.lastPersistedFiles))).slice(0, 12);
  return fullPath;
}

function getSigningConfig() {
  const privateKeyPem = process.env.WACP_ED25519_PRIVATE_KEY || '';
  const publicKeyPem = process.env.WACP_ED25519_PUBLIC_KEY || '';
  if (privateKeyPem) {
    try {
      const privateKey = crypto.createPrivateKey(privateKeyPem);
      const publicKey = publicKeyPem
        ? crypto.createPublicKey(publicKeyPem)
        : crypto.createPublicKey(privateKey);
      const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
      return { mode: 'ed25519', privateKey, publicKey, keyId };
    } catch (error) {
      return { mode: 'invalid-ed25519', error: error.message };
    }
  }
  const secret = process.env.WACP_HMAC_SECRET || process.env.JWT_SECRET || FALLBACK_HMAC_SECRET;
  return {
    mode: 'hmac-sha256',
    secret,
    keyId: secret === FALLBACK_HMAC_SECRET ? 'hmac:dev-fallback' : 'hmac:env',
    fallback: secret === FALLBACK_HMAC_SECRET,
  };
}

function signEnvelopeBody(body) {
  const cfg = getSigningConfig();
  if (cfg.mode === 'ed25519') {
    return {
      algorithm: 'ed25519',
      keyId: cfg.keyId,
      signature: crypto.sign(null, Buffer.from(body), cfg.privateKey).toString('base64'),
    };
  }
  if (cfg.mode === 'hmac-sha256') {
    return {
      algorithm: 'hmac-sha256',
      keyId: cfg.keyId,
      signature: crypto.createHmac('sha256', cfg.secret).update(body).digest('base64'),
    };
  }
  throw new Error('Signing unavailable: ' + (cfg.error || cfg.mode));
}

function verifySignature(body, signature) {
  if (!signature || typeof signature !== 'object') return { ok: true, skipped: true, reason: 'unsigned' };
  const cfg = getSigningConfig();
  if (signature.algorithm === 'ed25519') {
    if (cfg.mode !== 'ed25519' || !cfg.publicKey) return { ok: false, reason: 'missing_ed25519_public_key' };
    const ok = crypto.verify(null, Buffer.from(body), cfg.publicKey, Buffer.from(String(signature.signature || ''), 'base64'));
    return { ok, algorithm: 'ed25519', keyId: signature.keyId || null };
  }
  if (signature.algorithm === 'hmac-sha256') {
    if (cfg.mode !== 'hmac-sha256') return { ok: false, reason: 'hmac_secret_not_available' };
    const expected = crypto.createHmac('sha256', cfg.secret).update(body).digest('base64');
    const left = Buffer.from(expected);
    const right = Buffer.from(String(signature.signature || ''));
    const ok = left.length === right.length && crypto.timingSafeEqual(left, right);
    return { ok, algorithm: 'hmac-sha256', keyId: signature.keyId || null };
  }
  return { ok: false, reason: 'unsupported_signature_algorithm' };
}

function normalizeCatalogItem(item, index) {
  const src = item && typeof item === 'object' ? item : {};
  const id = String(src.id || src.serviceId || src.sku || ('item-' + (index + 1))).trim();
  const title = String(src.title || src.name || src.label || id).trim();
  const amount = Number(src.priceUsd ?? src.price ?? src.amount ?? 0);
  return {
    id,
    sku: String(src.sku || id).trim(),
    title,
    description: String(src.description || src.summary || '').trim(),
    category: String(src.category || src.group || 'general').trim(),
    availability: src.availability === false ? 'unavailable' : String(src.availability || 'available'),
    price: {
      amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
      currency: String(src.currency || 'USD').toUpperCase(),
    },
    deliveryKind: String(src.deliveryKind || src.fulfillment || 'digital').trim(),
    tags: Array.isArray(src.tags) ? src.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  };
}

function normalizeOrder(order) {
  const src = order && typeof order === 'object' ? order : {};
  const lines = Array.isArray(src.items) ? src.items.map((item, index) => {
    const qty = Math.max(1, Number(item && item.qty ? item.qty : item && item.quantity ? item.quantity : 1));
    const unitPrice = Number(item && (item.unitPriceUsd ?? item.priceUsd ?? item.price ?? 0));
    return {
      serviceId: String(item && (item.serviceId || item.id || item.sku || ('line-' + (index + 1)))).trim(),
      title: String(item && (item.title || item.name || item.label || '')).trim(),
      qty,
      unitPriceUsd: Number.isFinite(unitPrice) ? Number(unitPrice.toFixed(2)) : 0,
      lineTotalUsd: Number((qty * (Number.isFinite(unitPrice) ? unitPrice : 0)).toFixed(2)),
    };
  }) : [];
  const derivedTotal = lines.reduce((sum, line) => sum + line.lineTotalUsd, 0);
  return {
    orderId: String(src.orderId || src.id || ('order-' + Date.now())).trim(),
    buyer: {
      emailHash: src.buyerEmailHash || (src.buyerEmail ? hashEmail(src.buyerEmail) : (src.email ? hashEmail(src.email) : null)),
      accountId: src.accountId ? String(src.accountId) : null,
      country: src.country ? String(src.country).toUpperCase() : null,
    },
    items: lines,
    totals: {
      currency: String(src.currency || 'USD').toUpperCase(),
      subtotalUsd: Number(derivedTotal.toFixed(2)),
      totalUsd: Number(Number(src.totalUsd ?? src.total ?? derivedTotal).toFixed(2)),
    },
    requestedAt: isoNow(src.requestedAt),
    fulfillmentHint: String(src.fulfillmentHint || 'digital-delivery').trim(),
  };
}

function normalizeDelivery(delivery) {
  const src = delivery && typeof delivery === 'object' ? delivery : {};
  const artifactHashes = Array.isArray(src.artifactHashes)
    ? src.artifactHashes.map((hash) => String(hash).trim().toLowerCase()).filter(Boolean)
    : [];
  return {
    deliveryId: String(src.deliveryId || src.id || ('delivery-' + Date.now())).trim(),
    orderId: String(src.orderId || '').trim(),
    buyerEmailHash: src.buyerEmailHash || (src.buyerEmail ? hashEmail(src.buyerEmail) : (src.email ? hashEmail(src.email) : null)),
    artifactHashes,
    artifactRoot: sha256(stableStringify(artifactHashes)),
    deliveredAt: isoNow(src.deliveredAt),
    channel: String(src.channel || 'secure-download').trim(),
    proofUri: src.proofUri ? String(src.proofUri).trim() : null,
  };
}

function toWacpCatalog(items) {
  const normalizedItems = Array.isArray(items) ? items.map(normalizeCatalogItem) : [];
  const catalog = {
    protocol: VERSION,
    schema: 'wacp.catalog.v1',
    exportedAt: isoNow(),
    itemCount: normalizedItems.length,
    items: normalizedItems,
  };
  catalog.contentHash = sha256(stableStringify(catalog));
  state.catalogsBuilt += 1;
  state.lastCatalogHash = catalog.contentHash;
  writeExample('catalog-example.json', catalog);
  return catalog;
}

function buildOrderEnvelope(order) {
  const payload = normalizeOrder(order);
  const envelope = {
    protocol: VERSION,
    schema: 'wacp.order-envelope.v1',
    type: 'order',
    createdAt: isoNow(),
    payload,
    payloadHash: sha256(stableStringify(payload)),
  };
  envelope.envelopeHash = sha256(stableStringify(envelope));
  state.ordersBuilt += 1;
  state.lastEnvelopeHash = envelope.envelopeHash;
  writeExample('order-envelope-example.json', envelope);
  return envelope;
}

async function attestDelivery(delivery, signerFn) {
  const payload = normalizeDelivery(delivery);
  const unsigned = {
    protocol: VERSION,
    schema: 'wacp.delivery-attestation.v1',
    type: 'delivery-attestation',
    createdAt: isoNow(),
    payload,
    payloadHash: sha256(stableStringify(payload)),
  };
  const signableBody = stableStringify({
    protocol: unsigned.protocol,
    schema: unsigned.schema,
    type: unsigned.type,
    createdAt: unsigned.createdAt,
    payloadHash: unsigned.payloadHash,
  });
  const signature = signerFn ? await Promise.resolve(signerFn({
    body: signableBody,
    payload,
    payloadHash: unsigned.payloadHash,
  })) : signEnvelopeBody(signableBody);
  const envelope = {
    ...unsigned,
    signature: signature && typeof signature === 'object'
      ? {
          algorithm: String(signature.algorithm || signature.alg || 'custom'),
          keyId: signature.keyId || null,
          signature: String(signature.signature || signature.value || ''),
        }
      : null,
  };
  envelope.envelopeHash = sha256(stableStringify(envelope));
  state.deliveriesAttested += 1;
  state.lastEnvelopeHash = envelope.envelopeHash;
  writeExample('delivery-attestation-example.json', envelope);
  return envelope;
}

function verifyEnvelope(envelope) {
  const errors = [];
  const src = envelope && typeof envelope === 'object' ? envelope : null;
  if (!src) return { ok: false, valid: false, errors: ['envelope_required'] };
  if (src.protocol !== VERSION) errors.push('unsupported_protocol');
  if (!src.type) errors.push('missing_type');
  if (!src.payload || typeof src.payload !== 'object') errors.push('missing_payload');

  const expectedPayloadHash = src.payload ? sha256(stableStringify(src.payload)) : null;
  const payloadHashMatches = expectedPayloadHash && src.payloadHash === expectedPayloadHash;
  if (!payloadHashMatches) errors.push('payload_hash_mismatch');

  const unsignedBody = {
    protocol: src.protocol,
    schema: src.schema,
    type: src.type,
    createdAt: src.createdAt,
    payload: src.payload,
    payloadHash: src.payloadHash,
  };
  if (src.signature) unsignedBody.signature = src.signature;
  const expectedEnvelopeHash = sha256(stableStringify(unsignedBody));
  const envelopeHashMatches = src.envelopeHash === expectedEnvelopeHash;
  if (!envelopeHashMatches) errors.push('envelope_hash_mismatch');

  let signatureResult = { ok: true, skipped: true };
  if (src.type === 'delivery-attestation') {
    const signableBody = stableStringify({
      protocol: src.protocol,
      schema: src.schema,
      type: src.type,
      createdAt: src.createdAt,
      payloadHash: src.payloadHash,
    });
    signatureResult = verifySignature(signableBody, src.signature);
    if (!signatureResult.ok) errors.push('signature_invalid');
  }

  state.verifications += 1;
  state.lastVerifiedAt = isoNow();
  writeExample('verification-example.json', {
    checkedAt: state.lastVerifiedAt,
    valid: errors.length === 0,
    envelopeType: src.type || null,
    envelopeHash: src.envelopeHash || null,
    errors,
  });

  return {
    ok: errors.length === 0,
    valid: errors.length === 0,
    type: src.type || null,
    payloadHashMatches,
    envelopeHashMatches,
    signature: signatureResult,
    errors,
  };
}

function getStatus() {
  const cfg = getSigningConfig();
  ensureDir();
  const files = fs.readdirSync(dataDir()).sort();
  return {
    module: NAME,
    protocol: VERSION,
    signingMode: cfg.mode,
    fallbackSecretInUse: !!cfg.fallback,
    dataDir: dataDir(),
    catalogsBuilt: state.catalogsBuilt,
    ordersBuilt: state.ordersBuilt,
    deliveriesAttested: state.deliveriesAttested,
    verifications: state.verifications,
    lastCatalogHash: state.lastCatalogHash,
    lastEnvelopeHash: state.lastEnvelopeHash,
    lastVerifiedAt: state.lastVerifiedAt,
    exampleFiles: files,
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : input;
  if (action === 'catalog') return { ok: true, action, catalog: toWacpCatalog(payload.items || []) };
  if (action === 'order') return { ok: true, action, envelope: buildOrderEnvelope(payload.order || payload) };
  if (action === 'attest-delivery') {
    return { ok: true, action, envelope: await attestDelivery(payload.delivery || payload, payload.signerFn || input.signerFn) };
  }
  if (action === 'verify') return verifyEnvelope(payload.envelope || input.envelope);
  if (action === 'bootstrap-examples') {
    const catalog = toWacpCatalog(payload.items || []);
    const order = buildOrderEnvelope(payload.order || {});
    const delivery = await attestDelivery(payload.delivery || {
      orderId: order.payload.orderId,
      buyerEmailHash: order.payload.buyer.emailHash,
      artifactHashes: [],
    }, payload.signerFn || input.signerFn);
    return { ok: true, action, catalog, order, delivery };
  }
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  state.catalogsBuilt = 0;
  state.ordersBuilt = 0;
  state.deliveriesAttested = 0;
  state.verifications = 0;
  state.lastCatalogHash = null;
  state.lastEnvelopeHash = null;
  state.lastVerifiedAt = null;
  state.lastPersistedFiles = [];
}

module.exports = {
  name: NAME,
  toWacpCatalog,
  buildOrderEnvelope,
  attestDelivery,
  verifyEnvelope,
  getStatus,
  process: processInput,
  _resetForTests,
};
