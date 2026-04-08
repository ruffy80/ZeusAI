// scripts/setup-hetzner-auto.js
// Rulat de GitHub Actions pentru setup Hetzner
// Poate fi rulat și manual: node scripts/setup-hetzner-auto.js
'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const net  = require('net');

const HOST        = process.env.HETZNER_HOST;
const USER        = process.env.HETZNER_USER       || process.env.HETZNER_DEPLOY_USER || 'root';
const PORT        = process.env.HETZNER_DEPLOY_PORT || '22';
const PRIVATE_KEY = process.env.HETZNER_SSH_PRIVATE_KEY;
const DEPLOY_PATH = process.env.HETZNER_DEPLOY_PATH || '/opt/unicorn';
const REPO_URL    = process.env.GIT_REPO_URL        || process.env.REPO_URL;
const BRANCH      = process.env.BRANCH              || 'main';
const APP_PORT    = process.env.PORT                || '3000';

if (!HOST || !PRIVATE_KEY || !REPO_URL) {
  console.error('❌ Variabile lipsă: HETZNER_HOST, HETZNER_SSH_PRIVATE_KEY, GIT_REPO_URL');
  process.exit(1);
}

// Write key to temp file
const keyPath = path.join('/tmp', `hkey_${Date.now()}`);
fs.writeFileSync(keyPath, PRIVATE_KEY.replace(/\\n/g, '\n'), { mode: 0o600 });

const SSH = `ssh -p ${PORT} -i "${keyPath}" -o StrictHostKeyChecking=no ${USER}@${HOST}`;

function ssh(cmd) {
  try {
    return execSync(`${SSH} '${cmd.replace(/'/g, "'\\''")}'`, { stdio: 'inherit', timeout: 180000 });
  } catch (e) {
    console.error('SSH command failed:', e.message.slice(0, 100));
  }
}

console.log(`🔧 Conectare la ${USER}@${HOST}:${PORT}...`);

ssh(`
  set -e
  # Node.js
  which node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs git rsync)
  which pm2  >/dev/null 2>&1 || npm install -g pm2

  mkdir -p ${DEPLOY_PATH}
  cd ${DEPLOY_PATH}

  if [ -d ".git" ]; then
    git pull origin ${BRANCH} --ff-only
  else
    git clone ${REPO_URL} . && git checkout ${BRANCH}
  fi

  npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

  npm run innovation:sprint || true

  pm2 describe unicorn >/dev/null 2>&1 \\
    && pm2 restart unicorn \\
    || pm2 start backend/index.js --name unicorn --log logs/backend.log

  pm2 describe unicorn-orchestrator >/dev/null 2>&1 \\
    && pm2 restart unicorn-orchestrator \\
    || pm2 start autonomous-orchestrator.js --name unicorn-orchestrator --log logs/orchestrator.log

  pm2 save && pm2 startup systemd -u root --hp /root || true

  sleep 5
  curl -s http://localhost:${APP_PORT}/api/health && echo "✅ Backend LIVE"
  pm2 list
`);

fs.unlinkSync(keyPath);
console.log('✅ Hetzner setup complet!');
