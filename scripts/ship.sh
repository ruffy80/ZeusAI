#!/usr/bin/env bash
# scripts/ship.sh — commit + push pe main, lasând CI (deploy.yml) să facă
# deploy-ul la Hetzner cu garda no-downgrade.
#
# Folosire:
#   scripts/ship.sh "mesaj de commit" path1 [path2 ...]
#   scripts/ship.sh "fix(site): banner" UNICORN_FINAL/src/site/template.js
#
# Note:
#   - NU adaugă tot tree-ul (evită vechiul auto-sync-push care a cauzat outage).
#   - Forțează adăugarea EXPLICITĂ doar a path-urilor primite ca argumente.
#   - Refuză push dacă HEAD-ul nu e descendent al .github/baselines/live.sha.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ "$#" -lt 2 ]; then
  echo "usage: $0 \"commit message\" <path> [<path> ...]" >&2
  exit 2
fi

MSG="$1"; shift
PATHS=("$@")

echo "[ship] sync cu origin/main"
git fetch origin main --quiet
git pull --ff-only origin main

echo "[ship] stage: ${PATHS[*]}"
git add -- "${PATHS[@]}"

if git diff --cached --quiet; then
  echo "[ship] nimic de commit pentru path-urile date."
  exit 0
fi

git commit -m "$MSG"

# Verificare baseline înainte de push (oglindă a gărzii din CI).
if [ -f .github/baselines/live.sha ]; then
  BASE="$(tr -d '[:space:]' < .github/baselines/live.sha)"
  if [ "${#BASE}" -ge 40 ] && git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
    if ! git merge-base --is-ancestor "$BASE" HEAD; then
      echo "[ship][FAIL] HEAD nu e descendent al baseline-ului ${BASE}." >&2
      echo "[ship]       deploy.yml ar refuza acest push. Anulez." >&2
      exit 1
    fi
  fi
fi

echo "[ship] push origin main"
git push origin main

echo "[ship] ✅ pushed. CI deploy.yml pornește deploy-ul la Hetzner."
echo "[ship]    monitor: https://github.com/ruffy80/ZeusAI/actions/workflows/deploy.yml"
