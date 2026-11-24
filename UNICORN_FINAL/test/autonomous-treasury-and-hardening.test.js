'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-atro-hardening-'));
process.env.ZEUS_STATE_DIR = tmpDir;
process.env.ATRO_COMMERCE_DIR = path.join(tmpDir, 'commerce');
process.env.ATRO_DATA_DIR = path.join(tmpDir, 'atro');
process.env.CEGE_DATA_DIR = path.join(tmpDir, 'cege');
process.env.ASPE_DATA_DIR = path.join(tmpDir, 'aspe');
fs.mkdirSync(process.env.ATRO_COMMERCE_DIR, { recursive: true });

async function run() {
  const { validateAllManifests } = require('../backend/modules/validate_manifests');
  const { discoverModules, buildDependencyGraph, topologicalSort } = require('../backend/modules/orchestrator/discovery');
  const { getSystemMemoryInfo } = require('../backend/lib/linux-mem');
  const sloTracker = require('../backend/modules/slo-tracker');
  const atro = require('../backend/modules/autonomous-treasury-reconciler');
  const umap = require('../backend/modules/universal-mcp-a2a-mesh');
  const aspe = require('../backend/modules/autonomous-service-provisioning');
  const asri = require('../backend/modules/autonomous-runtime-immunity');
  const cege = require('../backend/modules/cognitive-evolution-genome');
  const revAuto = require('../backend/modules/revenue-autopilot');

  // 1. Validate ALL 28 manifests + cycle-free DAG
  const res = validateAllManifests();
  const invalid = res.filter((r) => !r.valid);
  assert.strictEqual(invalid.length, 0, 'Invalid manifests: ' + JSON.stringify(invalid));
  assert.ok(res.length >= 28, 'Expected >= 28 valid manifests, got ' + res.length);
  const graph = buildDependencyGraph(discoverModules());
  assert.strictEqual(graph.cycles.length, 0, 'Zero cycles expected');
  const topo = topologicalSort(graph).map((m) => (typeof m === 'string' ? m : m.name));
  assert.ok(topo.includes('autonomous-treasury-reconciler'), 'ATRO in DAG');
  console.log('PASS [1/7] All ' + res.length + ' manifests valid & cycle-free DAG');

  // 2. Linux MemAvailable helper + ASRI supplyChain knownVulnerabilities contract
  const mem = getSystemMemoryInfo();
  assert.ok(mem.totalBytes > 0 && mem.freePct >= 0 && mem.freePct <= 100);
  const sc = asri.auditSupplyChain();
  assert.strictEqual(sc.knownVulnerabilities, 0);
  console.log('PASS [2/7] Linux MemAvailable helper & ASRI knownVulnerabilities contract');

  // 3. SLO Tracker route cardinality cap (prevents 404 bot-scan RAM leak)
  for (let i = 0; i < 320; i++) {
    sloTracker.record('GET /wp-login-probe-' + i, 5, true);
  }
  assert.ok(sloTracker.routes.size <= 260, 'SLO routes must remain bounded, got ' + sloTracker.routes.size);
  console.log('PASS [3/7] SLOTracker route cardinality bounded (' + sloTracker.routes.size + ' keys)');

  // 4. ATRO/1.0 Deduplicated Net-Profit Reconciliation, On-Chain Audit & Recovery Sweep
  const nowIso = new Date().toISOString();
  const oldIso = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const sampleOrders = [
    // Real BTC order (0% fee, $100 net)
    { orderId: 'ord_btc_real_1', serviceId: 'instant-website-audit', status: 'paid', paid_via: 'btc', subtotal_fiat: 100, amount_sats: 110000, txids: ['a'.repeat(64)], buyer: { email: 'founder@acme.io' }, paid_at: nowIso },
    // Real PayPal order ($300 -> fee $10.96 -> net $289.04 -> triggers >$250 sweep alert!)
    { orderId: 'ord_pp_real_2', serviceId: 'professional-ai-agent', status: 'paid', paid_via: 'paypal', subtotal_fiat: 300, provider_settle: { providerRef: 'PAY-12345' }, buyer: { email: 'cto@beta.io' }, paid_at: nowIso },
    // Smoke test order (MUST BE EXCLUDED!)
    { orderId: 'ord_smoke_3', serviceId: 'instant-website-audit', status: 'paid', paid_via: 'loopback', subtotal_fiat: 9999, buyer: { email: 'smoke@zeusai.pro' }, paid_at: nowIso },
    // Expired abandoned order (90m ago -> MUST appear in stage_2_fresh_remint recovery sweep!)
    { orderId: 'ord_exp_4', serviceId: 'instant-seo-content-pack', status: 'expired', subtotal_fiat: 79, buyer: { email: 'buyer@gamma.io' }, created_at: oldIso },
  ];
  fs.writeFileSync(
    path.join(process.env.ATRO_COMMERCE_DIR, 'orders.jsonl'),
    sampleOrders.map((o) => JSON.stringify(o)).join('\n') + '\n',
    'utf8'
  );

  const rec = atro.reconcileLedger();
  assert.strictEqual(rec.ok, true);
  assert.strictEqual(rec.inventsRevenue, false);
  assert.strictEqual(rec.totals.realPaidOrders, 2, 'Smoke order must be excluded');
  assert.strictEqual(rec.totals.testOrSmokeOrdersExcluded, 1);
  assert.strictEqual(rec.totals.grossRevenueUsd, 400);
  assert.strictEqual(rec.byRail.btc.feeUsd, 0);
  assert.ok(rec.byRail.paypal.feeUsd > 10, 'PayPal fee deducted accurately');
  assert.strictEqual(rec.sweepAlerts.length, 1, 'PayPal balance >$250 must trigger sweep alert');

  const onchain = await atro.reconcileOnChainBtc({
    dryRunStats: { chain_stats: { funded_txo_sum: 110000, spent_txo_sum: 0, tx_count: 1 }, mempool_stats: { funded_txo_sum: 0 } },
  });
  assert.strictEqual(onchain.ok, true);
  assert.strictEqual(onchain.varianceSats, 0);

  const sweep = atro.runRecoverySweep();
  assert.strictEqual(sweep.ok, true);
  assert.strictEqual(sweep.neverResendsExpiredBtcQuote, true);
  assert.strictEqual(sweep.candidatesFound, 1);
  assert.strictEqual(sweep.candidates[0].stage, 'stage_2_fresh_remint');

  const snap = atro.getTreasurySnapshot();
  assert.strictEqual(snap.ok, true);
  assert.strictEqual(snap.attestation.algorithm, 'Ed25519');
  console.log('PASS [4/7] ATRO/1.0 net-profit reconciler, smoke exclusion, sweep alerts, on-chain audit & recovery sweep');

  // 5. ASPE cross-process disk sync (eliminates site->backend 404 split-brain)
  const fakeInst = {
    orderId: 'ord_cross_proc_sync_1',
    serviceId: 'instant-website-audit',
    workspaceId: 'ws_sync_1',
    status: 'active',
    cyclesExecuted: 1,
    executionLog: [],
    nextScheduledRunAt: new Date(Date.now() + 3600000).toISOString(),
  };
  fs.mkdirSync(process.env.ASPE_DATA_DIR, { recursive: true });
  fs.appendFileSync(path.join(process.env.ASPE_DATA_DIR, 'instances.jsonl'), JSON.stringify(fakeInst) + '\n', 'utf8');
  aspe._lastDiskMtimeMs = 0; // simulate backend process seeing new write from site process
  const loaded = aspe.getInstance('ord_cross_proc_sync_1');
  assert.ok(loaded && loaded.workspaceId === 'ws_sync_1', 'ASPE must sync newly written instances from disk across processes');
  console.log('PASS [5/7] ASPE cross-process disk sync eliminates site->backend 404 split-brain');

  // 6. CEGE/1.0 atomic state.json persistence + UMAP 11th MCP tool (zeus_treasury_autonomy)
  await cege.evolveGeneration({ domain: 'security_runtime_immunity', allowLiveLlm: false });
  assert.ok(fs.existsSync(path.join(process.env.CEGE_DATA_DIR, 'state.json')), 'CEGE state.json must persist across restarts');
  const mcpTools = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.ok(mcpTools.body.result.tools.length >= 11, 'Expected >= 11 MCP tools');
  const mcpAtro = await umap.handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'zeus_treasury_autonomy', arguments: {} } });
  assert.strictEqual(mcpAtro.body.result.structuredContent.ok, true);
  assert.strictEqual(mcpAtro.body.result.structuredContent.payload.protocol, 'ATRO/1.0');
  console.log('PASS [6/7] CEGE state.json persistence & UMAP 11th MCP tool (zeus_treasury_autonomy)');

  // 7. revenue-autopilot.status() fixed (delegates to profitAutopilot.getStatus)
  const rStat = revAuto.status();
  assert.ok(rStat && rStat.error !== 'profit-autopilot not initialized', 'revenue-autopilot status must resolve profitAutopilot.getStatus()');
  console.log('PASS [7/7] revenue-autopilot.status() delegation fixed');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  console.log('ALL ATRO/1.0 + AUTONOMOUS HARDENING TESTS PASSED ✓');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
