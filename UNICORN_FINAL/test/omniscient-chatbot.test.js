'use strict';

const assert = require('assert');
const brain = require('../backend/modules/omniscient-chatbot');

(async () => {
  // 1. Knowledge Map indexes all services ($29 to $4,000,000) and all 760+ modules
  const map = brain.getKnowledgeMap();
  assert.strictEqual(map.ok, true);
  assert.ok(map.servicesCount >= 80, `Expected >= 80 services indexed, got ${map.servicesCount}`);
  assert.ok(map.modulesCount >= 700, `Expected >= 700 modules indexed, got ${map.modulesCount}`);
  assert.ok(map.manifestModulesCount >= 20, `Expected >= 20 manifest modules, got ${map.manifestModulesCount}`);
  assert.strictEqual(map.priceRangeUsd.max, 4000000);
  console.log(`✓ Knowledge Map: ${map.servicesCount} services ($${map.priceRangeUsd.min}–$${map.priceRangeUsd.max.toLocaleString()}) & ${map.modulesCount} modules indexed`);

  // 2. Explains any specific module (e.g., orchestrator, zacc, witness, adi-core, cryptoBridge)
  const modAns = await brain.answer({
    message: 'Ce face și pentru ce este făcut modulul orchestrator, zacc și witness din Unicorn?',
  });
  assert.strictEqual(modAns.ok, true);
  assert.strictEqual(modAns.lang, 'ro');
  assert.ok(modAns.reply.includes('orchestrator') && modAns.reply.includes('zacc') && modAns.reply.includes('witness'));
  assert.ok(modAns.recommendations.length >= 2);
  console.log('✓ Module Omniscience: detailed explanations for orchestrator, zacc, witness verified');

  // 3. Explains all services including Enterprise up to $4,000,000
  const svcAns = await brain.answer({
    message: 'Arată-mi toate serviciile din site și pachetele Enterprise de până la 4 milioane de dolari',
  });
  assert.strictEqual(svcAns.ok, true);
  assert.ok(svcAns.reply.includes('4,000,000') && svcAns.reply.includes('ent-acquisition-pack'));
  console.log('✓ Full Service & Enterprise ($4,000,000) Omniscience verified');

  // 4. Proactive Latent-Need / Unthought Blind-Spot Discovery
  const latentAns = await brain.answer({
    message: 'Vreau un site de ecommerce nou pentru firma mea, ce îmi recomanzi?',
  });
  assert.strictEqual(latentAns.ok, true);
  assert.ok(latentAns.reply.includes('Analiză Proactivă') || latentAns.reply.includes('Puncte Oarbe'));
  assert.ok(latentAns.recommendations.some((r) => /NEVOIE ASCUNSĂ/i.test(r.title)));
  console.log('✓ Proactive Latent-Need & Blind-Spot Synthesis verified');

  // 5. Auto-generates 30% Live Reverse-SaaS Escrow Preview when a domain is mentioned
  const escrowAns = await brain.answer({
    message: 'Vreau un audit și o mostră pentru domeniul acme-enterprise.io',
  });
  assert.strictEqual(escrowAns.ok, true);
  assert.ok(escrowAns.escrowPreview && escrowAns.escrowPreview.escrowId.startsWith('escrow_'));
  assert.ok(escrowAns.reply.includes('acme-enterprise.io') && escrowAns.reply.includes('Ed25519'));
  console.log('✓ In-Chat 30% Reverse-SaaS Cryptographic Escrow Preview verified');

  console.log('ALL OMNISCIENT CHATBOT TESTS PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('OMNISCIENT CHATBOT TEST FAILED:', err);
  process.exit(1);
});
