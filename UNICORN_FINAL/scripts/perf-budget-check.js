#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const BUDGETS = [
  { file: 'src/site/v2/shell.js', maxBytes: 320 * 1024 },
  { file: 'src/site/v2/client.js', maxBytes: 560 * 1024 },
  { file: 'src/site/v2/styles.js', maxBytes: 260 * 1024 },
  { file: 'src/index.js', maxBytes: 900 * 1024 },
];

let failed = false;
console.log('== Zeus performance budget (size guard) ==');

for (const b of BUDGETS) {
  const abs = path.join(ROOT, b.file);
  const bytes = fs.statSync(abs).size;
  const ok = bytes <= b.maxBytes;
  const pct = ((bytes / b.maxBytes) * 100).toFixed(1);
  console.log(`${ok ? 'OK ' : 'FAIL'} ${b.file} -> ${bytes} B / budget ${b.maxBytes} B (${pct}%)`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('Performance budget failed: one or more critical files exceeded limits.');
  process.exit(1);
}

console.log('Performance budget passed.');
