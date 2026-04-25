#!/bin/zsh
# 30Y-LTS — Encrypted backup of secrets (server .env + signing key + ecosystem) to local repo.
# Output is GPG-symmetric-encrypted with a passphrase you provide; the encrypted
# tarball is the only artifact stored locally so a stolen Mac alone reveals nothing.
#
# Usage:
#   ./scripts/backup-secrets.sh                        # interactive passphrase
#   BACKUP_PASS='my secret' ./scripts/backup-secrets.sh   # non-interactive
#
# Restore:
#   gpg --decrypt backups/secrets-YYYYMMDD-HHMMSS.tar.gz.gpg | tar -xvz -C /tmp/restore
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS_DIR="$REPO_DIR/backups"
SYNC_HOST="${BACKUP_SSH_HOST:-zeusai}"
REMOTE_APP_DIR="${BACKUP_REMOTE_APP_DIR:-/var/www/unicorn/UNICORN_FINAL}"
REMOTE_KEY_DIR="${BACKUP_REMOTE_KEY_DIR:-/var/www/unicorn/secrets}"

mkdir -p "$BACKUPS_DIR"
chmod 700 "$BACKUPS_DIR"

if ! command -v gpg >/dev/null 2>&1; then
  echo "❌ gpg not installed. Install with: brew install gnupg" >&2
  exit 1
fi

STAMP="$(date '+%Y%m%d-%H%M%S')"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "📥 Pulling secrets from $SYNC_HOST..."
ssh "$SYNC_HOST" "cat $REMOTE_APP_DIR/.env"           > "$TMP_DIR/server.env" 2>/dev/null || true
ssh "$SYNC_HOST" "cat $REMOTE_KEY_DIR/site_sign_key.pem" > "$TMP_DIR/site_sign_key.pem" 2>/dev/null || true
cp "$REPO_DIR/UNICORN_FINAL/ecosystem.config.js" "$TMP_DIR/ecosystem.config.js" 2>/dev/null || true

cat > "$TMP_DIR/MANIFEST.txt" <<EOF
ZeusAI secrets backup
Created:    $(date -Iseconds)
Host:       $SYNC_HOST
App dir:    $REMOTE_APP_DIR
Key dir:    $REMOTE_KEY_DIR
BTC wallet: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
Files:
  server.env             — backend + site .env from server
  site_sign_key.pem      — Ed25519 signing key (30Y-LTS)
  ecosystem.config.js    — PM2 process config
EOF

OUT_TAR="$BACKUPS_DIR/secrets-$STAMP.tar.gz"
OUT_ENC="$OUT_TAR.gpg"
tar -czf "$OUT_TAR" -C "$TMP_DIR" .

echo "🔐 Encrypting with GPG (AES-256)..."
if [[ -n "${BACKUP_PASS:-}" ]]; then
  echo "$BACKUP_PASS" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "$OUT_ENC" "$OUT_TAR"
else
  gpg --symmetric --cipher-algo AES256 -o "$OUT_ENC" "$OUT_TAR"
fi
shred -u "$OUT_TAR" 2>/dev/null || rm -f "$OUT_TAR"
chmod 600 "$OUT_ENC"

echo "✅ Backup created: $OUT_ENC ($(/usr/bin/wc -c < "$OUT_ENC") bytes)"
echo "   To restore: gpg --decrypt $OUT_ENC | tar -xvz -C /tmp/restore"

# Optional: rclone/aws s3 sync hook (commented; opt-in)
#   rclone copy "$OUT_ENC" zeus-offsite:zeusai-backups/
#   aws s3 cp "$OUT_ENC" s3://my-encrypted-bucket/zeusai/

# Retention: keep last 30 backups
ls -t "$BACKUPS_DIR"/secrets-*.tar.gz.gpg 2>/dev/null | tail -n +31 | xargs -r rm -f

echo "📦 Local backups in $BACKUPS_DIR:"
ls -la "$BACKUPS_DIR"/secrets-*.tar.gz.gpg 2>/dev/null | tail -10
