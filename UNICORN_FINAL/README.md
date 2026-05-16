# UNICORN_FINAL

Generated automatically.

## Contributing

To avoid duplicate declarations and syntax errors, always run `npm run lint` before pushing.
CI will reject any code with duplicate identifiers (e.g. `const x = require(...)` declared twice).
A pre-commit hook (Husky + lint-staged) will auto-lint staged `.js` files before each commit.

## Scripts
- `npm run lint` — ESLint check on all backend/src JS files (must pass before push)
- `npm run lint:fix` — auto-fix lint issues
- `npm test`
- `npm run start`
- `npm run innovation:report`
- `npm run innovation:sprint`

## Interactive Unicorn Site
- / serves the full ZEUS + Robot + Codex + Marketplace + Automation portal
- /snapshot provides full JSON state for users, companies, industries, and modules
- /stream provides real-time updates (SSE)
- /modules, /marketplace, /codex, /telemetry, /me, /recommendations are exposed

## DeepSeek Governor (allowlist-only autonomy)

`backend/modules/deepseek-governor.js` exposes two admin-gated endpoints that let
an external decision-maker (e.g. DeepSeek) trigger a **fixed, hardcoded** set of
internal recovery actions on the backend — and nothing else.

### Endpoints
- `GET  /api/admin/deepseek/status` — allowlist, rate limits, aggregate counters.
- `POST /api/admin/deepseek/act` — body: `{ "action": string, "params": object, "requestId": string }`.

Both require a valid admin JWT (`adminTokenMiddleware`) and pass through
`adminCrudRateLimit`.

### Allowed actions
| Action            | Effect                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `none`            | No-op.                                                                 |
| `read_status`     | Returns a curated runtime snapshot (no secrets, no arbitrary file reads). |
| `read_file`       | Reads a file from the repo root with a strict whitelist: extension must be one of `.js/.json/.yaml/.yml/.log/.md/.txt/.html/.css`; path segments matching `.git/.ssh/.env/node_modules/secrets/private/credentials/id_rsa/id_ed25519` are rejected; substrings `secret/password/apikey/token/jwt/private_key` are rejected; symlinks are rejected; max 256 KiB; content returned base64-encoded. Configurable via `DEEPSEEK_GOVERNOR_READ_ROOT`, `DEEPSEEK_GOVERNOR_READ_MAX_BYTES`. |
| `prices_sync`     | Calls `livePricingBroker._refresh()` and returns snapshot summary.     |
| `checkout_fix`    | Read-only checkout-health re-check. Never mutates user data.           |
| `run_test`        | Spawns `npm test` with `shell:false` and a 30 s hard timeout.          |
| `restart_service` | **Intent-logged only.** Records a `restart_request` line in the governor log. The governor never invokes `systemctl` / `pm2` itself; a separate OS-level supervisor is responsible for acting on the log entry. Allowed service names: `unicorn-backend`, `unicorn-frontend`, `unicorn-site`, `pricing-module`. |
| `code_proposal`   | **Envelope only — never applied automatically.** Writes a JSON file under `data/deepseek-proposals/` containing `targetPath`, `proposedContent`, `rationale`, `objectiveId`, `riskLevel`. The proposal must target a repo-relative file with an extension in the read_file allowlist, must NOT touch `.github/`, `deepseek-governor.js`, `deepseek-loop.js`, `package.json`, `package-lock.json`, and the same deny-segments/substrings as `read_file` apply. Max 32 KiB per proposal, 50 proposals/day. Apply is a separate human/CI step. |
| `roadmap_update`  | Updates `status` and optional `note` on an **existing** objective in `data/roadmap.json`. Cannot add/remove objectives or change vision/north-star — that requires a human edit. Allowed statuses: `pending`, `in-progress`, `done`, `blocked`. |

### Explicitly rejected (by design, not by configuration)
- `write_file` to arbitrary paths — would be equivalent to remote code execution on the
  next `require()`. (`code_proposal` is **not** an exception: it only writes envelope
  JSON files under a dedicated quarantine directory and never to source.)
- `deploy` triggered by the LLM — would bypass human review and the
  AutoInnovation guard.
- `git_commit` / `git push` authored by an autonomous loop — same.
- Arbitrary shell / `eval`.
- Modifying the governor itself, the loop script, CI workflows, or `package.json`
  (enforced by `PROPOSAL_TARGET_DENY_*` allowlists).

### Autonomous Mode — goal-directed loop with operator commands

When DeepSeek runs continuously (see `scripts/deepseek-loop.js`), three new pieces
turn it into a goal-directed worker that the human owner can steer in real time:

1. **Roadmap** — `data/roadmap.json` lists prioritised objectives toward the
   north-star metric. The loop fetches the top-priority open objectives every
   tick and biases its action toward closing them.
   - `GET /api/admin/roadmap` returns the full roadmap.
   - `roadmap_update` action lets the loop mark an objective `done` when it
     ships a fix.
2. **Operator command queue** — push a free-form text instruction that
   overrides roadmap priorities for the next loop tick:
   - `POST /api/admin/deepseek/command` body `{ instruction: string, priority?: 1-10 }`
   - `GET  /api/admin/deepseek/commands?limit=50&includeConsumed=0`
   - `POST /api/admin/deepseek/command/consume` (used by the loop; pops the
     highest-priority unconsumed command and marks it consumed).
