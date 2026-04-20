#!/usr/bin/env bash
# ensure-ssh-access.sh
# Reusable SSH auto-bootstrap used by the unicorn secrets module.
#
# Verifică dacă perechea (HETZNER_SSH_PRIVATE_KEY, authorized_keys pe server)
# funcționează; dacă nu, folosește HETZNER_PASSWORD (sshpass) ca trust-anchor
# și instalează public key-ul derivat din privata existentă în authorized_keys
# pe server. Apoi reverifică key-auth-ul.
#
# Expects env vars:
#   HETZNER_HOST                 — server IP/hostname (obligatoriu)
#   HETZNER_DEPLOY_USER          — user SSH (default: root)
#   HETZNER_DEPLOY_PORT          — port SSH (default: 22)
#   HETZNER_SSH_PRIVATE_KEY      — private key content (obligatoriu)
#   HETZNER_PASSWORD             — opțional; folosit ca fallback pentru bootstrap
#
# Scrie cheia privată la ~/.ssh/deploy_key (chmod 600) și adaugă host-ul
# în ~/.ssh/known_hosts. Exit 0 dacă final auth probe trece, 1 altfel.

set -uo pipefail

HOST="${HETZNER_HOST:-${SSH_HOST:-}}"
USER="${HETZNER_DEPLOY_USER:-${HETZNER_USER:-${SSH_USER:-root}}}"
PORT="${HETZNER_DEPLOY_PORT:-${SSH_PORT:-22}}"
PRIV_KEY="${HETZNER_SSH_PRIVATE_KEY:-${SSH_PRIVATE_KEY:-}}"
PASSWORD="${HETZNER_PASSWORD:-}"

if [ -z "$HOST" ] || [ -z "$PRIV_KEY" ]; then
  echo "❌ ensure-ssh-access: HETZNER_HOST și HETZNER_SSH_PRIVATE_KEY sunt obligatorii"
  exit 1
fi

mkdir -p ~/.ssh && chmod 700 ~/.ssh
printf '%s\n' "$PRIV_KEY" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key

# Validate key format early — fail fast with a clear message
if ! ssh-keygen -l -f ~/.ssh/deploy_key >/dev/null 2>&1; then
  echo "❌ ensure-ssh-access: HETZNER_SSH_PRIVATE_KEY nu este o cheie SSH validă"
  exit 1
fi

ssh-keyscan -t ed25519,rsa -p "$PORT" "$HOST" >> ~/.ssh/known_hosts 2>/dev/null || true

ssh_probe() {
  ssh -i ~/.ssh/deploy_key -p "$PORT" \
      -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
      -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
      "${USER}@${HOST}" 'true' 2>/dev/null
}

echo "🔐 ensure-ssh-access: probe initial key-auth pentru ${USER}@${HOST}:${PORT}…"
if ssh_probe; then
  echo "✅ ensure-ssh-access: SSH key-auth funcțional — nu e nevoie de bootstrap"
  exit 0
fi

echo "⚠️  ensure-ssh-access: key-auth a eșuat — încerc bootstrap cu HETZNER_PASSWORD…"
if [ -z "$PASSWORD" ]; then
  echo "❌ ensure-ssh-access: HETZNER_PASSWORD nu e setat — nu pot bootstrap-a fără trust-anchor"
  echo "   Rezolvare manuală necesară: adaugă public key-ul în ~/.ssh/authorized_keys pe server"
  echo "   SAU setează secretul HETZNER_PASSWORD ca trust-anchor pentru auto-bootstrap."
  exit 1
fi

# Derive public key from the (valid) private key
PUB_KEY="$(ssh-keygen -y -f ~/.ssh/deploy_key 2>/dev/null)"
if [ -z "$PUB_KEY" ]; then
  echo "❌ ensure-ssh-access: nu pot deriva public key din HETZNER_SSH_PRIVATE_KEY"
  exit 1
fi
# Give the installed key a stable comment so future rotations pot fi curățate ușor
PUB_KEY_LINE="${PUB_KEY} unicorn-auto-bootstrap@$(date -u +%Y%m%dT%H%M%SZ)"

# Install sshpass if missing (GitHub-hosted runners have apt available)
if ! command -v sshpass >/dev/null 2>&1; then
  echo "📦 ensure-ssh-access: instalez sshpass…"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo apt-get install -y -qq sshpass >/dev/null 2>&1 || {
      echo "❌ ensure-ssh-access: nu pot instala sshpass"
      exit 1
    }
  else
    echo "❌ ensure-ssh-access: sshpass lipsește și apt-get nu e disponibil"
    exit 1
  fi
fi

# Remote command: reads the public key line from stdin and installs it idempotently.
# Using stdin avoids any fragile nested quoting of the key material.
REMOTE_CMD='set -e
umask 077
mkdir -p ~/.ssh
touch ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
NEW_LINE="$(cat)"
# Extract the key body (columns 1-2: "<algo> <base64>") — ignore any comment so
# the idempotency check matches regardless of timestamp/comment differences.
KEY_BODY="$(printf "%s" "$NEW_LINE" | awk "{print \$1\" \"\$2}")"
if [ -n "$KEY_BODY" ] && grep -F -q "$KEY_BODY" ~/.ssh/authorized_keys 2>/dev/null; then
  FP="$(printf "%s\n" "$NEW_LINE" | ssh-keygen -lf - 2>/dev/null | awk "{print \$2}")"
  echo "ℹ️  public key deja prezent (fp=$FP)"
else
  printf "%s\n" "$NEW_LINE" >> ~/.ssh/authorized_keys
  FP="$(printf "%s\n" "$NEW_LINE" | ssh-keygen -lf - 2>/dev/null | awk "{print \$2}")"
  echo "✅ public key instalat (fp=$FP)"
fi'

# Use sshpass to run the install via password auth (no BatchMode here — we WANT password auth).
# Public key line is piped via stdin to avoid nested shell-quoting of key material.
printf '%s\n' "$PUB_KEY_LINE" | SSHPASS="$PASSWORD" sshpass -e ssh \
    -p "$PORT" \
    -o StrictHostKeyChecking=no -o ConnectTimeout=15 \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${USER}@${HOST}" "$REMOTE_CMD" || {
  echo "❌ ensure-ssh-access: bootstrap via parolă a eșuat — verifică HETZNER_PASSWORD"
  exit 1
}

echo "🔁 ensure-ssh-access: reverific key-auth după bootstrap…"
if ssh_probe; then
  echo "✅ ensure-ssh-access: SSH key-auth funcțional după bootstrap"
  exit 0
fi

echo "❌ ensure-ssh-access: key-auth tot nu merge după bootstrap — verbose debug:"
ssh -vv -i ~/.ssh/deploy_key -p "$PORT" \
    -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
    "${USER}@${HOST}" 'true' 2>&1 | tail -30 || true
exit 1
