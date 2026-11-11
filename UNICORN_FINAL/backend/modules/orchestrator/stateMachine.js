'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATES = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  DEGRADED: 'DEGRADED',
  QUARANTINED: 'QUARANTINED',
  RECOVERING: 'RECOVERING',
  DISABLED: 'DISABLED',
});

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

class CapabilityStateMachine extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.cooldownMs = Number(opts.cooldownMs || opts.quarantineMs || process.env.ORCHESTRATOR_QUARANTINE_MS || DEFAULT_COOLDOWN_MS);
    this.auditFile = opts.auditFile || path.join(process.env.ZEUS_STATE_DIR || '/opt/zeusai/state', 'capability-state-audit.jsonl');
    this.persistPostgres = opts.persistPostgres !== undefined
      ? Boolean(opts.persistPostgres)
      : (process.env.NODE_ENV !== 'test' || process.env.FORCE_POSTGRES_STATE === '1');
    this.records = new Map();
    this.transitions = [];
  }

  getState(capabilityId) {
    const rec = this.records.get(capabilityId);
    return rec ? rec.state : null;
  }

  ensureCapability(capabilityId, moduleName = 'orchestrator') {
    if (!this.records.has(capabilityId)) {
      const rec = {
        capability_id: capabilityId,
        module_name: moduleName,
        state: STATES.IDLE,
        previous_state: STATES.IDLE,
        consecutive_failures: 0,
        last_success_at: null,
        last_error_at: null,
        last_error: null,
        quarantined_until: null,
        updated_at: new Date().toISOString(),
      };
      this.records.set(capabilityId, rec);
      this._persistRecord(rec);
    }
    return this.records.get(capabilityId);
  }

  getRecord(capabilityId) {
    return this.records.get(capabilityId) || null;
  }

  listRecords() {
    return [...this.records.values()].map((r) => ({ ...r }));
  }

  countsByState() {
    const counts = {
      IDLE: 0,
      RUNNING: 0,
      DEGRADED: 0,
      QUARANTINED: 0,
      RECOVERING: 0,
      DISABLED: 0,
    };
    for (const rec of this.records.values()) {
      counts[rec.state] = (counts[rec.state] || 0) + 1;
    }
    return counts;
  }

  transition(capabilityId, toState, reason = '', meta = {}) {
    const rec = this.ensureCapability(capabilityId, meta.moduleName || 'orchestrator');
    const fromState = rec.state;
    const nowIso = new Date(meta.now || Date.now()).toISOString();
    rec.previous_state = fromState;
    rec.state = toState;
    rec.updated_at = nowIso;

    const auditEntry = {
      capability_id: capabilityId,
      module_name: rec.module_name,
      from: fromState,
      to: toState,
      reason,
      consecutive_failures: rec.consecutive_failures,
      quarantined_until: rec.quarantined_until,
      timestamp: nowIso,
    };
    this.transitions.push(auditEntry);
    if (this.transitions.length > 500) this.transitions.shift();

    this._writeAudit(auditEntry);
    this._persistRecord(rec);
    this.emit('transition', auditEntry);

    if (toState === STATES.QUARANTINED && fromState !== STATES.QUARANTINED) {
      this.emit('capability_quarantined', auditEntry);
    }
    return rec;
  }

  canExecute(capabilityId, nowMs = Date.now()) {
    const rec = this.ensureCapability(capabilityId);
    if (rec.state === STATES.DISABLED) {
      return { allowed: false, state: rec.state, reason: 'disabled' };
    }
    if (rec.state === STATES.QUARANTINED) {
      const untilMs = rec.quarantined_until ? Date.parse(rec.quarantined_until) : 0;
      if (nowMs >= untilMs) {
        this.transition(capabilityId, STATES.RECOVERING, 'quarantine_cooldown_elapsed', { now: nowMs });
        return { allowed: true, state: STATES.RECOVERING, recovering: true };
      }
      return { allowed: false, state: STATES.QUARANTINED, reason: 'quarantined', quarantined_until: rec.quarantined_until };
    }
    return { allowed: true, state: rec.state, recovering: rec.state === STATES.RECOVERING };
  }

  markStart(capabilityId, moduleName = 'orchestrator', nowMs = Date.now()) {
    const rec = this.ensureCapability(capabilityId, moduleName);
    if (rec.state === STATES.IDLE || rec.state === STATES.DEGRADED) {
      this.transition(capabilityId, STATES.RUNNING, 'start_execution', { moduleName, now: nowMs });
    }
    return rec;
  }

  markSuccess(capabilityId, moduleName = 'orchestrator', nowMs = Date.now()) {
    const rec = this.ensureCapability(capabilityId, moduleName);
    rec.consecutive_failures = 0;
    rec.last_success_at = new Date(nowMs).toISOString();
    rec.quarantined_until = null;
    if (rec.state === STATES.RECOVERING) {
      this.transition(capabilityId, STATES.RUNNING, 'recovery_healthcheck_passed', { moduleName, now: nowMs });
    }
    this.transition(capabilityId, STATES.IDLE, 'execution_succeeded', { moduleName, now: nowMs });
    return rec;
  }

  markDegraded(capabilityId, reason = 'resource_budget_exceeded', nowMs = Date.now()) {
    const rec = this.ensureCapability(capabilityId);
    rec.last_error = reason;
    rec.last_error_at = new Date(nowMs).toISOString();
    if (rec.state !== STATES.QUARANTINED && rec.state !== STATES.DISABLED) {
      this.transition(capabilityId, STATES.DEGRADED, reason, { now: nowMs });
    }
    return rec;
  }

  markFailure(capabilityId, errorMsg = 'error', nowMs = Date.now()) {
    const rec = this.ensureCapability(capabilityId);
    rec.consecutive_failures = (rec.consecutive_failures || 0) + 1;
    rec.last_error = errorMsg;
    rec.last_error_at = new Date(nowMs).toISOString();

    if (rec.state === STATES.RECOVERING || rec.consecutive_failures >= 3) {
      rec.quarantined_until = new Date(nowMs + this.cooldownMs).toISOString();
      this.transition(
        capabilityId,
        STATES.QUARANTINED,
        rec.state === STATES.RECOVERING ? `recovery_failed: ${errorMsg}` : `3_consecutive_failures: ${errorMsg}`,
        { now: nowMs }
      );
    } else {
      this.transition(capabilityId, STATES.DEGRADED, `failure_${rec.consecutive_failures}: ${errorMsg}`, { now: nowMs });
    }
    return rec;
  }

  async attemptRecovery(capabilityId, healthCheckFn, nowMs = Date.now()) {
    const rec = this.ensureCapability(capabilityId);
    if (rec.state === STATES.QUARANTINED) {
      const untilMs = rec.quarantined_until ? Date.parse(rec.quarantined_until) : 0;
      if (nowMs < untilMs) {
        return { recovered: false, state: STATES.QUARANTINED, reason: 'cooldown_active' };
      }
      this.transition(capabilityId, STATES.RECOVERING, 'quarantine_cooldown_elapsed', { now: nowMs });
    }
    if (rec.state !== STATES.RECOVERING) {
      return { recovered: true, state: rec.state };
    }
    try {
      const res = typeof healthCheckFn === 'function' ? await healthCheckFn() : { ok: true };
      const ok = res === undefined || res === null || res === true || (typeof res === 'object' && res.ok !== false) || typeof res === 'string';
      if (ok) {
        rec.consecutive_failures = 0;
        rec.quarantined_until = null;
        rec.last_success_at = new Date(nowMs).toISOString();
        this.transition(capabilityId, STATES.RUNNING, 'healthCheck_passed', { now: nowMs });
        return { recovered: true, state: STATES.RUNNING };
      }
      throw new Error('healthCheck returned not ok');
    } catch (err) {
      rec.quarantined_until = new Date(nowMs + this.cooldownMs).toISOString();
      this.transition(capabilityId, STATES.QUARANTINED, `healthCheck_failed: ${err && err.message}`, { now: nowMs });
      return { recovered: false, state: STATES.QUARANTINED, error: err && err.message };
    }
  }

  disableAll(reason = 'emergency_stop', nowMs = Date.now()) {
    for (const [id, rec] of this.records.entries()) {
      if (rec.state !== STATES.DISABLED) {
        rec.saved_before_disable = rec.state;
        this.transition(id, STATES.DISABLED, reason, { now: nowMs });
      }
    }
  }

  resumeAll(reason = 'emergency_resume', nowMs = Date.now()) {
    for (const [id, rec] of this.records.entries()) {
      if (rec.state === STATES.DISABLED) {
        const target = rec.saved_before_disable || STATES.IDLE;
        delete rec.saved_before_disable;
        this.transition(id, target, reason, { now: nowMs });
      }
    }
  }

  _writeAudit(entry) {
    try {
      fs.mkdirSync(path.dirname(this.auditFile), { recursive: true });
      fs.appendFileSync(this.auditFile, JSON.stringify(entry) + '\n');
    } catch (_) { /* ignore in read-only test sandbox */ }
  }

  _persistRecord(rec) {
    if (!this.persistPostgres) return;
    try {
      const { spawn } = require('child_process');
      const sql = `INSERT INTO capability_state (capability_id, module_name, state, consecutive_failures, last_success_at, last_error_at, quarantined_until, updated_at)
VALUES (${sqlLiteral(rec.capability_id)}, ${sqlLiteral(rec.module_name)}, ${sqlLiteral(rec.state)}, ${sqlLiteral(rec.consecutive_failures || 0)}, ${sqlLiteral(rec.last_success_at)}, ${sqlLiteral(rec.last_error_at)}, ${sqlLiteral(rec.quarantined_until)}, NOW())
ON CONFLICT (capability_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  state = EXCLUDED.state,
  consecutive_failures = EXCLUDED.consecutive_failures,
  last_success_at = EXCLUDED.last_success_at,
  last_error_at = EXCLUDED.last_error_at,
  quarantined_until = EXCLUDED.quarantined_until,
  updated_at = NOW();`;
      const child = spawn('psql', ['-U', 'zeusai', '-d', 'zeusai', '-q'], {
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      child.on('error', () => {});
      if (child.stdin) {
        child.stdin.on('error', () => {});
        child.stdin.end(sql);
      }
      if (typeof child.unref === 'function') child.unref();
    } catch (_) { /* best-effort DB sync */ }
  }
}

module.exports = {
  STATES,
  DEFAULT_COOLDOWN_MS,
  CapabilityStateMachine,
};
