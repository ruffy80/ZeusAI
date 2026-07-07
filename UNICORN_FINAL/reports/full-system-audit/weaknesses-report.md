# Weaknesses Report

Generated: 2026-07-07T17:47:57.083Z

- Circular import cycles detected: 1
- Potential dead modules: 85
- Duplicate logic groups (identical file hash): 5
- Files with sync/blocking IO patterns: 140
- Files with setInterval but no clearInterval in file: 51

## Circular imports (sample)
- backend/modules/adi-core/world-scanner.js -> backend/modules/adi-core/world-scanner.js

## Potential dead modules (sample)
- backend/modules/Engine1.js
- backend/modules/Engine10.js
- backend/modules/Engine11.js
- backend/modules/Engine12.js
- backend/modules/Engine13.js
- backend/modules/Engine14.js
- backend/modules/Engine15.js
- backend/modules/Engine16.js
- backend/modules/Engine17.js
- backend/modules/Engine18.js
- backend/modules/Engine19.js
- backend/modules/Engine2.js
- backend/modules/Engine20.js
- backend/modules/Engine21.js
- backend/modules/Engine22.js
- backend/modules/Engine23.js
- backend/modules/Engine24.js
- backend/modules/Engine25.js
- backend/modules/Engine26.js
- backend/modules/Engine27.js
- backend/modules/Engine28.js
- backend/modules/Engine29.js
- backend/modules/Engine3.js
- backend/modules/Engine30.js
- backend/modules/Engine31.js
- backend/modules/Engine32.js
- backend/modules/Engine33.js
- backend/modules/Engine34.js
- backend/modules/Engine35.js
- backend/modules/Engine36.js
- backend/modules/Engine37.js
- backend/modules/Engine38.js
- backend/modules/Engine39.js
- backend/modules/Engine4.js
- backend/modules/Engine40.js
- backend/modules/Engine41.js
- backend/modules/Engine42.js
- backend/modules/Engine43.js
- backend/modules/Engine44.js
- backend/modules/Engine45.js
- backend/modules/Engine46.js
- backend/modules/Engine47.js
- backend/modules/Engine48.js
- backend/modules/Engine49.js
- backend/modules/Engine5.js
- backend/modules/Engine50.js
- backend/modules/Engine51.js
- backend/modules/Engine52.js
- backend/modules/Engine53.js
- backend/modules/Engine54.js
- backend/modules/Engine55.js
- backend/modules/Engine56.js
- backend/modules/Engine57.js
- backend/modules/Engine58.js
- backend/modules/Engine59.js
- backend/modules/Engine6.js
- backend/modules/Engine60.js
- backend/modules/Engine61.js
- backend/modules/Engine62.js
- backend/modules/Engine7.js

## Duplicate groups (sample)
- backend/modules/auto-optimize.js | backend/modules/autonomousInnovation.js
- backend/modules/evolution-core.js | backend/modules/innovationEngine.js
- backend/modules/ops-watchdog.js | backend/modules/predictive-healing.js | backend/modules/quantum-healing.js
- backend/modules/recovery-engine.js | backend/modules/recovery-orchestrator.js | backend/modules/self-healing-engine.js | backend/modules/service-watchdog.js
- backend/modules/ui-evolution.js | backend/modules/unicornAutoGenesis.js