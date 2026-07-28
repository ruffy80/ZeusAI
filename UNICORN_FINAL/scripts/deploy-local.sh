#!/usr/bin/env bash
# deploy-local.sh — SAFE manual deploy to Hetzner WITHOUT GitHub Actions.
# ---------------------------------------------------------------------------
# Ships a clean release of a git ref straight to the live server and runs the
# canary-gated, atomic deploy-atomic-forward.sh — exactly what GitHub Actions
# and the on-server poller do. Use this when GitHub is unavailable.
#
# IMPORTANT — the live app runs on **PM2 + nginx** from /var/www/unicorn (release
# symlink). It is NOT docker-compose. Docker on the box only runs sidecars
# (redis/postgres/netdata bound to 127.0.0.1). NEVER `docker-compose down/up`
# the app — it would collide with nginx+PM2 on :80/:443/:3000 and cause an
# outage. This script deliberately avoids docker entirely.
#
# Usage:
#   scripts/deploy-local.sh [git-ref]      # default: origin/main
#   ZEUS_SSH_KEY=~/.ssh/hetzner scripts/deploy-local.sh origin/main
#
# Env: ZEUS_HOST (204.168.230.142), ZEUS_USER (root), ZEUS_SSH_KEY
#      (~/.ssh/deploy_key), ZEUS_PUBLIC_URL (https://zeusai.pro)
# ---------------------------------------------------------------------------
set -euo pipefail

REF="${1:-origin/main}"
HOST="${ZEUS_HOST:-204.168.230.142}"
USER="${ZEUS_USER:-root}"
KEY="${ZEUS_SSH_KEY:-}"
PUBLIC_URL="${ZEUS_PUBLIC_URL:-https://zeusai.pro}"
DEPLOY_LINK="/var/www/unicorn/UNICORN_FINAL"
RELEASE_ROOT="/var/www/unicorn/releases"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # repo root
cd "$ROOT"

# Prefer Cursor Cloud SSH agent, then explicit key files.
if [ -z "${SSH_AUTH_SOCK:-}" ] && [ -S /run/host-services/ssh-auth.sock ]; then
  export SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock
fi
if [ -z "$KEY" ]; then
  for cand in "$HOME/.ssh/deploy_key" "$HOME/.ssh/hetzner_rsa" "$HOME/.ssh/id_ed25519"; do
    [ -f "$cand" ] && KEY="$cand" && break
  done
fi
SSHK=(-o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20)
if [ -n "$KEY" ] && [ -f "$KEY" ]; then
  SSHK=(-i "$KEY" "${SSHK[@]}")
elif [ -n "${SSH_AUTH_SOCK:-}" ]; then
  echo "[deploy-local] using SSH agent at $SSH_AUTH_SOCK (no key file)"
else
  echo "SSH key not found and no SSH agent (set ZEUS_SSH_KEY or start agent)"; exit 1
fi

git fetch origin --quiet 2>/dev/null || echo "[deploy-local] warn: git fetch failed (offline?) — using local objects"
SHA="$(git rev-parse "$REF")"
echo "[deploy-local] deploying $REF ($SHA) -> $USER@$HOST"

# Build a clean tree of the exact ref (never the dirty/self-mutated working tree),
# pruned the same way CI prunes so live shared state (.env/data/db) is preserved.
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
git archive "$SHA" | tar -x -C "$STAGE"
( cd "$STAGE" && rm -rf \
    UNICORN_FINAL/data UNICORN_FINAL/db UNICORN_FINAL/logs UNICORN_FINAL/backups \
    UNICORN_FINAL/snapshots UNICORN_FINAL/generated UNICORN_FINAL/public \
    UNICORN_FINAL/.archive UNICORN_FINAL/.unicorn-backups UNICORN_FINAL/node_modules \
    logs backups snapshots .archive node_modules 2>/dev/null || true )
find "$STAGE" -maxdepth 2 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | { grep -v example || true; } | xargs -r rm -f || true

REL="$RELEASE_ROOT/${SHA}-$(date +%s)"
ssh "${SSHK[@]}" "$USER@$HOST" "mkdir -p '$REL'"
tar czf - -C "$STAGE" . | ssh "${SSHK[@]}" "$USER@$HOST" "tar xzf - -C '$REL'"

# Canary-gated atomic promote + PM2 restart. HOME=/root so PM2 targets the live
# daemon (/root/.pm2), not /etc/.pm2.
ssh "${SSHK[@]}" "$USER@$HOST" "export HOME=/root; chmod +x '$REL/UNICORN_FINAL/scripts/'*.sh 2>/dev/null || true; GITHUB_SHA='$SHA' PUBLIC_URL='$PUBLIC_URL' bash '$REL/UNICORN_FINAL/scripts/deploy-atomic-forward.sh' '$REL/UNICORN_FINAL' '$DEPLOY_LINK'"

# Post-promote: reap orphan node backend/index.js (PPID=1) that can thrash PM2.
ssh "${SSHK[@]}" "$USER@$HOST" "ORPHAN_REAPER_APPLY=1 bash '$DEPLOY_LINK/scripts/orphan-backend-reaper.sh'" \
  || echo "[deploy-local] warn: orphan-reaper non-fatal"

