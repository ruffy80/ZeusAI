#!/bin/bash
# =================================================================
# UNICORN AI PLATFORM - QUICK REFERENCE CARD
# GitHub + Vercel + Hetzner Auto Connector
# =================================================================

echo "
╔════════════════════════════════════════════════════════════════╗
║        UNICORN AI - GitHub/Vercel/Hetzner Auto-Deploy         ║
║                       Quick Reference                          ║
╚════════════════════════════════════════════════════════════════╝

📦 NEW FILES CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ github-vercel-hetzner-connector.js
   → Main automation module with 4 classes
   → GitHubAutoConnector
   → VercelAutoLinker  
   → HetznerSSHManager
   → PlatformOrchestrator

✅ .env.auto-connector.example
   → Configuration template
   → Fill with your credentials

✅ setup-platform-auto-connect.sh
   → One-time setup script
   → Creates GitHub repo
   → Links to Vercel
   → Deploys to Hetzner
   → Sets up webhooks

✅ GITHUB-VERCEL-HETZNER-CONNECTOR.md
   → Complete technical documentation
   → API reference
   → Troubleshooting guide

✅ IMPLEMENTATION-GUIDE.md
   → Step-by-step setup guide
   → Example use cases
   → Security best practices


🚀 QUICK START (5 STEPS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Generate the project
   $ node generate_unicorn_final.js

2. Prepare configuration
   $ cp .env.auto-connector.example .env.auto-connector
   $ nano .env.auto-connector  # Edit with your credentials

3. Run auto setup
   $ bash setup-platform-auto-connect.sh

4. Wait for completion
   ✅ GitHub repo created
   ✅ Vercel project linked
   ✅ Hetzner deployed
   ✅ Webhooks configured

5. Deploy!
   $ cd UNICORN_FINAL
   $ git push origin main
   → Automatic deployment to all 3 platforms


📋 CREDENTIALS NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. GITHUB TOKEN
   → https://github.com/settings/tokens
   → Scopes: repo, workflow, admin:repo_hook
   → Format: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

2. VERCEL TOKEN + TEAM ID
   → https://vercel.com/account/tokens
   → Team ID from: https://vercel.com/account/settings
   → Format: VercelProdTokenxxxxxxxxxxx

3. HETZNER SERVER
   → IP/hostname (e.g., server.example.com)
   → SSH key: ssh-keygen -t rsa -b 4096 -f ~/.ssh/hetzner_rsa
   → Root access (usually 'root' user)


📁 FILES & LOCATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

On Your Machine:
├── .env.auto-connector              (DO NOT COMMIT)
├── github-vercel-hetzner-connector.js
├── setup-platform-auto-connect.sh
├── IMPLEMENTATION-GUIDE.md
├── GITHUB-VERCEL-HETZNER-CONNECTOR.md
├── platform-setup-results.json
└── UNICORN_FINAL/
    ├── .env.example
    ├── src/ (backend)
    ├── client/ (React frontend)
    └── package.json

On GitHub:
└── unicorn-final/
    ├── .github/workflows/deploy.yml
    ├── All your code (auto-synced)
    └── Webhooks configured

On Vercel:
└── unicorn-final (project)
    ├── Linked to GitHub
    ├── Preview deployments
    └── Production deployment

On Hetzner (/root/unicorn-final/):
├── (Full project clone)
├── webhook-server.js (port 3001)
├── node_modules/
└── Running with PM2


🔄 DEPLOYMENT FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git push origin main
         ↓
    [GitHub]
         ↓
   [2 webhooks]
     ↙        ↘
[Vercel]   [Hetzner:3001]
   ↓            ↓
Auto-deploy  git pull + build
   ↓            ↓
Production  App restart
   ↓            ↓
Live!       Live!


🔐 SECURITY CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Never commit .env.auto-connector
✅ SSH key on your machine only (chmod 600)
✅ Use GitHub Secrets for API keys
✅ Generate strong webhook secret: openssl rand -base64 32
✅ Rotate tokens every 90 days
✅ Monitor GitHub Action logs for failures
✅ Use strong HETZNER passwords


📊 VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check GitHub:
  open https://github.com/your-username/unicorn-final

Check Vercel:
  open https://vercel.com/dashboard

Check Hetzner:
   ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142
  cd /root/unicorn-final && ls -la
  pm2 status

Check Results File:
  cat platform-setup-results.json


⚠️ TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SSH Connection Failed:
   ssh -i ~/.ssh/hetzner_rsa -v root@204.168.230.142

Webhook Not Firing:
  Check: GitHub Settings → Webhooks → Recent Deliveries

Vercel Not Deploying:
  Check: GitHub Actions tab → Workflows

App Not Restarting on Hetzner:
   ssh root@204.168.230.142
  pm2 logs webhook-server


🎓 WHAT WAS CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4 Powerful Classes:

1. GitHubAutoConnector
   - createRepository()
   - setupDeployKey()
   - setupSecrets()
   - setupWebhook()

2. VercelAutoLinker
   - createProject()
   - setEnvironmentVariables()
   - triggerDeployment()
   - getDeploymentStatus()

3. HetznerSSHManager
   - connect()
   - deployRepository()
   - setupWebhookServer()
   - setupAuthorizedKeys()
   - disconnect()

4. PlatformOrchestrator
   - setupAll() [Master method]


📚 DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPLEMENTATION-GUIDE.md ← START HERE
  ✅ Overview
  ✅ Step-by-step setup
  ✅ Configuration
  ✅ Verification
  ✅ Troubleshooting
  ✅ Examples

GITHUB-VERCEL-HETZNER-CONNECTOR.md ← TECHNICAL REFERENCE
  ✅ API documentation
  ✅ Module usage
  ✅ Security details
  ✅ Deployment flow
  ✅ Best practices

generate_unicorn_final.js ← MAIN GENERATOR
  ✅ Now includes notes about auto-connector
  ✅ Original 4,866 lines intact
  ✅ Ready to generate projects


💡 PRO TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Test SSH before setup:
   ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142

2. Use a staging Vercel project first:
   VERCEL_TEAM_ID for staging, different for production

3. Keep backups of .env.auto-connector (never commit!)

4. Monitor with: 
   ssh root@204.168.230.142 && pm2 logs

5. Scale easily:
   Multiple Hetzner servers = loop through HetznerSSHManager

6. Rollback quickly:
   GitHub: revert commit + push
   Hetzner: git revert + webhook auto-triggers
   Vercel: one-click rollback in dashboard


🎯 ARCHITECTURE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────┐
│  Your Machine (git push)                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
            ┌────────┴────────┐
            ↓                 ↓
      ┌──────────┐      ┌──────────┐
      │  GitHub  │      │  Vercel  │
      │          │      │          │
      │  Webhook │  ←→  │ Deploys  │
      │  Server  │      │ Frontend │
      └────┬─────┘      └──────────┘
           │
           ↓
      ┌──────────────┐
      │   Hetzner    │
      │              │
      │ Webhook :3001│
      │ Pulls & Builds│
      │ Restarts App │
      └──────────────┘

All 3 stay in sync with every push!


✨ NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Read IMPLEMENTATION-GUIDE.md (5 min)
2. Prepare credentials (GitHub, Vercel, Hetzner)
3. Run: bash setup-platform-auto-connect.sh (5 min)
4. Verify setup in all 3 platforms
5. Push code and watch it deploy!

Done! Your AI platform is now fully automated! 🎉

═════════════════════════════════════════════════════════════════
"
