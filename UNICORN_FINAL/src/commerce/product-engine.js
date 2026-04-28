// commerce/product-engine.js
// Reads order deliverables from the per-order folder under logs/deliverables/<orderId>/.
// Strict path sandboxing: filename must not contain separators, "..", or NUL.
//
// readDeliverable(orderId, filename) → Buffer
//   Throws on missing or out-of-sandbox access.

const fs = require('fs');
const path = require('path');

const ROOT = process.env.UNICORN_DELIVERABLES_DIR || path.join(__dirname, '..', '..', 'logs', 'deliverables');

function safeName(name) {
  const s = String(name || '');
  if (!s) throw new Error('filename_required');
  if (s.includes('\0')) throw new Error('forbidden_filename');
  if (s.includes('/') || s.includes('\\')) throw new Error('forbidden_filename');
  if (s === '.' || s === '..' || s.startsWith('..')) throw new Error('forbidden_filename');
  if (s.length > 200) throw new Error('forbidden_filename');
  return s;
}
function safeId(id) {
  const s = String(id || '');
  if (!/^[A-Za-z0-9_\-:.]{1,80}$/.test(s)) throw new Error('forbidden_orderId');
  return s;
}

function deliverableDir(orderId) {
  return path.join(ROOT, safeId(orderId));
}

function readDeliverable(orderId, filename) {
  const dir = deliverableDir(orderId);
  const file = path.join(dir, safeName(filename));
  // Final realpath sanity: file must live under dir (no symlink escape).
  const rDir = fs.realpathSync(dir);
  let rFile;
  try { rFile = fs.realpathSync(file); }
  catch (_) { throw new Error('deliverable_not_found'); }
  if (!rFile.startsWith(rDir + path.sep) && rFile !== rDir) {
    throw new Error('forbidden_path');
  }
  return fs.readFileSync(rFile);
}

function listDeliverables(orderId) {
  const dir = deliverableDir(orderId);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name);
  } catch (_) { return []; }
}

function writeDeliverable(orderId, filename, content) {
  const dir = deliverableDir(orderId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, safeName(filename));
  fs.writeFileSync(file, content);
  return file;
}

module.exports = { readDeliverable, listDeliverables, writeDeliverable, deliverableDir };