3. **Proposals listing** — review what DeepSeek wants to change before any code
   lands on disk:
   - `GET /api/admin/deepseek/proposals?limit=50` returns the envelope metadata
     for the most recent proposals in `data/deepseek-proposals/`.

Recommended operator alias (mobile-friendly):

```bash
zeus() { curl -sX POST https://zeusai.pro/api/admin/deepseek/command \
  -H "x-admin-token: $DEEPSEEK_LOOP_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"instruction\":\"$*\",\"priority\":7}"; }
# Usage: zeus "fa marketplace sa incarce sub 150ms"
```

The loop reads the next operator command at the start of each tick and forwards
it to DeepSeek as the highest-priority context, alongside the roadmap. The model
must still pick an action from the hardcoded allowlist; nothing about the
operator-command channel weakens the safety envelope.

### Billion-USD roadmap + innovation mandate / Roadmap miliarde + mandat de inovație

`data/roadmap.json` is the durable goal-graph DeepSeek reads on every tick. It now declares the **owner BTC settlement address** (`ownerBtcSettlementAddress`), explicit **northStarTargets** (MRR 100k @ 30d → 1M @ 180d → 10M @ 365d → ARR 1B in 5y), a bilingual **`missionForDeepSeek`** instructing the model to operate 24/7 in an infinite improvement loop, and a set of innovation-flagged objectives (`innovation: true`) covering features that do not yet exist on any competing SaaS — AI-personalized per-visitor pricing, 24/7 AI commerce concierge, revenue-anomaly self-healing, sovereign anonymized-insights marketplace, BTC Lightning instant settlement, and autonomous blue/green self-deploy. The DeepSeek system prompt in `scripts/deepseek-loop.js` mirrors this mandate and adds an **auto-advance rule**: when an objective's metric target is met, DeepSeek prefers `roadmap_update status=done` so the loop chains automatically to the next priority.

These actions are **not in the allowlist enum**, so even a tampered client or a
compromised LLM response cannot invoke them.

### Rate limiting & idempotency
- Per IP: 10 actions/hour, 30 actions/day (override with
  `DEEPSEEK_GOVERNOR_HOURLY_LIMIT` / `DEEPSEEK_GOVERNOR_DAILY_LIMIT`).
- `requestId` is cached for 5 min — replays return the original result with
  `cached: true`.

### Logging
JSONL at `DEEPSEEK_GOVERNOR_LOG_PATH` (default `data/logs/deepseek-governor.log`),
auto-rotated at 2 MiB.

### Advisory loop (`scripts/deepseek-loop.js`)

A **default-off**, opt-in companion script that polls a status snapshot,
asks DeepSeek for one recommended action from the allowlist, and either logs
the recommendation (advisory mode, default) or posts it to
`/api/admin/deepseek/act` (execute mode).

Environment knobs:
- `DEEPSEEK_LOOP_ENABLED=1` — required, otherwise the script exits immediately.
- `DEEPSEEK_LOOP_EXECUTE=1` + `DEEPSEEK_LOOP_ADMIN_TOKEN=<jwt>` — together
  enable execute mode. Without both, the loop is advisory only.
- `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`, `DEEPSEEK_MODEL`.
- `DEEPSEEK_LOOP_INTERVAL_MS` (default 120 000, min 30 000).
- `DEEPSEEK_LOOP_FAILURE_THRESHOLD` (default 3) — consecutive failures
  before the circuit breaker pauses for `DEEPSEEK_LOOP_BACKOFF_MS`
  (default 30 min).

Circuit breaker, no shell, no eval, no file writes outside its log.

A systemd unit ships at `scripts/deepseek-loop.service`. It is **auto-installed
by `deploy.yml`** on every successful push to `main` (step _“🧠 Install + start
DeepSeek advisory/execute loop (default-OFF)”_): the unit is copied to
`/etc/systemd/system/`, `daemon-reload`-ed, and—only when
`DEEPSEEK_LOOP_ENABLED=1` is present in `/var/www/unicorn/UNICORN_FINAL/.env`—
`systemctl enable --now`-ed. A manual fallback workflow (**`🛠️ Install DeepSeek
Loop (Hetzner)`**, `.github/workflows/install-deepseek-loop.yml`,
`workflow_dispatch`) remains available for install/uninstall/status outside the
normal deploy path. The loop remains **default-OFF**: to bring it up at full
power, set the following as repository secrets in GitHub Actions so
`create-env.sh` propagates them to `.env` on the next deploy:

- `DEEPSEEK_API_KEY` — DeepSeek API token.
- `DEEPSEEK_LOOP_ENABLED=1` — flips the in-script gate.
- `DEEPSEEK_LOOP_EXECUTE=1` and `DEEPSEEK_LOOP_ADMIN_TOKEN=<admin-jwt>` —
  required together to switch from advisory-only to execute mode (POST to
  `/api/admin/deepseek/act`). Without both the loop only logs recommendations.
- *(optional)* `DEEPSEEK_LOOP_INTERVAL_MS`, `DEEPSEEK_LOOP_BACKEND_URL`.

The unit hardens the runtime with `NoNewPrivileges`, `ProtectSystem=strict`,
`MemoryDenyWriteExecute`, and a restrictive `SystemCallFilter`, and uses
`Restart=on-failure` so the default-OFF clean exit does not cause a restart
loop.

### Tests
`test/deepseek-governor.test.js` enforces the allowlist contract (including
explicit rejection of `write_file` / `deploy` / `git_commit`), idempotency,
intent-only restart semantics, and the 401 denial contract for both HTTP
endpoints.

