#!/usr/bin/env bash
set -euo pipefail

CANDIDATE_DIR="${1:-}"
DEPLOY_LINK="${2:-/var/www/unicorn/UNICORN_FINAL}"
PUBLIC_URL="${PUBLIC_URL:-https://zeusai.pro}"
CANARY_PORT="${CANARY_PORT:-3100}"
CANARY_TIMEOUT_SECONDS="${CANARY_TIMEOUT_SECONDS:-90}"
FINAL_SMOKE_ATTEMPTS="${FINAL_SMOKE_ATTEMPTS:-12}"
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
    wait "$CANARY_PID" 2>/dev/null || true
  fi
}
trap cleanup_canary EXIT

log "candidate=$CANDIDATE_DIR"
log "deploy_link=$DEPLOY_LINK"

CURRENT_TARGET=""
if [ -L "$DEPLOY_LINK" ]; then
  CURRENT_TARGET="$(readlink -f "$DEPLOY_LINK" || true)"
fi

# Stable shared state directory — every release symlinks .env/data/db/logs/...
# into here instead of into the previous release. Avoids the MAXSYMLINKS=40
# ELOOP that would otherwise hit the canary after ~40 deploys (each new
# release used to chain `data → prev/data → prev-prev/data → …`).
SHARED_ROOT="/var/www/unicorn/shared"
mkdir -p "$SHARED_ROOT"

# One-time migration: if the current live release contains REAL state dirs
# (not yet promoted to SHARED_ROOT), move them once. Subsequent deploys then
# always link straight into $SHARED_ROOT, breaking any pre-existing chain.
if [ -n "$CURRENT_TARGET" ] && [ -d "$CURRENT_TARGET" ]; then
  for item in .env data db logs backups snapshots; do
    SRC="$CURRENT_TARGET/$item"
    DEST="$SHARED_ROOT/$item"
    if [ -e "$SRC" ] && [ ! -L "$SRC" ] && [ ! -e "$DEST" ]; then
      log "migrate $item → $SHARED_ROOT (one-time)"
      mv "$SRC" "$DEST" || cp -a "$SRC" "$DEST"
    fi
    # If the source is a symlink chain, resolve it once and copy its
    # ultimate real target into SHARED_ROOT (only if SHARED_ROOT is empty).
    if [ -L "$SRC" ] && [ ! -e "$DEST" ]; then
      REAL="$(readlink -f "$SRC" 2>/dev/null || true)"
      if [ -n "$REAL" ] && [ -e "$REAL" ] && [ "$REAL" != "$DEST" ]; then
        log "rescue $item from chain → $SHARED_ROOT"
        cp -a "$REAL" "$DEST" || true
      fi
    fi
  done
fi

log "preserve live mutable state via shared root: $SHARED_ROOT"
for item in .env data db logs backups snapshots; do
  if [ -e "$SHARED_ROOT/$item" ] && [ ! -e "$CANDIDATE_DIR/$item" ]; then
    ln -sfn "$SHARED_ROOT/$item" "$CANDIDATE_DIR/$item"
  elif [ -n "$CURRENT_TARGET" ] && [ -e "$CURRENT_TARGET/$item" ] && [ ! -e "$CANDIDATE_DIR/$item" ]; then
    # Fallback: cold-start case where SHARED_ROOT is not populated yet.
    # Resolve to the real path so the new release does not extend the chain.
    REAL="$(readlink -f "$CURRENT_TARGET/$item" 2>/dev/null || true)"
    if [ -n "$REAL" ] && [ -e "$REAL" ]; then
      ln -sfn "$REAL" "$CANDIDATE_DIR/$item"
    fi
  fi
done

