#!/usr/bin/env bash
# =============================================================================
# PASTE THIS ENTIRE BLOCK into Hetzner Cloud Console → server → Console
# Login as: root
# Offline-first: NO curl/wget network fetches. Hardcoded SSH pubkeys only.
# Restores PM2 (phoenix + backend + site) + nginx, clears kill-switches.
# =============================================================================
set -euo pipefail

mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

install_pub() {
  local line="$1"
  local body
  body=$(printf '%s' "$line" | awk '{print $1" "$2}')
  [ -n "$body" ] || return 0
  grep -Fq "$body" ~/.ssh/authorized_keys 2>/dev/null || printf '%s\n' "$line" >> ~/.ssh/authorized_keys
}

# Cloud Agent recover key (matches Cursor secret HETZNER_SSH_PRIVATE_KEY on this run)
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q cursor-cloud-zeus-deploy-recover'
# Ephemeral agent key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIq+uCeIYtCITbLBmKTtELMMlggITZPAkxVdbp51y4PW zeus-cloud-agent-ephemeral'
# Host agent key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPqiJsBjAsv4KymedFcUR891X1lgC90DW8yMtjcHJ/p0 cursor-cloud-agent'
# Historical working Cloud Agent file key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC3ls7I4Y9XlmpIBjCF30qpQt2z89FYIPhg+gzhsYGM5 cursor-cloud-zeus-deploy'
# c3b6 activation key
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHA7c/ZKX3ZBpNC9vmgiUcKMhogxZFw6Hfg5LhH6QTm0 cursor-cloud-zeus-deploy-c3b6'
# This cloud-agent run pubkey
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIx+nov7zRmJAwDVh1p/0PACreFp2Hh4s13hKGOqS/c3 cursor-cloud-zeus-deploy-0854'
# MacBook ED25519 (ionutvladoi)
install_pub 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKM/g65kFDsOTtWH6nb9cjmhXvqN00JHRu2qLqqOf9ab ionutvladoi@MacBook-Air-Ionut.local'

# Clear kill-switches so poller + healer can run
rm -f /etc/zeus-autodeploy.disabled /etc/zeus-healer.disabled /etc/zeus-hang-watchdog.disabled

# Offline HTTP probe via bash /dev/tcp (no curl dependency)
http_probe() {
  # usage: http_probe HOST PORT PATH  → exit 0 if HTTP response bytes arrive
  local host="$1" port="$2" path="$3"
  local resp
  resp=$(timeout 3 bash -c "exec 3<>/dev/tcp/${host}/${port} && printf 'GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n' '${path}' '${host}' >&3 && head -c 64 <&3" 2>/dev/null || true)
  case "$resp" in
    HTTP/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Resolve live code path (symlink-aware) — include /var/www/unicorn/current
APP_DIR=""
for candidate in \
  /var/www/unicorn/current \
  /var/www/unicorn/current/UNICORN_FINAL \
  /var/www/unicorn/UNICORN_FINAL \
  /var/www/unicorn/live/UNICORN_FINAL
do
  if [ -f "$candidate/ecosystem.config.js" ]; then
    APP_DIR="$(readlink -f "$candidate" 2>/dev/null || echo "$candidate")"
    break
  fi
done
if [ -z "$APP_DIR" ]; then
  echo "FATAL: ecosystem.config.js not found under /var/www/unicorn"
  ls -la /var/www/unicorn 2>/dev/null || true
  exit 1
fi
echo "[heal] APP_DIR=$APP_DIR"
cd "$APP_DIR"

echo "[heal] nuclear PM2 reclaim"
timeout 15s pm2 stop all 2>/dev/null || true
timeout 15s pm2 delete all 2>/dev/null || true
timeout 10s pm2 kill 2>/dev/null || true
pkill -9 -f 'PM2 v.*God Daemon' 2>/dev/null || true
pkill -9 -f 'rescue-backend\.js' 2>/dev/null || true
for PORT in 3000 3001 3002 3100; do
  PIDS=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $0}' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
  for PID in $PIDS; do
    [ -n "$PID" ] || continue
    echo "[heal] kill listener pid=$PID port=$PORT"
    kill -9 "$PID" 2>/dev/null || true
  done
