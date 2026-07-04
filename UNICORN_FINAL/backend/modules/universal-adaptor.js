// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============== UNIVERSAL ADAPTOR ENGINE (REAL) ==============
// Transformări reale de structuri de date: flatten/unflatten, remapare de
// chei, coerciție de tipuri, normalizare. Utilitar determinist, fără mock.

const { createEngine } = require('./engine-core');

function flatten(obj, prefix = '', out = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = v;
    }
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [path, value] of Object.entries(flat || {})) {
    const keys = path.split('.');
    let node = out;
    for (let i = 0; i < keys.length - 1; i++) {
      node[keys[i]] = node[keys[i]] || {};
      node = node[keys[i]];
    }
    node[keys[keys.length - 1]] = value;
  }
  return out;
}

// Remapare reală de chei după un dicționar {sursa: destinatie}.
function remap(obj, mapping) {
  const out = {};
  for (const [from, to] of Object.entries(mapping || {})) {
    if (obj[from] !== undefined) out[to] = obj[from];
  }
  return out;
}

// Coerciție reală de tipuri după o schemă {camp: 'number'|'boolean'|'string'|'date'}.
function coerce(obj, schema) {
  const out = { ...obj };
  for (const [field, type] of Object.entries(schema || {})) {
    if (out[field] === undefined) continue;
    const v = out[field];
    switch (type) {
      case 'number': out[field] = Number(v); break;
      case 'boolean': out[field] = v === true || v === 'true' || v === 1 || v === '1'; break;
      case 'string': out[field] = String(v); break;
      case 'date': out[field] = new Date(v).toISOString(); break;
      default: break;
    }
  }
  return out;
}

function adaptorWork(input = {}) {
  const op = input.op || 'flatten';
  const data = input.data ?? input.payload ?? {};
  switch (op) {
    case 'flatten': return { op, result: flatten(data) };
    case 'unflatten': return { op, result: unflatten(data) };
    case 'remap': return { op, result: remap(data, input.mapping) };
    case 'coerce': return { op, result: coerce(data, input.schema) };
    case 'pipeline': {
      let r = data;
      if (input.mapping) r = remap(r, input.mapping);
      if (input.schema) r = coerce(r, input.schema);
      return { op, result: r };
    }
    default: return { op: 'flatten', result: flatten(data) };
  }
}

const engine = createEngine('universal-adaptor', { label: 'Universal Adaptor', category: 'infrastructure', work: adaptorWork });
module.exports = {
  name: 'universal-adaptor',
  process: (input, ctx) => engine.process(input, ctx),
  flatten, unflatten, remap, coerce,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
