// =====================================================================
// ai-genome-engine.test.js — AI Genome Engine GENOME/1.0
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_GENOME_DIR = require('os').tmpdir() + '/genome-' + process.pid + '-' + Date.now();
process.env.ZEUS_GENOME_DISABLED = '0';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete require.cache[require.resolve('../backend/modules/ai-genome-engine')];
const genome = require('../backend/modules/ai-genome-engine');
genome._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('discovery advertises GENOME/1.0 + registerProduct + 22 chromosomes', () => {
  const d = genome.discovery();
  assert.equal(d.protocol, 'GENOME/1.0');
  assert.equal(d.registerProduct, true);
  assert.ok(Array.isArray(d.chromosomes) && d.chromosomes.length >= 22);
  assert.ok(d.chromosomes.includes('capability'));
  assert.ok(d.chromosomes.includes('relationship'));
  assert.ok(d.inventions.length >= 5);
  assert.ok(d.principle.includes('ecosystem'));
});

check('registerProduct creates living genome + graph node', () => {
  const out = genome.registerProduct({
    id: 'frontier-nexus',
    title: 'Frontier Nexus',
    tier: 'enterprise',
    description: 'Autonomous frontier AI for enterprise ops',
    priceUSD: 199,
  });
  assert.ok(out.ok);
  assert.ok(out.genomeId.startsWith('gnm_'));
  assert.equal(out.genome.living, true);
  assert.equal(out.genome.protocol, 'GENOME/1.0');
  assert.ok(out.genome.chromosomeCount >= 22);
  assert.ok(out.genome.capabilities.includes('graph_participation'));
});

check('registerProduct is idempotent per SKU', () => {
  const a = genome.registerProduct({ id: 'frontier-nexus', title: 'Frontier Nexus' });
  assert.ok(a.ok);
  assert.equal(a.already, true);
  assert.equal(genome.getStatus().counts.genomesBorn, 1);
});

check('Universal Intelligence Graph links products via synaptic scoring', () => {
  genome.registerProduct({
    id: 'starter',
    title: 'Starter Automation',
    tier: 'instant',
    description: 'Autonomous starter workflows',
  });
  genome.registerProduct({
    id: 'growth-aura',
    title: 'Growth Aura Outreach',
    tier: 'professional',
    description: 'Growth automation outreach',
  });
  const g = genome.getGraph({});
  assert.ok(g.ok);
  assert.ok(g.nodeCount >= 3);
  assert.ok(g.edgeCount >= 1);
  assert.ok(g.nodes.omega_continuum);
});

check('enrichCatalogItem stamps genomeReady idempotently', () => {
  const item = genome.enrichCatalogItem({ id: 'starter', title: 'Starter' });
  assert.equal(item.genomeReady, true);
  assert.equal(item.genome.protocol, 'GENOME/1.0');
  const again = genome.enrichCatalogItem(item);
  assert.strictEqual(again, item);
});

check('onOrderPaid attaches purchase adaptation to genome', () => {
  const out = genome.onOrderPaid({
    orderId: 'ord_g1',
    serviceId: 'frontier-nexus',
    serviceName: 'Frontier Nexus',
    email: 'buyer@example.com',
  });
  assert.ok(out.ok);
  assert.ok(out.genomeId);
  const full = genome.getGenome('frontier-nexus');
  assert.ok(full.ok);
  assert.ok(full.dna.adaptation.customerAdaptations.length >= 1);
  assert.ok(full.dna.learning.history.some((h) => h.event === 'purchase'));
});

check('evolveOnce + orchestrate improve ecosystem without fake revenue', () => {
  const before = genome.getStatus().counts.evolutions;
  const out = genome.evolveOnce();
  assert.ok(out.ok);
  assert.ok(out.evolved >= 1);
  assert.ok(['integrate', 'automate', 'eliminate_manual', 'increase_value'].includes(out.question));
  assert.ok(genome.getStatus().counts.evolutions > before);
  const json = JSON.stringify(out);
  assert.ok(!/fake.?gmv|invented.?revenue/i.test(json));
});

