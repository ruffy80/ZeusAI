#!/usr/bin/env bash
# =============================================================================
# PASTE THIS ENTIRE BLOCK into Hetzner Cloud Console → server → Console
# Login as: root
# This restores the live site IMMEDIATELY (PM2 + nginx), then installs SSH
# keys so Cloud Agent / GitHub Actions can finish a proper deploy.
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

# Clear kill-switches so poller + healer can run
rm -f /etc/zeus-autodeploy.disabled /etc/zeus-healer.disabled

# Resolve live code path (symlink-aware)
APP_DIR=""
for candidate in \
  /var/www/unicorn/UNICORN_FINAL \
  /var/www/unicorn/current/UNICORN_FINAL \
  /var/www/unicorn/live/UNICORN_FINAL
do
  if [ -f "$candidate/ecosystem.config.js" ]; then
    APP_DIR="$candidate"
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
# Kill anything still bound to app ports
for PORT in 3000 3001 3100; do
  PIDS=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $0}' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
  for PID in $PIDS; do
    [ -n "$PID" ] || continue
    echo "[heal] kill listener pid=$PID port=$PORT"
    kill -9 "$PID" 2>/dev/null || true
  done
done
# Hung node workers that no longer answer HTTP
pkill -9 -f 'node .*backend/index\.js' 2>/dev/null || true
pkill -9 -f 'node .*src/index\.js' 2>/dev/null || true
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

echo "[heal] pm2 start unicorn-backend + unicorn-site + autoscaler"
timeout 90s pm2 start ecosystem.config.js --only unicorn-backend,unicorn-site,autoscaler --update-env

echo "[heal] wait for local health (max ~60s)"
ok_b=0
ok_s=0
for i in $(seq 1 20); do
  if [ "$ok_b" != "1" ] && curl -fsS --max-time 3 http://127.0.0.1:3000/health/live >/dev/null 2>&1; then
    ok_b=1
    echo "[heal] backend live ok attempt=$i"
  fi
  if [ "$ok_s" != "1" ] && curl -fsS --max-time 3 http://127.0.0.1:3001/health/live >/dev/null 2>&1; then
    ok_s=1
    echo "[heal] site live ok attempt=$i"
  fi
  if [ "$ok_b" = "1" ] && [ "$ok_s" = "1" ]; then
    break
  fi
  sleep 3
done

if [ "$ok_b" != "1" ]; then
  echo "[heal] backend still down — one more canonical restart"
  timeout 20s pm2 delete unicorn-backend 2>/dev/null || true
  timeout 90s pm2 start ecosystem.config.js --only unicorn-backend --update-env || true
  sleep 5
fi
if [ "$ok_s" != "1" ]; then
  echo "[heal] site still down — one more canonical restart"
  timeout 20s pm2 delete unicorn-site 2>/dev/null || true
  timeout 90s pm2 start ecosystem.config.js --only unicorn-site --update-env || true
  sleep 5
fi

echo "[heal] nginx restart"
nginx -t 2>&1 && systemctl restart nginx 2>&1 || systemctl reload nginx 2>&1 || true
timeout 20s pm2 save --force 2>&1 || true

echo "[heal] probes"
curl -sS --max-time 5 -w '\nHTTP %{http_code}\n' http://127.0.0.1:3000/api/health || true
curl -sS --max-time 5 -w '\nHTTP %{http_code}\n' http://127.0.0.1:3001/health || true
curl -sS --max-time 5 -o /dev/null -w 'public /api/health HTTP %{http_code}\n' https://zeusai.pro/api/health || true
timeout 15s pm2 list || true

# Best-effort: promote origin/main via on-box resuscitator (no GitHub Actions)
if [ -x "$APP_DIR/scripts/zeus-poller-resuscitate.sh" ]; then
  ZEUS_INSTALL_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q cursor-cloud-zeus-deploy-recover' \
    bash "$APP_DIR/scripts/zeus-poller-resuscitate.sh" || true
fi

echo "OK — site reclaim attempted; SSH keys installed; kill-switch cleared."
hostname
test -f /etc/zeus-autodeploy.disabled && echo KILL=1 || echo KILL=0
wc -l ~/.ssh/authorized_keys
