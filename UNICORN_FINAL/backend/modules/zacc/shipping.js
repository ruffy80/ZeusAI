// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Shipping quote engine.
// RO: calculează costul de livrare + ETA pe zone geografice, pornind de la
// costul de bază al produsului. Determinist, fără dependențe, nu aruncă
// NICIODATĂ (input invalid → fallback la zona WORLD). Toate valorile round2.

'use strict';

const { round2 } = require('./util');

// Zone table: multiplier applied to the base shipping cost + ETA window.
const ZONES = {
  NA: { mult: 1.00, etaDays: '7-12', countries: ['US', 'CA', 'MX'] },
  EU: { mult: 1.15, etaDays: '8-14', countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'SE', 'DK', 'FI', 'PL', 'RO', 'CZ', 'GR', 'HU'] },
  UK: { mult: 1.10, etaDays: '8-14', countries: ['GB', 'UK'] },
  OC: { mult: 1.35, etaDays: '10-18', countries: ['AU', 'NZ'] },
  WORLD: { mult: 1.40, etaDays: '12-21', countries: [] },
};

// country → zone key
const COUNTRY_ZONE = (() => {
  const map = {};
  for (const [zone, def] of Object.entries(ZONES)) {
    for (const c of def.countries) map[c] = zone;
  }
  return map;
})();

function zoneFor(country) {
  const c = String(country || '').trim().toUpperCase();
  return COUNTRY_ZONE[c] || 'WORLD';
}

// quote({ country, costUsd, shippingUsdBase, qty, weightKg })
//   → { shippingUsd, etaDays, zone, totalUsd }
// totalUsd = item cost (costUsd * qty) + shipping. Never throws.
function quote(input) {
  input = input || {};
  try {
    const zone = zoneFor(input.country);
    const def = ZONES[zone] || ZONES.WORLD;
    const qty = Math.max(1, Number(input.qty) || 1);
    const costUsd = Math.max(0, Number(input.costUsd) || 0);
    const base = Math.max(0, Number(input.shippingUsdBase) || 0);
    const weightKg = Math.max(0, Number(input.weightKg) || 0);

    // Heavier parcels cost more; +$1.20/kg beyond the first 0.5kg, capped.
    const weightSurcharge = weightKg > 0.5 ? Math.min(24, (weightKg - 0.5) * 1.2) : 0;
    // First unit ships at full base; extra units at 60% (consolidated parcel).
    const perUnitShip = (base * def.mult) + weightSurcharge;
    const shippingUsd = round2(perUnitShip + (qty - 1) * perUnitShip * 0.6);

    const itemUsd = round2(costUsd * qty);
    const totalUsd = round2(itemUsd + shippingUsd);

    return { shippingUsd, etaDays: def.etaDays, zone, totalUsd };
  } catch (_) {
    // Absolute fallback — never throw into the commerce flow.
    return { shippingUsd: 0, etaDays: ZONES.WORLD.etaDays, zone: 'WORLD', totalUsd: 0 };
  }
}

module.exports = { quote, zoneFor, ZONES };
