'use strict';

/**
 * declaration-desk.test.js — DECL/1.0
 * A public checklist the visitor signs. No grade, no ranking, no post.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decl-'));
process.env.DECLARATION_DIR = tmp;

const desk = require('../src/commerce/declaration-desk');
desk.resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Declaration desk (DECL/1.0)');

check('a signed checklist is a card, not a grade', () => {
  const out = desk.publish({
    repo: 'https://github.com/acme/widget.git/',
    name: 'Ada',
    check: ['readme', 'tests', 'architecture'],
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.record.repo, 'acme/widget');
  assert.strictEqual(out.record.url, 'https://github.com/acme/widget');
  assert.strictEqual(out.record.claimed, 3);
  assert.strictEqual(out.record.of, 8);
  assert.strictEqual(out.record.opened, false);
  assert.strictEqual(out.record.scored, false);
  assert.strictEqual(out.record.posted, false);
  assert.strictEqual(out.record.displayName, 'Ada');
  const html = desk.cardHtml(out.record);
  assert.ok(html.includes('You declared 3 of 8. Zeus did not open the repository.'));
  assert.ok(html.includes('Share this declaration'));
  assert.ok(html.includes('Selected — copy it'));
  assert.ok(html.includes('name="robots" content="noindex"'));
  assert.ok(!html.includes('Architecture Score'));
  assert.ok(!html.includes('Top 1%'));
  assert.ok(!html.includes('Top 5%'));
  const svg = desk.badgeSvg(out.record);
  assert.ok(svg.includes('3 of 8 declared'));
  assert.ok(svg.includes('self-reported'));
  assert.ok(svg.includes('Zeus did not open this repository'));
  assert.ok(!svg.includes('Top 1%'));
  const pdf = desk.cardPdf(out.record).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('Zeus did not open the repository.'));
  const copy = desk.drafts(out.record);
  assert.strictEqual(copy.posted, false);
  assert.ok(copy.x.includes('ZeusAI did not read the code.'));
  assert.ok(copy.linkedin.includes(out.record.repo));
});

check('an organization URL and a non-github URL are refused', () => {
  for (const repo of [
    'https://github.com/acme',
    'https://github.com/acme/widget/tree/main',
    'http://github.com/acme/widget',
    'https://gitlab.com/acme/widget',
    '',
  ]) {
    const out = desk.publish({ repo, check: ['readme'] });
    assert.strictEqual(out.ok, false, repo || '(empty)');
  }
});

check('the feed is time order, and an empty feed invents nothing', () => {
  desk.resetForTests();
  const empty = desk.feedHtml();
  assert.ok(empty.includes('No declaration has been published.'));
  assert.ok(!empty.includes('analyzed'));
  assert.ok(!empty.includes('Top 100'));
  const many = desk.publish({
    repo: 'https://github.com/acme/full',
    check: ['readme', 'tests', 'deploy', 'secrets', 'pinned', 'owner', 'architecture', 'prompt'],
  });
  const few = desk.publish({
    repo: 'https://github.com/acme/thin',
    name: 'https://evil.example',
    check: ['readme'],
  });
  assert.strictEqual(few.record.displayName, 'unsigned');
  assert.strictEqual(few.record.claimed, 1);
  assert.strictEqual(many.record.claimed, 8);
  const rows = desk.list();
  assert.strictEqual(rows[0].repo, 'acme/thin');
  assert.strictEqual(rows[1].repo, 'acme/full');
  const html = desk.feedHtml();
  assert.ok(html.indexOf('acme/thin') < html.indexOf('acme/full'));
  assert.ok(html.includes('just now') || html.includes('seconds ago'));
  const again = desk.publish({ repo: 'https://github.com/acme/thin', check: ['tests'] });
  assert.strictEqual(again.duplicate, true);
  assert.strictEqual(again.id, few.id);
  assert.strictEqual(desk.list().length, 2);
});

check('the page, the footer, and the sitemap keep the contract', () => {
  const root = path.join(__dirname, '..');
  const src = fs.readFileSync(path.join(root, 'src/commerce/declaration-desk.js'), 'utf8');
  const site = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'src/site/v2/shell.js'), 'utf8');
  assert.ok(!src.includes('api.github.com'));
  assert.ok(!/\bfetch\s*\(/.test(src));
  assert.ok(!src.includes('Architecture Score'));
  assert.ok(!src.includes('Top 1%'));
  assert.ok(src.includes('Zeus did not open the repository'));
  assert.ok(site.includes("urlPath === '/declare'"));
  assert.ok(site.includes("app.post('/declare'"));
  assert.ok(shell.includes('href="/declare"'));
  assert.ok(shell.includes('data-allow-raw="1"'));
  const form = desk.formHtml();
  assert.ok(form.includes('A number that did not read the repository is not a roast.'));
  assert.ok(form.includes('index,follow'));
  assert.ok(!form.includes('Architecture Score'));
  const seo = require('../src/seo/sitemap-helpers');
  const paths = seo.MARKETING_PAGES.map((row) => row.path);
  assert.deepStrictEqual(paths, [
    '/',
    '/about',
    '/pricing',
    '/contact',
    '/solutions/model-routing',
    '/solutions/self-healing',
    '/solutions/autonomous-agents',
  ]);
  assert.ok(!paths.includes('/declare'));
  const policy = desk.discovery().policy;
  assert.strictEqual(policy.opensRepository, false);
  assert.strictEqual(policy.assignsScore, false);
  assert.strictEqual(policy.ranks, false);
  assert.strictEqual(policy.posts, false);
  assert.strictEqual(policy.inventsEvents, false);
  assert.strictEqual(policy.signup, false);
});

console.log(`\n✅ declaration-desk: ${passed} tests passed`);
process.exit(0);
