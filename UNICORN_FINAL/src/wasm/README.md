# WASM Sandbox

This directory contains the forward-only implementation for the WASM sandbox (C13).

- All code execution is isolated using Node.js `vm` and `@wasmer/wasi` for maximum safety.
- Only whitelisted modules and memory are exposed.
- Used for safe plugin execution, user code, and advanced automation.

Entry: `wasm-sandbox.js` (to be created).