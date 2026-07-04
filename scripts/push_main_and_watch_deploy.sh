#!/usr/bin/env zsh
set -euo pipefail

REPO_ROOT="/Users/ionutvladoi/Desktop/generate-unicorn"
OWNER="ruffy80"
REPO="ZeusAI"

cd "$REPO_ROOT"
SHA=$(git rev-parse HEAD)
SHORT_SHA=${SHA[1,8]}

echo "[deploy-watch] pushing main @ ${SHORT_SHA}"
git push origin main

echo "[deploy-watch] waiting GitHub deploy workflow for ${SHORT_SHA}"

for i in {1..60}; do
  OUT=$(curl -fsSL "https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=50" | python3 - "$SHA" <<'PY'
import json,sys
sha=sys.argv[1]
d=json.load(sys.stdin)
runs=d.get('workflow_runs',[])
run=next((r for r in runs if r.get('name')=='🚀 Unicorn Stable Deploy' and r.get('head_branch')=='main' and r.get('head_sha')==sha), None)
if not run:
    print('NOT_FOUND')
else:
    print(run.get('status',''))
    print(run.get('conclusion') or '')
    print(run.get('html_url') or '')
PY
)

  STATUS=$(echo "$OUT" | sed -n '1p')
  CONCLUSION=$(echo "$OUT" | sed -n '2p')
  URL=$(echo "$OUT" | sed -n '3p')

  echo "[deploy-watch] #$i status=${STATUS} conclusion=${CONCLUSION}"

  if [[ "$STATUS" == "completed" ]]; then
    echo "[deploy-watch] done: ${CONCLUSION} ${URL}"
    [[ "$CONCLUSION" == "success" ]] || exit 1
    exit 0
  fi

  sleep 10
done

echo "[deploy-watch] timeout waiting deploy"
exit 1
