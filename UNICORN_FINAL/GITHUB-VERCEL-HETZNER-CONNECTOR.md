# GitHub-Vercel-Hetzner Auto Connector

Complete automation for connecting your Unicorn AI platform to GitHub, Vercel, and Hetzner with a single setup script.

## 🚀 What It Does

This module **automatically**:

### 🐙 GitHub
- ✅ Creates a new private/public repository
- ✅ Initializes with Node.js `.gitignore`
- ✅ Adds deploy keys for Hetzner SSH access
- ✅ Configures GitHub Secrets (Vercel token, Hetzner API key, admin credentials)
- ✅ Sets up webhook for automatic deployments
- ✅ Deploys GitHub Actions workflow

### 🎯 Vercel
- ✅ Creates Vercel project
- ✅ Links GitHub repository (auto-deploy on push)
- ✅ Configures environment variables
- ✅ Sets up preview + production environments
- ✅ Triggers initial deployment

### 🖥️ Hetzner
- ✅ SSH connection to your server
- ✅ Clones repository automatically
- ✅ Installs dependencies (`npm install`)
- ✅ Builds application (`npm run build`)
- ✅ Deploys webhook server on port 3001
- ✅ Authorizes SSH keys for future deployments

---

## 📋 Prerequisites

### 1. Create GitHub Personal Access Token
```bash
# Go to https://github.com/settings/tokens
# Create token with:
# - repo (full control of private repositories)
# - workflow (update GitHub Action workflows)
# - admin:repo_hook (write access to hooks)
```

### 2. Create Vercel API Token
```bash
# Go to https://vercel.com/account/tokens
# Create token (save it somewhere safe!)
```

### 3. Hetzner Server Setup
```bash
# You need:
# - Server IP/hostname
# - Root username (usually 'root')
# - SSH key pair

# Generate SSH key if you don't have one:
ssh-keygen -t rsa -b 4096 -f ~/.ssh/hetzner_rsa -N ""

# Verify connection:
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142
```

### 4. Install node-ssh
```bash
npm install node-ssh axios dotenv
```

---

## ⚡ Quick Start

### Step 1: Prepare Configuration
```bash
cp .env.auto-connector.example .env.auto-connector
```

Edit `.env.auto-connector` with your credentials:
```env
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
GITHUB_OWNER=ruffy80
GIT_REMOTE_URL=https://github.com/ruffy80/ZeusAI.git
GITHUB_SECRET_VERCEL_TOKEN=VercelProdTokenxxxxxxxxxxx
GITHUB_SECRET_HETZNER_KEY=your-hetzner-api-key
GITHUB_SECRET_ADMIN=your-secure-admin-secret

VERCEL_TOKEN=vcp_YOUR_VERCEL_TOKEN_HERE
VERCEL_TEAM_ID=team_wes3fQvKjdfOMKXe7f4fFQoL
VERCEL_ORG_ID=team_wes3fQvKjdfOMKXe7f4fFQoL
VERCEL_PROJECT_ID=prj_HZRAdxaNZf4m5jhkR1gpQLI9FWVu

HETZNER_HOST=204.168.230.142
HETZNER_USER=unicorn
HETZNER_DEPLOY_USER=unicorn
HETZNER_DEPLOY_PORT=22
HETZNER_API_KEY=4PN2WM0kpWqz27P1TiTLlux6F09SnXR6ixCDROZpEnoglWMBWpaZFYsTNQJe64kX
HETZNER_KEY_PATH=/Users/your-user/.ssh/hetzner_rsa
HETZNER_SSH_PUBLIC_KEY=ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICPzpyffuh3sR0unAz1MInbestMKeZRzUlq0d1OEJ9LE unicorn
HETZNER_DEPLOY_PATH=/root/unicorn-final

GITHUB_WEBHOOK_URL=http://204.168.230.142:3001/webhook/github
HETZNER_WEBHOOK_URL=http://204.168.230.142:3001/webhook/update
VERCEL_DEPLOY_HOOK_URL=
WEBHOOK_URL=http://204.168.230.142:3001/webhook/github
WEBHOOK_SECRET=generate-random-secret-here
HETZNER_WEBHOOK_SECRET=generate-random-secret-here

VERCEL_ENV_API_URL=https://api.example.com
VERCEL_ENV_DATABASE_URL=postgresql://user:pass@db:5432/unicorn
VERCEL_ENV_ADMIN_SECRET=your-admin-secret-here
```

