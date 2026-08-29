'use strict';

/**
 * ROCS/1.0 — Reality Ops Continuum
 *
 * Product-native observability that is intentionally NOT Prometheus/Grafana:
 *   - Causal Verdict Graph (symptom → cause → action → optional safe remediations)
 *   - Money-path continuum SLO (checkout → payment → fulfillment), not HTTP scrapes
 *   - Autonomy Continuity Score (IAK / TAAC / ZAC heartbeat age)
 *   - Deploy Trust Bond (integrity / build SHA awareness)
 *   - Decision Cards via Telegram/Discord (action verbs, not chart panels)
 *   - Anti-vanity: never invents GMV / SERP / reach; refuses fake metrics
 *
 * Backup policy (owner already has periodic server backup):
 *   ROCS never schedules, runs, or replaces host backups.
 *   Plane "backup" only ACKs owner-managed backup and optionally reads a
 *   freshness marker file if UNICORN_BACKUP_LAST_OK_FILE is set.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'ROCS/1.0';
const INVENTION = 'Reality Ops Continuum';
const DATA_DIR = process.env.ROCS_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'rocs');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LEDGER_FILE = path.join(DATA_DIR, 'verdicts.jsonl');
const TICK_MS = Math.max(30_000, Number(process.env.ROCS_TICK_MS || 90_000));
const ENABLED = process.env.ROCS_DISABLED !== '1';
const ALERT_DEDUP_MS = Math.max(60_000, Number(process.env.ROCS_ALERT_DEDUP_MS || 30 * 60_000));
const STUCK_PAYMENT_MS = Math.max(5 * 60_000, Number(process.env.ROCS_STUCK_PAYMENT_MS || 45 * 60_000));
const HEARTBEAT_STALE_MS = Math.max(2 * 60_000, Number(process.env.ROCS_HEARTBEAT_STALE_MS || 20 * 60_000));
const HEAP_WARN_MB = Math.max(256, Number(process.env.ROCS_HEAP_WARN_MB || 1400));

const _counts = {
  ticks: 0,
  verdicts: 0,
  alerts: 0,
  alertSkips: 0,
  remediations: 0,
  errors: 0,
};

let _timer = null;
let _running = false;
let _startedAt = null;
let _lastTickAt = null;
let _lastVerdict = null;
let _alertSeen = new Map(); // fingerprint → ts

function _iso() {
  return new Date().toISOString();
}

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function _envOn(name, fallbackFalse) {
  const v = process.env[name];
  if (v == null || v === '') return !fallbackFalse ? false : false;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function autoRemediateEnabled() {
  if (process.env.ROCS_AUTO_REMEDIATE === '0') return false;
  if (process.env.ROCS_AUTO_REMEDIATE === '1') return true;
  // Default: on under non-test when not explicitly disabled
  return process.env.NODE_ENV !== 'test';
}

function _persistState() {
  _ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      protocol: PROTOCOL,
      invention: INVENTION,
      updatedAt: _iso(),
      startedAt: _startedAt,
      lastTickAt: _lastTickAt,
      lastVerdict: _lastVerdict && {
        at: _lastVerdict.at,
        grade: _lastVerdict.grade,
        score: _lastVerdict.score,
        findingCount: (_lastVerdict.findings || []).length,
      },
      counts: _counts,
      policy: policy(),
    }, null, 2));
  } catch (_) { /* ignore */ }
}

function _appendLedger(verdict) {
  _ensureDir();
  try {
    const line = JSON.stringify({
      at: verdict.at,
      grade: verdict.grade,
      score: verdict.score,
      findings: (verdict.findings || []).map((f) => ({
        id: f.id,
        severity: f.severity,
        plane: f.plane,
        symptom: f.symptom,
        cause: f.cause,
        action: f.action,
        remediated: !!f.remediated,
      })),
      planes: verdict.planes,
    }) + '\n';
    fs.appendFileSync(LEDGER_FILE, line);
  } catch (_) { /* ignore */ }
}

