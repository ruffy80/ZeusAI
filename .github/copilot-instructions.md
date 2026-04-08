# Copilot instructions for generate-unicorn

## Big picture architecture
- This repo has two active layers:
  - Root Next.js shell (`app/`, `package.json`) used for simple frontend bootstrapping.
  - `UNICORN_FINAL/` generated product, validated/deployed in CI and containing most business logic.
- `generate_unicorn_final.js` is the canonical generator (explicitly documented in file header); use it for durable template-level changes.
- `UNICORN_FINAL/src/index.js` is a standalone Node HTTP server (no Express) that serves:
  - JSON APIs like `/health`, `/snapshot`, `/innovation`
  - SSE stream at `/stream`
  - Full UI HTML from `src/site/template.js`
- `UNICORN_FINAL/backend/index.js` is a separate Express runtime with many `/api/*` endpoints and module-based in-memory domain engines in `backend/modules/`.

## Critical workflows
- Root app:
  - `npm run dev` (Next dev), `npm run build`, `npm run start`
- Main generated app (`UNICORN_FINAL/`):
  - `npm run start` → `node src/index.js`
  - `npm test` → `node test/health.test.js` (uses Node 20 global `fetch`)
  - `npm run lint` → syntax checks via `node --check` (not ESLint)
  - `npm run innovation:report`, `npm run innovation:sprint`
- CI deploy path is centered on `UNICORN_FINAL/`:
  - Root workflow `.github/workflows/vercel-deploy.yml` runs lint/test with `working-directory: UNICORN_FINAL`.

## Project-specific coding conventions
- Prefer plain Node + in-memory state for features unless persistence is already introduced:
  - Example: `users` array auth store in `UNICORN_FINAL/backend/index.js`.
- Endpoint style is explicit and grouped by domain blocks in `backend/index.js` (identity, negotiate, carbon, marketplace, payment, etc.); follow the same grouping/comments when adding routes.
- Keep generated UI server-side inline in `src/site/template.js` (single HTML string) rather than adding frontend frameworks inside `UNICORN_FINAL/src`.
- Preserve bilingual comments/logs (English + Romanian) where present; do not normalize naming unless requested.

## Integration boundaries and external systems
- Deployment automation is first-class:
  - `github-vercel-hetzner-connector.js` orchestrates GitHub repo setup, Vercel linking, and Hetzner SSH deployment.
  - `setup-platform-auto-connect.sh` validates `.env.auto-connector` and bootstraps Hetzner runtime.
- GitHub Actions deploy both Vercel and Hetzner from secrets (`VERCEL_*`, `HETZNER_*`); keep secret names unchanged when editing workflows/scripts.
- Auto-sync scripts (`scripts/start-auto-sync.sh`, `scripts/auto-sync-push.sh`) continuously `git add/commit/push`; avoid enabling/changing them unintentionally during feature work.

## Practical change strategy for AI agents
- If a fix must survive future regeneration, patch generator templates in `generate_unicorn_final.js`.
- If user asks for immediate runtime behavior in current generated app, patch `UNICORN_FINAL/` directly and run its `lint` + `test`.
- For API/UI consistency checks, validate `/snapshot` and `/stream` behavior because the HTML portal depends on those payload shapes.