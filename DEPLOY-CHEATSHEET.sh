#!/bin/bash
# 🚀 LIVE AUTO-DEPLOY CHEAT SHEET
# Copy & paste these commands to work efficiently

# ============================================================================
# DAILY WORKFLOW
# ============================================================================

# 1️⃣ MAKE CHANGES (use your editor)
code UNICORN_FINAL/src/index.js     # Edit files

# 2️⃣ COMMIT & PUSH (one-liner)
cd ~/Desktop/generate-unicorn && git add . && git commit -m "feat: your message" && git push origin main

# ============================================================================
# WATCH DEPLOYMENT
# ============================================================================

# 3️⃣ OPEN GITHUB ACTIONS (watch in real-time)
open https://github.com/ruffy80/ZeusAI/actions

# Or check status in terminal
watch -n 2 'curl -s https://github.com/ruffy80/ZeusAI/actions | grep -i "deploy"'

# ============================================================================
# VERIFY DEPLOYMENT
# ============================================================================

# 4️⃣ CHECK IF LIVE (after ~90 seconds)
curl https://zeusai.com/health        # Should return {"status":"healthy"}
curl https://zeusai.com/snapshot      # Full app state
curl https://zeusai.com/              # Homepage

# ============================================================================
# EMERGENCY COMMANDS
# ============================================================================

# 🔴 ROLLBACK (if something breaks)
# Edit UNICORN_FINAL/.github/workflows/hetzner-deploy.yml
# and change the branch/tag to a known-good commit:
git log --oneline UNICORN_FINAL | head -20  # See last 20 commits
git push origin main --force                # (dangerous! use only if needed)

# 🔴 SSH TO SERVER (for debugging)
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142
cd /root/unicorn-final
pm2 logs                    # See live logs
pm2 status                  # See service status
npm run health:check        # Run health check

# 🔴 MANUAL RESTART (if needed)
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 'cd /root/unicorn-final && npm run restart'

# ============================================================================
# COMMON CHANGES
# ============================================================================

# 📝 Update site HTML
nano UNICORN_FINAL/src/site/template.js
# Then: git add . && git commit -m "ui: ..." && git push origin main

# 📝 Update backend routes
nano UNICORN_FINAL/backend/index.js
# Then: git add . && git commit -m "api: ..." && git push origin main

# 📝 Update dependencies
cd UNICORN_FINAL && npm install package-name
git add . && git commit -m "deps: upgrade package-name" && git push origin main

# ============================================================================
# DEBUGGING
# ============================================================================

# 🐛 See GitHub Actions error
open https://github.com/ruffy80/ZeusAI/actions
# Click failed job → expand "Deploy to Hetzner" → read error

# 🐛 See lint errors (before pushing)
cd UNICORN_FINAL && npm run lint

# 🐛 See test errors (before pushing)
cd UNICORN_FINAL && npm test

# 🐛 Run both locally (recommended before push)
cd UNICORN_FINAL && npm run lint && npm test

# ============================================================================
# POWER USER TIPS
# ============================================================================

# 💡 Alias for quick deploy
alias deploy='cd ~/Desktop/generate-unicorn && git add . && git commit -m "auto-deploy" && git push origin main'

# 💡 Watch logs in real-time
watch -n 5 'curl -s https://zeusai.com/health | jq'

# 💡 See recent commits
git log --oneline -10 UNICORN_FINAL/

# 💡 See what changed since last deploy
git diff HEAD~1 UNICORN_FINAL/src/

# ============================================================================
# NEVER DO THIS
# ============================================================================

# ❌ Don't manually SSH and change code (it gets overwritten)
# ❌ Don't skip local testing (CI will catch errors but it's slow)
# ❌ Don't push directly to main without reviewing changes
# ❌ Don't commit secrets to .env (use GitHub secrets instead)

echo "✅ All commands ready! Use: deploy"
