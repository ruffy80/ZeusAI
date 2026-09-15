'use strict';

/**
 * search-engine-bridge.test.js — SEBP/1.0 + HSDP/1.0
 *
 * Two things the platform could not do before:
 *   SEBP/1.0 search-console-bridge — claim Bing + Google ownership and submit
 *   the sitemap automatically once one secret per engine exists.
 *   HSDP/1.0 share-surface — turn the human-share step into one tap with no
 *   API token at all.
 *
 * Both must stay honest: no invented visitors, users, reach, or submissions.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sebp-'));
process.env.SEO_BRIDGE_DIR = TMP_DIR;
process.env.TRAFFIC_ENGINE_FILE = path.join(TMP_DIR, 'traffic-engine.json');
process.env.TRAFFIC_OUTREACH_FILE = path.join(TMP_DIR, 'outreach-queue.json');

const queue = [];
function check(name, fn) {
  queue.push({ name, fn });
}

function clearSecrets() {
  delete process.env.BING_WEBMASTER_API_KEY;
  delete process.env.BING_API_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
}
clearSecrets();

console.log('Search Engine Bridge (SEBP/1.0) + One-tap Share (HSDP/1.0)');

const bridge = require('../backend/modules/search-console-bridge');
const share = require('../src/commerce/share-surface');
const wivp = require('../src/commerce/world-index-os');

/** A throwaway RSA service account so the armed path is exercised offline. */
function fakeServiceAccount() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return JSON.stringify({
    type: 'service_account',
    project_id: 'zeusai-test',
    client_email: 'bridge@zeusai-test.iam.gserviceaccount.com',
    private_key: privateKey,
  });
}

// ── SEBP: honest when unarmed ────────────────────────────────────────
check('unarmed bridge names the exact missing secret and claims nothing', () => {
  clearSecrets();
  assert.deepStrictEqual(bridge.armedEngines(), []);
  const missing = bridge.missingSecrets();
  assert.strictEqual(missing.length, 2);
  const byEngine = Object.fromEntries(missing.map((m) => [m.engine, m.secret]));
  assert.strictEqual(byEngine.bing, 'BING_WEBMASTER_API_KEY');
  assert.strictEqual(byEngine.google, 'GOOGLE_SERVICE_ACCOUNT_JSON');
  const st = bridge.getStatus();
  assert.strictEqual(st.protocol, 'SEBP/1.0');
  assert.strictEqual(st.inventsVisitors, false);
  assert.strictEqual(st.inventsCrawlCounts, false);
  assert.strictEqual(st.inventsRankings, false);
  assert.strictEqual(st.lastRunAt, null);
});

check('runBing/runGoogle refuse to pretend without a secret', async () => {
  clearSecrets();
  return Promise.all([bridge.runBing({}), bridge.runGoogle({})]).then(([b, g]) => {
    assert.strictEqual(b.armed, false);
    assert.strictEqual(b.blocked, 'no_api_key');
    assert.strictEqual(b.secret, 'BING_WEBMASTER_API_KEY');
    assert.strictEqual(b.invented, false);
    assert.ok(!('ok' in b), 'an unarmed engine must not report ok');
    assert.strictEqual(g.armed, false);
    assert.strictEqual(g.blocked, 'no_service_account');
    assert.strictEqual(g.secret, 'GOOGLE_SERVICE_ACCOUNT_JSON');
    assert.ok(/Search Console/.test(g.manualFallback));
  });
});

// ── SEBP: armed plan, still no network ───────────────────────────────
check('armed Bing dry-run plans AddSite + SubmitFeed + SubmitUrlbatch', async () => {
  process.env.BING_WEBMASTER_API_KEY = 'test-key';
  return bridge.runBing({ dryRun: true }).then((r) => {
    assert.strictEqual(r.armed, true);
    assert.strictEqual(r.dryRun, true);
    assert.deepStrictEqual(r.steps, ['AddSite', 'SubmitFeed', 'SubmitUrlbatch']);
    assert.strictEqual(r.feedUrl, 'https://zeusai.pro/sitemap.xml');
    assert.strictEqual(r.siteUrl, 'https://zeusai.pro/');
    assert.ok(r.urlCount > 0);
    delete process.env.BING_WEBMASTER_API_KEY;
  });
});

