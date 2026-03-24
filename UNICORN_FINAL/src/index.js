const http = require('http');
const { buildInnovationReport } = require('./innovation/innovation-engine');
const { generateSprintPlan } = require('./innovation/innovation-sprint');
const { getSiteHtml } = require('./site/template');

const PORT = Number(process.env.PORT || 3000);

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
  name: 'ZEUS Operator',
  email: 'demo@unicorn.ai',
  type: 'company',
  plan: 'Growth',
  aiChild: { level: 7, health: 89, growth: 76, mood: 'curious' }
};

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        raw = '{}';
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function buildGlobalImpact() {
  const impactPillars = [
    { id: 'healthcare', title: 'Healthcare Augmentation', score: 92, goal2030: 'faster triage and prevention' },
    { id: 'education', title: 'Education Access', score: 90, goal2030: 'adaptive AI tutoring at scale' },
    { id: 'climate', title: 'Climate Efficiency', score: 87, goal2030: 'lower energy and waste footprint' },
    { id: 'inclusion', title: 'Digital Inclusion', score: 89, goal2030: 'multilingual-first product access' }
  ];

  const avgScore = Math.round(impactPillars.reduce((sum, item) => sum + item.score, 0) / impactPillars.length);
  const resilienceIndex = Math.round(avgScore * 0.6 + userProfile.aiChild.health * 0.2 + userProfile.aiChild.growth * 0.2);

  return {
    updatedAt: new Date().toISOString(),
    mission: 'Build useful, ethical, and resilient AI capabilities for people, companies, and industries.',
    horizonYears: 30,
    resilienceIndex,
    carbonAwareMode: true,
    multilingualCoverage: ['en', 'ro', 'es', 'fr', 'de', 'zh', 'ja'],
    pillars: impactPillars,
    nextMilestones: [
      'Launch accessibility-by-default UX checks in every release',
      'Enable low-energy execution mode for high-traffic workloads',
      'Continuously track social value KPIs alongside revenue KPIs'
    ]
  };
}

function buildTelemetry() {
  return {
    moduleHealth: 97,
    revenue: 24840,
    activeUsers: 1320,
    requests: 98544,
    aiGrowth: userProfile.aiChild.growth
  };
}

function buildTrends() {
  return [
    'Adopt AI copilots for repetitive workflows in all teams',
    'Shift toward carbon-aware workload scheduling',
    'Expand multilingual onboarding for global adoption'
  ];
}

function computeOptimalPrice(service, segment) {
  const basePrices = {
    'AI Consulting': 149,
    'API Access': 79,
    'Custom Module Development': 399
  };
  const base = basePrices[service] || 99;
  const multiplier = segment === 'enterprise' ? 1.35 : segment === 'startup' ? 0.85 : 1;
  return Math.round(base * multiplier * 100) / 100;
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
    impact: buildGlobalImpact(),
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
      note: 'BTC can be primary while preserving enterprise adoption via additional methods.'
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

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), service: 'unicorn-final' }));
  }

  if (req.url === '/api/modules') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ modules: modules.map((m) => m.id), details: modules }));
  }

  if (req.url === '/api/trends/analyze') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ trends: buildTrends() }));
  }

  if (req.url === '/api/pricing/optimize' && req.method === 'POST') {
    const payload = await readJsonBody(req);
    const service = payload?.clientData?.service;
    const segment = payload?.clientData?.segment;
    const optimalPrice = computeOptimalPrice(service, segment);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ optimalPrice, currency: 'USD' }));
  }

  if (req.url === '/api/generate-site' && req.method === 'POST') {
    const payload = await readJsonBody(req);
    const topic = (payload.topic || 'business').toString().trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    const id = Date.now().toString(36);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ path: '/landing/' + topic + '-' + id + '.html' }));
  }

  if (req.url === '/api/auth/login' && req.method === 'POST') {
    const payload = await readJsonBody(req);
    const email = payload.email || userProfile.email;
    const name = email.split('@')[0] || userProfile.name;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ token: 'demo-token-' + Date.now(), user: { id: userProfile.id, name, email } }));
  }

  if (req.url === '/api/auth/register' && req.method === 'POST') {
    const payload = await readJsonBody(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ token: 'demo-token-' + Date.now(), user: { id: 'user-' + Date.now(), name: payload.name || 'New User', email: payload.email || 'new@unicorn.ai' } }));
  }

  if (req.url === '/api/uaic/ask' && req.method === 'POST') {
    const payload = await readJsonBody(req);
    const prompt = (payload.prompt || '').toString().trim();
    const answer = prompt
      ? 'ZEUS suggests: prioritize outcomes, automate repeatable tasks, and measure impact weekly. Prompt: ' + prompt
      : 'ZEUS suggests: start with one workflow, automate it, then scale safely.';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ result: answer }));
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

  if (req.url === '/impact') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildGlobalImpact()));
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

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getSiteHtml());
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'Not found' }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('UNICORN_FINAL listening on http://localhost:' + PORT);
  });
}

module.exports = server;
