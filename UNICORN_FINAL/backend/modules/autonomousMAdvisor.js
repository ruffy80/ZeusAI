// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Autonomous M&A Advisor (AMAA) Module
// Analizează ținte de achiziție și simulează negocieri M&A.
// Datele sunt mock-uri cu structură realistă.

const crypto = require('crypto');

const MOCK_COMPANIES = [
  { id: 'T001', name: 'TechNova GmbH', industry: 'SaaS', revenue: 12000000, region: 'EU', employees: 85, growthRate: 0.35, ebitdaMargin: 0.22 },
  { id: 'T002', name: 'DataStream Inc', industry: 'AI', revenue: 28000000, region: 'US', employees: 210, growthRate: 0.52, ebitdaMargin: 0.18 },
  { id: 'T003', name: 'GreenFlow Energy', industry: 'CleanTech', revenue: 8500000, region: 'EU', employees: 60, growthRate: 0.28, ebitdaMargin: 0.30 },
  { id: 'T004', name: 'BioGen Labs', industry: 'BioTech', revenue: 45000000, region: 'US', employees: 340, growthRate: 0.15, ebitdaMargin: 0.12 },
  { id: 'T005', name: 'FinSecure Ltd', industry: 'FinTech', revenue: 19000000, region: 'GB', employees: 130, growthRate: 0.40, ebitdaMargin: 0.25 },
  { id: 'T006', name: 'CloudMesh Asia', industry: 'SaaS', revenue: 7200000, region: 'APAC', employees: 55, growthRate: 0.60, ebitdaMargin: 0.20 },
  { id: 'T007', name: 'SecureVault AG', industry: 'Cybersecurity', revenue: 31000000, region: 'EU', employees: 175, growthRate: 0.25, ebitdaMargin: 0.35 },
  { id: 'T008', name: 'AutoLogix Corp', industry: 'Logistics', revenue: 62000000, region: 'US', employees: 420, growthRate: 0.12, ebitdaMargin: 0.08 },
  { id: 'T009', name: 'HealthSync Pte', industry: 'HealthTech', revenue: 14500000, region: 'APAC', employees: 95, growthRate: 0.45, ebitdaMargin: 0.23 },
  { id: 'T010', name: 'MetaRetail SA', industry: 'E-Commerce', revenue: 38000000, region: 'EU', employees: 280, growthRate: 0.20, ebitdaMargin: 0.14 },
];

// Industry-specific EBITDA multiples used for valuation.
// Higher-margin / higher-growth sectors command premium multiples.
const INDUSTRY_MULTIPLES = {
  SaaS: 10, AI: 15, CleanTech: 12, BioTech: 18,
  FinTech: 12, Cybersecurity: 14, Logistics: 6,
  HealthTech: 13, 'E-Commerce': 8,
};

// Amplifier applied to company growth rate to arrive at an adjusted valuation multiple.
// Formula: adjustedMultiple = baseMultiple * (1 + growthRate * GROWTH_RATE_AMPLIFIER)
const GROWTH_RATE_AMPLIFIER = 10;
const negotiations = new Map();

class AutonomousMAdvisor {
  findTargets({ industry, minRevenue = 0, maxRevenue = Infinity, region, minGrowthRate = 0 }) {
    let results = MOCK_COMPANIES.filter(c => {
      if (industry && c.industry.toLowerCase() !== industry.toLowerCase()) return false;
      if (c.revenue < minRevenue || c.revenue > maxRevenue) return false;
      if (region && c.region.toLowerCase() !== region.toLowerCase()) return false;
      if (c.growthRate < minGrowthRate) return false;
      return true;
    });

    // Score targets
    return results.map(c => ({
      ...c,
      acquisitionScore: this._scoreTarget(c),
      estimatedValuation: this._estimateValuation(c),
      currency: 'USD',
    })).sort((a, b) => b.acquisitionScore - a.acquisitionScore);
  }

  _scoreTarget(company) {
    const growthScore = Math.min(company.growthRate * 100, 30);
    const marginScore = Math.min(company.ebitdaMargin * 100, 25);
    const sizeScore = Math.min(company.revenue / 2000000, 25);
    const efficiencyScore = Math.min((company.revenue / company.employees) / 10000, 20);
    return parseFloat((growthScore + marginScore + sizeScore + efficiencyScore).toFixed(1));
  }

