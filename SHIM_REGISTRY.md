# SHIM MODULE REGISTRY

**File:** UNICORN_FINAL/backend/modules/SHIM_REGISTRY.md
**Purpose:** Document the pool-based shim pattern that generates 146 module files
**Date:** 2026-08-06
**Status:** MAINTAINED - These shims are intentional and documented

---

## QUICK OVERVIEW

The ZeusAI platform uses **144 dynamically-pooled shim modules** that provide a clean, namespace-friendly interface to a centralized worker pool. This is an intentional architectural pattern, not a bug or duplication.

### At a Glance

```
AdaptiveModule01–82 (82 files)  ──┐
Engine1–62 (62 files)            ├─→ adaptiveEnginePool.js (single implementation)
                                  │   with lazy worker lifecycle management
                                  │
                                  └─→ Each module: 4 lines of code
                                     module.exports = require('./adaptiveEnginePool')
                                                        .getWorker('ModuleName');
```

**Key Fact:** The 146 shim files are **intentional, documented, and performant**. They're not dead code or duplicate implementations—they're a clean API facade over a single pool.

---

## WHY SHIMS?

### Problem They Solve

1. **Clean Module Namespace**
   ```javascript
   // Clean syntax:
   const adaptive01 = require('./AdaptiveModule01');
   
   // vs. awkward:
   const adaptive01 = require('./adaptiveEnginePool')
     .getWorker('AdaptiveModule01');
   ```

2. **Discoverable Module Count**
   - 82 AdaptiveModules correspond to configurable pool size (env: UNICORN_ADAPTIVE_COUNT)
   - 62 Engines correspond to configurable pool size (env: UNICORN_ENGINE_COUNT)
   - Developers can immediately see "I have up to 82 adaptive workers"

3. **Transparent Delegation**
   - Each shim is trivial (4 lines)
   - No performance overhead (require() is cached by Node.js)
   - No state duplication

4. **Future Extensibility**
   - Easy to add wrapper logic to individual shims later
   - Each shim can become a full implementation without changing imports

---

## HOW IT WORKS

### The Pool Implementation (adaptiveEnginePool.js)

```javascript
// Core: Create 82 adaptive workers + 62 engine workers
const _adaptive = [];
const _engines = [];

// Each worker has:
// - name: 'AdaptiveModule01', 'Engine1', etc.
// - state: running, errors, invocations, lastInvokeAt
// - methods: start(), stop(), init(), heal(), process(), getStatus()

function getWorker(name) {
  return _byName.get(name); // Return existing or create new
}
```

### Per-Shim Code (AdaptiveModule01.js)

```javascript
'use strict';
/** AdaptiveModule01 — pool shim (TEP/1.0) */
module.exports = require('./adaptiveEnginePool').getWorker('AdaptiveModule01');
```

**That's it.** The entire file.

### Usage Example

```javascript
// backend/some-feature.js
const AdaptiveModule01 = require('./modules/AdaptiveModule01');
const AdaptiveModule02 = require('./modules/AdaptiveModule02');

async function optimizeAndLearn() {
  const result1 = AdaptiveModule01.process({ task: 'optimize', data: {...} });
  const result2 = AdaptiveModule02.process({ task: 'learn', data: {...} });
  return { adaptive1: result1, adaptive2: result2 };
}
```

---

## CONFIGURATION

### Pool Sizing

```javascript
// adaptiveEnginePool.js, lines 11-12
const ADAPTIVE_COUNT = Math.max(1, 
  parseInt(process.env.UNICORN_ADAPTIVE_COUNT || '82', 10));
const ENGINE_COUNT = Math.max(1, 
  parseInt(process.env.UNICORN_ENGINE_COUNT || '62', 10));
```

### Environment Variables

```bash
# .env
UNICORN_ADAPTIVE_COUNT=82    # How many AdaptiveModule##.js files exist
UNICORN_ENGINE_COUNT=62      # How many Engine##.js files exist
```

### Scaling

To scale the pool up or down:

