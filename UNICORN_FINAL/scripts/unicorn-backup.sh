#!/usr/bin/env bash
# unicorn-backup.sh — daily encrypted off-site backup of /var/www/unicorn/data
# RO+EN: rulează zilnic via cron, criptează cu age (dacă e disponibil), fallback gzip.
# Loads optional UNICORN_BACKUP_DEST_HOST (rsync over SSH) and UNICORN_BACKUP_AGE_PUB
# from environment. Designed to be safe to run unattended on PROD.
set -u
LOG=/var/log/unicorn-backup.log
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
SRC="${UNICORN_BACKUP_SRC:-/var/www/unicorn/data}"
LOCAL_DIR="${UNICORN_BACKUP_LOCAL_DIR:-/var/backups/unicorn}"
RETENTION_DAYS="${UNICORN_BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$LOCAL_DIR"

log(){ printf '{"t":"%s","lvl":"%s","msg":%s}\n' "$(date -u +%FT%TZ)" "$1" "$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"$2\"")" >> "$LOG"; }

if [ ! -d "$SRC" ]; then
  log error "source missing: $SRC"
  exit 0
fi

ARCHIVE="$LOCAL_DIR/unicorn-data-$TS.tar.gz"
tar -C "$(dirname "$SRC")" -czf "$ARCHIVE" "$(basename "$SRC")" 2>>"$LOG"
log info "archive_created size=$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE") path=$ARCHIVE"

# Optional encryption with age (https://age-encryption.org)
if command -v age >/dev/null 2>&1 && [ -n "${UNICORN_BACKUP_AGE_PUB:-}" ]; then
  ENC="$ARCHIVE.age"
  if printf '%s\n' "$UNICORN_BACKUP_AGE_PUB" | age -R - -o "$ENC" "$ARCHIVE" 2>>"$LOG"; then
    rm -f "$ARCHIVE"
    ARCHIVE="$ENC"
    log info "encrypted_with_age path=$ARCHIVE"
  else
    log warn "age_encryption_failed_keeping_plain_gzip"
  fi
fi

# Optional off-site push (Hetzner Storage Box / generic SSH target)
if [ -n "${UNICORN_BACKUP_DEST_HOST:-}" ] && [ -n "${UNICORN_BACKUP_DEST_PATH:-}" ]; then
  rsync -aq -e "ssh -o StrictHostKeyChecking=accept-new" "$ARCHIVE" "${UNICORN_BACKUP_DEST_USER:-root}@${UNICORN_BACKUP_DEST_HOST}:${UNICORN_BACKUP_DEST_PATH}/" 2>>"$LOG" \
    && log info "uploaded_to_remote dest=$UNICORN_BACKUP_DEST_HOST" \
    || log error "remote_upload_failed dest=$UNICORN_BACKUP_DEST_HOST"
fi

# Retention: prune local archives older than $RETENTION_DAYS days
find "$LOCAL_DIR" -type f -name 'unicorn-data-*.tar.gz*' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null
log info "retention_pruned days=$RETENTION_DAYS dir=$LOCAL_DIR"
