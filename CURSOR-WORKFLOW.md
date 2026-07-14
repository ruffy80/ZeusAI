# CURSOR-WORKFLOW.md — GitHub-independent deploy & operations

_Last updated: 2026-07-14 by the Cursor agent._

## TL;DR — how zeusai.pro actually runs (read this before deploying)
- The live app is served by **nginx (:80/:443) + PM2 (`unicorn-backend` :3000, `unicorn-site` :3001)** from **`/var/www/unicorn/UNICORN_FINAL`** (a symlink to the current release under `/var/www/unicorn/releases/<sha>-<ts>/`).
- **It is NOT docker-compose.** Docker on the box runs only sidecars bound to `127.0.0.1`: `unicorn-redis`, `unicorn-postgres`, `unicorn-netdata`.
- ⚠️ **Do NOT run `docker-compose down` / `docker-compose up --build` for the app.** The repo's `docker-compose.yml` would collide with nginx+PM2 on :80/:443/:3000 and cause an outage, and `down` would stop the redis/postgres/netdata sidecars.
- Live state (`.env`, `data`, `db`) lives in **`/var/www/unicorn/shared`** and is symlinked into each release — never overwrite it with a deploy.

## Deploying WITHOUT GitHub (three ways, all safe, all canary-gated)
All three run the same `scripts/deploy-atomic-forward.sh` (canary on :3100 → health/QIS/smoke → atomic symlink promote → PM2 restart → final smoke → stamp `.deployed-commit`).

1. **Manual from your machine** — `scripts/deploy-local.sh [git-ref]` (default `origin/main`).
   Ships a clean `git archive` of the ref, then runs the atomic deploy. Env overrides: `ZEUS_SSH_KEY`, `ZEUS_HOST`, `ZEUS_USER`, `ZEUS_PUBLIC_URL`.
2. **On-server self-deploy poller** — `zeus-autodeploy.timer` (systemd, ~every 3 min) pulls `origin/main` over public HTTPS and deploys forward automatically. Kill-switch: `touch /etc/zeus-autodeploy.disabled`.
3. **GitHub Actions** (`.github/workflows/deploy.yml`) on push to `main` — the primary path when GitHub is available.

> NOTE: GitHub billing was **already unblocked** on 2026-07-14 — Actions runs again. The manual/poller paths remain as GitHub-independent fallbacks (belt & braces).

## Safety nets running on the box
- **Post-deploy sentinel** (`zeus-deploy-sentinel.timer`, `act` mode): rolls back to the last known-good release if a release regresses after promotion; quarantines the bad SHA so the poller won't redeploy it.
- **Hourly DB backups** (`zeus-db-backup.timer`): consistent gzip snapshots of `unicorn.db` + `tenants.db` (rotate 48), offsite-ready via `ZEUS_BACKUP_RCLONE_REMOTE`.

## What was changed / repaired (recent)
- `fix(checkout)`: BTC quote no longer stuck on "computing…" (TDZ in `client.js`).
- `feat(deploy)`: billing-independent self-deploy poller + `HOME`/PM2-daemon fix + live-SHA fallback.
- `feat(reliability)`: auto-rollback sentinel + hourly consistent DB backups.
- `feat(fulfillment)`: real AI-backed delivery engine (recipe-driven; standard artifacts + enterprise engagement proposals for high-ticket) wired to `aiProviders`; feature-flagged (`FULFILLMENT_AI_ENABLED=1`, pre-armed on server).
- `chore(security)`: untracked committed private keys / DBs / runtime secrets.
- Ops: registered a mislabeled OpenRouter key under `OPENROUTER_API_KEY`.

## Current live state
- ✅ **Functional.** `/health` 200, `/marketplace` 200, `/account` 200; sensitive-path guards `/.env` and `/%2eenv` → 404.
- Live build: `GET https://zeusai.pro/integrity.json` → `version`.

## Next steps (need owner action)
1. Merge the open fulfillment PR so real delivery activates (poller auto-deploys; flag pre-armed).
2. Add `SMTP_PASS` (Yahoo app password) so customers receive deliverables by email (currently queued only).
3. AI capacity for scale: DeepSeek out of balance, Groq on free daily cap, Gemini API not enabled, set a valid `OPENROUTER_MODEL`.
4. Restructure high-ticket checkout to deposit + milestones (so $4M engagements bill in stages, not upfront).
5. Rotate the SSH key that was shared in chat once you're done.
