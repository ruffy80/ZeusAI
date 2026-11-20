'use strict';

const assert = require('assert');
const path = require('path');
const { validateAllManifests } = require('../backend/modules/validate_manifests');
const sags = require('../backend/modules/seo-aeo-geo-singularity');
const brain = require('../backend/modules/omniscient-chatbot');

(async () => {
  sags.persistPostgres = false;

  // 1. Manifest validation (21/21 valid including seo-aeo-geo-singularity)
  const manifests = validateAllManifests([path.resolve(__dirname, '../backend/modules')]);
  const sagsManifest = manifests.find((m) => m.module === 'seo-aeo-geo-singularity');
  assert.ok(sagsManifest && sagsManifest.valid, 'seo-aeo-geo-singularity manifest must be valid');
  assert.strictEqual(manifests.filter((m) => !m.valid).length, 0);
  console.log(`✓ Manifest Validation: ${manifests.length}/${manifests.length} valid (including seo-aeo-geo-singularity@1.0.0)`);

  // 2. Tri-Layer Audit Matrix (SEO + AEO + GEO)
  const audit = sags.auditTriLayerMatrix();
  assert.strictEqual(audit.ok, true);
  assert.strictEqual(audit.layers.SEO.status, 'OPTIMAL');
  assert.strictEqual(audit.layers.AEO.status, 'OPTIMAL');
  assert.strictEqual(audit.layers.GEO.status, 'OPTIMAL');
  assert.ok(audit.layers.AEO.atomicAnswerCapsules >= 80, `Expected >= 80 AEO capsules, got ${audit.layers.AEO.atomicAnswerCapsules}`);
  assert.ok(audit.layers.GEO.semanticRagChunks >= 7, `Expected >= 7 RAG chunks, got ${audit.layers.GEO.semanticRagChunks}`);
  console.log(`✓ Tri-Layer Audit: ${audit.layers.AEO.atomicAnswerCapsules} AEO capsules, ${audit.layers.GEO.geoArchitectureCapsules} GEO capsules, ${audit.layers.GEO.semanticRagChunks} RAG chunks`);

  // 3. /llms-full.txt complete corpus
  const llmsFull = sags.buildLlmsFullTxt();
  assert.ok(llmsFull.includes('# ZeusAI — Full Omniscient LLM, AEO & GEO Knowledge Corpus (/llms-full.txt)'));
  assert.ok(llmsFull.includes('ent-acquisition-pack'));
  assert.ok(llmsFull.includes('seo-aeo-geo-singularity@1.0.0'));
  assert.ok(llmsFull.includes('/.well-known/aeo-answer-graph.json'));
  console.log(`✓ /llms-full.txt generated (${llmsFull.length} bytes)`);

  // 4. Ed25519 Cryptographic Citation Proof Verification
  const vOut = sags.verifyCapsule('aeo-core-what-is-zeusai');
  assert.strictEqual(vOut.ok, true);
  assert.strictEqual(vOut.verified, true);
  console.log('✓ Cryptographic Citation Proof Protocol (CCPP/1.0 Ed25519) verified');

  // 5. Multilingual 8-Locale Matrix
  const multi = sags.getMultilingualMatrix();
  assert.strictEqual(multi.ok, true);
  assert.strictEqual(multi.localesCount, 8);
  console.log('✓ 8-Language GEO Intent Matrix (EN, RO, DE, FR, ES, IT, PT, AR) verified');

  // 6. Autonomous Chat-to-AEO Self-Learning Loop
  const beforeCount = sags.capsules.size;
  await brain.answer({
    message: 'Cum mă ajută ZeusAI să reduc costurile cu modelele AI și să vând automat în Bitcoin?',
  });
  assert.ok(sags.capsules.size > beforeCount, 'Asking a new question in Omniscient Chatbot must auto-synthesize a new signed AEO capsule');
  console.log(`✓ Chat-to-AEO Autonomous Learning Loop: capsules grew from ${beforeCount} to ${sags.capsules.size}`);

  // 7. Continuous Evolution Cycle
  const genBefore = sags.evolutionGeneration;
  const ev = await sags.evolveContinuum();
  assert.strictEqual(ev.ok, true);
  assert.strictEqual(ev.evolutionGeneration, genBefore + 1);
  console.log(`✓ Autonomous Evolution Continuum: evolved to generation #${ev.evolutionGeneration}`);

  console.log('ALL SEO + AEO + GEO SINGULARITY TESTS PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('SEO AEO GEO TEST FAILED:', err);
  process.exit(1);
});
