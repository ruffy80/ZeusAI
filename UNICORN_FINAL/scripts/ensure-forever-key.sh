#!/usr/bin/env bash
# UNICORN_FINAL/scripts/ensure-forever-key.sh
#
# Idempotently provision a release-stable Ed25519 signing key in
# /var/www/unicorn/shared/site-sign.pem so that:
#   • /integrity.json signatures are verifiable across every deploy
#   • /.well-known/zeusai-key.pub serves a stable SPKI public key
#
# Safe to run on every deploy: if the key already exists, do nothing.
# This script is called by the deploy pipeline AFTER symlink promote and
# BEFORE PM2 restart.
set -euo pipefail

SHARED_DIR="${SHARED_DIR:-/var/www/unicorn/shared}"
KEY_FILE="${KEY_FILE:-$SHARED_DIR/site-sign.pem}"
PUB_FILE="${PUB_FILE:-$SHARED_DIR/site-sign.pub}"

mkdir -p "$SHARED_DIR"
chmod 700 "$SHARED_DIR" 2>/dev/null || true

if [ -s "$KEY_FILE" ]; then
  echo "[forever-key] key already present at $KEY_FILE — keeping existing"
else
  echo "[forever-key] minting new Ed25519 site-sign key at $KEY_FILE"
  # Use openssl (always available on Hetzner Ubuntu 22.04). Fall back to
  # node's crypto module if openssl is missing for some reason.
  if command -v openssl >/dev/null 2>&1; then
    openssl genpkey -algorithm ed25519 -out "$KEY_FILE"
  else
    node -e '
      const fs = require("fs");
      const crypto = require("crypto");
      const kp = crypto.generateKeyPairSync("ed25519");
      fs.writeFileSync(process.argv[1], kp.privateKey.export({ type:"pkcs8", format:"pem" }));
    ' "$KEY_FILE"
  fi
  chmod 600 "$KEY_FILE"
fi

# Always (re)derive the public key file from the private key. This is cheap
# and means a partial install (private only) self-heals on next deploy.
if command -v openssl >/dev/null 2>&1; then
  openssl pkey -in "$KEY_FILE" -pubout -out "$PUB_FILE"
else
  node -e '
    const fs = require("fs");
    const crypto = require("crypto");
    const priv = crypto.createPrivateKey(fs.readFileSync(process.argv[1]));
    const pub  = crypto.createPublicKey(priv).export({ type:"spki", format:"pem" });
    fs.writeFileSync(process.argv[2], pub);
  ' "$KEY_FILE" "$PUB_FILE"
fi
chmod 644 "$PUB_FILE"

echo "[forever-key] OK"
echo "  private: $KEY_FILE"
echo "  public:  $PUB_FILE"
