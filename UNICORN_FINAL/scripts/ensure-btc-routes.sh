#!/usr/bin/env bash
# ensure-btc-routes.sh
# Idempotent: ensures Nginx routes /api/invoice/, /api/alerts/ and /api/ai/
# to the backend on port 3000 (otherwise the site server on 3001 swallows
# them and you get the site-layer fallback instead of the real multi-router
# orchestrator with all 14 AI providers).
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

if grep -q "BTC invoice + ZAC alerts + AI multi-router" "$CONF"; then
  echo "[ensure-btc-routes] Already up to date in $CONF — skipping."
  exit 0
fi

# Upgrade path: an older version of this script may have injected a block
# with marker "BTC invoice + ZAC alerts API" (no /api/ai/). Strip it so the
# new injection adds the full /api/ai/ + /api/invoice/ + /api/alerts/ block.
if grep -q "BTC invoice + ZAC alerts API" "$CONF"; then
  echo "[ensure-btc-routes] Older marker found in $CONF — removing legacy block before re-injecting."
  TS_PRE=$(date +%s)
  cp "$CONF" "/var/backups/$(basename "$CONF").pre-upgrade.${TS_PRE}" 2>/dev/null || true
  python3 - "$CONF" <<'PYSTRIP'
import sys, re
path = sys.argv[1]
with open(path) as f:
    txt = f.read()
# Remove the legacy block: from the marker comment up to (and including)
# the second `}` that closes location ^~ /api/alerts/.
pat = re.compile(
    r'\n?\s*#\s*BTC invoice \+ ZAC alerts API[^\n]*\n'
    r'(?:.*\n){1,40}?\s*location \^~ /api/alerts/[^{]*\{[^}]*\}\s*\n',
    re.MULTILINE
)
new = pat.sub('\n', txt, count=1)
with open(path, 'w') as f:
    f.write(new)
PYSTRIP
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
    # BTC invoice + ZAC alerts + AI multi-router → backend on 3000 (managed by ensure-btc-routes.sh)
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

    location ^~ /api/ai/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # AI calls can take longer than the default 60s nginx timeout.
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        # Stream tokens as they arrive (no buffering for SSE / chunked replies).
        proxy_buffering    off;
        proxy_cache        off;
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
