# CACHE CONTROL FIXED — zeusai.pro (anti-stale rollout)

Date: 2026-05-02  
Scope: `UNICORN_FINAL` runtime + edge + deploy pipeline

## Objective

Guarantee that any visitor (new or returning, any device/browser) receives the newest HTML immediately after deploy, while static versioned assets are cached safely and aggressively.

---

## 1) HTML cache policy (strict no-cache / no-store)

Implemented in app runtime and edge policy:

- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

Applied in:
- app-level HTML response guard in `UNICORN_FINAL/src/index.js`
- nginx HTML route policy in `UNICORN_FINAL/scripts/nginx-unicorn.conf`

Result: HTML is always revalidated/fetched fresh, preventing stale document shells.

---

## 2) Hashed static assets (content-addressed)

Implemented hashed asset resolution and manifest logic:

- `assetPath(logicalPath)`
- `resolveAssetPath(requestPath)`
- browser-side asset manifest injection

Core changes:
- `UNICORN_FINAL/src/site/v2/build-id.js`
- `UNICORN_FINAL/src/site/v2/shell.js`
- `UNICORN_FINAL/src/site/v2/client.js`
- `UNICORN_FINAL/src/index.js`
- `UNICORN_FINAL/src/site/sovereign-extensions.js`

Behavior:
- HTML references assets like `/assets/app.<hash>.css` and `/assets/app.<hash>.js`
- Server resolves hashed paths back to canonical assets
- Versioned asset responses use immutable long cache

---

## 3) CDN policy (manual dashboard settings required)

Recommended Cloudflare/edge configuration:

1. **HTML routes** (`/`, `/*.html`, app routes):
   - Cache Level: Bypass (or equivalent)
   - Respect origin headers: ON
   - Do not force cache on HTML

2. **Static hashed assets** (`/assets/*.css`, `/assets/*.js`, images/fonts with hashes):
   - Cache Level: Cache Everything (optional if respecting origin is enough)
   - Edge TTL: long (e.g. 1 year)
   - Browser TTL: long
   - Respect immutable origin header

3. **Purge strategy**:
   - Prefer no full purge for deploys (hashing makes assets naturally new)
   - If emergency: purge HTML only

Note: these CDN rules are external to repository and must be set in provider dashboard.

---

## 4) Service Worker stale behavior disabled

Legacy SW caching path removed/neutralized.

Changes:
- `UNICORN_FINAL/src/site/v2/sw.js` converted to cleanup/unregister worker
- `UNICORN_FINAL/src/site/v2/shell.js` now unregisters existing service workers + clears caches
- SW no longer acts as an offline HTML cache source

Result: browser cannot serve old app shell via stale SW cache.

---

## 5) Nginx cache split policy

Implemented explicit route classes in:
- `UNICORN_FINAL/scripts/nginx-unicorn.conf`

Rules:
- `*.html` => strict no-cache/no-store headers
- static extensions (`css/js/png/jpg/jpeg/gif/ico/svg/woff2`) => long immutable caching

Result: origin/edge policy aligns with app-level policy.

---

## 6) Atomic deploy flow (release + symlink cutover)

Deployment workflow updated to release-based cutover model (blue/green style semantics):
- deploy to release dir
- symlink switch (`current`/target) for near-atomic activation

Changes in:
- `.github/workflows/deploy.yml`

Result: reduced mixed-version windows during deployment.

---

## 7) Post-deploy automatic verification

Added verification script:
- `UNICORN_FINAL/scripts/verify-cache-freshness.sh`

Checks:
- HTML headers contain strict no-cache/no-store directives
- homepage includes hashed CSS and JS paths

Integrated into CI workflow:
- `.github/workflows/deploy.yml`

---

## 8) Legacy browser fallback meta tags

Inserted no-cache fallback meta in HTML head:

- `<meta http-equiv="Cache-Control" ...>`
- `<meta http-equiv="Pragma" ...>`
- `<meta http-equiv="Expires" ...>`

Applied in:
- `UNICORN_FINAL/src/site/v2/shell.js`
- HTML safety injection in `UNICORN_FINAL/src/index.js`

---

## Local validation performed

Validated locally after implementation:
- status `200`
- `cache-control: no-cache, no-store, must-revalidate`
- `pragma: no-cache`
- `expires: 0`
- hashed assets present in HTML (`/assets/app.<hash>.css`, `/assets/app.<hash>.js`)

---

## Pending / manual follow-up

1. Apply/confirm CDN dashboard cache rules (Cloudflare or provider equivalent).
2. Confirm live production headers and hashed assets on `https://zeusai.pro` after latest deploy.
3. Optional manual browser checks on Safari/Firefox/Chrome mobile for hard-refresh behavior.

---

## Final status

Repository-side anti-stale implementation is complete for all requested technical layers:
- app headers
- hashed assets
- SW cleanup
- nginx policy
- deploy cutover
- automated verification
- legacy fallback meta
