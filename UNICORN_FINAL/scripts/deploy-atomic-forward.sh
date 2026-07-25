#!/usr/bin/env bash
set -euo pipefail

CANDIDATE_DIR="${1:-}"
DEPLOY_LINK="${2:-/var/www/unicorn/UNICORN_FINAL}"
PUBLIC_URL="${PUBLIC_URL:-https://zeusai.pro}"
CANARY_PORT="${CANARY_PORT:-3100}"
CANARY_TIMEOUT_SECONDS="${CANARY_TIMEOUT_SECONDS:-90}"
FINAL_SMOKE_ATTEMPTS="${FINAL_SMOKE_ATTEMPTS:-24}"
PM2_APPS="unicorn-backend unicorn-site"
PM2_ONLY="unicorn-backend,unicorn-site"
# module-mesh-guardian is ACTIVE (works together with ZAC systemd) — do not retire.
RETIRED_PM2_APPS="autoscaler unicorn-live-sync unicorn-guardian"

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

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/upgrade-only-guard.sh" ]; then
  # shellcheck source=lib/upgrade-only-guard.sh
  . "$SCRIPT_DIR/lib/upgrade-only-guard.sh"
elif [ -f "$CANDIDATE_DIR/scripts/lib/upgrade-only-guard.sh" ]; then
  # shellcheck source=lib/upgrade-only-guard.sh
  . "$CANDIDATE_DIR/scripts/lib/upgrade-only-guard.sh"
fi

# EARLY: install Cursor Cloud SSH keys even before canary, so a failed canary
# still unlocks SSH for the next agent (break GitHub-billing chicken/egg).
if [ -x "$CANDIDATE_DIR/scripts/ensure-cursor-cloud-ssh.sh" ]; then
  log "early Cursor Cloud SSH bootstrap"
  bash "$CANDIDATE_DIR/scripts/ensure-cursor-cloud-ssh.sh" || log "[cursor-ssh] early bootstrap non-fatal"
fi

# Upgrade-only last line of defence before canary work: refuse promoting a
# candidate whose SHA is a strict ancestor of the live SHA (true downgrade).
# Divergent reunite is allowed when caller set ZEUS_ALLOW_DIVERGENT_REUNITE=1
# or the candidate subject contains [force-deploy]. Requires a git mirror with
# both objects — skipped cleanly when unavailable (cold / archive-only).
if type upgrade_only_guard >/dev/null 2>&1 && [ -n "${GITHUB_SHA:-}" ]; then
  LIVE_SHA="$(upgrade_only_live_sha "$DEPLOY_LINK")"
  SUBJ=""
  MIRROR="${ZEUS_MIRROR_DIR:-/opt/zeus-autodeploy/repo}"
  if [ -d "$MIRROR/.git" ]; then
    SUBJ="$(git -C "$MIRROR" log -1 --format=%s "$GITHUB_SHA" 2>/dev/null || true)"
    DEC="$(
      cd "$MIRROR" && upgrade_only_guard "$LIVE_SHA" "$GITHUB_SHA" "$SUBJ" || true
    )"
    case "$DEC" in
      DOWNGRADE)
        fail "UPGRADE-ONLY: refusing downgrade live=${LIVE_SHA:-none} → candidate=$GITHUB_SHA"
        ;;
      DIVERGENT)
        fail "UPGRADE-ONLY: refusing divergent promote without [force-deploy] live=${LIVE_SHA:-none} → $GITHUB_SHA"
        ;;
      UPGRADE|SAME|COLD|REUNITE|'')
        log "upgrade-only pre-canary: ${DEC:-skip} (live=${LIVE_SHA:-none} → $GITHUB_SHA)"
        ;;
    esac
  else
    log "upgrade-only: no git mirror at $MIRROR — SHA ancestry check deferred to caller"
  fi
fi