  _estimateValuation(company) {
    // EBITDA multiple valuation: base multiple is industry-specific,
    // adjusted upward by growth rate using GROWTH_RATE_AMPLIFIER.
    const growthMultiplier = 1 + company.growthRate * GROWTH_RATE_AMPLIFIER;
    const baseMultiple = INDUSTRY_MULTIPLES[company.industry] || 8;
    const multiple = Math.min(baseMultiple * growthMultiplier, 25);
    const ebitda = company.revenue * company.ebitdaMargin;
    return {
      low: Math.round(ebitda * multiple * 0.8),
      mid: Math.round(ebitda * multiple),
      high: Math.round(ebitda * multiple * 1.2),
      multipleUsed: parseFloat(multiple.toFixed(1)),
    };
  }

  analyzeTarget(targetId) {
    const company = MOCK_COMPANIES.find(c => c.id === targetId);
    if (!company) throw new Error(`Target ${targetId} not found`);

    const analysisId = 'AMAA-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const valuation = this._estimateValuation(company);
    const score = this._scoreTarget(company);

    const analysis = {
      id: analysisId,
      targetId,
      company: { ...company },
      acquisitionScore: score,
      valuation: { ...valuation, currency: 'USD' },
      synergies: {
        revenueSynergies: Math.round(company.revenue * 0.15),
        costSynergies: Math.round(company.revenue * company.ebitdaMargin * 0.20),
        technologySynergies: company.industry === 'AI' || company.industry === 'SaaS' ? 'HIGH' : 'MEDIUM',
        marketExpansion: company.region !== 'US' ? 'HIGH' : 'MEDIUM',
        totalSynergyValue: Math.round(company.revenue * 0.15 + company.revenue * company.ebitdaMargin * 0.20),
      },
      risks: {
        integrationRisk: company.employees > 300 ? 'HIGH' : 'MEDIUM',
        regulatoryRisk: company.industry === 'FinTech' || company.industry === 'HealthTech' ? 'HIGH' : 'LOW',
        retentionRisk: company.growthRate > 0.40 ? 'HIGH' : 'MEDIUM',
        culturalFitScore: Math.round(Math.random() * 30 + 60),
        overallRisk: score > 70 ? 'LOW' : score > 50 ? 'MEDIUM' : 'HIGH',
      },
      dueDiligence: {
        financialDDRequired: true,
        legalDDRequired: true,
        technicalDDRequired: company.industry === 'AI' || company.industry === 'SaaS',
        estimatedDDWeeks: Math.ceil(company.employees / 50),
      },
      recommendation: score > 70 ? 'STRONG_BUY' : score > 50 ? 'BUY' : score > 30 ? 'NEUTRAL' : 'PASS',
      generatedAt: new Date().toISOString(),
    };

    analyses.set(analysisId, analysis);
    return analysis;
  }

  startNegotiation({ targetId, acquirerId, offerPrice, terms, aiNegotiatorModule }) {
    const company = MOCK_COMPANIES.find(c => c.id === targetId);
    if (!company) throw new Error(`Target ${targetId} not found`);

    const valuation = this._estimateValuation(company);

    // Use aiNegotiator module if available
    if (aiNegotiatorModule) {
      const negotiation = aiNegotiatorModule.startNegotiation({
        dealType: 'M&A',
        asset: company.name,
        initialOffer: offerPrice || valuation.low,
        targetPrice: valuation.mid,
        currentOffer: offerPrice || valuation.low,
        maxOffer: valuation.high,
        context: { acquirerId, targetId, terms },
      });

      negotiations.set(negotiation.id, {
        ...negotiation,
        targetCompany: company,
        valuation,
        acquirerId,
      });

      return { negotiationId: negotiation.id, ...negotiation, targetCompany: company, valuation };
    }

    // Fallback: basic negotiation simulation
    const negId = 'NEG-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const neg = {
      id: negId,
      targetId,
      acquirerId,
      targetCompany: company,
      valuation,
      offerPrice: offerPrice || valuation.low,
      counterOffer: valuation.mid,
      status: 'in_progress',
      round: 1,
      terms: terms || {},
      startedAt: new Date().toISOString(),
      _note: 'Provide aiNegotiatorModule for advanced negotiation AI',
    };
    negotiations.set(negId, neg);
    return neg;
  }

  getNegotiation(id) {
    const neg = negotiations.get(id);
    if (!neg) throw new Error(`Negotiation ${id} not found`);
    return neg;
  }

  getStats() {
    return {
      totalTargets: MOCK_COMPANIES.length,
      analysesCompleted: analyses.size,
      activeNegotiations: Array.from(negotiations.values()).filter(n => n.status === 'in_progress').length,
      averageScore: MOCK_COMPANIES.reduce((s, c) => s + this._scoreTarget(c), 0) / MOCK_COMPANIES.length,
    };
  }
}

module.exports = new AutonomousMAdvisor();