function policy() {
  return {
    inventGmv: 'never',
    inventSerp: 'never',
    inventReach: 'never',
    fakeMetrics: 'refused',
    fileMutators: 'never',
    backups: 'owner_periodic_external_never_managed_by_rocs',
    vsPrometheus: 'causal_verdicts_not_metric_scrapes',
    vsGrafana: 'decision_cards_not_chart_panels',
  };
}

function honesty() {
  return 'ROCS never invents GMV/SERP/reach. Never manages host backups (owner periodic backup remains source of truth). Never enables file mutators. Beyond Prometheus scrapes and Grafana panels: causal verdicts + money-path + autonomy continuity + Telegram decision cards.';
}

/** Build a finding in the causal graph shape. */
function finding(partial) {
  return {
    id: partial.id,
    plane: partial.plane,
    severity: partial.severity || 'info', // critical | warn | info
    symptom: partial.symptom,
    cause: partial.cause || null,
    action: partial.action || null,
    autoRemediation: partial.autoRemediation || null,
    remediated: false,
    evidence: partial.evidence || null,
  };
}

function _severityScore(sev) {
  if (sev === 'critical') return 40;
  if (sev === 'warn') return 15;
  return 2;
}

function _gradeFromScore(score) {
  if (score >= 80) return 'red';
  if (score >= 25) return 'amber';
  return 'green';
}

// ── Planes ──────────────────────────────────────────────────────────────────

function senseProcess() {
  const mem = process.memoryUsage();
  const heapMb = Math.round((mem.heapUsed || 0) / (1024 * 1024));
  const rssMb = Math.round((mem.rss || 0) / (1024 * 1024));
  const uptimeSec = Math.round(process.uptime());
  const findings = [];
  if (heapMb >= HEAP_WARN_MB) {
    findings.push(finding({
      id: 'process.heap_high',
      plane: 'process',
      severity: 'warn',
      symptom: `heapUsed ${heapMb}MB ≥ warn ${HEAP_WARN_MB}MB`,
      cause: 'event_loop_or_cache_pressure',
      action: 'inspect /api/resource-monitor/status; consider PM2 reload if sustained',
      evidence: { heapMb, rssMb, uptimeSec },
    }));
  }
  return {
    ok: true,
    heapMb,
    rssMb,
    uptimeSec,
    findings,
  };
}

