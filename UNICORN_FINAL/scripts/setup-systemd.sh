#!/usr/bin/env bash
# ============================================================
# UNICORN — Setup systemd service for permanent auto-boot
# on Hetzner (Ubuntu/Debian).
#
# Usage:  bash scripts/setup-systemd.sh [DEPLOY_PATH]
#
# This script:
#   1. Creates /etc/systemd/system/unicorn.service (starts PM2)
#   2. Enables the service to start on boot
#   3. Starts it immediately if not already running
# ============================================================
set -euo pipefail

DEPLOY_PATH="${1:-/root/unicorn-final}"
SERVICE_NAME="unicorn"
RUN_USER="${SUDO_USER:-root}"
RUN_HOME="$(eval echo ~$RUN_USER)"

# ── Resolve Node.js binary (supports NVM and system-wide installs) ─────────
_find_node_bin() {
  for candidate in \
    "$(command -v node 2>/dev/null || true)" \
    /usr/local/bin/node \
    /usr/bin/node \
    "${RUN_HOME}/.nvm/versions/node/"*/bin/node \
    /root/.nvm/versions/node/*/bin/node; do
    # shellcheck disable=SC2086
    candidate=$(ls -1 $candidate 2>/dev/null | sort -V | tail -1 || true)
    [ -x "$candidate" ] 2>/dev/null && echo "$candidate" && return
  done
  echo ""
}

NODE_BIN="$(_find_node_bin)"
if [ -z "$NODE_BIN" ]; then
  echo "❌ Node.js not found — install it first." >&2
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="${NODE_DIR}:${PATH}"

PM2_BIN="$(command -v pm2 2>/dev/null || echo "${NODE_DIR}/pm2")"

echo "⚙️  Setting up systemd service for UNICORN"
echo "   Deploy path : $DEPLOY_PATH"
echo "   PM2 binary  : $PM2_BIN"
echo "   Node binary : $NODE_BIN"
echo "   Run as user : $RUN_USER"
echo "   Home        : $RUN_HOME"

# ── Install PM2 if not present ────────────────────────────────────────────────
if ! "$PM2_BIN" --version >/dev/null 2>&1; then
  echo "📦 Installing PM2 globally..."
  "${NODE_DIR}/npm" install -g pm2
  PM2_BIN="$(command -v pm2 2>/dev/null || "${NODE_DIR}/pm2")"
fi

# ── Ensure logs directory exists ──────────────────────────────────────────────
mkdir -p "$DEPLOY_PATH/logs"

# ── Start all PM2 apps from ecosystem config ──────────────────────────────────
echo "🚀 Starting all PM2 apps from ecosystem.config.js..."
cd "$DEPLOY_PATH"
# Safe start: start/update ecosystem without wiping PM2 process table
"$PM2_BIN" startOrRestart ecosystem.config.js
"$PM2_BIN" save

# ── Generate systemd unit via pm2 startup ─────────────────────────────────────
echo "🔧 Configuring PM2 to start on system boot..."
STARTUP_CMD=$("$PM2_BIN" startup systemd -u "$RUN_USER" --hp "$RUN_HOME" | \
  grep -E "^sudo |^env " | head -1 || true)

if [ -n "$STARTUP_CMD" ]; then
  echo "   Running: $STARTUP_CMD"
  eval "$STARTUP_CMD"
else
  # Fallback: write the unit file directly
  PM2_HOME="${RUN_HOME}/.pm2"
  cat > /etc/systemd/system/pm2-${RUN_USER}.service <<EOF
[Unit]
Description=PM2 process manager for user ${RUN_USER}
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=${RUN_USER}
LimitNOFILE=infinity
LimitCORE=infinity
Environment=PATH=${NODE_BIN%/node}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PM2_HOME=${PM2_HOME}
PIDFile=${PM2_HOME}/pm2.pid
Restart=on-failure
ExecStart=${PM2_BIN} resurrect
ExecReload=${PM2_BIN} reload all
ExecStop=${PM2_BIN} kill

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable pm2-${RUN_USER}.service
  echo "✅ PM2 systemd service installed as pm2-${RUN_USER}.service"
fi

# ── Write a dedicated unicorn.service as secondary safeguard ─────────────────
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Unicorn Autonomous Platform — direct start fallback
After=network.target pm2-${RUN_USER}.service
Wants=pm2-${RUN_USER}.service

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${DEPLOY_PATH}
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=${NODE_BIN} backend/index.js
Restart=on-failure
RestartSec=5
StandardOutput=append:${DEPLOY_PATH}/logs/backend.log
StandardError=append:${DEPLOY_PATH}/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}.service
echo "✅ Fallback unicorn.service enabled"

# ── Start right now if not already running ────────────────────────────────────
if ! systemctl is-active --quiet ${SERVICE_NAME}.service 2>/dev/null; then
  echo "▶️  Starting unicorn.service..."
  systemctl start ${SERVICE_NAME}.service || true
fi

echo ""
echo "✅ Systemd setup complete!"
echo "   PM2 apps start on boot  : YES"
echo "   Fallback service enabled: ${SERVICE_NAME}.service"
echo ""
echo "Commands:"
echo "   systemctl status ${SERVICE_NAME}"
echo "   pm2 list"
echo "   pm2 logs"
