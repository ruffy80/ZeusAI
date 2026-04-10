// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.148Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.449Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.204Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.288Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.152Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.801Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.989Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

const axios = require('axios');

class OpportunityRadar {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.opportunities = [];
    this.alerts = [];
    this.sources = ['trending_github', 'startup_grants', 'government_programs', 'industry_events', 'funding_rounds', 'partnership_opportunities'];
    this.lastScan = null;
    this.startPeriodicScan();
  }

  startPeriodicScan() {
    setInterval(() => this.scanAllSources(), 2 * 60 * 60 * 1000);
    setTimeout(() => this.scanAllSources(), 5000);
  }

  async scanSource(source) {
    void axios;
    const mockData = {
      trending_github: [{ title: 'AI Agent Framework', description: 'New framework for autonomous agents', relevance: 0.9, link: 'https://github.com/ai-agent' }],
      startup_grants: [{ title: 'EU Innovation Grant', description: '€100,000 for AI startups', deadline: '2025-05-15', amount: 100000, relevance: 0.95 }],
      government_programs: [{ title: 'Digital Transformation Program', description: 'Funding for SMEs', deadline: '2025-06-01', amount: 25000, relevance: 0.7 }],
      industry_events: [{ title: 'AI Summit 2025', description: 'Global AI conference', date: '2025-05-20', location: 'London', relevance: 0.85 }],
      funding_rounds: [{ title: 'VC Fund: AI & Automation', description: 'Seeking early-stage AI startups', amount: '2M-5M', deadline: '2025-07-01', relevance: 0.9 }],
      partnership_opportunities: [{ title: 'AWS Partner Program', description: 'Join AWS partner network', benefits: 'co-marketing, funding', relevance: 0.95 }]
    };
    return mockData[source] || [];
  }

  async scanAllSources() {
    const results = [];
    for (const source of this.sources) {
      try {
        const opportunities = await this.scanSource(source);
        results.push(...opportunities);
      } catch (err) {
        console.error('Error scanning ' + source + ':', err.message);
      }
    }
    this.opportunities = results;
    this.lastScan = new Date().toISOString();
    this.generateAlerts();
  }

  isAlerted(opportunity) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return this.alerts.some(a => a.title === opportunity.title && a.createdAt > oneDayAgo);
  }

  generateAlerts() {
    const newAlerts = [];
    for (const opp of this.opportunities) {
      if (opp.relevance > 0.85 && !this.isAlerted(opp)) {
        newAlerts.push({ ...opp, alertId: Date.now() + '-' + Math.random().toString(36), createdAt: new Date().toISOString(), read: false });
      }
    }
    this.alerts = [...newAlerts, ...this.alerts];
  }

  getOpportunities(filters = {}) {
    let result = [...this.opportunities];
    if (filters.minRelevance) result = result.filter(o => o.relevance >= filters.minRelevance);
    if (filters.deadlineBefore) result = result.filter(o => o.deadline && new Date(o.deadline) <= new Date(filters.deadlineBefore));
    return result.sort((a, b) => b.relevance - a.relevance);
  }

  getUnreadAlerts() {
    return this.alerts.filter(a => !a.read);
  }

  markAlertRead(alertId) {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) alert.read = true;
    return alert;
  }

  getPersonalizedRecommendations(userProfile) {
    const interests = userProfile.interests || [];
    return this.opportunities
      .filter(opp => interests.some(interest => (opp.title + ' ' + opp.description).toLowerCase().includes(String(interest).toLowerCase())))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
  }

  getStats() {
    return {
      lastScan: this.lastScan,
      totalOpportunities: this.opportunities.length,
      unreadAlerts: this.alerts.filter(a => !a.read).length,
      topOpportunities: this.opportunities.slice(0, 5).map(o => ({ title: o.title, relevance: o.relevance })),
      sources: this.sources
    };
  }
}

module.exports = new OpportunityRadar();
