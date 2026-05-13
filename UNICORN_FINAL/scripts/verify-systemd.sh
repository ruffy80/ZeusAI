#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# SYSTEMD SERVICE VERIFICATION (zac.service)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SERVICE_FILE="./UNICORN_FINAL/deploy/zac.service"
REQUIRED_FIELDS=("ExecStart" "Restart=on-failure" "RestartSec=10")

echo "═══════════════════════════════════════════════════════════════"
echo "SYSTEMD SERVICE VERIFICATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ ! -f "$SERVICE_FILE" ]; then
  echo "Creating $SERVICE_FILE..."
  mkdir -p "$(dirname "$SERVICE_FILE")"
  cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Unicorn Autonomous Organism
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/unicorn/UNICORN_FINAL
ExecStart=/root/.nvm/versions/node/v20.11.0/bin/node /var/www/unicorn/UNICORN_FINAL/backend/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=unicorn
Environment="NODE_ENV=production"
Environment="BIND_HOST=127.0.0.1"

[Install]
WantedBy=multi-user.target
EOF
  echo "✓ Created $SERVICE_FILE"
else
  echo "✓ $SERVICE_FILE exists"
fi

echo ""
echo "Verifying required fields..."
PASS=0
FAIL=0

for field in "${REQUIRED_FIELDS[@]}"; do
  if grep -q "^$field" "$SERVICE_FILE"; then
    echo "✓ Found: $field"
    PASS=$((PASS + 1))
  else
    echo "✗ Missing: $field"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "File content:"
echo "───────────────────────────────────────────────────────────────"
cat "$SERVICE_FILE"
echo "───────────────────────────────────────────────────────────────"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✓ Systemd service file is valid"
  exit 0
else
  echo "✗ Systemd service file is missing required fields"
  exit 1
fi
