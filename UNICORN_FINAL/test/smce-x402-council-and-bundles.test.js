'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-smce-test-'));
process.env.ZEUS_STATE_DIR = tmpDir;
process.env.SMCE_DATA_DIR = path.join(tmpDir, 'smce');
process.env.ASPE_DATA_DIR = path.join(tmpDir, 'aspe');
process.env.CEGE_DATA_DIR = path.join(tmpDir, 'cege');
process.env.COMMERCE_DATA_DIR = path.join(tmpDir, 'commerce');

async function run() {
  // 1. Validate 30/30 manifests & zero-cycle DAG including autonomous-m2m-commerce-engine
  const { validateAllManifests } = require('../backend/modules/validate_manifests');
  const manifestResults = validateAllManifests();
  const invalid = manifestResults.filter((r) => !r.valid);
  assert.strictEqual(invalid.length, 0, 'Invalid manifests: ' + JSON.stringify(invalid));
  assert.ok(manifestResults.length >= 30, 'Expected >= 30 valid manifests, got ' + manifestResults.length);

  const { discoverModules, buildDependencyGraph, topologicalSort } = require('../backend/modules/orchestrator/discovery');
  const graph = buildDependencyGraph(discoverModules());
  assert.strictEqual(graph.cycles.length, 0, 'Dependency graph must remain cycle-free');
  const topoNames = topologicalSort(graph).map((m) => (typeof m === 'string' ? m : m.name));
  assert.ok(topoNames.includes('autonomous-m2m-commerce-engine'), 'DAG must include Module #30 SMCE/1.0');
  console.log('PASS [1/6] All ' + manifestResults.length + ' manifests valid & cycle-free DAG');

  // 2. SMCE/1.0 Autonomous Margin-Protected Deal Negotiation + Ed25519 Signature Verification
  const smce = require('../backend/modules/autonomous-m2m-commerce-engine');
  const deal = smce.negotiateAutonomousDeal({
    serviceIds: ['instant-website-audit', 'instant-seo-content-pack', 'instant-email-sequence'],
    budgetUsd: 50, // Deliberately below sovereign floor -> must trigger FLOOR_MARGIN_COUNTER_OFFER
    rail: 'btc',
    referralCode: 'zeus_1234567890',
    domain: 'enterprise-client.io',
  });
  assert.strictEqual(deal.ok, true);
  assert.strictEqual(deal.payload.protocol, 'SMCE/1.0');
  assert.strictEqual(deal.payload.itemCount, 3);
  assert.strictEqual(deal.payload.pricing.bundleDiscountPct, 20);
  assert.strictEqual(deal.payload.negotiationVerdict, 'FLOOR_MARGIN_COUNTER_OFFER');
  assert.ok(deal.payload.pricing.btcTotalUsd >= deal.payload.pricing.floorPriceUsd, 'Must enforce sovereign floor margin');
  assert.ok(deal.payload.checkoutUrls.btc.includes('&add='), 'Checkout URL must include bundled items');

  const ver = smce.verifySignedArtifact({
    payload: deal.payload,
    payloadHash: deal.attestation.payloadHash,
    signature: deal.attestation.signature,
    publicKeyBase64: deal.attestation.publicKeyBase64,
  });
  assert.strictEqual(ver.ok, true);
  assert.strictEqual(ver.valid, true, 'Ed25519 deal signature MUST verify');

  // Tamper test: mutating price must invalidate Ed25519 signature
  const tampered = JSON.parse(JSON.stringify(deal.payload));
  tampered.pricing.btcTotalUsd = 1;
  const verBad = smce.verifySignedArtifact({
    payload: tampered,
    payloadHash: deal.attestation.payloadHash,
    signature: deal.attestation.signature,
    publicKeyBase64: deal.attestation.publicKeyBase64,
  });
  assert.strictEqual(verBad.valid, false, 'Tampered payload must fail Ed25519 verification');
  console.log('PASS [2/6] SMCE/1.0 floor-margin negotiation & Ed25519 tamper-proof verification');

  // 3. True HTTP 402 Payment Required Paywall -> Paid Authenticated Execution (HTTP 200 + Ed25519 Proof)
  const challenge = await smce.executeX402OrChallenge({
    serviceId: 'instant-website-audit',
    bundleIds: ['instant-website-audit', 'instant-seo-content-pack'],
  });
  assert.strictEqual(challenge.httpStatus, 402, 'Unpaid execution MUST return HTTP 402 Payment Required');
  assert.ok(challenge.headers['X-Payment-Required'].includes('protocol=SMCE/1.0'));
  assert.strictEqual(challenge.body.error, 'payment_required');

  const aspe = require('../backend/modules/autonomous-service-provisioning');
  const paidOrderId = 'ord_x402_' + crypto.randomBytes(4).toString('hex');
  const paidToken = 'tok_x402_' + crypto.randomBytes(8).toString('hex');
  const act = aspe.activatePaidService({
    orderId: paidOrderId,
    serviceId: 'instant-website-audit',
    bundleIds: ['instant-website-audit', 'instant-seo-content-pack'],
    email: 'agent-buyer@example.com',
    accessToken: paidToken,
    amountUsd: 97.92,
  });
  assert.strictEqual(act.ok, true);
  assert.ok(Array.isArray(act.instance.bundledServiceIds) && act.instance.bundledServiceIds.length === 2, 'ASPE must merge bundled services');

  const paidExec = await smce.executeX402OrChallenge({
    orderId: paidOrderId,
    accessToken: paidToken,
    inputs: { domain: 'example.com' },
  });
  assert.strictEqual(paidExec.httpStatus, 200, 'Authenticated paid execution MUST return HTTP 200');
  assert.strictEqual(paidExec.body.ok, true);
  assert.strictEqual(paidExec.body.paid, true);
  assert.strictEqual(paidExec.body.attestation.algorithm, 'Ed25519');
  const execVer = smce.verifySignedArtifact({
    payload: paidExec.body.execution,
    payloadHash: paidExec.body.attestation.payloadHash,
    signature: paidExec.body.attestation.signature,
    publicKeyBase64: paidExec.body.attestation.publicKeyBase64,
  });
  assert.strictEqual(execVer.valid, true, 'Ed25519 Execution Outcome Certificate MUST verify');
  console.log('PASS [3/6] HTTP 402 paywall -> verified paid multi-service execution + Ed25519 proof');

  // 4. Server-Side Multi-Item Bundle Checkout in sovereign-commerce.js
  const commerce = require('../src/site/sovereign-commerce');
  const shelf = require('../src/commerce/public-shelf');
  const unified = require('../src/commerce/unified-catalog');
  const ctx = {
    buildSnapshot: () => ({ services: unified.all(), marketplace: [] }),
    resolveCatalogItem: (id) => shelf.byId(id) || unified.all().find((x) => x.id === id) || null,
    canonicalUsd: (id) => {
      const s = shelf.byId(id);
      return s && Number(s.priceUSD || s.priceUsd || s.price) > 0 ? Number(s.priceUSD || s.priceUsd || s.price) : null;
    },
  };
  const bundleOrderRes = await commerce.createOrder(ctx, {
    serviceId: 'instant-website-audit',
    bundleIds: ['instant-website-audit', 'instant-seo-content-pack'],
    currency: 'USD',
    rail: 'btc',
  });
  assert.ok(bundleOrderRes && bundleOrderRes.order, 'Server-side multi-item bundle order must succeed');
  const bo = bundleOrderRes.order;
  assert.deepStrictEqual(bo.bundleIds, ['instant-website-audit', 'instant-seo-content-pack']);
  assert.strictEqual(bo.bundle.discountPct, 15);
  assert.strictEqual(bo.bundle.listTotalUsd, 128);
  assert.strictEqual(bo.bundle.discountedUsd, 108.8);
  assert.strictEqual(bo.subtotal_fiat, 97.92, 'BTC rail must stack -10% on top of -15% bundle ($108.80 * 0.9 = $97.92)');
  console.log('PASS [4/6] Server-side multi-item bundle invoice math verified ($128 -> $108.80 -> $97.92 BTC)');

  // 5. NSC/1.0 Parallel Dual-Family Council of Minds Synthesis & Arbitration
  const nsc = require('../backend/modules/neural-swarm-llm-cascade');
  const council = await nsc.runCouncilSynthesis('Design an autonomous multi-agent commerce architecture', {
    dryRunCandidates: [
      { provider: 'groq', family: 'groq-lpu', model: 'openai/gpt-oss-120b', latencyMs: 180, content: 'Short generic reply.' },
      {
        provider: 'openrouter',
        family: 'openrouter-frontier',
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        latencyMs: 420,
        content: '## Sovereign M2M Architecture\n\n1. Expose HTTP 402 Payment Required at /api/x402/execute with Ed25519-signed quotes.\n2. Enforce a 65% floor margin across multi-item bundles (-15% / -20%) plus direct Bitcoin on-chain settlement (-10%).\n3. Provision isolated ASPE/1.0 workspaces immediately upon settlement and record quality outcomes in CEGE/1.0 for continuous UCB1 strategy optimization.',
      },
    ],
  });
  assert.strictEqual(council.ok, true);
  assert.strictEqual(council.mode, 'council');
  assert.strictEqual(council.provider, 'openrouter', 'Council arbiter MUST select the higher 5-pillar quality candidate');
  assert.strictEqual(council.councilScoreboard.length, 2);
  console.log('PASS [5/6] NSC/1.0 Dual-Family Council of Minds 5-pillar arbitration verified');

  // 6. UMAP/1.0 17 Live MCP Tools + 10 Resources + v1.3.1 Server Card + UMAS/1.0 Full-Fleet Atlas + Omniscient Chatbot SMCE Deal Closing
  const umap = require('../backend/modules/universal-mcp-a2a-mesh');
  const toolsList = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 10, method: 'tools/list' });
  assert.ok(toolsList.body.result.tools.length >= 17, 'Expected >= 17 MCP tools, got ' + toolsList.body.result.tools.length);
  const resList = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 11, method: 'resources/list' });
  assert.ok(resList.body.result.resources.length >= 10, 'Expected >= 10 MCP resources');
  assert.strictEqual(umap.getServerCard().version, '1.4.0');

  const negTool = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 12,
    method: 'tools/call',
    params: { name: 'zeus_negotiate_deal', arguments: { serviceIds: ['instant-website-audit', 'instant-seo-content-pack'] } },
  });
  assert.strictEqual(negTool.body.result.isError, false);
  assert.strictEqual(negTool.body.result.structuredContent.payload.protocol, 'SMCE/1.0');

  // Verify UMAS/1.0 Universal Full-Fleet Module Atlas via MCP & AOSO/1.0
  const atlasTool = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 13,
    method: 'tools/call',
    params: { name: 'zeus_unicorn_module_atlas', arguments: {} },
  });
  assert.strictEqual(atlasTool.body.result.isError, false);
  const atlasData = atlasTool.body.result.structuredContent;
  assert.strictEqual(atlasData.protocol, 'UMAS/1.0');
  assert.ok(atlasData.totals.totalModulesIndexed >= 850, 'Atlas must cover ALL 850+ Unicorn modules, got ' + atlasData.totals.totalModulesIndexed);
  assert.strictEqual(atlasData.totals.brokenAliases, 0, 'Zero broken aliases expected');
  assert.strictEqual(atlasData.totals.coveragePct, 100);

  // Verify AOSO/1.0 manifest includes universalModuleFleet + per-organ fleetModulesCovered
  const aoso = require('../backend/modules/autonomous-organism-orchestrator');
  const orgManifest = aoso.getOrganismManifest();
  assert.ok(orgManifest.payload.universalModuleFleet && orgManifest.payload.universalModuleFleet.totals.totalModulesIndexed >= 850);
  assert.ok(orgManifest.payload.specialistAgents.every((a) => typeof a.fleetModulesCovered === 'number' && a.fleetModulesCovered > 0));

  // Verify ASPE/1.0 executes real modules dynamically (not generic stub)
  const execResults = paidExec.body.execution.results || [];
  const dynamicInvoked = execResults.filter((r) => r && r.output && r.output.realModuleInvoked === true);
  assert.ok(dynamicInvoked.length >= 1, 'ASPE must dynamically invoke real modules beyond hardcoded 6');

  const brain = require('../backend/modules/omniscient-chatbot');
  const km = brain.getKnowledgeMap();
  assert.ok(km.modulesCount >= 850, 'Omniscient Chatbot must index ALL 850+ Unicorn modules, got ' + km.modulesCount);
  const chatDeal = await brain.answer({ message: 'Vreau un pachet bundle cu discount si pret bun pentru site-ul meu acme.io' });
  assert.strictEqual(chatDeal.ok, true);
  assert.ok(chatDeal.smceNegotiation && chatDeal.smceNegotiation.ok, 'Chatbot must attach SMCE/1.0 signed bundle deal');
  console.log('PASS [6/6] UMAP/1.0 17 MCP tools, 10 resources, v1.3.1, UMAS/1.0 (' + atlasData.totals.totalModulesIndexed + ' modules), ASPE dynamic exec & Chatbot SMCE');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('ALL SMCE/1.0 + COUNCIL + SERVER-SIDE BUNDLE TESTS PASSED ✓');
  process.exit(0);
}

run().catch((err) => {
  console.error('FAIL smce-x402-council-and-bundles.test.js:', err);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  process.exit(1);
});
