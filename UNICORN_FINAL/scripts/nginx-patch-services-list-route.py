#!/usr/bin/env python3
"""
nginx-patch-services-list-route.py — pin /api/services/list → site (:3001).

WHY: homepage Control Tower Sync Drift compares /api/services ↔ /api/services/list.
`/api/services` is already site-pinned; without an exact pin, list falls through
generic `location ^~ /api/` to the BACKEND and returns a different catalog
(observed live as "265 mismatch").

Idempotent. Safe on every deploy.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time

CONF = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/zeusai.conf")
BEGIN = "# ZEUS-SERVICES-LIST-ROUTE BEGIN"
END = "# ZEUS-SERVICES-LIST-ROUTE END"

PROXY = (
    "proxy_pass http://127.0.0.1:3001; "
    "proxy_http_version 1.1; "
    "proxy_set_header Host $host; "
    "proxy_set_header X-Real-IP $remote_addr; "
    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; "
    "proxy_set_header X-Forwarded-Proto $scheme;"
)

BLOCK = f"""    {BEGIN}
    # Public storefront alias — MUST match /api/services (site SoT).
    location = /api/services/list {{ {PROXY} }}
    {END}
"""


def main() -> int:
    targets = []
    for candidate in (
        CONF,
        "/etc/nginx/sites-enabled/zeusai.conf",
        "/etc/nginx/sites-enabled/unicorn",
        "/etc/nginx/sites-available/unicorn",
    ):
        if os.path.exists(candidate):
            real = os.path.realpath(candidate)
            if real not in targets:
                targets.append(real)
    if not targets:
        print("[services-list-patch] no nginx site config found — no-op", file=sys.stderr)
        return 0

    changed_any = False
    for path in targets:
        with open(path, "r", encoding="utf-8") as fh:
            original = fh.read()

        if BEGIN in original and END in original:
            print(f"[services-list-patch] markers already in {path} — no-op")
            continue
        if re.search(r"location\s+=\s+/api/services/list\s*\{", original):
            print(f"[services-list-patch] exact pin already in {path} — no-op")
            continue

        # Prefer insert next to existing /api/services pin; else before ^~ /api/.
        m = re.search(r"^(\s*)location\s+=\s+/api/services\s*\{", original, re.MULTILINE)
        if m:
            # Insert after the closing } of that one-line (or short) block.
            line_end = original.find("\n", m.start())
            insertion_point = line_end + 1 if line_end >= 0 else m.end()
        else:
            m2 = re.search(r"^(\s*)location\s+\^~\s+/api/\s*\{", original, re.MULTILINE)
            if not m2:
                print(f"[services-list-patch] no anchor in {path} — skip", file=sys.stderr)
                continue
            insertion_point = m2.start()

        patched = original[:insertion_point] + BLOCK + original[insertion_point:]
        backup_dir = os.environ.get("NGINX_BACKUP_DIR", "/etc/nginx/backups")
        try:
            os.makedirs(backup_dir, exist_ok=True)
        except OSError:
            backup_dir = "/tmp"
        backup = os.path.join(
            backup_dir,
            f"{os.path.basename(path)}.bak-services-list-{time.strftime('%Y%m%d')}",
        )
        if not os.path.exists(backup):
            shutil.copy2(path, backup)
        tmp = path + ".tmp-services-list"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(patched)
        os.replace(tmp, path)
        rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
        if rc.returncode != 0:
            print("[services-list-patch] nginx -t FAILED, reverting:", rc.stderr, file=sys.stderr)
            shutil.copy2(backup, path)
            return 1
        print(f"[services-list-patch] inserted pin into {path}")
        changed_any = True

    if changed_any:
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
        print("[services-list-patch] nginx reloaded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
