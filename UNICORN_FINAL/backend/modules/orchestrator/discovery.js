'use strict';

const fs = require('fs');
const path = require('path');

function defaultModuleRoots() {
  const backendModules = path.resolve(__dirname, '..');
  const topModules = path.resolve(__dirname, '../../../modules');
  const roots = [backendModules];
  if (fs.existsSync(topModules) && path.resolve(topModules) !== path.resolve(backendModules)) {
    try {
      if (fs.realpathSync(topModules) !== fs.realpathSync(backendModules)) {
        roots.push(topModules);
      }
    } catch (_) {
      roots.push(topModules);
    }
  }
  return roots;
}

function scanManifestsRecursive(dir, found = [], depth = 0) {
  if (depth > 3 || !fs.existsSync(dir)) return found;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return found;
  }

  const manifestFile = path.join(dir, 'manifest.json');
  const indexFile = path.join(dir, 'index.js');
  if (depth > 0 && fs.existsSync(manifestFile) && fs.existsSync(indexFile)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      found.push({
        name: manifest.name || path.basename(dir),
        version: manifest.version || '1.0.0',
        description: manifest.description || '',
        dir,
        indexFile,
        manifestPath: manifestFile,
        manifest,
        capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities : [],
        dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : [],
        provides: Array.isArray(manifest.provides) ? manifest.provides : [],
        failureModes: Array.isArray(manifest.failureModes) ? manifest.failureModes : [],
        sla: manifest.sla || null,
        healthCheck: manifest.healthCheck || 'health',
      });
    } catch (_) { /* ignore malformed manifest */ }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    scanManifestsRecursive(path.join(dir, entry.name), found, depth + 1);
  }
  return found;
}

function discoverModules(roots) {
  const searchRoots = Array.isArray(roots) && roots.length > 0 ? roots : defaultModuleRoots();
  const byName = new Map();
  for (const root of searchRoots) {
    const list = scanManifestsRecursive(root, [], 0);
    for (const item of list) {
      if (!byName.has(item.name)) {
        byName.set(item.name, item);
      }
    }
  }
  return [...byName.values()];
}

function buildDependencyGraph(modules) {
  const list = Array.isArray(modules) ? modules : [];
  const nodeMap = new Map();
  for (const m of list) {
    nodeMap.set(m.name, m);
  }

  const nodes = list.map((m) => m.name);
  const edges = [];
  const adj = new Map();
  for (const n of nodes) adj.set(n, []);

  for (const m of list) {
    const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
    for (const dep of deps) {
      if (nodeMap.has(dep)) {
        // dep must initialize before m.name
        edges.push({ from: dep, to: m.name });
        adj.get(dep).push(m.name);
      }
    }
  }

  // Detect cycles using 3-color DFS (0=unvisited, 1=visiting, 2=visited)
  const color = new Map();
  const parent = new Map();
  const cycles = [];

  function dfs(u, stack) {
    color.set(u, 1);
    stack.push(u);
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      const c = color.get(v) || 0;
      if (c === 1) {
        const idx = stack.indexOf(v);
        const cyclePath = stack.slice(idx).concat(v);
        cycles.push(cyclePath);
      } else if (c === 0) {
        parent.set(v, u);
        dfs(v, stack);
      }
    }
    stack.pop();
    color.set(u, 2);
  }

  for (const n of nodes) {
    if ((color.get(n) || 0) === 0) {
      dfs(n, []);
    }
  }

  return {
    nodes,
    edges,
    cycles,
    moduleMap: nodeMap,
  };
}

function topologicalSort(graph) {
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error('Invalid dependency graph');
  }
  if (Array.isArray(graph.cycles) && graph.cycles.length > 0) {
    const formatted = graph.cycles.map((c) => c.join(' -> ')).join('; ');
    throw new Error(`Dependency cycle detected: ${formatted}`);
  }

  const inDegree = new Map();
  const adj = new Map();
  for (const n of graph.nodes) {
    inDegree.set(n, 0);
    adj.set(n, []);
  }
  for (const e of (graph.edges || [])) {
    if (adj.has(e.from) && inDegree.has(e.to)) {
      adj.get(e.from).push(e.to);
      inDegree.set(e.to, inDegree.get(e.to) + 1);
    }
  }

  const queue = [];
  for (const [n, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(n);
  }
  queue.sort();

  const orderNames = [];
  while (queue.length > 0) {
    const u = queue.shift();
    orderNames.push(u);
    for (const v of (adj.get(u) || [])) {
      inDegree.set(v, inDegree.get(v) - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
        queue.sort();
      }
    }
  }

  if (orderNames.length !== graph.nodes.length) {
    throw new Error('Dependency cycle prevented full topological sort');
  }

  if (graph.moduleMap instanceof Map) {
    return orderNames.map((name) => graph.moduleMap.get(name)).filter(Boolean);
  }
  return orderNames;
}

module.exports = {
  discoverModules,
  buildDependencyGraph,
  topologicalSort,
};
