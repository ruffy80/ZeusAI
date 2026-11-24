'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-arre-test-'));
process.env.ZEUS_STATE_DIR = tmpDir;
process.env.ARRE_DATA_DIR = path.join(tmpDir, 'arre');
process.env.SMCE_DATA_DIR = path.join(tmpDir, 'smce');

async function run() {
  // 1. Validate 31/31 manifests & zero-cycle DAG including ARRE/1.0
  const { validateAllManifests } = require('../backend/modules/validate_manifests');
  const mRes = validateAllManifests();
  const invalid = mRes.filter((r) => !r.valid);
  assert.strictEqual(invalid.length, 0, 'All 31 manifests must be valid: ' + JSON.stringify(invalid));
  assert.ok(mRes.length >= 31, 'Expected >= 31 manifests, got ' + mRes.length);

  const { discoverModules, buildDependencyGraph, topologicalSort } = require('../backend/modules/orchestrator/discovery');
  const graph = buildDependencyGraph(discoverModules());
  assert.strictEqual(graph.cycles.length, 0);
  const topo = topologicalSort(graph).map((m) => (typeof m === 'string' ? m : m.name));
  assert.ok(topo.includes('autonomous-recurring-revenue-engine'), 'DAG must include Module #31 ARRE/1.0');
  console.log('PASS [1/6] All ' + mRes.length + ' manifests valid & cycle-free DAG');

  // 2. Universal Solution Finder (Everyday Humans + All 18 World Industries)
  const arre = require('../backend/modules/autonomous-recurring-revenue-engine');
  const career = arre.recommendUniversalSolution({ persona: 'individual_career' });
  assert.strictEqual(career.ok, true);
  assert.strictEqual(career.primaryServiceId, 'instant-resume-makeover');
  assert.ok(career.bundleOffer && career.bundleOffer.pricing.btcTotalUsd > 0);
  assert.strictEqual(career.allSupportedIndustries.length, 18);

  const fintech = arre.recommendUniversalSolution({ industry: 'fintech', goal: 'enterprise compliance' });
  assert.strictEqual(fintech.ok, true);
  assert.strictEqual(fintech.verticalOsId, 'fintech-os');
  assert.ok(fintech.verticalOsUrl.endsWith('/services/fintech-os'));
  console.log('PASS [2/6] Universal Solution Finder verified (6 personas + 18 world industries)');

  // 3. Weekly Client Drift Watch + Ed25519 Differential Proof
  const reg = arre.registerDriftWatch({ domain: 'example.com', email: 'owner@example.com', cadenceDays: 7 });
  assert.strictEqual(reg.ok, true);
  const cycle = await arre.runDriftWatchCycle(reg.watch.watchId, {
    dryRunHtml: '<html><head><title>Example</title></head><body><h1>Hello</h1></body></html>',
  });
  assert.strictEqual(cycle.ok, true);
  assert.strictEqual(cycle.attestation.algorithm, 'Ed25519');
  assert.strictEqual(cycle.report.domain, 'example.com');
  console.log('PASS [3/6] Weekly Client Drift Watch + Ed25519 differential proof verified');

  // 4. Global A2A Affiliate Mesh + Real-Revenue UCB1 Bandit
  const aff = arre.enrollAgentAffiliate({ agentOrPartnerId: 'claude-agent-alpha', channel: 'mcp_agent' });
  assert.strictEqual(aff.ok, true);
  assert.ok(aff.affiliate.code.startsWith('zeus_'));
  assert.strictEqual(aff.affiliate.commissionPct, 10);

  const b1 = arre.selectConversionVariant();
  assert.strictEqual(b1.ok, true);
  assert.strictEqual(b1.inventsConversions, false);
  const upd = arre.recordRealConversionOutcome({ variantId: b1.selectedVariant, confirmedRevenueUsd: 97.92 });
  assert.strictEqual(upd.ok, true);
  assert.strictEqual(upd.arm.paidConversions, 1);
  console.log('PASS [4/6] A2A Affiliate Mesh & Real-Revenue UCB1 Bandit verified');

  // 5. 21 Live MCP Tools + 11 Resources + v1.5.0 Server Card + SDKs + Viral Embed Widget + B2B Invoice
  const umap = require('../backend/modules/universal-mcp-a2a-mesh');
  const tList = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.ok(tList.body.result.tools.length >= 21, 'Expected >= 21 MCP tools, got ' + tList.body.result.tools.length);
  const rList = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
  assert.ok(rList.body.result.resources.length >= 11, 'Expected >= 11 MCP resources');
  assert.strictEqual(umap.getServerCard().version, '1.5.0');

  const finderTool = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'zeus_universal_solution_finder', arguments: { industry: 'health' } },
  });
  assert.strictEqual(finderTool.body.result.isError, false);
  assert.strictEqual(finderTool.body.result.structuredContent.verticalOsId, 'health-os');

  const embedTool = await umap.handleJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'zeus_embed_widget_generator', arguments: { refCode: 'zeus_partner99' } },
  });
  assert.strictEqual(embedTool.body.result.isError, false);
  assert.ok(embedTool.body.result.structuredContent.viralEmbedWidget.htmlSnippet.includes('data-ref="zeus_partner99"'));

  const b2b = require('../src/site/enterprise-b2b-and-embed');
  assert.ok(b2b.buildEmbedWidgetJs().includes('/api/magnet/instant-audit-teaser'));
  assert.ok(b2b.renderB2BInvoiceHtml({ orderId: 'ord_demo123', serviceId: 'instant-website-audit', subtotal_fiat: 44.1, status: 'paid' }).includes('INV-ORD_DEMO123'));
  assert.ok(b2b.renderLegalPageHtml('dpa').includes('GDPR'));
  assert.ok(b2b.renderLegalPageHtml('sla').includes('99.9%'));

  const { ZeusAI } = require('../../packages/zeusai-sdk');
  const sdk = new ZeusAI({ baseUrl: 'https://zeusai.pro', ref: 'zeus_demo' });
  assert.strictEqual(typeof sdk.auditWebsite, 'function');
  assert.strictEqual(typeof sdk.mcpCall, 'function');
  console.log('PASS [5/6] 21 Live MCP Tools, v1.5.0, @zeusai/sdk, Viral Embed Widget & B2B Tax Invoice verified');

  // 6. Perpetual Immortality Scripts (syntax + dry-run)
  const scriptsDir = path.resolve(__dirname, '..', 'scripts');
  const canaryOut = execFileSync('bash', [path.join(scriptsDir, 'canary-auto-rollback.sh'), '--dry-run'], { encoding: 'utf8' });
  assert.ok(canaryOut.includes('DRY-RUN OK'));
  const hygieneOut = execFileSync('bash', [path.join(scriptsDir, 'perpetual-hygiene-and-backup.sh'), '--dry-run'], { encoding: 'utf8' });
  assert.ok(hygieneOut.includes('DRY-RUN OK'));
  console.log('PASS [6/6] Canary Auto-Rollback & Perpetual Hygiene scripts verified (dry-run)');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('ALL ARRE/1.0 + PERPETUAL IMMORTALITY + GLOBAL UTILITY TESTS PASSED ✓');
  process.exit(0);
}

run().catch((err) => {
  console.error('FAIL arre-perpetual-immortality.test.js:', err);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  process.exit(1);
});
