/**
 * no-raw-json-cta-guard.test.js
 * Permanent site-wide regression guard: user-facing CTAs must never dump raw
 * JSON into a blank browser tab. Fail CI if forbidden phrases / patterns return.
 *
 * Allowed:
 *   - data-live-inspect="…" buttons/anchors (in-page Live Inspect drawer)
 *   - download / data-allow-raw="1" for intentional file exports
 *   - plain /api-explorer (no ?endpoint=) as a real page route
 *   - comments / docs strings that are not HTML anchors
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'backend', 'modules'),
];

const FORBIDDEN_PHRASES = [
  /Open JSON/i,
  /Open in API Explorer/i,
  /Open continuum JSON/i,
  /Inspect raw JSON/i,
  /JSON\s*→\s*<\/a>/i,
];

// CTA-ish anchors that navigate to JSON surfaces without live-inspect / download.
const CTA_API_HREF = /<a\b[^>]*(?:class="[^"]*\b(?:btn|cta|ds-cta)\b[^"]*"|style="[^"]*font-weight:\s*70[0-9][^"]*"|target="_blank")[^>]*href="(\/api\/[^"]+|\/\.well-known\/[^"]+|\/integrity\.json|\/openapi[^"]*)"[^>]*>/gi;
const CTA_API_HREF_REV = /<a\b[^>]*href="(\/api\/[^"]+|\/\.well-known\/[^"]+|\/integrity\.json|\/openapi[^"]*)"[^>]*(?:class="[^"]*\b(?:btn|cta|ds-cta)\b[^"]*"|style="[^"]*font-weight:\s*70[0-9][^"]*"|target="_blank")[^>]*>/gi;

const ALLOW_FILE_RE = /\.(test|spec)\.js$/i;
const ALLOW_PATH_SNIPS = [
  'node_modules',
  '/data/',
  'live-inspect-bootstrap.js', // contains escaped pattern strings in the bootstrap source
];

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'data' || ent.name === '.git') continue;
      walk(p, out);
    } else if (/\.(js|html|mjs|cjs)$/i.test(ent.name)) {
      out.push(p);
    }
  }
}

function isSkipped(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOW_FILE_RE.test(rel)) return true;
  return ALLOW_PATH_SNIPS.some((s) => rel.includes(s));
}

function violationsIn(src, file) {
  const hits = [];
  // Strip block comments lightly so JSDoc examples don't false-positive phrases.
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  for (const re of FORBIDDEN_PHRASES) {
    re.lastIndex = 0;
    if (re.test(text)) hits.push(`forbidden phrase ${re} in ${path.relative(ROOT, file)}`);
  }

  for (const re of [CTA_API_HREF, CTA_API_HREF_REV]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const tag = m[0];
      if (/\bdownload\b/i.test(tag)) continue;
      if (/data-allow-raw\s*=\s*["']1["']/.test(tag)) continue;
      if (/data-live-inspect\s*=/.test(tag)) continue;
      // wallet.json / binary exports with download are already skipped above.
      hits.push(`raw JSON CTA → ${m[1]} in ${path.relative(ROOT, file)} :: ${tag.slice(0, 140)}`);
    }
  }
  return hits;
}

check('client.js permanently intercepts API/well-known navigations into Live Inspect', () => {
  const client = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'client.js'), 'utf8');
  assert.ok(client.includes('function openLiveInspect'));
  assert.ok(client.includes('data-live-inspect'));
  assert.ok(/isApiSurface/.test(client));
  // Must not require CTA class alone — site-wide intercept for API surfaces.
  assert.ok(client.includes('never navigate the tab to a raw JSON surface')
    || (client.includes('isApiSurface') && client.includes('!isInspectAttr && !isApiSurface')));
});

check('live-inspect bootstrap exists for standalone HTML pages', () => {
  const boot = fs.readFileSync(path.join(ROOT, 'src', 'site', 'live-inspect-bootstrap.js'), 'utf8');
  assert.ok(boot.includes('__zeusLiveInspectBoot'));
  assert.ok(boot.includes('data-live-inspect'));
  assert.ok(typeof require(path.join(ROOT, 'src', 'site', 'live-inspect-bootstrap.js')).scriptTag === 'function');
});

check('repo scan: no forbidden Open-JSON / raw-API CTA patterns in site HTML sources', () => {
  const files = [];
  for (const d of SCAN_DIRS) walk(d, files);
  assert.ok(files.length > 50, 'expected a non-trivial scan corpus');
  const all = [];
  for (const f of files) {
    if (isSkipped(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    all.push(...violationsIn(src, f));
  }
  if (all.length) {
    console.error(all.slice(0, 40).join('\n'));
  }
  assert.strictEqual(all.length, 0, `found ${all.length} raw-JSON CTA regression(s)`);
});

check('index.js protocol pages use data-live-inspect (not blank API tabs)', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  assert.ok(idx.includes('data-live-inspect="/.well-known/world-dropship.json"'));
  assert.ok(idx.includes('data-live-inspect="/api/pomx/exchange"'));
  assert.ok(idx.includes('data-live-inspect="/api/eop/mesh"'));
  assert.ok(idx.includes('data-live-inspect="/api/pre-keys/status"'));
  assert.ok(idx.includes('data-live-inspect="/api/telegram/group-os"'));
  assert.ok(idx.includes('data-live-inspect="/api/catalog/master"'));
  assert.strictEqual((idx.match(/Open JSON/gi) || []).length, 0);
  assert.strictEqual((idx.match(/Inspect raw JSON/gi) || []).length, 0);
});

check('sovereign checkout + enterprise + vertical growth do not open raw JSON CTAs', () => {
  const sov = fs.readFileSync(path.join(ROOT, 'src', 'site', 'sovereign-commerce.js'), 'utf8');
  assert.ok(sov.includes('data-live-inspect="/api/entitlements/'));
  assert.ok(sov.includes('data-live-inspect="/api/delivery/'));
  assert.ok(sov.includes('live-inspect-bootstrap'));
  const ent = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'enterprise-cloud-router.js'), 'utf8');
  assert.ok(ent.includes('data-live-inspect="/api/enterprise/openapi.json"'));
  assert.ok(!/href="\/api\/enterprise\/openapi\.json"[^>]*target="_blank"/.test(ent));
  const vg = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'vertical-growth-page-engine.js'), 'utf8');
  assert.ok(vg.includes('data-live-inspect="/api/uaic/receipts"'));
});

console.log(`✅ no-raw-json-cta-guard: ${passed} tests passed`);
process.exit(0);
