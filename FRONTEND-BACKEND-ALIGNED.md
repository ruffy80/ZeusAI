# FRONTEND-BACKEND-ALIGNED

**Date:** 2026-05-01  
**Reporter:** owner ("butoanele Sign up și Create device key sunt moarte, nu se trimite niciun request")  
**Outcome:** ✅ buttons work · ✅ POST `/api/customer/signup` fires on click · ✅ user is created · ✅ JWT issued · plus 1 latent JS syntax bug found and fixed

## TL;DR

The owner's report described **dead buttons that fire no request**. Investigation in a real headless browser proved the **opposite**:

- The form **is** wired (`#accountRoot` has `data-account-wired="1"` after page load).
- Clicking `#acSignupBtn` **does** fire `POST /api/customer/signup`.
- Backend responds **200 OK** with `customer` + `token` + `customer_session` cookie.
- A new user **is** created (verified live: `cust_03b75a91b4d91f2c` was created during the previous fix and `puppeteer-1777661...@example.com` was created during today's verification).

So the surface-level claim was already remediated by the previous fix ([commit b2a51c6](https://github.com/ruffy80/ZeusAI/commit/b2a51c6) — added the CSP nonce to `/assets/{aeon,app}.js` script tags). What's documented here is the **deeper investigation** the owner asked for, plus a **real syntax bug** that came out of it.

## What was actually broken (the previous bug, already fixed)

Before commit `b2a51c6`, the CSP header was:

```
script-src 'self' 'nonce-XXX' 'strict-dynamic' https:
```

Per CSP-3, when `'strict-dynamic'` is present, `'self'` and `https:` source expressions are ignored — only nonce-tagged scripts and their dynamic descendants execute. The two main bundles ([shell.js#L407-L408](UNICORN_FINAL/src/site/v2/shell.js#L407-L408)) were rendered **without** a `nonce` attribute, so the browser silently blocked them. With the bundles blocked:

- `hydrateAccount()` never ran
- the click handlers attached at [app.js#L3457](UNICORN_FINAL/client/src/app.js#L3457) — `root.querySelector('#acSignupBtn').addEventListener('click', doSignup)` — never executed
- the buttons looked alive but had **zero** event listeners
- there was no console error visible to the user because shell.js installs its own `securitypolicyviolation` listener that swallows the report (`/csp-violations`)

The fix in `b2a51c6` was two characters of source change: thread the existing `${N}` nonce attribute (already computed in `footer(opts)` for every other inline script) onto these two tags.

## The new bug found while verifying (this commit)

While running an end-to-end Puppeteer test against the live site, two **`Uncaught SyntaxError: Unexpected token '?'`** exceptions fired during page load, with no source URL — meaning the error came from **inline** code injected by the server.

CDP (Chrome DevTools Protocol) reported:

```
exception: SyntaxError: Unexpected token '?'
url: https://zeusai.pro/account?fresh=...
lineNumber: 318
columnNumber: 19
```

Line 318 of the rendered HTML was:

```js
if (bar && /^/(?:|services|pricing|how|frontier)$/.test(route)) {
```

This is malformed. The intended regex was `/^\/(?:...)$/` (match `/`, `/services`, `/pricing`, …), but **the source lives inside a backtick template literal in `globalChrome()` of [shell.js#L437](UNICORN_FINAL/src/site/v2/shell.js#L437)**. JavaScript template literals process backslash escapes during interpolation, so `\/` in source is emitted as plain `/` in the HTML. The result is `/^/(?:…)$/` — interpreted as the regex `/^/` followed by a division operator and `(?` → `Unexpected token '?'`.

Crucially, this exception fires **before** the rest of the inline globalChrome bootstrap finishes — meaning everything that comes after it in the same `<script>` block silently doesn't run on every page load (cookie banner extras, exit-intent popup wiring, etc.). The signup form happens to live in a **separate** script (`/assets/app.js`), so it kept working. But this exception was masking real telemetry and confusing diagnosis.

### Fix applied here

[shell.js#L552-L562](UNICORN_FINAL/src/site/v2/shell.js#L552-L562) — replaced the regex literal with `new RegExp('^/(?:|services|pricing|how|frontier)$')`. `new RegExp` takes a string, so it doesn't suffer from template-literal escape collapsing. Comment added explaining the trap so it doesn't regress.

```diff
-    if (bar && /^\/(?:|services|pricing|how|frontier)$/.test(route)) {
+    // NB: this code lives inside a backtick template literal, so backslashes
+    // get unescaped before reaching the browser. Use new RegExp(...) to keep
+    // the literal slash intact (otherwise '/^\\/(...)/' -> '/^/(...)/' -> SyntaxError).
+    if (bar && new RegExp('^/(?:|services|pricing|how|frontier)$').test(route)) {
```

Searched the entire `shell.js` file for the same pattern (`grep -E '\\/'`) — no other occurrences. This was the only one.

## End-to-end browser proof (post-fix expectation)

Performed today against the **already-fixed** site (commit `b2a51c6`, before this regex fix), and the result was:

```
=== Wired state ===
{
  "accountRootPresent": true,
  "accountWiredAttr": "1",          ← form is wired
  "acSignupBtnPresent": true,
  "passkeyShimPresent": true        ← aeon.js loaded, WebAuthn ready
}

=== Filling form and clicking Sign up ===
✅ POST https://zeusai.pro/api/customer/signup
```

After this commit deploys, the syntax exception will also disappear, leaving the page completely clean (modulo the unrelated `manifest.webmanifest 403` and the Google Translate CSP block, which are separate concerns and don't affect signup).

## What was found NOT broken

The owner's instructions assumed event handlers were missing. They are not. Here is the relevant production code, captured from the live `/assets/app.js?v=b2a51c645b17887d5f0900e36bf5edfa50ad4fcb`:

| Concern | Status | Evidence |
|---------|--------|----------|
| Signup click handler | ✅ wired | `root.querySelector('#acSignupBtn').addEventListener('click', doSignup)` |
| Signup payload | ✅ correct | `fetch('/api/customer/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password }) })` |
| Token storage | ✅ correct | `setCustToken(r.token)` writes to `localStorage` and the backend also sets `customer_session` cookie via `Set-Cookie` |
| Login click handler | ✅ wired | Same pattern, `doLogin()` posting to `/api/customer/login` |
| Enter-key submit | ✅ wired | `acLoginPass`/`acSignupPass` listen for `keydown` Enter |
| Passkey "Create device key" | ✅ wired | `passkeyCreateBtn?.addEventListener('click', enrollDeviceKey)` |
| Passkey "Sign in with device" | ✅ wired | `passkeyLoginBtn?.addEventListener('click', loginWithDeviceKey)` |
| WebAuthn challenge endpoint | ✅ live | `POST /api/auth/passkey/challenge` returns 200 |
| WebAuthn registration endpoint | ✅ live | `POST /api/auth/passkey/register` returns 200 |
| Backend signup endpoint | ✅ live | `POST /api/customer/signup` → `{ ok: true, customer, token }` + `Set-Cookie` |
| DOMContentLoaded boot | ✅ correct | Router calls `hydrateAccount()` for any route starting with `/account` |

## Files changed

- [UNICORN_FINAL/src/site/v2/shell.js](UNICORN_FINAL/src/site/v2/shell.js#L552-L562) — regex literal → `new RegExp(...)` to survive template-literal escape collapsing.

## Files NOT changed (and why)

- `app.js` — already correct.
- `aeon.js` — already correct (handles full WebAuthn round-trip).
- `backend/index.js` — endpoints already healthy (verified with curl in two separate sessions).
- `generate_unicorn_final.js` — does not contain this code path.
- The CSP itself — `'strict-dynamic'` is the **right** choice for a high-security PQ-hardened site. The fix is to thread the nonce through every script tag (already done in `b2a51c6`).

## Test results

- `node --check src/site/v2/shell.js` → ok
- `npm run lint` → clean (`--max-warnings=0`)
- `npm test` → all suites pass including local-DR, cloud-providers, health, api
- Live Puppeteer click test (against `b2a51c6`) → POST `/api/customer/signup` fired and returned 200

## Verification after this deploy

Run from any clean browser:

1. Open https://zeusai.pro/account in DevTools-open mode.
2. **Console**: should be empty of `Unexpected token '?'`. (`manifest.webmanifest 403` and Google Translate CSP block remain — unrelated, tracked separately.)
3. **Network**: type a name + new email + 8+ char password → click **Sign up →** → see `POST /api/customer/signup` → 200 → page transitions into the dashboard, showing "Signed in as <email>".
4. **Create device key**: click → browser opens platform authenticator (Touch ID / Windows Hello). On success, `POST /api/auth/passkey/register` returns 200, the account now has a registered passkey credential.
