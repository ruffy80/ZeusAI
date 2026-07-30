'use strict';

/**
 * Edge Bond Signal — EBS/1.0
 * Writes an honest edge/public vs localhost bond snapshot for operators/nginx.
 * Does NOT rewrite nginx upstreams. Never fabricates multi-region failover.
 */

const { isoNow, writeJson, readJson, paths } = require('./_util');

const PROTOCOL = 'EBS/1.0';
const NAME = 'edge-bond-signal';

const state = {
  startedAt: null,
  running: false,
  lastProbeAt: null,
  lastScore: null,
};

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function publish(snapshot = {}) {
  start();
  const payload = {
    protocol: PROTOCOL,
    module: NAME,
    updatedAt: isoNow(),
    localSiteOk: snapshot.localSiteOk !== false,
    localBackendOk: snapshot.localBackendOk !== false,
    publicEdgeOk: snapshot.publicEdgeOk == null ? null : !!snapshot.publicEdgeOk,
    triadScore: snapshot.triadScore != null ? Number(snapshot.triadScore) : null,
    bonded: !!snapshot.bonded,
    reasons: Array.isArray(snapshot.reasons) ? snapshot.reasons.slice(0, 12) : [],
    recommendation: snapshot.recommendation || (
      snapshot.publicEdgeOk === false && snapshot.localSiteOk
        ? 'public_edge_degraded_while_local_green'
        : (snapshot.localSiteOk && snapshot.localBackendOk ? 'serve_normally' : 'maintenance_hint')
    ),
    honesty: {
      rewritesNginx: false,
      multiRegion: false,
      note: 'Signal file for operators/optional nginx map — never auto-rewires upstreams.',
    },
  };
  writeJson(paths.edgeBond(), payload);
  state.lastProbeAt = payload.updatedAt;
  state.lastScore = payload.triadScore;
  return payload;
}

function read() {
  return readJson(paths.edgeBond(), null);
}

function probeFromTriad() {
  start();
  let triad = null;
  try {
    const tbos = require('../triad-bond-os');
    if (tbos && typeof tbos.getScore === 'function') triad = tbos.getScore();
  } catch (_) { /* optional */ }

  let siteOk = true;
  let backendOk = true;
  let publicOk = null;
  const reasons = [];

  try {
    const subos = require('../site-unicorn-bond-os');
    if (subos && typeof subos.getScore === 'function') {
      const s = subos.getScore();
      if (s && s.bonded === false) {
        siteOk = false;
        backendOk = false;
        reasons.push('site_unicorn_unbonded');
      }
    }
  } catch (_) { /* optional */ }

  if (triad) {
    if (triad.bonded === false) reasons.push('triad_unbonded');
    if (Number(triad.score) < 70) reasons.push('triad_score_low');
    // TBOS often includes edge probe — prefer explicit fields when present
    if (triad.planes && triad.planes.edge) {
      publicOk = !!triad.planes.edge.ok;
      if (!publicOk) reasons.push('edge_plane_fail');
    } else if (triad.edge) {
      publicOk = !!triad.edge.ok;
      if (!publicOk) reasons.push('edge_fail');
    }
  }

  return publish({
    localSiteOk: siteOk,
    localBackendOk: backendOk,
    publicEdgeOk: publicOk,
    triadScore: triad && triad.score,
    bonded: !!(triad && triad.bonded),
    reasons,
  });
}

function getStatus() {
  const file = read();
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Edge Bond Signal',
    running: !!state.running,
    startedAt: state.startedAt,
    lastProbeAt: state.lastProbeAt,
    signal: file,
    pathHint: 'data/immortality/edge-bond.json',
    timestamp: isoNow(),
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  publish,
  read,
  probeFromTriad,
  getStatus,
};
