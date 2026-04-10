// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:38:58.446Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:33:19.618Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:28:24.680Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:27:44.400Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.218Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.235Z
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
// Data: 2026-04-10T19:14:20.606Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.149Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.449Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.205Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.289Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.152Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.802Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.990Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

class PaymentSystems {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.transactions = [];
    this.merchants = new Map();
    this.exchangeRates = {
      USD: { EUR: 0.92, GBP: 0.79, AED: 3.67 },
      EUR: { USD: 1.08, GBP: 0.86, AED: 3.97 },
      GBP: { USD: 1.27, EUR: 1.16, AED: 4.62 }
    };
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1;
    const rate = this.exchangeRates[fromCurrency]?.[toCurrency];
    if (rate) return rate;
    return 1 + (Math.random() * 0.15);
  }

  calculateRiskScore(transaction = {}) {
    const amountRisk = Math.min(Number(transaction.amount || 0) / 50000, 1);
    const geographyRisk = transaction.crossBorder ? 0.3 : 0.08;
    const velocityRisk = Math.min(Number(transaction.recentTransactions || 0) / 20, 1) * 0.3;
    const merchantRisk = transaction.knownMerchant ? 0.05 : 0.2;
    return Number(Math.min(amountRisk * 0.4 + geographyRisk + velocityRisk + merchantRisk, 0.99).toFixed(2));
  }

  async processCrossBorderPayment(params = {}) {
    const { fromCurrency = 'USD', toCurrency = 'EUR', amount = 0, merchantId = 'merchant_default' } = params;
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const numericAmount = Number(amount || 0);
    const fee = Number((numericAmount * 0.005).toFixed(2));
    const transactionId = 'xb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const transaction = {
      transactionId,
      merchantId,
      fromCurrency,
      toCurrency,
      amount: numericAmount,
      rate,
      amountConverted: Number((numericAmount * rate).toFixed(2)),
      fee,
      createdAt: new Date().toISOString()
    };
    this.transactions.push(transaction);
    return transaction;
  }

  detectFraud(transaction = {}) {
    const riskScore = this.calculateRiskScore(transaction);
    return {
      riskScore,
      flagged: riskScore > 0.7,
      reason: riskScore > 0.7 ? 'Suspicious pattern' : null
    };
  }

  processCardPayment(cardDetails = {}, amount = 0) {
    const last4 = String(cardDetails.number || '0000').slice(-4);
    return {
      success: true,
      authorizationCode: 'AUTH' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      fee: Number((Number(amount || 0) * 0.02).toFixed(2)),
      cardNetwork: cardDetails.network || 'Visa',
      maskedCard: '**** **** **** ' + last4
    };
  }
}

module.exports = new PaymentSystems();
