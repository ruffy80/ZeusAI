// =====================================================================
// omega-ecosystem-os.test.js — Project Omega Ecosystem Ω/1.0
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_OMEGA_DIR = require('os').tmpdir() + '/omega-' + process.pid + '-' + Date.now();
process.env.ZEUS_OMEGA_DISABLED = '0';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const modPath = require.resolve('../backend/modules/omega-ecosystem-os');
delete require.cache[modPath];
const omega = require('../backend/modules/omega-ecosystem-os');
omega._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery advertises OMEGA/1.0 Continuum Instance Graph', () => {
  const d = omega.discovery();
  assert.equal(d.protocol, 'OMEGA/1.0');
  assert.equal(d.design, 'Continuum Instance Graph');
  assert.ok(Array.isArray(d.capabilities) && d.capabilities.length >= 20);
  assert.ok(d.capabilities.some((c) => c.key === 'vault'));
  assert.ok(d.capabilities.some((c) => c.key === 'concierge'));
  assert.ok(d.capabilities.some((c) => c.key === 'selfHealing'));
  assert.ok(d.principle.includes('AI already handled'));
  assert.ok(d.endpoints.status.includes('/api/omega'));
  assert.ok(d.endpoints.human.includes('/omega'));
});

check('enrichCatalogItem stamps every SKU with Omega continuum', () => {
  const item = omega.enrichCatalogItem({ id: 'starter', name: 'Starter', price: 49 });
  assert.ok(item.omega);
  assert.equal(item.omega.protocol, 'OMEGA/1.0');
  assert.equal(item.omega.ready, true);
  assert.equal(item.omegaReady, true);
  assert.ok(item.omega.engines.includes('workspace'));
  assert.equal(item.omega.engineCount, 20);
});

check('bootstrapFromOrder creates live instance + vault', () => {
  const out = omega.bootstrapFromOrder({
    orderId: 'ord_omega_1',
    serviceId: 'frontier-nexus',
    serviceName: 'Frontier Nexus',
    email: 'buyer@example.com',
    amount_usd: 199,
    paid_via: 'btc',
  });
  assert.ok(out.ok);
  assert.ok(out.instance);
  assert.equal(out.instance.live, true);
  assert.equal(out.instance.stage, 'live');
  assert.equal(out.instance.protocol, 'OMEGA/1.0');
  assert.ok(String(out.instance.id).startsWith('omega_'));
  assert.ok(Array.isArray(out.instance.engines) && out.instance.engines.length >= 20);
  assert.ok(out.instance.engines.some((e) => e.key === 'vault' && e.status === 'active'));
  assert.ok(out.instance.engines.some((e) => e.key === 'delivery'));
  assert.ok(out.instance.concierge && out.instance.concierge.welcomed);
  assert.ok(String(out.instance.concierge.message).includes('already live'));

  const vault = omega.getVault('buyer@example.com');
  assert.ok(vault.ok);
  assert.equal(vault.count, 1);
  assert.equal(vault.entries[0].instanceId, out.instance.id);
  assert.ok(String(vault.email).includes('@'));
});

check('bootstrap is idempotent for same order', () => {
  const a = omega.bootstrapFromOrder({
    orderId: 'ord_omega_1',
    serviceId: 'frontier-nexus',
    email: 'buyer@example.com',
  });
  assert.ok(a.ok);
  assert.equal(a.already, true);
  assert.equal(omega.getStatus().counts.bootstraps, 1);
});

check('onDeliveryFired acknowledges continuum', () => {
  const out = omega.onDeliveryFired({
    orderId: 'ord_omega_1',
    serviceId: 'frontier-nexus',
    email: 'buyer@example.com',
  });
  assert.ok(out.ok);
  assert.ok(out.instanceId);
  assert.equal(out.instance.live, true);
  assert.ok(omega.getStatus().counts.deliveriesFired >= 1);
});

check('searchVault finds owned products', () => {
  const hits = omega.searchVault('buyer@example.com', 'frontier');
  assert.ok(hits.ok);
  assert.ok(hits.count >= 1);
  assert.ok(String(hits.entries[0].serviceId).includes('frontier'));
});

check('evolveOnce self-evolves OS questions', () => {
  const before = omega.getStatus().counts.evolutions;
  const out = omega.evolveOnce();
  assert.ok(out.ok);
  assert.ok(out.evolution);
  assert.ok(['simpler', 'autonomous', 'faster', 'invisible'].includes(out.evolution.axis));
  assert.ok(omega.getStatus().counts.evolutions > before);
});

check('getStatus never invents fake revenue and exposes endpoints', () => {
  const st = omega.getStatus();
  assert.equal(st.ok, true);
  assert.equal(st.protocol, 'OMEGA/1.0');
  assert.equal(st.design, 'Continuum Instance Graph');
  assert.ok(st.endpoints.status.includes('/api/omega'));
  assert.ok(st.endpoints.human.includes('/omega'));
  assert.ok(!JSON.stringify(st).includes('fake'));
});

check('Universal Product Engine works for arbitrary future SKU', () => {
  const out = omega.onOrderPaid({
    orderId: 'ord_future_99',
    serviceId: 'future-plugin-xyz',
    serviceName: 'Future Plugin XYZ',
    email: 'buyer@example.com',
    amount_usd: 9,
  });
  assert.ok(out.ok);
  assert.equal(out.instance.serviceId, 'future-plugin-xyz');
  assert.ok(out.instance.engines.length >= 20);
  const vault = omega.getVault('buyer@example.com');
  assert.ok(vault.count >= 2);
});

check('data persists under ZEUS_OMEGA_DIR', () => {
  const dir = process.env.ZEUS_OMEGA_DIR;
  assert.ok(fs.existsSync(path.join(dir, 'instances.json')));
  assert.ok(fs.existsSync(path.join(dir, 'vault.json')));
  assert.ok(fs.existsSync(path.join(dir, 'state.json')));
});

console.log('\n✅ omega-ecosystem-os:', passed, 'tests passed');
process.exit(0);