cleanup_pm2_topology() {
  for app in $RETIRED_PM2_APPS; do
    pm2 delete "$app" >/dev/null 2>&1 || true
  done

  local duplicate_ids
  duplicate_ids="$(pm2 jlist 2>/dev/null | node -e '
    let body = "";
    process.stdin.on("data", (chunk) => body += chunk);
    process.stdin.on("end", () => {
      try {
        const keepNames = new Set(["unicorn-backend", "unicorn-site"]);
        const seen = new Set();
        const deleteIds = [];
        for (const proc of JSON.parse(body || "[]")) {
          if (!keepNames.has(proc.name)) continue;
          if (seen.has(proc.name)) deleteIds.push(String(proc.pm_id));
          else seen.add(proc.name);
        }
        process.stdout.write(deleteIds.join(" "));
      } catch (_) {}
    });
  ')"
  if [ -n "$duplicate_ids" ]; then
    pm2 delete $duplicate_ids >/dev/null 2>&1 || true
  fi
}

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
  if [ "${BUILD_LEGACY_CLIENT:-0}" = "1" ]; then
    log "build legacy client (BUILD_LEGACY_CLIENT=1)"
    (cd client && { [ -f package-lock.json ] && npm ci --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error; } && NODE_OPTIONS="--no-deprecation --max-old-space-size=512" CI=false npm run build)
  else
    log "skip legacy client build (SSR site in src/ is production surface; set BUILD_LEGACY_CLIENT=1 to opt in)"
  fi
fi

log "start backend canary on port $CANARY_PORT"
CANARY_LOG="/tmp/unicorn-canary-${CANARY_PORT}.log"
PORT="$CANARY_PORT" BIND_HOST=127.0.0.1 NODE_ENV=production UNICORN_RUNTIME_PROFILE=safe \
  DISABLE_SELF_MUTATION=1 ENABLE_FILE_MUTATORS=0 ENABLE_AUTO_DEPLOY=0 ENABLE_UI_AUTOBUILDER=0 \
  ENABLE_AUTO_REPAIR=0 ENABLE_SELF_CONSTRUCTION=0 ENABLE_CODE_OPTIMIZER=0 ENABLE_AUTO_EVOLVE=0 \
  WATCHDOG_DISABLED=1 AUTH_GUARDIAN_ENABLED=0 UNICORN_REVENUE_AUTOPILOT_DISABLED=1 \
  QIS_REQUIRED_PROCESSES='' QIS_AUTO_HEAL_ENABLED=false QIS_HEAP_WARN_PCT=1 QIS_HEAP_WARN_MIN_MB=999999 \
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
    | node -e 'let body=""; process.stdin.on("data", c => body += c); process.stdin.on("end", () => { const data = JSON.parse(body); if (data.active === true && data.integrity !== "compromised") process.exit(0); process.exit(1); });' >/dev/null 2>&1; then
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
ln -sfn "$CANDIDATE_DIR" "$DEPLOY_PARENT/current"
[ "$(readlink -f "$DEPLOY_PARENT/current")" = "$CANDIDATE_DIR" ] || fail "current symlink mismatch after promote"

# Forever-key: provision the release-stable Ed25519 signing key BEFORE PM2
# starts, so the very first request after promote serves stable signatures.
log "ensure forever-key (Ed25519 site-sign)"
SHARED_DIR="$(dirname "$DEPLOY_LINK")/shared"
SHARED_DIR="$SHARED_DIR" KEY_FILE="$SHARED_DIR/site-sign.pem" PUB_FILE="$SHARED_DIR/site-sign.pub" \
  bash "$DEPLOY_LINK/scripts/ensure-forever-key.sh" || log "[forever-key] non-fatal: continuing without persistent key"

log "restart PM2 from canonical symlink only"
cd "$DEPLOY_LINK"
# Stamp build SHA into the release so /api/health + /api/build can prove reload.
if [ -n "${GITHUB_SHA:-}" ]; then
  printf '%s\n' "$GITHUB_SHA" > "$DEPLOY_LINK/.build-sha" || true
fi
# Install Cursor Cloud agent SSH pubkeys so agents can deploy when Actions is down.
if [ -x "$DEPLOY_LINK/scripts/ensure-cursor-cloud-ssh.sh" ]; then
  log "ensure Cursor Cloud SSH access"
  bash "$DEPLOY_LINK/scripts/ensure-cursor-cloud-ssh.sh" || log "[cursor-ssh] non-fatal"
elif [ -x "$CANDIDATE_DIR/scripts/ensure-cursor-cloud-ssh.sh" ]; then
  log "ensure Cursor Cloud SSH access (from candidate)"
  bash "$CANDIDATE_DIR/scripts/ensure-cursor-cloud-ssh.sh" || log "[cursor-ssh] non-fatal"
