// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-04T11:19:47.561Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Checkout Auto-Apply Integration
// Wires revenue conversion and AI pricing into UNICORN_FINAL checkout flow
// Status: PRODUCTION-READY for autonomous operation

const revenueConversion = require('../modules/revenue-conversion-auto');
const aiPricing = require('../modules/ai-personalized-pricing-auto');

/**
 * Initialize checkout integration
 * Call this in your Express app setup
 */
function setupCheckoutAutoApply(app) {
  // 1. Apply conversion tracking middleware
  app.use(revenueConversion.checkoutConversionMiddleware());

  // 2. Add GET /api/pricing/personalized endpoint
  app.get('/api/pricing/personalized', (req, res) => {
    try {
      const visitorContext = {
        pageViews: parseInt(req.query.pageViews || 1),
        sessionDuration: parseInt(req.query.sessionDuration || 0),
        referrer: req.get('referer') || req.query.referrer || undefined,
        device: req.query.device || detectDevice(req),
        country: req.query.country || detectCountry(req),
        isReturningUser: Boolean(req.cookies && req.cookies.userId)
      };

      const visitorId = req.cookies?.userId || req.ip;
      const pricing = aiPricing.getPriceForVisitor(visitorId, visitorContext);

      res.json({
        success: true,
        ...pricing
      });
    } catch (err) {
      console.error('[CheckoutIntegration] Pricing endpoint error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Add POST /api/checkout/complete endpoint
  app.post('/api/checkout/complete', async (req, res) => {
    try {
      const { orderId, amount, currency } = req.body;

      if (!orderId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing orderId or amount'
        });
      }

      // Record the paid event
      const result = await revenueConversion.recordPaidEvent({
        orderId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        source: 'checkout-complete',
        timestamp: new Date().toISOString()
      });

      res.json({
        success: result.success,
        message: result.success ? 'Payment recorded' : 'Error recording payment',
        metrics: revenueConversion.getMetrics()
      });
    } catch (err) {
      console.error('[CheckoutIntegration] Checkout error:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // 4. Add GET /api/metrics endpoint for monitoring
  app.get('/api/metrics', (req, res) => {
    res.json({
      revenue: revenueConversion.getMetrics(),
      pricing: aiPricing.getMetrics()
    });
  });

  console.log('[CheckoutAutoApply] Integration complete: autonomous checkout + pricing active');
}

/**
 * Utility: detect device from User-Agent
 */
function detectDevice(req) {
  const ua = req.get('user-agent') || '';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Utility: detect country (requires geoip middleware or header)
 */
function detectCountry(req) {
  return req.headers['x-country-code'] || req.geoip?.country_code || 'US';
}

module.exports = {
  setupCheckoutAutoApply
};
