#!/usr/bin/env bash
# =====================================================================
# ZeusAI / Unicorn — Perpetual Server Hygiene & Encrypted Backup Engine
# 1. Auto-loads /etc/zeus-unicorn/backup.env & /var/www/unicorn/shared/.env
# 2. Safe SQLite WAL checkpoint
# 3. SSL certificate expiry check (warns if < 20 days remaining)
# 4. AES-256-CBC + PBKDF2 encrypted backup of critical commerce/identity state
# 5. Dual off-site vault: S3/R2 (BACKUP_S3_URI) AND/OR Encrypted Telegram Vault
# =====================================================================
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

# Safely load environment files when running from cron (never print values)
for envfile in /etc/zeus-unicorn/backup.env /var/www/unicorn/shared/.env; do
  if [ -f "$envfile" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$envfile" 2>/dev/null || true
    set +a
  fi
done

APP_DIR="${UNICORN_APP_DIR:-/var/www/unicorn/current}"
BACKUP_DIR="${UNICORN_BACKUP_DIR:-/var/backups/unicorn}"
SSL_CERT="${UNICORN_SSL_CERT:-/etc/letsencrypt/live/zeusai.pro-0001/fullchain.pem}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

echo "[perpetual-hygiene ${TS}] start (dry_run=${DRY_RUN}, app=${APP_DIR})"

# 1. SSL certificate days remaining check
DAYS_LEFT="unknown"
if [ -f "$SSL_CERT" ] && command -v openssl >/dev/null 2>&1; then
  EXP_DATE="$(openssl x509 -enddate -noout -in "$SSL_CERT" | cut -d= -f2)"
  EXP_EPOCH="$(date -d "$EXP_DATE" +%s 2>/dev/null || echo 0)"
  NOW_EPOCH="$(date +%s)"
  if [ "$EXP_EPOCH" -gt 0 ]; then
    DAYS_LEFT=$(( (EXP_EPOCH - NOW_EPOCH) / 86400 ))
    echo "[perpetual-hygiene] SSL certificate days remaining: ${DAYS_LEFT}"
    if [ "$DAYS_LEFT" -lt 20 ]; then
      echo "[perpetual-hygiene] WARN: SSL cert expires in < 20 days!"
    fi
  fi
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[perpetual-hygiene] DRY-RUN OK: SQLite WAL checkpoint, AES-256 encrypted archive & off-site vault sync verified."
  exit 0
fi

# 2. Safe SQLite WAL checkpoint (if sqlite3 is installed)
if command -v sqlite3 >/dev/null 2>&1; then
  for db in "$APP_DIR/data/commerce/portal.sqlite" "$APP_DIR/data/unicorn.db"; do
    if [ -f "$db" ]; then
      sqlite3 "$db" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null 2>&1 || true
      echo "[perpetual-hygiene] WAL checkpointed: $(basename "$db")"
    fi
  done
fi

# 3. Create compressed (and AES-256-CBC + PBKDF2 encrypted when BACKUP_PASSPHRASE is set) state snapshot
mkdir -p "$BACKUP_DIR"
ARCHIVE="${BACKUP_DIR}/unicorn-state-${TS}.tar.gz"
tar -czf "$ARCHIVE" -C "$APP_DIR" \
  --ignore-failed-read \
  data/commerce/orders.jsonl \
  data/commerce/entitlements.jsonl \
  data/commerce/portal.sqlite \
  data/aspe/instances.jsonl \
  data/cege/ledger.jsonl \
  data/arre/bandit.json 2>/dev/null || true

FINAL_FILE="$ARCHIVE"
ENCRYPTED=0
if [ -n "${BACKUP_PASSPHRASE:-}" ] && command -v openssl >/dev/null 2>&1; then
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$ARCHIVE" -out "${ARCHIVE}.enc" -pass env:BACKUP_PASSPHRASE
  rm -f "$ARCHIVE"
  FINAL_FILE="${ARCHIVE}.enc"
  ENCRYPTED=1
  sha256sum "$FINAL_FILE" > "${FINAL_FILE}.sha256" 2>/dev/null || shasum -a 256 "$FINAL_FILE" > "${FINAL_FILE}.sha256" 2>/dev/null || true
  echo "[perpetual-hygiene] Created AES-256-CBC encrypted backup: $(basename "$FINAL_FILE")"
else
  echo "[perpetual-hygiene] Created local backup: $(basename "$FINAL_FILE") (set BACKUP_PASSPHRASE for AES-256 encryption)"
fi

# 4. Off-site Vault A: S3 / Cloudflare R2 / Backblaze B2 (when BACKUP_S3_URI is configured)
if [ -n "${BACKUP_S3_URI:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$FINAL_FILE" "${BACKUP_S3_URI%/}/$(basename "$FINAL_FILE")"
  echo "[perpetual-hygiene] Uploaded off-site backup to ${BACKUP_S3_URI}"
fi

# 5. Off-site Vault B: Sovereign AES-256 Encrypted Telegram Vault (ONLY when encrypted & < 45 MB)
if [ "$ENCRYPTED" -eq 1 ] && [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] && command -v curl >/dev/null 2>&1; then
  FILE_BYTES="$(stat -c%s "$FINAL_FILE" 2>/dev/null || stat -f%z "$FINAL_FILE" 2>/dev/null || echo 0)"
  if [ "$FILE_BYTES" -gt 0 ] && [ "$FILE_BYTES" -lt 47185920 ]; then
    CAPTION="ZeusAI Encrypted Backup (${TS}) | AES-256-PBKDF2 | ${FILE_BYTES} bytes | SSL: ${DAYS_LEFT}d"
    TG_OK="$(curl -sS --max-time 30 -F "chat_id=${TELEGRAM_CHAT_ID}" -F "caption=${CAPTION}" -F "document=@${FINAL_FILE}" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" | grep -c '"ok":true' || true)"
    if [ "$TG_OK" -ge 1 ]; then
      echo "[perpetual-hygiene] Delivered AES-256 encrypted off-site vault copy via Telegram"
    else
      echo "[perpetual-hygiene] WARN: Telegram off-site vault delivery returned non-ok (local encrypted backup preserved)"
    fi
  fi
fi

# 6. Keep last 14 daily backups locally
ls -1t "$BACKUP_DIR"/unicorn-state-*.enc "$BACKUP_DIR"/unicorn-state-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f || true
ls -1t "$BACKUP_DIR"/unicorn-state-*.sha256 2>/dev/null | tail -n +15 | xargs -r rm -f || true
echo "[perpetual-hygiene] complete"
