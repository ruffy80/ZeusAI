---
name: testing-unit-suite
description: Run and verify the ZeusAI unit test suite. Use when adding, modifying, or verifying unit tests.
---

# Testing the ZeusAI Unit Test Suite

## Quick Commands

```bash
cd UNICORN_FINAL
npm test          # Run full suite (45+ test files)
npm run lint      # ESLint on backend + src
```

## Running Individual Test Files

All test files are in `UNICORN_FINAL/test/` and follow the pattern:
```bash
node test/<name>.test.js
```

Each test file is self-contained — it sets up its own env vars and imports.

## Test File Conventions

- Uses Node.js built-in `assert` module (no test framework like Jest/Mocha)
- Each file has a `check(name, fn)` helper that runs assertions and counts passes
- Tests print `✓ <name>` for each passing test
- Final line prints `✅ <module>: N tests passed`
- Exit code 0 = all pass, non-zero = failure

## Environment Variables for Tests

Most test files set these at the top:
```js
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';  // use in-memory SQLite
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = '999999';
```

## Key Modules and Their Test Files

| Module | Test File |
|--------|----------|
| `backend/modules/dynamic-pricing.js` | `test/dynamic-pricing.test.js` |
| `backend/modules/circuit-breaker.js` | `test/circuit-breaker.test.js` |
| `backend/modules/creditSystem.js` | `test/credit-system.test.js` |
| `backend/modules/FeatureFlagManager.js` | `test/feature-flag-manager.test.js` |
| `backend/modules/forward-only-safety.js` | `test/forward-only-safety.test.js` |
| `backend/db.js` | `test/db-layer.test.js` |
| `backend/index.js` (API endpoints) | `test/api.test.js`, `test/api-aliases.test.js` |

## Notes

- The `dynamic-pricing` module starts a `setInterval` internally, so its test file needs `process.exit(0)` at the end to avoid hanging.
- The `db-layer` test uses a temp SQLite file (not `:memory:`) because it tests the full SQLite code path including file creation.
- The `npm test` script chains all test files with `&&` — if any file fails, subsequent files won't run.
- There are 236 backend modules total but only ~40 have direct test coverage. Priority untested modules include: `configurationManager.js`, `workflowEngine.js`, `tenant-manager.js`, `disaster-recovery.js`.

## Lint

```bash
npx eslint test/<file>.test.js --max-warnings=0
```

## Devin Secrets Needed

None — all tests run with in-memory databases and mock credentials.
