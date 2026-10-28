'use strict';

/**
 * one-homepage.test.js
 * The generic URL is one English document for every country.
 * IP and Accept-Language do not change it, and it is not a set of language URLs.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const shell = require('../src/site/v2/shell');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('One homepage');

check('a Romanian request still receives the English document', () => {
  const html = shell.getHtml('/', { lang: 'ro', autoLang: 'fr', country: 'RO' });
  assert.match(html, /<html lang="en"/);
  assert.match(html, /property="og:locale" content="en_US"/);
  assert.match(html, /<h1 id="dtHeroH1">Cut Your AI API Costs by 70% Automatically<\/h1>/);
  assert.ok(html.includes('id="homeLocale"'));
  assert.ok(html.includes('English. The same page in every country. This address is not redirected.'));
  assert.ok(html.includes('class="lang-mark"'));
  assert.doesNotMatch(html, /hreflang=/);
  assert.doesNotMatch(html, /\?lang=/);
  assert.doesNotMatch(html, /googtrans/);
  assert.doesNotMatch(html, /lang-toggle/);
  assert.doesNotMatch(html, /id="homeAtlas"/);
  assert.match(html, /rel="canonical" href="https:\/\/zeusai\.pro\/"/);
});

check('the server does not pick a language from country or Accept-Language', () => {
  const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(site.includes("const lang = 'en'"));
  assert.ok(!site.includes('COUNTRY_TO_LANG'));
  assert.ok(!site.includes('cookieLang || autoLang'));
  assert.ok(!site.includes("'Content-Language': lang"));
  assert.ok(site.includes("'Content-Language': 'en'"));
  assert.ok(!site.includes('Accept-Language, Accept-Encoding'));
  const sov = fs.readFileSync(path.join(__dirname, '../src/site/sovereign-extensions.js'), 'utf8');
  assert.ok(sov.includes("res.setHeader('X-Unicorn-Lang', 'en')"));
  assert.ok(sov.includes('separate_language_urls: false'));
  assert.ok(sov.includes("inLanguage: 'en'"));
  assert.ok(!sov.includes('inLanguage: SUPPORTED_LANGS'));
});

console.log(`\n✅ one-homepage: ${passed} tests passed`);
process.exit(0);
