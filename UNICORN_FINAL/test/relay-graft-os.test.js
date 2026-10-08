'use strict';

/**
 * relay-graft-os.test.js — RGP/1.0
 *
 * One hop a human can send (WhatsApp, SMS, email, the phone share sheet)
 * plus a script-free cite block any other site can paste.
 * A tap is not a visitor. An embed is not a user. paidHumans moves only
 * on a confirmed payment.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('  ✓', name); });
  }
  passed += 1;
  console.log('  ✓', name);
  return undefined;
}

console.log('Relay Graft Protocol (RGP/1.0)');

const rgp = require('../src/commerce/relay-graft-os');

check('discovery never invents visitors, users, reach, or shares', () => {
  const d = rgp.discovery();
  assert.strictEqual(d.protocol, 'RGP/1.0');
  assert.strictEqual(d.name, 'relay-graft-os');
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.page, '/relay');
  assert.strictEqual(d.wellKnown, '/.well-known/relay-graft.json');
  assert.strictEqual(d.inventsVisitors, false);
  assert.strictEqual(d.inventsUsers, false);
  assert.strictEqual(d.inventsHumans, false);
  assert.strictEqual(d.inventsGmv, false);
  assert.strictEqual(d.inventsReach, false);
  assert.strictEqual(d.inventsShares, false);
  assert.strictEqual(d.countsPageLoadsAsUsers, false);
  assert.equal(typeof d.paidHumans, 'number');
  assert.ok(d.paidHumans >= 0);
  assert.ok(d.offer && d.offer.priceUsd > 0);
  assert.ok(d.offer.buyUrl.includes(d.offer.serviceId));
  assert.ok(String(d.sentence).includes('$' + d.offer.priceUsd));
  assert.ok(!/millions of users|biggest site|trusted by thousands|guaranteed traffic/i.test(JSON.stringify(d)));
});

check('pass sentence stays honest when nobody has paid', () => {
  const sentence = rgp.passSentence({
    title: 'Instant Resume + LinkedIn Makeover',
    priceUsd: 39,
    paidHumans: 0,
  });
  assert.ok(sentence.includes('0 paid humans'));
  assert.ok(sentence.includes('$39'));
  assert.ok(/never invented/i.test(sentence));
});

check('whatsapp intent and cite block are tokenless and script-free', () => {
  const d = rgp.discovery();
  assert.ok(d.pass.whatsapp.startsWith('https://wa.me/?text='));
  const forwarded = decodeURIComponent(d.pass.whatsapp.slice(d.pass.whatsapp.indexOf('text=') + 5));
  assert.ok(forwarded.includes('$' + d.offer.priceUsd));
  assert.ok(forwarded.includes('/relay'));
  assert.ok(!/millions of users|biggest site/i.test(forwarded));
  assert.ok(d.pass.sms.startsWith('sms:?&body='));
  assert.ok(d.pass.email.startsWith('mailto:'));
  assert.strictEqual(d.pass.sharePage, '/share');
  assert.ok(d.embed.html.startsWith('<blockquote cite="'));
  assert.ok(d.embed.html.includes(d.landing));
  assert.ok(!/<script/i.test(d.embed.html));
  assert.ok(!/pixel|visitor counter/i.test(d.embed.html));
});

check('graft page offers one hop and refuses DOM sinks', () => {
  const d = rgp.discovery();
  const html = rgp.graftHtml();
  assert.ok(html.includes('RGP/1.0'));
  assert.ok(html.includes('https://wa.me/?text='));
  assert.ok(html.includes('sms:?&amp;body=') || html.includes('sms:?&body='));
  assert.ok(html.includes('id="copy-btn"'));
  assert.ok(html.includes('navigator.share'));
  assert.ok(html.includes('&lt;blockquote cite='));
  assert.ok(html.includes(JSON.stringify(d.sentence + '\n' + d.landing)));
  assert.ok(!/innerHTML|outerHTML|document\.write/.test(html));
  assert.ok(!/millions of users|biggest site in the world/i.test(html));
  assert.ok(!/(>|="|\s)(undefined|NaN|\[object Object\])(<|"|\s)/.test(html));
});

check('homepage strip is a pass, and the hero headline stays pinned', () => {
  const strip = rgp.homeStripHtml();
  assert.ok(strip.includes('id="homeRelayGraft"'));
  assert.ok(strip.includes('https://wa.me/?text='));
  assert.ok(strip.includes('href="/relay"'));
  assert.ok(!/millions of users|biggest site/i.test(strip));
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('id="dtHeroH1"'));
  assert.ok(shell.includes('discoverTrust.ssrVariant().h1'));
  assert.ok(shell.includes('Ship AI products at machine speed'));
  assert.ok(shell.includes("route === '/') return 'Instant Resume Makeover $39'"));
  assert.ok(shell.includes('homeRelayGraft') || shell.includes('relay-graft-os'));
});

check('rendered homepage includes the graft and keeps the pinned headline', () => {
  const shell = require('../src/site/v2/shell');
  const html = shell.getHtml('/');
  assert.ok(html.includes('id="homeRelayGraft"'));
  assert.ok(html.includes('Ship AI products at machine speed.'));
  assert.ok(html.includes('Send a stronger resume today.'));
  assert.ok(html.includes('id="dtHeroCta"'));
  assert.ok(html.includes('<title>Instant Resume Makeover $39 — ZEUSAI</title>'));
  assert.ok(html.includes('/relay'));
  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  assert.ok(desc && /\$39|resume/i.test(desc[1]));
  assert.ok(!/millions of users|biggest site in the world/i.test(html));
});

check('both site servers route /relay and relay-graft.json', () => {
  const site = read('src/index.js');
  assert.ok(site.includes("app.get(['/relay']"));
  assert.ok(site.includes("urlPath === '/relay'"));
  assert.ok(site.includes("'/.well-known/relay-graft.json'"));
  assert.ok(site.includes("urlPath === '/.well-known/relay-graft.json'"));
  assert.ok(site.includes("'/api/relay-graft'"));
  assert.ok(site.includes('relay_graft:'));
});

check('nginx pins relay-graft.json to the site in conf, snippet and self-heal', () => {
  const conf = read('scripts/nginx-unicorn.conf');
  const i = conf.indexOf('location = /.well-known/relay-graft.json');
  assert.ok(i >= 0, 'nginx-unicorn.conf');
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(i, i + 420)));
  const snippet = read('scripts/nginx-public-discovery.snippet.conf');
  const j = snippet.indexOf('location = /.well-known/relay-graft.json');
  assert.ok(j >= 0, 'snippet');
  assert.ok(snippet.slice(j, j + 420).includes('127.0.0.1:3001'));
  assert.ok(snippet.slice(j, j + 420).includes('no-store'));
  const patch = read('scripts/nginx-patch-public-discovery.py');
  assert.ok(patch.includes('location = /.well-known/relay-graft.json'));
  const k = patch.indexOf('location = /.well-known/relay-graft.json');
  assert.ok(patch.slice(k, k + 500).includes('127.0.0.1:3001'));
});

check('sitemap, IndexNow inventory and llms.txt advertise /relay', () => {
  const seo = read('src/seo/sitemap-helpers.js');
  assert.ok(seo.includes("'/relay'"));
  const te = read('backend/modules/traffic-engine.js');
  assert.ok(te.includes("'/relay'"));
  assert.ok(te.includes('relay-graft.json'));
  const sov = read('src/site/sovereign-extensions.js');
  assert.ok(sov.includes('/relay'));
  assert.ok(sov.includes('relay-graft.json'));
  assert.ok(sov.includes('RGP/1.0'));
  const wivp = read('src/commerce/world-index-os.js');
  assert.ok(wivp.includes("'/relay'"));
  assert.ok(wivp.includes("'/relay-graft'") || wivp.includes('relay-graft'));
});

check('test:chain includes relay-graft-os.test.js', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(String(pkg.scripts['test:chain']).includes('relay-graft-os.test.js'));
});

console.log('\n✅ relay-graft-os: ' + passed + ' tests passed');
process.exit(0);
