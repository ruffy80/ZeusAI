const g = require('/var/www/unicorn/UNICORN_FINAL/backend/modules/deepseek-governor');

(async () => {
  const repo = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || 'ruffy80/ZeusAI';
  const ts = Date.now();
  const read = await g.dispatch({ action: 'github_read_repo', params: { repo, path: '' }, requestId: `diag-read-${ts}`, actor: 'diag', ip: '127.0.0.1' });
  const branchMain = await g.dispatch({ action: 'github_create_branch', params: { repo, branch: `diag-main-${ts}`, from: 'main' }, requestId: `diag-main-${ts}`, actor: 'diag', ip: '127.0.0.1' });
  const branchMaster = await g.dispatch({ action: 'github_create_branch', params: { repo, branch: `diag-master-${ts}`, from: 'master' }, requestId: `diag-master-${ts}`, actor: 'diag', ip: '127.0.0.1' });

  const out = {
    repo,
    read: read.body,
    branchMain: branchMain.body,
    branchMaster: branchMaster.body,
  };
  console.log(JSON.stringify(out));
})();
