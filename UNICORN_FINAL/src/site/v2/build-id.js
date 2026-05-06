// UNICORN V2 — Per-deploy BUILD_ID (file-mtime based)
// Original work, © Vladoi Ionut. Used as cache-bust token for SW + assets.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILES = ['styles.js', 'client.js', 'shell.js', 'sw.js'];
const VERSIONED_FILE_ASSETS = {
  '/assets/app.js': path.join(__dirname, 'client.js'),
  '/assets/aeon.js': path.join(__dirname, 'aeon.js'),
  '/assets/vendor/three.min.js': path.join(__dirname, 'assets', 'vendor', 'three.min.js'),
  '/assets/zeus/hero.jpg': path.join(__dirname, 'assets', 'hero.jpg'),
  '/assets/zeus/hero-640.jpg': path.join(__dirname, 'assets', 'hero-640.jpg'),
  '/assets/zeus/hero-640.webp': path.join(__dirname, 'assets', 'hero-640.webp'),
  '/assets/zeus/hero-640.avif': path.join(__dirname, 'assets', 'hero-640.avif'),
  '/assets/zeus/brand.jpg': path.join(__dirname, 'assets', 'brand.jpg'),
  '/assets/zeus/brand-88.jpg':  path.join(__dirname, 'assets', 'brand-88.jpg'),
  '/assets/zeus/brand-88.webp': path.join(__dirname, 'assets', 'brand-88.webp'),
  '/assets/zeus/brand-88.avif': path.join(__dirname, 'assets', 'brand-88.avif'),
  '/assets/zeus/brand-176.jpg':  path.join(__dirname, 'assets', 'brand-176.jpg'),
  '/assets/zeus/brand-176.webp': path.join(__dirname, 'assets', 'brand-176.webp'),
  '/assets/zeus/brand-176.avif': path.join(__dirname, 'assets', 'brand-176.avif'),
  '/assets/zeus/brand-264.jpg':  path.join(__dirname, 'assets', 'brand-264.jpg'),
  '/assets/zeus/brand-264.webp': path.join(__dirname, 'assets', 'brand-264.webp'),
  '/assets/zeus/brand-264.avif': path.join(__dirname, 'assets', 'brand-264.avif'),
  '/assets/zeus/placeholder.svg': path.join(__dirname, 'assets', 'placeholder.svg'),
  '/assets/icons/favicon-32.png': path.join(__dirname, 'assets', 'icons', 'favicon-32.png'),
  '/assets/icons/icon-192.png': path.join(__dirname, 'assets', 'icons', 'icon-192.png'),
  '/assets/icons/icon-512.png': path.join(__dirname, 'assets', 'icons', 'icon-512.png'),
  '/assets/icons/icon-maskable-512.png': path.join(__dirname, 'assets', 'icons', 'icon-maskable-512.png'),
  '/assets/icons/apple-touch-icon.png': path.join(__dirname, 'assets', 'icons', 'apple-touch-icon.png'),
  '/assets/icons/og-default.png': path.join(__dirname, 'assets', 'icons', 'og-default.png')
};
const VERSIONED_INLINE_ASSETS = {
  '/assets/app.css': () => require('./styles').CSS
};

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

function readAssetSource(logicalPath) {
  if (VERSIONED_INLINE_ASSETS[logicalPath]) {
    return Buffer.from(String(VERSIONED_INLINE_ASSETS[logicalPath]() || ''), 'utf8');
  }
  const filePath = VERSIONED_FILE_ASSETS[logicalPath];
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

function assetHash(logicalPath) {
  const payload = readAssetSource(logicalPath);
  if (!payload) {
    return String(_id || 'latest').replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase() || 'latest';
  }
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 10);
}

function assetPath(logicalPath) {
  if (!logicalPath || /^https?:\/\//i.test(logicalPath)) return logicalPath;
  const ext = path.posix.extname(logicalPath);
  if (!ext) return logicalPath;
  const base = logicalPath.slice(0, -ext.length);
  return `${base}.${assetHash(logicalPath)}${ext}`;
}

function versionedAssetEntries() {
  const entries = {};
  for (const logicalPath of Object.keys(VERSIONED_INLINE_ASSETS).concat(Object.keys(VERSIONED_FILE_ASSETS))) {
    entries[logicalPath] = assetPath(logicalPath);
  }
  return entries;
}

function resolveAssetPath(requestPath) {
  if (!requestPath) return requestPath;
  const entries = versionedAssetEntries();
  for (const logicalPath of Object.keys(entries)) {
    if (entries[logicalPath] === requestPath) return logicalPath;
  }
  return requestPath;
}

function browserAssetManifest() {
  return {
    hero: assetPath('/assets/zeus/hero.jpg'),
    brand: assetPath('/assets/zeus/brand.jpg'),
    placeholder: assetPath('/assets/zeus/placeholder.svg'),
    icon192: assetPath('/assets/icons/icon-192.png'),
    icon512: assetPath('/assets/icons/icon-512.png'),
    og: assetPath('/assets/icons/og-default.png'),
    css: assetPath('/assets/app.css'),
    app: assetPath('/assets/app.js'),
    aeon: assetPath('/assets/aeon.js'),
    three: assetPath('/assets/vendor/three.min.js')
  };
}

module.exports = {
  get BUILD_ID() { return _id; },
  refresh() { _id = compute(); return _id; },
  assetHash,
  assetPath,
  browserAssetManifest,
  resolveAssetPath,
  versionedAssetEntries
};
