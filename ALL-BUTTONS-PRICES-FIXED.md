# ALL-BUTTONS-PRICES-FIXED.md

> Forward-only architectural fix · 2026-05-09 · zeusai.pro
> Owner: Vladoi Ionut · BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e

## Why this exists

User reported (correctly) that:

1. Prices on the live site bore no relation to the catalog (`instant-pitch-deck` SSR=$72 but catalog says $149; `unicorn-billion-scale-activation` engine=$80 but catalog says $500,000).
2. Filter chips on `/services` and the home featured grid (**All 25 / Instant / Professional / Enterprise**) plus several CTAs did nothing on click.

Both defeat the storefront's primary purpose: selling at the catalog's intended price with a fully functional UX.

## Root causes (architectural)

### Pricing
`backend/modules/dynamic-pricing.js` exposed a `BASE_PRICES` table with **only 14 SaaS-tier ids** (`free, starter, pro, enterprise, api-call, ai-analysis, wealth-engine, legal-bot, cloud-broker, data-export, sme, mid-market, enterprise-tier, global-giants`). Every other catalog id (the 578 services served by `/api/services`, plus the 25 curated unified-catalog items shown on the home + `/services` pages) fell through to a generic `99` fallback. The engine's per-service variance, demand factor and discount were then applied on top of `99`, producing $72-$89 for products whose real catalog price ranged from $49 to $500,000.

The SSR loop in `src/site/v2/shell.js` (`_loadCatalog`, `_loadFullLibrary`) called `dp.getPrice(id)` and **overrode the catalog's `priceUSD` with the engine's wrong fallback** — so the wrong number was already baked into the first paint. Live-pricing-broker's SSE channel published the same wrong shape, so even the post-hydration refresh stayed wrong.

### Buttons
The home page and `/services` SSR template emit chips like `<button class="chip" data-group="instant">⚡ Instant (10)</button>`. The only chip handler in `client.js` matched `chip.dataset.cat` (set on chips it built dynamically inside the SPA renderer). SSR chips that arrived before any SPA hydration were therefore dead. Other CTAs (`Buy with BTC →`, `Find my plan`, `Sign in`, `Explore Services`, `Buy AI Service`) were already correct anchors with `data-link` — but they linked to checkout flows that priced products incorrectly because of root cause #1.

## Forward-only fixes (5 files + 1 new test)

