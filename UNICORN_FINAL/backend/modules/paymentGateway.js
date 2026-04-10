// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:21:48.176Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:18:03.452Z
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
// Data: 2026-04-10T19:10:41.148Z
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
// Data: 2026-04-10T18:58:03.204Z
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
// Data: 2026-04-10T18:52:08.801Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.990Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

const axios = require('axios');
const QRCode = require('qrcode');
const { payments: dbPayments } = require('../db');

const DEFAULT_BTC_WALLET_ADDRESS = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const DEFAULT_APP_BASE_URL = 'http://localhost:3000';

class PaymentGateway {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.payments = new Map(); // session-level cache; durable state lives in SQLite via dbPayments
    this.appBaseUrl = this.normalizeBaseUrl(
      process.env.PUBLIC_APP_URL
      || process.env.APP_BASE_URL
      || process.env.FRONTEND_URL
      || DEFAULT_APP_BASE_URL
    );
    this.providers = {
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
      },
      paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID || '',
        clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        environment: (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
      }
    };
    this.wallets = {
      btc: process.env.BTC_WALLET_ADDRESS || DEFAULT_BTC_WALLET_ADDRESS,
      eth: process.env.ETH_WALLET_ADDRESS || process.env.USDC_WALLET_ADDRESS || ''
    };
    this.methods = [
      { id: 'card', name: 'Credit Card', currency: 'USD', active: this.isStripeConfigured(), feePercent: 2.9, settlement: 'instant', provider: 'stripe' },
      { id: 'paypal', name: 'PayPal', currency: 'USD', active: this.isPayPalConfigured(), feePercent: 3.4, settlement: 'instant', provider: 'paypal' },
      { id: 'stripe', name: 'Stripe', currency: 'USD', active: this.isStripeConfigured(), feePercent: 2.9, settlement: 'instant', provider: 'stripe' },
      { id: 'crypto_btc', name: 'Bitcoin', currency: 'BTC', active: true, feePercent: 1.2, settlement: '10-30 min' },
      { id: 'crypto_eth', name: 'Ethereum', currency: 'ETH', active: true, feePercent: 1.4, settlement: '2-10 min' },
      { id: 'bank', name: 'Bank Transfer', currency: 'EUR', active: true, feePercent: 0.8, settlement: '1-2 days' }
    ];
    this.statusFlow = ['created', 'pending', 'processing', 'completed'];
  }

  normalizeBaseUrl(value) {
    return String(value || DEFAULT_APP_BASE_URL).replace(/\/$/, '');
  }

  isStripeConfigured() {
    return Boolean(this.providers.stripe.secretKey);
  }

  isPayPalConfigured() {
    return Boolean(this.providers.paypal.clientId && this.providers.paypal.clientSecret);
  }

  getPayPalBaseUrl() {
    return this.providers.paypal.environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  getReturnUrl(txId, status = 'success') {
    return this.appBaseUrl + '/?payment=' + encodeURIComponent(status) + '&txId=' + encodeURIComponent(txId);
  }

  getPaymentMethods() {
    return this.methods.filter((method) => method.active);
  }

  async getBitcoinRate() {
    try {
      const response = await axios.get('https://api.coindesk.com/v1/bpi/currentprice/USD.json', { timeout: 8000 });
      return {
        asset: 'BTC',
        currency: 'USD',
        rate: Number(response.data?.bpi?.USD?.rate_float || 0),
        source: 'coindesk',
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        asset: 'BTC',
        currency: 'USD',
        rate: 65000,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
        warning: 'Live BTC rate unavailable, fallback used.'
      };
    }
  }

  getMethod(methodId) {
    return this.methods.find((item) => item.id === methodId && item.active);
  }

  getWalletAddress(method) {
    if (method === 'crypto_btc') {
      return this.wallets.btc;
    }

    if (method === 'crypto_eth') {
      return this.wallets.eth || null;
    }

    return null;
  }

  getProviderForMethod(method) {
    if (method === 'card' || method === 'stripe') {
      return 'stripe';
    }

    if (method === 'paypal') {
      return 'paypal';
    }

    return null;
  }

  async createStripeCheckout(payment) {
    if (!this.isStripeConfigured()) {
      throw new Error('Stripe credentials missing');
    }

    const form = new URLSearchParams();
    form.append('mode', 'payment');
    form.append('success_url', this.getReturnUrl(payment.txId, 'stripe-success'));
    form.append('cancel_url', this.getReturnUrl(payment.txId, 'stripe-cancel'));
    form.append('line_items[0][quantity]', '1');
    form.append('line_items[0][price_data][currency]', String(payment.currency || 'USD').toLowerCase());
    form.append('line_items[0][price_data][unit_amount]', String(Math.round(Number(payment.total || 0) * 100)));
    form.append('line_items[0][price_data][product_data][name]', payment.description || 'Unicorn AI Service');
    form.append('metadata[txId]', payment.txId);
    form.append('metadata[clientId]', payment.clientId || 'guest');

    const response = await axios.post('https://api.stripe.com/v1/checkout/sessions', form.toString(), {
      headers: {
        Authorization: 'Bearer ' + this.providers.stripe.secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data;
  }

  async getStripeCheckoutSession(sessionId) {
    const response = await axios.get('https://api.stripe.com/v1/checkout/sessions/' + sessionId, {
      headers: {
        Authorization: 'Bearer ' + this.providers.stripe.secretKey
      },
      timeout: 15000
    });

    return response.data;
  }

  async getPayPalAccessToken() {
    if (!this.isPayPalConfigured()) {
      throw new Error('PayPal credentials missing');
    }

    const response = await axios.post(this.getPayPalBaseUrl() + '/v1/oauth2/token', 'grant_type=client_credentials', {
      auth: {
        username: this.providers.paypal.clientId,
        password: this.providers.paypal.clientSecret
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data.access_token;
  }

  async createPayPalOrder(payment) {
    const accessToken = await this.getPayPalAccessToken();
    const response = await axios.post(this.getPayPalBaseUrl() + '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: payment.txId,
          description: payment.description,
          amount: {
            currency_code: String(payment.currency || 'USD').toUpperCase(),
            value: Number(payment.total || 0).toFixed(2)
          }
        }
      ],
      application_context: {
        user_action: 'PAY_NOW',
        return_url: this.getReturnUrl(payment.txId, 'paypal-success'),
        cancel_url: this.getReturnUrl(payment.txId, 'paypal-cancel')
      }
    }, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return response.data;
  }

  async capturePayPalOrder(orderId) {
    if (!orderId || !/^[A-Za-z0-9_-]{1,100}$/.test(orderId)) {
      throw new Error('Invalid PayPal order ID format');
    }
    const accessToken = await this.getPayPalAccessToken();
    const response = await axios.post(this.getPayPalBaseUrl() + '/v2/checkout/orders/' + orderId + '/capture', {}, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return response.data;
  }

  async createPayment(payload) {
    const {
      amount,
      currency = 'USD',
      method = 'card',
      clientId = 'guest',
      description = 'Unicorn AI Service',
      metadata = {}
    } = payload;

    if (!amount || Number(amount) <= 0) {
      throw new Error('Valid amount required');
    }

    const selectedMethod = this.getMethod(method);
    if (!selectedMethod) {
      throw new Error('Payment method unavailable');
    }

    const txId = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const numericAmount = Number(amount);
    const fee = Number((numericAmount * (selectedMethod.feePercent / 100)).toFixed(2));
    const total = Number((numericAmount + fee).toFixed(2));
    const provider = this.getProviderForMethod(method);
    const walletAddress = method.startsWith('crypto_') ? this.getWalletAddress(method) : null;
    if (method.startsWith('crypto_') && !walletAddress) {
      throw new Error('Crypto wallet address not configured for selected method');
    }
    const qrPayload = walletAddress
      ? await QRCode.toDataURL(walletAddress + '?amount=' + numericAmount + '&label=' + encodeURIComponent(description))
      : null;

    const payment = {
      txId,
      clientId,
      description,
      method,
      provider,
      currency,
      amount: numericAmount,
      fee,
      total,
      status: method.startsWith('crypto_') || provider ? 'pending' : 'created',
      walletAddress,
      qrCode: qrPayload,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (method === 'crypto_btc') {
      const rate = await this.getBitcoinRate();
      payment.exchangeRate = rate.rate;
      payment.cryptoAmount = Number((numericAmount / rate.rate).toFixed(8));
    }

    if (provider === 'stripe') {
      const session = await this.createStripeCheckout(payment);
      payment.providerPaymentId = session.id;
      payment.providerStatus = session.payment_status || 'unpaid';
      payment.checkoutUrl = session.url || null;
      payment.nextAction = session.url
        ? { type: 'redirect', url: session.url, label: 'Open Stripe Checkout' }
        : null;
    }

    if (provider === 'paypal') {
      const order = await this.createPayPalOrder(payment);
      const approvalUrl = (order.links || []).find((entry) => entry.rel === 'approve')?.href || null;
      payment.providerPaymentId = order.id;
      payment.providerStatus = order.status || 'CREATED';
      payment.checkoutUrl = approvalUrl;
      payment.nextAction = approvalUrl
        ? { type: 'redirect', url: approvalUrl, label: 'Open PayPal Checkout' }
        : null;
    }

    this.payments.set(txId, payment);
    dbPayments.save(payment);
    return payment;
  }

  getPaymentStatus(txId) {
    // Try in-memory first (fastest), fall back to DB (survives restart)
    return this.payments.get(txId) || dbPayments.findByTxId(txId) || null;
  }

  async processPayment(txId, details = {}) {
    const payment = this.payments.get(txId) || dbPayments.findByTxId(txId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.provider === 'stripe' && payment.providerPaymentId) {
      const session = await this.getStripeCheckoutSession(payment.providerPaymentId);
      const updatedPayment = {
        ...payment,
        status: session.payment_status === 'paid' ? 'completed' : 'pending',
        providerStatus: session.payment_status || payment.providerStatus || 'open',
        processorResponse: {
          approved: session.payment_status === 'paid',
          reference: session.payment_intent || session.id,
          note: session.payment_status === 'paid' ? 'Stripe checkout paid.' : 'Complete Stripe checkout, then verify again.'
        },
        updatedAt: new Date().toISOString()
      };

      this.payments.set(txId, updatedPayment);
      dbPayments.save(updatedPayment);
      return updatedPayment;
    }

    if (payment.provider === 'paypal' && payment.providerPaymentId) {
      try {
        const capture = await this.capturePayPalOrder(payment.providerPaymentId);
        const updatedPayment = {
          ...payment,
          status: capture.status === 'COMPLETED' ? 'completed' : 'pending',
          providerStatus: capture.status || payment.providerStatus || 'CREATED',
          processorResponse: {
            approved: capture.status === 'COMPLETED',
            reference: capture.id || payment.providerPaymentId,
            note: capture.status === 'COMPLETED' ? 'PayPal payment captured.' : 'PayPal payment still awaiting approval.'
          },
          updatedAt: new Date().toISOString()
        };

        this.payments.set(txId, updatedPayment);
        dbPayments.save(updatedPayment);
        return updatedPayment;
      } catch (error) {
        if (error.response?.status === 422 || error.response?.status === 409) {
          const updatedPayment = {
            ...payment,
            status: 'pending',
            processorResponse: {
              approved: false,
              reference: payment.providerPaymentId,
              note: error.response?.data?.message || 'Approve PayPal checkout first, then capture the payment.'
            },
            updatedAt: new Date().toISOString()
          };

          this.payments.set(txId, updatedPayment);
          dbPayments.save(updatedPayment);
          return updatedPayment;
        }

        throw error;
      }
    }

    const nextStatus = payment.status === 'created'
      ? 'processing'
      : payment.status === 'pending'
        ? 'processing'
        : payment.status === 'processing'
          ? 'completed'
          : payment.status;

    const updatedPayment = {
      ...payment,
      status: nextStatus,
      processorResponse: {
        approved: nextStatus === 'completed' || details.approved === true,
        reference: details.reference || 'ref_' + Math.random().toString(36).slice(2, 10),
        note: details.note || null
      },
      updatedAt: new Date().toISOString()
    };

    if (updatedPayment.processorResponse.approved && nextStatus === 'processing') {
      updatedPayment.status = 'completed';
    }

    this.payments.set(txId, updatedPayment);
    dbPayments.save(updatedPayment);
    return updatedPayment;
  }

  getTransactionHistory(filters = {}) {
    return dbPayments.list(filters);
  }

  getStats() {
    const allPayments = dbPayments.list();
    const completed = allPayments.filter(p => p.status === 'completed');
    const revenue = completed.reduce((sum, p) => sum + p.total, 0);
    const byMethod = allPayments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPayments: allPayments.length,
      completedPayments: completed.length,
      pendingPayments: allPayments.filter(p => p.status === 'pending' || p.status === 'processing').length,
      revenue: Number(revenue.toFixed(2)),
      byMethod,
      activeMethods: this.methods.filter(m => m.active).length,
      supportedStatuses: this.statusFlow
    };
  }

  activateMethod(methodId, active = true) {
    const method = this.methods.find((item) => item.id === methodId);
    if (!method) {
      throw new Error('Method not found');
    }
    if (active !== false && method.provider === 'stripe' && !this.isStripeConfigured()) {
      throw new Error('Stripe credentials missing');
    }
    if (active !== false && method.provider === 'paypal' && !this.isPayPalConfigured()) {
      throw new Error('PayPal credentials missing');
    }
    method.active = active !== false;
    return { success: true, method };
  }
}

module.exports = new PaymentGateway();