### Step 2: Run Auto Setup
```bash
bash setup-platform-auto-connect.sh
```

This will:
1. ✅ Check SSH keys (generates if missing)
2. ✅ Install dependencies
3. ✅ Run full platform setup
4. ✅ Save results to `platform-setup-results.json`

### Step 3: Verify Setup
```bash
# Check GitHub
open https://github.com/your-username/unicorn-final

# Check Vercel
open https://vercel.com/dashboard

# Check Hetzner connection
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142
# Should see: ls -la /root/unicorn-final
```

---

## 🔧 Manual Usage (Without Script)

If you prefer to use the connector programmatically:

```javascript
const connector = require('./github-vercel-hetzner-connector.js');

const config = {
  github: {
    token: 'your-github-token',
    owner: 'your-username',
    secrets: {
      VERCEL_TOKEN: 'vercel-token',
      ADMIN_SECRET: 'admin-secret'
    }
  },
  vercel: {
    token: 'vercel-token',
    teamId: 'team_xxx',
    envVars: {
      API_URL: 'https://api.example.com',
      ADMIN_SECRET: 'admin-secret'
    }
  },
  hetzner: {
    host: 'server.example.com',
    user: 'root',
    privateKeyPath: '/path/to/ssh/key',
    deployPath: '/root/unicorn-final',
    publicKey: 'ssh-rsa AAAA...'
  },
  webhook: {
    url: 'http://204.168.230.142:3001/webhook/github',
    secret: 'webhook-secret'
  }
};

// Run setup
const results = await connector.setupAll(config);
console.log('Setup complete:', results);
```

---

## 📚 Module APIs

### GitHubAutoConnector

```javascript
const { GitHubAutoConnector } = require('./github-vercel-hetzner-connector.js');

const github = new GitHubAutoConnector(token, owner);

// Create repository
await github.createRepository();

// Add deploy key
await github.setupDeployKey(publicKey, title);

// Setup secrets
await github.setupSecrets({
  SECRET_NAME: 'secret-value'
});

// Setup webhook
await github.setupWebhook(webhookUrl, webhookSecret);
```

### VercelAutoLinker

```javascript
const { VercelAutoLinker } = require('./github-vercel-hetzner-connector.js');

const vercel = new VercelAutoLinker(token);

// Create project
await vercel.createProject('project-name', 'owner/repo');

// Set environment variables
await vercel.setEnvironmentVariables(projectId, {
  API_URL: 'https://...',
  DATABASE_URL: 'postgresql://...'
});

// Trigger deployment
await vercel.triggerDeployment(projectId);
```

### HetznerSSHManager

```javascript
const { HetznerSSHManager } = require('./github-vercel-hetzner-connector.js');

const hetzner = new HetznerSSHManager(host, user, keyPath);

// Connect
await hetzner.connect();

// Deploy repository
await hetzner.deployRepository(repoUrl, deployPath);

// Setup webhook server
await hetzner.setupWebhookServer(deployPath, webhookSecret);

// Setup SSH keys
await hetzner.setupAuthorizedKeys(publicKey);

// Disconnect
await hetzner.disconnect();
```

### PlatformOrchestrator

```javascript
const { PlatformOrchestrator } = require('./github-vercel-hetzner-connector.js');

const orchestrator = new PlatformOrchestrator();
const results = await orchestrator.setupAll(config);
```

---

## 🔄 How It Works

### Deployment Flow

