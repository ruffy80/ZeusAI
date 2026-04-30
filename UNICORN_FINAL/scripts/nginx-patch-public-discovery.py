#!/usr/bin/env python3
"""
nginx-patch-public-discovery.py — idempotent injector for the public-discovery
snippet (/.well-known/*, /humans.txt, /offline.html, /agents.json).

Why this exists: server-doctor.sh refuses to overwrite
/etc/nginx/sites-available/unicorn once certbot has populated the file with
ssl_certificate directives (a full overwrite would wipe HTTPS until a fresh
certbot run). To still ship public-discovery routes, this script:

  1. Copies scripts/nginx-public-discovery.snippet.conf to
     /etc/nginx/snippets/zeus-public-discovery.conf
  2. Parses /etc/nginx/sites-available/unicorn and injects
     `include /etc/nginx/snippets/zeus-public-discovery.conf;`
     into every `server { ... }` block whose `server_name` directive includes
     zeusai.pro or www.zeusai.pro — once. Idempotent: re-runs are no-ops.
  3. Validates with `nginx -t`. Reloads nginx via systemctl on success.
  4. On validation failure, restores the timestamped backup and re-validates.

Usage (must run as root on the Hetzner host):
  sudo python3 nginx-patch-public-discovery.py \
    --snippet /home/.../UNICORN_FINAL/scripts/nginx-public-discovery.snippet.conf \
    [--site /etc/nginx/sites-available/unicorn] \
    [--target /etc/nginx/snippets/zeus-public-discovery.conf] \
    [--domain zeusai.pro]
"""

import argparse
import datetime
import os
import re
import shutil
import subprocess
import sys


INCLUDE_FILENAME = "zeus-public-discovery.conf"


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _write(path, content):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp, path)


def _find_server_blocks(text):
    """Yield (start, end, body) for every top-level `server { ... }` block.

    Brace-aware scanner — survives nested locations and quoted/escaped braces
    inside string literals (which nginx does not actually use at the conf
    level, but we stay conservative).
    """
    out = []
    i = 0
    n = len(text)
    while i < n:
        m = re.search(r"\bserver\s*\{", text[i:])
        if not m:
            break
        start = i + m.start()
        body_start = i + m.end()  # position right after the opening `{`
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
    # Look at the immediate body of this server block (ignore nested `server`
    # which nginx does not allow anyway).
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
    # Find the first `{` (the server-block opener)
    idx = block.find("{")
    if idx < 0:
        return block  # safety
    return block[: idx + 1] + line + block[idx + 1 :]


def patch_site_config(site_path, include_path, domain):
    text = _read(site_path)
    blocks = _find_server_blocks(text)
    if not blocks:
        return text, 0
    # Walk blocks in reverse so we can splice without invalidating earlier indices
    new_text = text
    edits = 0
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--snippet",
        required=True,
        help="path to nginx-public-discovery.snippet.conf",
    )
    ap.add_argument(
        "--site",
        default="/etc/nginx/sites-available/unicorn",
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
    print(f"[nginx-patch] snippet installed at {args.target}")

    if not os.path.isfile(args.site):
        # No active unicorn site — nothing to patch. Snippet is in place,
        # so when the file appears later it can `include` it. Validate and exit.
        print(
            f"[nginx-patch] {args.site} not present yet — snippet ready for future include"
        )
        v = nginx_validate()
        if v.returncode != 0:
            print(v.stderr or v.stdout, file=sys.stderr)
            sys.exit(1)
        nginx_reload()
        sys.exit(0)

    # 2) Backup and patch
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backup = f"{args.site}.bak.{ts}"
    shutil.copyfile(args.site, backup)
    print(f"[nginx-patch] backup → {backup}")

    new_text, edits = patch_site_config(args.site, args.target, args.domain)
    if edits == 0:
        print("[nginx-patch] no edits needed (already includes snippet)")
    else:
        _write(args.site, new_text)
        print(f"[nginx-patch] injected include into {edits} server block(s)")

    # 3) Validate
    v = nginx_validate()
    if v.returncode != 0:
        print("[nginx-patch] VALIDATION FAILED — restoring backup")
        sys.stderr.write((v.stderr or v.stdout) + "\n")
        shutil.copyfile(backup, args.site)
        v2 = nginx_validate()
        if v2.returncode == 0:
            nginx_reload()
        sys.exit(1)

    # 4) Reload
    r = nginx_reload()
    if r.returncode != 0:
        print("[nginx-patch] reload FAILED — restoring backup")
        sys.stderr.write((r.stderr or r.stdout) + "\n")
        shutil.copyfile(backup, args.site)
        nginx_validate()
        nginx_reload()
        sys.exit(1)

    print("[nginx-patch] reloaded OK")


if __name__ == "__main__":
    main()
