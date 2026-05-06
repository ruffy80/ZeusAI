#!/usr/bin/env python3
# =====================================================================
# OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
# Email: vladoi_ionut@yahoo.com
# BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
# =====================================================================
"""
nginx-patch-perf-100y-routes.py — idempotent injector for the
performance-100y .well-known endpoints.

WHY: nginx already routes /api/v100/* (covered by the generic
ZEUS-100Y-ROUTES block from the innovations-100y patcher), so the new
/api/v100/perf/* paths work automatically. However, /.well-known/* is
served from a static alias on disk; any file that does not exist there
returns 403. The performance-100y pack publishes two well-known files:

    /.well-known/perf-budget.json
    /.well-known/web-vitals-attestation.json

This patcher inserts a ``# ZEUS-PERF-100Y-ROUTES BEGIN/END`` block with
two ``location =`` rules that proxy those exact paths to the SITE
service (:3001), placed BEFORE the generic ``location ^~ /.well-known/``
so longest-prefix-wins selects them.

Re-runs are no-ops (markers detected). Safe to invoke on every deploy.
"""

import os, re, sys, shutil, subprocess, time

CONF = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/zeusai.conf")
BEGIN = "# ZEUS-PERF-100Y-ROUTES BEGIN"
END = "# ZEUS-PERF-100Y-ROUTES END"

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
    # performance-100y · 50-year visionary perf endpoints (additive, GET-only).
    # Must precede generic "location ^~ /.well-known/" so exact matches win.
    location = /.well-known/perf-budget.json             {{ {PROXY_TO_SITE} }}
    location = /.well-known/web-vitals-attestation.json  {{ {PROXY_TO_SITE} }}
    {END}
"""

def main() -> int:
    if not os.path.exists(CONF):
        print(f"[perf-100y-patch] config not found: {CONF}", file=sys.stderr)
        return 0  # do not fail deploy if nginx is unmanaged

    with open(CONF, "r", encoding="utf-8") as fh:
        original = fh.read()

    if BEGIN in original and END in original:
        print(f"[perf-100y-patch] already present in {CONF} — no-op")
        return 0

    # Anchor: insert before the existing innovations-100y BEGIN marker if
    # present, else before the generic /.well-known/ location, else before
    # the generic /api/ location (any anchor is fine since both blocks
    # ultimately need to win against generic catch-alls).
    pattern_innov = re.compile(r"^\s*#\s*ZEUS-100Y-ROUTES\s+BEGIN", re.MULTILINE)
    m = pattern_innov.search(original)
    if not m:
        pattern_wk = re.compile(r"^(\s*)location\s+\^~\s+/\.well-known/\s*\{", re.MULTILINE)
        m = pattern_wk.search(original)
    if not m:
        pattern_api = re.compile(r"^(\s*)location\s+\^~\s+/api/\s*\{", re.MULTILINE)
        m = pattern_api.search(original)
    if not m:
        print(f"[perf-100y-patch] no anchor found in {CONF}; aborting safely", file=sys.stderr)
        return 0

    insertion_point = m.start()
    patched = original[:insertion_point] + BLOCK + original[insertion_point:]

    if BEGIN not in patched or END not in patched:
        print("[perf-100y-patch] post-insert sanity failed", file=sys.stderr)
        return 1

    backup_dir = os.environ.get("NGINX_BACKUP_DIR", "/etc/nginx/backups")
    try:
        os.makedirs(backup_dir, exist_ok=True)
    except OSError:
        backup_dir = "/tmp"
    backup = os.path.join(backup_dir, f"{os.path.basename(CONF)}.bak-perf100y-{time.strftime('%Y%m%d')}")
    if not os.path.exists(backup):
        shutil.copy2(CONF, backup)

    tmp = CONF + ".tmp-perf100y"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(patched)
    os.replace(tmp, CONF)

    rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if rc.returncode != 0:
        print("[perf-100y-patch] nginx -t FAILED, reverting:", rc.stderr, file=sys.stderr)
        shutil.copy2(backup, CONF)
        return 1

    print(f"[perf-100y-patch] inserted {BEGIN}…{END} into {CONF}")
    print("[perf-100y-patch] nginx -t OK")
    rl = subprocess.run(["nginx", "-s", "reload"], capture_output=True, text=True)
    if rl.returncode != 0:
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
    print("[perf-100y-patch] nginx reloaded")
    return 0

if __name__ == "__main__":
    sys.exit(main())
