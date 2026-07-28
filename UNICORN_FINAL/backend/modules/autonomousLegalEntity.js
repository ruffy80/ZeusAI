// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Autonomous Legal Entity (ALE) Module
// Permite înregistrarea simulată a entităților juridice și calcularea taxelor.
// Ready for integration with real country registry APIs.

const crypto = require('crypto');

const SUPPORTED_COUNTRIES = {
  RO: { name: 'Romania', currency: 'RON', taxRates: { LLC: 0.16, SA: 0.16, PFA: 0.10 }, processingDays: 3 },
  US: { name: 'United States', currency: 'USD', taxRates: { LLC: 0.21, Corp: 0.21, Partnership: 0.15 }, processingDays: 7 },
  DE: { name: 'Germany', currency: 'EUR', taxRates: { GmbH: 0.30, AG: 0.30, UG: 0.25 }, processingDays: 14 },
  SG: { name: 'Singapore', currency: 'SGD', taxRates: { Pte_Ltd: 0.17, Sole_Prop: 0.22 }, processingDays: 1 },
  GB: { name: 'United Kingdom', currency: 'GBP', taxRates: { Ltd: 0.25, LLP: 0.20, PLC: 0.25 }, processingDays: 5 },
  AE: { name: 'UAE', currency: 'AED', taxRates: { LLC: 0.09, Freezone: 0.0 }, processingDays: 2 },
};

const registrations = new Map();

class AutonomousLegalEntity {
  register({ country, entityType, companyData }) {
    const countryInfo = SUPPORTED_COUNTRIES[country];
    if (!countryInfo) throw new Error(`Country ${country} not supported`);

    const id = 'ALE-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const taxRate = countryInfo.taxRates[entityType];
    if (taxRate === undefined) {
      throw new Error(`Entity type ${entityType} not supported in ${country}`);
    }

    const registration = {
      id,
      country,
      countryName: countryInfo.name,
      entityType,
      companyData: { ...companyData },
      status: 'demo_pending',
      demo: true,
      live: false,
      taxRate,
      currency: countryInfo.currency,
      documents: {
        registrationCertificate: null,
        articlesOfAssociation: null,
        taxRegistration: null,
        note: 'No government registry URLs — demo only until real API integration',
      },
      estimatedCompletionDays: countryInfo.processingDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _pendingTimerId: null,
      _externalApiEndpoint: null,
      note: 'Autonomous legal entity is a demo surface — not a government filing',
    };

    registrations.set(id, registration);

    // Demo timer: stay demo_pending → demo_ready (never claim live government registration).
    registration._pendingTimerId = setTimeout(() => {
      const r = registrations.get(id);
      if (r && (r.status === 'pending' || r.status === 'demo_pending')) {
        r.status = 'demo_ready';
        r.live = false;
        r.demo = true;
        r.updatedAt = new Date().toISOString();
        r.registrationNumber = null;
        r._pendingTimerId = null;
        registrations.set(id, r);
      }
    }, 5000);

    return { ...registration, _pendingTimerId: undefined };
  }

  getStatus(id) {
    const reg = registrations.get(id);
    if (!reg) throw new Error(`Registration ${id} not found`);
    return reg;
  }

  calculateTax(id, { annualRevenue, deductions = 0 }) {
    const reg = registrations.get(id);
    if (!reg) throw new Error(`Registration ${id} not found`);

    const taxableIncome = Math.max(0, annualRevenue - deductions);
    const taxOwed = taxableIncome * reg.taxRate;
    const effectiveRate = annualRevenue > 0 ? (taxOwed / annualRevenue) : 0;

    return {
      registrationId: id,
      country: reg.country,
      entityType: reg.entityType,
      annualRevenue,
      deductions,
      taxableIncome,
      taxRate: reg.taxRate,
      taxOwed: parseFloat(taxOwed.toFixed(2)),
      effectiveRate: parseFloat(effectiveRate.toFixed(4)),
      currency: reg.currency,
      calculatedAt: new Date().toISOString(),
    };
  }

  listAll() {
    return Array.from(registrations.values());
  }

  getSupportedCountries() {
    return Object.entries(SUPPORTED_COUNTRIES).map(([code, info]) => ({
      code,
      name: info.name,
      currency: info.currency,
      entityTypes: Object.keys(info.taxRates),
      processingDays: info.processingDays,
    }));
  }
}

// MeshOrchestrator expects a status function (getStatus)
const instance = new AutonomousLegalEntity();
instance.getStatus = function() {
  // Return all registrations, or supported countries if none
  const regs = this.listAll();
  return regs.length ? regs : { supportedCountries: this.getSupportedCountries() };
};
module.exports = instance;
