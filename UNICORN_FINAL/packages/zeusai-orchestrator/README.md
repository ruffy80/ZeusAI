# @zeusai/orchestrator

In-repository SDK for the ZeusAI unified orchestrator. It is MIT licensed and it is not published to the public npm registry. Install it from this repo:

```bash
npm install ./packages/zeusai-orchestrator
```

From another checkout, set `ZEUS_ROOT` to the `UNICORN_FINAL` directory before requiring the package.

## Register a capability

```js
const { UnifiedOrchestrator } = require('@zeusai/orchestrator');
const orch = new UnifiedOrchestrator();
orch.registerCapabilities();
```

## Locks

```js
await orch.withLock('orders', async () => {
  // only one runner holds this resource
});
```

A second caller receives `null` while the lock is held. That is the conflict guard.

## Circuit breakers

```js
await orch.safeRun('syncPrices', () => orch.syncPrices());
```

Repeated failures block the capability. Business capabilities raise `business_alert` and pause for one minute.

## Predictive health

```js
orch.updatePrediction('syncPrices', 120);
```

The facade keeps the last durations and emits `predictive_warning` when the recent average is more than 2.5 times the longer average.

## systemd

```
ExecStart=/usr/bin/node backend/modules/orchestrator/index.js
```

## Docker

```
CMD ["node", "backend/modules/orchestrator/index.js"]
```

## Migration

Leave the existing orchestrators loaded. Register new work on this facade. This package does not delete the old processes.

## Two capabilities

```bash
node examples/two-capabilities.js
```

The example runs both capabilities on one lock for 60 seconds and exits non-zero if they overlap.