function senseCommerce() {
  const findings = [];
  const out = {
    ok: true,
    orders: null,
    reality: null,
    findings,
  };

  try {
    let ordersApi = null;
    try {
      const zacc = _safeRequire('./zacc');
      if (zacc && zacc.orders) ordersApi = zacc.orders;
      else if (zacc && typeof zacc.getStatus === 'function') {
        const gst = zacc.getStatus();
        if (gst && gst.orders) {
          out.orders = gst.orders;
          ordersApi = null; // already have counts snapshot
          const counts = (gst.orders && gst.orders.counts) || {};
          const awaiting = Number(counts.awaiting_payment || 0);
          if (awaiting > 20) {
            findings.push(finding({
              id: 'commerce.awaiting_backlog',
              plane: 'commerce',
              severity: 'warn',
              symptom: `${awaiting} orders in awaiting_payment`,
              cause: 'funnel_or_rail_friction',
              action: 'review payment rails + abandoned checkout recovery',
              evidence: { awaiting },
            }));
          }
        }
      }
    } catch (_) { /* ignore */ }
    if (!ordersApi) {
      const zac = _safeRequire('./zeusAutonomousCore');
      if (zac && zac.orders) ordersApi = zac.orders;
    }
    if (ordersApi && typeof ordersApi.status === 'function') {
      const st = ordersApi.status();
      out.orders = {
        counts: st.counts || null,
        total: st.total != null ? st.total : null,
      };
      const counts = st.counts || {};
      const awaiting = Number(counts.awaiting_payment || 0);
      const paid = Number(counts.paid || 0);
      const queued = Number(counts.fulfillment_queued || 0) + Number(counts.fulfillment_routed || 0);
      // Stuck awaiting: if we can list orders with timestamps, count aged ones.
      let stuckAged = 0;
      if (typeof ordersApi.list === 'function' || Array.isArray(ordersApi.orders)) {
        const list = typeof ordersApi.list === 'function'
          ? (ordersApi.list() || [])
          : (ordersApi.orders || []);
        const now = Date.now();
        for (const o of list) {
          if (!o || o.status !== 'awaiting_payment') continue;
          const t = Date.parse(o.updatedAt || o.createdAt || o.at || 0);
          if (t && (now - t) >= STUCK_PAYMENT_MS) stuckAged += 1;
        }
      }
      if (stuckAged > 0) {
        findings.push(finding({
          id: 'commerce.stuck_awaiting_payment',
          plane: 'commerce',
          severity: stuckAged >= 3 ? 'critical' : 'warn',
          symptom: `${stuckAged} order(s) awaiting_payment older than ${Math.round(STUCK_PAYMENT_MS / 60000)}m`,
          cause: 'payment_rail_or_buyer_abandon',
          action: 'check BTC/PayPal/NOWPayments rails + /api/order/:id/status; recover via checkout recovery agent',
          evidence: { stuckAged, awaiting },
        }));
      } else if (awaiting > 20) {
        findings.push(finding({
          id: 'commerce.awaiting_backlog',
          plane: 'commerce',
          severity: 'warn',
          symptom: `${awaiting} orders in awaiting_payment`,
          cause: 'funnel_or_rail_friction',
          action: 'review payment rails + abandoned checkout recovery',
          evidence: { awaiting },
        }));
      }
      if (paid > 0 && queued === 0 && Number(counts.shipped || 0) === 0) {
        findings.push(finding({
          id: 'commerce.paid_without_fulfillment_signal',
          plane: 'commerce',
          severity: 'info',
          symptom: `${paid} paid with zero fulfillment_queued/shipped counts`,
          cause: 'digital_sku_or_fulfillment_idle',
          action: 'confirm digital delivery vs ZACC fulfillment desk',
          evidence: { paid, queued, shipped: counts.shipped || 0 },
        }));
      }
    }
  } catch (e) {
    findings.push(finding({
      id: 'commerce.zacc_unavailable',
      plane: 'commerce',
      severity: 'info',
      symptom: 'ZACC orders status unavailable',
      cause: String(e && e.message || e).slice(0, 120),
      action: 'ensure zacc loads under stable',
    }));
  }

  try {
    const rm = _safeRequire('./reality-metrics');
    if (rm && typeof rm.snapshot === 'function') {
      out.reality = rm.snapshot();
    }
  } catch (_) { /* ignore */ }

  return out;
}

