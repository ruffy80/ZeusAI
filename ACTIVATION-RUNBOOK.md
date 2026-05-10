# 🦄 UNICORN ACTIVATION RUNBOOK — Full Autonomy Mode

**Status:** Ready to activate all 8 autonomous engines  
**Mode:** Forward-Only (no breaking changes, no downtime)  
**Harmony:** Swiss-watch synchronization enforced  
**Date:** 2026-05-10

---

## TL;DR — Activation in 3 Steps

```bash
# 1️⃣ SAFETY CHECK — Verify Forward-Only mode is armed
curl -s https://zeusai.pro/api/autonomy/safety/status \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" | jq '.enforcement'
# Expected: true

# 2️⃣ ACTIVATE ALL ENGINES — Trigger orchestrator startup
curl -X POST https://zeusai.pro/api/autonomy/activate \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"full","monitor":true}'

# 3️⃣ VERIFY SWISS-WATCH HARMONY — Check all engines running in sync
curl -s https://zeusai.pro/api/autonomy/harmony/status \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" | jq '.health'
# Expected: "good"
```

---

## ⚙️ What Gets Activated

### 8 Core Autonomous Engines

| # | Engine | Purpose | Status | Started |
|---|--------|---------|--------|---------|
| 1️⃣ | **Self-Healing** | Auto-detect and repair system failures | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 2️⃣ | **Auto-Innovation** | Continuous code analysis + improvement | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 3️⃣ | **Auto-Deploy** | Automated deployment on changes | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 4️⃣ | **Auto-Repair** | Fix bugs + technical debt autonomously | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 5️⃣ | **Auto-Update** | Keep dependencies + services current | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 6️⃣ | **Auto-Scaling** | Scale resources based on demand | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 7️⃣ | **Auto-Monitoring** | Real-time health + alerting | ❌ OFF (STABLE) | `/api/autonomy/activate` |
| 8️⃣ | **Auto-Decision AI** | Business logic + optimization decisions | ❌ OFF (STABLE) | `/api/autonomy/activate` |

### 20+ Companion Systems Auto-Enabled

- **Innovation Suite:** autonomousInnovation, autoInnovationLoop, unicornInnovationSuite
- **Revenue Engines:** autoRevenue, autoViralGrowth, profitControlLoop
- **Marketplace:** serviceMarketplace, dynamicPricing, offerFactory
- **Commerce:** checkoutRecoveryAgent, paymentGateway, nowPayments
- **AI Agents:** aiCfoAgent, aiSalesCloser, competitorSpyAgent, predictiveMarketIntelligence
- **Self-Evolution:** selfAdaptationEngine, selfEvolvingEngine, autoEvolve
- **Infrastructure:** domainAutomationManager, globalFailover, canaryController
- **Compliance:** complianceEngine, legalFortress, worldStandard

---

## 🛡️ Forward-Only Safety Guarantees

Every autonomous operation is **gated** by the Forward-Only Safety Framework:

### ✅ APPROVED OPERATIONS
- ✅ New features / modules
- ✅ Performance optimizations
- ✅ Security hardening
- ✅ Schema migrations (forward-compatible)
- ✅ New endpoints / APIs
- ✅ Revenue flows & marketplace listings
- ✅ Auto-scaling & capacity expansion
- ✅ Health repairs & self-healing

### ❌ BLOCKED OPERATIONS
- ❌ Breaking API changes
- ❌ Schema deletions / regressions
- ❌ Module removals
- ❌ Endpoint deprecations (without redirects)
- ❌ Data deletion
- ❌ Rollbacks to previous versions
- ❌ Downtime / maintenance windows
- ❌ Security downgrades

### 🔒 PROTECTED STATE
These zones are **read-only** during autonomous operation:
- `PAYMENT_LEDGER` — all transaction records
- `USER_IDENTITY` — customer accounts
- `AUTH_CREDENTIALS` — authentication tokens
- `AUDIT_LOG` — compliance trail
- `MERCHANT_WALLET` — receiving BTC address
- `DEPLOYMENT_MANIFEST` — current version
- `SERVICE_CATALOG` — published services
- `REVENUE_PROOF` — outcome records

