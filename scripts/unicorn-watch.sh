#!/usr/bin/env bash
# unicorn-watch.sh — auto-sync on every file change in UNICORN_FINAL/
# Requires: brew install fswatch
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "fswatch not installed. Run: brew install fswatch" >&2
  exit 1
fi

echo "Watching ${REPO_ROOT}/UNICORN_FINAL/ ... (Ctrl+C to stop)"
fswatch -o -l 1.5 \
  --exclude '/\.git/' \
  --exclude '/node_modules/' \
  --exclude '/data/' \
  --exclude '/db/' \
  --exclude '/backups/' \
  --exclude '/logs/' \
  --exclude '\.log$' \
  --exclude '\.DS_Store$' \
  "${REPO_ROOT}/UNICORN_FINAL" | while read -r _; do
    echo "[$(date +%H:%M:%S)] change detected → syncing"
    "${REPO_ROOT}/scripts/unicorn-sync.sh" --no-commit || echo "[warn] sync failed"
  done
