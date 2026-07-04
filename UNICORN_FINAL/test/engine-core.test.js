'use strict';
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
// engine-core.test.js
//
// Plasa de siguranță REALĂ pentru engine-core + cele 22 module populate cu
// logică reală. Verifică algoritmica (NU echo): PSO converge, Dijkstra alege
// calea minimă, two-proportion z-test, merit-order clearing, topo-sort,
// PID, softmax+entropie, percentile reservoir, circuit breaker, contractul
// { process, getStatus } pe fiecare modul.
//
// Stil aliniat cu suita existentă: assert + check(name, fn) + contor.
// =====================================================================

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

const M = (p) => require('../backend/modules/' + p);

(async () => {
  // ───────────────────────── engine-core ──────────────────────────────
  console.log('engine-core');
  const { createEngine, Engine, Reservoir } = M('engine-core');

  check('Reservoir percentile is monotonic & bounded', () => {
    const r = new Reservoir(256);
    for (let i = 1; i <= 1000; i++) r.add(i);
    const p50 = r.percentile(50);
    const p95 = r.percentile(95);
    assert.ok(p95 >= p50, `p95(${p95}) >= p50(${p50})`);
    assert.ok(p50 >= 1 && p95 <= 1000, 'percentiles within data range');
  });

  check('createEngine returns the module contract', () => {
    const e = createEngine('t-contract', { work: (i) => ({ ok: true, echo: i }) });
    assert.strictEqual(typeof e.process, 'function');
    assert.strictEqual(typeof e.getStatus, 'function');
    assert.strictEqual(e.name, 't-contract');
  });

  await (async () => {
    const e = createEngine('t-metrics', { work: (i) => ({ doubled: (Number(i.n) || 0) * 2 }) });
    const r1 = await e.process({ n: 21 });
    check('engine executes real work function', () => {
      assert.strictEqual(r1.result.doubled, 42);
    });
    await e.process({ n: 1 });
    await e.process({ n: 2 });
    const st = e.getStatus();
    check('engine tracks real invocation metrics', () => {
      assert.strictEqual(st.invocations, 3);
      assert.strictEqual(st.success, 3);
      assert.strictEqual(st.fail, 0);
      assert.strictEqual(st.errorRate, 0);
      assert.ok(st.healthy === true);
    });
  })();

  await (async () => {
    // Circuit breaker: după erori repetate motorul intră în pauză și respinge.
    // Contract engine-core: process() NU aruncă — întoarce { status }.
    const e = createEngine('t-breaker', {
      failThreshold: 3, cooldownMs: 60000,
      work: () => { throw new Error('boom'); },
    });
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await e.process({});
      statuses.push(r.status);
    }
    check('circuit breaker trips after failThreshold then pauses/rejects', () => {
      const errors = statuses.filter((s) => s === 'error').length;
      const paused = statuses.filter((s) => s === 'paused').length;
      assert.ok(errors >= 3, `expected >=3 real failures, got ${errors} (${statuses})`);
      assert.ok(paused >= 1, `expected >=1 paused rejection after trip, got ${paused}`);
      const st = e.getStatus();
      assert.ok(st.healthy === false || st.paused === true, 'breaker reflects unhealthy/paused');
    });
  })();

  // ───────────────────────── analytics ────────────────────────────────
  console.log('analytics');
  const analytics = M('analytics');
  check('analytics computes real stats (avg/stddev/percentiles)', () => {
    const r = analytics.analyze({ events: [{ v: 10 }, { v: 20 }, { v: 30 }, { v: 40 }], metric: 'v' });
    assert.strictEqual(r.overall.avg, 25);
    assert.strictEqual(r.overall.min, 10);
    assert.strictEqual(r.overall.max, 40);
    assert.ok(r.overall.stddev > 11 && r.overall.stddev < 12, `stddev≈11.18, got ${r.overall.stddev}`);
  });
  check('analytics trend detects an upward slope via regression', () => {
    const r = analytics.trend([1, 2, 3, 4, 5, 6]);
    assert.strictEqual(r.direction, 'up');
    assert.ok(r.slope > 0.9, `slope≈1, got ${r.slope}`);
    assert.ok(r.confidence > 0.99, `R²≈1, got ${r.confidence}`);
  });

  // ───────────────────────── ab-testing ───────────────────────────────
  console.log('ab-testing');
  const ab = M('ab-testing');
  check('ab assignment is deterministic per subject', () => {
    const a = ab.assign('exp', 'user-77', ['control', 'treatment']);
    const b = ab.assign('exp', 'user-77', ['control', 'treatment']);
    assert.strictEqual(a, b);
  });
  check('ab two-proportion z-test flags a real significant lift', () => {
    const r = ab.significance({ visitors: 1000, conversions: 100 }, { visitors: 1000, conversions: 140 });
    assert.ok(r.significant === true, `expected significant, p=${r.pValue}`);
    assert.strictEqual(r.winner, 'treatment');
    assert.ok(r.pValue < 0.05);
  });
  check('ab reports inconclusive on tiny equal samples', () => {
    const r = ab.significance({ visitors: 10, conversions: 1 }, { visitors: 10, conversions: 1 });
    assert.strictEqual(r.significant, false);
  });

  // ───────────────────────── content-ai ───────────────────────────────
  console.log('content-ai');
  const content = M('content-ai');
  check('content readability scores simple text as easy', () => {
    const r = content.readability('The cat sat on the mat. The dog ran fast.');
    assert.ok(r.score >= 70, `expected easy (>=70), got ${r.score}`);
  });
  check('content keyword extraction ranks the repeated term first', () => {
    const kws = content.keywords('bitcoin bitcoin bitcoin payments crypto crypto invoice');
    assert.strictEqual(kws[0].term, 'bitcoin');
    assert.ok(kws[0].count === 3);
  });

  // ───────────────────────── auto-trend-analyzer ──────────────────────
  console.log('auto-trend-analyzer');
  const trend = M('auto-trend-analyzer');
  check('trend RSI of a strictly rising series is high', () => {
    const xs = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const r = trend.rsi(xs, 14);
    assert.ok(r > 70, `expected RSI>70 on uptrend, got ${r}`);
  });
  check('trend spike detection finds an outlier via z-score', () => {
    const s = trend.spikes([10, 10, 10, 10, 100, 10, 10, 10], 2);
    assert.ok(s.some((x) => x.value === 100), 'spike at value 100 detected');
  });

  // ───────────────────────── performance-monitor ──────────────────────
  console.log('performance-monitor');
  const perf = M('performance-monitor');
  check('performance sample returns real process readings', () => {
    const s = perf.sample();
    assert.ok(s.heapUsedMB > 0, 'heap used > 0');
    assert.ok(s.cores >= 1, 'cores >= 1');
    assert.ok(s.healthScore >= 0 && s.healthScore <= 100, 'health score in [0,100]');
  });
  check('performance latencyStats computes percentiles', () => {
    const r = perf.latencyStats([5, 1, 3, 2, 4]);
    assert.strictEqual(r.min, 1);
    assert.strictEqual(r.max, 5);
    assert.strictEqual(r.count, 5);
  });

  // ───────────────────────── swarm-intelligence ───────────────────────
  console.log('swarm-intelligence');
  const swarm = M('swarm-intelligence');
  check('swarm PSO converges toward the target vector', () => {
    const r = swarm.pso([3, -2, 5], { iterations: 120, particles: 30, seed: 42 });
    assert.ok(r.cost < 0.01, `expected near-zero cost, got ${r.cost}`);
    r.solution.forEach((v, i) => assert.ok(Math.abs(v - [3, -2, 5][i]) < 0.2, `dim ${i} close`));
  });
  check('swarm weighted consensus picks the heaviest vote', () => {
    const r = swarm.consensus([{ vote: 'A', weight: 3 }, { vote: 'B', weight: 1 }, { vote: 'A', weight: 1 }]);
    assert.strictEqual(r.decision, 'A');
    assert.ok(r.quorum === true);
  });

  // ───────────────────────── autonomous-wealth-engine ─────────────────
  console.log('autonomous-wealth-engine');
  const wealth = M('autonomous-wealth-engine');
  check('wealth future value grows above invested principal', () => {
    const r = wealth.futureValue({ principal: 1000, monthlyContribution: 100, annualRatePct: 8, years: 10 });
    assert.ok(r.futureValue > r.totalInvested, 'growth positive');
    assert.ok(r.growthMultiple > 1);
  });
  check('wealth risk-parity gives less weight to higher volatility', () => {
    const a = wealth.riskParity([{ name: 'low', volatility: 5 }, { name: 'high', volatility: 20 }]);
    const low = a.find((x) => x.asset === 'low');
    const high = a.find((x) => x.asset === 'high');
    assert.ok(low.weight > high.weight, 'low-vol gets more weight');
  });

  // ───────────────────────── autonomous-bd-engine ─────────────────────
  console.log('autonomous-bd-engine');
  const bd = M('autonomous-bd-engine');
  check('bd lead scoring ranks a strong lead as hot', () => {
    const r = bd.scoreLead({ budget: 0.9, authority: 0.9, need: 0.9, timing: 0.8, engagement: 0.8, fit: 0.9 });
    assert.strictEqual(r.tier, 'A-hot');
    assert.ok(r.winProbability > 0.5);
  });
  check('bd weighted pipeline ≤ raw pipeline', () => {
    const r = bd.pipeline([{ budget: 0.5, need: 0.5, dealValue: 1000 }, { budget: 0.9, need: 0.9, dealValue: 2000 }]);
    assert.ok(r.weightedPipeline <= r.rawPipeline, 'weighted discounted by probability');
  });

  // ───────────────────────── auto-marketing ───────────────────────────
  console.log('auto-marketing');
  const mk = M('auto-marketing');
  check('marketing metrics compute real ROAS/CAC', () => {
    const r = mk.channelMetrics({ name: 'g', impressions: 1000, clicks: 100, spend: 200, conversions: 10, revenue: 800 });
    assert.strictEqual(r.roas, 4);
    assert.strictEqual(r.cac, 20);
    assert.strictEqual(r.ctr, 10);
  });
  check('marketing budget allocation favors higher ROAS channel', () => {
    const r = mk.allocateBudget([{ name: 'hi', spend: 100, revenue: 500 }, { name: 'lo', spend: 100, revenue: 150 }], 1000);
    const hi = r.allocation.find((x) => x.channel === 'hi');
    const lo = r.allocation.find((x) => x.channel === 'lo');
    assert.ok(hi.allocation > lo.allocation, 'high ROAS gets more budget');
  });

  // ───────────────────────── self-adaptation-engine (PID) ─────────────
  console.log('self-adaptation-engine');
  const adapt = M('self-adaptation-engine');
  check('PID controller pushes toward the target (positive error → increase)', () => {
    const r = adapt.pidStep('k-test', { target: 100, measured: 50 });
    assert.strictEqual(r.direction, 'increase');
    assert.ok(r.error === 50);
  });

  // ───────────────────────── self-documenter ──────────────────────────
  console.log('self-documenter');
  const doc = M('self-documenter');
  check('self-documenter parses functions, classes and exports', () => {
    const r = doc.analyzeSource('class Foo {}\nfunction bar(a,b){return a+b;}\nconst baz=(x)=>x;\nmodule.exports={bar,baz};');
    assert.ok(r.functions >= 2, 'found functions');
    assert.strictEqual(r.classes, 1);
    assert.ok(r.exports >= 2);
  });

  // ───────────────────────── site-creator ─────────────────────────────
  console.log('site-creator');
  const site = M('site-creator');
  check('site-creator escapes XSS and emits valid HTML', () => {
    const html = site.buildPage({ title: '<script>alert(1)</script>', sections: [{ heading: 'Hi', text: 'x & y' }] });
    assert.ok(html.includes('&lt;script&gt;'), 'script tag escaped');
    assert.ok(!html.includes('<script>alert(1)</script>'), 'no raw script injection');
    assert.ok(html.startsWith('<!DOCTYPE html>') && html.includes('</html>'), 'valid document');
  });

  // ───────────────────────── unicorn-realization-engine ───────────────
  console.log('unicorn-realization-engine');
  const realize = M('unicorn-realization-engine');
  check('realization weighted completion is correct', () => {
    const r = realize.weightedCompletion([{ progress: 1, weight: 1 }, { progress: 0, weight: 1 }]);
    assert.strictEqual(r.completion, 50);
  });
  check('realization critical path picks the longest dependency chain', () => {
    const r = realize.criticalPath([
      { id: 'a', duration: 2, deps: [] },
      { id: 'b', duration: 3, deps: ['a'] },
      { id: 'c', duration: 10, deps: ['b'] },
    ]);
    assert.strictEqual(r.duration, 15);
    assert.deepStrictEqual(r.path, ['a', 'b', 'c']);
  });

  // ───────────────────────── unicorn-super-intelligence ───────────────
  console.log('unicorn-super-intelligence');
  const si = M('unicorn-super-intelligence');
  check('super-intelligence softmax decision picks the strongest signal', () => {
    const r = si.decide([{ name: 'x', signals: { s: 1 } }, { name: 'y', signals: { s: 9 } }]);
    assert.strictEqual(r.decision, 'y');
    assert.ok(r.confidence > 0.9);
    assert.ok(r.uncertainty >= 0 && r.uncertainty <= 1);
  });

  // ───────────────────────── universal-adaptor ────────────────────────
  console.log('universal-adaptor');
  const ua = M('universal-adaptor');
  check('adaptor flatten/unflatten round-trips', () => {
    const obj = { a: { b: { c: 1 } }, d: 2 };
    const flat = ua.flatten(obj);
    assert.strictEqual(flat['a.b.c'], 1);
    assert.deepStrictEqual(ua.unflatten(flat), obj);
  });
  check('adaptor coerce casts types from a schema', () => {
    const r = ua.coerce({ n: '42', b: 'true' }, { n: 'number', b: 'boolean' });
    assert.strictEqual(r.n, 42);
    assert.strictEqual(r.b, true);
  });

  // ───────────────────────── universal-interchain-nexus (Dijkstra) ────
  console.log('universal-interchain-nexus');
  const nexus = M('universal-interchain-nexus');
  check('nexus Dijkstra finds the cheapest cross-chain route', () => {
    const r = nexus.cheapestRoute([
      { from: 'ETH', to: 'BSC', feePct: 0.3 },
      { from: 'ETH', to: 'POLY', feePct: 0.1 },
      { from: 'POLY', to: 'BSC', feePct: 0.1 },
    ], 'ETH', 'BSC', 100);
    assert.ok(r.reachable === true);
    assert.strictEqual(r.hops, 2); // ETH→POLY→BSC (0.2) cheaper than direct (0.3)
    assert.ok(Math.abs(r.totalFee - 0.2) < 1e-6, `expected 0.2, got ${r.totalFee}`);
  });

  // ───────────────────────── unicorn-execution-engine (topo-sort) ─────
  console.log('unicorn-execution-engine');
  const exec = M('unicorn-execution-engine');
  check('execution topo-sort orders dependencies and finds parallelism', () => {
    const r = exec.execute([
      { id: 'a', duration: 3, deps: [] },
      { id: 'b', duration: 2, deps: ['a'] },
      { id: 'c', duration: 5, deps: ['a'] },
      { id: 'd', duration: 1, deps: ['b', 'c'] },
    ]);
    assert.ok(r.success === true);
    assert.ok(r.wallClockDuration < r.serialDuration, 'parallel wall-clock < serial sum');
    assert.strictEqual(r.order[0], 'a');
    assert.strictEqual(r.order[r.order.length - 1], 'd');
  });
  check('execution detects cyclic dependencies', () => {
    const r = exec.execute([{ id: 'a', deps: ['b'], duration: 1 }, { id: 'b', deps: ['a'], duration: 1 }]);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.error, 'cyclic-dependency');
  });

  // ───────────────────────── energyTrading (merit-order) ──────────────
  console.log('energyTrading');
  const energy = M('energyTrading');
  check('energy merit-order clears at the marginal price', () => {
    const r = energy.clear([], [{ price: 30, mwh: 50 }, { price: 45, mwh: 50 }, { price: 60, mwh: 50 }], 120);
    assert.strictEqual(r.clearedMwh, 120);
    assert.strictEqual(r.marginalPrice, 60); // third (most expensive) unit needed
    assert.ok(r.unmetMwh === 0);
  });

  // ───────────────────────── healthcareAI ─────────────────────────────
  console.log('healthcareAI');
  const health = M('healthcareAI');
  check('healthcare BMI categorizes correctly', () => {
    const r = health.bmi(80, 180);
    assert.ok(r.bmi > 24 && r.bmi < 25, `BMI≈24.7, got ${r.bmi}`);
    assert.strictEqual(r.category, 'normal');
  });
  check('healthcare cardio risk increases with risk factors', () => {
    const low = health.cardioRisk({ age: 25, smoker: false, systolicBP: 110 });
    const high = health.cardioRisk({ age: 65, smoker: true, systolicBP: 170, diabetic: true });
    assert.ok(high.riskScore > low.riskScore, 'more factors → higher risk');
    assert.strictEqual(high.band, 'high');
  });

  // ───────────────────────── web3Identity ─────────────────────────────
  console.log('web3Identity');
  const w3 = M('web3Identity');
  check('web3 validates EVM and Bitcoin addresses, rejects junk', () => {
    assert.ok(w3.isEvmAddress('0x52908400098527886E0F7030069857D2E4169EE7'));
    assert.ok(w3.isBitcoinAddress('bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'));
    assert.ok(!w3.isEvmAddress('0x123'));
    assert.ok(!w3.isBitcoinAddress('not-an-address'));
  });
  check('web3 fingerprint is deterministic and DID is derived', () => {
    const a = w3.fingerprint('0x52908400098527886E0F7030069857D2E4169EE7');
    const b = w3.fingerprint('0x52908400098527886E0F7030069857D2E4169EE7');
    assert.strictEqual(a, b);
    assert.ok(w3.did('0x52908400098527886E0F7030069857D2E4169EE7').startsWith('did:unicorn:evm:'));
  });

  // ───────────────────── contract sanity across all 22 ────────────────
  console.log('module contract (getStatus on all populated modules)');
  const slugs = [
    'analytics', 'ab-testing', 'content-ai', 'auto-trend-analyzer', 'performance-monitor',
    'seo-optimizer', 'security-scanner', 'swarm-intelligence', 'autonomous-wealth-engine',
    'autonomous-bd-engine', 'auto-marketing', 'self-adaptation-engine', 'self-documenter',
    'site-creator', 'unicorn-realization-engine', 'unicorn-super-intelligence',
    'universal-adaptor', 'universal-interchain-nexus', 'unicorn-execution-engine',
    'energyTrading', 'healthcareAI', 'web3Identity',
  ];
  for (const slug of slugs) {
    const mod = M(slug);
    check(`${slug} exposes process() + getStatus()`, () => {
      assert.strictEqual(typeof mod.process, 'function', `${slug}.process`);
      assert.strictEqual(typeof mod.getStatus, 'function', `${slug}.getStatus`);
      const st = mod.getStatus();
      assert.ok(st && typeof st === 'object', `${slug}.getStatus returns object`);
    });
  }

  console.log(`\n✅ engine-core.test.js: ${passed} checks passed`);
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ engine-core.test.js FAILED:', err && err.stack || err);
  process.exit(1);
});
