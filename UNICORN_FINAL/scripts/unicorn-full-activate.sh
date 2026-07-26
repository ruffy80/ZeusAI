#!/usr/bin/env bash
# unicorn-full-activate.sh
# ---------------------------------------------------------------------------
# FULL autonomy activation for ZeusAI / Unicorn Platform on the Hetzner box.
#
# Dual architecture (both run together):
#   1. Modules load IN-PROCESS via backend/index.js + ecosystem.config.js
#      (`unicorn-backend`, `unicorn-site`) — the source of truth. Untouched.
#   2. Each ESSENTIAL module ALSO runs as a standalone autonomous PM2 process
#      (zeus-*) via scripts/zeus-module-autonomous.js. These runners drive the
#      module's heartbeat/tick loop only — they NEVER open a second Express
#      server and NEVER write SQLite. selfConstruction runs audit-only.
#
# It:
#   - ensures the owner's canonical path /root/ZeusAI/UNICORN_FINAL resolves
#   - turns business autonomy ON (growth profile, auto-repair, auto-restart)
#   - keeps source-file mutators OFF (prevents auto-generated stubs from
#     overwriting the real backend modules)
#   - reloads the two canonical PM2 apps with the safe env
#   - runs a read-only module audit (report only, never create stubs)
#   - starts the zeus-* autonomous PM2 runners (one per essential module)
#   - installs a read-only self-heal audit cron (15 min, audit-only)
#   - installs a SAFE health-watch cron (5 min)
#   - verifies backend + site + public health
#
# Idempotent and best-effort where noted. Exits non-zero on health failure.
# NEVER creates stub module source files.
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

# ── 0b. Ensure the owner's canonical path /root/ZeusAI/UNICORN_FINAL works ────
# The owner's prompts reference /root/ZeusAI; make that path resolve to the live
# deploy without moving anything. Best-effort (needs root); never fatal.
OWNER_ROOT="${OWNER_ROOT:-/root/ZeusAI}"
if mkdir -p "$OWNER_ROOT" 2>/dev/null; then
  if ln -sfn "$DEPLOY_LINK" "$OWNER_ROOT/UNICORN_FINAL" 2>/dev/null; then
    log "owner path ready: $OWNER_ROOT/UNICORN_FINAL -> $DEPLOY_LINK"
  else
    warn "could not create symlink $OWNER_ROOT/UNICORN_FINAL (non-fatal)"
  fi
else
  warn "could not create $OWNER_ROOT (non-root?) — skipping owner-path symlink"
fi

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
UNICORN_RUNTIME_PROFILE=stable
ENABLE_FILE_MUTATORS=0
ENABLE_SELF_CONSTRUCTION=0
DISABLE_SELF_MUTATION=1
ENABLE_AUTO_REPAIR=1
ENABLE_AUTO_DEPLOY=0
ENABLE_UI_AUTOBUILDER=0
ENABLE_CODE_OPTIMIZER=0
ENABLE_AUTO_EVOLVE=0
ENABLE_AUTO_RESTART=0
WATCHDOG_AUTOSTART=0
ZDT_ENABLED=0
TAOS_DISABLED=0
TOTAL_AUTONOMY_SAFE_ARM=1
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

# Single getUpdates owner: zeus-unicorn-bot (CVR + Profit Group OS + bind).
if [ -x "$DEPLOY_LINK/scripts/install-zeus-unicorn-bot.sh" ]; then
  log "ensure zeus-unicorn-bot (CVR + TPG)"
  UNICORN_LIVE="$DEPLOY_LINK" bash "$DEPLOY_LINK/scripts/install-zeus-unicorn-bot.sh" \
    || warn "unicorn-bot install non-fatal"
fi
if pm2 describe zeus-telegram-autobind >/dev/null 2>&1; then
  log "stopping zeus-telegram-autobind (avoid dual getUpdates)"
  pm2 stop zeus-telegram-autobind >/dev/null 2>&1 || true
  pm2 delete zeus-telegram-autobind >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

# ── 5. Read-only module audit (report only — NEVER create stubs) ─────────────
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
  ['marketAnalytics',         ['marketAnalytics']],
  ['totalAutonomyOs',         ['totalAutonomyOs']],
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

# ── 5b. Standalone zeus-* PM2 runners (OPT-IN) ───────────────────────────────
# Default OFF on single-node Hetzner: these runners + cold-boot backend compete
# for RAM/CPU and historically caused health timeouts → healer/rescue thrash.
# Enable explicitly with ZEUS_START_MODULE_RUNNERS=1 on multi-core hosts.
# In-process module routes (registerModuleRoutes) remain available either way.
RUNNER="$DEPLOY_LINK/scripts/zeus-module-autonomous.js"
if [ "${ZEUS_START_MODULE_RUNNERS:-0}" = "1" ] && [ -f "$RUNNER" ]; then
  start_runner() {
    local pm2name="$1"; local modfile="$2"
    if [ ! -f "$DEPLOY_LINK/$modfile" ]; then
      warn "module file missing, skipping $pm2name: $modfile"
      return 0
    fi
    pm2 delete "$pm2name" >/dev/null 2>&1 || true
    if pm2 start "$RUNNER" --name "$pm2name" --time -- "$modfile" --autonomous >/dev/null 2>&1; then
      log "started PM2 runner: $pm2name ($modfile)"
    else
      warn "failed to start PM2 runner: $pm2name ($modfile)"
    fi
  }

  start_runner zeus-payments   backend/modules/quantumPaymentNexus.js
  start_runner zeus-negotiator backend/modules/aiNegotiator.js
  start_runner zeus-selfheal   backend/modules/selfConstruction.js
  start_runner zeus-deploy     backend/modules/autoDeploy.js
  start_runner zeus-dns        backend/modules/domainAutomationManager.js
  start_runner zeus-analytics  backend/modules/marketAnalytics.js
  start_runner zeus-frontier   backend/modules/frontierAI.js

  pm2 save || true
