// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:38:58.448Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:33:19.619Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:28:24.682Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:27:44.402Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.220Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.237Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.095Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.607Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.151Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.451Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.207Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.290Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.153Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.803Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.991Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

class RiskAnalyzer {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.riskHistory = [];
    this.riskModels = {
      financial: this.analyzeFinancialRisk.bind(this),
      operational: this.analyzeOperationalRisk.bind(this),
      security: this.analyzeSecurityRisk.bind(this),
      market: this.analyzeMarketRisk.bind(this)
    };
  }

  async analyzeRisk(type, data) {
    const model = this.riskModels[type];
    if (!model) throw new Error('Unknown risk type: ' + type);
    const result = await model(data);
    const analysis = {
      type,
      timestamp: new Date().toISOString(),
      data: { ...data, sensitive: '***' },
      riskScore: this.calculateRiskScore(result),
      confidence: result.confidence || 0.85,
      factors: result.factors,
      recommendations: this.generateRecommendations(type, result),
      monteCarlo: this.runMonteCarloSimulation(data, 1000)
    };
    this.riskHistory.push(analysis);
    return analysis;
  }

  async analyzeFinancialRisk(data) {
    const amount = Number(data.amount || 0);
    const factors = {
      amountRisk: Math.min(amount / 1000000, 1),
      volatilityRisk: data.volatility || 0.5,
      leverageRisk: Math.min((data.leverage || 1) / 10, 1),
      historicalRisk: (data.history && data.history.defaultRate) || 0.1
    };
    const totalRisk = factors.amountRisk * 0.3 + factors.volatilityRisk * 0.3 + factors.leverageRisk * 0.2 + factors.historicalRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.85, valueAtRisk: amount * totalRisk, expectedLoss: amount * totalRisk * 0.5 };
  }

  async analyzeOperationalRisk(data) {
    const factors = {
      complexityRisk: Math.min((data.complexity || 0) / 10, 1),
      dependencyRisk: Math.min((data.dependencies || 0) / 20, 1),
      redundancyRisk: data.redundancy ? 0.2 : 0.8,
      experienceRisk: Math.max(0, 1 - ((data.teamExperience || 0) / 100))
    };
    const totalRisk = factors.complexityRisk * 0.3 + factors.dependencyRisk * 0.25 + factors.redundancyRisk * 0.25 + factors.experienceRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.75, mitigationCost: totalRisk * 10000 };
  }

  async analyzeSecurityRisk(data) {
    const factors = {
      encryptionRisk: data.encryption ? 0.1 : 0.9,
      authRisk: data.authMethod === 'mfa' ? 0.1 : data.authMethod === '2fa' ? 0.3 : 0.7,
      vulnerabilityRisk: data.vulnerabilityScore ? data.vulnerabilityScore / 10 : 0.5,
      incidentRisk: Math.min((data.pastIncidents || 0) / 10, 1)
    };
    const totalRisk = factors.encryptionRisk * 0.25 + factors.authRisk * 0.3 + factors.vulnerabilityRisk * 0.25 + factors.incidentRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.9, breachProbability: totalRisk * 0.1, recommendedControls: this.getSecurityControls(totalRisk) };
  }

  async analyzeMarketRisk(data) {
    const factors = {
      volatilityRisk: data.volatility || 0.4,
      correlationRisk: Math.abs(data.correlation || 0.5),
      betaRisk: Math.min(Math.abs(data.beta || 1) / 3, 1),
      trendRisk: data.marketTrend === 'bear' ? 0.8 : data.marketTrend === 'bull' ? 0.2 : 0.5
    };
    const totalRisk = factors.volatilityRisk * 0.3 + factors.correlationRisk * 0.2 + factors.betaRisk * 0.3 + factors.trendRisk * 0.2;
    return { score: totalRisk, factors, confidence: 0.7, expectedReturn: data.expectedReturn || 0.1, sharpeRatio: ((data.expectedReturn || 0.1) - 0.02) / (totalRisk || 0.1) };
  }

  calculateRiskScore(analysis) {
    if (analysis.score < 0.2) return 'low';
    if (analysis.score < 0.5) return 'medium';
    if (analysis.score < 0.8) return 'high';
    return 'critical';
  }

  getSecurityControls(riskScore) {
    const controls = [];
    if (riskScore > 0.3) controls.push('Enable MFA for all users');
    if (riskScore > 0.5) controls.push('Implement data encryption at rest');
    if (riskScore > 0.7) controls.push('Conduct weekly security audits');
    if (riskScore > 0.9) controls.push('Hire external security firm');
    return controls;
  }

  generateRecommendations(type, analysis) {
    const recs = [];
    if (type === 'financial' && analysis.score > 0.5) recs.push('Reduce position size or add hedging');
    if (type === 'operational' && analysis.factors.redundancyRisk > 0.5) recs.push('Implement redundant systems');
    if (type === 'security') recs.push(...analysis.recommendedControls);
    if (type === 'market' && analysis.score > 0.6) recs.push('Reduce market exposure');
    if (recs.length === 0) recs.push('Risk level acceptable, continue monitoring');
    return recs;
  }

  runMonteCarloSimulation(data, iterations = 1000) {
    const amount = Number(data.amount || 1000);
    const results = [];
    for (let i = 0; i < iterations; i++) results.push(amount * (0.5 + Math.random()));
    results.sort((a, b) => a - b);
    return {
      p10: results[Math.floor(iterations * 0.1)],
      p50: results[Math.floor(iterations * 0.5)],
      p90: results[Math.floor(iterations * 0.9)],
      mean: results.reduce((a, b) => a + b, 0) / iterations
    };
  }

  getHistory(limit = 100) {
    return this.riskHistory.slice(-limit);
  }

  getStats() {
    const highRisk = this.riskHistory.filter(r => r.riskScore === 'high' || r.riskScore === 'critical').length;
    return {
      totalAnalyses: this.riskHistory.length,
      highRiskCount: highRisk,
      averageRiskScore: this.riskHistory.reduce((sum, r) => sum + (r.riskScore === 'low' ? 0.1 : r.riskScore === 'medium' ? 0.3 : r.riskScore === 'high' ? 0.7 : 0.9), 0) / (this.riskHistory.length || 1),
      lastAnalysis: this.riskHistory[this.riskHistory.length - 1] || null
    };
  }
}

module.exports = new RiskAnalyzer();
