const fs = require('fs');
const path = require('path');
const axios = require('axios');
const simpleGit = require('simple-git');
const dotenv = require('dotenv');

class AutoDeployOrchestrator {
  constructor() {
    this.rootPath = path.join(__dirname, '..', '..', '..');
    this.git = simpleGit(this.rootPath);
    this.loadCredentialEnvFiles();
  }

  loadCredentialEnvFiles() {
    const envCandidates = [
      path.join(this.rootPath, '.env'),
      path.join(this.rootPath, '.env.auto-connector'),
      path.join(this.rootPath, '..', '.env'),
      path.join(this.rootPath, '..', '.env.auto-connector')
    ];

    for (const filePath of envCandidates) {
      if (fs.existsSync(filePath)) {
        dotenv.config({ path: filePath, override: false });
      }
    }
  }

  getRepositoryUrl() {
    if (process.env.GIT_REMOTE_URL) return process.env.GIT_REMOTE_URL;
    if (process.env.GITHUB_OWNER && (process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO)) {
      const repoName = process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO;
      if (repoName && !repoName.startsWith('http')) {
        return `https://github.com/${process.env.GITHUB_OWNER}/${repoName}.git`;
      }
    }
    return '';
  }

  getAuthenticatedRemoteUrl() {
    const remoteUrl = this.getRepositoryUrl();
    const token = process.env.GITHUB_TOKEN || '';

    if (!remoteUrl || !token) return remoteUrl;
    if (!remoteUrl.includes('github.com') || remoteUrl.includes('@')) return remoteUrl;

    return remoteUrl.replace('https://', `https://x-access-token:${encodeURIComponent(token)}@`);
  }

  async ensureRepo() {
    const remoteUrl = this.getAuthenticatedRemoteUrl();

    const alreadyRepo = await this.git.checkIsRepo().catch(() => false);
    if (!alreadyRepo) {
      await this.git.init();
      if (remoteUrl) {
        await this.git.addRemote('origin', remoteUrl);
      }
      return;
    }

    if (remoteUrl) {
      try {
        await this.git.remote(['set-url', 'origin', remoteUrl]);
      } catch {}
    }
  }

  async triggerVercel() {
    if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID) {
      return { success: false, reason: 'missing_vercel_credentials' };
    }

    const response = await axios.post('https://api.vercel.com/v1/deployments', {
      name: process.env.VERCEL_PROJECT || 'unicorn-final',
      projectId: process.env.VERCEL_PROJECT_ID,
      target: 'production'
    }, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return { success: true, deploymentId: response.data.id };
  }

  async triggerHetznerWebhook() {
    if (!process.env.HETZNER_WEBHOOK_URL) {
      return { success: false, reason: 'missing_hetzner_webhook' };
    }

    const response = await axios.post(process.env.HETZNER_WEBHOOK_URL, {
      repo: this.getRepositoryUrl(),
      branch: process.env.GIT_BRANCH || 'main',
      secret: process.env.HETZNER_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || ''
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return { success: true, status: response.status };
  }

  async runFullDeploy() {
    await this.ensureRepo();

    const result = {
      ok: true,
      repo: this.getRepositoryUrl(),
      vercel: null,
      hetzner: null
    };

    if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
      result.vercel = await this.triggerVercel();
    }

    if (process.env.HETZNER_WEBHOOK_URL) {
      result.hetzner = await this.triggerHetznerWebhook();
    }

    return result;
  }

  async run() {
    return this.runFullDeploy();
  }
}

module.exports = new AutoDeployOrchestrator();
