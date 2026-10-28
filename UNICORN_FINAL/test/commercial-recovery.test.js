'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.GROWTH_EMERGENCY_STOP;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('robots names the service sitemap and the marketing urlset stays seven URLs', () => {
  const seo = require('../src/seo/sitemap-helpers');
  const robots = seo.robotsTxt('https://zeusai.pro');
  assert.ok(robots.includes('Sitemap: https://zeusai.pro/sitemap.xml'));
  assert.ok(robots.includes('Sitemap: https://zeusai.pro/seo/sitemap-services.xml'));
  assert.ok(robots.includes('Sitemap: https://zeusai.pro/sitemap-authority.xml'));
  assert.ok(robots.includes('Sitemap: https://zeusai.pro/sitemap-geo.xml'));
  const xml = seo.marketingUrlset('https://zeusai.pro');
  assert.strictEqual((xml.match(/<loc>/g) || []).length, 7);
  assert.ok(!xml.includes('/services/instant-website-audit'));
  assert.ok(!xml.includes('/buy</loc>'));
  assert.ok(!xml.includes('/commercial</loc>'));
});

check('emergency stop blocks a Telegram growth post and then releases', () => {
  const spread = require('../backend/modules/telegram-world-spread');
  process.env.GROWTH_EMERGENCY_STOP = '1';
  try {
    const stopped = spread.nextGrowthPost({
      silenced: false,
      postsToday: 0,
      maxPosts: 6,
      sinceLastMs: null,
      gapMs: 1,
    });
    assert.strictEqual(stopped.action, 'wait');
    assert.strictEqual(stopped.reason, 'emergency_stop');
  } finally {
    delete process.env.GROWTH_EMERGENCY_STOP;
  }
  const open = spread.nextGrowthPost({
    silenced: false,
    postsToday: 0,
    maxPosts: 6,
    sinceLastMs: null,
    gapMs: 1,
  });
  assert.strictEqual(open.action, 'live_shelf');
  assert.strictEqual(open.reason, 'grow');
});

check('the commercial desk does not invent a price or a visitor count', () => {
  const desk = require('../src/site/v2/commercial-desk');
  const status = desk.status();
  assert.strictEqual(status.invented, false);
  assert.strictEqual(status.primaryOffer.id, 'instant-website-audit');
  assert.strictEqual(status.primaryOffer.price, null);
  assert.ok(status.paidHumans === null || (Number.isFinite(status.paidHumans) && status.paidHumans >= 0));
  assert.ok(status.visits30d === null || Number.isFinite(status.visits30d));
  assert.ok(status.storedProducts === null || Array.isArray(status.storedProducts));
  const html = desk.page();
  assert.ok(html.includes('/services/instant-website-audit'));
  assert.ok(!html.includes('$44'));
  assert.ok(!html.includes('$39'));
});

check('the public page and both servers expose the desk', () => {
  const shell = require('../src/site/v2/shell');
  const html = shell.getHtml('/commercial');
  assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(html.includes('What was measured'));
  assert.ok(html.includes('href="/commercial"'));
  const site = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  const backend = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  assert.ok(site.includes("urlPath === '/api/commercial/status'"));
  assert.ok(site.includes("'/commercial'"));
  assert.ok(backend.includes("app.get('/api/commercial/status'"));
  const chain = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts['test:chain'];
  assert.ok(String(chain).includes('commercial-recovery.test.js'));
});

console.log('✅ commercial-recovery: ' + passed + ' tests passed');