function senseAutonomy() {
  const findings = [];
  const organs = {};

  try {
    const iak = _safeRequire('./integrated-autonomy-kernel');
    if (iak && typeof iak.getStatus === 'function') {
      const st = iak.getStatus();
      organs.iak = {
        running: !!st.running,
        mode: st.mode,
        meshHealthy: st.meshHealthy,
        healthyModules: st.healthyModules,
        totalModules: st.totalModules,
        quarantined: st.quarantined,
      };
      if (!st.running) {
        findings.push(finding({
          id: 'autonomy.iak_stopped',
          plane: 'autonomy',
          severity: 'critical',
          symptom: 'IAK master orchestrator not running',
          cause: 'boot_skip_or_stopped',
          action: 'start IAK in safe-autonomy; POST /api/orchestrator/start',
          autoRemediation: 'iak_safe_start',
        }));
      } else if (st.mode === 'monitor') {
        findings.push(finding({
          id: 'autonomy.iak_monitor_only',
          plane: 'autonomy',
          severity: 'warn',
          symptom: 'IAK in bare monitor (not safe-autonomy)',
          cause: 'boot_mode_monitor',
          action: 'promote to safe-autonomy so TAAC + non-mutator heal run',
          autoRemediation: 'iak_safe_start',
        }));
      }
    }
  } catch (_) { /* ignore */ }

  try {
    const taac = _safeRequire('./total-autonomy-activation-continuum');
    if (taac && typeof taac.getStatus === 'function') {
      const st = taac.getStatus();
      organs.taac = {
        running: !!st.running,
        enabled: st.enabled !== false,
        lastTickAt: st.lastTickAt || null,
        telegramReady: !!st.telegramReady,
      };
      if (!st.running && process.env.TAAC_DISABLED !== '1') {
        findings.push(finding({
          id: 'autonomy.taac_stopped',
          plane: 'autonomy',
          severity: 'warn',
          symptom: 'TAAC continuum not running',
          cause: 'not_started_or_disabled',
          action: 'taac.start() / POST /api/taac/arm',
          autoRemediation: 'taac_start_arm',
        }));
      }
    } else if (taac && typeof taac.discovery === 'function') {
      const d = taac.discovery();
      organs.taac = { running: !!d.running, protocol: d.protocol };
    }
  } catch (_) { /* ignore */ }

  // ZAC heartbeat freshness
  try {
    const hbPath = path.join(__dirname, '..', '..', 'data', 'zac', 'heartbeat.json');
    if (fs.existsSync(hbPath)) {
      const raw = JSON.parse(fs.readFileSync(hbPath, 'utf8'));
      const at = Date.parse(raw.updatedAt || raw.at || raw.ts || 0);
      const ageMs = at ? (Date.now() - at) : null;
      organs.zacHeartbeat = {
        path: 'data/zac/heartbeat.json',
        at: raw.updatedAt || raw.at || null,
        ageMs,
      };
      if (ageMs != null && ageMs > HEARTBEAT_STALE_MS) {
        findings.push(finding({
          id: 'autonomy.zac_heartbeat_stale',
          plane: 'autonomy',
          severity: ageMs > HEARTBEAT_STALE_MS * 3 ? 'critical' : 'warn',
          symptom: `ZAC heartbeat age ${Math.round(ageMs / 60000)}m`,
          cause: 'zac_loop_idle_or_crash',
          action: 'check zeusAutonomousCore / PM2 unicorn-backend logs',
          evidence: { ageMs },
        }));
      }
    } else {
      organs.zacHeartbeat = { present: false };
    }
  } catch (e) {
    organs.zacHeartbeat = { error: String(e && e.message || e).slice(0, 80) };
  }

  return { ok: true, organs, findings };
}

function senseDeploy() {
  const findings = [];
  const out = {
    ok: true,
    buildSha: process.env.ZEUS_BUILD_SHA || process.env.GITHUB_SHA || null,
    integrity: null,
    findings,
  };
  const candidates = [
    path.join(__dirname, '..', '..', 'public', 'integrity.json'),
    path.join(__dirname, '..', '..', 'integrity.json'),
    '/var/www/unicorn/UNICORN_FINAL/public/integrity.json',
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      out.integrity = {
        path: p,
        version: j.version || j.sha || j.build || null,
        generatedAt: j.generatedAt || j.at || null,
      };
      break;
    } catch (_) { /* try next */ }
  }
  if (!out.buildSha && !out.integrity) {
    findings.push(finding({
      id: 'deploy.sha_unknown',
      plane: 'deploy',
      severity: 'info',
      symptom: 'No ZEUS_BUILD_SHA and no integrity.json in probe paths',
      cause: 'local_dev_or_missing_artifact',
      action: 'deploy pipeline writes integrity.json; optional in local',
    }));
  }
  return out;
}

/**
 * Backup plane — ACK only. Never run backups.
 * Optional freshness: UNICORN_BACKUP_LAST_OK_FILE pointing at a marker the
 * owner's cron updates (mtime or JSON {ok,at}).
 */
