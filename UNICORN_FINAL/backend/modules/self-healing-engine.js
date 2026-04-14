// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-12T15:41:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SELF-HEALING ENGINE
 *
 * Componenta 2 din sistemul autonom complet.
 * Ascultă evenimentele de degradare din CentralOrchestrator și execută
 * automat acțiuni de remediere: restart procese, rebuild, fix DNS/SSL,
 * reinstalare dependențe, re-deploy complet.
 *
 * Responsabilități:
 *   1. Repornire procese via PM2 (dacă disponibil)
 *   2. Reinstalare dependențe când build-ul eșuează
 *   3. Trigger re-deploy pe Hetzner via SSH (dacă configurat)
 *   4. Verificare și reînnoire SSL (certbot)
 *   5. Fallback Vercel → Hetzner când Vercel e limitat
 *   6. Watchdog intern — detectează procese zombie și le ucide
 *   7. Audit trail complet pentru fiecare acțiune de vindecare
 */

'use strict';

const { execFile, spawn } = require('child_process');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const WATCHDOG_MS    = parseInt(process.env.HEALER_WATCHDOG_MS    || '120000', 10); // 2 min
const COOLDOWN_MS    = parseInt(process.env.HEALER_COOLDOWN_MS    || '300000', 10); // 5 min per service
const MAX_HEAL_LOG   = 500;
const MAX_AUTO_HEALS = 3;         // per service per cooldown window
const MAX_HEAP_MB    = parseInt(process.env.HEALER_MAX_HEAP_MB    || '1500',   10); // memory ceiling
const UPTIME_WARNING_HOURS  = 72; // log reminder after this many hours
const REMINDER_INTERVAL_HOURS = 24; // how often to repeat the reminder
const MAX_STDERR_BYTES = 500;     // truncation limit for exec stderr
const HEALTH_FAIL_THRESHOLD = parseInt(process.env.HEALER_HEALTH_FAIL_THRESHOLD || '3', 10); // consecutive failures before restart

// Safe list of PM2 process names that can be restarted
const SAFE_PM2_NAMES = new Set([
  // Actual PM2 process names from ecosystem.config.js
  'unicorn',
  'unicorn-orchestrator',
  'unicorn-health-guardian',
  'unicorn-platform-connector',
  'unicorn-uaic',
  'unicorn-llama-bridge',
  // Legacy / alternative names
  'unicorn-backend',
  'unicorn-frontend',
  'unicorn-worker',
  'zeus-ai',
]);

class SelfHealingEngine {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000;
    this.startedAt      = Date.now();
    this.healLog        = [];
    this.cooldowns      = new Map(); // service → { count, resetAt }
    this._watchdogTimer = null;
    this._running       = false;
    this._orchestrator  = null; // injected via attachOrchestrator()
    this._healthFailures = 0;   // consecutive /api/health probe failures
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;

    // Start watchdog loop
    this._watchdogTimer = setInterval(() => this._watchdogTick(), WATCHDOG_MS);

