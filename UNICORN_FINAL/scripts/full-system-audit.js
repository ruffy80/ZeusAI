#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'reports', 'full-system-audit');
const JS_DIRS = [
  path.join(ROOT, 'backend'),
  path.join(ROOT, 'src'),
];

const IGNORE_DIR = new Set(['node_modules', '.git', 'logs', 'tmp', 'generated', 'data', 'build']);

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      if (IGNORE_DIR.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
      continue;
    }
    if (!e.name.endsWith('.js')) continue;
    out.push(path.join(dir, e.name));
  }
  return out;
}

function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }

function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } }

function sha1(text) { return crypto.createHash('sha1').update(text).digest('hex'); }

function localRequireEdges(file, content) {
  const edges = [];
  const dir = path.dirname(file);
  // Intentionally do not strip comments/templates. Large SSR HTML strings and
  // CSS blocks in this repo make comment scrubbing destroy real require() edges
  // (false "dead module" storms). Self-requires from generators/comments are
  // filtered by the path.resolve(found) !== file guard below.
  const rx = /require\((['"])(\.{1,2}\/[^'"]+)\1\)/g;
  let m;
  while ((m = rx.exec(String(content || ''))) !== null) {
    const raw = m[2];
    const cands = [raw, raw + '.js', path.join(raw, 'index.js')]
      .map((r) => path.resolve(dir, r));
    const found = cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    // Ignore self-requires (dynamic generators / intentional recursion markers).
    if (found && path.resolve(found) !== path.resolve(file)) edges.push(found);
  }
  return edges;
}

function findCycles(graph) {
  const state = new Map();
  const stack = [];
  const cycles = [];

  function dfs(node) {
    state.set(node, 1);
    stack.push(node);
    for (const nxt of graph.get(node) || []) {
      const st = state.get(nxt) || 0;
      if (st === 0) dfs(nxt);
      else if (st === 1) {
        const idx = stack.lastIndexOf(nxt);
        if (idx >= 0) cycles.push(stack.slice(idx).concat([nxt]));
      }
    }
    stack.pop();
    state.set(node, 2);
  }

  for (const node of graph.keys()) if (!state.get(node)) dfs(node);

  const uniq = new Set();
  const out = [];
  for (const c of cycles) {
    const key = c.map(rel).join(' -> ');
    if (uniq.has(key)) continue;
    uniq.add(key);
    out.push(c);
  }
  return out;
}

function countRegex(content, rx) {
  const m = content.match(rx);
  return m ? m.length : 0;
}

function detectArchitecture(files, contentMap) {
  const routeFiles = [];
  const moduleInventory = { backendModules: 0, siteModules: 0 };

  for (const f of files) {
    const r = rel(f);
    const c = contentMap.get(f) || '';
    if (/app\.(get|post|put|patch|delete)\(/.test(c)) routeFiles.push(r);
    if (r.startsWith('backend/modules/')) moduleInventory.backendModules += 1;
    if (r.startsWith('src/modules/')) moduleInventory.siteModules += 1;
  }

  return {
    coreEngine: routeFiles.includes('backend/index.js') ? 'backend/index.js' : routeFiles[0] || null,
    orchestration: files.filter((f) => /orchestrator|autonom|evol|workflow/i.test(rel(f))).map(rel).slice(0, 25),
    eventSystems: files.filter((f) => /event|sse|stream|webhook/i.test(rel(f))).map(rel).slice(0, 25),
    serviceRegistry: files.filter((f) => /serviceCatalog|module.*registry|module-mesh|catalog/i.test(rel(f))).map(rel).slice(0, 25),
    aiRouter: files.filter((f) => /router|ai-provider|multi-model|connector/i.test(rel(f))).map(rel).slice(0, 25),
    memorySystems: files.filter((f) => /memory|cache|ledger/i.test(rel(f))).map(rel).slice(0, 25),
    paymentSystems: files.filter((f) => /payment|billing|checkout|invoice|btc|stripe|paypal|nowpayments/i.test(rel(f))).map(rel).slice(0, 35),
    deliverySystems: files.filter((f) => /deploy|release|pm2|delivery|smoke|health-guardian/i.test(rel(f))).map(rel).slice(0, 35),
    marketplaceSystems: files.filter((f) => /marketplace|catalog|commerce|offer|pricing/i.test(rel(f))).map(rel).slice(0, 35),
    evolutionSystems: files.filter((f) => /evol|innovation|self-heal|self-adapt|auto-optimize/i.test(rel(f))).map(rel).slice(0, 35),
    logging: files.filter((f) => /log|observability|analytics|monitor|trac/i.test(rel(f))).map(rel).slice(0, 25),
    database: files.filter((f) => /db\.js|sqlite|database|vault/i.test(rel(f))).map(rel).slice(0, 25),
    queuesRetriesRecovery: files.filter((f) => /queue|retry|recovery|circuit|failover|watchdog/i.test(rel(f))).map(rel).slice(0, 40),
    inventory: moduleInventory,
  };
}

function classifyRevenue(files) {
  const rev = {
    highProfit: [],
    lowProfit: [],
    unused: [],
    enterpriseReady: [],
    apiReady: [],
    whiteLabelReady: [],
    recurringRevenueReady: [],
  };
  for (const f of files) {
    const r = rel(f);
    if (!/backend\/modules\//.test(r)) continue;
    if (/enterprise|deal-desk|billing|pricing|revenue|growth|marketplace/.test(r)) rev.highProfit.push(r);
    if (/demo|test|legacy|bridge|adapter/.test(r)) rev.lowProfit.push(r);
    if (/tenant|api|gateway|router/.test(r)) rev.apiReady.push(r);
    if (/whiteLabel|tenant|provisioning/.test(r)) rev.whiteLabelReady.push(r);
    if (/billing|subscription|invoice|payment/.test(r)) rev.recurringRevenueReady.push(r);
    if (/enterprise/.test(r)) rev.enterpriseReady.push(r);
  }
  for (const k of Object.keys(rev)) rev[k] = [...new Set(rev[k])].slice(0, 30);
  return rev;
}

function main() {
  const files = JS_DIRS.flatMap((d) => walk(d));
  const contentMap = new Map(files.map((f) => [f, read(f)]));

  const graph = new Map();
  const importCount = new Map();
  const hashGroups = new Map();
  const risk = {
    syncIo: [],
    blockingExec: [],
    unboundedIntervals: [],
    evalLike: [],
    weakWebhookCompare: [],
  };

  // Basename index for dynamic/safeRequire('module-name') style loads.
  const byBase = new Map();
  for (const f of files) {
    const base = path.basename(f, '.js');
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(f);
  }

  for (const f of files) {
    const c = contentMap.get(f) || '';
    const edges = localRequireEdges(f, c);
    graph.set(f, edges);
    for (const e of edges) importCount.set(e, (importCount.get(e) || 0) + 1);

    // Count bare-string module references used by safeRequire / dynamic loaders.
    // Examples: safeRequire('FeatureFlagManager'), require('./modules/x') already
    // covered by localRequireEdges.
    const bareRx = /(?:safeRequire|tryRequire|tryLoad|_soft|_safeRequire|require)\(\s*['"]([A-Za-z0-9_./@-]+)['"]\s*\)/g;
    let bm;
    while ((bm = bareRx.exec(c)) !== null) {
      const token = bm[1];
      if (!token || token.startsWith('.')) continue; // relative handled above
      const base = path.basename(token, '.js');
      for (const target of byBase.get(base) || []) {
        if (path.resolve(target) !== path.resolve(f)) {
          importCount.set(target, (importCount.get(target) || 0) + 1);
        }
      }
    }

    // Dynamic relative loaders: only scan known string-table / pool hosts so
    // large SSR/HTML blobs do not contribute spurious './...' hits.
    const relPath = rel(f);
    const isDynLoaderHost = /(?:integrations\/index|ModuleLoader|adaptiveEnginePool|module-loader|capability-registry|essential-modules-continuum)\.js$/.test(relPath)
      || /\/integrations\/index\.js$/.test(relPath);
    if (isDynLoaderHost) {
      const dynRelRx = /['"](\.\/[A-Za-z0-9_./-]+)['"]/g;
      let dm;
      const dir = path.dirname(f);
      while ((dm = dynRelRx.exec(c)) !== null) {
        const raw = dm[1];
        const cands = [raw, raw + '.js', path.join(raw, 'index.js')].map((r) => path.resolve(dir, r));
        const found = cands.find((cand) => fs.existsSync(cand) && fs.statSync(cand).isFile());
        if (found && path.resolve(found) !== path.resolve(f)) {
          importCount.set(found, (importCount.get(found) || 0) + 1);
        }
      }
    }

    // Capability name tables: only array / object-value string literals that
    // look like module basenames (kebab or camel), not every short string.
    // Matches: ['foo-bar', "bazModule"] or name: 'foo-bar'
    if (/backend\/index\.js$/.test(relPath) || /essential-modules-continuum|total-ecosystem-perfection|module-reality|iak\//.test(relPath)) {
      const nameTableRx = /(?:[\[,:]\s*|^\s*)['"]([a-z][a-zA-Z0-9_-]{2,})['"]\s*[,\]}]/gm;
      let nm;
      while ((nm = nameTableRx.exec(c)) !== null) {
        const base = nm[1];
        // Skip common non-module tokens.
        if (/^(get|post|put|delete|patch|head|options|true|false|null|undefined|ok|error|status|json|html|utf-8)$/i.test(base)) continue;
        for (const target of byBase.get(base) || []) {
          if (path.resolve(target) !== path.resolve(f)) {
            importCount.set(target, (importCount.get(target) || 0) + 1);
          }
        }
      }
    }

    const h = sha1(c);
    if (!hashGroups.has(h)) hashGroups.set(h, []);
    hashGroups.get(h).push(f);

    if (/\b(readFileSync|writeFileSync|appendFileSync|readdirSync|statSync|execSync|spawnSync)\b/.test(c)) risk.syncIo.push(rel(f));
    if (/\b(execSync|spawnSync)\b/.test(c)) risk.blockingExec.push(rel(f));
    if (/setInterval\(/.test(c) && !/clearInterval\(/.test(c)) risk.unboundedIntervals.push(rel(f));
    if (/\beval\(|new Function\(/.test(c)) risk.evalLike.push(rel(f));
    // Flag only likely-insecure webhook compares (direct `!==` on signatures)
    // and avoid false positives in files that already use timingSafeEqual.
    const hasWebhookMismatchMsg = /Webhook signature mismatch/.test(c);
    const hasDirectSigCompare = /\b(signed|expected|computed|signature)\s*!==\s*(v1|sig|signature|provided)\b/.test(c);
    const hasTimingSafe = /timingSafeEqual\(/.test(c);
    if (hasWebhookMismatchMsg && hasDirectSigCompare && !hasTimingSafe) {
      risk.weakWebhookCompare.push(rel(f));
    }
  }

  const cycles = findCycles(graph);
  const duplicates = [];
  for (const group of hashGroups.values()) {
    if (group.length > 1) duplicates.push(group.map(rel));
  }

  const allModuleFiles = files.filter((f) => rel(f).startsWith('backend/modules/'));
  // Pool shims are loaded dynamically via adaptiveEnginePool.getWorker — not dead.
  const DYNAMIC_POOL_RE = /(?:^|\/)(?:AdaptiveModule|Engine)\d+\.js$/;
  // Intentional thin aliases that re-export supreme adapters (still production entrypoints).
  const INTENTIONAL_ALIAS_RE = /(?:ops-watchdog|predictive-healing|quantum-healing|recovery-engine|recovery-orchestrator|self-healing-engine|service-watchdog|auto-optimize|autonomousInnovation|evolution-core|ui-evolution|tenantBilling|tenantProvisioning)\.js$/;
  // Alternate process entrypoints (PM2/node start targets), not library imports.
  const STANDALONE_ENTRY_RE = /(?:^|\/)(?:social-orchestrator\/service)\.js$/;
  const deadModules = allModuleFiles
    .filter((f) => (importCount.get(f) || 0) === 0)
    .map(rel)
    .filter((r) => !/index\.js$/.test(r))
    .filter((r) => !DYNAMIC_POOL_RE.test(r))
    .filter((r) => !INTENTIONAL_ALIAS_RE.test(r))
    .filter((r) => !STANDALONE_ENTRY_RE.test(r));

  const architecture = detectArchitecture(files, contentMap);
  const revenue = classifyRevenue(files);
  revenue.unused = deadModules.filter((r) => /revenue|market|pricing|billing|sales|offer|checkout/i.test(r)).slice(0, 40);

  const securityFindings = [
    `Rate-limiting and auth middleware detected in backend routes: ${/authRateLimit\(|adminTokenMiddleware|helmet\(/.test(contentMap.get(path.join(ROOT, 'backend', 'index.js')) || '') ? 'yes' : 'needs check'}`,
    `Webhook signature handlers detected: ${/webhook\/stripe|webhook\/paypal|nowpayments/.test(contentMap.get(path.join(ROOT, 'backend', 'index.js')) || '') ? 'yes' : 'no'}`,
    `Potential eval/new Function usage files: ${risk.evalLike.length}`,
    `Potential sync/blocking IO files: ${risk.syncIo.length}`,
  ];

  const scalability = {
    nodeFiles: files.length,
    routeFiles: files.filter((f) => /app\.(get|post|put|patch|delete)\(/.test(contentMap.get(f) || '')).length,
    cycleCount: cycles.length,
    duplicateGroupCount: duplicates.length,
    deadModuleCount: deadModules.length,
    intervalRiskCount: risk.unboundedIntervals.length,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const architectureMd = [
    '# Full Architecture Map',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Core map',
    `- Core engine: ${architecture.coreEngine || 'unknown'}`,
    `- Backend modules: ${architecture.inventory.backendModules}`,
    `- Site modules: ${architecture.inventory.siteModules}`,
    '',
    '## Orchestration',
    ...architecture.orchestration.map((x) => `- ${x}`),
    '',
    '## Event systems',
    ...architecture.eventSystems.map((x) => `- ${x}`),
    '',
    '## Service registry',
    ...architecture.serviceRegistry.map((x) => `- ${x}`),
    '',
    '## AI router',
    ...architecture.aiRouter.map((x) => `- ${x}`),
    '',
    '## Memory systems',
    ...architecture.memorySystems.map((x) => `- ${x}`),
    '',
    '## Payment systems',
    ...architecture.paymentSystems.map((x) => `- ${x}`),
    '',
    '## Delivery systems',
    ...architecture.deliverySystems.map((x) => `- ${x}`),
    '',
    '## Marketplace systems',
    ...architecture.marketplaceSystems.map((x) => `- ${x}`),
    '',
    '## Evolution systems',
    ...architecture.evolutionSystems.map((x) => `- ${x}`),
  ].join('\n');

  const weaknessesMd = [
    '# Weaknesses Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Circular import cycles detected: ${cycles.length}`,
    `- Potential dead modules: ${deadModules.length}`,
    `- Duplicate logic groups (identical file hash): ${duplicates.length}`,
    `- Files with sync/blocking IO patterns: ${risk.syncIo.length}`,
    `- Files with setInterval but no clearInterval in file: ${risk.unboundedIntervals.length}`,
    '',
    '## Circular imports (sample)',
    ...cycles.slice(0, 20).map((c) => `- ${c.map(rel).join(' -> ')}`),
    '',
    '## Potential dead modules (sample)',
    ...deadModules.slice(0, 60).map((x) => `- ${x}`),
    '',
    '## Duplicate groups (sample)',
    ...duplicates.slice(0, 20).map((g) => `- ${g.join(' | ')}`),
  ].join('\n');

  const securityMd = [
    '# Security Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Findings',
    ...securityFindings.map((x) => `- ${x}`),
    '',
    '## Potential risks',
    `- Possible weak webhook compare files: ${risk.weakWebhookCompare.length}`,
    ...risk.weakWebhookCompare.slice(0, 30).map((x) => `  - ${x}`),
    `- Possible eval/new Function files: ${risk.evalLike.length}`,
    ...risk.evalLike.slice(0, 30).map((x) => `  - ${x}`),
    '',
    '## Mandatory hardening checklist',
    '- Enforce auth middleware on all webhook management endpoints',
    '- Keep signature checks timing-safe and timestamp-bounded',
    '- Keep admin APIs behind admin token + rate limits',
    '- Keep CSP / Trusted Types contract enabled in site renderer',
  ].join('\n');

  const scalabilityMd = [
    '# Scalability Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Node JS files scanned: ${scalability.nodeFiles}`,
    `- Route-bearing files: ${scalability.routeFiles}`,
    `- Circular dependency cycles: ${scalability.cycleCount}`,
    `- Potential dead modules: ${scalability.deadModuleCount}`,
    '',
    '## 100x readiness actions',
    '- Move long-running async workloads to queue workers (BullMQ/Redis or equivalent)',
    '- Make non-idempotent writes use idempotency keys by default',
    '- Add cache tier in front of heavy catalog/pricing computations',
    '- Keep PM2 cluster for stateless HTTP paths only',
    '- Keep health/readiness/deep health probes as deploy gates',
  ].join('\n');

  const revenueMd = [
    '# Revenue Optimization Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Classification',
    `- High-profit candidates: ${revenue.highProfit.length}`,
    `- Low-profit candidates: ${revenue.lowProfit.length}`,
    `- Unused monetization-related modules: ${revenue.unused.length}`,
    `- Enterprise-ready: ${revenue.enterpriseReady.length}`,
    `- API-ready: ${revenue.apiReady.length}`,
    `- White-label-ready: ${revenue.whiteLabelReady.length}`,
    `- Recurring-revenue-ready: ${revenue.recurringRevenueReady.length}`,
    '',
    '## High-profit (sample)',
    ...revenue.highProfit.slice(0, 40).map((x) => `- ${x}`),
    '',
    '## Recurring revenue ready (sample)',
    ...revenue.recurringRevenueReady.slice(0, 40).map((x) => `- ${x}`),
    '',
    '## Optimization actions',
    '- Keep dynamic pricing active for paid plans',
    '- Bundle enterprise modules with annual commitment discount',
    '- Introduce cross-sell packs from checkout success events',
    '- Promote API + white-label packs in `/api/payment/methods` + pricing UI',
  ].join('\n');

  const innovationMd = [
    '# Innovation Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Autonomous loop contract',
    '- Think -> Plan -> Execute -> Observe -> Reflect -> Improve',
    '- Enforce confidence threshold before auto-apply',
    '- Persist failure/success memory and replay-safe rollback snapshots',
    '- Require tests + security checks before mutation rollout',
    '',
    '## Revenue-first module candidates',
    '- Autonomous lead hunter',
    '- Autonomous closer',
    '- Predictive pricing optimizer',
    '- Competitor intelligence engine',
    '- AI retention engine',
    '- AI legal + tax copilot',
    '- Investor deck generator',
    '',
    '## Safety controls',
    '- Rollback engine + snapshot checkpoint before each auto-mutation',
    '- Mutation sandbox and approval thresholds for high-risk changes',
    '- Regression gate: security + performance budgets must stay green',
  ].join('\n');

  const poolShimCount = allModuleFiles.filter((f) => DYNAMIC_POOL_RE.test(rel(f))).length;
  const intentionalAliasSkipped = allModuleFiles.filter((f) => INTENTIONAL_ALIAS_RE.test(rel(f))).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    totals: {
      files: files.length,
      cycles: cycles.length,
      deadModules: deadModules.length,
      duplicateGroups: duplicates.length,
      poolShims: poolShimCount,
      intentionalAliasSkipped,
    },
    cycleSample: cycles.slice(0, 10).map((c) => c.map(rel).join(' -> ')),
    deadModulesSample: deadModules.slice(0, 40),
    architecture,
    risk: {
      syncIoCount: risk.syncIo.length,
      blockingExecCount: risk.blockingExec.length,
      unboundedIntervalsCount: risk.unboundedIntervals.length,
      evalLikeCount: risk.evalLike.length,
      weakWebhookCompareCount: risk.weakWebhookCompare.length,
      syncIoSample: risk.syncIo.slice(0, 30),
      unboundedIntervalsSample: risk.unboundedIntervals.slice(0, 30),
    },
    revenue,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'architecture-map.md'), architectureMd);
  fs.writeFileSync(path.join(OUT_DIR, 'weaknesses-report.md'), weaknessesMd);
  fs.writeFileSync(path.join(OUT_DIR, 'security-report.md'), securityMd);
  fs.writeFileSync(path.join(OUT_DIR, 'scalability-report.md'), scalabilityMd);
  fs.writeFileSync(path.join(OUT_DIR, 'revenue-optimization-report.md'), revenueMd);
  fs.writeFileSync(path.join(OUT_DIR, 'innovation-report.md'), innovationMd);
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('[audit] reports generated at', OUT_DIR);
  console.log('[audit] files=' + files.length + ' cycles=' + cycles.length + ' deadModules=' + deadModules.length + ' duplicateGroups=' + duplicates.length + ' poolShims=' + poolShimCount);
}

main();
