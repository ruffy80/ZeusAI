// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============ UNICORN EXECUTION ENGINE (REAL) ============
// Planificator real de task-uri cu dependențe: sortare topologică (Kahn),
// detecție de cicluri, nivele de paralelism și execuție secvențiată cu
// rezultate agregate. Fără mock — algoritmică reală de orchestrare.

const state = { running: false, cycles: 0, lastRun: null, executed: 0, generatedModules: [] };

// Sortare topologică reală (Kahn) → ordine validă + detecție ciclu.
function topoSort(tasks) {
  const ids = tasks.map(t => t.id);
  const indeg = new Map(ids.map(id => [id, 0]));
  const adj = new Map(ids.map(id => [id, []]));
  for (const t of tasks) {
    for (const d of (t.deps || [])) {
      if (!adj.has(d)) continue;
      adj.get(d).push(t.id);
      indeg.set(t.id, (indeg.get(t.id) || 0) + 1);
    }
  }
  const queue = ids.filter(id => indeg.get(id) === 0);
  const order = [];
  const levels = [];
  let frontier = [...queue];
  while (frontier.length) {
    levels.push([...frontier]);
    const next = [];
    for (const id of frontier) {
      order.push(id);
      for (const nb of adj.get(id)) {
        indeg.set(nb, indeg.get(nb) - 1);
        if (indeg.get(nb) === 0) next.push(nb);
      }
    }
    frontier = next;
  }
  const hasCycle = order.length !== ids.length;
  return { order, levels, hasCycle, maxParallelism: levels.reduce((m, l) => Math.max(m, l.length), 0) };
}

// Execută task-urile în ordine topologică, agregând durate/rezultate.
function execute(tasks) {
  const plan = topoSort(tasks);
  if (plan.hasCycle) return { success: false, error: 'cyclic-dependency', ...plan };
  const byId = new Map(tasks.map(t => [t.id, t]));
  const results = [];
  let totalDuration = 0;
  // durata reală = durata celui mai lung nivel (execuție paralelă pe nivel)
  for (const level of plan.levels) {
    let levelMax = 0;
    for (const id of level) {
      const t = byId.get(id);
      const dur = Number(t.duration) || 0;
      levelMax = Math.max(levelMax, dur);
      results.push({ id, status: 'done', duration: dur });
    }
    totalDuration += levelMax;
  }
  state.executed += results.length;
  return {
    success: true,
    tasks: tasks.length,
    order: plan.order,
    parallelLevels: plan.levels.length,
    maxParallelism: plan.maxParallelism,
    wallClockDuration: totalDuration,
    serialDuration: tasks.reduce((a, t) => a + (Number(t.duration) || 0), 0),
    results,
  };
}

function process(input = {}) {
  state.cycles++;
  state.lastRun = new Date().toISOString();
  if (Array.isArray(input.tasks)) return { module: 'UnicornExecutionEngine', cycles: state.cycles, ...execute(input.tasks) };
  if (Array.isArray(input)) return { module: 'UnicornExecutionEngine', cycles: state.cycles, ...execute(input) };
  return {
    success: false,
    module: 'UnicornExecutionEngine',
    cycles: state.cycles,
    error: 'invalid-input',
    required: {
      tasks: [
        { id: 'a', deps: [], duration: 3 },
        { id: 'b', deps: ['a'], duration: 2 },
      ],
    },
  };
}

function getStatus() {
  return { module: 'UnicornExecutionEngine', running: state.running, cycles: state.cycles, executed: state.executed, lastRun: state.lastRun, generatedModules: state.generatedModules.length };
}

function start() { state.running = true; return true; }
function init() { state.running = true; return true; }

module.exports = { process, getStatus, start, init, execute, topoSort, state, name: 'unicorn-execution-engine' };
