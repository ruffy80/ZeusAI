'use strict';

/**
 * SAOS/1.0 — Safe Apply OS
 * Apply data/docs, canary+rollback, source patches stay proposals.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.SAFE_EVOLVE = '1';
process.env.SAFE_APPLY = '1';
process.env.INNOVATION_GENERATE = '0';
process.env.INNOVATION_AUTO_SHIP = '0';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'saos-'));
process.env.SAFE_APPLY_ROOT = tmp;
process.env.INNOVATION_SHIPPED_DIR = path.join(tmp, 'data', 'innovations', 'shipped');
process.env.SAFE_PATCH_DIR = path.join(tmp, 'data', 'patches');
process.env.SAFE_CHANGED_PATH = path.join(tmp, 'data', 'evolution', 'changed.jsonl');
process.env.SAFE_APPLY_SEEN = path.join(tmp, 'data', 'evolution', 'applied-hashes.json');
process.env.SAFE_EVOLVE_DATA_DIR = path.join(tmp, 'data', 'evolution');
process.env.INNOVATOR_DATA_DIR = path.join(tmp, 'data', 'innovator');

const apply = require('../backend/modules/safe-apply-os');

let passed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    passed += 1;
    console.log('✓', name);
  });
}

async function run() {
  await check('protocol + safe path gate', () => {
    assert.equal(apply.PROTOCOL, 'SAOS/1.0');
    assert.equal(apply.enabled(), true);
    assert.equal(apply.isSafeRel('data/catalog/next-offer.json').ok, true);
    assert.equal(apply.isSafeRel('backend/modules/unicornBrain.js').ok, false);
    assert.equal(apply.isSafeRel('../etc/passwd').ok, false);
  });

  await check('applies a data artifact with before/after hash', () => {
    const r = apply.applySpec({
      id: 'offer-1',
      title: 'Honest next offer',
      description: 'Catalog brief only',
      targetPaths: ['data/catalog/next-offer.json'],
      contentHash: 'hash-offer-1',
      inventsGmv: false,
    }, { force: true });
    assert.equal(r.ok, true);
    assert.equal(r.applied, true);
    assert.ok(r.writes && r.writes[0] && r.writes[0].afterHash);
    const abs = path.join(tmp, 'data/catalog/next-offer.json');
    assert.ok(fs.existsSync(abs));
    const body = JSON.parse(fs.readFileSync(abs, 'utf8'));
    assert.equal(body.inventsGmv, false);
    assert.equal(body.notBuyable, true);
  });

  await check('dedup skips the same content hash', () => {
    const r = apply.applySpec({
      id: 'offer-1-again',
      title: 'Honest next offer',
      description: 'Catalog brief only',
      targetPaths: ['data/catalog/next-offer.json'],
      contentHash: 'hash-offer-1',
    });
    assert.equal(r.applied, false);
    assert.equal(r.reason, 'dedup_content_hash');
  });

  await check('unsafe path becomes a patch proposal, not an apply', () => {
    const r = apply.applySpec({
      id: 'src-mut-1',
      title: 'rewrite module backend/modules/unicornBrain.js',
      description: 'edit code',
      targetPaths: ['backend/modules/unicornBrain.js'],
    }, { force: true });
    assert.equal(r.applied, false);
    assert.equal(r.patched, true);
    const patches = fs.readdirSync(path.join(tmp, 'data', 'patches'));
    assert.ok(patches.length >= 1);
    const src = fs.readFileSync(path.join(tmp, 'data', 'patches', patches[0]), 'utf8');
    assert.ok(src.includes('never auto-applied'));
  });

  await check('SECOS tick applies shipped artifacts', async () => {
    const secos = require('../backend/modules/safe-evolution-os');
    const out = await secos.tick({ force: true });
    assert.equal(out.ok, true);
    assert.ok(out.apply);
    const st = apply.getStatus();
    assert.equal(st.mutatesSource, false);
    assert.equal(st.inventsGmv, false);
    assert.ok(Array.isArray(st.changedThisHour));
  });

  await check('docs-only apply is not rolled back solely for public_catalog_empty', () => {
    const r = apply.applySpec({
      id: 'docs-heal-1',
      title: 'Heal receipt',
      description: 'Data-plane heal receipt',
      targetPaths: ['docs/innovation/heal-example.md'],
      contentHash: 'hash-docs-heal-1',
      inventsGmv: false,
    }, { force: true });
    assert.equal(r.ok, true);
    assert.equal(r.applied, true);
    assert.ok(!r.rolledBack);
    const abs = path.join(tmp, 'docs/innovation/heal-example.md');
    assert.ok(fs.existsSync(abs));
  });

  await check('LAR + UI wire apply receipts', () => {
    const lar = require('../backend/modules/live-action-receipts');
    const snap = lar.snapshot(6);
    assert.ok(snap.apply);
    assert.equal(snap.apply.mutatesSource, false);
    const shell = fs.readFileSync(path.join(__dirname, '../src/site/v2/shell.js'), 'utf8');
    assert.ok(shell.includes('What changed this hour'));
    assert.ok(shell.includes("kpi('Applied'"));
    const be = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(be.includes("require('./modules/safe-apply-os')"));
  });

  await check('innovator defects + fitness + dedup exports', () => {
    const innovator = require('../backend/modules/unicornInnovator');
    assert.equal(typeof innovator.scanDefects, 'function');
    assert.equal(typeof innovator.fitness, 'function');
    const defects = innovator.scanDefects();
    assert.ok(Array.isArray(defects));
    const scored = innovator.fitness({ title: 'x', score: 0.7, defectKind: 'missing_seo_brief', targetPaths: ['docs/seo/landing-brief.md'], acceptanceTest: 'exists' });
    assert.ok(scored > 0.7);
    const ev = innovator.selfEvolver();
    assert.ok(typeof ev.evolutions === 'number');
  });

  await check('healer data-plane heal does not call processGuardian', () => {
    const healer = require('../backend/modules/unicornSelfHealer');
    assert.equal(typeof healer.dataPlaneHeal, 'function');
    const src = fs.readFileSync(path.join(__dirname, '../backend/modules/unicornSelfHealer.js'), 'utf8');
    const observe = src.split('function observeCycle()')[1].split('function _idlePulse')[0];
    assert.ok(observe.includes('dataPlaneHeal()'));
    assert.ok(!observe.includes('processGuardian()'));
  });

  console.log('safe-apply-os.test.js passed ·', passed);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('safe-apply-os.test.js failed:', err);
  process.exit(1);
});
