const g = require('/var/www/unicorn/UNICORN_FINAL/backend/modules/deepseek-governor');

(async () => {
  const r = await g.dispatch({
    action: 'run_test',
    params: {},
    requestId: `manual-runtest-${Date.now()}`,
    actor: 'manual',
    ip: '127.0.0.1',
  });

  const b = r.body || {};
  console.log(JSON.stringify({
    ok: b.ok,
    reason: b.reason || null,
    exitCode: b.exitCode || null,
    timeoutMs: b.timeoutMs || null,
    stdoutTail: (b.stdoutTail || '').slice(-500),
    stderrTail: (b.stderrTail || '').slice(-500),
  }));
})();