check('armed Google dry-run plans the full verify → property → sitemap chain', async () => {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = fakeServiceAccount();
  assert.deepStrictEqual(bridge.armedEngines(), ['google']);
  return bridge.runGoogle({ dryRun: true }).then((r) => {
    assert.strictEqual(r.armed, true);
    assert.strictEqual(r.dryRun, true);
    for (const step of ['getToken(FILE)', 'webResource.insert', 'sites.add', 'sitemaps.submit']) {
      assert.ok(r.steps.includes(step), step);
    }
    assert.strictEqual(r.sitemap, 'https://zeusai.pro/sitemap.xml');
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  });
});

check('base64 service account is accepted (multi-line .env transport)', () => {
  clearSecrets();
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 = Buffer.from(fakeServiceAccount(), 'utf8').toString('base64');
  assert.deepStrictEqual(bridge.armedEngines(), ['google']);
  clearSecrets();
  assert.deepStrictEqual(bridge.armedEngines(), []);
});

check('runCycle honours the kill switch', async () => {
  process.env.SEO_BRIDGE_DISABLED = '1';
  return bridge.runCycle({ dryRun: true }).then((r) => {
    assert.strictEqual(r.disabled, true);
    assert.strictEqual(r.ok, false);
    delete process.env.SEO_BRIDGE_DISABLED;
  });
});

// ── SEBP: Google FILE token persistence ──────────────────────────────
check('a negotiated FILE token is persisted and then served by the site', () => {
  bridge._resetForTests();
  assert.strictEqual(bridge.readGoogleVerification(), null);
  assert.strictEqual(bridge.persistGoogleVerification('../evil.html').ok, false);
  assert.strictEqual(bridge.persistGoogleVerification('nope.txt').ok, false);
  const out = bridge.persistGoogleVerification('googleabc123def.html');
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.record.path, '/googleabc123def.html');
  assert.strictEqual(out.record.body, 'google-site-verification: googleabc123def.html');

  const records = wivp.googleVerificationRecords();
  assert.ok(records.some((r) => r.path === '/googleabc123def.html' && r.source === 'search-console-bridge'));
  const served = wivp.googleHtmlVerification('/googleabc123def.html');
  assert.ok(served && served.body.includes('googleabc123def.html'));
  assert.strictEqual(wivp.googleHtmlVerification('/googleWRONG.html'), null);
  bridge._resetForTests();
  assert.strictEqual(wivp.googleHtmlVerification('/googleabc123def.html'), null);
});

// ── WIVP activation surface ──────────────────────────────────────────
check('activation lists every blocker as a named secret without inventing traction', () => {
  clearSecrets();
  const a = wivp.activation();
  assert.strictEqual(a.protocol, 'WIVP/1.0');
  assert.strictEqual(a.inventsVisitors, false);
  assert.strictEqual(a.tokenlessDistribution, '/share');
  assert.ok(a.rows.length >= 6);
  const ids = a.rows.map((r) => r.id);
  assert.ok(ids.includes('search-bing'));
  assert.ok(ids.includes('search-google'));
  assert.ok(ids.includes('gaze-facebook'));
  for (const row of a.rows) {
    assert.ok(row.secret, 'every row must name a secret: ' + row.id);
    assert.strictEqual(typeof row.armed, 'boolean');
  }
  assert.strictEqual(a.blockedCount + a.armedCount, a.rows.length);
});

check('discovery exposes the bridge + one-tap share and stays honest', () => {
  clearSecrets();
  const d = wivp.discovery();
  assert.strictEqual(d.inventsVisitors, false);
  assert.strictEqual(d.searchEngineBridge.protocol, 'SEBP/1.0');
  assert.strictEqual(d.searchEngineBridge.available, true);
  assert.strictEqual(d.searchEngineBridge.missingSecrets.length, 2);
  assert.strictEqual(d.shareOneTap.page, '/share');
  assert.strictEqual(d.shareOneTap.requiresToken, false);
  assert.strictEqual(d.pages.share, '/share');
  assert.ok(d.priorityPaths.includes('/share'));
  assert.ok(d.priorityPaths.includes('/.well-known/share-surface.json'));
  assert.ok(!/millions of users|trusted by thousands|guaranteed traffic/i.test(JSON.stringify(d)));
});

