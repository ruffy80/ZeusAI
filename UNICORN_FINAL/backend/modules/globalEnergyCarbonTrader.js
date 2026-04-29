// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Global Energy & Carbon Trader (GECT) Module
// Simulează tranzacționarea energiei și a creditelor de carbon.
// Ready for integration with real energy exchange APIs.

const crypto = require('crypto');

// Prețuri simulate pe regiuni (USD/MWh)
const ENERGY_PRICES = {
  EU: { basePrice: 85.50, unit: 'MWh', currency: 'EUR', types: ['solar', 'wind', 'hydro', 'nuclear', 'gas'] },
  US: { basePrice: 62.30, unit: 'MWh', currency: 'USD', types: ['solar', 'wind', 'coal', 'nuclear', 'gas'] },
  APAC: { basePrice: 74.20, unit: 'MWh', currency: 'USD', types: ['solar', 'coal', 'gas', 'hydro'] },
  ME: { basePrice: 45.00, unit: 'MWh', currency: 'USD', types: ['solar', 'gas', 'oil'] },
  AF: { basePrice: 38.50, unit: 'MWh', currency: 'USD', types: ['solar', 'hydro', 'wind'] },
  LATAM: { basePrice: 55.00, unit: 'MWh', currency: 'USD', types: ['hydro', 'solar', 'wind', 'gas'] },
};

// Simulate price fluctuation every 30 seconds.
// The interval reference is exported so callers can stop it if needed (e.g. in tests).
let priceVolatility = 0;
const _priceUpdateInterval = setInterval(() => {
  priceVolatility = (Math.random() - 0.5) * 10;
}, 30000);

const energyTrades = new Map();

class GlobalEnergyCarbonTrader {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000;
    this.portfolio = new Map(); // userId -> { energy: {}, carbonCredits: {} }
  }

  getCurrentPrice(region) {
    const regionData = ENERGY_PRICES[region.toUpperCase()];
    if (!regionData) throw new Error(`Region ${region} not supported. Available: ${Object.keys(ENERGY_PRICES).join(', ')}`);

    const fluctuation = priceVolatility + (Math.random() - 0.5) * 5;
    const currentPrice = parseFloat((regionData.basePrice + fluctuation).toFixed(2));
    const prices = {};
    regionData.types.forEach(type => {
      const typeMultiplier = {
        solar: 0.85, wind: 0.90, hydro: 0.92, nuclear: 1.10,
        gas: 1.15, coal: 0.75, oil: 1.20,
      }[type] || 1.0;
      prices[type] = parseFloat((currentPrice * typeMultiplier).toFixed(2));
    });

    return {
      region: region.toUpperCase(),
      basePrice: currentPrice,
      currency: regionData.currency,
      unit: regionData.unit,
      prices,
      timestamp: new Date().toISOString(),
      // Hook: replace with real-time data from energy exchanges
      _externalApiEndpoint: `https://api.energyexchange.${region.toLowerCase()}/v1/prices`,
    };
  }

  tradeEnergy({ userId, action, region, energyType, quantity, maxPrice }) {
    const regionData = ENERGY_PRICES[region?.toUpperCase()];
    if (!regionData) throw new Error(`Region ${region} not supported`);

    const priceInfo = this.getCurrentPrice(region);
    const unitPrice = priceInfo.prices[energyType] || priceInfo.basePrice;

    if (action === 'buy' && maxPrice && unitPrice > maxPrice) {
      throw new Error(`Current price ${unitPrice} exceeds maxPrice ${maxPrice}`);
    }

    const totalCost = parseFloat((unitPrice * quantity).toFixed(2));
    const tradeId = 'ET-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    const trade = {
      id: tradeId,
      userId,
      action,
      region: region.toUpperCase(),
      energyType,
      quantity,
      unitPrice,
      totalCost,
      currency: regionData.currency,
      status: 'executed',
      timestamp: new Date().toISOString(),
      settlement: new Date(Date.now() + 86400000).toISOString(), // T+1
    };

    energyTrades.set(tradeId, trade);

    // Update portfolio
    if (!this.portfolio.has(userId)) this.portfolio.set(userId, { energy: {}, carbonCredits: {} });
    const userPortfolio = this.portfolio.get(userId);
    const key = `${region.toUpperCase()}_${energyType}`;
    if (!userPortfolio.energy[key]) userPortfolio.energy[key] = 0;
    userPortfolio.energy[key] += action === 'buy' ? quantity : -quantity;

    return trade;
  }

  tradeCarbonCredits({ userId, action, creditType, amount, carbonExchangeModule }) {
    // Delegates to the existing carbonExchange module
    if (!carbonExchangeModule) throw new Error('carbonExchange module is required');

    if (action === 'buy') {
      const order = carbonExchangeModule.createBuyOrder(userId, creditType || 'VER', amount, 999999);
      return { action: 'buy', order, timestamp: new Date().toISOString() };
    } else if (action === 'sell') {
      // Issue credits first then create sell order (for simulation purposes)
      const creditId = carbonExchangeModule.issueCredits(userId, amount, creditType || 'VER');
      const order = carbonExchangeModule.createSellOrder(userId, creditId, amount);
      return { action: 'sell', creditId, order, timestamp: new Date().toISOString() };
    }
    throw new Error(`Unknown action: ${action}. Use 'buy' or 'sell'`);
  }

  getPortfolio(userId) {
    return this.portfolio.get(userId) || { energy: {}, carbonCredits: {} };
  }

  getTradeHistory(userId) {
    return Array.from(energyTrades.values()).filter(t => t.userId === userId);
  }

  getSupportedRegions() {
    return Object.entries(ENERGY_PRICES).map(([code, info]) => ({
      code,
      currency: info.currency,
      unit: info.unit,
      energyTypes: info.types,
    }));
  }
}


const instance = new GlobalEnergyCarbonTrader();
// Mesh orchestrator expects getStatus and statusFn
instance.getStatus = function() {
  return {
    ok: true,
    module: 'globalEnergyCarbonTrader',
    portfolioCount: instance.portfolio.size,
    energyTrades: energyTrades.size,
    supportedRegions: instance.getSupportedRegions(),
    timestamp: Date.now(),
  };
};
// Alias for orchestrator
instance.statusFn = instance.getStatus;
module.exports = instance;
