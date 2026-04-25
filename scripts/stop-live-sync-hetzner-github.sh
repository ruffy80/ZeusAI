#!/bin/zsh
# 30Y-LTS — stop the live-sync daemon cleanly via PID file.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$REPO_DIR/logs/live-sync-hetzner-github.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file at $PID_FILE — daemon not running."
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  echo "PID file is empty; cleaning up."
  rm -f "$PID_FILE"
  exit 0
fi

if kill -0 "$PID" 2>/dev/null; then
  echo "Stopping live-sync daemon (PID=$PID)..."
  kill "$PID" 2>/dev/null || true
  for i in 1 2 3 4 5; do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if kill -0 "$PID" 2>/dev/null; then
    echo "Process still alive; sending SIGKILL."
    kill -9 "$PID" 2>/dev/null || true
  fi
  echo "Stopped."
else
  echo "PID $PID not running; cleaning stale file."
fi

rm -f "$PID_FILE"
