// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:05:58.882Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * EcosystemScanner — scans UNICORN_FINAL/backend/modules and src/modules
 * Identifies modules that can produce profit / orchestrate / heal / market.
 * Pure read-only scan; safe to run on every cycle.
 *
 * Exports: scan({ roots, onlyProfit }) -> { modules: [...], profit: [...], orchestration: [...] }
 */
const fs = require('fs');
const path = require('path');

const PROFIT_KEYWORDS = [
  'revenue', 'profit', 'money', 'monet', 'price', 'pricing', 'pay', 'payment',
  'billing', 'commerce', 'sale', 'sales', 'market', 'checkout', 'invoice',
  'subscription', 'tenant', 'referral', 'affiliate', 'btc', 'crypto',
  'marketplace', 'catalog', 'offer', 'upsell', 'closer', 'deal', 'wealth',
  'royalty', 'licensing', 'licens', 'enterprise', 'premium',
];

const ORCH_KEYWORDS = [
  'orchestrat', 'autonom', 'control-plane', 'self-evolv', 'self-heal',
  'self-adapt', 'self-construct', 'mesh', 'dispatcher', 'router', 'routing',
  'genesis', 'coord', 'agent', 'innovation', 'auto-deploy', 'auto-restart',
  'auto-repair', 'auto-optimize', 'profit-control', 'profit-attribution',
  'eternal', 'cfo', 'commander',
];

const HEAL_KEYWORDS = [
  'heal', 'healing', 'recovery', 'rescue', 'doctor', 'guardian', 'shield',
  'failover', 'circuit-breaker', 'restart', 'repair',
];

function classify(filename) {
  const lower = filename.toLowerCase();
  const hits = { profit: 0, orchestration: 0, healing: 0 };
  for (const kw of PROFIT_KEYWORDS) if (lower.includes(kw)) hits.profit += 1;
  for (const kw of ORCH_KEYWORDS) if (lower.includes(kw)) hits.orchestration += 1;
  for (const kw of HEAL_KEYWORDS) if (lower.includes(kw)) hits.healing += 1;
  return hits;
}

function scanDir(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (['node_modules', '.git', '.archive'].includes(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile() && ent.name.endsWith('.js')) {
        const hits = classify(ent.name);
        if (hits.profit + hits.orchestration + hits.healing > 0) {
          found.push({
            name: ent.name.replace(/\.js$/, ''),
            path: full,
            hits,
            score: hits.profit * 3 + hits.orchestration * 2 + hits.healing,
          });
        }
      }
    }
  }
  return found;
}

function scan({ roots, onlyProfit = false } = {}) {
  const baseRoots = roots || [
    path.join(__dirname, '..'),
    path.join(__dirname, '../../../src/modules'),
  ];
  const all = [];
  for (const r of baseRoots) {
    for (const m of scanDir(r)) all.push(m);
  }
  // Dedupe by name (keep highest score)
  const map = new Map();
  for (const m of all) {
    const prev = map.get(m.name);
    if (!prev || m.score > prev.score) map.set(m.name, m);
  }
  const modules = Array.from(map.values()).sort((a, b) => b.score - a.score);
  const profit = modules.filter((m) => m.hits.profit > 0);
  const orchestration = modules.filter((m) => m.hits.orchestration > 0);
  const healing = modules.filter((m) => m.hits.healing > 0);
  return {
    scannedRoots: baseRoots,
    moduleCount: modules.length,
    profitCount: profit.length,
    orchestrationCount: orchestration.length,
    healingCount: healing.length,
    modules: onlyProfit ? profit : modules,
    profit,
    orchestration,
    healing,
  };
}

module.exports = { scan, classify };
