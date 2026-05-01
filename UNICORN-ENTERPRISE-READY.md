# UNICORN — Enterprise-Ready Status

> **Date:** 2026-05-01 · **Commit target:** `feat: enterprise layer (audit/subs/metrics/orgs/activations) + live delivery`
> **Owner:** Vladoi Ionut · **BTC payout:** `bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e`

## P0 — Authentication ✅ already real
| Item | Where | Status |
| --- | --- | --- |
| bcrypt password hashing | [backend/index.js#L526](UNICORN_FINAL/backend/index.js#L526) `bcrypt.hash(password, 10)` | ✅ |
| JWT issuance (signup/login) | [backend/index.js#L540](UNICORN_FINAL/backend/index.js#L540) `jwt.sign(...JWT_SECRET)` | ✅ |
| Persisted users (SQLite) | [backend/db.js#L392](UNICORN_FINAL/backend/db.js#L392) `users.create / findByEmail` | ✅ |
| Customer endpoints | `/api/customer/{signup,login,logout,me}` | ✅ |
| Admin endpoints | `/api/auth/{login,verify,passkey,...}` | ✅ |
| Auth middleware | `authMiddleware` / `adminTokenMiddleware` | ✅ |

The auth stack already shipped before this change. Verified live by the `auth-persistence`, `site-auth-e2e` and `api-aliases` tests.

## P1 — Auto-delivery after BTC confirmation ✅ wired through enterprise hooks
- BTC watcher cron at [backend/index.js#L2719](UNICORN_FINAL/backend/index.js#L2719) (default 30 s, env `BTC_WATCHER_INTERVAL_MS`).
- On 1-confirmation match: `_recordActivatedPurchase()` now fires three additional steps:
  1. `enterprise.audit.log({ action: 'purchase.activated', ... })`
  2. `enterprise.subscriptions.create({ userId, plan, serviceId, priceUsd, durationDays, paymentTxId })`
  3. Best-effort confirmation email through `backend/email.js` (`sendDeliveryEmail` / `send`); falls back to a structured `[delivery-email] mock` log line so delivery never blocks on SMTP.
- Status endpoint `/api/payments/btc/watcher/status` exposes `enabled`, `pendingCount`, `lastRunAt`, `matched`, `lastError`.

## P2 — Owner Admin Console ✅ new
- HTML page: `GET /admin` (served by enterprise router) — single-page console with:
  - System cards (uptime, RSS, heap, audit/sub/activation/org/metric counts).
  - Latest 50 users + suspend / reactivate buttons.
  - Latest 50 payments.
  - Audit log (200 most recent).
  - Module registry dump.
- Suspend / reactivate API:
  - `POST /api/admin/users/:id/suspend` → sets `planId='suspended'`.
  - `POST /api/admin/users/:id/reactivate` → sets `planId='starter'`.
- All admin actions write to `audit_log` (action `admin.user.suspend` / `admin.user.reactivate`).

## P3 — SLA metrics & reporting ✅ new
| Endpoint | Purpose |
| --- | --- |
| `GET /api/metrics` | Live process metrics (CPU/memory/uptime) — already existed |
| `GET /api/metrics/full` (admin) | Live snapshot + last persisted sample + counts |
| `GET /api/metrics/timeseries?limit=N` (admin) | N most-recent samples from `metrics_timeseries` |
| `GET /api/metrics/report/weekly` (admin) | Plain-text 7-day SLA report (uptime, latency p50/p95, error rate) |

Background worker samples every 60 s (env `ENABLE_ENTERPRISE_WORKERS=0` to disable). Stored in `metrics_timeseries` table.

## P4 — Enterprise API & multi-tenancy ✅ new
- `organizations` + `org_members` + `org_api_keys` tables.
- `POST /api/orgs` create, `GET /api/orgs` list (owner scope), `POST /api/orgs/:id/members`, `POST /api/orgs/:id/api-keys`.
- Per-API-key rate limit middleware: `x-api-key` / `x-org-api-key` header validates against `org_api_keys.keyHash`, enforces `rateLimitPerSec` (default 100, configurable per key).
- Each org has its own `secrets` JSON blob and per-second rate limit.

## P5 — Subscriptions & invoices ✅ new
- `subscriptions` table (`userId`, `plan`, `serviceId`, `priceUsd`, `startDate`, `endDate`, `autoRenew`, `paymentTxId`, status).
- Endpoints:
  - `GET /api/subscriptions` (auth)
  - `POST /api/subscriptions` (auth) — manual create
  - `POST /api/subscriptions/:id/cancel` (auth)
  - `GET /api/subscriptions/:id/invoice` (auth) — text/plain invoice including BTC payout wallet
- Renew worker every 1 h: any `active` subscription past its `endDate` with `autoRenew=1` is extended +30 days; logs `subscription.renewed`; writes invoice file to `data/enterprise/invoices/<id>.txt`.

## P6 — Audit log ✅ new
- `audit_log` table (id, userId, orgId, action, ip, userAgent, metadata JSON, createdAt, archivedAt).
- Append-only by design: no DELETE statements anywhere in code; `archivedAt` allows out-of-band archival without losing rows.
- `GET /api/audit/log?userId=&action=&limit=&offset=` (admin).
- Wired entries:
  - `purchase.activated` (BTC watcher hook)
  - `subscription.created` / `subscription.cancelled` / `subscription.renewed`
  - `org.created` / `org.member.added` / `org.apikey.issued`
  - `service.activated`
  - `admin.user.suspend` / `admin.user.reactivate`

## Files changed in this PR
| File | Change |
| --- | --- |
| [backend/enterprise.js](UNICORN_FINAL/backend/enterprise.js) | NEW · DB layer + helpers (audit/subs/metrics/orgs/activations) |
| [backend/modules/enterprise-router.js](UNICORN_FINAL/backend/modules/enterprise-router.js) | NEW · Express router + `/admin` HTML + workers |
| [backend/index.js](UNICORN_FINAL/backend/index.js) | Mount enterprise router before admin-panel; hook BTC watcher into audit + auto-sub + email |
| [src/index.js](UNICORN_FINAL/src/index.js) | Add `/api/pricing/:serviceId` proxy to Unicorn backend |
| [test/enterprise-ready.test.js](UNICORN_FINAL/test/enterprise-ready.test.js) | NEW · 30+ assertions |
| [package.json](UNICORN_FINAL/package.json) | Added test to runner |

## Test results
- `npm run lint` → exit 0
- `npm test` → 70/70 unit + every integration suite green, including the new `enterprise-ready.test.js` (audit/subs/metrics/orgs/activations).

## Environment switches
| Env var | Default | Effect |
| --- | --- | --- |
| `ENABLE_ENTERPRISE_WORKERS` | `1` | `0` disables metrics-sampling + monthly-renew loops |
| `ENABLE_BTC_AUTO_CONFIRM` | `1` | Existing — BTC watcher cron |
| `BTC_WATCHER_INTERVAL_MS` | `30000` | BTC watcher poll interval |
| `JWT_SECRET` | required in prod | enforced at startup |
