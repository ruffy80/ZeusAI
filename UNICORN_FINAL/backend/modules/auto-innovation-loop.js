// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-12T15:41:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * AUTO-INNOVATION LOOP
 *
 * Componenta 3 din sistemul autonom complet.
 * Analizează codul, propune îmbunătățiri, creează PR-uri automate,
 * testează, validează și integrează inovațiile în ciclu continuu.
 *
 * Responsabilități:
 *   1. Rulează ciclu de analiză cod la fiecare CYCLE_MS
 *   2. Generează propuneri de îmbunătățire via AI (UAIC/aiProviders)
 *   3. Crează branch-uri și pull-request-uri GitHub automat
 *   4. Monitorizează CI — promovează sau respinge PR-ul
 *   5. Rotește propunerile de inovație (max MAX_PENDING în paralel)
 *   6. Auto-merge dacă toate check-urile sunt verzi
 *   7. Expune /api/innovation-loop/* pentru control extern
 */

'use strict';

const https  = require('https');
const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');

const STATE_FILE = path.join(__dirname, '../../generated/innovation-state.json');

const CYCLE_MS      = parseInt(process.env.INNOV_CYCLE_MS     || '3600000',  10); // 1h
const PR_POLL_MS    = parseInt(process.env.INNOV_PR_POLL_MS   || '300000',   10); // 5 min
const MAX_PENDING   = parseInt(process.env.INNOV_MAX_PENDING  || '3',        10);
const MAX_LOOP_LOG  = 500;
const MAX_PROPOSALS = 100;
// Each proposal is stored in its own file under this directory.
// GitHub's Contents API creates parent directories automatically.
const INNOVATIONS_DIR = 'innovations';

// getGithubToken() și getGithubRepo() sunt citite din process.env la fiecare apel
// pentru a permite injectarea secretelor de către quantumVault la runtime
function getGithubToken() { return process.env.GITHUB_TOKEN      || ''; }
function getGithubRepo()  { return process.env.GITHUB_REPOSITORY || ''; }
const BASE_BRANCH   = process.env.INNOV_BASE_BRANCH || 'main';

// Innovation templates — each describes a category of improvement
const INNOVATION_CATEGORIES = [
  { type: 'performance', label: 'Performance Optimization',  priority: 'high'   },
  { type: 'security',    label: 'Security Hardening',        priority: 'high'   },
  { type: 'reliability', label: 'Reliability Improvement',   priority: 'high'   },
  { type: 'observability', label: 'Observability Enhancement', priority: 'medium' },
  { type: 'cost',        label: 'Cost Reduction',            priority: 'medium' },
  { type: 'dx',          label: 'Developer Experience',      priority: 'low'    },
  { type: 'feature',     label: 'New Feature Addition',      priority: 'low'    },
];

class AutoInnovationLoop {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000;
    this.startedAt    = Date.now();

    // Load persisted state so cycleCount and pendingPRs survive restarts
    const saved       = this._loadState();
    this.cycleCount   = saved.cycleCount  || 0;
    this.pendingPRs   = saved.pendingPRs  || [];   // PRs created, waiting for CI
    this.proposals    = [];   // all proposals generated (not persisted — recent only)
    this.mergedPRs    = [];   // successfully merged
    this.rejectedPRs  = [];   // CI failed or manually rejected
    this.loopLog      = [];

