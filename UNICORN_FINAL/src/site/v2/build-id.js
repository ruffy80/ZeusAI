// UNICORN V2 — Per-deploy BUILD_ID (file-mtime based)
// Original work, © Vladoi Ionut. Used as cache-bust token for SW + assets.
'use strict';

const fs = require('fs');
const path = require('path');

const FILES = ['styles.js', 'client.js', 'shell.js', 'sw.js'];

function compute() {
  if (process.env.SW_VERSION) return String(process.env.SW_VERSION);
  let m = 0;
  for (const f of FILES) {
    try {
      const st = fs.statSync(path.join(__dirname, f));
      if (st.mtimeMs > m) m = st.mtimeMs;
    } catch (_) { /* ignore */ }
  }
  if (!m) m = Date.now();
  // base36 for compactness, e.g. "lq8f3xz1"
  return Math.floor(m).toString(36);
}

let _id = compute();

module.exports = {
  get BUILD_ID() { return _id; },
  refresh() { _id = compute(); return _id; }
};
