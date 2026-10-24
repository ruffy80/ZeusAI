# ZeusAI / Unicorn — architectural review

Reviewed from the source tree on 24 October 2026 (Europe/Bucharest). This note is for an external architect. It describes what the code loads and starts. It does not treat boot banners, `MODULE_REGISTRY` name lists, or older root reports (`ARCHITECTURE_REPORT.md`, `MODULE_STATUS.md`, `MODULE-INVENTORY.md`, `SYSTEM_MAP.md` if present) as proof that a loop is running.

Production default is one Hetzner VPS, PM2, `UNICORN_RUNTIME_PROFILE=stable`, `NODE_ENV=production`. Under that profile the eight guardian engines stay idle, file mutators stay off, and a named allowlist plus a few explicit boot calls still start in-process work.

## 1. Directory structure (three levels)

The repository root is a thin wrapper. `package.json` scripts delegate into `UNICORN_FINAL` with `npm --prefix`. The root also holds a large set of historical status markdown files (on the order of one hundred), plus deploy and ops folders. Those markdown files are not the runtime.

```
/
  package.json, package-lock.json, Dockerfile, docker-compose.yml, docker-compose.prod.yml
  AGENTS.md, README.md, LIVE_BASELINE.md, renovate.json
  .github/            workflows, baselines, codeql
  .agents/skills/     local test skills
  .husky/             pre-commit (lint-staged inside UNICORN_FINAL)
  docs/               deploy and architecture notes, including this file
  k8s/                operator/
  monitoring/
  scripts/            root deploy and probe scripts
  services/           bandit/, kafka-lag-healer/   (small sidecars, not the orchestrator bus)
  templates/
  templates_saas_2026/
  UNICORN_FINAL/      the application
```

```
UNICORN_FINAL/
  package.json, ecosystem.config.js
  backend/            Express API, SQLite, module host
    constants/
    generated/        a few generated capability files
    integration/
    lib/
    middleware/
    modules/          514 top-level .js files, plus 23 subdirectories
  src/                SSR site (the public product)
    assets/  commerce/  config/  engine/  innovation/  lib/  lightning/
    modules/  monitoring/  openapi/  perf/  security/  seo/
    site/v2/  wasm/
  client/             separate Create React App; not the PM2 site process
    public/  src/{api,components,hooks,pages,innovations}/  build_mirror/
  test/               about 255 test files
  scripts/            autonomy/  cron/  systemd/  lib/   plus ~167 script files
  deploy/  docs/  generated/  public/docs/  reports/full-system-audit/
  schemas/  snapshots/  templates/
```

`backend/modules/` subdirectories and their JavaScript file counts:

| Directory | JS files | What lives there |
|---|---:|---|
| zacc | 34 | Dropship continuum. PM2 default `ZACC_ENABLED=0`. |
| marketing-innovations | 26 | Marketing experiments. |
| social-orchestrator | 16 | Social posting helpers. |
| world-standard | 12 | World-standard protocols, including the agent capability exchange. |
| adi-core | 10 | ADI core. PM2 default `ADI_CORE_DISABLED=1`. |
| ai_future_innovations | 10 | Innovation sketches. |
| improvements-pack | 9 | Improvement pack. |
| innovations-50y | 9 | Innovation pack. |
| sovereign_innovations | 9 | Sovereign innovation pack. |
| integrations | 8 | Third-party adapters. |
| zeusAutonomousCore | 8 | Optional ZAC process (`npm run zac:start`). |
| iak | 4 | Orchestrator facets: discovery, tenant queue, guardian engines, external sense. |
| immortality | 4 | Continuity helpers. |
| innovation | 4 | Innovation helpers. |
| unicorn-super-intelligence | 4 | USI pieces. |
| cryptoBridge, cryptoauth, innovations-100y, performance-100y, performance-100y-v2, performance-100y-v3, polish-pack, universal-ai-connector | 1 each | Single-file packs. |

IAK discovery scans **top-level** `backend/modules/*.js` and `backend/generated/*.js`. It does not walk those subdirectories. A subdirectory module runs only when some other file `require`s it.

`UNICORN_FINAL/data/**` is runtime state (SQLite, ledgers, heartbeats). It is not source and must not be treated as a module.

