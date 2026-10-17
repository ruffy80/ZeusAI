'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

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

const patchPath = path.join(__dirname, '../scripts/nginx-patch-public-discovery.py');
const patch = fs.readFileSync(patchPath, 'utf8');

check('the discovery patcher names the HTML files the static regex would hide', () => {
  assert.ok(patch.includes('location = /google4757746388248111.html'));
  assert.ok(patch.includes('location = /offline.html'));
  assert.ok(patch.includes('already'));
});

check('a location the vhost already has is not copied into the snippet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-edge-'));
  const snippet = path.join(dir, 'snip.conf');
  fs.writeFileSync(snippet, '# existing\nlocation = /.well-known/merchant.json {\n}\n');
  const site = [
    'location = /.well-known/zeusai.json {',
    '    proxy_pass http://127.0.0.1:3001;',
    '}',
    'location ~* \\.html$ {',
    '    add_header Cache-Control "no-store" always;',
    '}',
  ].join('\n');
  const runner = path.join(dir, 'run.py');
  fs.writeFileSync(runner, [
    'import importlib.util',
    'spec = importlib.util.spec_from_file_location("patch", ' + JSON.stringify(patchPath) + ')',
    'mod = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(mod)',
    'n = mod._ensure_required_locations(' + JSON.stringify(snippet) + ', ' + JSON.stringify(site) + ')',
    'text = open(' + JSON.stringify(snippet) + ').read()',
    'assert "location = /google4757746388248111.html" in text',
    'assert "location = /offline.html" in text',
    'assert "location = /.well-known/zeusai.json" not in text',
    'assert n >= 2',
    'print("appended", n)',
  ].join('\n'));
  const out = spawnSync('python3', [runner], { encoding: 'utf8' });
  if (out.status !== 0) {
    throw new Error(out.stderr || out.stdout || 'python failed');
  }
  assert.ok(out.stdout.includes('appended'));
});

console.log('✅ html-edge-exact: ' + passed + ' tests passed');
process.exit(0);
