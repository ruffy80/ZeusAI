#!/usr/bin/env bash
# propose-innovation.sh — wraps any working-tree change into an auto-PR.
#
# Usage:
#   bash scripts/propose-innovation.sh "title" "body" [path1 path2 ...]
#
# Behavior:
#   - Creates branch auto-evolve/<UTC-ts>
#   - Stages provided paths (or all changes if none given)
#   - Commits with mandatory [needs-review] trailer (NEVER auto-approves)
#   - Pushes branch and opens PR via `gh` if available
#   - Refuses to touch protected paths (UNICORN_FINAL/.env, .github/baselines/live.sha)
#
# Requires: git, gh (optional but recommended).
set -euo pipefail

TITLE="${1:-AutoInnovation proposal}"
BODY="${2:-Proposed by auto-evolve. Human review required before merge.}"
shift 2 2>/dev/null || true
PATHS=("$@")

PROTECTED=(
  ".github/baselines/live.sha"
  "UNICORN_FINAL/.env"
  "UNICORN_FINAL/data"
  "UNICORN_FINAL/logs"
)

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Refuse if working tree touches protected paths.
if git diff --name-only HEAD | grep -E "$(IFS='|'; echo "${PROTECTED[*]}")" >/dev/null 2>&1; then
  echo "❌ refusing: working tree modifies protected path(s)" >&2
  git diff --name-only HEAD | grep -E "$(IFS='|'; echo "${PROTECTED[*]}")" >&2 || true
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BRANCH="auto-evolve/${TS}"

git fetch origin main --quiet
git checkout -b "$BRANCH"

if [ "${#PATHS[@]}" -gt 0 ]; then
  git add -- "${PATHS[@]}"
else
  git add -A
fi

if git diff --cached --quiet; then
  echo "no staged changes — nothing to propose"
  git checkout -
  git branch -D "$BRANCH" >/dev/null 2>&1 || true
  exit 0
fi

# MANDATORY trailer — never use [innovation-approved] here.
COMMIT_MSG="$(printf '%s\n\n%s\n\nAuto-Evolve-Branch: %s\n[needs-review]\n' "$TITLE" "$BODY" "$BRANCH")"
git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  gh pr create \
    --title "$TITLE" \
    --body "$BODY"$'\n\n*Opened by `propose-innovation.sh`. Requires human review. Do not merge automatically.*' \
    --base main \
    --head "$BRANCH" \
    --label "auto-evolve,needs-review" 2>/dev/null || \
  gh pr create --title "$TITLE" --body "$BODY" --base main --head "$BRANCH"
else
  echo "ℹ gh CLI not found — branch pushed; open PR manually: $BRANCH"
fi

echo "✓ proposal branch: $BRANCH"
