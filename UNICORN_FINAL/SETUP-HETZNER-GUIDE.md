# Setup Hetzner - Interactive Server Configuration

Complete automated Hetzner server configuration for Unicorn AI Platform.

## 🎯 What It Does

This script runs **interactively on your local machine** and configures your Hetzner server with:

✅ **System Setup**
- System updates and upgrades
- Docker + Docker Compose
- Node.js + npm
- Git, nginx, and build tools

✅ **Application Deployment**
- Clone your GitHub repository
- Install backend + frontend dependencies
- Build frontend (React)
- Setup environment variables

✅ **Service Management**
- Systemd service for main application
- Systemd service for webhook server
- PM2 for process monitoring (optional)
- Auto-restart on crashes

✅ **Continuous Deployment**
- Webhook server on port 3001
- Automatic updates on GitHub push
- Cron jobs for periodic updates (every 5 minutes)
- Nginx reverse proxy (optional)

---

## 📦 Prerequisites

### On Your Local Machine

1. **Node.js and npm**
   ```bash
   node -v
   npm -v
   ```

2. **Required npm modules**
   ```bash
   npm install ssh2 dotenv inquirer
   ```

3. **SSH key to your Hetzner server**
   ```bash
   # If you don't have one, generate it:
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/hetzner_rsa
   
   # Copy public key to Hetzner:
   ssh-copy-id -i ~/.ssh/hetzner_rsa.pub root@204.168.230.142
   ```

### On Your Hetzner Server

- Root SSH access
- Public internet access (for GitHub webhooks)
- At least 10 GB free disk space
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3001 (Webhooks)

---

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
npm install ssh2 dotenv inquirer
```

### Step 2: Run the Setup Script
```bash
node setup_hetzner.js
```

### Step 3: Answer Interactive Questions

The script will ask you:

```
? IP-ul serverului Hetzner: 204.168.230.142
? Utilizator SSH (de obicei root): root
? Calea către cheia privată SSH: ~/.ssh/hetzner_rsa
? URL-ul repository-ului GitHub: https://github.com/user/repo.git
? Branch-ul principal: main
? Calea pe server unde se va clona repository-ul: /root/unicorn-live
? Secret pentru webhook (lasă gol pentru a genera automat): [auto-generated]
? Instalare Docker și Docker Compose? (Y/n) Y
? Configurare nginx ca reverse proxy? (Y/n) Y
? Instalare PM2 pentru monitoring? (Y/n) Y
```

### Step 4: Watch the Progress

The script will show real-time output from your server:

```
✅ Conexiune SSH stabilită.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Executare configurare pe server...

════════════════════════════════════════════
🚀 Configurare Hetzner - Unicorn AI
════════════════════════════════════════════

📦 Actualizare sistem...
[System output...]

🐳 Instalare Docker...
[Docker installation...]

[... more progress ...]

✅ Configurare completă!
```

### Step 5: Save Configuration

After completion, the script saves:
- `hetzner-setup-config.json` - Your server configuration for reference

---

## 📋 Configuration File

Create `.env` in your project root (optional, for defaults):

```env
# Hetzner Server
HETZNER_HOST=204.168.230.142
HETZNER_USER=root
HETZNER_API_KEY=4PN2WM0kpWqz27P1TiTLlux6F09SnXR6ixCDROZpEnoglWMBWpaZFYsTNQJe64kX
HETZNER_SSH_KEY_PATH=~/.ssh/hetzner_rsa
HETZNER_DEPLOY_PATH=/root/unicorn-live
HETZNER_WEBHOOK_SECRET=your-webhook-secret

# GitHub Repository
GIT_REMOTE_URL=https://github.com/user/repo.git
GIT_BRANCH=main
```

If `.env` exists, these values are used as defaults in the interactive prompts.

---

## 🔗 Setting Up Webhooks

After successful setup, add webhook to GitHub:

1. Go to: **Repository Settings → Webhooks → Add webhook**

2. Fill in:
   - **Payload URL**: `http://YOUR_SERVER_IP:3001/webhook/update`
   - **Content type**: `application/json`
   - **Secret**: The secret shown after setup (or from `hetzner-setup-config.json`)
   - **Which events would you like to trigger this webhook?**: Select "Push events"

