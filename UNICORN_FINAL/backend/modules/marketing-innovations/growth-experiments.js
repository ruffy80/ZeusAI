// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/growth-experiments.js
//
// Landing-page A/B coordinator that rides on the existing
// `bandit-optimizer`. Each experiment registers N variants under a
// dedicated bandit campaign; pickVariant() asks the bandit for the best
// arm; track() forwards click/conversion events to bandit.
// =====================================================================

'use strict';

const crypto = require('crypto');
const bandit = require('./bandit-optimizer');

const DISABLED = process.env.MARKETING_GROWTH_EXPERIMENTS_DISABLED === '1';

const _experiments = new Map(); // expId → { id, name, variants:[{armId, payload}] }

function create(opts) {
  if (DISABLED) return { ok: false, reason: 'disabled' };
  const o = opts || {};
  if (!o.name || !Array.isArray(o.variants) || !o.variants.length) {
    return { ok: false, error: 'name_and_variants_required' };
  }
  const id = o.id || ('EXP-' + crypto.randomBytes(4).toString('hex'));
  const exp = {
    id, name: String(o.name),
    campaign: 'exp:' + id,
    variants: o.variants.map((v, i) => ({
      armId: String(v.armId || ('V' + i)),
      payload: v.payload || v,
    })),
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  _experiments.set(id, exp);
  // Seed each arm with one impression so Thompson Sampling has priors.
  for (const v of exp.variants) bandit.impression(exp.campaign, v.armId, 0);
  return { ok: true, experiment: exp };
}

function pickVariant(id) {
  const exp = _experiments.get(String(id));
  if (!exp) return { ok: false, error: 'unknown' };
  const best = bandit.pickBest(exp.campaign);
  const v = exp.variants.find((x) => x.armId === best.armId) || exp.variants[0];
  bandit.impression(exp.campaign, v.armId);
  return { ok: true, expId: exp.id, armId: v.armId, payload: v.payload };
}

function track(id, evt) {
  const exp = _experiments.get(String(id));
  if (!exp) return { ok: false, error: 'unknown' };
  const e = evt || {};
  const arm = String(e.armId || '');
  if (!arm) return { ok: false, error: 'armId_required' };
  const ev = String(e.event || '').toLowerCase();
  if (ev === 'click') bandit.click(exp.campaign, arm);
  else if (ev === 'no_click') bandit.noClick(exp.campaign, arm);
  else if (ev === 'conversion') bandit.conversion(exp.campaign, arm, { revenueUsd: e.revenueUsd });
  else return { ok: false, error: 'unknown_event' };
  return { ok: true };
}

function close(id) {
  const exp = _experiments.get(String(id));
  if (!exp) return { ok: false, error: 'unknown' };
  exp.status = 'closed';
  exp.closedAt = new Date().toISOString();
  exp.summary = bandit.summary(exp.campaign);
  return { ok: true, experiment: exp };
}

function list() { return Array.from(_experiments.values()).map((e) => ({ ...e })); }
function get(id) { return _experiments.get(String(id)) || null; }
function status() {
  return {
    disabled: DISABLED,
    total: _experiments.size,
    active: Array.from(_experiments.values()).filter((e) => e.status === 'active').length,
  };
}
function _resetForTests() { _experiments.clear(); }

module.exports = { create, pickVariant, track, close, list, get, status, _resetForTests };
