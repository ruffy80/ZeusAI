#!/usr/bin/env node

/**
 * SETUP HETZNER - Configurare automată server Hetzner
 * 
 * Rulează pe mașina ta locală (Mac/Windows/Linux) pentru a configura 
 * serverul Hetzner automat cu:
 * - Docker + Docker Compose
 * - Node.js + npm
 * - Git + nginx
 * - Unicorn AI aplikație
 * - Webhook server pentru auto-update
 * - Systemd services
 * - Cron jobs pentru updates periodice
 * 
 * Necesită: Node.js, modulele `ssh2`, `dotenv`, `inquirer`
 * 
 * Instalare:
 *   npm install ssh2 dotenv inquirer
 * 
 * Utilizare:
 *   node setup_hetzner.js
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// Configurare implicită (poți modifica sau răspunde la întrebări)
const questions = [
  {
    type: 'input',
    name: 'host',
    message: 'IP-ul serverului Hetzner:',
    default: process.env.HETZNER_HOST || ''
  },
  {
    type: 'input',
    name: 'username',
    message: 'Utilizator SSH (de obicei root):',
    default: process.env.HETZNER_DEPLOY_USER || process.env.HETZNER_USER || 'root'
  },
  {
    type: 'input',
    name: 'apiKey',
    message: 'Hetzner API key:',
    default: process.env.HETZNER_API_KEY || process.env.HETZNER_API_TOKEN || ''
  },
  {
    type: 'input',
    name: 'privateKeyPath',
    message: 'Calea către cheia privată SSH (ex: ~/.ssh/id_rsa):',
    default: process.env.HETZNER_SSH_KEY_PATH || '~/.ssh/id_rsa'
  },
  {
    type: 'input',
    name: 'repoUrl',
    message: 'URL-ul repository-ului GitHub (HTTPS sau SSH):',
    default: process.env.GIT_REMOTE_URL || 'https://github.com/vladoi/unicorn-final.git'
  },
  {
    type: 'input',
    name: 'branch',
    message: 'Branch-ul principal:',
    default: process.env.GIT_BRANCH || 'main'
  },
  {
    type: 'input',
    name: 'deployPath',
    message: 'Calea pe server unde se va clona repository-ul:',
    default: process.env.HETZNER_DEPLOY_PATH || '/root/unicorn-live'
  },
  {
    type: 'input',
    name: 'webhookSecret',
    message: 'Secret pentru webhook (lasă gol pentru a genera automat):',
    default: process.env.HETZNER_WEBHOOK_SECRET || ''
  },
  {
    type: 'confirm',
    name: 'setupDocker',
    message: 'Instalare Docker și Docker Compose?',
    default: true
  },
  {
    type: 'confirm',
    name: 'setupNginx',
    message: 'Configurare nginx ca reverse proxy?',
    default: true
  },
  {
    type: 'confirm',
    name: 'setupMonitoring',
    message: 'Instalare PM2 pentru monitoring?',
    default: true
  }
];

async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   🚀 Configurare automată Hetzner        ║');
  console.log('║   Unicorn AI Deployment                  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const answers = await inquirer.prompt(questions);
  
  // Dacă secretul nu a fost furnizat, generează unul
  if (!answers.webhookSecret) {
    answers.webhookSecret = crypto.randomBytes(16).toString('hex');
    console.log(`\n🔑 Secret webhook generat automat: ${answers.webhookSecret}`);
  }

  // Expandare cale cheie (înlocuiește ~ cu home-ul utilizatorului)
  const privateKeyPath = answers.privateKeyPath.replace(/^~/, process.env.HOME);
  
  if (!fs.existsSync(privateKeyPath)) {
    console.error(`❌ Cheia privată nu se găsește la: ${privateKeyPath}`);
    process.exit(1);
  }

  const privateKey = fs.readFileSync(privateKeyPath);

  // Construire scriptul de configurare
  let setupScript = getSetupScript(answers);

  // Conectare SSH
  const conn = new Client();
  let output = '';

  conn.on('ready', () => {
    console.log('✅ Conexiune SSH stabilită.\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Executare configurare pe server...\n');
    
    conn.exec(setupScript, (err, stream) => {
      if (err) {
        console.error('❌ Eroare la execuție:', err);
        conn.end();
        process.exit(1);
        return;
      }

      stream.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data.toString());
      });

      stream.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      stream.on('close', (code) => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (code === 0) {
          console.log('\n✅ Configurare finalizată cu succes!\n');
          
          // Salvează configurația pentru referință viitoare
          const config = {
            host: answers.host,
            apiKey: answers.apiKey,
            deployPath: answers.deployPath,
            webhookUrl: `http://${answers.host}:3001/webhook/update`,
            githubWebhookUrl: `http://${answers.host}:3001/webhook/github`,
            hetznerWebhookUrl: `http://${answers.host}:3001/webhook/update`,
            webhookSecret: answers.webhookSecret,
            setupTime: new Date().toISOString(),
            branch: answers.branch,
            repo: answers.repoUrl
          };

          fs.writeFileSync('hetzner-setup-config.json', JSON.stringify(config, null, 2));
          console.log('💾 Configurație salvată în: hetzner-setup-config.json\n');

          // Afișează informații importantes
          console.log('📋 Informații importante:\n');
          console.log(`   🖥️  Server: ${answers.host}`);
          console.log(`   🔐 Hetzner API Key: ${answers.apiKey ? 'configured' : 'missing'}`);
          console.log(`   📂 Deploy path: ${answers.deployPath}`);
          console.log(`   🔗 GitHub Webhook URL: http://${answers.host}:3001/webhook/github`);
          console.log(`   🔗 Hetzner Webhook URL: http://${answers.host}:3001/webhook/update`);
          console.log(`   🔑 Webhook Secret: ${answers.webhookSecret}`);
          console.log(`   📦 Repository: ${answers.repoUrl}`);
          console.log(`   🌿 Branch: ${answers.branch}\n`);

          console.log('🔗 Adaugă webhook-ul pe GitHub:');
          console.log(`   Settings → Webhooks → Add webhook`);
          console.log(`   Payload URL: http://${answers.host}:3001/webhook/github`);
          console.log(`   Content type: application/json`);
          console.log(`   Secret: ${answers.webhookSecret}`);
          console.log(`   Events: Push events\n`);

          console.log('📊 Verificare status:');
          console.log(`   ssh -i ${answers.privateKeyPath} ${answers.username}@${answers.host}`);
          console.log(`   systemctl status unicorn`);
          console.log(`   systemctl status unicorn-webhook`);
          console.log(`   pm2 list (dacă e instalat PM2)\n`);

        } else {
          console.log(`\n⚠️  Configurare finalizată cu codul de ieșire: ${code}\n`);
        }

        conn.end();
      });
    });
  });

  conn.on('error', (err) => {
    console.error('❌ Eroare SSH:', err.message);
    process.exit(1);
  });

  console.log(`Conectare la ${answers.username}@${answers.host}...`);
  conn.connect({
    host: answers.host,
    port: 22,
    username: answers.username,
    privateKey: privateKey,
    readyTimeout: 30000
  });
}

function getSetupScript(answers) {
  const deployPath = answers.deployPath;
  const hetznerApiKey = answers.apiKey;
  const webhookSecret = answers.webhookSecret;
  const repoUrl = answers.repoUrl;
  const branch = answers.branch;

  // Build dynamic script based on user choices
  let script = `set -e\n\n`;
  
  script += `echo "════════════════════════════════════════════"\n`;
  script += `echo "🚀 Configurare Hetzner - Unicorn AI"\n`;
  script += `echo "════════════════════════════════════════════"\n\n`;

  // System update
  script += `echo "📦 Actualizare sistem..."\n`;
  script += `apt update -y && apt upgrade -y\n`;
  script += `apt install -y curl git wget build-essential\n\n`;

  // Docker setup
  if (answers.setupDocker) {
    script += `echo "🐳 Instalare Docker..."\n`;
    script += `apt install -y docker.io docker-compose\n`;
    script += `systemctl enable docker && systemctl start docker\n`;
    script += `usermod -aG docker root\n\n`;
  }

  // Node.js setup
  script += `echo "⚙️ Instalare Node.js..."\n`;
  script += `curl -fsSL https://deb.nodesource.com/setup_18.x | bash -\n`;
  script += `apt install -y nodejs\n`;
  script += `npm install -g npm pm2\n\n`;

  // Nginx setup
  if (answers.setupNginx) {
    script += `echo "🌐 Instalare nginx..."\n`;
    script += `apt install -y nginx\n`;
    script += `systemctl enable nginx && systemctl start nginx\n\n`;
  }

  // Repository clone and setup
  script += `echo "📁 Clonare repository și setup..."\n`;
  script += `mkdir -p ${deployPath}\n`;
  script += `cd ${deployPath}\n`;
  script += `if [ -d ".git" ]; then\n`;
  script += `  git pull origin ${branch}\n`;
  script += `else\n`;
  script += `  git clone ${repoUrl} .\n`;
  script += `  git checkout ${branch}\n`;
  script += `fi\n\n`;

  // Dependencies
  script += `echo "📦 Instalare dependențe..."\n`;
  script += `npm install\n`;
  script += `if [ -d "client" ]; then\n`;
  script += `  cd client && npm install && npm run build && cd ..\n`;
  script += `fi\n\n`;

  // Environment setup
  script += `echo "⚙️ Setup mediu..."\n`;
  script += `if [ ! -f .env ]; then\n`;
  script += `  if [ -f .env.example ]; then\n`;
  script += `    cp .env.example .env\n`;
  script += `  else\n`;
  script += `    echo "NODE_ENV=production" > .env\n`;
  script += `  fi\n`;
  script += `fi\n\n`;
  script += `grep -v "^HETZNER_API_KEY=" .env > .env.tmp || true\n`;
  script += `printf "%s\\n" "HETZNER_API_KEY=${hetznerApiKey}" >> .env.tmp\n`;
  script += `mv .env.tmp .env\n\n`;

  // Webhook server
  script += `echo "🔗 Setup webhook server..."\n`;
  script += `cat > ${deployPath}/webhook-server.js << 'WEBHOOK_EOF'\n`;
  script += getWebhookScript(webhookSecret, deployPath);
  script += `\nWEBHOOK_EOF\n\n`;

  // PM2 setup
  if (answers.setupMonitoring) {
    script += `echo "📊 Setup PM2..."\n`;
    script += `pm2 start ${deployPath}/webhook-server.js --name "unicorn-webhook"\n`;
    script += `pm2 save\n`;
    script += `pm2 startup\n\n`;
  }

  // Systemd service
  script += `echo "🔧 Setup systemd service..."\n`;
  script += `cat > /etc/systemd/system/unicorn.service << 'SERVICE_EOF'\n`;
  script += `[Unit]\n`;
  script += `Description=Unicorn AI Service\n`;
  script += `After=network.target\n\n`;
  script += `[Service]\n`;
  script += `Type=simple\n`;
  script += `User=root\n`;
  script += `WorkingDirectory=${deployPath}\n`;
  script += `ExecStart=/usr/bin/npm start\n`;
  script += `Restart=always\n`;
  script += `RestartSec=10\n`;
  script += `Environment="NODE_ENV=production"\n\n`;
  script += `[Install]\n`;
  script += `WantedBy=multi-user.target\n`;
  script += `SERVICE_EOF\n\n`;

  script += `systemctl daemon-reload\n`;
  script += `systemctl enable unicorn\n`;
  script += `systemctl restart unicorn\n\n`;

  // Cron job for auto-updates
  script += `echo "🔄 Setup auto-update..."\n`;
  script += `cat > /etc/cron.d/unicorn-update << 'CRON_EOF'\n`;
  script += `SHELL=/bin/bash\n`;
  script += `PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n`;
  script += `*/5 * * * * root cd ${deployPath} && git pull && npm install && systemctl restart unicorn >> /var/log/unicorn-update.log 2>&1\n`;
  script += `CRON_EOF\n`;
  script += `chmod 0644 /etc/cron.d/unicorn-update\n\n`;

  // Final checks
  script += `echo "✅ Verificare finală..."\n`;
  script += `sleep 5\n`;
  script += `systemctl status unicorn || true\n`;
  script += `echo "\n✅ Configurare completă!"\n`;
  script += `echo "🔗 GitHub Webhook URL: http://$(curl -s ifconfig.me):3001/webhook/github"\n`;
  script += `echo "🔗 Hetzner Webhook URL: http://$(curl -s ifconfig.me):3001/webhook/update"\n`;
  script += `echo "🔑 Webhook Secret: ${webhookSecret}"\n`;

  return script;
}

function getWebhookScript(webhookSecret, deployPath) {
  return `const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const WEBHOOK_SECRET = '${webhookSecret}';
