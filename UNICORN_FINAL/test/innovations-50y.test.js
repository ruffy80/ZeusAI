/**
 * innovations-50y.test.js — Verifies the 50-year-standard additive layer.
 *
 * Tests are STRICTLY ADDITIVE: they spin up the existing src/index.js HTTP
 * server unchanged and only assert that NEW endpoints work + existing
 * endpoints continue to behave (via /health smoke check).
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'test';
process.env.UNICORN_RUNTIME_PROFILE = process.env.UNICORN_RUNTIME_PROFILE || 'stable';
process.env.DISABLE_SELF_MUTATION = process.env.DISABLE_SELF_MUTATION || '1';

// Use isolated audit log path per-run so we never touch live data.
const tmpAudit = path.join(os.tmpdir(), `unicorn-50y-audit-${process.pid}-${Date.now()}.jsonl`);
process.env.AUDIT_50Y_LOG = tmpAudit;

const innov50 = require('../backend/modules/innovations-50y');
const { createServer } = require('../src/index');
const server = createServer();

async function run() {
  // ── 1. Module-level invariants (no HTTP yet) ─────────────────────────
  // Crypto-agility: Ed25519 sign/verify roundtrip
  {
    const keys = innov50.cryptoAgility.generateKeyPair('ed25519');
    const sig = innov50.cryptoAgility.sign('hello-50y', { alg: 'ed25519', privateKey: keys.privateKey });
    const ok = innov50.cryptoAgility.verify('hello-50y', sig, { alg: 'ed25519', publicKey: keys.publicKey });
    assert.strictEqual(ok, true, 'Ed25519 sign/verify roundtrip must succeed');
    const bad = innov50.cryptoAgility.verify('hello-tampered', sig, { alg: 'ed25519', publicKey: keys.publicKey });
    assert.strictEqual(bad, false, 'Ed25519 must reject tampered payload');
  }
  // Crypto-agility: HMAC-SHA-512 roundtrip
  {
    const keys = innov50.cryptoAgility.generateKeyPair('hmac-sha512');
    const sig = innov50.cryptoAgility.sign('hmac-data', { alg: 'hmac-sha512', secret: keys.secret });
    const ok = innov50.cryptoAgility.verify('hmac-data', sig, { alg: 'hmac-sha512', secret: keys.secret });
    assert.strictEqual(ok, true, 'HMAC roundtrip must succeed');
  }
  // Audit chain: append + proof + verifyChain
  {
    innov50.audit._resetForTests();
    const a = innov50.audit.append({ actor: 'test', action: 'boot' });
    const b = innov50.audit.append({ actor: 'test', action: 'second' });
    assert.strictEqual(a.id, 1);
    assert.strictEqual(b.id, 2);
    assert.notStrictEqual(b.prev_hash, '0'.repeat(64), 'second entry must reference first');
    assert.strictEqual(b.prev_hash, a.line_hash);
    const chain = innov50.audit.verifyChain();
    assert.strictEqual(chain.ok, true, 'chain must verify');
    const proof = innov50.audit.proof(2);
    assert.ok(proof, 'proof must be retrievable');
    const okProof = innov50.audit.verifyProof(proof);
    assert.strictEqual(okProof, true, 'merkle inclusion proof must validate');
  }
  // SBOM is deterministic
  {
    const a = innov50.sbom.buildSbom();
    const b = innov50.sbom.buildSbom();
    assert.strictEqual(JSON.stringify({ ...a, serialNumber: 'X', metadata: { ...a.metadata, timestamp: 'X' } }),
                       JSON.stringify({ ...b, serialNumber: 'X', metadata: { ...b.metadata, timestamp: 'X' } }),
                       'SBOM components must be deterministic across runs');
    assert.ok(Array.isArray(a.components), 'SBOM must list components');
  }
  // Schema registry has at least the public payload schemas we wrote
  {
    const list = innov50.schemas.list().map(s => s.id);
    for (const id of ['unicorn/health', 'unicorn/snapshot', 'unicorn/stream-event', 'unicorn/audit-entry']) {
      assert.ok(list.includes(id), 'schema registry must contain ' + id);
    }
  }
  // DID document has correct structure
  {
    const doc = innov50.did.buildDidDocument('zeusai.pro');
    assert.strictEqual(doc.id, 'did:web:zeusai.pro');
    assert.ok(Array.isArray(doc['@context']));
    assert.ok(doc.verificationMethod[0].publicKeyMultibase.startsWith('z'));
  }
  // Manifest builds a non-zero leaf set
  {
    const m = innov50.manifest.build();
    assert.ok(m.leafCount > 0, 'manifest must include at least one leaf');
    assert.ok(/^[0-9a-f]{64}$/.test(m.root), 'merkle root must be 64-hex sha256');
  }
  // OTel: span roundtrip
  {
    const out = await innov50.otel.withSpan('test.span', { foo: 'bar' }, async (ctx) => {
      assert.ok(ctx.traceparent.startsWith('00-'));
      return 42;
    });
    assert.strictEqual(out, 42);
    const recent = innov50.otel.recent(5);
    assert.ok(recent.some(s => s.name === 'test.span'), 'span must be recorded in buffer');
  }
  // Insight RAG: ask must return a structured response (may have zero hits)
  {
    const r = innov50.insight.ask('boot');
    assert.ok(typeof r.evaluatedDocs === 'number');
    assert.ok(Array.isArray(r.hits));
  }

  // ── 2. HTTP smoke against the new endpoints ─────────────────────────
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = 'http://127.0.0.1:' + port;

  // Health unchanged
  {
    const r = await fetch(base + '/health');
    assert.strictEqual(r.status, 200, '/health must remain 200');
    const j = await r.json();
    assert.strictEqual(j.ok, true, '/health.ok must remain true');
  }
  // /.well-known/did.json
  {
    const r = await fetch(base + '/.well-known/did.json');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(String(j.id || '').startsWith('did:web:'));
  }
  // /api/v50/status
  {
    const r = await fetch(base + '/api/v50/status');
    assert.strictEqual(r.status, 200);
    assert.ok(r.headers.get('x-schema-version'), 'X-Schema-Version header must be present');
    const j = await r.json();
    assert.ok(j.pillars && j.pillars.permanence && j.pillars.security);
  }
  // /api/v50/schemas
  {
    const r = await fetch(base + '/api/v50/schemas');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.count >= 4, 'must list ≥4 schemas');
  }
  // /api/v50/schemas/<id>
  {
    const r = await fetch(base + '/api/v50/schemas/unicorn%2Fhealth');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.$id, 'unicorn/health');
  }
  // /api/v50/sbom/cyclonedx
  {
    const r = await fetch(base + '/api/v50/sbom/cyclonedx');
    assert.strictEqual(r.status, 200);
    assert.ok(r.headers.get('x-sbom-sha256'));
    const j = await r.json();
    assert.strictEqual(j.bomFormat, 'CycloneDX');
    assert.strictEqual(j.specVersion, '1.5');
  }
  // /api/v50/audit/recent + proof
  {
    const r = await fetch(base + '/api/v50/audit/recent?limit=5');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.items));
    if (j.items.length > 0) {
      const id = j.items[j.items.length - 1].id;
      const p = await fetch(base + '/api/v50/audit/proof?id=' + id);
      assert.strictEqual(p.status, 200);
      const pj = await p.json();
      assert.strictEqual(pj.id, id);
    }
  }
  // /api/v50/otel/status
  {
    const r = await fetch(base + '/api/v50/otel/status');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.serviceName);
  }
  // /api/v50/crypto/status
  {
    const r = await fetch(base + '/api/v50/crypto/status');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.supported.ed25519, true);
  }
  // /api/v50/insight/ask
  {
    const r = await fetch(base + '/api/v50/insight/ask?q=test');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.hits));
  }

  await new Promise((resolve) => server.close(resolve));
  // Cleanup tmp audit log
  try { fs.unlinkSync(tmpAudit); } catch (_) {}
  console.log('✅ innovations-50y.test.js passed');
}

run().then(() => process.exit(0)).catch((e) => { console.error('❌ innovations-50y.test.js failed:', e); process.exit(1); });
