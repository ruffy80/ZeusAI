const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ServiceMarketplace {
  constructor() {
    this.services = new Map();
    this.pricingHistory = new Map();
    this.clientPreferences = new Map();
    this.marketTrends = { lastUpdate: null, trends: {}, globalMultiplier: 1.0 };
    this.discountRate = 0.20;
    this.loadServices();
    this.startMarketAnalysis();
  }

  loadServices() {
    const modulesDir = path.join(__dirname);
    if (!fs.existsSync(modulesDir)) return;

    const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js') && f !== 'serviceMarketplace.js');
    for (const file of files) {
      try {
        const mod = require(path.join(modulesDir, file));
        const serviceId = file.replace('.js', '');

        let category = 'general';
        if (serviceId.includes('pricing')) category = 'pricing';
        else if (serviceId.includes('negotiate')) category = 'negotiation';
        else if (serviceId.includes('carbon')) category = 'carbon';
        else if (serviceId.includes('identity')) category = 'security';
        else if (serviceId.includes('wealth')) category = 'finance';
        else if (serviceId.includes('trend')) category = 'analytics';

        const name = this.formatServiceName(serviceId);
        this.services.set(serviceId, {
          id: serviceId,
          name,
          category,
          description: mod.description || ('Serviciu AI avansat pentru ' + name),
          basePrice: this.calculateBasePrice(serviceId, category),
          currentPrice: 0,
          demand: 0.5,
          popularity: 0.5,
          availability: true,
          apiEndpoint: '/api/module/' + serviceId + '/process',
          metadata: { version: '1.0', createdAt: new Date().toISOString() }
        });
      } catch (err) {
        console.error('Eroare la încărcarea serviciului ' + file + ':', err.message);
      }
    }

    if (this.services.size < 10) this.addDefaultServices();
    console.log('✅ Încărcate ' + this.services.size + ' servicii în marketplace');
  }

  formatServiceName(serviceId) {
    return serviceId.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/[0-9]/g, '').trim();
  }

  calculateBasePrice(serviceId, category) {
    const prices = { pricing: 49.99, negotiation: 99.99, carbon: 149.99, security: 79.99, finance: 199.99, analytics: 39.99, general: 29.99 };
    return prices[category] || 29.99;
  }

  addDefaultServices() {
    const defaults = [
      { id: 'dynamic_pricing', name: 'Dynamic Pricing AI', category: 'pricing', basePrice: 49.99 },
      { id: 'ai_negotiator', name: 'AI Negotiator Pro', category: 'negotiation', basePrice: 99.99 },
      { id: 'carbon_trading', name: 'Carbon Credit Trading', category: 'carbon', basePrice: 149.99 },
      { id: 'quantum_identity', name: 'Quantum Identity Shield', category: 'security', basePrice: 79.99 },
      { id: 'wealth_engine', name: 'Autonomous Wealth Engine', category: 'finance', basePrice: 199.99 },
      { id: 'trend_analyzer', name: 'Global Trend Analyzer', category: 'analytics', basePrice: 39.99 }
    ];

    for (const svc of defaults) {
      if (!this.services.has(svc.id)) {
        this.services.set(svc.id, {
          id: svc.id,
          name: svc.name,
          category: svc.category,
          description: 'Serviciu AI avansat pentru ' + svc.name,
          basePrice: svc.basePrice,
          currentPrice: svc.basePrice,
          demand: 0.5,
          popularity: 0.5,
          availability: true,
          apiEndpoint: '/api/module/' + svc.id + '/process'
        });
      }
    }
  }

  startMarketAnalysis() {
    setInterval(() => this.analyzeMarket(), 30 * 60 * 1000);
    setTimeout(() => this.analyzeMarket(), 5000);
  }

  async collectMarketData() {
    void axios;
    const trends = { ai_services: 0.15, carbon: 0.08, security: 0.12, finance: 0.05, general: 0.02 };
    const globalMultiplier = 0.95 + Math.random() * 0.1;
    const competitorPrices = { dynamic_pricing: 59.99, ai_negotiator: 119.99, carbon_trading: 179.99, quantum_identity: 99.99, wealth_engine: 249.99 };
    return { trends, globalMultiplier, competitorPrices };
  }

  calculateDynamicPrice(service) {
    let price = service.basePrice;
    const demandFactor = 0.8 + (service.demand - 0.5) * 0.6;
    const popularityFactor = 0.9 + service.popularity * 0.2;
    const categoryTrend = this.marketTrends.trends[service.category] || 0.02;
    price *= demandFactor;
    price *= popularityFactor;
    price *= (1 + categoryTrend);
    price *= this.marketTrends.globalMultiplier || 1.0;
    if (this.marketTrends.competitorPrices && this.marketTrends.competitorPrices[service.id]) {
      const competitorPrice = this.marketTrends.competitorPrices[service.id];
      if (competitorPrice < price) price = price * 0.95 + competitorPrice * 0.05;
    }
    price = price * (1 - this.discountRate);
    const minPrice = service.basePrice * 0.5;
    if (price < minPrice) price = minPrice;
    return Math.round(price * 100) / 100;
  }

  async analyzeMarket() {
    try {
      const marketData = await this.collectMarketData();
      this.marketTrends = {
        lastUpdate: new Date().toISOString(),
        trends: marketData.trends,
        globalMultiplier: marketData.globalMultiplier,
        competitorPrices: marketData.competitorPrices
      };

      for (const [id, service] of this.services) {
        const newPrice = this.calculateDynamicPrice(service);
        const oldPrice = service.currentPrice || service.basePrice;
        if (Math.abs(newPrice - oldPrice) > 0.01) {
          if (!this.pricingHistory.has(id)) this.pricingHistory.set(id, []);
          this.pricingHistory.get(id).push({ price: oldPrice, timestamp: new Date().toISOString(), reason: 'market_adjustment' });
          service.currentPrice = newPrice;
        }
      }
    } catch (err) {
      console.error('❌ Eroare la analiza pieței:', err.message);
    }
  }

  getPersonalizedPrice(serviceId, clientId, clientData = {}) {
    const service = this.services.get(serviceId);
    if (!service) return null;

    let basePrice = service.currentPrice || service.basePrice;
    const clientHistory = this.clientPreferences.get(clientId);
    if (clientHistory) {
      const loyaltyDiscount = Math.min(clientHistory.purchases * 0.02, 0.15);
      basePrice *= (1 - loyaltyDiscount);
    }

    const segments = { retail: 1.0, enterprise: 0.9, startup: 0.85, nonprofit: 0.7 };
    basePrice *= (segments[clientData.segment] || 1.0);
    basePrice *= (1 - Math.min(clientData.volume || 0, 0.2));
    if (clientData.urgency === 'high') basePrice *= 1.1;
    if (clientData.urgency === 'low') basePrice *= 0.95;
    return Math.round(basePrice * 100) / 100;
  }

  recordPurchase(serviceId, clientId, price, details = {}) {
    if (!this.clientPreferences.has(clientId)) {
      this.clientPreferences.set(clientId, { purchases: 0, totalSpent: 0, services: [], firstPurchase: new Date().toISOString() });
    }
    const client = this.clientPreferences.get(clientId);
    const service = this.services.get(serviceId);
    const purchaseRecord = {
      serviceId,
      serviceName: details.serviceName || service?.name || serviceId,
      description: details.description || service?.description || '',
      category: service?.category || 'general',
      price: Number(price || 0),
      paymentTxId: details.paymentTxId || null,
      paymentMethod: details.paymentMethod || null,
      purchasedAt: new Date().toISOString()
    };
    client.purchases += 1;
    client.totalSpent += Number(price || 0);
    client.services.push(purchaseRecord);
    client.lastPurchase = new Date().toISOString();

    if (service) service.popularity = Math.min(service.popularity + 0.05, 1);
    return client;
  }

  getClientPurchases(clientId) {
    const client = this.clientPreferences.get(clientId);
    if (!client) return [];
    return [...client.services].sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
  }

  getAllServices() {
    return Array.from(this.services.values()).map(service => ({
      id: service.id,
      name: service.name,
      category: service.category,
      description: service.description,
      price: service.currentPrice || service.basePrice,
      basePrice: service.basePrice,
      discount: this.discountRate * 100,
      demand: service.demand,
      popularity: service.popularity,
      availability: service.availability,
      apiEndpoint: service.apiEndpoint
    }));
  }

  getRecommendations(clientId) {
    const client = this.clientPreferences.get(clientId);
    const recommendations = [];
    for (const service of this.services.values()) {
      if (!client || !client.services.some(s => s.serviceId === service.id)) {
        recommendations.push({
          serviceId: service.id,
          name: service.name,
          category: service.category,
          price: service.currentPrice || service.basePrice,
          score: service.popularity,
          reason: service.popularity > 0.7 ? 'Highly recommended' : 'You might also like'
        });
      }
    }
    return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  getMarketplaceStats() {
    let totalValue = 0;
    const byCategory = {};
    for (const service of this.services.values()) {
      const price = service.currentPrice || service.basePrice;
      totalValue += price;
      byCategory[service.category] = (byCategory[service.category] || 0) + 1;
    }
    return {
      totalServices: this.services.size,
      avgPrice: totalValue / (this.services.size || 1),
      totalValue,
      byCategory,
      discountRate: this.discountRate * 100,
      lastMarketUpdate: this.marketTrends.lastUpdate,
      marketTrends: this.marketTrends.trends
    };
  }

  updateDemand(serviceId, delta) {
    const service = this.services.get(serviceId);
    if (!service) return;
    service.demand = Math.min(Math.max(service.demand + Number(delta || 0), 0), 1);
  }

  applySpecialDiscount(clientId, serviceId, customDiscount) {
    void clientId;
    const service = this.services.get(serviceId);
    if (!service) return null;
    const basePrice = service.currentPrice || service.basePrice;
    const discountedPrice = basePrice * (1 - customDiscount);
    return {
      originalPrice: basePrice,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
      discountPercent: customDiscount * 100,
      expiresIn: '24h'
    };
  }
}

module.exports = new ServiceMarketplace();