---

## 🎯 Step 1: Pre-Activation Checklist

### A. Verify Production State

```bash
# 1. Live deployment SHA
curl -s https://zeusai.pro/api/build | jq '.shaShort'

# 2. Current health
curl -s https://zeusai.pro/health | jq '{status, runtimeProfile, autonomousBackgroundLoops}'

# 3. Mesh status (module registration)
curl -s https://zeusai.pro/api/mesh-status | jq '.moduleCount'

# 4. No active violations
curl -s https://zeusai.pro/api/autonomy/safety/violations \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.count'
# Expected: 0 or empty
```

### B. Verify All 292+ Modules Loaded

```bash
# Check module registry completeness
curl -s https://zeusai.pro/api/modules/registry \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.total'
# Expected: 292+
```

### C. Enable Forward-Only Mode (if not already on)

```bash
# Check status
curl -s https://zeusai.pro/api/autonomy/safety/status \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.enforcement'
# Expected: true (already enforced in production)

# If needed, enable:
curl -X POST https://zeusai.pro/api/autonomy/safety/enable \
  -H "X-Admin-Token: YOUR_TOKEN"
```

### D. Baseline Metrics (for comparison after activation)

```bash
# Record current state
curl -s https://zeusai.pro/api/metrics | jq '.' > /tmp/baseline-metrics.json
curl -s https://zeusai.pro/api/health/deep | jq '.' > /tmp/baseline-health.json
curl -s https://zeusai.pro/api/orchestrator/status | jq '.' > /tmp/baseline-orchest.json
```

---

## 🚀 Step 2: Activate All Engines

### A. Send Activation Signal

```bash
# MAIN ACTIVATION CALL
curl -X POST https://zeusai.pro/api/autonomy/activate \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full",
    "monitor": true,
    "reason": "Production autonomy activation — all engines live"
  }' | jq '.'

# Expected Response:
# {
#   "success": true,
#   "mode": "full",
#   "ts": "2026-05-10T...",
#   "activated": [
#     { "module": "autoInnovationLoop", "activated": true },
#     { "module": "selfHealingEngine", "activated": true },
#     { "module": "centralOrchestrator", "activated": true },
#     { "module": "quantumIntegrityShield", "activated": true },
#     { "module": "meshOrchestrator", "activated": true },
#     { "module": "unicornOrchestrator", "activated": true },
#     ...
#   ]
# }
```

### B. Monitor Startup Logs

```bash
# SSH to Hetzner and watch PM2 logs
ssh root@HETZNER_IP
pm2 logs unicorn-final
# Look for:
# ✅ "🦄 [UnicornOrchestrator] ORCHESTRATOR UNICORN — PORNIT [mode: full]"
# ✅ "🦄 [UnicornOrchestrator] ✅ Toate motoarele ACTIVE [mode: full]"
# ✅ "🕰️  Unicorn Mesh Orchestrator: STARTED — toate modulele conectate"

# Exit after engines report ready (usually 10-30 seconds)
```

### C. Check Activation Results

```bash
curl -s https://zeusai.pro/api/autonomy/activation/status \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.results | map(select(.activated == true)) | length'
# Expected: 6+ engines reporting activated=true
```

---

## 🕰️ Step 3: Validate Swiss-Watch Harmony

### A. Harmony Health Check

```bash
# Real-time harmony status
curl -s https://zeusai.pro/api/autonomy/harmony/status \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.'

# Expected output (all engines synchronized):
# {
#   "health": "good",
#   "totalEngines": 8,
#   "activeEngines": 8,
#   "engineErrors": 0,
#   "engines": [
#     {
#       "name": "selfHealingEngine",
#       "active": true,
#       "error": null,
#       "lastRun": "2026-05-10T..."
#     },
#     ...
#   ]
# }
```

