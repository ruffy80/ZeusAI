#!/usr/bin/env bash
# upgrade-node22-prod.sh — align Hetzner runtime with engines ">=22 <26" / .nvmrc 22.
# Safe-ish: installs Node 22 from NodeSource, rebuilds native modules, restarts PM2.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "must run as root" >&2
  exit 2
fi

CURRENT="$(node -v 2>/dev/null || echo none)"
echo "current node: $CURRENT"
MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [[ "$MAJOR" -ge 22 && "$MAJOR" -lt 26 ]]; then
  echo "already on Node $MAJOR — skip apt upgrade"
else
  echo "switching NodeSource → 22.x"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  # Non-interactive (no /dev/tty on SSH BatchMode / CI).
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  # Drop any stale Node 20 list remnants.
  rm -f /etc/apt/sources.list.d/nodesource.list.save 2>/dev/null || true
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

echo "node now: $(node -v)  npm: $(npm -v)"
MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$MAJOR" -lt 22 || "$MAJOR" -ge 26 ]]; then
  echo "ERROR: expected Node >=22 <26, got $(node -v)" >&2
  exit 1
fi

# Rebuild native addons in the live release + shared current symlink.
ROOT="$(readlink -f /var/www/unicorn/current 2>/dev/null || true)"
if [[ -z "$ROOT" || ! -d "$ROOT" ]]; then
  ROOT="/var/www/unicorn/UNICORN_FINAL"
fi
if [[ -d "$ROOT/node_modules/better-sqlite3" ]]; then
  echo "rebuild better-sqlite3 in $ROOT"
  (cd "$ROOT" && npm rebuild better-sqlite3 --foreground-scripts) || {
    echo "rebuild via npm rebuild failed — trying npm install better-sqlite3"
    (cd "$ROOT" && npm install better-sqlite3 --no-save --foreground-scripts)
  }
fi

# Point PM2 at the new node binary explicitly
NODE_BIN="$(command -v node)"
pm2 update || true
for app in unicorn-backend unicorn-site; do
  if pm2 describe "$app" >/dev/null 2>&1; then
    pm2 restart "$app" --update-env
  fi
done
pm2 save
echo "PM2 node versions:"
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{JSON.parse(d).forEach(p=>console.log(p.name,p.pm2_env&&p.pm2_env.node_version,p.pm2_env&&p.pm2_env.status))})'
echo "OK node22 upgrade complete"
