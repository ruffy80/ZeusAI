# Shadow report

Generated 2026-10-28T08:01:00Z after the facade was installed beside the existing orchestrators.

## What ran

- `zeus-orchestrator.service` stays in `SHADOW_MODE=true`. Its log line is `[SHADOW] would run: health, prices, orders, repair`.
- A separate process ran for 300 seconds with `SHADOW_MODE=false` and a 30 second tick. It completed 10 cycles. `/var/log/zeus-orchestrator-live.log` has no error lines.
- `priceNegotiator.getPrice('website-audit')` and `syncPrices()` both returned usd `44.1` and `mutated: false`.
- Invoice 9 stayed `pending`.
- `zac.service` was stopped for that window and started again. It is `active`.

## Chaos

Six restarts were applied to a throwaway container named `zeus-chaos-dummy`. `unicorn-postgres`, `unicorn-redis`, and `unicorn-netdata` were not restarted. The repair action recorded for that drill is `observe`.

## Not claimed

- The other inventoried modules were fingerprinted from source text. They were not executed with five inputs, so their outputs were not compared.
- OpenAI returned HTTP 401, Anthropic returned HTTP 401, and DeepSeek returned HTTP 402. The consensus decision is `NO_DECISION`. No file was deleted.
- Replay files are written every 100 events and again on shutdown. A five-minute window does not fill 100 events.
- Predictive warnings were not emitted. Cycle durations stayed in a narrow band.
- Autopsy files were not written on the server. The live window had no third failure.
- Old modules are still required by `backend/index.js`. `salesOrchestrator` still has references. Deletion waits on identical runtime fingerprints and 24 hours, which have not happened.

## Read-only follow-up

`scripts/orchestrator-probe.js` compared `salesOrchestrator.quote` with `priceNegotiator.getPrice` for four ids on the live release at 2026-10-28T08:07:55Z. All four usd values matched: website-audit 44.1, instant-website-audit 44.1, instant-resume-makeover 35.1, brand-logo-kit 89.1. The same process emitted one `business_alert` for `processPaidOrders` with error `drill_not_a_payment`. Invoice 9 stayed `pending` at 44.1. `zac.service` and `zeus-orchestrator.service` stayed active. Postgres and Redis were not restarted.
