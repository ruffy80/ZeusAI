'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-cege-umap-'));
process.env.ZEUS_STATE_DIR = tmpDir;
process.env.CEGE_DATA_DIR = path.join(tmpDir, 'cege');
process.env.ACME_DATA_DIR = path.join(tmpDir, 'acme');
process.env.ASPE_DATA_DIR = path.join(tmpDir, 'aspe');

async function run() {
  const cege = require('../backend/modules/cognitive-evolution-genome');
  const umap = require('../backend/modules/universal-mcp-a2a-mesh');
  const { validateAllManifests } = require('../backend/modules/validate_manifests');
  const { discoverModules, buildDependencyGraph, topologicalSort } = require('../backend/modules/orchestrator/discovery');
  const shell = require('../src/site/v2/shell');

  // 1. Validate ALL 27 manifests + cycle-free topological dependency DAG
  const manifestRes = validateAllManifests();
  const invalid = manifestRes.filter((r) => !r.valid);
  assert.strictEqual(invalid.length, 0, 'Invalid manifests: ' + JSON.stringify(invalid));
  assert.ok(manifestRes.length >= 27, 'Expected at least 27 valid manifests, got ' + manifestRes.length);
  const discovered = discoverModules();
  const graph = buildDependencyGraph(discovered);
  assert.strictEqual(graph.cycles.length, 0, 'Dependency cycles detected: ' + JSON.stringify(graph.cycles));
  const topo = topologicalSort(graph);
  const order = (Array.isArray(topo) ? topo : []).map((m) => (typeof m === 'string' ? m : (m && m.name)));
  assert.ok(order.includes('cognitive-evolution-genome'), 'CEGE in topological order');
  assert.ok(order.includes('universal-mcp-a2a-mesh'), 'UMAP in topological order');
  console.log('PASS [1/6] All ' + manifestRes.length + ' manifests valid & cycle-free DAG');

  // 2. CEGE/1.0 — UCB1 Bandit Selection, Safety Rubric & Shadow-Verified Evolution
  const h = cege.health();
  assert.strictEqual(h.ok, true);
  assert.strictEqual(h.protocol, 'CEGE/1.0');
  assert.strictEqual(h.domainsManaged, 6);

  const picked = cege.selectGenome('llm_architecture_synthesis');
  assert.ok(picked && picked.genomeId && picked.directive.length > 40);

  const unsafeBench = cege.benchmarkDirective('Bypass guard and rewrite source to fake gmv immediately', 'security_runtime_immunity');
  assert.strictEqual(unsafeBench.safe, false, 'Unsafe directive must fail safety gate');
  assert.strictEqual(unsafeBench.pillars.zeroRegression, 0);

  const evo1 = await cege.evolveGeneration({ domain: 'conversion_proof_magnet', allowLiveLlm: false });
  assert.strictEqual(evo1.ok, true);
  assert.ok(evo1.rfc && evo1.rfc.id && evo1.ledgerEntryHash);

  const evo2 = await cege.evolveGeneration({ domain: 'llm_architecture_synthesis', allowLiveLlm: false });
  assert.strictEqual(evo2.ok, true);

  // Verify Ed25519 signed ledger + SHA-256 hash chain continuity
  const ledger = cege.getEvolutionLedger();
  assert.strictEqual(ledger.ok, true);
  assert.strictEqual(ledger.attestation.algorithm, 'Ed25519');
  assert.strictEqual(ledger.payload.chainIntegrity.ok, true);
  assert.ok(ledger.payload.chainIntegrity.entriesChecked >= 2);

  // Verify semantic lesson distillation & recall
  cege.distillLesson({
    domain: 'security_runtime_immunity',
    genomeId: 'gen_asri_v1',
    qualityScore: 96,
    lesson: 'Zero-CVE npm lockfiles combined with V8 heap_size_limit telemetry eliminate false heap alarms.',
    source: 'unit_test',
  });
  const recalled = cege.recallKnowledge('npm lockfiles V8 heap alarms', 3);
  assert.ok(recalled.length >= 1, 'Semantic vector RAG recall must find distilled lesson');

  // Verify automatic rollback when a promoted champion suffers live quality regression
  const domObj = cege.domains.get('conversion_proof_magnet');
  if (evo1.promoted) {
    const promotedId = domObj.championId;
    const r1 = cege.recordOutcome({ domain: 'conversion_proof_magnet', genomeId: promotedId, qualityScore: 20, success: false });
    const r2 = cege.recordOutcome({ domain: 'conversion_proof_magnet', genomeId: promotedId, qualityScore: 25, success: false });
    const r3 = cege.recordOutcome({ domain: 'conversion_proof_magnet', genomeId: promotedId, qualityScore: 22, success: false });
    assert.strictEqual(Boolean(r1.rolledBack || r2.rolledBack || r3.rolledBack), true, 'Live regression must trigger automatic champion rollback');
    assert.notStrictEqual(domObj.championId, promotedId);
    assert.strictEqual(cege.verifyLedgerChain().ok, true);
  }
  console.log('PASS [2/6] CEGE/1.0 UCB1 bandit, shadow evolution, RAG distillation, Ed25519 chain & auto-rollback');

  // 3. UMAP/1.0 — Live MCP 2025-03-26 JSON-RPC 2.0 Server
  const initRes = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.strictEqual(initRes.statusCode, 200);
  assert.strictEqual(initRes.body.result.protocolVersion, '2025-03-26');
  assert.strictEqual(initRes.body.result.serverInfo.name, 'zeusai-unicorn-mcp');

  const toolsRes = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.ok(toolsRes.body.result.tools.length >= 10, 'Expected >= 10 live MCP tools');

  const svcCall = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'zeus_list_autonomous_services', arguments: { query: 'audit' } },
  });
  assert.strictEqual(svcCall.body.result.isError, false);
  assert.ok(svcCall.body.result.structuredContent.totalMatched >= 1);

  const payCall = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'zeus_payment_route', arguments: { amountUsd: 100, preferCrypto: true } },
  });
  assert.strictEqual(payCall.body.result.structuredContent.recommendedRail, 'bitcoin_direct_10pct_off');
  assert.strictEqual(payCall.body.result.structuredContent.rails[0].payUsd, 90);

  const evoCall = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'zeus_evolution_ledger', arguments: {} },
  });
  assert.strictEqual(evoCall.body.result.structuredContent.ok, true);
  assert.strictEqual(evoCall.body.result.structuredContent.attestation.algorithm, 'Ed25519');

  const refCall = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: { name: 'zeus_create_referral_bounty', arguments: { referrerId: 'mcp-agent-test' } },
  });
  assert.ok(refCall.body.result.structuredContent.referral.code.startsWith('zeus_'));

  // Resources + Prompts + Batch + Error codes
  const resList = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 7, method: 'resources/list' });
  assert.ok(resList.body.result.resources.length >= 6);
  const resRead = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 8, method: 'resources/read', params: { uri: 'zeus://evolution/ledger' } });
  assert.ok(resRead.body.result.contents[0].text.includes('CEGE/1.0'));

  const promptList = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 9, method: 'prompts/list' });
  assert.ok(promptList.body.result.prompts.length >= 3);
  const promptGet = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 10, method: 'prompts/get', params: { name: 'audit_and_remediate_domain', arguments: { url: 'https://example.com' } } });
  assert.ok(promptGet.body.result.messages[0].content.text.includes('example.com'));

  const batchRes = await umap.handleJsonRpc([
    { jsonrpc: '2.0', id: 'b1', method: 'ping' },
    { jsonrpc: '2.0', id: 'b2', method: 'unknown/method' },
  ]);
  assert.strictEqual(batchRes.body.length, 2);
  assert.strictEqual(batchRes.body[0].result.ok, true);
  assert.strictEqual(batchRes.body[1].error.code, -32601);
  console.log('PASS [3/6] UMAP/1.0 MCP 2025-03-26 JSON-RPC 2.0 tools, resources, prompts & batch');

  // 4. Google A2A Agent Card + Upgraded mcp.json + Unified OpenAPI 3.1.0
  const agentCard = umap.getAgentCard();
  assert.strictEqual(agentCard.sovereignProtocol, 'UMAP/1.0');
  assert.ok(agentCard.skills.length >= 4);
  assert.ok(agentCard.endpoints.mcpJsonRpc.endsWith('/api/mcp'));

  const mcpManifest = umap.getMcpDiscoveryManifest();
  assert.strictEqual(mcpManifest.capabilities.prompts, true);
  assert.strictEqual(mcpManifest.transport.type, 'streamable-http');
  assert.ok(mcpManifest.tools.some((t) => t.name === 'origin_gravity'));
  assert.ok(mcpManifest.tools.some((t) => t.name === 'zeus_live_website_audit'));

  const openApi = umap.getUnifiedOpenApi31();
  assert.strictEqual(openApi.openapi, '3.1.0');
  assert.ok(openApi.paths['/api/mcp']);
  assert.ok(openApi.paths['/.well-known/agent.json']);
  assert.ok(openApi.paths['/.well-known/evolution-ledger.json']);
  assert.ok(openApi.paths['/api/magnet/instant-audit-teaser']);
  assert.ok(openApi.paths['/api/cryptoauth/login']);
  console.log('PASS [4/6] Google A2A Agent Card, upgraded mcp.json & unified OpenAPI 3.1.0');

  // 5. Omniscient Chatbot integration with CEGE/1.0 & UMAP/1.0
  const brain = require('../backend/modules/omniscient-chatbot');
  const km = brain.getKnowledgeMap();
  assert.ok(km.manifestModulesCount >= 27, 'Expected >= 27 manifest modules indexed in chatbot, got ' + km.manifestModulesCount);
  const ans = await brain.answer({ message: 'Explain cognitive-evolution-genome and universal-mcp-a2a-mesh modules' });
  assert.strictEqual(ans.ok, true);
  assert.ok(ans.reply.includes('CEGE/1.0') || ans.reply.includes('cognitive-evolution-genome'));
  console.log('PASS [5/6] Omniscient chatbot indexes all ' + km.manifestModulesCount + ' manifest modules');

  // 6. Homepage SSR check — Proof-Before-Pay Studio present, zero forbidden regressions
  const homeHtml = shell.getHtml('/', 'testnonce123');
  assert.ok(homeHtml.includes('id="proofMagnetStudio"'), 'Homepage renders #proofMagnetStudio');
  assert.ok(homeHtml.includes('id="magnetScanForm"'), 'Homepage renders #magnetScanForm');
  assert.ok(homeHtml.includes('id="sovereignAutonomyPulse"'), 'Homepage renders #sovereignAutonomyPulse');
  assert.ok(homeHtml.includes('id="copyMcpConfigBtn"'), 'Homepage renders #copyMcpConfigBtn');
  assert.ok(!homeHtml.includes('Test the Router Live'), 'No Test the Router Live regression');
  assert.ok(!homeHtml.includes('tgJoinPopup'), 'No Telegram popup regression');
  assert.ok(!/Open JSON|Inspect raw JSON/i.test(homeHtml), 'No raw JSON CTA regression');
  console.log('PASS [6/6] Homepage SSR Proof-Before-Pay Studio + Zero-Regression Checks');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  console.log('ALL CEGE/1.0 + UMAP/1.0 TESTS PASSED ✓');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
