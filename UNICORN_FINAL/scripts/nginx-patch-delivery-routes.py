#!/usr/bin/env python3
"""
nginx-patch-delivery-routes.py — route the AI fulfillment DELIVERY endpoint to
the SITE service (:3001).

WHY: the live nginx catch-all ``location ^~ /api/`` proxies /api/* to BACKEND
(:3000), but the real deliverable download (`/api/delivery/:id?format=artifact`,
served by src/index.js on the SITE service) lives on :3001. Without a dedicated
rule a paying customer's deliverable download returns the SSR shell / 404 from
the backend. This inserts a ``# ZEUS-DELIVERY-ROUTES BEGIN/END`` block before
the generic /api/ rule and reloads nginx. Idempotent (no-op if markers present).
"""

import os, re, sys, shutil, subprocess, time
from pathlib import Path

CONF = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/zeusai.conf")
BEGIN = "# ZEUS-DELIVERY-ROUTES BEGIN"
END = "# ZEUS-DELIVERY-ROUTES END"

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
    # AI fulfillment deliverable download — served by the SITE service (:3001).
    # Must precede the generic "location ^~ /api/" rule.
    location ^~ /api/delivery/ {{ {PROXY_TO_SITE} }}
    {END}
"""

def log(m): print(f"[delivery-route-patch] {m}")

def main() -> int:
    if not os.path.exists(CONF):
        log(f"config not found: {CONF}"); return 0
    try:
        original = Path(CONF).read_text(encoding="utf-8")
    except IOError as e:
        log(f"read failed: {e}"); return 1
    if BEGIN in original and END in original:
        log("already present — no-op"); return 0
    patterns = [r"^(\s*)location\s+\^~\s+/api/\s*\{", r"^(\s*)location\s+\^~\s+/api",
                r"^(\s*)location\s+~\^\s+/api", r"^(\s*)location\s+/api"]
    ins = None
    for p in patterns:
        m = re.compile(p, re.MULTILINE).search(original)
        if m:
            ins = m.start(); break
    if ins is None:
        log("no /api/ anchor found; aborting safely"); return 0
    patched = original[:ins] + BLOCK + original[ins:]
    backup_dir = os.environ.get("NGINX_BACKUP_DIR", "/etc/nginx/backups")
    try:
        Path(backup_dir).mkdir(parents=True, exist_ok=True)
    except OSError:
        backup_dir = "/tmp"
    backup = os.path.join(backup_dir, f"{os.path.basename(CONF)}.bak-delivery-{time.strftime('%Y%m%d-%H%M%S')}")
    try:
        shutil.copy2(CONF, backup); log(f"backup -> {backup}")
    except IOError as e:
        log(f"backup failed: {e}"); return 1
    # Write directly to CONF (never a temp file inside sites-enabled/, which
    # nginx would also include -> duplicate limit_req_zone and a failed test).
    # nginx keeps running the in-memory config until reload, so revert-on-fail
    # from the backup is safe.
    Path(CONF).write_text(patched, encoding="utf-8")
    rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if rc.returncode != 0:
        log("nginx -t FAILED, reverting"); log(rc.stderr)
        shutil.copy2(backup, CONF)
        return 1
    log(f"inserted {BEGIN}..{END}")
    rl = subprocess.run(["nginx", "-s", "reload"], capture_output=True, text=True)
    if rl.returncode != 0:
        sr = subprocess.run(["systemctl", "reload", "nginx"], capture_output=True, text=True)
        if sr.returncode != 0:
            log(f"reload failed: {sr.stderr}"); return 1
    log("nginx reloaded")
    return 0

if __name__ == "__main__":
    sys.exit(main())
