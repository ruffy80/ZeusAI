// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:38:58.445Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:33:19.617Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:28:24.679Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:27:44.399Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.216Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.234Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.093Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.605Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.147Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.448Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.203Z
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
// Data: 2026-04-10T18:53:01.151Z
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

const crypto = require('crypto');

class LegalContractGenerator {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.templates = {
      nda: this.generateNDA.bind(this),
      partnership: this.generatePartnership.bind(this),
      employment: this.generateEmployment.bind(this),
      licensing: this.generateLicensing.bind(this),
      service: this.generateService.bind(this)
    };
    this.analyzedContracts = new Map();
  }

  generateContract(type, params) {
    const generator = this.templates[type];
    if (!generator) throw new Error('Unknown contract type: ' + type);
    const contract = generator(params || {});
    contract.id = crypto.randomBytes(8).toString('hex');
    contract.type = type;
    contract.generatedAt = new Date().toISOString();
    return contract;
  }

  generateNDA(params) {
    const { partyA, partyB, duration, purpose } = params;
    return {
      title: 'Non-Disclosure Agreement',
      parties: { disclosing: partyA, receiving: partyB },
      duration: String(duration || 0) + ' months',
      purpose,
      clauses: ['Confidential Information Definition', 'Obligations of Receiving Party', 'Exclusions', 'Term and Termination', 'Return of Information']
    };
  }

  generatePartnership(params) {
    const { parties, equitySplit, governance, revenueShare } = params;
    const eq = Number(equitySplit || 50);
    const rev = Number(revenueShare || 50);
    return {
      title: 'Partnership Agreement',
      parties,
      equitySplit: eq + '% / ' + (100 - eq) + '%',
      governance,
      revenueShare: rev + '% to partner A, ' + (100 - rev) + '% to partner B',
      clauses: ['Purpose and Scope', 'Capital Contributions', 'Profit and Loss Allocation', 'Management and Control', 'Dispute Resolution']
    };
  }

  generateEmployment(params) {
    const { employee, position, salary, benefits, startDate } = params;
    return {
      title: 'Employment Agreement',
      employee,
      position,
      salary: '$' + String(salary || 0) + '/year',
      benefits,
      startDate,
      clauses: ['Duties and Responsibilities', 'Compensation', 'Benefits', 'Termination', 'Confidentiality']
    };
  }

  generateLicensing(params) {
    const { licensor, licensee, ip, territory, duration, royalty } = params;
    return {
      title: 'License Agreement',
      licensor,
      licensee,
      intellectualProperty: ip,
      territory,
      duration: String(duration || 0) + ' years',
      royalty: String(royalty || 0) + '%',
      clauses: ['Grant of License', 'Royalties', 'Reporting', 'Quality Control', 'Termination']
    };
  }

  generateService(params) {
    const { provider, client, services, price, timeline } = params;
    return {
      title: 'Service Agreement',
      provider,
      client,
      services,
      price: '$' + String(price || 0),
      timeline: String(timeline || 0) + ' days',
      clauses: ['Scope of Services', 'Payment Terms', 'Delivery', 'Acceptance', 'Liability']
    };
  }

  analyzeContract(contractText) {
    const text = String(contractText || '');
    const riskKeywords = ['indemnify', 'unlimited liability', 'exclusive', 'non-compete', 'liquidated damages', 'termination without cause', 'automatic renewal'];
    const risks = [];
    for (const keyword of riskKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        risks.push({ keyword, severity: 'medium', suggestion: 'Review ' + keyword + ' clause carefully' });
      }
    }

    const analysis = {
      id: crypto.randomBytes(8).toString('hex'),
      analyzedAt: new Date().toISOString(),
      wordCount: text.length,
      risks,
      overallRisk: risks.length === 0 ? 'low' : risks.length < 3 ? 'medium' : 'high',
      summary: 'Contract contains ' + risks.length + ' potential risk areas.'
    };

    this.analyzedContracts.set(analysis.id, analysis);
    return analysis;
  }

  getStats() {
    return {
      totalGeneratedTypes: Object.keys(this.templates).length,
      totalAnalyzed: this.analyzedContracts.size,
      averageRiskLevel: 'medium'
    };
  }
}

module.exports = new LegalContractGenerator();
