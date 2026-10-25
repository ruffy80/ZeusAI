#!/usr/bin/env bash
# Decide whether this GitHub Actions deploy may SSH.
#
#   PROCEED     candidate is origin/main. Deploy it.
#   SUPERSEDED  a newer main commit already contains candidate.
#               The newer run owns promotion. This run must not SSH
#               and must not fail: a red X here looks like the merge
#               never landed.
#   exit 1      candidate is not an ancestor of latest (missing SHA,
#               unrelated history). Fail closed.
#
# Usage: deploy-freshness-decision.sh <candidate-sha> <latest-sha>
# Prints the decision on stdout. Run inside the checkout that contains both SHAs.
set -euo pipefail

candidate="${1:-}"
latest="${2:-}"

if [ -z "$candidate" ] || [ -z "$latest" ]; then
  echo "REFUSE missing sha" >&2
  exit 1
fi

if [ "$candidate" = "$latest" ]; then
  echo "PROCEED"
  exit 0
fi

if git cat-file -e "${candidate}^{commit}" 2>/dev/null \
  && git cat-file -e "${latest}^{commit}" 2>/dev/null \
  && git merge-base --is-ancestor "$candidate" "$latest"; then
  echo "SUPERSEDED"
  exit 0
fi

echo "REFUSE candidate is not an ancestor of latest" >&2
exit 1
