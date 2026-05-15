#!/usr/bin/env bash
# install-maintenance-page.sh — idempotent install of the never-502 fallback.
#
# Run on the Hetzner host (deploy.yml ssh block). Two responsibilities:
#   1. Copy UNICORN_FINAL/scripts/maintenance-page.html to
#      /var/www/maintenance/index.html (the doc-root referenced by the nginx
#      `@zeus_maintenance` named location).
#   2. Call nginx-patch-maintenance.py on every active zeusai vhost to
#      wire the snippet `include` into the server blocks.
#
# Both steps are idempotent: re-running this script never breaks an already
# patched config. Safe to invoke from every deploy.

set -uo pipefail

DEPLOY_PATH="${1:-/var/www/unicorn/UNICORN_FINAL}"
DOMAIN="${2:-zeusai.pro}"

SRC_HTML="$DEPLOY_PATH/scripts/maintenance-page.html"
SRC_SNIPPET="$DEPLOY_PATH/scripts/nginx-maintenance.snippet.conf"
PATCHER="$DEPLOY_PATH/scripts/nginx-patch-maintenance.py"

DEST_DIR=/var/www/maintenance
DEST_HTML="$DEST_DIR/index.html"

# ── Step 1: static HTML ─────────────────────────────────────────────────
if [ ! -f "$SRC_HTML" ]; then
    echo "[maint] WARN: $SRC_HTML missing — skipping HTML install"
else
    mkdir -p "$DEST_DIR"
    cp -f "$SRC_HTML" "$DEST_HTML"
    chmod 644 "$DEST_HTML"
    # Make sure nginx can read it. www-data is the default Ubuntu nginx user;
    # if it does not exist, leave ownership as-is (root readable is enough).
    chown -R www-data:www-data "$DEST_DIR" 2>/dev/null || true
    echo "[maint] installed $DEST_HTML ($(wc -c < "$DEST_HTML") bytes)"
fi

# ── Step 2: nginx snippet + server-block patch ──────────────────────────
if [ ! -f "$SRC_SNIPPET" ] || [ ! -f "$PATCHER" ]; then
    echo "[maint] WARN: snippet or patcher missing — skipping nginx patch"
    exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "[maint] python3 not available — skipping nginx patch"
    exit 0
fi

# Patch every active zeusai vhost AND the canonical sites-available/unicorn
# fallback. The patcher is fully idempotent.
PATCHED_ANY=0
for SITE in \
    /etc/nginx/sites-enabled/zeusai.conf \
    /etc/nginx/sites-enabled/unicorn \
    /etc/nginx/sites-available/unicorn
do
    [ -f "$SITE" ] || continue
    REAL=$(readlink -f "$SITE")
    echo "[maint] patching $SITE (real: $REAL)"
    python3 "$PATCHER" \
        --snippet "$SRC_SNIPPET" \
        --site   "$REAL" \
        --domain "$DOMAIN" || \
            echo "[maint] $REAL — patch step reported a non-zero exit (continuing)"
    PATCHED_ANY=1
done

if [ "$PATCHED_ANY" = "0" ]; then
    echo "[maint] no active zeusai vhost found — snippet installed for future use"
fi

# Final reload (best-effort; patcher already reloaded on success).
nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
echo "[maint] done"
