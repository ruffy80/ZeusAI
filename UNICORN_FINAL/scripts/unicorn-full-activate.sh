#!/usr/bin/env bash
# unicorn-full-activate.sh
# ---------------------------------------------------------------------------
# SAFE full-autonomy activation for ZeusAI / Unicorn Platform on the Hetzner
# box. Modules load IN-PROCESS via backend/index.js + ecosystem.config.js
# (`unicorn-backend`, `unicorn-site`). This script therefore NEVER starts a
# PM2 process per module file and NEVER creates stub module source files.
#
# It:
#   - turns business autonomy ON (growth profile, auto-repair, auto-restart)
#   - keeps source-file mutators OFF (prevents auto-generated stubs from
#     overwriting the real backend modules)
#   - reloads the two canonical PM2 apps with the safe env
#   - runs a read-only module audit (report only, never create stubs)
#   - verifies backend + site + public health
#   - installs a SAFE 5-min health-watch cron (no self-construction cron)
#
# Idempotent and best-effort where noted. Exits non-zero on health failure.
# ---------------------------------------------------------------------------
set -euo pipefail

DEPLOY_LINK="${DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
SHARED_ROOT="${SHARED_ROOT:-/var/www/unicorn/shared}"
AUTONOMY_ENV_FILE="${AUTONOMY_ENV_FILE:-$SHARED_ROOT/unicorn-autonomy.env}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
SITE_PORT="${SITE_PORT:-3001}"
PUBLIC_URL="${PUBLIC_URL:-https://zeusai.pro}"
PM2_ECOSYSTEM="ecosystem.config.js"

log()  { printf '[unicorn-activate] %s\n' "$*"; }
warn() { printf '[unicorn-activate][WARN] %s\n' "$*" >&2; }
fail() { printf '[unicorn-activate][FAIL] %s\n' "$*" >&2; exit 1; }

# ── 0. Resolve + validate deploy path ───────────────────────────────────────
if [ ! -e "$DEPLOY_LINK" ]; then
  fail "DEPLOY_LINK does not exist: $DEPLOY_LINK"
fi
if [ ! -d "$DEPLOY_LINK" ]; then
  fail "DEPLOY_LINK is not a directory: $DEPLOY_LINK"
fi
cd "$DEPLOY_LINK"
log "deploy_link=$DEPLOY_LINK ($(readlink -f "$DEPLOY_LINK" 2>/dev/null || echo "$DEPLOY_LINK"))"

# ── 1. Ensure dependencies (only if missing — do NOT always reinstall) ───────
if [ ! -d node_modules ]; then
  log "node_modules missing — installing production dependencies"
  npm install --omit=dev --no-audit --no-fund --loglevel=error
else
  log "node_modules present — skipping install"
fi

# ── 2. Ensure pm2 is available ───────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  log "pm2 not found — installing globally"
  npm install -g pm2 --loglevel=error
fi

# ── 3. Write the SAFE autonomy env file ──────────────────────────────────────
# Business autonomy ON, source-file mutators OFF. Keeping the file-mutators and
# self-construction flags OFF is what prevents auto-generated stubs from
# overwriting the real backend module source files.
mkdir -p "$SHARED_ROOT"
cat > "$AUTONOMY_ENV_FILE" <<'ENV'
UNICORN_RUNTIME_PROFILE=growth
ENABLE_FILE_MUTATORS=0
ENABLE_SELF_CONSTRUCTION=0
DISABLE_SELF_MUTATION=1
ENABLE_AUTO_REPAIR=1
ENABLE_AUTO_DEPLOY=0
ENABLE_UI_AUTOBUILDER=0
ENABLE_CODE_OPTIMIZER=0
ENABLE_AUTO_EVOLVE=0
ENABLE_AUTO_RESTART=1
ENV
log "wrote safe autonomy env → $AUTONOMY_ENV_FILE"

# ── 4. Source that env and reload PM2 with it ────────────────────────────────
set -a
# shellcheck disable=SC1090
. "$AUTONOMY_ENV_FILE"
set +a

if [ ! -f "$PM2_ECOSYSTEM" ]; then
  fail "missing $PM2_ECOSYSTEM in $DEPLOY_LINK"
fi
log "reloading PM2 from $PM2_ECOSYSTEM with safe autonomy env"
pm2 startOrReload "$PM2_ECOSYSTEM" --update-env
pm2 save