| # | File | Change |
|---|------|--------|
| 1 | [UNICORN_FINAL/backend/modules/dynamic-pricing.js](UNICORN_FINAL/backend/modules/dynamic-pricing.js) | `getPrice(id, options)` now accepts `options.basePrice` override. Added `registerService(id, basePrice)`, `registerServices(items)`, `hasService(id)`. Returned shape now includes `baseSource: 'override'\|'registered'\|'fallback-default'` so callers can detect the engine guess and refuse it. Once-per-id warning when fallback is used (no log floods on broker iteration). |
| 2 | [UNICORN_FINAL/src/site/v2/shell.js](UNICORN_FINAL/src/site/v2/shell.js) | `_loadCatalog` and `_loadFullLibrary` now pass `{ basePrice: catalog.priceUSD }` into `dp.getPrice()`, so the engine's demand factor multiplies the **real catalog floor**. They also reject the engine's `fallback-default` source and call `dp.registerService()` so subsequent `/api/pricing/{id}` calls in the same process are correct. |
| 3 | [UNICORN_FINAL/src/index.js](UNICORN_FINAL/src/index.js#L1066) | Boot-time seeding: after `unifiedCatalog`, `instantCatalog`, `entCatalog` are required, every catalog id's `priceUSD` is registered with the engine. The `/api/pricing/:serviceId` proxy now detects when the backend response carries a `default` source or `basePrice === 99` despite a real catalog floor existing locally, and **recomputes with the real base** by replaying the engine multiplier on the catalog price. New tiny telemetry sink `/api/site/log` accepts the button-audit beacon. |
| 4 | [UNICORN_FINAL/src/site/v2/client.js](UNICORN_FINAL/src/site/v2/client.js#L532) | New document-level delegated handler binds **every SSR `[data-group]` chip** (All / Instant / Professional / Enterprise) on every page. Filters cards by `[data-tier]` across `#catalogGrid` and `#homeFeaturedGrid`. Independent of any SPA hydration round-trip, so chips work the moment the HTML lands. Added `_auditButtonsForMissingHandlers()` that runs on `load` + `unicorn:hydrated` and beacons any visible CTA without a handler to `/api/site/log`. |
| 5 | [UNICORN_FINAL/test/buttons-and-prices.test.js](UNICORN_FINAL/test/buttons-and-prices.test.js) | Static + live-load regression test: dynamic-pricing accepts override, exports new functions, returns proper `baseSource`; `shell.js` passes the override; `src/index.js` seeds the engine and corrects the proxy; `client.js` binds the SSR chip filter and runs the audit. |
| 6 | [UNICORN_FINAL/package.json](UNICORN_FINAL/package.json) | Added new test to `npm test` chain. |

## Buttons inventory · status after the fix

| Page | Button / chip | Behavior |
|------|---------------|----------|
| Home | nav links (Home, Marketplace, Find my plan, Store, Crypto Bridge, Enterprise, Pricing, Innovations, Frontier, API, Status) | ✅ SPA navigation via `data-link` |
| Home | `Sign in` (`/account`), `Explore Services` (`/services`) | ✅ SPA navigation |
| Home | `Buy AI Service →` (`/services`) | ✅ SPA navigation |
| Home | `Buy with BTC →` per featured card | ✅ Opens `/checkout?plan={id}` → sovereign-commerce checkout endpoint (live, returns 201 with BIP21 URI) |
| Home | `Details` per card | ✅ Navigates to `/services/{id}` |
| `/services` | `All (25)`, `⚡ Instant (10)`, `💼 Professional (8)`, `👑 Enterprise (7)` | ✅ **NEW**: filters `[data-tier]` cards via the delegated `[data-group]` handler |
| `/services` | `Buy with BTC →`, `Details` per card | ✅ Same flow as home |
| `/wizard` | `Find my plan` form | ✅ Existing flow, no regression |
| `/account` | `Sign in` / `Create account` (Ed25519 cryptoauth) | ✅ Existing |
| `/checkout` | `Confirm BTC` / `Stripe` / `PayPal` chips | ✅ Existing sovereign-commerce flow |
| All pages | Visible CTA without handler | ❌ → `console.warn` + `/api/site/log` beacon |

## Prices · before / after (sample)

| ID | Catalog floor | Live SSR before | Live SSR after | `/api/pricing/{id}` after |
|----|--------------:|----------------:|---------------:|--------------------------:|
| `instant-pitch-deck` | $149 | $72 | ≈ $149 × demand (e.g. $134.55) | `basePrice: 149`, `baseSource: registered` |
| `instant-website-audit` | $49 | $81 | ≈ $49 × demand | `basePrice: 49` |
| `instant-landing-page` | $199 | $78 | ≈ $199 × demand | `basePrice: 199` |
| `professional-saas-mvp` | (catalog) | $78 | catalog × demand | seeded |
| `ent-private-cloud` | (catalog) | $71 | catalog × demand | seeded |
| `unicorn-billion-scale-activation` | $500,000 | $80 | $500k × demand (≈ $451k) | seeded |
| `pro` (SaaS tier) | $99 | $99 × demand (correct) | unchanged | unchanged |

## Real-time refresh

Already-existing channel `/api/pricing/live/stream` (named SSE event `pricing`) is wired in `client.js#openPricingStream`. Anchors `[data-pricing-value="{id}"]` and `[data-price-btc-value="{id}"]` are updated on every snapshot. No polling fallback needed because the broker emits at ≤60s cadence; if the stream 503s, the per-card `fetchLivePricing` loop kicks in.

## Auto-report on regression

`_auditButtonsForMissingHandlers()` runs 1.2s after `load` and 600ms after every `unicorn:hydrated` event. It selects all visible `button, .btn, a.btn, a[role="button"], [data-cta]` and flags any without `href` (other than `#`/`javascript:`), `onclick`, `data-action`, `data-link`, `data-group`, `data-cat`, `data-method`, an id, or `type="submit"`. Dead CTAs are `console.warn`-ed and beaconed to `/api/site/log`. Operations can scrape PM2 logs for `[site-log] kind=button-audit` to see regressions within 1.2s of any user landing on a broken page.

## Tests

```
npm test → EXIT=0 · 22 ✓
✓ buttons-and-prices: dynamic-pricing engine accepts basePrice override + register API
✓ buttons-and-prices: shell.js SSR multiplies demand on catalog floor
✓ buttons-and-prices: src/index.js seeds engine + corrects proxy fallback
✓ buttons-and-prices: client.js binds SSR chip filter + dead-CTA audit
+ all pre-existing tests (filter-chips, live-pricing-broker, live-pricing-sse, …) green.
```

`npm run lint` → 0 warnings · 0 errors.
`npm run lint:syntax` → backend + site clean.

## Live verification (post-deploy)

After the GitHub Actions `🚀 Unicorn Stable Deploy` workflow lands the build SHA, a follow-up curl sweep should confirm:

```
curl -s 'https://zeusai.pro/api/pricing/instant-pitch-deck' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['basePrice'], d['price_usd'], d.get('baseSource'))"
# expected: 149 ≈$134 registered  (was: 99 ≈$80 fallback-default)

curl -s 'https://zeusai.pro/api/pricing/unicorn-billion-scale-activation' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['basePrice'], d['price_usd'])"
# expected: 500000 ≈$451200  (was: 99 ≈$80)

curl -s 'https://zeusai.pro/' | grep -oE 'data-pricing-value="instant-pitch-deck">\$[0-9.]+' | head -1
# expected: $130-$170 band  (was: $72.15)
```

Chip filters can be verified visually at https://zeusai.pro/services — clicking `⚡ Instant (10)` hides Professional + Enterprise cards instantly via the delegated handler.
