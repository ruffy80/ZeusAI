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

### Explicitly rejected (by design, not by configuration)
- `write_file` to anywhere — would be equivalent to remote code execution on the
  next `require()`.
- `deploy` triggered by the LLM — would bypass human review and the
  AutoInnovation guard.
- `git_commit` authored by an autonomous loop — same.
- Arbitrary shell / `eval`.

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

A systemd unit template ships at `scripts/deepseek-loop.service`. **It is not
installed automatically by `.github/workflows/deploy.yml`** — an operator must
copy it to `/etc/systemd/system/`, set the `EnvironmentFile`, and enable it
explicitly. The unit hardens the runtime with `User=unicorn`, `NoNewPrivileges`,
`ProtectSystem=strict`, `MemoryDenyWriteExecute`, and a restrictive
`SystemCallFilter`.

### Tests
`test/deepseek-governor.test.js` enforces the allowlist contract (including
explicit rejection of `write_file` / `deploy` / `git_commit`), idempotency,
intent-only restart semantics, and the 401 denial contract for both HTTP
endpoints.

