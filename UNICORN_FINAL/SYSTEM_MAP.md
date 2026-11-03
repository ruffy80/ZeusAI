# System map

Static require graph of `backend/modules`. Nothing in this file was started to produce it.

The only orchestrator is Integrated Autonomy Kernel `IAK/1.1`. The names central-orchestrator, unicornMeshOrchestrator, unicornOrchestrator, meshOrchestrator, saas-orchestrator-v4, recovery-orchestrator, billion-scale-activation-orchestrator are shims.

| Status | Count |
|---|---|
| active | 703 |
| orphaned | 0 |
| dead | 0 |

```mermaid
flowchart LR
  backend["backend/index.js"] --> iak["IAK/1.1"]
  site["src/index.js"] --> iak
  iak --> census["module-census-os"]
  iak --> queue["tenant-queue"]
  iak --> guardian["guardian-engines"]
  iak --> sense["external-sense"]
  orphans["orphaned files: 0"]:::gap
  classDef gap stroke-dasharray: 5 5
```

Orphaned means the file is not reachable by a static `require` from `backend/index.js` or `src/index.js`. IAK can soft-require some of them later. This map does not call that scan, because the scan executes modules.

Sample of orphaned files:

