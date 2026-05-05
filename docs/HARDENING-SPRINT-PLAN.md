# UNICORN — 30-Year Hardening Sprint Plan

**Status legend:** ✅ live · 🟡 in-progress · ⏳ planned (forward-only, never rollback)

This document is the **forward-fix runbook** for everything beyond the immediate
A-package (already shipped). Every item is **additive**: existing behavior must
continue to work while the new layer rolls in. No revert, no downgrade, no
rollback — per `LIVE_BASELINE.md` policy.

---

## ✅ Pachet A — Immediate fixes (LIVE on `zeusai.pro`)

| ID | Item | Commit | Verified |
|----|------|--------|----------|
| A1 | `BIND_HOST=127.0.0.1` (backend + site loopback) | `0cf3d56` | `ss -tln` → `127.0.0.1:3000/3001`; external `:3000` refused |
| A2 | Cluster sanity (4× `unicorn-site` workers) | inherited | `pm2 jlist` |
| A3 | Idempotent predictive-scaler | `de7a28c` | autoscaler restarts = 0 (was 103) |
| A4 | Break `live-pricing-broker` ↔ `serviceMarketplace` cycle | `0cf3d56` | lazy `_marketplace()` accessor |
| A5 | AI fallback resilient (`degraded:true` + 60s log throttle) | `0cf3d56` | multi-router + chat |
| A6 | Structured `quantumIntegrityShield` degraded log | `de7a28c` | `degraded — N issue(s): [...]` |

---

## ⏳ Pachet B — Performance (next sprint)

### B7 · Node.js 20 → 22 LTS upgrade
- **Why:** Node 22 ships V8 12.4 (faster RegExp, tier-up compiler), `node --watch` GA,
  better permission model, ~10–15 % HTTP throughput gain on stream-heavy workloads
  like SSE.
- **Forward-fix steps:**
  1. Pin `engines.node` to `>=22.0.0 <23` in `UNICORN_FINAL/package.json` (additive,
     since current Node 20.20.2 already passes; CI matrix can run both).
  2. Bump `actions/setup-node@v4` `node-version: '22'` in `.github/workflows/*.yml`
     workflows that run tests.
  3. On Hetzner: install Node 22 via `nvm install 22 && nvm alias default 22`,
     then `pm2 update` to re-spawn workers under new runtime.
  4. Verify `node --version` on box, run `npm test`, then `pm2 reload all --update-env`.
- **Forward-only safety:** all production npm deps are already Node 22-compatible
  (better-sqlite3, ws, undici). No native module rebuild beyond `npm rebuild`.
- **Rollback path:** none (forward-only). If Node 22 surfaces an issue, fix the issue,
  do not regress runtime.

### B8 · Nginx HTTP/3 + QUIC
- **Why:** ~30 % faster page loads on lossy networks (mobile), 0-RTT resumption.
- **Forward-fix steps:**
  1. `apt install nginx-full` already gives `--with-http_v3_module` on Ubuntu 22.04.
  2. Add to `nginx-unicorn.conf`:
     ```
     listen 443 quic reuseport;
     listen 443 ssl http2;
     add_header Alt-Svc 'h3=":443"; ma=86400';
     ssl_protocols TLSv1.3;
     ssl_early_data on;
     ```
  3. Open UDP/443 in Hetzner firewall.
  4. Verify with `curl --http3 -I https://zeusai.pro`.
- **Forward-only safety:** HTTP/2 listener stays as fallback. Browsers downgrade
  automatically.

### B9 · Brotli compression
- **Why:** ~20 % smaller payloads vs gzip on JSON / HTML.
- **Forward-fix steps:**
  1. `apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static`.
  2. Add `brotli on; brotli_comp_level 5; brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;` to `nginx-unicorn.conf`.
  3. Reload nginx, verify `curl -H 'Accept-Encoding: br' -I` returns `content-encoding: br`.
- **Forward-only safety:** gzip stays enabled as fallback for clients without `br`.

### B10 · Static asset CDN-style caching
- Add `expires 1y; add_header Cache-Control "public, immutable";` for `/assets/*`.
- Already partially done via SWR on dynamic JSON (B11 ✅).

### B13 · `/snapshot` payload diff streaming
- Replace full snapshot every poll with delta over SSE (already have `/stream`).
- Reduces bandwidth ~80 % for the HTML portal.

---

## ⏳ Pachet C — Resilience (operational)

| ID | Item | Notes |
|----|------|-------|
| C15 | UFW firewall rules (allow 22/80/443/UDP-443 only) | Pair with B8 |
| C16 | `fail2ban` for SSH + nginx-bad-bot | Additive jail config |
| C17 | PM2 `max_memory_restart: '900M'` per worker | Caps RSS leaks |
| C18 | Daily SQLite `VACUUM` + `PRAGMA wal_checkpoint(TRUNCATE)` cron | DB hygiene |
| C19 | Automated restic backup of `/var/www/unicorn/data` → Hetzner Storage Box | Hourly snapshots |
| C20 | Prometheus node-exporter + nginx-exporter + custom unicorn-exporter | Pull-based metrics |
| C21 | Grafana dashboard for SSE active connections, scaler decisions, AI-router providers | Visibility |
| C22 | Loki for structured PM2 logs (already JSON-tagged via A6) | Log aggregation |
| C23 | Alertmanager → email/Telegram on: `/health` 5xx 3-of-5, scaler thrash, cert <14d | SLO alerts |
| C24 | Chaos drill: `pm2 stop unicorn-backend` → autoscaler must NOT cascade-fail site | Game day |

---

## ⏳ Pachet D — Long-term innovation

| ID | Item | Horizon |
|----|------|---------|
| D25 | WebTransport for `/stream` (replacing SSE for browsers ≥ Chrome 124) | Q2 2026 |
| D26 | Edge-cache `/api/instant/catalog` via Bunny/Fastly (origin-shield Hetzner) | Q2 2026 |
| D27 | Multi-region read replicas (Hetzner FSN1 + HEL1) with libsql/Turso | Q3 2026 |
| D28 | WASM sandbox for innovation engines (untrusted code → no host escape) | Q3 2026 |
| D29 | Conformal-prediction layer over multi-model-router for calibrated confidence | Q4 2026 |
| D30 | Public transparency log (Sigsum/Trillian) for every `/api/v50/audit/root` advancement | Q4 2026 |

---

## Operational guardrails (NEVER violate)

1. **Forward-only baseline.** `.github/baselines/live.sha` may only advance.
2. **No `git revert` on `main`.** Bugs are fixed by new commits.
3. **No removal of public endpoints.** Deprecate via header `Deprecation: <date>` + add successor.
4. **No schema column drops.** Mark `DEPRECATED` in code; ignore in writes; nullify reads later.
5. **No PM2 process renames.** Existing names are baselined in dashboards/alerts.
6. **CI smoke probes that hit `HETZNER_HOST:3000` directly are now non-functional** (loopback bind). They remain in `.github/workflows/deploy.yml` as harmless secondary-fallback paths because their primary target is `https://zeusai.pro/...` via nginx, and the `:3000` branch was already optional. Do not re-introduce 0.0.0.0 binding to "fix" them; instead, when convenient, switch them to ssh-tunneled probes.

---

_Last update: pachet A complete and live. Next sprint owner picks up from B7._
