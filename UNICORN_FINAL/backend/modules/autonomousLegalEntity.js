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
      status: 'pending',
      taxRate,
      currency: countryInfo.currency,
      documents: {
        registrationCertificate: `https://registry.${country.toLowerCase()}.gov/cert/${id}.pdf`,
        articlesOfAssociation: `https://registry.${country.toLowerCase()}.gov/aoa/${id}.pdf`,
        taxRegistration: `https://tax.${country.toLowerCase()}.gov/reg/${id}.pdf`,
      },
      estimatedCompletionDays: countryInfo.processingDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _pendingTimerId: null,
      // Hook: replace with real API call to country registry
      _externalApiEndpoint: `https://api.${country.toLowerCase()}-registry.gov/v1/register`,
    };

    registrations.set(id, registration);

    // Simulate async approval after processingDays (demo: 5s).
    // Timer ID is stored so it can be cancelled if the registration is deleted.
    registration._pendingTimerId = setTimeout(() => {
      const r = registrations.get(id);
      if (r && r.status === 'pending') {
        r.status = 'active';
        r.updatedAt = new Date().toISOString();
        r.registrationNumber = country + '-' + Math.floor(Math.random() * 9000000 + 1000000);
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

module.exports = new AutonomousLegalEntity();
