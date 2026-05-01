// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:17:01.458Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =============================================================================
// Enterprise-ready persistence layer
// Adds: audit_log, subscriptions, metrics_timeseries, organizations,
//       org_members, org_api_keys, service_activations
// All tables piggy-back on the same SQLite handle exposed by ./db.js.
// Falls back to in-memory store when SQLite is unavailable so unit tests
// without better-sqlite3 still pass.
// =============================================================================

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const dbModule = require('./db');
const db = dbModule.db; // raw better-sqlite3 handle, may be null in fallback

const REPORT_DIR = path.join(__dirname, '..', 'data', 'enterprise');
try { fs.mkdirSync(REPORT_DIR, { recursive: true }); } catch (_) {}

const usingSqlite = !!db;

// ---------------------------------------------------------------- in-memory fallback
const mem = {
  audit: [],
  subscriptions: [],
  metrics: [],
  orgs: [],
  orgMembers: [],
  orgApiKeys: [],
  activations: [],
};

if (usingSqlite) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      userId      TEXT,
      orgId       TEXT,
      action      TEXT NOT NULL,
      ip          TEXT,
      userAgent   TEXT,
      metadata    TEXT NOT NULL DEFAULT '{}',
      createdAt   TEXT NOT NULL,
      archivedAt  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, createdAt DESC);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id          TEXT PRIMARY KEY,
      userId      TEXT NOT NULL,
      plan        TEXT NOT NULL,
      serviceId   TEXT,
      orgId       TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      priceUsd    REAL NOT NULL DEFAULT 0,
      currency    TEXT NOT NULL DEFAULT 'USD',
      startDate   TEXT NOT NULL,
      endDate     TEXT NOT NULL,
      autoRenew   INTEGER NOT NULL DEFAULT 1,
      lastRenewedAt TEXT,
      paymentTxId TEXT,
      metadata    TEXT NOT NULL DEFAULT '{}',
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(userId, status);
    CREATE INDEX IF NOT EXISTS idx_sub_end ON subscriptions(endDate, status);

    CREATE TABLE IF NOT EXISTS metrics_timeseries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ts          INTEGER NOT NULL,
      uptime      REAL NOT NULL,
      rssMb       REAL NOT NULL,
      heapMb      REAL NOT NULL,
      cpuUserMs   REAL NOT NULL,
      cpuSystemMs REAL NOT NULL,
      reqTotal    INTEGER NOT NULL DEFAULT 0,
      reqErrors   INTEGER NOT NULL DEFAULT 0,
      latencyP50  REAL NOT NULL DEFAULT 0,
      latencyP95  REAL NOT NULL DEFAULT 0,
      activeUsers INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics_timeseries(ts DESC);

    CREATE TABLE IF NOT EXISTS organizations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      ownerUserId TEXT NOT NULL,
      plan        TEXT NOT NULL DEFAULT 'enterprise',
      rateLimitPerSec INTEGER NOT NULL DEFAULT 100,
      secrets     TEXT NOT NULL DEFAULT '{}',
      status      TEXT NOT NULL DEFAULT 'active',
      createdAt   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS org_members (
      orgId       TEXT NOT NULL,
      userId      TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'member',
      addedAt     TEXT NOT NULL,
      PRIMARY KEY (orgId, userId)
    );
    CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(userId);

    CREATE TABLE IF NOT EXISTS org_api_keys (
      keyId       TEXT PRIMARY KEY,
      orgId       TEXT NOT NULL,
      keyHash     TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL DEFAULT '',
      rateLimitPerSec INTEGER NOT NULL DEFAULT 100,
      active      INTEGER NOT NULL DEFAULT 1,
      createdAt   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_keys_org ON org_api_keys(orgId, active);

    CREATE TABLE IF NOT EXISTS service_activations (
      id          TEXT PRIMARY KEY,
      userId      TEXT NOT NULL,
      serviceId   TEXT NOT NULL,
      tokenHash   TEXT NOT NULL,
      paymentTxId TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      createdAt   TEXT NOT NULL,
      revokedAt   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_activations_user ON service_activations(userId, status);
  `);
}

// ---------------------------------------------------------------- helpers
function nowIso() { return new Date().toISOString(); }
function rid(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

// ---------------------------------------------------------------- audit_log
const audit = {
  log({ userId = null, orgId = null, action, ip = null, userAgent = null, metadata = {} } = {}) {
    if (!action) throw new Error('audit.action required');
    const entry = {
      id: rid('aud'),
      userId,
      orgId,
      action: String(action).slice(0, 120),
      ip: ip ? String(ip).slice(0, 64) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 256) : null,
      metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
      createdAt: nowIso(),
      archivedAt: null,
    };
    if (usingSqlite) {
      db.prepare(`INSERT INTO audit_log (id,userId,orgId,action,ip,userAgent,metadata,createdAt,archivedAt)
                  VALUES (@id,@userId,@orgId,@action,@ip,@userAgent,@metadata,@createdAt,@archivedAt)`).run(entry);
    } else {
      mem.audit.push(entry);
    }
    return { ...entry, metadata: safeParse(entry.metadata) };
  },
  list({ userId = null, action = null, limit = 200, offset = 0 } = {}) {
    if (usingSqlite) {
      const where = [];
      const params = [];
      if (userId) { where.push('userId = ?'); params.push(userId); }
      if (action) { where.push('action = ?'); params.push(action); }
      const sql = `SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
      const rows = db.prepare(sql).all(...params, Number(limit) || 200, Number(offset) || 0);
      return rows.map(r => ({ ...r, metadata: safeParse(r.metadata) }));
    }
    const filtered = mem.audit
      .filter(e => (!userId || e.userId === userId) && (!action || e.action === action))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filtered.slice(offset, offset + limit).map(e => ({ ...e, metadata: safeParse(e.metadata) }));
  },
  count() { return usingSqlite ? db.prepare('SELECT COUNT(*) AS c FROM audit_log').get().c : mem.audit.length; },
};

