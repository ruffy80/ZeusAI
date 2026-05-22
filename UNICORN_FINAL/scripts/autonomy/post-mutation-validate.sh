#!/bin/sh
set -eu

ACTION="${1:-unknown}"
TARGET="${2:-}"
MODE="${3:-}"
AUTONOMY_ROOT="${AUTONOMY_ROOT:-/opt/unicorn}"
SANDBOX_ROOT="${SANDBOX_ROOT:-$AUTONOMY_ROOT/sandbox}"
APP_ROOT="${APP_ROOT:-/var/www/unicorn/UNICORN_FINAL}"
LOG_PATH="${AUTONOMOUS_ACTION_LOG_PATH:-/var/log/autonomous_actions.log}"
REPORT_DIR="$AUTONOMY_ROOT/reports"
SANDBOX_REPO="$SANDBOX_ROOT/repo"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$SANDBOX_REPO" "$REPORT_DIR" "$(dirname "$LOG_PATH")"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude logs \
    --exclude data/logs \
    "$APP_ROOT/" "$SANDBOX_REPO/"
else
  rm -rf "$SANDBOX_REPO"
  mkdir -p "$SANDBOX_REPO"
  cp -R "$APP_ROOT/." "$SANDBOX_REPO/"
  rm -rf "$SANDBOX_REPO/node_modules" "$SANDBOX_REPO/.git" "$SANDBOX_REPO/logs" "$SANDBOX_REPO/data/logs" 2>/dev/null || true
fi

TEST_OK=0
TEST_EXIT=0
TEST_STDOUT=""
TEST_STDERR=""
if [ -f "$SANDBOX_REPO/package.json" ]; then
  set +e
  TEST_OUTPUT="$(cd "$SANDBOX_REPO" && npm test --silent 2>&1)"
  TEST_EXIT=$?
  set -e
  if [ "$TEST_EXIT" -eq 0 ]; then
    TEST_OK=1
  fi
  TEST_STDOUT="$(printf '%s' "$TEST_OUTPUT" | tail -c 1600)"
fi

COMMIT_STATUS="skipped_no_repo_changes"
DEPLOY_STATUS="skipped"
if [ "$TEST_OK" -eq 1 ] && [ -d "$APP_ROOT/.git" ] && [ "${AUTONOMY_COMMIT_DEPLOY:-1}" = "1" ]; then
  if [ -n "$(git -C "$APP_ROOT" status --porcelain 2>/dev/null || true)" ]; then
    COMMIT_MSG="autonomy(${ACTION}): ${TARGET:-n/a}"
    if git -C "$APP_ROOT" add -A && git -C "$APP_ROOT" commit -m "$COMMIT_MSG" >/dev/null 2>&1; then
      if git -C "$APP_ROOT" push origin main >/dev/null 2>&1; then
        COMMIT_STATUS="pushed"
        if command -v pm2 >/dev/null 2>&1; then
          if pm2 reload unicorn-backend unicorn-site --update-env >/dev/null 2>&1; then
            DEPLOY_STATUS="pm2_reloaded"
          else
            DEPLOY_STATUS="pm2_reload_failed"
          fi
        else
          DEPLOY_STATUS="pm2_missing"
        fi
      else
        COMMIT_STATUS="push_failed"
      fi
    else
      COMMIT_STATUS="commit_failed"
    fi
  fi
fi

JSON_LINE=$(printf '{"ts":"%s","kind":"post_mutation_validation","action":"%s","target":"%s","mode":"%s","sandboxRepo":"%s","testsOk":%s,"testExit":%s,"commitStatus":"%s","deployStatus":"%s","testTail":%s}\n' \
  "$TS" "$ACTION" "$TARGET" "$MODE" "$SANDBOX_REPO" \
  "$( [ "$TEST_OK" -eq 1 ] && printf true || printf false )" \
  "$TEST_EXIT" "$COMMIT_STATUS" "$DEPLOY_STATUS" \
  "$(printf '%s' "$TEST_STDOUT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")

printf '%s' "$JSON_LINE" >> "$LOG_PATH"
printf '%s\n' "$JSON_LINE" > "$REPORT_DIR/post-mutation-last.json"
printf '%s\n' "$JSON_LINE"
