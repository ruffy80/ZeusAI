'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function tplEmit(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) { out += s[i + 1]; i++; }
    else out += s[i];
  }
  return out;
}

const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const m = src.match(/const dropshipCheckoutJs = `([\s\S]*?)`;\n\n {4}if \(urlPath === '\/dropship'\)/);
assert.ok(m, 'checkout js template');
const a = src.indexOf('const js = dropshipCheckoutJs + `');
const b = src.indexOf('`;\n      try { res.writeHead(200', a);
assert.ok(a > 0 && b > a, 'catalog js template');
const cat = src.slice(a + 'const js = dropshipCheckoutJs + `'.length, b);
const full = tplEmit(m[1]) + tplEmit(cat);
assert.ok(!full.includes('/^https?:///i'), 'must not emit broken https regex');
assert.ok(full.includes('refreshCatalog'), 'refreshCatalog present');
assert.ok(full.includes('indexOf("https://")'), 'template-safe URL check');
const tmp = path.join(__dirname, '../.tmp-dropship-page-script.js');
fs.writeFileSync(tmp, full);
const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
try { fs.unlinkSync(tmp); } catch (_) {}
assert.strictEqual(r.status, 0, 'page script must parse: ' + (r.stderr || r.stdout || ''));
console.log('\n✅ dropship-page-script: syntax + https-regex regression guarded');