// ---------------------------------------------------------------- subscriptions
const subscriptions = {
  create({ userId, plan = 'starter', serviceId = null, orgId = null, priceUsd = 0, currency = 'USD',
           durationDays = 30, autoRenew = true, paymentTxId = null, metadata = {} } = {}) {
    if (!userId) throw new Error('subscriptions.create: userId required');
    const start = new Date();
    const end = new Date(start.getTime() + Math.max(1, Number(durationDays) || 30) * 86400000);
    const sub = {
      id: rid('sub'),
      userId: String(userId),
      plan: String(plan),
      serviceId: serviceId ? String(serviceId) : null,
      orgId: orgId ? String(orgId) : null,
      status: 'active',
      priceUsd: Number(priceUsd) || 0,
      currency: String(currency || 'USD'),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      autoRenew: autoRenew ? 1 : 0,
      lastRenewedAt: null,
      paymentTxId: paymentTxId || null,
      metadata: JSON.stringify(metadata || {}),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (usingSqlite) {
      db.prepare(`INSERT INTO subscriptions
        (id,userId,plan,serviceId,orgId,status,priceUsd,currency,startDate,endDate,autoRenew,lastRenewedAt,paymentTxId,metadata,createdAt,updatedAt)
        VALUES (@id,@userId,@plan,@serviceId,@orgId,@status,@priceUsd,@currency,@startDate,@endDate,@autoRenew,@lastRenewedAt,@paymentTxId,@metadata,@createdAt,@updatedAt)`).run(sub);
    } else {
      mem.subscriptions.push(sub);
    }
    return decodeSub(sub);
  },
  listByUser(userId) {
    if (usingSqlite) {
      return db.prepare('SELECT * FROM subscriptions WHERE userId = ? ORDER BY createdAt DESC').all(userId).map(decodeSub);
    }
    return mem.subscriptions.filter(s => s.userId === userId).map(decodeSub);
  },
  listExpiring(beforeIsoOrDate) {
    const cutoff = (beforeIsoOrDate instanceof Date) ? beforeIsoOrDate.toISOString() : String(beforeIsoOrDate);
    if (usingSqlite) {
      return db.prepare(`SELECT * FROM subscriptions WHERE status = 'active' AND endDate <= ?`).all(cutoff).map(decodeSub);
    }
    return mem.subscriptions.filter(s => s.status === 'active' && s.endDate <= cutoff).map(decodeSub);
  },
  renew(id, durationDays = 30) {
    const next = new Date(Date.now() + Math.max(1, Number(durationDays) || 30) * 86400000).toISOString();
    if (usingSqlite) {
      db.prepare(`UPDATE subscriptions SET endDate = ?, lastRenewedAt = ?, updatedAt = ?, status = 'active' WHERE id = ?`)
        .run(next, nowIso(), nowIso(), id);
      const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
      return row ? decodeSub(row) : null;
    }
    const s = mem.subscriptions.find(x => x.id === id);
    if (!s) return null;
    s.endDate = next; s.lastRenewedAt = nowIso(); s.updatedAt = nowIso(); s.status = 'active';
    return decodeSub(s);
  },
  cancel(id) {
    if (usingSqlite) {
      db.prepare(`UPDATE subscriptions SET status = 'cancelled', autoRenew = 0, updatedAt = ? WHERE id = ?`)
        .run(nowIso(), id);
      const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
      return row ? decodeSub(row) : null;
    }
    const s = mem.subscriptions.find(x => x.id === id);
    if (!s) return null;
    s.status = 'cancelled'; s.autoRenew = 0; s.updatedAt = nowIso();
    return decodeSub(s);
  },
  count() { return usingSqlite ? db.prepare('SELECT COUNT(*) AS c FROM subscriptions').get().c : mem.subscriptions.length; },
  buildInvoiceText(sub) {
    if (!sub) return '';
    const lines = [
      'ZeusAI / Unicorn — Invoice',
      '----------------------------------------',
      `Invoice ID:    ${sub.id}`,
      `User ID:       ${sub.userId}`,
      `Plan:          ${sub.plan}`,
      `Service:       ${sub.serviceId || 'platform'}`,
      `Status:        ${sub.status}`,
      `Period:        ${sub.startDate}  →  ${sub.endDate}`,
      `Amount:        ${sub.priceUsd.toFixed(2)} ${sub.currency}`,
      `Payment ref:   ${sub.paymentTxId || '—'}`,
      `Generated at:  ${nowIso()}`,
      '----------------------------------------',
      'BTC-direct settlement to owner wallet.',
      'Owner: Vladoi Ionut',
      'BTC:   bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
      '',
    ];
    return lines.join('\n');
  },
};

function decodeSub(s) {
  if (!s) return s;
  return {
    ...s,
    autoRenew: Number(s.autoRenew) === 1,
    metadata: typeof s.metadata === 'string' ? safeParse(s.metadata) : (s.metadata || {}),
  };
}

// ---------------------------------------------------------------- metrics_timeseries
const metrics = {
  record(sample = {}) {
    const cpu = process.cpuUsage();
    const memU = process.memoryUsage();
    const row = {
      ts: Date.now(),
      uptime: process.uptime(),
      rssMb: memU.rss / 1048576,
      heapMb: memU.heapUsed / 1048576,
      cpuUserMs: cpu.user / 1000,
      cpuSystemMs: cpu.system / 1000,
      reqTotal: Number(sample.reqTotal || 0),
      reqErrors: Number(sample.reqErrors || 0),
      latencyP50: Number(sample.latencyP50 || 0),
      latencyP95: Number(sample.latencyP95 || 0),
      activeUsers: Number(sample.activeUsers || 0),
    };
    if (usingSqlite) {
      db.prepare(`INSERT INTO metrics_timeseries
        (ts,uptime,rssMb,heapMb,cpuUserMs,cpuSystemMs,reqTotal,reqErrors,latencyP50,latencyP95,activeUsers)
        VALUES (@ts,@uptime,@rssMb,@heapMb,@cpuUserMs,@cpuSystemMs,@reqTotal,@reqErrors,@latencyP50,@latencyP95,@activeUsers)`).run(row);
    } else {
      mem.metrics.push(row);
      if (mem.metrics.length > 10000) mem.metrics.splice(0, mem.metrics.length - 10000);
    }
    return row;
  },
  recent({ limit = 200 } = {}) {
    if (usingSqlite) return db.prepare('SELECT * FROM metrics_timeseries ORDER BY ts DESC LIMIT ?').all(Number(limit) || 200);
    return mem.metrics.slice().sort((a, b) => b.ts - a.ts).slice(0, Number(limit) || 200);
  },
  weeklyReport() {
    const since = Date.now() - 7 * 86400000;
    const rows = usingSqlite
      ? db.prepare('SELECT * FROM metrics_timeseries WHERE ts >= ? ORDER BY ts ASC').all(since)
      : mem.metrics.filter(r => r.ts >= since).sort((a, b) => a.ts - b.ts);
    if (!rows.length) {
      return { ok: true, samples: 0, report: 'No metric samples collected in the last 7 days yet.' };
    }
    const avg = (k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0) / rows.length;
    const max = (k) => rows.reduce((m, r) => Math.max(m, Number(r[k] || 0)), 0);
    const errs = rows.reduce((a, r) => a + Number(r.reqErrors || 0), 0);
    const reqs = rows.reduce((a, r) => a + Number(r.reqTotal || 0), 0);
    const errRate = reqs ? (errs / reqs) * 100 : 0;
    const text = [
      'ZeusAI / Unicorn — Weekly SLA Report',
      `Period: last 7 days · samples: ${rows.length}`,
      '----------------------------------------',
      `Uptime (max sample): ${(max('uptime') / 3600).toFixed(2)} hours`,
      `Avg RSS:             ${avg('rssMb').toFixed(1)} MB`,
      `Avg heap:            ${avg('heapMb').toFixed(1)} MB`,
      `Avg latency p50:     ${avg('latencyP50').toFixed(2)} ms`,
      `Avg latency p95:     ${avg('latencyP95').toFixed(2)} ms`,
      `Total requests:      ${reqs}`,
      `Total errors:        ${errs}`,
      `Error rate:          ${errRate.toFixed(3)} %`,
      `Avg active users:    ${avg('activeUsers').toFixed(1)}`,
      '----------------------------------------',
      `Generated at: ${nowIso()}`,
    ].join('\n');
    return { ok: true, samples: rows.length, errs, reqs, errRate, report: text };
  },
};

// ---------------------------------------------------------------- organizations
const orgs = {
  create({ name, ownerUserId, plan = 'enterprise', rateLimitPerSec = 100, secrets = {} } = {}) {
    if (!name || !ownerUserId) throw new Error('orgs.create: name and ownerUserId required');
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || rid('org');
    const o = {
      id: rid('org'),
      name: String(name).slice(0, 120),
      slug,
      ownerUserId: String(ownerUserId),
      plan: String(plan),
      rateLimitPerSec: Math.max(1, Number(rateLimitPerSec) || 100),
      secrets: JSON.stringify(secrets || {}),
      status: 'active',
      createdAt: nowIso(),
    };
    if (usingSqlite) {
      try {
        db.prepare(`INSERT INTO organizations (id,name,slug,ownerUserId,plan,rateLimitPerSec,secrets,status,createdAt)
                    VALUES (@id,@name,@slug,@ownerUserId,@plan,@rateLimitPerSec,@secrets,@status,@createdAt)`).run(o);
      } catch (e) {
        if (String(e.message || '').includes('UNIQUE')) {
          o.slug = `${o.slug}-${crypto.randomBytes(2).toString('hex')}`;
          db.prepare(`INSERT INTO organizations (id,name,slug,ownerUserId,plan,rateLimitPerSec,secrets,status,createdAt)
                      VALUES (@id,@name,@slug,@ownerUserId,@plan,@rateLimitPerSec,@secrets,@status,@createdAt)`).run(o);
        } else { throw e; }
      }
      db.prepare(`INSERT OR IGNORE INTO org_members (orgId,userId,role,addedAt) VALUES (?,?,?,?)`)
        .run(o.id, o.ownerUserId, 'owner', nowIso());
    } else {
      mem.orgs.push(o);
      mem.orgMembers.push({ orgId: o.id, userId: o.ownerUserId, role: 'owner', addedAt: nowIso() });
    }
    return decodeOrg(o);
  },
  findById(id) {
    if (usingSqlite) { const r = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id); return r ? decodeOrg(r) : null; }
    const r = mem.orgs.find(x => x.id === id); return r ? decodeOrg(r) : null;
  },
  list() {
    if (usingSqlite) return db.prepare('SELECT * FROM organizations ORDER BY createdAt DESC').all().map(decodeOrg);
    return mem.orgs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(decodeOrg);
  },
  addMember(orgId, userId, role = 'member') {
    const row = { orgId, userId, role, addedAt: nowIso() };
    if (usingSqlite) {
      db.prepare(`INSERT OR REPLACE INTO org_members (orgId,userId,role,addedAt) VALUES (@orgId,@userId,@role,@addedAt)`).run(row);
    } else {
      const i = mem.orgMembers.findIndex(m => m.orgId === orgId && m.userId === userId);
      if (i >= 0) mem.orgMembers[i] = row; else mem.orgMembers.push(row);
    }
    return row;
  },
  listMembers(orgId) {
    if (usingSqlite) return db.prepare('SELECT * FROM org_members WHERE orgId = ? ORDER BY addedAt').all(orgId);
    return mem.orgMembers.filter(m => m.orgId === orgId);
  },
  issueApiKey(orgId, name = '', rateLimitPerSec = null) {
    const org = this.findById(orgId);
    if (!org) throw new Error('org not found');
    const raw = `unk_${crypto.randomBytes(24).toString('hex')}`;
    const row = {
      keyId: rid('key'),
      orgId,
      keyHash: sha256(raw),
      name: String(name || '').slice(0, 80),
      rateLimitPerSec: Math.max(1, Number(rateLimitPerSec || org.rateLimitPerSec || 100)),
      active: 1,
      createdAt: nowIso(),
    };
    if (usingSqlite) {
      db.prepare(`INSERT INTO org_api_keys (keyId,orgId,keyHash,name,rateLimitPerSec,active,createdAt)
                  VALUES (@keyId,@orgId,@keyHash,@name,@rateLimitPerSec,@active,@createdAt)`).run(row);
    } else {
      mem.orgApiKeys.push(row);
    }
    return { ...row, plaintext: raw };
  },
  findApiKeyByPlaintext(raw) {
    if (!raw) return null;
    const h = sha256(raw);
    if (usingSqlite) return db.prepare('SELECT * FROM org_api_keys WHERE keyHash = ? AND active = 1').get(h) || null;
    return mem.orgApiKeys.find(k => k.keyHash === h && k.active === 1) || null;
  },
  listKeys(orgId) {
    if (usingSqlite) return db.prepare('SELECT keyId,orgId,name,rateLimitPerSec,active,createdAt FROM org_api_keys WHERE orgId = ?').all(orgId);
    return mem.orgApiKeys.filter(k => k.orgId === orgId).map(({ keyHash, ...rest }) => rest);
  },
};