function senseBackup() {
  const findings = [];
  const marker = process.env.UNICORN_BACKUP_LAST_OK_FILE || '';
  const plane = {
    managedByRocs: false,
    policy: 'owner_periodic_external',
    honesty: 'Owner already configured periodic server backup for Unicorn. ROCS never schedules or replaces it.',
    marker: marker || null,
    fresh: null,
    ageMs: null,
    findings,
  };

  if (!marker) {
    plane.fresh = 'unobserved_owner_managed';
    return plane;
  }

  try {
    if (!fs.existsSync(marker)) {
      findings.push(finding({
        id: 'backup.marker_missing',
        plane: 'backup',
        severity: 'warn',
        symptom: `Backup freshness marker missing: ${marker}`,
        cause: 'cron_not_writing_marker_or_wrong_path',
        action: 'point UNICORN_BACKUP_LAST_OK_FILE at the marker your backup cron already writes — ROCS will not run backups',
      }));
      plane.fresh = false;
      return plane;
    }
    const st = fs.statSync(marker);
    let at = st.mtimeMs;
    try {
      const j = JSON.parse(fs.readFileSync(marker, 'utf8'));
      const parsed = Date.parse(j.at || j.updatedAt || j.okAt || 0);
      if (parsed) at = parsed;
    } catch (_) { /* mtime is fine */ }
    const ageMs = Date.now() - at;
    plane.ageMs = ageMs;
    const maxAge = Math.max(3600_000, Number(process.env.ROCS_BACKUP_MAX_AGE_MS || 36 * 3600_000));
    plane.fresh = ageMs <= maxAge;
    if (!plane.fresh) {
      findings.push(finding({
        id: 'backup.marker_stale',
        plane: 'backup',
        severity: 'warn',
        symptom: `Owner backup marker age ${Math.round(ageMs / 3600000)}h`,
        cause: 'periodic_backup_cron_may_have_stopped',
        action: 'inspect host backup cron (ROCS does not run backups)',
        evidence: { ageMs, maxAge, marker },
      }));
    }
  } catch (e) {
    findings.push(finding({
      id: 'backup.marker_error',
      plane: 'backup',
      severity: 'info',
      symptom: 'Could not read backup marker',
      cause: String(e && e.message || e).slice(0, 100),
      action: 'fix marker permissions; ROCS still will not run backups',
    }));
  }
  return plane;
}

function senseFakeMetricsGuard() {
  const findings = [];
  if (process.env.FAKE_OBS_METRICS === '1') {
    findings.push(finding({
      id: 'honesty.fake_obs_metrics_armed',
      plane: 'honesty',
      severity: 'critical',
      symptom: 'FAKE_OBS_METRICS=1 — fabricated Math.random observability armed',
      cause: 'env_flag',
      action: 'unset FAKE_OBS_METRICS; ROCS refuses vanity metrics',
    }));
  }
  return { ok: process.env.FAKE_OBS_METRICS !== '1', findings };
}

// ── Remediations (safe only) ────────────────────────────────────────────────

async function _remediate(findingRow) {
  const kind = findingRow.autoRemediation;
  if (!kind || !autoRemediateEnabled()) return { ok: false, skipped: true };

  if (kind === 'taac_start_arm') {
    const taac = _safeRequire('./total-autonomy-activation-continuum');
    if (!taac) return { ok: false, reason: 'taac_unavailable' };
    try {
      if (typeof taac.start === 'function' && process.env.TAAC_DISABLED !== '1') {
        taac.start({ bootDelayMs: 500 });
      }
      if (typeof taac.armAll === 'function') {
        const r = await taac.armAll({ source: 'rocs', dryRun: false });
        _counts.remediations += 1;
        return { ok: true, kind, result: { refused: r && r.refused, organKeys: r && r.organs ? Object.keys(r.organs) : [] } };
      }
      _counts.remediations += 1;
      return { ok: true, kind, started: true };
    } catch (e) {
      return { ok: false, kind, error: String(e && e.message || e).slice(0, 120) };
    }
  }

  if (kind === 'iak_safe_start') {
    const iak = _safeRequire('./integrated-autonomy-kernel');
    if (!iak || typeof iak.start !== 'function') return { ok: false, reason: 'iak_unavailable' };
    try {
      iak.start({ mode: 'safe-autonomy', ensureFacets: false, guardianMode: 'idle' });
      if (typeof iak.ensureSafeAutonomyActivation === 'function') {
        iak.ensureSafeAutonomyActivation({ source: 'rocs' });
      }
      _counts.remediations += 1;
      return { ok: true, kind };
    } catch (e) {
      return { ok: false, kind, error: String(e && e.message || e).slice(0, 120) };
    }
  }

  return { ok: false, skipped: true, reason: 'unknown_remediation' };
}

