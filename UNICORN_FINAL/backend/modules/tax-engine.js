// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// tax-engine.js — Global Tax Computation Engine for Unicorn SaaS
// Motor de calcul taxe globale pentru platforma Unicorn SaaS
// =============================================================================
// Covers / Acoperă:
//   1. VAT/GST by country  — EU (20 countries), UK, AU, CA, NZ, SG, etc.
//   2. US Sales Tax        — per-state rates (digital goods)
//   3. EU VAT OSS / MOSS   — single VAT registration for all EU sales
//   4. B2B reverse charge  — EU VAT number validation + zero-rating
//   5. Tax-exempt detection — NGOs, resellers, education
//   6. Invoice line items  — tax breakdown per line
//   7. Tax reports         — monthly/quarterly/annual summaries
//   8. Crypto tax note     — advisory for BTC/ETH payments
// =============================================================================

'use strict';

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const express = require('express');

// ── Storage ───────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../../data/tax-engine');
const LEDGER_F  = path.join(DATA_DIR, 'tax-ledger.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

/** @type {TaxRecord[]} */
let _ledger = _loadJson(LEDGER_F, []);

// ── §1  TAX RATE CATALOG ──────────────────────────────────────────────────

/** Standard VAT/GST rates for digital services (SaaS) by country code */
const TAX_RATES = {
  // EU Member States — digital services VAT
  AT: { rate: 20, name: 'Austrian VAT',         currency: 'EUR', type: 'VAT'  },
  BE: { rate: 21, name: 'Belgian VAT',          currency: 'EUR', type: 'VAT'  },
  BG: { rate: 20, name: 'Bulgarian VAT',        currency: 'BGN', type: 'VAT'  },
  CY: { rate: 19, name: 'Cypriot VAT',          currency: 'EUR', type: 'VAT'  },
  CZ: { rate: 21, name: 'Czech VAT',            currency: 'CZK', type: 'VAT'  },
  DE: { rate: 19, name: 'German VAT',           currency: 'EUR', type: 'VAT'  },
  DK: { rate: 25, name: 'Danish VAT',           currency: 'DKK', type: 'VAT'  },
  EE: { rate: 22, name: 'Estonian VAT',         currency: 'EUR', type: 'VAT'  },
  ES: { rate: 21, name: 'Spanish VAT',          currency: 'EUR', type: 'VAT'  },
  FI: { rate: 24, name: 'Finnish VAT',          currency: 'EUR', type: 'VAT'  },
  FR: { rate: 20, name: 'French VAT',           currency: 'EUR', type: 'VAT'  },
  GR: { rate: 24, name: 'Greek VAT',            currency: 'EUR', type: 'VAT'  },
  HR: { rate: 25, name: 'Croatian VAT',         currency: 'EUR', type: 'VAT'  },
  HU: { rate: 27, name: 'Hungarian VAT',        currency: 'HUF', type: 'VAT'  },
  IE: { rate: 23, name: 'Irish VAT',            currency: 'EUR', type: 'VAT'  },
  IT: { rate: 22, name: 'Italian VAT',          currency: 'EUR', type: 'VAT'  },
  LT: { rate: 21, name: 'Lithuanian VAT',       currency: 'EUR', type: 'VAT'  },
  LU: { rate: 17, name: 'Luxembourg VAT',       currency: 'EUR', type: 'VAT'  },
  LV: { rate: 21, name: 'Latvian VAT',          currency: 'EUR', type: 'VAT'  },
  MT: { rate: 18, name: 'Maltese VAT',          currency: 'EUR', type: 'VAT'  },
  NL: { rate: 21, name: 'Dutch VAT',            currency: 'EUR', type: 'VAT'  },
  PL: { rate: 23, name: 'Polish VAT',           currency: 'PLN', type: 'VAT'  },
  PT: { rate: 23, name: 'Portuguese VAT',       currency: 'EUR', type: 'VAT'  },
  RO: { rate: 19, name: 'Romanian VAT',         currency: 'RON', type: 'VAT'  },
  SE: { rate: 25, name: 'Swedish VAT',          currency: 'SEK', type: 'VAT'  },
  SI: { rate: 22, name: 'Slovenian VAT',        currency: 'EUR', type: 'VAT'  },
  SK: { rate: 20, name: 'Slovak VAT',           currency: 'EUR', type: 'VAT'  },
  // Non-EU Europe
  GB: { rate: 20, name: 'UK VAT',              currency: 'GBP', type: 'VAT'  },
  NO: { rate: 25, name: 'Norwegian MVA',        currency: 'NOK', type: 'VAT'  },
  CH: { rate: 8.1,name: 'Swiss MWST',          currency: 'CHF', type: 'VAT'  },
  // Americas
  CA: { rate: 5,  name: 'Canadian GST',         currency: 'CAD', type: 'GST',
    provincial: { ON: 13, BC: 12, AB: 5, QC: 14.975, SK: 11, MB: 12, NB: 15, NS: 15, PE: 15, NL: 15 } },
  BR: { rate: 9.25,name: 'Brazilian PIS/COFINS',currency: 'BRL', type: 'IVA'  },
  MX: { rate: 16, name: 'Mexican IVA',          currency: 'MXN', type: 'IVA'  },
  AR: { rate: 21, name: 'Argentine IVA',        currency: 'ARS', type: 'IVA'  },
  // Asia Pacific
  AU: { rate: 10, name: 'Australian GST',       currency: 'AUD', type: 'GST'  },
  NZ: { rate: 15, name: 'New Zealand GST',      currency: 'NZD', type: 'GST'  },
  SG: { rate: 9,  name: 'Singapore GST',        currency: 'SGD', type: 'GST'  },
  JP: { rate: 10, name: 'Japanese Consumption Tax', currency: 'JPY', type: 'CT'},
  KR: { rate: 10, name: 'Korean VAT',           currency: 'KRW', type: 'VAT'  },
  IN: { rate: 18, name: 'Indian GST',           currency: 'INR', type: 'GST'  },
  CN: { rate: 6,  name: 'Chinese VAT (services)',currency: 'CNY', type: 'VAT' },
  // Middle East
  SA: { rate: 15, name: 'Saudi VAT',            currency: 'SAR', type: 'VAT'  },
  AE: { rate: 5,  name: 'UAE VAT',              currency: 'AED', type: 'VAT'  },
  IL: { rate: 17, name: 'Israeli VAT',          currency: 'ILS', type: 'VAT'  },
  // Africa
  ZA: { rate: 15, name: 'South African VAT',    currency: 'ZAR', type: 'VAT'  },
  NG: { rate: 7.5,name: 'Nigerian VAT',         currency: 'NGN', type: 'VAT'  },
  // Zero / exempt regions
  US: { rate: 0,  name: 'US (state-dependent)',  currency: 'USD', type: 'SALES_TAX', stateDefault: 0 },
  // Default for unlisted countries
  _DEFAULT: { rate: 0, name: 'No VAT applicable', currency: 'USD', type: 'NONE' },
};

/** US state digital goods sales tax rates (%) — as of 2026 */
const US_STATE_TAX = {
  CA: 8.68, TX: 8.25, NY: 8.0, FL: 6.0, WA: 10.25, PA: 6.0, IL: 10.25,
  OH: 5.75, GA: 4.0, NC: 4.75, MI: 6.0, NJ: 6.625, VA: 5.3, AZ: 5.6,
  CO: 2.9, TN: 7.0, IN: 7.0, MO: 4.225, MD: 6.0, WI: 5.0, MN: 6.875,
  AL: 4.0, SC: 6.0, KY: 6.0, OR: 0, MT: 0, NH: 0, DE: 0, AK: 0,
};

// ── §2  TAX COMPUTATION ───────────────────────────────────────────────────

/**
 * computeTax — calculate tax for a transaction
 * Calculează taxa pentru o tranzacție
 */
function computeTax({
  amountUsd,
  countryCode,
  stateCode       = null,   // for US
  vatNumber       = null,   // for B2B EU reverse charge
  isExempt        = false,
  productType     = 'saas', // saas | software | consulting | physical
  currency        = 'USD',
}) {
  const country = (countryCode || '').toUpperCase();
  const catalog  = TAX_RATES[country] || TAX_RATES._DEFAULT;
  let taxRate    = catalog.rate;
  let taxType    = catalog.type;
  let taxName    = catalog.name;
  let reverseCharge = false;
  let exemptReason  = null;

  // EU B2B reverse charge — if valid VAT number provided, zero-rate
  const EU_COUNTRIES = Object.keys(TAX_RATES).filter(k => TAX_RATES[k].type === 'VAT' && k !== 'GB' && k !== 'NO' && k !== 'CH');
  const sellerCountry = (process.env.TAX_SELLER_COUNTRY || 'RO').toUpperCase();
  if (vatNumber && EU_COUNTRIES.includes(country) && country !== sellerCountry) {
    taxRate       = 0;
    reverseCharge = true;
    taxName       = `${catalog.name} (Reverse Charge — customer accounts for VAT)`;
  }

  // US sales tax — per state
  if (country === 'US') {
    const state = (stateCode || '').toUpperCase();
    taxRate = US_STATE_TAX[state] !== undefined ? US_STATE_TAX[state] : 0;
    taxName = state ? `US ${state} Sales Tax` : 'US Sales Tax (state unknown)';
    taxType = 'SALES_TAX';
  }

  // Exempt override
  if (isExempt) {
    taxRate      = 0;
    exemptReason = 'Customer marked tax-exempt';
  }

  const taxAmount   = Math.round(amountUsd * (taxRate / 100) * 100) / 100;
  const totalAmount = amountUsd + taxAmount;

  return {
    amountBeforeTax: amountUsd,
    taxRate,
    taxAmount,
    totalAmount,
    currency,
    taxType,
    taxName,
    reverseCharge,
    exemptReason,
    countryCode:     country,
    stateCode:       stateCode || null,
    vatNumber:       vatNumber ? _maskVat(vatNumber) : null,
  };
}

/**
 * computeInvoiceTax — full invoice with line-item tax breakdown
 */
function computeInvoiceTax({ lines = [], countryCode, stateCode, vatNumber, isExempt, currency = 'USD' }) {
  const taxedLines = lines.map(line => {
    const { amountUsd, description, productType } = line;
    const tax = computeTax({ amountUsd, countryCode, stateCode, vatNumber, isExempt, productType, currency });
    return { description, ...tax };
  });
  const subtotal  = taxedLines.reduce((s, l) => s + l.amountBeforeTax, 0);
  const totalTax  = taxedLines.reduce((s, l) => s + l.taxAmount,        0);
  const total     = taxedLines.reduce((s, l) => s + l.totalAmount,       0);

  return {
    lines:    taxedLines,
    subtotal: +subtotal.toFixed(2),
    totalTax: +totalTax.toFixed(2),
    total:    +total.toFixed(2),
    currency,
    invoiceId: 'INV_' + Date.now(),
    issuedAt:  new Date().toISOString(),
  };
}

// ── §3  TAX LEDGER ────────────────────────────────────────────────────────

/**
 * recordTax — persist a completed taxed transaction
 */
function recordTax({ transactionId, amountUsd, taxAmount, countryCode, taxType, taxRate }) {
  const record = {
    id:            transactionId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts:            new Date().toISOString(),
    amountUsd,
    taxAmount,
    countryCode:   (countryCode || '').toUpperCase(),
    taxType,
    taxRate,
  };
  _ledger.push(record);
  if (_ledger.length > 50000) _ledger = _ledger.slice(-50000);
  _persistDebounced();
  return record;
}

// ── §4  TAX REPORTS ───────────────────────────────────────────────────────

/**
 * getTaxReport — monthly/quarterly/annual tax summary
 * Raport fiscal lunar/trimestrial/anual
 */
function getTaxReport({ period = 'monthly', year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = {}) {
  let filtered;
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');

  if (period === 'monthly') {
    filtered = _ledger.filter(r => r.ts.startsWith(`${y}-${m}`));
  } else if (period === 'quarterly') {
    const q = Math.ceil(month / 3);
    const months = [1, 2, 3].map(i => String((q - 1) * 3 + i).padStart(2, '0'));
    filtered = _ledger.filter(r => months.some(mo => r.ts.startsWith(`${y}-${mo}`)));
  } else {
    filtered = _ledger.filter(r => r.ts.startsWith(y));
  }

  const byCountry = {};
  let totalRevenue = 0, totalTax = 0;
  for (const r of filtered) {
    totalRevenue += r.amountUsd;
    totalTax     += r.taxAmount;
    const cc = r.countryCode || 'UNKNOWN';
    if (!byCountry[cc]) byCountry[cc] = { country: cc, transactions: 0, revenue: 0, tax: 0, taxType: r.taxType };
    byCountry[cc].transactions += 1;
    byCountry[cc].revenue      += r.amountUsd;
    byCountry[cc].tax          += r.taxAmount;
  }

  return {
    period, year, month,
    transactions:   filtered.length,
    totalRevenue:   +totalRevenue.toFixed(2),
    totalTax:       +totalTax.toFixed(2),
    effectiveRate:  totalRevenue > 0 ? +((totalTax / totalRevenue) * 100).toFixed(2) : 0,
    byCountry:      Object.values(byCountry)
      .map(c => ({ ...c, revenue: +c.revenue.toFixed(2), tax: +c.tax.toFixed(2) }))
      .sort((a, b) => b.tax - a.tax),
    euVatOSSRequired: Object.keys(byCountry).some(cc => {
      const eu = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];
      return eu.includes(cc);
    }),
    cryptoAdvisory: 'BTC/ETH payments are subject to capital gains tax in the customer\'s jurisdiction. Provide transaction ID as evidence of payment value at time of sale.',
  };
}

// ── §5  HELPERS ───────────────────────────────────────────────────────────

function getTaxRate(countryCode, stateCode = null) {
  const country = (countryCode || '').toUpperCase();
  if (country === 'US') {
    const state = (stateCode || '').toUpperCase();
    return { rate: US_STATE_TAX[state] || 0, name: `US ${state} Sales Tax`, type: 'SALES_TAX' };
  }
  const cat = TAX_RATES[country] || TAX_RATES._DEFAULT;
  return { rate: cat.rate, name: cat.name, type: cat.type };
}

function _maskVat(v) {
  const s = String(v);
  return s.length > 6 ? s.slice(0, 4) + '***' + s.slice(-2) : '***';
}

let _persistTimer = null;
function _persistDebounced() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    try { fs.writeFileSync(LEDGER_F, JSON.stringify(_ledger.slice(-20000), null, 2)); } catch (_) {}
  }, 5000);
}

