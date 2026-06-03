// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============ ENERGY TRADING ENGINE (REAL) ============
// Clearing real de piață prin merit-order (curba ofertei sortată după preț
// întâlnește cererea) → preț de echilibru, volum tranzacționat, surplus.

class EnergyTrading {
  constructor() { this.name = 'energyTrading'; this.state = { clears: 0 }; this.cache = new Map(); }

  // Merit-order real: sortează ofertele crescător după preț și satisface
  // cererea până la epuizare → marginal price = ultima ofertă acceptată.
  clear(bids = [], asks = [], demandMwh = null) {
    const supply = [...asks].map(a => ({ price: Number(a.price) || 0, mwh: Number(a.mwh) || 0 }))
      .sort((x, y) => x.price - y.price);
    const demand = demandMwh != null
      ? Number(demandMwh)
      : bids.reduce((a, b) => a + (Number(b.mwh) || 0), 0);

    let remaining = demand, cleared = 0, cost = 0, marginalPrice = 0;
    const accepted = [];
    for (const s of supply) {
      if (remaining <= 0) break;
      const take = Math.min(s.mwh, remaining);
      cleared += take; cost += take * s.price; remaining -= take;
      marginalPrice = s.price;
      accepted.push({ price: s.price, mwh: take });
    }
    // În piețe marginale, toți primesc prețul marginal (uniform-price auction).
    const uniformCost = cleared * marginalPrice;
    this.state.clears++;
    return {
      demandMwh: demand,
      clearedMwh: Number(cleared.toFixed(3)),
      unmetMwh: Number(Math.max(0, remaining).toFixed(3)),
      marginalPrice: Number(marginalPrice.toFixed(2)),
      payAsBidCost: Number(cost.toFixed(2)),
      uniformPriceCost: Number(uniformCost.toFixed(2)),
      producerSurplus: Number((uniformCost - cost).toFixed(2)),
      accepted,
      filledPct: demand ? Number(((cleared / demand) * 100).toFixed(1)) : 0,
    };
  }

  async process(input = {}) {
    if (Array.isArray(input.asks)) {
      return { status: 'ok', module: this.name, ...this.clear(input.bids || [], input.asks, input.demandMwh) };
    }
    return { status: 'ok', module: this.name, note: 'provide {asks:[{price,mwh}], demandMwh}', echo: input };
  }

  getStatus() { return { name: this.name, health: 'good', clears: this.state.clears, uptime: process.uptime() }; }
}

module.exports = new EnergyTrading();