```
1. You push code to GitHub
   ↓
2. GitHub triggers webhook (configured during setup)
   ↓
3. Hetzner receives webhook on port 3001
   ↓
4. Webhook server runs: git pull + npm install + npm run build
   ↓
5. Application auto-restarts via PM2
   ↓
6. Vercel also auto-deploys (GitHub integration)
   ↓
✅ Both platforms now running latest code
```

### File Structure After Setup

```
unicorn-final/
├── .github/
│   └── workflows/
│       └── deploy.yml (auto-created)
├── .env.example
├── .env (not committed)
├── .gitignore
├── src/
├── client/
├── UNICORN_FINAL.zip
└── README.md

Hetzner Server (/root/unicorn-final/):
├── [full clone of above]
├── webhook-server.js (running on port 3001)
├── node_modules/ (after npm install)
└── logs/
```

---

## 🚨 Security Considerations

### ✅ Best Practices Implemented

1. **GitHub Secrets** - API keys stored securely in GitHub, not in code
2. **SSH Keys** - Private key only on your machine, public key on Hetzner
3. **Webhook Secret** - HMAC signature verification for GitHub webhooks
4. **Admin Secret** - All admin routes protected with secret header
5. **SSH Authentication** - No password login, key-based authentication only
6. **Environment Variables** - Separate `.env.example` committed, `.env` in `.gitignore`

### 🔐 What To Do

1. **Never commit** `.env` or `.env.auto-connector`
2. **Rotate tokens** periodically (GitHub, Vercel, Hetzner)
3. **Monitor logs** for unauthorized access attempts
4. **Use strong** webhook secrets (use `openssl rand -base64 32`)
5. **Limit GitHub** token permissions to only what's needed

### 🔒 Example: Generate Strong Secrets

```bash
# Generate webhook secret
openssl rand -base64 32

# Generate admin secret
openssl rand -hex 32

# Generate strong password
openssl rand -base64 16
```

---

## 📊 Results File

After setup, check `platform-setup-results.json`:

```json
{
  "github": {
    "success": true,
    "repoUrl": "https://github.com/your-username/unicorn-final.git",
    "repoSshUrl": "git@github.com:your-username/unicorn-final.git"
  },
  "vercel": {
    "success": true,
    "projectId": "prj_xxxxxxxxxxxxx"
  },
  "hetzner": {
    "success": true
  }
}
```

---

## 🐛 Troubleshooting

### GitHub Token Issues
```bash
# Verify token works
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# Check token permissions
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user/repos
```

### SSH Connection Failed
```bash
# Test SSH connection
ssh -i ~/.ssh/hetzner_rsa -v root@204.168.230.142

# Check permissions
chmod 600 ~/.ssh/hetzner_rsa
chmod 700 ~/.ssh/

# Test from Hetzner
ssh-copy-id -i ~/.ssh/hetzner_rsa.pub root@204.168.230.142
```

### Webhook Not Triggering
```bash
# Check webhook in GitHub
# Settings → Webhooks → Recent Deliveries

# Test webhook locally
curl -X POST http://localhost:3001/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=xxx" \
  -d '{"push": "test"}'
```

### Vercel Deploy Stuck
```bash
# Check Vercel logs
open https://vercel.com/dashboard/project-name/deployments

# Check GitHub Actions
open https://github.com/your-username/unicorn-final/actions
```

---

## 📖 Additional Resources

- [GitHub Personal Access Tokens](https://github.com/settings/tokens)
- [Vercel API Documentation](https://vercel.com/docs/rest-api)
- [Hetzner API Reference](https://docs.hetzner.cloud/)
- [Node-SSH Documentation](https://github.com/mscdex/ssh2)

---

## 💬 Support

For issues or questions:
1. Check `platform-setup-results.json` for error details
2. Review logs in `.github/workflows/` for GitHub Actions
3. SSH into Hetzner and check: `pm2 logs webhook-server`
4. Check Vercel deployment logs: `vercel logs`

---

**Made with ❤️ for Unicorn AI Platform**
