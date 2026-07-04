---
name: testing-zeusai-platform
description: Test ZeusAI platform changes end-to-end. Use when verifying site deployment, backend modules, circuit-breaker, or bundle optimizations.
---

# Testing ZeusAI Platform

## Environment

- **Live site**: https://zeusai.pro (port 3001 site-server, port 3000 backend)
- **Health endpoint**: `GET /health` — returns JSON with `ok`, `status`, `uptimeSec`, `backend.ok`
- **Observe endpoint**: `GET /site/observe` — detailed module status, SSE clients, memory
- **Repo path**: `/home/ubuntu/repos/ZeusAI/UNICORN_FINAL`

## Architecture Notes

- **nginx** routes `/api/*` directly to backend (port 3000), bypassing site-server
- **Site-server** (port 3001) uses v2 SSR shell (`/assets/app.js`), NOT the React SPA build
- **Circuit-breaker** is on site-server's internal proxy (`siteProxyToUnicorn()`) — only testable locally or when requests go through port 3001 directly
- **React SPA** (`client/`) is built separately — code-split verification requires `npm run build` in client/
- **Deploy**: GitHub Actions auto-deploys on push to main (SSH + rsync + PM2 restart)

## Testing Workflows

### 1. Verify Live Deployment
```bash
curl -s https://zeusai.pro/health | python3 -m json.tool
# Expect: ok=true, uptimeSec < 1800 (recent restart), backend.ok=true
```

### 2. Test Backend Modules Locally
```bash
cd /home/ubuntu/repos/ZeusAI/UNICORN_FINAL

# Crash-notifier (disabled without env vars)
node -e "const cn = require('./backend/modules/crash-notifier'); cn.start(); console.log(cn.getStatus());"

# Crash-notifier (enabled with webhook)
CRASH_WEBHOOK_URL=http://example.com node -e "const cn = require('./backend/modules/crash-notifier'); cn.start(); console.log(cn.getStatus());"
```

### 3. Test Circuit-Breaker State Machine
The circuit-breaker uses a non-existent backend to simulate failures:
```bash
cd /home/ubuntu/repos/ZeusAI/UNICORN_FINAL
# Start site-server pointing to non-existent backend
# Then hit /api/industry/list to trigger failures
# After threshold (default 3) → circuit opens
# After cooldown (default 10s) → HALF_OPEN probe
# If probe fails → back to OPEN
```
Key headers: `X-Source: site-fallback-mock` (CLOSED/failed) vs `X-Source: site-circuit-breaker` (OPEN)

### 4. Test Code-Split Build
```bash
cd /home/ubuntu/repos/ZeusAI/UNICORN_FINAL/client
CI=false npx react-scripts build
# Expect: main.*.js < 300KB gzipped, separate *.chunk.js for three.js
```

### 5. Run Unit Tests
```bash
cd /home/ubuntu/repos/ZeusAI/UNICORN_FINAL
npm test  # Runs all test files
npm run lint  # ESLint with --max-warnings=0
```

## Common Issues

- **Node 22 lockfile issue**: If `npm ci` fails in client/ with missing peer deps, regenerate with `npm install --package-lock-only`
- **Site-server startup noise**: The site-server prints many module initialization logs on start — filter with grep for relevant output
- **Circuit-breaker not visible externally**: nginx sends /api/* to backend directly; circuit-breaker only applies to site-server's internal proxy calls

## Devin Secrets Needed

No secrets required for basic testing. For full crash-notifier testing:
- `CRASH_WEBHOOK_URL` — Discord/Slack webhook URL (optional, for live notification testing)