else
  log "skipping zeus-* module runners (set ZEUS_START_MODULE_RUNNERS=1 to enable)"
  # Ensure leftovers from older activates do not thrash the next cold boot.
  for pm2name in zeus-payments zeus-negotiator zeus-selfheal zeus-deploy zeus-dns zeus-analytics zeus-frontier; do
    pm2 stop "$pm2name" >/dev/null 2>&1 || true
  done
fi

# ── 5c. Install the read-only self-heal audit cron (15 min) ──────────────────
# Runs selfConstruction.audit() ONLY (read-only). NEVER applies skeletons.
SELFHEAL_AUDIT="$DEPLOY_LINK/scripts/zeus-selfheal-audit.js"
if [ -f "$SELFHEAL_AUDIT" ] && command -v crontab >/dev/null 2>&1; then
  NODE_BIN="$(command -v node || echo node)"
  AUDIT_LOG="${AUDIT_LOG:-/var/log/zeus-selfheal-audit.log}"
  AUDIT_CRON="*/15 * * * * cd $DEPLOY_LINK && DISABLE_SELF_MUTATION=1 SELF_CONSTRUCTION_APPLY=0 $NODE_BIN $SELFHEAL_AUDIT >> $AUDIT_LOG 2>&1"
  EXISTING_AUDIT="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$EXISTING_AUDIT" | grep -Fq "zeus-selfheal-audit.js"; then
    log "self-heal audit cron already installed"
  else
    { printf '%s\n' "$EXISTING_AUDIT"; printf '%s\n' "$AUDIT_CRON"; } | grep -v '^$' | crontab -
    log "installed read-only self-heal audit cron (every 15 min)"
  fi
else
  warn "self-heal audit script or crontab unavailable — skipping audit cron"
fi

# ── 6. Install the SAFE health-watch cron (5 min) ────────────────────────────
# This cron runs ONLY the read-only-ish health watch. It NEVER schedules a
# self-construction cron job or any file-mutating job.
# Kill-switch: /etc/zeus-healer.disabled skips arming restart crons (OOB stabilize).
if [ -f /etc/zeus-healer.disabled ]; then
  log "healer kill-switch present — skipping health-watch cron install"
else
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
fi

# ── 6b. Forever-up (NDK) + autoheal-min — hang/disk aware, cooldown gated ──
# Kill-switch mirrors install-healer.sh: skip arming thrashy restart crons
# when /etc/zeus-healer.disabled is present (OOB / single-node stabilize).
if [ -f /etc/zeus-healer.disabled ]; then
  log "healer kill-switch present — skipping never-down/autoheal cron install"
  touch /var/run/unicorn-autoheal-min.disabled /var/run/zeus-never-down-watch.disabled 2>/dev/null || true
else
NDK_WATCH="$DEPLOY_LINK/scripts/never-down-watch.sh"
if [ -f "$NDK_WATCH" ] && command -v crontab >/dev/null 2>&1; then
  chmod +x "$NDK_WATCH" 2>/dev/null || true
  NDK_LINE="*/2 * * * * DEPLOY_LINK=$DEPLOY_LINK bash $NDK_WATCH >/dev/null 2>&1"
  EXISTING="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$EXISTING" | grep -Fq "never-down-watch.sh"; then
    log "never-down-watch cron already installed"
  else
    { printf '%s\n' "$EXISTING"; printf '%s\n' "$NDK_LINE"; } | grep -v '^$' | crontab -
    log "installed never-down-watch cron (every 2 min)"
  fi
fi
AUTOHEAL_MIN="$DEPLOY_LINK/scripts/autoheal-min.sh"
if [ -f "$AUTOHEAL_MIN" ] && command -v crontab >/dev/null 2>&1; then
  chmod +x "$AUTOHEAL_MIN" 2>/dev/null || true
  AH_LINE="* * * * * BACKEND_HEALTH_URL=http://127.0.0.1:${BACKEND_PORT}/api/health SITE_HEALTH_URL=http://127.0.0.1:${SITE_PORT}/health bash $AUTOHEAL_MIN >>/var/log/unicorn-autoheal-min.log 2>&1"
  EXISTING="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$EXISTING" | grep -Fq "autoheal-min.sh"; then
    log "autoheal-min cron already installed"
  else
    { printf '%s\n' "$EXISTING"; printf '%s\n' "$AH_LINE"; } | grep -v '^$' | crontab -
    log "installed autoheal-min cron (every 1 min, NDK-aware)"
  fi
fi
fi

# ── 6c. Orphan backend reaper (PPID=1 node backend/index.js suicide prevention) ──
REAPER="$DEPLOY_LINK/scripts/orphan-backend-reaper.sh"
if [ -f "$REAPER" ]; then
  chmod +x "$REAPER" 2>/dev/null || true
  log "orphan-backend-reaper (apply)"
  ORPHAN_REAPER_APPLY=1 bash "$REAPER" || warn "orphan-reaper non-fatal"
else
  warn "orphan-reaper missing at $REAPER"
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
log "zeus-* autonomous runners:"
pm2 list 2>/dev/null | grep -E 'zeus-(payments|negotiator|selfheal|deploy|dns|analytics|frontier)' || warn "no zeus-* runners visible in pm2 list"

if [ "$HEALTH_OK" != "1" ]; then
  fail "local health checks failed — see WARN lines above"
fi
log "SAFE full-autonomy activation complete"
exit 0