done
pkill -9 -f 'node .*backend/index\.js' 2>/dev/null || true
pkill -9 -f 'node .*src/index\.js' 2>/dev/null || true
pkill -9 -f 'node .*phoenix-edge\.js' 2>/dev/null || true
rm -f /root/.pm2/dump.pm2 /root/.pm2/dump.pm2.bak /root/.pm2/rpc.sock /root/.pm2/pub.sock /root/.pm2/pm2.pid 2>/dev/null || true
rm -rf /root/.pm2/pids/* 2>/dev/null || true
sleep 2

export NODE_ENV=production
export BIND_HOST=127.0.0.1
export UNICORN_RUNTIME_PROFILE=stable
export DISABLE_SELF_MUTATION=1
export QIS_AUTO_HEAL_ENABLED=false
export SITE_INSTANCES="${SITE_INSTANCES:-1}"
export UNICORN_INSTANCES="${UNICORN_INSTANCES:-1}"
export UNICORN_GUARDIAN=0
export UNICORN_PHOENIX=1
export AUTOSCALE_DISABLED=1

echo "[heal] pm2 start phoenix + backend + site (canonical)"
# Phoenix FIRST — immortality edge answers even while brain boots
if [ -f "$APP_DIR/backend/phoenix-edge.js" ]; then
  timeout 60s pm2 start ecosystem.config.js --only unicorn-phoenix --update-env || true
fi
timeout 90s pm2 start ecosystem.config.js --only unicorn-backend,unicorn-site --update-env
# Never resurrect retired side-cars
for a in autoscaler module-mesh-guardian unicorn-live-sync unicorn-guardian; do
  timeout 10s pm2 delete "$a" 2>/dev/null || true
done

echo "[heal] wait for local health (max ~90s) via /dev/tcp (no curl)"
ok_p=0
ok_b=0
ok_s=0
for i in $(seq 1 30); do
  if [ "$ok_p" != "1" ] && http_probe 127.0.0.1 3002 /phoenix/live; then
    ok_p=1
    echo "[heal] phoenix live ok attempt=$i"
  fi
  if [ "$ok_b" != "1" ] && http_probe 127.0.0.1 3000 /health/live; then
    ok_b=1
    echo "[heal] backend live ok attempt=$i"
  fi
  if [ "$ok_s" != "1" ] && http_probe 127.0.0.1 3001 /health; then
    ok_s=1
    echo "[heal] site live ok attempt=$i"
  fi
  # Phoenix alone is enough to keep commerce surfaces answering; prefer all three.
  if [ "$ok_b" = "1" ] && [ "$ok_s" = "1" ]; then
    break
  fi
  sleep 3
done

if [ "$ok_b" != "1" ]; then
  echo "[heal] backend still down — SIGKILL + recreate"
  timeout 20s pm2 delete unicorn-backend 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  timeout 90s pm2 start ecosystem.config.js --only unicorn-backend --update-env || true
  sleep 5
fi
if [ "$ok_s" != "1" ]; then
  echo "[heal] site still down — recreate"
  timeout 20s pm2 delete unicorn-site 2>/dev/null || true
  timeout 90s pm2 start ecosystem.config.js --only unicorn-site --update-env || true
  sleep 5
fi
if [ "$ok_p" != "1" ] && [ -f "$APP_DIR/backend/phoenix-edge.js" ]; then
  echo "[heal] phoenix missing — recreate"
  timeout 60s pm2 start ecosystem.config.js --only unicorn-phoenix --update-env || true
fi

echo "[heal] nginx restart"
nginx -t 2>&1 && systemctl restart nginx 2>&1 || systemctl reload nginx 2>&1 || true
timeout 20s pm2 save --force 2>&1 || true

# Arm phoenix nginx + autodeploy when installer present (local script, no network)
if [ -x "$APP_DIR/scripts/install-phoenix-continuity.sh" ]; then
  bash "$APP_DIR/scripts/install-phoenix-continuity.sh" 2>&1 | tail -30 || true
fi

echo "[heal] probes (/dev/tcp)"
http_probe 127.0.0.1 3002 /phoenix/live && echo "phoenix HTTP ok" || echo "phoenix HTTP fail"
http_probe 127.0.0.1 3000 /health/live && echo "backend HTTP ok" || echo "backend HTTP fail"
http_probe 127.0.0.1 3001 /health && echo "site HTTP ok" || echo "site HTTP fail"
timeout 15s pm2 list || true

# Best-effort: promote origin/main via on-box resuscitator (uses git; optional)
if [ -x "$APP_DIR/scripts/zeus-poller-resuscitate.sh" ]; then
  ZEUS_INSTALL_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q cursor-cloud-zeus-deploy-recover' \
    bash "$APP_DIR/scripts/zeus-poller-resuscitate.sh" || true
fi

echo "OK — site reclaim attempted; SSH keys installed; kill-switch cleared."
hostname
test -f /etc/zeus-autodeploy.disabled && echo KILL=1 || echo KILL=0
wc -l ~/.ssh/authorized_keys