# Soft-arm Total Autonomy OS SAFE loops (admin secret from shared .env if present).
ssh "${SSHK[@]}" "$USER@$HOST" 'bash -s' <<'REMOTE' || echo "[deploy-local] warn: taos arm non-fatal"
set +e
DEPLOY_LINK="${DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
ENVF="/var/www/unicorn/shared/.env"
SECRET=""
if [ -f "$ENVF" ]; then
  SECRET="$(grep -E '^ADMIN_SECRET=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -n "$SECRET" ]; then
  curl -sk -X POST -H "x-admin-secret: $SECRET" -H "content-type: application/json" \
    --max-time 15 "http://127.0.0.1:3000/api/autonomy/os/arm" >/tmp/taos-arm.json 2>/dev/null \
    && echo "[deploy-local] taos arm: $(head -c 200 /tmp/taos-arm.json)" \
    || echo "[deploy-local] taos arm curl skipped/failed"
else
  echo "[deploy-local] no ADMIN_SECRET — skip remote arm (TAOS still scores on boot)"
fi
curl -sk --max-time 10 "http://127.0.0.1:3000/api/autonomy/score" || true
REMOTE

# Install MINIMAL nginx overlay for /.well-known/autonomy.json → site :3001.
# The full nginx-public-discovery.snippet.conf collides with locations already
# present in zeusai.conf (/api/eop, /api/lightning, …) and must NOT be copied
# wholesale into /etc/nginx/snippets on this host.
ssh "${SSHK[@]}" "$USER@$HOST" 'bash -s' <<'REMOTE' || echo "[deploy-local] warn: nginx/cron ops non-fatal"
set +e
DEPLOY_LINK="${DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
mkdir -p /var/log/unicorn /etc/nginx/snippets
cat > /etc/nginx/snippets/zeus-public-discovery.conf <<'EOF'
# Minimal Zeus discovery overlay (production-safe).
# Full snippet collides with zeusai.conf — keep ONLY autonomy + platform here.
location = /.well-known/autonomy.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
# Neural Autonomy OS (NAOS/1.0) — served by the backend on :3000.
location = /.well-known/neural-autonomy.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
# Site↔Unicorn Bond OS (SUBOS/1.0) — served by the backend on :3000.
location = /.well-known/autonomy-bond.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
# Platform Foundation OS (PFOS/1.0) — served by the backend on :3000.
location = /.well-known/platform.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
# Enterprise Standard OS (ESOS/1.0) — served by the backend on :3000.
location = /.well-known/enterprise.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
# Forever Ed25519 site-sign key — MUST beat generic /.well-known/ deny (403).
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
# Triad Never-Down Bond OS (TBOS/1.0) — served by the backend on :3000.
location = /.well-known/triad-bond.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store" always;
}
# Chromatic Identity Continuum (CIC/1.0) — 40y brand spectrum.
location = /.well-known/brand-spectrum.json {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=60" always;
}
# World Dropship Continuum (WDOS/1.0) — permanent global product feed.
location = /.well-known/world-dropship.json {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=30" always;
}
location = /.well-known/module-reality.json {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=60" always;
}
location = /.well-known/clos.json {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=15" always;
}
location = /.well-known/aacos.json {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=10" always;
}
EOF
# Install additive security-headers snippet (server_tokens off + nosniff etc).
# Written verbatim from scripts/nginx-security-headers.snippet.conf. This only
# installs the snippet file; whether it is `include`d is left to the live
# zeusai.conf (we never wholesale-rewrite it here).
SEC_SRC="$DEPLOY_LINK/scripts/nginx-security-headers.snippet.conf"
if [ -f "$SEC_SRC" ]; then
  install -m 0644 "$SEC_SRC" /etc/nginx/snippets/zeus-security-headers.conf \
    && echo "[deploy-local] installed /etc/nginx/snippets/zeus-security-headers.conf"
else
  cat > /etc/nginx/snippets/zeus-security-headers.conf <<'EOF'
server_tokens off;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Permitted-Cross-Domain-Policies "none" always;
EOF
  echo "[deploy-local] wrote fallback /etc/nginx/snippets/zeus-security-headers.conf"
fi
if nginx -t 2>/tmp/nginx-t.out; then
  systemctl reload nginx && echo "[deploy-local] nginx autonomy overlay reloaded" \
    || echo "[deploy-local] nginx reload failed (non-fatal)"
else
  echo "[deploy-local] nginx -t failed — left previous config running:"
  tail -5 /tmp/nginx-t.out 2>/dev/null
fi
CRON_SRC="$DEPLOY_LINK/scripts/cron/unicorn-orphan-reaper.cron"
if [ -f "$CRON_SRC" ]; then
  install -m 0644 "$CRON_SRC" /etc/cron.d/unicorn-orphan-reaper
  echo "[deploy-local] installed /etc/cron.d/unicorn-orphan-reaper (dry-run)"
fi
REMOTE

# Post-deploy health is informational only — the canary + smoke inside
# deploy-atomic-forward.sh already gated the promote, so a flaky external curl
# here must not mark the deploy as failed.
echo -n "[deploy-local] live health: "; curl -sk -o /dev/null -w "https %{http_code}\n" --max-time 20 "$PUBLIC_URL/health" || echo "(post-check curl timed out; deploy already verified by canary+smoke)"
echo -n "[deploy-local] taos score: "; curl -sk --max-time 15 "$PUBLIC_URL/api/autonomy/score" || echo "(taos score check skipped)"
echo -n "[deploy-local] autonomy well-known: "; curl -sk -o /dev/null -w "%{http_code}\n" --max-time 15 "$PUBLIC_URL/.well-known/autonomy.json" || echo "(skipped)"
echo "[deploy-local] done — deployed $SHA"