function _fingerprint(f) {
  return crypto.createHash('sha1')
    .update(`${f.id}|${f.severity}|${f.symptom}`)
    .digest('hex')
    .slice(0, 16);
}

async function _maybeAlert(verdict) {
  const actionable = (verdict.findings || []).filter((f) => f.severity === 'critical' || f.severity === 'warn');
  if (!actionable.length) return { ok: true, skipped: 'no_actionable' };

  const now = Date.now();
  // Drop expired fingerprints
  for (const [k, t] of _alertSeen.entries()) {
    if (now - t > ALERT_DEDUP_MS) _alertSeen.delete(k);
  }

  const fresh = actionable.filter((f) => {
    const fp = _fingerprint(f);
    if (_alertSeen.has(fp)) return false;
    _alertSeen.set(fp, now);
    return true;
  });
  if (!fresh.length) {
    _counts.alertSkips += 1;
    return { ok: true, skipped: 'dedup' };
  }

  const lines = [
    `🧭 *ROCS/${verdict.grade.toUpperCase()}* score=${verdict.score}`,
    `Decision cards (not Grafana panels):`,
    ...fresh.slice(0, 6).map((f) => (
      `• *[${f.severity}]* ${f.plane}: ${f.symptom}`
      + (f.action ? `\n  → ${f.action}` : '')
    )),
    `\n_Backup: owner periodic (ROCS does not run backups)_`,
    `Status: /api/rocs/status`,
  ];

  try {
    const zac = _safeRequire('./zacAlertChannel');
    if (zac && typeof zac.broadcast === 'function') {
      const r = await zac.broadcast(lines.join('\n'));
      _counts.alerts += 1;
      return { ok: true, channels: r, count: fresh.length };
    }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 100) };
  }
  return { ok: true, skipped: 'no_alert_channel' };
}

/**
 * Full sense + score + optional remediations + alert.
 */
async function tick(opts) {
  const o = opts || {};
  _counts.ticks += 1;
  _lastTickAt = _iso();

  const processPlane = senseProcess();
  const commerce = senseCommerce();
  const autonomy = senseAutonomy();
  const deploy = senseDeploy();
  const backup = senseBackup();
  const honestyPlane = senseFakeMetricsGuard();

  const findings = []
    .concat(processPlane.findings || [])
    .concat(commerce.findings || [])
    .concat(autonomy.findings || [])
    .concat(deploy.findings || [])
    .concat(backup.findings || [])
    .concat(honestyPlane.findings || []);

  let score = 0;
  for (const f of findings) score += _severityScore(f.severity);
  const grade = _gradeFromScore(score);

  // Safe remediations
  if (!o.dryRun && autoRemediateEnabled()) {
    for (const f of findings) {
      if (!f.autoRemediation) continue;
      if (f.severity !== 'critical' && f.severity !== 'warn') continue;
      try {
        const r = await _remediate(f);
        if (r && r.ok) f.remediated = true;
        f.remediationResult = r;
      } catch (e) {
        f.remediationResult = { ok: false, error: String(e && e.message || e).slice(0, 80) };
        _counts.errors += 1;
      }
    }
  }

  const verdict = {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    at: _lastTickAt,
    grade,
    score,
    findings,
    planes: {
      process: { heapMb: processPlane.heapMb, rssMb: processPlane.rssMb, uptimeSec: processPlane.uptimeSec },
      commerce: { orders: commerce.orders, realityPresent: !!commerce.reality },
      autonomy: autonomy.organs,
      deploy: { buildSha: deploy.buildSha, integrity: deploy.integrity },
      backup: {
        managedByRocs: false,
        policy: backup.policy,
        fresh: backup.fresh,
        ageMs: backup.ageMs,
        marker: backup.marker,
      },
      honesty: { fakeMetricsRefused: honestyPlane.ok },
    },
    decisionCards: findings
      .filter((f) => f.severity === 'critical' || f.severity === 'warn')
      .map((f) => ({
        severity: f.severity,
        title: f.symptom,
        cause: f.cause,
        doThis: f.action,
        remediated: !!f.remediated,
      })),
    beyond: {
      prometheus: 'Causal verdict graph + money-path SLO — not metric scrapes',
      grafana: 'Telegram/API decision cards with verbs — not chart panels',
      backups: 'Owner periodic backup remains authoritative; ROCS never runs backups',
    },
    policy: policy(),
    honesty: honesty(),
  };

  _lastVerdict = verdict;
  _counts.verdicts += 1;
  if (!o.skipPersist) {
    _appendLedger(verdict);
    _persistState();
  }

  let alert = null;
  if (!o.dryRun && !o.skipAlert && grade !== 'green') {
    alert = await _maybeAlert(verdict);
  }

  return Object.assign({}, verdict, { alert, counts: { ..._counts } });
}

