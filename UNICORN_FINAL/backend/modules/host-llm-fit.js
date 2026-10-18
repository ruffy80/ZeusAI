'use strict';

/**
 * HOST LLM FIT — HLF/1.0
 *
 * Picks a local Ollama model this machine can keep loaded beside the
 * commerce processes. An 8B weight file is about 4.7GB. On an 8GB host
 * with the site and the backend already resident, loading it swaps and
 * the kernel can kill Node. The 3B Q4 model is the largest that leaves
 * headroom. The prompt is the public shelf, not a second catalog.
 */

const fs = require('fs');
const os = require('os');

const PROTOCOL = 'HLF/1.0';
const SAFE_MODEL = 'llama3.2:3b-instruct-q4_K_M';
const HEADROOM_MB = 1800;
const SMALL_HOST_MB = 12000;
const SMALL_HOST_RUNTIME_CAP_MB = 3200;

const WEIGHT_MB = {
  'llama3.2:1b': 1300,
  'llama3.2:3b': 2000,
  'llama3.2:3b-instruct-q4_K_M': 2000,
  'llama3:latest': 4700,
  'llama3.1:8b': 4900,
  'llama3.1:8b-instruct-q4_K_M': 4900,
};

function weightMb(name) {
  const id = String(name || '');
  if (WEIGHT_MB[id]) return WEIGHT_MB[id];
  if (/:1b\b/.test(id)) return 1300;
  if (/:3b\b/.test(id)) return 2000;
  if (/70b|\b8b\b|:latest/.test(id)) return 4900;
  return 8000;
}

function runtimeMb(name) {
  return Math.round(weightMb(name) * 1.25);
}

function availableMB() {
  try {
    const text = fs.readFileSync('/proc/meminfo', 'utf8');
    const match = text.match(/MemAvailable:\s+(\d+)\s+kB/);
    if (match) return Math.round(Number(match[1]) / 1024);
  } catch (_) { /* freemem below */ }
  return Math.round(os.freemem() / 1048576);
}

function selectModel(opts = {}) {
  const requested = String(opts.requested || SAFE_MODEL);
  const totalMB = Number(opts.totalMB);
  const freeMB = Number(opts.availableMB);
  const runtime = runtimeMb(requested);
  const smallHost = !Number.isFinite(totalMB) || totalMB < SMALL_HOST_MB;
  let reason = 'fits';
  if (smallHost && runtime > SMALL_HOST_RUNTIME_CAP_MB) reason = 'host_ram';
  else if (!Number.isFinite(freeMB) || runtime + HEADROOM_MB > freeMB) reason = 'host_ram';
  const base = {
    requested,
    runtimeMB: runtime,
    availableMB: Number.isFinite(freeMB) ? freeMB : null,
    totalMB: Number.isFinite(totalMB) ? totalMB : null,
    headroomMB: HEADROOM_MB,
  };
  if (reason !== 'fits') {
    return Object.assign(base, { model: null, refused: requested, reason });
  }
  return Object.assign(base, { model: requested, refused: null, reason });
}

function decide(requested) {
  const totalMB = Math.round(os.totalmem() / 1048576);
  const choice = selectModel({
    requested: requested || SAFE_MODEL,
    totalMB,
    availableMB: availableMB(),
  });
  return Object.assign({ protocol: PROTOCOL, safeModel: SAFE_MODEL }, choice);
}

function unicornContext(rows) {
  const lines = (Array.isArray(rows) ? rows : []).map((item) => {
    if (!item || !item.id) return '';
    const price = item.priceUsd != null ? `${item.priceUsd} USD` : 'unpriced';
    return [item.id, item.title || '', price, item.clock || '', item.mode || '', item.when || ''].join(' | ');
  }).filter(Boolean);
  return [
    'You are the local Unicorn assistant.',
    'Use only the shelf rows below. Do not invent customers, revenue, a street address, a phone number, or a product that is not in the list.',
    'Bitcoin is the live payment rail. Card and PayPal appear only when checkout shows them.',
    'Dropship is paused. Frontier is research and is not for sale.',
    'ent-engagement-kickoff does not deliver the license, the source, or a private cloud.',
    'Shelf:',
    lines.join('\n') || '(no shelf rows loaded)',
  ].join('\n');
}

function unicornShelfContext() {
  const shelf = require('../../src/commerce/public-shelf');
  return unicornContext(shelf.publicShelf());
}

module.exports = {
  PROTOCOL,
  SAFE_MODEL,
  HEADROOM_MB,
  weightMb,
  runtimeMb,
  selectModel,
  decide,
  unicornContext,
  unicornShelfContext,
};
