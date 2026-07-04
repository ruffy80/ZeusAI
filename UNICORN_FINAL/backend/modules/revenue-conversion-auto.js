// Revenue Conversion Framework (Auto-Apply Ready)
// Autonomous integration point for checkout → paidEvent tracking
// Status: PRODUCTION-READY for auto-apply

const fs = require('fs');
const path = require('path');

const REVENUE_LOG = path.join(__dirname, '../../data/revenue_events.log');
const CONVERSION_STATE = path.join(__dirname, '../../data/conversion-state.json');

/**
 * Initialize revenue tracking state
 */
function initializeState() {
  try {
    if (!fs.existsSync(path.dirname(CONVERSION_STATE))) {
      fs.mkdirSync(path.dirname(CONVERSION_STATE), { recursive: true });
    }
    if (!fs.existsSync(CONVERSION_STATE)) {
      const initial = {
        paidEvents: 0,
        totalRevenue: 0,
        conversionRate: 0,
        leads: 0,
        lastReset: new Date().toISOString(),
        autoApplyEnabled: true
      };
      fs.writeFileSync(CONVERSION_STATE, JSON.stringify(initial, null, 2));
    }
  } catch (err) {
    console.error('[RevenueConversion] Init failed:', err);
  }
}

/**
 * Log a paid event (autonomous checkpoint)
 */
async function recordPaidEvent(eventData) {
  try {
    const state = JSON.parse(fs.readFileSync(CONVERSION_STATE, 'utf8'));
    state.paidEvents = (state.paidEvents || 0) + 1;
    state.totalRevenue = (state.totalRevenue || 0) + (eventData.amount || 0);
    state.conversionRate = state.leads > 0 ? (state.paidEvents / state.leads) * 100 : 0;
    state.lastEvent = new Date().toISOString();
    
    fs.writeFileSync(CONVERSION_STATE, JSON.stringify(state, null, 2));
    
    // Also log to event stream
    const logEntry = {
      ts: new Date().toISOString(),
      type: 'paidEvent',
      ...eventData
    };
    fs.appendFileSync(REVENUE_LOG, JSON.stringify(logEntry) + '\n');
    
    return { success: true, ...state };
  } catch (err) {
    console.error('[RevenueConversion] recordPaidEvent failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get current conversion metrics
 */
function getMetrics() {
  try {
    if (fs.existsSync(CONVERSION_STATE)) {
      return JSON.parse(fs.readFileSync(CONVERSION_STATE, 'utf8'));
    }
  } catch (err) {
    console.error('[RevenueConversion] getMetrics failed:', err);
  }
  return { paidEvents: 0, totalRevenue: 0, conversionRate: 0, leads: 0 };
}

/**
 * Auto-apply middleware for Express
 */
function checkoutConversionMiddleware() {
  return async (req, res, next) => {
    // Intercept successful checkout responses
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      if (body && body.success && req.path.includes('checkout')) {
        // Auto-record paid event
        recordPaidEvent({
          orderId: body.orderId || 'unknown',
          amount: body.amount || 0,
          currency: body.currency || 'USD',
          source: 'auto-middleware',
          timestamp: new Date().toISOString()
        }).catch(err => console.error('[RevenueConversion] middleware error:', err));
      }
      return originalJson(body);
    };
    next();
  };
}

// Auto-initialize on require
initializeState();

module.exports = {
  recordPaidEvent,
  getMetrics,
  checkoutConversionMiddleware,
  initializeState
};
