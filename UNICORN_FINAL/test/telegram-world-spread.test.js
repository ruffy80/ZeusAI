'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const spread = require('../backend/modules/telegram-world-spread');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('a shelf post uses the given price and does not invent a crowd', () => {
  const post = spread.buildPost({
    offers: [{ id: 'instant-website-audit', title: 'Instant Website Audit', usd: 44.1 }],
    cta: 'https://zeusai.pro/services',
    members: null,
  });
  assert.ok(post.text.includes('$44.10'));
  assert.ok(post.text.includes('not estimated'));
  assert.ok(!/biggest|most users|world.s largest/i.test(post.text));
  assert.ok(post.buttons[0][1].url.includes('t.me/share/url'));
  const urls = JSON.stringify(post.buttons);
  assert.ok(urls.includes('serviceId=instant-website-audit'));
});

check('a measured member count is printed as Telegram reported it', () => {
  const post = spread.buildPost({
    offers: [{ id: 'instant-logo-kit', title: 'Instant Brand Logo Kit', usd: 89.1 }],
    members: 12,
  });
  assert.ok(post.text.includes('Telegram reports 12 members'));
});

check('inline cards carry the same dollars and a checkout link', () => {
  const cards = spread.inlineResults([
    { id: 'instant-resume-makeover', title: 'Instant Resume + LinkedIn Makeover', usd: 35.1 },
  ]);
  assert.equal(cards.length, 1);
  assert.ok(cards[0].title.includes('$35.10'));
  assert.ok(cards[0].input_message_content.message_text.includes('utm_source=telegram'));
});

check('an empty shelf does not invent a price', () => {
  const cards = spread.inlineResults([]);
  assert.equal(cards[0].id, 'zeusai-site');
  assert.ok(!/\$\d/.test(cards[0].input_message_content.message_text));
});

check('the public shell carries Telegram on the header, footer, and banner', () => {
  const shell = require('fs').readFileSync(require('path').join(__dirname, '../src/site/v2/shell.js'), 'utf8');
  assert.ok(shell.includes('data-telegram="header"'));
  assert.ok(shell.includes('data-telegram="footer"'));
  assert.ok(shell.includes('data-telegram="banner"'));
  assert.ok(shell.includes('data-telegram="popup"'));
  assert.ok(shell.includes('telegram_click'));
  assert.ok(shell.includes('30000'));
});

check('a quiet channel still gets an invite post', () => {
  const decision = spread.nextGrowthPost({
    silenced: false,
    postsToday: 0,
    maxPosts: 6,
    sinceLastMs: null,
    gapMs: 30 * 60 * 1000,
  });
  assert.equal(decision.action, 'live_shelf');
  assert.equal(decision.reason, 'grow');
  const capped = spread.nextGrowthPost({ silenced: false, postsToday: 6, maxPosts: 6, sinceLastMs: null, gapMs: 1 });
  assert.equal(capped.reason, 'daily_cap');
});

check('a new article is chosen once', () => {
  const first = spread.nextArticle([
    { slug: 'autonomous-ai-commerce', title: 'What autonomous AI commerce means' },
    { slug: 'ai-resume-service-bitcoin', title: 'An AI resume service' },
  ], ['autonomous-ai-commerce']);
  assert.equal(first.slug, 'ai-resume-service-bitcoin');
  const text = spread.articleMessage(first);
  assert.ok(text.includes('/insights/ai-resume-service-bitcoin'));
  assert.equal(spread.nextArticle([{ slug: 'autonomous-ai-commerce', title: 'x' }], ['autonomous-ai-commerce']), null);
});

console.log(passed + ' passed');
