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
