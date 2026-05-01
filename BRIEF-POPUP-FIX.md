# BRIEF-POPUP-FIX

**Date:** 2026-05-01  
**Reporter:** owner ("pop-up 'Wait — get the founders' brief.' nu se închide după trimitere și blochează accesul la cont")  
**Severity:** P1 — blocks logged-in customers from reaching dashboard.

## What was wrong

The exit-intent modal lives in [shell.js#L447-L457](UNICORN_FINAL/src/site/v2/shell.js#L447-L457) and was wired in [shell.js#L563-L582](UNICORN_FINAL/src/site/v2/shell.js#L563-L582). The original logic had four real problems:

1. **No logged-in check** — once a customer was authenticated (token in `localStorage.u_cust_token`), the modal could still trigger on `mouseleave`, covering the dashboard with a `position:fixed; inset:0; z-index:120` overlay.
2. **No route exemption** — could fire on `/account`, `/dashboard`, `/checkout`, blocking the very flows users came for.
3. **Only sessionStorage dismissal** — closing the modal set `zeus_exit_seen` only for the current tab session; reopening the site brought it back. There was no real "I dismissed this" memory.
4. **No fallback close paths** — only the `×` button closed it; clicking the backdrop or pressing Escape did nothing. If `mouseleave` re-fired on a tab without a clean `mouseleave` event (some macOS / iPad trackpads), the user could feel trapped.

After form submit, the close timer was 1.8 s — fine in theory, but if the network call hung, `modal.hidden` was never set to `true` and the `×` was the only escape (and many users didn't notice it).

## What was fixed

[shell.js#L562-L644](UNICORN_FINAL/src/site/v2/shell.js#L562-L644) — completely rewrote the exit-intent block:

### 1. `exitIntentSuppressed()` gate — runs at boot AND at trigger time

```js
// Suppress on routes where users are actively transacting / authenticating.
if (/^\/(account|dashboard|checkout|store|portal|login|signup|register|admin)(\/|$)/.test(route)) return true;

// Suppress if customer is signed in (any of the keys client.js#setCustToken writes).
var tok = localStorage.getItem('u_cust_token')
       || localStorage.getItem('customerToken')
       || localStorage.getItem('token') || '';
if (tok) return true;

// Suppress if user previously dismissed within the TTL window.
var until = parseInt(localStorage.getItem('zeus_exit_dismissed_until') || '0', 10) || 0;
if (until && Date.now() < until) return true;
```

### 2. `dismissExitForever()` — 30-day persistence

```js
function dismissExitForever(){
  localStorage.setItem('zeus_exit_dismissed_until', String(Date.now() + 30*24*60*60*1000));
  sessionStorage.setItem('zeus_exit_seen', '1');
}
```

Called on every dismissal path (✕ click, backdrop click, Escape, successful submit).

### 3. Three independent close paths

- `× ` button → close + dismiss-30d
- click on backdrop (`ev.target === modal`) → close + dismiss-30d
- `Escape` keydown → close + dismiss-30d

### 4. Recheck at trigger time

`mouseleave` no longer blindly shows the modal. It re-runs `exitIntentSuppressed()` first — so even if the user logs in **after** the page loaded (e.g. via the inline auth form), moving the mouse to the top of the viewport won't dredge up the popup.

### 5. Submit flow tightened

- Empty email → inline message, no fetch.
- Successful submit → `dismissExitForever()` + close after 1.5 s.
- Network failure → message tells user to press × (no infinite spinner).

## Behavior matrix

| User state | Route | Behavior |
|---|---|---|
| **Logged in** (token in localStorage) | any | Popup never appears |
| **Logged out** | `/account`, `/dashboard`, `/checkout`, `/store`, `/portal`, `/login`, `/signup`, `/register`, `/admin` | Popup never appears |
| **Logged out** | `/`, `/services`, `/pricing`, `/how`, etc. | Popup may appear once after 20s + mouse-leave; X / backdrop / Escape all close it; submit closes it; **all four** persist a 30-day dismissal |
| **Previously dismissed** | any | Popup never appears for 30 days |

## Files changed

- [UNICORN_FINAL/src/site/v2/shell.js](UNICORN_FINAL/src/site/v2/shell.js#L562-L644) — exit-intent rewrite (only file).

## Files NOT changed

- The HTML structure of the modal ([shell.js#L447-L457](UNICORN_FINAL/src/site/v2/shell.js#L447)) — the `×` button was already present, just wired weakly.
- `/api/newsletter/subscribe` — backend endpoint untouched, still accepts the same payload.
- `client.js` token plumbing — read-only access via `localStorage.getItem`.

## Test results

- `node --check src/site/v2/shell.js` → ok
- `npm run lint` → clean (`--max-warnings=0`)
- `npm test` → all suites green

## Verification after deploy

Open a fresh browser (or incognito) and:

1. Visit https://zeusai.pro/account — popup must **never** appear.
2. Visit https://zeusai.pro/ logged out, wait 20 s, move cursor to top of viewport — popup appears with prominent ✕ button. Press ✕ → modal disappears.
3. Reload the homepage — popup does **not** reappear (30-day localStorage cookie).
4. Clear localStorage, log in as a customer, then visit `/`, wait 20 s, move cursor up — popup must **not** appear.
5. Clear localStorage, then visit `/`, wait 20 s, mouse-leave to trigger popup, hit Escape → modal disappears, 30-day suppression kicks in.
