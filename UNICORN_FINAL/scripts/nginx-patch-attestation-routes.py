#!/usr/bin/env python3
# =====================================================================
# OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
# Email: vladoi_ionut@yahoo.com
# BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
# =====================================================================
"""
nginx-patch-attestation-routes.py — idempotent injector that routes
the HTML build-attestation API to the SITE service (:3001).

WHY: /api/attestation/publickey and /api/attestation/verify-html are
implemented in UNICORN_FINAL/src/index.js (the SITE service on :3001),
but the live nginx has a catch-all `location ^~ /api/ → :3000` (BACKEND)
that would 404 these endpoints. We insert specific rules for them
BEFORE the catch-all. Idempotent — re-running is a no-op once the
markers are in place.
"""

import os, re, sys, shutil, subprocess, time
from pathlib import Path

CONF = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/zeusai.conf")
BEGIN = "# ZEUS-ATTESTATION BEGIN"
END = "# ZEUS-ATTESTATION END"

PROXY_TO_SITE = (
    "proxy_pass http://127.0.0.1:3001; "
    "proxy_http_version 1.1; "
    "proxy_set_header Host $host; "
    "proxy_set_header X-Real-IP $remote_addr; "
    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; "
    "proxy_set_header X-Forwarded-Proto $scheme; "
    "proxy_next_upstream error timeout http_502 http_503 http_504; "
    "proxy_read_timeout 30s;"
)

BLOCK = f"""    {BEGIN}
    # HTML build-attestation (Ed25519). Site-only — must precede /api/.
    location = /api/attestation/publickey   {{ {PROXY_TO_SITE} }}
    location = /api/attestation/verify-html {{ {PROXY_TO_SITE} client_max_body_size 6m; }}
    {END}
"""

def log(msg): print(f"[attestation-patch] {msg}")

def find_api_anchor(content):
    patterns = [
        r"^(\s*)location\s+\^~\s+/api/\s*\{",
        r"^(\s*)location\s+\^~\s+/api",
        r"^(\s*)location\s+/api",
    ]
    for p in patterns:
        m = re.compile(p, re.MULTILINE).search(content)
        if m:
            return m.start()
    return None

def main():
    if not os.path.exists(CONF):
        log(f"config not found: {CONF}"); return 0
    with open(CONF, "r", encoding="utf-8") as fh:
        original = fh.read()
    if BEGIN in original and END in original:
        log("already present — no-op"); return 0
    ip = find_api_anchor(original)
    if ip is None:
        log("no /api/ anchor found — abort safely"); return 0
    patched = original[:ip] + BLOCK + original[ip:]
    backup_dir = "/etc/nginx/backups"
    try:
        Path(backup_dir).mkdir(parents=True, exist_ok=True)
    except OSError:
        backup_dir = "/tmp"
    backup = os.path.join(backup_dir, f"{os.path.basename(CONF)}.bak-attestation-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(CONF, backup)
    log(f"backed up to {backup}")
    tmp = "/tmp/" + os.path.basename(CONF) + ".tmp-attestation"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(patched)
    # Validate by atomically swapping in-place: write tmp outside nginx
    # include glob, then move into place; if `nginx -t` after the move
    # fails we restore from backup. Writing the tmp inside sites-enabled/
    # would make `nginx -t` see BOTH files and trip duplicate-zone errors.
    os.replace(tmp, CONF)
    rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if rc.returncode != 0:
        log(f"nginx -t FAILED, reverting: {rc.stderr}")
        shutil.copy2(backup, CONF)
        return 1
    log(f"inserted {BEGIN}…{END}")
    rl = subprocess.run(["nginx", "-s", "reload"], capture_output=True, text=True)
    if rl.returncode != 0:
        sr = subprocess.run(["systemctl", "reload", "nginx"], capture_output=True, text=True)
        if sr.returncode != 0:
            log(f"reload failed: {sr.stderr}"); return 1
    log("nginx reloaded")
    return 0

if __name__ == "__main__":
    sys.exit(main())
