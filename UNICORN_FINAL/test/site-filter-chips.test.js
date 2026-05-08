/**
 * site-filter-chips.test.js — static regression guard for the SSR tier
 * filter chips on /services (and /marketplace which echoes pageServices).
 *
 * Bug we never want to re-introduce (reported 2026-05-08, screenshot of
 * zeusai.pro on Samsung Chrome):
 *   The four filter chips at the top of the catalog —
 *       All (25)  ⚡ Instant (10)  💼 Professional (8)  👑 Enterprise (7)
 *   — were silent stubs: clicking them did nothing.
 *
 * Root cause: `hydrateMasterCatalog()` in src/site/v2/client.js bound the
 * chip click handler ONLY inside the success branch of the
 * `/api/instant/catalog` fetch, AFTER the early-return that preserves
 * SSR-rendered cards when the API is empty/unhealthy. On split
 * site:3001 / backend:3000 production, the API path frequently lands on
 * the SSR-preserve branch, so the handler was never bound.
 *
 * Fix: bind the chip handler EARLY (before any API call) using an
 * SSR-aware tier filter that toggles `[data-product-id][data-tier]`
 * cards in place, and swap the renderer to `cat.items` once hydration
 * succeeds.
 *
 * This test pins the contract by static-string analysis of the SSR
 * template (shell.js) and the hydration code (client.js). It does not
 * boot the server, so it is fast, deterministic, and safe in every CI
 * lane (same shape as site-stability-guard.test.js).
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SHELL = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js'), 'utf8');
const CLIENT = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'site', 'v2', 'client.js'), 'utf8');

// ---------- 1) SSR contract: chips + cards ----------

// Chips are declared in pageServices() with `data-group="all|instant|
// professional|enterprise"`. The names are stable: the early-bound chip
// handler reads `chip.dataset.group` and the test below counts on those
// exact tokens.
for (const group of ['all', 'instant', 'professional', 'enterprise']) {
  assert.ok(
    SHELL.includes('data-group="' + group + '"'),
    'shell.js pageServices() must emit a chip with data-group="' + group + '"'
  );
}

// SSR product cards must carry `data-tier="<tier>"` so the early-bound
// chip handler can filter the SSR DOM by `[data-tier]` directly when
// the catalog API is empty/unhealthy. This matches `_catalogCard()` in
// shell.js which renders `data-tier="${_esc(p.tier || '')}"`.
assert.ok(
  /data-tier="\$\{_esc\(p\.tier[^"]*"/.test(SHELL),
  'shell.js _catalogCard must emit data-tier on every product card'
);
assert.ok(
  /data-product-id="\$\{id\}"/.test(SHELL),
  'shell.js _catalogCard must emit data-product-id on every product card'
);

// ---------- 2) Hydration contract: early chip binding ----------

// The chip click handler MUST be bound BEFORE the `/api/instant/catalog`
// fetch in hydrateMasterCatalog(). We assert this by checking the
// relative position of the binding marker (`filters.dataset.bound`)
// against the API call (`/api/instant/catalog`).
const hydrateMarker = "async function hydrateMasterCatalog(){";
const hydrateStart = CLIENT.indexOf(hydrateMarker);
assert.ok(hydrateStart > 0, 'hydrateMasterCatalog must exist in client.js');

// End of hydrateMasterCatalog: the next top-level `async function` or
// `function` declaration. We use the next async-function as a cheap upper
// bound (hydrateLiveSales is the next one in the file at the time of
// writing, declared as `async function hydrateLiveSales(`).
const hydrateNext = CLIENT.indexOf('async function hydrateLiveSales(', hydrateStart + 1);
assert.ok(hydrateNext > hydrateStart, 'hydrateLiveSales must follow hydrateMasterCatalog');
const hydrateBody = CLIENT.slice(hydrateStart, hydrateNext);

const bindIdx = hydrateBody.indexOf('filters.dataset.bound');
const apiIdx  = hydrateBody.indexOf("'/api/instant/catalog'");
assert.ok(bindIdx >= 0, 'hydrateMasterCatalog must bind the chip handler (filters.dataset.bound)');
assert.ok(apiIdx >= 0,  'hydrateMasterCatalog must fetch /api/instant/catalog');
assert.ok(
  bindIdx < apiIdx,
  'CHIP REGRESSION: filter-chip handler must be bound BEFORE the ' +
  '/api/instant/catalog fetch so the chips work even on the SSR-preserve ' +
  'early-return path. (bound at offset ' + bindIdx + ', API at offset ' + apiIdx + ')'
);

// The early binding MUST also delegate to a tier-filter function that
// inspects `data-tier` on SSR cards (so it works without cat.items).
assert.ok(
  /data-tier/.test(hydrateBody),
  'hydrateMasterCatalog must reference data-tier (SSR-aware filter path)'
);
assert.ok(
  /data-product-id/.test(hydrateBody),
  'hydrateMasterCatalog must reference data-product-id (SSR card selector)'
);

// The hydrated `render(group)` must remain wired so the success path
// repaints the grid from `cat.items[]`. Pin both the renderer signature
// and the swap-in.
assert.ok(
  /const render = \(group\)/.test(hydrateBody),
  'hydrateMasterCatalog must keep the hydrated renderer `const render = (group) => {...}`'
);
assert.ok(
  /_renderHydrated\s*=\s*render/.test(hydrateBody),
  'hydrateMasterCatalog must wire the hydrated renderer into the early-bound chip handler'
);

// ---------- 3) Idempotency guard preserved ----------

// `filters.dataset.bound` is the de-dupe latch. If it ever disappears,
// repeated hydration (e.g. SPA route returns to /services) would attach
// duplicate listeners and trigger the same render twice per click.
assert.ok(
  /if \(filters && !filters\.dataset\.bound\)/.test(hydrateBody),
  'hydrateMasterCatalog must keep the `!filters.dataset.bound` idempotency guard'
);

console.log('✓ site-filter-chips: SSR chips + cards contract holds');
console.log('✓ site-filter-chips: chip handler bound BEFORE /api/instant/catalog');
console.log('✓ site-filter-chips: SSR-aware filter (data-tier) wired');
console.log('✓ site-filter-chips: hydrated renderer swap-in wired');
console.log('✓ site-filter-chips: idempotency guard preserved');
process.exit(0);