## 2. Entry points and boot

Two long-lived Node processes, both defaulting to port 3000 if started alone. Production splits them.

| Process | Entry | Production bind | Role |
|---|---|---|---|
| Backend | `UNICORN_FINAL/backend/index.js` | `127.0.0.1:3000` | Express API, SQLite, orchestrator, module host. Source of truth. |
| Site | `UNICORN_FINAL/src/index.js` | `127.0.0.1:3001` | Server-rendered HTML. Proxies `/api` toward the backend when nginx is not in front. |
| Phoenix (optional, default on in ecosystem config) | `UNICORN_FINAL/backend/phoenix-edge.js` | `127.0.0.1:3002` | Separate process. Does not load the orchestrator. Proxies commerce with a short timeout and a last-known-good fallback. |

Root `npm start` runs **only** the site. `UNICORN_FINAL` `npm start` runs **only** the backend. PM2 `ecosystem.config.js` is the production supervisor: fork mode, one backend instance, because SQLite and the in-memory orchestrator are not cluster-safe. The site entry is declared `exec_mode: cluster` with `SITE_INSTANCES` defaulting to 1. Deploy starts `unicorn-backend` and `unicorn-site`. Phoenix is included unless `UNICORN_PHOENIX=0`. Autoscaler, module-mesh-guardian, live-sync, and unicorn-guardian are off unless their `*_PM2` / `UNICORN_GUARDIAN` flags are set.

Nginx on the VPS sends `/api/` to the backend and page routes to the site. A site response that shows `X-Unicorn-Role: site` on `/api/*` means that split is broken.

### Profile

`backend/index.js` sets the profile before the kernel boots:

- `UNICORN_RUNTIME_PROFILE`, or `stable` when `NODE_ENV=production`, otherwise `full`.
- `stable` and `safe` are `_stableRuntime`.
- `growth` and `full` are `_growthRuntime`.
- `full` is the only profile that is allowed to turn file mutators on, and only if `ENABLE_FILE_MUTATORS=1`.

PM2 pins `UNICORN_RUNTIME_PROFILE=stable` and `DISABLE_SELF_MUTATION=1`. An older comment in `backend/index.js` says stable pauses all background loops. The boot function below that comment does not do that. Read the boot function, not the comment.

### What `backend/index.js` actually calls

On load, before `app.listen`:

1. Mounts Express, SLO timing, tenant and API-gateway middleware.
2. Under stable, schedules a **read-only** `selfConstruction.audit()` on a delay (default 20s). It does not call `selfConstruction.start({ apply: true })`.
3. `bootIntegratedAutonomyKernel()`:
   - Asks the dual-plane helper for a mode. The fallback is `safe-autonomy` when stable, `full` otherwise.
   - Calls `start()` / `mountRoutes()` on world-standard inventions, the immortality continuum, the merchant trust standard, the orchestrated capability continuum, the essential-modules continuum, continuum harmony, and total ecosystem perfection. A console line that says `STARTED` here means that call returned, not that a guardian engine is armed.
   - `meshOrchestrator.discoverAndRegister({ softRequireMissing: true })` — in-process registry fill.
   - `meshOrchestrator.causalStart()` — starts modules the profile gate allows.
   - Stable path: `meshOrchestrator.start({ mode: 'safe-autonomy', ensureFacets: false, guardianMode: 'idle' })`. That arms the harmonic tick. It does **not** start the tenant queue or the eight guardian engines.
   - Non-stable `full` path: `start({ mode: 'full', ensureFacets: true })` and `unicornOrchestrator.start('full')`, which is the only path that arms the eight engines.
4. Autonomy Action Continuum starts unless `NODE_ENV=test` or `AACOS_DISABLED=1`. PM2 default is `AACOS_DISABLED=0`.
5. Telegram credential continuum reloads from its sanctum and logs whether a token is present. It does not invent one.
6. Revenue invention continuum starts unless `NODE_ENV=test` or `RIVOS_DISABLED=1`.
7. `app.listen(PORT, BIND_HOST)`.

The site process, when run as main, calls `createServer()` and `server.listen`. It does not host the Integrated Autonomy Kernel. With `NODE_ENV=production` and no backend, site `/health` reports the backend as down. That is the expected single-process result.