### B. Cross-Engine Communication Test

```bash
# Mesh bus connectivity check
curl -s https://zeusai.pro/api/mesh/health \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '{interconnect, latencyMs, modules}'

# Expected: interconnect=true, latencyMs < 50, modules.active > 280
```

### C. No Blocking / Deadlocks

```bash
# Check for resource contention
curl -s https://zeusai.pro/api/autonomy/resource-audit \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.contentionLevel'
# Expected: "low" or "none"
```

### D. Verify Site Still Live & Responsive

```bash
# Frontend SSR health
curl -sI https://zeusai.pro/ | grep -E 'HTTP|X-Unicorn-Role'
# Expected: HTTP/1.1 200, X-Unicorn-Role: site

# API responsiveness (should be <100ms)
time curl -s https://zeusai.pro/api/health | jq '.status'
# Expected: real ≈ 0.05s
```

---

## 📊 Step 4: Live Monitoring (First 24 Hours)

### A. Watch for Violations

Every autonomous operation is logged. **NO violations expected** in Forward-Only mode:

```bash
# Check for any rule violations (should be empty)
curl -s https://zeusai.pro/api/autonomy/safety/violations \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.violations | length'
# Expected: 0

# Watch in real-time
watch -n 5 'curl -s https://zeusai.pro/api/autonomy/safety/violations \
  -H "X-Admin-Token: YOUR_TOKEN" | jq .count'
```

### B. Monitor Engine Activity

```bash
# Per-engine cycle counts (should be incrementing)
curl -s https://zeusai.pro/api/unicorn/orchestrator/stats \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.stats | map({engine: .name, cycles})'
```

### C. Revenue & Innovation Metrics

```bash
# Innovation loop progress
curl -s https://zeusai.pro/api/evolution/status | jq '.loop'

# Revenue generation
curl -s https://zeusai.pro/api/revenue/proof | jq '.revenue'

# Auto-publish progress (services added to marketplace)
curl -s https://zeusai.pro/api/services/list | jq '.services | length'
```

### D. Performance Baseline Comparison

```bash
# Compare to baseline
curl -s https://zeusai.pro/api/metrics | jq '.' > /tmp/live-metrics.json
jq -s '.[0] as $baseline | .[1] | . + {vs_baseline: {
  cpu_diff: .cpu.user - $baseline.cpu.user,
  mem_diff: .memory.heapUsed - $baseline.memory.heapUsed
}}' /tmp/baseline-metrics.json /tmp/live-metrics.json
```

### E. Set Up Alerting (if using external monitoring)

```bash
# Datadog / New Relic / other APM:
# Alert on:
# - autonomy/violations > 0
# - harmony/health != "good"
# - engine_errors > 0
# - api/response_time > 200ms (alert, not block)
# - unicorn/mode != "full" (activation reverted)
```

---

## 🔄 Step 5: Continuous Validation (Weekly)

### A. Full Mesh Audit

```bash
npm run -s audit:live:mesh
# Expected: All 12 checks passing
```

### B. Safety Compliance Report

```bash
curl -s https://zeusai.pro/api/autonomy/safety/report \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.'
# Expected: approvedMutationCount > 0, violationCount == 0
```

### C. Revenue Proof Validation

```bash
curl -s https://zeusai.pro/api/trust/ledger | jq '.ledger'
# Expected: status="active", records increasing
```

---

## ⚡ Emergency Procedures

### If Harmony Degrades

```bash
# Graceful engine pause (not shutdown)
curl -X POST https://zeusai.pro/api/autonomy/pause \
  -H "X-Admin-Token: YOUR_TOKEN"

# Investigate
curl -s https://zeusai.pro/api/autonomy/harmony/status | jq '.reason'

# Restart all engines
curl -X POST https://zeusai.pro/api/autonomy/activate \
  -H "X-Admin-Token: YOUR_TOKEN" \
  -d '{"mode":"full"}'
```

