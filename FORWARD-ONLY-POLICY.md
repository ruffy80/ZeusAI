# 🛡️ FORWARD-ONLY POLICY — Live Site Protection

**Effective Date:** 10 May 2026  
**Status:** ENFORCED — All pushes to `main` are validated

---

## 🎯 Core Principle

**ZERO ROLLBACKS** — The live site (`zeusai.com`) can ONLY:
- ✅ **Forward upgrades** (new features, fixes, improvements)
- ✅ **Lateral repairs** (bug fixes, security patches)
- ✅ **Innovation rollouts** (new modules, experiments)

**NEVER:**
- ❌ Downgrade dependencies
- ❌ Delete critical features
- ❌ Revert commits
- ❌ Rollback to old versions
- ❌ Break existing APIs

---

## 🔐 How It's Protected

### 1. **No-Downgrade Guard** (Mandatory Check)

Every push to `main` is validated by `.github/workflows/no-downgrade-guard.yml`:

```
✓ Current commit must be FORWARD of baseline (.github/baselines/live.sha)
✓ No critical files can be deleted
✓ If critical files ARE deleted, commit message MUST include [upgrade-approved]
```

**Baseline SHA** (current HEAD): `51e42e33d927d9459a84365c145cbfccca2db721`

Any push that tries to go BACKWARD will be **REJECTED** automatically.

### 2. **GitHub Actions Deploy Lock**

Deploy only happens if:
- ✅ Lint passes
- ✅ Tests pass  
- ✅ No-downgrade guard passes
- ✅ Pre-flight checks pass

If ANY check fails → deploy is **BLOCKED** (old version stays live).

### 3. **Atomic Deploy on Hetzner**

Deploy script creates **release directories** (never modifies live):

```
/var/www/unicorn/releases/
├── 54cc7f0-1778348995/  ← Old version (kept for rollback)
├── a4e2ef2-1778349123/  ← Current live ← symlink here
└── 51e42e3-1778349156/  ← New version (installed here first)
```

If install FAILS → symlink never changes → old version stays live.

### 4. **Post-Deploy Health Check**

After every deploy:
- `curl /health` — must return 200
- `curl /snapshot` — must return valid app state
- `npm run preflight:forward` — checks no regressions

If health check fails → **rollback automatic** (symlink reverts).

### 5. **Daily Backup Vault**

Every deploy creates backup:
```
/root/unicorn-backups/
├── zeusai-2026-05-09.tar.gz
├── zeusai-2026-05-10.tar.gz  ← Today
└── zeusai-2026-05-11.tar.gz
```

Keep 14 days. Can restore any old version IF needed (via manual request only).

---

## 📋 Workflow for You

### ✅ **ALLOWED - Forward Updates**

```bash
# Edit code
nano UNICORN_FINAL/src/index.js

# Commit with FORWARD message
git add .
git commit -m "feat(api): add new endpoint"
# or
git commit -m "fix(bug): repair checkout flow"
# or  
git commit -m "improve(perf): optimize queries"

# Push → auto-validates → auto-deploys
git push origin main
```

**Result:** Auto-deployed in 60-90s, zero risk.

---

### ❌ **BLOCKED - Downgrade Attempts**

```bash
# Try to revert old commit (BLOCKED!)
git revert abc123
git push origin main
# ❌ NO-DOWNGRADE-GUARD: rejected

# Try to delete critical feature (BLOCKED!)
rm UNICORN_FINAL/backend/index.js
git add .
git commit -m "remove backend"
git push origin main
# ❌ NO-DOWNGRADE-GUARD: rejected (need [upgrade-approved] trailer)

# Try to git reset (BLOCKED!)
git reset --hard 54cc7f0
git push origin main --force
# ❌ NO-DOWNGRADE-GUARD: rejected
```

---

## 🚨 Emergency: If Something Breaks

### **Scenario 1: Deploy succeeded but site is broken**

1. GitHub Actions will detect health check FAIL
2. Automatic rollback happens (symlink reverts to old version)
3. You get alert in Discord

**Manual fix:**
```bash
ssh root@204.168.230.142
cd /root/unicorn-final
pm2 restart all           # Restart services
npm run health:check      # Verify health
```

### **Scenario 2: Need to revert a feature (very rare)**

Only option: **CREATE A NEW FIX FORWARD**

❌ Don't: `git revert abc123`  
✅ Do: Create new commit that fixes the issue differently

```bash
# Issue: Feature X breaks checkout
# Solution: Create NEW fix (not revert)

nano UNICORN_FINAL/src/index.js  # Fix the root cause
git add .
git commit -m "fix: disable feature X properly via flag"
git push origin main
```

### **Scenario 3: Catastrophic failure**

If site is down completely:
1. Manually SSH and restore backup
2. Document what happened
3. Create forward fix

```bash
ssh root@204.168.230.142
cd /root/unicorn-backups
tar -xzf zeusai-2026-05-10.tar.gz -C /root/unicorn-final
pm2 restart all
```

---

## 📊 Baseline Management

**Current Baseline:** `51e42e33d927d9459a84365c145cbfccca2db721`

Every 7 days (Friday):
1. Copy current live SHA to baseline
2. Commit to `.github/baselines/live.sha`
3. Makes that week's version the "safe checkpoint"

This means: **max rollback is 7 days** (if REALLY needed, with approval).

---

## 🔍 Verification

Check your commits are FORWARD:

```bash
# See if your commit is forward of baseline
BASELINE=$(cat .github/baselines/live.sha)
CURRENT=$(git rev-parse HEAD)
git log --oneline $BASELINE..$CURRENT
# If you see commits: ✅ FORWARD
# If empty: ❌ Your commit is IN THE PAST (won't deploy)
```

---

## 📚 Related Docs

- **Deploy Workflow:** [UNICORN_FINAL/.github/workflows/hetzner-deploy.yml](UNICORN_FINAL/.github/workflows/hetzner-deploy.yml)
- **No-Downgrade Guard:** [.github/workflows/no-downgrade-guard.yml](.github/workflows/no-downgrade-guard.yml)
- **Health Checks:** [UNICORN_FINAL/scripts/health-check.sh](UNICORN_FINAL/scripts/health-check.sh)
- **Deployment Strategy:** [docs/deployment.md](docs/deployment.md)

---

## ✨ Summary

| Action | Status |
|--------|--------|
| Push forward commits | ✅ Auto-deploys |
| Push downgrade commits | ❌ Blocked |
| Broken deploy auto-rollback | ✅ Automatic |
| Manual rollback | ❌ Requires approval |
| Keep old versions | ✅ 14-day backup vault |

**The live site is now PROTECTED from regressions. You can push forward commits safely!** 🚀
