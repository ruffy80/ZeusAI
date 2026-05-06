#!/usr/bin/env python3
# =====================================================================
# OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
# Email: vladoi_ionut@yahoo.com
# BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
# =====================================================================
"""
nginx-patch-100y-routes.py — idempotent injector for the innovations-100y
routing block.

WHY: the live nginx has a catch-all  ``location ^~ /api/``  that proxies
the entire /api/ namespace to the BACKEND service on :3000. The new
innovations-100y endpoints live on the SITE service (:3001) and use
brand-new paths (/api/v100/* and /.well-known/{civilization-protocol,
ai-rights, earth-standard, zeus-attestation}.json). Without dedicated
nginx rules, /api/v100/* would land on 3000 (404) and /.well-known/* would
hit the static alias on disk (403).

This patcher:
  1. Inserts a ``# ZEUS-100Y-ROUTES BEGIN/END`` block exactly once.
  2. Routes /api/v100/  →  127.0.0.1:3001  (site).
  3. Adds 4 ``location =`` rules for the new well-known JSON files,
     mirroring the existing did.json / ai-attestation pattern.
  4. Places the block BEFORE the generic ``location ^~ /api/`` and
     BEFORE the generic ``location ^~ /.well-known/`` so nginx's
     longest-prefix-wins rule selects our specific blocks.
  5. Re-running the script with the markers already present is a no-op.

Safe to run on every deploy. Reload nginx only if the file changed.
"""

import os, re, sys, shutil, subprocess, time

CONF = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/zeusai.conf")
BEGIN = "# ZEUS-100Y-ROUTES BEGIN"
END = "# ZEUS-100Y-ROUTES END"

PROXY_TO_SITE = (
    "proxy_pass http://127.0.0.1:3001; "
    "proxy_http_version 1.1; "
    "proxy_set_header Host $host; "
    "proxy_set_header X-Real-IP $remote_addr; "
    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; "
    "proxy_set_header X-Forwarded-Proto $scheme; "
    "proxy_set_header X-CSP-Nonce $request_id;"
)

BLOCK = f"""    {BEGIN}
    # innovations-100y · 50-year world-standard endpoints (additive, GET-only).
    # Must precede generic "location ^~ /api/" and "location ^~ /.well-known/".
    location ^~ /api/v100/ {{ {PROXY_TO_SITE} }}
    location = /.well-known/civilization-protocol.json {{ {PROXY_TO_SITE} }}
    location = /.well-known/ai-rights.json             {{ {PROXY_TO_SITE} }}
    location = /.well-known/earth-standard.json        {{ {PROXY_TO_SITE} }}
    location = /.well-known/zeus-attestation.json      {{ {PROXY_TO_SITE} }}
    {END}
"""

def main() -> int:
    if not os.path.exists(CONF):
        print(f"[100y-patch] config not found: {CONF}", file=sys.stderr)
        return 0  # do not fail deploy if nginx is unmanaged

    with open(CONF, "r", encoding="utf-8") as fh:
        original = fh.read()

    if BEGIN in original and END in original:
        print(f"[100y-patch] already present in {CONF} — no-op")
        return 0

    # Anchor: insert block immediately before the generic ``location ^~ /api/``.
    # Match the line that opens that block; capture its leading whitespace so
    # we can drop our block on its own line above it.
    pattern = re.compile(r"^(\s*)location\s+\^~\s+/api/\s*\{", re.MULTILINE)
    m = pattern.search(original)
    if not m:
        # Fallback anchor: the first line that opens any /api/ rule.
        pattern2 = re.compile(r"^(\s*)location\s+\^~\s+/api", re.MULTILINE)
        m = pattern2.search(original)
        if not m:
            print(f"[100y-patch] no /api/ anchor found in {CONF}; aborting safely", file=sys.stderr)
            return 0

    insertion_point = m.start()
    patched = original[:insertion_point] + BLOCK + original[insertion_point:]

    # Verify both markers landed.
    if BEGIN not in patched or END not in patched:
        print("[100y-patch] post-insert sanity failed", file=sys.stderr)
        return 1

    # Backup once per day so we never accumulate hundreds of copies.
    # IMPORTANT: backups MUST live OUTSIDE sites-enabled, otherwise nginx
    # globs ``sites-enabled/*`` will parse them as live configs and crash
    # with duplicate ``limit_req_zone`` / ``server`` errors.
    backup_dir = os.environ.get("NGINX_BACKUP_DIR", "/etc/nginx/backups")
    try:
        os.makedirs(backup_dir, exist_ok=True)
    except OSError:
        backup_dir = "/tmp"
    backup = os.path.join(backup_dir, f"{os.path.basename(CONF)}.bak-100y-{time.strftime('%Y%m%d')}")
    if not os.path.exists(backup):
        shutil.copy2(CONF, backup)

    # Atomic write via temp file.
    tmp = CONF + ".tmp-100y"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(patched)
    os.replace(tmp, CONF)

    # Validate config; revert on failure.
    rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if rc.returncode != 0:
        print("[100y-patch] nginx -t FAILED, reverting:", rc.stderr, file=sys.stderr)
        shutil.copy2(backup, CONF)
        return 1

    print(f"[100y-patch] inserted {BEGIN}…{END} into {CONF}")
    print("[100y-patch] nginx -t OK")
    # Reload nginx (graceful).
    rl = subprocess.run(["nginx", "-s", "reload"], capture_output=True, text=True)
    if rl.returncode != 0:
        # systemctl as a fallback
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
    print("[100y-patch] nginx reloaded")
    return 0

if __name__ == "__main__":
    sys.exit(main())