### If Violations Spike

```bash
# Reduce enforcement (not disable, reduce)
curl -X POST https://zeusai.pro/api/autonomy/safety/reduce-sensitivity \
  -H "X-Admin-Token: YOUR_TOKEN"

# Review violations
curl -s https://zeusai.pro/api/autonomy/safety/violations \
  -H "X-Admin-Token: YOUR_TOKEN" | jq '.violations[0:10]'

# Whitelist new mutation type if needed
curl -X POST https://zeusai.pro/api/autonomy/safety/approve-mutation \
  -H "X-Admin-Token: YOUR_TOKEN" \
  -d '{"mutationType":"your.new.type","reason":"approved_after_review"}'
```

### If API Response Time Spikes

```bash
# Temporarily throttle autonomous operations
curl -X POST https://zeusai.pro/api/autonomy/throttle \
  -H "X-Admin-Token: YOUR_TOKEN" \
  -d '{"maxConcurrentOperations":2,"batchSizeLimit":100}'

# Monitor perf recovery
watch -n 2 'curl -s https://zeusai.pro/health/deep | jq .eventLoop'

# Resume normal operation when stable
curl -X POST https://zeusai.pro/api/autonomy/throttle \
  -H "X-Admin-Token: YOUR_TOKEN" \
  -d '{"maxConcurrentOperations":8,"batchSizeLimit":500}'
```

---

## 📚 Reference: Activation Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/autonomy/activate` | `POST` | Activate all engines |
| `/api/autonomy/pause` | `POST` | Gracefully pause (not shutdown) |
| `/api/autonomy/status` | `GET` | Current activation status |
| `/api/autonomy/safety/status` | `GET` | Forward-Only mode status |
| `/api/autonomy/safety/violations` | `GET` | Rule violations (should be empty) |
| `/api/autonomy/harmony/status` | `GET` | Swiss-watch synchronization |
| `/api/autonomy/harmony/monitor` | `GET` | Real-time harmony stream (SSE) |
| `/api/mesh/health` | `GET` | Mesh orchestrator connectivity |
| `/api/evolution/status` | `GET` | Innovation loop progress |
| `/api/revenue/proof` | `GET` | Revenue generation proof |
| `/api/unicorn/orchestrator/stats` | `GET` | Per-engine cycle stats |

---

## ✅ Success Criteria

### All Engines Running ✅
- 8/8 autonomous engines activated and reporting `active: true`
- No engine errors or crashes in first 24 hours

### Harmony Achieved ✅
- `harmony/status.health` = `"good"` continuously
- `harmony/status.engineErrors` = 0
- Cross-engine message latency < 50ms

### Zero Regressions ✅
- All 292+ modules loaded and responsive
- `/snapshot` + `/stream` working as before
- API response time ≤ 150ms (p95)
- Payment processing: 100% success rate

### Forward-Only Enforced ✅
- `safety/violations.count` = 0
- Only approved mutation types executed
- Protected state zones untouched
- Audit log growing (new entries only, never deleted)

### Site & Commerce Live ✅
- Frontend rendering at zeusai.pro (SSR + SPA)
- Checkout working end-to-end
- Services auto-publishing to marketplace
- Revenue streams flowing

---

## 🔗 Related Runbooks

- [Force-Deploy Guide](./FORCE-DEPLOY-GUIDE.md) — If engines need manual restart
- [Mesh Audit](./MESH-AUDIT.md) — Full system health check
- [Recovery Procedures](./RECOVERY.md) — Rollback if critical issue (rare)
- [Monitoring Setup](./MONITORING.md) — Datadog/New Relic integration

---

**Status:** 🟢 READY FOR ACTIVATION  
**Last Updated:** 2026-05-10  
**Owner:** Vladoi Ionut (vladoi_ionut@yahoo.com)
