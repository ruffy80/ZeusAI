# 🚀 Live Auto-Deploy Setup — QUICK START

## ✅ What just happened?

You ran `setup-live-deploy.sh` which configured GitHub Actions with SSH credentials. Now **every time you push code to `main`, it automatically deploys to Hetzner**.

---

## 📋 The Workflow (5 steps)

### 1️⃣ **Edit code locally**
```bash
# Edit files on your machine (in VS Code, terminal, whatever)
nano UNICORN_FINAL/src/index.js
# or
code UNICORN_FINAL/
```

### 2️⃣ **Commit your changes**
```bash
cd /Users/ionutvladoi/Desktop/generate-unicorn
git add .
git commit -m "fix: add feature X" 
```

### 3️⃣ **Push to GitHub**
```bash
git push origin main
```

### 4️⃣ **GitHub Actions runs automatically**
✓ Pulls your code  
✓ Runs `npm run lint` on UNICORN_FINAL/  
✓ Runs `npm test` on UNICORN_FINAL/  
✓ If tests pass → SSH deploys to Hetzner  
✓ If tests fail → You see errors, no deploy  

### 5️⃣ **Your changes go LIVE**
- Deployment takes **60-90 seconds**
- zeusai.com is updated automatically
- No manual SSH, no password entry

---

## 👀 Monitor deployment

**Watch in real-time:**
```bash
open https://github.com/ruffy80/ZeusAI/actions
```

You'll see:
- ✓ Validate job (lint + test)
- ✓ Deploy-hetzner job (if validate passes)
- ✓ Real-time logs

---

## ✅ Verify it worked

```bash
# Check if site is healthy
curl https://zeusai.com/health
```

Should return: `{"status":"healthy",...}`

---

## 🔑 What credentials were stored?

GitHub now has these secrets (encrypted):
- `HETZNER_SSH_PRIVATE_KEY` — used to SSH into server
- `HETZNER_HOST` — 204.168.230.142
- `HETZNER_DEPLOY_USER` — root
- `HETZNER_DEPLOY_PORT` — 22
- `HETZNER_DEPLOY_PATH` — /root/unicorn-final

These are **never shown in logs** and are used only by GitHub Actions.

---

## 🚨 If deployment fails

1. Go to [GitHub Actions](https://github.com/ruffy80/ZeusAI/actions)
2. Click the failed workflow
3. Expand "Deploy to Hetzner" step
4. Read the error
5. Fix code locally
6. Commit + push again → auto-redeploy

---

## 🎯 Example workflow

```bash
# 1. Make changes
echo "console.log('hello');" >> UNICORN_FINAL/src/index.js

# 2. Commit
git add .
git commit -m "log hello on startup"

# 3. Push (this triggers GitHub Actions)
git push origin main

# 4. Watch (open in browser)
# https://github.com/ruffy80/ZeusAI/actions

# 5. After 90s, changes are LIVE
curl https://zeusai.com/health
```

---

## ✨ NO MORE:
- ❌ SSH-ing manually to server
- ❌ Running `npm install` on server
- ❌ Restarting services manually
- ❌ Remembering passwords

---

## 🛠 If you need to run custom scripts on deploy

Edit [UNICORN_FINAL/.github/workflows/hetzner-deploy.yml](UNICORN_FINAL/.github/workflows/hetzner-deploy.yml) — add steps after "Sync code to Hetzner".

---

## 📞 Questions?

- Workflow config: [UNICORN_FINAL/.github/workflows/hetzner-deploy.yml](UNICORN_FINAL/.github/workflows/hetzner-deploy.yml)
- Deployment script: [UNICORN_FINAL/scripts/create-backup.sh](UNICORN_FINAL/scripts/create-backup.sh)
- Live status: `curl https://zeusai.com/snapshot`
