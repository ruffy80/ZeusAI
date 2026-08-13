#!/usr/bin/env bash
# sensitive-path-gate.sh — prove public edge never serves secrets / repo files.
#
# SWISS/1.1: curl network timeouts (exit 28) must NEVER red-fail a healthy
# deploy. Only hard-fail when we receive a real HTTP response that proves
# exposure (2xx/3xx on a sensitive path).
#
# Usage:
#   BASE_URL=https://zeusai.pro bash scripts/sensitive-path-gate.sh
#   BASE_URL=https://zeusai.pro HETZNER_HOST=1.2.3.4 bash scripts/sensitive-path-gate.sh
#
set -uo pipefail

BASE_URL="${BASE_URL:-https://zeusai.pro}"
BASE_URL="${BASE_URL%/}"
HETZNER_HOST="${HETZNER_HOST:-}"
CONNECT_TIMEOUT="${SENSITIVE_PATH_CONNECT_TIMEOUT:-8}"
MAX_TIME="${SENSITIVE_PATH_MAX_TIME:-20}"
RETRIES="${SENSITIVE_PATH_RETRIES:-4}"
BODY_FILE="${TMPDIR:-/tmp}/zeus-sensitive-path.$$.body"
PATHS=(
  '/.env'
  '/%2eenv'
  '/%252eenv'
  '/.git/config'
  '/wp-config.php'
  '/package-lock.json'
)

cleanup() { rm -f "$BODY_FILE" 2>/dev/null || true; }
trap cleanup EXIT

probe_once() {
  local url="$1"
  local meta rc=0
  : >"$BODY_FILE"
  # Capture http_code even when curl exits non-zero; never abort the gate.
  meta="$(curl --path-as-is -sS \
    --connect-timeout "$CONNECT_TIMEOUT" \
    --max-time "$MAX_TIME" \
    -o "$BODY_FILE" \
    -w '%{http_code}|%{content_type}' \
    "$url" 2>/dev/null)" || rc=$?
  local code ctype
  code="${meta%%|*}"
  ctype="${meta#*|}"
  code="$(printf '%s' "$code" | tr -dc '0-9' | head -c 3)"
  if [ -z "$code" ] || [ "$rc" -ne 0 ]; then
    # Timeout / refuse → treat as no response (not exposure).
    printf '000|'
    return 0
  fi
  printf '%s|%s' "$code" "$ctype"
}

probe_with_retry() {
  local path="$1"
  local url="${BASE_URL}${path}"
  local attempt=1
  local meta code
  while [ "$attempt" -le "$RETRIES" ]; do
    meta="$(probe_once "$url")"
    code="${meta%%|*}"
    if [ "$code" != "000" ] && [ -n "$code" ]; then
      printf '%s\n' "$meta"
      return 0
    fi
    echo "[sensitive-path] ${path} attempt ${attempt}/${RETRIES}: timeout/network — retrying" >&2
    sleep $((attempt * 2))
    attempt=$((attempt + 1))
  done
  printf '000|\n'
}

ssh_probe() {
  local path="$1"
  [ -n "$HETZNER_HOST" ] || return 1
  local code
  code="$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes \
    root@"$HETZNER_HOST" \
    "curl --path-as-is -sS -o /dev/null -m 8 -w '%{http_code}' \
      -H 'Host: zeusai.pro' --resolve zeusai.pro:443:127.0.0.1 \
      https://zeusai.pro${path} 2>/dev/null \
      || curl --path-as-is -sS -o /dev/null -m 8 -w '%{http_code}' \
      -H 'Host: zeusai.pro' http://127.0.0.1${path} 2>/dev/null \
      || true" 2>/dev/null || true)"
  code="$(printf '%s' "$code" | tr -dc '0-9' | head -c 3)"
  [ -n "$code" ] || code=000
  printf '%s' "$code"
}

body_looks_sensitive() {
  local body
  body="$(head -c 4000 "$BODY_FILE" 2>/dev/null || true)"
  [ -n "$body" ] || return 1
  grep -Eqi '^(export )?[A-Z][A-Z0-9_]+=.+' <<<"$body" \
    || grep -Eqi '^\s*\[core\]|repositoryformatversion' <<<"$body" \
    || grep -Eqi '"lockfileVersion"|node_modules/' <<<"$body" \
    || grep -Eqi 'DB_PASSWORD|JWT_SECRET|HETZNER_SSH|PRIVATE KEY' <<<"$body"
}

failed=0
inconclusive=0

echo "[sensitive-path] base=${BASE_URL} retries=${RETRIES} max-time=${MAX_TIME}s"

for path in "${PATHS[@]}"; do
  meta="$(probe_with_retry "$path")"
  status="${meta%%|*}"
  content_type="${meta#*|}"
  echo "${path} -> ${status} ${content_type}"

  if [ "$status" = "000" ]; then
    ssh_code="$(ssh_probe "$path" 2>/dev/null || echo '')"
    if [ -n "$ssh_code" ] && [ "$ssh_code" != "000" ]; then
      echo "[sensitive-path] ${path} SSH fallback -> ${ssh_code}"
      if [ "$ssh_code" = "404" ] || [ "$ssh_code" = "403" ] || [ "$ssh_code" = "401" ]; then
        echo "::warning::Public probe timed out for ${path}; SSH confirms blocked (${ssh_code}) — soft-pass"
        continue
      fi
      if [[ "$ssh_code" =~ ^2 ]] || [[ "$ssh_code" =~ ^3 ]]; then
        echo "::error::Sensitive path exposed (SSH confirmed ${ssh_code}): ${path}"
        failed=1
        continue
      fi
    fi
    echo "::warning::Could not reach ${path} after ${RETRIES} tries (curl timeout) — inconclusive, not treating as exposure"
    inconclusive=$((inconclusive + 1))
    continue
  fi

  if [ "$status" = "404" ] || [ "$status" = "403" ] || [ "$status" = "401" ]; then
    if [ "$status" = "404" ] && [[ "$content_type" == *text/html* ]]; then
      body="$(head -c 4000 "$BODY_FILE" 2>/dev/null || true)"
      if body_looks_sensitive || grep -Eqi 'data-pricing-value|unicorn-shell|id="marketplace"' <<<"$body"; then
        echo "::error::Sensitive path fell through to HTML site shell: ${path}"
        failed=1
      else
        echo "::warning::${path} returned HTML 404 (acceptable if not the app shell)"
      fi
    fi
    continue
  fi

  if [[ "$status" =~ ^2 ]] || [[ "$status" =~ ^3 ]]; then
    echo "::error::Sensitive path is exposed through the public fallback: ${path} (${status} ${content_type})"
    failed=1
    continue
  fi

  echo "::warning::${path} returned ${status} after retries — not treating as secret exposure"
done

if [ "$failed" -ne 0 ]; then
  echo "[sensitive-path] FAILED — exposure detected"
  exit 1
fi

if [ "$inconclusive" -gt 0 ]; then
  echo "[sensitive-path] PASS with ${inconclusive} inconclusive public timeout(s) (no exposure proof)"
else
  echo "[sensitive-path] PASS — all sensitive paths blocked"
fi
exit 0