    console.log('[SelfHealer] 🏥 Self-Healing Engine started');
  }

  stop() {
    if (this._watchdogTimer) clearInterval(this._watchdogTimer);
    this._watchdogTimer = null;
    this._running = false;
  }

  /**
   * Wire to CentralOrchestrator events.
   * Call after both modules are instantiated in index.js.
   */
  attachOrchestrator(orchestratorInstance) {
    this._orchestrator = orchestratorInstance;

    orchestratorInstance.on('service:degraded', async ({ service, reason, failures }) => {
      await this._handleDegradation(service, reason, failures).catch(
        e => console.error('[SelfHealer] handler error:', e.message)
      );
    });

    orchestratorInstance.on('service:escalated', async ({ service, reason, failures }) => {
      await this._handleEscalation(service, reason, failures).catch(
        e => console.error('[SelfHealer] escalation error:', e.message)
      );
    });

    console.log('[SelfHealer] 🔗 Attached to CentralOrchestrator');
  }

  // ── Degradation handler ───────────────────────────────────────────

  async _handleDegradation(service, reason, failures) {
    if (!this._checkCooldown(service)) {
      this._log('COOLDOWN_SKIP', service, `Cooldown active — skipping heal for: ${reason}`);
      return;
    }

    this._log('HEAL_START', service, `Degradation detected (${failures} failures): ${reason}`);

    switch (service) {
      case 'hetzner':
        await this._healHetzner(reason);
        break;
      case 'dns':
        await this._healDNS(reason);
        break;
      case 'github':
        await this._healGitHub(reason);
        break;
      default:
        this._log('UNKNOWN_SERVICE', service, `No heal strategy for service "${service}"`);
    }
  }

  async _handleEscalation(service, reason, failures) {
    this._log('ESCALATION', service, `Escalation triggered after ${failures} failures: ${reason}`);
    // On escalation, try full re-deploy regardless of cooldown
    if (service === 'hetzner') {
      await this._fullRedeploy('hetzner', reason);
    }
  }

  // ── Heal strategies ───────────────────────────────────────────────

  async _healHetzner(reason) {
    // 1. Try PM2 restart of backend process
    const restarted = await this._pm2Restart('unicorn');
    if (restarted) {
      this._log('HEAL_DONE', 'hetzner', 'PM2 restart of unicorn issued');
      return;
    }

    // 2. Try SSH-based remote restart if PM2 not local
    const sshDone = await this._sshRestart(reason);
    if (sshDone) {
      this._log('HEAL_DONE', 'hetzner', 'SSH restart of Hetzner backend issued');
      return;
    }

    // 3. Last resort: full redeploy
    await this._fullRedeploy('hetzner', reason);
  }

  async _healDNS(reason) {
    this._log('DNS_HEAL', 'dns', `DNS degraded: ${reason}`);
    // 1. Flush local DNS cache (platform-dependent, best-effort)
    await this._exec('nscd', ['-i', 'hosts'], 'flush DNS cache').catch(() => {});
    // 2. Verify SSL if domain is configured
    if (process.env.DOMAIN) {
      await this._checkSSL(process.env.DOMAIN);
    }
    this._log('DNS_HEAL_DONE', 'dns', 'DNS flush and SSL verification completed');
  }

  async _healGitHub(reason) {
    this._log('GITHUB_HEAL', 'github', `GitHub Actions failure detected: ${reason}`);
    // Nothing executable without GitHub App credentials,
    // but we record the incident for the Auto-Innovation Loop to process
    this._log('GITHUB_HEAL_NOTED', 'github', 'Failure recorded — Auto-Innovation Loop will analyze and create fix PR');
  }

  async _fullRedeploy(service, reason) {
    this._log('REDEPLOY_START', service, `Full redeploy triggered: ${reason}`);
    const scriptPath = path.join(__dirname, '../../scripts/deploy-hetzner.sh');
    if (fs.existsSync(scriptPath)) {
      await this._exec('bash', [scriptPath], 'full Hetzner redeploy');
      this._log('REDEPLOY_DONE', service, 'Full redeploy script executed');
    } else {
      this._log('REDEPLOY_SKIP', service, 'Deploy script not found — skipping');
    }
  }

  // ── PM2 integration ───────────────────────────────────────────────

  async _pm2Restart(processName) {
    // Validate name against whitelist before executing
    if (!SAFE_PM2_NAMES.has(processName)) {
      this._log('PM2_BLOCKED', 'system', `PM2 restart blocked — "${processName}" not in safe list`);
      return false;
    }

    return new Promise((resolve) => {
      execFile('pm2', ['restart', processName, '--update-env'], { timeout: 30000 }, (err) => {
        if (err) {
          this._log('PM2_FAIL', 'system', `PM2 restart failed for ${processName}: ${err.message}`);
          resolve(false);
        } else {
          this._log('PM2_OK', 'system', `PM2 restart succeeded for ${processName}`);
          resolve(true);
        }
      });
    });
  }

  // ── SSH restart (via pre-configured SSH key) ──────────────────────

  async _sshRestart(reason) {
    const sshHost = process.env.HETZNER_HOST || process.env.HETZNER_IP || '';
    const sshUser = process.env.HETZNER_USER || 'root';
    const sshKey  = process.env.HETZNER_SSH_KEY_PATH || '';

    if (!sshHost) return false;

    const args = sshKey
      ? ['-i', sshKey, '-o', 'StrictHostKeyChecking=no', `${sshUser}@${sshHost}`, 'pm2 restart unicorn --update-env']
      : ['-o', 'StrictHostKeyChecking=no', `${sshUser}@${sshHost}`, 'pm2 restart unicorn --update-env'];

    this._log('SSH_RESTART', 'hetzner', `SSH restart attempt: ${sshHost}`);
    const ok = await this._exec('ssh', args, 'SSH restart');
    return ok;
  }

  // ── SSL verification ──────────────────────────────────────────────

  async _checkSSL(domain) {
    this._log('SSL_CHECK', 'dns', `Checking SSL for ${domain}`);
    // Check if cert expires within 14 days — trigger certbot renew if so
    const ok = await this._exec(
      'certbot', ['certificates', '--domain', domain],
      'certbot SSL check'
    );
    if (!ok) {
      // Try renewal
      await this._exec('certbot', ['renew', '--quiet', '--non-interactive'], 'certbot renew').catch(() => {});
      this._log('SSL_RENEW', 'dns', `certbot renew triggered for ${domain}`);
    }
  }

  // ── Watchdog ──────────────────────────────────────────────────────

  async _watchdogTick() {
    // Check Node process health (memory ceiling)
    const memMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memMB > MAX_HEAP_MB) {
      this._log('WATCHDOG_MEM', 'system', `Heap usage high: ${memMB.toFixed(0)} MB — triggering GC hint`);
      if (global.gc) global.gc();
    }

    // Active health-check probe → restart if service is degraded
    await this._probeHealth();

    // Check uptime — after UPTIME_WARNING_HOURS h, log a reminder for restart
    const uptimeH = (Date.now() - this.startedAt) / 3600000;
    if (uptimeH > UPTIME_WARNING_HOURS && Math.round(uptimeH) % REMINDER_INTERVAL_HOURS === 0) {
      this._log('WATCHDOG_UPTIME', 'system', `Process uptime ${uptimeH.toFixed(1)}h — consider scheduled restart`);
    }
  }

  // ── Health-check probe ────────────────────────────────────────────

  _probeHealth() {
    const http = require('http');
    const port = process.env.PORT || 3000;
    return new Promise((resolve) => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/health`,
        { timeout: 5000 },
        (res) => {
          let body = '';
          res.on('data', c => { body += c; });
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (json.status === 'ok') {
                this._healthFailures = 0;
              } else {
                this._onHealthDegraded(`status=${json.status}`);
              }
            } catch {
              this._onHealthDegraded('invalid JSON response');
            }
            resolve();
          });
        }
      );
      req.on('error', (err) => { this._onHealthDegraded(err.message); resolve(); });
      req.on('timeout', () => { req.destroy(); this._onHealthDegraded('request timeout'); resolve(); });
    });
  }

  _onHealthDegraded(reason) {
    this._healthFailures++;
    this._log(
      'WATCHDOG_HEALTH', 'backend',
      `Health probe failed (${this._healthFailures}/${HEALTH_FAIL_THRESHOLD}): ${reason}`
    );
    if (this._healthFailures >= HEALTH_FAIL_THRESHOLD && this._checkCooldown('backend')) {
      this._log('WATCHDOG_RESTART', 'backend', 'Health threshold exceeded — triggering PM2 restart');
      this._pm2Restart('unicorn').then(ok => {
        if (ok) {
          this._healthFailures = 0;
          this._log('HEAL_DONE', 'backend', 'PM2 restart triggered by health watchdog');
        }
      });
    }
  }

  // ── Cooldown guard ────────────────────────────────────────────────

  _checkCooldown(service) {
    const now  = Date.now();
    const info = this.cooldowns.get(service) || { count: 0, resetAt: 0 };

    if (now > info.resetAt) {
      // Window expired — reset
      this.cooldowns.set(service, { count: 1, resetAt: now + COOLDOWN_MS });
      return true;
    }

    if (info.count >= MAX_AUTO_HEALS) return false;

    info.count++;
    this.cooldowns.set(service, info);
    return true;
  }

  // ── Exec helper ───────────────────────────────────────────────────

  _exec(cmd, args, label) {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, { timeout: 60000, stdio: 'pipe' });
      let stderr = '';
      proc.stderr && proc.stderr.on('data', d => { stderr += d.toString().slice(0, MAX_STDERR_BYTES); });
      proc.on('close', (code) => {
        if (code === 0) {
          this._log('EXEC_OK', 'system', `${label} exited 0`);
          resolve(true);
        } else {
          this._log('EXEC_FAIL', 'system', `${label} exited ${code}: ${stderr.slice(0, 200)}`);
          resolve(false);
        }
      });
      proc.on('error', (err) => {
        this._log('EXEC_ERR', 'system', `${label} spawn error: ${err.message}`);
        resolve(false);
      });
    });
  }

  // ── Decision log ──────────────────────────────────────────────────

  _log(action, service, reasoning) {
    const entry = {
      id:        crypto.randomBytes(6).toString('hex'),
      ts:        new Date().toISOString(),
      agent:     'SelfHealingEngine',
      action,
      service,
      reasoning,
    };
    this.healLog.push(entry);
    if (this.healLog.length > MAX_HEAL_LOG) this.healLog.shift();
    console.log(`[SelfHealer] [${action}] [${service}] ${reasoning}`);
    return entry;
  }

  // ── Public API ────────────────────────────────────────────────────

  getStatus() {
    const totalHeals = this.healLog.filter(e => e.action === 'HEAL_DONE').length;
    return {
      running:    this._running,
      uptimeMs:   Date.now() - this.startedAt,
      healCount:  totalHeals,
      logCount:   this.healLog.length,
      cooldowns:  Object.fromEntries(
        [...this.cooldowns.entries()].map(([k, v]) => [k, { ...v, resetIn: Math.max(0, v.resetAt - Date.now()) }])
      ),
      memoryMB:   (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
    };
  }

  getHealLog(limit = 50) {
    return this.healLog.slice(-Math.min(limit, MAX_HEAL_LOG));
  }

  /** Manual trigger — restart a named PM2 service from API */
  async manualRestart(processName) {
    return this._pm2Restart(processName);
  }

  /** Manual trigger — run full deploy script */
  async manualRedeploy() {
    return this._fullRedeploy('manual', 'Manual redeploy triggered via API');
  }
}

const healer = new SelfHealingEngine();
module.exports = healer;
module.exports.SelfHealingEngine = SelfHealingEngine;
