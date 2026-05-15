#!/usr/bin/env python3
"""
nginx-patch-maintenance.py — idempotent injector for the never-502 fallback.

Why this exists: even with `proxy_next_upstream` and `proxy_cache_use_stale`
across every /api/* and / location, when BOTH `unicorn-site` (port 3001) and
`unicorn-backend` (port 3000) PM2 clusters are simultaneously down (e.g. mid
pm2 reload, OOM kill on both, post-rsync race), nginx returns a bare 502 to
the user. This script wires in a static maintenance page served by nginx
itself from `/var/www/maintenance/index.html` so the user never sees that
screen again.

Effect: injects a single `include /etc/nginx/snippets/zeus-maintenance.conf;`
into every server { ... } block whose server_name covers zeusai.pro (or
www.zeusai.pro). The snippet declares `error_page 500 502 503 504 =
@zeus_maintenance;` plus an `internal` named location that does
`try_files /index.html =503` from /var/www/maintenance.

Usage (must run as root on the Hetzner host):
  sudo python3 nginx-patch-maintenance.py \
    --snippet /path/to/UNICORN_FINAL/scripts/nginx-maintenance.snippet.conf \
    [--site /etc/nginx/sites-enabled/zeusai.conf] \
    [--target /etc/nginx/snippets/zeus-maintenance.conf] \
    [--domain zeusai.pro]
"""

import argparse
import datetime
import os
import re
import shutil
import subprocess
import sys


INCLUDE_FILENAME = "zeus-maintenance.conf"


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _write(path, content):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp, path)


def _find_server_blocks(text):
    """Yield (start, end, body) for every top-level `server { ... }` block."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        m = re.search(r"\bserver\s*\{", text[i:])
        if not m:
            break
        start = i + m.start()
        body_start = i + m.end()
        depth = 1
        j = body_start
        while j < n and depth > 0:
            c = text[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            j += 1
        if depth != 0:
            break  # malformed; bail
        out.append((start, j, text[start:j]))
        i = j
    return out


def _server_name_matches(block, domain):
    m = re.search(r"\bserver_name\s+([^;]+);", block)
    if not m:
        return False
    names = m.group(1).split()
    return any(n == domain or n == f"www.{domain}" or n == "_" for n in names)


def _has_include(block, target):
    return target in block


def _inject_include(block, include_path):
    """Insert `include <include_path>;` right after the opening `{` of the
    server block, preserving indentation."""
    line = f"\n    include {include_path};\n"
    idx = block.find("{")
    if idx < 0:
        return block
    return block[: idx + 1] + line + block[idx + 1 :]


def patch_site_config(site_path, include_path, domain):
    text = _read(site_path)
    blocks = _find_server_blocks(text)
    if not blocks:
        return text, 0
    new_text = text
    edits = 0
    # Walk in reverse so splice does not invalidate earlier offsets.
    for start, end, body in reversed(blocks):
        if not _server_name_matches(body, domain):
            continue
        if _has_include(body, include_path):
            continue
        patched = _inject_include(body, include_path)
        new_text = new_text[:start] + patched + new_text[end:]
        edits += 1
    return new_text, edits


def nginx_validate():
    return subprocess.run(["nginx", "-t"], capture_output=True, text=True)


def nginx_reload():
    return subprocess.run(
        ["systemctl", "reload", "nginx"], capture_output=True, text=True
    )


def make_backup(site_path):
    """Keep backups outside /etc/nginx/sites-enabled so they are not parsed
    as additional vhosts."""
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backup_dir = "/var/backups/zeus-nginx-maintenance"
    os.makedirs(backup_dir, exist_ok=True)
    backup_name = os.path.basename(site_path).replace(os.sep, "_")
    backup = os.path.join(backup_dir, f"{backup_name}.bak.{ts}")
    shutil.copyfile(site_path, backup)
    return backup


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--snippet",
        required=True,
        help="path to nginx-maintenance.snippet.conf",
    )
    ap.add_argument(
        "--site",
        default="/etc/nginx/sites-enabled/zeusai.conf",
        help="path to the active site config",
    )
    ap.add_argument(
        "--target",
        default=f"/etc/nginx/snippets/{INCLUDE_FILENAME}",
        help="path where the snippet will be installed",
    )
    ap.add_argument(
        "--domain",
        default="zeusai.pro",
        help="apex domain whose server blocks must be patched",
    )
    args = ap.parse_args()

    if os.geteuid() != 0:
        print("ERROR: must run as root (snippet writes to /etc/nginx)", file=sys.stderr)
        sys.exit(2)

    if not os.path.isfile(args.snippet):
        print(f"ERROR: snippet not found at {args.snippet}", file=sys.stderr)
        sys.exit(2)

    # 1) Install snippet
    os.makedirs(os.path.dirname(args.target), exist_ok=True)
    shutil.copyfile(args.snippet, args.target)
    os.chmod(args.target, 0o644)
    print(f"[nginx-maint] snippet installed at {args.target}")

    if not os.path.isfile(args.site):
        print(
            f"[nginx-maint] {args.site} not present yet — snippet ready for future include"
        )
        v = nginx_validate()
        if v.returncode != 0:
            print(v.stderr or v.stdout, file=sys.stderr)
            sys.exit(1)
        nginx_reload()
        sys.exit(0)

    # 2) Backup and patch
    backup = make_backup(args.site)
    print(f"[nginx-maint] backup → {backup}")

    new_text, edits = patch_site_config(args.site, args.target, args.domain)
    if edits == 0:
        print("[nginx-maint] no edits needed (already includes snippet)")
    else:
        _write(args.site, new_text)
        print(f"[nginx-maint] injected include into {edits} server block(s)")

    # 3) Validate
    v = nginx_validate()
    if v.returncode != 0:
        print("[nginx-maint] VALIDATION FAILED — restoring backup")
        sys.stderr.write((v.stderr or v.stdout) + "\n")
        shutil.copyfile(backup, args.site)
        v2 = nginx_validate()
        if v2.returncode == 0:
            nginx_reload()
        sys.exit(1)

    # 4) Reload
    r = nginx_reload()
    if r.returncode != 0:
        print("[nginx-maint] reload FAILED — restoring backup")
        sys.stderr.write((r.stderr or r.stdout) + "\n")
        shutil.copyfile(backup, args.site)
        nginx_validate()
        nginx_reload()
        sys.exit(1)

    print("[nginx-maint] reloaded OK")


if __name__ == "__main__":
    main()