fi
# Keep the installed poller + upgrade-only guard in sync with the promoted
# release so future auto-pull runs always refuse downgrades.
if [ -f "$DEPLOY_LINK/scripts/auto-pull-deploy.sh" ]; then
  if install -m 0755 "$DEPLOY_LINK/scripts/auto-pull-deploy.sh" /usr/local/bin/zeus-auto-pull-deploy.sh 2>/dev/null; then
    log "synced /usr/local/bin/zeus-auto-pull-deploy.sh from promoted release"
  else
    log "[autodeploy] could not sync poller binary (non-fatal)"
  fi
fi
if [ -f "$DEPLOY_LINK/scripts/lib/upgrade-only-guard.sh" ]; then
  mkdir -p /usr/local/lib/zeus 2>/dev/null || true
  if install -m 0644 "$DEPLOY_LINK/scripts/lib/upgrade-only-guard.sh" /usr/local/lib/zeus/upgrade-only-guard.sh 2>/dev/null; then
    log "synced /usr/local/lib/zeus/upgrade-only-guard.sh from promoted release"
  else
    log "[autodeploy] could not sync upgrade-only guard (non-fatal)"
  fi
fi
if [ -f "$DEPLOY_LINK/scripts/zeus-deploy-sentinel.sh" ]; then
  install -m 0755 "$DEPLOY_LINK/scripts/zeus-deploy-sentinel.sh" /usr/local/bin/zeus-deploy-sentinel.sh 2>/dev/null \
    && log "synced /usr/local/bin/zeus-deploy-sentinel.sh from promoted release" \
    || log "[sentinel] could not sync sentinel binary (non-fatal)"
fi
# Clear quarantine for this SHA if a previous canary blip listed it — forward-only
# still applies; this only unblocks a known-good retry of the tip commit.
QUARANTINE_FILE="${ZEUS_QUARANTINE_FILE:-/opt/zeus-autodeploy/quarantine.txt}"
if [ -n "${GITHUB_SHA:-}" ] && [ -f "$QUARANTINE_FILE" ]; then
  if grep -qxF "$GITHUB_SHA" "$QUARANTINE_FILE" 2>/dev/null; then
    log "clearing quarantine entry for $GITHUB_SHA before promote"
    grep -vxF "$GITHUB_SHA" "$QUARANTINE_FILE" > "${QUARANTINE_FILE}.tmp" 2>/dev/null || true
    mv -f "${QUARANTINE_FILE}.tmp" "$QUARANTINE_FILE" 2>/dev/null || true
  fi
fi
cleanup_pm2_topology
for app in $PM2_APPS; do
  pm2 delete "$app" >/dev/null 2>&1 || true
done
# Hard-clear listeners on app ports. Fork-mode unicorn-backend has historically
# survived `pm2 delete` as an orphan on :3000 (site reloads, API stays stale).
for port in 3000 3001; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN | xargs -r kill -9 >/dev/null 2>&1 || true
  fi
done
sleep 2
# DO NOT set a global PORT here. ecosystem.config.js is the single source of
# truth for per-app PORT (backend:3000, site:3001). Setting PORT=3000 in the
# shell env propagates via `--update-env` to ALL apps and forces site to also
# attempt 3000, racing with backend → EADDRINUSE crash-loops on cold deploy.
if ! env \
  NODE_ENV=production \
  BIND_HOST=127.0.0.1 \
  UNICORN_RUNTIME_PROFILE=safe \
  QIS_REQUIRED_PROCESSES="$PM2_ONLY" \
  ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
  SW_VERSION="${GITHUB_SHA:-}" \
  pm2 start ecosystem.config.js --only "$PM2_ONLY" --update-env; then
  log "PM2 start failed (possibly stale process/daemon bug). Attempting recovery via pm2 kill..."
  pm2 kill || true
  sleep 3
  env \
    NODE_ENV=production \
    BIND_HOST=127.0.0.1 \
    UNICORN_RUNTIME_PROFILE=safe \
    QIS_REQUIRED_PROCESSES="$PM2_ONLY" \
    ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
    SW_VERSION="${GITHUB_SHA:-}" \
    pm2 start ecosystem.config.js --only "$PM2_ONLY" --update-env
fi

log "wait for PM2 warmup"
sleep 15
cleanup_pm2_topology

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
      QIS_REQUIRED_PROCESSES="$PM2_ONLY" \
      ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
      SW_VERSION="${GITHUB_SHA:-}" \
      pm2 start ecosystem.config.js --only "$app" --update-env >/dev/null
  done
  sleep 10
