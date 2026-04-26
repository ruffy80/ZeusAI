#!/usr/bin/env bash
# ensure-btc-routes.sh
# Idempotent: ensures Nginx routes /api/invoice/ and /api/alerts/ to the
# backend on port 3000 (otherwise the site server on 3001 swallows them).
#
# Safe to re-run; survives re-runs of setup-ssl.sh / certbot --nginx.
# Usage: bash scripts/ensure-btc-routes.sh [domain]

set -uo pipefail

DOMAIN="${1:-zeusai.pro}"

# Locate the active config (first match wins).
CONF=""
for c in /etc/nginx/sites-enabled/zeusai.conf \
         /etc/nginx/sites-enabled/unicorn \
         "/etc/nginx/sites-enabled/${DOMAIN}.conf" \
         "/etc/nginx/sites-enabled/${DOMAIN}"; do
  [ -f "$c" ] && { CONF="$c"; break; }
done

if [ -z "$CONF" ]; then
  echo "[ensure-btc-routes] No active nginx site config found — skipping."
  exit 0
fi

if grep -q "BTC invoice + ZAC alerts API" "$CONF"; then
  echo "[ensure-btc-routes] Already present in $CONF — skipping."
  exit 0
fi

echo "[ensure-btc-routes] Patching $CONF …"

# Find the SSL server block for the apex domain and inject before its main `location /`.
TS=$(date +%s)
cp "$CONF" "/var/backups/$(basename "$CONF").bak.${TS}" 2>/dev/null || true

python3 - "$CONF" "$DOMAIN" <<'PYEOF'
import sys, re
path, domain = sys.argv[1], sys.argv[2]
with open(path) as f:
    txt = f.read()

inject = """
    # BTC invoice + ZAC alerts API → backend on 3000 (managed by ensure-btc-routes.sh)
    location ^~ /api/invoice/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location ^~ /api/alerts/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

"""

# Try to inject before the apex domain's main `location / {` proxying to 3001.
patterns = [
    r'(    # Main site \(Node\.js on 3001[^\n]*\n)',
    r'(    location / \{\s*\n        proxy_pass\s+http://127\.0\.0\.1:3001;)',
    r'(    location / \{\s*\n\s*proxy_pass\s+http://127\.0\.0\.1:3001;)',
]
new = txt
for pat in patterns:
    m = re.search(pat, new)
    if m:
        new = new[:m.start()] + inject + new[m.start():]
        break

if new == txt:
    print("[python] no insertion point matched — leaving config unchanged", file=sys.stderr)
    sys.exit(2)

with open(path, "w") as f:
    f.write(new)
print("[python] injected BTC routes")
PYEOF

if ! nginx -t >/dev/null 2>&1; then
  echo "[ensure-btc-routes] nginx -t failed, restoring backup"
  cp "/var/backups/$(basename "$CONF").bak.${TS}" "$CONF"
  exit 1
fi

systemctl reload nginx || service nginx reload || true
echo "[ensure-btc-routes] ✅ BTC API routes active on $CONF"
