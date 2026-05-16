/* =====================================================================
 * deepseek-roadmap-billion-mandate.test.js
 *
 * Pins the upgraded `data/roadmap.json` contract that drives the DeepSeek
 * autonomous loop toward the billion-USD / global-SaaS mission:
 *
 *   1. Top-level scaffolding: ownerBtcSettlementAddress, missionForDeepSeek,
 *      northStarTargets, northStarMetric.
 *   2. The `deepseek-autonomy-cockpit` objective is preserved (already
 *      pinned by site-deepseek-cockpit.test.js but re-asserted here).
 *   3. At least 5 innovation-flagged objectives (`innovation: true`) exist
 *      — these are features that don't yet exist on competing SaaS.
 *   4. Both revenue blockers (billing-recurring + checkout-conversion-
 *      instrumentation) are at priority 1.
 *   5. AI-personalized pricing innovation is at priority 1 (drives MRR).
 *   6. The bilingual missionForDeepSeek references "24/7" or "autonom"
 *      (continuous-improvement-loop mandate).
 *   7. Pinează prompt-ul DeepSeek: include "BILLION" sau "billions" și
 *      "INNOVATION MANDATE" — fără aceste cuvinte loop-ul nu mai
 *      direcționează modelul spre invenții.
 *
 * If you intentionally rework the roadmap, update this test in the SAME
 * commit so the safety/intent contract stays explicit.
 * ===================================================================== */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const roadmap = require('../data/roadmap.json');

// ---- 1. Top-level scaffolding ---------------------------------------
assert.strictEqual(typeof roadmap.ownerBtcSettlementAddress, 'string',
  'roadmap must declare ownerBtcSettlementAddress');
assert.ok(/^bc1[a-z0-9]{20,}$/i.test(roadmap.ownerBtcSettlementAddress),
  'ownerBtcSettlementAddress must look like a bech32 BTC address');

assert.strictEqual(typeof roadmap.missionForDeepSeek, 'string',
  'roadmap must declare missionForDeepSeek (DeepSeek system context)');
assert.ok(roadmap.missionForDeepSeek.length > 80,
  'missionForDeepSeek must be a substantive instruction (>80 chars)');

assert.ok(roadmap.northStarTargets && typeof roadmap.northStarTargets === 'object',
  'roadmap must declare northStarTargets');
assert.ok(typeof roadmap.northStarTargets.mrr30d_usd === 'number',
  'northStarTargets.mrr30d_usd must be numeric');
assert.ok(roadmap.northStarTargets.mrr30d_usd >= 1000,
  'northStarTargets.mrr30d_usd must be a meaningful milestone');

assert.strictEqual(roadmap.northStarMetric, 'MRR_USD',
  'northStarMetric must remain MRR_USD');

// ---- 2. Cockpit objective preserved ---------------------------------
const cockpit = roadmap.objectives.find(o => o && o.id === 'deepseek-autonomy-cockpit');
assert.ok(cockpit, 'roadmap must keep the deepseek-autonomy-cockpit objective');

// ---- 3. Innovation-flagged objectives -------------------------------
const innovations = roadmap.objectives.filter(o => o && o.innovation === true);
assert.ok(innovations.length >= 5,
  'roadmap must define at least 5 innovation-flagged objectives, got ' + innovations.length);

// ---- 4. Revenue blockers at priority 1 ------------------------------
const billing = roadmap.objectives.find(o => o && /^billing-recurring/.test(o.id));
assert.ok(billing, 'roadmap must include a billing-recurring* objective');
assert.strictEqual(billing.priority, 1,
  'billing-recurring* must be priority 1 — no billing = no billions');

const conversion = roadmap.objectives.find(o => o && o.id === 'checkout-conversion-instrumentation');
assert.ok(conversion, 'roadmap must include checkout-conversion-instrumentation');
assert.strictEqual(conversion.priority, 1,
  'checkout-conversion-instrumentation must be priority 1');

// ---- 5. AI-personalized pricing at priority 1 -----------------------
const aiPricing = roadmap.objectives.find(o => o && o.id === 'ai-personalized-pricing-negotiator');
assert.ok(aiPricing, 'roadmap must include ai-personalized-pricing-negotiator innovation');
assert.strictEqual(aiPricing.innovation, true,
  'ai-personalized-pricing-negotiator must be innovation: true');
assert.strictEqual(aiPricing.priority, 1,
  'ai-personalized-pricing-negotiator must be priority 1 (direct MRR uplift)');

// ---- 6. Continuous-loop mandate phrasing ----------------------------
assert.ok(
  /24\/7|autonom|infinite/i.test(roadmap.missionForDeepSeek),
  'missionForDeepSeek must convey continuous/24-7 operation'
);

// ---- 7. DeepSeek loop system prompt pinned --------------------------
const loopSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'deepseek-loop.js'), 'utf8');
assert.ok(/billion/i.test(loopSrc),
  'deepseek-loop.js system prompt must reference billion-scale revenue goal');
assert.ok(/INNOVATION MANDATE/.test(loopSrc),
  'deepseek-loop.js system prompt must contain the literal "INNOVATION MANDATE" directive');
assert.ok(/Auto-advance rule/i.test(loopSrc),
  'deepseek-loop.js system prompt must contain the auto-advance rule for completed objectives');
assert.ok(/bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e/.test(loopSrc),
  'deepseek-loop.js system prompt must reference the owner BTC settlement address');

console.log('deepseek-roadmap-billion-mandate.test.js: OK ('
  + roadmap.objectives.length + ' objectives, '
  + innovations.length + ' innovations)');