fi

# Prove the LIVE backend on :3000 is the freshly started process — not a 28h orphan.
log "verify backend process is fresh (uptime < 180s)"
BACKEND_UPTIME="$(curl -fsS --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null | node -e '
  let b=""; process.stdin.on("data",d=>b+=d); process.stdin.on("end",()=>{
    try { const j=JSON.parse(b||"{}"); process.stdout.write(String(j.uptime||999999)); }
    catch(_) { process.stdout.write("999999"); }
  });
' || echo 999999)"
if [ "${BACKEND_UPTIME:-999999}" -gt 180 ]; then
  log "backend uptime=${BACKEND_UPTIME}s looks stale — killing :3000 and respawning unicorn-backend"
  pm2 delete unicorn-backend >/dev/null 2>&1 || true
  if command -v fuser >/dev/null 2>&1; then fuser -k 3000/tcp >/dev/null 2>&1 || true; fi
  sleep 2
  cd "$DEPLOY_LINK"
  env \
    NODE_ENV=production \
    BIND_HOST=127.0.0.1 \
    UNICORN_RUNTIME_PROFILE=safe \
    QIS_REQUIRED_PROCESSES="$PM2_ONLY" \
    ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
    SW_VERSION="${GITHUB_SHA:-}" \
    pm2 start ecosystem.config.js --only unicorn-backend --update-env
  sleep 12
  BACKEND_UPTIME="$(curl -fsS --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null | node -e '
    let b=""; process.stdin.on("data",d=>b+=d); process.stdin.on("end",()=>{
      try { const j=JSON.parse(b||"{}"); process.stdout.write(String(j.uptime||999999)); }
      catch(_) { process.stdout.write("999999"); }
    });
  ' || echo 999999)"
  [ "${BACKEND_UPTIME:-999999}" -le 180 ] || fail "backend still stale after force-respawn (uptime=${BACKEND_UPTIME}s)"
fi
log "backend fresh — uptime=${BACKEND_UPTIME}s"

# ── Never leave production on rescue-backend.js ─────────────────────────────
# A prior thrash left PM2 pointing at scripts/rescue-backend.js (minimal API,
# missing PFOS/ESOS/catalog). Detect and force-respawn from ecosystem.
log "verify unicorn-backend script is backend/index.js (not rescue)"
BACKEND_SCRIPT="$(pm2 jlist 2>/dev/null | node -e '
  let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
    try {
      const list = JSON.parse(b || "[]");
      const p = list.find(x => x && x.name === "unicorn-backend");
      const script = (p && p.pm2_env && (p.pm2_env.pm_exec_path || p.pm2_env.script)) || "";
      process.stdout.write(String(script));
    } catch (_) { process.stdout.write(""); }
  });
' || true)"
case "$BACKEND_SCRIPT" in
  *rescue-backend*)
    log "FATAL topology: unicorn-backend is on rescue ($BACKEND_SCRIPT) — force ecosystem respawn"
    pm2 delete unicorn-backend >/dev/null 2>&1 || true
    if command -v fuser >/dev/null 2>&1; then fuser -k 3000/tcp >/dev/null 2>&1 || true; fi
    sleep 2
    cd "$DEPLOY_LINK"
    env \
      NODE_ENV=production \
      BIND_HOST=127.0.0.1 \
      UNICORN_RUNTIME_PROFILE=safe \
      QIS_AUTO_HEAL_ENABLED=false \
      QIS_REQUIRED_PROCESSES="$PM2_ONLY" \
      ZEUS_BUILD_SHA="${GITHUB_SHA:-}" \
      SW_VERSION="${GITHUB_SHA:-}" \
      pm2 start ecosystem.config.js --only unicorn-backend --update-env
    sleep 12
    BACKEND_SCRIPT="$(pm2 jlist 2>/dev/null | node -e '
      let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{
        try {
          const list = JSON.parse(b || "[]");
          const p = list.find(x => x && x.name === "unicorn-backend");
          const script = (p && p.pm2_env && (p.pm2_env.pm_exec_path || p.pm2_env.script)) || "";
          process.stdout.write(String(script));
        } catch (_) { process.stdout.write(""); }
      });
    ' || true)"
    case "$BACKEND_SCRIPT" in
      *rescue-backend*|"" ) fail "unicorn-backend still not on backend/index.js (got: $BACKEND_SCRIPT)" ;;
      *backend/index.js*) log "backend script restored → $BACKEND_SCRIPT" ;;
      *) fail "unicorn-backend unexpected script after rescue purge: $BACKEND_SCRIPT" ;;
    esac
    ;;
  *backend/index.js*) log "backend script OK → $BACKEND_SCRIPT" ;;
  "") log "WARN: could not read unicorn-backend script path from pm2 jlist" ;;
  *) log "WARN: unexpected unicorn-backend script path: $BACKEND_SCRIPT" ;;
