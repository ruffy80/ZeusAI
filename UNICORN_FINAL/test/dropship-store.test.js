// =====================================================================
// dropship-store.test.js — static regression guard for the Autonomous
// Dropshipping storefront (/dropship, /dropship/product/:id, /zacc).
//
// Bug class we never want to re-introduce (reported live: "nu sunt poze la
// produse, butonul de buy nu functioneaza"):
//
//   The pages emitted backslash-escaped double quotes INSIDE double-quoted
//   HTML attributes, e.g.
//       style="...background:#0d0d1a url(\"IMG\")..."
//       onclick="openInvoice(\"ID\",\"TITLE\")"
//   Browsers do NOT honour backslash escapes in attribute values, so the
//   attribute is truncated at the first \" — the product photo never loads
//   (empty placeholder) and the Buy/Approve buttons throw "Invalid or
//   unexpected token" on click (button does nothing).
//
//   Fix: product images render as a real lazy <img> with an onerror fallback,
//   and Buy/Approve are wired via delegated listeners reading data-* attrs
//   (quote-safe, XSS-safe) instead of fragile inline onclick.
//
// This guard is purely static (reads the source file — no boot, no network),
// so it is fast, deterministic and safe in every CI lane.
// =====================================================================

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');

// ---------- 1) the broken escaping must be gone ----------
// Backslash-double-quote inside a CSS url() background (the "no images" bug).
assert.ok(
  SRC.indexOf('url(\\"') === -1,
  'REGRESSION: backslash-escaped quote inside a CSS url(...) found in src/index.js. ' +
  'Browsers truncate the attribute there, so product images never load. ' +
  'Render images as a real <img> instead.'
);

// Backslash-double-quote inside an inline onclick handler (the "buy button
// does nothing" bug) for the dropship/zacc actions.
assert.ok(
  !/onclick="(?:openInvoice|approveIdea)\(\\"/.test(SRC),
  'REGRESSION: inline onclick with backslash-escaped quotes found in src/index.js. ' +
  'It throws "Invalid or unexpected token" on click. ' +
  'Use a delegated click listener reading data-* attributes instead.'
);

// ---------- 2) the robust replacements must be present ----------
// A real lazy <img> with an onerror fallback (graceful when a remote photo 404s).
assert.ok(
  SRC.indexOf('<img src=') !== -1 && SRC.indexOf('onerror="this.remove()"') !== -1,
  'EXPECTED: product images should render as an <img> with an onerror fallback.'
);
assert.ok(
  SRC.indexOf('object-fit:cover') !== -1,
  'EXPECTED: product <img> should use object-fit:cover to fill the media box.'
);
assert.ok(
  SRC.indexOf('loading="lazy"') !== -1,
  'EXPECTED: product images should be lazy-loaded for performance.'
);

// Buy buttons use data-* + delegation (count the markup occurrences and the
// delegated listeners that consume them).
const dataBuyMarkup = (SRC.match(/data-buy data-pid="/g) || []).length;
assert.ok(
  dataBuyMarkup >= 2,
  'EXPECTED: /dropship grid and /zacc Buy buttons should emit data-buy/data-pid markup (found ' + dataBuyMarkup + ').'
);
const delegatedBuy = (SRC.match(/closest\("\[data-buy\]"\)/g) || []).length;
assert.ok(
  delegatedBuy >= 2,
  'EXPECTED: a delegated [data-buy] click listener should be bound on each grid (found ' + delegatedBuy + ').'
);

// Approve button (admin) on /zacc also uses delegation.
assert.ok(
  SRC.indexOf('data-approve data-id="') !== -1 && SRC.indexOf('closest("[data-approve]")') !== -1,
  'EXPECTED: the /zacc Approve button should use data-approve + a delegated listener.'
);

// The product detail page binds Buy from the product closure (quote-safe).
assert.ok(
  SRC.indexOf('id="dp-buy"') !== -1,
  'EXPECTED: the /dropship/product page Buy button should carry id="dp-buy".'
);
assert.ok(
  /getElementById\("dp-buy"\)[\s\S]*addEventListener\("click"/.test(SRC),
  'EXPECTED: the /dropship/product page should bind #dp-buy via addEventListener.'
);

console.log('\u2713 dropship-store: images render as robust <img>, Buy/Approve use delegated data-* handlers');
console.log('\nDropship storefront regression guard passed.');
process.exit(0);