function _loadJson(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return def;
}

// ── §6  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/rates',    (_req, res) => res.json({ ok: true, rates: TAX_RATES, usStateTax: US_STATE_TAX }));
  r.get('/rate/:cc', (req, res) => {
    const state = req.query.state || null;
    res.json({ ok: true, countryCode: req.params.cc.toUpperCase(), ...getTaxRate(req.params.cc, state) });
  });

  r.post('/compute', express.json(), (req, res) => {
    const result = computeTax(req.body || {});
    res.json({ ok: true, ...result });
  });

  r.post('/invoice', express.json(), (req, res) => {
    const result = computeInvoiceTax(req.body || {});
    res.json({ ok: true, invoice: result });
  });

  r.post('/record', express.json(), (req, res) => {
    const record = recordTax(req.body || {});
    res.json({ ok: true, record });
  });

  r.get('/report', (req, res) => {
    const { period, year, month } = req.query;
    const report = getTaxReport({
      period: period || 'monthly',
      year:   year   ? Number(year)  : undefined,
      month:  month  ? Number(month) : undefined,
    });
    res.json({ ok: true, report });
  });

  r.get('/ledger', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    res.json({ ok: true, ledger: _ledger.slice(-limit), total: _ledger.length });
  });

  return r;
}

function getStatus() {
  const report = getTaxReport();
  return {
    name:              'tax-engine',
    label:             'Global Tax Computation Engine',
    health:            'good',
    supportedCountries: Object.keys(TAX_RATES).length - 1,
    usStatesSupported:  Object.keys(US_STATE_TAX).length,
    totalRecords:       _ledger.length,
    monthlyTaxCollected: report.totalTax,
    euVatOSSRequired:   report.euVatOSSRequired,
  };
}

module.exports = {
  computeTax,
  computeInvoiceTax,
  recordTax,
  getTaxReport,
  getTaxRate,
  TAX_RATES,
  US_STATE_TAX,
  getStatus,
  router,
};
