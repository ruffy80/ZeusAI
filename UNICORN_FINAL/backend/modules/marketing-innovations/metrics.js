// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/metrics.js
//
// Prometheus-style text metrics aggregator. Pulls live numbers from
// every sub-engine without modifying them. Always returns text/plain
// in Prom 0.0.4 format. Also offers a JSON view for dashboards.
// =====================================================================

'use strict';

const DISABLED = process.env.MARKETING_METRICS_DISABLED === '1';

function _safe(fn, fallback) { try { return fn(); } catch (_) { return fallback; } }

function snapshot() {
  if (DISABLED) return { disabled: true, metrics: {} };
  const viral = _safe(() => require('./viral-amplifier'), null);
  const innov = _safe(() => require('./self-innovation-loop'), null);
  const affil = _safe(() => require('./affiliate-revenue'), null);
  const out = _safe(() => require('./outbound-publisher'), null);
  const exp = _safe(() => require('./growth-experiments'), null);
  const sched = _safe(() => require('./scheduler'), null);
  const wl = _safe(() => require('./waitlist-mechanic'), null);
  const inf = _safe(() => require('./influencer-crm'), null);
  const ab = _safe(() => require('./abuse-shield'), null);
  const mon = _safe(() => require('./viral-coefficient-monitor'), null);

  const m = {};
  m.viral_boost_factor = _safe(() => Number((viral && viral.boostFactor()) && viral.boostFactor().value) || 0, 0);
  m.viral_loops = _safe(() => (viral && viral.listLoops().length) || 0, 0);
  m.innovation_strategies = _safe(() => (innov && innov.listStrategies({}).length) || 0, 0);
  m.affiliate_count = _safe(() => (affil && affil.listAffiliates().length) || 0, 0);
  m.outbound_dryrun = _safe(() => out && out.status() && out.status().dryRun ? 1 : 0, 0);
  m.experiments_total = _safe(() => exp && exp.status() && exp.status().total || 0, 0);
  m.experiments_active = _safe(() => exp && exp.status() && exp.status().active || 0, 0);
  m.scheduler_pending = _safe(() => sched && sched.status() && sched.status().pending || 0, 0);
  m.scheduler_sent = _safe(() => sched && sched.status() && sched.status().sent || 0, 0);
  m.waitlist_total = _safe(() => wl && wl.summary() && wl.summary().total || 0, 0);
  m.influencers_total = _safe(() => inf && inf.status() && inf.status().total || 0, 0);
  m.abuse_events = _safe(() => ab && ab.status() && ab.status().events || 0, 0);
  m.abuse_suspects = _safe(() => ab && ab.status() && ab.status().suspects || 0, 0);
  m.viral_monitor_alerts = _safe(() => mon && mon.status() && mon.status().alerts || 0, 0);
  m.viral_monitor_accelerations = _safe(() => mon && mon.status() && mon.status().accelerations || 0, 0);
  return { disabled: false, metrics: m };
}

function toProm(snap) {
  const s = snap || snapshot();
  if (s.disabled) return '# marketing metrics disabled\n';
  const lines = ['# Marketing Innovations metrics'];
  for (const [k, v] of Object.entries(s.metrics)) {
    lines.push(`# TYPE marketing_${k} gauge`);
    lines.push(`marketing_${k} ${Number(v) || 0}`);
  }
  return lines.join('\n') + '\n';
}

function status() { return { disabled: DISABLED }; }

module.exports = { snapshot, toProm, status };
