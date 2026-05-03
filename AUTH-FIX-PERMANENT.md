# AUTH-FIX-PERMANENT

Date: 2026-05-03

## Status

This report covers the **repository-side** permanent measures that protect
authentication on `https://zeusai.pro` (the AuthGuardian + automated DB
backup). The live diagnostic and repair steps that the operator requested
(SSH into `root@204.168.230.142`, inspect `docker logs`, restart
`docker-compose`, etc.) must be executed by an operator with SSH access to
the Hetzner server — the agent sandbox has neither SSH credentials nor
network reachability to the production host. Once an operator runs the
playbook below and merges this branch, the deploy workflow
(`.github/workflows/hetzner-deploy.yml`) will ship the durable
protections.

## Live operator playbook (steps 1–4 of the request)

Run from a workstation that has SSH access:

```bash
ssh root@204.168.230.142

# 1) DB sanity
file  /opt/unicorn/data/users.db
sqlite3 /opt/unicorn/data/users.db "PRAGMA quick_check;"
sqlite3 /opt/unicorn/data/users.db "SELECT COUNT(*) FROM users;"

# 2) Backend logs — look for jwt / secret / auth errors
docker logs unicorn-backend --tail 200 | grep -iE 'error|fail|jwt|secret|auth'
# fallback if pm2-managed:
pm2 logs unicorn-backend --lines 200 --nostream | grep -iE 'error|fail|jwt|secret|auth'

# 3) Env sanity — JWT_SECRET / SESSION_SECRET must be present and unchanged
grep -E '^(JWT_SECRET|SESSION_SECRET)=' /opt/unicorn/.env | sed 's/=.*/=<redacted>/'

# 4) If DB is corrupt → restore latest backup; otherwise restart services
ls -lt /opt/unicorn/backups/auth-db/ | head
node /opt/unicorn/UNICORN_FINAL/scripts/auth-repair.js   # idempotent
docker-compose -f /opt/unicorn/docker-compose.yml restart backend frontend \
  || pm2 restart unicorn-backend --update-env

# 5) Smoke test
curl -sS -X POST https://zeusai.pro/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@fix.com","password":"Test123456!","name":"Tester"}'
curl -sS -X POST https://zeusai.pro/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@fix.com","password":"Test123456!"}'
# Expect: HTTP 200 with a JSON body containing `"token": "..."`.
```

The login endpoint (`UNICORN_FINAL/backend/index.js:592`) returns
`{ token, user: {...} }` on success and `401 { error: "Invalid credentials" }`
otherwise. The register endpoint is at line 554 of the same file.

## Permanent protections shipped in this branch (step 5)

### 1) `auth-guardian.sh` — 5-minute login canary with 2-strike self-repair

- Path: `UNICORN_FINAL/scripts/auth-guardian.sh` (deployed to
  `/opt/unicorn/scripts/auth-guardian.sh`).
- Behaviour:
  1. `POST /api/auth/login` with the canary credentials
     (`AUTH_GUARDIAN_EMAIL` / `AUTH_GUARDIAN_PASSWORD` from `/opt/unicorn/.env`).
  2. On a fail, increments a counter in
     `/var/lib/unicorn/auth-guardian/consecutive-failures`. On success the
     counter resets to `0`.
  3. When the counter reaches `AUTH_GUARDIAN_FAIL_THRESHOLD` (default `2` —
     i.e. **two consecutive failures**, ~10 minutes apart) the script:
       * runs `sqlite3 PRAGMA quick_check` against `users.db`;
       * verifies `JWT_SECRET` and `SESSION_SECRET` are present in the env;
       * invokes `auth-repair.js` (DB integrity + backup restore);
       * restarts the backend (`pm2 restart unicorn-backend`, falling back
         to `docker-compose restart backend`, then `docker restart`);
       * re-probes after 8 s and dispatches a `🚨 AuthGuardian: ...` POST to
         `AUTH_GUARDIAN_WEBHOOK_URL` (Discord/Slack-compatible payload —
         both `content` and `text` keys are sent).
  4. All actions are logged with UTC timestamps to
     `/var/log/unicorn/auth-guardian.log`.
- Sibling runtime module `backend/modules/auth-guardian.js` already runs
  inside the Node process; this shell script is the **out-of-process**
  watchdog that survives a crashed/hung backend.

### 2) Hourly DB backup, 24-copy retention

- Path: `UNICORN_FINAL/scripts/auth-db-backup.js` (already in repo).
- Backups land under `/opt/unicorn/backups/auth-db/unicorn-auth-<ts>.db`.
- Each new copy is integrity-checked with `PRAGMA quick_check` before old
  copies are pruned; only **valid** backups can survive rotation, which is
  what `auth-repair.js` falls back to when restoring.

### 3) Cron file

- Path: `UNICORN_FINAL/scripts/cron/unicorn-auth-guardian.cron`.
- Install on the server:

  ```bash
  sudo install -m 0644 \
    /opt/unicorn/UNICORN_FINAL/scripts/cron/unicorn-auth-guardian.cron \
    /etc/cron.d/unicorn-auth-guardian
  sudo mkdir -p /var/log/unicorn /var/lib/unicorn/auth-guardian
  sudo chmod +x /opt/unicorn/UNICORN_FINAL/scripts/auth-guardian.sh
  sudo ln -sfn /opt/unicorn/UNICORN_FINAL/scripts/auth-guardian.sh \
               /opt/unicorn/scripts/auth-guardian.sh
  ```

- Schedule:
  - `*/5 * * * *` — `auth-guardian.sh`
  - `0   * * * *` — `auth-db-backup.js` (24-copy retention)

### 4) Required `/opt/unicorn/.env` keys

```env
AUTH_GUARDIAN_EMAIL=guardian@zeusai.pro
AUTH_GUARDIAN_PASSWORD=<strong-canary-password>
AUTH_GUARDIAN_BASE_URL=https://zeusai.pro
AUTH_GUARDIAN_DB_PATH=/opt/unicorn/data/users.db
AUTH_GUARDIAN_WEBHOOK_URL=https://discord.com/api/webhooks/...   # optional
# Override knobs (defaults shown):
# AUTH_GUARDIAN_FAIL_THRESHOLD=2
# AUTH_GUARDIAN_BACKUP_KEEP=24
# AUTH_GUARDIAN_PM2_NAME=unicorn-backend
```

The canary account must be created once via the registration endpoint
(see step 5 of the operator playbook) so that the guardian has a real
credential to probe with.

## Verification (run after deploy + cron install)

```bash
# Manual one-shot probe
sudo AUTH_GUARDIAN_ENV_FILE=/opt/unicorn/.env \
  /opt/unicorn/scripts/auth-guardian.sh
tail -n 20 /var/log/unicorn/auth-guardian.log
# Expect a line ending in: ok: login probe succeeded

# Backup smoke
sudo /usr/bin/node /opt/unicorn/UNICORN_FINAL/scripts/auth-db-backup.js
ls -lt /opt/unicorn/backups/auth-db/ | head -3
```

## What is NOT covered by this branch

- Live diagnostic findings from `root@204.168.230.142` (the operator must
  paste the output of step 1–4 of the playbook above into a follow-up
  comment so the post-mortem is complete).
- Rotation of `JWT_SECRET` / `SESSION_SECRET` — if the live diagnosis
  reveals these were regenerated, every existing session/JWT will be
  invalidated, and users will need to log in again. That is a manual,
  policy-level decision and is intentionally not automated here.
