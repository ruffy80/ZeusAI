'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viralizer = require('../backend/modules/socialMediaViralizer');
const secrets = require('../src/config/secrets');

let passed = 0;
let failed = 0;

const SOCIAL_KEYS = [
  'X_BEARER_TOKEN', 'TWITTER_BEARER_TOKEN', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET',
  'TELEGRAM_BOT_TOKEN', 'ZAC_TELEGRAM_TOKEN', 'ZEUS_TG_BOT_TOKEN', 'TG_BOT_TOKEN',
  'TELEGRAM_CHAT_ID', 'ZAC_TELEGRAM_CHAT_ID', 'ZEUS_TG_GROUP_CHAT_ID', 'TELEGRAM_GROUP_CHAT_ID',
  'FACEBOOK_PAGE_TOKEN', 'FB_PAGE_TOKEN', 'FACEBOOK_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID',
  'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID', 'TIKTOK_ACCESS_TOKEN',
  'DISCORD_WEBHOOK_URL', 'LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR_URN', 'LINKEDIN_ORG_ID',
  'YOUTUBE_API_KEY', 'PRODUCTHUNT_DEVELOPER_TOKEN', 'DEV_API_KEY', 'PINTEREST_TOKEN',
  'BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD', 'MASTODON_TOKEN', 'SOCIAL_WEBHOOK_URL',
];

