'use strict';
/**
 * social-gravity.test.js — SGP/1.0
 * Tracked social→origin landings. No invented reach or humans.
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';
delete process.env.SGP_DATA_DIR;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'social-gravity-os.js');
const VIRAL = path.join(ROOT, 'backend', 'modules', 'socialMediaViralizer.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const NGINX = path.join(ROOT, 'scripts', 'nginx-unicorn.conf');
const SOV = path.join(ROOT, 'src', 'site', 'sovereign-extensions.js');
const SEO = path.join(ROOT, 'src', 'seo', 'sitemap-helpers.js');
const TRAFFIC = path.join(ROOT, 'backend', 'modules', 'traffic-engine.js');
const IAK_DISC = path.join(ROOT, 'backend', 'modules', 'iak', 'module-discovery.js');
const PKG = path.join(ROOT, 'package.json');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

console.log('Social Gravity Protocol (SGP/1.0)');

const sgp = require('../backend/modules/social-gravity-os');
sgp._resetForTests();

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD), 'social-gravity-os.js missing');
});

check('composePost Origin #1 copy has tracked /from/x URL and no random module names', () => {
  const post = sgp.composePost('x');
  assert.equal(post.channel, 'x');
  assert.ok(post.text.includes('0 paid humans') || post.text.includes('Origin #1'));
  assert.ok(post.url.includes('/from/x'));
  assert.ok(post.url.includes('utm_source=x'));
  assert.ok(post.url.includes('ref=SGP-X'));
  assert.equal(post.inventsReach, false);
  assert.ok(!/hang-watchdog|module-ranker|unicornEternal/.test(post.text));
});

check('facebook alias and twitter alias normalize', () => {
  assert.equal(sgp.normalizeChannel('twitter'), 'x');
  assert.equal(sgp.normalizeChannel('fb'), 'facebook');
  assert.equal(sgp.refCode('instagram'), 'SGP-INSTAGRAM');
});

check('getStatus never invents humans/reach/gmv', () => {
  const st = sgp.getStatus();
  assert.equal(st.inventsHumans, false);
  assert.equal(st.inventsVisitors, false);
  assert.equal(st.inventsGmv, false);
  assert.equal(st.inventsReach, false);
  assert.equal(typeof st.paidHumans, 'number');
});

check('recordAttempt + recentlyPosted dedupe', () => {
  const post = sgp.composePost('telegram');
  sgp.recordAttempt({ channel: 'telegram', success: true, contentHash: post.contentHash });
  assert.equal(sgp.recentlyPosted('telegram', post.contentHash), true);
  assert.equal(sgp.recentlyPosted('facebook', post.contentHash), false);
});

check('inbound landing is a page load, not a user', () => {
  const before = sgp.getStatus().inboundLandings;
  sgp.recordLanding('x', { ref: 'SGP-X' });
  const st = sgp.getStatus();
  assert.ok(st.inboundLandings >= before + 1);
  assert.match(String(st.inboundLandingsNote), /not buyers/i);
});

check('viralizer source no longer posts random module filenames', () => {
  const src = fs.readFileSync(VIRAL, 'utf8');
  assert.ok(!src.includes('Modulul "\' + randomModule'));
  assert.ok(src.includes('social-gravity-os'));
});

check('backend + site expose well-known social-gravity.json', () => {
  const be = fs.readFileSync(BACKEND_INDEX, 'utf8');
  const site = fs.readFileSync(SITE_INDEX, 'utf8');
  assert.ok(be.includes('/.well-known/social-gravity.json'));
  assert.ok(be.includes('social-gravity-os'));
  assert.ok(site.includes('/.well-known/social-gravity.json'));
  assert.ok(site.includes("startsWith('/from/')"));
});

check('homepage + /from landing exist', () => {
  const shell = fs.readFileSync(SHELL, 'utf8');
  assert.ok(shell.includes('function pageFrom'));
  assert.ok(shell.includes('homeSocialGravity') || shell.includes('SGP/1.0'));
  assert.ok(shell.includes("startsWith('/from/')"));
});

check('llms.txt ships share templates', () => {
  const src = fs.readFileSync(SOV, 'utf8');
  assert.ok(src.includes('Social Gravity'));
  assert.ok(src.includes('SGP-X'));
  assert.ok(src.includes('inboundLandings'));
});

check('sitemap + IndexNow include /from/x and social-gravity.json', () => {
  const seo = fs.readFileSync(SEO, 'utf8');
  assert.ok(seo.includes("'/from/x'"));
  const te = fs.readFileSync(TRAFFIC, 'utf8');
  assert.ok(te.includes("'/from/x'"));
  assert.ok(te.includes('social-gravity.json'));
});

check('nginx pins social-gravity.json to backend', () => {
  const conf = fs.readFileSync(NGINX, 'utf8');
  assert.ok(/location\s+=\s+\/\.well-known\/social-gravity\.json/.test(conf));
  const idx = conf.indexOf('location = /.well-known/social-gravity.json');
  const win = conf.slice(idx, idx + 400);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(win));
});

check('IAK stable allowlist includes SGP', () => {
  const src = fs.readFileSync(IAK_DISC, 'utf8');
  assert.ok(src.includes('social-gravity-os'));
});

check('test:chain includes social-gravity.test.js', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  assert.ok(String(pkg.scripts['test:chain']).includes('social-gravity.test.js'));
});

async function main() {
  const viralizer = require('../backend/modules/socialMediaViralizer');
  const c = await viralizer.generatePostContent('facebook');
  assert.ok(c.url && c.url.includes('/from/facebook'));
  assert.ok(c.text.includes('Origin') || c.text.includes('paid humans'));
  assert.ok(!/Modulul "/.test(c.text));
  console.log('✓ viralizer generatePostContent uses Social Gravity, not random modules');
  passed += 1;

  viralizer.reloadTokensFromEnv();
  const originalHttp = viralizer._http;
  let calls = 0;
  viralizer._http = { post: async () => { calls += 1; return { data: {} }; } };
  try {
    const results = await viralizer.postToAllPlatforms();
    assert.equal(calls, 0);
    const ok = Object.keys(results).filter((k) => results[k] && results[k].success);
    assert.equal(ok.length, 0);
  } finally {
    viralizer._http = originalHttp;
  }
  console.log('✓ unconfigured post cycle still invents zero successes');
  passed += 1;

  sgp._resetForTests();
  const pulse = await sgp.pulseDiscovery({ dryRun: true });
  assert.strictEqual(pulse.ok, true);
  assert.strictEqual(pulse.inventsReach, false);
  assert.ok(pulse.dryRun === true);
  console.log('✓ pulseDiscovery dry-run does not invent reach');
  passed += 1;
  console.log('\n✅ social-gravity: ' + passed + ' tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