`Dockerfile` `CMD` is `node src/index.js` (the site only) on port 3000. `docker-compose.yml` is that single container plus nginx. It is not the two-process production topology.

Self-mutation: if the backend is started without `DISABLE_SELF_MUTATION=1` on a non-stable profile, it can rewrite `backend/modules/*.js`. Local work and the test suite set the flag. Production PM2 sets it because the profile is stable.

## 3. Agents and their roles

There is no separate agent fleet, no worker pool of LLM processes, and no roster loaded from a queue. “Agent” in this tree means an in-process module whose name ends in agent, plus two in-memory maps that register entries at runtime.

Named agent modules:

| Module | Role in code | When it does work |
|---|---|---|
| `control-plane-agent.js` | Polls the SLO tracker, records a decision, and exposes hooks for rollback, restart, and canary promote/reject. | The file comment says `start()` runs on export. The guardian’s eight-engine `start()` does not call it under stable unless `UNICORN_ORCHESTRATOR_FORCE=1`. Treat a live heal loop as unproven unless a status route shows `running: true`. |
| `ai-cfo-agent.js` | Reads the paid ledger. If that ledger is absent it returns `dataMode: 'unarmed'` and zeros. It does not invent revenue. | On demand. |
| `ai-sdr-agent.js` | Reads `data/marketing/leads.jsonl` when that file exists and returns a prioritized list. Pull-based. No timer. | On demand, and only if the lead file exists. |
| `checkout-recovery-agent.js` | Lists SQLite orders stuck in `awaiting_payment`. May send one recovery email per order per 24h if a mailer is present. Does not cancel or rewrite order status. | On the stable allowlist (`checkout-recovery-agent` / `checkoutRecoveryAgent`), so causal start may call `start()` if the module was discovered and exports `start`. |
| `competitor-spy-agent.js` | Stays unarmed without `SERPAPI_KEY` (or `COMPETITOR_SPY_FORCE=1` plus operator input). Does not invent competitor ratings. | On demand, key-gated. |
| `growth-agent.js` | Builds content briefs from pages that already exist. Does not call a model, send mail, ping IndexNow, or call Google. | On demand. Search Console stays on `search-console-bridge.js` and stays blocked without `GOOGLE_SERVICE_ACCOUNT_JSON`. |
| `world-standard/agent-capability-exchange.js` | In-memory clearinghouse: list, quote, reserve prepaid credits, issue a credential. Not loaded by the top-level discovery scan unless required. | When a caller requires the world-standard pack. |

`aiWorkforce.js` is an `AIWorkforceMarketplace` with `Map`s for agents, jobs, hirings, and reviews. Agents appear when something calls `registerAgent`. It is not a fixed live roster, and any default rating inside it is not a customer count.

`MODULE_REGISTRY.dynamic` and `MODULE_REGISTRY.engines` in `backend/index.js` synthesize names `AdaptivePool#01`… (default 82) and `EnginePool#1`… (default 62). Those strings are labels for `getModuleRegistryStatus()`. They are not OS processes. `adaptiveEnginePool.js` is on the discovery skip list as synthetic idle stubs.

## 4. How the orchestrator talks to modules

The master object is `IntegratedAutonomyKernel` in `backend/modules/integrated-autonomy-kernel.js` (`IAK/1.1`). It extends Node `EventEmitter`. Public files `central-orchestrator.js`, `unicornOrchestrator.js`, `unicornMeshOrchestrator.js`, and `saas-orchestrator-v4.js` are shims onto IAK facets. There is one registry `Map` inside the backend process.

Communication paths that exist in code:

| Path | Mechanism | Armed under production `stable`? |
|---|---|---|
| Registry | In-process `Map`: `register`, quarantine, capability owner, causal boot order. | Yes. `discoverAndRegister` then `causalStart`. |
| Events | `emit` / `on` for `module:registered`, `iak:tick`, `iak:sense`, `mesh:heartbeat`, `mesh:sync`, `mesh:report`, `module:unhealthy`. Listeners are other objects in the same process. | Yes, once `start()` runs. |
| Harmonic tick | `setInterval` over phases `sense → health → heal → sync → report`. Default period `IAK_HARMONIC_MS` 15000. PM2 sets `120000`. Sync every `IAK_SYNC_EVERY` ticks (PM2 `30`). Continuum rediscovery every `IAK_CONTINUUM_EVERY` (PM2 `60`). | Yes. `ensureFacets` is false, but `start()` still arms the timer. |
| Tenant queue | `backend/modules/iak/tenant-queue.js`. Four in-memory arrays, priorities enterprise 10, pro 7, starter 4, free 1. `setInterval` drain every 100 ms, cap `ORCHESTRATOR_MAX_CONCURRENT` (default 10). Per-tenant context and a 500-entry audit ring, all in RAM. | **No** on the stable boot path. `ensureFacets: false`, so `tenants.start()` is not called. Nothing here is Redis, SQS, NATS, or Kafka. |
| Guardian engines | Eight logical engines in `iak/guardian-engines.js`: self-healing, auto-innovation, auto-deploy, auto-repair, auto-update, auto-scaling, auto-monitoring, auto-decision. | **Idle** when the profile is stable or safe, unless `UNICORN_ORCHESTRATOR_FORCE=1`. `start()` returns immediately and logs that eternal, repair, and deploy loops are not started. |
| HTTP | Site ↔ backend via `BACKEND_API_URL` / `BACKEND_ORIGIN` (production `http://127.0.0.1:3000`). Nginx is the public split. Phoenix proxies to the backend with a timeout of a few seconds. | Yes, between processes. This is request/response, not an agent bus. |
| SQLite and JSONL | Orders, ledgers, and module state under `UNICORN_FINAL/data/`. | Yes. This is shared state on disk, still one backend writer. |

`services/kafka-lag-healer/` is a small sidecar directory. Kafka is not a dependency of `UNICORN_FINAL/package.json` and is not the path between the kernel and modules.

`mayStart` in `iak/module-discovery.js` is the gate `causalStart` uses:

- No `start` and no `init` → skip.
- Tier `mutator` (`selfConstruction`, `codeSanityEngine`, `autoDeploy`, and names matching those) → skip when stable or `DISABLE_SELF_MUTATION=1`.
- Tier `commerce` (payments, billing, Stripe, PayPal, checkout, money-machine) → skip unless `isConfigured()` or status says configured/ready.
- Stable, and not on `STABLE_START_ALLOW` / tier `infra` → skip with reason `stable_idle`.
- `growth` or `full` → start autonomy, resilience, infra, and configured commerce.

The stable allowlist is the set `STABLE_START_ALLOW` in that file. It includes boot-immortal, never-down, immortality continuum, total autonomy, the action continuum, ops watchdog, memory-pressure guardian, closed-loop commerce, module-reality, forward-only safety, platform foundation, world-standard inventions, dual-plane kernel, armed-rails, mutation-boundary enforcer, proof-of-outcome, the capability-continuum names, essential-modules and harmony and ecosystem-perfection, traffic engine, growth brain, telegram credential continuum, revenue invention continuum, reality-ops, live pricing, checkout recovery, commerce bond, origin gravity, social gravity, viral unification, safe-evolve, safe-apply, and live-honesty. Being on the list means causal start **may** call `start()` if discovery loaded the file and it exports `start`. It does not mean the module has external credentials.

PM2 also parks specific loops even if a file is present: `ZACC_ENABLED=0`, `ADI_CORE_DISABLED=1`, `UNICORN_REVENUE_AUTOPILOT_DISABLED=1`, `WATCHDOG_DISABLED=1`, `PCL_DISABLED=1`, `PROFIT_LOOP_AUTOSTART=0`, `INNOVATION_AUTO_SHIP=0`, `INNOVATION_GENERATE=0`, `QIS_AUTO_HEAL_ENABLED=false`, `AUTH_GUARDIAN_ENABLED=0`. `SAFE_EVOLVE` and `SAFE_APPLY` default on, and their own modules describe an artifact/observe plane rather than source rewrite. `GROWTH_STACK_DISABLED` defaults to `0`, so IndexNow-related discovery code is not parked by that flag; it still cannot call Google without a service-account file.

