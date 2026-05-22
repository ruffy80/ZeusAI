#!/bin/sh
set -eu

AUTONOMY_ROOT="${AUTONOMY_ROOT:-/opt/unicorn}"
LOG_PATH="${AUTONOMOUS_ACTION_LOG_PATH:-/var/log/autonomous_actions.log}"
SANDBOX_ROOT="${SANDBOX_ROOT:-$AUTONOMY_ROOT/sandbox}"
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p "$(dirname "$LOG_PATH")"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

[ -x "$SCRIPT_DIR/generate-dead-code-candidates.js" ] || [ -f "$SCRIPT_DIR/generate-dead-code-candidates.js" ]
node "$SCRIPT_DIR/generate-dead-code-candidates.js" >/dev/null 2>&1 || true

TEMP_DELETED=$(find "$AUTONOMY_ROOT/temp" -type f -mtime +7 2>/dev/null | wc -l | tr -d ' ')
BACKUP_DELETED=$(find "$AUTONOMY_ROOT/old_backups" -type f -mtime +30 2>/dev/null | wc -l | tr -d ' ')
LOG_DELETED=$(find "$AUTONOMY_ROOT/logs-old" -type f -mtime +7 2>/dev/null | wc -l | tr -d ' ')

find "$AUTONOMY_ROOT/temp" -type f -mtime +7 -delete 2>/dev/null || true
find "$AUTONOMY_ROOT/old_backups" -type f -mtime +30 -delete 2>/dev/null || true
find "$AUTONOMY_ROOT/logs-old" -type f -mtime +7 -delete 2>/dev/null || true

DEAD_CODE_FILE="$SANDBOX_ROOT/dead-code-candidates.json"
SANDBOX_REPO="$SANDBOX_ROOT/repo"
DEAD_CODE_REMOVED=0
if [ -f "$DEAD_CODE_FILE" ] && [ -d "$SANDBOX_ROOT/repo" ]; then
  if (cd "$SANDBOX_ROOT/repo" && npm test --silent >/dev/null 2>&1); then
        export DEAD_CODE_FILE SANDBOX_REPO
        DEAD_CODE_REMOVED=$(python3 - <<'PY'
import json, os
removed = 0
file_path = os.environ['DEAD_CODE_FILE']
sandbox_repo = os.environ['SANDBOX_REPO']
if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as fh:
        data = json.load(fh)
    for item in data[:10]:
        rel = item.get('path') if isinstance(item, dict) else None
        if not rel:
            continue
        target = os.path.normpath(os.path.join(sandbox_repo, rel))
        if not target.startswith(os.path.normpath(sandbox_repo) + os.sep):
            continue
        if os.path.isfile(target):
            os.remove(target)
            removed += 1
print(removed)
PY
)
  fi
fi

printf '{"ts":"%s","kind":"weekly_auto_clean","tempDeleted":%s,"backupDeleted":%s,"staleLogsDeleted":%s,"sandboxDeadCodeRemoved":%s}\n' \
  "$TS" "$TEMP_DELETED" "$BACKUP_DELETED" "$LOG_DELETED" "$DEAD_CODE_REMOVED" >> "$LOG_PATH"
