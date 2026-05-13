#!/usr/bin/env bash
set -uo pipefail
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/unicorn/UNICORN_FINAL}"
cd "$DEPLOY_PATH" || exit 0
node scripts/unicorn-payment-monitor.js >> /var/log/unicorn-transactions.log 2>&1 || true