const g = require('/var/www/unicorn/UNICORN_FINAL/backend/modules/deepseek-governor');

(async () => {
  const ts = Date.now();
  const run = (action, params, suffix) => g.dispatch({
    action,
    params,
    requestId: `cycle-${suffix}-${ts}`,
    actor: 'manual-cycle',
    ip: '127.0.0.1',
  });

  const analyze = await run('analyze_logs', { path: '/var/log/deepseek-loop.log', maxLines: 600 }, 'analyze');
  const runTest = await run('run_test', {}, 'test');
  const deploy = await run('deploy', { target: 'hetzner-main' }, 'deploy');
  const rollbackGuard = await run('rollback_deploy', { confirm: false }, 'rollback-guard');

  const out = {
    analyze: analyze.body ? { ok: analyze.body.ok, counters: analyze.body.counters || null } : null,
    runTest: runTest.body ? { ok: runTest.body.ok, exitCode: runTest.body.exitCode || null, reason: runTest.body.reason || null } : null,
    deploy: deploy.body ? { ok: deploy.body.ok, note: deploy.body.note || null } : null,
    rollbackGuard: rollbackGuard.body ? { ok: rollbackGuard.body.ok, reason: rollbackGuard.body.reason || null } : null,
  };

  console.log(JSON.stringify(out));
})();
