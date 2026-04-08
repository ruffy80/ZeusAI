// Rulează pe mașina locală: node deploy-hetzner.js

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log(`
🚀 Configurare automată Hetzner pentru Unicorn
`);
  console.log(`Acest script va configura serverul Hetzner de la zero și va porni Unicornul.
`);

  const host = await question('🌐 IP-ul serverului Hetzner: ');
  const user = await question('👤 Utilizator SSH (default root): ') || 'root';
  const repoUrl = await question('📦 URL repository GitHub: ');
  const deployPath = await question('📁 Calea deploy pe server (default /root/unicorn): ') || '/root/unicorn';

  console.log(`
🔧 Se rulează scriptul de configurare pe server...
`);

  const script = `
echo "═══════════════════════════════════════════════════════════"
echo "🚀 Configurare automată Unicorn pe Hetzner"
echo "═══════════════════════════════════════════════════════════"

echo "🔧 1. Actualizare sistem și instalare dependențe..."
apt update -y && apt upgrade -y
apt install -y docker.io docker-compose curl git nginx

echo "🐳 2. Pornire Docker..."
systemctl enable docker
systemctl start docker

echo "📁 3. Creare director și clonare repository..."
mkdir -p ${deployPath}
cd ${deployPath}
if [ -d ".git" ]; then
  git pull origin main
else
  git clone ${repoUrl} .
  git checkout main
fi

echo "📦 4. Instalare dependențe backend..."
npm install

echo "🎨 5. Instalare și construire frontend..."
cd client
npm install
npm run build
cd ..

echo "⚙️ 6. Creare fișier .env..."
if [ ! -f .env ]; then
  echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
  echo "PORT=3000" >> .env
fi

echo "🔧 7. Creare serviciu systemd pentru Unicorn..."
cat > /etc/systemd/system/unicorn.service <<EOF
[Unit]
Description=Unicorn AI Service
After=network.target
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${deployPath}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "🌐 8. Creare serviciu systemd pentru webhook..."
WEBHOOK_SECRET=$(openssl rand -hex 16)
cat > /etc/systemd/system/unicorn-webhook.service <<EOF
[Unit]
Description=Unicorn Webhook Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${deployPath}
ExecStart=/usr/bin/node webhook-server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "🔗 9. Creare script webhook..."
cat > ${deployPath}/webhook-server.js <<'WEBHOOK'
const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '${WEBHOOK_SECRET}';

app.post('/webhook/update', (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) return res.status(403).send('Forbidden');
  console.log('📡 Webhook primit, actualizare...');
  exec('cd ${deployPath} && git pull && npm install && cd client && npm install && npm run build && cd .. && systemctl restart unicorn', (err) => {
    if (err) {
      console.error('❌ Eroare:', err);
      return res.status(500).send('Update failed');
    }
    console.log('✅ Actualizare finalizată');
    res.send('OK');
  });
});

app.listen(3001, () => console.log('Webhook server on port 3001'));
WEBHOOK

echo "📦 10. Instalare express pentru webhook..."
cd ${deployPath}
npm install express

echo "🔄 11. Activare servicii systemd..."
systemctl daemon-reload
systemctl enable unicorn.service
systemctl enable unicorn-webhook.service
systemctl restart unicorn.service
systemctl restart unicorn-webhook.service

echo "⏰ 12. Configurare cron pentru auto-update (la fiecare 5 minute)..."
cat > /etc/cron.d/unicorn-update <<EOF
*/5 * * * * root cd ${deployPath} && git pull && npm install && cd client && npm install && npm run build && cd .. && systemctl restart unicorn >> /var/log/unicorn-update.log 2>&1
EOF
chmod 0644 /etc/cron.d/unicorn-update

echo "🔒 13. Configurare firewall..."
ufw allow 3000/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ CONFIGURARE COMPLETĂ! Unicornul rulează pe portul 3000"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Informații importante:"
echo "   🔗 URL Unicorn: http://${host}:3000"
echo "   🔗 Webhook URL: http://${host}:3001/webhook/update"
echo "   🔑 Secret webhook: ${WEBHOOK_SECRET}"
echo ""
echo "🔄 Pentru a activa webhook-ul pe GitHub:"
echo "   1. Mergi la Settings → Webhooks → Add webhook"
echo "   2. Payload URL: http://${host}:3001/webhook/update"
echo "   3. Secret: ${WEBHOOK_SECRET}"
echo "   4. Events: Just the push event"
`;

  try {
    execSync(`ssh ${user}@${host} 'bash -s' <<'EOS'
${script}
EOS`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Eroare la deploy pe Hetzner:', err.message);
  } finally {
    rl.close();
  }
}

main();
