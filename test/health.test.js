const assert = require('assert');
const server = require('../src/index');

async function run() {
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
  assert.ok(siteHtml.includes('ZEUS FACE'));
  assert.ok(siteHtml.includes('ROBOT FACE'));

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  console.log('health test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
