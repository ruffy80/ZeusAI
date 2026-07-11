// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.347Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

let Docker = null;
try { Docker = require('dockerode'); } catch (_) {}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'unicorn.db');

function timeoutFetch(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal, cache: 'no-store' })
    .finally(() => clearTimeout(t));
}

class HealthGuardian {
  constructor(opts = {}) {
    this.endpoints = Array.isArray(opts.endpoints) && opts.endpoints.length
      ? opts.endpoints
      : ['/health', '/api/social-orchestrator/status', '/api/profit-autopilot/status'];
    this.endpointBudgetMs = Number(process.env.SOCIAL_HEALTH_ENDPOINT_BUDGET_MS || 500);
    this.memWarnPct = Number(process.env.SOCIAL_HEALTH_MEM_WARN_PCT || 80);
    this.cpuWarnPct = Number(process.env.SOCIAL_HEALTH_CPU_WARN_PCT || 80);
    this.docker = Docker ? new Docker() : null;
  }

  async checkEndpoints(baseUrl) {
    const out = [];
    for (const ep of this.endpoints) {
      const t0 = Date.now();
      try {
        const r = await timeoutFetch(String(baseUrl || '').replace(/\/$/, '') + ep, this.endpointBudgetMs + 1000);
        const tookMs = Date.now() - t0;
        out.push({ endpoint: ep, ok: r.ok && tookMs <= this.endpointBudgetMs, status: r.status, tookMs });
      } catch (e) {
        out.push({ endpoint: ep, ok: false, status: 0, tookMs: Date.now() - t0, error: e && e.message ? e.message : String(e) });
      }
    }
    return out;
  }

  checkResources() {
    const total = os.totalmem() || 1;
    const free = os.freemem() || 0;
    const usedPct = ((total - free) / total) * 100;
    const cpus = Math.max(1, (os.cpus() || []).length);
    const cpuPct = Math.min(100, (os.loadavg()[0] / cpus) * 100);
    return {
      ok: usedPct < this.memWarnPct && cpuPct < this.cpuWarnPct,
      memoryUsedPct: Math.round(usedPct * 100) / 100,
      cpuLoadPct: Math.round(cpuPct * 100) / 100,
      thresholds: { memWarnPct: this.memWarnPct, cpuWarnPct: this.cpuWarnPct },
    };
  }

  checkDb() {
    try {
      const exists = fs.existsSync(DB_PATH);
      if (!exists) return { ok: false, exists, path: DB_PATH, reason: 'db_missing' };
      fs.accessSync(DB_PATH, fs.constants.R_OK | fs.constants.W_OK);
      return { ok: true, exists, path: DB_PATH };
    } catch (e) {
      return { ok: false, exists: true, path: DB_PATH, reason: e && e.message ? e.message : String(e) };
    }
  }

  async checkDocker() {
    if (!this.docker) return { ok: true, available: false, reason: 'dockerode_unavailable' };
    try {
      const containers = await Promise.race([
        this.docker.listContainers({ all: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('docker_timeout')), 3000)),
      ]);
      const down = containers.filter((c) => c.State !== 'running').map((c) => ({ id: c.Id.slice(0, 12), names: c.Names, state: c.State }));
      return { ok: down.length === 0, available: true, total: containers.length, down };
    } catch (e) {
      return { ok: false, available: true, reason: e && e.message ? e.message : String(e) };
    }
  }

  async runOnce(ctx = {}) {
    const startedAt = Date.now();
    const baseUrl = ctx.baseUrl || process.env.SOCIAL_HEALTH_BASE_URL || 'http://127.0.0.1:3000';
    const endpointChecks = await this.checkEndpoints(baseUrl);
    const resources = this.checkResources();
    const db = this.checkDb();
    const docker = await this.checkDocker();

    const failures = [];
    if (endpointChecks.some((x) => !x.ok)) failures.push('endpoint');
    if (!resources.ok) failures.push('resources');
    if (!db.ok) failures.push('db');
    if (!docker.ok) failures.push('docker');

    const actions = [];
    if (failures.length && !ctx.dryRun) {
      if (failures.includes('endpoint') && typeof ctx.restartModule === 'function') {
        actions.push(await ctx.restartModule('social-orchestrator'));
      }
      if (failures.includes('db') && typeof ctx.repairDb === 'function') {
        actions.push(await ctx.repairDb());
      }
      if (failures.includes('docker') && typeof ctx.recoverDocker === 'function') {
        actions.push(await ctx.recoverDocker());
      }
    }

    return {
      ok: failures.length === 0,
      dryRun: !!ctx.dryRun,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      tookMs: Date.now() - startedAt,
      checks: { endpoints: endpointChecks, resources, db, docker },
      failures,
      actions,
    };
  }
}

module.exports = HealthGuardian;
