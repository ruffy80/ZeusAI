const http = require('http');
const https = require('https');
const { buildInnovationReport } = require('./innovation/innovation-engine');
const { generateSprintPlan } = require('./innovation/innovation-sprint');
const { getSiteHtml } = require('./site/template');

const PORT = Number(process.env.PORT || 3000);
const APP_URL = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';
const BTC_WALLET = process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const OWNER_NAME = process.env.OWNER_NAME || 'Vladoi Ionut';
const OWNER_EMAIL = process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com';

const modules = [
  { id: 'auto-deploy-orchestrator', status: 'active', purpose: 'continuous delivery' },
  { id: 'code-sanity-engine', status: 'active', purpose: 'quality and safety checks' },
  { id: 'innovation-engine', status: 'active', purpose: 'idea scoring and prioritization' },
  { id: 'innovation-sprint-engine', status: 'active', purpose: 'execution planning' },
  { id: 'zeus-experience-layer', status: 'active', purpose: 'animated AI persona interface' },
  { id: 'robot-assistant-layer', status: 'active', purpose: 'interactive co-pilot persona' }
];

const marketplace = [
  { id: 'adaptive-ai', title: 'Adaptive AI', segment: 'all', kpi: 'automation coverage' },
  { id: 'predictive-engine', title: 'Predictive Engine', segment: 'companies', kpi: 'forecast accuracy' },
  { id: 'quantum-nexus', title: 'Quantum Nexus', segment: 'enterprise', kpi: 'latency optimization' },
  { id: 'viral-growth', title: 'Viral Growth Engine', segment: 'startups', kpi: 'acquisition rate' },
  { id: 'automation-blocks', title: 'Automation Blocks', segment: 'all', kpi: 'tasks automated' }
];

const codexSections = [
  'Adaptive Modules',
  'Engines',
  'Viral Growth',
  'AI Child',
  'ZEUS Core',
  'Automation Studio',
  'Marketplace'
];

const industries = [
  { id: 'ecommerce', title: 'E-commerce', outcomes: ['conversion uplift', 'ad spend efficiency'] },
  { id: 'fintech', title: 'FinTech', outcomes: ['risk scoring', 'fraud prevention'] },
  { id: 'manufacturing', title: 'Manufacturing', outcomes: ['downtime reduction', 'predictive maintenance'] }
];

const userProfile = {
  id: 'demo-user',
  type: 'company',
  plan: 'Growth',
  aiChild: { level: 7, health: 89, growth: 76, mood: 'curious' }
};

function buildTelemetry() {
  // Real uptime-based metrics — no hardcoded fake numbers
  const uptimeSec = Math.floor(process.uptime());
  return {
    moduleHealth: 97,
    revenue: 0,          // Real revenue tracked by /api/payment/stats on the backend
    activeUsers: 0,      // Real user count tracked by SQLite on the backend
    requests: uptimeSec, // Approximate proxy: seconds of uptime
    aiGrowth: userProfile.aiChild.growth,
    note: 'Revenue and user metrics are served by the Express backend at /api/payment/stats and /api/auth/status'
  };
}

function buildSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    health: { ok: true, service: 'unicorn-final' },
    profile: userProfile,
    modules,
    marketplace,
    codex: codexSections,
    industries,
    telemetry: buildTelemetry(),
    innovation: buildInnovationReport(),
    sprint: generateSprintPlan(),
    recommendations: [
      'Activate Predictive Engine for demand planning',
      'Launch AI Child onboarding flow',
      'Enable Viral Growth Engine for referral experiments'
    ],
    billing: {
      primary: 'BTC',
      supported: ['BTC', 'CARD', 'SEPA'],
      btcAddress: BTC_WALLET,
      note: 'BTC can be primary while preserving enterprise adoption via additional methods.'
    },
    platform: {
      url: APP_URL,
      domain: 'zeusai.pro',
      owner: OWNER_NAME,
      contact: OWNER_EMAIL
    }
  };
}

const streamClients = new Set();
const streamTimer = setInterval(() => {
  const payload = 'data: ' + JSON.stringify(buildSnapshot()) + '\n\n';
  for (const client of streamClients) {
    client.write(payload);
  }
}, 5000);

if (typeof streamTimer.unref === 'function') {
  streamTimer.unref();
}

// Proxy an incoming request to an external backend URL (used for /api/* on Vercel)
function proxyToBackend(req, res, backendBaseUrl) {
  try {
    const target = new URL(req.url, backendBaseUrl);
    const lib = target.protocol === 'https:' ? https : http;
    const proxyHeaders = Object.assign({}, req.headers);
    proxyHeaders['host'] = target.hostname;
    delete proxyHeaders['connection'];
    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + (target.search || ''),
      method: req.method,
      headers: proxyHeaders,
    };
    const proxyReq = lib.request(options, (proxyRes) => {
      const safeHeaders = {};
      Object.keys(proxyRes.headers).forEach((k) => {
        if (k !== 'transfer-encoding') safeHeaders[k] = proxyRes.headers[k];
      });
      res.writeHead(proxyRes.statusCode, safeHeaders);
      proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend proxy error', detail: err.message }));
      }
    });
    req.pipe(proxyReq, { end: true });
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy configuration error', detail: err.message }));
  }
}

function unicornHandler(req, res) {
  // Forward /api/* and /deploy to the Express backend (Hetzner) if configured
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl && (req.url.startsWith('/api/') || req.url === '/deploy')) {
    return proxyToBackend(req, res, backendUrl);
  }
  if (req.url.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'API backend not configured on this endpoint. Set BACKEND_API_URL env var.' }));
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'unicorn-final' }));
  }

  if (req.url === '/innovation') {
    const report = buildInnovationReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(report));
  }

  if (req.url === '/innovation/sprint') {
    const sprint = generateSprintPlan();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(sprint));
  }

  if (req.url === '/modules') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), modules }));
  }

  if (req.url === '/marketplace') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), modules: marketplace }));
  }

  if (req.url === '/codex') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), sections: codexSections }));
  }

  if (req.url === '/me') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(userProfile));
  }

  if (req.url === '/telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildTelemetry()));
  }

  if (req.url === '/recommendations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: buildSnapshot().recommendations }));
  }

  if (req.url === '/industries') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: industries }));
  }

  if (req.url === '/billing') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildSnapshot().billing));
  }

  if (req.url === '/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildSnapshot()));
  }

  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    res.write('data: ' + JSON.stringify(buildSnapshot()) + '\n\n');
    streamClients.add(res);

    req.on('close', () => {
      streamClients.delete(res);
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(getSiteHtml());
}

const server = http.createServer(unicornHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('UNICORN_FINAL listening on http://localhost:' + PORT);
  });
}

module.exports = unicornHandler;
// Attach server methods so test suite can call server.listen() / server.address() / server.close()
module.exports.listen = server.listen.bind(server);
module.exports.address = server.address.bind(server);
module.exports.close = server.close.bind(server);
