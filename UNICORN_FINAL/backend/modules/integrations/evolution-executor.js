// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

/**
 * EVOLUTION EXECUTOR (complementary)
 *
 * Reads APPROVED proposals from the existing auto-innovation-loop.
 * Does NOT modify the loop. For each approved proposal it produces a
 * deterministic execution plan + lightweight code stub under
 * generated/evolution/<id>/, marks it executed, and exposes status at
 * /api/integrations/evolution-executor/state.
 *
 * Real PR creation remains the responsibility of auto-innovation-loop;
 * this executor only materializes the local artefact so engineers can
 * inspect it and self-evolving-engine can pick it up.
 */

const fs   = require('fs');
const path = require('path');

const POLL_MS  = parseInt(process.env.EVO_EXEC_POLL_MS || '300000', 10); // 5 min
const OUT_DIR  = path.join(__dirname, '..', '..', '..', 'generated', 'evolution');

const _state = {
  name: 'evolution-executor',
  startedAt: null,
  executed: new Set(),
  lastRun: null,
  artifacts: [],
  lastError: null,
};

function _scaffold(proposal) {
  const id = proposal.id || ('p_' + Date.now().toString(36));
  const dir = path.join(OUT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const plan = {
    id,
    type: proposal.type || 'feature',
    title: proposal.title || 'Auto-evolution',
    description: proposal.description || '',
    createdAt: new Date().toISOString(),
    status: 'scaffolded',
    files: ['plan.json', 'patch.md'],
  };
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'patch.md'),
    `# Auto-evolution patch\n\nProposal: ${plan.title}\nType: ${plan.type}\n\n${plan.description}\n`,
    'utf8');
  return { id, dir, plan };
}

function _runOnce() {
  _state.lastRun = new Date().toISOString();
  try {
    const loop = require('../auto-innovation-loop');
    let approved = [];
    if (typeof loop.getApprovedProposals === 'function') {
      approved = loop.getApprovedProposals();
    } else if (typeof loop.getProposals === 'function') {
      const all = loop.getProposals(50) || [];
      approved = all.filter(p => p && (p.status === 'approved' || p.status === 'merged'));
    }
    for (const p of approved) {
      const id = p && p.id;
      if (!id || _state.executed.has(id)) continue;
      const out = _scaffold(p);
      _state.executed.add(id);
      _state.artifacts.unshift({ id: out.id, dir: out.dir, at: new Date().toISOString() });
      if (_state.artifacts.length > 100) _state.artifacts.length = 100;
    }
    _state.lastError = null;
  } catch (e) {
    _state.lastError = e && e.message;
  }
}

function init({ app } = {}) {
  if (_state.startedAt) return;
  _state.startedAt = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  setTimeout(_runOnce, 5000).unref();
  setInterval(_runOnce, POLL_MS).unref();

  if (app && typeof app.get === 'function') {
    app.get('/api/integrations/evolution-executor/state', (_req, res) => {
      res.json({ ok: true, state: { ..._state, executed: Array.from(_state.executed) } });
    });
  }
}

function getStatus() { return { name: _state.name, startedAt: _state.startedAt, executed: _state.executed.size, lastRun: _state.lastRun }; }

module.exports = { name: 'evolution-executor', init, getStatus, _runOnce };
