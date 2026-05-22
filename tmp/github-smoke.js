const g = require('/var/www/unicorn/UNICORN_FINAL/backend/modules/deepseek-governor');

(async () => {
  const ts = Date.now();
  const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || 'ruffy80/ZeusAI';
  const branch = `deepseek-smoke-${ts}`;
  const testPath = `deepseek-smoke/${ts}.txt`;

  const call = (action, params, suffix) => g.dispatch({
    action,
    params,
    requestId: `smoke-${suffix}-${ts}`,
    actor: 'manual-smoke',
    ip: '127.0.0.1',
  });

  const read = await call('github_read_repo', { repo, path: 'README.md' }, 'read');
  const branchCreate = await call('github_create_branch', { repo, branch, from: 'main' }, 'branch');
  const commitPush = await call('github_commit_push', {
    repo,
    branch,
    path: testPath,
    content: `smoke ${new Date().toISOString()}`,
    message: `DeepSeek smoke ${ts}`,
  }, 'commit');
  const createPr = await call('github_create_pr', {
    repo,
    head: branch,
    base: 'main',
    title: `DeepSeek smoke ${ts}`,
    body: 'Automated smoke test PR',
  }, 'pr');

  const summary = {
    repo,
    branch,
    testPath,
    read: read && read.body ? { ok: read.body.ok, reason: read.body.reason || null } : null,
    branchCreate: branchCreate && branchCreate.body ? { ok: branchCreate.body.ok, reason: branchCreate.body.reason || null } : null,
    commitPush: commitPush && commitPush.body ? { ok: commitPush.body.ok, reason: commitPush.body.reason || null } : null,
    createPr: createPr && createPr.body ? {
      ok: createPr.body.ok,
      reason: createPr.body.reason || null,
      number: createPr.body.number || null,
      url: createPr.body.htmlUrl || null,
    } : null,
  };

  console.log(JSON.stringify(summary));
})();