function start(opts) {
  if (!ENABLED) return getStatus();
  if (_timer) return getStatus();
  const o = opts || {};
  _running = true;
  _startedAt = _startedAt || _iso();
  const delay = Math.max(0, Number(o.bootDelayMs != null ? o.bootDelayMs : 8000));
  const boot = () => {
    tick({ source: 'boot' }).catch(() => { _counts.errors += 1; });
    _timer = setInterval(() => {
      tick({ source: 'interval' }).catch(() => { _counts.errors += 1; });
    }, TICK_MS);
    if (_timer.unref) _timer.unref();
  };
  if (delay === 0) boot();
  else {
    const t = setTimeout(boot, delay);
    if (t.unref) t.unref();
  }
  _persistState();
  return getStatus();
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _running = false;
  return getStatus();
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    running: _running && !!_timer,
    enabled: ENABLED,
    startedAt: _startedAt,
    lastTickAt: _lastTickAt,
    lastGrade: _lastVerdict && _lastVerdict.grade,
    lastScore: _lastVerdict && _lastVerdict.score,
    decisionCardCount: _lastVerdict && _lastVerdict.decisionCards
      ? _lastVerdict.decisionCards.length
      : 0,
    counts: { ..._counts },
    tickMs: TICK_MS,
    autoRemediate: autoRemediateEnabled(),
    backupPolicy: 'owner_periodic_external_never_managed_by_rocs',
    policy: policy(),
    honesty: honesty(),
  };
}

function discovery() {
  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    running: _running && !!_timer,
    enabled: ENABLED,
    lastGrade: _lastVerdict && _lastVerdict.grade,
    lastScore: _lastVerdict && _lastVerdict.score,
    lastTickAt: _lastTickAt,
    planes: ['process', 'commerce', 'autonomy', 'deploy', 'backup', 'honesty'],
    endpoints: {
      status: '/api/rocs/status',
      tick: 'POST /api/rocs/tick',
      verdict: '/api/rocs/verdict',
      wellKnown: '/.well-known/rocs.json',
    },
    beyondPrometheus: true,
    beyondGrafana: true,
    managesBackups: false,
    policy: policy(),
    honesty: honesty(),
  };
}

function lastVerdict() {
  return _lastVerdict;
}

module.exports = {
  PROTOCOL,
  INVENTION,
  start,
  stop,
  tick,
  getStatus,
  discovery,
  lastVerdict,
  policy,
  honesty,
  senseProcess,
  senseCommerce,
  senseAutonomy,
  senseDeploy,
  senseBackup,
  // test helpers
  _test: {
    finding,
    ALERT_DEDUP_MS,
    DATA_DIR,
  },
};
