// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-13T19:44:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * GITHUB OPS — Orchestrator GitHub Integration
 *
 * Oferă operații GitHub pentru orchestrator:
 *   1. pullLatest(branch)         — git pull origin <branch>
 *   2. createBranch(name, from)   — crează un branch nou
 *   3. createPR(opts)             — deschide un Pull Request via GitHub API
 *   4. mergePR(number, method)    — merge PR via GitHub API
 *   5. triggerWorkflow(id,branch) — declanșează GitHub Actions workflow (CI/teste)
 *   6. getWorkflowRuns(id,limit)  — citește ultimele rulări ale unui workflow
 *   7. rollback(commitSha)        — revert commit + push (sau force-reset)
 *   8. getStatus()                — returnează starea modulului
 *
 * Token: GITHUB_TOKEN (PAT cu scope repo + workflow)
 * Repo:  GITHUB_REPOSITORY (owner/repo) sau GITHUB_REPO_OWNER + GITHUB_REPO_NAME
 */

'use strict';

const path   = require('path');
const crypto = require('crypto');

// Lazy-load simple-git pentru a evita erori dacă pachetul lipseşte
let _git = null;
function getGit() {
  if (_git) return _git;
  try {
    const simpleGit = require('simple-git');
    const rootPath  = path.join(__dirname, '..', '..'); // UNICORN_FINAL root
    _git = simpleGit(rootPath, { binary: 'git' });
    return _git;
  } catch {
    return null;
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────
function getToken()  { return process.env.GITHUB_TOKEN || ''; }
function getOwner()  { return process.env.GITHUB_REPO_OWNER || (getRepo().split('/')[0] || ''); }
function getName()   { return process.env.GITHUB_REPO_NAME  || (getRepo().split('/')[1] || ''); }
function getRepo()   { return process.env.GITHUB_REPOSITORY || ''; }
const DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';
const API_HOST       = 'api.github.com';
const MAX_LOG        = 200;

// ─── State ───────────────────────────────────────────────────────────────────
const _log      = [];
const _ops      = { pull: 0, createPR: 0, mergePR: 0, workflow: 0, rollback: 0, errors: 0 };
const startedAt = new Date().toISOString();

function _addLog(type, msg, extra) {
  const entry = { ts: new Date().toISOString(), type, msg };
  if (extra) entry.extra = typeof extra === 'string' ? extra.slice(0, 300) : extra;
  _log.push(entry);
  if (_log.length > MAX_LOG) _log.shift();
  // Use separate args (not template literal format) to avoid tainted-format-string
  console.log('[GithubOps]', entry.ts, '[' + String(type) + ']', String(msg), extra || '');
}

// ─── GitHub API helper ────────────────────────────────────────────────────────
function githubAPI(method, path, body) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    if (!token) return reject(new Error('GITHUB_TOKEN not configured'));

    const payload = body ? JSON.stringify(body) : null;
    const https   = require('https');
    const opts    = {
      hostname: API_HOST,
      path,
      method,
      headers: {
        'User-Agent':    'unicorn-github-ops/1.0',
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 15000,
    };
    if (payload) {
      opts.headers['Content-Type']   = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            return reject(Object.assign(new Error(`GitHub API ${res.statusCode}: ${json.message || data.slice(0, 100)}`), { statusCode: res.statusCode, json }));
          }
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('GitHub API timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * git pull origin <branch>
 */
async function pullLatest(branch = DEFAULT_BRANCH) {
  const git = getGit();
  if (!git) throw new Error('simple-git not available');
  _addLog('PULL', `pulling origin/${branch}`);
  const token = getToken();
  const owner = getOwner();
  const name  = getName();
  if (token && owner && name) {
    try {
      const remote = `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${name}.git`;
      await git.remote(['set-url', 'origin', remote]);
    } catch { /* ignore */ }
  }
  const result = await git.pull('origin', branch, { '--rebase': 'false' });
  _ops.pull++;
  _addLog('PULL_OK', `pulled ${branch}`, result.summary);
  return result;
}

/**
 * Crează un branch local + push la origin
 */
async function createBranch(branchName, fromBranch = DEFAULT_BRANCH) {
  const git = getGit();
  if (!git) throw new Error('simple-git not available');
  _addLog('CREATE_BRANCH', `${fromBranch} → ${branchName}`);
  await git.checkoutBranch(branchName, `origin/${fromBranch}`);
  await git.push('origin', branchName, { '--set-upstream': null });
  _addLog('CREATE_BRANCH_OK', branchName);
  return { branch: branchName, from: fromBranch };
}

/**
 * Deschide un Pull Request via GitHub API
 * @param {{ title, body, head, base }} opts
 */
async function createPR({ title, body = '', head, base = DEFAULT_BRANCH }) {
  const owner = getOwner();
  const repo  = getName();
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY not configured');
  _addLog('CREATE_PR', `${head} → ${base}: ${title}`);
  const res = await githubAPI('POST', `/repos/${owner}/${repo}/pulls`, { title, body, head, base, draft: false });
  _ops.createPR++;
  _addLog('CREATE_PR_OK', `PR #${res.data.number}`, res.data.html_url);
  return res.data;
}

/**
 * Merge un Pull Request via GitHub API
 */
async function mergePR(number, mergeMethod = 'squash') {
  const owner = getOwner();
  const repo  = getName();
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY not configured');
  _addLog('MERGE_PR', `#${number} method=${mergeMethod}`);
  const res = await githubAPI('PUT', `/repos/${owner}/${repo}/pulls/${number}/merge`, {
    merge_method:   mergeMethod,
    commit_title:   `[Orchestrator] Auto-merge PR #${number}`,
    commit_message: `Merged automatically by Unicorn Orchestrator at ${new Date().toISOString()}`,
  });
  _ops.mergePR++;
  _addLog('MERGE_PR_OK', `#${number} merged`, res.data.sha);
  return res.data;
}

/**
 * Declanșează un GitHub Actions workflow (workflow_dispatch event)
 */
async function triggerWorkflow(workflowId = 'deploy-hetzner.yml', branch = DEFAULT_BRANCH, inputs = {}) {
  const owner = getOwner();
  const repo  = getName();
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY not configured');
  _addLog('TRIGGER_WORKFLOW', `${workflowId} @ ${branch}`);
  await githubAPI('POST', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`, {
    ref: branch,
    inputs,
  });
  _ops.workflow++;
  _addLog('TRIGGER_WORKFLOW_OK', `${workflowId} triggered`);
  return { triggered: true, workflow: workflowId, branch };
}

/**
 * Citește ultimele rulări ale unui workflow
 */
async function getWorkflowRuns(workflowId = 'deploy-hetzner.yml', limit = 5) {
  const owner = getOwner();
  const repo  = getName();
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY not configured');
  const res = await githubAPI('GET', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?per_page=${limit}`);
  return (res.data.workflow_runs || []).map((r) => ({
    id:         r.id,
    status:     r.status,
    conclusion: r.conclusion,
    createdAt:  r.created_at,
    branch:     r.head_branch,
    sha:        r.head_sha,
    url:        r.html_url,
  }));
}

/**
 * Rollback: revert la ultimul commit bun sau la un SHA specific
 * Strategia 1: git revert <sha> --no-edit + push
 * Strategia 2: dacă nu există sha — revine la HEAD~1
 */
async function rollback(commitSha = null, branch = DEFAULT_BRANCH) {
  const git = getGit();
  if (!git) throw new Error('simple-git not available');

  // Actualizăm remote cu token pentru push autentificat
  const token = getToken();
  const owner = getOwner();
  const name  = getName();
  if (token && owner && name) {
    try {
      const remote = `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${name}.git`;
      await git.remote(['set-url', 'origin', remote]);
    } catch { /* ignore */ }
  }

  const targetSha = commitSha || 'HEAD';
  _addLog('ROLLBACK', `reverting ${targetSha} on ${branch}`);
  _ops.rollback++;

  try {
    // Checkout branch şi pull latest
    await git.checkout(branch);
    await git.pull('origin', branch, { '--rebase': 'false' });
    // Revert commit
    await git.revert([targetSha, '--no-edit']);
    // Push rollback commit
    await git.push('origin', branch);
    _addLog('ROLLBACK_OK', `reverted ${targetSha}, pushed to ${branch}`);
    return { ok: true, reverted: targetSha, branch };
  } catch (err) {
    _ops.errors++;
    _addLog('ROLLBACK_ERR', err.message);
    throw err;
  }
}

/**
 * Verifică dacă ultimul workflow run a eşuat şi returnează SHA-ul commit-ului
 */
async function getLastFailedCommit(workflowId = 'deploy-hetzner.yml') {
  const runs = await getWorkflowRuns(workflowId, 3);
  const failed = runs.find((r) => r.conclusion === 'failure');
  return failed || null;
}

/**
 * Returnează starea modulului
 */
function getStatus() {
  return {
    name:       'GithubOps',
    startedAt,
    configured: !!(getToken() && getOwner() && getName()),
    owner:      getOwner() || null,
    repo:       getName()  || null,
    ops:        { ..._ops },
    recentLog:  _log.slice(-20),
  };
}

module.exports = {
  pullLatest,
  createBranch,
  createPR,
  mergePR,
  triggerWorkflow,
  getWorkflowRuns,
  rollback,
  getLastFailedCommit,
  getStatus,
};
