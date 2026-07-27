'use strict';

/**
 * brand-spectrum-os.test.js — Chromatic Identity Continuum (CIC/1.0)
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'brand-spectrum-os.js');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

check('module exports CIC continuum APIs', () => {
  const m = require(MOD);
  assert.strictEqual(m.PROTOCOL, 'CIC/1.0');
  assert.strictEqual(m.HORIZON_YEAR, 2066);
  assert.ok(typeof m.getStatus === 'function');
  assert.ok(typeof m.getScore === 'function');
  assert.ok(typeof m.getWellKnown === 'function');
});

check('Volt Aurora spectrum has vibrant wordmark tokens', () => {
  const m = require(MOD);
  const s = m.getStatus();
  assert.ok(s.ok);
  assert.strictEqual(s.continuumId, 'volt-aurora');
  assert.ok(s.spectrum.wordmark.zeus.includes('#FF3B5C'));
  assert.ok(s.spectrum.wordmark.ai.includes('#00E8A0'));
  assert.ok(s.cssVars['--cic-zeus-a']);
  assert.ok(s.cssVars['--cic-ai-a']);
  assert.ok(s.score >= 70);
});

check('letterform genome is blade-condensed', () => {
  const m = require(MOD);
  const s = m.getStatus();
  assert.ok(String(s.letterform.genome).includes('blade'));
  assert.ok(s.letterform.optical.bladeCut === true);
  assert.ok(s.mark.targetPx.desktop >= 72);
});

check('horizon pledges 40+ years through 2066', () => {
  const m = require(MOD);
  const wk = m.getWellKnown();
  assert.strictEqual(wk.horizonYear, 2066);
  assert.ok(wk.durabilityYears >= 40);
  assert.ok(Array.isArray(wk.pledge) && wk.pledge.length >= 3);
  assert.ok(wk.discovery.wellKnown.includes('brand-spectrum.json'));
});

check('signs continuum when SITE_SIGN_KEY is present', () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  global.__SITE_SIGN_KEY__ = privateKey;
  delete require.cache[require.resolve(MOD)];
  const m = require(MOD);
  const s = m.getStatus();
  assert.ok(s.signed, 'expected signed continuum');
  assert.ok(s.kid);
  assert.ok(s.signature);
  delete global.__SITE_SIGN_KEY__;
  delete require.cache[require.resolve(MOD)];
});

check('backend + site wire CIC routes', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  assert.ok(idx.includes("require('./modules/brand-spectrum-os')"));
  assert.ok(idx.includes('/api/brand/spectrum'));
  assert.ok(idx.includes('brand-spectrum.json'));
  const site = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  assert.ok(site.includes('brand-spectrum.json'));
  assert.ok(site.includes('/api/brand/spectrum'));
  // Site serves CIC locally so brand continuum survives a dark/old backend.
  assert.ok(site.includes("require('../backend/modules/brand-spectrum-os')"));
});

check('nav wordmark uses Volt Aurora blade letterforms + larger Zeus mark', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
  assert.ok(shell.includes('data-cic="volt-aurora"'));
  assert.ok(shell.includes('brand-176.jpg'));
  assert.ok(shell.includes('width="72"'));
  assert.ok(shell.includes('Zeus<span class="ai">AI</span>'));
  assert.ok(shell.includes('cicPanel') || shell.includes('Chromatic Identity Continuum'));
  const css = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'styles.js'), 'utf8');
  assert.ok(css.includes('#FF3B5C'));
  assert.ok(css.includes('#00E8A0'));
  assert.ok(css.includes('width:72px'));
  assert.ok(css.includes('Avenir Next Condensed') || css.includes('Segoe UI Variable Display'));
  assert.ok(css.includes('font-stretch:condensed') || css.includes('letter-spacing:-.038em'));
});

check('nginx self-heal requires brand-spectrum', () => {
  const patch = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py'), 'utf8');
  assert.ok(patch.includes('location = /.well-known/brand-spectrum.json'));
  const unicorn = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
  assert.ok(unicorn.includes('brand-spectrum.json'));
  const deploy = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy-local.sh'), 'utf8');
  assert.ok(deploy.includes('brand-spectrum.json'));
});

console.log(`\n✅ brand-spectrum-os: ${passed} tests passed`);
