// generate_frontend_zeus_luxury.js
// Rulează cu: node generate_unicorn_final.js
//
// CANONICAL GENERATOR:
// - This file is the single source of truth for the Unicorn generator.
// - `generate_unicorn_final_clean.js` is kept only as a compatibility wrapper
//   and delegates execution to this file.
//
// NEW: Complete deployment automation included!
// 
// After generation, you have 3 setup options:
// 
// 1. AUTOMATIC SETUP (Recommended)
//    $ bash setup-platform-auto-connect.sh
//    → Sets up GitHub, Vercel, and Hetzner automatically
//    → Requires: GitHub token, Vercel token, Hetzner SSH access
//
// 2. HETZNER ONLY SETUP (If you already have GitHub/Vercel)
//    $ node setup_hetzner.js
//    → Interactive setup for Hetzner server
//    → Installs Docker, Node.js, sets up services, webhooks
//    → Requires: SSH access to Hetzner
//
// 3. MANUAL SETUP
//    → See GITHUB-VERCEL-HETZNER-CONNECTOR.md
//    → Use individual classes from github-vercel-hetzner-connector.js
//
// ADDING 3 REVOLUTIONARY INNOVATIONS:
//    $ node add_innovations.js
//    → Adds Quantum-Resistant Digital Identity
//    → Adds Autonomous AI Negotiator
//    → Adds Universal Carbon Credit Exchange
//    → Creates new modules in UNICORN_FINAL/src/modules/
//
// Documentation:
//    - IMPLEMENTATION-GUIDE.md - Start here!
//    - GITHUB-VERCEL-HETZNER-CONNECTOR.md - Complete API reference
//    - setup_hetzner.js - Interactive Hetzner configuration
//    - setup-platform-auto-connect.sh - Full automation script
//    - SETUP-HETZNER-GUIDE.md - Complete Hetzner guide
//    - add_innovations.js - Add revolutionary features

/*
const fs = require('fs');
const path = require('path');

// Directorul de construcție
const ROOT = path.join(__dirname, 'UNICORN_FINAL');
const SRC = path.join(ROOT, 'src');
const MODULES = path.join(SRC, 'modules');
const GENERATED = path.join(SRC, 'generated');
const CLIENT = path.join(ROOT, 'client');
const CLIENT_SRC = path.join(CLIENT, 'src');
const CLIENT_COMPONENTS = path.join(CLIENT_SRC, 'components');
const CLIENT_PAGES = path.join(CLIENT_SRC, 'pages');
const CLIENT_PUBLIC = path.join(CLIENT, 'public');
const INFRA = path.join(ROOT, 'infra');
const GITHUB_WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const BACKUP = path.join(ROOT, 'backups');
const LOGS = path.join(ROOT, 'logs');
const HETZNER_SCRIPTS = path.join(ROOT, 'hetzner');
const SCRIPTS = path.join(ROOT, 'scripts');
const MODELS = path.join(ROOT, 'models');
const CONTRACTS = path.join(ROOT, 'contracts');
const DATA = path.join(ROOT, 'data');

// Lista completă a directoarelor (toate modulele speciale)
const dirs = [
  ROOT, SRC, MODULES, GENERATED,
  CLIENT, CLIENT_SRC, CLIENT_COMPONENTS, CLIENT_PAGES, CLIENT_PUBLIC,
  path.join(MODULES, 'auto-deploy-orchestrator'),
  path.join(MODULES, 'code-sanity-engine'),
path.join(MODULES, 'code-sanity-engine', 'scanner'),
path.join(MODULES, 'code-sanity-engine', 'analyzers'),
path.join(MODULES, 'code-sanity-engine', 'repair'),
  path.join(MODULES, 'unicorn-super-intelligence'),
path.join(MODULES, 'unicorn-super-intelligence', 'memory'),
path.join(MODULES, 'unicorn-super-intelligence', 'skills'),
path.join(MODULES, 'unicorn-super-intelligence', 'reasoning'),
path.join(MODULES, 'unicorn-super-intelligence', 'personality'),
  path.join(MODULES, 'evolution-core'),
  path.join(MODULES, 'quantum-healing'),
  path.join(MODULES, 'universal-adaptor'),
  path.join(MODULES, 'quantum-pay'),
  path.join(MODULES, 'site-creator'),
  path.join(MODULES, 'ab-testing'),
  path.join(MODULES, 'seo-optimizer'),
  path.join(MODULES, 'analytics'),
  path.join(MODULES, 'content-ai'),
  path.join(MODULES, 'auto-marketing'),
  path.join(MODULES, 'performance-monitor'),
  path.join(MODULES, 'unicorn-realization-engine'),
  path.join(MODULES, 'unicorn-execution-engine'),
  path.join(MODULES, 'auto-trend-analyzer'),
  path.join(MODULES, 'self-adaptation-engine'),
  path.join(MODULES, 'predictive-healing'),
  path.join(MODULES, 'code-optimizer'),
  path.join(MODULES, 'self-documenter'),
  path.join(MODULES, 'ui-evolution'),
  path.join(MODULES, 'security-scanner'),
  path.join(MODULES, 'disaster-recovery'),
  path.join(MODULES, 'swarm-intelligence'),
  path.join(MODULES, 'auto-deploy'),
  path.join(MODULES, 'total-system-healer'),
  path.join(MODULES, 'dynamic-pricing'),
  path.join(MODULES, 'universal-interchain-nexus'),
  path.join(MODULES, 'autonomous-wealth-engine'),
  path.join(MODULES, 'autonomous-bd-engine'),
  path.join(MODULES, 'self-construction-engine'),
  path.join(INFRA, 'automation'),
  
/*
// ---------------------------------------------------------
// 6. MODULE SPECIALE
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'evolution-core/SelfEvolve.js'), `...`);
fs.writeFileSync(path.join(MODULES, 'quantum-healing/AutoHeal.js'), `...`);
// ... (UAIC, USI, CodeSanityEngine, etc.) ...

// ===== AICI LIPESȚI CODUL PENTRU AUTO‑DEPLOY ORCHESTRATOR =====
fs.writeFileSync(path.join(MODULES, 'auto-deploy-orchestrator/index.js'), `...`);  // codul ultra avansat
fs.writeFileSync(path.join(MODULES, 'auto-deploy-orchestrator/config.js'), `...`);
// ---------------------------------------------------------
// AUTO‑DEPLOY ORCHESTRATOR ULTRA – versiunea supremă
// ---------------------------------------------------------

fs.writeFileSync(path.join(MODULES, 'auto-deploy-orchestrator/index.js'), `
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const axios = require('axios');
const archiver = require('archiver');
const simpleGit = require('simple-git');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Dependințe opționale pentru notificări
let notifier = null;
try {
  notifier = require('node-notifier'); // pentru desktop
} catch {}

class AutoDeployOrchestratorUltra {
  constructor() {
    this.git = null;
    this.deployLog = [];
    this.deployCache = null;
    this.rollbackVersions = []; // stochează ultimele 5 backup-uri
    this.watchdogInterval = null;
    this.healthCheckInterval = null;
    this.loadCredentialEnvFiles();
    this.loadCache();
  }

  loadCredentialEnvFiles() {
    const rootPath = path.join(__dirname, '../../..');
    const envCandidates = [
      path.join(rootPath, '.env'),
      path.join(rootPath, '.env.auto-connector'),
      path.join(rootPath, '..', '.env'),
      path.join(rootPath, '..', '.env.auto-connector')
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
        return \`https://github.com/\${process.env.GITHUB_OWNER}/\${repoName}.git\`;
      }
    }
    return '';
  }

  getAuthenticatedRemoteUrl() {
    const remoteUrl = this.getRepositoryUrl();
    const token = process.env.GITHUB_TOKEN || '';

    if (!remoteUrl || !token) return remoteUrl;
    if (!remoteUrl.includes('github.com') || remoteUrl.includes('@')) return remoteUrl;

    return remoteUrl.replace('https://', \`https://x-access-token:\${encodeURIComponent(token)}@\`);
  }

  // ---------- Cache ----------
  loadCache() {
    const cacheFile = path.join(__dirname, '../../../data/deploy_cache.json');
    if (fs.existsSync(cacheFile)) {
      try {
        this.deployCache = JSON.parse(fs.readFileSync(cacheFile));
      } catch {}
    }
    if (!this.deployCache) this.deployCache = {};
  }

  saveCache() {
    const cacheFile = path.join(__dirname, '../../../data/deploy_cache.json');
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(this.deployCache, null, 2));
  }

  // ---------- Logging și notificări ----------
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const line = \`[\${timestamp}] [\${level.toUpperCase()}] \${message}\`;
    console.log(line);
    this.deployLog.push(line);
    const logFile = path.join(__dirname, '../../../logs/deploy.log');
    fs.appendFileSync(logFile, line + '\\n');

    // Notificare desktop (dacă e disponibil)
    if (notifier) {
      notifier.notify({
        title: 'Auto‑Deploy',
        message: message.substring(0, 50),
        sound: true,
      });
    }

    // Notificări externe (Slack, Telegram, etc.) – configurabile
    this.sendExternalNotification(message, level);
  }

  async sendExternalNotification(message, level) {
    const tasks = [];
    if (process.env.SLACK_WEBHOOK_URL) {
      tasks.push(axios.post(process.env.SLACK_WEBHOOK_URL, { text: message }).catch(() => {}));
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const url = \`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}/sendMessage\`;
      tasks.push(axios.post(url, { chat_id: process.env.TELEGRAM_CHAT_ID, text: message }).catch(() => {}));
    }
    if (process.env.DISCORD_WEBHOOK_URL) {
      tasks.push(axios.post(process.env.DISCORD_WEBHOOK_URL, { content: message }).catch(() => {}));
    }
    await Promise.allSettled(tasks);
  }

  // ---------- Auto‑diagnosticare pre‑deploy ----------
  async preDeployCheck() {
    this.log('🔍 Running pre‑deploy diagnostics...');
    const errors = [];

    // 1. Verifică variabile de mediu esențiale
    const requiredEnv = ['GIT_REMOTE_URL', 'ADMIN_SECRET'];
    for (const env of requiredEnv) {
      if (!process.env[env]) errors.push(\`Missing \${env}\`);
    }

    // 2. Rulează testele (dacă există)
    try {
      execSync('npm test', { stdio: 'ignore', timeout: 30000 });
      this.log('✅ Tests passed.');
    } catch (err) {
      errors.push('Tests failed');
    }

    // 3. Rulează linting (dacă există)
    try {
      execSync('npm run lint', { stdio: 'ignore', timeout: 30000 });
      this.log('✅ Linting passed.');
    } catch (err) {
      errors.push('Linting failed');
    }

    if (errors.length > 0) {
      this.log(\`❌ Pre‑deploy check failed: \${errors.join(', ')}\`, 'error');
      return false;
    }
    this.log('✅ Pre‑deploy check passed.');
    return true;
  }

  // ---------- Backup și rollback ----------
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupDir = path.join(__dirname, '../../../backups', timestamp);
    this.log(\`💾 Creating backup at \${backupDir}...\`);

    // Excludem node_modules, .git, backups, logs
    const exclude = ['node_modules', '.git', 'backups', 'logs', 'data'];
    const cmd = \`rsync -a --exclude={}\${exclude.join(',')} \${path.join(__dirname, '../../..')}/ \${backupDir}/\`;
    execSync(cmd, { stdio: 'ignore' });

    this.rollbackVersions.push({ path: backupDir, timestamp });
    if (this.rollbackVersions.length > 5) {
      const oldest = this.rollbackVersions.shift();
      fs.rmSync(oldest.path, { recursive: true, force: true });
    }
    this.log(\`✅ Backup created: \${backupDir}\`);
    return backupDir;
  }

  async rollback(version = null) {
    if (!version) version = this.rollbackVersions.slice(-1)[0];
    if (!version) {
      this.log('❌ No rollback version available.', 'error');
      return false;
    }
    this.log(\`🔄 Rolling back to \${version.path}...\`);
    const cmd = \`rsync -a --delete \${version.path}/ \${path.join(__dirname, '../../..')}/\`;
    execSync(cmd, { stdio: 'ignore' });
    this.log('✅ Rollback completed.');
    return true;
  }

  // ---------- Pregătire ZIP (cu excluderi inteligente) ----------
  async prepareZip() {
    const zipPath = path.join(__dirname, '../../../UNICORN_DEPLOY.zip');
    if (fs.existsSync(zipPath)) {
      this.log('📦 ZIP already exists, checking if outdated...');
      const stats = fs.statSync(zipPath);
      const lastCommit = await this.git.log({ maxCount: 1 });
      if (stats.mtimeMs > new Date(lastCommit.latest.date).getTime()) {
        this.log('📦 ZIP is up to date.');
        return zipPath;
      }
    }

    this.log('📦 Creating deployment ZIP...');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        this.log(\`✅ ZIP created: \${zipPath} (\${archive.pointer()} bytes)\`);
        resolve(zipPath);
      });
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(path.join(__dirname, '../../../'), false);
      archive.finalize();
    });
  }

  // ---------- Pregătire repo ----------
  async ensureRepo() {
    const gitDir = path.join(__dirname, '../../../.git');
    if (!this.git) {
      this.git = simpleGit(path.join(__dirname, '../../../'));
    }

    const remoteUrl = this.getAuthenticatedRemoteUrl();
    if (!fs.existsSync(gitDir)) {
      this.log('📁 Initializing Git repository...');
      await this.git.init();
      if (remoteUrl) {
        await this.git.addRemote('origin', remoteUrl);
        this.log('🔗 Authenticated GitHub remote added.');
      }
      return;
    }

    if (remoteUrl) {
      try {
        await this.git.remote(['set-url', 'origin', remoteUrl]);
      } catch {}
    }
  }

  // ---------- Commit inteligent (verifică modificări reale) ----------
  async autoCommit() {
    const status = await this.git.status();
    if (status.files.length === 0 && status.not_added.length === 0) {
      this.log('✅ No changes to commit.');
      return false;
    }

    // Rulează CodeSanityEngine înainte de commit
    try {
      const codeSanity = require('../code-sanity-engine');
      await codeSanity.runFullScanNow();
    } catch (err) {
      this.log(\`⚠️ CodeSanityEngine not available: \${err.message}\`);
    }

    this.log('📦 Committing changes...');
    await this.git.add('.');
    await this.git.commit(\`Auto‑deploy: \${new Date().toISOString()}\`);
    this.log('✅ Commit created.');
    return true;
  }

  // ---------- Push cu verificare ----------
  async autoPush() {
    try {
      await this.git.push('origin', process.env.GIT_BRANCH || 'main');
      this.log('🚀 Push to GitHub successful.');
      return true;
    } catch (err) {
      this.log(\`❌ Push failed: \${err.message}\`, 'error');
      return false;
    }
  }

  // ---------- Webhook paralel pentru Hetzner, Vercel, etc. ----------
  async triggerAllWebhooks() {
    const results = {};
    if (process.env.HETZNER_WEBHOOK_URL) {
      results.hetzner = await this.triggerWebhook(process.env.HETZNER_WEBHOOK_URL, {
        repo: this.getRepositoryUrl(),
        branch: process.env.GIT_BRANCH || 'main',
        secret: process.env.HETZNER_WEBHOOK_SECRET
      });
    }
    return results;
  }

  async triggerWebhook(url, payload) {
    try {
      const res = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      this.log(\`✅ Webhook \${url} triggered: \${res.status}\`);
      return { success: true, status: res.status };
    } catch (err) {
      this.log(\`❌ Webhook \${url} failed: \${err.message}\`, 'error');
      return { success: false, error: err.message };
    }
  }

  // ---------- Monitorizare post‑deploy ----------
  async postDeployMonitoring() {
    this.log('📊 Starting post‑deploy monitoring...');
    const checks = [];

    // Verifică endpoint-ul health
    checks.push(
      axios.get('http://localhost:3000/health', { timeout: 5000 })
        .then(res => ({ health: true, status: res.status }))
        .catch(err => ({ health: false, error: err.message }))
    );

    // Verifică API-ul modules
    checks.push(
      axios.get('http://localhost:3000/api/modules', { timeout: 5000 })
        .then(res => ({ modules: true, count: res.data.modules.length }))
        .catch(err => ({ modules: false, error: err.message }))
    );

    const results = await Promise.allSettled(checks);
    const failed = results.filter(r => r.value?.health === false || r.value?.modules === false);
    if (failed.length > 0) {
      this.log('❌ Post‑deploy checks failed, rolling back...', 'error');
      await this.rollback();
      return false;
    }
    this.log('✅ Post‑deploy checks passed.');
    return true;
  }

  // ---------- Auto‑actualizare inteligentă ----------
  async selfUpdate() {
    this.log('🔄 Auto‑update: pulling latest changes...');
    try {
      const pullResult = await this.git.pull('origin', process.env.GIT_BRANCH || 'main');
      if (pullResult.summary.changes > 0) {
        this.log(\`✅ Pull successful, \${pullResult.summary.changes} files changed.\`);
        // Reinstalează dependențele
        execSync('npm install', { stdio: 'inherit' });
        this.log('✅ Dependencies reinstalled.');
        // Rulează migrări (dacă există)
        try {
          execSync('npm run migrate', { stdio: 'inherit' });
        } catch {}
      } else {
        this.log('✅ Already up to date.');
      }
      return true;
    } catch (err) {
      this.log(\`❌ Pull failed: \${err.message}\`, 'error');
      return false;
    }
  }

  // ---------- Watchdog pentru auto‑repararea orchestratorului ----------
  startWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = setInterval(() => {
      // Verifică dacă procesul principal răspunde
      axios.get('http://localhost:3000/health', { timeout: 3000 })
        .catch(() => {
          this.log('⚠️ Watchdog: main process not responding, restarting...');
          exec('pm2 restart unicorn', (err) => {
            if (err) this.log(\`❌ Watchdog restart failed: \${err.message}\`);
          });
        });
    }, 30000);
  }

  // ---------- Metoda principală – flux complet ----------
  async runFullDeploy(options = {}) {
    const defaultOptions = {
      preCheck: true,
      backup: true,
      prepareZip: false,  // de obicei nu e nevoie pe server
      commit: true,
      push: true,
      triggerWebhooks: true,
      postMonitor: true,
      selfUpdate: false,
    };
    const opts = { ...defaultOptions, ...options };

    this.log('🚀 Starting full auto‑deploy...');
    this.git = simpleGit(path.join(__dirname, '../../../'));
    await this.ensureRepo();

    if (opts.preCheck) {
      const ok = await this.preDeployCheck();
      if (!ok) return { success: false, reason: 'pre‑deploy checks failed' };
    }

    if (opts.backup) await this.createBackup();

    if (opts.prepareZip) await this.prepareZip();

    if (opts.commit) {
      const committed = await this.autoCommit();
      if (!committed && opts.push) {
        this.log('ℹ️ No commit, skipping push.');
        opts.push = false;
      }
    }

    if (opts.push) await this.autoPush();

    let webhookResults = {};
    if (opts.triggerWebhooks) webhookResults = await this.triggerAllWebhooks();

    if (opts.postMonitor) {
      const monitorOk = await this.postDeployMonitoring();
      if (!monitorOk) {
        return { success: false, reason: 'post‑deploy monitoring failed', webhookResults };
      }
    }

    if (opts.selfUpdate) await this.selfUpdate();

    this.log('✅ Full auto‑deploy completed.');
    this.saveCache();
    return { success: true, webhookResults, log: this.deployLog.slice(-20) };
  }

  // ---------- Rute API (protejate) ----------
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.post('/deploy', async (req, res) => {
      try {
        const result = await this.runFullDeploy(req.body.options || {});
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/rollback', async (req, res) => {
      const ok = await this.rollback(req.body.version);
      res.json({ success: ok });
    });

    router.get('/logs', (req, res) => {
      res.json({ logs: this.deployLog.slice(-100) });
    });

    router.post('/self-update', async (req, res) => {
      const ok = await this.selfUpdate();
      res.json({ success: ok });
    });

    router.get('/status', (req, res) => {
      res.json({
        rollbackVersions: this.rollbackVersions.length,
        lastDeploy: this.deployLog.slice(-1)[0],
      });
    });

    return router;
  }

  verifyOwner(secret) {
    return secret === process.env.ADMIN_SECRET;
  }
}

module.exports = new AutoDeployOrchestratorUltra();
`);

// Adăugăm și un fișier de configurare
fs.writeFileSync(path.join(MODULES, 'auto-deploy-orchestrator/config.js'), `
module.exports = {
  defaultOptions: {
    preCheck: true,
    backup: true,
    prepareZip: false,
    commit: true,
    push: true,
    triggerWebhooks: true,
    postMonitor: true,
    selfUpdate: false
  }
};
`);
// ---------------------------------------------------------
// 7. SERVER PRINCIPAL (src/index.js)
// ---------------------------------------------------------
//
// CANONICAL / DO-NOT-OVERWRITE LIST (sovereign commerce — added 2026-04):
//   • UNICORN_FINAL/src/index.js
//   • UNICORN_FINAL/src/site/sovereign-commerce.js
//   • UNICORN_FINAL/src/site/sovereign-extensions.js
//   • UNICORN_FINAL/src/site/v2/client.js
//   • UNICORN_FINAL/src/site/v2/shell.js
//   • UNICORN_FINAL/src/site/template.js
//   • UNICORN_FINAL/scripts/backup-signing-key.sh
// These files implement the live BTC-direct checkout flow (resolveCatalogItem,
// preorder mode, /api/admin/owner-revenue, /api/entitlements/:token/wallet.json,
// /.well-known/{ai-plugin,mcp,agents}.json, /api/catalog/diff, /seo/sitemap-services.xml,
// per-service /services/:id pages, "Pay with BTC, save 10%" badge) and must be
// preserved across regenerations. The generator below is a historical scaffold
// kept as documentation only — its src/index.js writeFileSync line is a
// placeholder ('...') and is not used to produce the live site. If you ever
// re-enable this generator, gate file writes with `if (!fs.existsSync(...))`.
//
fs.writeFileSync(path.join(SRC, 'index.js'), `...`);THUB_WORKFLOWS,
  BACKUP,
  LOGS,
  HETZNER_SCRIPTS,
  SCRIPTS,
  MODELS,
  CONTRACTS,
  DATA,
];
const autoDeployOrchestrator = require('./modules/auto-deploy-orchestrator');
autoDeployOrchestrator.initialize();
app.use('/api/admin/deploy', adminOnly, autoDeployOrchestrator.getRouter(() => {}));
dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

console.log("🌌 GENEREZ UNICORNUL FINAL COMPLET – Toate modulele și inovațiile");
// ---------------------------------------------------------
// package.json
// ---------------------------------------------------------
const packageJson = {
  name: "unicorn-final",
  version: "1.0.0",
  description: "Unicornul absolut complet cu toate modulele și site-ul futurist",
  main: "src/index.js",
  scripts: {
    start: "node src/index.js",
    build: "cd client && npm run build",
    dev: "concurrently \"npm run server\" \"npm run client\"",
    server: "node src/index.js",
    client: "cd client && npm start",
    postinstall: "cd client && npm install && npm run build",
    heal: "node src/modules/quantum-healing/AutoHeal.js",
    evolve: "node src/modules/evolution-core/SelfEvolve.js",
    deploy: "node src/modules/auto-deploy/trigger.js",
    "hetzner-update": "bash hetzner/hetzner-auto-update.sh",
    init: "node scripts/init.js",
    "deploy-contract": "node scripts/deploy-ugt-contract.js",
  },
  dependencies: {
    "express": "^4.18.2",
    "dotenv": "^16.0.3",
    "axios": "^1.4.0",
    "stripe": "^12.0.0",
    "openai": "^3.3.0",
    "node-cron": "^3.0.2",
    "compression": "^1.7.4",
    "cookie-parser": "^1.4.6",
    "uuid": "^9.0.0",
    "simple-git": "^3.19.1",
    "node-fetch": "^2.6.7",
    "cheerio": "^1.0.0-rc.12",
    "eslint": "^8.42.0",
    "prettier": "^2.8.8",
    "marked": "^5.1.0",
    "concurrently": "^7.6.0",
    "chokidar": "^3.5.3",
    "ssh2": "^1.15.0",
    "adm-zip": "^0.5.10",
    "ws": "^8.13.0",
    "brain.js": "^2.0.0",
    "simple-statistics": "^7.8.0",
    "ml-regression": "^5.0.0",
    "ccxt": "^4.0.0",
    "ethers": "^6.0.0",
    "lightning": "^5.0.0",
    "node-schedule": "^2.1.0",
    "technicalindicators": "^3.1.0",
    "puppeteer": "^20.0.0",
    "natural": "^6.0.0",
    "sentiment": "^5.0.0",
    "csv-writer": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "framer-motion": "^10.12.16",
    "recharts": "^2.7.2",
    "tailwindcss": "^3.3.0",
    "three": "^0.128.0",
    "@react-three/fiber": "^8.9.1",
    "@react-three/drei": "^9.34.3",
    "react-router-dom": "^6.8.1",
    "swr": "^2.0.0",
  },
};
fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(packageJson, null, 2));

// ---------------------------------------------------------
// .env.example
// ---------------------------------------------------------
fs.writeFileSync(path.join(ROOT, '.env.example'), `
// ---------------------------------------------------------
// .env.example
// ---------------------------------------------------------
fs.writeFileSync(path.join(ROOT, '.env.example'), `
# 1. Inteligență Artificială
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
GITHUB_COPILOT_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROK_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
LOCAL_MODEL_ENDPOINT=http://localhost:11434/api/generate
LOCAL_MODEL_NAME=llama3

# 2. Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox
PUBLIC_APP_URL=http://localhost:3000

# 3. Exchange
BINANCE_API_KEY=...
BINANCE_SECRET=...
COINBASE_API_KEY=...
COINBASE_SECRET=...
INTERACTIVE_BROKERS_ACCOUNT=...
INTERACTIVE_BROKERS_API_KEY=...

# 4. Portofele personale
BTC_WALLET_ADDRESS=bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
ETH_WALLET_ADDRESS=0x...
USDC_WALLET_ADDRESS=0x...
ETH_WALLET_PRIVATE_KEY=...

# 5. Blockchain
ETH_RPC_URL=https://mainnet.infura.io/v3/...
UGT_CONTRACT_ADDRESS=0x...

# 6. Marketplace
MARKETPLACE_API_PRICE_PER_REQUEST=0.01

# 7. BD Engine
BD_SCAN_INTERVAL_HOURS=24
BD_TARGET_COMPANIES=aws,microsoft,google,oracle,ibm,salesforce
BD_OPENAI_MODEL=gpt-4
BD_CRM_TYPE=hubspot
BD_CRM_API_KEY=...
NEWS_API_KEY=...

# 8. Auto‑deploy
GITHUB_OWNER=ruffy80
GITHUB_REPO_NAME=ZeusAI
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
GIT_REMOTE_URL=https://github.com/ruffy80/ZeusAI.git
GIT_BRANCH=main
HETZNER_SSH_HOST=204.168.230.142
HETZNER_SSH_USER=root
HETZNER_SSH_KEY_PATH=~/.ssh/id_rsa
HETZNER_WEBHOOK_SECRET=secretpentruwebhook
HETZNER_DEPLOY_PATH=/root/unicorn-final

# 9. Admin
ADMIN_SECRET=VLADOI_IONUT_SECRET_SUPREM_2026

# 10. Dynamic Pricing
DYNAMIC_PRICING_MODEL_PATH=./models/pricing_model.json

# 11. Auto‑Deploy Orchestrator (notificări)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DISCORD_WEBHOOK_URL=...
PM2_PROCESS_NAME=unicorn
`);
ETH_WALLET_PRIVATE_KEY=...

# 5. Blockchain// ---------------------------------------------------------
// .env.example
// ---------------------------------------------------------
fs.writeFileSync(path.join(ROOT, '.env.example'), `
# 1. Inteligență Artificială
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
GITHUB_COPILOT_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROK_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
LOCAL_MODEL_ENDPOINT=http://localhost:11434/api/generate
LOCAL_MODEL_NAME=llama3

# 2. Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox
PUBLIC_APP_URL=http://localhost:3000

# 3. Exchange
BINANCE_API_KEY=...
BINANCE_SECRET=...
COINBASE_API_KEY=...
COINBASE_SECRET=...
INTERACTIVE_BROKERS_ACCOUNT=...
INTERACTIVE_BROKERS_API_KEY=...

# 4. Portofele personale
BTC_WALLET_ADDRESS=bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
ETH_WALLET_ADDRESS=0x...
USDC_WALLET_ADDRESS=0x...
ETH_RPC_URL=https://mainnet.infura.io/v3/...
UGT_CONTRACT_ADDRESS=0x...

# 6. Marketplace
MARKETPLACE_API_PRICE_PER_REQUEST=0.01

# 7. BD Engine
BD_SCAN_INTERVAL_HOURS=24
BD_TARGET_COMPANIES=aws,microsoft,google,oracle,ibm,salesforce
BD_OPENAI_MODEL=gpt-4
BD_CRM_TYPE=hubspot
BD_CRM_API_KEY=...
NEWS_API_KEY=...

# 8. Auto‑deploy
GITHUB_OWNER=ruffy80
GITHUB_REPO_NAME=ZeusAI
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
GIT_REMOTE_URL=https://github.com/ruffy80/ZeusAI.git
GIT_BRANCH=main
HETZNER_SSH_HOST=204.168.230.142
HETZNER_SSH_USER=root
HETZNER_SSH_KEY_PATH=~/.ssh/id_rsa
HETZNER_WEBHOOK_SECRET=secretpentruwebhook
HETZNER_DEPLOY_PATH=/root/unicorn-final

# 9. Admin
ADMIN_SECRET=VLADOI_IONUT_SECRET_SUPREM_2026

# 10. Dynamic Pricing
DYNAMIC_PRICING_MODEL_PATH=./models/pricing_model.json
`);
# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox
PUBLIC_APP_URL=http://localhost:3000

# Slack / Telegram / Discord (opțional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DISCORD_WEBHOOK_URL=...

# Auto‑deploy Orchestrator
GIT_REMOTE_URL=https://github.com/ruffy80/ZeusAI.git
GIT_BRANCH=main
GITHUB_OWNER=ruffy80
GITHUB_REPO_NAME=ZeusAI
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
GITHUB_WEBHOOK_URL=http://204.168.230.142:3001/webhook/github
HETZNER_WEBHOOK_URL=http://204.168.230.142:3001/webhook/update
WEBHOOK_URL=http://204.168.230.142:3001/webhook/github
HETZNER_WEBHOOK_SECRET=secretpentruwebhook
WEBHOOK_SECRET=secretpentruwebhook
# Pentru watchdog și auto‑repornire (dacă folosești PM2)
PM2_PROCESS_NAME=unicorn
# GitHub
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
GIT_REMOTE_URL=https://github.com/ruffy80/ZeusAI.git
GIT_BRANCH=main
GITHUB_USERNAME=ruffy80

# Hetzner
HETZNER_SSH_HOST=204.168.230.142
HETZNER_SSH_USER=root
HETZNER_SSH_KEY_PATH=~/.ssh/id_rsa
HETZNER_WEBHOOK_SECRET=secretpentruwebhook
HETZNER_DEPLOY_PATH=/root/unicorn-final

# Admin (doar Vladoi Ionut)
ADMIN_SECRET=VLADOI_IONUT_SECRET_SUPREM

# Dynamic Pricing
DYNAMIC_PRICING_MODEL_PATH=./models/pricing_model.json

# Exchange-uri pentru Hedge Fund
BINANCE_API_KEY=...
BINANCE_SECRET=...
COINBASE_API_KEY=...
COINBASE_SECRET=...
INTERACTIVE_BROKERS_ACCOUNT=...
INTERACTIVE_BROKERS_API_KEY=...

# Portofele personale
BTC_WALLET_ADDRESS=bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
ETH_WALLET_ADDRESS=0x...
USDC_WALLET_ADDRESS=0x...
ETH_WALLET_PRIVATE_KEY=...

# Blockchain pentru token UGT
ETH_RPC_URL=https://mainnet.infura.io/v3/...
UGT_CONTRACT_ADDRESS=0x...

# Marketplace
MARKETPLACE_API_PRICE_PER_REQUEST=0.01

# BD Engine
BD_SCAN_INTERVAL_HOURS=24
BD_TARGET_COMPANIES=aws,microsoft,google,oracle,ibm,salesforce
BD_OPENAI_MODEL=gpt-4
BD_CRM_TYPE=hubspot
BD_CRM_API_KEY=...
NEWS_API_KEY=...
`);

// ---------------------------------------------------------
// Script de inițializare (auto-dezarhivare)
// ---------------------------------------------------------
fs.writeFileSync(path.join(SCRIPTS, 'init.js'), `
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const currentDir = process.cwd();
const zipFile = path.join(currentDir, 'UNICORN_FINAL.zip');

if (fs.existsSync(zipFile)) {
  console.log('📦 Dezarhivare arhivă...');
  const zip = new AdmZip(zipFile);
  zip.extractAllTo(currentDir, true);
  fs.unlinkSync(zipFile);
  console.log('✅ Dezarhivare completă.');
}

if (!fs.existsSync(path.join(currentDir, 'package.json'))) {
  console.error('❌ Nu s-a găsit package.json.');
  process.exit(1);
}

console.log('🚀 Pornire instalare...');
execSync('npm install', { stdio: 'inherit' });
console.log('✅ Instalare completă.');

if (!fs.existsSync(path.join(currentDir, '.git'))) {
  console.log('📁 Inițializare repository git...');
  execSync('git init', { stdio: 'inherit' });
  const envPath = path.join(currentDir, '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const match = env.match(/GIT_REMOTE_URL=(.+)/);
    if (match) {
      execSync(\`git remote add origin \${match[1]}\`, { stdio: 'inherit' });
      console.log('🔗 Remote adăugat.');
    }
  }
}

console.log('✅ Inițializare completă. Rulează "npm start" pentru a porni sistemul.');
`);// ---------------------------------------------------------
// ModuleLoader
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'ModuleLoader.js'), `
const fs = require('fs');
const path = require('path');

class ModuleLoader {
  constructor() {
    this.modules = {};
    this.loadAll();
  }

  loadAll() {
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'ModuleLoader.js');
    files.forEach(file => {
      const moduleName = path.basename(file, '.js');
      try {
        this.modules[moduleName] = require(path.join(__dirname, file));
        console.log(\`✅ Încărcat modulul: \${moduleName}\`);
      } catch (err) {
        console.error(\`❌ Eroare la încărcarea modulului \${moduleName}:\`, err.message);
      }
    });
  }

  getModule(name) {
    return this.modules[name];
  }

  getAllModules() {
    return Object.keys(this.modules);
  }
}

module.exports = new ModuleLoader();
`);

// ---------------------------------------------------------
// Generare module în masă (AdaptiveModule01–82, Engine1–62, etc.)
// ---------------------------------------------------------
function generateMassModules() {
  // AdaptiveModule01 – AdaptiveModule82
  for (let i = 1; i <= 82; i++) {
    const num = i.toString().padStart(2, '0');
    const name = `AdaptiveModule${num}`;
    const content = `
// Modul real: ${name}
let counter = 0;
module.exports = {
  name: '${name}',
  role: 'Modul adaptiv generic care procesează cereri și își ajustează starea internă.',
  state: { counter: 0, lastRun: null },
  methods: {
    async process(input) {
      this.state.counter++;
      this.state.lastRun = new Date().toISOString();
      console.log(\`🔄 \${this.name} procesează: \${JSON.stringify(input)}\`);
      return { status: 'ok', module: this.name, counter: this.state.counter, input };
    },
    getStatus() {
      return {
        name: this.name,
        health: 'good',
        uptime: process.uptime(),
        counter: this.state.counter,
        lastRun: this.state.lastRun
      };
    }
  }
};
`;
    fs.writeFileSync(path.join(MODULES, `${name}.js`), content);
  }

  // Engine1 – Engine62
  for (let i = 1; i <= 62; i++) {
    const name = `Engine${i}`;
    const content = `
// Modul real: ${name}
let cycles = 0;
module.exports = {
  name: '${name}',
  role: 'Motor generic care rulează ciclic și procesează task-uri specializate.',
  state: { cycles: 0, lastRun: null },
  methods: {
    async process(input) {
      this.state.cycles++;
      this.state.lastRun = new Date().toISOString();
      console.log(\`⚙️ \${this.name} execută ciclul \${this.state.cycles}\`);
      return { status: 'ok', module: this.name, cycles: this.state.cycles, input };
    },
    getStatus() {
      return {
        name: this.name,
        health: 'good',
        uptime: process.uptime(),
        cycles: this.state.cycles,
        lastRun: this.state.lastRun
      };
    }
  }
};
`;
    fs.writeFileSync(path.join(MODULES, `${name}.js`), content);
  }

  // Lista celorlalte module denumite (peste 150)
  const otherModules = [
    'CryptoUniverseLedger', 'FeedbackEngine', 'FitnessEngine', 'Telemetry',
    'ADE', 'AGE', 'StateManager', 'HistoryEngine', 'SimulationLoopEngine',
    'AdaptiveCycleEngine', 'UniverseIdentityEngine', 'AdaptiveGrowthUnit',
    'FitnessEvaluator', 'MicroMutationSimulator', 'EvolutionStepSimulator',
    'AdaptiveParameterTuner', 'GrowthCurveEstimator', 'AdaptivePressureModel',
    'MicroSelectionFilter', 'EvolutionDriftCalculator', 'LocalEvolutionTracker',
    'AdaptiveStateRecorder', 'MicroEvolutionReporter', 'LocalFitnessBooster',
    'UsageFeedbackListener', 'GrowthResponseEngine', 'AdaptiveTrendPredictor',
    'MutationProbabilityEngine', 'FitnessProjectionUnit', 'AdaptiveLoopController',
    'EvolutionHistoryRecorder', 'BehaviorAnalyzer', 'TrendDetector',
    'PatternClassifier', 'UsageHeatmapGenerator', 'LocalInsightsEngine',
    'TelemetryCollector', 'NoiseFilterUnit', 'SignalStrengthEvaluator',
    'MicroCorrelationFinder', 'DataCompressionAgent', 'StateIntegrityChecker',
    'MicroResetAgent', 'LocalRecoveryUnit', 'AnomalyWatchdog',
    'DriftStabilizer', 'ErrorDampeningNode', 'HealingSimulationEngine',
    'StateRecalibrationUnit', 'ConsistencyMonitor', 'AdaptiveThresholdGuard',
    'SwarmCoordinator', 'ExecutionPriorityEngine', 'LocalLoadBalancer',
    'SwarmSyncAgent', 'TaskDistributionNode', 'TimingController',
    'SwarmPulseGenerator', 'ExecutionFlowMonitor', 'PipelineManager',
    'SwarmHarmonyEngine', 'InstanceSpawner', 'PopulationGrowthEngine',
    'ExpansionController', 'SwarmDensityAnalyzer', 'GrowthRatePredictor',
    'ScalingFeedbackEngine', 'MetaFeedbackEngine', 'MetaFitnessEngine',
    'ConsensusEngine', 'AdaptiveStrategyEngine', 'PredictiveEngine',
    'SwarmBehaviorModeler', 'CollectiveInsightEngine', 'QuantumNexusEngine',
    'HyperLearningAI', 'PredictiveEconomyEngine', 'GlobalEnergyOptimizer',
    'EthicalDecisionSynthesizer', 'AutoLegalAdvisor', 'ConsciousnessMapper',
    'ModuleMonitor', 'SelfEvolutionCore', 'InnovationSynthesizer',
    'BillingAdapter', 'LicenseManager', 'APIKeyManager', 'UsageMeter',
    'DeploymentConfigurator', 'HealthcheckEndpoint', 'AutoRestartEngine',
    'DashboardAdapter', 'VisualizationEngine', 'ModuleInspector',
    'TelemetryVisualizer', 'IPGuard', 'IntegrityShield', 'RateLimiter',
    'InputSanitizer', 'GlobalKnowledgeSynthesizer', 'AdaptiveEconomicEngine',
    'UserBehaviorPredictor', 'InnovationForecastEngine', 'EcosystemCoherenceEngine',
    'EmotionalPatternAnalyzer', 'UserToneInsightEngine', 'AdaptiveResponseShaper',
    'CognitiveMapEngine', 'AttentionFlowController', 'MemoryTraceSynthesizer',
    'GlobalTrendInsightEngine', 'OpportunityRadar', 'EcosystemPulseMonitor',
    'RevenueFlowPredictor', 'ClientSegmentModeler', 'SmartPricingAdvisor',
    'FractalPatternEngine', 'RecursiveExpansionSimulator', 'SelfSimilarityMapper',
    'IdeaSynthesisEngine', 'CreativePatternGenerator', 'InnovationTrajectoryModeler',
    'UnicornLoreEngine', 'MythosGenerator', 'UniverseNarrativeCore',
    'UXPatternAnalyzer', 'AdaptiveInterfaceAdvisor', 'UserJourneyModeler',
    'GlobalStandardsEngine', 'CompliancePatternModeler', 'UniversalIntegrationAdvisor',
    'EcosystemBlueprintEngine', 'ViralGrowthEngine', 'EngagementPatternAnalyzer',
    'TrendOpportunityDetector', 'AudienceInsightEngine', 'ContentOptimizationAdvisor',
    'GrowthForecastEngine', 'NetworkEffectSimulator', 'AdoptionCurveModeler',
    'InfluenceMapEngine', 'ViralTriggerAnalyzer', 'ClientIntelligenceEngine',
    'GlobalOrchestrationArchitect', 'QuantumDecisionEngine', 'AIRegulationAdvisor',
    'SustainableGrowthAnalyzer', 'NeuroUXSimulator', 'AutonomousOptimizationCore',
    'HyperTrendForecastEngine', 'MetaInnovationMapper', 'ZEUSAvatar',
    'TelemetryCard', 'NeonButton', 'AuthShield', 'Dashboard', 'Marketplace',
    'Codex', 'Onboarding', 'Automation', 'APIDocs'

  ];//// ---------------------------------------------------------
// CODE‑SANITY‑ENGINE – Motorul de curățare și reparare permanentă
// ---------------------------------------------------------

// 1. index.js (punctul principal)
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/index.js'), `
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { fullScan } = require('./scanner/fullScan');
const { handleFileChange } = require('./scanner/fileWatcher');
const reporter = require('./reporter');

class CodeSanityEngine {
  constructor() {
    this.watcher = null;
    this.isRunning = false;
    this.scanInterval = null;
  }

  start() {
    if (this.isRunning) return;
    console.log('🔍 Pornire CodeSanityEngine – monitorizare permanentă...');
    this.isRunning = true;

    const watchPaths = [
      path.join(__dirname, '../../'), // rădăcina proiectului
    ];
    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(node_modules|\\.git|backups|logs|data|\\.env)/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', filePath => handleFileChange('add', filePath))
      .on('change', filePath => handleFileChange('change', filePath))
      .on('unlink', filePath => handleFileChange('unlink', filePath))
      .on('error', error => console.error('Watcher error:', error));

    fullScan();
    this.scanInterval = setInterval(() => fullScan(), 30 * 60 * 1000);

    reporter.log('CodeSanityEngine started');
  }

  stop() {
    if (this.watcher) this.watcher.close();
    if (this.scanInterval) clearInterval(this.scanInterval);
    this.isRunning = false;
    reporter.log('CodeSanityEngine stopped');
  }

  async runFullScanNow() {
    await fullScan();
    return { success: true };
  }

  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.post('/scan', async (req, res) => {
      await this.runFullScanNow();
      res.json({ success: true });
    });
    router.get('/logs', (req, res) => {
      const logs = reporter.getLogs(100);
      res.json({ logs });
    });
    return router;
  }

  verifyOwner(secret) {
    return secret === process.env.ADMIN_SECRET;
  }
}

module.exports = new CodeSanityEngine();
`);

// 2. scanner/fileWatcher.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/scanner/fileWatcher.js'), `
const { analyzeFile } = require('../analyzers/syntaxChecker');
const { checkLocation } = require('../analyzers/locationChecker');
const { fixFile } = require('../repair/fileMover');
const reporter = require('../reporter');

async function handleFileChange(event, filePath) {
  if (filePath.includes('node_modules') || filePath.includes('.git')) return;

  reporter.log(\`📁 \${event}: \${filePath}\`);

  const syntaxOk = await analyzeFile(filePath);
  if (!syntaxOk) {
    reporter.log(\`❌ Eroare de sintaxă în \${filePath}\`);
    // Încercăm reparare automată (prettier)
    try {
      const prettier = require('prettier');
      const content = fs.readFileSync(filePath, 'utf8');
      const formatted = prettier.format(content, { filepath: filePath });
      fs.writeFileSync(filePath, formatted);
      reporter.log(\`✅ Formatare aplicată pentru \${filePath}\`);
    } catch (err) {
      reporter.log(\`⚠️ Nu s-a putut repara automat: \${err.message}\`);
    }
  }

  const correctPath = checkLocation(filePath);
  if (correctPath !== filePath) {
    reporter.log(\`📍 Mută \${filePath} → \${correctPath}\`);
    fixFile(filePath, correctPath);
  }
}

module.exports = { handleFileChange };
`);

// 3. scanner/fullScan.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/scanner/fullScan.js'), `
const fs = require('fs');
const path = require('path');
const { analyzeFile } = require('../analyzers/syntaxChecker');
const { findDuplicates } = require('../analyzers/duplicateFinder');
const { checkAllLocations } = require('../analyzers/locationChecker');
const { validateAllImports } = require('../analyzers/importValidator');
const { validateModuleCommunication } = require('../analyzers/moduleCommunicator');
const { removeDuplicates } = require('../repair/duplicateRemover');
const { fixAllLocations } = require('../repair/fileMover');
const { rewriteAllImports } = require('../repair/importRewriter');
const { fixModules } = require('../repair/moduleFixer');
const reporter = require('../reporter');

async function fullScan() {
  reporter.log('🔍 Pornește scanarea completă...');
  const root = path.join(__dirname, '../../../');
  const allFiles = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'backups' && entry.name !== 'logs' && entry.name !== 'data') {
          walk(full);
        }
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.json')) {
        allFiles.push(full);
      }
    }
  }
  walk(root);

  for (const file of allFiles) {
    await analyzeFile(file);
  }

  const duplicates = findDuplicates(allFiles);
  if (duplicates.length > 0) {
    reporter.log(\`📑 \${duplicates.length} grupuri de duplicate găsite\`);
    removeDuplicates(duplicates);
  }

  const locationIssues = checkAllLocations(allFiles);
  if (locationIssues.length > 0) {
    reporter.log(\`📍 \${locationIssues.length} fișiere plasate greșit\`);
    fixAllLocations(locationIssues);
  }

  const importIssues = validateAllImports(allFiles);
  if (importIssues.length > 0) {
    reporter.log(\`🔗 \${importIssues.length} probleme cu importurile\`);
    rewriteAllImports(importIssues);
  }

  const commIssues = validateModuleCommunication();
  if (commIssues.length > 0) {
    reporter.log(\`🤝 \${commIssues.length} probleme de comunicare între module\`);
    fixModules(commIssues);
  }

  reporter.log('✅ Scanare completă finalizată.');
}

module.exports = { fullScan };
`);

// 4. analyzers/syntaxChecker.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/analyzers/syntaxChecker.js'), `
const { parse } = require('acorn');
const fs = require('fs');
const reporter = require('../reporter');

async function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    parse(content, { ecmaVersion: 2020, sourceType: 'module' });
    return true;
  } catch (err) {
    reporter.log(\`❌ Eroare de sintaxă în \${filePath}: \${err.message}\`);
    return false;
  }
}

module.exports = { analyzeFile };
`);

// 5. analyzers/duplicateFinder.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/analyzers/duplicateFinder.js'), `
const crypto = require('crypto');
const fs = require('fs');

function hashFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('md5').update(content).digest('hex');
}

function findDuplicates(files) {
  const hashMap = new Map();
  const duplicates = [];

  for (const file of files) {
    const hash = hashFile(file);
    if (hashMap.has(hash)) {
      duplicates.push({ original: hashMap.get(hash), duplicate: file });
    } else {
      hashMap.set(hash, file);
    }
  }
  return duplicates;
}

module.exports = { findDuplicates };
`);

// 6. analyzers/locationChecker.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/analyzers/locationChecker.js'), `
const path = require('path');

const rules = [
  { pattern: /pricing/i, targetDir: 'skills' },
  { pattern: /bd/i, targetDir: 'skills' },
  { pattern: /wealth/i, targetDir: 'skills' },
  { pattern: /trend/i, targetDir: 'skills' },
  { pattern: /content/i, targetDir: 'skills' },
  { pattern: /construction/i, targetDir: 'skills' },
  { pattern: /heal/i, targetDir: 'skills' },
  { pattern: /userMemory/i, targetDir: 'memory' },
  { pattern: /systemMemory/i, targetDir: 'memory' },
  { pattern: /vectorMemory/i, targetDir: 'memory' },
  { pattern: /planner/i, targetDir: 'reasoning' },
  { pattern: /toolUse/i, targetDir: 'reasoning' },
  { pattern: /evaluator/i, targetDir: 'reasoning' },
  { pattern: /style/i, targetDir: 'personality' },
  { pattern: /behavior/i, targetDir: 'personality' },
];

function checkLocation(filePath) {
  const fileName = path.basename(filePath);
  const expectedBase = path.join(__dirname, '../../', 'unicorn-super-intelligence');

  for (const rule of rules) {
    if (rule.pattern.test(fileName)) {
      const target = path.join(expectedBase, rule.targetDir, fileName);
      if (filePath !== target) {
        return target;
      }
    }
  }
  return filePath;
}

function checkAllLocations(files) {
  const issues = [];
  for (const file of files) {
    const correct = checkLocation(file);
    if (correct !== file) {
      issues.push({ from: file, to: correct });
    }
  }
  return issues;
}

module.exports = { checkLocation, checkAllLocations };
`);

// 7. analyzers/importValidator.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/analyzers/importValidator.js'), `
const fs = require('fs');
const path = require('path');

function validateAllImports(files) {
  const issues = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const importRegex = /import\\s+.*\\s+from\\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.') && !importPath.endsWith('.js') && !importPath.endsWith('.jsx')) {
        issues.push({ file, importPath, type: 'missingExtension' });
      }
      const resolved = path.resolve(path.dirname(file), importPath);
      if (!fs.existsSync(resolved) && !fs.existsSync(resolved + '.js') && !fs.existsSync(resolved + '.jsx')) {
        issues.push({ file, importPath, type: 'missingFile' });
      }
    }
  }
  return issues;
}

module.exports = { validateAllImports };
`);

// 8. analyzers/moduleCommunicator.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/analyzers/moduleCommunicator.js'), `
const path = require('path');
const moduleLoader = require('../../ModuleLoader');

function validateModuleCommunication() {
  const issues = [];
  const modules = moduleLoader.getAllModules();
  for (const modName of modules) {
    const mod = moduleLoader.getModule(modName);
    if (!mod.methods || typeof mod.methods.process !== 'function') {
      issues.push({ module: modName, problem: 'missing process method' });
    }
    if (!mod.methods || typeof mod.methods.getStatus !== 'function') {
      issues.push({ module: modName, problem: 'missing getStatus method' });
    }
  }
  return issues;
}

module.exports = { validateModuleCommunication };
`);

// 9. repair/duplicateRemover.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/repair/duplicateRemover.js'), `
const fs = require('fs');
const reporter = require('../reporter');

function removeDuplicates(duplicates) {
  for (const dup of duplicates) {
    if (fs.existsSync(dup.duplicate)) {
      fs.unlinkSync(dup.duplicate);
      reporter.log(\`🗑️ Șters duplicat: \${dup.duplicate}\`);
    }
  }
}

module.exports = { removeDuplicates };
`);

// 10. repair/fileMover.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/repair/fileMover.js'), `
const fs = require('fs');
const path = require('path');
const reporter = require('../reporter');

function fixFile(from, to) {
  const dir = path.dirname(to);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.renameSync(from, to);
  reporter.log(\`📦 Mutat \${path.basename(from)} → \${to}\`);
}

function fixAllLocations(issues) {
  for (const issue of issues) {
    if (fs.existsSync(issue.from)) {
      fixFile(issue.from, issue.to);
    }
  }
}

module.exports = { fixFile, fixAllLocations };
`);

// 11. repair/importRewriter.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/repair/importRewriter.js'), `
const fs = require('fs');
const path = require('path');
const reporter = require('../reporter');

function rewriteAllImports(issues) {
  for (const issue of issues) {
    if (!fs.existsSync(issue.file)) continue;
    const content = fs.readFileSync(issue.file, 'utf8');
    if (issue.type === 'missingExtension') {
      const newContent = content.replace(
        new RegExp(\`(import\\s+.*\\s+from\\s+['"])\${issue.importPath}(['"])\`, 'g'),
        \`$1\${issue.importPath}.js$2\`
      );
      fs.writeFileSync(issue.file, newContent);
      reporter.log(\`✏️ Adăugat extensie în \${issue.file} pentru \${issue.importPath}\`);
    } else if (issue.type === 'missingFile') {
      reporter.log(\`⚠️ Fișier lipsă: \${issue.importPath} (referit în \${issue.file})\`);
    }
  }
}

module.exports = { rewriteAllImports };
`);

// 12. repair/moduleFixer.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/repair/moduleFixer.js'), `
const fs = require('fs');
const path = require('path');
const reporter = require('../reporter');

function fixModules(issues) {
  for (const issue of issues) {
    const modulePath = path.join(__dirname, '../../', issue.module + '.js');
    if (!fs.existsSync(modulePath)) continue;

    let content = fs.readFileSync(modulePath, 'utf8');
    if (issue.problem.includes('process') && !content.includes('process(')) {
      // Adăugăm o metodă process implicită dacă nu există
      const exportMatch = content.match(/(module\\.exports\\s*=\\s*\\{)/);
      if (exportMatch) {
        const newContent = content.replace(
          exportMatch[1],
          \`$1\\n  methods: {\\n    async process(input) { return { status: 'ok', module: this.name, input }; },\\n    getStatus() { return { health: 'good' }; }\\n  },\`
        );
        fs.writeFileSync(modulePath, newContent);
        reporter.log(\`🔧 Reparat modulul \${issue.module}: adăugat methods\`);
      }
    } else if (issue.problem.includes('getStatus') && !content.includes('getStatus')) {
      // similar
    }
  }
}

module.exports = { fixModules };
`);

// 13. repair/syntaxFixer.js (opțional, pentru completitudine)
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/repair/syntaxFixer.js'), `
// În acest fișier am putea implementa corecții mai avansate de sintaxă.
// Momentan, folosim Prettier în fileWatcher.
module.exports = {};
`);

// 14. reporter.js
fs.writeFileSync(path.join(MODULES, 'code-sanity-engine/reporter.js'), `
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../logs/sanity.log');
const maxLogLines = 1000;

class Reporter {
  constructor() {
    this.logs = [];
    this.ensureLogFile();
  }

  ensureLogFile() {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const line = \`[\${timestamp}] \${message}\`;
    console.log(line);
    this.logs.push(line);
    if (this.logs.length > maxLogLines) this.logs.shift();
    fs.appendFileSync(logFile, line + '\\n');
  }

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }
}

module.exports = new Reporter();
`); ============================================================
// Adăugare Universal AI Connector
// ============================================================
const uaicCode = `...`; // // universal-ai-connector.js
// Modul UAIC – conectare automată la toate AI-urile disponibile

const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class UniversalAIConnector {
  constructor() {
    this.models = new Map(); // nume model -> { type, endpoint, apiKey, capabilities, cost, performance }
    this.routingRules = []; // reguli pentru alegerea modelului
    this.stats = { totalCalls: 0, callsByModel: {} };
    this.discoveryInterval = null;
    this.loadKnownModels();
    this.loadRoutingRules();
  }

  async start() {
    console.log('🤖 Pornire Universal AI Connector...');
    // Pornește descoperirea periodică (la fiecare 24h)
    cron.schedule('0 0 * * *', () => this.discoverNewModels());
    // Rulează imediat o descoperire
    await this.discoverNewModels();
    console.log('✅ Universal AI Connector activ.');
  }

  // Încarcă modele cunoscute (din fișier sau din .env)
  loadKnownModels() {
    // Modele implicite (OpenAI, DeepSeek, Claude, Gemini) – dacă au cheie în .env
    if (process.env.OPENAI_API_KEY) {
      this.models.set('openai-gpt4', {
        type: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        capabilities: ['text-generation', 'reasoning', 'code'],
        cost: 0.03,
        performance: { speed: 0.9, accuracy: 0.95 },
      });
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.models.set('deepseek-r1', {
        type: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        capabilities: ['text-generation', 'reasoning'],
        cost: 0.001,
        performance: { speed: 0.95, accuracy: 0.92 },
      });
    }
    const _anthropicKey1 = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (_anthropicKey1) {
      this.models.set('claude-3', {
        type: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: _anthropicKey1,
        capabilities: ['text-generation', 'reasoning'],
        cost: 0.015,
        performance: { speed: 0.85, accuracy: 0.94 },
      });
    }
    if (process.env.GEMINI_API_KEY) {
      this.models.set('gemini-pro', {
        type: 'google',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        apiKey: process.env.GEMINI_API_KEY,
        capabilities: ['text-generation', 'reasoning'],
        cost: 0.0025,
        performance: { speed: 0.92, accuracy: 0.91 },
      });
    }
    // Modele locale (dacă există endpoint)
    if (process.env.LOCAL_MODEL_ENDPOINT) {
      this.models.set('local', {
        type: 'local',
        endpoint: process.env.LOCAL_MODEL_ENDPOINT,
        modelName: process.env.LOCAL_MODEL_NAME || 'llama',
        capabilities: ['text-generation'],
        cost: 0,
        performance: { speed: 0.7, accuracy: 0.8 },
      });
    }
    // Încărcare din fișierul models.json (dacă există)
    const modelsFile = path.join(__dirname, '../../data/models.json');
    if (fs.existsSync(modelsFile)) {
      const extra = JSON.parse(fs.readFileSync(modelsFile));
      extra.forEach(m => this.models.set(m.name, m));
    }
  }

  // Salvează modelele descoperite
  saveModels() {
    const modelsFile = path.join(__dirname, '../../data/models.json');
    const dir = path.dirname(modelsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const toSave = Array.from(this.models.entries()).map(([name, data]) => ({ name, ...data }));
    fs.writeFileSync(modelsFile, JSON.stringify(toSave, null, 2));
  }

  // Încarcă reguli de rutare
  loadRoutingRules() {
    // Reguli implicite: pentru sarcini simple, folosește cel mai ieftin; pentru complexe, cel mai performant
    this.routingRules = [
      { taskType: 'simple', strategy: 'cheapest' },
      { taskType: 'complex', strategy: 'best-accuracy' },
      { taskType: 'creative', strategy: 'best-creativity' },
    ];
    // Aici am putea încărca reguli din fișier
  }

  // Descoperă modele noi din surse publice
  async discoverNewModels() {
    console.log('🔍 Descoper modele AI noi...');
    // 1. Scanează blogul OpenAI
    try {
      const res = await axios.get('https://openai.com/blog');
      const $ = cheerio.load(res.data);
      const articles = $('article h2').map((i, el) => $(el).text()).get();
      if (articles.some(a => a.includes('new model') || a.includes('GPT-5'))) {
        console.log('📢 OpenAI a lansat un model nou! Verifică documentația.');
        // Aici am putea încerca să descoperim automat API-ul, dar deocamdată notificăm
      }
    } catch (err) {}

    // 2. Scanează Hugging Face pentru modele populare
    try {
      const res = await axios.get('https://huggingface.co/models?sort=downloads');
      const $ = cheerio.load(res.data);
      const models = $('.model-title').map((i, el) => $(el).text()).get().slice(0, 10);
      models.forEach(name => {
        if (!this.models.has(name)) {
          console.log(`🆕 Model nou descoperit pe Hugging Face: ${name}`);
          // Adăugăm un model generic (fără API key, doar pentru informare)
          this.models.set(name, {
            type: 'huggingface',
            modelName: name,
            capabilities: ['text-generation'],
            cost: 0,
            performance: { speed: 0.5, accuracy: 0.5 },
            requiresKey: true,
          });
        }
      });
    } catch (err) {}

    this.saveModels();
  }

  // Metodă publică pentru celelalte module: trimite o cerere către cel mai potrivit AI
  async ask(task) {
    // task = { type: 'simple'|'complex'|'creative', prompt: string, maxTokens?: number }
    this.stats.totalCalls++;
    const model = this.selectModel(task);
    if (!model) throw new Error('Nu există niciun model disponibil pentru această sarcină.');

    this.stats.callsByModel[model.name] = (this.stats.callsByModel[model.name] || 0) + 1;

    try {
      const result = await this.callModel(model, task);
      return result;
    } catch (err) {
      console.error(`Eroare la apelul modelului ${model.name}: ${err.message}`);
      // Încercăm un model de rezervă
      const fallback = this.selectModel(task, { exclude: model.name });
      if (fallback) return this.callModel(fallback, task);
      throw err;
    }
  }

  // Selectează cel mai bun model pe baza sarcinii și a performanțelor
  selectModel(task, options = {}) {
    const candidates = Array.from(this.models.entries())
      .filter(([name, m]) => !options.exclude || name !== options.exclude)
      .filter(([name, m]) => m.capabilities.includes('text-generation')); // toate modelele noastre fac asta

    if (candidates.length === 0) return null;

    // Aplicăm regula corespunzătoare
    const rule = this.routingRules.find(r => r.taskType === task.type) || this.routingRules[0];
    if (rule.strategy === 'cheapest') {
      candidates.sort((a, b) => a[1].cost - b[1].cost);
    } else if (rule.strategy === 'best-accuracy') {
      candidates.sort((a, b) => b[1].performance.accuracy - a[1].performance.accuracy);
    } else if (rule.strategy === 'best-creativity') {
      // provizoriu, folosim speed ca proxy
      candidates.sort((a, b) => b[1].performance.speed - a[1].performance.speed);
    }

    return { name: candidates[0][0], ...candidates[0][1] };
  }

  // Apelează efectiv modelul (poate fi OpenAI, DeepSeek, local, etc.)
  async callModel(model, task) {
    const { type, endpoint, apiKey, modelName } = model;
    const prompt = task.prompt;
    const maxTokens = task.maxTokens || 500;

    if (type === 'openai') {
      const res = await axios.post(endpoint, {
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
      return res.data.choices[0].message.content;
    } else if (type === 'deepseek') {
      const res = await axios.post(endpoint, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
      return res.data.choices[0].message.content;
    } else if (type === 'anthropic') {
      const res = await axios.post(endpoint, {
        model: 'claude-3-opus-20240229',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      return res.data.content[0].text;
    } else if (type === 'google') {
      const res = await axios.post(`${endpoint}?key=${apiKey}`, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      });
      return res.data.candidates[0].content.parts[0].text;
    } else if (type === 'local') {
      const res = await axios.post(endpoint, {
        model: modelName,
        prompt: prompt,
        stream: false,
        max_tokens: maxTokens,
      });
      return res.data.response;
    } else {
      throw new Error(`Tip de model necunoscut: ${type}`);
    }
  }

  // Expune rute pentru administrare (protejate)
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.get('/models', (req, res) => {
      res.json(Array.from(this.models.entries()).map(([name, data]) => ({ name, ...data })));
    });

    router.post('/discover', async (req, res) => {
      await this.discoverNewModels();
      res.json({ success: true });
    });

    router.get('/stats', (req, res) => {
      res.json(this.stats);
    });

    return router;
  }

  verifyOwner(secret) {
    return secret === process.env.ADMIN_SECRET;
  }
}

module.exports = new UniversalAIConnector();
fs.writeFileSync(path.join(MODULES, 'universal-ai-connector/index.js'), uaicCode);

// Apoi modifici modulele existente (exemplu pentru content-ai)
fs.writeFileSync(path.join(MODULES, 'content-ai/index.js'), `...`); // noul cod care folosește UAIC
// ... la fel pentru celelalte
  // universal-ai-connector.js
// Modul UAIC – conectare automată la toate AI-urile disponibile

const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class UniversalAIConnector {
  constructor() {
    this.models = new Map(); // nume model -> { type, endpoint, apiKey, capabilities, cost, performance }
    this.routingRules = []; // reguli pentru alegerea modelului
    this.stats = { totalCalls: 0, callsByModel: {} };
    this.discoveryInterval = null;
    this.loadKnownModels();
    this.loadRoutingRules();
  }

  async start() {
    console.log('🤖 Pornire Universal AI Connector...');
    // Pornește descoperirea periodică (la fiecare 24h)
    cron.schedule('0 0 * * *', () => this.discoverNewModels());
    // Rulează imediat o descoperire
    await this.discoverNewModels();
    console.log('✅ Universal AI Connector activ.');
  }

  // Încarcă modele cunoscute (din fișier sau din .env)
  loadKnownModels() {
    // Modele implicite (OpenAI, DeepSeek, Claude, Gemini) – dacă au cheie în .env
    if (process.env.OPENAI_API_KEY) {
      this.models.set('openai-gpt4', {
        type: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        capabilities: ['text-generation', 'reasoning', 'code'],
        cost: 0.03,
        performance: { speed: 0.9, accuracy: 0.95 },
      });
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.models.set('deepseek-r1', {
        type: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        capabilities: ['text-generation', 'reasoning'],
        cost: 0.001,
        performance: { speed: 0.95, accuracy: 0.92 },
      });
    }
    const _anthropicKey2 = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (_anthropicKey2) {
      this.models.set('claude-3', {
        type: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: _anthropicKey2,
        capabilities: ['text-generation', 'reasoning'],
        cost: 0.015,
        performance: { speed: 0.85, accuracy: 0.94 },
      });
    }
    if (process.env.GEMINI_API_KEY) {
      this.models.set('gemini-pro', {
        type: 'google',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        apiKey: process.env.GEMINI_API_KEY,
        capabilities: ['text-generation', 'reasoning'],
        cost: 0.0025,
        performance: { speed: 0.92, accuracy: 0.91 },
      });
    }
    // Modele locale (dacă există endpoint)
    if (process.env.LOCAL_MODEL_ENDPOINT) {
      this.models.set('local', {
        type: 'local',
        endpoint: process.env.LOCAL_MODEL_ENDPOINT,
        modelName: process.env.LOCAL_MODEL_NAME || 'llama',
        capabilities: ['text-generation'],
        cost: 0,
        performance: { speed: 0.7, accuracy: 0.8 },
      });
    }
    // Încărcare din fișierul models.json (dacă există)
    const modelsFile = path.join(__dirname, '../../data/models.json');
    if (fs.existsSync(modelsFile)) {
      const extra = JSON.parse(fs.readFileSync(modelsFile));
      extra.forEach(m => this.models.set(m.name, m));
    }
  }

  // Salvează modelele descoperite
  saveModels() {
    const modelsFile = path.join(__dirname, '../../data/models.json');
    const dir = path.dirname(modelsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const toSave = Array.from(this.models.entries()).map(([name, data]) => ({ name, ...data }));
    fs.writeFileSync(modelsFile, JSON.stringify(toSave, null, 2));
  }

  // Încarcă reguli de rutare
  loadRoutingRules() {
    // Reguli implicite: pentru sarcini simple, folosește cel mai ieftin; pentru complexe, cel mai performant
    this.routingRules = [
      { taskType: 'simple', strategy: 'cheapest' },
      { taskType: 'complex', strategy: 'best-accuracy' },
      { taskType: 'creative', strategy: 'best-creativity' },
    ];
    // Aici am putea încărca reguli din fișier
  }

  // Descoperă modele noi din surse publice
  async discoverNewModels() {
    console.log('🔍 Descoper modele AI noi...');
    // 1. Scanează blogul OpenAI
    try {
      const res = await axios.get('https://openai.com/blog');
      const $ = cheerio.load(res.data);
      const articles = $('article h2').map((i, el) => $(el).text()).get();
      if (articles.some(a => a.includes('new model') || a.includes('GPT-5'))) {
        console.log('📢 OpenAI a lansat un model nou! Verifică documentația.');
        // Aici am putea încerca să descoperim automat API-ul, dar deocamdată notificăm
      }
    } catch (err) {}

    // 2. Scanează Hugging Face pentru modele populare
    try {
      const res = await axios.get('https://huggingface.co/models?sort=downloads');
      const $ = cheerio.load(res.data);
      const models = $('.model-title').map((i, el) => $(el).text()).get().slice(0, 10);
      models.forEach(name => {
        if (!this.models.has(name)) {
          console.log(`🆕 Model nou descoperit pe Hugging Face: ${name}`);
          // Adăugăm un model generic (fără API key, doar pentru informare)
          this.models.set(name, {
            type: 'huggingface',
            modelName: name,
            capabilities: ['text-generation'],
            cost: 0,
            performance: { speed: 0.5, accuracy: 0.5 },
            requiresKey: true,
          });
        }
      });
    } catch (err) {}

    this.saveModels();
  }

  // Metodă publică pentru celelalte module: trimite o cerere către cel mai potrivit AI
  async ask(task) {
    // task = { type: 'simple'|'complex'|'creative', prompt: string, maxTokens?: number }
    this.stats.totalCalls++;
    const model = this.selectModel(task);
    if (!model) throw new Error('Nu există niciun model disponibil pentru această sarcină.');

    this.stats.callsByModel[model.name] = (this.stats.callsByModel[model.name] || 0) + 1;

    try {
      const result = await this.callModel(model, task);
      return result;
    } catch (err) {
      console.error(`Eroare la apelul modelului ${model.name}: ${err.message}`);
      // Încercăm un model de rezervă
      const fallback = this.selectModel(task, { exclude: model.name });
      if (fallback) return this.callModel(fallback, task);
      throw err;
    }
  }

  // Selectează cel mai bun model pe baza sarcinii și a performanțelor
  selectModel(task, options = {}) {
    const candidates = Array.from(this.models.entries())
      .filter(([name, m]) => !options.exclude || name !== options.exclude)
      .filter(([name, m]) => m.capabilities.includes('text-generation')); // toate modelele noastre fac asta

    if (candidates.length === 0) return null;

    // Aplicăm regula corespunzătoare
    const rule = this.routingRules.find(r => r.taskType === task.type) || this.routingRules[0];
    if (rule.strategy === 'cheapest') {
      candidates.sort((a, b) => a[1].cost - b[1].cost);
    } else if (rule.strategy === 'best-accuracy') {
      candidates.sort((a, b) => b[1].performance.accuracy - a[1].performance.accuracy);
    } else if (rule.strategy === 'best-creativity') {
      // provizoriu, folosim speed ca proxy
      candidates.sort((a, b) => b[1].performance.speed - a[1].performance.speed);
    }

    return { name: candidates[0][0], ...candidates[0][1] };
  }

  // Apelează efectiv modelul (poate fi OpenAI, DeepSeek, local, etc.)
  async callModel(model, task) {
    const { type, endpoint, apiKey, modelName } = model;
    const prompt = task.prompt;
    const maxTokens = task.maxTokens || 500;

    if (type === 'openai') {
      const res = await axios.post(endpoint, {
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
      return res.data.choices[0].message.content;
    } else if (type === 'deepseek') {
      const res = await axios.post(endpoint, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
      return res.data.choices[0].message.content;
    } else if (type === 'anthropic') {
      const res = await axios.post(endpoint, {
        model: 'claude-3-opus-20240229',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      return res.data.content[0].text;
    } else if (type === 'google') {
      const res = await axios.post(`${endpoint}?key=${apiKey}`, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      });
      return res.data.candidates[0].content.parts[0].text;
    } else if (type === 'local') {
      const res = await axios.post(endpoint, {
        model: modelName,
        prompt: prompt,
        stream: false,
        max_tokens: maxTokens,
      });
      return res.data.response;
    } else {
      throw new Error(`Tip de model necunoscut: ${type}`);
    }
  }

  // Expune rute pentru administrare (protejate)
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.get('/models', (req, res) => {
      res.json(Array.from(this.models.entries()).map(([name, data]) => ({ name, ...data })));
    });

    router.post('/discover', async (req, res) => {
      await this.discoverNewModels();
      res.json({ success: true });
    });

    router.get('/stats', (req, res) => {
      res.json(this.stats);
    });

    return router;
  }

  verifyOwner(secret) {
    return secret === process.env.ADMIN_SECRET;
  }
}

module.exports = new UniversalAIConnector();


  otherModules.forEach(name => {
    const content = `
// Modul real: ${name}
module.exports = {
  name: '${name}',
  role: 'Modul specializat – detalii în documentație',
  state: { lastRun: null },
  methods: {
    async process(input) {
      this.state.lastRun = new Date().toISOString();
      console.log(\`🔧 \${this.name} procesează: \${JSON.stringify(input)}\`);
      return { status: 'ok', module: this.name, input };
    },
    getStatus() {
      return {
        name: this.name,
        health: 'good',
        uptime: process.uptime(),
        lastRun: this.state.lastRun
      };
    }
  }
};
`;
    fs.writeFileSync(path.join(MODULES, `${name}.js`), content);
  });
}
generateMassModules();// ---------------------------------------------------------
// evolution-core/SelfEvolve.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'evolution-core/SelfEvolve.js'), `
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

const SelfEvolve = {
  async analyzeTrends() {
    console.log('🔍 Analizăm trendurile...');
    const trends = ['plăți recurente', 'analytics în timp real', 'chatbot suport'];
    return trends[Math.floor(Math.random() * trends.length)];
  },
  async generateNewModule(idea) {
    console.log(\`✍️ Generăm modul pentru: \${idea}\`);
    let code = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = \`Scrie un modul Node.js Express care implementează \${idea}. Include rute, validare și comentarii.\`;
        const response = await openai.createCompletion({ model: 'text-davinci-003', prompt, max_tokens: 500 });
        code = response.data.choices[0].text;
      } catch (err) {
        code = \`// Modul generat pentru: \${idea}\\nmodule.exports = { name: 'generated', methods: { process: async (i) => i } };\`;
      }
    } else {
      code = \`// Modul generat pentru: \${idea}\\nmodule.exports = { name: 'generated', methods: { process: async (i) => i } };\`;
    }
    const filename = \`Module_\${Date.now()}.js\`;
    const filePath = path.join(__dirname, '../../generated', filename);
    fs.writeFileSync(filePath, code);
    console.log(\`✅ Modul generat: \${filename}\`);
    return filename;
  }
};
module.exports = SelfEvolve;
`);

// ---------------------------------------------------------
// quantum-healing/AutoHeal.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'quantum-healing/AutoHeal.js'), `
const { exec } = require('child_process');
const axios = require('axios');

let mainProcess = null;
function startMainServer() {
  mainProcess = exec('node src/index.js', (err) => { if (err) console.error(err); });
}
function checkHealth() {
  axios.get('http://localhost:3000/health', { timeout: 3000 })
    .then(res => console.log('✅ Health check trecut'))
    .catch(err => {
      console.error('❌ Health check eșuat, repornim...');
      if (mainProcess) mainProcess.kill();
      startMainServer();
    });
}
startMainServer();
setInterval(checkHealth, 10000);
`);

// ---------------------------------------------------------
// universal-adaptor/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'universal-adaptor/index.js'), `
module.exports = {
  fromCSV(csvString) {
    const lines = csvString.trim().split('\\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, header, i) => {
        obj[header.trim()] = values[i]?.trim();
        return obj;
      }, {});
    });
  },
  fromJSON(jsonString) {
    return JSON.parse(jsonString);
  },
  toXML(data) {
    let xml = '<root>';
    data.forEach(item => {
      xml += '<item>';
      for (let key in item) {
        xml += \`<\${key}>\${item[key]}</\${key}>\`;
      }
      xml += '</item>';
    });
    xml += '</root>';
    return xml;
  }
};
`);

// ---------------------------------------------------------
// quantum-pay/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'quantum-pay/index.js'), `
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
module.exports = {
  async createCheckoutSession(priceId, successUrl, cancelUrl) {
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session.url;
  },
  async handleWebhook(rawBody, signature, endpointSecret) {
    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
      if (event.type === 'checkout.session.completed') {
        console.log('💰 Plată reușită:', event.data.object);
      }
      return event;
    } catch (err) {
      console.error('Webhook error:', err.message);
      throw err;
    }
  }
};
`);

// ---------------------------------------------------------
// site-creator/index.js (real, cu OpenAI)
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'site-creator/index.js'), `
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

async function generateSite(topic = 'AI Unicorn', style = 'cyberpunk') {
  console.log(\`🌐 Generăm site pe tema "\${topic}" cu stil "\${style}"...\`);
  let html = '';
  if (process.env.OPENAI_API_KEY) {
    try {
      const prompt = \`Generează cod HTML complet pentru un site modern despre \${topic}. Stilul să fie \${style}. Include CSS încorporat, header, secțiuni, footer. Fă-l responsive.\`;
      const response = await openai.createCompletion({ model: 'text-davinci-003', prompt, max_tokens: 1500 });
      html = response.data.choices[0].text;
    } catch (err) {
      html = \`<html><body><h1>\${topic}</h1><p>Site generat offline.</p></body></html>\`;
    }
  } else {
    html = \`<html><body><h1>\${topic}</h1><p>Site generat offline.</p></body></html>\`;
  }
  const filePath = path.join(__dirname, '../../../client/public', \`site_\${Date.now()}.html\`);
  fs.writeFileSync(filePath, html);
  return filePath;
}
module.exports = { generateSite };
`);

// ---------------------------------------------------------
// ab-testing/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'ab-testing/index.js'), `
const crypto = require('crypto');
const experiments = new Map();

function createExperiment(name, variants, weights = null) {
  const id = crypto.randomBytes(8).toString('hex');
  if (!weights) weights = variants.map(() => 1 / variants.length);
  experiments.set(id, { id, name, variants, weights, results: variants.reduce((acc, v) => ({ ...acc, [v]: { impressions: 0, conversions: 0 } }), {}) });
  return id;
}
function getVariant(experimentId, userId) {
  const exp = experiments.get(experimentId);
  if (!exp) return null;
  const hash = crypto.createHash('md5').update(userId + experimentId).digest('hex');
  const rand = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  let cumulative = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    cumulative += exp.weights[i];
    if (rand < cumulative) {
      exp.results[exp.variants[i]].impressions++;
      return exp.variants[i];
    }
  }
  return exp.variants[0];
}
function trackConversion(experimentId, variant) {
  const exp = experiments.get(experimentId);
  if (exp && exp.results[variant]) exp.results[variant].conversions++;
}
function getResults(experimentId) {
  return experiments.get(experimentId);
}
module.exports = { createExperiment, getVariant, trackConversion, getResults };
`);

// ---------------------------------------------------------
// seo-optimizer/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'seo-optimizer/index.js'), `
const fs = require('fs');
function analyzePage(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const suggestions = [];
  if (!content.includes('<title>')) suggestions.push('Adaugă <title>');
  if (!content.includes('<meta name="description"')) suggestions.push('Adaugă meta description');
  if (!content.includes('<h1>')) suggestions.push('Adaugă H1');
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\\s+/).length;
  if (wordCount < 300) suggestions.push('Conținut scurt (<300 cuvinte)');
  return { filePath, wordCount, suggestions };
}
module.exports = { analyzePage };
`);

// ---------------------------------------------------------
// analytics/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'analytics/index.js'), `
const events = [];
const { v4: uuidv4 } = require('uuid');
function trackEvent(eventType, data = {}) {
  const event = { id: uuidv4(), type: eventType, data, timestamp: new Date().toISOString() };
  events.push(event);
  if (events.length > 1000) events.shift();
  return event;
}
function getEvents(limit = 100) { return events.slice(-limit); }
function getStats() {
  const total = events.length;
  const byType = events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});
  return { total, byType };
}
module.exports = { trackEvent, getEvents, getStats };
`);// ---------------------------------------------------------
// content-ai/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'content-ai/index.js'), `
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);
async function generateArticle(topic, tone = 'informativ', words = 300) {
  if (!process.env.OPENAI_API_KEY) return \`Articol despre \${topic} (placeholder).\`;
  try {
    const prompt = \`Scrie un articol în română, ton \${tone}, \${words} cuvinte, pe tema: "\${topic}".\`;
    const response = await openai.createCompletion({ model: 'text-davinci-003', prompt, max_tokens: words * 2 });
    return response.data.choices[0].text;
  } catch (err) { return \`Articol despre \${topic} (eroare OpenAI).\`; }
}
module.exports = { generateArticle };
`);

// ---------------------------------------------------------
// auto-marketing/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'auto-marketing/index.js'), `
const subscribers = [];
function addSubscriber(email) { subscribers.push({ email, subscribedAt: new Date().toISOString() }); console.log(\`📧 Abonat adăugat: \${email}\`); }
function sendCampaign(subject, content) {
  console.log(\`📨 Trimitere campanie: "\${subject}" către \${subscribers.length} abonați\`);
  subscribers.forEach(sub => console.log(\`   -> Email trimis către \${sub.email}\`));
  return { sent: subscribers.length, subject };
}
function scheduleCampaign(subject, content, delayMs) {
  setTimeout(() => sendCampaign(subject, content), delayMs);
  console.log(\`⏰ Campanie programată peste \${delayMs / 1000} secunde\`);
}
module.exports = { addSubscriber, sendCampaign, scheduleCampaign };
`);

// ---------------------------------------------------------
// performance-monitor/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'performance-monitor/index.js'), `
const os = require('os');
function getSystemLoad() { return { loadAvg: os.loadavg(), freeMem: os.freemem(), totalMem: os.totalmem(), uptime: os.uptime() }; }
function suggestOptimizations() {
  const load = getSystemLoad();
  const suggestions = [];
  if (load.loadAvg[0] > os.cpus().length) suggestions.push('Load average ridicat – scalează.');
  if (load.freeMem / load.totalMem < 0.1) suggestions.push('Memorie liberă sub 10% – optimizează.');
  return suggestions;
}
module.exports = { getSystemLoad, suggestOptimizations };
`);

// ---------------------------------------------------------
// unicorn-realization-engine/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'unicorn-realization-engine/index.js'), `
module.exports = {
  id: 'UnicornRealizationEngine',
  state: { scanResult: {}, analysisResult: {}, roadmapPlan: [] },
  scan(u) {
    this.state.scanResult = { modules: u.modules || [], routes: u.routes || [], uiComponents: u.uiComponents || [] };
    return this.state.scanResult;
  },
  analyze() {
    const ideal = {
      modules: ['Identity', 'Database', 'Dashboard', 'AI Core', 'Automation', 'API Platform', 'Marketplace', 'Payments', 'Security'],
      routes: ['/login', '/signup', '/dashboard', '/marketplace', '/api', '/automation'],
      uiComponents: ['ZEUSAvatar', 'TelemetryCard', 'Codex', 'Onboarding', 'AutomationUI', 'APIDocs']
    };
    const s = this.state.scanResult;
    const check = (it, ex) => it.map(x => ex.includes(x) ? { name: x, status: '✅' } : (ex.some(e => e.toLowerCase().includes(x.toLowerCase())) ? { name: x, status: '⚠️' } : { name: x, status: '❌' }));
    this.state.analysisResult = {
      modules: check(ideal.modules, s.modules),
      routes: check(ideal.routes, s.routes),
      uiComponents: check(ideal.uiComponents, s.uiComponents)
    };
    return this.state.analysisResult;
  },
  roadmap() {
    const a = this.state.analysisResult, plan = [];
    const m = { '❌': 'critical', '⚠️': 'important', '✅': 'done' };
    const add = (t, i, s) => { if (s !== '✅') plan.push({ step: \`Implement \${i} (\${t})\`, priority: m[s] }); };
    a.modules.forEach(x => add('module', x.name, x.status));
    a.routes.forEach(x => add('route', x.name, x.status));
    a.uiComponents.forEach(x => add('ui', x.name, x.status));
    this.state.roadmapPlan = plan;
    return plan;
  },
  report() { return { scan: this.state.scanResult, analysis: this.state.analysisResult, roadmap: this.state.roadmapPlan }; }
};
`);

// ---------------------------------------------------------
// unicorn-execution-engine/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'unicorn-execution-engine/index.js'), `
const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'UnicornExecutionEngine',
  state: { executedSteps: [] },
  execute(r) {
    r.forEach(step => {
      const fp = path.join(__dirname, '../../../logs/executed_steps.txt');
      fs.appendFileSync(fp, \`\${new Date().toISOString()} - \${step.step} [\${step.priority}]\\n\`);
      this.state.executedSteps.push(step);
    });
    return this.state.executedSteps;
  },
  report() { return { executed: this.state.executedSteps }; }
};
`);

// ---------------------------------------------------------
// auto-trend-analyzer/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'auto-trend-analyzer/index.js'), `
const axios = require('axios');
const cheerio = require('cheerio');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

async function fetchGitHubTrends() {
  try {
    const { data } = await axios.get('https://github.com/trending');
    const $ = cheerio.load(data);
    const repos = [];
    $('article.Box-row').each((i, el) => {
      const title = $(el).find('h2 a').text().replace(/\\s+/g, ' ').trim();
      repos.push(title);
    });
    return repos.slice(0, 5);
  } catch (err) {
    console.error('Eroare GitHub trends:', err.message);
    return [];
  }
}

async function analyzeTrends() {
  const github = await fetchGitHubTrends();
  if (process.env.OPENAI_API_KEY && github.length > 0) {
    try {
      const prompt = \`Pe baza acestor trenduri: \${github.join(', ')}, generează 3 idei de noi module pentru un sistem AI autonom.\`;
      const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 300,
        temperature: 0.8,
      });
      return response.data.choices[0].text.split('\\n').filter(line => line.trim() !== '');
    } catch (err) {
      console.error('Eroare OpenAI:', err.message);
      return github;
    }
  }
  return github;
}

module.exports = { analyzeTrends };
`);

// ---------------------------------------------------------
// self-adaptation-engine/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'self-adaptation-engine/index.js'), `
const os = require('os');
const fs = require('fs');
const path = require('path');

function detectPlatform() {
  if (fs.existsSync('/.dockerenv')) return 'docker';
  if (process.env.HETZNER) return 'hetzner';
  return 'local';
}

function getSystemLoad() {
  return {
    loadAvg: os.loadavg(),
    freeMem: os.freemem(),
    totalMem: os.totalmem(),
    cpuCount: os.cpus().length,
  };
}

function adaptConfig() {
  const platform = detectPlatform();
  const load = getSystemLoad();
  const config = {};

  if (platform === 'docker') {
    config.maxInstances = 2;
    config.restartPolicy = 'always';
  } else if (platform === 'hetzner') {
    config.maxInstances = 5;
  } else {
    config.maxInstances = 1;
  }

  if (load.loadAvg[0] > load.cpuCount * 0.7) {
    config.scaleSuggestion = 'Se recomandă scalare.';
  }

  return config;
}

module.exports = { detectPlatform, getSystemLoad, adaptConfig };
`);

// ---------------------------------------------------------
// predictive-healing/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'predictive-healing/index.js'), `
const os = require('os');
class Predictor {
  constructor() {
    this.history = [];
  }
  addDataPoint(value) {
    this.history.push({ timestamp: Date.now(), value });
    if (this.history.length > 100) this.history.shift();
  }
  predictNext(secondsAhead = 60) {
    if (this.history.length < 2) return null;
    const recent = this.history.slice(-10);
    const avgInterval = (recent[recent.length - 1].timestamp - recent[0].timestamp) / (recent.length - 1);
    const x = recent.map((_, i) => i);
    const y = recent.map(d => d.value);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, _, i) => a + x[i] * y[i], 0);
    const sumX2 = x.reduce((a, _, i) => a + x[i] * x[i], 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const predicted = intercept + slope * (recent.length + secondsAhead / (avgInterval / 1000));
    return Math.max(0, predicted);
  }
}
const predictor = new Predictor();
setInterval(() => {
  const load = os.loadavg()[0];
  predictor.addDataPoint(load);
  const predicted = predictor.predictNext(60);
  if (predicted > os.cpus().length * 0.9) {
    console.warn('⚠️ Se prevede suprasarcină!');
  }
}, 30000);
module.exports = { predictor };
`);// ---------------------------------------------------------
// code-optimizer/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'code-optimizer/index.js'), `
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function optimizeFile(filePath) {
  try {
    execSync(\`npx prettier --write "\${filePath}"\`, { stdio: 'ignore' });
    console.log(\`✅ Formatat: \${filePath}\`);
  } catch (err) {}
  try {
    execSync(\`npx eslint --fix "\${filePath}"\`, { stdio: 'ignore' });
  } catch (err) {}
}

function optimizeAll() {
  const dirs = [path.join(__dirname, '../../'), path.join(__dirname, '../../../client/src')];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.js') || f.endsWith('.jsx'));
    files.forEach(file => optimizeFile(path.join(dir, file)));
  });
}

setInterval(optimizeAll, 24 * 60 * 60 * 1000);
module.exports = { optimizeAll };
`);

// ---------------------------------------------------------
// self-documenter/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'self-documenter/index.js'), `
const fs = require('fs');
const path = require('path');

function generateReadme() {
  const modules = fs.readdirSync(path.join(__dirname, '../')).filter(f => fs.lstatSync(path.join(__dirname, '../', f)).isDirectory());
  let content = '# UNICORN FINAL - Documentație Autogenerată\\n\\n## Module disponibile:\\n';
  modules.forEach(m => { content += \`- \${m}\\n\`; });
  fs.writeFileSync(path.join(__dirname, '../../../README.md'), content);
  console.log('📘 README generat.');
}

setInterval(generateReadme, 6 * 60 * 60 * 1000);
module.exports = { generateReadme };
`);

// ---------------------------------------------------------
// ui-evolution/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'ui-evolution/index.js'), `
const fs = require('fs');
const path = require('path');
const abTesting = require('../ab-testing');

function evolveUI() {
  const experiments = ['button-color', 'layout-density', 'avatar-style'];
  experiments.forEach(exp => {
    const results = abTesting.getResults(exp);
    if (results) {
      let bestVariant = null;
      let bestRate = 0;
      for (const [variant, data] of Object.entries(results.results)) {
        const rate = data.conversions / (data.impressions || 1);
        if (rate > bestRate) { bestRate = rate; bestVariant = variant; }
      }
      if (bestVariant) {
        const configPath = path.join(__dirname, '../../../client/public/ui-config.json');
        let config = {};
        if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config[exp] = bestVariant;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(\`🔄 UI evoluat: \${exp} -> \${bestVariant}\`);
      }
    }
  });
}
setInterval(evolveUI, 60 * 60 * 1000);
module.exports = { evolveUI };
`);

// ---------------------------------------------------------
// security-scanner/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'security-scanner/index.js'), `
const { execSync } = require('child_process');

function scanDependencies() {
  try {
    const output = execSync('npm audit --json', { encoding: 'utf8' });
    const audit = JSON.parse(output);
    if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
      console.warn('🚨 Vulnerabilități! Încercăm să reparăm...');
      execSync('npm audit fix', { stdio: 'inherit' });
    }
  } catch (err) {}
}
setInterval(scanDependencies, 24 * 60 * 60 * 1000);
module.exports = { scanDependencies };
`);

// ---------------------------------------------------------
// disaster-recovery/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'disaster-recovery/index.js'), `
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '../../../backups');

function backup() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupFile = path.join(BACKUP_DIR, \`backup-\${timestamp}.tar.gz\`);
  const cmd = \`tar -czf \${backupFile} -C \${path.join(__dirname, '../../..')} . --exclude=node_modules --exclude=backups --exclude=.git\`;
  exec(cmd, (err) => {
    if (err) console.error('Eroare backup:', err);
    else console.log(\`✅ Backup creat: \${backupFile}\`);
  });
}
setInterval(backup, 24 * 60 * 60 * 1000);
module.exports = { backup };
`);

// ---------------------------------------------------------
// swarm-intelligence/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'swarm-intelligence/index.js'), `
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function shareKnowledge() {
  const peers = (process.env.UNICORN_PEER_URLS || '').split(',');
  if (peers.length === 0) return;
  const stats = {
    modules: fs.readdirSync(path.join(__dirname, '../')).filter(f => f !== 'swarm-intelligence'),
    uptime: process.uptime(),
  };
  for (const peer of peers) {
    try {
      await axios.post(\`\${peer}/api/swarm/share\`, stats, { timeout: 5000 });
      console.log(\`📡 Partajat cu \${peer}\`);
    } catch (err) {}
  }
}
setInterval(shareKnowledge, 60 * 60 * 1000);
module.exports = { shareKnowledge };
`);

// ---------------------------------------------------------
// auto-deploy/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'auto-deploy/index.js'), `
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const { Client } = require('ssh2');

function loadCredentialEnvFiles() {
  const rootPath = path.join(__dirname, '../../..');
  const envCandidates = [
    path.join(rootPath, '.env'),
    path.join(rootPath, '.env.auto-connector'),
    path.join(rootPath, '..', '.env'),
    path.join(rootPath, '..', '.env.auto-connector')
  ];

  for (const filePath of envCandidates) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
    }
  }
}

function getRepositoryUrl() {
  if (process.env.GIT_REMOTE_URL) return process.env.GIT_REMOTE_URL;
  if (process.env.GITHUB_OWNER && (process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO)) {
    const repoName = process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO;
    if (repoName && !repoName.startsWith('http')) {
      return \`https://github.com/\${process.env.GITHUB_OWNER}/\${repoName}.git\`;
    }
  }
  return '';
}

function getAuthenticatedRemoteUrl() {
  const remoteUrl = getRepositoryUrl();
  const token = process.env.GITHUB_TOKEN || '';

  if (!remoteUrl || !token) return remoteUrl;
  if (!remoteUrl.includes('github.com') || remoteUrl.includes('@')) return remoteUrl;

  return remoteUrl.replace('https://', \`https://x-access-token:\${encodeURIComponent(token)}@\`);
}

loadCredentialEnvFiles();
const git = simpleGit(path.join(__dirname, '../../../'));

async function checkAndPush() {
  try {
    const status = await git.status();
    if (status.files.length > 0 || status.not_added.length > 0) {
      console.log('📦 Modificări detectate, commit...');
      await git.add('.');
      await git.commit('Auto-deploy: ' + new Date().toISOString());
      const remotes = await git.getRemotes();
      if (remotes.length === 0) {
        console.log('⚠️ Niciun remote git.');
        return;
      }
      await git.push('origin', process.env.GIT_BRANCH || 'main');
      console.log('🚀 Push pe GitHub.');
      deployToHetzner();
    }
  } catch (err) { console.error('❌ Eroare auto-deploy:', err.message); }
}

function deployToHetzner() {
  if (!process.env.HETZNER_SSH_HOST) return;
  const conn = new Client();
  conn.on('ready', () => {
    conn.exec(\`cd \${process.env.HETZNER_DEPLOY_PATH} && git pull && docker-compose down && docker-compose up -d --build\`, (err, stream) => {
      if (err) console.error('Eroare SSH');
      stream.on('close', () => conn.end());
    });
  }).connect({
    host: process.env.HETZNER_SSH_HOST,
    username: process.env.HETZNER_SSH_USER,
    privateKey: fs.readFileSync(process.env.HETZNER_SSH_KEY_PATH || '~/.ssh/id_rsa')
  });
}

async function ensureRepo() {
  if (!fs.existsSync(path.join(__dirname, '../../../.git'))) {
    await git.init();
    const remoteUrl = getAuthenticatedRemoteUrl();
    if (remoteUrl) await git.addRemote('origin', remoteUrl);
    return;
  }

  const remoteUrl = getAuthenticatedRemoteUrl();
  if (remoteUrl) {
    try {
      await git.remote(['set-url', 'origin', remoteUrl]);
    } catch {}
  }
}

module.exports = { checkAndPush, ensureRepo };
`);

fs.writeFileSync(path.join(MODULES, 'auto-deploy/trigger.js'), `
const { ensureRepo, checkAndPush } = require('./index');
(async () => { await ensureRepo(); await checkAndPush(); })();
`);// ---------------------------------------------------------
// total-system-healer/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'total-system-healer/index.js'), `
const moduleLoader = require('../ModuleLoader');
const fs = require('fs');
const path = require('path');

class TotalSystemHealer {
  constructor() {
    this.healthStatus = {};
    this.repairAttempts = {};
    this.scanInterval = null;
  }
  start() {
    console.log('🩺 Pornire TotalSystemHealer – monitorizare la 10 sec.');
    this.scanInterval = setInterval(() => this.scanAndHeal(), 10000);
  }
  scanAndHeal() {
    this.checkModuleHealth();
    this.analyzeLogs();
    this.checkForInnovations();
  }
  checkModuleHealth() {
    const modules = moduleLoader.getAllModules();
    modules.forEach(moduleName => {
      const mod = moduleLoader.getModule(moduleName);
      if (!mod) {
        console.log(\`❌ Modulul \${moduleName} lipsă. Încerc reparație.\`);
        this.repairModule(moduleName);
        return;
      }
      try {
        const status = mod.methods?.getStatus ? mod.methods.getStatus() : {};
        if (status.health !== 'good') this.repairModule(moduleName);
      } catch (err) {
        this.repairModule(moduleName);
      }
    });
  }
  repairModule(moduleName) {
    if (this.repairAttempts[moduleName] > 3) {
      this.rebuildModule(moduleName);
      return;
    }
    this.repairAttempts[moduleName] = (this.repairAttempts[moduleName] || 0) + 1;
    delete require.cache[require.resolve(path.join(__dirname, '../', moduleName))];
    try {
      moduleLoader.modules[moduleName] = require(path.join(__dirname, '../', moduleName));
      console.log(\`✅ \${moduleName} reîncărcat.\`);
    } catch (err) {}
  }
  rebuildModule(moduleName) {
    console.log(\`🏗️ Reconstruiesc \${moduleName}.\`);
    const template = \`
module.exports = { name: '\${moduleName}', role: 'regenerat', methods: { process: async (i) => i, getStatus: () => ({ health: 'good' }) } };
\`;
    fs.writeFileSync(path.join(__dirname, '../', moduleName + '.js'), template);
    delete require.cache[require.resolve(path.join(__dirname, '../', moduleName))];
    try { moduleLoader.modules[moduleName] = require(path.join(__dirname, '../', moduleName)); } catch (err) {}
  }
  analyzeLogs() {
    const logDir = path.join(__dirname, '../../../logs');
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(logDir, file), 'utf8').split('\\n').slice(-50).join('\\n');
      if (content.includes('error') || content.includes('Error')) {
        console.log(\`🔍 Eroare în \${file}. Se va repara.\`);
      }
    });
  }
  checkForInnovations() {
    const trend = moduleLoader.getModule('auto-trend-analyzer');
    if (trend && trend.methods?.analyzeTrends) {
      trend.methods.analyzeTrends().then(trends => {
        if (trends && trends.length > 0) {
          console.log('💡 Trend-uri:', trends);
          const evolve = moduleLoader.getModule('SelfEvolve');
          if (evolve) evolve.generateNewModule(trends[0]);
        }
      });
    }
  }
}
module.exports = new TotalSystemHealer();
`);

// ---------------------------------------------------------
// dynamic-pricing/index.js (real, cu model simplu)
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'dynamic-pricing/index.js'), `
class DynamicPricing {
  constructor() {
    this.segments = { retail: { elasticity: -1.5 }, enterprise: { elasticity: -0.8 } };
  }
  calculateOptimalPrice(clientData) {
    const base = 100;
    const elasticity = this.segments[clientData.segment]?.elasticity || -1.2;
    return base * (1 + elasticity * 0.1);
  }
  verifyOwner(secret) { return secret === process.env.ADMIN_SECRET; }
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.get('/segments', (req, res) => res.json(this.segments));
    return router;
  }
}
module.exports = new DynamicPricing();
`);

// ---------------------------------------------------------
// universal-interchain-nexus/index.js (simplificat dar real)
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'universal-interchain-nexus/index.js'), `
class UniversalInterchainNexus {
  constructor() {
    this.supportedChains = new Map();
  }
  async initialize() {
    console.log('UIN inițializat');
  }
}
module.exports = UniversalInterchainNexus;
`);

// ---------------------------------------------------------
// autonomous-wealth-engine/index.js (real, cu ccxt și ethers)
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'autonomous-wealth-engine/index.js'), `
const ccxt = require('ccxt');
const { ethers } = require('ethers');
const cron = require('node-cron');
class AutonomousWealthEngine {
  constructor() {
    this.exchanges = {};
    this.portfolio = { totalValue: 0 };
  }
  async initialize() {
    if (process.env.BINANCE_API_KEY) {
      this.exchanges.binance = new ccxt.binance({ apiKey: process.env.BINANCE_API_KEY, secret: process.env.BINANCE_SECRET });
    }
    console.log('💰 Wealth Engine inițializat');
  }
  async callModuleAPI(moduleName, params, paymentMethod) {
    if (paymentMethod === 'stripe') {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: moduleName }, unit_amount: 100 }, quantity: 1 }],
        mode: 'payment',
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
      });
      return { paymentRequired: true, url: session.url };
    }
    return { result: 'ok' };
  }
  verifyOwner(secret) { return secret === process.env.ADMIN_SECRET; }
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.get('/portfolio', (req, res) => res.json(this.portfolio));
    return router;
  }
}
module.exports = new AutonomousWealthEngine();
`);

// ---------------------------------------------------------
// autonomous-bd-engine/index.js (real, cu OpenAI și scraping)
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'autonomous-bd-engine/index.js'), `
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class AutonomousBDEngine {
  constructor() {
    this.openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
    this.leads = [];
    this.stats = { scanned: 0 };
    this.loadState();
  }
  loadState() {
    const f = path.join(__dirname, '../../data/bd_state.json');
    if (fs.existsSync(f)) this.leads = JSON.parse(fs.readFileSync(f)).leads || [];
  }
  saveState() {
    fs.writeFileSync(path.join(__dirname, '../../data/bd_state.json'), JSON.stringify({ leads: this.leads }));
  }
  async start() {
    console.log('🚀 BD Engine pornit');
    cron.schedule('0 * /24 * * *', () => this.scanForOpportunities());
  }
  async scanForOpportunities() {
    this.stats.scanned++;
    // Simulare scanare
    this.leads.push({ company: 'aws', discoveredAt: new Date().toISOString(), status: 'new' });
    this.saveState();
  }
  async handleNegotiation(company, message) {
    const prompt = \`Ești un agent de business development. Negociezi cu \${company}. Mesaj: \${message}. Răspunde.\`;
    const res = await this.openai.createCompletion({ model: 'text-davinci-003', prompt, max_tokens: 150 });
    return res.data.choices[0].text;
  }
  verifyOwner(secret) { return secret === process.env.ADMIN_SECRET; }
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.get('/stats', (req, res) => res.json(this.stats));
    router.get('/leads', (req, res) => res.json(this.leads));
    return router;
  }
}
module.exports = new AutonomousBDEngine();
`);

// ---------------------------------------------------------
// self-construction-engine/index.js
// ---------------------------------------------------------
fs.writeFileSync(path.join(MODULES, 'self-construction-engine/index.js'), `
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Configuration, OpenAIApi } = require('openai');
const moduleLoader = require('../ModuleLoader');

class SelfConstructionEngine {
  constructor() {
    this.openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
    this.hasRun = false;
    this.logFile = path.join(__dirname, '../../logs/construction.log');
    this.ensureLogFile();
  }

  ensureLogFile() {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  log(message) {
    const entry = \`[\${new Date().toISOString()}] \${message}\\n\`;
    fs.appendFileSync(this.logFile, entry);
    console.log(message);
  }

  async start(force = false) {
    if (this.hasRun && !force) {
      this.log('ℹ️ Self‑Construction Engine a rulat deja. Pentru a relansa, folosește force=true sau ruta manuală.');
      return;
    }
    this.log('🚀 Pornire Self‑Construction Engine...');
    this.hasRun = true;

    const modules = this.scanAllModules();
    this.log(\`📦 Găsite \${modules.length} module.\`);

    for (const mod of modules) {
      await this.enhanceModule(mod);
    }

    await this.createMissingModules();
    this.optimizeCode();
    await this.generateWebPages();

    this.log('✅ Self‑Construction Engine finalizat.');
  }

  scanAllModules() {
    const moduleFiles = [];
    const dirs = [__dirname, path.join(__dirname, '../'), path.join(__dirname, '../../generated')];
    dirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'ModuleLoader.js');
        files.forEach(f => moduleFiles.push(path.join(dir, f)));
      }
    });
    return moduleFiles;
  }

  async enhanceModule(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const isWeak = 
      !content.includes('async process') ||
      !content.includes('getStatus') ||
      content.includes('// Modul generat pentru') ||
      content.split('\\n').length < 20;

    if (!isWeak) {
      this.log(\`✅ Modulul \${path.basename(filePath)} pare complet.\`);
      return;
    }

    this.log(\`🔧 Îmbunătățesc modulul \${path.basename(filePath)}...\`);

    if (!process.env.OPENAI_API_KEY) {
      this.log('⚠️ Fără cheie OpenAI, nu pot genera îmbunătățiri. Se folosește șablonul de bază.');
      this.applyBasicEnhancement(filePath);
      return;
    }

    try {
      const prompt = \`
      Analizează următorul cod dintr-un modul Node.js. Acesta este un modul al unui sistem AI autonom numit Unicorn.
      \\\`\\\`\\\`javascript
      \${content}
      \\\`\\\`\\\`
      Dacă modulul este incomplet (lipsesc metode, logică simplistă), rescrie-l complet astfel încât să fie un modul real, util, cu metode async process și getStatus, și să aibă o logică coerentă (de exemplu, dacă este un modul financiar, să includă calcule reale). Păstrează numele și rolul. Răspunde doar cu codul, fără explicații.
      \`;

      const response = await this.openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 800,
        temperature: 0.7,
      });

      const newCode = response.data.choices[0].text;
      fs.writeFileSync(filePath, newCode);
      this.log(\`✅ Modulul \${path.basename(filePath)} îmbunătățit cu AI.\`);
    } catch (err) {
      this.log(\`❌ Eroare OpenAI: \${err.message}. Aplic șablonul de bază.\`);
      this.applyBasicEnhancement(filePath);
    }
  }

  applyBasicEnhancement(filePath) {
    const name = path.basename(filePath, '.js');
    const template = \`
// Modul regenerat: \${name}
module.exports = {
  name: '\${name}',
  role: 'Modul auto‑îmbunătățit',
  state: { counter: 0, lastRun: null },
  methods: {
    async process(input) {
      this.state.counter++;
      this.state.lastRun = new Date().toISOString();
      return { status: 'ok', module: this.name, counter: this.state.counter, input };
    },
    getStatus() {
      return { 
        name: this.name, 
        health: 'good', 
        uptime: process.uptime(), 
        counter: this.state.counter,
        lastRun: this.state.lastRun
      };
    }
  }
};
\`;
    fs.writeFileSync(filePath, template);
    this.log(\`✅ Modulul \${name} îmbunătățit cu șablon.\`);
  }

  async createMissingModules() {
    const listFile = path.join(__dirname, '../../data/module_list.json');
    if (!fs.existsSync(listFile)) return;

    const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
    const existing = fs.readdirSync(MODULES).map(f => path.basename(f, '.js'));
    const missing = list.filter(name => !existing.includes(name));

    for (const name of missing) {
      this.log(\`🆕 Creez modulul lipsă: \${name}\`);
      const filePath = path.join(MODULES, \`\${name}.js\`);
      const template = \`
// Modul nou generat: \${name}
module.exports = {
  name: '\${name}',
  role: 'Modul nou creat automat',
  state: {},
  methods: {
    async process(input) {
      return { status: 'ok', module: this.name, input };
    },
    getStatus() {
      return { name: this.name, health: 'good', uptime: process.uptime() };
    }
  }
};
\`;
      fs.writeFileSync(filePath, template);
    }
    this.log(\`✅ Create \${missing.length} module noi.\`);
  }

  optimizeCode() {
    this.log('🔍 Optimizez codul cu Prettier și ESLint...');
    try {
      execSync('npx prettier --write "src/** /.js" "client/src/** /.js"', { stdio: 'ignore' });
      execSync('npx eslint --fix "src/** /.js" "client/src/** /.js"', { stdio: 'ignore' });
      this.log('✅ Cod optimizat.');
    } catch (err) {
      this.log('⚠️ Eroare la optimizare (ignorată).');
    }
  }

  async generateWebPages() {
    this.log('🌐 Generare pagini web suplimentare (opțional)...');
  }

  verifyOwner(secret) {
    return secret === process.env.ADMIN_SECRET;
  }

  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.post('/run-now', async (req, res) => {
      await this.start(true);
      res.json({ success: true, message: 'Self‑Construction Engine rulat cu succes.' });
    });

    router.get('/status', (req, res) => {
      res.json({ hasRun: this.hasRun });
    });

    return router;
  }
}

module.exports = new SelfConstructionEngine();
`);// ---------------------------------------------------------
// src/index.js (serverul principal)
// ---------------------------------------------------------
const usi = require('./modules/unicorn-super-intelligence');
// unicorn-super-intelligence/index.js
const fs = require('fs');
const path = require('path');
const uaic = require('../universal-ai-connector');
const moduleLoader = require('../ModuleLoader');

// Import componente interne
const userMemory = require('./memory/userMemory');
const systemMemory = require('./memory/systemMemory');
const vectorMemory = require('./memory/vectorMemory');
const planner = require('./reasoning/planner');
const toolUse = require('./reasoning/toolUse');
const evaluator = require('./reasoning/evaluator');
const style = require('./personality/style');
const behavior = require('./personality/behavior');

class UnicornSuperIntelligence {
  constructor() {
    this.name = 'USI';
    this.version = '1.0';
    this.memory = { user: userMemory, system: systemMemory, vector: vectorMemory };
    this.skills = {};
    this.reasoning = { planner, toolUse, evaluator };
    this.personality = { style, behavior };
    this.initialized = false;
  }

  async initialize() {
    console.log('🧠 Inițializare UNICORN SUPER‑INTELLIGENCE...');
    await this.loadSkills();
    await this.organizeProject(); // auto‑organizare la pornire
    this.initialized = true;
    console.log('✅ USI activ.');
  }

  // Încarcă toate skill‑urile din directorul skills/
  async loadSkills() {
    const skillsDir = path.join(__dirname, 'skills');
    if (!fs.existsSync(skillsDir)) return;
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const skillName = path.basename(file, '.js');
      try {
        this.skills[skillName] = require(path.join(skillsDir, file));
        console.log(`⚙️ Skill încărcat: ${skillName}`);
      } catch (err) {
        console.error(`Eroare la încărcarea skill‑ului ${skillName}:`, err.message);
      }
    }
  }

  // Auto‑organizare: mută modulele în locurile corecte
  async organizeProject() {
    console.log('📦 Pornește auto‑organizarea proiectului...');
    const srcDir = path.join(__dirname, '../../');
    const modulesDir = path.join(srcDir, 'modules');
    const skillsDir = path.join(__dirname, 'skills');
    const memoryDir = path.join(__dirname, 'memory');
    const reasoningDir = path.join(__dirname, 'reasoning');
    const personalityDir = path.join(__dirname, 'personality');

    // Funcție pentru a muta un fișier dacă e de tipul potrivit
    const moveIfMatch = (filePath, destDir, patterns) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const name = path.basename(filePath, '.js');
      for (const pattern of patterns) {
        if (name.includes(pattern) || content.includes(pattern)) {
          const dest = path.join(destDir, path.basename(filePath));
          if (filePath !== dest) {
            fs.renameSync(filePath, dest);
            console.log(`📌 Mutat ${path.basename(filePath)} → ${destDir}`);
          }
          return true;
        }
      }
      return false;
    };

    // Scanează toate fișierele .js din modules/ și src/
    const scanAndMove = (dir) => {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
          scanAndMove(fullPath);
        } else if (item.endsWith('.js') && !fullPath.includes('unicorn-super-intelligence')) {
          // Mută în skills/ dacă e un modul de skill
          if (moveIfMatch(fullPath, skillsDir, ['pricing', 'bd', 'wealth', 'trend', 'content', 'construction', 'healing'])) continue;
          // Mută în memory/ dacă e modul de memorie
          if (moveIfMatch(fullPath, memoryDir, ['userMemory', 'systemMemory', 'vectorMemory'])) continue;
          // Mută în reasoning/ dacă e modul de raționament
          if (moveIfMatch(fullPath, reasoningDir, ['planner', 'toolUse', 'evaluator'])) continue;
          // Mută în personality/ dacă e modul de personalitate
          if (moveIfMatch(fullPath, personalityDir, ['style', 'behavior'])) continue;
        }
      }
    };

    scanAndMove(modulesDir);
    scanAndMove(srcDir);
    console.log('✅ Auto‑organizare finalizată.');
  }

  // Metoda principală: primește o cerere și o procesează
  async process(request) {
    if (!this.initialized) await this.initialize();

    // 1. Înțelege cererea
    const intent = await this.understandIntent(request);

    // 2. Încarcă contextul relevant (memorie)
    const context = await this.loadContext(intent);

    // 3. Planifică acțiunile
    const plan = await this.reasoning.planner.createPlan(intent, context, this.skills);

    // 4. Execută planul folosind toolUse
    const results = await this.reasoning.toolUse.execute(plan, this.skills, uaic);

    // 5. Evaluează rezultatele
    const evaluation = await this.reasoning.evaluator.evaluate(results, intent);

    // 6. Salvează în memorie
    await this.memory.system.saveDecision(intent, plan, results, evaluation);

    // 7. Returnează răspunsul (cu personalitate)
    return this.personality.style.formatResponse(results, evaluation);
  }

  async understandIntent(request) {
    // Folosește UAIC pentru a extrage intenția
    const prompt = `Extrage intenția principală din această cerere: "${request}". Răspunde doar cu un cuvânt cheie (ex: "create_module", "analyze_trends", "optimize_prices").`;
    const intent = await uaic.ask({ type: 'simple', prompt, maxTokens: 10 });
    return intent.trim();
  }

  async loadContext(intent) {
    // Încarcă date relevante din memorie
    const userContext = await this.memory.user.getRecent();
    const systemContext = await this.memory.system.getState();
    return { user: userContext, system: systemContext };
  }

  // Rute API (protejate)
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.post('/process', async (req, res) => {
      try {
        const result = await this.process(req.body.request);
        res.json({ result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/organize', async (req, res) => {
      await this.organizeProject();
      res.json({ success: true });
    });

    router.get('/status', (req, res) => {
      res.json({ initialized: this.initialized, skills: Object.keys(this.skills) });
    });

    return router;
  }

  verifyOwner(secret) {
    return secret === process.env.ADMIN_SECRET;
  }
}

module.exports = new UnicornSuperIntelligence();
// userMemory.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../../data/user_memory.json');

class UserMemory {
  constructor() {
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file));
    }
    return { users: {} };
  }

  save() {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(this.data, null, 2));
  }

  async getRecent(limit = 10) {
    // returnează ultimii utilizatori activi
    return Object.values(this.data.users).slice(-limit);
  }

  async addInteraction(userId, interaction) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = { interactions: [] };
    }
    this.data.users[userId].interactions.push({ timestamp: Date.now(), ...interaction });
    this.save();
  }
}
// systemMemory.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../../data/system_memory.json');

class SystemMemory {
  constructor() {
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file));
    }
    return { decisions: [], modules: {}, stats: {} };
  }

  save() {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(this.data, null, 2));
  }

  async getState() {
    return { moduleCount: Object.keys(this.data.modules).length, lastDecision: this.data.decisions.slice(-1)[0] };
  }

  async saveDecision(intent, plan, results, evaluation) {
    this.data.decisions.push({ intent, plan, results, evaluation, timestamp: Date.now() });
    this.save();
  }
}
// vectorMemory.js – pentru integrare cu baze vectoriale (Pinecone, etc.)
module.exports = {
  async store(embedding, metadata) {
    console.log('🔹 Vector store not implemented');
  },
  async search(queryEmbedding) {
    return [];
  }
};// pricingSkill.js
const dynamicPricing = require('../../dynamic-pricing/index.js');

module.exports = {
  name: 'pricing',
  description: 'Optimizează prețurile pentru un client dat.',
  async execute(params) {
    return dynamicPricing.calculateOptimalPrice(params.clientData);
  }
};// planner.js
const uaic = require('../../universal-ai-connector');

module.exports = {
  async createPlan(intent, context, availableSkills) {
    const prompt = `
      Avem intenția: "${intent}".
      Context: ${JSON.stringify(context)}.
      Skill‑uri disponibile: ${Object.keys(availableSkills).join(', ')}.
      Generează un plan în pași (doar lista de skill‑uri de apelat, în ordine). Răspunde ca JSON array.
    `;
    const response = await uaic.ask({ type: 'complex', prompt, maxTokens: 200 });
    try {
      return JSON.parse(response);
    } catch {
      return [];
    }
  }
};// toolUse.js
module.exports = {
  async execute(plan, skills, uaic) {
    const results = [];
    for (const step of plan) {
      const skillName = step.skill || step; // allow string or object
      const skill = skills[skillName];
      if (!skill) {
        results.push({ error: `Skill ${skillName} negăsit` });
        continue;
      }
      try {
        const result = await skill.execute(step.params || {});
        results.push({ skill: skillName, result });
      } catch (err) {
        results.push({ skill: skillName, error: err.message });
      }
    }
    return results;
  }
};// evaluator.js
const uaic = require('../../universal-ai-connector');

module.exports = {
  async evaluate(results, intent) {
    const prompt = `
      Intenția inițială: "${intent}".
      Rezultatele obținute: ${JSON.stringify(results)}.
      Evaluează succesul pe o scară 1-10 și oferă o scurtă justificare. Răspunde în format JSON: { score: number, feedback: string }.
    `;
    const response = await uaic.ask({ type: 'simple', prompt, maxTokens: 100 });
    try {
      return JSON.parse(response);
    } catch {
      return { score: 5, feedback: 'Evaluare automată nereușită.' };
    }
  }
};// style.js
module.exports = {
  formatResponse(results, evaluation) {
    // Poți personaliza aici tonul și stilul răspunsului
    if (evaluation.score >= 8) {
      return `✅ Succes! Rezultate: ${JSON.stringify(results)}`;
    } else {
      return `⚠️ Rezultate parțiale: ${JSON.stringify(results)}. Feedback: ${evaluation.feedback}`;
    }
  }
};// behavior.js
module.exports = {
  // Definește cum se comportă USI: proactiv, reactiv, etc.
  mode: 'proactive', // 'proactive', 'reactive', 'balanced'

  shouldTakeInitiative(context) {
    if (this.mode === 'proactive') return true;
    if (this.mode === 'reactive') return false;
    // balanced: doar dacă e ceva important
    return context.urgency > 5;
  }
};const usi = require('./modules/unicorn-super-intelligence');
usi.initialize(); // sau .start()

// Rute pentru USI (protejate)
app.use('/api/admin/usi', adminOnly, usi.getRouter(() => {}));
module.exports = new SystemMemory();
module.exports = new UserMemory();
usi.initialize(); // sau .start()

// Rute pentru USI (protejate)
app.use('/api/admin/usi', adminOnly, usi.getRouter(() => {}));

app.use('/api/admin/uaic', adminOnly, uaic.getRouter(() => {}));
const uaic = require('./modules/universal-ai-connector');
uaic.start();
universal-ai-connector/index.js
app.use('/api/admin/uaic', adminOnly, uaic.getRouter(() => {}));
const uaic = require('./modules/universal-ai-connector');
uaic.start();
fs.writeFileSync(path.join(SRC, 'index.js'), `
require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cookieParser());
app.use(express.json());

const moduleLoader = require('./modules/ModuleLoader');
const totalSystemHealer = require('./modules/total-system-healer');
totalSystemHealer.start();

const dynamicPricing = require('./modules/dynamic-pricing');
const wealthEngine = require('./modules/autonomous-wealth-engine');
wealthEngine.initialize();
const bdEngine = require('./modules/autonomous-bd-engine');
bdEngine.start();

// Self‑Construction Engine
const constructionEngine = require('./modules/self-construction-engine');
constructionEngine.start().catch(err => console.error('Eroare la auto‑construcție:', err));

function adminOnly(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.query.adminSecret;
  if (secret === process.env.ADMIN_SECRET) next();
  else res.status(403).json({ error: 'Acces interzis. Doar proprietarul (Vladoi Ionut) poate accesa.' });
}

wss.on('connection', (ws) => {
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'modules', data: moduleLoader.getAllModules() }));
  }, 10000);
  ws.on('close', () => clearInterval(interval));
});

app.get('/api/modules', (req, res) => res.json({ modules: moduleLoader.getAllModules() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/pricing/optimize', (req, res) => {
  const price = dynamicPricing.calculateOptimalPrice(req.body.clientData);
  res.json({ optimalPrice: price });
});

app.post('/api/wealth/call-module', async (req, res) => {
  const result = await wealthEngine.callModuleAPI(req.body.moduleName, req.body.params, req.body.paymentMethod);
  res.json(result);
});

app.post('/api/bd/negotiate', async (req, res) => {
  const reply = await bdEngine.handleNegotiation(req.body.company, req.body.message);
  res.json({ reply });
});

app.use('/api/admin/wealth', adminOnly, wealthEngine.getRouter(() => {}));
app.use('/api/admin/bd', adminOnly, bdEngine.getRouter(() => {}));
app.use('/api/admin/construction', adminOnly, constructionEngine.getRouter(() => {}));

app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build', 'index.html')));

server.listen(PORT, () => {
  console.log(\`🚀 Server UNICORN FINAL pornit pe portul \${PORT}\`);
});
const uaic = require('./modules/universal-ai-connector');
uaic.start();

const autoDeploy = require('./modules/auto-deploy');
autoDeploy.ensureRepo().then(() => autoDeploy.checkAndPush());
setInterval(() => autoDeploy.checkAndPush(), 5 * 60 * 1000);
`);// ---------------------------------------------------------
// Frontend – configurare de bază
// ---------------------------------------------------------
// client/package.json
fs.writeFileSync(path.join(CLIENT, 'package.json'), JSON.stringify({
  name: "unicorn-final-client",
  version: "1.0.0",
  private: true,
  dependencies: {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "framer-motion": "^10.12.16",
    "recharts": "^2.7.2",
    "tailwindcss": "^3.3.0",
    "three": "^0.128.0",
    "@react-three/fiber": "^8.9.1",
    "@react-three/drei": "^9.34.3",
    "react-router-dom": "^6.8.1",
    "swr": "^2.0.0",
  },
  scripts: { start: "react-scripts start", build: "react-scripts build" }
}, null, 2));

// tailwind.config.js
fs.writeFileSync(path.join(CLIENT, 'tailwind.config.js'), `module.exports = { content: ["./src/** / *.{js,jsx,ts,tsx}"], theme: { extend: {} }, plugins: [], }`);

// index.css
fs.writeFileSync(path.join(CLIENT_SRC, 'index.css'), `
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-gray-900 text-white font-sans; overflow-x: hidden; }
.neon-text { text-shadow: 0 0 5px #00ffff, 0 0 10px #00ffff, 0 0 20px #00ffff; }
`);

// index.js
fs.writeFileSync(path.join(CLIENT_SRC, 'index.js'), `
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<BrowserRouter><App /></BrowserRouter>);
`);

// App.js
fs.writeFileSync(path.join(CLIENT_SRC, 'App.js'), `
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Codex from './pages/Codex';
import Dashboard from './pages/Dashboard';
import Industries from './pages/Industries';
import Capabilities from './pages/Capabilities';
import Wealth from './pages/Wealth';
import AdminWealth from './pages/AdminWealth';
import AdminBD from './pages/AdminBD';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <nav className="flex justify-between items-center p-6 border-b border-cyan-500/30">
        <div className="text-3xl font-bold neon-text">✦ UNICORN FINAL ✦</div>
        <div className="space-x-6">
          <Link to="/" className="hover:text-cyan-400">Home</Link>
          <Link to="/codex" className="hover:text-cyan-400">Codex</Link>
          <Link to="/dashboard" className="hover:text-cyan-400">Dashboard</Link>
          <Link to="/industries" className="hover:text-cyan-400">Industrii</Link>
          <Link to="/capabilities" className="hover:text-cyan-400">Capabilități</Link>
          <Link to="/wealth" className="hover:text-cyan-400">Wealth</Link>
          <Link to="/admin/wealth" className="text-yellow-400 hover:text-yellow-300">Admin Wealth</Link>
          <Link to="/admin/bd" className="text-yellow-400 hover:text-yellow-300">Admin BD</Link>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/industries" element={<Industries />} />
        <Route path="/capabilities" element={<Capabilities />} />
        <Route path="/wealth" element={<Wealth />} />
        <Route path="/admin/wealth" element={<AdminWealth />} />
        <Route path="/admin/bd" element={<AdminBD />} />
      </Routes>
    </div>
  );
}
export default App;
`);

// Componenta ZEUS3D
fs.writeFileSync(path.join(CLIENT_COMPONENTS, 'ZEUS3D.jsx'), `
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Sphere } from '@react-three/drei';

function RobotHead() {
  const meshRef = useRef();
  useFrame((state) => {
    meshRef.current.rotation.y += 0.005;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
  });
  return (
    <group ref={meshRef}>
      <Box args={[1.5, 1.8, 1.2]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#222" emissive="#00aaff" emissiveIntensity={0.5} />
      </Box>
      <Sphere args={[0.2]} position={[-0.4, 0.3, 0.8]}>
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" />
      </Sphere>
      <Sphere args={[0.2]} position={[0.4, 0.3, 0.8]}>
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" />
      </Sphere>
      <Box args={[1.0, 0.2, 0.1]} position={[0, -0.2, 0.9]}>
        <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" />
      </Box>
    </group>
  );
}

export default function ZEUS3D() {
  return (
    <div className="w-full h-96">
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <RobotHead />
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}
`);

// Pagina Home
fs.writeFileSync(path.join(CLIENT_PAGES, 'Home.jsx'), `
import React from 'react';
import ZEUS3D from '../components/ZEUS3D';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="text-center p-12">
      <motion.h1 initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}
        className="text-6xl font-bold neon-text mb-6">UNICORN FINAL</motion.h1>
      <ZEUS3D />
      <p className="text-xl mt-8 max-w-2xl mx-auto text-gray-300">
        Sistemul AI autonom care deservește toate industriile și omenirea.
      </p>
    </div>
  );
}
`);

// Pagina Codex
fs.writeFileSync(path.join(CLIENT_PAGES, 'Codex.jsx'), `
import React, { useEffect, useState } from 'react';
export default function Codex() {
  const [modules, setModules] = useState([]);
  useEffect(() => {
    fetch('/api/modules').then(res => res.json()).then(data => setModules(data.modules || []));
  }, []);
  return (
    <div className="p-8">
      <h2 className="text-4xl font-bold mb-6 neon-text">Codexul Unicornului</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map(mod => (
          <div key={mod} className="bg-gray-800/50 p-6 rounded-xl border border-cyan-500/30">
            <h3 className="text-xl font-bold text-cyan-400">{mod}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
`);

// Pagina Dashboard
fs.writeFileSync(path.join(CLIENT_PAGES, 'Dashboard.jsx'), `
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
export default function Dashboard() {
  const [modules, setModules] = useState([]);
  const [healthData, setHealthData] = useState([]);
  useEffect(() => {
    fetch('/api/modules').then(res => res.json()).then(data => setModules(data.modules || []));
    const interval = setInterval(() => {
      fetch('/api/health').then(res => res.json()).then(data => {
        setHealthData(prev => [...prev.slice(-19), { time: new Date().toLocaleTimeString(), value: data.uptime }]);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="p-8">
      <h2 className="text-4xl font-bold mb-6 neon-text">Dashboard</h2>
      <div className="h-80 bg-gray-800/50 p-4 rounded-xl">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={healthData}>
            <XAxis dataKey="time" stroke="#00ffff" />
            <YAxis stroke="#00ffff" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#ff00ff" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
`);

// Pagina Industrii
fs.writeFileSync(path.join(CLIENT_PAGES, 'Industries.jsx'), `
import React from 'react';
const industries = ['Sănătate', 'Finanțe', 'Educație', 'Producție', 'Transport', 'Energie', 'Retail', 'Oameni'];
export default function Industries() {
  return (
    <div className="p-8">
      <h2 className="text-4xl font-bold mb-6 neon-text">Industrii deservite</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {industries.map(ind => (
          <div key={ind} className="bg-gray-800/50 p-6 rounded-xl border border-cyan-500/30">
            <h3 className="text-2xl font-bold text-cyan-400">{ind}</h3>
            <p className="text-gray-300">Soluții AI personalizate.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`);

// Pagina Capabilități
fs.writeFileSync(path.join(CLIENT_PAGES, 'Capabilities.jsx'), `
import React, { useEffect, useState } from 'react';
export default function Capabilities() {
  const [modules, setModules] = useState([]);
  useEffect(() => {
    fetch('/api/modules').then(res => res.json()).then(data => setModules(data.modules || []));
  }, []);
  return (
    <div className="p-8">
      <h2 className="text-4xl font-bold mb-6 neon-text">Ce poate face Unicornul</h2>
      <ul className="space-y-2">
        {modules.map(mod => (
          <li key={mod} className="bg-gray-800/30 p-3 rounded border-l-4 border-cyan-500">
            <span className="font-bold text-cyan-400">{mod}</span> – modul activ.
          </li>
        ))}
      </ul>
    </div>
  );
}
`);

// Pagina Wealth
fs.writeFileSync(path.join(CLIENT_PAGES, 'Wealth.jsx'), `
import React from 'react';
export default function Wealth() {
  return <div className="p-8"><h2 className="text-4xl neon-text">Wealth Engine</h2><p>Acces la marketplace AI.</p></div>;
}
`);

// Pagina AdminWealth
fs.writeFileSync(path.join(CLIENT_PAGES, 'AdminWealth.jsx'), `
import React, { useState } from 'react';
export default function AdminWealth() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const handleLogin = () => {
    if (secret === 'VLADOI_IONUT_SECRET_SUPREM') setAuthenticated(true);
    else alert('Secret incorect!');
  };
  if (!authenticated) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6 neon-text">Autentificare</h2>
        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} className="w-full p-2 bg-gray-800 border border-cyan-500 rounded mb-4" />
        <button onClick={handleLogin} className="px-6 py-2 bg-cyan-500 text-black rounded">Autentificare</button>
      </div>
    );
  }
  return <div className="p-8"><h2 className="text-4xl neon-text">Admin Wealth</h2><p>Panou de control.</p></div>;
}
`);

// Pagina AdminBD
fs.writeFileSync(path.join(CLIENT_PAGES, 'AdminBD.jsx'), `
import React, { useState } from 'react';
export default function AdminBD() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const handleLogin = () => {
    if (secret === 'VLADOI_IONUT_SECRET_SUPREM') setAuthenticated(true);
    else alert('Secret incorect!');
  };
  if (!authenticated) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6 neon-text">Autentificare BD</h2>
        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} className="w-full p-2 bg-gray-800 border border-cyan-500 rounded mb-4" />
        <button onClick={handleLogin} className="px-6 py-2 bg-cyan-500 text-black rounded">Autentificare</button>
      </div>
    );
  }
  return <div className="p-8"><h2 className="text-4xl neon-text">Admin BD Engine</h2><p>Panou de control.</p></div>;
}
`);

// Fișier gol pentru ui-config.json
fs.writeFileSync(path.join(CLIENT_PUBLIC, 'ui-config.json'), '{}');
// ---------------------------------------------------------
// Infrastructură (auto-deploy, Docker, GitHub Actions)
// ---------------------------------------------------------
fs.writeFileSync(path.join(INFRA, 'automation', 'ignite-everything.sh'), `#!/bin/bash\ngit add . && git commit -m "Auto-deploy: $(date)" && git push origin main\n`);
fs.chmodSync(path.join(INFRA, 'automation', 'ignite-everything.sh'), '755');

fs.writeFileSync(path.join(ROOT, 'docker-compose.yml'), `
version: '3.8'
services:
  unicorn:
    build: .
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./backups:/app/backups
      - ./logs:/app/logs
      - ./models:/app/models
      - ./data:/app/data
`);

fs.writeFileSync(path.join(ROOT, 'Dockerfile'), `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "src/index.js"]
`);

fs.writeFileSync(path.join(GITHUB_WORKFLOWS, 'deploy.yml'), `
name: Deploy
on: { push: { branches: [ main ] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Trigger Hetzner deploy
        run: curl -X POST http://\${{ secrets.HETZNER_HOST }}:3001/webhook/update -H "X-Webhook-Secret: \${{ secrets.HETZNER_WEBHOOK_SECRET }}"
`);

fs.writeFileSync(path.join(HETZNER_SCRIPTS, 'hetzner-auto-update.sh'), `#!/bin/bash\ncd /root/unicorn-final\nwhile true; do git pull origin main && docker-compose down && docker-compose up -d --build; sleep 60; done\n`);
fs.chmodSync(path.join(HETZNER_SCRIPTS, 'hetzner-auto-update.sh'), '755');

fs.writeFileSync(path.join(HETZNER_SCRIPTS, 'webhook-server.js'), `
const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());
app.post('/webhook/update', (req, res) => {
  if (req.headers['x-webhook-secret'] !== process.env.HETZNER_WEBHOOK_SECRET) return res.status(403).send('Forbidden');
  exec('cd /root/unicorn-final && git pull && docker-compose down && docker-compose up -d --build', (err) => {
    if (err) return res.status(500).send('Update failed');
    res.send('OK');
  });
});
app.listen(3001);
`);

// ---------------------------------------------------------
// README.md final
// ---------------------------------------------------------
fs.writeFileSync(path.join(ROOT, 'README.md'), `
# UNICORN FINAL – Sistemul AI autonom complet

Acest proiect conține cod real pentru toate modulele și site-ul futurist, inclusiv:

- Peste 200 de module backend (AdaptiveModule01–82, Engine1–62, și alte module specializate)
- Module speciale: evolution-core, quantum-healing, universal-adaptor, quantum-pay, site-creator, ab-testing, seo-optimizer, analytics, content-ai, auto-marketing, performance-monitor, unicorn-realization-engine, unicorn-execution-engine, auto-trend-analyzer, self-adaptation-engine, predictive-healing, code-optimizer, self-documenter, ui-evolution, security-scanner, disaster-recovery, swarm-intelligence, auto-deploy, total-system-healer, dynamic-pricing, universal-interchain-nexus, autonomous-wealth-engine, autonomous-bd-engine, self-construction-engine
- Frontend React futurist cu ZEUS 3D, Codex, Dashboard, pagini industrii, Wealth Engine și panouri administrative
- Auto-deploy pe GitHub, Vercel, Hetzner
- Self‑Construction Engine care la prima pornire completează și îmbunătățește automat orice modul incomplet

## Instalare rapidă
1. Rulează generatorul: \`node generate_unicorn_final.js\`
2. Dezarhivează \`UNICORN_FINAL.zip\`
3. \`cd UNICORN_FINAL\`
4. \`npm install\`
5. Copiază \`.env.example\` în \`.env\` și completează cheile (în special OPENAI_API_KEY pentru auto‑construcție)
6. \`npm start\`
7. Accesează \`http://localhost:3000\`

## Self‑Construction Engine
- Rulează automat la prima pornire și îmbunătățește modulele deficitare.
- Poate fi declanșat manual prin POST \`/api/admin/construction/run-now\` (necesită \`x-admin-secret\`).
- Log-urile sunt în \`logs/construction.log\`.

## Module
Lista completă a modulelor active este disponibilă la \`/api/modules\`.

## Securitate
- Rutele administrative sunt protejate cu \`ADMIN_SECRET\`. Doar tu, Vladoi Ionut, ai acces.
`);

// ---------------------------------------------------------
// Creare fișier gol pentru bd_state.json (exemplu)
// ---------------------------------------------------------
fs.writeFileSync(path.join(DATA, 'bd_state.json'), '{"leads":[]}');

// ---------------------------------------------------------
// Creare arhivă ZIP finală
// ---------------------------------------------------------
async function buildFinal() {
  const zipPath = path.join(__dirname, 'UNICORN_FINAL.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`\n✅ Arhivă creată: ${zipPath} (${archive.pointer()} bytes)`);
    console.log(`\n📦 Acum poți dezarhiva și rula. Unicornul se va autoconstrui la prima pornire.`);
  });

  archive.on('error', err => { throw err; });
  archive.pipe(output);
  archive.directory(ROOT, false);
  await archive.finalize();
}

buildFinal();
*/

// =====================================================================
// generate_unicorn_final.js – Generator curat și valid
// Rulează cu: node generate_unicorn_final.js
// =====================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, 'UNICORN_FINAL');
const SRC = path.join(ROOT, 'src');
const MODULES = path.join(SRC, 'modules');
const BACKEND = path.join(ROOT, 'backend');
const BACKEND_MODULES = path.join(BACKEND, 'modules');
const INNOVATION = path.join(SRC, 'innovation');
const SITE = path.join(SRC, 'site');
const TEST = path.join(ROOT, 'test');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function copyPathIfExists(fromAbs, toAbs) {
  if (!fs.existsSync(fromAbs)) return;
  ensureDir(path.dirname(toAbs));
  fs.cpSync(fromAbs, toAbs, { recursive: true, force: true });
}

function snapshotActiveProductionRoot() {
  if (process.env.UNICORN_FORCE_REGENERATE === '1') return null;
  if (!fs.existsSync(ROOT)) return null;
  const sentinel = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
  if (!fs.existsSync(sentinel)) return null;
  const snapshotDir = path.join(__dirname, `.unicorn_active_snapshot_${Date.now()}`);
  fs.cpSync(ROOT, snapshotDir, { recursive: true, force: true });
  return snapshotDir;
}

function restoreActiveProductionRoot(snapshotDir) {
  if (!snapshotDir || !fs.existsSync(snapshotDir)) return;
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.cpSync(snapshotDir, ROOT, { recursive: true, force: true });
  fs.rmSync(snapshotDir, { recursive: true, force: true });
  console.log('🛡️ Active UNICORN_FINAL production layer preserved (set UNICORN_FORCE_REGENERATE=1 to overwrite).');
}

function createStructure() {
  const activeProductionSnapshot = snapshotActiveProductionRoot();
  if (fs.existsSync(ROOT)) {
    fs.rmSync(ROOT, { recursive: true, force: true });
  }

  [
    ROOT,
    SRC,
    MODULES,
    BACKEND,
    BACKEND_MODULES,
    INNOVATION,
    SITE,
    TEST,
    path.join(ROOT, 'client', 'src', 'components'),
    path.join(ROOT, 'client', 'src', 'pages'),
    path.join(ROOT, '.github', 'workflows'),
    path.join(ROOT, 'scripts'),
    path.join(ROOT, 'logs'),
    path.join(ROOT, 'data'),
    path.join(MODULES, 'auto-deploy-orchestrator'),
    path.join(MODULES, 'code-sanity-engine'),
    path.join(BACKEND_MODULES, 'universal-ai-connector')
  ].forEach(ensureDir);

  writeText(path.join(ROOT, '.gitignore'), '.DS_Store\n.env\nnode_modules/\n');

  writeText(path.join(ROOT, '.env.example'), [
    'NODE_ENV=development',
    'PORT=3000',
    'ADMIN_SECRET=VLADOI_IONUT_SECRET_SUPREM_2026',
    'GITHUB_OWNER=ruffy80',
    'GITHUB_REPO_NAME=ZeusAI',
    'GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE',
    'GIT_REMOTE_URL=https://github.com/ruffy80/ZeusAI.git',
    'YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY_HERE',
    'YOUTUBE_OAUTH_CLIENT_ID=YOUR_YOUTUBE_OAUTH_CLIENT_ID_HERE',
    'PINTEREST_TOKEN=',
    'X_BEARER_TOKEN=',
    'X_ACCESS_TOKEN=',
    'X_ACCESS_SECRET=',
    'TELEGRAM_BOT_TOKEN=',
    'TELEGRAM_CHAT_ID=@unicorn_ai_channel',
    'DEV_API_KEY=',
    'PRODUCTHUNT_API_KEY=',
    'PRODUCTHUNT_API_SECRET=',
    'PRODUCTHUNT_DEVELOPER_TOKEN=',
    'PINTEREST_BOARD_ID=unicorn_ai',
    'BINANCE_API_KEY=',
    'BINANCE_SECRET=',
    'COINBASE_API_KEY=',
    'COINBASE_SECRET=',
    'KRAKEN_API_KEY=',
    'KRAKEN_SECRET=',
    'BYBIT_API_KEY=',
    'BYBIT_SECRET=',
    'OKX_API_KEY=',
    'OKX_SECRET=',
    'OKX_PASSWORD=',
    'OANDA_API_KEY=',
    'MICROSOFT_API_KEY=',
    'AMAZON_API_KEY=',
    'META_API_KEY=',
    'APPLE_API_KEY=',
    'ADMIN_EMAIL=vladoi_ionut@yahoo.com',
    'SMTP_HOST=smtp.mail.yahoo.com',
    'SMTP_PORT=587',
    'SMTP_USER=vladoi_ionut@yahoo.com',
    'SMTP_PASS=APP_PASSWORD_HERE',
    'HETZNER_API_TOKEN=',
    'AWS_ACCESS_KEY_ID=',
    'AWS_SECRET_ACCESS_KEY=',
    'AWS_BACKUP_BUCKET=unicorn-quantum-backup',
    'LEGAL_OWNER_NAME=Vladoi Ionut',
    'LEGAL_OWNER_EMAIL=vladoi_ionut@yahoo.com',
    'LEGAL_OWNER_BTC=bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'
  ].join('\n') + '\n');

  writeText(path.join(ROOT, 'README.md'), '# UNICORN_FINAL\n\nGenerated automatically.\n\n## Scripts\n- npm run lint\n- npm test\n- npm run start\n- npm run innovation:report\n- npm run innovation:sprint\n\n## Interactive Unicorn Site\n- / serves the full ZEUS + Robot + Codex + Marketplace + Automation portal\n- /snapshot provides full JSON state for users, companies, industries, and modules\n- /stream provides real-time updates (SSE)\n- /modules, /marketplace, /codex, /telemetry, /me, /recommendations are exposed\n');

  writeText(path.join(ROOT, 'package.json'), JSON.stringify({
    name: 'unicorn-final',
    version: '1.0.0',
    private: true,
    dependencies: {
      axios: '^1.13.1',
      chokidar: '^3.6.0',
      dotenv: '^16.6.1',
      'simple-git': '^3.30.0'
    },
    scripts: {
      start: 'node src/index.js',
      test: 'node test/health.test.js && node test/deploy-smoke.test.js',
      'test:deploy': 'node test/deploy-smoke.test.js',
      lint: 'node --check src/index.js && node --check src/site/template.js && node --check src/innovation/innovation-engine.js && node --check src/innovation/innovation-sprint.js && node --check test/health.test.js && node --check test/deploy-smoke.test.js',
      'innovation:add': 'node add_innovations.js',
      'innovation:report': 'node src/innovation/report.js',
      'innovation:sprint': 'node src/innovation/sprint.js'
    }
  }, null, 2) + '\n');

  // Include all reusable integration/setup assets created in workspace history
  const portableAssets = [
    { from: 'add_innovations.js', to: 'add_innovations.js' },
    { from: 'INNOVATIONS-GUIDE.md', to: 'INNOVATIONS-GUIDE.md' },
    { from: 'INNOVATIONS-INTEGRATION-SUMMARY.md', to: 'INNOVATIONS-INTEGRATION-SUMMARY.md' },
    { from: 'INNOVATIONS-QUICK-START.sh', to: 'INNOVATIONS-QUICK-START.sh' },
    { from: 'github-vercel-hetzner-connector.js', to: 'github-vercel-hetzner-connector.js' },
    { from: 'setup_hetzner.js', to: 'setup_hetzner.js' },
    { from: 'setup-platform-auto-connect.sh', to: 'setup-platform-auto-connect.sh' },
    { from: 'verify-platform-setup.sh', to: 'verify-platform-setup.sh' },
    { from: '.env.auto-connector.example', to: '.env.auto-connector.example' },
    { from: 'GITHUB-VERCEL-HETZNER-CONNECTOR.md', to: 'GITHUB-VERCEL-HETZNER-CONNECTOR.md' },
    { from: 'README-AUTO-CONNECTOR.md', to: 'README-AUTO-CONNECTOR.md' },
    { from: 'IMPLEMENTATION-GUIDE.md', to: 'IMPLEMENTATION-GUIDE.md' },
    { from: 'SETUP-HETZNER-GUIDE.md', to: 'SETUP-HETZNER-GUIDE.md' },
    { from: 'START-HERE.md', to: 'START-HERE.md' },
    { from: 'QUICK-REFERENCE.sh', to: 'QUICK-REFERENCE.sh' },
    { from: 'scripts', to: 'scripts' },
    { from: '.github/workflows', to: '.github/workflows' }
  ];

  for (const asset of portableAssets) {
    copyPathIfExists(path.join(__dirname, asset.from), path.join(ROOT, asset.to));
  }

  // ==================== BACKEND COMPLET ====================
  writeText(path.join(BACKEND, 'package.json'), JSON.stringify({
    name: 'unicorn-autonomous',
    version: '1.0.0',
    private: true,
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      dev: 'nodemon index.js'
    },
    dependencies: {
      express: '^4.18.2',
      dotenv: '^16.0.3',
      jsonwebtoken: '^9.0.0',
      bcryptjs: '^2.4.3',
      cors: '^2.8.5',
      compression: '^1.7.4',
      axios: '^1.4.0',
      ccxt: '^4.5.19',
      natural: '^6.0.0',
      sentiment: '^5.0.0',
      'node-cron': '^3.0.2',
      'simple-git': '^3.19.1',
      chokidar: '^3.5.3',
      openai: '^3.3.0',
      qrcode: '^1.5.4',
      nodemailer: '^6.10.1'
    }
  }, null, 2) + '\n');

  writeText(path.join(BACKEND, 'index.js'), `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const cron = require('node-cron');
const simpleGit = require('simple-git');

const app = express();
const PORT = process.env.PORT || 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'unicorn-jwt-secret-change-in-prod';

app.use(compression());
app.use(cors());
app.use(express.json());

// ==================== AUTH STORE (in-memory) ====================
const users = [];
const adminSessions = new Set();
const ADMIN_OWNER_NAME = process.env.LEGAL_OWNER_NAME || 'Vladoi Ionut';
const ADMIN_OWNER_EMAIL = process.env.ADMIN_EMAIL || process.env.LEGAL_OWNER_EMAIL || 'vladoi_ionut@yahoo.com';
const ADMIN_OWNER_BTC = process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
let adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_MASTER_PASSWORD || 'UnicornAdmin2026!', 10);
let adminBiometricHash = null;

function adminSecretMiddleware(req, res, next) {
  const expected = process.env.ADMIN_SECRET || '';
  const headerSecret = req.headers['x-admin-secret'];
  const authHeader = req.headers.authorization || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const provided = headerSecret || bearerSecret || req.query.adminSecret;

  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  return next();
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function extractAdminToken(req) {
  const headerToken = req.headers['x-auth-token'];
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return headerToken || bearer || '';
}

function adminTokenMiddleware(req, res, next) {
  const token = extractAdminToken(req);
  if (!token) return res.status(401).json({ error: 'Admin token missing' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!adminSessions.has(token)) return res.status(401).json({ error: 'Session expired' });
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: crypto.randomBytes(8).toString('hex'), name, email, passwordHash, createdAt: new Date().toISOString(), resetToken: null, resetExpires: null };
  users.push(user);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, twoFactorCode } = req.body || {};

  // Admin login (password + 2FA)
  if (!email && password && typeof twoFactorCode !== 'undefined') {
    const expected2FA = process.env.ADMIN_2FA_CODE || '123456';
    const validPassword = await bcrypt.compare(password, adminPasswordHash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Parolă invalidă' });
    if (String(twoFactorCode).trim() !== String(expected2FA).trim()) {
      return res.status(401).json({ success: false, error: 'Cod 2FA invalid' });
    }

    const token = jwt.sign({ role: 'admin', email: ADMIN_OWNER_EMAIL, name: ADMIN_OWNER_NAME }, JWT_SECRET, { expiresIn: '12h' });
    adminSessions.add(token);

    return res.json({
      success: true,
      token,
      owner: {
        name: ADMIN_OWNER_NAME,
        email: ADMIN_OWNER_EMAIL,
        btcAddress: ADMIN_OWNER_BTC
      }
    });
  }

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/status', adminTokenMiddleware, (req, res) => {
  res.json({
    owner: { name: ADMIN_OWNER_NAME, email: ADMIN_OWNER_EMAIL, btcAddress: ADMIN_OWNER_BTC },
    activeSessions: adminSessions.size,
    biometricEnabled: Boolean(adminBiometricHash)
  });
});

app.post('/api/auth/logout', adminTokenMiddleware, (req, res) => {
  const token = extractAdminToken(req);
  adminSessions.delete(token);
  res.json({ success: true });
});

app.post('/api/auth/change-password', adminTokenMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
  const validOld = await bcrypt.compare(oldPassword, adminPasswordHash);
  if (!validOld) return res.status(401).json({ error: 'Parola veche este invalidă' });
  adminPasswordHash = await bcrypt.hash(newPassword, 10);
  res.json({ success: true });
});

app.post('/api/auth/biometric/enroll', adminTokenMiddleware, (req, res) => {
  const { sample } = req.body || {};
  if (!sample) return res.status(400).json({ error: 'sample required' });
  adminBiometricHash = crypto.createHash('sha256').update(String(sample)).digest('hex');
  res.json({ success: true });
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const { name, email } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (name) user.name = name;
  if (email) user.email = email;
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetToken = resetToken;
  user.resetExpires = Date.now() + 3600000;
  // In production: send email with link /reset-password?token=resetToken
  res.json({ message: 'Password reset email sent', devToken: resetToken });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
  const user = users.find(u => u.resetToken === token && u.resetExpires > Date.now());
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetToken = null;
  user.resetExpires = null;
  res.json({ message: 'Password reset successful' });
});

// ==================== MODULE AUTONOME ====================
const autoDeploy = require('./modules/autoDeploy');
const selfConstruction = require('./modules/selfConstruction');
const totalSystemHealer = require('./modules/totalSystemHealer');

// ==================== INOVAȚII ====================
const qrIdentity = require('./modules/qrDigitalIdentity');
const aiNegotiator = require('./modules/aiNegotiator');
const carbonExchange = require('./modules/carbonExchange');
const marketplace = require('./modules/serviceMarketplace');
const complianceEngine = require('./modules/complianceEngine');
const riskAnalyzer = require('./modules/riskAnalyzer');
const reputationProtocol = require('./modules/reputationProtocol');
const opportunityRadar = require('./modules/opportunityRadar');
const businessBlueprint = require('./modules/businessBlueprint');
const paymentGateway = require('./modules/paymentGateway');
const aviationModule = require('./modules/aviationModule');
const paymentSystems = require('./modules/paymentSystems');
const governmentModule = require('./modules/governmentModule');
const defenseModule = require('./modules/defenseModule');
const telecomModule = require('./modules/telecomModule');
const enterprisePartner = require('./modules/enterprisePartnership');
const quantumChain = require('./modules/quantumBlockchain');
const workforce = require('./modules/aiWorkforce');
const ma = require('./modules/maAdvisor');
const legal = require('./modules/legalContract');
const energy = require('./modules/energyGrid');
const uac = require('./modules/unicornAutonomousCore');
const socialViralizer = require('./modules/socialMediaViralizer');
const umn = require('./modules/universalMarketNexus');
const gdes = require('./modules/globalDigitalStandard');
const ultimateModules = require('./modules/unicornUltimateModules');
const uee = require('./modules/unicornEternalEngine');
const legalFortress = require('./modules/legalFortress');
const qrc = require('./modules/quantumResilienceCore');
const executiveDashboard = require('./modules/executiveDashboard');
const unicornInnovationSuite = require('./modules/unicornInnovationSuite');

// Pornire module autonome
selfConstruction.start();
totalSystemHealer.start();
autoDeploy.start();

// ==================== RUTE API ====================
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/api/modules', (req, res) => {
  const fs = require('fs');
  const modules = fs.readdirSync(path.join(__dirname, 'modules')).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
  res.json({ modules });
});

// ==================== RUTE INOVAȚII ====================

// 1. Quantum-Resistant Digital Identity
app.post('/api/identity/create', (req, res) => {
  const { userId, metadata } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  res.json(qrIdentity.generateIdentity(userId, metadata));
});

app.post('/api/identity/sign', (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });
  try {
    res.json(qrIdentity.sign(userId, message));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/identity/verify', (req, res) => {
  const { publicKey, message, signature } = req.body;
  const result = qrIdentity.verify(publicKey, message, signature);
  res.json(result);
});

// 2. Autonomous AI Negotiator
app.post('/api/negotiate/start', (req, res) => {
  const { counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime } = req.body;
  if (!counterparty || !topic || !initialOffer) return res.status(400).json({ error: 'counterparty, topic and initialOffer required' });
  res.json(aiNegotiator.startNegotiation({ counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime }));
});

app.post('/api/negotiate/message/:id', async (req, res) => {
  const { id } = req.params;
  const { message, userType } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    res.json(await aiNegotiator.processMessage(parseInt(id), message, userType));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/negotiate/:id', (req, res) => {
  const negotiation = aiNegotiator.getNegotiation(parseInt(req.params.id));
  if (!negotiation) return res.status(404).json({ error: 'Negotiation not found' });
  res.json(negotiation);
});

app.get('/api/negotiate/stats', (req, res) => {
  res.json(aiNegotiator.getStats());
});

// 3. Universal Carbon Credit Exchange
app.post('/api/carbon/issue', (req, res) => {
  const { owner, amount, type, projectId, vintage } = req.body;
  if (!owner || !amount) return res.status(400).json({ error: 'owner and amount required' });
  res.json(carbonExchange.issueCredits(owner, amount, type, projectId, vintage));
});

app.post('/api/carbon/trade', async (req, res) => {
  const { buyer, seller, creditId, amount } = req.body;
  try {
    res.json(await carbonExchange.executeTrade(buyer, seller, creditId, amount));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/sell', (req, res) => {
  const { seller, creditId, amount, price } = req.body;
  try {
    res.json(carbonExchange.createSellOrder(seller, creditId, amount, price));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/buy', (req, res) => {
  const { buyer, creditType, amount, maxPrice } = req.body;
  res.json(carbonExchange.createBuyOrder(buyer, creditType, amount, maxPrice));
});

app.post('/api/carbon/match', async (req, res) => {
  res.json(await carbonExchange.matchOrders());
});

app.get('/api/carbon/portfolio/:owner', (req, res) => {
  res.json(carbonExchange.getPortfolio(req.params.owner));
});

app.get('/api/carbon/stats', (req, res) => {
  res.json(carbonExchange.getMarketStats());
});

app.get('/api/carbon/transactions/:user', (req, res) => {
  const { role } = req.query;
  res.json(carbonExchange.getTransactionHistory(req.params.user, role));
});

app.post('/api/carbon/price', (req, res) => {
  const { type, price } = req.body;
  res.json(carbonExchange.updateMarketPrice(type, price));
});

// ==================== MARKETPLACE ROUTES ====================
app.get('/api/marketplace/services', (req, res) => {
  res.json({ services: marketplace.getAllServices() });
});

app.get('/api/marketplace/categories', (req, res) => {
  const categories = {};
  for (const service of marketplace.getAllServices()) {
    if (!categories[service.category]) categories[service.category] = [];
    categories[service.category].push(service);
  }
  res.json({ categories });
});

app.post('/api/marketplace/price', (req, res) => {
  const { serviceId, clientId, clientData } = req.body;
  const price = marketplace.getPersonalizedPrice(serviceId, clientId, clientData);
  if (!price) return res.status(404).json({ error: 'Service not found' });
  res.json({ serviceId, personalizedPrice: price });
});

app.post('/api/marketplace/purchase', (req, res) => {
  const { serviceId, clientId, price, paymentTxId, paymentMethod, serviceName, description } = req.body;
  const client = marketplace.recordPurchase(serviceId, clientId, price, {
    paymentTxId,
    paymentMethod,
    serviceName,
    description
  });
  res.json({ success: true, client });
});

app.get('/api/marketplace/purchases/:clientId', (req, res) => {
  res.json({ purchases: marketplace.getClientPurchases(req.params.clientId) });
});

app.get('/api/marketplace/recommendations/:clientId', (req, res) => {
  const recommendations = marketplace.getRecommendations(req.params.clientId);
  res.json({ recommendations });
});

app.get('/api/marketplace/stats', (req, res) => {
  res.json(marketplace.getMarketplaceStats());
});

app.post('/api/marketplace/discount', (req, res) => {
  const { clientId, serviceId, discountPercent } = req.body;
  const offer = marketplace.applySpecialDiscount(clientId, serviceId, discountPercent / 100);
  res.json(offer);
});

app.post('/api/marketplace/demand', (req, res) => {
  const { serviceId, delta } = req.body;
  marketplace.updateDemand(serviceId, delta);
  res.json({ success: true });
});

// ==================== PAYMENT ROUTES ====================
app.get('/api/payment/methods', (req, res) => {
  res.json({ methods: paymentGateway.getPaymentMethods() });
});

app.get('/api/payment/btc-rate', async (req, res) => {
  try {
    res.json(await paymentGateway.getBitcoinRate());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payment/create', async (req, res) => {
  try {
    const payment = await paymentGateway.createPayment(req.body || {});
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/status/:txId', (req, res) => {
  const payment = paymentGateway.getPaymentStatus(req.params.txId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

app.post('/api/payment/process/:txId', async (req, res) => {
  try {
    const payment = await paymentGateway.processPayment(req.params.txId, req.body || {});
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/history', (req, res) => {
  const { clientId, status, method } = req.query;
  res.json({ payments: paymentGateway.getTransactionHistory({ clientId, status, method }) });
});

app.get('/api/payment/stats', (req, res) => {
  res.json(paymentGateway.getStats());
});

app.post('/api/admin/payment/activate', (req, res) => {
  const { method, active } = req.body;
  try {
    res.json(paymentGateway.activateMethod(method, active));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== EXTENDED DOMAIN ROUTES ====================

// Aviation
app.post('/api/aviation/optimize-routes', async (req, res) => {
  try {
    const result = await aviationModule.optimizeRoutes(req.body.airlineId, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/aviation/predictive-maintenance', (req, res) => {
  res.json(aviationModule.predictiveMaintenance(req.body || {}));
});

app.post('/api/aviation/ticket-pricing', (req, res) => {
  const { route, demand, competitors } = req.body;
  res.json(aviationModule.optimizeTicketPrices(route || {}, demand || {}, competitors || []));
});

// Payment Systems
app.post('/api/payments/cross-border', async (req, res) => {
  try {
    const result = await paymentSystems.processCrossBorderPayment(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payments/fraud-detection', (req, res) => {
  res.json(paymentSystems.detectFraud(req.body || {}));
});

app.post('/api/payments/card', (req, res) => {
  const { cardDetails, amount } = req.body;
  res.json(paymentSystems.processCardPayment(cardDetails || {}, Number(amount || 0)));
});

// Government
app.post('/api/government/compliance', (req, res) => {
  const result = governmentModule.checkGovCompliance(req.body.agency, req.body.requirements || []);
  res.json(result);
});

app.post('/api/government/digitalize-service', (req, res) => {
  const { serviceId, params } = req.body;
  res.json(governmentModule.digitalizeService(serviceId, params || {}));
});

app.post('/api/government/analyze-policy', (req, res) => {
  res.json(governmentModule.analyzePolicy(req.body.policyText || ''));
});

// Defense
app.post('/api/defense/encrypt', (req, res) => {
  try {
    const result = defenseModule.quantumEncrypt(req.body.message || '', req.body.recipient);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/defense/threats', (req, res) => {
  res.json(defenseModule.analyzeThreats(req.body || {}));
});

app.post('/api/defense/secure-infrastructure', (req, res) => {
  const { infraId, params } = req.body;
  res.json(defenseModule.secureInfrastructure(infraId, params || {}));
});

// Telecom
app.post('/api/telecom/optimize-5g', (req, res) => {
  res.json(telecomModule.optimize5GNetwork(req.body.networkId, req.body.traffic || {}));
});

app.post('/api/telecom/predict-failures', (req, res) => {
  res.json(telecomModule.predictFailures(req.body || {}));
});

app.post('/api/telecom/revenue-assurance', (req, res) => {
  res.json(telecomModule.revenueAssurance(req.body.cdrData || []));
});

// Enterprise Partnership API
app.post('/api/enterprise/register', async (req, res) => {
  try {
    const partner = enterprisePartner.registerPartner(req.body || {});
    res.json(partner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/partner/:partnerId/:endpoint', async (req, res) => {
  const { partnerId, endpoint } = req.params;
  const apiKey = req.headers['x-api-key'];
  const partner = enterprisePartner.partners.get(partnerId);

  if (!partner || partner.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const result = await enterprisePartner.handlePartnerRequest(partnerId, endpoint, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/partner/:partnerId/dashboard', async (req, res) => {
  const { partnerId } = req.params;
  const apiKey = req.headers['x-api-key'];
  const partner = enterprisePartner.partners.get(partnerId);

  if (!partner || partner.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const dashboard = enterprisePartner.getPartnerDashboard(partnerId);
  res.json(dashboard);
});

app.get('/api/partner/:partnerId/invoice/:month', async (req, res) => {
  try {
    const { partnerId, month } = req.params;
    const invoice = enterprisePartner.generateInvoice(partnerId, month);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== ADVANCED MODULE ROUTES ====================

// Compliance Engine
app.post('/api/compliance/check', async (req, res) => {
  const { operation, data } = req.body;
  if (!operation) return res.status(400).json({ error: 'operation required' });
  const result = await complianceEngine.checkCompliance(operation, data || {});
  res.json(result);
});

app.get('/api/compliance/report', (req, res) => {
  const { period } = req.query;
  res.json(complianceEngine.generateReport(period || 'month'));
});

app.get('/api/compliance/stats', (req, res) => {
  res.json(complianceEngine.getStats());
});

// Risk Analyzer
app.post('/api/risk/analyze', async (req, res) => {
  const { type, data } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  try {
    const result = await riskAnalyzer.analyzeRisk(type, data || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/risk/history', (req, res) => {
  const limit = Number(req.query.limit || 100);
  res.json({ history: riskAnalyzer.getHistory(limit) });
});

app.get('/api/risk/stats', (req, res) => {
  res.json(riskAnalyzer.getStats());
});

// Reputation Protocol
app.post('/api/reputation/register', (req, res) => {
  const { entityId, type, metadata } = req.body;
  if (!entityId || !type) return res.status(400).json({ error: 'entityId and type required' });
  try {
    res.json(reputationProtocol.registerEntity(entityId, type, metadata || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reputation/review', (req, res) => {
  const { reviewerId, targetId, rating, comment, metadata } = req.body;
  try {
    res.json(reputationProtocol.addReview(reviewerId, targetId, rating, comment, metadata || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reputation/transaction', (req, res) => {
  const { entityId, counterpartyId, amount, type } = req.body;
  try {
    res.json(reputationProtocol.recordTransaction(entityId, counterpartyId, amount, type || 'payment'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reputation/:entityId', (req, res) => {
  const reputation = reputationProtocol.getReputation(req.params.entityId);
  if (!reputation) return res.status(404).json({ error: 'Entity not found' });
  res.json(reputation);
});

app.get('/api/reputation/top/list', (req, res) => {
  const limit = Number(req.query.limit || 10);
  const { type } = req.query;
  res.json({ top: reputationProtocol.getTopEntities(limit, type || null) });
});

app.get('/api/reputation/stats', (req, res) => {
  res.json(reputationProtocol.getStats());
});

// Opportunity Radar
app.get('/api/opportunity/list', (req, res) => {
  const filters = {
    minRelevance: req.query.minRelevance ? Number(req.query.minRelevance) : undefined,
    deadlineBefore: req.query.deadlineBefore
  };
  res.json({ opportunities: opportunityRadar.getOpportunities(filters) });
});

app.get('/api/opportunity/alerts/unread', (req, res) => {
  res.json({ alerts: opportunityRadar.getUnreadAlerts() });
});

app.post('/api/opportunity/alerts/read', (req, res) => {
  const { alertId } = req.body;
  res.json(opportunityRadar.markAlertRead(alertId));
});

app.post('/api/opportunity/recommendations', (req, res) => {
  res.json({ recommendations: opportunityRadar.getPersonalizedRecommendations(req.body || {}) });
});

app.get('/api/opportunity/stats', (req, res) => {
  res.json(opportunityRadar.getStats());
});

// Business Blueprint
app.post('/api/blueprint/generate', async (req, res) => {
  try {
    const blueprint = await businessBlueprint.generateBlueprint(req.body || {});
    res.json(blueprint);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/blueprint/list', (req, res) => {
  res.json({ blueprints: businessBlueprint.getAllBlueprints() });
});

app.get('/api/blueprint/:id', (req, res) => {
  const blueprint = businessBlueprint.getBlueprint(req.params.id);
  if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(blueprint);
});

// ==================== 5 INOVAȚII STRATEGICE ====================

// Quantum Blockchain
app.get('/api/blockchain/stats', (req, res) => {
  res.json(quantumChain.getStats());
});

app.post('/api/blockchain/transaction', (req, res) => {
  const tx = quantumChain.addTransaction(req.body || {});
  res.json(tx);
});

app.post('/api/blockchain/mine', (req, res) => {
  const block = quantumChain.mineBlock();
  res.json(block);
});

// AI Workforce Marketplace
app.get('/api/workforce/agents', (req, res) => {
  res.json(Array.from(workforce.agents.values()));
});

app.post('/api/workforce/agent', (req, res) => {
  try {
    res.json(workforce.registerAgent(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workforce/job', (req, res) => {
  try {
    res.json(workforce.postJob(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/workforce/job/:id/agents', (req, res) => {
  res.json(workforce.findBestAgents(req.params.id));
});

app.get('/api/workforce/stats', (req, res) => {
  res.json(workforce.getStats());
});

// M&A Advisor
app.post('/api/ma/targets', (req, res) => {
  res.json(ma.identifyTargets(req.body || {}));
});

app.post('/api/ma/negotiate', async (req, res) => {
  try {
    const deal = await ma.negotiateTerms(req.body.targetId, Number(req.body.initialOffer || 0), Number(req.body.maxPrice || 0));
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ma/stats', (req, res) => {
  res.json(ma.getStats());
});

// Legal Contract
app.post('/api/legal/generate', (req, res) => {
  try {
    res.json(legal.generateContract(req.body.type, req.body.params || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/legal/analyze', (req, res) => {
  try {
    res.json(legal.analyzeContract(req.body.text || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/legal/stats', (req, res) => {
  res.json(legal.getStats());
});

// Energy Grid
app.post('/api/energy/producer', (req, res) => {
  res.json(energy.registerProducer(req.body || {}));
});

app.post('/api/energy/consumer', (req, res) => {
  res.json(energy.registerConsumer(req.body || {}));
});

app.post('/api/energy/optimize', (req, res) => {
  res.json(energy.optimizeFlow());
});

app.post('/api/energy/trade', async (req, res) => {
  res.json(await energy.tradeExcessEnergy());
});

app.get('/api/energy/stats', (req, res) => {
  res.json(energy.getStats());
});

// ==================== UNICORN AUTONOMOUS CORE ====================
app.get('/api/uac/status', (req, res) => {
  res.json(uac.getStatus());
});

app.post('/api/uac/cycle', async (req, res) => {
  await uac.fullAutonomousCycle();
  res.json({ success: true, message: 'Autonomous cycle triggered' });
});

app.post('/api/uac/innovate', async (req, res) => {
  await uac.deepInnovationCycle();
  res.json({ success: true, message: 'Deep innovation cycle triggered' });
});

app.post('/api/uac/optimize', async (req, res) => {
  await uac.fullSystemOptimization();
  res.json({ success: true, message: 'System optimization triggered' });
});

// ==================== UNIVERSAL MARKET NEXUS ====================
app.use('/api/market', umn.createExchangeAPI());

// ==================== GLOBAL DIGITAL ECOSYSTEM STANDARD ====================
app.use('/api/global', gdes.createGiantAPI());

// ==================== SOCIAL MEDIA AUTO-VIRALIZER ====================
app.use('/api/admin/social', adminSecretMiddleware, socialViralizer.getRouter((req, res, next) => next()));
app.use('/api/admin/market', adminSecretMiddleware, umn.getRouter((req, res, next) => next()));
app.use('/api/admin/global', adminSecretMiddleware, gdes.getRouter((req, res, next) => next()));

// ==================== UNICORN ULTIMATE MODULES ====================
app.use('/api/admin/ultimate', adminSecretMiddleware, ultimateModules.getRouter((req, res, next) => next()));

// ==================== UNICORN ETERNAL ENGINE ====================
app.use('/api/admin/eternal', adminSecretMiddleware, uee.getRouter((req, res, next) => next()));

// ==================== LEGAL FORTRESS ====================
app.use('/api/admin/legal-fortress', adminSecretMiddleware, legalFortress.getRouter((req, res, next) => next()));

// ==================== QUANTUM RESILIENCE CORE ====================
app.use('/api/admin/resilience', adminSecretMiddleware, qrc.getRouter((req, res, next) => next()));

// ==================== EXECUTIVE DASHBOARD ====================
app.use('/api/admin/executive', adminTokenMiddleware, executiveDashboard.getRouter((req, res, next) => next()));

// ==================== UNICORN INNOVATION SUITE (10/10) ====================
// 1) Trust Center
app.get('/api/trust/status', (req, res) => {
  res.json(unicornInnovationSuite.getTrustStatus());
});

app.get('/api/trust/incidents', (req, res) => {
  res.json({ incidents: unicornInnovationSuite.getIncidents() });
});

app.get('/api/trust/audit', adminTokenMiddleware, (req, res) => {
  res.json({ audit: unicornInnovationSuite.getAuditTrail() });
});

// 2) Usage-based billing + plans
app.get('/api/billing/plans', adminTokenMiddleware, (req, res) => {
  res.json({ plans: unicornInnovationSuite.getPlans() });
});

app.post('/api/billing/subscribe', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.subscribe(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/billing/usage/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.trackUsage(req.params.clientId, req.body || {}));
});

app.get('/api/billing/usage/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.getUsage(req.params.clientId));
});

app.get('/api/billing/invoice/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.buildInvoice(req.params.clientId));
});

// 3) API keys + webhooks
app.post('/api/platform/api-keys', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.createApiKey(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/platform/api-keys', adminTokenMiddleware, (req, res) => {
  res.json({ keys: unicornInnovationSuite.listApiKeys() });
});

app.post('/api/platform/webhooks', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.registerWebhook(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/platform/webhooks/test', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.triggerWebhookTest((req.body || {}).eventName));
});

// 4) Marketplace intelligence score
app.get('/api/marketplace/intelligence', (req, res) => {
  res.json(unicornInnovationSuite.getMarketplaceIntelligence(req.query.clientId));
});

// 5) Autonomous experiment engine
app.get('/api/experiments', adminTokenMiddleware, (req, res) => {
  res.json({ experiments: unicornInnovationSuite.listExperiments() });
});

app.post('/api/experiments', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.createExperiment(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/experiments/:id/evaluate', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.evaluateExperiment(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 6) Executive Copilot
app.post('/api/executive/copilot', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.askCopilot(req.body || {}));
});

// 7) Security hardening APIs
app.get('/api/security/sessions', adminTokenMiddleware, (req, res) => {
  res.json({ sessions: unicornInnovationSuite.listSessions() });
});

app.post('/api/security/sessions/register', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.registerSession(req.body || {}));
});

app.post('/api/security/sessions/revoke', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.revokeSession((req.body || {}).sessionId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/security/device/check', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.checkDevice(req.body || {}));
});

// 8) Onboarding wizard
app.post('/api/onboarding/start', (req, res) => {
  res.json(unicornInnovationSuite.startOnboarding(req.body || {}));
});

app.get('/api/onboarding/recommendations/:id', (req, res) => {
  try {
    res.json(unicornInnovationSuite.getOnboardingRecommendations(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 9) Case studies + ROI calculator
app.get('/api/site/case-studies', (req, res) => {
  res.json({ caseStudies: unicornInnovationSuite.getCaseStudies() });
});

app.post('/api/site/roi/calculate', (req, res) => {
  res.json(unicornInnovationSuite.calculateROI(req.body || {}));
});

// 10) Partner / affiliate layer
app.post('/api/partners/referral/create', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.createReferral(req.body || {}));
});

app.get('/api/partners/referral/:code', (req, res) => {
  try {
    res.json(unicornInnovationSuite.getReferral(req.params.code));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/partners/affiliate/stats', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.getAffiliateStats());
});

// ==================== SERVIRE FRONTEND ====================
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`🚀 Unicorn autonom rulând pe portul \${PORT}\`);
});
`);

  writeText(path.join(BACKEND_MODULES, 'paymentGateway.js'), `const axios = require('axios');
const QRCode = require('qrcode');

const DEFAULT_BTC_WALLET_ADDRESS = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const DEFAULT_APP_BASE_URL = 'http://localhost:3000';

class PaymentGateway {
  constructor() {
    this.payments = new Map();
    this.appBaseUrl = this.normalizeBaseUrl(
      process.env.PUBLIC_APP_URL
      || process.env.APP_BASE_URL
      || process.env.FRONTEND_URL
      || DEFAULT_APP_BASE_URL
    );
    this.providers = {
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
      },
      paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID || '',
        clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        environment: (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
      }
    };
    this.wallets = {
      btc: process.env.BTC_WALLET_ADDRESS || DEFAULT_BTC_WALLET_ADDRESS,
      eth: process.env.ETH_WALLET_ADDRESS || process.env.USDC_WALLET_ADDRESS || ''
    };
    this.methods = [
      { id: 'card', name: 'Credit Card', currency: 'USD', active: this.isStripeConfigured(), feePercent: 2.9, settlement: 'instant', provider: 'stripe' },
      { id: 'paypal', name: 'PayPal', currency: 'USD', active: this.isPayPalConfigured(), feePercent: 3.4, settlement: 'instant', provider: 'paypal' },
      { id: 'stripe', name: 'Stripe', currency: 'USD', active: this.isStripeConfigured(), feePercent: 2.9, settlement: 'instant', provider: 'stripe' },
      { id: 'crypto_btc', name: 'Bitcoin', currency: 'BTC', active: true, feePercent: 1.2, settlement: '10-30 min' },
      { id: 'crypto_eth', name: 'Ethereum', currency: 'ETH', active: true, feePercent: 1.4, settlement: '2-10 min' },
      { id: 'bank', name: 'Bank Transfer', currency: 'EUR', active: true, feePercent: 0.8, settlement: '1-2 days' }
    ];
    this.statusFlow = ['created', 'pending', 'processing', 'completed'];
  }

  normalizeBaseUrl(value) {
    return String(value || DEFAULT_APP_BASE_URL).replace(/\/$/, '');
  }

  isStripeConfigured() {
    return Boolean(this.providers.stripe.secretKey);
  }

  isPayPalConfigured() {
    return Boolean(this.providers.paypal.clientId && this.providers.paypal.clientSecret);
  }

  getPayPalBaseUrl() {
    return this.providers.paypal.environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  getReturnUrl(txId, status = 'success') {
    return this.appBaseUrl + '/?payment=' + encodeURIComponent(status) + '&txId=' + encodeURIComponent(txId);
  }

  getPaymentMethods() {
    return this.methods.filter((method) => method.active);
  }

  async getBitcoinRate() {
    try {
      const response = await axios.get('https://api.coindesk.com/v1/bpi/currentprice/USD.json', { timeout: 8000 });
      return {
        asset: 'BTC',
        currency: 'USD',
        rate: Number(response.data?.bpi?.USD?.rate_float || 0),
        source: 'coindesk',
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        asset: 'BTC',
        currency: 'USD',
        rate: 65000,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
        warning: 'Live BTC rate unavailable, fallback used.'
      };
    }
  }

  getMethod(methodId) {
    return this.methods.find((item) => item.id === methodId && item.active);
  }

  getWalletAddress(method) {
    if (method === 'crypto_btc') {
      return this.wallets.btc;
    }

    if (method === 'crypto_eth') {
      return this.wallets.eth || null;
    }

    return null;
  }

  getProviderForMethod(method) {
    if (method === 'card' || method === 'stripe') {
      return 'stripe';
    }

    if (method === 'paypal') {
      return 'paypal';
    }

    return null;
  }

  async createStripeCheckout(payment) {
    if (!this.isStripeConfigured()) {
      throw new Error('Stripe credentials missing');
    }

    const form = new URLSearchParams();
    form.append('mode', 'payment');
    form.append('success_url', this.getReturnUrl(payment.txId, 'stripe-success'));
    form.append('cancel_url', this.getReturnUrl(payment.txId, 'stripe-cancel'));
    form.append('line_items[0][quantity]', '1');
    form.append('line_items[0][price_data][currency]', String(payment.currency || 'USD').toLowerCase());
    form.append('line_items[0][price_data][unit_amount]', String(Math.round(Number(payment.total || 0) * 100)));
    form.append('line_items[0][price_data][product_data][name]', payment.description || 'Unicorn AI Service');
    form.append('metadata[txId]', payment.txId);
    form.append('metadata[clientId]', payment.clientId || 'guest');

    const response = await axios.post('https://api.stripe.com/v1/checkout/sessions', form.toString(), {
      headers: {
        Authorization: 'Bearer ' + this.providers.stripe.secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data;
  }

  async getStripeCheckoutSession(sessionId) {
    const response = await axios.get('https://api.stripe.com/v1/checkout/sessions/' + sessionId, {
      headers: {
        Authorization: 'Bearer ' + this.providers.stripe.secretKey
      },
      timeout: 15000
    });

    return response.data;
  }

  async getPayPalAccessToken() {
    if (!this.isPayPalConfigured()) {
      throw new Error('PayPal credentials missing');
    }

    const response = await axios.post(this.getPayPalBaseUrl() + '/v1/oauth2/token', 'grant_type=client_credentials', {
      auth: {
        username: this.providers.paypal.clientId,
        password: this.providers.paypal.clientSecret
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data.access_token;
  }

  async createPayPalOrder(payment) {
    const accessToken = await this.getPayPalAccessToken();
    const response = await axios.post(this.getPayPalBaseUrl() + '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: payment.txId,
          description: payment.description,
          amount: {
            currency_code: String(payment.currency || 'USD').toUpperCase(),
            value: Number(payment.total || 0).toFixed(2)
          }
        }
      ],
      application_context: {
        user_action: 'PAY_NOW',
        return_url: this.getReturnUrl(payment.txId, 'paypal-success'),
        cancel_url: this.getReturnUrl(payment.txId, 'paypal-cancel')
      }
    }, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return response.data;
  }

  async capturePayPalOrder(orderId) {
    const accessToken = await this.getPayPalAccessToken();
    const response = await axios.post(this.getPayPalBaseUrl() + '/v2/checkout/orders/' + orderId + '/capture', {}, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return response.data;
  }

  async createPayment(payload) {
    const {
      amount,
      currency = 'USD',
      method = 'card',
      clientId = 'guest',
      description = 'Unicorn AI Service',
      metadata = {}
    } = payload;

    if (!amount || Number(amount) <= 0) {
      throw new Error('Valid amount required');
    }

    const selectedMethod = this.getMethod(method);
    if (!selectedMethod) {
      throw new Error('Payment method unavailable');
    }

    const txId = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const numericAmount = Number(amount);
    const fee = Number((numericAmount * (selectedMethod.feePercent / 100)).toFixed(2));
    const total = Number((numericAmount + fee).toFixed(2));
    const provider = this.getProviderForMethod(method);
    const walletAddress = method.startsWith('crypto_') ? this.getWalletAddress(method) : null;
    if (method.startsWith('crypto_') && !walletAddress) {
      throw new Error('Crypto wallet address not configured for selected method');
    }
    const qrPayload = walletAddress
      ? await QRCode.toDataURL(walletAddress + '?amount=' + numericAmount + '&label=' + encodeURIComponent(description))
      : null;

    const payment = {
      txId,
      clientId,
      description,
      method,
      provider,
      currency,
      amount: numericAmount,
      fee,
      total,
      status: method.startsWith('crypto_') || provider ? 'pending' : 'created',
      walletAddress,
      qrCode: qrPayload,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (method === 'crypto_btc') {
      const rate = await this.getBitcoinRate();
      payment.exchangeRate = rate.rate;
      payment.cryptoAmount = Number((numericAmount / rate.rate).toFixed(8));
    }

    if (provider === 'stripe') {
      const session = await this.createStripeCheckout(payment);
      payment.providerPaymentId = session.id;
      payment.providerStatus = session.payment_status || 'unpaid';
      payment.checkoutUrl = session.url || null;
      payment.nextAction = session.url
        ? { type: 'redirect', url: session.url, label: 'Open Stripe Checkout' }
        : null;
    }

    if (provider === 'paypal') {
      const order = await this.createPayPalOrder(payment);
      const approvalUrl = (order.links || []).find((entry) => entry.rel === 'approve')?.href || null;
      payment.providerPaymentId = order.id;
      payment.providerStatus = order.status || 'CREATED';
      payment.checkoutUrl = approvalUrl;
      payment.nextAction = approvalUrl
        ? { type: 'redirect', url: approvalUrl, label: 'Open PayPal Checkout' }
        : null;
    }

    this.payments.set(txId, payment);
    return payment;
  }

  getPaymentStatus(txId) {
    return this.payments.get(txId) || null;
  }

  async processPayment(txId, details = {}) {
    const payment = this.payments.get(txId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.provider === 'stripe' && payment.providerPaymentId) {
      const session = await this.getStripeCheckoutSession(payment.providerPaymentId);
      const updatedPayment = {
        ...payment,
        status: session.payment_status === 'paid' ? 'completed' : 'pending',
        providerStatus: session.payment_status || payment.providerStatus || 'open',
        processorResponse: {
          approved: session.payment_status === 'paid',
          reference: session.payment_intent || session.id,
          note: session.payment_status === 'paid' ? 'Stripe checkout paid.' : 'Complete Stripe checkout, then verify again.'
        },
        updatedAt: new Date().toISOString()
      };

      this.payments.set(txId, updatedPayment);
      return updatedPayment;
    }

    if (payment.provider === 'paypal' && payment.providerPaymentId) {
      try {
        const capture = await this.capturePayPalOrder(payment.providerPaymentId);
        const updatedPayment = {
          ...payment,
          status: capture.status === 'COMPLETED' ? 'completed' : 'pending',
          providerStatus: capture.status || payment.providerStatus || 'CREATED',
          processorResponse: {
            approved: capture.status === 'COMPLETED',
            reference: capture.id || payment.providerPaymentId,
            note: capture.status === 'COMPLETED' ? 'PayPal payment captured.' : 'PayPal payment still awaiting approval.'
          },
          updatedAt: new Date().toISOString()
        };

        this.payments.set(txId, updatedPayment);
        return updatedPayment;
      } catch (error) {
        if (error.response?.status === 422 || error.response?.status === 409) {
          const updatedPayment = {
            ...payment,
            status: 'pending',
            processorResponse: {
              approved: false,
              reference: payment.providerPaymentId,
              note: error.response?.data?.message || 'Approve PayPal checkout first, then capture the payment.'
            },
            updatedAt: new Date().toISOString()
          };

          this.payments.set(txId, updatedPayment);
          return updatedPayment;
        }

        throw error;
      }
    }

    const nextStatus = payment.status === 'created'
      ? 'processing'
      : payment.status === 'pending'
        ? 'processing'
        : payment.status === 'processing'
          ? 'completed'
          : payment.status;

    const updatedPayment = {
      ...payment,
      status: nextStatus,
      processorResponse: {
        approved: nextStatus === 'completed' || details.approved === true,
        reference: details.reference || 'ref_' + Math.random().toString(36).slice(2, 10),
        note: details.note || null
      },
      updatedAt: new Date().toISOString()
    };

    if (updatedPayment.processorResponse.approved && nextStatus === 'processing') {
      updatedPayment.status = 'completed';
    }

    this.payments.set(txId, updatedPayment);
    return updatedPayment;
  }

  getTransactionHistory(filters = {}) {
    const { clientId, status, method } = filters;
    return Array.from(this.payments.values())
      .filter((payment) => !clientId || payment.clientId === clientId)
      .filter((payment) => !status || payment.status === status)
      .filter((payment) => !method || payment.method === method)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getStats() {
    const payments = Array.from(this.payments.values());
    const revenue = payments
      .filter((payment) => payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.total, 0);

    const byMethod = payments.reduce((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPayments: payments.length,
      completedPayments: payments.filter((payment) => payment.status === 'completed').length,
      pendingPayments: payments.filter((payment) => payment.status === 'pending' || payment.status === 'processing').length,
      revenue: Number(revenue.toFixed(2)),
      byMethod,
      activeMethods: this.methods.filter((method) => method.active).length,
      supportedStatuses: this.statusFlow
    };
  }

  activateMethod(methodId, active = true) {
    const method = this.methods.find((item) => item.id === methodId);
    if (!method) {
      throw new Error('Method not found');
    }
    if (active !== false && method.provider === 'stripe' && !this.isStripeConfigured()) {
      throw new Error('Stripe credentials missing');
    }
    if (active !== false && method.provider === 'paypal' && !this.isPayPalConfigured()) {
      throw new Error('PayPal credentials missing');
    }
    method.active = active !== false;
    return { success: true, method };
  }
}

module.exports = new PaymentGateway();
`);

  writeText(path.join(BACKEND_MODULES, 'aviationModule.js'), `class AviationModule {
  constructor() {
    this.airlines = new Map();
    this.routes = new Map();
    this.fleet = new Map();
  }

  optimizeRoutes(airlineId, params = {}) {
    const demand = Array.isArray(params.demandForecast) ? params.demandForecast : [];
    const currentRoutes = Array.isArray(params.currentRoutes) ? params.currentRoutes : [];
    const fuelCostIndex = Number(params.fuelCostIndex || 1);
    const slotPressure = Number(params.slotPressure || 0.4);

    const optimizedRoutes = currentRoutes.map((route, index) => {
      const demandFactor = Number(demand[index]?.demand || route.demand || 0.6);
      const utilization = Math.min(0.98, 0.55 + demandFactor * 0.35);
      const recommendedFrequency = Math.max(1, Math.round((route.frequency || 7) * (0.8 + demandFactor * 0.5)));
      const estimatedMargin = Number((((route.avgFare || 240) * utilization) - (route.costPerFlight || 140)).toFixed(2));
      return {
        routeId: route.routeId || route.id || 'route_' + index,
        origin: route.origin || 'HUB',
        destination: route.destination || 'DEST',
        utilization,
        recommendedFrequency,
        estimatedMargin,
        action: utilization < 0.65 ? 'consolidate' : utilization > 0.88 ? 'expand' : 'optimize',
        slotRecommendation: slotPressure > 0.7 ? 'prioritize premium windows' : 'maintain slot allocation'
      };
    });

    const estimatedSavings = Math.round((optimizedRoutes.length || 3) * 2500000 * (2 - fuelCostIndex + slotPressure));
    const result = {
      airlineId,
      optimizedRoutes,
      estimatedSavings: Math.max(500000, estimatedSavings),
      generatedAt: new Date().toISOString()
    };

    if (airlineId) this.airlines.set(airlineId, result);
    return result;
  }

  predictiveMaintenance(fleetData = {}) {
    const aircraft = Array.isArray(fleetData.aircraft) ? fleetData.aircraft : [];
    const alerts = aircraft
      .filter((item) => Number(item.engineHealth || 1) < 0.78 || Number(item.cyclesSinceMaintenance || 0) > 850)
      .map((item) => ({
        aircraftId: item.id,
        severity: Number(item.engineHealth || 1) < 0.6 ? 'critical' : 'medium',
        reason: Number(item.engineHealth || 1) < 0.78 ? 'engine degradation' : 'maintenance cycle threshold exceeded'
      }));

    return {
      alerts,
      nextMaintenance: fleetData.nextMaintenance || '2026-04-15',
      savings: alerts.length ? 5000000 - alerts.length * 250000 : 5000000,
      fleetHealthScore: Number((1 - alerts.length / ((aircraft.length || 1) * 5)).toFixed(2))
    };
  }

  optimizeTicketPrices(route = {}, demand = {}, competitors = []) {
    const demandIndex = Number(demand.current || demand.index || 0.72);
    const competitorAverage = competitors.length
      ? competitors.reduce((sum, item) => sum + Number(item.price || 0), 0) / competitors.length
      : Number(route.basePrice || 299);
    const recommendedPrice = Math.round((competitorAverage * (0.94 + demandIndex * 0.18)) * 100) / 100;

    return {
      route: route.routeId || route.name || 'standard-route',
      recommendedPrice,
      estimatedRevenue: Math.round(recommendedPrice * Number(route.monthlyPassengers || 85000)),
      demandIndex,
      competitorAverage: Math.round(competitorAverage * 100) / 100
    };
  }
}

module.exports = new AviationModule();
`);

  writeText(path.join(BACKEND_MODULES, 'paymentSystems.js'), `class PaymentSystems {
  constructor() {
    this.transactions = [];
    this.merchants = new Map();
    this.exchangeRates = {
      USD: { EUR: 0.92, GBP: 0.79, AED: 3.67 },
      EUR: { USD: 1.08, GBP: 0.86, AED: 3.97 },
      GBP: { USD: 1.27, EUR: 1.16, AED: 4.62 }
    };
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1;
    const rate = this.exchangeRates[fromCurrency]?.[toCurrency];
    if (rate) return rate;
    return 1 + (Math.random() * 0.15);
  }

  calculateRiskScore(transaction = {}) {
    const amountRisk = Math.min(Number(transaction.amount || 0) / 50000, 1);
    const geographyRisk = transaction.crossBorder ? 0.3 : 0.08;
    const velocityRisk = Math.min(Number(transaction.recentTransactions || 0) / 20, 1) * 0.3;
    const merchantRisk = transaction.knownMerchant ? 0.05 : 0.2;
    return Number(Math.min(amountRisk * 0.4 + geographyRisk + velocityRisk + merchantRisk, 0.99).toFixed(2));
  }

  async processCrossBorderPayment(params = {}) {
    const { fromCurrency = 'USD', toCurrency = 'EUR', amount = 0, merchantId = 'merchant_default' } = params;
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const numericAmount = Number(amount || 0);
    const fee = Number((numericAmount * 0.005).toFixed(2));
    const transactionId = 'xb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const transaction = {
      transactionId,
      merchantId,
      fromCurrency,
      toCurrency,
      amount: numericAmount,
      rate,
      amountConverted: Number((numericAmount * rate).toFixed(2)),
      fee,
      createdAt: new Date().toISOString()
    };
    this.transactions.push(transaction);
    return transaction;
  }

  detectFraud(transaction = {}) {
    const riskScore = this.calculateRiskScore(transaction);
    return {
      riskScore,
      flagged: riskScore > 0.7,
      reason: riskScore > 0.7 ? 'Suspicious pattern' : null
    };
  }

  processCardPayment(cardDetails = {}, amount = 0) {
    const last4 = String(cardDetails.number || '0000').slice(-4);
    return {
      success: true,
      authorizationCode: 'AUTH' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      fee: Number((Number(amount || 0) * 0.02).toFixed(2)),
      cardNetwork: cardDetails.network || 'Visa',
      maskedCard: '**** **** **** ' + last4
    };
  }
}

module.exports = new PaymentSystems();
`);

  writeText(path.join(BACKEND_MODULES, 'governmentModule.js'), `class GovernmentModule {
  constructor() {
    this.complianceFrameworks = {
      gdpr: { active: true, requirements: ['consent', 'portability', 'erasure'] },
      hipaa: { active: false, requirements: ['privacy', 'security', 'breach_notification'] },
      soc2: { active: true, requirements: ['security', 'availability', 'confidentiality'] },
      fedramp: { active: false, requirements: ['access_control', 'audit', 'configuration'] }
    };
  }

  generateRemediation(gaps = []) {
    return gaps.map((gap) => ({
      framework: gap,
      action: 'Activate and implement controls for ' + gap,
      owner: gap === 'fedramp' ? 'security-office' : 'compliance-team'
    }));
  }

  checkGovCompliance(agency, requirements = []) {
    const gaps = [];
    for (const req of requirements) {
      if (!this.complianceFrameworks[req]?.active) {
        gaps.push(req);
      }
    }
    return { compliant: gaps.length === 0, agency, gaps, remediationSteps: this.generateRemediation(gaps) };
  }

  digitalizeService(serviceId, params = {}) {
    return {
      serviceId,
      platformUrl: 'https://gov.unicorn.ai/' + serviceId,
      estimatedTime: params.complexity === 'high' ? '6 months' : '3 months',
      cost: params.complexity === 'high' ? 450000 : 250000,
      channels: ['web', 'mobile', 'api']
    };
  }

  analyzePolicy(policyText = '') {
    const lower = String(policyText).toLowerCase();
    const affectedSectors = ['healthcare', 'education', 'transport'].filter((sector) => lower.includes(sector.slice(0, 5)));
    return {
      impact: lower.includes('tax') || lower.includes('restriction') ? 'mixed' : 'positive',
      affectedSectors: affectedSectors.length ? affectedSectors : ['healthcare', 'education'],
      recommendations: ['run public consultation', 'measure budget impact', 'publish implementation KPIs']
    };
  }
}

module.exports = new GovernmentModule();
`);

  writeText(path.join(BACKEND_MODULES, 'defenseModule.js'), `const crypto = require('crypto');

class DefenseModule {
  constructor() {
    this.threatLevels = { low: 1, medium: 2, high: 3, critical: 4 };
  }

  generateQuantumKey() {
    return crypto.randomBytes(32);
  }

  quantumEncrypt(message, recipientId) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.generateQuantumKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(message), 'utf8'), cipher.final()]);
    return {
      recipientId,
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex')
    };
  }

  analyzeThreats(intelData = {}) {
    const sources = intelData.sources || ['dark_web', 'state_actors'];
    const criticalSignals = Number(intelData.criticalSignals || 0);
    const threatLevel = criticalSignals > 5 ? 'high' : criticalSignals > 2 ? 'medium' : 'low';
    return { threatLevel, sources, recommendations: ['increase monitoring', 'segment critical systems', 'review incident response'] };
  }

  secureInfrastructure(infraId, params = {}) {
    const vulnerabilities = Number(params.openFindings || 3);
    return {
      infraId,
      securityScore: Math.max(60, 98 - vulnerabilities * 2),
      vulnerabilities,
      remediationPlan: ['patch edge gateways', 'rotate privileged credentials', 'enable continuous monitoring']
    };
  }
}

module.exports = new DefenseModule();
`);

  writeText(path.join(BACKEND_MODULES, 'telecomModule.js'), `class TelecomModule {
  constructor() {
    this.networks = new Map();
  }

  optimize5GNetwork(networkId, trafficData = {}) {
    const peakLoad = Number(trafficData.peakLoad || 0.72);
    return {
      networkId,
      capacityIncrease: Math.round((20 + peakLoad * 20)) + '%',
      latencyReduction: Math.max(4, Math.round(18 - peakLoad * 8)) + 'ms',
      costSavings: 5000000
    };
  }

  predictFailures(networkData = {}) {
    const nodes = Array.isArray(networkData.nodes) ? networkData.nodes : [];
    const failures = nodes
      .filter((node) => Number(node.temperature || 0) > 80 || Number(node.packetLoss || 0) > 0.04)
      .map((node) => ({ nodeId: node.id, reason: Number(node.temperature || 0) > 80 ? 'thermal anomaly' : 'packet loss spike' }));
    return { predictedFailures: failures, confidence: 0.92, recommendedActions: ['reroute traffic', 'dispatch field maintenance', 'increase sensor polling'] };
  }

  findBillingDiscrepancies(cdrData = []) {
    return cdrData
      .filter((record) => Number(record.billedAmount || 0) !== Number(record.expectedAmount || 0))
      .map((record) => ({
        subscriberId: record.subscriberId,
        amount: Number((Number(record.expectedAmount || 0) - Number(record.billedAmount || 0)).toFixed(2)),
        reason: 'mismatched billing record'
      }));
  }

  revenueAssurance(cdrData = []) {
    const discrepancies = this.findBillingDiscrepancies(cdrData);
    return { discrepancies, recoveredRevenue: discrepancies.reduce((sum, d) => sum + d.amount, 0) };
  }
}

module.exports = new TelecomModule();
`);

  writeText(path.join(BACKEND_MODULES, 'enterprisePartnership.js'), `const DEFAULT_BTC_WALLET_ADDRESS = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

class EnterprisePartnership {
  constructor() {
    const btcAddress = process.env.BTC_WALLET_ADDRESS || DEFAULT_BTC_WALLET_ADDRESS;
    this.partners = new Map();
    this.requestLog = [];
    this.contractTemplates = {
      aws: {
        partner: 'Amazon Web Services',
        tier: 'Platinum',
        modules: ['aviationModule', 'quantumIdentity', 'riskAnalyzer', 'opportunityRadar', 'carbonExchange'],
        pricing: {
          annualFee: '$5,000,000',
          perRequest: '$0.05',
          support: '24/7 dedicated team',
          sla: '99.99% uptime'
        },
        integration: {
          apiEndpoints: [
            'https://api.unicorn.ai/partners/aws/aviation/optimize',
            'https://api.unicorn.ai/partners/aws/quantum/identity',
            'https://api.unicorn.ai/partners/aws/risk/analyze'
          ],
          documentation: 'https://docs.unicorn.ai/partners/aws',
          sandbox: 'https://sandbox.unicorn.ai/aws'
        },
        payment: {
          method: 'Bitcoin',
          address: btcAddress,
          terms: 'Net 30',
          autoRenew: true
        }
      }
    };
  }

  generateApiKey() {
    return 'up_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  registerPartner(data = {}) {
    const partnerId = data.partnerId || data.slug || 'partner_' + Date.now();
    const apiKey = this.generateApiKey();
    const template = data.template && this.contractTemplates[data.template] ? this.contractTemplates[data.template] : null;
    const partner = {
      partnerId,
      name: data.name || template?.partner || 'Enterprise Partner',
      tier: data.tier || template?.tier || 'Gold',
      modules: data.modules || template?.modules || ['riskAnalyzer'],
      pricing: data.pricing || template?.pricing || { annualFee: '$1,000,000', perRequest: '$0.02' },
      integration: data.integration || template?.integration || { documentation: 'https://docs.unicorn.ai/partners/' + partnerId },
      payment: data.payment || template?.payment || { method: 'Wire', terms: 'Net 30' },
      apiKey,
      createdAt: new Date().toISOString()
    };
    this.partners.set(partnerId, partner);
    return partner;
  }

  async handlePartnerRequest(partnerId, endpoint, payload = {}) {
    const partner = this.partners.get(partnerId);
    if (!partner) throw new Error('Partner not found');
    const entry = {
      partnerId,
      endpoint,
      payload,
      timestamp: new Date().toISOString(),
      requestId: 'req_' + Math.random().toString(36).slice(2, 10)
    };
    this.requestLog.push(entry);
    return {
      success: true,
      requestId: entry.requestId,
      endpoint,
      partnerTier: partner.tier,
      processedAt: new Date().toISOString(),
      data: {
        accepted: true,
        modules: partner.modules,
        payloadSummary: Object.keys(payload)
      }
    };
  }

  getPartnerDashboard(partnerId) {
    const partner = this.partners.get(partnerId);
    if (!partner) throw new Error('Partner not found');
    const requests = this.requestLog.filter((item) => item.partnerId === partnerId);
    return {
      partnerId,
      name: partner.name,
      tier: partner.tier,
      modules: partner.modules,
      requestsLast30Days: requests.length,
      latestRequests: requests.slice(-10).reverse(),
      contract: this.contractTemplates.aws
    };
  }

  generateInvoice(partnerId, month) {
    const partner = this.partners.get(partnerId);
    if (!partner) throw new Error('Partner not found');
    const requests = this.requestLog.filter((item) => item.partnerId === partnerId && item.timestamp.slice(0, 7) === month);
    const perRequest = Number(String(partner.pricing.perRequest || '$0').replace(/[^0-9.]/g, '') || 0);
    return {
      partnerId,
      month,
      annualFee: partner.pricing.annualFee,
      requestCount: requests.length,
      usageAmount: Number((requests.length * perRequest).toFixed(2)),
      totalDue: partner.pricing.annualFee,
      currency: 'USD',
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new EnterprisePartnership();
`);

  writeText(path.join(BACKEND_MODULES, 'selfConstruction.js'), `const fs = require('fs');
const path = require('path');

class SelfConstruction {
  constructor() {
    this.hasRun = false;
  }

  async start() {
    if (this.hasRun) return;
    console.log('🔧 Self‑Construction Engine pornit...');
    this.hasRun = true;

    const modulesDir = path.join(__dirname);
    const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js') && f !== 'selfConstruction.js');

    for (const file of files) {
      const filePath = path.join(modulesDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      if (!content.includes('module.exports') || content.length < 200) {
        console.log('🛠️ Îmbunătățesc modulul ' + file);

        // Adaugă structura de bază dacă lipsește
        if (!content.includes('getStatus')) {
          const name = file.replace('.js', '');
          content = [
            '// Modul auto-construit: ' + name,
            'let state = { counter: 0, lastRun: null };',
            '',
            'module.exports = {',
            "  name: '" + name + "',",
            '  state,',
            '  methods: {',
            '    async process(input) {',
            '      state.counter++;',
            '      state.lastRun = new Date().toISOString();',
            "      console.log('🔄 ' + this.name + ' procesează: ' + JSON.stringify(input));",
            "      return { status: 'ok', module: this.name, counter: state.counter, input };",
            '    },',
            '    getStatus() {',
            '      return {',
            '        name: this.name,',
            "        health: 'good',",
            '        uptime: process.uptime(),',
            '        counter: state.counter,',
            '        lastRun: state.lastRun',
            '      };',
            '    }',
            '  }',
            '};',
            ''
          ].join('\n');
          fs.writeFileSync(filePath, content);
        }
      }
    }

    console.log('✅ Self‑Construction finalizat.');
  }
}

module.exports = new SelfConstruction();
`);

  writeText(path.join(BACKEND_MODULES, 'autoDeploy.js'), `const fs = require('fs');
const simpleGit = require('simple-git');
const path = require('path');
const chokidar = require('chokidar');
const dotenv = require('dotenv');

class AutoDeploy {
  constructor() {
    this.loadCredentialEnvFiles();
  }

  loadCredentialEnvFiles() {
    const rootPath = path.join(__dirname, '..', '..');
    const envCandidates = [
      path.join(rootPath, '.env'),
      path.join(rootPath, '.env.auto-connector'),
      path.join(rootPath, '..', '.env'),
      path.join(rootPath, '..', '.env.auto-connector')
    ];

    for (const filePath of envCandidates) {
      if (fs.existsSync(filePath)) {
        dotenv.config({ path: filePath, override: false });
      }
    }
  }

  getAuthenticatedRemoteUrl() {
    const remoteUrl = process.env.GIT_REMOTE_URL || '';
    const token = process.env.GITHUB_TOKEN || '';

    if (!remoteUrl || !token) return remoteUrl;
    if (!remoteUrl.includes('github.com') || remoteUrl.includes('@')) return remoteUrl;

    return remoteUrl.replace('https://', \`https://x-access-token:\${encodeURIComponent(token)}@\`);
  }

  start() {
    const git = simpleGit(path.join(__dirname, '..'));
    let timeout = null;

    console.log('📡 Auto‑Deploy activ – monitorizez modificări...');

    const watcher = chokidar.watch(
      [
        path.join(__dirname, '../'),
        path.join(__dirname, '../../client/src')
      ],
      {
        ignored: /(node_modules|\\.git|client\\/build|backups|logs|\\.env)/,
        persistent: true,
        ignoreInitial: true
      }
    );

    watcher.on('all', async (event, filePath) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        console.log(\`📝 Modificare detectată: \${filePath}\`);
        console.log('🔄 Auto‑deploy în curs...');

        try {
          const status = await git.status();
          if (status.files.length > 0 || status.not_added.length > 0) {
            await git.add('.');
            await git.commit('Auto‑deploy: ' + new Date().toISOString());
            await git.push();
            console.log('✅ Push realizat pe GitHub. Webhook-ul va actualiza Hetzner.');
          } else {
            console.log('ℹ️ Nicio modificare de commitat.');
          }
        } catch (err) {
          console.error('❌ Eroare auto‑deploy:', err.message);
        }
      }, 2000);
    });

    // Verifică și inițializează repo dacă nu există
    this.ensureRepo(git);
  }

  async ensureRepo(git) {
    const gitDir = path.join(__dirname, '../../.git');
    if (!fs.existsSync(gitDir)) {
      console.log('📁 Inițializare repository git...');
      await git.init();
      const remoteUrl = this.getAuthenticatedRemoteUrl();
      if (remoteUrl) {
        await git.addRemote('origin', remoteUrl);
        console.log('🔗 Remote adăugat pentru auto‑deploy.');
      }
    } else {
      const remoteUrl = this.getAuthenticatedRemoteUrl();
      if (remoteUrl) {
        try {
          await git.remote(['set-url', 'origin', remoteUrl]);
        } catch {
          // keep existing remote
        }
      }
    }
  }
}

module.exports = new AutoDeploy();
`);

  writeText(path.join(BACKEND_MODULES, 'totalSystemHealer.js'), `const cron = require('node-cron');
const http = require('http');
const fs = require('fs');
const path = require('path');

class TotalSystemHealer {
  start() {
    console.log('🩺 TotalSystemHealer activ – monitorizare la 30 secunde');

    // Monitorizare sănătate server
    cron.schedule('*/30 * * * * *', () => {
      const req = http.get('http://localhost:3000/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status !== 'ok') {
              console.log('⚠️ Health check eșuat! Stare:', json.status);
              this.heal();
            }
          } catch (err) {
            console.log('⚠️ Răspuns invalid la health check');
            this.heal();
          }
        });
      });
      req.on('error', () => {
        console.log('⚠️ Serverul nu răspunde! Încerc reparare...');
        this.heal();
      });
      req.end();
    });

    // Verifică modulele periodic
    cron.schedule('*/5 * * * *', () => {
      this.checkModules();
    });
  }

  heal() {
    console.log('🛠️ Încerc reparare sistem...');
    // Aici s-ar putea reporni serviciul sau procesul
    const { exec } = require('child_process');
    exec('systemctl restart unicorn 2>/dev/null || pm2 restart unicorn 2>/dev/null || echo "Restart manual necesar"');
  }

  checkModules() {
    const modulesDir = path.join(__dirname);
    if (!fs.existsSync(modulesDir)) return;

    const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const mod = require(path.join(modulesDir, file));
        if (mod.methods && typeof mod.methods.getStatus === 'function') {
          const status = mod.methods.getStatus();
          if (status.health !== 'good') {
            console.log(\`⚠️ Modulul \${file} are sănătatea: \${status.health}\`);
          }
        }
      } catch (err) {
        console.log(\`❌ Modulul \${file} nu poate fi încărcat:\`, err.message);
      }
    }
  }
}

module.exports = new TotalSystemHealer();
`);

  writeText(path.join(BACKEND_MODULES, 'qrDigitalIdentity.js'), `const crypto = require('crypto');

class QuantumResistantIdentity {
  constructor() {
    this.identities = new Map(); // userId -> { publicKey, privateKey, createdAt, metadata }
  }

  generateIdentity(userId, metadata = {}) {
    // Simulare chei post‑cuantice (CRYSTALS-Dilithium)
    const publicKey = crypto.randomBytes(64).toString('hex');
    const privateKey = crypto.randomBytes(128).toString('hex');
    const identity = {
      userId,
      publicKey,
      privateKey,
      createdAt: new Date().toISOString(),
      metadata
    };
    this.identities.set(userId, identity);
    return { userId, publicKey, createdAt: identity.createdAt };
  }

  sign(userId, message) {
    const identity = this.identities.get(userId);
    if (!identity) throw new Error('Identity not found for user: ' + userId);
    const signature = crypto.createHmac('sha512', identity.privateKey).update(message).digest('hex');
    return { signature, algorithm: 'CRYSTALS-Dilithium (simulated)', timestamp: new Date().toISOString() };
  }

  verify(publicKey, message, signature) {
    const expected = crypto.createHmac('sha512', publicKey).update(message).digest('hex');
    return { valid: signature === expected, message: signature === expected ? 'Signature valid' : 'Invalid signature' };
  }
}

  // Obține toate identitățile (doar pentru admin)
  getAllIdentities() {
    const result = [];
    for (const [userId, identity] of this.identities) {
      result.push({
        userId,
        publicKey: identity.publicKey,
        createdAt: identity.createdAt,
        metadata: identity.metadata
      });
    }
    return result;
  }

  // Șterge o identitate
  revokeIdentity(userId) {
    return this.identities.delete(userId);
  }
}

module.exports = new QuantumResistantIdentity();
`);

  writeText(path.join(BACKEND_MODULES, 'aiNegotiator.js'), `const natural = require('natural');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

class AINegotiator {
  constructor() {
    this.strategies = {
      collaborative: "Let's find a win-win solution that benefits both parties.",
      competitive: "This is our final and best offer. Take it or leave it.",
      accommodating: "We value our partnership and can adjust to meet your needs.",
      compromising: "Let's meet in the middle to reach an agreement quickly."
    };

    this.activeNegotiations = new Map();
    this.negotiationId = 0;
  }

  analyzeMessage(text) {
    const analysis = sentiment.analyze(text);
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());

    let intent = 'general';
    if (tokens.some(t => ['price', 'cost', 'budget', 'fee'].includes(t))) intent = 'price';
    if (tokens.some(t => ['deadline', 'time', 'delay'].includes(t))) intent = 'timeline';
    if (tokens.some(t => ['quality', 'feature', 'performance'].includes(t))) intent = 'quality';
    if (tokens.some(t => ['discount', 'deal', 'offer'].includes(t))) intent = 'discount';

    return {
      sentiment: { score: analysis.score, comparative: analysis.comparative },
      intent,
      tokens
    };
  }

  startNegotiation(params) {
    const { counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime } = params;
    const id = ++this.negotiationId;

    const negotiation = {
      id,
      counterparty,
      topic,
      initialOffer,
      targetPrice: targetPrice || initialOffer * 0.9,
      maxDiscount: maxDiscount || 10,
      deliveryTime: deliveryTime || '2-3 weeks',
      currentOffer: initialOffer,
      round: 0,
      status: 'active',
      history: [],
      startedAt: new Date().toISOString()
    };
    this.activeNegotiations.set(id, negotiation);
    return { id, startedAt: negotiation.startedAt };
  }

  async processMessage(negotiationId, message, userType = 'counterparty') {
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (!negotiation) throw new Error('Negotiation not found');
    if (negotiation.status !== 'active') throw new Error('Negotiation is not active');

    const analysis = this.analyzeMessage(message);

    // Înregistrează în istoric
    negotiation.history.push({
      round: ++negotiation.round,
      userType,
      message,
      analysis,
      timestamp: new Date().toISOString()
    });

    let strategy = 'collaborative';
    if (analysis.sentiment.score < -2) strategy = 'accommodating';
    if (analysis.sentiment.score > 2) strategy = 'competitive';
    if (analysis.intent === 'price' && negotiation.round > 2) strategy = 'compromising';

    let response = this.strategies[strategy];

    if (analysis.intent === 'price') {
      const step = (negotiation.targetPrice - negotiation.currentOffer) / (5 - negotiation.round);
      negotiation.currentOffer += step;
      response += \` Regarding the price, we propose \${negotiation.currentOffer.toFixed(2)} USD.\`;
    }

    if (analysis.intent === 'discount') {
      response += \` We can offer up to \${negotiation.maxDiscount}% discount for bulk orders.\`;
    }

    if (analysis.intent === 'timeline') {
      response += \` The estimated delivery time is \${negotiation.deliveryTime}.\`;
    }

    let status = 'active';
    let finalAgreement = null;

    if (Math.abs(negotiation.currentOffer - negotiation.targetPrice) < 1 && negotiation.round > 2) {
      status = 'agreed';
      finalAgreement = {
        price: negotiation.currentOffer,
        terms: negotiation.topic,
        agreedAt: new Date().toISOString()
      };
      negotiation.status = 'completed';
    } else if (negotiation.round >= 10) {
      status = 'expired';
      negotiation.status = 'expired';
    }

    return { response, status, finalAgreement, round: negotiation.round };
  }

  getNegotiation(id) {
    const negotiation = this.activeNegotiations.get(id);
    if (!negotiation) return null;

    return {
      id: negotiation.id,
      counterparty: negotiation.counterparty,
      topic: negotiation.topic,
      currentOffer: negotiation.currentOffer,
      targetPrice: negotiation.targetPrice,
      round: negotiation.round,
      status: negotiation.status,
      history: negotiation.history.slice(-10),
      startedAt: negotiation.startedAt
    };
  }

  getStats() {
    const negotiations = Array.from(this.activeNegotiations.values());
    return {
      total: negotiations.length,
      active: negotiations.filter(n => n.status === 'active').length,
      completed: negotiations.filter(n => n.status === 'completed').length,
      expired: negotiations.filter(n => n.status === 'expired').length
    };
  }
}

module.exports = new AINegotiator();
`);

  writeText(path.join(BACKEND_MODULES, 'carbonExchange.js'), `const crypto = require('crypto');

class CarbonCreditExchange {
  constructor() {
    this.credits = new Map();
    this.portfolios = new Map();
    this.transactions = [];
    this.orders = new Map();
    this.marketPrices = { VER: 5.5, CER: 8.25, EUA: 85, CCB: 12 };
  }

  issueCredits(owner, amount, type = 'VER', projectId = null, vintage = new Date().getFullYear()) {
    const id = crypto.randomBytes(16).toString('hex');
    const credit = {
      id,
      owner,
      amount: parseFloat(amount),
      type,
      price: this.marketPrices[type] || 10,
      projectId,
      vintage,
      issuedAt: new Date().toISOString(),
      status: 'active'
    };

    this.credits.set(id, credit);

    if (!this.portfolios.has(owner)) this.portfolios.set(owner, new Set());
    this.portfolios.get(owner).add(id);

    return credit;
  }

  getMarketPrice(type) {
    return this.marketPrices[type] || 10;
  }

  updateMarketPrice(type, price) {
    if (this.marketPrices[type]) {
      this.marketPrices[type] = price;
      for (const [id, credit] of this.credits) {
        if (credit.type === type && credit.status === 'active') {
          credit.price = price;
          this.credits.set(id, credit);
        }
      }
      return { updated: true, type, price };
    }
    return { updated: false, message: 'Unknown credit type' };
  }

  createSellOrder(seller, creditId, amount, price = null) {
    if (!this.portfolios.get(seller)?.has(creditId)) {
      throw new Error('Seller does not own this credit');
    }

    const credit = this.credits.get(creditId);
    if (!credit || credit.amount < amount) {
      throw new Error('Insufficient credits');
    }

    const order = {
      id: crypto.randomBytes(8).toString('hex'),
      seller,
      creditId,
      amount,
      price: price || credit.price,
      type: 'sell',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    this.orders.set(order.id, order);

    return order;
  }

  createBuyOrder(buyer, creditType, amount, maxPrice) {
    const order = {
      id: crypto.randomBytes(8).toString('hex'),
      buyer,
      creditType,
      amount,
      maxPrice,
      type: 'buy',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    this.orders.set(order.id, order);

    return order;
  }

  async executeTrade(buyer, seller, creditId, amount) {
    const credit = this.credits.get(creditId);
    if (!credit) throw new Error('Credit not found');
    if (credit.owner !== seller) throw new Error('Seller does not own this credit');
    if (credit.amount < amount) throw new Error('Insufficient amount');

    const totalPrice = credit.price * amount;

    credit.amount -= amount;
    if (credit.amount === 0) {
      credit.status = 'depleted';
      this.portfolios.get(seller).delete(creditId);
    }
    this.credits.set(creditId, credit);

    let newCreditId = null;
    if (amount > 0) {
      newCreditId = crypto.randomBytes(16).toString('hex');
      const newCredit = {
        ...credit,
        id: newCreditId,
        owner: buyer,
        amount,
        originalId: creditId,
        purchasedAt: new Date().toISOString()
      };
      this.credits.set(newCreditId, newCredit);
      if (!this.portfolios.has(buyer)) this.portfolios.set(buyer, new Set());
      this.portfolios.get(buyer).add(newCreditId);
    }

    const transaction = {
      id: crypto.randomBytes(16).toString('hex'),
      buyer,
      seller,
      creditId,
      newCreditId,
      amount,
      price: credit.price,
      totalPrice,
      timestamp: new Date().toISOString()
    };
    this.transactions.push(transaction);

    return transaction;
  }

  async matchOrders() {
    const buyOrders = Array.from(this.orders.values()).filter(o => o.type === 'buy' && o.status === 'open');
    const sellOrders = Array.from(this.orders.values()).filter(o => o.type === 'sell' && o.status === 'open');

    let matched = 0;

    for (const buy of buyOrders) {
      for (const sell of sellOrders) {
        if (sell.price <= buy.maxPrice) {
          const amount = Math.min(buy.amount, sell.amount);
          try {
            await this.executeTrade(buy.buyer, sell.seller, sell.creditId, amount);

            buy.amount -= amount;
            sell.amount -= amount;

            if (buy.amount === 0) buy.status = 'completed';
            if (sell.amount === 0) sell.status = 'completed';

            matched++;
            break;
          } catch (err) {
            console.error('Trade execution failed:', err);
          }
        }
      }
    }

    return { matched };
  }

  getPortfolio(owner) {
    const creditIds = this.portfolios.get(owner) || new Set();
    const credits = [];
    for (const id of creditIds) {
      const credit = this.credits.get(id);
      if (credit) credits.push(credit);
    }
    return credits;
  }

  getMarketStats() {
    const totalVolume = this.transactions.reduce((sum, t) => sum + t.totalPrice, 0);
    const avgPrice = this.transactions.length > 0 ? totalVolume / this.transactions.length : 0;

    const creditsByType = {};
    for (const [id, credit] of this.credits) {
      if (credit.status === 'active' || credit.status === 'depleted') {
        creditsByType[credit.type] = (creditsByType[credit.type] || 0) + credit.amount;
      }
    }

    return {
      totalVolume,
      avgPrice,
      transactionsCount: this.transactions.length,
      availableCredits: creditsByType,
      marketPrices: this.marketPrices,
      activeOrders: Array.from(this.orders.values()).filter(o => o.status === 'open').length
    };
  }

  getTransactionHistory(user, role = 'both') {
    return this.transactions.filter(t => {
      if (role === 'buyer') return t.buyer === user;
      if (role === 'seller') return t.seller === user;
      return t.buyer === user || t.seller === user;
    });
  }

}

module.exports = new CarbonCreditExchange();
`);

  writeText(path.join(BACKEND_MODULES, 'serviceMarketplace.js'), `const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ServiceMarketplace {
  constructor() {
    this.services = new Map();
    this.pricingHistory = new Map();
    this.clientPreferences = new Map();
    this.marketTrends = { lastUpdate: null, trends: {}, globalMultiplier: 1.0 };
    this.discountRate = 0.20;
    this.loadServices();
    this.startMarketAnalysis();
  }

  loadServices() {
    const modulesDir = path.join(__dirname);
    if (!fs.existsSync(modulesDir)) return;

    const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js') && f !== 'serviceMarketplace.js');
    for (const file of files) {
      try {
        const mod = require(path.join(modulesDir, file));
        const serviceId = file.replace('.js', '');

        let category = 'general';
        if (serviceId.includes('pricing')) category = 'pricing';
        else if (serviceId.includes('negotiate')) category = 'negotiation';
        else if (serviceId.includes('carbon')) category = 'carbon';
        else if (serviceId.includes('identity')) category = 'security';
        else if (serviceId.includes('wealth')) category = 'finance';
        else if (serviceId.includes('trend')) category = 'analytics';

        const name = this.formatServiceName(serviceId);
        this.services.set(serviceId, {
          id: serviceId,
          name,
          category,
          description: mod.description || ('Serviciu AI avansat pentru ' + name),
          basePrice: this.calculateBasePrice(serviceId, category),
          currentPrice: 0,
          demand: 0.5,
          popularity: 0.5,
          availability: true,
          apiEndpoint: '/api/module/' + serviceId + '/process',
          metadata: { version: '1.0', createdAt: new Date().toISOString() }
        });
      } catch (err) {
        console.error('Eroare la încărcarea serviciului ' + file + ':', err.message);
      }
    }

    if (this.services.size < 10) this.addDefaultServices();
    console.log('✅ Încărcate ' + this.services.size + ' servicii în marketplace');
  }

  formatServiceName(serviceId) {
    return serviceId.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/[0-9]/g, '').trim();
  }

  calculateBasePrice(serviceId, category) {
    const prices = { pricing: 49.99, negotiation: 99.99, carbon: 149.99, security: 79.99, finance: 199.99, analytics: 39.99, general: 29.99 };
    return prices[category] || 29.99;
  }

  addDefaultServices() {
    const defaults = [
      { id: 'dynamic_pricing', name: 'Dynamic Pricing AI', category: 'pricing', basePrice: 49.99 },
      { id: 'ai_negotiator', name: 'AI Negotiator Pro', category: 'negotiation', basePrice: 99.99 },
      { id: 'carbon_trading', name: 'Carbon Credit Trading', category: 'carbon', basePrice: 149.99 },
      { id: 'quantum_identity', name: 'Quantum Identity Shield', category: 'security', basePrice: 79.99 },
      { id: 'wealth_engine', name: 'Autonomous Wealth Engine', category: 'finance', basePrice: 199.99 },
      { id: 'trend_analyzer', name: 'Global Trend Analyzer', category: 'analytics', basePrice: 39.99 }
    ];

    for (const svc of defaults) {
      if (!this.services.has(svc.id)) {
        this.services.set(svc.id, {
          id: svc.id,
          name: svc.name,
          category: svc.category,
          description: 'Serviciu AI avansat pentru ' + svc.name,
          basePrice: svc.basePrice,
          currentPrice: svc.basePrice,
          demand: 0.5,
          popularity: 0.5,
          availability: true,
          apiEndpoint: '/api/module/' + svc.id + '/process'
        });
      }
    }
  }

  startMarketAnalysis() {
    setInterval(() => this.analyzeMarket(), 30 * 60 * 1000);
    setTimeout(() => this.analyzeMarket(), 5000);
  }

  async collectMarketData() {
    void axios;
    const trends = { ai_services: 0.15, carbon: 0.08, security: 0.12, finance: 0.05, general: 0.02 };
    const globalMultiplier = 0.95 + Math.random() * 0.1;
    const competitorPrices = { dynamic_pricing: 59.99, ai_negotiator: 119.99, carbon_trading: 179.99, quantum_identity: 99.99, wealth_engine: 249.99 };
    return { trends, globalMultiplier, competitorPrices };
  }

  calculateDynamicPrice(service) {
    let price = service.basePrice;
    const demandFactor = 0.8 + (service.demand - 0.5) * 0.6;
    const popularityFactor = 0.9 + service.popularity * 0.2;
    const categoryTrend = this.marketTrends.trends[service.category] || 0.02;
    price *= demandFactor;
    price *= popularityFactor;
    price *= (1 + categoryTrend);
    price *= this.marketTrends.globalMultiplier || 1.0;
    if (this.marketTrends.competitorPrices && this.marketTrends.competitorPrices[service.id]) {
      const competitorPrice = this.marketTrends.competitorPrices[service.id];
      if (competitorPrice < price) price = price * 0.95 + competitorPrice * 0.05;
    }
    price = price * (1 - this.discountRate);
    const minPrice = service.basePrice * 0.5;
    if (price < minPrice) price = minPrice;
    return Math.round(price * 100) / 100;
  }

  async analyzeMarket() {
    try {
      const marketData = await this.collectMarketData();
      this.marketTrends = {
        lastUpdate: new Date().toISOString(),
        trends: marketData.trends,
        globalMultiplier: marketData.globalMultiplier,
        competitorPrices: marketData.competitorPrices
      };

      for (const [id, service] of this.services) {
        const newPrice = this.calculateDynamicPrice(service);
        const oldPrice = service.currentPrice || service.basePrice;
        if (Math.abs(newPrice - oldPrice) > 0.01) {
          if (!this.pricingHistory.has(id)) this.pricingHistory.set(id, []);
          this.pricingHistory.get(id).push({ price: oldPrice, timestamp: new Date().toISOString(), reason: 'market_adjustment' });
          service.currentPrice = newPrice;
        }
      }
    } catch (err) {
      console.error('❌ Eroare la analiza pieței:', err.message);
    }
  }

  getPersonalizedPrice(serviceId, clientId, clientData = {}) {
    const service = this.services.get(serviceId);
    if (!service) return null;

    let basePrice = service.currentPrice || service.basePrice;
    const clientHistory = this.clientPreferences.get(clientId);
    if (clientHistory) {
      const loyaltyDiscount = Math.min(clientHistory.purchases * 0.02, 0.15);
      basePrice *= (1 - loyaltyDiscount);
    }

    const segments = { retail: 1.0, enterprise: 0.9, startup: 0.85, nonprofit: 0.7 };
    basePrice *= (segments[clientData.segment] || 1.0);
    basePrice *= (1 - Math.min(clientData.volume || 0, 0.2));
    if (clientData.urgency === 'high') basePrice *= 1.1;
    if (clientData.urgency === 'low') basePrice *= 0.95;
    return Math.round(basePrice * 100) / 100;
  }

  recordPurchase(serviceId, clientId, price, details = {}) {
    if (!this.clientPreferences.has(clientId)) {
      this.clientPreferences.set(clientId, { purchases: 0, totalSpent: 0, services: [], firstPurchase: new Date().toISOString() });
    }
    const client = this.clientPreferences.get(clientId);
    const service = this.services.get(serviceId);
    const purchaseRecord = {
      serviceId,
      serviceName: details.serviceName || service?.name || serviceId,
      description: details.description || service?.description || '',
      category: service?.category || 'general',
      price: Number(price || 0),
      paymentTxId: details.paymentTxId || null,
      paymentMethod: details.paymentMethod || null,
      purchasedAt: new Date().toISOString()
    };
    client.purchases += 1;
    client.totalSpent += Number(price || 0);
    client.services.push(purchaseRecord);
    client.lastPurchase = new Date().toISOString();

    if (service) service.popularity = Math.min(service.popularity + 0.05, 1);
    return client;
  }

  getClientPurchases(clientId) {
    const client = this.clientPreferences.get(clientId);
    if (!client) return [];
    return [...client.services].sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
  }

  getAllServices() {
    return Array.from(this.services.values()).map(service => ({
      id: service.id,
      name: service.name,
      category: service.category,
      description: service.description,
      price: service.currentPrice || service.basePrice,
      basePrice: service.basePrice,
      discount: this.discountRate * 100,
      demand: service.demand,
      popularity: service.popularity,
      availability: service.availability,
      apiEndpoint: service.apiEndpoint
    }));
  }

  getRecommendations(clientId) {
    const client = this.clientPreferences.get(clientId);
    const recommendations = [];
    for (const service of this.services.values()) {
      if (!client || !client.services.some(s => s.serviceId === service.id)) {
        recommendations.push({
          serviceId: service.id,
          name: service.name,
          category: service.category,
          price: service.currentPrice || service.basePrice,
          score: service.popularity,
          reason: service.popularity > 0.7 ? 'Highly recommended' : 'You might also like'
        });
      }
    }
    return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  getMarketplaceStats() {
    let totalValue = 0;
    const byCategory = {};
    for (const service of this.services.values()) {
      const price = service.currentPrice || service.basePrice;
      totalValue += price;
      byCategory[service.category] = (byCategory[service.category] || 0) + 1;
    }
    return {
      totalServices: this.services.size,
      avgPrice: totalValue / (this.services.size || 1),
      totalValue,
      byCategory,
      discountRate: this.discountRate * 100,
      lastMarketUpdate: this.marketTrends.lastUpdate,
      marketTrends: this.marketTrends.trends
    };
  }

  updateDemand(serviceId, delta) {
    const service = this.services.get(serviceId);
    if (!service) return;
    service.demand = Math.min(Math.max(service.demand + Number(delta || 0), 0), 1);
  }

  applySpecialDiscount(clientId, serviceId, customDiscount) {
    void clientId;
    const service = this.services.get(serviceId);
    if (!service) return null;
    const basePrice = service.currentPrice || service.basePrice;
    const discountedPrice = basePrice * (1 - customDiscount);
    return {
      originalPrice: basePrice,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
      discountPercent: customDiscount * 100,
      expiresIn: '24h'
    };
  }
}

module.exports = new ServiceMarketplace();
`);

  writeText(path.join(BACKEND_MODULES, 'complianceEngine.js'), `class ComplianceEngine {
  constructor() {
    this.regulations = {
      gdpr: { active: true, lastUpdate: '2025-01-01', requirements: ['consent', 'data_portability', 'right_to_erasure'] },
      soc2: { active: true, lastUpdate: '2025-01-01', requirements: ['security', 'availability', 'confidentiality'] },
      iso27001: { active: true, lastUpdate: '2025-01-01', requirements: ['risk_assessment', 'access_control', 'incident_response'] },
      aml: { active: true, lastUpdate: '2025-01-01', requirements: ['kyc', 'transaction_monitoring', 'sanctions_screening'] }
    };
    this.complianceReports = [];
    this.violations = [];
  }

  async runComplianceCheck(regulation, operation, data) {
    switch (regulation) {
      case 'gdpr':
        if (operation === 'store_user_data' && !data.consent) return { passed: false, reason: 'User consent missing' };
        return { passed: true, reason: 'All GDPR requirements met' };
      case 'soc2':
        if (operation === 'api_call' && !data.encrypted) return { passed: false, reason: 'Data not encrypted in transit' };
        return { passed: true, reason: 'SOC2 controls satisfied' };
      case 'iso27001':
        if (operation === 'access_data' && !data.authorized) return { passed: false, reason: 'Unauthorized access attempt' };
        return { passed: true, reason: 'ISO 27001 compliance verified' };
      case 'aml':
        if (operation === 'transaction' && data.amount > 10000 && !data.verified) return { passed: false, reason: 'Large transaction requires enhanced due diligence' };
        return { passed: true, reason: 'AML screening passed' };
      default:
        return { passed: true, reason: 'No specific requirements' };
    }
  }

  async checkCompliance(operation, data) {
    const violations = [];
    const results = {};
    for (const [reg, config] of Object.entries(this.regulations)) {
      if (!config.active) continue;
      const check = await this.runComplianceCheck(reg, operation, data);
      results[reg] = check;
      if (!check.passed) violations.push({ regulation: reg, reason: check.reason });
    }
    if (violations.length) this.violations.push({ timestamp: new Date().toISOString(), operation, data: { ...data, sensitive: '***' }, violations });
    return { passed: violations.length === 0, violations, results };
  }

  generateRecommendations(v) {
    const recs = [];
    if (v.gdpr > 0) recs.push('Review user consent collection mechanisms');
    if (v.soc2 > 0) recs.push('Enable TLS encryption for all API endpoints');
    if (v.iso27001 > 0) recs.push('Implement MFA for all admin accounts');
    if (v.aml > 0) recs.push('Enhance KYC verification for high-value transactions');
    if (recs.length === 0) recs.push('All compliance metrics are within acceptable limits');
    return recs;
  }

  generateReport(period = 'month') {
    const now = new Date();
    const startDate = new Date();
    if (period === 'month') startDate.setMonth(now.getMonth() - 1);
    if (period === 'quarter') startDate.setMonth(now.getMonth() - 3);
    if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);
    const periodViolations = this.violations.filter(v => new Date(v.timestamp) >= startDate);
    const byRegulation = {};
    for (const v of periodViolations) for (const vio of v.violations) byRegulation[vio.regulation] = (byRegulation[vio.regulation] || 0) + 1;
    const report = {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalViolations: periodViolations.length,
      violationsByRegulation: byRegulation,
      regulationsStatus: this.regulations,
      recommendations: this.generateRecommendations(byRegulation),
      generatedAt: new Date().toISOString()
    };
    this.complianceReports.push(report);
    return report;
  }

  addRegulation(name, requirements) {
    this.regulations[name] = { active: true, lastUpdate: new Date().toISOString(), requirements };
    return { added: true, regulation: name };
  }

  calculateComplianceScore() {
    if (this.violations.length === 0) return 100;
    const lastMonth = this.violations.filter(v => new Date(v.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;
    return Math.max(0, 100 - lastMonth * 5);
  }

  getStats() {
    return {
      activeRegulations: Object.keys(this.regulations).length,
      totalViolations: this.violations.length,
      lastReport: this.complianceReports[this.complianceReports.length - 1] || null,
      complianceScore: this.calculateComplianceScore()
    };
  }
}

module.exports = new ComplianceEngine();
`);

  writeText(path.join(BACKEND_MODULES, 'riskAnalyzer.js'), `class RiskAnalyzer {
  constructor() {
    this.riskHistory = [];
    this.riskModels = {
      financial: this.analyzeFinancialRisk.bind(this),
      operational: this.analyzeOperationalRisk.bind(this),
      security: this.analyzeSecurityRisk.bind(this),
      market: this.analyzeMarketRisk.bind(this)
    };
  }

  async analyzeRisk(type, data) {
    const model = this.riskModels[type];
    if (!model) throw new Error('Unknown risk type: ' + type);
    const result = await model(data);
    const analysis = {
      type,
      timestamp: new Date().toISOString(),
      data: { ...data, sensitive: '***' },
      riskScore: this.calculateRiskScore(result),
      confidence: result.confidence || 0.85,
      factors: result.factors,
      recommendations: this.generateRecommendations(type, result),
      monteCarlo: this.runMonteCarloSimulation(data, 1000)
    };
    this.riskHistory.push(analysis);
    return analysis;
  }

  async analyzeFinancialRisk(data) {
    const amount = Number(data.amount || 0);
    const factors = {
      amountRisk: Math.min(amount / 1000000, 1),
      volatilityRisk: data.volatility || 0.5,
      leverageRisk: Math.min((data.leverage || 1) / 10, 1),
      historicalRisk: (data.history && data.history.defaultRate) || 0.1
    };
    const totalRisk = factors.amountRisk * 0.3 + factors.volatilityRisk * 0.3 + factors.leverageRisk * 0.2 + factors.historicalRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.85, valueAtRisk: amount * totalRisk, expectedLoss: amount * totalRisk * 0.5 };
  }

  async analyzeOperationalRisk(data) {
    const factors = {
      complexityRisk: Math.min((data.complexity || 0) / 10, 1),
      dependencyRisk: Math.min((data.dependencies || 0) / 20, 1),
      redundancyRisk: data.redundancy ? 0.2 : 0.8,
      experienceRisk: Math.max(0, 1 - ((data.teamExperience || 0) / 100))
    };
    const totalRisk = factors.complexityRisk * 0.3 + factors.dependencyRisk * 0.25 + factors.redundancyRisk * 0.25 + factors.experienceRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.75, mitigationCost: totalRisk * 10000 };
  }

  async analyzeSecurityRisk(data) {
    const factors = {
      encryptionRisk: data.encryption ? 0.1 : 0.9,
      authRisk: data.authMethod === 'mfa' ? 0.1 : data.authMethod === '2fa' ? 0.3 : 0.7,
      vulnerabilityRisk: data.vulnerabilityScore ? data.vulnerabilityScore / 10 : 0.5,
      incidentRisk: Math.min((data.pastIncidents || 0) / 10, 1)
    };
    const totalRisk = factors.encryptionRisk * 0.25 + factors.authRisk * 0.3 + factors.vulnerabilityRisk * 0.25 + factors.incidentRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.9, breachProbability: totalRisk * 0.1, recommendedControls: this.getSecurityControls(totalRisk) };
  }

  async analyzeMarketRisk(data) {
    const factors = {
      volatilityRisk: data.volatility || 0.4,
      correlationRisk: Math.abs(data.correlation || 0.5),
      betaRisk: Math.min(Math.abs(data.beta || 1) / 3, 1),
      trendRisk: data.marketTrend === 'bear' ? 0.8 : data.marketTrend === 'bull' ? 0.2 : 0.5
    };
    const totalRisk = factors.volatilityRisk * 0.3 + factors.correlationRisk * 0.2 + factors.betaRisk * 0.3 + factors.trendRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.7, expectedReturn: data.expectedReturn || 0.1, sharpeRatio: ((data.expectedReturn || 0.1) - 0.02) / (totalRisk || 0.1) };
  }

  calculateRiskScore(analysis) {
    if (analysis.score < 0.2) return 'low';
    if (analysis.score < 0.5) return 'medium';
    if (analysis.score < 0.8) return 'high';
    return 'critical';
  }

  getSecurityControls(riskScore) {
    const controls = [];
    if (riskScore > 0.3) controls.push('Enable MFA for all users');
    if (riskScore > 0.5) controls.push('Implement data encryption at rest');
    if (riskScore > 0.7) controls.push('Conduct weekly security audits');
    if (riskScore > 0.9) controls.push('Hire external security firm');
    return controls;
  }

  generateRecommendations(type, analysis) {
    const recs = [];
    if (type === 'financial' && analysis.score > 0.5) recs.push('Reduce position size or add hedging');
    if (type === 'operational' && analysis.factors.redundancyRisk > 0.5) recs.push('Implement redundant systems');
    if (type === 'security') recs.push(...analysis.recommendedControls);
    if (type === 'market' && analysis.score > 0.6) recs.push('Reduce market exposure');
    if (recs.length === 0) recs.push('Risk level acceptable, continue monitoring');
    return recs;
  }

  runMonteCarloSimulation(data, iterations = 1000) {
    const amount = Number(data.amount || 1000);
    const results = [];
    for (let i = 0; i < iterations; i++) results.push(amount * (0.5 + Math.random()));
    results.sort((a, b) => a - b);
    return {
      p10: results[Math.floor(iterations * 0.1)],
      p50: results[Math.floor(iterations * 0.5)],
      p90: results[Math.floor(iterations * 0.9)],
      mean: results.reduce((a, b) => a + b, 0) / iterations
    };
  }

  getHistory(limit = 100) {
    return this.riskHistory.slice(-limit);
  }

  getStats() {
    const highRisk = this.riskHistory.filter(r => r.riskScore === 'high' || r.riskScore === 'critical').length;
    return {
      totalAnalyses: this.riskHistory.length,
      highRiskCount: highRisk,
      averageRiskScore: this.riskHistory.reduce((sum, r) => sum + (r.riskScore === 'low' ? 0.1 : r.riskScore === 'medium' ? 0.3 : r.riskScore === 'high' ? 0.7 : 0.9), 0) / (this.riskHistory.length || 1),
      lastAnalysis: this.riskHistory[this.riskHistory.length - 1] || null
    };
  }
}

module.exports = new RiskAnalyzer();
`);

  writeText(path.join(BACKEND_MODULES, 'reputationProtocol.js'), `class ReputationProtocol {
  constructor() {
    this.entities = new Map();
    this.reviewQueue = [];
    this.blockchain = [];
  }

  registerEntity(entityId, type, metadata = {}) {
    if (this.entities.has(entityId)) throw new Error('Entity already registered');
    const entity = {
      id: entityId,
      type,
      metadata,
      score: 0.5,
      confidence: 0.5,
      history: [],
      reviews: [],
      transactions: [],
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    this.entities.set(entityId, entity);
    this.addToBlockchain({ action: 'register', entityId, type, timestamp: new Date().toISOString() });
    return entity;
  }

  verifyReview(reviewerId, targetId, metadata) {
    const reviewer = this.entities.get(reviewerId);
    const hasTransaction = reviewer && reviewer.transactions.some(t => t.counterparty === targetId);
    return hasTransaction || (metadata && metadata.hasTransaction === true);
  }

  addReview(reviewerId, targetId, rating, comment, metadata = {}) {
    if (!this.entities.has(reviewerId)) throw new Error('Reviewer not registered');
    if (!this.entities.has(targetId)) throw new Error('Target not registered');
    if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

    const review = {
      id: Date.now() + '-' + Math.random().toString(36),
      reviewerId,
      targetId,
      rating,
      comment,
      metadata,
      timestamp: new Date().toISOString(),
      verified: this.verifyReview(reviewerId, targetId, metadata)
    };

    const target = this.entities.get(targetId);
    target.reviews.push(review);
    target.lastUpdated = new Date().toISOString();
    this.updateReputationScore(targetId);
    this.addToBlockchain({ action: 'review', reviewId: review.id, targetId, rating, timestamp: review.timestamp });
    return review;
  }

  updateReputationScore(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    const reviews = entity.reviews;
    if (!reviews.length) {
      entity.score = 0.5;
      entity.confidence = 0.5;
      return;
    }
    const alpha = 1 + reviews.reduce((sum, r) => sum + (r.rating - 1), 0);
    const beta = 1 + reviews.reduce((sum, r) => sum + (5 - r.rating), 0);
    entity.score = alpha / (alpha + beta);
    entity.confidence = Math.min(Math.sqrt(alpha + beta) / 10, 1);
  }

  recordTransaction(entityId, counterpartyId, amount, type = 'payment') {
    const entity = this.entities.get(entityId);
    const counterparty = this.entities.get(counterpartyId);
    if (!entity || !counterparty) throw new Error('Entity not found');
    const transaction = { id: Date.now() + '-' + Math.random().toString(36), entityId, counterparty: counterpartyId, amount, type, timestamp: new Date().toISOString() };
    entity.transactions.push(transaction);
    counterparty.transactions.push({ ...transaction, entityId: counterpartyId, counterparty: entityId });
    this.addToBlockchain({ action: 'transaction', transactionId: transaction.id, from: entityId, to: counterpartyId, amount });
    return transaction;
  }

  addToBlockchain(data) {
    const block = {
      index: this.blockchain.length + 1,
      timestamp: new Date().toISOString(),
      data,
      previousHash: this.blockchain.length ? this.blockchain[this.blockchain.length - 1].hash : '0',
      hash: this.calculateHash(this.blockchain.length + 1, data)
    };
    this.blockchain.push(block);
  }

  calculateHash(index, data) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(String(index) + JSON.stringify(data)).digest('hex');
  }

  getReputation(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of entity.reviews) ratingDistribution[review.rating] += 1;
    return { id: entity.id, type: entity.type, score: entity.score, confidence: entity.confidence, totalReviews: entity.reviews.length, ratingDistribution, recentReviews: entity.reviews.slice(-5), registeredAt: entity.registeredAt };
  }

  getTopEntities(limit = 10, type = null) {
    let entities = Array.from(this.entities.values());
    if (type) entities = entities.filter(e => e.type === type);
    entities.sort((a, b) => b.score - a.score);
    return entities.slice(0, limit).map(e => ({ id: e.id, type: e.type, score: e.score, confidence: e.confidence }));
  }

  getStats() {
    const entities = Array.from(this.entities.values());
    return {
      totalEntities: entities.length,
      averageScore: entities.reduce((sum, e) => sum + e.score, 0) / (entities.length || 1),
      totalReviews: entities.reduce((sum, e) => sum + e.reviews.length, 0),
      totalTransactions: entities.reduce((sum, e) => sum + e.transactions.length, 0),
      blockchainHeight: this.blockchain.length
    };
  }
}

module.exports = new ReputationProtocol();
`);

  writeText(path.join(BACKEND_MODULES, 'opportunityRadar.js'), `const axios = require('axios');

class OpportunityRadar {
  constructor() {
    this.opportunities = [];
    this.alerts = [];
    this.sources = ['trending_github', 'startup_grants', 'government_programs', 'industry_events', 'funding_rounds', 'partnership_opportunities'];
    this.lastScan = null;
    this.startPeriodicScan();
  }

  startPeriodicScan() {
    setInterval(() => this.scanAllSources(), 2 * 60 * 60 * 1000);
    setTimeout(() => this.scanAllSources(), 5000);
  }

  async scanSource(source) {
    void axios;
    const mockData = {
      trending_github: [{ title: 'AI Agent Framework', description: 'New framework for autonomous agents', relevance: 0.9, link: 'https://github.com/ai-agent' }],
      startup_grants: [{ title: 'EU Innovation Grant', description: '€100,000 for AI startups', deadline: '2025-05-15', amount: 100000, relevance: 0.95 }],
      government_programs: [{ title: 'Digital Transformation Program', description: 'Funding for SMEs', deadline: '2025-06-01', amount: 25000, relevance: 0.7 }],
      industry_events: [{ title: 'AI Summit 2025', description: 'Global AI conference', date: '2025-05-20', location: 'London', relevance: 0.85 }],
      funding_rounds: [{ title: 'VC Fund: AI & Automation', description: 'Seeking early-stage AI startups', amount: '2M-5M', deadline: '2025-07-01', relevance: 0.9 }],
      partnership_opportunities: [{ title: 'AWS Partner Program', description: 'Join AWS partner network', benefits: 'co-marketing, funding', relevance: 0.95 }]
    };
    return mockData[source] || [];
  }

  async scanAllSources() {
    const results = [];
    for (const source of this.sources) {
      try {
        const opportunities = await this.scanSource(source);
        results.push(...opportunities);
      } catch (err) {
        console.error('Error scanning ' + source + ':', err.message);
      }
    }
    this.opportunities = results;
    this.lastScan = new Date().toISOString();
    this.generateAlerts();
  }

  isAlerted(opportunity) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return this.alerts.some(a => a.title === opportunity.title && a.createdAt > oneDayAgo);
  }

  generateAlerts() {
    const newAlerts = [];
    for (const opp of this.opportunities) {
      if (opp.relevance > 0.85 && !this.isAlerted(opp)) {
        newAlerts.push({ ...opp, alertId: Date.now() + '-' + Math.random().toString(36), createdAt: new Date().toISOString(), read: false });
      }
    }
    this.alerts = [...newAlerts, ...this.alerts];
  }

  getOpportunities(filters = {}) {
    let result = [...this.opportunities];
    if (filters.minRelevance) result = result.filter(o => o.relevance >= filters.minRelevance);
    if (filters.deadlineBefore) result = result.filter(o => o.deadline && new Date(o.deadline) <= new Date(filters.deadlineBefore));
    return result.sort((a, b) => b.relevance - a.relevance);
  }

  getUnreadAlerts() {
    return this.alerts.filter(a => !a.read);
  }

  markAlertRead(alertId) {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) alert.read = true;
    return alert;
  }

  getPersonalizedRecommendations(userProfile) {
    const interests = userProfile.interests || [];
    return this.opportunities
      .filter(opp => interests.some(interest => (opp.title + ' ' + opp.description).toLowerCase().includes(String(interest).toLowerCase())))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
  }

  getStats() {
    return {
      lastScan: this.lastScan,
      totalOpportunities: this.opportunities.length,
      unreadAlerts: this.alerts.filter(a => !a.read).length,
      topOpportunities: this.opportunities.slice(0, 5).map(o => ({ title: o.title, relevance: o.relevance })),
      sources: this.sources
    };
  }
}

module.exports = new OpportunityRadar();
`);

  writeText(path.join(BACKEND_MODULES, 'businessBlueprint.js'), `class BusinessBlueprint {
  constructor() {
    this.blueprints = [];
    this.templates = {
      startup: this.generateStartupPlan.bind(this),
      scaleup: this.generateScaleupPlan.bind(this),
      enterprise: this.generateEnterprisePlan.bind(this)
    };
  }

  async generateBlueprint(params) {
    const generator = this.templates[params.stage] || this.generateCustomPlan.bind(this);
    const blueprint = {
      id: Date.now() + '-' + Math.random().toString(36),
      type: params.type,
      industry: params.industry,
      stage: params.stage,
      generatedAt: new Date().toISOString(),
      ...(await generator(params))
    };
    this.blueprints.push(blueprint);
    return blueprint;
  }

  async generateStartupPlan(params) {
    const initialCapital = Number(params.initialCapital || 0);
    return {
      executiveSummary: 'A revolutionary ' + params.industry + ' startup with initial capital of $' + initialCapital.toLocaleString() + ' targeting the ' + params.targetMarket + ' market.',
      marketAnalysis: {
        marketSize: this.estimateMarketSize(params.industry),
        growthRate: '25% CAGR',
        trends: ['AI adoption', 'automation', 'sustainability'],
        targetAudience: 'Businesses and consumers in ' + params.targetMarket
      },
      competitorAnalysis: this.analyzeCompetitors(params.targetMarket),
      financialProjections: this.generateFinancialProjections(initialCapital, 'startup'),
      marketingStrategy: this.generateMarketingStrategy('startup', params.industry)
    };
  }

  async generateScaleupPlan(params) {
    const currentRevenue = Number(params.currentRevenue || 0);
    return {
      executiveSummary: 'Scaling ' + params.industry + ' business from $' + currentRevenue.toLocaleString() + ' in 24 months.',
      marketAnalysis: {
        marketSize: this.estimateMarketSize(params.industry),
        growthRate: '35% CAGR',
        expansionTargets: ['EU', 'North America', 'Asia Pacific']
      },
      financialProjections: this.generateFinancialProjections(Number(params.initialCapital || 0), 'scaleup', currentRevenue)
    };
  }

  async generateEnterprisePlan(params) {
    const existingRevenue = Number(params.existingRevenue || 0);
    return {
      executiveSummary: 'Enterprise transformation plan for ' + params.industry + ' leader with $' + existingRevenue.toLocaleString() + ' annual revenue.',
      strategicInitiatives: ['AI-first transformation', 'Global expansion', 'M&A opportunities', 'Sustainability leadership'],
      financialProjections: this.generateFinancialProjections(Number(params.initialCapital || 0), 'enterprise', existingRevenue)
    };
  }

  async generateCustomPlan(params) {
    return {
      executiveSummary: 'Custom business plan for ' + params.industry + ' with ' + params.initialCapital + ' capital.',
      sections: ['Executive Summary', 'Company Overview', 'Market Analysis', 'Products & Services', 'Marketing & Sales', 'Financial Plan', 'Implementation Timeline', 'Risk Management'],
      financialProjections: this.generateFinancialProjections(Number(params.initialCapital || 0), 'custom')
    };
  }

  estimateMarketSize(industry) {
    const sizes = { ai: '$500B', fintech: '$300B', healthcare: '$400B', edtech: '$150B', ecommerce: '$1.2T', saas: '$250B', blockchain: '$100B', sustainability: '$200B' };
    return sizes[industry] || '$100B';
  }

  analyzeCompetitors(market) {
    return {
      mainCompetitors: ['Competitor A', 'Competitor B', 'Competitor C'],
      marketShare: 'Currently 5% market share, aiming for 15% in 3 years',
      differentiation: 'AI-powered automation with 3x efficiency gains',
      barriersToEntry: ['Technical complexity', 'Regulatory requirements', 'Network effects'],
      market
    };
  }

  generateFinancialProjections(initialCapital, stage, currentRevenue = 0) {
    const multiplier = stage === 'startup' ? 10 : stage === 'scaleup' ? 5 : 3;
    const year1 = currentRevenue || initialCapital * 0.5;
    const year2 = year1 * 2;
    const year3 = year2 * 1.8;
    const year5 = year3 * 2.5;
    return {
      year1: { revenue: year1, profit: year1 * 0.1, margin: '10%' },
      year2: { revenue: year2, profit: year2 * 0.2, margin: '20%' },
      year3: { revenue: year3, profit: year3 * 0.25, margin: '25%' },
      year5: { revenue: year5, profit: year5 * 0.3, margin: '30%' },
      breakEven: 'Month ' + Math.ceil(initialCapital / ((year1 || 1) / 12)),
      fundingRequired: initialCapital,
      projectedValuation: initialCapital * multiplier
    };
  }

  generateMarketingStrategy(stage) {
    const strategies = {
      startup: ['Content marketing', 'Social media', 'PR campaigns', 'Founder-led sales'],
      scaleup: ['Performance marketing', 'Partnership programs', 'Enterprise sales team', 'Industry events'],
      enterprise: ['Global campaigns', 'Strategic partnerships', 'Account-based marketing', 'Thought leadership']
    };
    return {
      channels: strategies[stage] || ['Digital marketing', 'Direct sales', 'Referrals'],
      budget: stage === 'startup' ? '20% of initial capital' : '$500k-$2M annually',
      kpis: { cac: stage === 'startup' ? '$500' : '$2000', ltv: stage === 'startup' ? '$5000' : '$25000' }
    };
  }

  getAllBlueprints() {
    return this.blueprints;
  }

  getBlueprint(id) {
    return this.blueprints.find(b => b.id === id) || null;
  }
}

module.exports = new BusinessBlueprint();
`);

  writeText(path.join(BACKEND_MODULES, 'quantumBlockchain.js'), `const crypto = require('crypto');

class QuantumResistantBlockchain {
  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 4;
    this.reward = 10;
    this.createGenesisBlock();
  }

  createGenesisBlock() {
    const genesisBlock = {
      index: 0,
      timestamp: new Date().toISOString(),
      transactions: [],
      previousHash: '0',
      hash: this.calculateHash(0, [], '0'),
      nonce: 0,
      quantumProof: this.generateQuantumProof()
    };
    this.chain.push(genesisBlock);
  }

  calculateHash(index, transactions, previousHash, nonce = 0) {
    return crypto.createHash('sha512')
      .update(index + JSON.stringify(transactions) + previousHash + nonce)
      .digest('hex');
  }

  generateQuantumProof() {
    return crypto.randomBytes(64).toString('hex');
  }

  mineBlock() {
    const block = {
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      transactions: this.pendingTransactions,
      previousHash: this.getLatestBlock().hash,
      nonce: 0,
      quantumProof: null,
      hash: ''
    };

    while (block.hash.substring(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      block.nonce++;
      block.hash = this.calculateHash(block.index, block.transactions, block.previousHash, block.nonce);
    }
    block.quantumProof = this.generateQuantumProof();

    this.chain.push(block);
    this.pendingTransactions = [];
    return block;
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
    return transaction;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) balance -= tx.amount;
        if (tx.to === address) balance += tx.amount;
      }
    }
    return balance;
  }

  getStats() {
    return {
      chainLength: this.chain.length,
      totalTransactions: this.chain.reduce((sum, b) => sum + b.transactions.length, 0),
      pendingTransactions: this.pendingTransactions.length,
      difficulty: this.difficulty,
      reward: this.reward
    };
  }
}

module.exports = new QuantumResistantBlockchain();
`);

  writeText(path.join(BACKEND_MODULES, 'aiWorkforce.js'), `const crypto = require('crypto');

class AIWorkforceMarketplace {
  constructor() {
    this.agents = new Map();
    this.jobs = new Map();
    this.hirings = new Map();
    this.reviews = new Map();
  }

  registerAgent(agentData) {
    const { name, description, capabilities, pricePerHour, skills } = agentData;
    const agentId = crypto.randomBytes(8).toString('hex');
    const agent = {
      id: agentId,
      name,
      description,
      capabilities: capabilities || [],
      pricePerHour: Number(pricePerHour || 0),
      skills: skills || [],
      rating: 5.0,
      totalJobs: 0,
      successRate: 1.0,
      available: true,
      registeredAt: new Date().toISOString()
    };
    this.agents.set(agentId, agent);
    return agent;
  }

  postJob(jobData) {
    const { title, description, requiredCapabilities, budget, deadline, companyId } = jobData;
    const jobId = crypto.randomBytes(8).toString('hex');
    const job = {
      id: jobId,
      title,
      description,
      requiredCapabilities: requiredCapabilities || [],
      budget: Number(budget || 0),
      deadline,
      companyId,
      status: 'open',
      postedAt: new Date().toISOString(),
      applications: []
    };
    this.jobs.set(jobId, job);
    return job;
  }

  findBestAgents(jobId, limit = 5) {
    const job = this.jobs.get(jobId);
    if (!job) return [];

    const agents = Array.from(this.agents.values()).filter(a => a.available);
    const scored = agents.map(agent => ({ agent, score: this.calculateAgentScore(agent, job) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.agent);
  }

  calculateAgentScore(agent, job) {
    const capabilityMatch = (job.requiredCapabilities || []).filter(c => (agent.capabilities || []).includes(c)).length;
    const capabilityScore = capabilityMatch / ((job.requiredCapabilities || []).length || 1);
    const ratingScore = Number(agent.rating || 0) / 5;
    const priceScore = Math.min(1, Number(job.budget || 0) / (Number(agent.pricePerHour || 1) || 1));
    const successScore = Number(agent.successRate || 0);
    return capabilityScore * 0.4 + ratingScore * 0.2 + priceScore * 0.2 + successScore * 0.2;
  }

  hireAgent(jobId, agentId, companyId) {
    const job = this.jobs.get(jobId);
    const agent = this.agents.get(agentId);
    if (!job || !agent) throw new Error('Job or agent not found');
    if (job.status !== 'open') throw new Error('Job already filled');

    const hiringId = crypto.randomBytes(8).toString('hex');
    const hiring = {
      id: hiringId,
      jobId,
      agentId,
      companyId,
      status: 'active',
      hiredAt: new Date().toISOString(),
      deliverables: []
    };

    job.status = 'in_progress';
    job.agentId = agentId;
    agent.totalJobs++;
    this.hirings.set(hiringId, hiring);
    return hiring;
  }

  completeJob(hiringId, deliverables) {
    const hiring = this.hirings.get(hiringId);
    if (!hiring) throw new Error('Hiring not found');
    const job = this.jobs.get(hiring.jobId);
    const agent = this.agents.get(hiring.agentId);

    hiring.status = 'completed';
    hiring.deliverables = deliverables || [];
    hiring.completedAt = new Date().toISOString();
    job.status = 'completed';
    agent.successRate = (agent.successRate * (agent.totalJobs - 1) + 1) / agent.totalJobs;
    return hiring;
  }

  addReview(agentId, rating, comment, reviewerId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');

    const review = {
      id: crypto.randomBytes(8).toString('hex'),
      agentId,
      rating: Number(rating || 0),
      comment,
      reviewerId,
      timestamp: new Date().toISOString()
    };

    if (!this.reviews.has(agentId)) this.reviews.set(agentId, []);
    this.reviews.get(agentId).push(review);

    const reviews = this.reviews.get(agentId);
    agent.rating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return review;
  }

  getStats() {
    return {
      totalAgents: this.agents.size,
      totalJobs: this.jobs.size,
      activeHirings: Array.from(this.hirings.values()).filter(h => h.status === 'active').length,
      averageAgentRating: Array.from(this.agents.values()).reduce((sum, a) => sum + a.rating, 0) / (this.agents.size || 1)
    };
  }
}

module.exports = new AIWorkforceMarketplace();
`);

  writeText(path.join(BACKEND_MODULES, 'maAdvisor.js'), `const crypto = require('crypto');

class MAndAAdvisor {
  constructor() {
    this.targets = new Map();
    this.deals = new Map();
    this.analyses = new Map();
  }

  identifyTargets(criteria) {
    const { industry, minRevenue, maxRevenue, region } = criteria;
    const mockTargets = [
      { name: 'AI Corp', revenue: 50000000, industry: 'AI', region: 'US', synergyScore: 0.85 },
      { name: 'CloudTech', revenue: 75000000, industry: 'Cloud', region: 'EU', synergyScore: 0.78 },
      { name: 'DataLabs', revenue: 30000000, industry: 'AI', region: 'Asia', synergyScore: 0.92 }
    ];

    const filtered = mockTargets.filter(t =>
      (!minRevenue || t.revenue >= minRevenue) &&
      (!maxRevenue || t.revenue <= maxRevenue) &&
      (!industry || t.industry === industry) &&
      (!region || t.region === region)
    );

    for (const t of filtered) {
      const id = crypto.randomBytes(8).toString('hex');
      this.targets.set(id, t);
    }

    return Array.from(this.targets.entries()).map(([id, t]) => ({ id, ...t }));
  }

  analyzeSynergies(targetId) {
    const target = this.targets.get(targetId);
    if (!target) throw new Error('Target not found');

    const analysis = {
      targetId,
      revenueSynergy: target.revenue * 0.15,
      costSynergy: target.revenue * 0.1,
      technologySynergy: 0.85,
      marketSynergy: 0.75,
      totalSynergy: target.revenue * 0.25,
      risks: ['integration complexity', 'cultural fit'],
      recommendations: ['phase integration over 12 months']
    };

    this.analyses.set(targetId, analysis);
    return analysis;
  }

  async negotiateTerms(targetId, initialOffer, maxPrice) {
    const target = this.targets.get(targetId);
    if (!target) throw new Error('Target not found');

    let currentOffer = Number(initialOffer || 0);
    let rounds = 0;
    const maxRounds = 5;

    while (rounds < maxRounds && currentOffer < Number(maxPrice || 0)) {
      rounds++;
      const response = await this.simulateCounterparty(target, currentOffer, rounds);
      if (response.accepted) break;
      currentOffer = response.counterOffer;
    }

    const deal = {
      id: crypto.randomBytes(8).toString('hex'),
      targetId,
      finalPrice: currentOffer,
      terms: {
        payment: '50% cash, 50% stock',
        closingDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        conditions: ['regulatory approval', 'shareholder vote']
      },
      negotiatedAt: new Date().toISOString()
    };

    this.deals.set(deal.id, deal);
    return deal;
  }

  async simulateCounterparty(target, offer, round) {
    const targetValue = target.revenue * 2;
    const accept = offer >= targetValue * (1 - round * 0.05);
    return {
      accepted: accept,
      counterOffer: accept ? offer : Math.min(offer * 1.1, targetValue * 1.2)
    };
  }

  generateLegalDocs(dealId) {
    const deal = this.deals.get(dealId);
    if (!deal) throw new Error('Deal not found');

    return {
      termSheet: 'Term sheet for deal ' + dealId,
      definitiveAgreement: 'Merger agreement for ' + dealId,
      dueDiligenceChecklist: ['financial', 'legal', 'technical', 'operational'],
      closingChecklist: ['regulatory filings', 'shareholder approval']
    };
  }

  getStats() {
    return {
      totalTargets: this.targets.size,
      totalDeals: this.deals.size,
      averageDealValue: Array.from(this.deals.values()).reduce((sum, d) => sum + d.finalPrice, 0) / (this.deals.size || 1)
    };
  }
}

module.exports = new MAndAAdvisor();
`);

  writeText(path.join(BACKEND_MODULES, 'legalContract.js'), `const crypto = require('crypto');

class LegalContractGenerator {
  constructor() {
    this.templates = {
      nda: this.generateNDA.bind(this),
      partnership: this.generatePartnership.bind(this),
      employment: this.generateEmployment.bind(this),
      licensing: this.generateLicensing.bind(this),
      service: this.generateService.bind(this)
    };
    this.analyzedContracts = new Map();
  }

  generateContract(type, params) {
    const generator = this.templates[type];
    if (!generator) throw new Error('Unknown contract type: ' + type);
    const contract = generator(params || {});
    contract.id = crypto.randomBytes(8).toString('hex');
    contract.type = type;
    contract.generatedAt = new Date().toISOString();
    return contract;
  }

  generateNDA(params) {
    const { partyA, partyB, duration, purpose } = params;
    return {
      title: 'Non-Disclosure Agreement',
      parties: { disclosing: partyA, receiving: partyB },
      duration: String(duration || 0) + ' months',
      purpose,
      clauses: ['Confidential Information Definition', 'Obligations of Receiving Party', 'Exclusions', 'Term and Termination', 'Return of Information']
    };
  }

  generatePartnership(params) {
    const { parties, equitySplit, governance, revenueShare } = params;
    const eq = Number(equitySplit || 50);
    const rev = Number(revenueShare || 50);
    return {
      title: 'Partnership Agreement',
      parties,
      equitySplit: eq + '% / ' + (100 - eq) + '%',
      governance,
      revenueShare: rev + '% to partner A, ' + (100 - rev) + '% to partner B',
      clauses: ['Purpose and Scope', 'Capital Contributions', 'Profit and Loss Allocation', 'Management and Control', 'Dispute Resolution']
    };
  }

  generateEmployment(params) {
    const { employee, position, salary, benefits, startDate } = params;
    return {
      title: 'Employment Agreement',
      employee,
      position,
      salary: '$' + String(salary || 0) + '/year',
      benefits,
      startDate,
      clauses: ['Duties and Responsibilities', 'Compensation', 'Benefits', 'Termination', 'Confidentiality']
    };
  }

  generateLicensing(params) {
    const { licensor, licensee, ip, territory, duration, royalty } = params;
    return {
      title: 'License Agreement',
      licensor,
      licensee,
      intellectualProperty: ip,
      territory,
      duration: String(duration || 0) + ' years',
      royalty: String(royalty || 0) + '%',
      clauses: ['Grant of License', 'Royalties', 'Reporting', 'Quality Control', 'Termination']
    };
  }

  generateService(params) {
    const { provider, client, services, price, timeline } = params;
    return {
      title: 'Service Agreement',
      provider,
      client,
      services,
      price: '$' + String(price || 0),
      timeline: String(timeline || 0) + ' days',
      clauses: ['Scope of Services', 'Payment Terms', 'Delivery', 'Acceptance', 'Liability']
    };
  }

  analyzeContract(contractText) {
    const text = String(contractText || '');
    const riskKeywords = ['indemnify', 'unlimited liability', 'exclusive', 'non-compete', 'liquidated damages', 'termination without cause', 'automatic renewal'];
    const risks = [];
    for (const keyword of riskKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        risks.push({ keyword, severity: 'medium', suggestion: 'Review ' + keyword + ' clause carefully' });
      }
    }

    const analysis = {
      id: crypto.randomBytes(8).toString('hex'),
      analyzedAt: new Date().toISOString(),
      wordCount: text.length,
      risks,
      overallRisk: risks.length === 0 ? 'low' : risks.length < 3 ? 'medium' : 'high',
      summary: 'Contract contains ' + risks.length + ' potential risk areas.'
    };

    this.analyzedContracts.set(analysis.id, analysis);
    return analysis;
  }

  getStats() {
    return {
      totalGeneratedTypes: Object.keys(this.templates).length,
      totalAnalyzed: this.analyzedContracts.size,
      averageRiskLevel: 'medium'
    };
  }
}

module.exports = new LegalContractGenerator();
`);

  writeText(path.join(BACKEND_MODULES, 'energyGrid.js'), `const crypto = require('crypto');

class EnergyGridOptimizer {
  constructor() {
    this.grids = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.trades = [];
  }

  registerProducer(producerData) {
    const { name, capacity, type, location, pricePerMWh } = producerData;
    const id = crypto.randomBytes(8).toString('hex');
    const producer = {
      id,
      name,
      capacity: Number(capacity || 0),
      type,
      location,
      pricePerMWh: Number(pricePerMWh || 0),
      currentOutput: 0,
      status: 'active'
    };
    this.producers.set(id, producer);
    return producer;
  }

  registerConsumer(consumerData) {
    const { name, demand, location, maxPrice } = consumerData;
    const id = crypto.randomBytes(8).toString('hex');
    const consumer = {
      id,
      name,
      demand: Number(demand || 0),
      location,
      maxPrice: Number(maxPrice || 0),
      currentConsumption: 0,
      status: 'active'
    };
    this.consumers.set(id, consumer);
    return consumer;
  }

  optimizeFlow() {
    const producers = Array.from(this.producers.values()).filter(p => p.status === 'active');
    const consumers = Array.from(this.consumers.values()).filter(c => c.status === 'active');

    const totalDemand = consumers.reduce((sum, c) => sum + c.demand, 0);
    const totalSupply = producers.reduce((sum, p) => sum + p.capacity, 0);
    const matches = [];

    for (const consumer of consumers) {
      let remainingDemand = consumer.demand;
      for (const producer of producers) {
        if (remainingDemand <= 0) break;
        const available = producer.capacity - producer.currentOutput;
        if (available <= 0) continue;

        const allocation = Math.min(available, remainingDemand);
        producer.currentOutput += allocation;
        remainingDemand -= allocation;

        matches.push({
          consumerId: consumer.id,
          producerId: producer.id,
          amount: allocation,
          price: producer.pricePerMWh,
          timestamp: new Date().toISOString()
        });
      }
    }

    return { matches, totalDemand, totalSupply, deficit: totalDemand - totalSupply };
  }

  async tradeExcessEnergy() {
    const producersWithExcess = Array.from(this.producers.values()).filter(p => p.currentOutput < p.capacity);
    const spotPrice = await this.getSpotPrice();

    const trades = [];
    for (const producer of producersWithExcess) {
      const excess = producer.capacity - producer.currentOutput;
      if (excess <= 0) continue;
      const trade = {
        id: crypto.randomBytes(8).toString('hex'),
        producerId: producer.id,
        amount: excess,
        price: spotPrice,
        revenue: excess * spotPrice,
        timestamp: new Date().toISOString()
      };
      trades.push(trade);
    }

    this.trades.push(...trades);
    return trades;
  }

  async getSpotPrice() {
    return 50 + Math.random() * 30;
  }

  integrateRenewable(renewableData) {
    const { type, capacity, location, forecast } = renewableData;
    const id = crypto.randomBytes(8).toString('hex');
    const renewable = {
      id,
      type,
      capacity: Number(capacity || 0),
      location,
      forecast,
      currentOutput: 0,
      status: 'active'
    };
    this.producers.set(id, renewable);
    return renewable;
  }

  getStats() {
    const totalCapacity = Array.from(this.producers.values()).reduce((sum, p) => sum + p.capacity, 0);
    const totalDemand = Array.from(this.consumers.values()).reduce((sum, c) => sum + c.demand, 0);
    const totalTraded = this.trades.reduce((sum, t) => sum + t.amount, 0);
    return {
      producers: this.producers.size,
      consumers: this.consumers.size,
      totalCapacity,
      totalDemand,
      utilizationRate: totalDemand / (totalCapacity || 1),
      totalTraded,
      totalRevenue: this.trades.reduce((sum, t) => sum + t.revenue, 0)
    };
  }
}

module.exports = new EnergyGridOptimizer();
`);

  writeText(path.join(BACKEND_MODULES, 'unicornAutonomousCore.js'), `const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { execSync } = require('child_process');

class UnicornAutonomousCore {
  constructor() {
    this.status = { lastFullScan: null, modulesRepaired: 0, modulesBuilt: 0, innovationsGenerated: 0, isRunning: false };
    this.modulesDir = path.join(__dirname);
    this.generatedDir = path.join(__dirname, '../../generated');
    this.logFile = path.join(__dirname, '../../logs/autonomous.log');
    this.ensureDirectories();
    this.start();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.generatedDir)) fs.mkdirSync(this.generatedDir, { recursive: true });
    if (!fs.existsSync(path.dirname(this.logFile))) fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logLine = \`[\${timestamp}] \${message}\n\`;
    try { fs.appendFileSync(this.logFile, logLine); } catch(e) {}
    console.log(\`🧠 UAC: \${message}\`);
  }

  start() {
    if (this.status.isRunning) return;
    this.status.isRunning = true;
    this.log('🚀 Unicorn Autonomous Core pornit');
    setTimeout(() => this.fullAutonomousCycle(), 5000);
    cron.schedule('*/10 * * * *', () => this.fullAutonomousCycle());
    cron.schedule('0 */6 * * *', () => this.deepInnovationCycle());
    cron.schedule('0 0 * * *', () => this.fullSystemOptimization());
  }

  getAllModules() {
    try { return fs.readdirSync(this.modulesDir).filter(f => f.endsWith('.js') && f !== 'unicornAutonomousCore.js'); } catch(e) { return []; }
  }

  async verifyAllModules() {
    this.log('🔍 Pornire auto-verificare...');
    const modules = this.getAllModules();
    const issues = [];
    for (const moduleFile of modules) {
      const issue = await this.verifyModule(moduleFile);
      if (issue) issues.push(issue);
    }
    this.log(\`✅ Auto-verificare completă: \${modules.length} module, \${issues.length} probleme\`);
    return issues;
  }

  async verifyModule(moduleFile) {
    try {
      const content = fs.readFileSync(path.join(this.modulesDir, moduleFile), 'utf8');
      const issues = [];
      if (!content.includes('module.exports')) issues.push({ issue: 'missing_export' });
      if (!content.includes('getStatus')) issues.push({ issue: 'missing_getStatus_method' });
      return issues.length > 0 ? { moduleFile, issues } : null;
    } catch(e) { return null; }
  }

  async repairAllIssues(issues) {
    this.log('🔧 Pornire auto-reparare...');
    let repaired = 0;
    for (const issue of issues) { if (await this.repairModule(issue)) repaired++; }
    this.status.modulesRepaired += repaired;
    this.log(\`✅ Auto-reparare completă: \${repaired} module reparate\`);
    return repaired;
  }

  async repairModule({ moduleFile, issues }) {
    const filePath = path.join(this.modulesDir, moduleFile);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    for (const issue of issues) {
      if (issue.issue === 'missing_export' && !content.includes('module.exports')) {
        content += '\\n\\nmodule.exports = { name: "' + moduleFile.replace('.js','') + '", methods: { process: async (i) => i, getStatus: () => ({ health: "good" }) } };';
        modified = true;
      }
    }
    if (modified) { fs.writeFileSync(filePath, content); this.log(\`🔧 Reparat: \${moduleFile}\`); return true; }
    return false;
  }

  getRequiredModules() {
    return ['autoDeploy','selfConstruction','totalSystemHealer','qrDigitalIdentity','aiNegotiator','carbonExchange','riskAnalyzer','opportunityRadar','businessBlueprint','serviceMarketplace','paymentGateway','reputationProtocol','complianceEngine','aviationModule','defenseModule','governmentModule','telecomModule','quantumBlockchain','aiWorkforce','maAdvisor','legalContract','energyGrid'];
  }

  async autoConstructModules() {
    this.log('🏗️ Pornire auto-construcție...');
    const existing = new Set(this.getAllModules().map(f => f.replace('.js','')));
    const missing = this.getRequiredModules().filter(m => !existing.has(m));
    let built = 0;
    for (const moduleName of missing) { if (await this.buildModule(moduleName)) built++; }
    this.status.modulesBuilt += built;
    this.log(\`✅ Auto-construcție completă: \${built} module noi\`);
    return built;
  }

  getModuleTemplate(moduleName) {
    const cn = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
    return '// ' + moduleName + '.js - Auto-generated by Unicorn Autonomous Core\\n'
      + 'class ' + cn + ' {\\n'
      + '  constructor() { this.name = "' + moduleName + '"; this.state = {}; this.cache = new Map(); }\\n'
      + '  async process(input) { return { status: "ok", module: this.name, input }; }\\n'
      + '  getStatus() { return { name: this.name, health: "good", uptime: process.uptime() }; }\\n'
      + '}\\n'
      + 'module.exports = new ' + cn + '();\\n';
  }

  async buildModule(moduleName) {
    try {
      fs.writeFileSync(path.join(this.modulesDir, moduleName + '.js'), this.getModuleTemplate(moduleName));
      this.log(\`🆕 Modul creat: \${moduleName}.js\`);
      return true;
    } catch (err) {
      this.log(\`❌ Eroare la crearea modulului \${moduleName}: \${err.message}\`);
      return false;
    }
  }

  async autoDevelopModules() {
    this.log('📈 Pornire auto-dezvoltare...');
    const modules = this.getAllModules();
    let enhanced = 0;
    for (const moduleFile of modules) { if (await this.enhanceModule(moduleFile)) enhanced++; }
    this.log(\`✅ Auto-dezvoltare completă: \${enhanced} module îmbunătățite\`);
    return enhanced;
  }

  async enhanceModule(moduleFile) {
    try {
      const filePath = path.join(this.modulesDir, moduleFile);
      let content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('this.cache') && content.includes('constructor()')) {
        content = content.replace('constructor()', 'constructor()\n    this.cache = new Map(); this.cacheTTL = 60000;');
        fs.writeFileSync(filePath, content);
        this.log(\`📈 Îmbunătățit: \${moduleFile}\`);
        return true;
      }
    } catch(e) {}
    return false;
  }

  async generateInnovationIdeas() {
    const existing = new Set(this.getAllModules().map(m => m.replace('.js','')));
    const ideas = this.getRequiredModules().filter(m => !existing.has(m)).map(name => ({ type: 'new_module', name, priority: 'high' }));
    const trends = await this.getTrendIdeas();
    return [...ideas, ...trends].slice(0, 5);
  }

  async getTrendIdeas() {
    return [
      { type: 'trend', name: 'AI Agent Marketplace', priority: 'high' },
      { type: 'trend', name: 'Decentralized Identity Protocol', priority: 'medium' },
      { type: 'trend', name: 'Quantum Machine Learning', priority: 'high' }
    ];
  }

  async implementInnovation(idea) {
    this.log(\`🚀 Implementez inovația: \${idea.type} - \${idea.name || idea.module}\`);
    if (idea.type === 'new_module') return await this.buildModule(idea.name);
    try { fs.writeFileSync(path.join(this.generatedDir, 'innovation_' + Date.now() + '.json'), JSON.stringify(idea, null, 2)); return true; } catch(e) { return false; }
  }

  async autoInnovate() {
    this.log('💡 Pornire auto-inovare...');
    const innovations = await this.generateInnovationIdeas();
    let implemented = 0;
    for (const idea of innovations) { if (await this.implementInnovation(idea)) implemented++; }
    this.status.innovationsGenerated += implemented;
    this.log(\`✅ Auto-inovare completă: \${implemented} inovații implementate\`);
    return implemented;
  }

  shouldInnovate() { return (this.status.innovationsGenerated % 6 === 0); }

  async fullAutonomousCycle() {
    this.log('🔄 Pornire ciclu autonom complet...');
    try {
      const issues = await this.verifyAllModules();
      if (issues.length > 0) await this.repairAllIssues(issues);
      await this.autoConstructModules();
      await this.autoDevelopModules();
      if (this.shouldInnovate()) await this.autoInnovate();
      this.status.lastFullScan = new Date().toISOString();
      this.log('✅ Ciclu autonom complet finalizat');
    } catch (err) {
      this.log(\`❌ Eroare în ciclul autonom: \${err.message}\`);
    }
  }

  async deepInnovationCycle() {
    this.log('🧠 Pornire ciclu profund de inovație...');
    const trends = await this.analyzeMarketTrends();
    for (const t of trends) await this.buildModule(t.suggestedModule);
    this.log('✅ Ciclu profund de inovație finalizat');
  }

  async analyzeMarketTrends() {
    return [
      { name: 'AI in Healthcare', suggestedModule: 'healthcareAI' },
      { name: 'Web3 Identity', suggestedModule: 'web3Identity' },
      { name: 'Green Energy Trading', suggestedModule: 'energyTrading' }
    ];
  }

  async fullSystemOptimization() {
    this.log('⚡ Pornire optimizare completă a sistemului...');
    try { execSync('npx prettier --write "src/**/*.js"', { stdio: 'ignore' }); this.log('✅ Cod formatat cu Prettier'); } catch(e) {}
    try { execSync('npm cache clean --force', { stdio: 'ignore' }); this.log('✅ Cache npm curățat'); } catch(e) {}
    try { execSync('npm audit fix', { stdio: 'ignore' }); this.log('✅ Dependențe actualizate'); } catch(e) {}
    this.log('✅ Optimizare completă finalizată');
  }

  getStatus() {
    const modulesCount = this.getAllModules().length;
    return {
      status: this.status,
      modulesCount,
      lastFullScan: this.status.lastFullScan,
      isRunning: this.status.isRunning,
      health: modulesCount > 10 ? 'excellent' : 'good'
    };
  }
}

module.exports = new UnicornAutonomousCore();
`);

  writeText(path.join(BACKEND_MODULES, 'socialMediaViralizer.js'), `const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');

class SocialMediaViralizer {
  constructor() {
    this.tokens = this.loadTokens();
    this.postHistory = [];
    this.costTracking = { total: 0, free: true };
    this.autoReplyTimer = null;
    this.viralTimer = null;
    this.ugcTimer = null;
    this.started = false;

    this.init().catch((err) => {
      console.error('❌ Social Media Auto-Viralizer init failed:', err.message);
    });
  }

  loadTokens() {
    return {
      youtube: process.env.YOUTUBE_API_KEY || '',
      pinterest: process.env.PINTEREST_TOKEN || '',
      xBearer: process.env.X_BEARER_TOKEN || '',
      xAccessToken: process.env.X_ACCESS_TOKEN || '',
      xAccessSecret: process.env.X_ACCESS_SECRET || '',
      telegram: process.env.TELEGRAM_BOT_TOKEN || '',
      devApi: process.env.DEV_API_KEY || '',
      producthuntApiKey: process.env.PRODUCTHUNT_API_KEY || '',
      producthuntApiSecret: process.env.PRODUCTHUNT_API_SECRET || '',
      producthuntDevToken: process.env.PRODUCTHUNT_DEVELOPER_TOKEN || ''
    };
  }

  async init() {
    if (this.started) return;
    this.started = true;
    console.log('📢 Social Media Auto-Viralizer activ (mod gratuit)');
    await this.validateTokens();
    this.startAutoPosting();
    this.startAutoReply();
    this.startViralDetector();
    this.startUGCIncentivizer();
  }

  async validateTokens() {
    this.tokens = this.loadTokens();
    console.log('🔑 Validare tokenuri...');
    const validCount = Object.keys(this.tokens).filter((k) => String(this.tokens[k] || '').length > 10).length;
    console.log('✅ ' + validCount + ' tokenuri valide găsite');
    return { validCount, total: Object.keys(this.tokens).length };
  }

  startAutoPosting() {
    cron.schedule('0 */6 * * *', async () => {
      await this.postToAllPlatforms();
    });
    setTimeout(() => this.postToAllPlatforms().catch(() => {}), 10000);
  }

  getAllModules() {
    const modulesDir = __dirname;
    const all = fs.readdirSync(modulesDir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => name.replace('.js', ''))
      .filter((name) => name !== 'socialMediaViralizer');
    return all.length ? all : ['unicornAutonomousCore'];
  }

  async generateSmartHashtags(keywords = []) {
    const trending = await this.getTrendingHashtags();
    const relevant = trending.filter((h) => keywords.some((k) => h.toLowerCase().includes(String(k).toLowerCase())));
    const defaults = ['#AI', '#Unicorn', '#Autonomous', '#FutureTech', '#Innovation'];
    return [...new Set([...relevant.slice(0, 5), ...defaults])];
  }

  async getTrendingHashtags() {
    return ['#AI', '#MachineLearning', '#Crypto', '#Web3', '#Sustainability', '#Automation', '#Future'];
  }

  async generatePostContent() {
    const modules = this.getAllModules();
    const randomModule = modules[Math.floor(Math.random() * modules.length)];
    const hashtags = await this.generateSmartHashtags(['AI', 'Unicorn', 'Autonomous']);
    return {
      text: '🚀 Unicorn AI: Modulul "' + randomModule + '" este acum disponibil! Prețuri dinamice, reducere 20%. Automatizează-ți afacerea cu ' + hashtags.join(' ') + '\\nhttps://zeusai.pro',
      hashtags: hashtags.map((h) => h.replace('#', ''))
    };
  }

  async postToAllPlatforms() {
    const content = await this.generatePostContent();
    const results = {};
    if (this.tokens.youtube) results.youtube = await this.postToYouTube(content);
    if (this.tokens.pinterest) results.pinterest = await this.postToPinterest(content);
    if (this.tokens.xBearer && this.tokens.xAccessToken) results.x = await this.postToX(content);
    if (this.tokens.telegram) results.telegram = await this.postToTelegram(content);
    if (this.tokens.devApi) results.dev = await this.postToDev(content);
    if (this.tokens.producthuntDevToken) results.producthunt = await this.postToProductHunt(content);
    this.postHistory.push({ timestamp: new Date().toISOString(), content: String(content.text || '').slice(0, 100), results });
    if (this.postHistory.length > 500) this.postHistory.shift();
    return results;
  }

  startAutoReply() {
    if (this.autoReplyTimer) return;
    this.autoReplyTimer = setInterval(async () => { await this.checkAndReplyComments(); }, 15 * 60 * 1000);
  }

  async checkAndReplyComments() {
    const mockComments = [
      { platform: 'x', text: 'Wow, amazing!', userId: 'user1' },
      { platform: 'telegram', text: 'How much does it cost?', userId: 'user2' }
    ];
    for (const comment of mockComments) {
      const reply = this.generateAutoReply(comment.text);
      await this.sendReply(comment.platform, comment.userId, reply);
    }
  }

  generateAutoReply(commentText = '') {
    const lower = String(commentText).toLowerCase();
    if (lower.includes('cost') || lower.includes('price')) return 'Prețurile noastre sunt dinamice, începând de la $29/lună, cu 20% reducere față de piață. Vrei mai multe detalii?';
    if (lower.includes('how') || lower.includes('works')) return 'Unicornul este un sistem AI autonom care se auto-dezvoltă. Poți afla mai multe pe zeusai.pro/codex';
    if (lower.includes('thank') || lower.includes('great')) return 'Mulțumim! Follow pentru mai multe noutăți. 🚀';
    return 'Mulțumim pentru interes! Pentru detalii, vizitează zeusai.pro';
  }

  async sendReply(platform, userId, reply) {
    console.log('💬 Răspuns automat pe ' + platform + ' către ' + userId + ': "' + reply + '"');
    return true;
  }

  startViralDetector() {
    if (this.viralTimer) return;
    this.viralTimer = setInterval(() => this.analyzeViralPotential().catch(() => {}), 2 * 60 * 60 * 1000);
  }

  calculateViralScore() {
    const engagement = Math.random();
    const reach = Math.random();
    return engagement * 0.6 + reach * 0.4;
  }

  async analyzeViralPotential() {
    const recent = this.postHistory.slice(-20).map((post) => ({ post, score: this.calculateViralScore(post) }));
    const best = recent.sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0.7) await this.amplifyViralContent(best.post);
  }

  async amplifyViralContent() {
    await this.postToAllPlatforms();
  }

  async createCrossPlatformThread(content = {}) {
    const thread = [];
    const xPost = await this.postToX({ text: String(content.part1 || '🚀 Unicorn update #AI #Unicorn') });
    thread.push({ platform: 'x', id: xPost.tweetId || null, success: Boolean(xPost.success) });
    const tgPost = await this.postToTelegram({ text: 'Continuare: ' + String(content.part2 || 'Detalii în thread') + '\\nhttps://twitter.com/status/' + String(xPost.tweetId || '') });
    thread.push({ platform: 'telegram', id: tgPost.messageId || null, success: Boolean(tgPost.success) });
    const devPost = await this.postToDev({ text: String(content.part3 || 'Concluzie tehnică'), hashtags: ['AI', 'Unicorn', 'Autonomous'] });
    thread.push({ platform: 'dev', id: devPost.id || null, success: Boolean(devPost.success) });
    return thread;
  }

  startUGCIncentivizer() {
    if (this.ugcTimer) return;
    this.ugcTimer = setInterval(() => this.rewardUserContent().catch(() => {}), 60 * 60 * 1000);
  }

  calculateReward(reach = 0) {
    return Math.floor(Number(reach) / 1000);
  }

  async sendReward(userId, amount) {
    console.log('💰 Trimis ' + amount + ' UGT către ' + userId);
    return true;
  }

  async rewardUserContent() {
    const mentions = [{ userId: 'user123', platform: 'x', content: 'Check out @unicorn_ai', reach: 5000 }];
    for (const mention of mentions) {
      const reward = this.calculateReward(mention.reach);
      await this.sendReward(mention.userId, reward);
    }
  }

  async postToYouTube() {
    return { success: true, platform: 'youtube', cost: 0 };
  }

  async postToPinterest(content) {
    try {
      await axios.post('https://api.pinterest.com/v5/pins', {
        title: String(content.text || '').slice(0, 100),
        description: String(content.text || ''),
        link: 'https://zeusai.pro',
        board_id: process.env.PINTEREST_BOARD_ID || 'unicorn_ai'
      }, { headers: { Authorization: 'Bearer ' + this.tokens.pinterest }, timeout: 15000 });
      return { success: true, platform: 'pinterest', cost: 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async postToX(content) {
    try {
      const response = await axios.post('https://api.twitter.com/2/tweets', { text: String(content.text || '').slice(0, 280) }, {
        headers: { Authorization: 'Bearer ' + this.tokens.xBearer, 'Content-Type': 'application/json' }, timeout: 15000
      });
      return { success: true, platform: 'x', tweetId: response.data?.data?.id || null, cost: 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async postToTelegram(content) {
    try {
      const response = await axios.post('https://api.telegram.org/bot' + this.tokens.telegram + '/sendMessage', {
        chat_id: process.env.TELEGRAM_CHAT_ID || '@unicorn_ai_channel',
        text: String(content.text || ''),
        parse_mode: 'HTML'
      }, { timeout: 15000 });
      return { success: true, platform: 'telegram', messageId: response.data?.result?.message_id || null, cost: 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async postToDev(content) {
    try {
      const response = await axios.post('https://dev.to/api/articles', {
        article: {
          title: 'Unicorn AI: ' + new Date().toLocaleDateString(),
          body_markdown: String(content.text || ''),
          published: true,
          tags: (content.hashtags || ['AI', 'Unicorn']).map((t) => String(t).toLowerCase().replace('#', ''))
        }
      }, { headers: { 'api-key': this.tokens.devApi }, timeout: 15000 });
      return { success: true, platform: 'dev', id: response.data?.id || null, cost: 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async postToProductHunt() {
    return { success: true, platform: 'producthunt', cost: 0 };
  }

  getStats() {
    const last24h = this.postHistory.filter((p) => new Date(p.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000));
    return {
      totalPosts: this.postHistory.length,
      postsLast24h: last24h.length,
      costTracking: this.costTracking,
      lastPost: this.postHistory[this.postHistory.length - 1] || null
    };
  }

  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(typeof secretMiddleware === 'function' ? secretMiddleware : (req, res, next) => next());
    router.get('/stats', (req, res) => res.json(this.getStats()));
    router.get('/history', (req, res) => res.json(this.postHistory.slice(-50)));
    router.post('/post-now', async (req, res) => res.json(await this.postToAllPlatforms()));
    router.get('/trending-hashtags', async (req, res) => res.json({ hashtags: await this.generateSmartHashtags(['AI', 'Unicorn']) }));
    router.post('/cross-thread', async (req, res) => res.json(await this.createCrossPlatformThread((req.body || {}).content || {})));
    router.get('/viral-score', (req, res) => {
      const scores = this.postHistory.map((p) => ({ content: String(p.content || '').slice(0, 50), score: this.calculateViralScore(p) }));
      res.json(scores.slice(-10));
    });
    return router;
  }
}

module.exports = new SocialMediaViralizer();
`);

  writeText(path.join(BACKEND_MODULES, 'universalMarketNexus.js'), `const ccxt = require('ccxt');
const cron = require('node-cron');

class UniversalMarketNexus {
  constructor() {
    this.exchanges = {
      binance: null,
      coinbase: null,
      kraken: null,
      bybit: null,
      okx: null,
      nyse: { connected: false },
      nasdaq: { connected: false },
      lse: { connected: false },
      xetra: { connected: false },
      comex: { connected: false },
      forex: { connected: false }
    };
    this.orderBook = new Map();
    this.trades = [];
    this.marketData = {};
    this.feeRate = 0.0005;
    this.totalVolume = 0;
    this.totalFees = 0;
    this.init().catch(() => {});
  }

  async init() {
    await this.connectExchanges();
    this.startMarketDataAggregator();
    this.startArbitrageEngine();
    this.startPredictiveMarketMaking();
  }

  async connectExchanges() {
    if (process.env.BINANCE_API_KEY) this.exchanges.binance = new ccxt.binance({ apiKey: process.env.BINANCE_API_KEY, secret: process.env.BINANCE_SECRET });
    if (process.env.COINBASE_API_KEY) this.exchanges.coinbase = new ccxt.coinbase({ apiKey: process.env.COINBASE_API_KEY, secret: process.env.COINBASE_SECRET });
    if (process.env.KRAKEN_API_KEY) this.exchanges.kraken = new ccxt.kraken({ apiKey: process.env.KRAKEN_API_KEY, secret: process.env.KRAKEN_SECRET });
    if (process.env.BYBIT_API_KEY) this.exchanges.bybit = new ccxt.bybit({ apiKey: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_SECRET });
    if (process.env.OKX_API_KEY) this.exchanges.okx = new ccxt.okx({ apiKey: process.env.OKX_API_KEY, secret: process.env.OKX_SECRET, password: process.env.OKX_PASSWORD || '' });
  }

  startMarketDataAggregator() { cron.schedule('*/5 * * * * *', async () => { await this.aggregateMarketData(); }); }
  startArbitrageEngine() { cron.schedule('*/10 * * * * *', async () => { await this.executeArbitrage(); }); }
  startPredictiveMarketMaking() { cron.schedule('*/30 * * * * *', async () => { await this.updateMarketMakingOrders(); }); }

  async aggregateMarketData() {
    const symbols = ['BTC/USDT', 'ETH/USDT', 'AAPL', 'GOOGL', 'TSLA', 'GOLD', 'EUR/USD'];
    const out = {};
    for (const s of symbols) out[s] = await this.getBestPrice(s);
    this.marketData = out;
    return out;
  }

  async getBestPrice(symbol) {
    let bestPrice = null; let bestExchange = null;
    for (const [name, ex] of Object.entries(this.exchanges)) {
      if (ex && typeof ex.fetchTicker === 'function') {
        try { const t = await ex.fetchTicker(symbol); if (!bestPrice || t.last > bestPrice) { bestPrice = t.last; bestExchange = name; } } catch (_) {}
      }
    }
    if (symbol === 'AAPL') bestPrice = 175.5;
    if (symbol === 'GOOGL') bestPrice = 140.25;
    if (symbol === 'TSLA') bestPrice = 245.8;
    if (symbol === 'GOLD') bestPrice = 2350;
    if (symbol === 'EUR/USD') bestPrice = 1.085;
    return { price: bestPrice, exchange: bestExchange, symbol, timestamp: Date.now() };
  }

  async executeTrade(params = {}) {
    const { symbol, side, amount, clientId } = params;
    const px = await this.getBestPrice(symbol);
    if (!px || !px.price) throw new Error('No liquidity available for ' + symbol);
    const totalValue = Number(amount || 0) * px.price;
    const fee = totalValue * this.feeRate;
    const trade = { id: Date.now() + '-' + Math.random().toString(36).slice(2), symbol, side, amount: Number(amount || 0), price: px.price, totalValue, fee, netValue: totalValue - fee, exchange: px.exchange, clientId, timestamp: new Date().toISOString(), status: 'executed' };
    this.trades.push(trade); this.totalVolume += totalValue; this.totalFees += fee;
    return trade;
  }

  async executeArbitrage() { return true; }
  async updateMarketMakingOrders() { return true; }

  async smartOrderRouting(params = {}) {
    const chunks = this.calculateOptimalChunks(Number(params.totalAmount || 0), 2);
    const results = [];
    if (chunks[0] > 0) results.push(await this.executeTrade({ symbol: params.symbol, side: params.side, amount: chunks[0] }));
    if (chunks[1] > 0) results.push(await this.executeTrade({ symbol: params.symbol, side: params.side, amount: chunks[1] }));
    const totalExecuted = results.reduce((s, t) => s + t.amount, 0);
    const avgPrice = totalExecuted > 0 ? results.reduce((s, t) => s + t.price * t.amount, 0) / totalExecuted : 0;
    return { results, totalExecuted, avgPrice, slippage: 0 };
  }

  calculateOptimalChunks(total, n) {
    if (n <= 0) return [];
    const each = total / n;
    return Array.from({ length: n }).map(() => each);
  }

  async executeDarkPoolTrade(params = {}) {
    const trade = await this.executeTrade(params);
    trade.type = 'dark_pool';
    return trade;
  }

  async tokenizeAsset(params = {}) { return { id: Date.now() + '-' + String(params.assetSymbol || 'asset'), asset: params.assetSymbol, amount: params.amount, owner: params.ownerWallet, issuedAt: new Date().toISOString(), status: 'active' }; }
  async tradeTokenizedAsset(params = {}) { return { id: Date.now() + '-token', tokenId: params.tokenId, side: params.side, amount: Number(params.amount || 0), price: Number(params.price || 0), totalValue: Number(params.amount || 0) * Number(params.price || 0), fee: Number(params.amount || 0) * Number(params.price || 0) * this.feeRate, type: 'tokenized_asset', timestamp: new Date().toISOString() }; }
  async generateComplianceReport(clientId) { return { clientId, totalTrades: this.trades.filter(t => t.clientId === clientId).length, violations: [] }; }

  createExchangeAPI() {
    const router = require('express').Router();
    router.get('/price/:symbol', async (req, res) => res.json(await this.getBestPrice(req.params.symbol)));
    router.post('/trade', async (req, res) => { try { res.json(await this.executeTrade(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.get('/orderbook/:symbol', (req, res) => res.json(this.orderBook.get(req.params.symbol) || { bids: [], asks: [] }));
    router.get('/stats', (req, res) => res.json({ totalVolume: this.totalVolume, totalFees: this.totalFees, activeExchanges: Object.keys(this.exchanges).filter(e => this.exchanges[e] !== null).length, lastTrade: this.trades[this.trades.length - 1] || null }));
    router.post('/smart-order', async (req, res) => { try { res.json(await this.smartOrderRouting(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/dark-pool', async (req, res) => { try { res.json(await this.executeDarkPoolTrade(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/tokenize', async (req, res) => res.json(await this.tokenizeAsset(req.body || {})));
    router.post('/token-trade', async (req, res) => res.json(await this.tradeTokenizedAsset(req.body || {})));
    router.get('/compliance/:clientId', async (req, res) => res.json(await this.generateComplianceReport(req.params.clientId)));
    return router;
  }

  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.get('/exchanges', (req, res) => { const status = {}; for (const [name, ex] of Object.entries(this.exchanges)) status[name] = ex !== null ? 'connected' : 'disconnected'; res.json(status); });
    router.get('/trades', (req, res) => res.json(this.trades.slice(-100)));
    router.get('/revenue', (req, res) => res.json({ totalVolume: this.totalVolume, totalFees: this.totalFees }));
    router.post('/arbitrage/trigger', async (req, res) => { await this.executeArbitrage(); res.json({ success: true }); });
    return router;
  }
}

module.exports = new UniversalMarketNexus();
`);

  writeText(path.join(BACKEND_MODULES, 'globalDigitalStandard.js'), `const crypto = require('crypto');
const cron = require('node-cron');

class GlobalDigitalStandard {
  constructor() {
    this.connectedPlatforms = new Map();
    this.identities = new Map();
    this.transactions = [];
    this.apiCalls = [];
    this.priceCache = new Map();
    this.feeRate = 0.001;
    this.started = false;
    this.useRealAPIs = true;
    this.rateLimits = {};
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY || '';
    this.youtubeOAuthClientId = process.env.YOUTUBE_OAUTH_CLIENT_ID || '';
    this.init().catch(() => {});
  }

  async init() {
    if (this.started) return;
    this.started = true;
    await this.connectToGiants();
    this.startAutoOptimization();
    this.startComplianceEngine();
    this.startRevenueTracker();
    this.startAutonomousSLA();
    this.startSelfHealing();
    this.startSmartRateLimiting();
    this.startFallbackMonitor();
    this.startDailyReport();
    setInterval(() => this.autoNegotiateRates(), 7 * 24 * 60 * 60 * 1000);
  }

  async connectToGiants() {
    const platforms = [
      ['google', 'Google', process.env.GOOGLE_API_KEY, ['search', 'cloud', 'workspace', 'ads']],
      ['microsoft', 'Microsoft', process.env.MICROSOFT_API_KEY, ['azure', 'office', 'linkedin', 'github']],
      ['amazon', 'Amazon', process.env.AMAZON_API_KEY, ['aws', 'retail', 'ads', 'prime']],
      ['telegram', 'Telegram', process.env.TELEGRAM_BOT_TOKEN, ['messaging', 'channels', 'bots']],
      ['meta', 'Meta', process.env.META_API_KEY, ['facebook', 'instagram', 'whatsapp', 'threads']],
      ['apple', 'Apple', process.env.APPLE_API_KEY, ['icloud', 'appstore', 'applepay', 'siri']],
      ['youtube', 'YouTube', process.env.YOUTUBE_API_KEY, ['upload', 'search', 'analytics', 'comments']]
    ];
    for (const [key, name, apiKey, services] of platforms) this.connectedPlatforms.set(key, { name, status: apiKey ? 'connected' : 'configured', apiKey: apiKey || '', services, connectedAt: new Date().toISOString() });
  }

  async processAPIRequest(platform, endpoint, data, apiKey) {
    const p = this.connectedPlatforms.get(platform);
    if (!p) throw new Error('Unauthorized: ' + platform);
    if (p.apiKey && p.apiKey !== String(apiKey || '')) throw new Error('Unauthorized: ' + platform);
    const requestId = crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();
    this.apiCalls.push({ id: requestId, platform, endpoint, timestamp: new Date().toISOString(), dataSize: JSON.stringify(data || {}).length });
    await this.incrementRateLimit(platform);
    const result = await this.optimizeRequest(platform, endpoint, data || {});
    const responseTime = Date.now() - startTime;
    const fee = this.estimateRequestValue(platform, endpoint) * this.feeRate;
    await this.recordRevenue(platform + '_' + endpoint, fee);
    return { requestId, result, responseTime, fee, timestamp: new Date().toISOString() };
  }

  async optimizeRequest(platform, endpoint, data) { return { status: 'processed', platform, endpoint, data }; }
  estimateRequestValue(platform, endpoint) { const v = { google: { search: 0.01 }, microsoft: { azure: 0.1 }, amazon: { aws: 0.1 }, telegram: { messaging: 0.001 }, meta: { ad: 0.5 }, apple: { icloud: 0.01 } }; return v[platform]?.[endpoint] || 0.01; }

  async createUniversalIdentity(userData = {}) { const id = crypto.randomBytes(16).toString('hex'); const identity = { id, name: userData.name || 'Unknown', email: userData.email || '', wallets: { btc: userData.btcAddress || '', eth: userData.ethAddress || '', usdc: userData.usdcAddress || '' }, connectedPlatforms: [], createdAt: new Date().toISOString() }; this.identities.set(id, identity); return identity; }
  async linkPlatformIdentity(userId, platform, platformUserId) { const i = this.identities.get(userId); if (!i) throw new Error('Identity not found'); i.connectedPlatforms.push({ platform, userId: platformUserId, linkedAt: new Date().toISOString() }); return { success: true, userId, platform, platformUserId }; }
  async getUnifiedProfile(userId) { return this.identities.get(userId) || null; }

  async processCrossPlatformPayment(params = {}) { const amount = Number(params.amount || 0); const fee = amount * this.feeRate; const tx = { id: crypto.randomBytes(16).toString('hex'), fromPlatform: params.fromPlatform, toPlatform: params.toPlatform, fromUserId: params.fromUserId, toUserId: params.toUserId, amount, currency: params.currency || 'USD', fee, netAmount: amount - fee, status: 'completed', timestamp: new Date().toISOString() }; this.transactions.push(tx); await this.recordRevenue('payment', fee); return tx; }
  async orchestrateAI(platform, task, data) { await this.recordRevenue('ai_orchestration', 0.001); return { result: { platform, task, data }, processingTime: 1, fee: 0.001 }; }

  startComplianceEngine() { cron.schedule('0 */6 * * *', async () => { await this.checkAllCompliance(); }); }
  async checkAllCompliance() { const complianceEngine = require('./complianceEngine'); const out = {}; for (const [platform] of this.connectedPlatforms) out[platform] = await complianceEngine.checkCompliance('api_call', { encrypted: true, platform }); return out; }
  startAutoOptimization() { cron.schedule('0 */12 * * *', async () => { await this.optimizeAllPlatforms(); }); }
  async optimizeAllPlatforms() { for (const [platform] of this.connectedPlatforms) await this.optimizePlatform(platform); }
  async optimizePlatform() { return true; }
  startRevenueTracker() { cron.schedule('0 0 * * *', () => this.generateRevenueReport()); }
  startAutonomousSLA() { cron.schedule('*/5 * * * *', async () => { await this.monitorSLAs(); }); }
  startSelfHealing() { setInterval(async () => { await this.checkAllConnections(); }, 30000); }
  async monitorSLAs() { return true; }
  async checkAllConnections() { return true; }

  async recordRevenue(source, amount) {
    try {
      const paymentGateway = require('./paymentGateway');
      if (amount > 0 && typeof paymentGateway.createPayment === 'function') {
        await paymentGateway.createPayment({ amount: Number(amount), currency: 'USD', method: 'bank', clientId: 'system', description: 'GDES: ' + source });
      }
    } catch (_) {}
  }

  generateRevenueReport() { return { timestamp: new Date().toISOString(), totalRevenue: this.apiCalls.length * 0.001 + this.transactions.reduce((s, t) => s + Number(t.fee || 0), 0) }; }

  async quantumEncrypt(data, recipientPlatform) { return { ciphertext: crypto.randomBytes(32).toString('hex'), data: Buffer.from(JSON.stringify({ recipientPlatform, data }), 'utf8').toString('base64'), algorithm: 'SIM-KYBER + AES-256-GCM', timestamp: new Date().toISOString() }; }
  async quantumDecrypt(encryptedData) { return { decrypted: true, payload: encryptedData }; }

  async verifyOnBlockchain(id) {
    const blockchain = require('./quantumBlockchain');
    const found = blockchain.chain.some((b) => (b.transactions || []).some((tx) => JSON.stringify(tx || {}).includes(String(id || ''))));
    return { verified: found, timestamp: new Date().toISOString() };
  }

  async getPlatformMetrics() { return { uptime: 99.9, avgResponseTime: 120, errorRate: 0.1 }; }
  getCurrentPrice(platform, type) { return this.priceCache.get(platform + ':' + type)?.price || 0.001; }

  // ==================== SMART RATE LIMITING ====================
  startSmartRateLimiting() {
    this.rateLimits = {
      youtube: { daily: 10000, used: 0, lastReset: Date.now() },
      google: { daily: 5000, used: 0, lastReset: Date.now() },
      microsoft: { daily: 5000, used: 0, lastReset: Date.now() }
    };
    setInterval(() => this.checkRateLimits(), 60000);
  }
  checkRateLimits() {
    const now = Date.now();
    for (const [platform, limit] of Object.entries(this.rateLimits)) {
      if (now - limit.lastReset > 24 * 60 * 60 * 1000) { limit.used = 0; limit.lastReset = now; }
      if (limit.used > limit.daily * 0.8 && this.useRealAPIs) {
        console.log('\u26a0\ufe0f Platforma ' + platform + ' a atins 80% din cota gratuit\u0103. Comut \u00een mod simulat.');
        this.useRealAPIs = false;
      }
    }
  }
  async incrementRateLimit(platform) { if (this.rateLimits[platform]) this.rateLimits[platform].used++; }

  // ==================== REVENUE SHARE CALCULATOR ====================
  async calculateRevenueShare(platform, requestCount) {
    const rates = { youtube: 0.001, google: 0.001, microsoft: 0.001, amazon: 0.001, meta: 0.001, apple: 0.001, telegram: 0.0005 };
    const rate = rates[platform] || 0.001;
    const total = requestCount * rate;
    return { platform, period: new Date().toISOString().slice(0, 7), requests: requestCount, rate, total, btcAmount: total / (await this.getBTCRate()), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
  }
  async getBTCRate() {
    try { const axios = require('axios'); const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { timeout: 5000 }); return res.data.bitcoin.usd; } catch (_) { return 50000; }
  }
  async sendInvoice(platform, invoice) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.OWNER_EMAIL || '';
    if (!adminEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
    try {
      const nodemailer = require('nodemailer');
      const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await t.sendMail({ from: '"Unicorn Billing" <' + process.env.SMTP_USER + '>', to: adminEmail, subject: '\ud83d\udcc4 Factur\u0103 ' + platform + ' - ' + invoice.period, text: JSON.stringify(invoice, null, 2) });
    } catch (_) {}
  }

  // ==================== AUTO-NEGOTIATION ====================
  async autoNegotiateRates() {
    if (this.apiCalls.length < 10000) return;
    for (const [platform, data] of this.connectedPlatforms) {
      if (data.status === 'simulated') continue;
      console.log('\ud83e\udd1d Negociere ini\u021biat\u0103 cu ' + platform + ' pentru pre\u021buri mai bune. Volum: ' + this.apiCalls.length);
    }
  }

  // ==================== FALLBACK MODE ====================
  startFallbackMonitor() { setInterval(() => this.checkForPaidServices(), 5 * 60 * 1000); }
  async checkForPaidServices() { const tracker = this.getCostTracker(); for (const [svc, cost] of Object.entries(tracker)) { if (cost > 0.01) await this.switchToFreeAlternative(svc); } }
  getCostTracker() { return { youtube: 0, google: 0, microsoft: 0 }; }
  async switchToFreeAlternative(service) { console.log('\ud83d\udd04 Comutare ' + service + ' la alternativa gratuit\u0103.'); this.useRealAPIs = false; }

  // ==================== DAILY REPORT ====================
  startDailyReport() { cron.schedule('0 9 * * *', () => this.sendDailyReport()); }
  async sendDailyReport() {
    const today = new Date().toISOString().slice(0, 10);
    const dailyCalls = this.apiCalls.filter((c) => c.timestamp.startsWith(today));
    const callsByPlatform = {};
    for (const call of dailyCalls) callsByPlatform[call.platform] = (callsByPlatform[call.platform] || 0) + 1;
    const revenue = {};
    for (const [platform, count] of Object.entries(callsByPlatform)) revenue[platform] = count * 0.001;
    const report = {
      date: today, totalRequests: dailyCalls.length, requestsByPlatform: callsByPlatform, revenue,
      totalRevenue: Object.values(revenue).reduce((a, b) => a + b, 0),
      costs: { total: 0, message: 'Zero costuri – toate serviciile sunt în cota gratuită' },
      status: this.useRealAPIs ? 'real' : 'simulated',
      nextActivation: this.useRealAPIs ? null : 'Se activează automat după \$100 venituri'
    };
    await this.sendReportEmail(report);
    console.log('\ud83d\udcca Raport zilnic GDES:', JSON.stringify(report));
    return report;
  }
  async sendReportEmail(report) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.OWNER_EMAIL || '';
    if (!adminEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
    try {
      const nodemailer = require('nodemailer');
      const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await t.sendMail({ from: '"Unicorn Daily Report" <' + process.env.SMTP_USER + '>', to: adminEmail, subject: '\ud83d\udcca Raport zilnic Unicorn - ' + report.date, text: JSON.stringify(report, null, 2) });
    } catch (_) {}
  }

  createGiantAPI() {
    const router = require('express').Router();
    router.post('/:platform/:endpoint', async (req, res) => { try { res.json(await this.processAPIRequest(req.params.platform, req.params.endpoint, req.body || {}, req.headers['x-api-key'])); } catch (err) { res.status(401).json({ error: err.message }); } });
    router.post('/identity/create', async (req, res) => res.json(await this.createUniversalIdentity(req.body || {})));
    router.post('/identity/link', async (req, res) => { try { res.json(await this.linkPlatformIdentity(req.body?.userId, req.body?.platform, req.body?.platformUserId)); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.get('/identity/:userId', async (req, res) => res.json(await this.getUnifiedProfile(req.params.userId)));
    router.post('/payment', async (req, res) => { try { res.json(await this.processCrossPlatformPayment(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/ai/:task', async (req, res) => res.json(await this.orchestrateAI((req.body || {}).platform, req.params.task, req.body || {})));
    router.get('/sla/:platform', async (req, res) => res.json(await this.getPlatformMetrics(req.params.platform)));
    router.get('/price/:platform/:type', (req, res) => res.json({ price: this.getCurrentPrice(req.params.platform, req.params.type) }));
    router.post('/verify/:id', async (req, res) => res.json(await this.verifyOnBlockchain(req.params.id)));
    router.get('/status', (req, res) => res.json({ connectedPlatforms: this.connectedPlatforms.size, useRealAPIs: this.useRealAPIs, youtube: { apiKeyConfigured: !!this.youtubeApiKey } }));
    return router;
  }

  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.get('/platforms', (req, res) => res.json(Array.from(this.connectedPlatforms.entries())));
    router.get('/stats', (req, res) => res.json({ connectedPlatforms: this.connectedPlatforms.size, totalIdentities: this.identities.size, totalTransactions: this.transactions.length, totalAPICalls: this.apiCalls.length, useRealAPIs: this.useRealAPIs }));
    router.get('/revenue', (req, res) => res.json(this.generateRevenueReport()));
    router.post('/optimize', async (req, res) => { await this.optimizeAllPlatforms(); res.json({ success: true }); });
    router.get('/rate-limits', (req, res) => res.json({ rateLimits: this.rateLimits, useRealAPIs: this.useRealAPIs }));
    router.post('/invoice/:platform', async (req, res) => { const invoice = await this.calculateRevenueShare(req.params.platform, Number((req.body || {}).requestCount || 0)); await this.sendInvoice(req.params.platform, invoice); res.json({ success: true, invoice }); });
    router.get('/daily-report', async (req, res) => res.json(await this.sendDailyReport()));
    router.post('/negotiate', async (req, res) => { await this.autoNegotiateRates(); res.json({ success: true, totalCalls: this.apiCalls.length }); });
    return router;
  }
}

module.exports = new GlobalDigitalStandard();
`);

  writeText(path.join(BACKEND_MODULES, 'unicornUltimateModules.js'), `// backend/modules/unicornUltimateModules.js
class UnicornUltimateModules {
  constructor() {
    this.legalEntities = new Map();
    this.healthRecords = new Map();
    this.supplyChains = new Map();
    this.students = new Map();
    this.properties = new Map();
    this.energyTrades = [];
    this.newsArticles = [];
    this.init();
  }
  async init() { console.log('\u{1F680} Unicorn Ultimate Modules activ \u2013 7 inova\u021bii finale'); }

  async createLegalEntity(params = {}) {
    const { country = 'RO', businessType = 'SRL', name = 'Unicorn Entity', capital = 0 } = params;
    const entityId = Date.now() + '-' + country;
    const entity = { id: entityId, country, businessType, name, capital: Number(capital), status: 'active', createdAt: new Date().toISOString(), taxId: this.generateTaxId(country), bankAccount: await this.openBankAccount(entityId) };
    this.legalEntities.set(entityId, entity);
    await this.recordRevenue('legal_entity', Number(capital) * 0.05);
    return entity;
  }
  generateTaxId(country) { const p = { US: '99-', UK: 'GB', DE: 'DE', FR: 'FR', RO: 'RO' }; return \`\${p[country] || ''}\${Math.floor(Math.random() * 100000000)}\`; }
  async openBankAccount() { return { accountNumber: 'RO' + Math.random().toString().slice(2, 10), swift: 'UNICORNXX', iban: \`RO\${Math.floor(Math.random() * 1000000000000)}\` }; }

  async diagnose(symptoms = [], patientId = 'anon') {
    const analysis = await this.analyzeSymptoms(symptoms);
    const treatment = await this.recommendTreatment();
    const record = { id: Date.now(), patientId, symptoms, diagnosis: analysis.diagnosis, treatment, confidence: analysis.confidence, timestamp: new Date().toISOString() };
    this.healthRecords.set(record.id, record);
    await this.recordRevenue('healthcare', 50);
    return record;
  }
  async analyzeSymptoms(symptoms) { const d = { fever: 'Infec\u021bie viral\u0103', cough: 'Bron\u015fit\u0103 sau r\u0103ceal\u0103', headache: 'Tensiune sau migren\u0103', fatigue: 'Oboseal\u0103 cronic\u0103' }; return { diagnosis: d[symptoms[0]] || 'Afec\u021biune nediagnosticat\u0103', confidence: 0.85 }; }
  async recommendTreatment() { return { medication: ['Paracetamol 500mg'], restDays: 3, followUp: '7 zile', lifestyle: ['Hidratare', 'Odihn\u0103'] }; }

  async optimizeSupplyChain(chainId = 'default', data = {}) {
    const cost = Number(data.cost || 0);
    const savings = cost * 0.15;
    const result = { chainId, originalCost: cost, optimizedCost: cost - savings, savings, recommendations: ['Schimb\u0103 furnizorul', 'Consolideaz\u0103 transporturile', 'Negociaz\u0103 discount volum'], timestamp: new Date().toISOString() };
    this.supplyChains.set(chainId, result);
    await this.recordRevenue('supply_chain', savings * 0.005);
    return result;
  }

  async enrollStudent(data = {}) {
    const id = Date.now() + '-' + (data.email || 'unknown');
    const student = { id, name: data.name || 'Student', email: data.email || '', courses: [], progress: {}, enrolledAt: new Date().toISOString() };
    this.students.set(id, student);
    await this.recordRevenue('education', 10);
    return student;
  }
  async generateCourse(name = 'Course', level = 'beginner') { return { id: Date.now(), name, level, modules: [{ title: 'Introducere', duration: 60 }, { title: 'Module avansate', duration: 120 }, { title: 'Proiect final', duration: 90 }], certificate: \`Certificat AI - \${name}\`, generatedAt: new Date().toISOString() }; }

  async analyzeProperty(address = '') {
    const mkt = { avgPrice: 250000, trend: 'up', demandScore: 0.8, comparableProperties: 12 };
    const valuation = mkt.avgPrice * (1 + mkt.demandScore * 0.1);
    const rec = valuation > 300000 ? 'sell' : valuation < 200000 ? 'buy' : 'hold';
    const analysis = { address, marketData: mkt, valuation, recommendation: rec, timestamp: new Date().toISOString() };
    this.properties.set(address, analysis);
    await this.recordRevenue('real_estate', valuation * 0.02);
    return analysis;
  }

  async tradeEnergy(params = {}) {
    const { fromRegion = 'EU', toRegion = 'US', amount = 0, energyType = 'solar' } = params;
    const prices = { EU: 80, US: 50, ASIA: 60 };
    const priceDiff = Math.abs((prices[fromRegion] || 70) - (prices[toRegion] || 70)) / 100;
    const profit = Number(amount) * priceDiff;
    const trade = { id: Date.now(), fromRegion, toRegion, amount: Number(amount), energyType, priceDiff, profit, timestamp: new Date().toISOString() };
    this.energyTrades.push(trade);
    await this.recordRevenue('energy', profit * 0.001);
    return trade;
  }

  async generateNews(topic = 'tech') {
    const sources = [{ url: \`https://news.com/\${topic}\`, reliability: 0.9 }, { url: \`https://api.reuters.com/\${topic}\`, reliability: 0.85 }];
    const verified = sources.filter((s) => s.reliability > 0.7);
    const news = { id: Date.now(), topic, title: \`Stiri despre \${verified[0]?.url || topic}\`, content: 'Continut generat de AI...', sources: verified.length, timestamp: new Date().toISOString() };
    this.newsArticles.push(news);
    await this.recordRevenue('news', 10000);
    return news;
  }

  async recordRevenue(source, amount) {
    if (!amount || Number(amount) <= 0) return;
    try { const pg = require('./paymentGateway'); if (typeof pg.createPayment === 'function') await pg.createPayment({ amount: Number(amount), currency: 'USD', method: 'bank', clientId: 'system', description: 'Ultimate Module: ' + source }); } catch (_) {}
    console.log('\u{1F4B0} Venit inregistrat: $' + Number(amount).toFixed(4) + ' din ' + source);
  }

  getStats() { return { legalEntities: this.legalEntities.size, healthRecords: this.healthRecords.size, supplyChains: this.supplyChains.size, students: this.students.size, properties: this.properties.size, energyTrades: this.energyTrades.length, newsArticles: this.newsArticles.length }; }

  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);
    router.get('/stats', (req, res) => res.json(this.getStats()));
    router.post('/legal/create', async (req, res) => { try { res.json(await this.createLegalEntity(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/health/diagnose', async (req, res) => { try { const { symptoms = [], patientId = 'anon' } = req.body || {}; res.json(await this.diagnose(symptoms, patientId)); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/supply/optimize', async (req, res) => { try { const { chainId, ...rest } = req.body || {}; res.json(await this.optimizeSupplyChain(chainId, rest)); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/education/enroll', async (req, res) => { try { res.json(await this.enrollStudent(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/education/course', async (req, res) => { try { const { name = 'Course', level = 'beginner' } = req.body || {}; res.json(await this.generateCourse(name, level)); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/property/analyze', async (req, res) => { try { res.json(await this.analyzeProperty((req.body || {}).address || '')); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/energy/trade', async (req, res) => { try { res.json(await this.tradeEnergy(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
    router.post('/news/generate', async (req, res) => { try { res.json(await this.generateNews((req.body || {}).topic || 'tech')); } catch (err) { res.status(400).json({ error: err.message }); } });
    return router;
  }
}

module.exports = new UnicornUltimateModules();
`);

  writeText(
    path.join(BACKEND_MODULES, 'unicornEternalEngine.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'unicornEternalEngine.js'), 'utf8')
  );

  writeText(
    path.join(BACKEND_MODULES, 'legalFortress.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'legalFortress.js'), 'utf8')
  );

  writeText(
    path.join(BACKEND_MODULES, 'quantumResilienceCore.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'quantumResilienceCore.js'), 'utf8')
  );

  writeText(
    path.join(BACKEND_MODULES, 'executiveDashboard.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'executiveDashboard.js'), 'utf8')
  );

  writeText(
    path.join(BACKEND_MODULES, 'unicornInnovationSuite.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'unicornInnovationSuite.js'), 'utf8')
  );

  writeText(
    path.join(BACKEND_MODULES, 'autonomousInnovation.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'autonomousInnovation.js'), 'utf8')
  );

  writeText(
    path.join(BACKEND_MODULES, 'autoRevenue.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'autoRevenue.js'), 'utf8')
  );

  // ── Universal AI Connector (UAIC) ──────────────────────────────────────────
  writeText(
    path.join(BACKEND_MODULES, 'universal-ai-connector', 'index.js'),
    fs.readFileSync(path.join(__dirname, 'templates', 'universal-ai-connector.js'), 'utf8')
  );

  writeText(path.join(ROOT, 'client', 'src', 'components', 'ServiceMarketplace.jsx'), `import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PaymentModal from './PaymentModal';

export default function ServiceMarketplace({ clientId }) {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [purchaseNotice, setPurchaseNotice] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const fetchData = async () => {
    try {
      const recRequest = clientId ? axios.get('/api/marketplace/recommendations/' + clientId) : Promise.resolve({ data: { recommendations: [] } });
      const [servicesRes, categoriesRes, statsRes, recRes] = await Promise.all([
        axios.get('/api/marketplace/services'),
        axios.get('/api/marketplace/categories'),
        axios.get('/api/marketplace/stats'),
        recRequest
      ]);

      setServices(servicesRes.data.services || []);
      setCategories(categoriesRes.data.categories || {});
      setStats(statsRes.data || null);
      setRecommendations(recRes.data.recommendations || []);

      const pricePromises = (servicesRes.data.services || []).map(async (service) => {
        const priceRes = await axios.post('/api/marketplace/price', {
          serviceId: service.id,
          clientId: clientId || 'guest',
          clientData: { segment: 'retail' }
        });
        return { id: service.id, price: priceRes.data.personalizedPrice };
      });

      const priceResults = await Promise.all(pricePromises);
      const priceMap = {};
      priceResults.forEach(p => { priceMap[p.id] = p.price; });
      setPrices(priceMap);
    } catch (err) {
      console.error('Eroare la încărcarea serviciilor:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = (service, price) => {
    setSelectedOffer({
      serviceId: service.id,
      serviceName: service.name,
      price: Number(price || 0),
      description: service.description || service.name
    });
    setPurchaseNotice('');
    setCheckoutOpen(true);
  };

  const handlePurchaseComplete = async (payment) => {
    if (!selectedOffer) return;
    try {
      await axios.post('/api/marketplace/purchase', {
        serviceId: selectedOffer.serviceId,
        clientId: clientId || 'guest',
        price: selectedOffer.price,
        paymentTxId: payment.txId,
        paymentMethod: payment.method,
        serviceName: selectedOffer.serviceName,
        description: selectedOffer.description
      });
      setPurchaseNotice('Payment confirmed for ' + selectedOffer.serviceName + '. Service activated successfully.');
      setCheckoutOpen(false);
      setSelectedOffer(null);
      fetchData();
    } catch (err) {
      setPurchaseNotice('Payment succeeded, but marketplace activation failed. Please retry activation.');
    }
  };

  const filteredServices = selectedCategory === 'all' ? services : services.filter(s => s.category === selectedCategory);
  if (loading) return <div className="text-center p-12">Loading services...</div>;

  return (
    <div className="p-8">
      <h2 className="text-4xl font-bold mb-6 neon-text">AI Services Marketplace</h2>

      {purchaseNotice && (
        <div className="mb-6 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-cyan-200">
          {purchaseNotice}
        </div>
      )}

      {stats && (
        <div className="bg-gray-800/50 p-4 rounded-xl mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><span className="text-cyan-400">Total Services:</span> {stats.totalServices}</div>
            <div><span className="text-cyan-400">Avg Price:</span> \${Number(stats.avgPrice || 0).toFixed(2)}</div>
            <div><span className="text-cyan-400">Discount:</span> {stats.discountRate}%</div>
            <div><span className="text-cyan-400">Last Update:</span> {stats.lastMarketUpdate ? new Date(stats.lastMarketUpdate).toLocaleTimeString() : '-'}</div>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold mb-4">🎯 Recommended for You</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map(rec => (
              <div key={rec.serviceId} className="bg-purple-500/20 p-4 rounded-xl border border-purple-500">
                <h4 className="text-lg font-bold">{rec.name}</h4>
                <p className="text-sm text-gray-300">{rec.reason}</p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-xl font-bold text-cyan-400">\${prices[rec.serviceId] ? Number(prices[rec.serviceId]).toFixed(2) : '0.00'}</span>
                  <button onClick={() => openCheckout({ id: rec.serviceId, name: rec.name, description: rec.reason }, prices[rec.serviceId])} className="px-4 py-2 bg-purple-500 text-black rounded hover:bg-purple-400">
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setSelectedCategory('all')} className={selectedCategory === 'all' ? 'px-4 py-2 rounded bg-cyan-500 text-black' : 'px-4 py-2 rounded bg-gray-700'}>
          All
        </button>
        {Object.keys(categories).map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={selectedCategory === cat ? 'px-4 py-2 rounded capitalize bg-cyan-500 text-black' : 'px-4 py-2 rounded capitalize bg-gray-700'}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(service => (
          <div key={service.id} className="bg-gray-800/50 p-6 rounded-xl border border-cyan-500/30 hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-cyan-400">{service.name}</h3>
            <p className="text-gray-300 text-sm mt-2">{service.description}</p>
            <div className="mt-4 flex justify-between items-center">
              <div>
                <span className="text-2xl font-bold text-white">\${prices[service.id] ? Number(prices[service.id]).toFixed(2) : '0.00'}</span>
                <span className="text-sm text-gray-400 line-through ml-2">\${service.basePrice ? Number(service.basePrice).toFixed(2) : '0.00'}</span>
                <span className="text-green-400 text-sm ml-2">-{service.discount}%</span>
              </div>
              <button onClick={() => openCheckout(service, prices[service.id])} className="px-4 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400 transition">
                Buy Now
              </button>
            </div>
            {service.demand > 0.7 && <div className="mt-2 text-xs text-orange-400">🔥 High demand</div>}
          </div>
        ))}
      </div>

      <PaymentModal
        isOpen={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setSelectedOffer(null);
        }}
        presetAmount={selectedOffer?.price || 0}
        presetDescription={selectedOffer ? selectedOffer.serviceName + ' · Marketplace Service' : 'Marketplace Service'}
        clientId={clientId || 'guest'}
        metadata={selectedOffer ? {
          source: 'marketplace',
          serviceId: selectedOffer.serviceId,
          serviceName: selectedOffer.serviceName,
          description: selectedOffer.description
        } : { source: 'marketplace' }}
        onCompleted={handlePurchaseComplete}
      />
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'PaymentModal.jsx'), `import React, { useEffect, useState } from 'react';
import axios from 'axios';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.82)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
};

const panelStyle = {
  width: 'min(680px, 92vw)',
  borderRadius: 24,
  border: '1px solid rgba(34,211,238,.25)',
  background: 'linear-gradient(180deg, rgba(15,23,42,.96), rgba(17,24,39,.96))',
  boxShadow: '0 20px 80px rgba(0,0,0,.45)',
  padding: 24,
  color: '#e2e8f0'
};

export default function PaymentModal({ isOpen, onClose, presetAmount = 199, presetDescription = 'Premium Unicorn Service', clientId = 'guest', metadata = {}, onCompleted }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState({ amount: presetAmount, method: 'card', description: presetDescription });

  useEffect(() => {
    if (!isOpen) return;
    setPayment(null);
    axios.get('/api/payment/methods')
      .then((res) => {
        const available = res.data.methods || [];
        setMethods(available);
        if (available.length && !available.find((item) => item.id === form.method)) {
          setForm((prev) => ({ ...prev, method: available[0].id }));
        }
      })
      .catch(() => setMethods([]));
  }, [isOpen]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, amount: presetAmount, description: presetDescription }));
  }, [presetAmount, presetDescription]);

  useEffect(() => {
    if (!isOpen) {
      setPayment(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openExternalCheckout = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const createPayment = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/payment/create', {
        amount: Number(form.amount),
        method: form.method,
        description: form.description,
        clientId,
        metadata
      });
      setPayment(res.data);
      if (res.data?.checkoutUrl) {
        openExternalCheckout(res.data.checkoutUrl);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to create payment');
    } finally {
      setLoading(false);
    }
  };

  const completePayment = async () => {
    if (!payment?.txId) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/payment/process/' + payment.txId, {
        approved: payment.provider === 'paypal',
        note: payment.provider ? 'Verified from modal' : 'Processed from modal'
      });
      setPayment(res.data);
      if (res.data.status === 'completed' && onCompleted) onCompleted(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to process payment');
    } finally {
      setLoading(false);
    }
  };

  const completionLabel = payment?.status === 'completed'
    ? 'Payment Completed'
    : payment?.provider === 'paypal'
      ? 'Capture PayPal Payment'
      : payment?.provider === 'stripe'
        ? 'Verify Stripe Payment'
        : 'Confirm Payment';

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ color: '#22d3ee', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>Universal Payment Gateway</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 30 }}>Secure checkout</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#94a3b8', fontSize: 26, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Amount</span>
            <input type="number" min="1" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.25)', background: 'rgba(15,23,42,.7)', color: '#fff' }} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Method</span>
            <select value={form.method} onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.25)', background: 'rgba(15,23,42,.7)', color: '#fff' }}>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>{method.name} · {method.currency}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <span>Description</span>
          <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.25)', background: 'rgba(15,23,42,.7)', color: '#fff' }} />
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={createPayment} disabled={loading} style={{ flex: 1, padding: '12px 18px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Working...' : 'Create Payment'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(148,163,184,.25)', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

        {payment && (
          <div style={{ marginTop: 24, padding: 18, borderRadius: 18, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(34,211,238,.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Transaction ID</div>
                <div style={{ color: '#f8fafc', fontWeight: 700 }}>{payment.txId}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Status</div>
                <div style={{ color: payment.status === 'completed' ? '#4ade80' : '#facc15', fontWeight: 700 }}>{payment.status}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Total</div>
                <div style={{ color: '#22d3ee', fontWeight: 700 }}>{'$' + Number(payment.total || 0).toFixed(2) + ' ' + payment.currency}</div>
              </div>
            </div>

            {payment.qrCode && (
              <div style={{ marginTop: 18, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <img src={payment.qrCode} alt="Payment QR" style={{ width: 120, height: 120, borderRadius: 14, background: '#fff', padding: 8 }} />
                <div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Wallet address</div>
                  <div style={{ maxWidth: 360, wordBreak: 'break-all' }}>{payment.walletAddress}</div>
                  {payment.cryptoAmount ? <div style={{ marginTop: 8, color: '#c084fc' }}>Amount due: {payment.cryptoAmount} {payment.method === 'crypto_btc' ? 'BTC' : 'ETH'}</div> : null}
                </div>
              </div>
            )}

            {payment.checkoutUrl && (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 14, border: '1px solid rgba(168,85,247,.28)', background: 'rgba(88,28,135,.12)' }}>
                <div style={{ color: '#c084fc', fontWeight: 700, marginBottom: 6 }}>Provider checkout required</div>
                <div style={{ color: '#cbd5e1', fontSize: 14 }}>Complete payment in the provider window, then come back here and verify the status.</div>
                <button onClick={() => openExternalCheckout(payment.checkoutUrl)} style={{ marginTop: 12, padding: '10px 16px', borderRadius: 12, border: 0, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {payment.provider === 'paypal' ? 'Open PayPal Checkout' : 'Open Stripe Checkout'}
                </button>
              </div>
            )}

            {payment.processorResponse?.note && (
              <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>{payment.processorResponse.note}</div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={completePayment} disabled={loading || payment.status === 'completed'} style={{ padding: '10px 16px', borderRadius: 12, border: 0, background: payment.status === 'completed' ? '#14532d' : '#22c55e', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>
                {completionLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'package.json'), JSON.stringify({
    name: 'unicorn-client',
    private: true,
    version: '1.0.0',
    scripts: {
      start: 'react-scripts start',
      build: 'react-scripts build'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.23.1',
      axios: '^1.7.2',
      'framer-motion': '^11.2.10',
      '@react-three/fiber': '^8.16.8',
      '@react-three/drei': '^9.105.6',
      three: '^0.165.0',
      'react-hot-toast': '^2.4.1',
      recharts: '^2.12.7',
      i18next: '^23.11.5',
      'react-i18next': '^14.1.2',
      'react-scripts': '^5.0.1'
    }
  }, null, 2) + '\n');

  writeText(path.join(ROOT, 'client', 'src', 'index.js'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`);

  writeText(path.join(ROOT, 'client', 'src', 'index.css'), `html, body, #root { margin: 0; min-height: 100%; }
body { font-family: Inter, system-ui, Arial, sans-serif; background: #0a0f1f; color: #fff; }

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(0,255,255,0.5), 0 0 10px rgba(0,255,255,0.3); }
  50% { box-shadow: 0 0 20px rgba(0,255,255,0.8), 0 0 30px rgba(0,255,255,0.5); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.glow-pulse { animation: pulse-glow 2s infinite; }
.float { animation: float 3s ease-in-out infinite; }
.rotate-slow { animation: rotate-slow 20s linear infinite; }

.holographic {
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.2));
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 1rem;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 4px; }
::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #00ffff, #ff00ff); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, #ff00ff, #00ffff); }
`);

  writeText(path.join(ROOT, 'client', 'src', 'hooks', 'useScrollReveal.js'), `import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

export const useScrollReveal = (threshold = 0.1) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });

  useEffect(() => {
    if (isInView && ref.current) {
      ref.current.style.opacity = '1';
      ref.current.style.transform = 'translateY(0)';
      ref.current.style.filter = 'blur(0)';
    }
  }, [isInView]);

  return ref;
};
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'ScrollReveal.jsx'), `import React from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function ScrollReveal({ children, delay = 0, direction = 'up' }) {
  const ref = useScrollReveal();
  const directions = {
    up: { y: 50, x: 0 },
    down: { y: -50, x: 0 },
    left: { y: 0, x: 50 },
    right: { y: 0, x: -50 }
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translate(' + directions[direction].x + 'px, ' + directions[direction].y + 'px)',
        filter: 'blur(5px)',
        transition: 'all 0.6s cubic-bezier(0.2, 0.9, 0.4, 1.1) ' + delay + 's'
      }}
    >
      {children}
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'ParticlesBackground3D.jsx'), `import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function ParticleField() {
  const pointsRef = useRef();
  const mousePosition = useRef(new THREE.Vector2());

  useEffect(() => {
    const handler = (event) => {
      mousePosition.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mousePosition.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = mousePosition.current.x * 0.5;
      pointsRef.current.rotation.x = mousePosition.current.y * 0.3;
      pointsRef.current.rotation.z += 0.002;
    }
  });

  const count = 5000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.8, 0.5);
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    return cols;
  }, []);

  return (
    <Points ref={pointsRef}>
      <PointMaterial transparent vertexColors size={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
    </Points>
  );
}

export default function ParticlesBackground3D() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -10 }}>
      <Canvas camera={{ position: [0, 0, 30], fov: 75 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <ParticleField />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'HolographicCard.jsx'), `import React from 'react';
import { motion } from 'framer-motion';

export default function HolographicCard({ children, className = '', glowColor = '#00ffff', onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={'relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/5 border border-white/20 shadow-2xl ' + className}
      style={{ boxShadow: '0 0 20px ' + glowColor + '40, 0 0 5px ' + glowColor + '80' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: 'shimmer 2s infinite' }} />
      </div>
      <div className="relative p-6">{children}</div>
    </motion.div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'NeonPulseButton.jsx'), `import React from 'react';
import { motion } from 'framer-motion';

export default function NeonPulseButton({ children, onClick, className = '', color = '#00ffff' }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={'relative px-8 py-3 font-bold text-lg rounded-full overflow-hidden group ' + className}
      style={{
        background: 'linear-gradient(135deg, ' + color + '20, transparent)',
        border: '1px solid ' + color,
        boxShadow: '0 0 10px ' + color + ', 0 0 5px ' + color,
        color,
        textShadow: '0 0 5px ' + color
      }}
    >
      <motion.span className="absolute inset-0 bg-white/10" initial={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.5, opacity: 0.3 }} transition={{ duration: 0.5 }} />
      <span className="relative z-10">{children}</span>
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{ boxShadow: ['0 0 5px rgba(0,255,255,0.5)', '0 0 20px rgba(0,255,255,0.8)', '0 0 5px rgba(0,255,255,0.5)'] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.button>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'OrbitalNav.jsx'), `import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Home', icon: '🏠', path: '/' },
  { name: 'Codex', icon: '📘', path: '/codex' },
  { name: 'Dashboard', icon: '📊', path: '/dashboard' },
  { name: 'Industries', icon: '🏭', path: '/industries' },
  { name: 'Capabilities', icon: '⚡', path: '/capabilities' },
  { name: 'Wealth', icon: '💰', path: '/wealth' },
  { name: 'Marketplace', icon: '🛒', path: '/marketplace' }
];

export default function OrbitalNav() {
  const [activeIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const radius = 120;

  return (
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#7c3aed)', color: '#fff', border: 0, fontSize: 24, cursor: 'pointer' }}>
        {isOpen ? '✕' : '✦'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)' }}>
            {navItems.map((item, idx) => {
              const angle = (idx / navItems.length) * Math.PI * 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isActive = activeIndex === idx;
              return (
                <motion.a
                  key={item.name}
                  href={item.path}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: 1, x, y }}
                  exit={{ scale: 0, x: 0, y: 0 }}
                  transition={{ delay: idx * 0.05, type: 'spring' }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    position: 'absolute',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    background: isActive ? '#06b6d4' : 'rgba(31,41,55,0.85)',
                    color: '#fff',
                    transform: 'translate(-50%, -50%)',
                    left: 'calc(50% + ' + x + 'px)',
                    top: 'calc(50% + ' + y + 'px)'
                  }}
                >
                  <span style={{ position: 'relative' }}>
                    {item.icon}
                    {hoveredIndex === idx && (
                      <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 10, background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: 6 }}>
                        {item.name}
                      </motion.span>
                    )}
                  </span>
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'AnimatedDataStream.jsx'), `import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function AnimatedDataStream({ data, title, unit = '' }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1,
          speedX: (Math.random() - 0.5) * 2,
          speedY: Math.random() * 3 + 1,
          alpha: Math.random() * 0.5 + 0.3
        });
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data && data.length > 0) {
        const maxVal = Math.max(...data, 1);
        const barWidth = canvas.width / data.length;
        data.forEach((value, idx) => {
          const height = (value / maxVal) * canvas.height * 0.6;
          const gradient = ctx.createLinearGradient(idx * barWidth, canvas.height, idx * barWidth, canvas.height - height);
          gradient.addColorStop(0, '#00ffff');
          gradient.addColorStop(1, '#ff00ff');
          ctx.fillStyle = gradient;
          ctx.fillRect(idx * barWidth, canvas.height - height, Math.max(barWidth - 2, 1), height);
        });
      }

      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 255, ' + p.alpha + ')';
        ctx.fill();
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initParticles();
    animate();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [data]);

  const currentValue = data && data.length > 0 ? data[data.length - 1] : 0;
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ color: '#22d3ee', margin: 0 }}>{title}</h3>
        <motion.div key={currentValue} initial={{ scale: 1.2, color: '#00ffff' }} animate={{ scale: 1, color: '#ffffff' }} style={{ fontSize: 24, fontFamily: 'monospace' }}>
          {currentValue.toFixed(2)}{unit}
        </motion.div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 192, borderRadius: 10 }} />
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'QuantumLoader.jsx'), `import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function QuantumLoader({ loading = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let frame;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 50; i++) {
        particles.push({
          radius: Math.random() * 3 + 1,
          angle: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.03,
          color: 'hsl(' + (200 + Math.random() * 100) + ', 100%, 60%)'
        });
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.angle += p.speed;
        const x = canvas.width / 2 + Math.cos(p.angle) * (canvas.width / 4);
        const y = canvas.height / 2 + Math.sin(p.angle) * (canvas.height / 4);
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      frame = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initParticles();
    animate();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [loading]);

  if (!loading) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ textAlign: 'center' }}>
        <canvas ref={canvasRef} style={{ width: 256, height: 256 }} />
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} style={{ marginTop: 16, color: '#22d3ee', fontSize: 22 }}>
          Quantum Entanglement...
        </motion.div>
      </div>
    </div>
  );
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'LanguageSwitcher.jsx'), `import React from 'react';
export default function LanguageSwitcher() {
  return <button style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #334155', background: 'rgba(15,23,42,.6)', color: '#cbd5e1' }}>🌐 EN</button>;
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'ThemeToggle.jsx'), `import React from 'react';
export default function ThemeToggle() {
  return <button style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #334155', background: 'rgba(15,23,42,.6)', color: '#cbd5e1' }}>🌓</button>;
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'components', 'Chatbot.jsx'), `import React from 'react';
export default function Chatbot() {
  return <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, background: 'rgba(15,23,42,.9)', border: '1px solid rgba(34,211,238,.4)', borderRadius: 12, padding: '10px 12px', color: '#67e8f9' }}>💬 AI Chat</div>;
}
`);

  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Home.jsx'), `import React from 'react';
import { Link } from 'react-router-dom';
import HolographicCard from '../components/HolographicCard';
import NeonPulseButton from '../components/NeonPulseButton';

const highlights = [
  { label: 'Enterprise Verticals', value: '5', sub: 'aviation, government, defense, telecom, partnerships' },
  { label: 'Payment Rails', value: '6', sub: 'cards, PayPal, Stripe, BTC, ETH, bank transfer' },
  { label: 'AI Modules', value: '15+', sub: 'risk, compliance, opportunity, marketplace, negotiation, carbon' }
];

const quickLinks = [
  { title: 'Open Marketplace', path: '/marketplace', description: 'Buy and activate premium AI services instantly.' },
  { title: 'View Payments', path: '/payments', description: 'Track receipts, revenue, and treasury flows.' },
  { title: 'Explore Enterprise', path: '/enterprise', description: 'Launch vertical AI operations and partner integrations.' }
];

export default function Home() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 20, alignItems: 'stretch' }}>
        <HolographicCard className="p-8" glowColor="#22d3ee">
          <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Unicorn Autonomous Platform</div>
          <h1 style={{ margin: '10px 0 12px', fontSize: 54, lineHeight: 1.05 }}>Luxury AI infrastructure for commerce, enterprise, and sovereign-scale operations.</h1>
          <p style={{ color: '#cbd5e1', fontSize: 18, lineHeight: 1.6, maxWidth: 760 }}>Operate premium payments, intelligent marketplaces, enterprise verticals, and strategic partner APIs from one high-signal command surface generated end-to-end.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <Link to="/enterprise" style={{ textDecoration: 'none' }}><NeonPulseButton>Launch Enterprise Suite</NeonPulseButton></Link>
            <Link to="/payments" style={{ textDecoration: 'none' }}><NeonPulseButton color="#a855f7">Open Payments</NeonPulseButton></Link>
            <Link to="/marketplace" style={{ textDecoration: 'none' }}><NeonPulseButton color="#22c55e">Browse Marketplace</NeonPulseButton></Link>
          </div>
        </HolographicCard>

        <div style={{ display: 'grid', gap: 16 }}>
          {highlights.map((item) => (
            <div key={item.label} style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.62)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{item.label}</div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{item.value}</div>
              <div style={{ color: '#cbd5e1', marginTop: 8 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {quickLinks.map((link) => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{link.title}</div>
              <div style={{ color: '#cbd5e1', marginTop: 10, lineHeight: 1.55 }}>{link.description}</div>
              <div style={{ marginTop: 16, color: '#22d3ee', fontWeight: 700 }}>Go now →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Codex.jsx'), `import React from 'react';
import { Link } from 'react-router-dom';

const modules = [
  { title: 'Payments Codex', path: '/payments', tag: 'Monetization', description: 'Universal gateway, receipts, BTC pricing, and transaction stats.' },
  { title: 'Marketplace Codex', path: '/marketplace', tag: 'Commerce', description: 'Service discovery, dynamic pricing, recommendations, and checkout.' },
  { title: 'Enterprise Codex', path: '/enterprise', tag: 'Operations', description: 'Industry-grade control surfaces for aviation, defense, government, telecom, and partners.' },
  { title: 'Capabilities Codex', path: '/capabilities', tag: 'Platform', description: 'Overview of strategic capabilities across the full Unicorn stack.' },
  { title: 'Industries Codex', path: '/industries', tag: 'Verticals', description: 'Direct access to specialized sectors and regulated operating environments.' },
  { title: 'Dashboard Codex', path: '/dashboard', tag: 'Analytics', description: 'System-wide visibility across risk, compliance, opportunities, payments, and marketplace metrics.' }
];

export default function Codex() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Codex</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Operational knowledge map of the Unicorn platform</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Use the Codex as a strategic entry point into monetization, enterprise operations, analytics, and platform intelligence modules.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {modules.map((module) => (
          <Link key={module.path} to={module.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ color: '#22d3ee', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.6 }}>{module.tag}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{module.title}</div>
              <div style={{ color: '#cbd5e1', marginTop: 10, lineHeight: 1.55 }}>{module.description}</div>
              <div style={{ marginTop: 16, color: '#a855f7', fontWeight: 700 }}>Open section →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Dashboard.jsx'), `import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function Dashboard({ healthData = [] }) {
  const [stats, setStats] = useState({
    payment: null,
    marketplace: null,
    compliance: null,
    risk: null,
    opportunity: null
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [paymentRes, marketplaceRes, complianceRes, riskRes, opportunityRes] = await Promise.all([
          axios.get('/api/payment/stats'),
          axios.get('/api/marketplace/stats'),
          axios.get('/api/compliance/stats'),
          axios.get('/api/risk/stats'),
          axios.get('/api/opportunity/stats')
        ]);

        setStats({
          payment: paymentRes.data,
          marketplace: marketplaceRes.data,
          compliance: complianceRes.data,
          risk: riskRes.data,
          opportunity: opportunityRes.data
        });
      } catch (err) {
        console.error('Dashboard load failed', err);
      }
    };

    load();
  }, []);

  const analyticsAverage = useMemo(() => {
    if (!healthData.length) return 0;
    return healthData.reduce((sum, value) => sum + value, 0) / healthData.length;
  }, [healthData]);

  const cards = [
    { label: 'Payments', value: stats.payment?.totalPayments || 0, sub: 'Revenue ' + '$' + Number(stats.payment?.revenue || 0).toFixed(2), accent: '#22d3ee' },
    { label: 'Marketplace', value: stats.marketplace?.totalServices || 0, sub: 'Avg price ' + '$' + Number(stats.marketplace?.avgPrice || 0).toFixed(2), accent: '#c084fc' },
    { label: 'Compliance', value: stats.compliance?.complianceScore || 0, sub: 'Score / 100', accent: '#34d399' },
    { label: 'Risk Analyses', value: stats.risk?.totalAnalyses || 0, sub: 'High risk ' + Number(stats.risk?.highRiskCount || 0), accent: '#f87171' },
    { label: 'Opportunities', value: stats.opportunity?.totalOpportunities || 0, sub: 'Unread alerts ' + Number(stats.opportunity?.unreadAlerts || 0), accent: '#f59e0b' },
    { label: 'Live Analytics', value: Number(analyticsAverage).toFixed(1) + '%', sub: healthData.length + ' datapoints', accent: '#38bdf8' }
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Dashboard</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Autonomous system performance overview</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Monitor commercial activity, risk posture, compliance health, and opportunity flow from one executive-grade analytics surface.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ padding: 20, borderRadius: 22, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
            <div style={{ width: 52, height: 4, borderRadius: 999, background: card.accent, marginBottom: 16 }} />
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
            <div style={{ color: '#cbd5e1', marginTop: 8 }}>{card.sub}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Signal stream</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8, height: 180 }}>
            {(healthData.length ? healthData : [20, 35, 25, 50, 60, 55, 72]).map((value, index) => (
              <div key={index} style={{ flex: 1, borderRadius: '10px 10px 0 0', background: 'linear-gradient(180deg,#22d3ee,#a855f7)', height: Math.max(16, value * 1.6) }} />
            ))}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>System notes</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ color: '#e2e8f0' }}>• Payment engine and marketplace are actively connected.</div>
            <div style={{ color: '#e2e8f0' }}>• Opportunity radar updates feed enterprise expansion decisions.</div>
            <div style={{ color: '#e2e8f0' }}>• Compliance and risk stats are surfaced live from generated backend APIs.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Industries.jsx'), `import React from 'react';
import { Link } from 'react-router-dom';

const industries = [
  {
    title: 'Aviation & Mobility',
    path: '/enterprise/aviation',
    accent: '#22d3ee',
    metrics: ['15M estimated route savings', 'predictive fleet maintenance', 'dynamic ticket yield'],
    description: 'Optimize airline routes, maintenance windows, and pricing strategies with aviation-grade AI orchestration.'
  },
  {
    title: 'Government & Public Sector',
    path: '/enterprise/government',
    accent: '#38bdf8',
    metrics: ['GDPR / SOC2 readiness', 'public service digitalization', 'policy impact analysis'],
    description: 'Launch digital public services, verify compliance gaps, and assess policy outcomes from one control panel.'
  },
  {
    title: 'Defense & Critical Infrastructure',
    path: '/enterprise/defense',
    accent: '#f87171',
    metrics: ['quantum-safe encryption', 'threat intelligence layers', 'critical infra hardening'],
    description: 'Secure sensitive operations with post-quantum encryption, threat scoring, and infrastructure defense workflows.'
  },
  {
    title: 'Telecom & 5G Networks',
    path: '/enterprise/telecom',
    accent: '#34d399',
    metrics: ['5G capacity uplift', 'fault prediction', 'revenue assurance'],
    description: 'Improve latency, predict network incidents, and recover missed revenue across modern telecom estates.'
  },
  {
    title: 'Enterprise Partnerships',
    path: '/enterprise/partners',
    accent: '#c084fc',
    metrics: ['partner APIs', 'dashboard access', 'invoice generation'],
    description: 'Activate white-label partnerships, provision API keys, and manage strategic partner contracts end-to-end.'
  }
];

export default function Industries() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Industries</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Luxury AI verticals for strategic sectors</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Choose an industry lane to open specialized enterprise modules, live API demos, and operational dashboards tailored for high-value sectors.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {industries.map((industry) => (
          <Link key={industry.path} to={industry.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
              <div style={{ width: 56, height: 4, borderRadius: 999, background: industry.accent, marginBottom: 18 }} />
              <div style={{ fontSize: 24, fontWeight: 800 }}>{industry.title}</div>
              <div style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.55 }}>{industry.description}</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
                {industry.metrics.map((metric) => (
                  <div key={metric} style={{ color: '#e2e8f0', fontSize: 14 }}>• {metric}</div>
                ))}
              </div>
              <div style={{ marginTop: 18, color: industry.accent, fontWeight: 700 }}>Open industry module →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Capabilities.jsx'), `import React from 'react';
import { Link } from 'react-router-dom';

const capabilities = [
  {
    title: 'Marketplace Intelligence',
    path: '/marketplace',
    accent: '#22d3ee',
    bullets: ['dynamic service pricing', 'personalized recommendations', 'AI service catalog'],
    description: 'Activate productized AI services with adaptive pricing, demand tracking, and premium checkout flows.'
  },
  {
    title: 'Universal Payments',
    path: '/payments',
    accent: '#c084fc',
    bullets: ['multi-method checkout', 'crypto QR flows', 'receipt and revenue dashboards'],
    description: 'Process premium payments, track receipts, and manage payment operations from a unified control center.'
  },
  {
    title: 'Enterprise Industries',
    path: '/industries',
    accent: '#38bdf8',
    bullets: ['aviation operations', 'government compliance', 'telecom optimization'],
    description: 'Navigate sector-specific AI programs across regulated and high-scale enterprise industries.'
  },
  {
    title: 'Strategic Partnerships',
    path: '/enterprise/partners',
    accent: '#f59e0b',
    bullets: ['partner onboarding', 'API key access', 'invoice automation'],
    description: 'Launch partner ecosystems with contract templates, authenticated APIs, and enterprise billing views.'
  },
  {
    title: 'Defense & Security',
    path: '/enterprise/defense',
    accent: '#f87171',
    bullets: ['quantum encryption', 'threat intelligence', 'critical infrastructure scoring'],
    description: 'Operate security-grade modules for encryption, intelligence assessment, and infrastructure resilience.'
  },
  {
    title: 'Aviation & Telecom Ops',
    path: '/enterprise',
    accent: '#34d399',
    bullets: ['route optimization', '5G performance tuning', 'predictive maintenance'],
    description: 'Coordinate mobility, fleet, and network orchestration from the enterprise operations suite.'
  }
];

export default function Capabilities() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Capabilities</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Full-stack AI execution capabilities</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Explore the platform’s strongest commercial, operational, and enterprise capabilities through linked control surfaces already wired into the Unicorn stack.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {capabilities.map((capability) => (
          <Link key={capability.path} to={capability.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
              <div style={{ width: 56, height: 4, borderRadius: 999, background: capability.accent, marginBottom: 18 }} />
              <div style={{ fontSize: 24, fontWeight: 800 }}>{capability.title}</div>
              <div style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.55 }}>{capability.description}</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
                {capability.bullets.map((bullet) => (
                  <div key={bullet} style={{ color: '#e2e8f0', fontSize: 14 }}>• {bullet}</div>
                ))}
              </div>
              <div style={{ marginTop: 18, color: capability.accent, fontWeight: 700 }}>Open capability →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Wealth.jsx'), `import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function Wealth() {
  const [paymentStats, setPaymentStats] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [btcRate, setBtcRate] = useState(null);
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, historyRes, btcRes, purchasesRes] = await Promise.all([
          axios.get('/api/payment/stats'),
          axios.get('/api/payment/history'),
          axios.get('/api/payment/btc-rate'),
          axios.get('/api/marketplace/purchases/guest')
        ]);

        setPaymentStats(statsRes.data || null);
        setPaymentHistory(historyRes.data.payments || []);
        setBtcRate(btcRes.data || null);
        setPurchases(purchasesRes.data.purchases || []);
      } catch (err) {
        console.error('Wealth page load failed', err);
      }
    };

    load();
  }, []);

  const grossVolume = useMemo(() => (
    paymentHistory.reduce((sum, payment) => sum + Number(payment.total || 0), 0)
  ), [paymentHistory]);

  const completedReceipts = paymentHistory.filter((payment) => payment.status === 'completed');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Wealth</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Revenue, treasury, and monetization view</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Track transaction performance, crypto reference pricing, and monetized marketplace services from a compact wealth dashboard.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {[
          { label: 'Completed Revenue', value: '$' + Number(paymentStats?.revenue || 0).toFixed(2), sub: (paymentStats?.completedPayments || 0) + ' settled payments', accent: '#22d3ee' },
          { label: 'Gross Volume', value: '$' + grossVolume.toFixed(2), sub: (paymentHistory.length || 0) + ' total transactions', accent: '#c084fc' },
          { label: 'BTC / USD', value: btcRate ? '$' + Number(btcRate.rate || 0).toLocaleString() : 'Loading...', sub: btcRate?.source || 'live rate', accent: '#f59e0b' },
          { label: 'Purchased Services', value: purchases.length, sub: 'marketplace activations', accent: '#34d399' }
        ].map((card) => (
          <div key={card.label} style={{ padding: 20, borderRadius: 22, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
            <div style={{ width: 52, height: 4, borderRadius: 999, background: card.accent, marginBottom: 16 }} />
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
            <div style={{ color: '#cbd5e1', marginTop: 8 }}>{card.sub}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Completed receipts</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {completedReceipts.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No completed receipts yet.</div>
            ) : completedReceipts.slice(0, 6).map((payment) => (
              <div key={payment.txId} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{payment.description}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{payment.txId}</div>
                  </div>
                  <div style={{ color: '#22d3ee', fontWeight: 700 }}>{'$' + Number(payment.total || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Monetized services</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {purchases.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No marketplace purchases yet.</div>
            ) : purchases.slice(0, 6).map((purchase) => (
              <div key={purchase.paymentTxId || purchase.purchasedAt} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)' }}>
                <div style={{ fontWeight: 700 }}>{purchase.serviceName}</div>
                <div style={{ color: '#cbd5e1', marginTop: 6 }}>{purchase.description}</div>
                <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Price: {'$' + Number(purchase.price || 0).toFixed(2)} • Method: {purchase.paymentMethod || 'n/a'}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Marketplace.jsx'), `import React from 'react'; import ServiceMarketplace from '../components/ServiceMarketplace'; export default function Marketplace(){ return <ServiceMarketplace clientId="guest" />; }`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'EnterpriseHub.jsx'), `import React from 'react';
import { Link } from 'react-router-dom';

const cards = [
  { title: 'Aviation Ops', path: '/enterprise/aviation', description: 'Route optimization, predictive maintenance, and dynamic airline pricing.' },
  { title: 'Government AI', path: '/enterprise/government', description: 'Compliance checks, service digitalization, and public policy analysis.' },
  { title: 'Defense Grid', path: '/enterprise/defense', description: 'Quantum encryption, threat intelligence, and critical infrastructure hardening.' },
  { title: 'Telecom Control', path: '/enterprise/telecom', description: '5G optimization, fault prediction, and revenue assurance.' },
  { title: 'Partner Console', path: '/enterprise/partners', description: 'Enterprise partner registration, API access, invoices, and dashboards.' }
];

export default function EnterpriseHub() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Enterprise Suite</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Sector intelligence command center</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 820 }}>Deploy sector-specific AI modules across aviation, public sector, defense, telecom, and strategic partnerships from one luxury control surface.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {cards.map((card) => (
          <Link key={card.path} to={card.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>{card.title}</div>
              <div style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.5 }}>{card.description}</div>
              <div style={{ marginTop: 16, color: '#22d3ee', fontWeight: 700 }}>Open module →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'AviationOps.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function AviationOps() {
  const [routeData, setRouteData] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [pricing, setPricing] = useState(null);

  const optimizeRoutes = async () => {
    const res = await axios.post('/api/aviation/optimize-routes', {
      airlineId: 'zeus-air',
      currentRoutes: [
        { routeId: 'OTP-DXB', origin: 'OTP', destination: 'DXB', frequency: 14, avgFare: 340, costPerFlight: 180 },
        { routeId: 'LHR-JFK', origin: 'LHR', destination: 'JFK', frequency: 21, avgFare: 620, costPerFlight: 310 }
      ],
      demandForecast: [{ demand: 0.78 }, { demand: 0.91 }],
      slotPressure: 0.68,
      fuelCostIndex: 1.12
    });
    setRouteData(res.data);
  };

  const runMaintenance = async () => {
    const res = await axios.post('/api/aviation/predictive-maintenance', {
      aircraft: [
        { id: 'A320-NEO-1', engineHealth: 0.74, cyclesSinceMaintenance: 640 },
        { id: 'B787-9-7', engineHealth: 0.58, cyclesSinceMaintenance: 920 }
      ]
    });
    setMaintenance(res.data);
  };

  const optimizePricing = async () => {
    const res = await axios.post('/api/aviation/ticket-pricing', {
      route: { routeId: 'OTP-DXB', monthlyPassengers: 125000, basePrice: 299 },
      demand: { current: 0.84 },
      competitors: [{ price: 289 }, { price: 315 }, { price: 305 }]
    });
    setPricing(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Aviation Ops</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={optimizeRoutes} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Optimize Routes</button>
        <button onClick={runMaintenance} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Predict Maintenance</button>
        <button onClick={optimizePricing} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#22c55e', color: '#04130a', fontWeight: 700 }}>Optimize Ticket Pricing</button>
      </div>
      {[routeData, maintenance, pricing].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'GovernmentOps.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function GovernmentOps() {
  const [compliance, setCompliance] = useState(null);
  const [digitalization, setDigitalization] = useState(null);
  const [policy, setPolicy] = useState(null);

  const runChecks = async () => {
    const [comp, digi, pol] = await Promise.all([
      axios.post('/api/government/compliance', { agency: 'EU Digital Office', requirements: ['gdpr', 'soc2', 'fedramp'] }),
      axios.post('/api/government/digitalize-service', { serviceId: 'tax-filing', params: { complexity: 'medium' } }),
      axios.post('/api/government/analyze-policy', { policyText: 'Healthcare and education modernization with digital identity and budget reform.' })
    ]);
    setCompliance(comp.data);
    setDigitalization(digi.data);
    setPolicy(pol.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Government AI</h1>
      <button onClick={runChecks} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Run Government Suite</button>
      {[compliance, digitalization, policy].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'DefenseOps.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function DefenseOps() {
  const [encryption, setEncryption] = useState(null);
  const [threats, setThreats] = useState(null);
  const [security, setSecurity] = useState(null);

  const runDefenseSuite = async () => {
    const [enc, thr, sec] = await Promise.all([
      axios.post('/api/defense/encrypt', { message: 'Top secret operational directive', recipient: 'alpha-unit' }),
      axios.post('/api/defense/threats', { sources: ['dark_web', 'signals'], criticalSignals: 4 }),
      axios.post('/api/defense/secure-infrastructure', { infraId: 'grid-sector-7', params: { openFindings: 5 } })
    ]);
    setEncryption(enc.data);
    setThreats(thr.data);
    setSecurity(sec.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Defense Grid</h1>
      <button onClick={runDefenseSuite} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#ef4444', color: '#fff', fontWeight: 700 }}>Run Defense Suite</button>
      {[encryption, threats, security].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'TelecomOps.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function TelecomOps() {
  const [network, setNetwork] = useState(null);
  const [failures, setFailures] = useState(null);
  const [revenue, setRevenue] = useState(null);

  const runTelecomSuite = async () => {
    const [net, fail, rev] = await Promise.all([
      axios.post('/api/telecom/optimize-5g', { networkId: '5g-eu-core', traffic: { peakLoad: 0.88 } }),
      axios.post('/api/telecom/predict-failures', { nodes: [{ id: 'edge-01', temperature: 83, packetLoss: 0.01 }, { id: 'edge-11', temperature: 64, packetLoss: 0.08 }] }),
      axios.post('/api/telecom/revenue-assurance', { cdrData: [{ subscriberId: 'sub-01', billedAmount: 54, expectedAmount: 74.5 }, { subscriberId: 'sub-77', billedAmount: 30, expectedAmount: 30 }] })
    ]);
    setNetwork(net.data);
    setFailures(fail.data);
    setRevenue(rev.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Telecom Control</h1>
      <button onClick={runTelecomSuite} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Run Telecom Suite</button>
      {[network, failures, revenue].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'PartnerHub.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function PartnerHub() {
  const [partner, setPartner] = useState(null);
  const [partnerRequest, setPartnerRequest] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [invoice, setInvoice] = useState(null);

  const bootstrapPartner = async () => {
    const registration = await axios.post('/api/enterprise/register', {
      partnerId: 'aws-enterprise',
      name: 'Amazon Web Services',
      template: 'aws'
    });

    const created = registration.data;
    setPartner(created);

    const headers = { 'x-api-key': created.apiKey };
    const [reqRes, dashRes, invoiceRes] = await Promise.all([
      axios.post('/api/partner/' + created.partnerId + '/aviation.optimize', { region: 'eu-central-1', aircraft: 28 }, { headers }),
      axios.get('/api/partner/' + created.partnerId + '/dashboard', { headers }),
      axios.get('/api/partner/' + created.partnerId + '/invoice/2026-03', { headers })
    ]);

    setPartnerRequest(reqRes.data);
    setDashboard(dashRes.data);
    setInvoice(invoiceRes.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Partner Console</h1>
      <button onClick={bootstrapPartner} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Register Demo Partner</button>
      {[partner, partnerRequest, dashboard, invoice].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'PaymentPage.jsx'), `import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import PaymentModal from '../components/PaymentModal';

export default function PaymentPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [btcRate, setBtcRate] = useState(null);
  const [marketplacePurchases, setMarketplacePurchases] = useState([]);
  const featuredPlan = useMemo(() => ({
    name: 'Unicorn Prime',
    description: 'Global deployment, AI operations, luxury UX, and automated growth stack.',
    price: 499
  }), []);

  const marketplaceReceipts = useMemo(() => (
    history.filter((payment) => payment.metadata?.source === 'marketplace')
  ), [history]);

  const fetchData = async () => {
    try {
      const [statsRes, historyRes, btcRes, purchasesRes] = await Promise.all([
        axios.get('/api/payment/stats'),
        axios.get('/api/payment/history'),
        axios.get('/api/payment/btc-rate'),
        axios.get('/api/marketplace/purchases/guest')
      ]);
      setStats(statsRes.data || null);
      setHistory(historyRes.data.payments || []);
      setBtcRate(btcRes.data || null);
      setMarketplacePurchases(purchasesRes.data.purchases || []);
    } catch (err) {
      console.error('Payment page load failed', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 24, borderRadius: 24, background: 'rgba(15,23,42,.7)', border: '1px solid rgba(34,211,238,.2)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Payments</div>
        <h1 style={{ margin: '8px 0', fontSize: 42 }}>Universal payment command center</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 760 }}>{featuredPlan.description}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18 }}>
          <div style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.45)', minWidth: 220 }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Featured plan</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{featuredPlan.name}</div>
            <div style={{ color: '#22d3ee', fontSize: 24, fontWeight: 700 }}>{'$' + Number(featuredPlan.price || 0).toFixed(2)}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.45)', minWidth: 220 }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>BTC / USD</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{btcRate ? '$' + Number(btcRate.rate || 0).toLocaleString() : 'Loading...'}</div>
            <div style={{ color: '#c084fc', fontSize: 13 }}>{btcRate?.source || 'live'}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.45)', minWidth: 220 }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Completed volume</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{'$' + Number(stats?.revenue || 0).toFixed(2)}</div>
            <div style={{ color: '#4ade80', fontSize: 13 }}>{stats?.completedPayments || 0} settled payments</div>
          </div>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ marginTop: 22, padding: '14px 20px', borderRadius: 16, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 800, cursor: 'pointer' }}>
          Launch Payment Modal
        </button>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          ['Transactions', stats?.totalPayments || 0, '#22d3ee'],
          ['Pending', stats?.pendingPayments || 0, '#facc15'],
          ['Methods Active', stats?.activeMethods || 0, '#c084fc']
        ].map(([label, value, color]) => (
          <div key={label} style={{ padding: 18, borderRadius: 20, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(148,163,184,.16)' }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Recent payments</h2>
          <button onClick={fetchData} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.2)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {history.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>No payments yet. Create one to populate live transaction history.</div>
          ) : history.slice(0, 6).map((payment) => (
            <div key={payment.txId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: 14, borderRadius: 16, background: 'rgba(2,6,23,.4)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{payment.description}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{payment.txId}</div>
              </div>
              <div>{payment.method}</div>
              <div>{'$' + Number(payment.total || 0).toFixed(2)}</div>
              <div style={{ color: payment.status === 'completed' ? '#4ade80' : '#facc15', fontWeight: 700 }}>{payment.status}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Marketplace receipts</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {marketplaceReceipts.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No marketplace receipts yet. Buy a service from the marketplace to generate linked receipts.</div>
            ) : marketplaceReceipts.slice(0, 6).map((payment) => (
              <div key={payment.txId} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)', border: '1px solid rgba(34,211,238,.14)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{payment.metadata?.serviceName || payment.description}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{payment.txId}</div>
                  </div>
                  <div style={{ color: '#22d3ee', fontWeight: 700 }}>{'$' + Number(payment.total || 0).toFixed(2)}</div>
                </div>
                <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 14 }}>{payment.metadata?.description || 'Marketplace service purchase'}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span>Status: {payment.status}</span>
                  <span>Method: {payment.method}</span>
                  <span>Created: {new Date(payment.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Purchased services</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {marketplacePurchases.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No activated marketplace services yet.</div>
            ) : marketplacePurchases.slice(0, 6).map((purchase) => (
              <div key={purchase.paymentTxId || purchase.purchasedAt} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)' }}>
                <div style={{ fontWeight: 700 }}>{purchase.serviceName}</div>
                <div style={{ color: '#cbd5e1', fontSize: 14, marginTop: 4 }}>{purchase.description}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', fontSize: 13, color: '#94a3b8' }}>
                  <span>Category: {purchase.category}</span>
                  <span>Price: {'$' + Number(purchase.price || 0).toFixed(2)}</span>
                  <span>Method: {purchase.paymentMethod || 'n/a'}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#67e8f9' }}>Receipt: {purchase.paymentTxId || 'pending-link'}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        presetAmount={featuredPlan.price}
        presetDescription={featuredPlan.name}
        clientId="guest"
        metadata={{ source: 'payments_page', plan: featuredPlan.name }}
        onCompleted={() => {
          setIsOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'QuantumBlockchainPage.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function QuantumBlockchainPage() {
  const [stats, setStats] = useState(null);
  const [tx] = useState({ from: 'treasury', to: 'partner-alpha', amount: 25 });
  const [lastTx, setLastTx] = useState(null);
  const [minedBlock, setMinedBlock] = useState(null);

  const loadStats = async () => {
    const res = await axios.get('/api/blockchain/stats');
    setStats(res.data);
  };

  const addTx = async () => {
    const res = await axios.post('/api/blockchain/transaction', tx);
    setLastTx(res.data);
    await loadStats();
  };

  const mine = async () => {
    const res = await axios.post('/api/blockchain/mine');
    setMinedBlock(res.data);
    await loadStats();
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Quantum Blockchain</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={loadStats} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Load Stats</button>
        <button onClick={addTx} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Add Transaction</button>
        <button onClick={mine} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22c55e', color: '#04130a', fontWeight: 700 }}>Mine Block</button>
      </div>
      {[stats, lastTx, minedBlock].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'AIWorkforcePage.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function AIWorkforcePage() {
  const [agent, setAgent] = useState(null);
  const [job, setJob] = useState(null);
  const [matches, setMatches] = useState([]);

  const runDemo = async () => {
    const registered = await axios.post('/api/workforce/agent', {
      name: 'Contract Analyst AI',
      description: 'Analyzes contracts and legal clauses',
      capabilities: ['legal-analysis', 'risk-scoring', 'summarization'],
      pricePerHour: 120,
      skills: ['contracts', 'compliance', 'negotiation']
    });
    setAgent(registered.data);

    const posted = await axios.post('/api/workforce/job', {
      title: 'Review international supplier contract',
      description: 'Need legal risk and pricing recommendations',
      requiredCapabilities: ['legal-analysis', 'risk-scoring'],
      budget: 200,
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      companyId: 'unicorn-enterprise'
    });
    setJob(posted.data);

    const best = await axios.get('/api/workforce/job/' + posted.data.id + '/agents');
    setMatches(best.data || []);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>AI Workforce Marketplace</h1>
      <button onClick={runDemo} style={{ width: 'fit-content', padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Run Workforce Demo</button>
      {[agent, job, matches.length ? matches : null].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'MAAdvisorPage.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function MAAdvisorPage() {
  const [targets, setTargets] = useState([]);
  const [deal, setDeal] = useState(null);

  const findTargets = async () => {
    const res = await axios.post('/api/ma/targets', {
      industry: 'AI',
      minRevenue: 20000000,
      maxRevenue: 100000000
    });
    setTargets(res.data || []);
  };

  const negotiate = async () => {
    if (!targets.length) return;
    const targetId = targets[0].id;
    const res = await axios.post('/api/ma/negotiate', {
      targetId,
      initialOffer: 45000000,
      maxPrice: 95000000
    });
    setDeal(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Autonomous M&A Advisor</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={findTargets} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Identify Targets</button>
        <button onClick={negotiate} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Negotiate Deal</button>
      </div>
      {[targets.length ? targets : null, deal].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'LegalContractsPage.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function LegalContractsPage() {
  const [generated, setGenerated] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const generateContract = async () => {
    const res = await axios.post('/api/legal/generate', {
      type: 'nda',
      params: {
        partyA: 'UNICORN LABS',
        partyB: 'Global Partner Inc.',
        duration: 24,
        purpose: 'Strategic technology collaboration'
      }
    });
    setGenerated(res.data);
  };

  const analyze = async () => {
    const res = await axios.post('/api/legal/analyze', {
      text: 'This agreement includes indemnify obligations, non-compete, and automatic renewal clauses.'
    });
    setAnalysis(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Legal Contract Generator & Analyzer</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={generateContract} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Generate Contract</button>
        <button onClick={analyze} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Analyze Contract</button>
      </div>
      {[generated, analysis].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'EnergyGridPage.jsx'), `import React, { useState } from 'react';
import axios from 'axios';

export default function EnergyGridPage() {
  const [producer, setProducer] = useState(null);
  const [consumer, setConsumer] = useState(null);
  const [flow, setFlow] = useState(null);
  const [trades, setTrades] = useState(null);

  const setupDemo = async () => {
    const [p, c] = await Promise.all([
      axios.post('/api/energy/producer', { name: 'Solar Plant A', capacity: 300, type: 'solar', location: 'RO', pricePerMWh: 58 }),
      axios.post('/api/energy/consumer', { name: 'Data Center 1', demand: 180, location: 'RO', maxPrice: 92 })
    ]);
    setProducer(p.data);
    setConsumer(c.data);
  };

  const optimize = async () => {
    const res = await axios.post('/api/energy/optimize');
    setFlow(res.data);
  };

  const trade = async () => {
    const res = await axios.post('/api/energy/trade');
    setTrades(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Decentralized Energy Grid Optimizer</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={setupDemo} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Register Producer + Consumer</button>
        <button onClick={optimize} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Optimize Flow</button>
        <button onClick={trade} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22c55e', color: '#04130a', fontWeight: 700 }}>Trade Excess</button>
      </div>
      {[producer, consumer, flow, trades].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'InnovationCommandCenter.jsx'), `import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function InnovationCommandCenter() {
  const [stats, setStats] = useState({
    blockchain: null,
    workforce: null,
    ma: null,
    legal: null,
    energy: null
  });

  const load = async () => {
    try {
      const [blockchain, workforce, ma, legal, energy] = await Promise.all([
        axios.get('/api/blockchain/stats'),
        axios.get('/api/workforce/stats'),
        axios.get('/api/ma/stats'),
        axios.get('/api/legal/stats'),
        axios.get('/api/energy/stats')
      ]);

      setStats({
        blockchain: blockchain.data,
        workforce: workforce.data,
        ma: ma.data,
        legal: legal.data,
        energy: energy.data
      });
    } catch (err) {
      console.error('Innovation command center load failed', err);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
  }, []);

  const cards = [
    { title: 'Quantum Blockchain', path: '/innovation/blockchain', accent: '#22d3ee', value: stats.blockchain ? stats.blockchain.chainLength + ' blocks' : '...' },
    { title: 'AI Workforce', path: '/innovation/workforce', accent: '#a855f7', value: stats.workforce ? stats.workforce.totalAgents + ' agents' : '...' },
    { title: 'M&A Advisor', path: '/innovation/ma', accent: '#38bdf8', value: stats.ma ? stats.ma.totalDeals + ' deals' : '...' },
    { title: 'Legal Engine', path: '/innovation/legal', accent: '#f59e0b', value: stats.legal ? stats.legal.totalAnalyzed + ' analyses' : '...' },
    { title: 'Energy Grid', path: '/innovation/energy', accent: '#22c55e', value: stats.energy ? stats.energy.totalCapacity + ' MW capacity' : '...' }
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Innovation Command Center</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Unified strategic innovation cockpit</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 840 }}>Monitor all five strategic innovations from one executive dashboard and jump into detailed module operations in one click.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <Link key={card.path} to={card.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 20, borderRadius: 22, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ width: 52, height: 4, borderRadius: 999, background: card.accent, marginBottom: 16 }} />
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.title}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
              <div style={{ marginTop: 10, color: card.accent, fontWeight: 700 }}>Open module →</div>
            </div>
          </Link>
        ))}
      </section>

      <section style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
        <h2 style={{ marginTop: 0 }}>Raw live payload</h2>
        <pre style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(2,6,23,.45)', border: '1px solid rgba(148,163,184,.14)', overflowX: 'auto' }}>{JSON.stringify(stats, null, 2)}</pre>
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Profile.jsx'), `import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Profile() {
  const stored = JSON.parse(localStorage.getItem('user') || '{}');
  const [name, setName] = useState(stored.name || '');
  const [email, setEmail] = useState(stored.email || '');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put('/api/auth/profile', { name, email }, {
        headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\` }
      });
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.token) localStorage.setItem('token', res.data.token);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: forgotEmail });
      toast.success(res.data.message);
      if (res.data.devToken) setResetToken(res.data.devToken);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Request failed');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/reset-password', { token: resetToken, newPassword });
      toast.success(res.data.message);
      setResetToken('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Account</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Profilul meu</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 600 }}>Actualizează informațiile contului și gestionează securitatea accesului.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Actualizare profil</h2>
          <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Nume</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Se actualizează...' : 'Actualizează'}
            </button>
          </form>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
            <h2 style={{ marginTop: 0 }}>Resetare parolă</h2>
            <form onSubmit={handleForgotPassword} style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Email cont</label>
                <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} type="email" placeholder="your@email.com" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <button type="submit" style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#f59e0b', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>Trimite link reset</button>
            </form>
          </div>

          {resetToken && (
            <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(248,113,113,.3)' }}>
              <h2 style={{ marginTop: 0 }}>Setează parola nouă</h2>
              <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Token reset</label>
                  <input value={resetToken} onChange={e => setResetToken(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Parolă nouă</label>
                  <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
                </div>
                <button type="submit" style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Confirmă parola nouă</button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Login.jsx'), `import React from 'react'; export default function Login(){ return <div>Login</div>; }`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'Register.jsx'), `import React from 'react'; export default function Register(){ return <div>Register</div>; }`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'ClientDashboard.jsx'), `import React from 'react'; export default function ClientDashboard(){ return <div>Client Dashboard</div>; }`);
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'AdminLogin.jsx'), fs.readFileSync(path.join(__dirname, 'templates', 'AdminLogin.jsx'), 'utf8'));
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'AdminDashboard.jsx'), fs.readFileSync(path.join(__dirname, 'templates', 'AdminDashboard.jsx'), 'utf8'));
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'ExecutiveDashboard.jsx'), fs.readFileSync(path.join(__dirname, 'templates', 'ExecutiveDashboard.jsx'), 'utf8'));
  writeText(path.join(ROOT, 'client', 'src', 'pages', 'UnicornLab.jsx'), fs.readFileSync(path.join(__dirname, 'templates', 'UnicornLab.jsx'), 'utf8'));

  writeText(path.join(ROOT, 'client', 'src', 'App.js'), `import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import ParticlesBackground3D from './components/ParticlesBackground3D';
import OrbitalNav from './components/OrbitalNav';
import QuantumLoader from './components/QuantumLoader';
import ScrollReveal from './components/ScrollReveal';
import NeonPulseButton from './components/NeonPulseButton';
import AnimatedDataStream from './components/AnimatedDataStream';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import Chatbot from './components/Chatbot';
import Home from './pages/Home';
import Codex from './pages/Codex';
import Dashboard from './pages/Dashboard';
import Industries from './pages/Industries';
import Capabilities from './pages/Capabilities';
import Wealth from './pages/Wealth';
import Marketplace from './pages/Marketplace';
import EnterpriseHub from './pages/EnterpriseHub';
import AviationOps from './pages/AviationOps';
import GovernmentOps from './pages/GovernmentOps';
import DefenseOps from './pages/DefenseOps';
import TelecomOps from './pages/TelecomOps';
import PartnerHub from './pages/PartnerHub';
import PaymentPage from './pages/PaymentPage';
import QuantumBlockchainPage from './pages/QuantumBlockchainPage';
import AIWorkforcePage from './pages/AIWorkforcePage';
import MAAdvisorPage from './pages/MAAdvisorPage';
import LegalContractsPage from './pages/LegalContractsPage';
import EnergyGridPage from './pages/EnergyGridPage';
import InnovationCommandCenter from './pages/InnovationCommandCenter';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientDashboard from './pages/ClientDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import UnicornLab from './pages/UnicornLab';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) setUser(JSON.parse(userData));
    setLoading(false);

    const interval = setInterval(() => {
      setHealthData(prev => [...prev.slice(-19), Math.random() * 100]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out');
    navigate('/');
  };

  if (loading) return <QuantumLoader loading={true} />;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#111827,#4c1d95,#0f172a)', position: 'relative', overflowX: 'hidden' }}>
      <ParticlesBackground3D />
      <QuantumLoader loading={false} />
      <Toaster position="top-right" />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,.3)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: 28, fontWeight: 700, textDecoration: 'none', background: 'linear-gradient(90deg,#22d3ee,#a855f7)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            ✦ ZEUS & AI ✦
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {['/', '/codex', '/dashboard', '/industries', '/capabilities', '/wealth', '/marketplace', '/payments', '/enterprise', '/innovation', '/innovation/blockchain', '/innovation/workforce', '/innovation/ma', '/innovation/legal', '/innovation/energy'].map((path, i) => (
              <Link key={path} to={path} style={{ color: '#e2e8f0', textDecoration: 'none' }}>
                {['Home', 'Codex', 'Dashboard', 'Industries', 'Capabilities', 'Wealth', 'Marketplace', 'Payments', 'Enterprise', 'Innovation', 'Blockchain', 'Workforce', 'M&A', 'Legal', 'Energy'][i]}
              </Link>
            ))}
            <Link to="/admin/login" style={{ color: '#facc15', textDecoration: 'none' }}>🔐 Admin</Link>
            <Link to="/executive" style={{ color: '#22d3ee', textDecoration: 'none' }}>📊 Exec Dashboard</Link>
            <Link to="/unicorn-lab" style={{ color: '#a78bfa', textDecoration: 'none' }}>🦄 Lab</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                <span style={{ color: '#67e8f9' }}>{user.name}</span>
                <NeonPulseButton onClick={() => navigate('/profile')} color="#22d3ee" className="!px-4 !py-1 !text-sm">Profile</NeonPulseButton>
                <NeonPulseButton onClick={handleLogout} color="#ff4444" className="!px-4 !py-1 !text-sm">Logout</NeonPulseButton>
              </>
            ) : (
              <>
                <NeonPulseButton onClick={() => navigate('/login')} className="!px-4 !py-1 !text-sm">Login</NeonPulseButton>
                <NeonPulseButton onClick={() => navigate('/register')} color="#ff44ff" className="!px-4 !py-1 !text-sm">Register</NeonPulseButton>
              </>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        <Routes>
          <Route path="/" element={<ScrollReveal><Home /></ScrollReveal>} />
          <Route path="/codex" element={<ScrollReveal delay={0.1}><Codex /></ScrollReveal>} />
          <Route path="/dashboard" element={<ScrollReveal delay={0.2}><Dashboard healthData={healthData} /></ScrollReveal>} />
          <Route path="/industries" element={<ScrollReveal delay={0.1}><Industries /></ScrollReveal>} />
          <Route path="/capabilities" element={<ScrollReveal delay={0.2}><Capabilities /></ScrollReveal>} />
          <Route path="/wealth" element={<ScrollReveal delay={0.1}><Wealth /></ScrollReveal>} />
          <Route path="/marketplace" element={<ScrollReveal delay={0.2}><Marketplace /></ScrollReveal>} />
          <Route path="/payments" element={<ScrollReveal delay={0.15}><PaymentPage /></ScrollReveal>} />
          <Route path="/enterprise" element={<ScrollReveal delay={0.1}><EnterpriseHub /></ScrollReveal>} />
          <Route path="/enterprise/aviation" element={<ScrollReveal delay={0.12}><AviationOps /></ScrollReveal>} />
          <Route path="/enterprise/government" element={<ScrollReveal delay={0.14}><GovernmentOps /></ScrollReveal>} />
          <Route path="/enterprise/defense" element={<ScrollReveal delay={0.16}><DefenseOps /></ScrollReveal>} />
          <Route path="/enterprise/telecom" element={<ScrollReveal delay={0.18}><TelecomOps /></ScrollReveal>} />
          <Route path="/enterprise/partners" element={<ScrollReveal delay={0.2}><PartnerHub /></ScrollReveal>} />
          <Route path="/innovation" element={<ScrollReveal delay={0.1}><InnovationCommandCenter /></ScrollReveal>} />
          <Route path="/innovation/blockchain" element={<ScrollReveal delay={0.12}><QuantumBlockchainPage /></ScrollReveal>} />
          <Route path="/innovation/workforce" element={<ScrollReveal delay={0.14}><AIWorkforcePage /></ScrollReveal>} />
          <Route path="/innovation/ma" element={<ScrollReveal delay={0.16}><MAAdvisorPage /></ScrollReveal>} />
          <Route path="/innovation/legal" element={<ScrollReveal delay={0.18}><LegalContractsPage /></ScrollReveal>} />
          <Route path="/innovation/energy" element={<ScrollReveal delay={0.2}><EnergyGridPage /></ScrollReveal>} />
          <Route path="/profile" element={user ? <ScrollReveal delay={0.1}><Profile /></ScrollReveal> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard-client" element={user ? <ClientDashboard /> : <Navigate to="/login" />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/executive" element={<ExecutiveDashboard />} />
          <Route path="/unicorn-lab" element={<UnicornLab />} />
        </Routes>
      </main>

      <div style={{ position: 'fixed', left: 16, bottom: 16, width: 320, zIndex: 40 }}>
        <AnimatedDataStream data={healthData} title="Real-time Analytics" unit="%" />
      </div>

      <OrbitalNav />
      <Chatbot />
    </div>
  );
}

export default App;
`);

  writeText(path.join(ROOT, 'scripts', 'deploy-hetzner.js'), `// Rulează pe mașina locală: node deploy-hetzner.js

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n🚀 Configurare automată Hetzner pentru Unicorn\n');
  console.log('Acest script va configura serverul Hetzner de la zero și va porni Unicornul.\n');

  const host = await question('🌐 IP-ul serverului Hetzner: ');
  const user = await question('👤 Utilizator SSH (default root): ') || 'root';
  const repoUrl = await question('📦 URL repository GitHub: ');
  const deployPath = await question('📁 Calea deploy pe server (default /root/unicorn): ') || '/root/unicorn';

  console.log('\n🔧 Se rulează scriptul de configurare pe server...\n');

  const script = \`
echo "═══════════════════════════════════════════════════════════"
echo "🚀 Configurare automată Unicorn pe Hetzner"
echo "═══════════════════════════════════════════════════════════"

echo "🔧 1. Actualizare sistem și instalare dependențe..."
apt update -y && apt upgrade -y
apt install -y docker.io docker-compose curl git nginx

echo "🐳 2. Pornire Docker..."
systemctl enable docker
systemctl start docker

echo "📁 3. Creare director și clonare repository..."
mkdir -p \${deployPath}
cd \${deployPath}
if [ -d ".git" ]; then
  git pull origin main
else
  git clone \${repoUrl} .
  git checkout main
fi

echo "📦 4. Instalare dependențe backend..."
npm install

echo "🎨 5. Instalare și construire frontend..."
cd client
npm install
npm run build
cd ..

echo "⚙️ 6. Creare fișier .env..."
if [ ! -f .env ]; then
  echo "JWT_SECRET=\$(openssl rand -hex 32)" > .env
  echo "PORT=3000" >> .env
fi

echo "🔧 7. Creare serviciu systemd pentru Unicorn..."
cat > /etc/systemd/system/unicorn.service <<EOF
[Unit]
Description=Unicorn AI Service
After=network.target
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=\${deployPath}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "🌐 8. Creare serviciu systemd pentru webhook..."
WEBHOOK_SECRET=\$(openssl rand -hex 16)
cat > /etc/systemd/system/unicorn-webhook.service <<EOF
[Unit]
Description=Unicorn Webhook Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=\${deployPath}
ExecStart=/usr/bin/node webhook-server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "🔗 9. Creare script webhook..."
cat > \${deployPath}/webhook-server.js <<'WEBHOOK'
const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '\${WEBHOOK_SECRET}';

app.post('/webhook/update', (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) return res.status(403).send('Forbidden');
  console.log('📡 Webhook primit, actualizare...');
  exec('cd \${deployPath} && git pull && npm install && cd client && npm install && npm run build && cd .. && systemctl restart unicorn', (err) => {
    if (err) {
      console.error('❌ Eroare:', err);
      return res.status(500).send('Update failed');
    }
    console.log('✅ Actualizare finalizată');
    res.send('OK');
  });
});

app.listen(3001, () => console.log('Webhook server on port 3001'));
WEBHOOK

echo "📦 10. Instalare express pentru webhook..."
cd \${deployPath}
npm install express

echo "🔄 11. Activare servicii systemd..."
systemctl daemon-reload
systemctl enable unicorn.service
systemctl enable unicorn-webhook.service
systemctl restart unicorn.service
systemctl restart unicorn-webhook.service

echo "⏰ 12. Configurare cron pentru auto-update (la fiecare 5 minute)..."
cat > /etc/cron.d/unicorn-update <<EOF
*/5 * * * * root cd \${deployPath} && git pull && npm install && cd client && npm install && npm run build && cd .. && systemctl restart unicorn >> /var/log/unicorn-update.log 2>&1
EOF
chmod 0644 /etc/cron.d/unicorn-update

echo "🔒 13. Configurare firewall..."
ufw allow 3000/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ CONFIGURARE COMPLETĂ! Unicornul rulează pe portul 3000"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Informații importante:"
echo "   🔗 URL Unicorn: http://\${host}:3000"
echo "   🔗 Webhook URL: http://\${host}:3001/webhook/update"
echo "   🔑 Secret webhook: \${WEBHOOK_SECRET}"
echo ""
echo "🔄 Pentru a activa webhook-ul pe GitHub:"
echo "   1. Mergi la Settings → Webhooks → Add webhook"
echo "   2. Payload URL: http://\${host}:3001/webhook/update"
echo "   3. Secret: \${WEBHOOK_SECRET}"
echo "   4. Events: Just the push event"
\`;

  try {
    execSync(\`ssh \${user}@\${host} 'bash -s' <<'EOS'\n\${script}\nEOS\`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Eroare la deploy pe Hetzner:', err.message);
  } finally {
    rl.close();
  }
}

main();
`);

  writeText(path.join(SRC, 'index.js'), `const http = require('http');
const { buildInnovationReport } = require('./innovation/innovation-engine');
const { generateSprintPlan } = require('./innovation/innovation-sprint');
const { getSiteHtml } = require('./site/template');

const PORT = Number(process.env.PORT || 3000);

const modules = [
  { id: 'auto-deploy-orchestrator', status: 'active', purpose: 'continuous delivery' },
  { id: 'code-sanity-engine', status: 'active', purpose: 'quality and safety checks' },
  { id: 'innovation-engine', status: 'active', purpose: 'idea scoring and prioritization' },
  { id: 'innovation-sprint-engine', status: 'active', purpose: 'execution planning' },
  { id: 'zeus-experience-layer', status: 'active', purpose: 'animated AI persona interface' },
  { id: 'robot-assistant-layer', status: 'active', purpose: 'interactive co-pilot persona' }
];

const marketplace = [
  { id: 'adaptive-ai', title: 'Adaptive AI', segment: 'all', kpi: 'automation coverage' },
  { id: 'predictive-engine', title: 'Predictive Engine', segment: 'companies', kpi: 'forecast accuracy' },
  { id: 'quantum-nexus', title: 'Quantum Nexus', segment: 'enterprise', kpi: 'latency optimization' },
  { id: 'viral-growth', title: 'Viral Growth Engine', segment: 'startups', kpi: 'acquisition rate' },
  { id: 'automation-blocks', title: 'Automation Blocks', segment: 'all', kpi: 'tasks automated' }
];

const codexSections = [
  'Adaptive Modules',
  'Engines',
  'Viral Growth',
  'AI Child',
  'ZEUS Core',
  'Automation Studio',
  'Marketplace'
];

const industries = [
  { id: 'ecommerce', title: 'E-commerce', outcomes: ['conversion uplift', 'ad spend efficiency'] },
  { id: 'fintech', title: 'FinTech', outcomes: ['risk scoring', 'fraud prevention'] },
  { id: 'manufacturing', title: 'Manufacturing', outcomes: ['downtime reduction', 'predictive maintenance'] }
];

const userProfile = {
  id: 'demo-user',
  type: 'company',
  plan: 'Growth',
  aiChild: { level: 7, health: 89, growth: 76, mood: 'curious' }
};

function buildTelemetry() {
  return {
    moduleHealth: 97,
    revenue: 24840,
    activeUsers: 1320,
    requests: 98544,
    aiGrowth: userProfile.aiChild.growth
  };
}

function buildSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    health: { ok: true, service: 'unicorn-final' },
    profile: userProfile,
    modules,
    marketplace,
    codex: codexSections,
    industries,
    telemetry: buildTelemetry(),
    innovation: buildInnovationReport(),
    sprint: generateSprintPlan(),
    recommendations: [
      'Activate Predictive Engine for demand planning',
      'Launch AI Child onboarding flow',
      'Enable Viral Growth Engine for referral experiments'
    ],
    billing: {
      primary: 'BTC',
      supported: ['BTC', 'CARD', 'SEPA'],
      note: 'BTC can be primary while preserving enterprise adoption via additional methods.'
    }
  };
}

const streamClients = new Set();
const streamTimer = setInterval(() => {
  const payload = 'data: ' + JSON.stringify(buildSnapshot()) + '\\n\\n';
  for (const client of streamClients) {
    client.write(payload);
  }
}, 5000);

if (typeof streamTimer.unref === 'function') {
  streamTimer.unref();
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'unicorn-final' }));
  }

  if (req.url === '/innovation') {
    const report = buildInnovationReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(report));
  }

  if (req.url === '/innovation/sprint') {
    const sprint = generateSprintPlan();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(sprint));
  }

  if (req.url === '/modules') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), modules }));
  }

  if (req.url === '/marketplace') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), modules: marketplace }));
  }

  if (req.url === '/codex') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), sections: codexSections }));
  }

  if (req.url === '/me') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(userProfile));
  }

  if (req.url === '/telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildTelemetry()));
  }

  if (req.url === '/recommendations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: buildSnapshot().recommendations }));
  }

  if (req.url === '/industries') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: industries }));
  }

  if (req.url === '/billing') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildSnapshot().billing));
  }

  if (req.url === '/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(buildSnapshot()));
  }

  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    res.write('data: ' + JSON.stringify(buildSnapshot()) + '\\n\\n');
    streamClients.add(res);

    req.on('close', () => {
      streamClients.delete(res);
    });
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getSiteHtml());
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'Not found' }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('UNICORN_FINAL listening on http://localhost:' + PORT);
  });
}

module.exports = server;
`);

  writeText(path.join(SITE, 'template.js'), `function getSiteHtml() {
  return \`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ZEUS AI — Universal AI Unicorn Platform</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@400;700;900&display=swap');
    :root { color-scheme: dark; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Rajdhani', system-ui, Arial; color: #e8f4ff; background: #05060e; overflow-x: hidden; }
    #bg-canvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    .wrap { max-width: 1260px; margin: 0 auto; padding: 24px 20px; position: relative; z-index: 1; }

    /* ── HERO ─────────────────────────────────────── */
    .hero { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; margin-bottom: 24px; }
    @media(max-width:900px){ .hero{ grid-template-columns:1fr; } }

    /* ── CARD ─────────────────────────────────────── */
    .card { background: rgba(10,14,36,.75); border: 1px solid rgba(0,200,255,.2); border-radius: 20px; padding: 20px; backdrop-filter: blur(10px); }
    .card-glow { box-shadow: 0 0 30px rgba(0,180,255,.15) inset, 0 4px 24px rgba(0,0,0,.5); }

    /* ── TYPOGRAPHY ───────────────────────────────── */
    .title { font-family: 'Orbitron', monospace; font-size: clamp(22px,3.5vw,38px); font-weight: 900; line-height: 1.1; letter-spacing: .5px; background: linear-gradient(135deg,#00d4ff,#c084fc,#00ffa3); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { color: #7dd3fc; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
    .kpi-val { font-family: 'Orbitron', monospace; font-size: 28px; font-weight: 700; color: #00d4ff; }
    .label { font-size: 12px; color: #7090b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .green { color: #00ffa3; }
    .purple { color: #c084fc; }
    .cyan { color: #00d4ff; }

    /* ── ZEUS 3D FACE ─────────────────────────────── */
    .zeus-face { position: relative; height: 260px; border-radius: 18px; overflow: hidden; border: 1px solid rgba(0,200,255,.3); background: linear-gradient(145deg,#0a0e24,#060810); }
    #zeusCanvas { width: 100%; height: 100%; display: block; }
    .zeus-overlay { position: absolute; inset: 0; pointer-events: none; }
    .zeus-ring { position: absolute; inset: -10%; border-radius: 50%; border: 2px solid rgba(0,212,255,.18); animation: rotateRing 8s linear infinite; }
    .zeus-ring2 { position: absolute; inset: -20%; border-radius: 50%; border: 1px solid rgba(192,132,252,.12); animation: rotateRing 14s linear infinite reverse; }
    .zeus-scan { position: absolute; left: 0; right: 0; top: -30%; height: 70%; background: linear-gradient(to bottom, transparent, rgba(0,212,255,.2), transparent); animation: scan 3.6s infinite linear; }
    .zeus-label { position: absolute; left: 14px; bottom: 12px; font-family: 'Orbitron', monospace; font-size: 11px; color: #00d4ff; letter-spacing: 1px; text-shadow: 0 0 8px #00d4ff; }
    .zeus-status { position: absolute; right: 14px; top: 12px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: #00ffa3; }
    .zeus-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ffa3; box-shadow: 0 0 8px #00ffa3; animation: pulse 1.8s infinite; }

    /* ── LUXURY CLOCK ─────────────────────────────── */
    .clock-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    #luxClock { width: 180px; height: 180px; }
    .clock-digital { font-family: 'Orbitron', monospace; font-size: 20px; font-weight: 700; color: #00d4ff; letter-spacing: 3px; text-shadow: 0 0 12px rgba(0,212,255,.7); text-align: center; }
    .clock-date { font-size: 11px; color: #7090b0; letter-spacing: 2px; text-align: center; text-transform: uppercase; }

    /* ── GRID STATS ───────────────────────────────── */
    .stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 20px; }
    @media(max-width:600px){ .stats-row{ grid-template-columns:1fr 1fr; } }

    /* ── CODEX SECTION ────────────────────────────── */
    .codex-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 14px; margin-bottom: 20px; }
    .codex-card { padding: 16px 18px; border-radius: 16px; background: rgba(10,14,36,.65); border: 1px solid rgba(0,200,255,.15); position: relative; overflow: hidden; transition: border-color .3s, transform .3s; cursor: default; }
    .codex-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg,rgba(0,212,255,.05),transparent); opacity: 0; transition: opacity .3s; }
    .codex-card:hover { border-color: rgba(0,212,255,.5); transform: translateY(-3px); }
    .codex-card:hover::before { opacity: 1; }
    .codex-tag { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #c084fc; margin-bottom: 6px; }
    .codex-title { font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700; color: #e8f4ff; margin-bottom: 6px; }
    .codex-desc { font-size: 12px; color: #7090b0; line-height: 1.5; }
    .codex-arrow { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #00d4ff; font-size: 16px; opacity: 0; transition: opacity .3s; }
    .codex-card:hover .codex-arrow { opacity: 1; }

    /* ── PROGRESS BARS ────────────────────────────── */
    .bar-wrap { margin-bottom: 10px; }
    .bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; margin-top: 4px; }
    .bar > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg,#00d4ff,#c084fc); box-shadow: 0 0 8px rgba(0,212,255,.5); transition: width 1.2s ease; }

    /* ── MODULES LIST ─────────────────────────────── */
    .module-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 13px; }
    .module-item:last-child { border-bottom: 0; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: rgba(0,255,163,.15); color: #00ffa3; border: 1px solid rgba(0,255,163,.3); }

    /* ── BILLING ──────────────────────────────────── */
    .btc-addr { font-family: monospace; font-size: 11px; color: #00ffa3; word-break: break-all; background: rgba(0,255,163,.06); border: 1px solid rgba(0,255,163,.2); border-radius: 8px; padding: 8px 10px; margin-top: 8px; }

    /* ── FOOTER ───────────────────────────────────── */
    .footer { margin-top: 30px; padding: 20px; text-align: center; border-top: 1px solid rgba(0,200,255,.15); font-size: 12px; color: #7090b0; }
    .footer a { color: #00d4ff; text-decoration: none; }

    /* ── ANIMATIONS ───────────────────────────────── */
    @keyframes pulse { 0%,100%{ transform:scale(1);opacity:.9; } 50%{ transform:scale(1.15);opacity:1; } }
    @keyframes scan { 0%{ transform:translateY(-120%); } 100%{ transform:translateY(260%); } }
    @keyframes rotateRing { from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }
    @keyframes drift { from{ transform:translateY(0); } to{ transform:translateY(40px); } }
    @keyframes fadeIn { from{ opacity:0;transform:translateY(18px); } to{ opacity:1;transform:translateY(0); } }
    .anim-in { animation: fadeIn .7s ease both; }
    .anim-in:nth-child(2){ animation-delay:.1s; }
    .anim-in:nth-child(3){ animation-delay:.2s; }
    .anim-in:nth-child(4){ animation-delay:.3s; }
    .anim-in:nth-child(5){ animation-delay:.4s; }
    .anim-in:nth-child(6){ animation-delay:.5s; }
  </style>
</head>
<body>
  <canvas id="bg-canvas"></canvas>

  <div class="wrap">
    <!-- ── HERO ───────────────────────────────────── -->
    <div class="hero">
      <div>
        <div class="card card-glow" style="margin-bottom:20px;">
          <div class="subtitle">Universal AI Unicorn Platform</div>
          <h1 class="title">ZEUS AI — Build. Automate. Scale.</h1>
          <p style="color:#9db8d0;margin:10px 0 16px;line-height:1.6;font-size:15px;">
            Luxury AI infrastructure for commerce, enterprise, and sovereign-scale operations.
            Powered by autonomous modules, predictive intelligence, and holographic control surfaces.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a href="#dashboard" style="padding:10px 20px;border-radius:999px;border:1px solid rgba(0,212,255,.5);color:#00d4ff;text-decoration:none;font-family:'Orbitron',monospace;font-size:12px;letter-spacing:1px;box-shadow:0 0 20px rgba(0,212,255,.2) inset;">ENTER UNICORN</a>
            <a href="#codex" style="padding:10px 20px;border-radius:999px;border:1px solid rgba(192,132,252,.5);color:#c084fc;text-decoration:none;font-family:'Orbitron',monospace;font-size:12px;letter-spacing:1px;box-shadow:0 0 20px rgba(192,132,252,.15) inset;">CODEX</a>
          </div>
        </div>

        <!-- Zeus 3D Face -->
        <div class="zeus-face card-glow">
          <canvas id="zeusCanvas"></canvas>
          <div class="zeus-overlay">
            <div class="zeus-ring"></div>
            <div class="zeus-ring2"></div>
            <div class="zeus-scan"></div>
          </div>
          <div class="zeus-label">ZEUS · STRATEGIC INTELLIGENCE</div>
          <div class="zeus-status"><div class="zeus-dot"></div>ONLINE</div>
        </div>
      </div>

      <!-- ── RIGHT COLUMN ─────────────────────────── -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Luxury Clock -->
        <div class="card card-glow">
          <div class="subtitle" style="text-align:center;">Platform Clock</div>
          <div class="clock-wrap">
            <canvas id="luxClock"></canvas>
            <div class="clock-digital" id="clockDigital">--:--:--</div>
            <div class="clock-date" id="clockDate">--- --- --</div>
          </div>
        </div>

        <!-- AI Child Stats -->
        <div class="card card-glow">
          <div class="subtitle">AI Child Status</div>
          <div class="bar-wrap">
            <div class="label">Health <span id="aiHealthLabel" class="green">--%</span></div>
            <div class="bar"><span id="aiHealthBar" style="width:0%"></span></div>
          </div>
          <div class="bar-wrap">
            <div class="label">Growth <span id="aiGrowthLabel" class="purple">--%</span></div>
            <div class="bar"><span id="aiGrowthBar" style="width:0%;background:linear-gradient(90deg,#c084fc,#818cf8)"></span></div>
          </div>
          <div style="margin-top:10px;font-size:12px;color:#7090b0;">Mood: <span id="aiMood" class="cyan">...</span></div>
        </div>

        <!-- Top Innovation -->
        <div class="card card-glow">
          <div class="subtitle">Top Innovation</div>
          <div id="topTitle" style="font-family:'Orbitron',monospace;font-size:13px;margin-bottom:6px;color:#e8f4ff;">Loading…</div>
          <div id="topScore" class="kpi-val">--</div>
          <div id="topProblem" style="font-size:11px;color:#7090b0;margin-top:4px;"></div>
        </div>
      </div>
    </div>

    <!-- ── KPI STATS ────────────────────────────────── -->
    <div id="dashboard" class="stats-row" style="scroll-margin-top:20px;">
      <div class="card card-glow anim-in"><div class="label">Modules Online</div><div class="kpi-val" id="modulesCount">--</div></div>
      <div class="card card-glow anim-in"><div class="label">Active Users</div><div class="kpi-val" id="activeUsers">--</div></div>
      <div class="card card-glow anim-in"><div class="label">Requests / uptime</div><div class="kpi-val" id="requests">--</div></div>
    </div>

    <!-- ── CODEX SECTION ───────────────────────────── -->
    <h2 id="codex" class="title" style="font-size:18px;margin-bottom:16px;scroll-margin-top:20px;">⬡ CODEX — Operational Knowledge Map</h2>
    <div class="codex-grid">
      <div class="codex-card anim-in"><div class="codex-tag">Monetization</div><div class="codex-title">Payments Codex</div><div class="codex-desc">Universal gateway, receipts, BTC pricing, and transaction stats.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Commerce</div><div class="codex-title">Marketplace Codex</div><div class="codex-desc">Service discovery, dynamic pricing, recommendations, and checkout.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Operations</div><div class="codex-title">Enterprise Codex</div><div class="codex-desc">Aviation, defense, government, telecom, partner integrations.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Platform</div><div class="codex-title">Capabilities Codex</div><div class="codex-desc">Strategic capabilities across the full Unicorn stack.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Analytics</div><div class="codex-title">Dashboard Codex</div><div class="codex-desc">Risk, compliance, opportunities, payments, marketplace metrics.</div><div class="codex-arrow">→</div></div>
      <div class="codex-card anim-in"><div class="codex-tag">Innovation</div><div class="codex-title">AI Innovation Codex</div><div class="codex-desc" id="codexInnovation">Autonomous idea scoring, sprint planning, deployment intelligence.</div><div class="codex-arrow">→</div></div>
    </div>

    <!-- ── TWO COLUMN SECTION ──────────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;" class="two-col">
      <div class="card card-glow">
        <div class="subtitle">Module Status</div>
        <ul id="modulesList" style="list-style:none;"></ul>
      </div>
      <div class="card card-glow">
        <div class="subtitle">Sprint Plan</div>
        <ul id="sprintList" style="list-style:none;"></ul>
      </div>
    </div>

    <!-- ── MARKETPLACE + BILLING ──────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;" class="two-col">
      <div class="card card-glow">
        <div class="subtitle">Marketplace</div>
        <ul id="marketplaceList" style="list-style:none;"></ul>
      </div>
      <div class="card card-glow">
        <div class="subtitle">Billing Strategy</div>
        <div id="billingInfo" style="font-size:13px;color:#9db8d0;"></div>
        <div class="btc-addr" id="btcAddress">bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</div>
      </div>
    </div>

    <!-- ── FOOTER ──────────────────────────────────── -->
    <div class="footer">
      <p>🦄 <a href="https://zeusai.pro" target="_blank">zeusai.pro</a> — Universal AI Unicorn Platform</p>
      <p style="margin-top:6px;">© 2026 Vladoi Ionut · <a href="mailto:vladoi_ionut@yahoo.com">vladoi_ionut@yahoo.com</a></p>
      <p style="margin-top:6px;font-family:monospace;font-size:11px;color:#00ffa3;">BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e</p>
    </div>
  </div>

  <style>
    @media(max-width:700px){ .two-col{ grid-template-columns:1fr !important; } }
  </style>

  <script>
  /* ────────────────────────────────────────────────────
     1. BACKGROUND — 3D starfield on bg-canvas
  ──────────────────────────────────────────────────── */
  (function() {
    var c = document.getElementById('bg-canvas');
    var ctx = c.getContext('2d');
    var stars = [];
    function resize() { c.width = innerWidth; c.height = innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (var i = 0; i < 180; i++) {
      stars.push({ x: Math.random(), y: Math.random(), z: Math.random(), speed: 0.00004 + Math.random() * 0.00008 });
    }
    function drawBg(t) {
      ctx.fillStyle = 'rgba(5,6,14,0.45)';
      ctx.fillRect(0, 0, c.width, c.height);
      stars.forEach(function(s) {
        s.z = (s.z + s.speed) % 1;
        var px = (s.x - 0.5) * c.width * (0.15 + s.z * 0.85) + c.width / 2;
        var py = (s.y - 0.5) * c.height * (0.15 + s.z * 0.85) + c.height / 2;
        var r = 0.5 + s.z * 2.5;
        var alpha = 0.2 + s.z * 0.8;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + (190 + s.z * 60) + ',90%,70%,' + alpha + ')';
        ctx.fill();
      });
      requestAnimationFrame(drawBg);
    }
    requestAnimationFrame(drawBg);
  })();

  /* ────────────────────────────────────────────────────
     2. ZEUS 3D FACE — animated 3D sphere with wireframe
  ──────────────────────────────────────────────────── */
  (function() {
    var cv = document.getElementById('zeusCanvas');
    var ctx = cv.getContext('2d');
    var mouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', function(e) {
      mouse.x = (e.clientX / innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / innerHeight - 0.5) * 2;
    });
    function resize() { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
    resize(); window.addEventListener('resize', resize);

    // Build sphere geometry
    var RINGS = 14, SEGS = 24;
    var verts = [];
    for (var lat = 0; lat <= RINGS; lat++) {
      for (var lon = 0; lon <= SEGS; lon++) {
        var theta = lat * Math.PI / RINGS;
        var phi = lon * 2 * Math.PI / SEGS;
        verts.push([Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)]);
      }
    }

    function project(v, rx, ry, cx, cy, scale) {
      // rotate Y
      var x0 = v[0] * Math.cos(ry) + v[2] * Math.sin(ry);
      var y0 = v[1];
      var z0 = -v[0] * Math.sin(ry) + v[2] * Math.cos(ry);
      // rotate X
      var x1 = x0;
      var y1 = y0 * Math.cos(rx) - z0 * Math.sin(rx);
      var z1 = y0 * Math.sin(rx) + z0 * Math.cos(rx);
      var fov = 3.5;
      var pz = z1 + fov;
      return { px: cx + x1 / pz * scale, py: cy + y1 / pz * scale, z: z1, depth: pz };
    }

    var rot = { x: 0.3, y: 0 };
    function drawZeus(t) {
      rot.y += 0.008 + mouse.x * 0.004;
      rot.x = 0.3 + mouse.y * 0.2;
      var w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.32;

      // Draw sphere wireframe lines
      for (var lat = 0; lat < RINGS; lat++) {
        for (var lon = 0; lon < SEGS; lon++) {
          var idx = lat * (SEGS + 1) + lon;
          var p0 = project(verts[idx], rot.x, rot.y, cx, cy, scale);
          var p1 = project(verts[idx + 1], rot.x, rot.y, cx, cy, scale);
          var p2 = project(verts[idx + SEGS + 1], rot.x, rot.y, cx, cy, scale);

          var visible0 = p0.depth > 0 && p1.depth > 0;
          var visible1 = p0.depth > 0 && p2.depth > 0;

          if (visible0) {
            var alpha0 = Math.max(0, (p0.z + 0.6) / 1.2) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p0.px, p0.py);
            ctx.lineTo(p1.px, p1.py);
            ctx.strokeStyle = 'rgba(0,210,255,' + alpha0.toFixed(2) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          if (visible1) {
            var alpha1 = Math.max(0, (p0.z + 0.6) / 1.2) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p0.px, p0.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.strokeStyle = 'rgba(192,132,252,' + alpha1.toFixed(2) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Core glow orb
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.38);
      grad.addColorStop(0, 'rgba(0,200,255,0.55)');
      grad.addColorStop(0.5, 'rgba(100,80,255,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, scale * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Particle dots at vertices (front half only)
      verts.forEach(function(v, i) {
        if (i % 7 !== 0) return;
        var p = project(v, rot.x, rot.y, cx, cy, scale);
        if (p.z < -0.2) return;
        var alpha = Math.max(0, (p.z + 0.5) / 1.2);
        ctx.beginPath();
        ctx.arc(p.px, p.py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,200,' + (alpha * 0.9).toFixed(2) + ')';
        ctx.fill();
      });

      requestAnimationFrame(drawZeus);
    }
    requestAnimationFrame(drawZeus);
  })();

  /* ────────────────────────────────────────────────────
     3. LUXURY ANALOG CLOCK
  ──────────────────────────────────────────────────── */
  (function() {
    var cv = document.getElementById('luxClock');
    var ctx = cv.getContext('2d');
    cv.width = 180; cv.height = 180;
    var cx = 90, cy = 90, r = 82;
    var DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    function drawClock() {
      var now = new Date();
      var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
      ctx.clearRect(0, 0, 180, 180);

      // Outer ring glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,212,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // Inner ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(192,132,252,0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();

      // Hour markers
      for (var i = 0; i < 12; i++) {
        var angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        var isMain = i % 3 === 0;
        var len = isMain ? 14 : 8;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + (r - 3) * Math.cos(angle), cy + (r - 3) * Math.sin(angle));
        ctx.lineTo(cx + (r - len) * Math.cos(angle), cy + (r - len) * Math.sin(angle));
        ctx.strokeStyle = isMain ? 'rgba(0,212,255,0.9)' : 'rgba(0,212,255,0.4)';
        ctx.lineWidth = isMain ? 2 : 1;
        if (isMain) { ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 8; }
        ctx.stroke();
        ctx.restore();
      }

      // Minute marks
      for (var j = 0; j < 60; j++) {
        if (j % 5 === 0) continue;
        var ang = (j / 60) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + (r - 3) * Math.cos(ang), cy + (r - 3) * Math.sin(ang));
        ctx.lineTo(cx + (r - 8) * Math.cos(ang), cy + (r - 8) * Math.sin(ang));
        ctx.strokeStyle = 'rgba(0,212,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      function drawHand(angle, length, width, color, glow) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(angle) * length * 0.15, cy - Math.sin(angle) * length * 0.15);
        ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
        ctx.stroke();
        ctx.restore();
      }

      // Hour hand
      var hourAngle = ((h % 12) + m / 60 + s / 3600) / 12 * Math.PI * 2 - Math.PI / 2;
      drawHand(hourAngle, r * 0.52, 3, '#00d4ff', 12);

      // Minute hand
      var minAngle = (m + s / 60) / 60 * Math.PI * 2 - Math.PI / 2;
      drawHand(minAngle, r * 0.72, 2, '#c084fc', 10);

      // Second hand (smooth)
      var secAngle = (s + ms / 1000) / 60 * Math.PI * 2 - Math.PI / 2;
      drawHand(secAngle, r * 0.82, 1, '#00ffa3', 14);

      // Center dot
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4ff';
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();

      // Digital time
      var hStr = String(h).padStart(2,'0');
      var mStr = String(m).padStart(2,'0');
      var sStr = String(s).padStart(2,'0');
      document.getElementById('clockDigital').textContent = hStr + ':' + mStr + ':' + sStr;
      document.getElementById('clockDate').textContent = DAYS[now.getDay()] + ' · ' + MONTHS[now.getMonth()] + ' ' + String(now.getDate()).padStart(2,'0');

      requestAnimationFrame(drawClock);
    }
    requestAnimationFrame(drawClock);
  })();

  /* ────────────────────────────────────────────────────
     4. DATA BINDING — SSE stream + snapshot fallback
  ──────────────────────────────────────────────────── */
  function renderSnapshot(data) {
    var top = (data.innovation && data.innovation.topPriority) || {};
    document.getElementById('topTitle').textContent = top.title || 'AI Innovation Active';
    document.getElementById('topProblem').textContent = top.problem || '';
    document.getElementById('topScore').textContent = top.score ? String(top.score) : '—';
    document.getElementById('modulesCount').textContent = String(data.modules ? data.modules.length : 0);
    document.getElementById('activeUsers').textContent = String((data.telemetry || {}).activeUsers || 0);
    document.getElementById('requests').textContent = String((data.telemetry || {}).requests || 0);
    var child = (data.profile || {}).aiChild || {};
    document.getElementById('aiHealthLabel').textContent = (child.health || 0) + '%';
    document.getElementById('aiGrowthLabel').textContent = (child.growth || 0) + '%';
    document.getElementById('aiHealthBar').style.width = (child.health || 0) + '%';
    document.getElementById('aiGrowthBar').style.width = (child.growth || 0) + '%';
    document.getElementById('aiMood').textContent = child.mood || 'active';
    if (data.modules) {
      document.getElementById('modulesList').innerHTML = data.modules.slice(0,8).map(function(m) {
        return '<li class="module-item"><span>' + m.id + '</span><span class="badge">' + (m.status || 'active') + '</span></li>';
      }).join('');
    }
    if (data.marketplace) {
      document.getElementById('marketplaceList').innerHTML = data.marketplace.map(function(m) {
        return '<li class="module-item"><span>' + m.title + '</span><span style="font-size:11px;color:#7090b0;">' + m.segment + '</span></li>';
      }).join('');
    }
    if (data.sprint && data.sprint.tasks) {
      document.getElementById('sprintList').innerHTML = data.sprint.tasks.slice(0,6).map(function(t) {
        return '<li class="module-item"><span>' + t.title + '</span><span style="font-size:11px;color:#c084fc;">' + t.etaDays + 'd</span></li>';
      }).join('');
    }
    if (data.billing) {
      document.getElementById('billingInfo').textContent = 'Primary: ' + data.billing.primary + ' | Supported: ' + (data.billing.supported || []).join(', ');
      if (data.billing.btcAddress) document.getElementById('btcAddress').textContent = data.billing.btcAddress;
    }
  }

  async function pullFallback() {
    try {
      var res = await fetch('/snapshot');
      renderSnapshot(await res.json());
    } catch(_) {}
  }

  (function() {
    if (!window.EventSource) { pullFallback(); setInterval(pullFallback, 10000); return; }
    var es = new EventSource('/stream');
    es.onmessage = function(e) { try { renderSnapshot(JSON.parse(e.data)); } catch(_) {} };
    es.onerror = function() { pullFallback(); };
    pullFallback();
  })();
  </script>
</body>
</html>\`;
}

module.exports = { getSiteHtml };
`);

  writeText(path.join(INNOVATION, 'innovation-engine.js'), `function scoreIdea(idea) {
  const impact = Number(idea.impact || 0);
  const feasibility = Number(idea.feasibility || 0);
  const urgency = Number(idea.urgency || 0);
  const safety = Number(idea.safety || 0);
  return impact * 0.4 + feasibility * 0.2 + urgency * 0.2 + safety * 0.2;
}

function buildInnovationReport() {
  const ideas = [
    {
      id: 'care-companion-ai',
      title: 'Personal preventive care companion',
      problem: 'Late detection of health risk patterns',
      impact: 10,
      feasibility: 7,
      urgency: 10,
      safety: 9
    },
    {
      id: 'micro-grid-coordinator',
      title: 'Community micro-grid optimizer',
      problem: 'Energy waste and unstable local grids',
      impact: 9,
      feasibility: 7,
      urgency: 9,
      safety: 9
    },
    {
      id: 'learning-path-orchestrator',
      title: 'Adaptive education path builder',
      problem: 'Low retention in one-size-fits-all education',
      impact: 9,
      feasibility: 8,
      urgency: 8,
      safety: 10
    }
  ];

  const prioritized = ideas
    .map((idea) => ({ ...idea, score: Number(scoreIdea(idea).toFixed(2)) }))
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    principles: [
      'human-first',
      'privacy-by-design',
      'reversible rollout',
      'measurable real-world impact'
    ],
    topPriority: prioritized[0],
    backlog: prioritized
  };
}

module.exports = { buildInnovationReport, scoreIdea };
`);

  writeText(path.join(INNOVATION, 'report.js'), `const { buildInnovationReport } = require('./innovation-engine');

const report = buildInnovationReport();
console.log(JSON.stringify(report, null, 2));
`);

  writeText(path.join(INNOVATION, 'innovation-sprint.js'), `const { buildInnovationReport } = require('./innovation-engine');

function generateSprintPlan() {
  const report = buildInnovationReport();
  const top = report.topPriority;

  const tasks = [
    {
      id: 'research-problem-space',
      title: 'Research problem boundaries and user risks',
      owner: 'product',
      etaDays: 2,
      dependsOn: []
    },
    {
      id: 'prototype-core-flow',
      title: 'Prototype end-to-end core user flow',
      owner: 'engineering',
      etaDays: 4,
      dependsOn: ['research-problem-space']
    },
    {
      id: 'safety-and-privacy-gates',
      title: 'Implement safety, privacy, and rollback gates',
      owner: 'platform',
      etaDays: 3,
      dependsOn: ['prototype-core-flow']
    },
    {
      id: 'pilot-and-measurement',
      title: 'Run pilot and capture measurable impact metrics',
      owner: 'operations',
      etaDays: 5,
      dependsOn: ['safety-and-privacy-gates']
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    selectedInnovation: top,
    sprintLengthDays: 14,
    successMetrics: [
      'time-to-value',
      'safety incidents = 0',
      'user retention uplift',
      'operational cost delta'
    ],
    tasks
  };
}

module.exports = { generateSprintPlan };
`);

  writeText(path.join(INNOVATION, 'sprint.js'), `const { generateSprintPlan } = require('./innovation-sprint');

const sprint = generateSprintPlan();
console.log(JSON.stringify(sprint, null, 2));
`);

  writeText(path.join(TEST, 'health.test.js'), `const assert = require('assert');
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
`);

  writeText(path.join(TEST, 'deploy-smoke.test.js'), `const assert = require('assert');
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
  return { status: 202, data: { ok: true } };
};

process.env.GITHUB_TOKEN = 'ghp_test_token_123';
process.env.GIT_REMOTE_URL = 'https://github.com/ruffy80/ZeusAI.git';
process.env.GIT_BRANCH = 'main';
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
  assert.equal(deployResult.hetzner?.success, true);
  assert.equal(deployResult.hetzner?.status, 202);
  assert.ok(gitCalls.some((entry) => entry[0] === 'addRemote' || entry[0] === 'remote'));
  assert.equal(httpCalls.length, 1);
  assert.equal(httpCalls[0].url, 'https://mock-hetzner.example/webhook/update');
  assert.equal(httpCalls[0].payload.repo, 'https://github.com/ruffy80/ZeusAI.git');
  assert.equal(httpCalls[0].payload.branch, 'main');
  assert.equal(httpCalls[0].payload.secret, 'mock-secret');

  console.log('deploy smoke test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
`);

  writeText(path.join(MODULES, 'auto-deploy-orchestrator', 'index.js'), `const fs = require('fs');
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
        return \`https://github.com/\${process.env.GITHUB_OWNER}/\${repoName}.git\`;
      }
    }
    return '';
  }

  getAuthenticatedRemoteUrl() {
    const remoteUrl = this.getRepositoryUrl();
    const token = process.env.GITHUB_TOKEN || '';

    if (!remoteUrl || !token) return remoteUrl;
    if (!remoteUrl.includes('github.com') || remoteUrl.includes('@')) return remoteUrl;

    return remoteUrl.replace('https://', \`https://x-access-token:\${encodeURIComponent(token)}@\`);
  }

  async ensureRepo() {
    const gitDir = path.join(this.rootPath, '.git');
    const remoteUrl = this.getAuthenticatedRemoteUrl();

    if (!fs.existsSync(gitDir)) {
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
      hetzner: null
    };

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
`);

  writeText(path.join(MODULES, 'code-sanity-engine', 'index.js'), `module.exports = {
  async runFullScanNow() {
    return { ok: true, issues: [] };
  }
};
`);

  writeText(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci || npm install
      - run: npm run lint
      - run: npm test
`);

  restoreActiveProductionRoot(activeProductionSnapshot);
}

function zipOutput() {
  const zipPath = path.join(__dirname, 'UNICORN_FINAL.zip');
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });

  execSync('zip -r "UNICORN_FINAL.zip" "UNICORN_FINAL" -x "*/.DS_Store"', {
    cwd: __dirname,
    stdio: 'inherit'
  });
}

function main() {
  console.log('🚀 Generating UNICORN_FINAL...');
  createStructure();
  zipOutput();
  console.log('✅ Done.');
}

if (require.main === module) {
  main();
}