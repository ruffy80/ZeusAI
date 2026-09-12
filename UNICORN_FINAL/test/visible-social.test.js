'use strict';
/**
 * visible-social.test.js — VSP/1.0 Visible Surface Protocol
 * Gaze permalinks only. Telegram/Discord/webhook are rails, not posts.
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
delete process.env.VSP_DATA_DIR;

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'visible-social-os.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');
const IAK_DISC = path.join(ROOT, 'backend', 'modules', 'iak', 'module-discovery.js');
const PKG = path.join(ROOT, 'package.json');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const SOV = path.join(ROOT, 'src', 'site', 'sovereign-extensions.js');
const NGINX = path.join(ROOT, 'scripts', 'nginx-unicorn.conf');
const SNIP = path.join(ROOT, 'scripts', 'nginx-public-discovery.snippet.conf');
const PATCH = path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py');

const SOCIAL_KEYS = [
  'FACEBOOK_PAGE_TOKEN', 'FACEBOOK_PAGE_ID', 'FB_PAGE_TOKEN',
  'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID',
  'THREADS_ACCESS_TOKEN', 'THREADS_USER_ID',
  'X_BEARER_TOKEN', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET',
  'TIKTOK_ACCESS_TOKEN', 'UNICORN_SOCIAL_STORE_FILE',
];

const vsp = require('../backend/modules/visible-social-os');
const secrets = require('../src/config/secrets');
const viralizer = require('../backend/modules/socialMediaViralizer');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  const prev = {};
  for (const k of SOCIAL_KEYS) prev[k] = process.env[k];
  vsp._resetForTests();
  try {
    await fn();
    console.log('  ✅ ' + name);
    passed += 1;
  } catch (err) {
    console.error('  ❌ ' + name + ': ' + (err && err.stack ? err.stack : err.message));
    failed += 1;
  } finally {
    for (const k of SOCIAL_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    vsp._resetForTests();
    try { viralizer.reloadTokensFromEnv(); } catch (_) { /* ignore */ }
  }
}

function clearGazeEnv() {
  for (const n of SOCIAL_KEYS) {
    if (n !== 'UNICORN_SOCIAL_STORE_FILE') delete process.env[n];
  }
}

console.log('\n🧪 Visible Surface Protocol (VSP/1.0)\n');

