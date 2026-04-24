# Vendored runtime assets (sovereignty)

To keep the site 100% functional for 30+ years without external CDNs, place the
following files here:

- `three.min.js` — Three.js r160 (or later) minified build.

The site loader (`shell.js`) tries `/assets/vendor/three.min.js` first and falls
back to `https://unpkg.com/three@0.160.0/build/three.min.js` only when the local
copy is missing. Hosting the file locally neutralizes CDN-outage risk and CSP
restrictions.

Any update to Three.js should bump the `data-local-three-version` attribute in
`shell.js` to preserve cacheability.
