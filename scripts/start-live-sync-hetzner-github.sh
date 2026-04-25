#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/ionutvladoi/Desktop/generate-unicorn"
LOG_DIR="$REPO_DIR/logs"
PID_FILE="$LOG_DIR/live-sync-hetzner-github.pid"
LOG_FILE="$LOG_DIR/live-sync-hetzner-github.log"
SCRIPT="$REPO_DIR/scripts/live-sync-hetzner-github.sh"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Live sync already running with PID $(cat "$PID_FILE")"
  exit 0
fi

nohup "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Live sync started with PID $!"