function decodeOrg(o) {
  if (!o) return o;
  return { ...o, secrets: typeof o.secrets === 'string' ? safeParse(o.secrets) : (o.secrets || {}) };
}

// ---------------------------------------------------------------- service activations
const activations = {
  issue({ userId, serviceId, paymentTxId = null } = {}) {
    if (!userId || !serviceId) throw new Error('activations.issue: userId+serviceId required');
    const raw = `act_${crypto.randomBytes(24).toString('hex')}`;
    const row = {
      id: rid('act'),
      userId: String(userId),
      serviceId: String(serviceId),
      tokenHash: sha256(raw),
      paymentTxId: paymentTxId || null,
      status: 'active',
      createdAt: nowIso(),
      revokedAt: null,
    };
    if (usingSqlite) {
      db.prepare(`INSERT INTO service_activations (id,userId,serviceId,tokenHash,paymentTxId,status,createdAt,revokedAt)
                  VALUES (@id,@userId,@serviceId,@tokenHash,@paymentTxId,@status,@createdAt,@revokedAt)`).run(row);
    } else {
      mem.activations.push(row);
    }
    return { ...row, token: raw };
  },
  listByUser(userId) {
    if (usingSqlite) return db.prepare('SELECT * FROM service_activations WHERE userId = ? ORDER BY createdAt DESC').all(userId);
    return mem.activations.filter(a => a.userId === userId);
  },
  verify(token) {
    if (!token) return null;
    const h = sha256(token);
    if (usingSqlite) return db.prepare(`SELECT * FROM service_activations WHERE tokenHash = ? AND status = 'active'`).get(h) || null;
    return mem.activations.find(a => a.tokenHash === h && a.status === 'active') || null;
  },
  revoke(id) {
    if (usingSqlite) {
      db.prepare(`UPDATE service_activations SET status='revoked', revokedAt = ? WHERE id = ?`).run(nowIso(), id);
      return db.prepare('SELECT * FROM service_activations WHERE id = ?').get(id) || null;
    }
    const a = mem.activations.find(x => x.id === id);
    if (a) { a.status = 'revoked'; a.revokedAt = nowIso(); }
    return a || null;
  },
};

// ---------------------------------------------------------------- helpers
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }

function meta() {
  return {
    usingSqlite,
    counts: {
      audit: audit.count(),
      subscriptions: subscriptions.count(),
      metrics: usingSqlite ? db.prepare('SELECT COUNT(*) AS c FROM metrics_timeseries').get().c : mem.metrics.length,
      organizations: orgs.list().length,
      activations: usingSqlite ? db.prepare('SELECT COUNT(*) AS c FROM service_activations').get().c : mem.activations.length,
    },
  };
}

module.exports = { audit, subscriptions, metrics, orgs, activations, meta, REPORT_DIR };
