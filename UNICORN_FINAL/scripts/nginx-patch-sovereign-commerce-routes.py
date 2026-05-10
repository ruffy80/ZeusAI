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
from pathlib import Path
from typing import Optional, Tuple

# ANSI colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

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

def log_info(msg: str) -> None:
    """Log info message in blue."""
    print(f"{BLUE}[commerce-patch]{RESET} {msg}")

def log_success(msg: str) -> None:
    """Log success message in green."""
    print(f"{GREEN}[commerce-patch]{RESET} {msg}")

def log_warn(msg: str) -> None:
    """Log warning message in yellow."""
    print(f"{YELLOW}[commerce-patch]{RESET} {msg}", file=sys.stderr)

def log_error(msg: str) -> None:
    """Log error message in red."""
    print(f"{RED}[commerce-patch]{RESET} {msg}", file=sys.stderr)

def find_nginx_location_pattern(content: str) -> Optional[Tuple[int, str]]:
    """Find /api/ location block with multiple fallback patterns."""
    patterns = [
        r"^(\s*)location\s+\^~\s+/api/\s*\{",
        r"^(\s*)location\s+\^~\s+/api",
        r"^(\s*)location\s+~\^\s+/api",
        r"^(\s*)location\s+/api",
    ]
    for pattern_str in patterns:
        pattern = re.compile(pattern_str, re.MULTILINE)
        m = pattern.search(content)
        if m:
            return (m.start(), pattern_str)
    return None

def main() -> int:
    if not os.path.exists(CONF):
        log_error(f"config not found: {CONF}")
        return 0

    try:
        with open(CONF, "r", encoding="utf-8") as fh:
            original = fh.read()
    except IOError as e:
        log_error(f"failed to read {CONF}: {e}")
        return 1

    if BEGIN in original and END in original:
        log_info(f"already present in {CONF} — no-op")
        return 0

    result = find_nginx_location_pattern(original)
    if not result:
        log_error(f"no /api/ location anchor found in {CONF}; aborting safely")
        return 0

    insertion_point, pattern_matched = result
    log_info(f"found /api/ pattern: {pattern_matched}")
    patched = original[:insertion_point] + BLOCK + original[insertion_point:]

    if BEGIN not in patched or END not in patched:
        log_error("post-insert sanity failed")
        return 1

    # Backup setup
    backup_dir = os.environ.get("NGINX_BACKUP_DIR", "/etc/nginx/backups")
    try:
        Path(backup_dir).mkdir(parents=True, exist_ok=True)
    except OSError:
        backup_dir = "/tmp"
        log_warn(f"could not create {os.environ.get('NGINX_BACKUP_DIR')}; using /tmp")
    
    backup = os.path.join(backup_dir, f"{os.path.basename(CONF)}.bak-commerce-{time.strftime('%Y%m%d-%H%M%S')}")
    try:
        shutil.copy2(CONF, backup)
        log_info(f"backed up to {backup}")
    except IOError as e:
        log_error(f"backup failed: {e}")
        return 1

    # Write patched config to temp file
    tmp = CONF + ".tmp-commerce"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(patched)
    except IOError as e:
        log_error(f"failed to write temp config: {e}")
        return 1

    # Validate with nginx -t
    rc = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if rc.returncode != 0:
        log_error(f"nginx -t FAILED, reverting")
        log_error(rc.stderr)
        try:
            shutil.copy2(backup, CONF)
            log_info("reverted to backup")
        except IOError as e:
            log_error(f"failed to revert: {e}")
        try:
            os.remove(tmp)
        except OSError:
            pass
        return 1

    # Apply changes
    try:
        os.replace(tmp, CONF)
    except OSError as e:
        log_error(f"failed to apply patch: {e}")
        try:
            shutil.copy2(backup, CONF)
        except IOError:
            pass
        return 1

    log_success(f"inserted {BEGIN}…{END} into {CONF}")

    # Reload nginx
    rl = subprocess.run(["nginx", "-s", "reload"], capture_output=True, text=True)
    if rl.returncode != 0:
        log_warn("nginx -s reload failed, trying systemctl...")
        sr = subprocess.run(["systemctl", "reload", "nginx"], capture_output=True, text=True)
        if sr.returncode != 0:
            log_error(f"failed to reload nginx: {sr.stderr}")
            return 1
    
    log_success("nginx reloaded successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())
