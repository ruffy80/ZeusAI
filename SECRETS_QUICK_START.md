# 🔐 Secret Setup Quick Checklist

## Phase 1: Local Development (5 min)

```bash
# 1. Copy example file
cp .env.auto-connector.example .env.auto-connector

# 2. Edit with your real secrets
nano .env.auto-connector

# 3. Test it works
source .env.auto-connector
echo $HETZNER_API_KEY  # Should print your key (don't share!)

# 4. Verify it's git-ignored
git status | grep .env.auto-connector  # Should show nothing
```

## Phase 2: GitHub Secrets (10 min)

### Option A: Using GitHub CLI (Recommended)
```bash
gh secret set GITHUB_TOKEN --body "ghp_your_token_here"
gh secret set VERCEL_TOKEN --body "vcp_your_token_here"
gh secret set VERCEL_ORG_ID --body "team_your_org_id"
gh secret set VERCEL_PROJECT_ID --body "prj_your_project_id"
gh secret set HETZNER_HOST --body "192.168.1.100"
gh secret set HETZNER_USER --body "root"
gh secret set HETZNER_DEPLOY_USER --body "app-user"
gh secret set HETZNER_DEPLOY_PORT --body "22"
gh secret set HETZNER_API_KEY --body "your_hetzner_api_key"
gh secret set HETZNER_SSH_PRIVATE_KEY --body "$(cat ~/.ssh/hetzner_rsa)"
gh secret set HETZNER_DEPLOY_PATH --body "/home/app/unicorn"

# Verify
gh secret list
```

### Option B: Using GitHub UI
1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret from table below

### Option C: Using Automated Script
```bash
source .env.auto-connector
./setup-platform-auto-connect.sh
```

## Phase 3: Deploy to Hetzner (15 min)

```bash
# Push code to trigger GitHub Actions
git add .
git commit -m "Initial deployment"
git push origin main

# Watch the workflow
gh run view --web

# SSH into server after deployment
ssh -i ~/.ssh/hetzner_rsa -p 22 root@your.server.ip

# Verify app is running
pm2 list  # or: systemctl status unicorn
curl localhost:3000/health  # Should return 200 OK
```

---

## 📋 Required Secrets Reference

| Secret | Value | Example | Get From |
|--------|-------|---------|----------|
| `GITHUB_TOKEN` | Your GitHub PAT | `ghp_xxxxxxxxxxxx` | https://github.com/settings/tokens |
| `VERCEL_TOKEN` | Your Vercel token | `vcp_xxxxxxxx` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Your org ID | `team_qwerty` | https://vercel.com/dashboard |
| `VERCEL_PROJECT_ID` | Your project ID | `prj_zxcvbnm` | https://vercel.com/dashboard |
| `HETZNER_HOST` | Server IP | `192.168.1.100` | Your Hetzner console |
| `HETZNER_USER` | SSH user | `root` | Your server |
| `HETZNER_DEPLOY_USER` | Deploy user | `app-user` | Your preference |
| `HETZNER_DEPLOY_PORT` | SSH port | `22` | Your server |
| `HETZNER_API_KEY` | Hetzner API key | (token) | https://console.hetzner.cloud |
| `HETZNER_SSH_PRIVATE_KEY` | Your private SSH key | (full key file) | `cat ~/.ssh/hetzner_rsa` |
| `HETZNER_DEPLOY_PATH` | App directory | `/home/app/unicorn` | Your choice |

---

## ⚠️ DO NOT

❌ Commit `.env` or `.env.auto-connector` files  
❌ Paste secrets in Slack, email, or unencrypted channels  
❌ Print secrets in logs or console output  
❌ Use the same token for multiple environments  
❌ Store secrets in comments or documentation  
❌ Share GitHub/Vercel/Hetzner credentials directly  

---

## ✅ VERIFY SETUP

```bash
# Check 1: .env files are git-ignored
git status | grep -E "\.env|auto-connector"  
# Should show: nothing

# Check 2: Secrets are in GitHub
gh secret list | wc -l
# Should show: 11+ secrets

# Check 3: SSH key has right permissions
ls -la ~/.ssh/hetzner_rsa | cut -d' ' -f1
# Should show: -rw------- (600)

# Check 4: No real secrets in example files
grep -E "ghp_[A-Za-z0-9]+|vcp_[A-Za-z0-9]+|^[0-9]{1,3}\.[0-9]{1,3}" .env*.example
# Should show: nothing OR only "YOUR_*_HERE" placeholders
```

---

## 🚨 EMERGENCY: Secrets Exposed?

**Act within minutes:**

```bash
# 1. Regenerate token immediately
# GitHub: https://github.com/settings/tokens → Delete old, create new
# Vercel: https://vercel.com/account/tokens → Delete old, create new
# Hetzner: https://console.hetzner.cloud → Delete old, create new

# 2. Update GitHub Secrets
gh secret set EXPOSED_SECRET_NAME --body "new_value"

# 3. Tell your team to stop using old token
# 4. Audit logs for unauthorized access
# 5. Force-push if committed to git:
git filter-branch --tree-filter 'rm -f .env.auto-connector' -- --all
git push origin main --force-with-lease
```

---

## 📖 Full Documentation

For detailed guides, troubleshooting, and best practices:
- **[SECRET_MANAGEMENT.md](SECRET_MANAGEMENT.md)** ← Read this for complete guide
- **[SECRETS_IMPLEMENTATION_SUMMARY.md](SECRETS_IMPLEMENTATION_SUMMARY.md)** ← Implementation details

---

## 💬 Questions?

See **SECRET_MANAGEMENT.md** → **Troubleshooting** section