cd "$CANDIDATE_DIR"
chmod +x scripts/*.sh scripts/*.js 2>/dev/null || true

log "preflight syntax/integrity"
node scripts/preflight-forward-only.js

export NPM_CONFIG_LOGLEVEL=error
export NPM_CONFIG_FUND=false

log "install production dependencies if needed"
if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
else
  npm install --omit=dev --no-audit --no-fund --loglevel=error
fi

if [ -f client/package.json ]; then
  log "build client if present"
  (cd client && { [ -f package-lock.json ] && npm ci --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error; } && CI=false npm run build)
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

# Forever-key: provision the release-stable Ed25519 signing key BEFORE PM2
# starts, so the very first request after promote serves stable signatures.
log "ensure forever-key (Ed25519 site-sign)"
SHARED_DIR="$(dirname "$DEPLOY_LINK")/shared"
SHARED_DIR="$SHARED_DIR" KEY_FILE="$SHARED_DIR/site-sign.pem" PUB_FILE="$SHARED_DIR/site-sign.pub" \
  bash "$DEPLOY_LINK/scripts/ensure-forever-key.sh" || log "[forever-key] non-fatal: continuing without persistent key"

log "restart PM2 from canonical symlink only"
cd "$DEPLOY_LINK"
for app in $PM2_APPS; do
  pm2 delete "$app" >/dev/null 2>&1 || true
done
# DO NOT set a global PORT here. ecosystem.config.js is the single source of
# truth for per-app PORT (backend:3000, site:3001). Setting PORT=3000 in the
# shell env propagates via `--update-env` to ALL apps and forces site to also
# attempt 3000, racing with backend → EADDRINUSE crash-loops on cold deploy.
env \
  NODE_ENV=production \
  BIND_HOST=127.0.0.1 \
  UNICORN_RUNTIME_PROFILE=safe \
  QIS_REQUIRED_PROCESSES=unicorn-backend,unicorn-site,autoscaler \
  ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
  SW_VERSION="${GITHUB_SHA:-}" \
  pm2 start ecosystem.config.js --update-env

log "wait for PM2 warmup"
sleep 15

# ── PM2 cwd-drift auto-recovery ─────────────────────────────────────────────
# Some PM2 versions don't fully replace existing entries on `pm2 start
# ecosystem.config.js` when a name collides with a previously-deleted slot.
# This causes apps (especially fork-mode `unicorn-backend`) to silently keep
# pointing at the previous release's pm_cwd. Detect and force-respawn.
log "check for PM2 cwd drift"
EXPECTED_CWD="$(readlink -f "$DEPLOY_LINK")"
DRIFTED_APPS="$(pm2 jlist 2>/dev/null | node -e '
  let body=""; process.stdin.on("data",c=>body+=c);
  process.stdin.on("end",()=>{
    try {
      const expected = process.argv[1];
      const required = (process.argv[2] || "").split(/\s+/).filter(Boolean);
      const list = JSON.parse(body || "[]");
      const drifted = new Set();
      for (const p of list) {
        const name = p.name || "";
        if (!required.includes(name)) continue;
        const cwd = (p.pm2_env && p.pm2_env.pm_cwd) || "";
        if (cwd && cwd !== expected) drifted.add(name);
        if ((p.pm2_env && p.pm2_env.status) !== "online") drifted.add(name);
      }
      // Also: any required app entirely missing → respawn it.
      const present = new Set(list.map(p => p.name));
      for (const name of required) if (!present.has(name)) drifted.add(name);
      process.stdout.write([...drifted].join(" "));
    } catch (_) { /* leave empty */ }
  });
' "$EXPECTED_CWD" "$PM2_APPS")"

if [ -n "$DRIFTED_APPS" ]; then
  log "PM2 drift detected on: $DRIFTED_APPS — force-respawn from canonical symlink"
  for app in $DRIFTED_APPS; do
    pm2 delete "$app" >/dev/null 2>&1 || true
  done
  cd "$DEPLOY_LINK"
  for app in $DRIFTED_APPS; do
    env \
      NODE_ENV=production \
      BIND_HOST=127.0.0.1 \
      UNICORN_RUNTIME_PROFILE=safe \
      QIS_REQUIRED_PROCESSES=unicorn-backend,unicorn-site,autoscaler \
      ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
      SW_VERSION="${GITHUB_SHA:-}" \
      pm2 start ecosystem.config.js --only "$app" --update-env >/dev/null
  done
  sleep 10
fi

FINAL_SMOKE_OK=0
for _ in $(seq 1 "$FINAL_SMOKE_ATTEMPTS"); do
  if BASE_URL=http://127.0.0.1:3000 PUBLIC_URL="$PUBLIC_URL" EXPECT_PM2_CWD="$DEPLOY_LINK" bash scripts/smoke-forward-only.sh; then
    FINAL_SMOKE_OK=1
    break
  fi
  sleep 5
done
[ "$FINAL_SMOKE_OK" = "1" ] || fail "final live smoke timeout after PM2 restart"
pm2 save --force >/dev/null

if [ -n "${GITHUB_SHA:-}" ]; then
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_LINK/.deployed-commit"
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_LINK/.build-sha"
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_PARENT/.build-sha"
fi

# Idempotent self-heal install: ensures unicorn-healer.timer is on every box.
log "ensure unicorn-healer.timer is installed and active"
if [ -x "$DEPLOY_LINK/scripts/install-healer.sh" ]; then
  REPO_DIR="$DEPLOY_LINK" bash "$DEPLOY_LINK/scripts/install-healer.sh" \
    || log "[healer] non-fatal: install-healer.sh exited non-zero"
fi

log "forward-only deploy complete"
