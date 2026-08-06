# Weaknesses Report

Generated: 2026-08-06T19:47:04.141Z

- Circular import cycles detected: 6
- Potential dead modules: 0
- Duplicate logic groups (identical file hash): 3
- Files with sync/blocking IO patterns: 195
- Files with setInterval but no clearInterval in file: 55

## Circular imports (sample)
- backend/modules/telegram-profit-group-os.js -> backend/modules/telegram-mobdial-os.js -> backend/modules/telegram-profit-group-os.js
- backend/modules/fulfillment-ai-os.js -> backend/modules/ai-provider-health.js -> backend/modules/fulfillment-ai-os.js
- backend/modules/marketing-innovations/index.js -> backend/modules/marketing-innovations/modules/marketing-innovations.js -> backend/modules/marketing-innovations/index.js
- src/commerce/billion-autonomy-loop-os.js -> src/commerce/autonomy-money-surface-os.js -> src/commerce/billion-autonomy-loop-os.js
- src/commerce/autonomous-enterprise-deal-orchestrator.js -> src/commerce/autonomous-enterprise-closure-os.js -> src/commerce/autonomous-enterprise-deal-orchestrator.js
- src/site/commerce-integrity.js -> src/site/sovereign-commerce.js -> src/site/commerce-integrity.js

## Potential dead modules (sample)

## Duplicate groups (sample)
- backend/modules/auto-optimize.js | backend/modules/autonomousInnovation.js
- backend/modules/ops-watchdog.js | backend/modules/predictive-healing.js | backend/modules/quantum-healing.js
- backend/modules/recovery-engine.js | backend/modules/recovery-orchestrator.js | backend/modules/self-healing-engine.js | backend/modules/service-watchdog.js