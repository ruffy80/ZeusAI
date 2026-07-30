'use strict';

/**
 * Immortality shared paths — durable cross-process signals.
 * Never claims 100% uptime. Observation + fail-closed commerce only.
 */

const fs = require('fs');
const path = require('path');

function dataRoot() {
  return process.env.IMMORTALITY_DATA_DIR
    || path.join(
      process.env.UNICORN_DATA_DIR
        || path.resolve(__dirname, '..', '..', '..', 'data'),
      'immortality'
    );
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* ok */ }
  return dir;
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function isoNow() {
  return new Date().toISOString();
}

module.exports = {
  dataRoot,
  ensureDir,
  readJson,
  writeJson,
  isoNow,
  paths: {
    dca: () => path.join(dataRoot(), 'deploy-continuum.json'),
    ndkEnvelope: () => path.join(dataRoot(), 'ndk-envelope.json'),
    edgeBond: () => path.join(dataRoot(), 'edge-bond.json'),
    pressure: () => path.join(dataRoot(), 'commerce-pressure.json'),
  },
};