    this._cycleTimer  = null;
    this._prPollTimer = null;
    this._running     = false;
    this._aiModule    = null; // injected lazy
  }

  // ── State persistence ─────────────────────────────────────────────

  _loadState() {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  _saveState() {
    const dir = path.dirname(STATE_FILE);
    const data = JSON.stringify({ cycleCount: this.cycleCount, pendingPRs: this.pendingPRs });
    fs.promises.mkdir(dir, { recursive: true })
      .then(() => fs.promises.writeFile(STATE_FILE, data, 'utf8'))
      .catch(() => { /* non-fatal */ });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    if (process.env.DISABLE_SELF_MUTATION === '1') {
      console.log('[InnovLoop] disabled via DISABLE_SELF_MUTATION=1 (no PRs will be created)');
      return;
    }
    this._running = true;

    // First cycle after short delay
    setTimeout(() => this._runCycle().catch(e => this._log('CYCLE_ERROR', e.message)), 15000);

    this._cycleTimer  = setInterval(() => this._runCycle().catch(e => this._log('CYCLE_ERROR', e.message)), CYCLE_MS);
    this._prPollTimer = setInterval(() => this._pollPendingPRs().catch(e => this._log('POLL_ERROR', e.message)), PR_POLL_MS);

    console.log('[InnovLoop] 🔄 Auto-Innovation Loop started');
  }

  stop() {
    if (this._cycleTimer)  clearInterval(this._cycleTimer);
    if (this._prPollTimer) clearInterval(this._prPollTimer);
    this._cycleTimer  = null;
    this._prPollTimer = null;
    this._running     = false;
  }

  // ── Main cycle ────────────────────────────────────────────────────

  async _runCycle() {
    this.cycleCount++;
    this._saveState(); // persist immediately so restarts resume from the right count
    this._log('CYCLE_START', `Starting innovation cycle #${this.cycleCount}`);

    // Skip if too many pending PRs
    if (this.pendingPRs.length >= MAX_PENDING) {
      this._log('CYCLE_THROTTLE', `${this.pendingPRs.length} PRs pending — skipping new proposals`);
      return;
    }

    // 1. Analyze codebase metrics
    const metrics = await this._analyzeCodebase();
    this._log('ANALYSIS_DONE', `Codebase analysis: ${JSON.stringify(metrics)}`);

    // 2. Pick innovation category based on metrics
    const category = this._selectCategory(metrics);
    this._log('CATEGORY_SELECTED', `Selected innovation category: ${category.label} (${category.type})`);

    // 3. Skip if an open PR for this category already exists (deduplication)
    if (getGithubToken() && getGithubRepo()) {
      const duplicate = await this._findOpenPRForCategory(category.type);
      if (duplicate) {
        this._log('PR_DUPLICATE', `Open PR #${duplicate.number} already exists for category "${category.type}" — skipping cycle`);
        return;
      }
    }

    // 4. Generate proposal via AI
    const proposal = await this._generateProposal(category, metrics);
    this._addProposal(proposal);
    this._log('PROPOSAL_GENERATED', `Proposal: ${proposal.title}`);

    // 5. Create GitHub PR (if credentials available)
    if (getGithubToken() && getGithubRepo()) {
      await this._createPR(proposal);
    } else {
      this._log('PR_SKIP', 'GITHUB_TOKEN or GITHUB_REPOSITORY not configured — PR creation skipped');
    }

    this._log('CYCLE_DONE', `Innovation cycle #${this.cycleCount} completed`);
  }

  // ── Codebase analysis ─────────────────────────────────────────────

  async _analyzeCodebase() {
    const root = path.join(__dirname, '../../');
    const metrics = {
      fileCount:      0,
      moduleCount:    0,
      testCoverage:   'unknown',
      openIssues:     0,
      failedBuilds:   0,
      securityAlerts: 0,
    };

    try {
      const backendModules = path.join(root, 'backend/modules');
      if (fs.existsSync(backendModules)) {
        metrics.moduleCount = fs.readdirSync(backendModules).length;
      }

      const testDir = path.join(root, 'test');
      if (fs.existsSync(testDir)) {
        metrics.fileCount = fs.readdirSync(testDir).length;
      }
    } catch {
      // non-fatal — partial metrics ok
    }

    // Fetch open GitHub issues count
    if (getGithubToken() && getGithubRepo()) {
      try {
        const [owner, repo] = getGithubRepo().split('/');
        const data = await this._githubGet(`/repos/${owner}/${repo}/issues?state=open&per_page=1`);
        if (Array.isArray(data)) {
          metrics.openIssues = data.length; // approximation (1 page only)
        }
      } catch { /* non-fatal */ }
    }

    return metrics;
  }

  // ── Category selection ────────────────────────────────────────────

  _selectCategory(metrics) {
    // Simple heuristic: rotate through high-priority categories
    const highPrio = INNOVATION_CATEGORIES.filter(c => c.priority === 'high');
    const idx = this.cycleCount % highPrio.length;
    return highPrio[idx];
  }

  // ── Proposal generation ───────────────────────────────────────────

  async _generateProposal(category, metrics) {
    const id = crypto.randomBytes(6).toString('hex');
    const ts = new Date().toISOString();

    // Try AI generation first
    let description = '';
    let aiUsed = false;

    const ai = this._getAI();
    if (ai) {
      try {
        const prompt = [
          `You are the Auto-Innovation Loop for a Node.js autonomous SaaS platform.`,
          `Category: ${category.label} (${category.type})`,
          `Current metrics: ${JSON.stringify(metrics)}`,
          `Generate a concise improvement proposal (max 5 sentences):`,
          `1. What to improve`,
          `2. How to implement it`,
          `3. Expected impact`,
        ].join('\n');

        const result = await ai.ask(prompt);
        if (result && result.text) {
          description = result.text.slice(0, 1000);
          aiUsed = true;
        }
      } catch { /* fallback to template */ }
    }

    if (!description) {
      description = this._templateProposal(category, metrics);
    }

    return {
      id,
      ts,
      cycleId:     this.cycleCount,
      category:    category.type,
      title:       `[AutoInnovation] ${category.label} — cycle #${this.cycleCount}`,
      description,
      aiGenerated: aiUsed,
      status:      'proposed',
      prNumber:    null,
      prUrl:       null,
    };
  }

  _templateProposal(category, metrics) {
    const templates = {
      performance:   `Reduce API response times by adding in-memory caching for frequent read endpoints. Profile the top-5 slowest routes and introduce LRU cache with TTL=60s. Expected impact: 30-50% latency reduction.`,
      security:      `Add input validation and sanitization to all POST/PUT endpoints that currently lack it. Introduce Helmet.js headers update and review CORS policy. Expected impact: eliminates injection attack surface.`,
      reliability:   `Add health-check watchdog that restarts degraded services and implements exponential back-off retry on external API calls. Expected impact: 99.9% uptime target achievable.`,
      observability: `Integrate structured JSON logging with request-id correlation across all modules. Add /api/metrics Prometheus endpoint. Expected impact: faster root-cause analysis.`,
      cost:          `Identify and remove unused npm dependencies. Optimize Docker image layers for build cache reuse. Expected impact: 20% reduction in build time and storage cost.`,
      dx:            `Add TypeScript type definitions for all public module APIs. Document all /api/* endpoints with OpenAPI 3.0 spec. Expected impact: faster onboarding.`,
      feature:       `Implement webhook notification system for key platform events (new user, payment, deploy). Expected impact: integrations with Slack/Discord/email.`,
    };
    return templates[category.type] || `Improve ${category.label} through automated analysis and refactoring.`;
  }

  // ── GitHub PR creation ────────────────────────────────────────────

  async _createPR(proposal) {
    if (!getGithubToken() || !getGithubRepo()) return;

    const [owner, repo] = getGithubRepo().split('/');
    if (!owner || !repo) return;

    const branchName = `auto-innovation/${proposal.category}-${proposal.id}`;

    try {
      // 1. Get base branch SHA
      const baseRef = await this._githubGet(`/repos/${owner}/${repo}/git/ref/heads/${BASE_BRANCH}`);
      if (!baseRef || !baseRef.object) {
        this._log('PR_FAIL', `Cannot get base branch SHA for ${BASE_BRANCH}`);
        return;
      }
      const baseSha = baseRef.object.sha;

      // 2. Create new branch
      await this._githubPost(`/repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      // 3. Create a unique per-proposal file to avoid merge conflicts with main.
      // Each PR writes to innovations/<category>-<id>.md — a brand-new file that
      // does not exist on any other branch, so conflicts are structurally impossible.
      const proposalFilePath = `${INNOVATIONS_DIR}/${proposal.category}-${proposal.id}.md`;
      const logContent = [
        `# Auto-Innovation Proposal`,
        ``,
        `**ID:** ${proposal.id}`,
        `**Category:** ${proposal.category}`,
        `**Generated:** ${proposal.ts}`,
        `**AI Generated:** ${proposal.aiGenerated}`,
        ``,
        `## Description`,
        ``,
        proposal.description,
        ``,
        `## Metrics at Generation Time`,
        ``,
        `Cycle: #${proposal.cycleId}`,
      ].join('\n');

      const fileBody = {
        message: proposal.title,
        content: Buffer.from(logContent).toString('base64'),
        branch:  branchName,
      };

      await this._githubPut(`/repos/${owner}/${repo}/contents/${proposalFilePath}`, fileBody);

      // 4. Open PR
      const prBody = {
        title: proposal.title,
        body:  [
          `## Auto-Innovation Proposal`,
          ``,
          `**Category:** ${proposal.category}`,
          `**Generated by:** Auto-Innovation Loop (cycle #${proposal.cycleId})`,
          `**AI Generated:** ${proposal.aiGenerated}`,
          ``,
          `### Description`,
          ``,
          proposal.description,
          ``,
          `---`,
          `*This PR was automatically generated. Review before merging.*`,
        ].join('\n'),
        head:               branchName,
        base:               BASE_BRANCH,
        maintainer_can_modify: true,
      };

      const pr = await this._githubPost(`/repos/${owner}/${repo}/pulls`, prBody);

      if (pr && pr.number) {
        proposal.prNumber = pr.number;
        proposal.prUrl    = pr.html_url;
        proposal.status   = 'pr_open';
        this.pendingPRs.push({ ...proposal, prNumber: pr.number, branchName, createdAt: Date.now() });
        this._saveState();
        this._log('PR_CREATED', `PR #${pr.number} created: ${pr.html_url}`);
      }
    } catch (err) {
      this._log('PR_ERROR', `Failed to create PR for proposal ${proposal.id}: ${err.message}`);
    }
  }

  // ── PR monitoring ─────────────────────────────────────────────────

  async _pollPendingPRs() {
    if (!getGithubToken() || !getGithubRepo() || this.pendingPRs.length === 0) return;

    const [owner, repo] = getGithubRepo().split('/');
    const toRemove = [];

    for (const pr of this.pendingPRs) {
      try {
        const data = await this._githubGet(`/repos/${owner}/${repo}/pulls/${pr.prNumber}`);
        if (!data) continue;

        if (data.state === 'closed') {
          if (data.merged) {
            this._log('PR_MERGED', `PR #${pr.prNumber} merged successfully`);
            this.mergedPRs.push({ ...pr, mergedAt: new Date().toISOString() });
          } else {
            this._log('PR_CLOSED', `PR #${pr.prNumber} closed without merge`);
            this.rejectedPRs.push({ ...pr, closedAt: new Date().toISOString() });
          }
          toRemove.push(pr.prNumber);
          continue;
        }

        // Check CI status
        const checks = await this._githubGet(`/repos/${owner}/${repo}/commits/${data.head.sha}/check-runs`);
        if (!checks || !checks.check_runs) continue;

        const allPassed = checks.check_runs.length > 0 &&
          checks.check_runs.every(c => c.status === 'completed' && c.conclusion === 'success');
        const anyFailed = checks.check_runs.some(c => c.status === 'completed' && c.conclusion === 'failure');

        if (allPassed) {
          this._log('PR_CI_PASS', `PR #${pr.prNumber} — all checks passed. Attempting auto-merge.`);
          await this._autoMerge(owner, repo, pr.prNumber);
          toRemove.push(pr.prNumber);
        } else if (anyFailed) {
          this._log('PR_CI_FAIL', `PR #${pr.prNumber} — CI failed. Closing PR.`);
          await this._closePR(owner, repo, pr.prNumber, 'CI checks failed — auto-closed by Auto-Innovation Loop');
          this.rejectedPRs.push({ ...pr, closedAt: new Date().toISOString(), reason: 'CI failure' });
          toRemove.push(pr.prNumber);
        }
      } catch (err) {
        this._log('PR_POLL_ERROR', `Error polling PR #${pr.prNumber}: ${err.message}`);
      }
    }

    this.pendingPRs = this.pendingPRs.filter(p => !toRemove.includes(p.prNumber));
    if (toRemove.length > 0) this._saveState();
  }

  async _autoMerge(owner, repo, prNumber) {
    try {
      await this._githubPut(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
        merge_method: 'squash',
        commit_title: `[AutoInnovation] Auto-merged PR #${prNumber}`,
      });
      this._log('AUTO_MERGE_OK', `PR #${prNumber} auto-merged`);
      const pr = this.pendingPRs.find(p => p.prNumber === prNumber);
      if (pr) this.mergedPRs.push({ ...pr, mergedAt: new Date().toISOString() });
    } catch (err) {
      this._log('AUTO_MERGE_FAIL', `Auto-merge PR #${prNumber} failed: ${err.message}`);
    }
  }

  async _closePR(owner, repo, prNumber, reason) {
    try {
      await this._githubPost(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, { body: reason });
      await this._githubPatch(`/repos/${owner}/${repo}/pulls/${prNumber}`, { state: 'closed' });
    } catch { /* non-fatal */ }
  }

  /** Returns the first open PR whose head branch matches this category, or null. */
  async _findOpenPRForCategory(categoryType) {
    try {
      const [owner, repo] = getGithubRepo().split('/');
      const prefix = `auto-innovation/${categoryType}-`;
      let page = 1;
      while (page <= 3) {
        const prs = await this._githubGet(
          `/repos/${owner}/${repo}/pulls?state=open&base=${BASE_BRANCH}&per_page=50&page=${page}`
        );
        if (!Array.isArray(prs) || prs.length === 0) break;
        const found = prs.find(p => p.head && p.head.ref && p.head.ref.startsWith(prefix));
        if (found) return found;
        if (prs.length < 50) break;
        page++;
      }
    } catch { /* non-fatal */ }
    return null;
  }

  // ── Proposal store ────────────────────────────────────────────────

  _addProposal(proposal) {
    this.proposals.push(proposal);
    if (this.proposals.length > MAX_PROPOSALS) this.proposals.shift();
  }

  // ── GitHub API helpers ────────────────────────────────────────────

  _githubRequest(method, path, body) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          'Authorization':   `Bearer ${getGithubToken()}`,
          'User-Agent':      'UnicornAutoInnovation/1.0',
          'Accept':          'application/vnd.github+json',
          'Content-Type':    'application/json',
          'Content-Length':  payload ? Buffer.byteLength(payload) : 0,
        },
        timeout: 15000,
      };
      let respBody = '';
      const req = https.request(opts, (res) => {
        res.on('data', d => { respBody += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(respBody)); } catch { resolve(null); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('GitHub API timeout')); });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  _githubGet(path)           { return this._githubRequest('GET',   path, null);  }
  _githubPost(path, body)    { return this._githubRequest('POST',  path, body);  }
  _githubPut(path, body)     { return this._githubRequest('PUT',   path, body);  }
  _githubPatch(path, body)   { return this._githubRequest('PATCH', path, body);  }

  // ── AI lazy-load ──────────────────────────────────────────────────

  _getAI() {
    if (this._aiModule !== undefined) return this._aiModule;
    try {
      this._aiModule = require('./universal-ai-connector');
    } catch {
      try {
        this._aiModule = require('./universalAIConnector');
      } catch {
        try {
          this._aiModule = require('./aiProviders');
        } catch {
          this._aiModule = null;
        }
      }
    }
    return this._aiModule;
  }

  // ── Decision log ──────────────────────────────────────────────────

  _log(action, reasoning) {
    const entry = {
      id:        crypto.randomBytes(6).toString('hex'),
      ts:        new Date().toISOString(),
      agent:     'AutoInnovationLoop',
      action,
      reasoning,
    };
    this.loopLog.push(entry);
    if (this.loopLog.length > MAX_LOOP_LOG) this.loopLog.shift();
    console.log(`[InnovLoop] [${action}] ${reasoning}`);
    return entry;
  }

  // ── Public API ────────────────────────────────────────────────────

  getStatus() {
    return {
      running:      this._running,
      uptimeMs:     Date.now() - this.startedAt,
      cycleCount:   this.cycleCount,
      proposals:    this.proposals.length,
      pendingPRs:   this.pendingPRs.length,
      mergedPRs:    this.mergedPRs.length,
      rejectedPRs:  this.rejectedPRs.length,
      logCount:     this.loopLog.length,
      githubEnabled: !!(getGithubToken() && getGithubRepo()),
    };
  }

  getProposals(limit = 20) {
    return this.proposals.slice(-Math.min(limit, MAX_PROPOSALS));
  }

  getPendingPRs() {
    return [...this.pendingPRs];
  }

  getMergedPRs(limit = 20) {
    return this.mergedPRs.slice(-limit);
  }

  getLog(limit = 50) {
    return this.loopLog.slice(-Math.min(limit, MAX_LOOP_LOG));
  }

  /** Trigger an immediate innovation cycle */
  async triggerCycle() {
    return this._runCycle();
  }
}

const innovationLoop = new AutoInnovationLoop();
module.exports = innovationLoop;
module.exports.AutoInnovationLoop = AutoInnovationLoop;
