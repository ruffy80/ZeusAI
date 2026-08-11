#!/usr/bin/env bash
# install-phoenix-continuity.sh — arm PCOS/1.0 on the live Hetzner box.
# Idempotent. Safe to re-run. Does NOT require a full atomic deploy.
set -euo pipefail

APP_DIR=""
for candidate in \
  /var/www/unicorn/current \
  /var/www/unicorn/current/UNICORN_FINAL \
  /var/www/unicorn/UNICORN_FINAL
do
  if [ -f "$candidate/backend/phoenix-edge.js" ] || [ -f "$candidate/ecosystem.config.js" ]; then
    APP_DIR="$(readlink -f "$candidate" 2>/dev/null || echo "$candidate")"
    break
  fi
done
[ -n "$APP_DIR" ] || { echo "[phoenix-install] FATAL: app dir missing"; exit 1; }
cd "$APP_DIR"
echo "[phoenix-install] APP_DIR=$APP_DIR"

# 1) PM2: start immortality edge (never blocks on brain)
export UNICORN_PHOENIX=1
export DISABLE_SELF_MUTATION=1
export UNICORN_RUNTIME_PROFILE="${UNICORN_RUNTIME_PROFILE:-stable}"
pm2 startOrRestart ecosystem.config.js --only unicorn-phoenix --update-env || \
  pm2 start ecosystem.config.js --only unicorn-phoenix --update-env
# Ensure brain+site still present
pm2 startOrRestart ecosystem.config.js --only unicorn-backend,unicorn-site --update-env || true
pm2 save || true

# 2) nginx snippet
mkdir -p /etc/nginx/snippets
cp -f "$APP_DIR/scripts/nginx-phoenix.snippet.conf" /etc/nginx/snippets/zeus-phoenix.conf
CONF=""
for c in /etc/nginx/sites-enabled/zeusai.conf /etc/nginx/sites-available/zeusai.conf; do
  [ -f "$c" ] && CONF="$c" && break
done
if [ -n "$CONF" ] && ! grep -q 'zeus-phoenix.conf' "$CONF"; then
  # Insert include just before the generic location ^~ /api/ block
  if grep -q 'location \^~ /api/' "$CONF"; then
    python3 - <<PY
from pathlib import Path
p = Path("$CONF")
t = p.read_text(encoding="utf-8", errors="replace")
needle = "location ^~ /api/"
inc = "    # Phoenix Continuity OS — immortality + LKG commerce\n    include /etc/nginx/snippets/zeus-phoenix.conf;\n\n    "
idx = t.find(needle)
if idx >= 0 and "zeus-phoenix.conf" not in t:
    # find start of line
    line_start = t.rfind("\n", 0, idx) + 1
    t = t[:line_start] + inc + t[line_start:]
    p.write_text(t, encoding="utf-8")
    print("[phoenix-install] nginx include inserted into", p)
else:
    print("[phoenix-install] nginx include skipped (already present or needle missing)")
PY
  else
    echo "[phoenix-install] WARN: generic /api/ location not found — snippet installed, wire manually"
  fi
fi

if nginx -t 2>/dev/null; then
  systemctl reload nginx || systemctl restart nginx || true
  echo "[phoenix-install] nginx reloaded"
else
  echo "[phoenix-install] WARN: nginx -t failed — left config untouched beyond snippet copy"
fi

# 3) Wait for phoenix live
ok=0
for i in $(seq 1 20); do
  if curl -fsS --max-time 2 http://127.0.0.1:3002/phoenix/live >/dev/null 2>&1; then
    ok=1; break
  fi
  sleep 1
done
[ "$ok" = "1" ] || { echo "[phoenix-install] WARN: phoenix not answering yet"; }

# 4) Re-arm autodeploy (sovereign auto-push path) when phoenix is up
rm -f /etc/zeus-autodeploy.disabled
systemctl enable --now zeus-autodeploy.timer 2>/dev/null || true
systemctl start zeus-autodeploy.timer 2>/dev/null || true

echo "[phoenix-install] done"
curl -sS --max-time 3 http://127.0.0.1:3002/phoenix/status | head -c 400; echo
pm2 list || true