## 5. Modules and implementation status

Counts below are files on disk, not running workers.

- **514** JavaScript files in the top level of `backend/modules/`.
- **About 175** more JavaScript files inside the 23 subdirectories.
- **`MODULE_REGISTRY`** in `backend/index.js` is a static catalog grouped as orchestrator, shield, healthDaemon, watchdog, ai, dynamic, engines, generated, internal, external, and saas. Names repeat across groups. `dynamic` and `engines` are generated label arrays (defaults 82 and 62). `getModuleRegistryStatus()` returns that catalog. It does not probe liveness.

Status classes that match the code:

| Area | Implementation | Production stable status |
|---|---|---|
| Integrated Autonomy Kernel | Real in-process registry, discovery, causal start, harmonic tick, quarantine. | Armed in `safe-autonomy`. Facet queue and guardian engines are not. |
| Model routing | `multi-model-router.js`. Fourteen providers: Groq, DeepSeek, Mistral, Together, Fireworks, Gemini, Cohere, Hugging Face, SambaNova, NVIDIA NIM, OpenAI, Perplexity, OpenRouter, Claude. Task-type order, cost fields, retry, a short response cache, and a circuit breaker that opens after repeated failures. Each provider reads its own env key. | Code is real. A provider is unused until its key is set. No key means that provider is skipped. |
| Host LLM fit | `host-llm-fit.js`. Picks an Ollama tag from free RAM. On a small host it refuses an 8B weight (about 4.7 GB) and prefers `llama3.2:3b-instruct-q4_K_M`. The prompt is constrained to the public shelf. | Advisory. Ollama is external and not a package dependency. |
| Self-improvement / self-construction | `selfConstruction` can rewrite module files when `start({ apply: true })` runs. | Stable boot runs a deferred read-only audit. Apply path is off. `DISABLE_SELF_MUTATION=1`. |
| Evolution | `evolution-core.js` re-exports `supreme-innovator-adapter.js`. Innovation source-ship is off (`INNOVATION_GENERATE=0`, `INNOVATION_AUTO_SHIP=0`). `SAFE_EVOLVE=1` is a separate observe/artifact switch inside its own module. | Do not describe this as a live self-rewriting training loop. |
| Self-adaptation | `self-adaptation-engine.js` is an in-memory PID step (`pidStep`) that returns a clamped adjustment. It does not apply host config by itself. | Library. Idle unless a caller invokes it. |
| Eight guardian engines | Implemented behind `iak/guardian-engines.js`, each engine `tryRequire`s other modules and no-ops if missing. | `start()` is a no-op idle under stable. |
| Payments | Bitcoin checkout is the rail the storefront renders when card and PayPal keys are absent. Stripe, PayPal, and NOWPayments clients exist and arm when keys exist. Commerce modules are not causal-started unless they report configured. | Key-gated. Do not assume card or PayPal is live. |
| Commerce shelf | `src/commerce/` plus `src/site/`. Catalog, checkout, and fulfillment are request handlers and file writers, not background agents. | Active as HTTP on the site and backend. |
| Search | `search-console-bridge.js` and `growth-agent.js`. Google calls require `GOOGLE_SERVICE_ACCOUNT_JSON`. | Blocked without that file. |
| Dropship continuum | `backend/modules/zacc/` (34 files). | Not started by PM2 default (`ZACC_ENABLED=0`). The public dropship page is a demo catalog until a supplier key is armed. |
| Social | `backend/modules/social-orchestrator/` (16 files) plus social-gravity modules on the allowlist. | Posting still needs provider keys. Allowlist membership is not a proof of a successful post. |
| ADI core | `backend/modules/adi-core/`. | PM2 default disabled. |
| Control plane / SLO | `slo-tracker` records request latency inside the backend process. The control-plane agent is the consumer described above. | SLO middleware is installed. Automatic rollback is not armed by the stable guardian. |
| Phoenix | Separate tiny process, no kernel. | On by default in ecosystem config. |
| Client SPA | `UNICORN_FINAL/client` is React 18, React Router 7, Three.js, Tailwind. The Docker build compiles it. | Not the process PM2 calls `unicorn-site`. The live pages are rendered by `src/index.js`. |
| Tests | `UNICORN_FINAL/test/*.test.js`, runner `scripts/run-tests-resilient.js`. Node `>=22 <26`. | They set `DISABLE_SELF_MUTATION=1` and the stable profile. A green suite is not a statement about production credentials. |

