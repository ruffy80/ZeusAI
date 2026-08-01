#!/usr/bin/env bash
# prod-env-bootstrap.sh — fill internal/alias secrets that must never be blank.
# Does NOT invent Stripe/SMTP provider credentials (those come from GitHub Secrets
# via sync-all-secrets.yml). Safe to re-run.
set -euo pipefail

ENV_FILE="${1:-/var/www/unicorn/shared/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file missing: $ENV_FILE" >&2
  exit 2
fi

umask 077
tmp="$(mktemp)"
cp -a "$ENV_FILE" "$tmp"

ensure_key() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$tmp"; then
    local cur
    cur="$(grep -E "^${key}=" "$tmp" | head -1 | cut -d= -f2-)"
    if [[ -n "${cur// /}" && "$cur" != \$\{* ]]; then
      echo "keep $key (already filled)"
      return 0
    fi
    # replace empty / placeholder
    sed -i -E "s|^${key}=.*|${key}=${value}|" "$tmp"
    echo "filled $key (was empty/placeholder)"
  else
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
    echo "appended $key"
  fi
}

# SESSION_SECRET — internal signing; generate if absent
if ! grep -qE '^SESSION_SECRET=[^[:space:]{$]' "$tmp"; then
  sess="$(openssl rand -hex 32)"
  ensure_key SESSION_SECRET "$sess"
else
  echo "keep SESSION_SECRET"
fi

# GITHUB_TOKEN alias from GH_PAT when only the short name is set
if grep -qE '^GH_PAT=.+' "$tmp" && ! grep -qE '^GITHUB_TOKEN=[^[:space:]{$]' "$tmp"; then
  ghpat="$(grep -E '^GH_PAT=' "$tmp" | head -1 | cut -d= -f2-)"
  ensure_key GITHUB_TOKEN "$ghpat"
fi

# PORT is owned by PM2 ecosystem — document presence for completeness audits
ensure_key PORT "${PORT:-3000}"

# Accept IP health probes without host-sanity spam
if ! grep -qE '^HOST_SANITY_EXTRA_HOSTS=' "$tmp"; then
  # public VPS IP (best-effort)
  ip="$(curl -4 -sS -m 3 ifconfig.me 2>/dev/null || true)"
  if [[ -n "$ip" ]]; then
    ensure_key HOST_SANITY_EXTRA_HOSTS "$ip"
  fi
fi

# Atomic replace
cp -a "$ENV_FILE" "${ENV_FILE}.bak-bootstrap-$(date -u +%Y%m%dT%H%M%SZ)"
cat "$tmp" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
rm -f "$tmp"
echo "OK wrote $ENV_FILE"
