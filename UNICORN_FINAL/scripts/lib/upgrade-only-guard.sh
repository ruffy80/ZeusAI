#!/usr/bin/env bash
# upgrade-only-guard.sh — HARD contract: never promote a downgrade.
# ---------------------------------------------------------------------------
# Source this file from deploy scripts, then call:
#
#   upgrade_only_guard <live_sha> <candidate_sha> [commit_subject]
#
# Exit codes:
#   0  allow deploy (upgrade, same SHA, cold-start, or divergent reunite)
#   1  refuse (true downgrade, or unapproved divergent)
#
# Prints one token on stdout for logging: UPGRADE | SAME | COLD | REUNITE |
# DOWNGRADE | DIVERGENT | INCOMPLETE
#
# Rules (immutable):
#   1. NEW is a descendant of CUR          → UPGRADE (always allow)
#   2. NEW == CUR                         → SAME (caller usually no-ops)
#   3. CUR empty / unknown                → COLD (allow first pin)
#   4. NEW is an ancestor of CUR          → DOWNGRADE — ALWAYS refuse
#      (even with [force-deploy] / ZEUS_ALLOW_DIVERGENT_REUNITE)
#   5. Neither is ancestor of the other   → DIVERGENT
#      allow ONLY if subject contains [force-deploy]
#      OR ZEUS_ALLOW_DIVERGENT_REUNITE=1
#      (squash/SSH reunite — canary still gates the promote)
#   6. Candidate SHA missing from mirror / ancestry graph incomplete
#      → INCOMPLETE (NOT DIVERGENT). Callers must fetch or trust CI.
#      Never treat a missing brand-new Actions tip as "need [force-deploy]".
# ---------------------------------------------------------------------------

upgrade_only_guard() {
  local CUR="${1:-}"
  local NEW="${2:-}"
  local SUBJECT="${3:-}"
  local MB=""

  CUR="$(printf '%s' "$CUR" | tr -d '[:space:]')"
  NEW="$(printf '%s' "$NEW" | tr -d '[:space:]')"

  if [ -z "$NEW" ]; then
    printf 'INCOMPLETE\n'
    return 1
  fi
  if [ -z "$CUR" ]; then
    printf 'COLD\n'
    return 0
  fi
  if [ "$CUR" = "$NEW" ]; then
    printf 'SAME\n'
    return 0
  fi

  # Need a git repo cwd with both objects resolvable.
  if ! git cat-file -e "${CUR}^{commit}" 2>/dev/null; then
    # Live SHA not in this mirror — treat as reunite/cold; never as downgrade.
    printf 'COLD\n'
    return 0
  fi
  if ! git cat-file -e "${NEW}^{commit}" 2>/dev/null; then
    # Brand-new Actions tip often arrives before the on-box mirror fetches.
    # That is NOT a history fork — callers refresh the mirror or trust CI.
    printf 'INCOMPLETE\n'
    return 1
  fi

  if git merge-base --is-ancestor "$CUR" "$NEW" 2>/dev/null; then
    printf 'UPGRADE\n'
    return 0
  fi

  # True downgrade: candidate is strictly behind live. NEVER bypass.
  if git merge-base --is-ancestor "$NEW" "$CUR" 2>/dev/null; then
    printf 'DOWNGRADE\n'
    return 1
  fi

  # If there is no merge-base at all, the object graph is shallow/incomplete
  # (or truly unrelated). Do not mislabel that as DIVERGENT+[force-deploy].
  MB="$(git merge-base "$CUR" "$NEW" 2>/dev/null || true)"
  if [ -z "$MB" ]; then
    printf 'INCOMPLETE\n'
    return 1
  fi

  # Divergent histories (e.g. live SSH tip vs squash-merged main).
  if printf '%s' "$SUBJECT" | grep -qiF '[force-deploy]'; then
    printf 'REUNITE\n'
    return 0
  fi
  if [ "${ZEUS_ALLOW_DIVERGENT_REUNITE:-}" = "1" ]; then
    printf 'REUNITE\n'
    return 0
  fi

  printf 'DIVERGENT\n'
  return 1
}

# Resolve the currently-live deploy SHA from the canonical symlink tree.
# Prints empty string if unknown.
upgrade_only_live_sha() {
  local DEPLOY_LINK="${1:-${ZEUS_DEPLOY_LINK:-/var/www/unicorn/UNICORN_FINAL}}"
  local CUR=""
  CUR="$(cat "$DEPLOY_LINK/.deployed-commit" 2>/dev/null | head -c 64 | tr -d '[:space:]' || true)"
  if [ -z "$CUR" ]; then
    local RESOLVED DERIVED
    RESOLVED="$(readlink -f "$DEPLOY_LINK" 2>/dev/null || true)"
    DERIVED="$(printf '%s' "$RESOLVED" | grep -oE '/releases/[0-9a-f]{40}-' | head -1 | grep -oE '[0-9a-f]{40}' || true)"
    CUR="$DERIVED"
  fi
  printf '%s' "$CUR"
}
