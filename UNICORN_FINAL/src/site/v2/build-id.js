// UNICORN V2 — Per-deploy BUILD_ID (file-mtime based)
// Original work, © Vladoi Ionut. Used as cache-bust token for SW + assets.
'use strict';

const fs = require('fs');
const path = require('path');

const FILES = ['styles.js', 'client.js', 'shell.js', 'sw.js'];

function compute() {
  if (process.env.SW_VERSION) return String(process.env.SW_VERSION);
  // Prefer ZEUS_BUILD_SHA env var (set by CI) for a deploy-stable cache key.
  // Fall back to ZEUS_BUILD_SHA via git, then file-mtime.
  // IMPORTANT: rsync -a preserves mtimes, so mtime alone doesn't change on re-deploy.
  // We mix in the git SHA so every new commit busts the asset cache.
  let gitSha = '';
  try {
    const shaFile = path.join(__dirname, '..', '..', '..', '.build-sha');
    if (fs.existsSync(shaFile)) {
      gitSha = fs.readFileSync(shaFile, 'utf8').trim().slice(0, 7);
    }
  } catch (_) { /* ignore */ }
  if (!gitSha) {
    try {
      gitSha = require('child_process')
        .execSync('git -C ' + path.join(__dirname, '..', '..', '..') + ' rev-parse --short HEAD 2>/dev/null')
        .toString().trim();
    } catch (_) { /* ignore */ }
  }
  if (gitSha) return gitSha;
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
