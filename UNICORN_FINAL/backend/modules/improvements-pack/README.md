# improvements-pack — Strict Additive Layer

This folder is a **purely additive** layer added on top of the stable
`UNICORN_FINAL` baseline. Every change here was designed to:

* Add only **new** routes (none collide with existing endpoints).
* Add only **new** modules (no removal, no rename, no shape changes for
  `/health`, `/snapshot`, `/stream`, `/api/*`).
* Be **opt-out friendly**: setting `IMPROVEMENTS_PACK_DISABLED=1` makes the
  dispatcher short-circuit, leaving the original site behavior 100% intact.

## What this layer adds

| # | Concern | Routes / hooks |
|---|---------|----------------|
| 5 | Aggregated internal health | `GET /internal/health/aggregate` |
| 8 | CSP report endpoint | `POST /api/csp-report`, `POST /csp-violations` |
| 9 | Per-IP rate limit on AI dispatch | `aiDispatchIpLimiter` middleware |
| 10 | Tenant API key rotation w/ grace period | `rotateTenantApiKey()` helper |
| 12 | Snapshot TTL cache | `cachedSnapshot()` wrapper (5–10s) |
| 16 | Webhook idempotency store | `seenWebhook(id)` + audit hook |
| 17 | Owner revenue dashboard | `GET /api/owner/revenue.csv` |
| 18 | Pre-order conversion funnel | `funnel.track(stage, ctx)` |

## Wiring

Single line each in `src/index.js` and `backend/index.js`, exactly the same
pattern as `innovations-50y/`:

```js
let _improvementsPack = null;
try {
  _improvementsPack = require('./modules/improvements-pack');
} catch (e) {
  console.warn('[improvements-pack] not loaded:', e.message);
}
```

## Tests

* `test/improvements-pack.test.js` — unit/integration tests for every helper
  + endpoint.
* `test/secret-leak-scan.test.js` — scans logs for accidental leakage of
  Stripe / PayPal / BTC owner secrets.

## Audit log rotation (3)

Implemented additively in `tamper-evident-audit.js` via the new methods
`rotate()` and `loadAnchors()` — see `/api/v50/audit/rotate` route in the
`innovations-50y` dispatcher (only enabled when `AUDIT_50Y_TOKEN` is set).
