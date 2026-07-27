#!/usr/bin/env python3
"""
nginx-patch-public-discovery.py — idempotent injector for the public-discovery
snippet (/.well-known/*, /humans.txt, /offline.html, /agents.json).

Why this exists: server-doctor.sh refuses to overwrite
/etc/nginx/sites-available/unicorn once certbot has populated the file with
ssl_certificate directives (a full overwrite would wipe HTTPS until a fresh
certbot run). To still ship public-discovery routes, this script:

  1. Installs a collision-safe discovery snippet at
     /etc/nginx/snippets/zeus-public-discovery.conf
     (additive self-heal of required /.well-known/* proxies; NEVER wholesale-
     copies the full nginx-public-discovery.snippet.conf when it would
     duplicate /api/eop etc. already present in live zeusai.conf).
  2. Parses the active site config and injects
     `include /etc/nginx/snippets/zeus-public-discovery.conf;`
     into every `server { ... }` block whose `server_name` directive includes
     zeusai.pro or www.zeusai.pro — once. Idempotent: re-runs are no-ops.
  3. Validates with `nginx -t`. Reloads nginx via systemctl on success.
  4. On validation failure, restores the timestamped site + snippet backups.

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

# Production-safe bootstrap when the snippet file is missing. The FULL
# nginx-public-discovery.snippet.conf collides with locations already present
# in live zeusai.conf (/api/eop, /api/lightning, …) and must NOT be copied
# wholesale — that makes `nginx -t` fail and aborts reload (leaving new
# well-known routes like neural-autonomy.json at 403 forever).
_MINIMAL_SNIPPET = """# Minimal Zeus discovery overlay (production-safe).
# Additive well-known proxies only — never redeclare /api/* routes that live in zeusai.conf.
location = /.well-known/autonomy.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location = /.well-known/neural-autonomy.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location = /.well-known/autonomy-bond.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location = /.well-known/platform.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location = /.well-known/enterprise.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location = /.well-known/zeusai-key.pub {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=300" always;
}
location = /.well-known/zeusai-pubkey {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=300" always;
}
location = /.well-known/triad-bond.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
location = /.well-known/brand-spectrum.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=60" always;
}
"""

# Extra self-heal blocks that MUST exist inside the installed snippet.
# If the source snippet on disk is stale (older release without an autonomy
# route, for example), we append a minimal proxy block to the target so the
# route reaches the backend on :3000. Idempotent: we only append when the
# exact-match location is missing from the installed snippet.
_REQUIRED_LOCATIONS = [
    {
        "match": "location = /.well-known/autonomy.json",
        "block": (
            "\n"
            "# ── /.well-known/autonomy.json — TAOS/1.0 live score (self-heal) ──\n"
            "location = /.well-known/autonomy.json {\n"
            "    proxy_pass http://127.0.0.1:3000;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"no-store\" always;\n"
            "}\n"
        ),
    },
    {
        "match": "location = /.well-known/neural-autonomy.json",
        "block": (
            "\n"
            "# ── /.well-known/neural-autonomy.json — NAOS/1.0 (self-heal) ──\n"
            "location = /.well-known/neural-autonomy.json {\n"
            "    proxy_pass http://127.0.0.1:3000;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"no-store\" always;\n"
            "}\n"
        ),
    },
    {
        "match": "location = /.well-known/autonomy-bond.json",
        "block": (
            "\n"
            "# ── /.well-known/autonomy-bond.json — SUBOS/1.0 (self-heal) ──\n"
            "location = /.well-known/autonomy-bond.json {\n"
            "    proxy_pass http://127.0.0.1:3000;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"no-store\" always;\n"
            "}\n"
        ),
    },
    {
        "match": "location = /.well-known/zeusai-key.pub",
        "block": (
            "\n"
            "# ── /.well-known/zeusai-key.pub — forever site-sign key (self-heal) ──\n"
            "location = /.well-known/zeusai-key.pub {\n"
            "    proxy_pass http://127.0.0.1:3001;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"public, max-age=300\" always;\n"
            "}\n"
        ),
    },
    {
        "match": "location = /.well-known/zeusai-pubkey",
        "block": (
            "\n"
            "# ── /.well-known/zeusai-pubkey — forever key alias (self-heal) ──\n"
            "location = /.well-known/zeusai-pubkey {\n"
            "    proxy_pass http://127.0.0.1:3001;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"public, max-age=300\" always;\n"
            "}\n"
        ),
    },
    {
        "match": "location = /.well-known/triad-bond.json",
        "block": (
            "\n"
            "# ── /.well-known/triad-bond.json — TBOS/1.0 (self-heal) ──\n"
            "location = /.well-known/triad-bond.json {\n"
            "    proxy_pass http://127.0.0.1:3000;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"no-store\" always;\n"
            "}\n"
        ),
    },
    {
        "match": "location = /.well-known/brand-spectrum.json",
        "block": (
            "\n"
            "# ── /.well-known/brand-spectrum.json — CIC/1.0 (self-heal) ──\n"
            "location = /.well-known/brand-spectrum.json {\n"
            "    proxy_pass http://127.0.0.1:3000;\n"
            "    proxy_http_version 1.1;\n"
            "    proxy_set_header Host $host;\n"
            "    proxy_set_header X-Real-IP $remote_addr;\n"
            "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "    proxy_set_header X-Forwarded-Proto $scheme;\n"
            "    add_header Cache-Control \"public, max-age=60\" always;\n"
            "}\n"
        ),
    },
]


def _ensure_required_locations(target_path):
    """Read the installed snippet and append any REQUIRED_LOCATIONS whose
    exact-match `location` header is not already present. Returns the number
    of blocks appended (0 when the snippet is already complete)."""
    try:
        current = _read(target_path)
    except FileNotFoundError:
        return 0
    appended = 0
    for entry in _REQUIRED_LOCATIONS:
        if entry["match"] in current:
            continue
        current += entry["block"]
        appended += 1
    if appended:
        _write(target_path, current)
    return appended


def _snippet_looks_colliding(text):
    """Heuristic: full public-discovery snippet redeclares /api/* routes that
    already exist in live zeusai.conf (duplicate location → nginx -t fail)."""
    if not text:
        return False
    markers = (
        "location ^~ /api/eop",
        "location ^~ /api/lightning",
        "location ^~ /api/pre-keys",
    )
    return any(m in text for m in markers)


def _install_snippet(snippet_src, target_path):
    """Install or upgrade the discovery snippet without breaking nginx -t.

    Strategy:
      - Always backup existing target first (restored on validation failure).
      - If target exists: additive self-heal only (append missing REQUIRED).
        Never wholesale-overwrite a working minimal overlay with the full
        colliding snippet.
      - If target missing: write _MINIMAL_SNIPPET (safe), then ensure required.
      - If an existing target already looks like the full colliding snippet,
        rewrite it to minimal + required (so the next reload can succeed).

    Returns (snippet_backup_path_or_None, note).
    """
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    snippet_backup = None
    if os.path.isfile(target_path):
        ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        backup_dir = "/var/backups/zeus-nginx-public-discovery"
        try:
            os.makedirs(backup_dir, exist_ok=True)
            snippet_backup = os.path.join(
                backup_dir, f"{os.path.basename(target_path)}.bak.{ts}"
            )
            shutil.copyfile(target_path, snippet_backup)
        except OSError:
            snippet_backup = target_path + f".bak.{ts}"
            shutil.copyfile(target_path, snippet_backup)

        current = _read(target_path)
        if _snippet_looks_colliding(current):
            _write(target_path, _MINIMAL_SNIPPET)
            note = "replaced colliding full snippet with minimal overlay"
        else:
            note = "kept existing snippet (additive self-heal only)"
    else:
        # Prefer minimal bootstrap over wholesale full-snippet copy.
        # Keep --snippet arg for provenance / future diffs, but do not install
        # the full file when it would collide with live vhost locations.
        _write(target_path, _MINIMAL_SNIPPET)
        note = "installed minimal discovery overlay (full snippet skipped — collision-safe)"

    os.chmod(target_path, 0o644)
    appended = _ensure_required_locations(target_path)
    if appended:
        note += f"; appended {appended} required location(s)"
    # Optional: if caller passed a non-colliding custom snippet and target was
    # empty of autonomy routes, merge any exact well-known locations from src.
    if snippet_src and os.path.isfile(snippet_src):
        try:
            src = _read(snippet_src)
            if src and not _snippet_looks_colliding(src):
                # Rare path: a custom safe snippet — merge missing exact locations.
                tgt = _read(target_path)
                for m in re.finditer(
                    r"(location\s+=\s+/\.well-known/[^\s{]+)\s*\{", src
                ):
                    header = m.group(1).strip()
                    if header in tgt:
                        continue
                    # Extract full block from src for this location header.
                    start = m.start()
                    depth = 0
                    j = src.find("{", start)
                    if j < 0:
                        continue
                    depth = 1
                    k = j + 1
                    while k < len(src) and depth:
                        if src[k] == "{":
                            depth += 1
                        elif src[k] == "}":
                            depth -= 1
                        k += 1
                    block = src[start:k]
                    tgt += "\n" + block + "\n"
                    _write(target_path, tgt)
                    note += f"; merged {header} from source snippet"
                    tgt = _read(target_path)
        except OSError:
            pass
    return snippet_backup, note


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


CONFLICTING_LOCATION_PATHS = {
    "/.well-known/security.txt",
    "/security.txt",
    "/.well-known/agents.json",
    "/humans.txt",
}


def _remove_conflicting_locations(block):
    """Remove old exact location blocks for routes now served by the snippet.

    The active Hetzner vhost already contains some generated `location = ...`
    blocks for these paths, but they still return nginx-level 403. Including our
    fixed snippet beside them makes nginx fail with `duplicate location`. Remove
    only these exact public-discovery locations and leave every other route,
    including ACME and backend proxy locations, untouched.
    """
    pattern = re.compile(r"\blocation\s+(?:=\s*)?([^\s{]+)\s*\{")
    spans = []
    for match in pattern.finditer(block):
        location_path = match.group(1)
        if location_path not in CONFLICTING_LOCATION_PATHS:
            continue
        depth = 1
        cursor = match.end()
        while cursor < len(block) and depth > 0:
            if block[cursor] == "{":
                depth += 1
            elif block[cursor] == "}":
                depth -= 1
            cursor += 1
        if depth == 0:
            start = match.start()
            while start > 0 and block[start - 1] in " \t":
                start -= 1
            if start > 0 and block[start - 1] == "\n":
                start -= 1
            spans.append((start, cursor))

    if not spans:
        return block, 0

    cleaned = block
    for start, end in reversed(spans):
        cleaned = cleaned[:start] + cleaned[end:]
    return cleaned, len(spans)


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
        patched, removed = _remove_conflicting_locations(body)
        injected = 0
        if not _has_include(patched, include_path):
            patched = _inject_include(patched, include_path)
            injected = 1
        if removed == 0 and injected == 0:
            continue
        new_text = new_text[:start] + patched + new_text[end:]
        edits += removed + injected
    return new_text, edits


def nginx_validate():
    return subprocess.run(["nginx", "-t"], capture_output=True, text=True)


def nginx_reload():
    return subprocess.run(
        ["systemctl", "reload", "nginx"], capture_output=True, text=True
    )


def make_backup(site_path):
    """Create backups outside nginx include directories.

    Ubuntu nginx normally includes `/etc/nginx/sites-enabled/*`; a backup named
    `zeusai.conf.bak.<timestamp>` inside that directory is therefore parsed as a
    second site config and can duplicate top-level directives like
    `limit_req_zone`, making `nginx -t` fail. Keep backups in /var/backups.
    """
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backup_dir = "/var/backups/zeus-nginx-public-discovery"
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

    # 1) Install / self-heal snippet (collision-safe: never wholesale-copy the
    # full public-discovery file when it would duplicate /api/eop etc.).
    snippet_backup, note = _install_snippet(args.snippet, args.target)
    print(f"[nginx-patch] snippet at {args.target} — {note}")
    if snippet_backup:
        print(f"[nginx-patch] snippet backup → {snippet_backup}")

    if not os.path.isfile(args.site):
        # No active unicorn site — nothing to patch. Snippet is in place,
        # so when the file appears later it can `include` it. Validate and exit.
        print(
            f"[nginx-patch] {args.site} not present yet — snippet ready for future include"
        )
        v = nginx_validate()
        if v.returncode != 0:
            print(v.stderr or v.stdout, file=sys.stderr)
            if snippet_backup and os.path.isfile(snippet_backup):
                shutil.copyfile(snippet_backup, args.target)
            sys.exit(1)
        nginx_reload()
        sys.exit(0)

    # 2) Backup and patch
    backup = make_backup(args.site)
    print(f"[nginx-patch] backup → {backup}")

    new_text, edits = patch_site_config(args.site, args.target, args.domain)
    if edits == 0:
        print("[nginx-patch] no edits needed (already includes snippet)")
    else:
        _write(args.site, new_text)
        print(f"[nginx-patch] injected include into {edits} server block(s)")

    def _restore_all():
        shutil.copyfile(backup, args.site)
        if snippet_backup and os.path.isfile(snippet_backup):
            shutil.copyfile(snippet_backup, args.target)

    # 3) Validate
    v = nginx_validate()
    if v.returncode != 0:
        print("[nginx-patch] VALIDATION FAILED — restoring backup")
        sys.stderr.write((v.stderr or v.stdout) + "\n")
        _restore_all()
        v2 = nginx_validate()
        if v2.returncode == 0:
            nginx_reload()
        sys.exit(1)

    # 4) Reload
    r = nginx_reload()
    if r.returncode != 0:
        print("[nginx-patch] reload FAILED — restoring backup")
        sys.stderr.write((r.stderr or r.stdout) + "\n")
        _restore_all()
        nginx_validate()
        nginx_reload()
        sys.exit(1)

    print("[nginx-patch] reloaded OK")


if __name__ == "__main__":
    main()
