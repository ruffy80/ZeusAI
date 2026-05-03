# AUTH-PERMANENT-FIX

Date: 2026-05-02

## Scope
Permanent hardening for auth availability on production (Hetzner), with automatic detection, repair, backup, and deploy-time blocking checks.

## Implemented components

### 1) AuthGuardian runtime module (5-minute loop)
- File: `UNICORN_FINAL/backend/modules/auth-guardian.js`
- Integrated in backend startup and module registry.
- Runs every 5 minutes (`AUTH_GUARDIAN_INTERVAL_MS`, default 300000).
- Probe flow:
  1. login with guardian account
  2. if account missing/invalid, bootstrap signup + retry login
  3. on failure, trigger repair script and retry within repair window (`AUTH_GUARDIAN_REPAIR_WINDOW_MS`, default 30000)
- Maintains degraded state, failures/recoveries counters, and event log.
- Writes persistent log to `UNICORN_FINAL/logs/auth-guardian.log`.

### 2) Self-repair script
- File: `UNICORN_FINAL/scripts/auth-repair.js`
- Actions:
  - validate SQLite auth DB integrity (using Node sqlite driver)
  - restore latest valid backup when DB is unhealthy
  - validate auth secrets presence (`JWT_SECRET`, `SESSION_SECRET` checks)
  - restart runtime (PM2 / docker-compose fallback path)
- Emits structured JSON output for automation.

### 3) Hourly DB backups (24 retention)
- File: `UNICORN_FINAL/scripts/auth-db-backup.js`
- Backup target: `.../backups/auth-db/`
- Retention: last 24 backups (`AUTH_GUARDIAN_BACKUP_KEEP`, default 24)
- Cron installed on server:
  - `/etc/cron.d/unicorn-auth-backup`
  - `0 * * * * root cd /var/www/unicorn/UNICORN_FINAL && /usr/bin/node scripts/auth-db-backup.js ...`

### 4) Deploy gate: mandatory auth smoke
- File: `.github/workflows/deploy.yml`
- Added blocking step: **Mandatory auth login smoke**
- Uses `.env` guardian credentials and fails deploy if login cannot be established.
- Includes signup bootstrap fallback and optional webhook alerting.

### 5) Backend endpoints for operator visibility
- File: `UNICORN_FINAL/backend/index.js`
- Added:
  - `GET /api/auth-guardian/status`
  - `POST /api/auth-guardian/run`

## Production activation details
- `.env` updated with:
  - `SESSION_SECRET`
  - `AUTH_GUARDIAN_ENABLED=1`
  - `AUTH_GUARDIAN_TEST_EMAIL=auth.guardian@zeusai.pro`
  - `AUTH_GUARDIAN_TEST_PASSWORD=<generated>`
  - `AUTH_GUARDIAN_TEST_NAME=AuthGuardian` (shell-safe)
  - `AUTH_GUARDIAN_INTERVAL_MS=300000`
  - `AUTH_GUARDIAN_REPAIR_WINDOW_MS=30000`
  - `AUTH_GUARDIAN_BACKUP_KEEP=24`
  - `AUTH_GUARDIAN_BACKUP_DIR=/var/www/unicorn/UNICORN_FINAL/backups/auth-db`
- Same env mirrored to `/opt/unicorn/.env` for compatibility with existing deploy scripts.

## Verification evidence
- Immediate backup executed successfully on production.
- AuthGuardian log exists and shows startup + probe success in:
  - `/var/www/unicorn/releases/<active-release>/UNICORN_FINAL/logs/auth-guardian.log`
- Direct auth smoke on backend localhost returns HTTP 200 for guardian account.

## Operational notes
- Current production runtime is PM2-first; docker-compose backend service naming may differ.
- Auth DB path in active app is SQLite `data/unicorn.db`.
- If auth degrades, AuthGuardian attempts recovery inside ~30 seconds window and flags degraded state if unresolved.
