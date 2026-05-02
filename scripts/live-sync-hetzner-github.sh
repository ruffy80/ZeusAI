#!/bin/zsh
set -euo pipefail

# 30Y-LTS — ensure PATH includes Node/npm/npx so husky pre-commit hooks work
# even when the daemon is launched from a minimal launchd / cron environment.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

REPO_DIR="/Users/ionutvladoi/Desktop/generate-unicorn"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/live-sync-hetzner-github.log"
PID_FILE="$LOG_DIR/live-sync-hetzner-github.pid"

BRANCH="${AUTO_SYNC_BRANCH:-main}"
INTERVAL="${AUTO_SYNC_INTERVAL:-60}"
SYNC_HOST="${AUTO_SYNC_HOST:-zeusai}"
REMOTE_APP_DIR="${AUTO_SYNC_REMOTE_APP_DIR:-/var/www/unicorn/UNICORN_FINAL}"
PM2_APPS="${AUTO_SYNC_PM2_APPS:-unicorn-site unicorn-backend}"
SYNC_SCOPE=(
  "UNICORN_FINAL"
  "scripts/live-sync-hetzner-github.sh"
  "scripts/start-live-sync-hetzner-github.sh"
  "scripts/stop-live-sync-hetzner-github.sh"
  "scripts/backup-secrets.sh"
  "scripts/ssh-zeusai.sh"
)

mkdir -p "$LOG_DIR"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

sync_server() {
  local changed="$1"
  log "Deploying UNICORN_FINAL to $SYNC_HOST:$REMOTE_APP_DIR"
  # 30Y-LTS — write a stable .build-sha file before rsync so the deployed
  # server (which has no .git tree) can show a real short SHA in
  # /status, X-Zeus-Build header and the on-page build badge.
  local short_sha
  short_sha="$(git -C "$REPO_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  echo "$short_sha" > "$REPO_DIR/UNICORN_FINAL/.build-sha"
  rsync -az --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'logs/' \
    --exclude 'data/' \
    --exclude '.env' \
    --exclude '.env.*' \
    "$REPO_DIR/UNICORN_FINAL/" "$SYNC_HOST:$REMOTE_APP_DIR/" >> "$LOG_FILE" 2>&1

  local remote_cmd="cd '$REMOTE_APP_DIR'"
  if echo "$changed" | grep -Eq '^UNICORN_FINAL/package(-lock)?\.json$'; then
    remote_cmd+=" && npm install --omit=dev >> '$REMOTE_APP_DIR/logs/live-sync-npm.log' 2>&1"
  fi
  if echo "$changed" | grep -Eq '^UNICORN_FINAL/(src|backend)/|^UNICORN_FINAL/(ecosystem\.config\.js|package(-lock)?\.json)$'; then
    remote_cmd+=" && pm2 restart $PM2_APPS --update-env"
  fi
  ssh "$SYNC_HOST" "$remote_cmd" >> "$LOG_FILE" 2>&1
  log "Server sync complete"
}

cd "$REPO_DIR"

log "Live sync started (branch=$BRANCH, interval=${INTERVAL}s, host=$SYNC_HOST, remote=$REMOTE_APP_DIR)"

while true; do
  local_status="$(git status --porcelain --untracked-files=all -- ${SYNC_SCOPE[@]} || true)"
  if [[ -n "$local_status" ]]; then
    log "Changes detected in sync scope"
    git add -- ${SYNC_SCOPE[@]} >> "$LOG_FILE" 2>&1 || true

    if git diff --cached --quiet; then
      log "Nothing staged after add"
    else
      git commit -m "live-sync: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE" 2>&1
      if ! git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
        log "Fetch failed; will retry"
        sleep "$INTERVAL"
        continue
      fi
      if ! git rebase "origin/$BRANCH" >> "$LOG_FILE" 2>&1; then
        log "Rebase failed; aborting rebase and retrying later"
        git rebase --abort >> "$LOG_FILE" 2>&1 || true
        sleep "$INTERVAL"
        continue
      fi
      if ! git push origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
        log "Push failed after rebase; will retry"
        sleep "$INTERVAL"
        continue
      fi
      changed_files="$(git diff-tree --no-commit-id --name-only -r HEAD -- ${SYNC_SCOPE[@]} || true)"
      if echo "$changed_files" | grep -q '^UNICORN_FINAL/'; then
        sync_server "$changed_files"
      else
        log "GitHub push complete (no server deploy needed)"
      fi
    fi
  fi

  sleep "$INTERVAL"
done