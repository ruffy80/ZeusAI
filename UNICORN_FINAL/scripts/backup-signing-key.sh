#!/usr/bin/env bash
# backup-signing-key.sh — Off-server encrypted backup of the Ed25519 signing
# key used by sovereign-commerce to mint W3C Verifiable Credential entitlement
# receipts. Losing this key means past receipts can no longer be cryptographically
# verified, so we keep a GPG-encrypted copy in a safe location.
#
# Usage:
#   BACKUP_GPG_RECIPIENT=you@domain.com ./scripts/backup-signing-key.sh
# Or with a passphrase (symmetric):
#   BACKUP_PASSPHRASE='strong-pass' ./scripts/backup-signing-key.sh
#
# Output is written to data/commerce/backups/signing-<timestamp>.pem.gpg
# This script is read-only against the source key; it never modifies it.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="${COMMERCE_DATA_DIR:-$ROOT_DIR/data/commerce}"
KEY_FILE="${KEY_DIR}/signing.pem"
BACKUP_DIR="${KEY_DIR}/backups"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/signing-${TS}.pem.gpg"

if [ ! -f "${KEY_FILE}" ]; then
  echo "[backup] signing key not found at ${KEY_FILE} — nothing to back up." >&2
  exit 0
fi

if ! command -v gpg >/dev/null 2>&1; then
  echo "[backup] gpg is not installed; install gnupg to enable encrypted backups." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "[backup] encrypting with public key for ${BACKUP_GPG_RECIPIENT}"
  gpg --batch --yes --quiet \
      --recipient "${BACKUP_GPG_RECIPIENT}" \
      --trust-model always \
      --output "${OUT_FILE}" \
      --encrypt "${KEY_FILE}"
elif [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  echo "[backup] encrypting symmetrically with BACKUP_PASSPHRASE"
  gpg --batch --yes --quiet \
      --pinentry-mode loopback \
      --passphrase "${BACKUP_PASSPHRASE}" \
      --symmetric --cipher-algo AES256 \
      --output "${OUT_FILE}" "${KEY_FILE}"
else
  echo "[backup] set BACKUP_GPG_RECIPIENT or BACKUP_PASSPHRASE to encrypt the backup." >&2
  exit 2
fi

chmod 600 "${OUT_FILE}"

# Keep at most the last 30 backups locally (portable across BSD/GNU; no `xargs -r`).
ls -1t "${BACKUP_DIR}"/signing-*.pem.gpg 2>/dev/null | awk 'NR>30' | while IFS= read -r old; do
  [ -n "${old}" ] && rm -f -- "${old}"
done

SIZE="$(wc -c <"${OUT_FILE}" | tr -d ' ')"
SHA="$(sha256sum "${OUT_FILE}" | awk '{print $1}')"
echo "[backup] wrote ${OUT_FILE} (${SIZE} bytes, sha256 ${SHA})"
