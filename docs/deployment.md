# Unicorn Autonomous Deployment (Hetzner-only)

## Scope
This document defines the production runtime for `zeusai.pro` without Vercel dependency.

- Runtime target: Hetzner
- Public domains: `zeusai.pro`, `www.zeusai.pro`
- Process manager: PM2 + systemd
- Reverse proxy: Nginx
- SSL: Certbot
- Deploy trigger: GitHub push to `main`

## Autonomous architecture

### Core processes (PM2 ecosystem)
Defined in [UNICORN_FINAL/ecosystem.config.js](../UNICORN_FINAL/ecosystem.config.js):

- `unicorn` — backend API + frontend static serving
- `unicorn-orchestrator` — autonomy loop coordinator
- `unicorn-health-guardian` — health watchdog + auto-heal + rollback hook
- `unicorn-quantum-watchdog` — Quantum Integrity Shield watchdog
- `unicorn-platform-connector` — edge/backend monitor + redeploy trigger
- Optional support daemons: `unicorn-uaic`, `unicorn-llama-bridge`

### Integrity and self-healing
- Quantum Integrity API: `/api/quantum-integrity/status`
- Shield module: [UNICORN_FINAL/backend/modules/quantumIntegrityShield.js](../UNICORN_FINAL/backend/modules/quantumIntegrityShield.js)
- Shield checks:
  - critical module hashes
  - critical deploy/runtime file hashes
  - required PM2 process presence
  - runtime memory pressure
- Auto-actions:
  - auto-heal command
  - rollback command (if configured and integrity remains compromised)

## Production deploy pipeline

### Main workflow
- File: [.github/workflows/deploy-hetzner.yml](../.github/workflows/deploy-hetzner.yml)
- Trigger: push to `main` (or manual dispatch)

### Pipeline stages
1. Validate (`lint`, `test`, frontend `build`) on CI runner
2. SSH deploy to Hetzner
3. Backup current release (`scripts/create-backup.sh`)
4. Pull latest `origin/main`
5. Install backend/frontend dependencies
6. Build frontend
7. Re-run lint/tests on server
8. Controlled PM2 restart (`pm2 startOrRestart ecosystem.config.js`)
9. Run server auto-repair (`scripts/fix-server.sh`)
10. Verify local health + integrity + HTTPS
11. Automatic rollback on error (`scripts/rollback-last-backup.sh`)

## Nginx + SSL

- Nginx template: [UNICORN_FINAL/scripts/nginx-unicorn.conf](../UNICORN_FINAL/scripts/nginx-unicorn.conf)
- Auto-repair entrypoint: [UNICORN_FINAL/scripts/fix-server.sh](../UNICORN_FINAL/scripts/fix-server.sh)
- Certbot renew/issue is executed by deploy and keepalive paths

## Startup guarantees

Startup persistence is configured via:
- [UNICORN_FINAL/scripts/setup-systemd.sh](../UNICORN_FINAL/scripts/setup-systemd.sh)
- PM2 startup registration + fallback `unicorn.service`

The platform is designed to recover automatically:
- at server boot
- after deploy
- after PM2 restart
- after health/integrity degradation

## Operational checks

Use these endpoints externally:
- `http://zeusai.pro/health`
- `http://zeusai.pro/api/health`
- `http://zeusai.pro/api/orchestrator/status`
- `http://zeusai.pro/api/quantum-integrity/status`

Use these commands on server:

- `pm2 list`
- `pm2 logs --lines 100`
- `systemctl status nginx`
- `curl -sf http://127.0.0.1:3000/api/health`
- `curl -sf http://127.0.0.1:3000/api/quantum-integrity/status`

## Notes

- Vercel workflow is intentionally deprecated in Hetzner-only mode.
- If DNS/SSL provider propagation is in progress, HTTPS may lag until propagation completes.
