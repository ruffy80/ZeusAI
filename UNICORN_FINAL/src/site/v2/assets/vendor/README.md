# Vendored runtime assets (sovereignty)

To keep the site 100% functional for 30+ years without external CDNs, place the
following files here:

- `three.min.js` — Three.js r160 (or later) minified build.
- `nacl-fast.min.js` — tweetnacl 1.0.3 (Ed25519 fallback when SubtleCrypto Ed25519 is missing).

Public pages do not inject Three.js. The homepage has no WebGL scene, and
other routes never mounted one. Do not add a shell loader for
`/assets/vendor/three.min.js` or for the unpkg build: the vendored file
throws in the console, and the CDN copy is unused JavaScript.
