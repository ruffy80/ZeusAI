#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'logs') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }

function runNodeCheck(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`syntax_check_failed ${rel(file)}\n${(result.stderr || result.stdout || '').trim()}`);
  }
}

function resolveRelativeRequire(file, spec) {
  const base = path.resolve(path.dirname(file), spec);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.json`,
    path.join(base, 'index.js'),
    path.join(base, 'index.json'),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function checkRequires(file, source) {
  const patterns = [
    /require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g,
    /import\s+(?:[^'";]+\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      const spec = match[1];
      if (spec.includes('${')) {
        warn(`dynamic_relative_module ${rel(file)} -> ${spec}`);
        continue;
      }
      if (!resolveRelativeRequire(file, spec)) {
        const nearby = source.slice(Math.max(0, match.index - 160), Math.min(source.length, match.index + 220));
        const guardedOptional = /try\s*\{[\s\S]*$/.test(nearby.slice(0, nearby.indexOf(match[0]) + match[0].length)) && /catch\b/.test(nearby);
        if (guardedOptional) warn(`optional_missing_relative_module ${rel(file)} -> ${spec}`);
        else warn(`missing_relative_module_runtime_checked_by_canary ${rel(file)} -> ${spec}`);
      }
    }
  }
}

function checkGlobalApiFallback(file, source) {
  const appUseBlocks = source.match(/app\.use\s*\([\s\S]{0,900}?\}\s*\)\s*;?/g) || [];
  for (const block of appUseBlocks) {
    const catchesAllApi = /req\.(?:path|url|originalUrl)\.startsWith\(\s*['"]\/api\//.test(block);
    const returns404 = /status\(\s*404\s*\)|writeHead\(\s*404/.test(block);
    const hasScopedPrefixes = /Prefixes|prefixes|some\(\s*\(?\s*prefix/.test(block);
    if (catchesAllApi && returns404 && !hasScopedPrefixes) {
      fail(`unsafe_global_api_404_fallback ${rel(file)} — scope fallback to owned route prefixes only`);
    }
  }
}

function checkEcosystem() {
  const ecosystem = path.join(root, 'ecosystem.config.js');
  if (!fs.existsSync(ecosystem)) return fail('missing ecosystem.config.js');
  const source = fs.readFileSync(ecosystem, 'utf8');
  const required = ['unicorn-backend', 'unicorn-site', 'autoscaler'];
  for (const name of required) {
    if (!source.includes(`name: '${name}'`) && !source.includes(`name: \"${name}\"`)) {
      fail(`ecosystem_missing_pm2_app ${name}`);
    }
  }
  if (!source.includes('QIS_REQUIRED_PROCESSES')) {
    fail('ecosystem_missing_QIS_REQUIRED_PROCESSES');
  }
  if (/unicorn-guardian/.test(source) && /QIS_REQUIRED_PROCESSES[^\n]+unicorn-guardian/.test(source)) {
    fail('ecosystem_requires_disabled_unicorn_guardian');
  }
}

function checkCriticalRoutes() {
  const backend = path.join(root, 'backend/index.js');
  if (!fs.existsSync(backend)) return fail('missing backend/index.js');
  const source = fs.readFileSync(backend, 'utf8');
  const critical = [
    "app.get('/health'",
    "app.get('/api/health'",
    "app.get('/api/quantum-integrity/status'",
  ];
  for (const needle of critical) {
    if (!source.includes(needle)) fail(`missing_critical_route ${needle}`);
  }
}

function main() {
  const files = walk(path.join(root, 'backend')).concat(walk(path.join(root, 'src'))).filter((file) => file.endsWith('.js'));
  files.push(path.join(root, 'ecosystem.config.js'));
  const uniqueFiles = [...new Set(files)].filter((file) => fs.existsSync(file));

  for (const file of uniqueFiles) {
    const source = fs.readFileSync(file, 'utf8');
    runNodeCheck(file);
    checkRequires(file, source);
    checkGlobalApiFallback(file, source);
  }
  checkEcosystem();
  checkCriticalRoutes();

  const report = {
    ok: failures.length === 0,
    checkedFiles: uniqueFiles.length,
    failures,
    warnings,
    generatedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exit(1);
}

main();
