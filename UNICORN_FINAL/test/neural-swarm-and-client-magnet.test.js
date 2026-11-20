'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-nsc-acme-'));
process.env.ACME_DATA_DIR = tmpDir;
process.env.GROQ_API_KEY = 'gsk_test_mock_key_1234567890';
process.env.GROQ_MODEL = 'llama-3.3-70b-versatile'; // deprecated -> must auto-heal!
process.env.OPENROUTER_API_KEY = 'sk-or-v1-test_mock_key_1234567890';
process.env.OPENROUTER_MODEL = 'mistralai/mistral-7b-instruct:free'; // deprecated -> must auto-heal!

const nsc = require('../backend/modules/neural-swarm-llm-cascade');
const acme = require('../backend/modules/autonomous-client-magnet');

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

(async () => {
  await check('NSC/1.0 auto-heals deprecated Groq & OpenRouter model IDs to live 120B & 550B frontier models', () => {
    const m = nsc.getSwarmManifest();
    assert.strictEqual(m.ok, true);
    assert.strictEqual(m.protocol, 'NSC/1.0');
    const groq = m.rails.find((r) => r.id === 'groq');
    const or = m.rails.find((r) => r.id === 'openrouter');
    const ol = m.rails.find((r) => r.id === 'ollama');
    assert.ok(groq && groq.model === 'openai/gpt-oss-120b', 'deprecated Groq model must heal to openai/gpt-oss-120b, got ' + (groq && groq.model));
    assert.ok(or && or.model === 'nvidia/nemotron-3-ultra-550b-a55b:free', 'deprecated OpenRouter model must heal to 550B free model, got ' + (or && or.model));
    assert.ok(ol && ol.tier === 'tier-3-sovereign-local', 'sovereign Ollama local fallback must always exist');
  });

  await check('NSC/1.0 adversarial quality scorer rewards concrete structured output and flags empty/fluff', () => {
    const empty = nsc.scoreDeliverableQuality('');
    assert.strictEqual(empty.needsRefinement, true);
    assert.strictEqual(empty.score, 0);

    const elite = nsc.scoreDeliverableQuality(
      '# Executive Audit & Remediation\n'
      + '- Implement Strict-Transport-Security (`HSTS`) and verify HTTPS 200 latency under 120ms.\n'
      + '- Configure `application/ld+json` and `/llms-full.txt` to boost SEO, AEO, and GEO citation capture by 40%.\n'
      + '- Deploy Ed25519 cryptographic proofs and automate weekly regression audits at $49.\n'
      + '1. Fix missing canonical tags.\n2. Optimize meta descriptions.\n3. Reduce unused JS payloads.\n'.repeat(3)
    );
    assert.ok(elite.score >= 85, 'elite structured response should score >= 85, got ' + elite.score);
    assert.strictEqual(elite.needsRefinement, false);
  });

  await check('ACME/1.0 SSRF guard blocks private/localhost URLs strictly', async () => {
    for (const bad of ['http://127.0.0.1:3000', 'http://localhost/admin', 'http://169.254.169.254/latest', 'http://10.0.0.1/', 'ftp://example.com']) {
      const r = await acme.runProofBeforePayTeaser(bad);
      assert.strictEqual(r.ok, false, 'must block ' + bad);
    }
  });

  await check('ACME/1.0 Proof-Before-Pay teaser diagnoses real HTML gaps, generates 4-rail checkout & 10%/10% referral bounty', async () => {
    const res = await acme.runProofBeforePayTeaser('https://prospect-example.com', {
      dryRunHtml: '<html><head><title>Short</title></head><body><h1>First</h1><h1>Second</h1><p>Hello</p></body></html>',
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.protocol, 'ACME/1.0');
    assert.ok(res.detectedGaps.length >= 3, 'should detect missing meta, canonical, JSON-LD, multiple H1s');
    assert.ok(res.instantActivation.btcCheckoutUrl.includes('rail=btc'));
    assert.ok(res.instantActivation.paypalCheckoutUrl.includes('rail=paypal'));
    assert.ok(res.instantActivation.nowpaymentsCheckoutUrl.includes('rail=nowpayments'));
    assert.ok(res.referralBounty.code.startsWith('zeus_'));
    assert.ok(Array.isArray(res.compoundingUpgrades) && res.compoundingUpgrades.length >= 2);
  });

  await check('ACME/1.0 runAcquisitionPulse coordinates SAGS + ASPE + NSC honestly', async () => {
    const p = await acme.runAcquisitionPulse();
    assert.strictEqual(p.ok, true);
    assert.ok(p.pulse.autonomousServicesReady >= 55);
    assert.ok(p.pulse.discoveryEndpoints.includes('https://zeusai.pro/.well-known/llm-swarm.json'));
    assert.ok(p.pulse.discoveryEndpoints.includes('https://zeusai.pro/.well-known/client-magnet.json'));
  });

  console.log(`neural-swarm-and-client-magnet.test.js: ${passed} passed ✓`);
  process.exit(0);
})();
