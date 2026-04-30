// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.682Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// api-docs.js
// Self-documenting API generator pentru endpoint-uri Express

'use strict';

function extractRoutes(app) {
  const routes = [];
  // Express 5 expune router-ul ca `app.router`; Express 4 ca `app._router`.
  const router = (app && (app.router || app._router)) || null;
  const stack = (router && router.stack) || [];
  stack.forEach(mw => {
    if (mw && mw.route && mw.route.path) {
      const methodsObj = mw.route.methods || (mw.route.methods === undefined && mw.route.stack
        ? mw.route.stack.reduce((acc, l) => { if (l && l.method) acc[l.method] = true; return acc; }, {})
        : {});
      const methods = Object.keys(methodsObj).map(m => m.toUpperCase());
      const paths = Array.isArray(mw.route.path) ? mw.route.path : [mw.route.path];
      paths.forEach(p => routes.push({ path: p, methods }));
    }
  });
  return routes;
}

function docsHtml(routes) {
  return `<!DOCTYPE html><html><head><title>UNICORN API Docs</title><style>body{font-family:sans-serif;}table{border-collapse:collapse;}td,th{border:1px solid #ccc;padding:4px;}th{background:#eee;}</style></head><body><h1>UNICORN API Docs</h1><table><tr><th>Method</th><th>Path</th></tr>${routes.map(r=>r.methods.map(m=>`<tr><td>${m}</td><td>${r.path}</td></tr>`).join('')).join('')}</table><p>Testează cu <code>curl</code> sau Postman. Endpoint-urile POST acceptă JSON.</p></body></html>`;
}

module.exports = { extractRoutes, docsHtml };
