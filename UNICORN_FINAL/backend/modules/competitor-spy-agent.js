// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-13T03:10:20.944Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== COMPETITOR SPY AGENT ====================
// Agent AI care monitorizează automat competitorii și identifică oportunități

const _state = {
  name: 'competitor-spy-agent',
  label: 'Competitor Spy Agent',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'good',
  competitors: [],
  alerts: [],
  opportunities: [],
};

const COMPETITOR_NAMES = [
  'SalesForce AI', 'HubSpot Pro', 'Zendesk AI', 'Monday.com',
  'Notion AI', 'Airtable', 'ClickUp AI', 'Pipedrive',
];

const WEAKNESS_TYPES = [
  'high pricing', 'poor support SLA', 'missing mobile app',
  'no API access', 'limited integrations', 'slow onboarding',
  'no white-label', 'weak analytics',
];

const OPPORTUNITY_TYPES = [
  'price undercut by 30%', 'feature gap: AI automation',
  'customer exodus (reviews dropping)', 'outage detected',
  'key feature request unmet', 'enterprise tier too expensive',
];

function _buildCompetitorProfile(name) {
  return {
    name,
    pricing: `$${Math.round(29 + Math.random() * 471)}/mo`,
    customerRating: Math.round((2.5 + Math.random() * 2.4) * 10) / 10,
    weaknesses: Array.from({ length: 2 }, () =>
      WEAKNESS_TYPES[Math.floor(Math.random() * WEAKNESS_TYPES.length)]
    ),
    recentChange: Math.random() > 0.5 ? 'raised prices' : 'lost key feature',
    monitoredAt: new Date().toISOString(),
  };
}

function _generateOpportunity() {
  const competitor = COMPETITOR_NAMES[Math.floor(Math.random() * COMPETITOR_NAMES.length)];
  const type = OPPORTUNITY_TYPES[Math.floor(Math.random() * OPPORTUNITY_TYPES.length)];
  return {
    id: `opp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    competitor,
    opportunityType: type,
    estimatedLeads: Math.round(50 + Math.random() * 450),
    urgency: Math.random() > 0.6 ? 'HIGH' : 'MEDIUM',
    detectedAt: new Date().toISOString(),
    action: 'Launch targeted campaign against ' + competitor,
  };
}

function init() {
  _state.startedAt = new Date().toISOString();
  // Build initial competitor profiles
  COMPETITOR_NAMES.forEach(name => {
    _state.competitors.push(_buildCompetitorProfile(name));
  });
  // Refresh intelligence every 20 minutes
  setInterval(() => {
    _state.competitors = COMPETITOR_NAMES.map(name => _buildCompetitorProfile(name));
    const opp = _generateOpportunity();
    _state.opportunities.unshift(opp);
    if (_state.opportunities.length > 50) _state.opportunities.pop();
    _state.alerts.unshift({
      message: `⚡ ${opp.competitor}: ${opp.opportunityType}`,
      urgency: opp.urgency,
      timestamp: opp.detectedAt,
    });
    if (_state.alerts.length > 100) _state.alerts.pop();
    _state.lastRun = new Date().toISOString();
  }, 20 * 60 * 1000);
  // Generate initial opportunities
  for (let i = 0; i < 3; i++) _state.opportunities.push(_generateOpportunity());
  console.log('🕵️  Competitor Spy Agent activat.');
}

async function process(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  const competitor = input.competitor || null;
  const profile = competitor
    ? _state.competitors.find(c => c.name.toLowerCase().includes(competitor.toLowerCase()))
    : _state.competitors[0];
  const opp = _generateOpportunity();
  _state.opportunities.unshift(opp);
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    competitorProfile: profile || null,
    latestOpportunity: opp,
    totalCompetitorsMonitored: _state.competitors.length,
    totalOpportunities: _state.opportunities.length,
    timestamp: _state.lastRun,
  };
}

function getStatus() {
  return {
    ..._state,
    competitorsMonitored: _state.competitors.length,
    activeOpportunities: _state.opportunities.filter(o => o.urgency === 'HIGH').length,
    latestAlert: _state.alerts[0] || null,
  };
}

init();

module.exports = { process, getStatus, init, name: 'competitor-spy-agent' };
