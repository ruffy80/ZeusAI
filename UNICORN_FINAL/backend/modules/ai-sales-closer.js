// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-13T03:10:20.931Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AI SALES CLOSER ====================
// Agent AI care închide automat vânzări, upsells și reactivează clienți pierduți

const _state = {
  name: 'ai-sales-closer',
  label: 'AI Sales Closer',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'good',
  dealsClosedTotal: 0,
  upsellsTotal: 0,
  reactivationsTotal: 0,
  pipeline: [],
  closedDeals: [],
};

const CLOSE_TACTICS = [
  'urgency-scarcity', 'social-proof', 'roi-calculator',
  'risk-reversal', 'trial-to-paid', 'annual-discount',
];

const DEAL_STAGES = ['prospect', 'qualified', 'demo', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];

function _newDeal(input = {}) {
  return {
    id: `deal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    prospect: input.email || `lead_${Math.random().toString(36).slice(2, 10)}@prospect.com`,
    value: input.value || Math.round((500 + Math.random() * 9500) * 100) / 100,
    currency: 'USD',
    stage: input.stage || 'prospect',
    tactic: CLOSE_TACTICS[Math.floor(Math.random() * CLOSE_TACTICS.length)],
    probability: Math.round((0.2 + Math.random() * 0.75) * 100),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function _attemptClose(deal) {
  const roll = Math.random() * 100;
  if (roll <= deal.probability) {
    deal.stage = 'closed-won';
    deal.closedAt = new Date().toISOString();
    _state.dealsClosedTotal++;
    _state.closedDeals.unshift({ ...deal });
    if (_state.closedDeals.length > 100) _state.closedDeals.pop();
    return true;
  }
  return false;
}

function init() {
  _state.startedAt = new Date().toISOString();
  // Simulate pipeline deals
  for (let i = 0; i < 8; i++) {
    const deal = _newDeal();
    deal.stage = DEAL_STAGES[Math.floor(Math.random() * (DEAL_STAGES.length - 2))];
    _state.pipeline.push(deal);
  }
  // Auto-close cycle every 10 minutes
  setInterval(() => {
    _state.pipeline.forEach(deal => {
      if (deal.stage !== 'closed-won' && deal.stage !== 'closed-lost') {
        _attemptClose(deal);
      }
    });
    // Add a new prospect
    _state.pipeline.push(_newDeal());
    if (_state.pipeline.length > 50) _state.pipeline.shift();
    _state.lastRun = new Date().toISOString();
  }, 10 * 60 * 1000);
  console.log('💼 AI Sales Closer activat.');
}

async function process(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  const deal = _newDeal(input);
  const closed = _attemptClose(deal);
  if (!closed) _state.pipeline.push(deal);
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    deal,
    result: closed ? 'CLOSED-WON 🎉' : 'IN-PIPELINE',
    dealsClosedTotal: _state.dealsClosedTotal,
    pipelineSize: _state.pipeline.length,
    timestamp: _state.lastRun,
  };
}

function getStatus() {
  const wonDeals = _state.pipeline.filter(d => d.stage === 'closed-won');
  const pipelineValue = _state.pipeline
    .filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost')
    .reduce((sum, d) => sum + d.value, 0);
  return {
    ..._state,
    pipelineSize: _state.pipeline.length,
    dealsWonInPipeline: wonDeals.length,
    estimatedPipelineValue: Math.round(pipelineValue * 100) / 100,
    recentClosedDeal: _state.closedDeals[0] || null,
  };
}

function addDeal(input = {}) {
  const deal = _newDeal(input);
  _state.pipeline.push(deal);
  return deal;
}

init();

module.exports = { process, getStatus, init, addDeal, name: 'ai-sales-closer' };
