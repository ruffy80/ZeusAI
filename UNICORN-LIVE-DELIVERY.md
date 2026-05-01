# UNICORN — Live Delivery Pipeline

> **Date:** 2026-05-01 · **Owner:** Vladoi Ionut · **BTC payout:** `bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e`
> Goal: site `zeusai.pro` → Unicorn modules deliver real services on payment.

## 1. Site → Unicorn proxy

The public site (port 3001, `src/index.js`) proxies the four read-only endpoints listed in the task:

| Path on site | Target on Unicorn (3000) | Live route |
| --- | --- | --- |
| `GET /api/industry/list` | `/api/industry/list` | [src/index.js#L288](UNICORN_FINAL/src/index.js#L288) |
| `GET /api/control/stats` | `/api/control/stats` | [src/index.js#L289](UNICORN_FINAL/src/index.js#L289) |
| `GET /api/evolution/snapshot` | `/api/evolution/snapshot` | [src/index.js#L290](UNICORN_FINAL/src/index.js#L290) |
| `GET /api/pricing/:serviceId` | `/api/pricing/:serviceId` | [src/index.js#L291](UNICORN_FINAL/src/index.js#L291) (NEW) |

Every proxy:
- Honours `BACKEND_API_URL` env (set in PM2 / nginx).
- Aborts upstream request after `SITE_PROXY_TIMEOUT_MS` (default 2 s).
- Returns a stable shape mock (`X-Source: site-fallback-mock`) when the backend is unreachable, so the front-end never breaks.

The four target endpoints are all wired in `backend/index.js`:
- `/api/industry/list` → [backend/index.js#L1972](UNICORN_FINAL/backend/index.js#L1972)
- `/api/control/stats` → [backend/index.js#L2014](UNICORN_FINAL/backend/index.js#L2014)
- `/api/evolution/snapshot` → [backend/index.js#L2036](UNICORN_FINAL/backend/index.js#L2036)
- `/api/pricing/:serviceId` → [backend/index.js#L4548](UNICORN_FINAL/backend/index.js#L4548)

## 2. Auto-delivery after BTC confirmation

A single watcher loop drives the entire delivery pipeline:

```
[ user pays BTC to bc1q4f7… ]
             │
   poll mempool.space every 30 s
             │  match expectedBtc ± 2%
             ▼
   _autoConfirmBtcPurchases()                    backend/index.js:2640
             │
             ▼
   purchase.status='paid' / active=true
   _savePurchaseToDb()    →  marketplace_purchases row
   _recordActivatedPurchase()
             │
             ├── enterprise.audit.log(action='purchase.activated')
             ├── enterprise.subscriptions.create({ userId, serviceId, … })
             └── email.sendDeliveryEmail() | console fallback
             ▼
   _emitUnicornEvent('payment_confirmed', …)   →  SSE to /events
```

Code path in this PR:
- BTC watcher: [backend/index.js#L2640](UNICORN_FINAL/backend/index.js#L2640)
- Activation hook (audit + subscription + email): [backend/index.js#L2288](UNICORN_FINAL/backend/index.js#L2288) `_recordActivatedPurchase`

## 3. Service activation tokens

After the watcher marks a purchase as paid, the buyer can claim a service-bound token:

```
POST /api/activate/:serviceId
Authorization: Bearer <user JWT>
```

Returns:
```json
{
  "ok": true,
  "activation": {
    "id":        "act_<hex>",
    "serviceId": "ai-site-generator",
    "token":     "act_<48-hex>",
    "createdAt": "2026-05-01T…Z",
    "usage":     "Authorization: Bearer act_… → ZeusAI service endpoint"
  }
}
```

Rules enforced:
- Caller must be authenticated (JWT).
- A matching paid purchase **or** active subscription for `:serviceId` is required, otherwise `402 payment_required`.
- Token is hashed (`sha256`) before storage — the plaintext is shown exactly once.
- Verification: `enterprise.activations.verify(token)` returns the activation row when the token is active.
- Revocation: `POST /api/admin/users/:id/suspend` and direct DB call `activations.revoke(id)`.

Endpoints:
- `POST /api/activate/:serviceId` — issue token (auth)
- `GET  /api/activations` — list user's activations (auth)

## 4. Cap-la-cap test (offline reproduction)

`test/enterprise-ready.test.js` exercises the same code path the watcher uses:

```
[ok] audit.log: 2 entries
[ok] subscriptions: create/renew/cancel/invoice
[ok] metrics: 5 samples, report=5
[ok] organizations: acme-co key=key_… members=2
[ok] activations: issue/verify/revoke
[ok] meta: {"audit":2,"subscriptions":1,"metrics":5,"organizations":1,"activations":1}
[enterprise-ready.test.js] all assertions passed
```

The full suite (`npm test`) — 70 unit + 19 integration suites — passes.

## 5. Live deploy

- `git push origin main` triggers `.github/workflows/hetzner-deploy.yml`.
- Workflow runs `npm run lint` + `npm test` against the new code, then rsyncs `UNICORN_FINAL/` to Hetzner and `pm2 reload`.
- Verification once deployed:
  ```
  curl -s https://zeusai.pro/api/industry/list  | jq '.industries|length'
  curl -s https://zeusai.pro/api/pricing/ai-site-generator
  curl -s https://zeusai.pro/api/payments/btc/watcher/status | jq '.enabled,.lastRunAt'
  curl -s https://zeusai.pro/admin -I            # owner console
  ```

## 6. Owner console

`GET https://zeusai.pro/admin` — single-page console served by the enterprise router. Paste an admin JWT (issued by `/api/auth/login`) and click **Load** to see live users, payments, subscriptions, audit log and module registry. Suspend / reactivate buttons call `/api/admin/users/:id/{suspend,reactivate}` which write to `audit_log`.