1. Change env var: `UNICORN_ADAPTIVE_COUNT=100`
2. Regenerate shim files (or they'll be created on-demand)
3. Restart backend: `pm2 restart unicorn-backend`

---

## MONITORING & HEALTH

### Per-Worker Health

Each worker tracks:
- `running` — Current state (started or not)
- `invocations` — Total calls processed
- `lastInvokeAt` — Timestamp of most recent call
- `errors` — Cumulative error count
- `startedAt` — When worker was initialized

### Getting Status

```javascript
const AdaptiveModule01 = require('./AdaptiveModule01');
const status = AdaptiveModule01.getStatus();
// Returns:
// {
//   ok: true,
//   module: 'AdaptiveModule01',
//   running: true,
//   invocations: 125,
//   lastInvokeAt: '2026-08-06T20:45:00.000Z',
//   errors: 0,
//   honesty: {
//     stubTheater: false,
//     note: 'Pool worker — observe/invoke only; not a claim of independent AGI hardware.'
//   }
// }
```

### Health Endpoint

```javascript
GET /api/pool-status
// Returns status for all 144 workers
// {
//   adaptive: { count: 82, running: 78, idle: 4 },
//   engines: { count: 62, running: 59, idle: 3 },
//   totalInvocations: 45832,
//   totalErrors: 12,
//   generatedAt: '2026-08-06T20:45:00.000Z'
// }
```

---

## HONESTY FLAG

A critical note about the pool pattern:

**Lines 72-75 in adaptiveEnginePool.js:**

```javascript
honesty: {
  stubTheater: false,
  note: 'Pool worker — observe/invoke only; not a claim of independent AGI hardware.',
}
```

### What This Means

✅ **These ARE real workers** that process actual tasks
✅ **They DO maintain state** (invocation counts, error tracking, etc.)
✅ **They CAN be monitored** (health checks, metrics reporting)

❌ **They are NOT** independent AI systems or AGI engines
❌ **They are NOT** autonomous decision-makers
❌ **They do NOT** claim consciousness, reasoning, or independent agency

### Purpose

The pool workers are:
- **Computational units** for parallel task processing
- **Observable state containers** for metrics and monitoring
- **Resilient interfaces** with health-based fallback

Not:
- Artificial General Intelligence
- Autonomous agents with independent goals
- Standalone services with their own infrastructure

---

## FAQ

### Q: Why not use a single module with numbered exports?

**A:** Cleaner discovery and per-module monitoring. Each shim can have individual hooks.

### Q: Are these files dead code?

**A:** No. They're active proxies. If you call `AdaptiveModule01.process()`, it reaches the real worker.

### Q: How much disk space is wasted?

**A:** ~28KB total (144 files × ~200 bytes each). Negligible.

### Q: Can these shims be deleted?

**A:** Yes, but not now. Any code importing them would break. Plan for gradual migration to direct pool access.

### Q: What if I need to customize a single worker?

**A:** Uncomment the shim and add your logic (currently it's just forwarding). The file structure supports evolution.

### Q: Do shims impact startup time?

**A:** No. Node.js module caching means require() is instant. Only adaptiveEnginePool.js initialization adds overhead (~1ms).

### Q: How do I monitor all workers?

**A:** GET /api/pool-status returns aggregated health. Individual calls to `ModuleName.getStatus()` give per-worker metrics.

---

## CONSOLIDATION ROADMAP

### Current (PHASE 9)
- [x] Document the shim pattern (this file)
- [x] Add honesty flag (already in code)
- [x] Create registry for discoverability

### Phase 10 (Future)
- [ ] Consider deprecation if alternative pooling strategy emerges
- [ ] Optional: Provide direct pool API wrapper for new code
- [ ] Optional: Reduce shim file count with dynamic loader

### Recommendation
**Keep shims as-is.** They serve a valid purpose and have zero maintenance burden. Consider them an intentional, documented feature of the architecture.

---

## RELATED DOCUMENTATION

- **adaptiveEnginePool.js** — Core implementation (80+ lines)
- **MODULE_STATUS.md** — Lists all 452 modules including these shims
- **ARCHITECTURE_REPORT.md** — Explains shim in system context
- **CONSOLIDATION_PLAN.md** — Roadmap for future shim management

---

## CONCLUSION

The 146 shim modules are **not a bug, not a mistake, and not dead code.** They're an intentional, documented architectural pattern that provides:

1. ✅ Clean, discoverable module names
2. ✅ Zero performance overhead
3. ✅ Transparent delegation to the pool
4. ✅ Per-worker health monitoring
5. ✅ Future extensibility

This pattern is **well-documented, honestly declared, and ready for production.**

---

*Maintained by PHASE 9 Architecture Team*
*Last Updated: 2026-08-06T20:41:45Z*
*Next Review: 2026-09-06 (30 days)*
