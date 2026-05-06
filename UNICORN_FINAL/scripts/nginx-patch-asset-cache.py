#!/usr/bin/env python3
"""
nginx-patch-asset-cache.py — idempotent injector that ensures static assets
served from the SSR upstream (port 3001) keep their long-cache headers.

Why this exists: the active Hetzner vhost (`/etc/nginx/sites-enabled/zeusai.conf`)
contains a catch-all `location /` that adds
`add_header Cache-Control "no-cache, no-store, must-revalidate" always;`
which nginx merges with the upstream's
`Cache-Control: public, max-age=31536000, immutable`, producing two conflicting
`Cache-Control` response headers. Browsers and PageSpeed/Lighthouse interpret
the union as "do not cache", which kills the Performance score and forces every
revisit to re-download ~250 KiB of JS plus CSS/icons.

This script inserts dedicated `location ^~ /assets/`, `location ^~ /icons/` and
`location = /manifest.json` blocks BEFORE the catch-all `location /`, each
proxying to the same upstream WITHOUT adding any Cache-Control override. The
upstream's immutable header is preserved, fixing the duplicate header without
breaking any existing route.

Idempotent: re-runs are no-ops (we tag the inserted comment with
`ZEUS-PERF: static immutable assets`). On nginx -t failure the original config
is restored from a timestamped backup placed outside any nginx include dir.

Usage (root on the Hetzner host):
  sudo python3 nginx-patch-asset-cache.py [--site /etc/nginx/sites-enabled/zeusai.conf]
"""

import argparse
import datetime
import os
import shutil
import subprocess
import sys


MARKER = "ZEUS-PERF: static immutable assets"
ANCHOR = "    location ~* \\.html$ {"  # Insert directly before this block.

NEW_BLOCK = """    # ZEUS-PERF: static immutable assets MUST keep their upstream
    # "public, max-age=31536000, immutable" Cache-Control. The catch-all
    # "location /" below otherwise injects "no-cache" and Lighthouse marks
    # them as uncacheable. Added 2026-05-06 to lift PageSpeed Performance.
    location ^~ /assets/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-CSP-Nonce       $request_id;
        gzip on;
        gzip_types application/javascript text/css text/plain text/javascript application/json image/svg+xml;
        gzip_vary on;
    }
    location ^~ /icons/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-CSP-Nonce       $request_id;
    }
    location = /manifest.json {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-CSP-Nonce       $request_id;
    }

"""


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _write(path, content):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp, path)


def make_backup(site_path):
    """Create backup OUTSIDE /etc/nginx/sites-enabled/ — nginx includes the whole
    directory and would parse a `*.bak.*` file as a duplicate vhost."""
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backup_dir = "/var/backups/zeus-nginx-asset-cache"
    os.makedirs(backup_dir, exist_ok=True)
    backup = os.path.join(
        backup_dir, f"{os.path.basename(site_path)}.bak.{ts}"
    )
    shutil.copyfile(site_path, backup)
    return backup


def patch(site_path):
    text = _read(site_path)
    if MARKER in text:
        return False, "already patched"
    if ANCHOR not in text:
        return False, f"anchor not found: {ANCHOR!r}"
    backup = make_backup(site_path)
    new_text = text.replace(ANCHOR, NEW_BLOCK + ANCHOR, 1)
    _write(site_path, new_text)

    # Validate; rollback on failure.
    res = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if res.returncode != 0:
        shutil.copyfile(backup, site_path)
        return False, (
            f"nginx -t failed after patch (rolled back):\n{res.stderr}"
        )
    return True, f"patched (backup: {backup})"


def reload_nginx():
    return subprocess.run(
        ["systemctl", "reload", "nginx"], capture_output=True, text=True
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--site",
        default="/etc/nginx/sites-enabled/zeusai.conf",
        help="path to the active site config",
    )
    ap.add_argument(
        "--no-reload",
        action="store_true",
        help="apply patch but do not reload nginx",
    )
    args = ap.parse_args()

    if not os.path.exists(args.site):
        print(f"site config not found: {args.site}", file=sys.stderr)
        return 0  # not fatal — host may be a different layout

    changed, msg = patch(args.site)
    print(msg)
    if changed and not args.no_reload:
        r = reload_nginx()
        if r.returncode != 0:
            print(f"nginx reload failed:\n{r.stderr}", file=sys.stderr)
            return 1
        print("nginx reloaded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
