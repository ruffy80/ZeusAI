// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.348Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const registry = new Map();

function register(input = {}) {
  const name = String(input.name || '').trim();
  const version = String(input.version || '0.0.1').trim();
  if (!name) throw new Error('name required');
  const item = {
    name,
    version,
    contract: input.contract || {},
    createdAt: new Date().toISOString(),
  };
  const arr = registry.get(name) || [];
  arr.push(item);
  registry.set(name, arr);
  return { ok: true, item };
}

function list() {
  const out = {};
  for (const [k, v] of registry.entries()) out[k] = v;
  return { ok: true, modules: out };
}

function compatMatrix() {
  const out = {};
  for (const [k, v] of registry.entries()) out[k] = v.map((x) => x.version);
  return { ok: true, matrix: out };
}

function resolve(name, _range) {
  const arr = registry.get(String(name)) || [];
  return { ok: true, name: String(name), resolved: arr.length ? arr[arr.length - 1] : null };
}

register({ name: 'social-orchestrator', version: '1.0.0', contract: { status: 'v1' } });

module.exports = { register, list, compatMatrix, resolve };