3. Click **Add webhook**

Now every push to your repository will trigger automatic deployment!

---

## 🔄 How It Works

### On Push to GitHub

```
1. You: git push origin main
         ↓
2. GitHub: Sends webhook to http://YOUR_SERVER:3001/webhook/update
         ↓
3. Webhook Server: Receives request, verifies signature
         ↓
4. Server: Runs git pull && npm install
         ↓
5. Systemd: Restarts unicorn service
         ↓
✅ Your app is updated!
```

### Periodic Updates (Every 5 minutes)

Via cron job, the server automatically:
1. Pulls latest changes from GitHub
2. Installs new dependencies
3. Restarts the service

---

## 📊 Managing Your Server

### SSH Into Server
```bash
ssh -i ~/.ssh/hetzner_rsa root@YOUR_SERVER_IP
```

### Check Application Status
```bash
systemctl status unicorn
systemctl status unicorn-webhook
journalctl -u unicorn -f  # Real-time logs
```

### Check PM2 (if installed)
```bash
pm2 list
pm2 logs unicorn-webhook
pm2 monit
```

### View Webhook Server Logs
```bash
tail -f /var/log/unicorn-webhook.log
```

### View Update Logs
```bash
tail -f /var/log/unicorn-update.log
```

### Manual Restart
```bash
systemctl restart unicorn
systemctl restart unicorn-webhook
```

### Manual Update
```bash
cd /root/unicorn-live
git pull origin main
npm install
systemctl restart unicorn
```

---

## 🐛 Troubleshooting

### SSH Connection Failed

```bash
# Test SSH connection
ssh -i ~/.ssh/hetzner_rsa -v root@YOUR_SERVER_IP

# Check key permissions
chmod 600 ~/.ssh/hetzner_rsa
chmod 700 ~/.ssh/

# Add key to server if not already there
ssh-copy-id -i ~/.ssh/hetzner_rsa.pub root@YOUR_SERVER_IP
```

### Webhook Not Triggering

```bash
# Check webhook server is running
systemctl status unicorn-webhook

# Check if port 3001 is listening
ss -tlnp | grep 3001

# Test webhook manually
curl -X POST http://YOUR_SERVER_IP:3001/webhook/update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{}'
```

### Application Not Starting

```bash
# Check service status
systemctl status unicorn

# View service logs
journalctl -u unicorn -n 50

# Check if port 3000 is already in use
ss -tlnp | grep 3000

# Manually start and see errors
cd /root/unicorn-live && npm start
```

### Dependencies Installation Failed

```bash
# SSH to server and reinstall
cd /root/unicorn-live
npm cache clean --force
npm install
```

### Disk Space Issue

```bash
# Check disk usage
df -h

# Clean Docker if needed
docker system prune -a

# Clean npm cache
npm cache clean --force
```

---

## 🔐 Security Best Practices

✅ **SSH Keys**
- Use strong key length: `-b 4096`
- Keep private key safe (chmod 600)
- Never commit private keys to Git

✅ **Webhook Secret**
- Use the auto-generated secret (strong random)
- Store it in GitHub webhook settings
- Never expose in logs or code

✅ **Environment Variables**
- Create `.env` on server (not in Git)
- Use strong values for secrets
- Rotate credentials regularly

✅ **Firewall**
- Only open necessary ports (22, 80, 443, 3001)
- Use Hetzner's firewall features
- Consider rate limiting on webhook endpoint

---

## 📈 Monitoring and Logs

### Application Logs
```bash
# Real-time logs
journalctl -u unicorn -f

# Last 100 lines
journalctl -u unicorn -n 100

# Since last boot
journalctl -u unicorn --since today
```

