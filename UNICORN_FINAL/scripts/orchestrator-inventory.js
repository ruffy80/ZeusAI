'use strict';

/**
 * Static inventory of orchestrator-like modules.
 * Writes fingerprints and ORCHESTRATOR_AUDIT.md.
 * Does not execute the modules and does not delete them.
 *
 *   node scripts/orchestrator-inventory.js [outputDir]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'orchestrator-audit');
const SCAN = [
  path.join(ROOT, 'backend', 'modules'),
  path.join(ROOT, 'src'),
].filter((dir) => fs.existsSync(dir));

const NEEDLE = /orchestrat|scheduler|setInterval|cron|autoRepair|selfHeal|ZeusCore|AutonomousCore/i;

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'data' || name === '.git') continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch (_) { continue; }
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(js|mjs|cjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function fingerprint(file, text) {
  const envs = [];
  const envRe = /process\.env\.([A-Z0-9_]+)/g;
  let m;
  while ((m = envRe.exec(text))) {
    if (!envs.includes(m[1])) envs.push(m[1]);
  }
  const intervals = [];
  const intRe = /setInterval\s*\([^,]+,\s*([0-9_]+)/g;
  while ((m = intRe.exec(text))) intervals.push(Number(String(m[1]).replace(/_/g, '')));
  const side = [];
  if (/writeFile|appendFile|mkdirSync/.test(text)) side.push('file:write');
  if (/https?\.request|fetch\(/.test(text)) side.push('http:request');
  if (/createInvoice|markPaid|db\.|INSERT /.test(text)) side.push('db:write');
  const listeners = [];
  if (/\.on\(\s*['"]/.test(text)) listeners.push('event:on');
  return {
    capability: path.basename(file, path.extname(file)),
    file: rel(file),
    inputs_sample: [],
    output_shape: { note: 'static fingerprint; module was not executed' },
    side_effects: side,
    cron: intervals.length ? ('every ' + intervals.join(',') + ' ms') : null,
    env_vars: envs.slice(0, 20),
    idempotency_keys: [],
    event_listeners: listeners,
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
  };
}

function importers(files, targetRel) {
  const base = path.basename(targetRel, '.js');
  const hits = [];
  const re = new RegExp('require\\([\'"][^\'"]*' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]\\)');
  for (const file of files) {
    if (rel(file) === targetRel) continue;
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    if (re.test(text)) hits.push(rel(file));
  }
  return hits;
}

const files = [];
for (const dir of SCAN) walk(dir, files);
const hits = [];
for (const file of files) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
  if (NEEDLE.test(text) && /orchestrat|ZeusCore|AutonomousCore|autoRepair|selfHeal/i.test(text)) {
    hits.push(file);
  }
}

fs.mkdirSync(path.join(OUT, 'fingerprints'), { recursive: true });
const rows = [];
for (const file of hits) {
  const text = fs.readFileSync(file, 'utf8');
  const fp = fingerprint(file, text);
  const importedBy = importers(files, fp.file);
  fp.imported_by = importedBy;
  const safe = fp.capability.replace(/[^a-z0-9._-]+/gi, '_');
  fs.writeFileSync(path.join(OUT, 'fingerprints', safe + '.json'), JSON.stringify(fp, null, 2));
  rows.push({ fp, importedBy });
}

rows.sort((a, b) => a.importedBy.length - b.importedBy.length);
const lines = [];
lines.push('# Orchestrator audit');
lines.push('');
lines.push('Generated ' + new Date().toISOString() + ' from static reads. Modules were not executed and were not deleted.');
lines.push('');
lines.push('Found: ' + rows.length);
lines.push('');
lines.push('## Conflict table');
lines.push('');
lines.push('| Resource | Orchestrators that mention it |');
lines.push('|---|---|');
const resources = ['setInterval', 'writeFile', 'createInvoice', 'markPaid', 'fetch('];
for (const resource of resources) {
  const owners = rows.filter((row) => fs.readFileSync(path.join(ROOT, row.fp.file), 'utf8').includes(resource)).map((row) => row.fp.capability);
  lines.push('| `' + resource + '` | ' + (owners.slice(0, 12).join(', ') || 'none') + ' |');
}
lines.push('');
lines.push('## Impact graph');
lines.push('');
lines.push('Deleting a file breaks every importer below. Migration order is fewest importers first. Nothing was deleted.');
lines.push('');
for (const row of rows) {
  lines.push('### ' + row.fp.file);
  lines.push('');
  lines.push('Importers: ' + (row.importedBy.length ? row.importedBy.join(', ') : 'none'));
  lines.push('');
}
fs.writeFileSync(path.join(OUT, 'ORCHESTRATOR_AUDIT.md'), lines.join('\n'));
console.log(JSON.stringify({ found: rows.length, out: OUT }));
