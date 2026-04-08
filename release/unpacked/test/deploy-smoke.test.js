const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'dotenv') {
    return { config: () => ({}) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const axios = require('axios');
const httpCalls = [];
axios.post = async (url, payload, options) => {
  httpCalls.push({ url, payload, headers: options?.headers || null });
  if (url.includes('vercel.com')) {
    return { status: 200, data: { id: 'mock-vercel-deploy-123' } };
  }
  return { status: 202, data: { ok: true } };
};

process.env.GITHUB_TOKEN = 'ghp_test_token_123';
process.env.GIT_REMOTE_URL = 'https://github.com/ruffy80/ZeusAI.git';
process.env.GIT_BRANCH = 'main';
process.env.VERCEL_TOKEN = 'vcp_test_token_456';
process.env.VERCEL_PROJECT_ID = 'prj_test_789';
process.env.VERCEL_PROJECT = 'zeusaisynexai';
process.env.HETZNER_WEBHOOK_URL = 'https://mock-hetzner.example/webhook/update';
process.env.HETZNER_WEBHOOK_SECRET = 'mock-secret';

const autoDeploy = require('../backend/modules/autoDeploy');
const orchestrator = require('../src/modules/auto-deploy-orchestrator');

const gitCalls = [];
orchestrator.git.init = async () => { gitCalls.push(['init']); };
orchestrator.git.addRemote = async (name, url) => { gitCalls.push(['addRemote', name, url]); };
orchestrator.git.remote = async (args) => { gitCalls.push(['remote', ...args]); };

async function run() {
  const remoteUrl = autoDeploy.getAuthenticatedRemoteUrl();
  const deployResult = await orchestrator.runFullDeploy();

  assert.equal(remoteUrl, 'https://x-access-token:ghp_test_token_123@github.com/ruffy80/ZeusAI.git');
  assert.equal(deployResult.ok, true);
  assert.equal(deployResult.repo, 'https://github.com/ruffy80/ZeusAI.git');
  assert.equal(deployResult.vercel?.success, true);
  assert.equal(deployResult.vercel?.deploymentId, 'mock-vercel-deploy-123');
  assert.equal(deployResult.hetzner?.success, true);
  assert.equal(deployResult.hetzner?.status, 202);
  assert.ok(gitCalls.some((entry) => entry[0] === 'addRemote' || entry[0] === 'remote'));
  assert.equal(httpCalls.length, 2);
  assert.equal(httpCalls[0].url, 'https://api.vercel.com/v1/deployments');
  assert.equal(httpCalls[0].payload.name, 'zeusaisynexai');
  assert.equal(httpCalls[0].payload.projectId, 'prj_test_789');
  assert.equal(httpCalls[1].url, 'https://mock-hetzner.example/webhook/update');
  assert.equal(httpCalls[1].payload.repo, 'https://github.com/ruffy80/ZeusAI.git');
  assert.equal(httpCalls[1].payload.branch, 'main');
  assert.equal(httpCalls[1].payload.secret, 'mock-secret');

  console.log('deploy smoke test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
