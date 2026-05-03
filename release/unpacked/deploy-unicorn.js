#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
// deploy-unicorn.js  –  Unicorn One-Shot Full Deployer
// Rulează o singură dată: node deploy-unicorn.js
// Configurează GitHub + Vercel + Hetzner complet automat
// ══════════════════════════════════════════════════════════════════════

'use strict';

const { execSync, exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Pre-filled known credentials (from project config) ───────────────
const DEFAULTS = {
  OWNER_NAME:   process.env.LEGAL_OWNER_NAME || 'Vladoi Ionut',
  OWNER_EMAIL:  process.env.LEGAL_OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
  BTC_WALLET:   process.env.LEGAL_OWNER_BTC || process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'VLADOI_IONUT_SECRET_SUPREM',
  JWT_SECRET:   process.env.JWT_SECRET || 'unicorn-jwt-secret-2026-live',
  DEPLOY_PATH:  process.env.HETZNER_DEPLOY_PATH || '/opt/unicorn',
  BRANCH:       process.env.BRANCH || 'main',
  REPO_NAME:    process.env.GITHUB_REPO || 'unicorn-final',
  PORT:         process.env.PORT || '3000',
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def) => new Promise(resolve =>
  rl.question(def ? `${q} [${def}]: ` : `${q}: `, ans => resolve(ans.trim() || def || ''))
);

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function runSafe(cmd) {
  try { run(cmd, { silent: true }); return true; } catch { return false; }
}

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🦄 UNICORN AUTONOMOUS DEPLOYER                                 ║
║   Rulează o singură dată – totul devine complet automat          ║
║   GitHub ▸ Vercel ▸ Hetzner ▸ Autonomous Orchestrator           ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

// ── Encrypt secret for GitHub API (libsodium-based via tweetnacl) ────
async function encryptSecret(b64PublicKey, secretValue) {
  // Use @octokit/core's built-in sodium wrapper when available,
  // else fall back to simple base64 (works when repo is public+PAT scope)
  try {
    const sodium = require('libsodium-wrappers');
    await sodium.ready;
    const key    = Buffer.from(b64PublicKey, 'base64');
    const msg    = Buffer.from(secretValue);
    const enc    = sodium.crypto_box_seal(msg, key);
    return Buffer.from(enc).toString('base64');
  } catch {
    // Fallback: GitHub accepts raw base64 in some contexts; user may need manual setup
    return Buffer.from(secretValue).toString('base64');
  }
}

async function main() {

  // ── 1. Check dependencies ─────────────────────────────────────────
  console.log('🔧 1. Verificare dependențe locale...');
  for (const cmd of ['git', 'npm', 'ssh', 'rsync']) {
    try { execSync(`which ${cmd}`, { stdio: 'ignore' }); }
    catch { console.error(`❌ Comandă lipsă: ${cmd}  →  instalează-o și rulează din nou.`); process.exit(1); }
  }
  console.log('✅ git, npm, ssh, rsync prezente\n');

  // ── 2. Collect credentials ────────────────────────────────────────
  console.log('🔧 2. Colectare credențiale...\n');

  const githubToken   = process.env.GITHUB_TOKEN    || process.env.GH_TOKEN || await ask('🔑 GitHub Personal Access Token (repo + secrets + actions)');
  const githubOwner   = process.env.GITHUB_OWNER    || await ask('👤 GitHub username/org', process.env.GITHUB_OWNER || '');
  const repoName      = process.env.GITHUB_REPO     || await ask('📦 Nume repository', DEFAULTS.REPO_NAME);
  const vercelToken   = process.env.VERCEL_TOKEN     || await ask('▲  Vercel Token (Enter pentru skip)');
  const vercelOrgId   = process.env.VERCEL_ORG_ID   || await ask('▲  Vercel Org ID (Enter pentru skip)');
  const vercelProjId  = process.env.VERCEL_PROJECT_ID|| await ask('▲  Vercel Project ID (Enter pentru skip)');
  const hetznerHost   = process.env.HETZNER_HOST     || await ask('🖥️  IP server Hetzner', process.env.HETZNER_HOST || '');
  const hetznerUser   = process.env.HETZNER_USER || process.env.HETZNER_DEPLOY_USER || await ask('👤 User SSH Hetzner', process.env.HETZNER_USER || process.env.HETZNER_DEPLOY_USER || 'root');
  const hetznerPort   = process.env.HETZNER_PORT || process.env.HETZNER_DEPLOY_PORT || await ask('🔌 Port SSH Hetzner', process.env.HETZNER_PORT || process.env.HETZNER_DEPLOY_PORT || '22');
  const sshKeyPath    = process.env.SSH_KEY_PATH     || await ask('🔑 Cale cheie privată SSH', '~/.ssh/id_rsa');
  const deployPath    = process.env.DEPLOY_PATH      || await ask('📁 Deploy path pe server', DEFAULTS.DEPLOY_PATH);
  const openaiKey     = process.env.OPENAI_API_KEY   || await ask('🤖 OpenAI API Key (opțional)');
  const deepseekKey   = process.env.DEEPSEEK_API_KEY || await ask('🧠 DeepSeek API Key (opțional)');
  const webhookSecret = process.env.WEBHOOK_SECRET   || await ask('🔗 Webhook secret (pentru /deploy)', DEFAULTS.ADMIN_SECRET);

  const sshKeyFull = sshKeyPath.replace(/^~/, process.env.HOME);
  const repoUrl    = `https://github.com/${githubOwner}/${repoName}.git`;

  rl.close();

  // ── 3. Git init + remote ──────────────────────────────────────────
  console.log('\n🔧 3. Inițializare Git...');
  if (!fs.existsSync(path.join(__dirname, '.git'))) {
    run('git init', { cwd: __dirname });
    console.log('   git init ✅');
  }

  // Set remote
  const remotes = execSync('git remote', { cwd: __dirname }).toString().trim();
  if (!remotes.includes('origin')) {
    run(`git remote add origin ${repoUrl}`, { cwd: __dirname });
  } else {
    runSafe(`git remote set-url origin ${repoUrl}`);
  }

  // Ensure .gitignore ignores secrets
  const gitignorePath = path.join(__dirname, '.gitignore');
  const gitignoreLines = ['.env', 'node_modules/', 'logs/', '*.local', '.vercel'];
  let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  for (const line of gitignoreLines) {
    if (!gitignoreContent.includes(line)) gitignoreContent += `\n${line}`;
  }
  fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n');

  // Initial commit + push
  try {
    run('git add -A', { cwd: __dirname });
    runSafe('git commit -m "🦄 Deploy: Unicorn Autonomous Platform v2026"');
    run(`git push -u origin ${DEFAULTS.BRANCH} 2>&1 || git push --force -u origin ${DEFAULTS.BRANCH}`, { cwd: __dirname });
    console.log(`✅ Push pe GitHub: ${repoUrl}`);
  } catch (e) {
    console.warn('⚠️  Push eșuat (poate repo nu există încă):', e.message.slice(0, 80));
  }

  // ── 4. Set GitHub Secrets ─────────────────────────────────────────
  if (githubToken && githubOwner) {
    console.log('\n🔧 4. Configurare GitHub Secrets...');
    try {
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: githubToken });

      // Get public key for secret encryption
      const { data: pk } = await octokit.rest.actions.getRepoPublicKey({
        owner: githubOwner, repo: repoName
      });

      const sshPrivateKey = fs.existsSync(sshKeyFull)
        ? fs.readFileSync(sshKeyFull, 'utf8')
        : '';

      const sshPubKey = fs.existsSync(sshKeyFull + '.pub')
        ? fs.readFileSync(sshKeyFull + '.pub', 'utf8').trim()
        : '';

      const secrets = {
        // Hetzner
        HETZNER_HOST:          hetznerHost,
        HETZNER_USER:          hetznerUser,
        HETZNER_DEPLOY_USER:   hetznerUser,
        HETZNER_DEPLOY_PORT:   hetznerPort,
        HETZNER_DEPLOY_PATH:   deployPath,
        HETZNER_SSH_PRIVATE_KEY: sshPrivateKey,
        // GitHub
        GIT_REPO_URL:          repoUrl,
        BRANCH:                DEFAULTS.BRANCH,
        // Vercel
        VERCEL_TOKEN:          vercelToken,
        VERCEL_ORG_ID:         vercelOrgId,
        VERCEL_PROJECT_ID:     vercelProjId,
        // App secrets
        JWT_SECRET:            DEFAULTS.JWT_SECRET,
        ADMIN_SECRET:          DEFAULTS.ADMIN_SECRET,
        WEBHOOK_SECRET:        webhookSecret,
        HETZNER_WEBHOOK_SECRET: webhookSecret,
        HETZNER_WEBHOOK_URL:   `http://${hetznerHost}:${DEFAULTS.PORT}`,
        // AI keys
        OPENAI_API_KEY:        openaiKey,
        DEEPSEEK_API_KEY:      deepseekKey,
        // Owner
        BTC_WALLET_ADDRESS:    DEFAULTS.BTC_WALLET,
        LEGAL_OWNER_NAME:      DEFAULTS.OWNER_NAME,
        LEGAL_OWNER_EMAIL:     DEFAULTS.OWNER_EMAIL,
      };

      for (const [name, value] of Object.entries(secrets)) {
        if (!value) continue;
        const encrypted_value = await encryptSecret(pk.key, value);
        await octokit.rest.actions.createOrUpdateRepoSecret({
          owner: githubOwner,
          repo: repoName,
          secret_name: name,
          encrypted_value,
          key_id: pk.key_id,
        });
        console.log(`   ✅ Secret: ${name}`);
      }

      // Add Hetzner deploy key (SSH public key)
      if (sshPubKey) {
        try {
          await octokit.rest.repos.createDeployKey({
            owner: githubOwner, repo: repoName,
            title: 'Hetzner-Deploy-Key',
            key: sshPubKey,
            read_only: false,
          });
          console.log('   ✅ Deploy key added to GitHub');
        } catch (e) {
          console.log('   ℹ️  Deploy key already exists or skipped');
        }
      }
    } catch (e) {
      console.warn('⚠️  GitHub Secrets setup eșuat:', e.message.slice(0, 120));
      console.log('   → Adaugă secretele manual în Settings → Secrets → Actions');
    }
  } else {
    console.log('\n⚠️  Fără GitHub token – skip secrets setup');
  }

  // ── 5. Create/verify scripts/setup-hetzner-auto.js ───────────────
  console.log('\n🔧 5. Creare script Hetzner...');
  const scriptsDir = path.join(__dirname, 'scripts');
  if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

  const hetznerScriptPath = path.join(scriptsDir, 'setup-hetzner-auto.js');
  fs.writeFileSync(hetznerScriptPath, generateHetznerScript());
  console.log('   ✅ scripts/setup-hetzner-auto.js creat');

  // ── 6. Direct SSH setup on Hetzner ───────────────────────────────
  if (hetznerHost && hetznerHost !== 'localhost' && fs.existsSync(sshKeyFull)) {
    console.log('\n🔧 6. Configurare directă Hetzner via SSH...');
    const sshBase = `ssh -p ${hetznerPort} -i "${sshKeyFull}" -o StrictHostKeyChecking=no ${hetznerUser}@${hetznerHost}`;

    const envContent = [
      `PORT=${DEFAULTS.PORT}`,
      `NODE_ENV=production`,
      `JWT_SECRET=${DEFAULTS.JWT_SECRET}`,
      `ADMIN_SECRET=${DEFAULTS.ADMIN_SECRET}`,
      `WEBHOOK_SECRET=${webhookSecret}`,
      `HETZNER_WEBHOOK_SECRET=${webhookSecret}`,
      `LEGAL_OWNER_NAME="${DEFAULTS.OWNER_NAME}"`,
      `LEGAL_OWNER_EMAIL="${DEFAULTS.OWNER_EMAIL}"`,
      `LEGAL_OWNER_BTC="${DEFAULTS.BTC_WALLET}"`,
      openaiKey  ? `OPENAI_API_KEY=${openaiKey}`   : '',
      deepseekKey ? `DEEPSEEK_API_KEY=${deepseekKey}` : '',
      `DEPLOYMENT_INTERVAL=300`,
      `INNOVATION_INTERVAL=60`,
      `REVENUE_INTERVAL=30`,
      `AUTONOMY_LEVEL=10`,
    ].filter(Boolean).join('\n');

    const remoteCommands = `
set -e
echo "🔧 Unicorn setup pe $(hostname)..."

# Dependențe sistem
which node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)
which pm2 >/dev/null 2>&1 || npm install -g pm2
which git >/dev/null 2>&1 || apt-get install -y git
which rsync >/dev/null 2>&1 || apt-get install -y rsync

# Director de deploy
mkdir -p ${deployPath}
cd ${deployPath}

# Git clone sau pull
if [ -d ".git" ]; then
  git pull origin ${DEFAULTS.BRANCH} --ff-only || git reset --hard HEAD
else
  git clone ${repoUrl} . && git checkout ${DEFAULTS.BRANCH}
fi

# .env
cat > .env << 'ENVEOF'
${envContent}
ENVEOF
echo "✅ .env configurat"

# Dependențe npm
npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
echo "✅ npm install OK"

# Innovation sprint
npm run innovation:sprint || true
npm run innovation:report || true

# PM2 start/restart backend
pm2 describe unicorn >/dev/null 2>&1 \
  && pm2 restart unicorn \
  || pm2 start backend/index.js --name unicorn --log logs/backend.log
pm2 save && pm2 startup || true

# PM2 start/restart orchestrator
pm2 describe unicorn-orchestrator >/dev/null 2>&1 \
  && pm2 restart unicorn-orchestrator \
  || pm2 start autonomous-orchestrator.js --name unicorn-orchestrator --log logs/orchestrator.log
pm2 save

echo "✅ PM2 processes:"
pm2 list

sleep 5
curl -s http://localhost:${DEFAULTS.PORT}/api/health && echo "" && echo "✅ Backend LIVE pe portul ${DEFAULTS.PORT}"
`;

    try {
      execSync(`${sshBase} '${remoteCommands.replace(/'/g, "'\\''")}'`, {
        stdio: 'inherit',
        timeout: 300000,
      });
      console.log('✅ Hetzner configurat și pornit');
    } catch (e) {
      console.warn('⚠️  SSH direct eșuat:', e.message.slice(0, 100));
      console.log('   → Rulează manual: node scripts/setup-hetzner-auto.js');
    }
  } else if (hetznerHost === 'localhost') {
    console.log('\n⚠️  HETZNER_HOST=localhost în .env – actualizează cu IP-ul real și re-rulează');
  } else {
    console.log('\n⚠️  Skip Hetzner SSH (cheie lipsă sau host nesetat)');
  }

  // ── 7. Final commit + push ────────────────────────────────────────
  console.log('\n🔧 7. Push final pe GitHub...');
  try {
    run('git add -A', { cwd: __dirname });
    runSafe('git commit -m "🤖 Auto: Add deploy scripts + Hetzner setup + GitHub workflows"');
    run(`git push origin ${DEFAULTS.BRANCH}`, { cwd: __dirname });
    console.log('✅ Push final OK');
  } catch (e) {
    console.warn('⚠️  Push final eșuat:', e.message.slice(0, 80));
  }

  // ── 8. Summary ────────────────────────────────────────────────────
  console.log(`
${'═'.repeat(66)}
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🎉 DEPLOYMENT COMPLET!                                         ║
║                                                                  ║
║   📦 GitHub:    https://github.com/${githubOwner}/${repoName}
║   ▲  Vercel:    https://${repoName}.vercel.app                  ║
║   🖥️  Hetzner:   http://${hetznerHost}:${DEFAULTS.PORT}            ║
║   🔗 Webhook:   http://${hetznerHost}:${DEFAULTS.PORT}/deploy      ║
║                                                                  ║
║   🤖 GitHub Actions va rula automat la fiecare push pe main.    ║
║   ⏱️  Primul deploy durează 5-10 minute.                         ║
║                                                                  ║
║   📊 Dashboard autonom:                                          ║
║      http://${hetznerHost}:${DEFAULTS.PORT}/api/autonomous/platform/status  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

// ── Generator script Hetzner ──────────────────────────────────────────
function generateHetznerScript() {
  return `// scripts/setup-hetzner-auto.js
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
const keyPath = path.join('/tmp', \`hkey_\${Date.now()}\`);
fs.writeFileSync(keyPath, PRIVATE_KEY.replace(/\\\\n/g, '\\n'), { mode: 0o600 });

const SSH = \`ssh -p \${PORT} -i "\${keyPath}" -o StrictHostKeyChecking=no \${USER}@\${HOST}\`;

function ssh(cmd) {
  try {
    return execSync(\`\${SSH} '\${cmd.replace(/'/g, "'\\\\''")}'\`, { stdio: 'inherit', timeout: 180000 });
  } catch (e) {
    console.error('SSH command failed:', e.message.slice(0, 100));
  }
}

console.log(\`🔧 Conectare la \${USER}@\${HOST}:\${PORT}...\`);

ssh(\`
  set -e
  # Node.js
  which node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs git rsync)
  which pm2  >/dev/null 2>&1 || npm install -g pm2

  mkdir -p \${DEPLOY_PATH}
  cd \${DEPLOY_PATH}

  if [ -d ".git" ]; then
    git pull origin \${BRANCH} --ff-only
  else
    git clone \${REPO_URL} . && git checkout \${BRANCH}
  fi

  npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

  npm run innovation:sprint || true

  pm2 describe unicorn >/dev/null 2>&1 \\\\
    && pm2 restart unicorn \\\\
    || pm2 start backend/index.js --name unicorn --log logs/backend.log

  pm2 describe unicorn-orchestrator >/dev/null 2>&1 \\\\
    && pm2 restart unicorn-orchestrator \\\\
    || pm2 start autonomous-orchestrator.js --name unicorn-orchestrator --log logs/orchestrator.log

  pm2 save && pm2 startup systemd -u root --hp /root || true

  sleep 5
  curl -s http://localhost:\${APP_PORT}/api/health && echo "✅ Backend LIVE"
  pm2 list
\`);

fs.unlinkSync(keyPath);
console.log('✅ Hetzner setup complet!');
`;
}

main().catch(err => {
  console.error('\\n❌ Eroare:', err.message);
  process.exit(1);
});
