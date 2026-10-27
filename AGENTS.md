# AGENTS.md

## Standing contract

This file is the memory a new agent has on the first message. Chat history is
not carried over. Do not drop these facts, and do not invent customers, GMV,
buyer counts, or an unmeasured Lighthouse score.

- ZeusAI (`zeusai.pro`) is the public storefront. Code lives in `UNICORN_FINAL/`.
  The homepage is the cost-optimizer landing. The public shelf is `/services`
  and `/pricing`.
- Bitcoin is the live payment rail. The number on the card is the list price
  and the merchant `itemprop=price`. Bitcoin pays 10% under that list
  (`COMMERCE_BTC_DISCOUNT_PCT`, default 10). Card and PayPal pay the list price
  only when they are configured. File delivery is $0. The buyer keeps the file.
  Merchant listings omit `returnMethod` (`KeepProduct` and `ReturnByMail` are
  refused) and state `availability` and `itemCondition` once per offer.
- Operator desks stay reachable by URL, `noindex`, and unlinked from the public
  header and footer. The public sitemap stays the marketing URLs already shipped.
- Owner: Vladoi Ionut (`vladoi_ionut@yahoo.com`).
- Never commit `UNICORN_FINAL/data/**`. Start the backend with
  `DISABLE_SELF_MUTATION=1` or it rewrites module source.

Cloud agents boot from the latest active environment build of
[the ZeusAI environment](https://cursor.com/dashboard/cloud-agents/environments/e/8d12b95c-7d1a-11f1-ba66-0e7d0216e441).
`install` (`.cursor/cloud-install.sh`) is `npm ci` and is baked into that
snapshot, so a new agent already has `node_modules`. `start`
(`.cursor/cloud-start.sh`) only materializes the optional deploy key. It does
not launch the site or the backend. A draft build does not apply until it is
activated after merge.

## Cursor Cloud specific instructions

ZeusAI / "Unicorn Platform" is a Node.js autonomous AI-commerce platform. The
application lives in `UNICORN_FINAL/`; the repo root is a thin wrapper whose
scripts delegate into `UNICORN_FINAL` via `npm --prefix`.

### Services

There are **two long-lived Node services** and they behave differently:

| Service | Entry point | Default port | Role |
|---|---|---|---|
| Backend API | `UNICORN_FINAL/backend/index.js` | 3000 | Express API, SQLite, source-of-truth |
| Site server | `UNICORN_FINAL/src/index.js` | 3000 | SSR site + proxies `/api/*` to the backend |

**Non-obvious gotcha:** both entry points default to `PORT=3000`. To run the
full product end-to-end you must run them on separate ports and tell the site
server where the backend is, e.g.:

```bash
# terminal 1 — backend (source of truth)
cd UNICORN_FINAL && PORT=3000 BIND_HOST=127.0.0.1 npm start

# terminal 2 — site server on 3001, proxying to the backend on 3000
cd UNICORN_FINAL && PORT=3001 \
  UNICORN_SITE_INTERNAL_BACKEND=http://127.0.0.1:3000/api/health \
  BACKEND_ORIGIN=http://127.0.0.1:3000 \
  node src/index.js
```

- Root `npm start` runs **only** the site server (`src/index.js`) on port 3000.
  Run alone it works but `/health` reports `backend.ok:false` / degraded because
  no backend is listening — that is expected, not a bug.
- **Important — self-mutation rewrites source files:** the backend runs an
  autonomous "self-construction" loop that will **overwrite backend module
  source files** (e.g. `backend/modules/*.js`) with auto-generated stubs while
  it runs, dirtying the git tree. Always start the backend with
  `DISABLE_SELF_MUTATION=1` during local/dev work to keep the repo clean (the
  test suite already sets this). It also continuously writes runtime state under
  `UNICORN_FINAL/data/**` (heartbeats, rankings) — those churn is benign and
  should not be committed; `git checkout -- UNICORN_FINAL/data/...` to discard.
- Health checks: backend `GET /api/health`; site `GET /health` (the site health
  includes a `backend` sub-object that should show `ok:true` once both run).
- The public marketplace/commerce flow (used for smoke-testing) is:
  `GET /api/catalog`, `GET /api/payment/btc-rate`,
  `POST /api/checkout/create` (body `{"serviceId": "...", "qty": 1, "email": "..."}`),
  then `GET /api/order/:orderId/status`. A human checkout page renders at
  `GET /checkout/:orderId`.

### Deploy & self-update (autonomy)

Production is a single Hetzner VPS (`zeusai.pro`) behind nginx, PM2-managed
(`unicorn-backend`, `unicorn-site`). Code reaches it two independent ways:

- **GitHub Actions** (`.github/workflows/deploy.yml`) on push to `main` — primary
  path (rsync + `scripts/deploy-atomic-forward.sh` + PM2 restart).
- **On-server self-deploy poller** (`scripts/auto-pull-deploy.sh` via the
  `zeus-autodeploy.timer` systemd timer, ~every 3 min) — a billing-independent
  safety net that polls `origin/main` over public HTTPS and runs the same
  canary-gated `deploy-atomic-forward.sh`. A merge to `main` therefore goes live
  within ~3 min even if Actions is down. Kill-switch: `touch /etc/zeus-autodeploy.disabled`.
- **Post-deploy sentinel** (`scripts/zeus-deploy-sentinel.sh` via
  `zeus-deploy-sentinel.timer`) records the last known-good release and can roll
  back one that regresses after promotion. Default `ZEUS_SENTINEL_MODE=monitor`
  (logs only); `act` enables rollback and quarantines the bad SHA so the poller
  won't redeploy it.

`deploy-atomic-forward.sh` canaries on port 3100 and only promotes the live
symlink after health/QIS/smoke pass. Live mutable state (`.env`, `data`, `db`)
lives in `/var/www/unicorn/shared` and is symlinked into each release — never
ship snapshots of it. Current live build SHA: `GET /integrity.json` (`version`).

**Browser cache:** the site no longer registers a service worker. Shell SWNOS
auto-heals legacy SW controllers and build-SHA drift via a silent `/sw-heal`
bounce (`Clear-Site-Data: "cache"` + unregister). Manual `/sw-reset` is not
required before UI verification — a normal reload/navigation is enough.

### Environment / secrets

- No secrets are required for local dev, lint, or the test suite. `.env` is
  optional — the app boots with built-in defaults (see `.env.example`). Absence
  of Stripe/PayPal/SMTP/GitHub keys only disables those optional integrations.
- Tests use in-memory / temp SQLite and mock credentials.

### Lint / test / build

Standard commands are already defined; do not duplicate them. See
`UNICORN_FINAL/package.json` scripts and `.agents/skills/testing-unit-suite/SKILL.md`.
- Lint: `npm run lint` (repo root) → `eslint ... --max-warnings=0`.
- Tests: `cd UNICORN_FINAL && npm test` (chained with `&&`; a single failing
  file stops the rest). Individual files: `node test/<name>.test.js`.
- `npm run build` at the root runs lint + tests (there is no compiled artifact;
  `UNICORN_FINAL`'s own `build` script just echoes).
- Git hooks: `.husky/pre-commit` runs `lint-staged` (eslint --fix) inside
  `UNICORN_FINAL`.
