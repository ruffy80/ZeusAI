'use strict';

/**
 * MODULE BOND — MBD/1.0
 *
 * The joins that must resolve for Unicorn organs to work together.
 * A catch that hides a missing require is not a working join.
 * This list does not invent customer products. The shelf remains the offer.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MBD/1.0';
const ROOT = path.join(__dirname, '..', '..');

const EDGES = Object.freeze([
  {
    from: 'backend/modules/immortality-continuum-protocol.js',
    spec: './never-down-kernel',
    work: 'Commerce pressure reads the kernel that sits in the same folder.',
  },
  {
    from: 'backend/modules/immortality/continuity-attestation-chain.js',
    spec: '../never-down-kernel',
    work: 'The attestation chain reads the same kernel from the immortality folder.',
  },
  {
    from: 'src/site/v2/fulfillment-engine.js',
    spec: '../../../backend/modules/fulfillment-ai-os',
    work: 'The buyer file calls the fulfillment organ for the six text offers.',
  },
  {
    from: 'src/site/v2/fulfillment-engine.js',
    spec: '../../../backend/modules/aiProviders',
    work: 'That organ calls the provider layer.',
  },
  {
    from: 'src/site/v2/sell-surface.js',
    spec: '../../commerce/universal-payment-rails',
    work: 'The fallback buy card uses the payment-rail label.',
  },
  {
    from: 'src/site/v2/sell-surface.js',
    spec: '../../commerce/public-shelf',
    work: 'The buy card reads the public shelf first.',
  },
  {
    from: 'src/commerce/public-shelf.js',
    spec: '../../backend/modules/dynamic-pricing',
    work: 'The shelf price reads the pricing organ.',
  },
  {
    from: 'src/commerce/dial-attributed-money-continuum.js',
    spec: '../../backend/modules/telegram-mobdial-os',
    work: 'Dial attribution reads the telegram desk.',
  },
]);

function _used(src, spec) {
  const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp("require\\(\\s*['\"]" + escaped + "['\"]\\s*\\)").test(src);
}

function _exists(fromAbs, spec) {
  const base = path.resolve(path.dirname(fromAbs), spec);
  return [base, base + '.js', path.join(base, 'index.js')].some((cand) => fs.existsSync(cand));
}

function audit() {
  const edges = EDGES.map((edge) => {
    const fromAbs = path.join(ROOT, edge.from);
    let src = '';
    try { src = fs.readFileSync(fromAbs, 'utf8'); } catch (_) { src = ''; }
    const used = _used(src, edge.spec);
    const exists = _exists(fromAbs, edge.spec);
    return {
      from: edge.from,
      spec: edge.spec,
      work: edge.work,
      used,
      exists,
      ok: used && exists,
    };
  });
  return {
    ok: edges.every((edge) => edge.ok),
    protocol: PROTOCOL,
    inventsServices: false,
    edges,
  };
}

module.exports = { PROTOCOL, EDGES, audit };
