'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-aspe-test-'));
process.env.ASPE_DATA_DIR = tmpDir;
process.env.ZEUS_STATE_DIR = tmpDir;
process.env.SNM_STATE_DIR = tmpDir;

const aspe = require('../backend/modules/autonomous-service-provisioning');
const shelf = require('../src/commerce/public-shelf');
const shell = require('../src/site/v2/shell');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

check('ASPE/1.0 maps every single public-shelf service to real Unicorn autonomous modules', () => {
  const items = shelf.publicShelf();
  assert.ok(items.length >= 50, 'expected >= 50 shelf services');
  for (const item of items) {
    const bp = aspe.getServiceBlueprint(item.id);
    assert.ok(bp && bp.serviceId === item.id, 'missing blueprint for ' + item.id);
    assert.ok(Array.isArray(bp.modules) && bp.modules.length >= 2, 'service ' + item.id + ' must activate >= 2 Unicorn modules');
    assert.ok(bp.executionMode && bp.executionMode.length > 10, 'service ' + item.id + ' must define executionMode');
    assert.ok(bp.schedule && bp.schedule.length > 5, 'service ' + item.id + ' must define autonomous schedule');
  }
});

check('ASPE/1.0 activatePaidService provisions live workspace, API key, executes Unicorn modules & signs Ed25519 proof', () => {
  const res = aspe.activatePaidService({
    orderId: 'ord_aspe_live_001',
    serviceId: 'instant-website-audit',
    email: 'buyer@enterprise.example',
    amountUsd: 49,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.idempotent, false);
  assert.ok(res.apiKeyPlaintextOnce && res.apiKeyPlaintextOnce.startsWith('zai_auto_'));
  const inst = res.instance;
  assert.strictEqual(inst.status, 'ACTIVE_AUTONOMOUS');
  assert.ok(inst.workspaceId && inst.workspaceId.startsWith('ws_'));
  assert.ok(inst.modulesActivated.includes('seo-aeo-geo-singularity'));
  assert.ok(inst.modulesActivated.includes('autonomous-runtime-immunity'));
  assert.strictEqual(inst.cyclesExecuted, 1);
  assert.strictEqual(inst.activationProof.algorithm, 'Ed25519');

  const v = aspe.verifyActivationProof(inst);
  assert.strictEqual(v.valid, true, 'Ed25519 activation proof must verify');

  // Tamper rejection
  const tampered = JSON.parse(JSON.stringify(inst));
  tampered.proofPayload.serviceId = 'forged-service';
  assert.strictEqual(aspe.verifyActivationProof(tampered).valid, false, 'tampered proof must be rejected');

  // Idempotency
  const dup = aspe.activatePaidService({ orderId: 'ord_aspe_live_001', serviceId: 'instant-website-audit' });
  assert.strictEqual(dup.ok, true);
  assert.strictEqual(dup.idempotent, true);
});

check('ASPE/1.0 runAutonomousCycle executes live on-demand customer cycles cleanly', () => {
  const run = aspe.runAutonomousCycle('ord_aspe_live_001', { trigger: 'customer_on_demand' });
  assert.strictEqual(run.ok, true);
  assert.strictEqual(run.instance.cyclesExecuted, 2);
  assert.strictEqual(run.cycle.cycleId, 'cyc_2');
  assert.ok(run.cycle.modulesRan >= 4);
  assert.ok(run.cycle.results.every((r) => r.ok === true));
});

check('Storefront homepage, /services, and /services/:id showcase autonomous Unicorn services (not just static files)', () => {
  const home = shell.getHtml('/');
  assert.ok(home.includes('Three autonomous Unicorn services you can activate now'), 'homepage doors must showcase autonomous services');
  assert.ok(home.includes('Six autonomous Unicorn services you can activate now'), 'homepage featured must showcase autonomous services');
  assert.ok(!home.includes('Three files you can buy'), 'old Three files copy must be gone');
  assert.ok(!home.includes('Six files you can buy now'), 'old Six files copy must be gone');

  const services = shell.getHtml('/services');
  assert.ok(services.includes('Full Autonomous Unicorn Catalog'), '/services must lead with Autonomous Unicorn Catalog');
  assert.ok(services.includes('aspe-auto-pill'), '/services cards must display autonomous Unicorn modules');
  assert.ok(!services.includes('Pay, then download the file.'), 'old Pay then download the file copy must be gone');

  const detail = shell.getHtml('/services/instant-website-audit');
  assert.ok(detail.includes('id="aspeExecutionCard"'), 'service detail must render ASPE/1.0 live execution card');
  assert.ok(detail.includes('Autonomous Execution'), 'service detail panel must highlight Autonomous Execution');
});

console.log(`autonomous-service-provisioning.test.js: ${passed} passed ✓`);
process.exit(0);