### Webhook Logs
```bash
# Check if webhook server is running
ps aux | grep webhook-server

# PM2 logs (if installed)
pm2 logs unicorn-webhook
```

### System Logs
```bash
# Check for errors
tail -f /var/log/syslog
tail -f /var/log/auth.log
```

---

## 🎯 Next Steps

After setup is complete:

1. **Verify Setup**
   - Check `systemctl status unicorn`
   - Test webhook with a push
   - Monitor logs in real-time

2. **Configure Monitoring**
   - Setup email alerts for failures
   - Configure uptime monitoring
   - Setup log aggregation

3. **Setup CI/CD**
   - Add GitHub Actions for testing
   - Configure automatic deployments
   - Setup staging environment

4. **Optimize Performance**
   - Setup caching (Redis)
   - Configure CDN
   - Monitor application performance

5. **Secure Your Server**
   - Configure SSL/TLS
   - Setup fail2ban for intrusion prevention
   - Regular security updates

---

## 💻 System Services Created

### unicorn.service
- Main application service
- Runs: `npm start`
- Auto-restarts on crash
- Logs: `journalctl -u unicorn`

### unicorn-webhook.service
- Webhook server for GitHub
- Runs on port 3001
- Listens for push events
- Triggers git pull + npm install

### cron job: unicorn-update
- Runs every 5 minutes
- Checks for updates
- Auto-pulls and restarts if needed
- Log: `/var/log/unicorn-update.log`

---

## 📚 Files Generated

After setup, on your server you'll have:

```
/root/unicorn-live/
├── webhook-server.js       # Webhook server code
├── .env                     # Environment variables
├── node_modules/           # Dependencies
├── src/                     # Backend code
├── client/                  # React frontend
│   └── build/              # Built frontend
└── logs/                    # Application logs
```

---

## 🔗 Integration with Other Tools

### With GitHub Actions
```yaml
name: Deploy to Hetzner
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Trigger Webhook
        run: |
          curl -X POST ${{ secrets.WEBHOOK_URL }} \
            -H "X-Webhook-Secret: ${{ secrets.WEBHOOK_SECRET }}"
```

### With Slack Notifications
```javascript
// Add to webhook-server.js to notify Slack on deploy
const slack = require('slack-notify')(process.env.SLACK_WEBHOOK);
slack.send({ text: 'Deployment triggered!' });
```

---

## 📞 Support

For issues:

1. **Check logs**
   ```bash
   journalctl -u unicorn -n 100
   systemctl status unicorn-webhook
   ```

2. **Verify configuration**
   ```bash
   cat hetzner-setup-config.json
   ```

3. **Test connectivity**
   ```bash
   ssh -i ~/.ssh/hetzner_rsa root@YOUR_SERVER_IP "systemctl status unicorn"
   ```

4. **Manual webhook test**
   ```bash
   curl -v -X POST http://YOUR_SERVER:3001/webhook/update \
     -H "X-Webhook-Secret: YOUR_SECRET"
   ```

---

## ✨ Advanced Usage

### Scale to Multiple Servers

```javascript
const servers = [
  { host: '1.1.1.1', path: '/root/unicorn-1' },
  { host: '2.2.2.2', path: '/root/unicorn-2' },
  { host: '3.3.3.3', path: '/root/unicorn-3' }
];

for (const server of servers) {
  // Run setup_hetzner.js for each
}
```

### Custom Deployment Script

Modify the setup script to add your own commands:

```bash
# Add this to the setup script in getSetupScript():
script += `echo "🚀 Running custom deployment steps..."\n`;
script += `cd ${deployPath}\n`;
script += `# Your custom commands here\n`;
```

### Docker Deployment (Optional)

Use Docker Compose instead of systemd:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
  webhook:
    build: ./webhook
    ports:
      - "3001:3001"
```

---

Made with ❤️ for **Unicorn AI Platform**
