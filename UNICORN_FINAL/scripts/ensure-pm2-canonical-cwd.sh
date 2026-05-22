#!/usr/bin/env bash
set -euo pipefail

CANONICAL_DIR="${1:-/var/www/unicorn/UNICORN_FINAL}"

if [ ! -f "$CANONICAL_DIR/ecosystem.config.js" ]; then
  echo "[pm2-cwd] missing ecosystem at $CANONICAL_DIR/ecosystem.config.js"
  exit 1
fi

echo "[pm2-cwd] enforcing canonical ecosystem from $CANONICAL_DIR"
cd "$CANONICAL_DIR"
pm2 startOrReload ecosystem.config.js --only unicorn-backend --update-env
pm2 startOrReload ecosystem.config.js --only unicorn-site --update-env
pm2 save >/dev/null 2>&1 || true

pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const a=JSON.parse(d);for(const n of ['unicorn-backend','unicorn-site']){const p=a.find(x=>x.name===n);const cwd=p&&p.pm2_env&&p.pm2_env.pm_cwd||'';console.log('[pm2-cwd]',n,'->',cwd)}})"
