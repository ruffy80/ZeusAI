'use strict';
/**
 * viral-unification.test.js — VUK/1.0
 * Single outbound mutex for site autoviralization. No invented reach.
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';
process.env.AACOS_DISABLED = '1';
delete process.env.VUK_DATA_DIR;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'viral-unification-os.js');
const VIRAL = path.join(ROOT, 'backend', 'modules', 'socialMediaViralizer.js');
const OUT = path.join(ROOT, 'backend', 'modules', 'marketing-innovations', 'outbound-publisher.js');
const AACOS = path.join(ROOT, 'backend', 'modules', 'autonomy-action-continuum-os.js');
const AVG = path.join(ROOT, 'backend', 'modules', 'autoViralGrowth.js');
const CVR = path.join(ROOT, 'backend', 'modules', 'growthCausalitySentinel.js');
const TE = path.join(ROOT, 'backend', 'modules', 'traffic-engine.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const NGINX = path.join(ROOT, 'scripts', 'nginx-unicorn.conf');
const SNIP = path.join(ROOT, 'scripts', 'nginx-public-discovery.snippet.conf');
const PATCH = path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py');
const SOV = path.join(ROOT, 'src', 'site', 'sovereign-extensions.js');
const IAK_DISC = path.join(ROOT, 'backend', 'modules', 'iak', 'module-discovery.js');
const PKG = path.join(ROOT, 'package.json');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log('✓', name);
    });
}

console.log('Viral Unification Kernel (VUK/1.0)');

const vuk = require('../backend/modules/viral-unification-os');
vuk._resetForTests();

(async () => {
  await check('module file exists', () => {
    assert.ok(fs.existsSync(MOD), 'viral-unification-os.js missing');
  });

  await check('status never invents humans/reach/gmv', () => {
    const st = vuk.getStatus();
    assert.equal(st.protocol, 'VUK/1.0');
    assert.equal(st.inventsHumans, false);
    assert.equal(st.inventsVisitors, false);
    assert.equal(st.inventsGmv, false);
    assert.equal(st.inventsReach, false);
    assert.equal(st.designatedExecutor, 'socialMediaViralizer');
    assert.ok(Array.isArray(st.organs));
    assert.ok(st.organs.some((o) => o.name === 'socialMediaViralizer' && o.role === 'designated_executor'));
    assert.ok(st.organs.some((o) => o.name === 'autonomy-action-continuum-os' && o.role === 'client'));
  });

  await check('admit first ok, second same channel skipped', () => {
    vuk._resetForTests();
    const a = vuk.admit({ channel: 'x', source: 'viralizer', kind: 'site-viral', contentHash: 'h1' });
    assert.equal(a.ok, true);
    vuk.record({ channel: 'x', source: 'viralizer', kind: 'site-viral', success: true, contentHash: 'h1' });
    const b = vuk.admit({ channel: 'x', source: 'outbound-publisher', kind: 'site-viral', contentHash: 'h1' });
    assert.equal(b.ok, false);
    assert.equal(b.reason, 'unified_dedupe');
    assert.equal(b.previousSource, 'viralizer');
  });

  await check('different channels stay independent', () => {
    vuk._resetForTests();
    vuk.record({ channel: 'telegram', source: 'viralizer', kind: 'site-viral', success: true });
    const a = vuk.admit({ channel: 'discord', source: 'outbound-publisher', kind: 'site-viral' });
    assert.equal(a.ok, true);
  });

  await check('rss is exempt from the mutex', () => {
    vuk._resetForTests();
    const a = vuk.admit({ channel: 'rss', source: 'outbound-publisher', kind: 'site-viral' });
    assert.equal(a.ok, true);
    assert.equal(a.reason, 'exempt');
    const b = vuk.admit({ channel: 'rss', source: 'cvr', kind: 'rss' });
    assert.equal(b.ok, true);
  });

  await check('shouldRunFullCycle: AACOS skipped after viralizer cycle', () => {
    vuk._resetForTests();
    assert.equal(vuk.shouldRunFullCycle('aacos').ok, true, 'first cycle open');
    vuk.noteFullCycle('viralizer');
    const aacos = vuk.shouldRunFullCycle('aacos');
    assert.equal(aacos.ok, false);
    assert.equal(aacos.reason, 'not_designated');
    const viral = vuk.shouldRunFullCycle('viralizer');
    assert.equal(viral.ok, true);
    assert.equal(viral.reason, 'designated_executor');
    assert.equal(vuk.shouldRunFullCycle('autoViralGrowth').ok, false);
    assert.equal(vuk.shouldRunFullCycle('cvr').ok, false);
    assert.equal(vuk.shouldRunFullCycle('aacos', { force: true }).ok, true);
  });

  await check('canonicalizeIntent rewrites homepage dump to /from/x', () => {
    const c = vuk.canonicalizeIntent({
      body: 'ZeusAI Unicorn — autonomous commerce continuum. https://zeusai.pro',
      url: 'https://zeusai.pro',
      platform: 'x',
    }, 'x');
    assert.equal(c.canonical, true);
    assert.ok(c.body.includes('0 paid humans') || c.body.includes('Origin #1') || c.url.includes('/from/x'));
    assert.ok(c.url.includes('/from/x'));
    assert.ok(c.url.includes('utm_source=x'));
    assert.ok(c.url.includes('ref=SGP-X'));
    assert.ok(!/Modulul "/.test(c.body));
  });

  await check('canonicalizeIntent appends tracked URL to unique CVR copy', () => {
    const c = vuk.canonicalizeIntent({
      body: 'Causal hook: checkout starts are starving vs sessions.',
      platform: 'telegram',
    }, 'telegram');
    assert.ok(c.body.includes('Causal hook'));
    assert.ok(c.body.includes('/from/telegram') || c.url.includes('/from/telegram'));
  });

  await check('organs wire admit/canonicalize (source)', () => {
    const viral = fs.readFileSync(VIRAL, 'utf8');
    const out = fs.readFileSync(OUT, 'utf8');
    const aacos = fs.readFileSync(AACOS, 'utf8');
    const avg = fs.readFileSync(AVG, 'utf8');
    const cvr = fs.readFileSync(CVR, 'utf8');
    const te = fs.readFileSync(TE, 'utf8');
    assert.ok(viral.includes('viral-unification-os'));
    assert.ok(viral.includes('noteFullCycle'));
    assert.ok(out.includes('viral-unification-os'));
    assert.ok(out.includes('canonicalizeIntent'));
    assert.ok(aacos.includes('vuk_not_designated') || aacos.includes('shouldRunFullCycle'));
    assert.ok(avg.includes('shouldRunFullCycle'));
    assert.ok(cvr.includes('vuk_not_designated') || cvr.includes('shouldRunFullCycle'));
    assert.ok(te.includes('coalesced') && te.includes('viral-unification-os'));
  });

  await check('backend + site expose well-known viral-unification.json', () => {
    const be = fs.readFileSync(BACKEND_INDEX, 'utf8');
    const site = fs.readFileSync(SITE_INDEX, 'utf8');
    assert.ok(be.includes('/.well-known/viral-unification.json'));
    assert.ok(be.includes('viral-unification-os'));
    assert.ok(site.includes('/.well-known/viral-unification.json'));
    assert.ok(site.includes('viralUnification'));
  });

  await check('homepage + llms + nginx pin VUK', () => {
    const shell = fs.readFileSync(SHELL, 'utf8');
    const sov = fs.readFileSync(SOV, 'utf8');
    const conf = fs.readFileSync(NGINX, 'utf8');
    const snip = fs.readFileSync(SNIP, 'utf8');
    const patch = fs.readFileSync(PATCH, 'utf8');
    assert.ok(shell.includes('homeViralUnification') || shell.includes('VUK/1.0'));
    assert.ok(sov.includes('Viral Unification'));
    assert.ok(/location\s+=\s+\/\.well-known\/viral-unification\.json/.test(conf));
    assert.ok(snip.includes('viral-unification.json'));
    assert.ok(patch.includes('viral-unification.json'));
  });

  await check('IAK stable allowlist + test:chain include VUK', () => {
    const src = fs.readFileSync(IAK_DISC, 'utf8');
    assert.ok(src.includes('viral-unification-os'));
    const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
    assert.ok(String(pkg.scripts['test:chain']).includes('viral-unification.test.js'));
  });

  await check('IndexNow coalesce skips second default ping', async () => {
    vuk._resetForTests();
    const firstGate = vuk.admit({ channel: 'indexnow', source: 'traffic-engine', kind: 'indexnow' });
    assert.equal(firstGate.ok, true);
    vuk.record({ channel: 'indexnow', source: 'traffic-engine', kind: 'indexnow', success: true });
    const te = require('../backend/modules/traffic-engine');
    const second = await te.pingAll({ dryRun: false });
    assert.equal(second.coalesced, true);
    assert.equal(second.skipped, true);
    assert.equal(second.reason, 'unified_dedupe');
  });

  await check('AACOS skip when not designated (no double blast)', async () => {
    vuk._resetForTests();
    vuk.noteFullCycle('viralizer');
    process.env.AACOS_DISABLED = '1';
    const aacos = require('../backend/modules/autonomy-action-continuum-os');
    const r = await aacos.tick({ source: 'aacos', force: false });
    assert.equal(r.ok, true);
    assert.ok(r.drain);
    assert.equal(r.drain.reason, 'vuk_not_designated');
    assert.equal(r.drain.via, 'viral-unification-os');
  });

  await check('discovery inventsReach false + organs listed', () => {
    const d = vuk.discovery();
    assert.equal(d.ok, true);
    assert.equal(d.inventsReach, false);
    assert.equal(d.copyContract, 'SGP/1.0');
    assert.ok(d.urls.some((u) => String(u).includes('viral-unification.json')));
  });

  console.log('\n✅ viral-unification: ' + passed + ' tests passed');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
