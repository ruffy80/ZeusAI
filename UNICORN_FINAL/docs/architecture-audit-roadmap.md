# ZeusAI / Unicorn — Architecture Map, Audit & Roadmap

Lead Systems Architect snapshot after full-repo inspection (2026-07-31).
Honest: this is not AGI theater. Money truth = BTC sovereign path + optional rails.

## 1. Architecture map

### Process topology

```
Internet → nginx (zeusai.pro)
  ├─ /api/* (default)     → unicorn-backend  127.0.0.1:3000  (backend/index.js)
  ├─ pinned commerce APIs → unicorn-site     127.0.0.1:3001  (src/index.js)
  └─ HTML / assets / SW   → unicorn-site     127.0.0.1:3001
                                └─ BACKEND_API_URL → :3000
```

| Process | Entry | Port | Role |
|---|---|---|---|
| Backend | `backend/index.js` | 3000 | Express API, SQLite, most modules |
| Site SSR | `src/index.js` | 3001 (prod) / 3000 if alone | SSR v2 shell, sovereign commerce |
| Deploy canary | same backend | 3100 | Atomic promote gate |

**Gotchas:** both default to PORT=3000 locally; use `DISABLE_SELF_MUTATION=1` in dev.

### Data stores (shared on VPS: `/var/www/unicorn/shared`)

| Store | Owner |
|---|---|
| `data/unicorn.db` | `backend/db.js` |
| `data/commerce/portal.sqlite` | customer-portal |
| `data/commerce/referrals.sqlite` | referral-engine-real |
| `data/commerce/orders.jsonl` | sovereign-commerce |
| JSONL ledgers (POD, growth, frontier, email outbox) | various modules |

### Deploy

1. GitHub Actions `deploy.yml` → rsync → `deploy-atomic-forward.sh` (canary :3100)
2. On-server `auto-pull-deploy.sh` (~3 min) — kill-switch `/etc/zeus-autodeploy.disabled`
3. Sentinel monitors health; upgrade-only (no symlink rollback by default)

### Money path (canonical)

`catalog → sovereignBuy → POST /api/checkout/create → /checkout/:orderId → mempool match → entitlement + delivery`

Secondary: UAIC receipts, salesOrchestrator invoices, optional Stripe/PayPal/NOWPayments when secrets armed.

**Canonical Settle Bridge (CSB/1.0):** sovereign ORDERS remain money SoT; each mint dual-writes a portal shadow (`meta.portalOrderId`) so recovery + dashboards share one invoice plane; paid settle mirrors `status:paid` onto the shadow.

### Module reality (~610 backend module files)

- ~145 AdaptiveModule/Engine shims (pool workers — not commerce organs)
- ~40 real commerce organs (pricing, BTC, upsell, ZACC, recovery, …)
- Large observe/status layer under stable profile (mutators off)

## 2. Audit — prioritized findings

### P0 — Security / integrity

1. Gift mint was a public free SKU printer (`/api/gift/mint`)
2. Payment confirm allowed `open-dev` when confirm secrets missing
3. Mutating ZAC / quarantine promote endpoints lacked admin gate
4. Public `/api/referral/redeem` could inflate commissions

### P1 — Revenue / reliability

5. Email rail unarmed without Resend/Brevo (recovery cannot reach buyers)
6. Card rails unarmed without Stripe
7. Affiliate commissions stay `pending` (no payout rail)
8. Split checkout planes (sovereign / UAIC / portal)
9. Growth profile can re-arm file mutators

### P2 — Debt / scale

10. Referral engine duplication (4 systems)
11. Pricing module sprawl
12. Monolith size + ~220 timers + heavy SSR/JS payloads
13. Weak default referral HMAC fallbacks

## 3. Execution roadmap (priority order)

| Phase | Focus | Exit criteria | Status |
|---|---|---|---|
| **1** | Security harden money + control plane | Gift/redeem/confirm/ZAC/quarantine gated; tests green | **DONE** |
| **2** | Revenue rails honesty + recovery delivery | Email status surfaced; card CTA only when armed; recovery awaits send result | **DONE** |
| **3** | Canonical settle plane | One attribution path; portal↔sovereign bridge for recovery | **DONE** |
| **4** | Affiliate payout + lead ops | Pending → paid BTC ledger; outreach metrics | **DONE** |
| **5** | Performance | Cut first-paint JS; reduce idle timers under stable | **DONE** |
| **6** | Consolidation | Deprecate duplicate referral/pricing SoTs | **DONE** |

**Decision filter for every change:** improves reliability, user value, or revenue — otherwise skip.

## 4. Phase status detail

### Phase 1 — Security (`cursor/phase1-security-harden-c3b6`)

- Close payment-confirm `open-dev` outside `NODE_ENV=test` / explicit allow
- Gate gift mint behind paid-order proof or admin secret
- Gate ZAC mutate + quarantine promote with admin secret/JWT
- Gate public referral redeem (settle still redeems in-process)

### Phase 2 — Rails honesty + recovery delivery

- `recoverStuckPending` / `checkout-recovery-agent.recover` are **async** and only mark sent when `r.ok`
- `/api/payment/methods` exposes `emailConfigured` (site + backend)
- Stripe/PayPal/email reject placeholder secrets
- Checkout **Armed Rails Continuum** strip (BTC / Card / Email live status)
- `hydratePaymentRails` hides unarmed card chips and surfaces email arm state

### Phase 3 — Canonical Settle Bridge (CSB/1.0)

- New module: `src/commerce/canonical-settle-bridge.js`
- Sovereign `createOrder` dual-writes portal shadow → `meta.portalOrderId`
- `scanIncoming` paid path mirrors `status:paid` onto portal
- Bridge failures never block mint or settle

### Phase 4 — Affiliate payout + lead ops

- `referral-engine-real.listPendingPayouts` / `markPaid(id, {txid})` — ledger-only, no fake chain send
- Admin routes: `GET /api/referral/payouts/pending`, `POST /api/referral/payouts/mark-paid`
- Lead hunter `getStatus().outreach` = `{ sent, failed, unconfigured, queued }`
- Outreach send awaits provider result (no false "sent")

### Phase 5 — Performance

- Lead hunter idle under `UNICORN_RUNTIME_PROFILE=stable` unless `LEAD_HUNTER_FORCE=1`
- Three.js loader skipped on non-home routes (`window.__UNICORN__.route !== '/'`)

### Phase 6 — Referral consolidation

- `backend/modules/referralEngine.js` → thin deprecated facade → `referral-engine-real`
- `global-referral-loop` dual-writes SoT on `attributePaidOrder` / `createCode`
- Roadmap + regression tests: `test/phases-2-6-completion.test.js`