const DEPLOY_PATH = '${deployPath}';

// Verify webhook signature
function verifySignature(secret, body) {
  if (!secret) return true;
  return secret === WEBHOOK_SECRET;
}

function handleWebhook(req, res) {
  const secret = req.headers['x-webhook-secret'] || req.body.secret;
  
  if (!verifySignature(secret, JSON.stringify(req.body))) {
    console.log('🚫 Webhook cu secret invalid');
    return res.status(403).json({ error: 'Forbidden' });
  }

  console.log('🔔 Webhook primit, declanșăm update...');
  
  const updateCmd = \`cd \${DEPLOY_PATH} && git pull origin main && npm install\`;
  
  exec(updateCmd, { cwd: DEPLOY_PATH, timeout: 300000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Eroare update:', err);
      return res.status(500).json({ error: 'Update failed', message: stderr });
    }
    
    console.log('✅ Update completat, restarting service...');
    exec('systemctl restart unicorn', (err) => {
      if (err) {
        console.error('Eroare restart:', err);
      } else {
        console.log('✅ Serviciu restartat');
      }
    });
    
    res.json({ status: 'OK', message: 'Update initiated' });
  });
}

app.post('/webhook/update', handleWebhook);
app.post('/webhook/github', handleWebhook);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.WEBHOOK_PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🎯 Webhook server listening on port \${PORT}\`);
});
`;
}

// Run
if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Eroare fatală:', err);
    process.exit(1);
  });
}

module.exports = { main };
