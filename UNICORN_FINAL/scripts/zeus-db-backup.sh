#!/usr/bin/env bash
# zeus-db-backup.sh
# ---------------------------------------------------------------------------
# Consistent, rotated backups of the live SQLite databases (users, receipts,
# payments, entitlements, tenants). Uses better-sqlite3's online backup API so
# snapshots are transaction-consistent even while the app is writing (WAL).
#
# WHY: the main commerce DB (unicorn.db) had no recent backup — only a stale
# auth-only snapshot. On a platform that takes money this is the single highest
# data-loss risk. This runs hourly via systemd and keeps a rolling window.
#
# Offsite-ready: if ZEUS_BACKUP_RCLONE_REMOTE is set (e.g. "s3:bucket/zeus-db")
# and rclone is installed, each snapshot is also pushed offsite. Without it,
# backups stay local (still far better than none).
# ---------------------------------------------------------------------------
set -uo pipefail

DEPLOY_LINK="${ZEUS_DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}"
SHARED="${ZEUS_SHARED_ROOT:-/var/www/unicorn/shared}"
DATA_DIR="${ZEUS_DB_DATA_DIR:-$SHARED/data}"
DEST="${ZEUS_DB_BACKUP_DIR:-$SHARED/backups/db}"
KEEP="${ZEUS_DB_BACKUP_KEEP:-48}"
LOG_FILE="${ZEUS_DB_BACKUP_LOG:-/var/log/zeus-db-backup.log}"
LOCK_FILE="${ZEUS_DB_BACKUP_LOCK:-/var/run/zeus-db-backup.lock}"
RCLONE_REMOTE="${ZEUS_BACKUP_RCLONE_REMOTE:-}"

log() { printf '%s [db-backup] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE" >&2; }

exec 9>"$LOCK_FILE" 2>/dev/null || true
if command -v flock >/dev/null 2>&1; then flock -n 9 || { log "locked — skipping"; exit 0; }; fi

mkdir -p "$DEST"
cd "$DEPLOY_LINK" 2>/dev/null || { log "deploy link missing: $DEPLOY_LINK"; exit 1; }
[ -d node_modules/better-sqlite3 ] || { log "better-sqlite3 not found under $DEPLOY_LINK — abort"; exit 1; }

TS="$(date -u +%Y%m%dT%H%M%SZ)"
rc=0
for db in unicorn.db tenants.db; do
  SRC="$DATA_DIR/$db"
  [ -f "$SRC" ] || { log "skip (missing): $SRC"; continue; }
  OUT="$DEST/${db%.db}-${TS}.db"
  if node -e '
      const D = require("better-sqlite3");
      (async () => {
        try {
          const s = new D(process.argv[1], { readonly: true, fileMustExist: true });
          await s.backup(process.argv[2]);
          // integrity check on the snapshot
          const c = new D(process.argv[2], { readonly: true });
          const ok = c.pragma("integrity_check", { simple: true });
          c.close(); s.close();
          if (ok !== "ok") { console.error("integrity=" + ok); process.exit(2); }
          process.exit(0);
        } catch (e) { console.error(e && e.message); process.exit(1); }
      })();
    ' "$SRC" "$OUT"; then
    # The readonly integrity-check connection can leave WAL sidecars next to the
    # snapshot; drop them so only the single .gz artifact remains.
    rm -f "${OUT}-shm" "${OUT}-wal" 2>/dev/null || true
    gzip -f "$OUT" && log "✅ $db -> $(basename "$OUT").gz ($(du -h "$OUT.gz" 2>/dev/null | cut -f1))"
    if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
      rclone copy "$OUT.gz" "$RCLONE_REMOTE/" >>"$LOG_FILE" 2>&1 && log "  ↳ offsite: $RCLONE_REMOTE" || log "  ↳ offsite push FAILED"
    fi
  else
    log "❌ backup failed for $db"; rc=1; rm -f "$OUT" 2>/dev/null || true
  fi
done

# ── Rotation: keep newest $KEEP snapshots per db prefix ─────────────────────
for prefix in unicorn tenants; do
  ls -1t "$DEST/${prefix}-"*.db.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r f; do
    rm -f "$f" 2>/dev/null && log "pruned old: $(basename "$f")"
  done
done

exit "$rc"
