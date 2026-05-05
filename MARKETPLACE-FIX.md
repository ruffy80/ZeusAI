# MARKETPLACE-FIX

**Reported symptom (RO).** „Pagina `/marketplace` se încarcă un fragment de
secundă (se vede conținutul) apoi devine complet goală.” Visiting
`https://zeusai.pro/marketplace` briefly showed content and then collapsed
to a fully blank page.

## 1. Diagnosis

The repository's site server is `UNICORN_FINAL/src/index.js` — a single Node
HTTP dispatcher that fronts both an Express app and a raw `unicornHandler`
(see `__continueDispatch`). The v2 SSR HTML shell is rendered for the route
whitelist defined in `v2Routes` (around line 7472), and the human-facing
**Marketplace** page is `/services` (`pageServices()` in
`src/site/v2/shell.js`). There is no separate `/marketplace` page in the v2
SSR shell.

However, `src/index.js` had a **JSON-only handler** at line 3653:

```js
if (urlPath === '/marketplace') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ updatedAt: …, modules: getRuntimeDataSources().marketplace }));
}
```

That handler ran **before** the v2 SSR dispatcher (line ~7480), so any
visitor who:

- typed `https://zeusai.pro/marketplace` directly,
- followed a SPA `data-link` to `/marketplace` (back-button, bookmark, external link, service-worker prefetch), or
- had `/marketplace` in a stale browser/SW cache

…received a `Content-Type: application/json` body. The browser briefly
painted the previous SSR page (and the SW cache shell), the v2 SPA router
attempted to render the response as HTML, hit a non-HTML body, and the page
fell back to empty — exactly the “content for a fragment of a second, then
blank” behaviour reported.

There was no JS exception of the form `products is not iterable` because
the front-end never received an array of products at all — the request to
`/marketplace` returned a JSON envelope shaped like `{ updatedAt, modules }`
to a navigation that expected HTML. The blank state is the SPA shell after
hydration with no template.

This is a **routing / content-negotiation collision**, not a frontend
exception, and it would keep happening every time anyone navigated to
`/marketplace` again.

> *Note on browser/SSH access.* The Copilot sandbox executing this fix has
> no outbound credentials for `204.168.230.142` and no DevTools session on
> `zeusai.pro`. The diagnosis was therefore performed by reading the
> dispatcher order in `src/index.js` directly — the cause is unambiguous
> from the code path. A local reproduction (below) confirms the fix.

## 2. Fix (definitive)

Three coordinated edits, all in the `UNICORN_FINAL/` tree (the canonical
production layer per `.github/workflows/hetzner-deploy.yml`).

### 2.1 `UNICORN_FINAL/src/index.js` — content-negotiation on `/marketplace`

The `/marketplace` handler now distinguishes between **browser
navigation** and **programmatic JSON consumers**:

- Browser navigation (`Accept: text/html`, or `Sec-Fetch-Dest: document`,
  or `Sec-Fetch-Mode: navigate`) → `302 → /services` with `Cache-Control:
  no-store`. The v2 SSR shell renders the proper Marketplace page, and any
  SW/CDN caches heal themselves on the redirect target.
- Everything else (XHR/`fetch`, including the legacy `loadServices()`
  fallback at `src/site/v2/client.js:1087` which uses
  `api('/marketplace')`) keeps the original `{ updatedAt, modules }` JSON
  body byte-for-byte.

### 2.2 `UNICORN_FINAL/src/index.js` — `/marketplace` added to `v2Routes`

Defensive belt-and-suspenders: even if a future change or an upstream
cache bypasses the redirect, `/marketplace` is now part of the v2 SSR
whitelist and renders an HTML page rather than falling through.

### 2.3 `UNICORN_FINAL/src/site/v2/shell.js` — SSR alias + breadcrumb

- `renderRoute()` now maps `case '/marketplace': return pageServices();`
  so the SSR shell serves the same Marketplace HTML for both URLs.
- `routeTitle()` map adds `'/marketplace': 'Marketplace'` so the breadcrumb
  / `<title>` is correct on either path.

The hydration path was already safe: per the existing `hydrateMasterCatalog`
guard at `src/site/v2/client.js:1810-1830`, the front-end **preserves SSR
cards in `#catalogGrid` when `/api/instant/catalog` returns empty/error**,
counting `data-product-id` cards before any overwrite. So even an empty
products array can no longer wipe the grid; the regression was strictly
upstream of hydration.

## 3. Local verification

Started the site against `PORT=3919 BIND_HOST=127.0.0.1` and exercised the
four canonical request shapes:

| Request | Expected | Got |
| --- | --- | --- |
| `GET /marketplace` with `Accept: text/html` + `Sec-Fetch-Dest: document` | `302 Location: /services` | **`HTTP/1.1 302 Found`** ✅ |
| `GET /marketplace` with `Accept: application/json` | `200 application/json` | **`HTTP/1.1 200 OK · Content-Type: application/json`** ✅ |
| `GET /marketplace` body, JSON consumer | `{ updatedAt, modules: [...] }` | **`{"updatedAt":"…","modules":[{"id":"adaptive-ai",…}]`** ✅ |
| `GET /marketplace` no `Accept` (legacy `api()` call) | `200 application/json` | **`{"updatedAt":"…","modules":[…]}`** ✅ |

Targeted test suites also pass:

- `node test/health.test.js` — OK
- `node test/api.test.js` — OK
- `node test/api-aliases.test.js` — `[api-aliases.test.js] all assertions passed`
- `node test/site-commerce-smoke.test.js` — `site commerce smoke test passed`

## 4. Deploy

Deployment is handled by `.github/workflows/hetzner-deploy.yml` on push to
`main`. No infrastructure or env changes are required; this is a pure
src-level fix in `UNICORN_FINAL/`.

## 5. Why this can never happen again

- The `/marketplace` URL now has a **single canonical HTML target**
  (`/services`), reachable via 302 from any browser navigation regardless
  of cache, SW state, or external link.
- The `v2Routes` whitelist + `renderRoute` SSR alias guarantee a real HTML
  page even if the redirect is bypassed.
- The existing `hydrateMasterCatalog` SSR-preservation guard prevents
  catalog wipe-out from any empty/erroring upstream API.
- All four primitives (redirect, SSR alias, route whitelist, hydration
  guard) would each individually prevent the regression; together they
  make a blank `/marketplace` page require simultaneous failure of four
  independent guards in different files.