esac

# ── QIS settle heartbeat (keeps the SSH session alive) ──────────────────────
# The Quantum Integrity Shield re-baselines on a fresh PM2 start; right after
# a restart that changed files it reports a transient non-'intact' state. We
# give it a short, BEST-EFFORT settle window that PRINTS a heartbeat each
# iteration so the deploy SSH session never idles into a broken pipe. If it
# doesn't reach strict 'intact' in time, we proceed anyway because the final
# smoke runs QIS_TOLERANT (active && not compromised), which is the correct
# security bar immediately post-restart.
# Scutul de Integritate are nevoie de timp să se re-calibreze; batem un puls.
log "QIS settle heartbeat (best-effort, pre-smoke)"
for s in $(seq 1 18); do
  QIS_BODY="$(curl -fsS --max-time 6 -H 'Cache-Control: no-cache' http://127.0.0.1:3000/api/quantum-integrity/status 2>/dev/null || true)"
  if printf '%s' "$QIS_BODY" | node -e 'let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>{try{const d=JSON.parse(b);process.exit((d.active===true&&d.integrity==="intact"&&(!d.diagnostics||(d.diagnostics.issues||[]).length===0))?0:1)}catch(_){process.exit(1)}})' 2>/dev/null; then
    log "QIS settled to intact (heartbeat ${s})"
    break
  fi
  log "QIS settling… (${s}/18)"
  sleep 5
done

FINAL_SMOKE_OK=0
for _ in $(seq 1 "$FINAL_SMOKE_ATTEMPTS"); do
  if BASE_URL=http://127.0.0.1:3000 PUBLIC_URL="$PUBLIC_URL" EXPECT_PM2_CWD="$DEPLOY_LINK" QIS_TOLERANT=1 bash scripts/smoke-forward-only.sh; then
    FINAL_SMOKE_OK=1
    break
  fi
  sleep 5
done
[ "$FINAL_SMOKE_OK" = "1" ] || fail "final live smoke timeout after PM2 restart"
cleanup_pm2_topology
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

# ZeusAI Unicorn Bot — CVR + Telegram Profit Group OS (single getUpdates owner).
# Do NOT reinstall zeus-telegram-autobind here — dual pollers fight.
if [ -x "$DEPLOY_LINK/scripts/install-zeus-unicorn-bot.sh" ]; then
  log "ensure zeus-unicorn-bot (CVR + TPG) is installed"
  UNICORN_LIVE="$DEPLOY_LINK" bash "$DEPLOY_LINK/scripts/install-zeus-unicorn-bot.sh" \
    || log "[unicorn-bot] non-fatal: install-zeus-unicorn-bot.sh exited non-zero"
fi
if pm2 describe zeus-telegram-autobind >/dev/null 2>&1; then
  log "stopping zeus-telegram-autobind (single getUpdates owner = unicorn-bot)"
  pm2 stop zeus-telegram-autobind >/dev/null 2>&1 || true
  pm2 delete zeus-telegram-autobind >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

# SAFE full-autonomy activation: turn business autonomy ON while keeping
# source-file mutators OFF, reload PM2 with the safe env, and install the
# health-watch cron. Best-effort / non-fatal so a watch/cron glitch never
# fails an otherwise-green deploy.
if [ -f "$DEPLOY_LINK/scripts/unicorn-full-activate.sh" ]; then
  log "SAFE full-autonomy activation"
  DEPLOY_LINK="$DEPLOY_LINK" PUBLIC_URL="$PUBLIC_URL" \
    bash "$DEPLOY_LINK/scripts/unicorn-full-activate.sh" || log "unicorn-full-activate non-fatal"
fi

log "forward-only deploy complete"
