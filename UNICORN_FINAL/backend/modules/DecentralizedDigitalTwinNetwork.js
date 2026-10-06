'use strict';

/**
 * DecentralizedDigitalTwinNetwork — in-process twin graph.
 * Nodes keep state, links allow a sync, and a snapshot can move to another
 * process. This is not a planetary twin grid.
 */

const crypto = require('crypto');

const nodes = new Map();
const links = new Set();

function _hash(state) {
  return crypto.createHash('sha256').update(JSON.stringify(state == null ? {} : state)).digest('hex');
}

function upsert(id, state) {
  const nodeId = String(id || '').slice(0, 80);
  if (!nodeId) return { ok: false, reason: 'missing_id', claimsPlanetaryGrid: false };
  const prev = nodes.get(nodeId);
  const record = {
    id: nodeId,
    state: state == null ? {} : state,
    hash: _hash(state),
    version: prev ? prev.version + 1 : 1,
    updatedAt: new Date().toISOString(),
  };
  nodes.set(nodeId, record);
  return {
    ok: true,
    node: { id: record.id, hash: record.hash, version: record.version },
    claimsPlanetaryGrid: false,
  };
}

function link(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (!nodes.has(x) || !nodes.has(y) || x === y) {
    return { ok: false, reason: 'unknown_node', claimsPlanetaryGrid: false };
  }
  const key = [x, y].sort().join('|');
  links.add(key);
  return { ok: true, link: key, claimsPlanetaryGrid: false };
}

function sync(from, to) {
  const key = [String(from || ''), String(to || '')].sort().join('|');
  if (!links.has(key)) return { ok: false, reason: 'not_linked', claimsPlanetaryGrid: false };
  const src = nodes.get(String(from || ''));
  if (!src) return { ok: false, reason: 'unknown_node', claimsPlanetaryGrid: false };
  return upsert(to, src.state);
}

function snapshot() {
  return {
    ok: true,
    nodes: [...nodes.values()],
    links: [...links],
    claimsPlanetaryGrid: false,
  };
}

function restore(snap) {
  const body = snap && typeof snap === 'object' ? snap : {};
  nodes.clear();
  links.clear();
  for (const node of Array.isArray(body.nodes) ? body.nodes : []) {
    if (node && node.id) nodes.set(String(node.id), node);
  }
  for (const key of Array.isArray(body.links) ? body.links : []) links.add(String(key));
  return { ok: true, nodes: nodes.size, links: links.size, claimsPlanetaryGrid: false };
}

function process(body) {
  const input = body && typeof body === 'object' ? body : {};
  if (input.op === 'link') return link(input.a, input.b);
  if (input.op === 'sync') return sync(input.from, input.to);
  if (input.op === 'snapshot') return snapshot();
  if (input.op === 'restore') return restore(input.snapshot);
  return upsert(input.id, input.state);
}

function getStatus() {
  return {
    ok: true,
    name: 'DecentralizedDigitalTwinNetwork',
    nodes: nodes.size,
    links: links.size,
    claimsPlanetaryGrid: false,
  };
}

module.exports = {
  upsert, link, sync, snapshot, restore, process, getStatus,
  name: 'DecentralizedDigitalTwinNetwork',
};
