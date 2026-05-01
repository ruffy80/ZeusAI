# SIGNUP-BUTTON-FIX

**Date:** 2026-05-01  
**Reporter:** owner (manual UI test on https://zeusai.pro/account)  
**Symptom:** "Sign up" + "Create device key" buttons do nothing. No Network requests. No Console errors visible to a casual look.  
**Severity:** P0 — blocks every new customer signup.

## TL;DR

`/account` page has a Content-Security-Policy with `script-src 'self' 'nonce-XXX' 'strict-dynamic' https:`. According to the CSP3 spec, **when `'strict-dynamic'` is present, the `'self'` and `https:` source expressions are ignored by all CSP3-compliant browsers**. Only:

1. Scripts that carry the matching `nonce="..."` attribute load.
2. Scripts dynamically inserted by an already-trusted (nonced) script load.

The two main bundles in [src/site/v2/shell.js](UNICORN_FINAL/src/site/v2/shell.js#L407-L408) — `/assets/aeon.js` and `/assets/app.js` — were rendered as **plain `<script src="...">` tags with NO `nonce` attribute**. Result: the browser silently refuses to execute them, so:

- `hydrateAccount()` is never defined → never runs → buttons stay un-wired.
- WebAuthn helpers from `aeon.js` (`window.__UNICORN_PASSKEY__`) are never registered → "Create device key" does nothing.
- The form fields (`#acSignupEmail`, `#acSignupPass`, `#acSignupBtn`, etc.) are server-rendered raw HTML inside `#accountRoot`. With the JS blocked, clicks on `<button>` elements (no `type="submit"`, not in a `<form>`) do literally nothing.

The user reported "no console errors" — actually the browser does fire a CSP violation event, but since [shell.js](UNICORN_FINAL/src/site/v2/shell.js#L391-L405) installs its own `securitypolicyviolation` listener that posts to `/csp-violations` and swallows it (and that listener itself runs in inline script with the nonce, so it works), the violation goes silent in DevTools unless you scroll up.

## Investigation timeline

1. Curled https://zeusai.pro/account → page loads (HTTP 200, ~47 KB), form HTML is present, `#accountRoot` wrapper exists, button IDs match what `app.js` expects.
2. Curled `/assets/app.js` and `/assets/aeon.js` → both 200, contents include `addEventListener('click', ...)` for `#acSignupBtn`, `#acLoginBtn`, `#acPasskeyCreateBtn`, `#acPasskeyLoginBtn`. Backend wiring looks correct.
3. Curled `POST /api/customer/signup` with a fake email → backend returns `200 OK` with full customer + JWT + `customer_session` cookie. **Backend is healthy.**
4. Diffed CSP header vs script tag attributes:
   - Header: `script-src 'self' 'nonce-69b479bc...' 'strict-dynamic' https:`
   - Tag: `<script src="/assets/aeon.js?v=..." defer></script>` ← no nonce
   - Tag: `<script src="/assets/app.js?v=..." defer></script>` ← no nonce
5. Confirmed root cause: `'strict-dynamic'` invalidates the `'self'` allowance for these tags.

## Fix

[`UNICORN_FINAL/src/site/v2/shell.js`](UNICORN_FINAL/src/site/v2/shell.js#L407-L408) — added the existing `${N}` nonce attribute (already computed at [line 216](UNICORN_FINAL/src/site/v2/shell.js#L216) inside `footer()`) to both script tags:

```diff
-<script src="/assets/aeon.js?v=${BUILD_ID}" defer></script>
-<script src="/assets/app.js?v=${BUILD_ID}" defer></script>
+<script${N} src="/assets/aeon.js?v=${BUILD_ID}" defer></script>
+<script${N} src="/assets/app.js?v=${BUILD_ID}" defer></script>
```

That's the entire fix. Two characters of source change. Every other inline script in `shell.js` already carried the nonce; only these two external bundles were missed.

## Why this regressed

The CSP `'strict-dynamic'` was added during a recent PQ-security hardening pass (visible in the `/api/security/pq/status` endpoint shipped in the same window). At the time, all inline scripts were updated to use `${nonceAttr}`/`${N}`, but the two `<script src=...>` tags at the very end of the document body were overlooked because they were external and "looked safe under `'self'`".

## Verification plan (post-deploy)

1. `curl -s https://zeusai.pro/account | grep -E "/assets/(app|aeon)\.js"` should show `nonce="..."` on both tags.
2. Open https://zeusai.pro/account in a clean browser, DevTools Network tab:
   - Page loads → `aeon.js` and `app.js` show status `200`, no longer blocked.
   - Type email + password (≥8 chars) → click **Sign up →**.
   - Network tab shows `POST /api/customer/signup` → `200 OK`.
   - Page transitions into the dashboard view (renderAccountDashboard).
3. WebAuthn path: type email → **Create device key** → browser opens platform authenticator (Touch ID / Windows Hello / etc.), not silent failure.

## Files changed

- [UNICORN_FINAL/src/site/v2/shell.js](UNICORN_FINAL/src/site/v2/shell.js#L407-L408) — added `${N}` nonce to both bundle script tags.

## Files deliberately NOT changed

- [generate_unicorn_final.js](generate_unicorn_final.js) — does not contain the offending tags; shell.js is the source of truth.
- [UNICORN_FINAL/src/index.js](UNICORN_FINAL/src/index.js) — CSP is correctly emitting the nonce via `crypto.randomBytes(16).toString('hex')` per request and exposing it through `opts.nonce`. No backend change needed.
- Backend signup endpoint — proven working via direct curl.

## Test results

- `node --check src/site/v2/shell.js` → ok
- `npm run lint` → clean (`--max-warnings=0`)
- `npm test` → full suite passes including new local-DR tests
