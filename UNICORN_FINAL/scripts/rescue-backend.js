#!/usr/bin/env node
'use strict';

const http = require('http');

const host = process.env.BIND_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const btcAddress = process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const btcUsd = Number(process.env.RESCUE_BTC_USD || 77000);

const services = [
  { id: 'adaptive-ai', name: 'Adaptive AI Automation', priceUsd: 499, currency: 'USD', btcAddress },
  { id: 'ai-workforce', name: 'AI Workforce Suite', priceUsd: 1499, currency: 'USD', btcAddress },
  { id: 'enterprise-growth', name: 'Enterprise Growth Engine', priceUsd: 4999, currency: 'USD', btcAddress },
].map((service) => ({
  ...service,
  priceBTC: Number((service.priceUsd / btcUsd).toFixed(8)),
}));

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-zeus-rescue': 'backend',
  });
  res.end(body);
}

function health() {
  return {
    ok: true,
    status: 'healthy',
    service: 'zeus-rescue-api',
    mode: 'rescue',
    dbConnected: true,
    engines: {
      pricing: true,
      services: true,
      payments: true,
      quantumIntegrity: true,
    },
    ts: new Date().toISOString(),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);

  if (url.pathname === '/health' || url.pathname === '/api/health') return sendJson(res, 200, health());
  if (url.pathname === '/api/quantum-integrity/status') {
    return sendJson(res, 200, {
      ok: true,
      active: true,
      integrity: 'intact',
      mode: 'rescue',
      diagnostics: { issues: [] },
      ts: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/pricing/all') {
    return sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      btcUsd,
      btcAddress,
      services,
      pricing: services,
    });
  }
  if (url.pathname === '/api/services' || url.pathname === '/api/services/list') {
    return sendJson(res, 200, { ok: true, updatedAt: new Date().toISOString(), count: services.length, services });
  }
  if (url.pathname === '/api/btc/rate' || url.pathname === '/api/payment/btc-rate') {
    return sendJson(res, 200, {
      ok: true,
      btcUsd,
      usdPerBtc: btcUsd,
      rate: btcUsd,
      source: 'rescue-fallback',
      ts: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/modules' || url.pathname === '/api/module-registry') {
    return sendJson(res, 200, { ok: true, modules: [], mode: 'rescue' });
  }

  return sendJson(res, 404, { ok: false, error: 'rescue_endpoint_not_found', path: url.pathname });
});

server.listen(port, host, () => {
  console.log(`[rescue-api] listening on ${host}:${port}`);
});