`k8s/` and the control-plane comments that mention ArgoCD and Istio are hooks and manifests. The running shape in `ecosystem.config.js` and `AGENTS.md` is PM2 on one VPS, not a Kubernetes mesh.

## 6. Tech stack

**Languages.** JavaScript on Node.js `>=22 <26`. Shell for deploy, smoke, and systemd units. Nginx config. A small amount of Kubernetes YAML. The Docker image is `node:lts-alpine`. No Python, Go, or Rust service is on the boot path.

**Frameworks and libraries (from `UNICORN_FINAL/package.json`).** Express 5, Helmet, cors, compression, express-rate-limit, jsonwebtoken, bcryptjs, better-sqlite3, dotenv, axios, node-cron, nodemailer, ssh2, simple-git, stripe, googleapis, `@octokit/rest`, AWS SDK clients (CloudWatch, EC2, S3), Azure SDK clients (Key Vault, Monitor, Network, Storage, identity), ccxt, `@simplewebauthn/server`, libsodium-wrappers, `@noble/hashes`, `@noble/post-quantum`, qrcode, natural, sentiment, chokidar. The site is custom SSR, not Next.js or Nest. The unused-by-PM2 client is Create React App.

**Data.** `better-sqlite3` is the database (`UNICORN_FINAL/data/unicorn.db`, plus other sqlite files such as referrals). Many modules also append JSON or JSONL under `data/`. There is no Postgres, MySQL, MongoDB, or Redis dependency. Backend fork count stays 1 because of SQLite locks.

**External APIs (all optional; absent keys disable that call).**

- LLM HTTP: Groq, DeepSeek, Mistral, Together, Fireworks, Google Gemini, Cohere, Hugging Face, SambaNova, NVIDIA NIM, OpenAI, Perplexity, OpenRouter, Anthropic Claude. Local Ollama is selected by host-llm-fit, not by the fourteen-provider catalog.
- Payments: Bitcoin address configured on the host; Stripe; PayPal (default env `sandbox`); NOWPayments; ccxt for exchange markets.
- Google APIs via `googleapis` (Search Console needs a service-account JSON file).
- GitHub via Octokit.
- AWS and Azure management APIs, only if those credentials are present.
- SMTP via nodemailer.
- SSH via ssh2 (deploy).
- WebAuthn via SimpleWebAuthn.
- SerpAPI, only for the competitor-spy module, and only with `SERPAPI_KEY`.

**Processes and delivery.** PM2 ecosystem file. GitHub Actions (`.github/workflows/deploy.yml`) rsyncs and runs `scripts/deploy-atomic-forward.sh`, which canaries before promoting the live symlink. An on-server poller (`scripts/auto-pull-deploy.sh`) can deploy `origin/main` without Actions. Mutable production state (`.env`, `data`, `db`) is intended to live in `/var/www/unicorn/shared` and be symlinked into each release. `GET /integrity.json` is the live build identity. `GET /api/health` is the backend health route; `GET /health` is the site route and includes a backend sub-object.

## What not to assume

- A log line that says `ACTIVE` or `STARTED` after listen is a banner for a `start()` call that returned. It is not a credential check and not a customer count.
- `MODULE_REGISTRY.total` double-counts names and includes synthetic pool labels. It is not the number of live agents.
- `paidHumans`, GMV, ratings, and Search Console numbers are real only when a ledger or a Google response says so. Modules such as the CFO agent are written to return zeros when unarmed.
- Card, PayPal, supplier dispatch (CJ, Printful, Printify), and social posting are key-gated.
- The eight guardian engines, the tenant priority queue’s 100 ms drain, file-mutating self-construction, ZACC, ADI core, the revenue autopilot, and the profit-control loop are not the production stable boot.
- The harmonic tick, discovery, causal start of the allowlist, the site/backend HTTP split, SQLite, and Bitcoin checkout when a price resolves are the parts that the stable boot actually wires.
