#!/usr/bin/env bash
# Adds an nginx location block to route /webhooks/ → backend:3000.
# Idempotent: safe to run multiple times.
set -euo pipefail
CONF=/etc/nginx/sites-enabled/zeusai.conf

if grep -q "location \^~ /webhooks/" "$CONF"; then
  echo "[nginx] /webhooks/ proxy already present — nothing to do."
  exit 0
fi

# Insert before the first /api/invoice/ block (which is the canonical
# backend-proxy zone of this config).
TMP="$(mktemp)"
awk '
  BEGIN { inserted = 0 }
  !inserted && /^[[:space:]]*location \^~ \/api\/invoice\// {
    print "    # Stripe + future webhooks → backend on 3000 (signature-verified handlers)"
    print "    location ^~ /webhooks/ {"
    print "        proxy_pass         http://127.0.0.1:3000;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header   Host              $host;"
    print "        proxy_set_header   X-Real-IP         $remote_addr;"
    print "        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;"
    print "        proxy_set_header   X-Forwarded-Proto $scheme;"
    print "        # Webhook bodies are small (Stripe ≤ ~256 KB); raise just in case."
    print "        client_max_body_size 1m;"
    print "        # Stripe expects a quick 2xx; do not buffer or rewrite the body"
    print "        # because signature verification needs the raw payload byte-for-byte."
    print "        proxy_request_buffering off;"
    print "        proxy_buffering         off;"
    print "    }"
    print ""
    inserted = 1
  }
  { print }
' "$CONF" > "$TMP"

# IMPORTANT: backup must live OUTSIDE /etc/nginx/sites-enabled/ — otherwise
# nginx loads it as a second site and we get duplicate-zone errors.
BAK_DIR=/var/backups/nginx
mkdir -p "$BAK_DIR"
BAK="$BAK_DIR/zeusai.conf.bak.$(date +%s)"
cp "$CONF" "$BAK"
mv "$TMP" "$CONF"

if nginx -t 2>&1; then
  systemctl reload nginx
  echo "[nginx] /webhooks/ proxy added and nginx reloaded. Backup: $BAK"
else
  echo "[nginx] config test FAILED — restoring backup." >&2
  cp "$BAK" "$CONF"
  exit 1
fi
