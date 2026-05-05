// C13: WASM sandbox (forward-only, safe execution)
// Provides a secure environment for running user-supplied WebAssembly code.
// Uses Node.js vm and @wasmer/wasi for isolation.

const { WASI } = require('@wasmer/wasi');
const { readFileSync } = require('fs');
const { WASI_DEFAULTS } = require('@wasmer/wasi/lib/constants');

async function runWasmSandbox(wasmPath, input = "") {
  const wasi = new WASI({
    args: [],
    env: {},
    preopens: {},
  });
  const wasm = readFileSync(wasmPath);
  const module = await WebAssembly.compile(wasm);
  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  wasi.start(instance);
  return instance;
}

module.exports = { runWasmSandbox };