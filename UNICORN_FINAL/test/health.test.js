process.env.NODE_ENV = 'test';
process.env.UNICORN_RUNTIME_PROFILE = process.env.UNICORN_RUNTIME_PROFILE || 'stable';
process.env.DISABLE_SELF_MUTATION = process.env.DISABLE_SELF_MUTATION || '1';

const assert = require('assert');
const { createServer } = require('../src/index');

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  const response = await fetch('http://127.0.0.1:' + port + '/health');
  const body = await response.json();
  const innovationResponse = await fetch('http://127.0.0.1:' + port + '/innovation');
  const innovationBody = await innovationResponse.json();
  const sprintResponse = await fetch('http://127.0.0.1:' + port + '/innovation/sprint');
  const sprintBody = await sprintResponse.json();
  const modulesResponse = await fetch('http://127.0.0.1:' + port + '/modules');
  const modulesBody = await modulesResponse.json();
  const snapshotResponse = await fetch('http://127.0.0.1:' + port + '/snapshot');
  const snapshotBody = await snapshotResponse.json();
  const streamResponse = await fetch('http://127.0.0.1:' + port + '/stream');
  const siteResponse = await fetch('http://127.0.0.1:' + port + '/');
  const siteHtml = await siteResponse.text();

  // ── Autoviralization: site worker must answer the admin Viral tab even
  // when the backend is unreachable (BACKEND_API_URL unset → fallback mock).
  const viralAutonomousRes = await fetch('http://127.0.0.1:' + port + '/api/autonomous/viral/status');
  const viralAutonomousBody = await viralAutonomousRes.json();
  const viralSocialRes = await fetch('http://127.0.0.1:' + port + '/api/viral/status');
  const viralSocialBody = await viralSocialRes.json();
  const viralTriggerRes = await fetch('http://127.0.0.1:' + port + '/api/autonomous/viral/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const viralTriggerBody = await viralTriggerRes.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(innovationResponse.status, 200);
  assert.ok(Array.isArray(innovationBody.backlog));
  assert.ok(innovationBody.backlog.length > 0);
  assert.equal(sprintResponse.status, 200);
  assert.ok(Array.isArray(sprintBody.tasks));
  assert.ok(sprintBody.tasks.length >= 3);
  assert.equal(modulesResponse.status, 200);
  assert.ok(Array.isArray(modulesBody.modules));
  assert.ok(modulesBody.modules.length >= 4);
  assert.equal(snapshotResponse.status, 200);
  assert.ok(Array.isArray(snapshotBody.modules));
  assert.ok(snapshotBody.sprint.tasks.length >= 3);
  assert.equal(streamResponse.status, 200);
  assert.ok((streamResponse.headers.get('content-type') || '').includes('text/event-stream'));
  if (streamResponse.body) {
    await streamResponse.body.cancel();
  }
  assert.equal(siteResponse.status, 200);
  assert.ok(siteHtml.includes('ZEUS'));
  assert.ok(siteHtml.includes('zeusai.pro'));

  // Autoviralization endpoints respond on the site worker (proxy → backend
  // with shape-preserving fallback mock when BACKEND_API_URL is unset).
  assert.equal(viralAutonomousRes.status, 200);
  assert.ok(viralAutonomousBody && viralAutonomousBody.metrics, 'autonomous viral status must return metrics');
  assert.ok('viralScore' in viralAutonomousBody.metrics, 'metrics must include viralScore');
  assert.ok('estimatedReach' in viralAutonomousBody.metrics, 'metrics must include estimatedReach');
  assert.equal(viralSocialRes.status, 200);
  assert.ok(viralSocialBody && 'totalPosts' in viralSocialBody, 'viral status must include totalPosts');
  assert.equal(viralTriggerRes.status, 200);
  assert.ok(viralTriggerBody && typeof viralTriggerBody === 'object', 'viral trigger must return JSON');

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  console.log('health test passed');
}

run().then(() => {
  // Force-exit after success: src/index.js loads many production modules
  // (predictive-scaler, orchestrators, watchers...) that legitimately keep
  // long-lived handles in real runtime. Without an explicit exit the test
  // process never returns, GitHub Actions cancels after ~6h, and the
  // deploy step never runs.
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