async function test(name, fn) {
  const prev = {};
  for (const k of SOCIAL_KEYS) prev[k] = process.env[k];
  try {
    await fn();
    console.log('  ✅ ' + name);
    passed += 1;
  } catch (err) {
    console.error('  ❌ ' + name + ': ' + err.message);
    failed += 1;
  } finally {
    for (const k of SOCIAL_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    viralizer.reloadTokensFromEnv();
  }
}

function clearSocialEnv() {
  for (const n of SOCIAL_KEYS) delete process.env[n];
}

async function main() {
  console.log('\n🧪 Social viralizer channel wiring\n');

  await test('registry lists facebook / tiktok / instagram secret names', () => {
    const { ALL_SECRET_KEYS } = require('../backend/constants/secretKeys');
    for (const k of ['FACEBOOK_PAGE_TOKEN', 'FACEBOOK_PAGE_ID', 'INSTAGRAM_ACCESS_TOKEN', 'TIKTOK_ACCESS_TOKEN', 'THREADS_ACCESS_TOKEN']) {
      assert.ok(ALL_SECRET_KEYS.includes(k), 'missing ' + k);
    }
  });

  await test('facebook page token alias FB_PAGE_TOKEN is readable via getSecret', () => {
    clearSocialEnv();
    process.env.FB_PAGE_TOKEN = 'page-token-abc-1234567890';
    process.env.FACEBOOK_PAGE_ID = '111222333';
    assert.equal(secrets.getSecret('FACEBOOK_PAGE_TOKEN'), 'page-token-abc-1234567890');
    const tokens = viralizer.reloadTokensFromEnv();
    assert.equal(tokens.facebookPageToken, 'page-token-abc-1234567890');
    assert.equal(tokens.facebookPageId, '111222333');
  });

  await test('telegram alias ZAC_TELEGRAM_TOKEN fills viralizer telegram token', () => {
    clearSocialEnv();
    process.env.ZAC_TELEGRAM_TOKEN = '123456:AA-telegram-bot-token-alias';
    process.env.ZAC_TELEGRAM_CHAT_ID = '-1001234567890';
    const tokens = viralizer.reloadTokensFromEnv();
    assert.equal(tokens.telegram, '123456:AA-telegram-bot-token-alias');
    assert.ok(tokens.telegramChat);
  });

  await test('twitter bearer alias arms X poster', () => {
    clearSocialEnv();
    process.env.TWITTER_BEARER_TOKEN = 'AAAA-twitter-bearer-user-context-token';
    const tokens = viralizer.reloadTokensFromEnv();
    assert.equal(tokens.xBearer, 'AAAA-twitter-bearer-user-context-token');
    const status = viralizer.getProviderStatus();
    assert.equal(status.providers.x_twitter.configured, true);
  });

  await test('linkedin org id derives author URN', () => {
    clearSocialEnv();
    process.env.LINKEDIN_ACCESS_TOKEN = 'li-access-token-1234567890';
    process.env.LINKEDIN_ORG_ID = '987654';
    secrets.bootstrap({ log: false });
    const tokens = viralizer.reloadTokensFromEnv();
    assert.equal(tokens.linkedinAuthor, 'urn:li:organization:987654');
  });

  await test('getProviderStatus includes facebook, instagram, tiktok, discord, linkedin', () => {
    const status = viralizer.getProviderStatus();
    for (const name of ['facebook', 'instagram', 'tiktok', 'discord', 'linkedin', 'bluesky', 'mastodon', 'reddit', 'webhook', 'threads']) {
      assert.ok(status.providers[name], 'missing provider ' + name);
    }
  });

  await test('unconfigured cycle skips every channel and does not invent success', async () => {
    clearSocialEnv();
    viralizer.reloadTokensFromEnv();
    const originalHttp = viralizer._http;
    let httpCalls = 0;
    viralizer._http = { post: async () => { httpCalls += 1; return { data: {} }; } };
    try {
      const results = await viralizer.postToAllPlatforms();
      assert.equal(httpCalls, 0, 'no HTTP when no credentials');
      const successes = Object.keys(results).filter((k) => results[k] && results[k].success);
      assert.equal(successes.length, 0, 'must not report success without a live API call');
    } finally {
      viralizer._http = originalHttp;
    }
  });

  await test('youtube API key does not fake a successful upload', async () => {
    const r = await viralizer.postToYouTube();
    assert.equal(r.success, false);
    assert.equal(r.skipped, true);
    assert.match(String(r.reason), /oauth|video/i);
  });

  await test('product hunt token does not fake a ship', async () => {
    const r = await viralizer.postToProductHunt();
    assert.equal(r.success, false);
    assert.equal(r.skipped, true);
  });

  await test('tiktok token without video is an honest skip', async () => {
    const r = await viralizer.postToTikTok();
    assert.equal(r.success, false);
    assert.equal(r.skipped, true);
  });

  await test('facebook posts to Graph page feed when tokens are set', async () => {
    clearSocialEnv();
    process.env.FACEBOOK_PAGE_TOKEN = 'page-token-abc-1234567890';
    process.env.FACEBOOK_PAGE_ID = '555666777';
    viralizer.reloadTokensFromEnv();
    const originalHttp = viralizer._http;
    const calls = [];
    viralizer._http = {
      post: async (url, body, opts) => {
        calls.push({ url, body, opts });
        return { data: { id: '555666777_1' } };
      }
    };
    try {
      const r = await viralizer.postToFacebook({ text: 'hello zeusai.pro' });
      assert.equal(r.success, true);
      assert.equal(r.platform, 'facebook');
      assert.ok(String(calls[0].url).includes('graph.facebook.com'));
      assert.ok(String(calls[0].url).includes('555666777/feed'));
    } finally {
      viralizer._http = originalHttp;
    }
  });

  await test('sync-all-secrets workflow maps facebook/tiktok/instagram github secrets', () => {
    const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/sync-all-secrets.yml'), 'utf8');
    assert.ok(yml.includes('FACEBOOK_PAGE_TOKEN:'));
    assert.ok(yml.includes('INSTAGRAM_ACCESS_TOKEN:'));
    assert.ok(yml.includes('TIKTOK_ACCESS_TOKEN:'));
    assert.ok(yml.includes('/etc/zeusai/social.env'));
  });

  await test('test:chain includes social-viralizer-channels.test.js', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.ok(String(pkg.scripts['test:chain']).includes('social-viralizer-channels.test.js'));
  });

  console.log('\n📊 Results: ' + passed + ' passed, ' + failed + ' failed\n');
  if (failed > 0) process.exit(1);
  console.log('✅ social-viralizer-channels: ' + passed + ' tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
