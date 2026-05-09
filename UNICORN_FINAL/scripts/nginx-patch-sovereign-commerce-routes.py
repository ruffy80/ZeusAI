#!/usr/bin/env python3
# =====================================================================
# OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
# Email: vladoi_ionut@yahoo.com
# BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
# =====================================================================
"""
nginx-patch-sovereign-commerce-routes.py — idempotent injector that routes
the sovereign-commerce paths to the SITE service (:3001) instead of the
default BACKEND service (:3000).

WHY: the live nginx has a catch-all ``location ^~ /api/`` that proxies
every /api/* request to BACKEND. The sovereign-commerce module
(UNICORN_FINAL/src/site/sovereign-commerce.js) lives only on the SITE
service. Without dedicated rules /api/checkout/create,
/api/commerce/{health,price,recent-sales,reconcile}, /api/order/* and
/api/entitlements/* return 404 from the backend Express finalhandler.

This patcher inserts a single ``# ZEUS-SOVEREIGN-COMMERCE BEGIN/END``
block before the generic ``location ^~ /api/`` rule and reloads nginx.
Re-running it after the markers are present is a no-op.
"""

import os, re, sys, shutil, subprocess, time

CONF = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/zeusai.conf")
BEGIN = "# ZEUS-SOVEREIGN-COMMERCE BEGIN"
END = "# ZEUS-SOVEREIGN-COMMERCE END"

PROXY_TO_SITE = (
    "proxy_pass http://127.0.0.1:3001; "
    "proxy_http_version 1.1; "
    "proxy_set_header Host $host; "
    "proxy_set_header X-Real-IP $remote_addr; "
    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; "
    "proxy_set_header X-Forwarded-Proto $scheme; "
    "proxy_next_upstream error timeout http_502 http_503 http_504; "
    "proxy_read_timeout 60s;"
)

BLOCK = f"""    {BEGIN}
    # Sovereign commerce (BTC checkout, watcher, delivery) — site-only.
    # Must precede the generic "location ^~ /api/" rule.
    location = /api/checkout/create       {{ {PROXY_TO_SITE} }}
    location = /api/commerce/health       {{ {PROXY_TO_SITE} }}
    location = /api/commerce/price        {{ {PROXY_TO_SITE} }}
    location = /api/commerce/recent-sales {{ {PROXY_TO_SITE} }}
    location = /api/commerce/reconcile    {{ {PROXY_TO_SITE} }}
    location ^~ /api/order/               {{ {PROXY_TO_SITE} }}
    location ^~ /api/entitlements/        {{ {PROXY_TO_SITE} }}
    location ^~ /checkout/                {{ {PROXY_TO_SITE} }}
    {END}
"""

def main() -> int:
    if not os.path.exists(CONF):
        print(f"[commerce-patch] config not found: {CONF}", file=sys.stderr)
        return 0

    with open(CONF, "r", encoding="utf-8") as fh:
        original = fh.read()

    if BEGIN in original and END in original:
        print(f"[commerce-patch] already present in {CONF} — no-op")
        return 0

    pattern = re.compile(r"^(\s*)location\s+\^~\s+/api/\s*\{", re.MULTILINE)
    m = pattern.search(original)
    if not m:
        pattern2 = re.compile(r"^(\s*)location\s+\^~\s+/api", re.MULTILINE)
        m = pattern2.search(original)
        if not m:
            print(f"[commerce-patch] no /api/ anchor found in {CONF}; aborting safely", file=sys.stderr)
            return 0

    insertion_point = m.start()
    patched = original[:insertion_point] + BLOCK + original[insertion_point:]

    if BEGIN not in patched or END not in patched:
        print("[commerce-patch] post-insert sanity failed", file=sys.stderr)
        return 1

    backup_dir = os.environ.get("NGINX_BACKUP_DIR", "/etc/nginx/backups")
    try:
        os.makedirs(backup_dir, exist_ok=True)
    except OSError:
        backup_dir = "/tmp"
    backup = os.path.join(backup_dir, f"{os.path.basename(CONF)}.bak-commerce-{time.strftime('%Y%m%d')}")
    if not os.path.exists(backup):
        shutil.copy2(CONF, backup)

    tmp = CONF + ".tmp-commerce"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(patched)
    os.replace(tmp, CONF)

    rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if rc.returncode != 0:
        print("[commerce-patch] nginx -t FAILED, reverting:", rc.stderr, file=sys.stderr)
        shutil.copy2(backup, CONF)
        return 1

    print(f"[commerce-patch] inserted {BEGIN}…{END} into {CONF}")
    rl = subprocess.run(["nginx", "-s", "reload"], capture_output=True, text=True)
    if rl.returncode != 0:
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
    print("[commerce-patch] nginx reloaded")
    return 0

if __name__ == "__main__":
    sys.exit(main())
