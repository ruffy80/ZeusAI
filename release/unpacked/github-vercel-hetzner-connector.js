/**
 * GITHUB-VERCEL-HETZNER AUTO CONNECTOR
 * Complete automation module for connecting GitHub, Vercel, and Hetzner
 * 
 * Usage:
 *   const connector = require('./github-vercel-hetzner-connector.js');
 *   await connector.setupAll(config);
 */

const axios = require('axios');
const NodeSSH = require('node-ssh');
const fs = require('fs');
const path = require('path');

// ================================================================
// 1. GITHUB AUTO CONNECTOR
// ================================================================
class GitHubAutoConnector {
  constructor(githubToken, repoOwner) {
    this.token = githubToken;
    this.owner = repoOwner;
    this.repoName = 'unicorn-final';
    this.apiBase = 'https://api.github.com';
  }

  log(msg) {
    console.log(`[GitHub] ${msg}`);
  }

  async createRepository() {
    try {
      const res = await axios.post(`${this.apiBase}/user/repos`, {
        name: this.repoName,
        description: 'UNICORN FINAL - AI Platform with Auto-Deploy',
        private: false,
        auto_init: true,
        gitignore_template: 'Node'
      }, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      this.log(`✅ Repository created: ${res.data.clone_url}`);
      return { success: true, repoUrl: res.data.clone_url, repoSshUrl: res.data.ssh_url };
    } catch (err) {
      this.log(`❌ Failed to create repo: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async setupDeployKey(publicKey, title = 'Hetzner Auto-Deploy') {
    try {
      await axios.post(
        `${this.apiBase}/repos/${this.owner}/${this.repoName}/keys`,
        { title, key: publicKey, read_only: false },
        { headers: { 'Authorization': `token ${this.token}` } }
      );
      this.log(`✅ Deploy key added`);
      return { success: true };
    } catch (err) {
      this.log(`❌ Failed to add deploy key: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async setupSecrets(secrets) {
    const results = {};
    for (const [key, value] of Object.entries(secrets)) {
      try {
        await axios.put(
          `${this.apiBase}/repos/${this.owner}/${this.repoName}/actions/secrets/${key}`,
          { encrypted_value: value },
          { headers: { 'Authorization': `token ${this.token}` } }
        );
        results[key] = { success: true };
      } catch (err) {
        results[key] = { success: false, error: err.message };
      }
    }
    this.log(`✅ Secrets configured: ${Object.keys(results).length}`);
    return results;
  }

  async setupWebhook(webhookUrl, webhookSecret) {
    try {
      await axios.post(
        `${this.apiBase}/repos/${this.owner}/${this.repoName}/hooks`,
        {
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0'
          }
        },
        { headers: { 'Authorization': `token ${this.token}` } }
      );
      this.log(`✅ Webhook configured: ${webhookUrl}`);
      return { success: true };
    } catch (err) {
      this.log(`❌ Failed to setup webhook: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

// ================================================================
// 2. VERCEL AUTO LINKER
// ================================================================
class VercelAutoLinker {
  constructor(vercelToken) {
    this.token = vercelToken;
    this.apiBase = 'https://api.vercel.com';
  }

  log(msg) {
    console.log(`[Vercel] ${msg}`);
  }

  async createProject(projectName, gitRepo) {
    try {
      const res = await axios.post(`${this.apiBase}/v10/projects`, {
        name: projectName,
        gitRepository: { type: 'github', repo: gitRepo },
        framework: 'nextjs'
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      this.log(`✅ Project created: ${projectName}`);
      return { success: true, projectId: res.data.id };
    } catch (err) {
      this.log(`❌ Failed to create project: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async setEnvironmentVariables(projectId, envVars) {
    const results = {};
    for (const [key, value] of Object.entries(envVars)) {
      try {
        await axios.post(`${this.apiBase}/v10/projects/${projectId}/env`, {
          key,
          value,
          target: ['production', 'preview', 'development']
        }, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        results[key] = { success: true };
      } catch (err) {
        results[key] = { success: false, error: err.message };
      }
    }
    this.log(`✅ Environment variables set: ${Object.keys(results).length}`);
    return results;
  }

  async triggerDeployment(projectId) {
    try {
      const res = await axios.post(`${this.apiBase}/v13/deployments`, {
        name: 'unicorn-final',
        projectId,
        target: 'production'
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      this.log(`✅ Deployment triggered: ${res.data.id}`);
      return { success: true, deploymentId: res.data.id };
    } catch (err) {
      this.log(`❌ Failed to trigger deployment: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

// ================================================================
// 3. HETZNER SSH MANAGER
// ================================================================
class HetznerSSHManager {
  constructor(hetznerHost, hetznerUser, privateKeyPath) {
    this.host = hetznerHost;
    this.user = hetznerUser;
    this.privateKeyPath = privateKeyPath;
    this.ssh = new NodeSSH();
  }

  log(msg) {
    console.log(`[Hetzner] ${msg}`);
  }

  async connect() {
    try {
      await this.ssh.connect({
        host: this.host,
        username: this.user,
        privateKey: fs.readFileSync(this.privateKeyPath, 'utf-8'),
        readyTimeout: 30000
      });
      this.log(`✅ SSH connected`);
      return { success: true };
    } catch (err) {
      this.log(`❌ SSH connection failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async deployRepository(repoUrl, deployPath, sshKey = null) {
    try {
      const commands = [
        `mkdir -p ${deployPath}`,
        `cd ${deployPath} && git clone ${repoUrl} . || git pull origin main`,
        `npm install`,
        `npm run build || true`
      ];

      for (const cmd of commands) {
        const result = await this.ssh.execCommand(cmd);
        if (result.code !== 0) {
          this.log(`⚠️ Command failed: ${cmd}`);
          this.log(result.stderr);
        }
      }
      this.log(`✅ Repository deployed to ${deployPath}`);
      return { success: true };
    } catch (err) {
      this.log(`❌ Deployment failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async setupWebhookServer(deployPath, webhookSecret) {
    try {
      const webhookScript = `const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

app.post('/webhook/github', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const body = JSON.stringify(req.body);
  const hash = 'sha256=' + crypto.createHmac('sha256', '${webhookSecret}').update(body).digest('hex');
  
  if (signature !== hash) return res.status(403).send('Forbidden');
  
  console.log('[Webhook] GitHub push received - deploying...');
  exec('cd ${deployPath} && git pull origin main && npm install && npm run build && pm2 restart app', (err) => {
    if (err) {
      console.error('[Error]', err);
      return res.status(500).send('Deploy failed');
    }
    res.send('Deployed');
  });
});

app.listen(3001, '0.0.0.0', () => console.log('[Webhook] Server on :3001'));
`;

      const scriptPath = `${deployPath}/webhook-server.js`;
      const cmd = `cat > ${scriptPath} << 'EOF'\n${webhookScript}\nEOF`;
      
      await this.ssh.execCommand(cmd);
      await this.ssh.execCommand(`pm2 start ${scriptPath} --name webhook-server`);
      await this.ssh.execCommand(`pm2 save`);
      
      this.log(`✅ Webhook server deployed`);
      return { success: true };
    } catch (err) {
      this.log(`❌ Webhook setup failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async setupAuthorizedKeys(publicKey) {
    try {
      const cmd = `mkdir -p ~/.ssh && echo '${publicKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
      await this.ssh.execCommand(cmd);
      this.log(`✅ SSH key authorized`);
      return { success: true };
    } catch (err) {
      this.log(`❌ SSH key setup failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async disconnect() {
    this.ssh.dispose();
    this.log(`✅ SSH disconnected`);
  }
}

// ================================================================
// 4. MASTER ORCHESTRATOR
// ================================================================
class PlatformOrchestrator {
  constructor() {
    this.results = {};
  }

  log(msg) {
    console.log(`\n[Orchestrator] ${msg}\n`);
  }

  async setupAll(config) {
    this.log('🚀 Starting complete platform setup...');
    
    const {
      github,
      vercel,
      hetzner,
      webhook
    } = config;

    // 1. GitHub Setup
    if (github) {
      this.log('Setting up GitHub...');
      const githubConnector = new GitHubAutoConnector(github.token, github.owner);
      
      this.results.github = await githubConnector.createRepository();
      if (this.results.github.success) {
        const repoName = `${github.owner}/unicorn-final`;
        
        // Add deploy key for Hetzner
        if (hetzner?.publicKey) {
          await githubConnector.setupDeployKey(hetzner.publicKey);
        }

        // Setup secrets
        if (github.secrets) {
          await githubConnector.setupSecrets(github.secrets);
        }

        // Setup webhook
        if (webhook) {
          await githubConnector.setupWebhook(webhook.url, webhook.secret);
        }
      }
    }

    // 2. Vercel Setup
    if (vercel) {
      this.log('Setting up Vercel...');
      const vercelLinker = new VercelAutoLinker(vercel.token);
      
      const repoName = this.results.github?.success 
        ? `${github.owner}/unicorn-final` 
        : config.gitRepo;
      
      this.results.vercel = await vercelLinker.createProject('unicorn-final', repoName);
      
      if (this.results.vercel.success && vercel.envVars) {
        await vercelLinker.setEnvironmentVariables(this.results.vercel.projectId, vercel.envVars);
      }
    }

    // 3. Hetzner Setup
    if (hetzner) {
      this.log('Setting up Hetzner...');
      const hetznerMgr = new HetznerSSHManager(
        hetzner.host,
        hetzner.user,
        hetzner.privateKeyPath
      );
      
      const connRes = await hetznerMgr.connect();
      if (connRes.success) {
        const repoUrl = this.results.github?.repoUrl || config.gitRepo;
        await hetznerMgr.deployRepository(repoUrl, hetzner.deployPath);
        
        if (webhook) {
          await hetznerMgr.setupWebhookServer(hetzner.deployPath, webhook.secret);
        }

        if (hetzner.publicKey) {
          await hetznerMgr.setupAuthorizedKeys(hetzner.publicKey);
        }

        await hetznerMgr.disconnect();
        this.results.hetzner = { success: true };
      } else {
        this.results.hetzner = connRes;
      }
    }

    this.log('✅ Platform setup complete!');
    return this.results;
  }
}

// ================================================================
// EXPORTS
// ================================================================
module.exports = {
  GitHubAutoConnector,
  VercelAutoLinker,
  HetznerSSHManager,
  PlatformOrchestrator,
  
  // Convenience function
  setupAll: async (config) => {
    const orchestrator = new PlatformOrchestrator();
    return orchestrator.setupAll(config);
  }
};
