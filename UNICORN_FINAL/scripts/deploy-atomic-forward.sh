#!/usr/bin/env bash
set -euo pipefail

CANDIDATE_DIR="${1:-}"
DEPLOY_LINK="${2:-/var/www/unicorn/UNICORN_FINAL}"
PUBLIC_URL="${PUBLIC_URL:-https://zeusai.pro}"
CANARY_PORT="${CANARY_PORT:-3100}"
CANARY_TIMEOUT_SECONDS="${CANARY_TIMEOUT_SECONDS:-90}"
PM2_APPS="unicorn-backend unicorn-site autoscaler"

if [ -z "$CANDIDATE_DIR" ]; then
  echo "usage: $0 /path/to/candidate/UNICORN_FINAL [/var/www/unicorn/UNICORN_FINAL]" >&2
  exit 2
fi
if [ ! -d "$CANDIDATE_DIR" ]; then
  echo "candidate directory not found: $CANDIDATE_DIR" >&2
  exit 2
fi

CANDIDATE_DIR="$(cd "$CANDIDATE_DIR" && pwd)"
DEPLOY_PARENT="$(dirname "$DEPLOY_LINK")"
mkdir -p "$DEPLOY_PARENT"

log() { printf '[deploy-forward] %s\n' "$*"; }
fail() { printf '[deploy-forward][FAIL] %s\n' "$*" >&2; exit 1; }

cleanup_canary() {
  if [ -n "${CANARY_PID:-}" ] && kill -0 "$CANARY_PID" 2>/dev/null; then
    kill "$CANARY_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$CANARY_PID" 2>/dev/null || true
  fi
}
trap cleanup_canary EXIT

log "candidate=$CANDIDATE_DIR"
log "deploy_link=$DEPLOY_LINK"

CURRENT_TARGET=""
if [ -L "$DEPLOY_LINK" ]; then
  CURRENT_TARGET="$(readlink -f "$DEPLOY_LINK" || true)"
fi

if [ -n "$CURRENT_TARGET" ] && [ -d "$CURRENT_TARGET" ]; then
  log "preserve live mutable state from $CURRENT_TARGET"
  for item in .env data db logs backups snapshots; do
    if [ -e "$CURRENT_TARGET/$item" ] && [ ! -e "$CANDIDATE_DIR/$item" ]; then
      ln -sfn "$CURRENT_TARGET/$item" "$CANDIDATE_DIR/$item"
    fi
  done
fi

cd "$CANDIDATE_DIR"
chmod +x scripts/*.sh scripts/*.js 2>/dev/null || true

log "preflight syntax/integrity"
node scripts/preflight-forward-only.js

log "install production dependencies if needed"
if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --no-fund
else
  npm install --omit=dev --no-audit --no-fund
fi

if [ -f client/package.json ]; then
  log "build client if present"
  (cd client && { [ -f package-lock.json ] && npm ci --no-audit --no-fund || npm install --no-audit --no-fund; } && CI=false npm run build)
fi

log "start backend canary on port $CANARY_PORT"
CANARY_LOG="/tmp/unicorn-canary-${CANARY_PORT}.log"
PORT="$CANARY_PORT" BIND_HOST=127.0.0.1 NODE_ENV=production UNICORN_RUNTIME_PROFILE=safe QIS_REQUIRED_PROCESSES='' \
  node backend/index.js >"$CANARY_LOG" 2>&1 &
CANARY_PID=$!

CANARY_OK=0
for _ in $(seq 1 "$CANARY_TIMEOUT_SECONDS"); do
  if ! kill -0 "$CANARY_PID" 2>/dev/null; then
    tail -120 "$CANARY_LOG" >&2 || true
    fail "canary process exited before health was ready"
  fi
  if curl -fsS --max-time 2 "http://127.0.0.1:${CANARY_PORT}/health" >/dev/null 2>&1; then
    CANARY_OK=1
    break
  fi
  sleep 1
done
[ "$CANARY_OK" = "1" ] || { tail -120 "$CANARY_LOG" >&2 || true; fail "canary health timeout"; }

log "wait for canary quantum integrity"
QIS_OK=0
for _ in $(seq 1 "$CANARY_TIMEOUT_SECONDS"); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${CANARY_PORT}/api/quantum-integrity/status" \
    | node -e 'let body=""; process.stdin.on("data", c => body += c); process.stdin.on("end", () => { const data = JSON.parse(body); if (data.active === true && data.integrity === "intact" && (!data.diagnostics || (data.diagnostics.issues || []).length === 0)) process.exit(0); process.exit(1); });' >/dev/null 2>&1; then
    QIS_OK=1
    break
  fi
  sleep 1
done
[ "$QIS_OK" = "1" ] || { curl -fsS --max-time 2 "http://127.0.0.1:${CANARY_PORT}/api/quantum-integrity/status" >&2 || true; tail -120 "$CANARY_LOG" >&2 || true; fail "canary quantum integrity timeout"; }

BASE_URL="http://127.0.0.1:${CANARY_PORT}" SKIP_PUBLIC=1 bash scripts/smoke-forward-only.sh
cleanup_canary
trap - EXIT

log "promote symlink atomically after green canary"
if [ -e "$DEPLOY_LINK" ] && [ ! -L "$DEPLOY_LINK" ]; then
  fail "$DEPLOY_LINK exists and is not a symlink; refusing destructive promote"
fi
TMP_LINK="${DEPLOY_LINK}.next.$$"
ln -sfn "$CANDIDATE_DIR" "$TMP_LINK"
RESOLVED_TMP="$(readlink -f "$TMP_LINK")"
[ "$RESOLVED_TMP" = "$CANDIDATE_DIR" ] || fail "temporary symlink mismatch"
mv -Tf "$TMP_LINK" "$DEPLOY_LINK"
[ "$(readlink -f "$DEPLOY_LINK")" = "$CANDIDATE_DIR" ] || fail "deploy symlink mismatch after promote"

log "restart PM2 from canonical symlink only"
cd "$DEPLOY_LINK"
for app in $PM2_APPS; do
  pm2 delete "$app" >/dev/null 2>&1 || true
done
pm2 start ecosystem.config.js --update-env

log "wait for PM2 warmup"
sleep 15
BASE_URL=http://127.0.0.1:3000 PUBLIC_URL="$PUBLIC_URL" EXPECT_PM2_CWD="$DEPLOY_LINK" bash scripts/smoke-forward-only.sh
pm2 save --force >/dev/null

if [ -n "${GITHUB_SHA:-}" ]; then
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_LINK/.deployed-commit"
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_LINK/.build-sha"
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_PARENT/.build-sha"
fi

log "forward-only deploy complete"
