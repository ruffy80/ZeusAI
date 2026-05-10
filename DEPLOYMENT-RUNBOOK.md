# 🚀 FORWARD-ONLY DEPLOYMENT RUNBOOK

**Status: LIVE & PROTECTED** ✅  
**Date: 10 May 2026**  
**Policy: Zero rollbacks. Updates only.**

---

## 🎯 Your Daily Workflow

```bash
# 1️⃣ EDIT CODE
nano UNICORN_FINAL/src/index.js

# 2️⃣ COMMIT (FORWARD MESSAGE REQUIRED)
git add .
git commit -m "feat: ..." # Must be a forward-moving message
# or
git commit -m "fix: ..."
# or
git commit -m "improve: ..."

# 3️⃣ PUSH (TRIGGERS AUTO-DEPLOY)
git push origin main

# 4️⃣ WAIT (~60-90 seconds)
# GitHub Actions validates & deploys automatically

# 5️⃣ VERIFY (OPTIONAL)
curl https://zeusai.com/health
```

**That's it! No manual server work needed.**

---

## 🛡️ What's Protected

✅ **No-Downgrade Guard** — Rejects downgrades automatically  
✅ **Auto-Rollback** — If deploy fails, old version stays live  
✅ **Health Checks** — Site must respond after deploy  
✅ **Atomic Deployment** — Never partial deploys  
✅ **Backup Vault** — 14-day backup history  
✅ **Version Locking** — Baseline prevents regressions  

---

## ❌ What's BLOCKED

You CANNOT push:
- Revert commits (`git revert`)
- Reset to old SHA (`git reset --hard`)
- Delete critical files (without [upgrade-approved])
- Downgrade packages
- Any commit BEFORE baseline

**If you try, GitHub will auto-reject it.** 🚫

---

## 🔍 Check Status Anytime

```bash
# Verify all protections are active
./verify-forward-only.sh

# Check deployment history
git log --oneline -10 UNICORN_FINAL/

# See if you're forward of baseline
cat .github/baselines/live.sha  # baseline
git rev-parse HEAD               # your current

# Monitor live site
curl https://zeusai.com/health
```

---

## 🚨 Emergency: Site is Down

### Step 1: Check What Happened
```bash
# SSH to server
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142

# See services
pm2 status

# Check logs
pm2 logs unicorn-site  # Live logs

# Check health
curl http://127.0.0.1:3000/health
```

### Step 2: Automatic Rollback (Already Happened)
- GitHub Actions detected health check fail
- Symlink `/var/www/unicorn/current` reverted to last working version
- Discord alert sent
- Services restarted

### Step 3: Fix Forward (You Create a Patch)
```bash
# Figure out what broke (don't revert!)
# Instead, create a NEW fix

nano UNICORN_FINAL/src/index.js  # Fix the actual problem

git add .
git commit -m "fix: address root cause of failure"
git push origin main

# New version deploys, health check validates
```

---

## 📋 Before Every Push

**Ask yourself:**

- ✅ Is this a FORWARD move? (new feature, fix, improvement)
- ✅ Did you test locally? (`npm run lint && npm test`)
- ✅ Is commit message clear? (feat/fix/improve + description)
- ✅ No reverting old commits?
- ✅ No deleting critical files?

If ALL yes → Push safely! 🚀

---

## 📊 Deploy Pipeline

```
Your Commit
    ↓
Git Push to main
    ↓
No-Downgrade Guard (validates)
    ↓ ✅ PASS
    ↓
Lint & Test
    ↓ ✅ PASS
    ↓
Pre-flight Forward Check
    ↓ ✅ PASS
    ↓
Deploy to Hetzner
    ├─ Create release directory
    ├─ Install dependencies
    ├─ Run migrations/setup
    ├─ Health check
    │  ├─ ✅ PASS → Promote (symlink switch)
    │  └─ ❌ FAIL → Keep old version live
    ↓
Live on zeusai.com (60-90 seconds total)
```

---

## 🔐 Baseline & Rollback Window

**Current Baseline:** `51e42e33d927d9459a84365c145cbfccca2db721`

- You can push ANY commit FORWARD of this SHA
- This prevents accidental regressions
- Baseline updates every Friday (best practice)
- Max rollback window: 7 days (with approval only)

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| [FORWARD-ONLY-POLICY.md](FORWARD-ONLY-POLICY.md) | Complete forward-only rules |
| [.github/baselines/live.sha](.github/baselines/live.sha) | Baseline version SHA |
| [.github/workflows/no-downgrade-guard.yml](.github/workflows/no-downgrade-guard.yml) | Auto-rejection of downgrades |
| [UNICORN_FINAL/.github/workflows/hetzner-deploy.yml](UNICORN_FINAL/.github/workflows/hetzner-deploy.yml) | Deploy pipeline |
| [UNICORN_FINAL/scripts/smoke-forward-only.sh](UNICORN_FINAL/scripts/smoke-forward-only.sh) | Health validation |
| [verify-forward-only.sh](verify-forward-only.sh) | Status checker |

---

## ✨ Summary

| Scenario | What Happens |
|----------|--------------|
| You push forward commit | ✅ Auto-deploys in 60-90s |
| Deploy succeeds + health OK | ✅ Live immediately |
| Deploy succeeds + health FAIL | ✅ Auto-rollback to old version |
| You try to revert/downgrade | ❌ GitHub blocks it |
| You try to delete critical files | ❌ GitHub blocks it |
| Break production | 🔄 Auto-rollback (old version stays live) |
| Really broken? 🚨 | Manual SSH restore from 14-day backup vault |

---

## 🎓 Examples

### ✅ GOOD: Push this
```bash
git add .
git commit -m "feat: add new payment method"
git push origin main
```
Result: Auto-deployed ✅

### ✅ GOOD: Push this
```bash
git add .
git commit -m "fix(checkout): handle edge case in validation"
git push origin main
```
Result: Auto-deployed ✅

### ❌ BAD: Don't push
```bash
git revert abc123  # REVERTING
git push origin main
```
Result: GitHub blocks it ❌

### ❌ BAD: Don't push
```bash
git reset --hard HEAD~5  # GOING BACKWARDS
git push origin main --force
```
Result: GitHub blocks it ❌

---

## 🚀 You're Protected!

The live site is now **BULLETPROOF**:
- No accidental downgrade can slip through
- Failed deploys auto-rollback
- Every change is tracked
- 14-day backup history
- Zero-downtime deployments

**Focus on building forward! The system protects stability.** 💪

---

Questions? Check [FORWARD-ONLY-POLICY.md](FORWARD-ONLY-POLICY.md) for details.