check('operator checklist promises automation only where a secret is armed', () => {
  clearSecrets();
  const unarmed = wivp.operatorChecklist({ gazeLit: [] });
  const bingRow = unarmed.find((r) => r.id === 'bing-webmaster');
  const googleRow = unarmed.find((r) => r.id === 'google-search-console');
  assert.strictEqual(bingRow.ready, false);
  assert.ok(bingRow.action.includes('BING_WEBMASTER_API_KEY'));
  assert.strictEqual(googleRow.ready, false);
  assert.ok(googleRow.action.includes('GOOGLE_SERVICE_ACCOUNT_JSON'));

  process.env.BING_WEBMASTER_API_KEY = 'test-key';
  const armed = wivp.operatorChecklist({ gazeLit: [] });
  assert.strictEqual(armed.find((r) => r.id === 'bing-webmaster').ready, true);
  delete process.env.BING_WEBMASTER_API_KEY;

  const humanRow = unarmed.find((r) => r.id === 'human-share');
  assert.ok(humanRow.action.includes('/share'));
});

// ── HSDP: one-tap share ──────────────────────────────────────────────
check('every share target is a tokenless public web intent', () => {
  const targets = share.shareTargets();
  const channels = targets.map((t) => t.channel);
  for (const ch of ['x', 'facebook', 'whatsapp', 'telegram', 'linkedin', 'reddit', 'hackernews', 'email']) {
    assert.ok(channels.includes(ch), 'missing channel ' + ch);
  }
  for (const t of targets) {
    assert.strictEqual(t.requiresToken, false, t.channel + ' must not need a token');
    assert.ok(/^(https:\/\/|mailto:)/.test(t.intentUrl), t.channel + ' intent must be https or mailto');
    assert.ok(t.landing.startsWith('https://zeusai.pro/'), t.channel + ' landing must be canonical');
    assert.ok(t.text && t.text.length > 10, t.channel + ' needs copy');
    assert.ok(!/\n/.test(t.intentUrl), t.channel + ' intent url must be single-line');
  }
  const x = targets.find((t) => t.channel === 'x');
  assert.ok(x.intentUrl.startsWith('https://twitter.com/intent/tweet?'));
  const fb = targets.find((t) => t.channel === 'facebook');
  assert.ok(fb.intentUrl.startsWith('https://www.facebook.com/sharer/sharer.php?'));
});

check('share copy carries utm + ref attribution and never fakes traction', () => {
  const copy = share.shareCopy('x');
  assert.ok(copy.url.includes('utm_source=x'));
  assert.ok(copy.url.includes('utm_medium=social'));
  assert.ok(!/\d+[km] users|thousands of|millions of/i.test(copy.text), 'copy must not invent an audience');
  const d = share.discovery();
  assert.strictEqual(d.protocol, 'HSDP/1.0');
  assert.strictEqual(d.inventsVisitors, false);
  assert.strictEqual(d.inventsUsers, false);
  assert.strictEqual(d.inventsReach, false);
  assert.strictEqual(d.inventsShares, false);
  assert.strictEqual(typeof d.paidHumans, 'number');
  assert.strictEqual(d.tokenlessChannels.length, 8);
  assert.ok(/not a post|not a visitor/i.test(d.note));
});

check('/share html is self-contained, OG-rich and escapes its copy', () => {
  const html = share.shareHtml();
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('property="og:image"'));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes('HSDP/1.0'));
  assert.ok(html.includes('navigator.share'), 'native OS share sheet must be offered');
  assert.ok(html.includes('id="copy-btn"'));
  assert.ok(html.includes('https://wa.me/?text='));
  assert.ok(html.includes('https://t.me/share/url?'));
  // Trusted-Types safety: no DOM sink assignments in the inline script.
  assert.ok(!/innerHTML|outerHTML|document\.write/.test(html));
  // No template interpolation leaked into the rendered markup.
  assert.ok(!/(>|="|\s)(undefined|NaN|\[object Object\])(<|"|\s)/.test(html));
});

