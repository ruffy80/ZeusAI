#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/root/unicorn-final}"

if [[ "${ALLOW_MANUAL_DOWNGRADE:-}" != "I_UNDERSTAND_THIS_IS_A_DOWNGRADE" ]]; then
  echo "Rollback is disabled by the forward-only deploy contract."
  echo "Create a new forward-fix commit and deploy it through scripts/deploy-atomic-forward.sh instead."
  echo "If you are performing an audited disaster-recovery drill, set ALLOW_MANUAL_DOWNGRADE=I_UNDERSTAND_THIS_IS_A_DOWNGRADE explicitly."
  exit 2
fi

BACKUP_DIR="${APP_DIR}/backups"
LAST_BACKUP="$(ls -1t "${BACKUP_DIR}"/unicorn-backup-*.tar.gz 2>/dev/null | head -n 1 || true)"

if [[ -z "${LAST_BACKUP}" ]]; then
  echo "No backup found in ${BACKUP_DIR}"
  exit 1
fi

echo "Rolling back from: ${LAST_BACKUP}"

tar -xzf "${LAST_BACKUP}" -C "${APP_DIR}"

cd "${APP_DIR}"
npm install --no-audit --no-fund
if [[ -d client ]]; then
  cd client
  npm install --no-audit --no-fund
  npm run build
  cd ..
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart unicorn || true
fi
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart unicorn-orchestrator --update-env || true
  pm2 save || true
fi

echo "Rollback complete"
