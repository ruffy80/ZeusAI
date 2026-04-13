#!/usr/bin/env bash
# ============================================
# Unicorn – Deploy complet pe Hetzner
# zeusai.pro – /var/www/unicorn
# ============================================

set -e

REPO_DIR="/var/www/unicorn"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/client"
BRANCH="main"

echo "=== [1] Merg în repo: $REPO_DIR"
cd "$REPO_DIR"

echo "=== [2] Reset + pull din GitHub ($BRANCH)"
git fetch origin
git reset --hard origin/$BRANCH
git clean -fd

echo "=== [3] Backend – npm install + build (dacă e cazul)"
cd "$BACKEND_DIR"
npm install
if [ -f "build.sh" ]; then
  bash build.sh
fi

echo "=== [4] Frontend – npm install + build"
cd "$FRONTEND_DIR"
npm install
CI=false npm run build

echo "=== [5] Verific PM2 – pornesc / repornesc backend-ul Unicorn"
cd "$REPO_DIR"
if pm2 list | grep -q "unicorn"; then
  echo "=== PM2: restart unicorn via ecosystem"
  pm2 startOrRestart ecosystem.config.js
else
  echo "=== PM2: start unicorn via ecosystem"
  pm2 start ecosystem.config.js
fi

echo "=== [6] Salvez starea PM2 și mă asigur că pornește la boot"
pm2 save
pm2 startup -u "$USER" --hp "$HOME"

echo "=== [7] Verific Nginx config și reîncarc"
sudo nginx -t
sudo systemctl reload nginx

echo "=== [8] Health check backend"
curl -f http://localhost:3000/api/health || echo "ATENȚIE: /api/health nu a răspuns OK"

echo "=== [9] Health check HTTPS extern"
curl -I https://zeusai.pro || echo "ATENȚIE: HTTPS zeusai.pro nu a răspuns OK"

echo "=== [10] Deploy Unicorn FINALIZAT."
