# Secret Management Guide

This document explains how to securely manage API keys, tokens, and credentials in the **generate-unicorn** project.

## Table of Contents
1. [Overview](#overview)
2. [Environment Files](#environment-files)
3. [GitHub Secrets Setup](#github-secrets-setup)
4. [Local Development Setup](#local-development-setup)
5. [Hetzner Deployment Setup](#hetzner-deployment-setup)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This project uses **environment variables** to manage secrets securely. Secrets are:
- **Never hardcoded** in source files
- **Never committed** to git
- **Stored locally** in `.env` and `.env.auto-connector` files (git-ignored)
- **Injected** via GitHub Secrets in CI/CD workflows
- **Passed securely** to Hetzner runtime during deployment

### Architecture
```
Local Development (.env.auto-connector)
                ↓
GitHub Secrets (via UI or gh CLI)
                ↓
GitHub Actions Workflows
                ↓
Hetzner Deployment (injected into .env)
```

---

## Environment Files

### Files & Their Purpose

| File | Location | Purpose | Committed? |
|------|----------|---------|-----------|
| `.env.auto-connector.example` | Root & `UNICORN_FINAL/` | Template with placeholders | ✅ Yes |
| `.env.auto-connector` | Root (setup script) | Your actual secrets | ❌ No (.gitignore) |
| `.env.example` | `UNICORN_FINAL/` | Template with placeholders | ✅ Yes |
| `.env` | `UNICORN_FINAL/` | Runtime secrets (server-side) | ❌ No (.gitignore) |

### `.env.auto-connector.example` Sections

```bash
# GitHub - for CI/CD
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
GIT_REMOTE_URL=https://github.com/your-username/your-repo.git

# Vercel - for front-end deployment
VERCEL_TOKEN=vcp_YOUR_VERCEL_TOKEN_HERE
VERCEL_ORG_ID=team_YOUR_ORG_ID_HERE
VERCEL_PROJECT_ID=prj_YOUR_PROJECT_ID_HERE

# Hetzner - for server deployment
HETZNER_HOST=your.server.ip.address
HETZNER_API_KEY=YOUR_HETZNER_API_KEY_HERE
HETZNER_DEPLOY_USER=your-deploy-user
HETZNER_KEY_PATH=/Users/your-username/.ssh/hetzner_rsa

# Payment gateways
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLIC_HERE
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID_HERE
```

---

## GitHub Secrets Setup

### Step 1: Generate Personal Access Tokens

**For GitHub Actions CI/CD:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `admin:repo_hook`
4. Copy the token (you'll only see it once!)

**For Vercel:**
1. Go to https://vercel.com/account/tokens
2. Create a new token
3. Copy the token

**For Hetzner:**
1. Go to https://console.hetzner.cloud/projects
2. Select your project → API Tokens
3. Create a new token
4. Copy the token

### Step 2: Add Secrets to GitHub

Via **GitHub UI**:
1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each required secret:

```
GITHUB_TOKEN              = ghp_...
VERCEL_TOKEN              = vcp_...
VERCEL_ORG_ID             = team_...
VERCEL_PROJECT_ID         = prj_...
HETZNER_HOST              = 192.168.1.100
HETZNER_USER              = root
HETZNER_DEPLOY_USER       = app-user
HETZNER_DEPLOY_PORT       = 22
HETZNER_API_KEY           = (your Hetzner API key)
HETZNER_SSH_PRIVATE_KEY   = (contents of ~/.ssh/hetzner_rsa)
HETZNER_DEPLOY_PATH       = /home/app/unicorn
```

**Via GitHub CLI**:
```bash
# Make sure you're authenticated: gh auth login
gh secret set GITHUB_TOKEN --body "ghp_..."
gh secret set VERCEL_TOKEN --body "vcp_..."
gh secret set HETZNER_API_KEY --body "..."
# ... etc
```

### Step 3: Verify Secrets are Set

```bash
gh secret list
```

You should NOT see the actual values, only the secret names.

---

## Local Development Setup

### Step 1: Copy Example File

```bash
cd /path/to/generate-unicorn
cp .env.auto-connector.example .env.auto-connector
```

### Step 2: Fill in Real Values

Edit `.env.auto-connector` and replace placeholders:
```bash
nano .env.auto-connector
```

Example filled-in section:
```bash
GITHUB_OWNER=myusername
GITHUB_REPO=my-project
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuv
GIT_REMOTE_URL=https://github.com/myusername/my-project.git

VERCEL_TOKEN=vcp_asdfghjkl
VERCEL_ORG_ID=team_qwerty
VERCEL_PROJECT_ID=prj_zxcvbnm

HETZNER_HOST=192.168.1.100
HETZNER_USER=root
HETZNER_DEPLOY_USER=app-user
HETZNER_DEPLOY_PORT=22
HETZNER_API_KEY=YOUR_ACTUAL_HETZNER_API_KEY
HETZNER_KEY_PATH=/Users/yourname/.ssh/hetzner_rsa
HETZNER_DEPLOY_PATH=/home/app/unicorn
```

### Step 3: Verify It's Git-Ignored

Check that `.env.auto-connector` is in `.gitignore`:
```bash
grep "\.env\.auto-connector" .gitignore
# Should output: .env.auto-connector
```

### Step 4: Test Access

```bash
source .env.auto-connector
echo $HETZNER_API_KEY
# Should print your Hetzner API key (don't share!)
```

---

## Hetzner Deployment Setup

### Automatic Setup Script

The `setup-platform-auto-connect.sh` script automates GitHub Secrets configuration:

```bash
./setup-platform-auto-connect.sh
```

This script:
1. ✅ Reads your `.env.auto-connector`
2. ✅ Validates all required secrets
3. ✅ Prints GitHub CLI commands to add secrets
4. ✅ Bootstraps Hetzner server with Node.js, Git, nginx
5. ✅ Tests SSH connectivity

### Manual Hetzner Setup

If you prefer manual setup, use `setup_hetzner.js`:

```bash
npm install ssh2 dotenv inquirer  # Install dependencies
node setup_hetzner.js              # Interactive setup
```

This will:
1. Ask for Hetzner server IP, username, API key
2. Connect via SSH and install dependencies
3. Clone your repository
4. Setup systemd services
5. Configure nginx reverse proxy

### Workflow During Deployment

When you push to `main`:
1. GitHub Actions checks out code
2. Validates with `npm test` and `npm run lint`
3. **Deploys to Vercel** using `VERCEL_TOKEN` from secrets
4. **Deploys to Hetzner** using:
   - `HETZNER_HOST`, `HETZNER_DEPLOY_USER`, `HETZNER_API_KEY` (from secrets)
   - `HETZNER_SSH_PRIVATE_KEY` for SSH connection
5. Creates `.env` file on Hetzner with `HETZNER_API_KEY` injected
6. Restarts the application

---

## Best Practices

### ✅ DO

- ✅ Use `.env.auto-connector` for **local development only**
- ✅ Store production secrets in **GitHub Secrets**
- ✅ Keep `.env` and `.env.auto-connector` in `.gitignore`
- ✅ Rotate tokens regularly (every 3-6 months)
- ✅ Use **separate tokens** for dev/staging/production
- ✅ Restrict token scopes (minimum required permissions)
- ✅ Review GitHub Secrets quarterly
- ✅ Keep SSH keys in `~/.ssh/` with `chmod 600` permissions
- ✅ Log secret names, **never** actual values in CI/CD

### ❌ DON'T

- ❌ Commit `.env`, `.env.auto-connector`, or `.env.local` files
- ❌ Hardcode tokens in source code
- ❌ Share secrets via Slack, email, or unencrypted channels
- ❌ Use the same token for multiple environments
- ❌ Print secrets in logs or console output
- ❌ Store secrets in `package.json` or public repositories
- ❌ Use placeholder values in production
- ❌ Commit example files with real tokens (use placeholders)

---

## Troubleshooting

### Problem: "HETZNER_API_KEY not found"
**Solution:**
1. Check `.env.auto-connector` exists in your working directory
2. Check your shell sources it: `source .env.auto-connector`
3. Verify the key path: `echo $HETZNER_API_KEY`

### Problem: GitHub Actions deployment fails with "Authorization error"
**Solution:**
1. Verify secrets exist: `gh secret list`
2. Check expiration: Some tokens (like GitHub Classic) can expire
3. Regenerate the token:
   ```bash
   # GitHub
   gh secret set GITHUB_TOKEN --body "ghp_new_token_here"
   ```

### Problem: Hetzner SSH connection fails
**Solution:**
1. Check key permissions: `ls -la ~/.ssh/hetzner_rsa` (should be `-rw-------`)
2. Fix if needed: `chmod 600 ~/.ssh/hetzner_rsa`
3. Test SSH manually:
   ```bash
   ssh -i ~/.ssh/hetzner_rsa -p 22 root@your.server.ip "echo test"
   ```

### Problem: Vercel deployment fails
**Solution:**
1. Check token is not expired: https://vercel.com/account/tokens
2. Verify org/project IDs match:
   ```bash
   # In UNICORN_FINAL directory
   cat .vercel/project.json
   ```
3. Regenerate Vercel token if needed

### Problem: Secrets were accidentally committed
**Solution:**
1. **Immediately regenerate** all exposed tokens
2. Remove from git history:
   ```bash
   git filter-branch --tree-filter 'grep -v "HETZNER_API_KEY" .env.auto-connector > .env.tmp; mv .env.tmp .env.auto-connector' -- --all
   git push origin main --force-with-lease
   ```
3. Add `.env.auto-connector` to `.gitignore`
4. Force push the cleaned history

---

## Reference: Required Secrets

### For GitHub Actions (CI/CD)

| Secret | Scope | Example | Where To Get |
|--------|-------|---------|--------------|
| `GITHUB_TOKEN` | Repo, workflow | `ghp_xxxx` | https://github.com/settings/tokens |
| `VERCEL_TOKEN` | Project, org | `vcp_xxxx` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Project org | `team_xxxx` | https://vercel.com/dashboard |
| `VERCEL_PROJECT_ID` | Project | `prj_xxxx` | https://vercel.com/dashboard |
| `HETZNER_API_KEY` | Cloud API | (token) | https://console.hetzner.cloud |
| `HETZNER_SSH_PRIVATE_KEY` | SSH key | (full key file) | `cat ~/.ssh/hetzner_rsa` |
| `HETZNER_HOST` | Server IP | `192.168.1.100` | Your Hetzner console |
| `HETZNER_DEPLOY_USER` | SSH user | `root` or `app` | Your server user |
| `HETZNER_DEPLOY_PORT` | SSH port | `22` | Your SSH port |
| `HETZNER_DEPLOY_PATH` | Deploy dir | `/home/app/unicorn` | Your choice |

### For `.env.auto-connector` (Local Development)

All of the above plus:
- `HETZNER_KEY_PATH` (local path)
- `HETZNER_SSH_PUBLIC_KEY` (for reference)
- Optional: `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`, etc.

---

## Questions?

See the main [README.md](README.md) or run:
```bash
./verify-platform-setup.sh
```

This validates your entire setup and reports which secrets are missing or invalid.
