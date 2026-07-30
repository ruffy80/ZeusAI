'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function isoNow() {
  return new Date().toISOString();
}

function sha256(input) {
  return crypto.createHash('sha256')
    .update(typeof input === 'string' ? input : JSON.stringify(input))
    .digest('hex');
}

function dataRoot() {
  return process.env.WORLD_STANDARD_DATA_DIR
    || path.join(
      process.env.UNICORN_COMMERCE_DIR
        || path.resolve(__dirname, '..', '..', '..', 'data'),
      'world-standard'
    );
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* ok */ }
  return dir;
}

function moduleDir(name) {
  return ensureDir(path.join(dataRoot(), name));
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

function ringPush(arr, item, max) {
  arr.push(item);
  while (arr.length > max) arr.shift();
  return arr;
}

function envTruthy(name) {
  const v = String(process.env[name] || '').trim();
  return v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}

function envNonEmpty(name) {
  return String(process.env[name] || '').trim() !== '';
}

function ownerBtc() {
  return process.env.BTC_OWNER_WALLET
    || process.env.BTC_WALLET_ADDRESS
    || process.env.OWNER_BTC_ADDRESS
    || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
}

module.exports = {
  isoNow,
  sha256,
  dataRoot,
  ensureDir,
  moduleDir,
  readJson,
  writeJson,
  ringPush,
  envTruthy,
  envNonEmpty,
  ownerBtc,
};