(async () => {
  await test('module file exists and never invents posts/reach', () => {
    assert.ok(fs.existsSync(MOD), 'visible-social-os.js missing');
    const st = vsp.getStatus();
    assert.equal(st.protocol, 'VSP/1.0');
    assert.equal(st.inventsHumans, false);
    assert.equal(st.inventsReach, false);
    assert.equal(st.inventsPosts, false);
    assert.ok(vsp.GAZE.includes('facebook'));
    assert.ok(vsp.GAZE.includes('x'));
    assert.ok(vsp.GAZE.includes('tiktok'));
    assert.ok(vsp.RAILS.includes('telegram'));
    assert.ok(vsp.RAILS.includes('discord'));
    assert.ok(vsp.RAILS.includes('webhook'));
  });

  await test('telegram receipt is a rail — not a visible gaze post', () => {
    const rec = vsp.recordReceipt({
      channel: 'telegram',
      success: true,
      messageId: 42,
      chatId: '-100123',
      permalink: 'https://t.me/c/123/42',
    });
    assert.equal(rec.rail, true);
    assert.equal(rec.gaze, false);
    assert.equal(rec.visible, false);
    const st = vsp.getStatus();
    assert.equal(st.visibleReceipts, 0);
    assert.ok(st.gazeDark.includes('facebook'));
    assert.ok(st.gazeLit.length === 0);
    assert.ok(st.whyYouSeeNothing);
    assert.match(st.whyYouSeeNothing, /Facebook|X|TikTok|Instagram/i);
  });

  await test('facebook permalink receipt lights gaze', () => {
    const rec = vsp.recordReceipt({
      channel: 'facebook',
      success: true,
      id: '555666777_1',
    });
    assert.equal(rec.gaze, true);
    assert.equal(rec.visible, true);
    assert.equal(rec.permalink, 'https://www.facebook.com/555666777/posts/1');
    const st = vsp.getStatus();
    assert.ok(st.gazeLit.includes('facebook'));
    assert.equal(st.whyYouSeeNothing, null);
  });

  await test('permalinkFor builds facebook / x / telegram URLs', () => {
    assert.equal(
      vsp.permalinkFor('facebook', { id: '111_222' }),
      'https://www.facebook.com/111/posts/222'
    );
    assert.equal(
      vsp.permalinkFor('x', { tweetId: '1999' }),
      'https://x.com/i/web/status/1999'
    );
    assert.equal(
      vsp.permalinkFor('telegram', { id: 9, messageId: 9, chatId: '@zeusai' }),
      'https://t.me/zeusai/9'
    );
    assert.equal(vsp.permalinkFor('discord', { id: '1' }), null);
  });

  await test('oauth1Header produces OAuth prefix and signature', () => {
    const h = vsp.oauth1Header(
      'POST',
      'https://api.twitter.com/2/tweets',
      'ck',
      'cs',
      'at',
      'as'
    );
    assert.ok(h.startsWith('OAuth '));
    assert.ok(h.includes('oauth_signature='));
    assert.ok(h.includes('oauth_consumer_key='));
  });

  await test('companion completion fills FACEBOOK_PAGE_ID from Graph /me', async () => {
    clearGazeEnv();
    process.env.FACEBOOK_PAGE_TOKEN = 'page-token-for-me-call';
    delete process.env.FACEBOOK_PAGE_ID;
    const mockHttp = {
      get(url, _opts, cb) {
        assert.ok(String(url).includes('graph.facebook.com'));
        assert.ok(String(url).includes('access_token=page-token-for-me-call'));
        const res = {
          setEncoding() {},
          on(ev, fn) {
            if (ev === 'data') fn(JSON.stringify({ id: '999888777', name: 'ZeusAI Page' }));
            if (ev === 'end') fn();
          },
        };
        process.nextTick(() => cb(res));
        return { on() {}, destroy() {} };
      },
    };
    const out = await vsp.completeCompanionIds({ http: mockHttp });
    assert.equal(out.ok, true);
    assert.equal(out.inventsPosts, false);
    assert.equal(out.companions.facebook.id, '999888777');
    assert.equal(out.companions.facebook.via, 'graph_me');
    assert.equal(process.env.FACEBOOK_PAGE_ID, '999888777');
  });

  await test('reloadSocialStores unmasks empty FACEBOOK_PAGE_TOKEN from a store file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsp-store-'));
    const store = path.join(dir, 'social.env');
    fs.writeFileSync(store, 'FACEBOOK_PAGE_TOKEN=real-token-from-durable-store\nX_BEARER_TOKEN=bearer-from-store\n');
    process.env.FACEBOOK_PAGE_TOKEN = '';
    process.env.X_BEARER_TOKEN = 'changeme';
    process.env.UNICORN_SOCIAL_STORE_FILE = store;
    const filled = secrets.reloadSocialStores();
    assert.ok(filled.includes('FACEBOOK_PAGE_TOKEN'), 'empty pin must be filled: ' + filled.join(','));
    assert.ok(filled.includes('X_BEARER_TOKEN'), 'placeholder pin must be filled');
    assert.equal(process.env.FACEBOOK_PAGE_TOKEN, 'real-token-from-durable-store');
    assert.equal(process.env.X_BEARER_TOKEN, 'bearer-from-store');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  });

  await test('facebook token without page id is configured but cannot post', () => {
    clearGazeEnv();
    process.env.FACEBOOK_PAGE_TOKEN = 'page-token-only';
    delete process.env.FACEBOOK_PAGE_ID;
    const status = viralizer.getProviderStatus();
    assert.equal(status.providers.facebook.configured, true);
    assert.equal(status.providers.facebook.canPost, false);
    assert.equal(status.liveReady.includes('facebook'), false);
  });

  await test('facebook skip is honest when companion id is missing', async () => {
    clearGazeEnv();
    process.env.FACEBOOK_PAGE_TOKEN = 'page-token-only';
    delete process.env.FACEBOOK_PAGE_ID;
    viralizer.reloadTokensFromEnv();
    const r = await viralizer.postToFacebook({ text: 'should not hit graph' });
    assert.equal(r.success, false);
    assert.equal(r.skipped, true);
    assert.equal(r.reason, 'facebook_page_id_incomplete');
  });

  await test('tiktok canPost stays false even when token is set', () => {
    clearGazeEnv();
    process.env.TIKTOK_ACCESS_TOKEN = 'tiktok-token-present';
    const status = viralizer.getProviderStatus();
    assert.equal(status.providers.tiktok.configured, true);
    assert.equal(status.providers.tiktok.canPost, false);
  });

  await test('x user-context keys arm the poster without a bearer', () => {
    clearGazeEnv();
    process.env.X_API_KEY = 'ck';
    process.env.X_API_SECRET = 'cs';
    process.env.X_ACCESS_TOKEN = 'at-user-context';
    process.env.X_ACCESS_SECRET = 'as-user-context';
    const status = viralizer.getProviderStatus();
    assert.equal(status.providers.x_twitter.configured, true);
    assert.equal(status.providers.x_twitter.userContext, true);
  });

  await test('gazeProofHtml does not invent a facebook permalink', () => {
    const html = vsp.gazeProofHtml();
    assert.match(html, /VSP\/1\.0/);
    assert.match(html, /facebook/);
    assert.ok(!html.includes('facebook.com/') || html.includes('none'));
    assert.match(html, /whyYouSeeNothing|Autoviralizer is not publishing|operator rails/i);
  });

  await test('backend + site expose well-known visible-social.json and /visible', () => {
    const be = fs.readFileSync(BACKEND_INDEX, 'utf8');
    const site = fs.readFileSync(SITE_INDEX, 'utf8');
    assert.ok(be.includes('/.well-known/visible-social.json'));
    assert.ok(be.includes('visible-social-os'));
    assert.ok(site.includes('/.well-known/visible-social.json'));
    assert.ok(site.includes('visibleSocial'));
    assert.ok(site.includes("'/visible'") || site.includes('"/visible"') || site.includes("['/visible'"));
  });

  await test('homepage + llms + nginx pin VSP', () => {
    const shell = fs.readFileSync(SHELL, 'utf8');
    const sov = fs.readFileSync(SOV, 'utf8');
    const conf = fs.readFileSync(NGINX, 'utf8');
    const snip = fs.readFileSync(SNIP, 'utf8');
    const patch = fs.readFileSync(PATCH, 'utf8');
    assert.ok(shell.includes('homeVisibleSocial') || shell.includes('VSP/1.0'));
    assert.ok(sov.includes('Visible Surface'));
    assert.ok(/location\s+=\s+\/\.well-known\/visible-social\.json/.test(conf));
    assert.ok(snip.includes('visible-social.json'));
    assert.ok(patch.includes('visible-social.json'));
  });

  await test('IAK stable allowlist + test:chain include VSP', () => {
    const src = fs.readFileSync(IAK_DISC, 'utf8');
    assert.ok(src.includes('visible-social-os'));
    const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
    assert.ok(String(pkg.scripts['test:chain']).includes('visible-social.test.js'));
  });

  await test('facebook Graph post still attaches a permalink', async () => {
    clearGazeEnv();
    process.env.FACEBOOK_PAGE_TOKEN = 'page-token-abc-1234567890';
    process.env.FACEBOOK_PAGE_ID = '555666777';
    viralizer.reloadTokensFromEnv();
    const originalHttp = viralizer._http;
    viralizer._http = {
      post: async () => ({ data: { id: '555666777_1' } }),
    };
    try {
      const r = await viralizer.postToFacebook({ text: 'hello zeusai.pro' });
      assert.equal(r.success, true);
      assert.equal(r.permalink, 'https://www.facebook.com/555666777/posts/1');
    } finally {
      viralizer._http = originalHttp;
    }
  });

  console.log('\n📊 Results: ' + passed + ' passed, ' + failed + ' failed\n');
  if (failed > 0) process.exit(1);
  console.log('✅ visible-social: ' + passed + ' tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
