#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const autonomyRoot = process.env.AUTONOMY_ROOT || '/opt/unicorn';
const sandboxRoot = process.env.SANDBOX_ROOT || path.join(autonomyRoot, 'sandbox');
const repoRoot = path.join(sandboxRoot, 'repo');
const outPath = path.join(sandboxRoot, 'dead-code-candidates.json');

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'data') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.(js|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(repoRoot)) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, '[]\n', 'utf8');
    return;
  }
  const files = walk(repoRoot, []);
  const contents = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
  const candidates = [];
  for (const file of files) {
    const stem = path.basename(file).replace(/\.(js|mjs|cjs)$/i, '');
    if (!stem || stem === 'index') continue;
    let refs = 0;
    for (const [otherFile, source] of contents) {
      if (otherFile === file) continue;
      if (source.includes(stem)) refs++;
      if (refs > 0) break;
    }
    if (refs === 0) {
      candidates.push({
        path: path.relative(repoRoot, file).replace(/\\/g, '/'),
        reason: 'no_text_references_outside_self',
      });
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(candidates.slice(0, 50), null, 2) + '\n', 'utf8');
}

main();
