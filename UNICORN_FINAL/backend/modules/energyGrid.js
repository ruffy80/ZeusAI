// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.146Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.447Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.202Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.287Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.150Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.800Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.988Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

const crypto = require('crypto');

class EnergyGridOptimizer {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.grids = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.trades = [];
  }

  registerProducer(producerData) {
    const { name, capacity, type, location, pricePerMWh } = producerData;
    const id = crypto.randomBytes(8).toString('hex');
    const producer = {
      id,
      name,
      capacity: Number(capacity || 0),
      type,
      location,
      pricePerMWh: Number(pricePerMWh || 0),
      currentOutput: 0,
      status: 'active'
    };
    this.producers.set(id, producer);
    return producer;
  }

  registerConsumer(consumerData) {
    const { name, demand, location, maxPrice } = consumerData;
    const id = crypto.randomBytes(8).toString('hex');
    const consumer = {
      id,
      name,
      demand: Number(demand || 0),
      location,
      maxPrice: Number(maxPrice || 0),
      currentConsumption: 0,
      status: 'active'
    };
    this.consumers.set(id, consumer);
    return consumer;
  }

  optimizeFlow() {
    const producers = Array.from(this.producers.values()).filter(p => p.status === 'active');
    const consumers = Array.from(this.consumers.values()).filter(c => c.status === 'active');

    const totalDemand = consumers.reduce((sum, c) => sum + c.demand, 0);
    const totalSupply = producers.reduce((sum, p) => sum + p.capacity, 0);
    const matches = [];

    for (const consumer of consumers) {
      let remainingDemand = consumer.demand;
      for (const producer of producers) {
        if (remainingDemand <= 0) break;
        const available = producer.capacity - producer.currentOutput;
        if (available <= 0) continue;

        const allocation = Math.min(available, remainingDemand);
        producer.currentOutput += allocation;
        remainingDemand -= allocation;

        matches.push({
          consumerId: consumer.id,
          producerId: producer.id,
          amount: allocation,
          price: producer.pricePerMWh,
          timestamp: new Date().toISOString()
        });
      }
    }

    return { matches, totalDemand, totalSupply, deficit: totalDemand - totalSupply };
  }

  async tradeExcessEnergy() {
    const producersWithExcess = Array.from(this.producers.values()).filter(p => p.currentOutput < p.capacity);
    const spotPrice = await this.getSpotPrice();

    const trades = [];
    for (const producer of producersWithExcess) {
      const excess = producer.capacity - producer.currentOutput;
      if (excess <= 0) continue;
      const trade = {
        id: crypto.randomBytes(8).toString('hex'),
        producerId: producer.id,
        amount: excess,
        price: spotPrice,
        revenue: excess * spotPrice,
        timestamp: new Date().toISOString()
      };
      trades.push(trade);
    }

    this.trades.push(...trades);
    return trades;
  }

  async getSpotPrice() {
    return 50 + Math.random() * 30;
  }

  integrateRenewable(renewableData) {
    const { type, capacity, location, forecast } = renewableData;
    const id = crypto.randomBytes(8).toString('hex');
    const renewable = {
      id,
      type,
      capacity: Number(capacity || 0),
      location,
      forecast,
      currentOutput: 0,
      status: 'active'
    };
    this.producers.set(id, renewable);
    return renewable;
  }

  getStats() {
    const totalCapacity = Array.from(this.producers.values()).reduce((sum, p) => sum + p.capacity, 0);
    const totalDemand = Array.from(this.consumers.values()).reduce((sum, c) => sum + c.demand, 0);
    const totalTraded = this.trades.reduce((sum, t) => sum + t.amount, 0);
    return {
      producers: this.producers.size,
      consumers: this.consumers.size,
      totalCapacity,
      totalDemand,
      utilizationRate: totalDemand / (totalCapacity || 1),
      totalTraded,
      totalRevenue: this.trades.reduce((sum, t) => sum + t.revenue, 0)
    };
  }
}

module.exports = new EnergyGridOptimizer();
