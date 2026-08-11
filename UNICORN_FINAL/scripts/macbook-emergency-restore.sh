#!/usr/bin/env bash
# macbook-emergency-restore.sh — one-shot live reclaim for zeusai.pro
#
# Run from the MacBook that already has `ssh zeusai` working:
#   bash UNICORN_FINAL/scripts/macbook-emergency-restore.sh
#
# Or: ssh zeusai 'bash -s' < UNICORN_FINAL/scripts/macbook-emergency-restore.sh
set -euo pipefail

REMOTE_HOST="${ZEUS_HOST:-${HETZNER_HOST:-204.168.230.142}}"
REMOTE_USER="${ZEUS_USER:-${HETZNER_DEPLOY_USER:-root}}"
SSH_TARGET="${SSH_TARGET:-${REMOTE_USER}@${REMOTE_HOST}}"

# Prefer alias `zeusai` when present in local ssh config.
if ssh -G zeusai >/dev/null 2>&1; then
  SSH_CMD=(ssh -o BatchMode=yes -o ConnectTimeout=15 zeusai)
else
  SSH_CMD=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$SSH_TARGET")
fi

echo "[restore] target via: ${SSH_CMD[*]}"
echo "[restore] public probe before:"
curl -sS -m 5 -o /dev/null -w '  https://zeusai.pro/health -> %{http_code} (%{time_total}s)\n' https://zeusai.pro/health || true

"${SSH_CMD[@]}" bash -s <<'SSHEOF'
set +e
rm -f /etc/zeus-autodeploy.disabled /etc/zeus-healer.disabled /etc/zeus-hang-watchdog.disabled

APP_DIR=""
for candidate in \
  /var/www/unicorn/current/UNICORN_FINAL \
  /var/www/unicorn/live/UNICORN_FINAL \
  /var/www/unicorn/UNICORN_FINAL
do
  if [ -f "$candidate/ecosystem.config.js" ]; then
    APP_DIR="$(readlink -f "$candidate" 2>/dev/null || echo "$candidate")"
    break
  fi
done
if [ -z "$APP_DIR" ]; then
  echo '[restore] FATAL: ecosystem.config.js missing'
  exit 1
fi
echo "[restore] APP_DIR=$APP_DIR HEAD=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
cd "$APP_DIR"

echo '[restore] hard reset PM2'
timeout 10s pm2 stop all 2>/dev/null || true
timeout 10s pm2 delete all 2>/dev/null || true
timeout 8s pm2 kill 2>/dev/null || true
pkill -9 -f 'PM2 v.*God Daemon' 2>/dev/null || true
pkill -9 -f 'rescue-backend\.js' 2>/dev/null || true
pkill -9 -f 'node .*backend/index\.js' 2>/dev/null || true
pkill -9 -f 'node .*src/index\.js' 2>/dev/null || true
rm -f /root/.pm2/dump.pm2 /root/.pm2/dump.pm2.bak /root/.pm2/rpc.sock /root/.pm2/pub.sock /root/.pm2/pm2.pid 2>/dev/null || true
rm -rf /root/.pm2/pids/* 2>/dev/null || true
for PORT in 3000 3001 3100; do
  PIDS=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $0}' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
  for PID in $PIDS; do
    [ -n "$PID" ] || continue
    echo "[restore] kill stale pid=$PID on :$PORT"
    kill -9 "$PID" 2>/dev/null || true
  done
done
sleep 2

export NODE_ENV=production
export BIND_HOST=127.0.0.1
export UNICORN_RUNTIME_PROFILE=stable
export DISABLE_SELF_MUTATION=1
export QIS_AUTO_HEAL_ENABLED=false
export SITE_INSTANCES="${SITE_INSTANCES:-1}"
export UNICORN_INSTANCES="${UNICORN_INSTANCES:-1}"
export UNICORN_GUARDIAN=0

echo '[restore] pm2 start canonical stack'
timeout 60s pm2 start ecosystem.config.js --only unicorn-backend,unicorn-site,autoscaler --update-env

wait_live() {
  local name="$1" url="$2" n="${3:-24}" d="${4:-4}"
  local i=1
  while [ "$i" -le "$n" ]; do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      echo "[restore] $name live ($i/$n)"
      return 0
    fi
    echo "[restore] waiting $name ($i/$n)"
    sleep "$d"
    i=$((i + 1))
  done
  echo "[restore] $name NOT live"
  return 1
}

BE=0; SITE=0
wait_live backend http://127.0.0.1:3000/health/live 24 4 && BE=1
wait_live site http://127.0.0.1:3001/health/live 12 3 && SITE=1

if [ "$BE" != "1" ]; then
  echo '[restore] backend stuck — SIGKILL + recreate'
  timeout 15s pm2 logs unicorn-backend --err --lines 80 --nostream 2>&1 | tail -100 || true
  PID=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const a=JSON.parse(s||"[]").find(x=>x&&x.name==="unicorn-backend");if(a&&a.pid)process.stdout.write(String(a.pid))}catch{}})' || true)
  [ -n "${PID:-}" ] && kill -9 "$PID" 2>/dev/null || true
  timeout 15s pm2 delete unicorn-backend 2>/dev/null || true
  for PORT in 3000; do
    PIDS=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $0}' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
    for P in $PIDS; do kill -9 "$P" 2>/dev/null || true; done
  done
  timeout 60s pm2 start ecosystem.config.js --only unicorn-backend --update-env
  wait_live backend http://127.0.0.1:3000/health/live 24 4 && BE=1
fi

if timeout 15s nginx -t 2>&1; then
  systemctl restart nginx 2>&1 || systemctl reload nginx 2>&1 || true
fi
timeout 15s pm2 save --force 2>&1 || true

# Arm hang watchdog if units exist
if [ -f "$APP_DIR/scripts/install-healer.sh" ]; then
  bash "$APP_DIR/scripts/install-healer.sh" 2>&1 | tail -40 || true
fi

echo '[restore] local health:'
curl -sS -m 5 http://127.0.0.1:3000/api/health | head -c 400; echo
curl -sS -m 5 http://127.0.0.1:3001/health | head -c 400; echo
timeout 15s pm2 list || true
echo "[restore] done backend_live=$BE site_live=$SITE"
[ "$BE" = "1" ] && [ "$SITE" = "1" ]
SSHEOF

echo "[restore] public probe after:"
curl -sS -m 8 -w '  https://zeusai.pro/health -> %{http_code} (%{time_total}s)\n' https://zeusai.pro/health | head -c 300; echo
curl -sS -m 8 -w '  https://zeusai.pro/api/health -> %{http_code} (%{time_total}s)\n' https://zeusai.pro/api/health | head -c 300; echo
echo '[restore] OK — if codes are not 200, paste pm2 logs from the SSH block above'
