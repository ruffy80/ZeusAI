#!/usr/bin/env python3
"""
heal-nginx-wellknown-root-alias.py
----------------------------------
Live nginx on zeusai.pro historically aliased /.well-known/ and ads.txt to
/root/.unicorn_temp/... — www-data cannot traverse /root (mode 700), so every
request returned 403 Permission denied.

This healer rewrites those filesystem aliases to proxy_pass :3001 (unicorn-site),
matching scripts/nginx-unicorn.conf. Idempotent.

Usage (root on Hetzner):
  python3 heal-nginx-wellknown-root-alias.py [--site /etc/nginx/sites-enabled/zeusai.conf]
"""
from __future__ import annotations

import argparse
import datetime
import pathlib
import re
import shutil
import subprocess
import sys

PROXY_WELLKNOWN = """\
    location ^~ /.well-known/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-CSP-Nonce $request_id;
    }
"""

PROXY_ADS = """\
    location = /ads.txt {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""

EXACT_SECURITY = """\
    location = /.well-known/security.txt {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""

EXACT_ZEUSAI = """\
    location = /.well-known/zeusai.json {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Cache-Control "public, max-age=300" always;
    }
"""


def replace_location(src: str, opener_re: str, replacement: str) -> tuple[str, bool]:
    m = re.search(opener_re, src, flags=re.M)
    if not m:
        return src, False
    start = m.start()
    brace = src.find("{", m.start())
    if brace < 0:
        return src, False
    depth = 0
    end = None
    for i in range(brace, len(src)):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        return src, False
    return src[:start] + replacement.strip("\n") + src[end:], True


def ensure_block(src: str, needle: str, block: str) -> tuple[str, bool]:
    if needle in src:
        return src, False
    m = re.search(r"location\s+\^~\s+/\.well-known/", src)
    if not m:
        return src, False
    return src[: m.start()] + block.strip("\n") + "\n" + src[m.start() :], True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="/etc/nginx/sites-enabled/zeusai.conf")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    site = pathlib.Path(args.site)
    if not site.exists():
        for cand in (
            "/etc/nginx/sites-available/zeusai.conf",
            "/etc/nginx/sites-enabled/unicorn",
            "/etc/nginx/sites-available/unicorn",
        ):
            if pathlib.Path(cand).exists():
                site = pathlib.Path(cand)
                break
    if not site.exists():
        print("ERROR: site config not found", file=sys.stderr)
        return 2

    original = site.read_text(encoding="utf-8", errors="replace")
    src = original
    notes: list[str] = []

    if re.search(r"alias\s+/root/", src) or "unicorn_temp" in src:
        src2, ok = replace_location(src, r"location\s+\^~\s+/\.well-known/\s*\{", PROXY_WELLKNOWN)
        if ok:
            src = src2
            notes.append("rewrote ^~ /.well-known/ /root alias → proxy :3001")
        src2, ok = replace_location(src, r"location\s+=\s+/ads\.txt\s*\{", PROXY_ADS)
        if ok:
            src = src2
            notes.append("rewrote /ads.txt /root alias → proxy :3001")
        # single-line ads.txt
        src3, n = re.subn(
            r"location\s+=\s+/ads\.txt\s*\{\s*alias\s+/root/[^;]+;\s*\}",
            PROXY_ADS.strip(),
            src,
            count=1,
        )
        if n:
            src = src3
            notes.append("rewrote single-line /ads.txt alias")

    src, ok = ensure_block(src, "location = /.well-known/security.txt", EXACT_SECURITY)
    if ok:
        notes.append("added exact /.well-known/security.txt proxy")
    src, ok = ensure_block(src, "location = /.well-known/zeusai.json", EXACT_ZEUSAI)
    if ok:
        notes.append("added exact /.well-known/zeusai.json proxy")

    # Catch-all must never remain a /root alias even if rewrite above missed.
    if re.search(r"location\s+\^~\s+/\.well-known/[\s\S]{0,200}alias\s+/root/", src):
        src2, ok = replace_location(src, r"location\s+\^~\s+/\.well-known/\s*\{", PROXY_WELLKNOWN)
        if ok:
            src = src2
            notes.append("force-rewrote remaining well-known /root alias")

    if src == original:
        print("already healthy — no changes")
        for n in notes:
            print(" ·", n)
        return 0

    for n in notes:
        print(" ·", n)

    if args.dry_run:
        print("dry-run: would write", site, "delta_bytes", len(src) - len(original))
        return 0

    stamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    # NEVER write backups into sites-enabled/ — nginx loads every file there and
    # duplicate limit_req_zone / server blocks make `nginx -t` fail.
    bak_dir = pathlib.Path("/etc/nginx/bak")
    bak_dir.mkdir(parents=True, exist_ok=True)
    bak = bak_dir / f"{site.name}.bak-wellknown-{stamp}"
    shutil.copy2(site, bak)
    site.write_text(src, encoding="utf-8")
    print("wrote", site, "backup", bak)

    t = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    sys.stderr.write(t.stderr or "")
    sys.stdout.write(t.stdout or "")
    if t.returncode != 0:
        shutil.copy2(bak, site)
        print("ERROR: nginx -t failed — restored backup", file=sys.stderr)
        return 1
    subprocess.check_call(["systemctl", "reload", "nginx"])
    print("nginx reloaded OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