# ── 5. Read-only module audit (report only — NEVER create stubs) ─────────────
# frontierAI.js is known NOT to exist; report it as absent, do not invent it.
log "read-only module audit (report only)"
MODULES_DIR="$DEPLOY_LINK/backend/modules" node <<'NODE' || warn "module audit encountered an error (non-fatal)"
const path = require('path');
const dir = process.env.MODULES_DIR;
// [display name, candidate require targets relative to backend/modules]
const targets = [
  ['quantumPaymentNexus',     ['quantumPaymentNexus']],
  ['aiNegotiator',            ['aiNegotiator']],
  ['selfConstruction',        ['selfConstruction']],
  ['domainAutomationManager', ['domainAutomationManager']],
  ['autoDeploy',              ['autoDeploy', 'auto-deploy']],
  ['totalSystemHealer',       ['totalSystemHealer']],
  ['dynamicPricing',          ['dynamic-pricing', 'dynamicPricing']],
  ['ModuleLoader',            ['ModuleLoader']],
  ['frontierAI',              ['frontierAI']],
];
let present = 0;
let missing = 0;
for (const [name, candidates] of targets) {
  let resolved = null;
  for (const c of candidates) {
    try {
      resolved = require.resolve(path.join(dir, c));
      break;
    } catch (_) { /* try next candidate */ }
  }
  if (resolved) {
    // require to confirm it actually loads (read-only, no mutation).
    try {
      require(resolved);
      console.log(`  [ok]   ${name} -> ${path.basename(resolved)}`);
      present += 1;
    } catch (e) {
      console.log(`  [WARN] ${name} present but failed to load: ${e.message}`);
      present += 1;
    }
  } else {
    console.log(`  [WARN] ${name} ABSENT — not creating a stub`);
    missing += 1;
  }
}
console.log(`  audit: ${present} present, ${missing} absent (absent modules are NOT stubbed)`);
// Some modules start background intervals on load (e.g. auto-restart); exit
// explicitly so this short-lived audit process never hangs the deploy.
process.exit(0);
NODE

# ── 6. Install the SAFE health-watch cron (5 min) ────────────────────────────
# This cron runs ONLY the read-only-ish health watch. It NEVER schedules a
# self-construction cron job or any file-mutating job.
HEALTH_WATCH="$DEPLOY_LINK/scripts/unicorn-health-watch.sh"
if [ -f "$HEALTH_WATCH" ]; then
  chmod +x "$HEALTH_WATCH" 2>/dev/null || true
  if command -v crontab >/dev/null 2>&1; then
    CRON_LINE="*/5 * * * * BACKEND_PORT=$BACKEND_PORT SITE_PORT=$SITE_PORT PUBLIC_URL=$PUBLIC_URL DEPLOY_LINK=$DEPLOY_LINK bash $HEALTH_WATCH >/dev/null 2>&1"
    EXISTING="$(crontab -l 2>/dev/null || true)"
    if printf '%s\n' "$EXISTING" | grep -Fq "unicorn-health-watch.sh"; then
      log "health-watch cron already installed"
    else
      { printf '%s\n' "$EXISTING"; printf '%s\n' "$CRON_LINE"; } | grep -v '^$' | crontab -
      log "installed SAFE health-watch cron (every 5 min)"
    fi
  else
    warn "crontab not available — skipping health-watch cron install"
  fi
else
  warn "health-watch script not found at $HEALTH_WATCH — skipping cron install"
fi

# ── 7. Health checks (retry — backend needs a few seconds after PM2 reload) ──
HEALTH_OK=0
check_health_once() {
  local url="$1"
  curl -fsS --max-time 8 "$url" >/dev/null 2>&1
}
for attempt in 1 2 3 4 5 6 8 10 12; do
  if check_health_once "http://127.0.0.1:${BACKEND_PORT}/api/health" \
    && check_health_once "http://127.0.0.1:${SITE_PORT}/health"; then
    HEALTH_OK=1
    log "health OK: backend+site (attempt ${attempt})"
    break
  fi
  warn "health warming… attempt ${attempt}"
  sleep 5
done
if [ "$HEALTH_OK" != "1" ]; then
  warn "health FAIL: backend (http://127.0.0.1:${BACKEND_PORT}/api/health)"
  warn "health FAIL: site (http://127.0.0.1:${SITE_PORT}/health)"
fi
# Public health is best-effort — a network/DNS blip should not by itself fail
# activation when both local services are healthy.
if curl -fsS --max-time 10 "${PUBLIC_URL%/}/health" >/dev/null 2>&1; then
  log "health OK: public (${PUBLIC_URL%/}/health)"
else
  warn "health check for public URL failed (non-fatal): ${PUBLIC_URL%/}/health"
fi

# ── 8. Report PM2 topology ───────────────────────────────────────────────────
log "PM2 process list:"
pm2 list || true

if [ "$HEALTH_OK" != "1" ]; then
  fail "local health checks failed — see WARN lines above"
fi
log "SAFE full-autonomy activation complete"
exit 0
