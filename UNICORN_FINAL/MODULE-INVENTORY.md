# UNICORN_FINAL — Module Inventory (cleanup branch `cleanup/strategic-20260501-224759`)

**Date:** 2026-05-01  
**Total modules in `backend/modules/`:** 193 (pre-cleanup) → 190 (post-cleanup, +3 in `_deprecated_/`)  
**Other code roots:** `src/` (HTTP entry + site template + innovation/ + modules/), `src/commerce/` (17 files), `services/` (empty).

## Group-by-group analysis

Each row: file · imports (in active code) · lines · verdict.

### A. Self-healing / recovery
| File | Imports | Lines | Verdict |
|---|---:|---:|---|
| `self-healing-engine.js` | 2 | 413 | ✅ KEEP — winner of group |
| `ai-self-healing.js` | 1 | 392 | ✅ KEEP — AI-specific scope |
| `totalSystemHealer.js` | 2 | 277 | ✅ KEEP — orchestrator scope |
| `recovery-engine.js` | 1 | 204 | ✅ KEEP — distinct (restore flow) |
| `recovery-orchestrator.js` | 1 | 47 | ✅ KEEP — real periodic worker (`pm2 restart` + nodemailer) |
| `predictive-healing.js` | 1 | 40 | 🗑️ **DEPRECATED** — pure stub using `Math.random()`. Moved to `_deprecated_/healing/`. |
| `quantum-healing.js` | 1 | 46 | 🗑️ **DEPRECATED** — pure stub (counter only). Moved to `_deprecated_/healing/`. |

### B. Innovation / evolution
| File | Imports | Lines | Verdict |
|---|---:|---:|---|
| `autonomousInnovation.js` | 2 | 594 | ✅ KEEP |
| `auto-innovation-loop.js` | 2 | 588 | ✅ KEEP |
| `unicornInnovationSuite.js` | 1 | 519 | ✅ KEEP |
| `innovationEngine.js` | 0 | 15 | ✅ KEEP — harmless alias re-exporting `src/innovation/innovation-engine` |
| `evolution-core.js` | 1 | 46 | 🗑️ **DEPRECATED** — pure stub. Moved to `_deprecated_/innovation/`. |

### C. Pricing
| File | Imports | Lines | Verdict |
|---|---:|---:|---|
| `dynamic-pricing.js` | 2 | 354 | ✅ KEEP — pricing engine |
| `live-pricing-broker.js` | 1 | 197 | ✅ KEEP — distinct (broker/feed) |

### D. Cloud
Per mandate: keep all. No changes.

### E. Optimization
Per mandate: keep all. No changes.

### F. Backup / Recovery
| File | Verdict |
|---|---|
| `disaster-recovery.js` | ✅ KEEP — only file in scope |

## Safety rule applied
> "Dacă ceva nu e clar, păstrează modulul existent (nu elimina). Dacă două module sunt la fel de bune, păstrează-le pe ambele."

Only files identified as **provable stubs** (random data, no real logic) were moved. All borderline cases (small but real, or harmless aliases) were retained.

## Surface preservation
The 3 deprecated modules were registered in [backend/index.js](backend/index.js) on:
- `meshOrchestrator.register('quantumHealing', …)` (line ~1730)
- `meshOrchestrator.register('predictiveHealing', …)` (line ~1726)
- `registerModuleRoutes('evolution-core' | 'quantum-healing' | 'predictive-healing', …)` (lines ~6937/6938/6977)
- `evolutionCore.getStatus()` calls in dashboard aggregation (lines ~2833, ~2887)

To preserve mesh + HTTP route surface, each `require('./modules/<stub>')` was replaced with a tiny inline `_deprecatedShim(name, replacement)` exposing `process()` + `getStatus()` returning `{ status: 'deprecated', replacement, … }`. No public route 500s; downstream consumers continue to receive a stable JSON shape.
