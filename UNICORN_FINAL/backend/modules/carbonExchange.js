// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:26:26.903Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.232Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.091Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.604Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.144Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.445Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.197Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.286Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.147Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.799Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.987Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

const crypto = require('crypto');

class CarbonCreditExchange {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.credits = new Map();
    this.portfolios = new Map();
    this.transactions = [];
    this.orders = new Map();
    this.marketPrices = { VER: 5.5, CER: 8.25, EUA: 85, CCB: 12 };
  }

  issueCredits(owner, amount, type = 'VER', projectId = null, vintage = new Date().getFullYear()) {
    const id = crypto.randomBytes(16).toString('hex');
    const credit = {
      id,
      owner,
      amount: parseFloat(amount),
      type,
      price: this.marketPrices[type] || 10,
      projectId,
      vintage,
      issuedAt: new Date().toISOString(),
      status: 'active'
    };

    this.credits.set(id, credit);

    if (!this.portfolios.has(owner)) this.portfolios.set(owner, new Set());
    this.portfolios.get(owner).add(id);

    return credit;
  }

  getMarketPrice(type) {
    return this.marketPrices[type] || 10;
  }

  updateMarketPrice(type, price) {
    if (this.marketPrices[type]) {
      this.marketPrices[type] = price;
      for (const [id, credit] of this.credits) {
        if (credit.type === type && credit.status === 'active') {
          credit.price = price;
          this.credits.set(id, credit);
        }
      }
      return { updated: true, type, price };
    }
    return { updated: false, message: 'Unknown credit type' };
  }

  createSellOrder(seller, creditId, amount, price = null) {
    if (!this.portfolios.get(seller)?.has(creditId)) {
      throw new Error('Seller does not own this credit');
    }

    const credit = this.credits.get(creditId);
    if (!credit || credit.amount < amount) {
      throw new Error('Insufficient credits');
    }

    const order = {
      id: crypto.randomBytes(8).toString('hex'),
      seller,
      creditId,
      amount,
      price: price || credit.price,
      type: 'sell',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    this.orders.set(order.id, order);

    return order;
  }

  createBuyOrder(buyer, creditType, amount, maxPrice) {
    const order = {
      id: crypto.randomBytes(8).toString('hex'),
      buyer,
      creditType,
      amount,
      maxPrice,
      type: 'buy',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    this.orders.set(order.id, order);

    return order;
  }

  async executeTrade(buyer, seller, creditId, amount) {
    const credit = this.credits.get(creditId);
    if (!credit) throw new Error('Credit not found');
    if (credit.owner !== seller) throw new Error('Seller does not own this credit');
    if (credit.amount < amount) throw new Error('Insufficient amount');

    const totalPrice = credit.price * amount;

    credit.amount -= amount;
    if (credit.amount === 0) {
      credit.status = 'depleted';
      this.portfolios.get(seller).delete(creditId);
    }
    this.credits.set(creditId, credit);

    let newCreditId = null;
    if (amount > 0) {
      newCreditId = crypto.randomBytes(16).toString('hex');
      const newCredit = {
        ...credit,
        id: newCreditId,
        owner: buyer,
        amount,
        originalId: creditId,
        purchasedAt: new Date().toISOString()
      };
      this.credits.set(newCreditId, newCredit);
      if (!this.portfolios.has(buyer)) this.portfolios.set(buyer, new Set());
      this.portfolios.get(buyer).add(newCreditId);
    }

    const transaction = {
      id: crypto.randomBytes(16).toString('hex'),
      buyer,
      seller,
      creditId,
      newCreditId,
      amount,
      price: credit.price,
      totalPrice,
      timestamp: new Date().toISOString()
    };
    this.transactions.push(transaction);

    return transaction;
  }

  async matchOrders() {
    const buyOrders = Array.from(this.orders.values()).filter(o => o.type === 'buy' && o.status === 'open');
    const sellOrders = Array.from(this.orders.values()).filter(o => o.type === 'sell' && o.status === 'open');

    let matched = 0;

    for (const buy of buyOrders) {
      for (const sell of sellOrders) {
        if (sell.price <= buy.maxPrice) {
          const amount = Math.min(buy.amount, sell.amount);
          try {
            await this.executeTrade(buy.buyer, sell.seller, sell.creditId, amount);

            buy.amount -= amount;
            sell.amount -= amount;

            if (buy.amount === 0) buy.status = 'completed';
            if (sell.amount === 0) sell.status = 'completed';

            matched++;
            break;
          } catch (err) {
            console.error('Trade execution failed:', err);
          }
        }
      }
    }

    return { matched };
  }

  getPortfolio(owner) {
    const creditIds = this.portfolios.get(owner) || new Set();
    const credits = [];
    for (const id of creditIds) {
      const credit = this.credits.get(id);
      if (credit) credits.push(credit);
    }
    return credits;
  }

  getMarketStats() {
    const totalVolume = this.transactions.reduce((sum, t) => sum + t.totalPrice, 0);
    const avgPrice = this.transactions.length > 0 ? totalVolume / this.transactions.length : 0;

    const creditsByType = {};
    for (const [id, credit] of this.credits) {
      if (credit.status === 'active' || credit.status === 'depleted') {
        creditsByType[credit.type] = (creditsByType[credit.type] || 0) + credit.amount;
      }
    }

    return {
      totalVolume,
      avgPrice,
      transactionsCount: this.transactions.length,
      availableCredits: creditsByType,
      marketPrices: this.marketPrices,
      activeOrders: Array.from(this.orders.values()).filter(o => o.status === 'open').length
    };
  }

  getTransactionHistory(user, role = 'both') {
    return this.transactions.filter(t => {
      if (role === 'buyer') return t.buyer === user;
      if (role === 'seller') return t.seller === user;
      return t.buyer === user || t.seller === user;
    });
  }

}

module.exports = new CarbonCreditExchange();
