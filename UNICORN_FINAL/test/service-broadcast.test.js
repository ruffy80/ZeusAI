'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUSAI_SOCIAL_DATA_DIR = require('path').join(require('os').tmpdir(), 'za-broadcast-' + process.pid);

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const KEYS = [
  'X_BEARER_TOKEN', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET',
  'FACEBOOK_PAGE_TOKEN', 'FACEBOOK_PAGE_ID', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID',
];
for (const k of KEYS) delete process.env[k];

const surface = require('../backend/modules/social-orchestrator/social-surface');
const broadcast = require('../backend/modules/social-orchestrator/service-broadcast');
const shelf = require('../src/commerce/public-shelf');

assert.equal(surface.snapshot().posts, 0);

const report = broadcast.broadcastShelf();
assert.equal(report.ok, true);
assert.equal(report.inventsReach, false);
assert.ok(report.count >= 10, 'buyable services should be posted');
assert.equal(report.published, report.count);

const seo = shelf.byId('instant-seo-content-pack');
const card = report.items.find((p) => p.id === seo.id);
assert.ok(card);
assert.equal(card.priceUsd, seo.priceUsd);
assert.equal(card.ctaHref, seo.ctaHref);

const again = surface.publishOfficial({ offerId: seo.id, text: broadcast.cardText(seo, shelf) });
assert.equal(again.ok, true);
assert.equal(again.already, true);

const blocked = surface.publishOfficial({ offerId: 'not-a-real-sku', text: 'nope' });
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'offer_not_on_shelf');

const contact = shelf.byId('ent-acquisition-pack');
if (contact && contact.buyable !== true) {
  const noCart = surface.publishOfficial({ offerId: contact.id, text: 'proposal' });
  assert.equal(noCart.ok, false);
}

const html = broadcast.deskHtml(report);
assert.ok(html.includes('id="zaWorldDesk"'));
assert.ok(html.includes('data-product-id="' + seo.id + '"'));
assert.ok(html.includes('Waiting for keys'));
assert.ok(!/outclass/i.test(html));

const quiet = broadcast.worldChannels();
assert.ok(quiet.every((c) => c.armed === false && c.posted === false));

process.env.X_BEARER_TOKEN = 'bearer-token-for-desk-only';
const armed = broadcast.worldChannels();
assert.equal(armed.find((c) => c.id === 'x').armed, true);
assert.equal(armed.find((c) => c.id === 'x').posted, false);
assert.equal(armed.find((c) => c.id === 'facebook').armed, false);
delete process.env.X_BEARER_TOKEN;

const shell = fs.readFileSync(path.join(__dirname, '../src/site/v2/shell.js'), 'utf8');
assert.ok(shell.includes('service-broadcast'));
assert.ok(shell.includes('worldDesk'));

const viralSrc = fs.readFileSync(path.join(__dirname, '../backend/modules/socialMediaViralizer.js'), 'utf8');
assert.ok(viralSrc.includes('postNextShelfService'));
assert.ok(viralSrc.includes("reason: 'keys_missing'"));
const orch = fs.readFileSync(path.join(__dirname, '../backend/modules/social-orchestrator/orchestrator.js'), 'utf8');
assert.ok(!orch.includes('logged_for_dispatch'));
assert.ok(!orch.includes('Autonomous social network is live'));

console.log('✅ service-broadcast.test.js: passed');
process.exit(0);
