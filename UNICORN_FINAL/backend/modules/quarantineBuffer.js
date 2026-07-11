// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.340Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const stages = [];

function _id() {
  return 'stage_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function stats() {
  return {
    total: stages.length,
    pending: stages.filter((x) => x.state === 'pending').length,
    vetoed: stages.filter((x) => x.state === 'vetoed').length,
    promoted: stages.filter((x) => x.state === 'promoted').length,
  };
}

function list() {
  return stages.slice().reverse();
}

function stage(payload = {}) {
  const rec = { stageId: _id(), state: 'pending', payload, createdAt: new Date().toISOString() };
  stages.push(rec);
  return { ok: true, stage: rec };
}

function veto(stageId, vetoer, reason) {
  const rec = stages.find((x) => x.stageId === String(stageId));
  if (!rec) return { ok: false, error: 'not_found' };
  rec.state = 'vetoed';
  rec.vetoer = vetoer || 'unknown';
  rec.reason = reason || 'unspecified';
  rec.vetoedAt = new Date().toISOString();
  return { ok: true, stage: rec };
}

function forcePromote(stageId) {
  const rec = stages.find((x) => x.stageId === String(stageId));
  if (!rec) return { ok: false, error: 'not_found' };
  rec.state = 'promoted';
  rec.promotedAt = new Date().toISOString();
  return { ok: true, stage: rec };
}

module.exports = { stats, list, stage, veto, forcePromote };
