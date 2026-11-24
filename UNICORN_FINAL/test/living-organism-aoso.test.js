'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-aoso-test-'));
process.env.ZEUS_STATE_DIR = tmpDir;
process.env.AOSO_DATA_DIR = path.join(tmpDir, 'organism');
process.env.ASPE_DATA_DIR = path.join(tmpDir, 'aspe');
process.env.CEGE_DATA_DIR = path.join(tmpDir, 'cege');

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

async function run() {
  // 1. Validate 29/29 manifests + acyclic DAG including autonomous-organism-orchestrator
  const { validateAllManifests } = require('../backend/modules/validate_manifests');
  const res = validateAllManifests();
  const invalid = res.filter((r) => !r.valid);
  assert.strictEqual(invalid.length, 0, 'All manifests must be valid: ' + JSON.stringify(invalid));
  assert.ok(res.length >= 29, 'Expected at least 29 valid manifests, got ' + res.length);

  const { discoverModules, buildDependencyGraph, topologicalSort } = require('../backend/modules/orchestrator/discovery');
  const graph = buildDependencyGraph(discoverModules());
  assert.strictEqual(graph.cycles.length, 0, 'Zero dependency cycles expected');
  const topo = topologicalSort(graph);
  const topoNames = topo.map((m) => (typeof m === 'string' ? m : m.name));
  assert.ok(topoNames.includes('autonomous-organism-orchestrator'), 'DAG topological sort must include autonomous-organism-orchestrator');

  // 2. Test AOSO/1.0 6-Agent Organism Heartbeat, Red-Team, Bundle Quoter & Ed25519 Manifest
  const aoso = require('../backend/modules/autonomous-organism-orchestrator');
  const beat = await aoso.runOrganismHeartbeat();
  assert.strictEqual(beat.ok, true);
  assert.strictEqual(beat.protocol, 'AOSO/1.0');
  assert.strictEqual(beat.organs.length, 6, 'Must coordinate all 6 specialist agents');
  const agentNames = beat.organs.map((o) => o.agent);
  [
    'FirstDollarGrowthAgent',
    'CroFunnelSurgeonAgent',
    'FulfillmentExcellenceAgent',
    'RedTeamPaymentSecurityAgent',
    'SrePerformanceGuardianAgent',
    'GitNativeEvolutionDirectorAgent',
  ].forEach((expected) => {
    assert.ok(agentNames.includes(expected), 'Missing specialist agent: ' + expected);
  });
  assert.ok(beat.homeostasisScore >= 70 && beat.homeostasisScore <= 100, 'Homeostasis score must be in 70..100, got ' + beat.homeostasisScore);

  const redTeam = aoso.runRedTeamAudit();
  assert.strictEqual(redTeam.agent, 'RedTeamPaymentSecurityAgent');
  assert.ok(Array.isArray(redTeam.checks) && redTeam.checks.length >= 7, 'Red-team must check >= 7 security invariants');
  const failedChecks = redTeam.checks.filter((c) => !c.pass);
  assert.strictEqual(failedChecks.length, 0, 'All 7 security invariants must pass locally: ' + JSON.stringify(failedChecks));
  assert.strictEqual(redTeam.score, 100, 'Red-team security score must be 100/100');

  const manifest = aoso.getOrganismManifest();
  assert.strictEqual(manifest.ok, true);
  assert.strictEqual(manifest.payload.protocol, 'AOSO/1.0');
  assert.strictEqual(manifest.payload.inventsMetrics, false);
  assert.strictEqual(manifest.payload.mutatesSourceDirectly, false);
  assert.strictEqual(manifest.payload.reflexArcsArmed.length, 5);
  assert.strictEqual(manifest.attestation.algorithm, 'Ed25519');
  // Cryptographically verify Ed25519 signature
  const pubKey = crypto.createPublicKey({
    key: Buffer.from(manifest.attestation.publicKeyBase64, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const signedBytes = Buffer.from(canonicalJson({
    payloadHash: manifest.attestation.payloadHash,
    payload: manifest.payload,
  }), 'utf8');
  const sigValid = crypto.verify(
    null,
    signedBytes,
    pubKey,
    Buffer.from(manifest.attestation.signature, 'base64')
  );
  assert.strictEqual(sigValid, true, 'Ed25519 signature on Living Organism manifest MUST verify');

  const dirPack = aoso.getMcpDirectoryPack();
  assert.strictEqual(dirPack.ok, true);
  assert.ok(Array.isArray(dirPack.directories) && dirPack.directories.length >= 3);

  // Multi-item bundle pricing: 15% for 2 items, 20% for 3+ items, +10% BTC
  const q2 = aoso.quoteMultiItemBundle(['instant-website-audit', 'instant-seo-content-pack']);
  assert.strictEqual(q2.ok, true);
  assert.strictEqual(q2.itemCount, 2);
  assert.strictEqual(q2.bundleDiscountPct, 15);
  assert.ok(q2.bundlePriceUsd < q2.listTotalUsd, 'Bundle price must be below list total');
  assert.ok(q2.btcPriceUsd < q2.bundlePriceUsd, 'BTC bundle price must apply extra 10% savings');
  assert.ok(q2.checkoutUrl.includes('&add='), 'Bundle checkout URL must preserve primary + added items');

  const q3 = aoso.quoteMultiItemBundle([
    'instant-website-audit',
    'instant-seo-content-pack',
    'instant-email-sequence',
  ]);
  assert.strictEqual(q3.ok, true);
  assert.strictEqual(q3.itemCount, 3);
  assert.strictEqual(q3.bundleDiscountPct, 20);
  assert.ok(q3.bundleSavingsUsd > 0 && q3.btcCombinedSavingsUsd > q3.bundleSavingsUsd);

  // 3. Test ASPE/1.0 Token Authentication & Public Redaction
  const aspe = require('../backend/modules/autonomous-service-provisioning');
  const orderId = 'ord_aoso_auth_' + crypto.randomBytes(4).toString('hex');
  const secretToken = 'tok_secret_' + crypto.randomBytes(8).toString('hex');
  const activated = await aspe.activatePaidService({
    orderId,
    serviceId: 'instant-website-audit',
    email: 'client-private@example.com',
    amountUsd: 19,
    accessToken: secretToken,
    context: { domain: 'example.com', objective: 'SEO + AEO audit' },
  });
  assert.strictEqual(activated.ok, true);
  assert.ok(activated.instance && activated.instance.orderAccessTokenHash, 'Must hash accessToken on activation');
  assert.strictEqual(aspe.verifyInstanceAccess(orderId, secretToken).ok, true, 'Valid order access token must pass');
  assert.strictEqual(aspe.verifyInstanceAccess(orderId, 'wrong-token').ok, false, 'Wrong token must be rejected');
  assert.strictEqual(aspe.verifyInstanceAccess(orderId, '').ok, false, 'Missing token must be rejected');
  assert.strictEqual(aspe.verifyInstanceAccess(orderId, activated.apiKeyPlaintextOnce).ok, true, 'Scoped ASPE API key must pass');

  const redacted = aspe.redactInstanceForPublic(activated.instance);
  assert.ok(redacted && !String(redacted.email || '').includes('client-private'), 'Public redacted instance must hide full email');
  assert.ok(String(redacted.email || '').includes('***@'), 'Public redacted instance must mask email');
  assert.strictEqual(redacted.orderAccessTokenHash, undefined, 'Public redacted instance must strip token hash');
  assert.strictEqual(redacted.apiKeyHash, undefined, 'Public redacted instance must strip API key hash');

  // 4. Test UMAP/1.0 MCP JSON-RPC 2.0 (13 tools, 8 resources, OpenAPI 3.1)
  const umap = require('../backend/modules/universal-mcp-a2a-mesh');
  const toolsResp = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.strictEqual(toolsResp.statusCode, 200);
  assert.ok(toolsResp.body.result.tools.length >= 13, 'Expected >= 13 MCP tools, got ' + toolsResp.body.result.tools.length);

  const resResp = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
  assert.ok(resResp.body.result.resources.length >= 8, 'Expected >= 8 MCP resources');

  const orgToolResp = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'zeus_living_organism', arguments: { includeRedTeam: true } },
  });
  assert.strictEqual(orgToolResp.body.result.isError, false);
  assert.strictEqual(orgToolResp.body.result.structuredContent.payload.protocol, 'AOSO/1.0');
  assert.strictEqual(orgToolResp.body.result.structuredContent.attestation.algorithm, 'Ed25519');

  const bundleToolResp = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'zeus_bundle_quote',
      arguments: { serviceIds: ['instant-website-audit', 'instant-seo-content-pack'] },
    },
  });
  assert.strictEqual(bundleToolResp.body.result.isError, false);
  assert.strictEqual(bundleToolResp.body.result.structuredContent.bundleDiscountPct, 15);

  const openapi = umap.getUnifiedOpenApi31();
  assert.ok(openapi.paths['/.well-known/living-organism.json'], 'OpenAPI must document /.well-known/living-organism.json');
  assert.ok(openapi.paths['/api/bundles/quote'], 'OpenAPI must document /api/bundles/quote');
  assert.ok(openapi.paths['/.well-known/treasury-autonomy.json'], 'OpenAPI must document /.well-known/treasury-autonomy.json');

  const card = umap.getAgentCard();
  assert.ok(card.endpoints.livingOrganism.endsWith('/.well-known/living-organism.json'));
  assert.ok(card.endpoints.mcpServerCard.endsWith('/.well-known/mcp/server-card.json'));

  const serverCard = umap.getServerCard();
  assert.strictEqual(serverCard.name, 'io.github.ruffy80/zeusai-unicorn-mcp');
  assert.strictEqual(serverCard.remotes[0].type, 'streamable-http');
  assert.ok(serverCard.description.length <= 100, 'MCP Registry schema caps description at 100 chars');

  const aiCatalog = umap.getAiCatalog();
  assert.ok(Array.isArray(aiCatalog.mcpServers) && aiCatalog.mcpServers.length >= 1);
  const aiPlugin = umap.getAiPluginManifest();
  assert.strictEqual(aiPlugin.schema_version, 'v1');

  // Verify root Official MCP Registry server.json & glama.json
  const repoRoot = path.resolve(__dirname, '..', '..');
  const rootServerJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'server.json'), 'utf8'));
  assert.strictEqual(rootServerJson.name, 'io.github.ruffy80/zeusai-unicorn-mcp');
  assert.ok(rootServerJson.description.length <= 100);
  assert.strictEqual(rootServerJson.remotes[0].type, 'streamable-http');
  const rootGlamaJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'glama.json'), 'utf8'));
  assert.ok(Array.isArray(rootGlamaJson.maintainers) && rootGlamaJson.maintainers.includes('ruffy80'));

  // Verify live SVG Proof-Before-Pay badge (XSS-safe) & Growth Agent real SAGS capsule count
  const acme = require('../backend/modules/autonomous-client-magnet');
  const svg = acme.renderAuditBadgeSvg('example.com<script>alert(1)</script>');
  assert.ok(svg.startsWith('<svg ') && svg.includes('ZeusAI Audit') && !svg.includes('<script>'), 'SVG badge must be valid and XSS-safe');

  const growthAgent = aoso.runGrowthAgent();
  assert.ok(growthAgent.metrics.seoAeoGeoCapsules >= 100, 'Growth agent must read real SAGS AEO+GEO capsules (>=100), got ' + growthAgent.metrics.seoAeoGeoCapsules);
  assert.strictEqual(growthAgent.score, 100, 'Growth agent score should reach 100/100 with Server Card + SVG Badge + SAGS + MCP');

  const distRes = await aoso.triggerAutonomousDistribution();
  assert.strictEqual(distRes.ok, true);
  assert.ok(distRes.indexNowAndWebSub && Array.isArray(distRes.indexNowAndWebSub.engines));
  const engNames = distRes.indexNowAndWebSub.engines.map((e) => e.engine);
  assert.ok(engNames.includes('seznam') && engNames.includes('naver') && engNames.includes('yep') && engNames.includes('websub'));

  // 5. Verify Homepage SSR renders 30 modules + 16 MCP tools with zero forbidden strings
  const shell = require('../src/site/v2/shell');
  const html = shell.getHtml('/');
  assert.ok(html.includes('30 sovereign modules'), 'Homepage must show 30 sovereign modules');
  assert.ok(html.includes('16 Live Tools'), 'Homepage must show 16 Live Tools');
  assert.ok(html.includes('proofMagnetStudio'), 'Homepage must keep Proof-Before-Pay studio');
  assert.ok(!html.includes('Test the Router Live'), 'Must never reintroduce Test the Router Live');
  assert.ok(!html.includes('tgJoinPopup'), 'Must never reintroduce Telegram popup');
  assert.ok(!html.includes('Open JSON'), 'Must never show raw Open JSON CTAs');

  // Cleanup temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('PASS living-organism-aoso.test.js (29/29 manifests, 6 agents, Ed25519 verified, ASPE auth, 13 MCP tools, bundle quote, SSR clean)');
}

run().catch((err) => {
  console.error('FAIL living-organism-aoso.test.js:', err);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  process.exit(1);
});
