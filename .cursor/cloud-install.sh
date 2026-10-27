#!/usr/bin/env bash
# Baked into the Cloud Agent environment snapshot. Must exit.
# Dependencies only. Secrets and servers belong in cloud-start.sh.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "[cursor-env] node and npm are required on PATH" >&2
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 22 ] || [ "$node_major" -ge 26 ]; then
  echo "[cursor-env] Node $(node -v) is outside engines >=22 <26" >&2
  exit 1
fi

if ! command -v make >/dev/null 2>&1 || ! command -v g++ >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends python3 make g++
  sudo rm -rf /var/lib/apt/lists/*
fi

cd "$root/UNICORN_FINAL"
npm ci --no-audit --no-fund
node -e "require('express'); require('better-sqlite3'); console.log('[cursor-env] npm ci ok', process.version)"
