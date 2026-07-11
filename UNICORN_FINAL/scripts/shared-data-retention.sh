#!/usr/bin/env bash
set -euo pipefail

SHARED_ROOT="${UNICORN_SHARED_ROOT:-/var/www/unicorn/shared}"
STATE_DIR="${UNICORN_RETENTION_STATE_DIR:-/var/lib/unicorn-retention}"
MAX_BYTES="${UNICORN_JSONL_MAX_BYTES:-268435456}"
KEEP_LINES="${UNICORN_JSONL_KEEP_LINES:-100000}"
LOG_RETENTION_DAYS="${UNICORN_LOG_RETENTION_DAYS:-14}"
LEDGER_LOCK_WAIT_S="${UNICORN_LEDGER_LOCK_WAIT_S:-30}"
LEDGER_LOCK_STALE_S="${UNICORN_LEDGER_LOCK_STALE_S:-900}"

require_uint() {
  local name="$1" value="$2"
  case "$value" in
    ''|*[!0-9]*) printf 'invalid %s: %s\n' "$name" "$value" >&2; exit 2 ;;
  esac
  [ "$value" -gt 0 ] || { printf '%s must be greater than zero\n' "$name" >&2; exit 2; }
}

require_uint UNICORN_JSONL_MAX_BYTES "$MAX_BYTES"
require_uint UNICORN_JSONL_KEEP_LINES "$KEEP_LINES"
require_uint UNICORN_LOG_RETENTION_DAYS "$LOG_RETENTION_DAYS"
require_uint UNICORN_LEDGER_LOCK_WAIT_S "$LEDGER_LOCK_WAIT_S"
require_uint UNICORN_LEDGER_LOCK_STALE_S "$LEDGER_LOCK_STALE_S"

mkdir -p "$STATE_DIR"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE_DIR/run.lock"
  flock -n 9 || exit 0
else
  LOCK_DIR="$STATE_DIR/run.lock.d"
  mkdir "$LOCK_DIR" 2>/dev/null || exit 0
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
fi

compact_jsonl() {
  local file="$1"
  [ -f "$file" ] || return 0
  local size tmp lock_dir started lock_mtime now
  lock_dir="${file}.lock.d"
  started=$(date +%s)
  while ! mkdir "$lock_dir" 2>/dev/null; do
    now=$(date +%s)
    lock_mtime=$(stat -c%Y "$lock_dir" 2>/dev/null || stat -f%m "$lock_dir" 2>/dev/null || echo "$now")
    if [ $((now - lock_mtime)) -gt "$LEDGER_LOCK_STALE_S" ]; then
      rm -rf "$lock_dir" 2>/dev/null || true
      continue
    fi
    [ $((now - started)) -lt "$LEDGER_LOCK_WAIT_S" ] || {
      printf '%s skipped locked ledger %s\n' "$(date -u +%FT%TZ)" "$file" >&2
      return 0
    }
    sleep 1
  done

  size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
  if [ "$size" -le "$MAX_BYTES" ]; then
    rmdir "$lock_dir"
    return 0
  fi
  tmp="${file}.compact.$$"
  if ! tail -n "$KEEP_LINES" "$file" > "$tmp"; then
    rm -f "$tmp"
    rmdir "$lock_dir"
    return 1
  fi
  chmod --reference="$file" "$tmp" 2>/dev/null || chmod 600 "$tmp"
  chown --reference="$file" "$tmp" 2>/dev/null || true
  mv "$tmp" "$file"
  rmdir "$lock_dir"
  printf '%s compacted %s from %s to %s bytes\n' "$(date -u +%FT%TZ)" "$file" "$size" "$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file")"
}

compact_jsonl "$SHARED_ROOT/data/money-machine/offers.jsonl"
compact_jsonl "$SHARED_ROOT/data/revenue/autopilot-ledger.jsonl"
compact_jsonl "$SHARED_ROOT/data/money-machine/conversion-events.jsonl"
compact_jsonl "$SHARED_ROOT/data/money-machine/sales-leads.jsonl"
compact_jsonl "$SHARED_ROOT/data/money-machine/checkout-recovery.jsonl"

find "$SHARED_ROOT/logs" -maxdepth 1 -type f \( -name '*.log.*' -o -name '*.gz' \) -mtime +"$LOG_RETENTION_DAYS" -delete 2>/dev/null || true
find "$SHARED_ROOT/data" -type f -name '*.oversized.*.bak' -mtime +"$LOG_RETENTION_DAYS" -delete 2>/dev/null || true