// ── Wiring ───────────────────────────────────────────────────────────
check('both site servers route /share, share-surface.json and the activation API', () => {
  const site = read('src/index.js');
  assert.ok(site.includes("app.get(['/share', '/post']"));
  assert.ok(site.includes("urlPath === '/share'"));
  assert.ok(site.includes("'/.well-known/share-surface.json'"));
  assert.ok(site.includes("urlPath === '/.well-known/share-surface.json'"));
  assert.ok(site.includes("app.get('/api/world-index/activation'"));
  assert.ok(site.includes("urlPath === '/api/world-index/activation'"));
  assert.ok(site.includes("'/api/world-index/activation', '/api/share/targets'"), 'public API allowlist');
  assert.ok(site.includes('googleHtmlVerification(req.path)'));
  assert.ok(site.includes('googleHtmlVerification(urlPath)'));
});

check('nginx pins share-surface.json to the site in conf, snippet and self-heal patch', () => {
  const conf = read('scripts/nginx-unicorn.conf');
  const i = conf.indexOf('location = /.well-known/share-surface.json');
  assert.ok(i >= 0, 'nginx-unicorn.conf');
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(i, i + 420)));
  const snippet = read('scripts/nginx-public-discovery.snippet.conf');
  const j = snippet.indexOf('location = /.well-known/share-surface.json');
  assert.ok(j >= 0, 'snippet');
  assert.ok(snippet.slice(j, j + 420).includes('127.0.0.1:3001'));
  const patch = read('scripts/nginx-patch-public-discovery.py');
  assert.ok(patch.includes('location = /.well-known/share-surface.json'));
  assert.ok(patch.includes('127.0.0.1:3001'));
});

check('crawl inventory, sitemap, robots and llms.txt all advertise /share', () => {
  const te = read('backend/modules/traffic-engine.js');
  assert.ok(te.includes("'/share'"));
  assert.ok(te.includes('share-surface.json'));
  assert.ok(te.includes('_searchConsoleBridge'), 'traffic-engine cycle must run the bridge');
  const seo = read('src/seo/sitemap-helpers.js');
  assert.ok(seo.includes("'/share'"));
  const sov = read('src/site/sovereign-extensions.js');
  assert.ok(sov.includes('/share'));
  assert.ok(sov.includes('share-surface.json'));
  assert.ok(sov.includes('HSDP/1.0'));
});

check('traffic-engine cycle reports the bridge without a secret instead of skipping silently', async () => {
  clearSecrets();
  const te = require('../backend/modules/traffic-engine');
  return te.runCycle({ dryRun: true }).then((r) => {
    assert.strictEqual(r.ok, true);
    assert.ok(r.searchConsole, 'cycle must include a searchConsole result');
    assert.strictEqual(r.searchConsole.skipped, true);
    assert.strictEqual(r.searchConsole.reason, 'no_engine_secret');
    assert.strictEqual(r.searchConsole.missingSecrets.length, 2);
    te._resetForTests();
  });
});

check('new secrets are in the canonical list and the sync workflow', () => {
  const { ALL_SECRET_KEYS } = require('../backend/constants/secretKeys');
  for (const k of ['BING_WEBMASTER_API_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_JSON_B64']) {
    assert.ok(ALL_SECRET_KEYS.includes(k), k);
  }
  const wf = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'sync-all-secrets.yml'), 'utf8');
  assert.ok(wf.includes('BING_WEBMASTER_API_KEY'));
  assert.ok(wf.includes('GOOGLE_SERVICE_ACCOUNT_JSON'));
  // The multi-line key must travel base64-encoded or it corrupts the .env.
  assert.ok(wf.includes('NEVER_RAW'));
  assert.ok(wf.includes("toString('base64')"));
});

check('backend boot names the blocking secret', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes('search-console-bridge'));
  assert.ok(src.includes('blocked — set '));
});

check('test:chain includes search-engine-bridge.test.js', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(String(pkg.scripts['test:chain']).includes('search-engine-bridge.test.js'));
});

async function main() {
  let passed = 0;
  for (const t of queue) {
    await t.fn();
    passed += 1;
    console.log('  ✓', t.name);
  }
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  console.log(`\n✅ search-engine-bridge: ${passed} tests passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ search-engine-bridge failed:', err);
  process.exit(1);
});
