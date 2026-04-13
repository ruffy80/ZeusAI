#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/root/unicorn-final}"
BACKUP_DIR="${APP_DIR}/backups"
TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/unicorn-backup-${TS}.tar.gz"

mkdir -p "${BACKUP_DIR}"

tar -czf "${ARCHIVE}" \
  -C "${APP_DIR}" \
  --exclude='./node_modules' \
  --exclude='./logs' \
  --exclude='./backups' \
  --exclude='./.env' \
  .

# keep last 5 backups
ls -1t "${BACKUP_DIR}"/unicorn-backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

echo "Backup created: ${ARCHIVE}"
