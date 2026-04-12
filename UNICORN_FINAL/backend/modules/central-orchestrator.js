// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-12T15:41:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * CENTRAL ORCHESTRATOR
 *
 * Componenta 1 din sistemul autonom complet.
 * Monitorizează Vercel, Hetzner și GitHub, detectează erori,
 * ia decizii și reconstruiește pipeline-ul fără intervenție manuală.
 *
 * Responsabilități:
 *   1. Ping health endpoints pentru Vercel + Hetzner la fiecare POLL_MS
 *   2. Verifică starea DNS domeniului configurat
 *   3. Detectează build failures în GitHub Actions via API
 *   4. Loghează fiecare decizie cu reasoning complet (audit trail)
 *   5. Emite evenimente pe bus-ul intern pentru Self-Healing Engine
 *   6. Expune /api/orchestrator/* pentru monitoring extern
 */

'use strict';

const https = require('https');
const http  = require('http');
const dns   = require('dns').promises;
const { EventEmitter } = require('events');
const crypto = require('crypto');

const POLL_MS           = parseInt(process.env.ORCHESTRATOR_POLL_MS   || '60000',  10); // 1 min
const DNS_CHECK_MS      = parseInt(process.env.ORCHESTRATOR_DNS_MS    || '120000', 10); // 2 min
const GITHUB_POLL_MS    = parseInt(process.env.ORCHESTRATOR_GH_MS     || '300000', 10); // 5 min
const MAX_LOG           = 500;
const MAX_INCIDENTS     = 200;

// Env-driven targets — safe defaults for when not configured
const VERCEL_APP_URL    = process.env.PUBLIC_APP_URL       || process.env.VERCEL_URL || '';
const HETZNER_URL       = process.env.HETZNER_BACKEND_URL  || '';
const DOMAIN            = process.env.DOMAIN               || '';
const GITHUB_TOKEN      = process.env.GITHUB_TOKEN         || '';
const GITHUB_REPO       = process.env.GITHUB_REPOSITORY    || ''; // "owner/repo"

class CentralOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.startedAt    = Date.now();
    this.decisionLog  = [];
    this.incidents    = [];
    this.health       = {
      vercel:  { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
      hetzner: { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
      dns:     { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
      github:  { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
    };
    this._timers = [];
    this._running = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;

    // Stagger initial checks to avoid burst on startup
    this._schedule(() => this._checkVercel(),  2000);
    this._schedule(() => this._checkHetzner(), 3000);
    this._schedule(() => this._checkDNS(),     5000);
    this._schedule(() => this._checkGitHub(),  8000);

    // Recurring polls
    this._timers.push(setInterval(() => this._checkVercel(),  POLL_MS));
    this._timers.push(setInterval(() => this._checkHetzner(), POLL_MS));
    this._timers.push(setInterval(() => this._checkDNS(),     DNS_CHECK_MS));
    this._timers.push(setInterval(() => this._checkGitHub(),  GITHUB_POLL_MS));

    console.log('[Orchestrator] 🌐 Central Orchestrator started');
  }

  stop() {
    this._timers.forEach(t => clearInterval(t));
    this._timers = [];
    this._running = false;
  }

  _schedule(fn, delayMs) {
    const t = setTimeout(() => fn().catch(e => console.error('[Orchestrator] init check error:', e.message)), delayMs);
    this._timers.push(t);
  }

  // ── Probe: Vercel ─────────────────────────────────────────────────

  async _checkVercel() {
    const target = VERCEL_APP_URL ? `${VERCEL_APP_URL}/health` : null;
    if (!target) {
      this._updateHealth('vercel', 'unconfigured');
      return;
    }

    try {
      const code = await this._httpGet(target, 8000);
      if (code >= 200 && code < 400) {
        this._recover('vercel', `Vercel responded with HTTP ${code}`);
      } else {
        await this._fail('vercel', `Vercel health returned HTTP ${code}`, { target, code });
      }
    } catch (err) {
      await this._fail('vercel', `Vercel unreachable: ${err.message}`, { target });
    }
  }

  // ── Probe: Hetzner ────────────────────────────────────────────────

  async _checkHetzner() {
    const target = HETZNER_URL ? `${HETZNER_URL}/health` : null;
    if (!target) {
      this._updateHealth('hetzner', 'unconfigured');
      return;
    }

    try {
      const code = await this._httpGet(target, 8000);
      if (code >= 200 && code < 400) {
        this._recover('hetzner', `Hetzner responded with HTTP ${code}`);
      } else {
        await this._fail('hetzner', `Hetzner health returned HTTP ${code}`, { target, code });
      }
    } catch (err) {
      await this._fail('hetzner', `Hetzner unreachable: ${err.message}`, { target });
    }
  }

  // ── Probe: DNS ────────────────────────────────────────────────────

  async _checkDNS() {
    if (!DOMAIN) {
      this._updateHealth('dns', 'unconfigured');
      return;
    }

    try {
      const addresses = await dns.resolve4(DOMAIN);
      if (addresses && addresses.length > 0) {
        this._recover('dns', `DNS OK for ${DOMAIN}: ${addresses.join(', ')}`);
      } else {
        await this._fail('dns', `DNS resolved empty for ${DOMAIN}`, { domain: DOMAIN });
      }
    } catch (err) {
      await this._fail('dns', `DNS resolution failed for ${DOMAIN}: ${err.message}`, { domain: DOMAIN });
    }
  }

  // ── Probe: GitHub Actions ─────────────────────────────────────────

  async _checkGitHub() {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      this._updateHealth('github', 'unconfigured');
      return;
    }

    try {
      const [owner, repo] = GITHUB_REPO.split('/');
      if (!owner || !repo) {
        this._updateHealth('github', 'misconfigured');
        return;
      }

      const data = await this._githubGet(`/repos/${owner}/${repo}/actions/runs?per_page=5&status=completed`);
      if (!data || !data.workflow_runs) {
        this._updateHealth('github', 'unknown');
        return;
      }

      const failed = data.workflow_runs.filter(r => r.conclusion === 'failure');
      if (failed.length > 0) {
        const names = failed.map(r => r.name).join(', ');
        await this._fail('github', `${failed.length} recent workflow(s) failed: ${names}`, { runs: failed.map(r => r.id) });
      } else {
        this._recover('github', `GitHub Actions: last ${data.workflow_runs.length} runs OK`);
      }
    } catch (err) {
      await this._fail('github', `GitHub API error: ${err.message}`, {});
    }
  }

  // ── Health state machine ──────────────────────────────────────────

  _updateHealth(service, status) {
    this.health[service].status    = status;
    this.health[service].lastCheck = new Date().toISOString();
  }

  _recover(service, msg) {
    const prev = this.health[service].status;
    this.health[service].status               = 'healthy';
    this.health[service].lastCheck            = new Date().toISOString();
    this.health[service].consecutiveFailures  = 0;

    if (prev !== 'healthy') {
      this._log('RECOVER', service, msg);
      this.emit('service:recovered', { service, msg });
    }
  }

  async _fail(service, reason, meta = {}) {
    this.health[service].status    = 'degraded';
    this.health[service].lastCheck = new Date().toISOString();
    this.health[service].consecutiveFailures = (this.health[service].consecutiveFailures || 0) + 1;

    const incident = this._log('INCIDENT', service, reason, meta);
    this._addIncident({ ...incident, service });

    // Emit heal request — Self-Healing Engine listens for this
    this.emit('service:degraded', { service, reason, meta, failures: this.health[service].consecutiveFailures });

    // Escalate if repeated failures
    if (this.health[service].consecutiveFailures >= 3) {
      const escalation = `[ESCALATION] ${service} has failed ${this.health[service].consecutiveFailures} consecutive checks`;
      this._log('ESCALATE', service, escalation, meta);
      this.emit('service:escalated', { service, reason: escalation, failures: this.health[service].consecutiveFailures });
    }
  }

  // ── Decision log ──────────────────────────────────────────────────

  _log(action, service, reasoning, metadata = {}) {
    const entry = {
      id:        crypto.randomBytes(6).toString('hex'),
      ts:        new Date().toISOString(),
      agent:     'CentralOrchestrator',
      action,
      service,
      reasoning,
      metadata,
    };
    this.decisionLog.push(entry);
    if (this.decisionLog.length > MAX_LOG) this.decisionLog.shift();
    console.log(`[Orchestrator] [${action}] [${service}] ${reasoning}`);
    return entry;
  }

  _addIncident(entry) {
    this.incidents.push(entry);
    if (this.incidents.length > MAX_INCIDENTS) this.incidents.shift();
  }

  // ── HTTP helpers ──────────────────────────────────────────────────

  _httpGet(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const lib    = url.startsWith('https') ? https : http;
      const parsed = new URL(url);
      const opts   = {
        hostname: parsed.hostname,
        port:     parsed.port || (url.startsWith('https') ? 443 : 80),
        path:     parsed.pathname + (parsed.search || ''),
        method:   'GET',
        headers:  { 'User-Agent': 'UnicornOrchestrator/1.0' },
        timeout:  timeoutMs,
      };
      const req = lib.request(opts, (res) => resolve(res.statusCode));
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
      req.end();
    });
  }

  async _githubGet(path) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.github.com',
        path,
        method:  'GET',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent':    'UnicornOrchestrator/1.0',
          'Accept':        'application/vnd.github+json',
        },
        timeout: 10000,
      };
      let body = '';
      const req = https.request(opts, (res) => {
        res.on('data', d => { body += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('GitHub API timeout')); });
      req.on('error', reject);
      req.end();
    });
  }

  // ── Public API ────────────────────────────────────────────────────

  getStatus() {
    const overallHealthy = Object.values(this.health)
      .filter(h => h.status !== 'unconfigured' && h.status !== 'unknown')
      .every(h => h.status === 'healthy');

    return {
      status:    overallHealthy ? 'healthy' : 'degraded',
      running:   this._running,
      uptimeMs:  Date.now() - this.startedAt,
      services:  this.health,
      incidents: this.incidents.length,
      decisionCount: this.decisionLog.length,
    };
  }

  getDecisionLog(limit = 50) {
    return this.decisionLog.slice(-Math.min(limit, MAX_LOG));
  }

  getIncidents(limit = 50) {
    return this.incidents.slice(-Math.min(limit, MAX_INCIDENTS));
  }

  /** Force an immediate re-check of all services */
  async forceCheck() {
    await Promise.allSettled([
      this._checkVercel(),
      this._checkHetzner(),
      this._checkDNS(),
      this._checkGitHub(),
    ]);
    return this.getStatus();
  }
}

const orchestrator = new CentralOrchestrator();
module.exports = orchestrator;
module.exports.CentralOrchestrator = CentralOrchestrator;