check('Future Mode planMigration preserves data + minimizes downtime', () => {
  const m = genome.planMigration({ target: 'genome_helix_v2' });
  assert.ok(m.ok);
  assert.equal(m.plan.preserveCustomerData, true);
  assert.equal(m.plan.minimizeDowntime, true);
  assert.equal(m.plan.applied, false);
  assert.ok(m.plan.steps.some((s) => s.requiresApproval));
});

check('searchGenomes finds by sku/title', () => {
  const hits = genome.searchGenomes('frontier');
  assert.ok(hits.ok);
  assert.ok(hits.count >= 1);
  assert.ok(String(hits.genomes[0].sku).includes('frontier'));
});

check('persistence under ZEUS_GENOME_DIR', () => {
  const dir = process.env.ZEUS_GENOME_DIR;
  const flushed = genome.flush();
  assert.equal(flushed.ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'genomes.json')));
  assert.ok(fs.existsSync(path.join(dir, 'graph.json')));
  assert.ok(fs.existsSync(path.join(dir, 'state.json')));
  const raw = fs.readFileSync(path.join(dir, 'genomes.json'), 'utf8');
  assert.equal(raw.trim().startsWith('{'), true);
  assert.ok(!/\n {2}"/.test(raw), 'genomes.json must stay compact so catalog walks do not pretty-print megabytes');
});

check('getStatus exposes orchestrator + coalesced persistence', () => {
  const st = genome.getStatus();
  assert.equal(st.ok, true);
  assert.equal(st.protocol, 'GENOME/1.0');
  assert.equal(st.design, 'Living Genome + Universal Intelligence Graph');
  assert.ok(st.counts.graphNodes >= 1);
  assert.ok(st.endpoints.human.includes('/genome'));
  assert.equal(st.persistence.mode, 'coalesced');
  assert.equal(typeof st.persistence.debounceMs, 'number');
  assert.ok(st.persistence.flushes >= 1);
});

check('catalog enrich coalesces disk writes instead of writing per item', () => {
  genome._resetForTests();
  const dir = process.env.ZEUS_GENOME_DIR;
  const genomesPath = path.join(dir, 'genomes.json');
  for (let i = 0; i < 40; i += 1) {
    genome.enrichCatalogItem({ id: `walk-sku-${i}`, title: `Walk ${i}`, priceUSD: i + 1 });
  }
  const pending = genome.getStatus();
  assert.equal(pending.persistence.pending, true);
  assert.equal(pending.persistence.flushes, 0);
  assert.equal(fs.existsSync(genomesPath), false);
  const flushed = genome.flush();
  assert.equal(flushed.ok, true);
  assert.equal(flushed.flushes, 1);
  assert.equal(fs.existsSync(genomesPath), true);
  const skipped = genome.flush();
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.flushes, 1);
});

check('idempotent catalog re-walk does not dirty persistence', () => {
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    items.push(genome.enrichCatalogItem({ id: `walk-sku-${i}`, title: `Walk ${i}`, priceUSD: i + 1 }));
  }
  assert.equal(genome.getStatus().persistence.pending, false);
  const before = genome.getStatus().persistence.flushes;
  const skipped = genome.flush();
  assert.equal(skipped.skipped, true);
  assert.equal(genome.getStatus().persistence.flushes, before);
  assert.ok(items.every((it) => it.genomeReady === true));
});

check('evolveOnce keeps version current climbing after history trim', () => {
  genome._resetForTests();
  genome.registerProduct({ id: 'seq-sku', title: 'Seq' });
  for (let i = 0; i < 36; i += 1) {
    const out = genome.evolveOnce();
    assert.ok(out.ok);
  }
  const full = genome.getGenome('seq-sku');
  assert.ok(full.ok);
  assert.ok(full.dna.learning.history.length <= 50);
  assert.ok(full.dna.versioning.versions.length <= 30);
  const last = full.dna.versioning.current;
  assert.ok(/^1\.0\.\d+$/.test(last));
  const seq = Number(String(last).split('.')[2]);
  assert.ok(seq >= 36);
});

console.log('\n✅ ai-genome-engine:', passed, 'tests passed');
process.exit(0);
