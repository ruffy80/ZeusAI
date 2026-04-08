require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
// const cron = require('node-cron'); // Optional scheduling
const simpleGit = require('simple-git');

const app = express();
const PORT = process.env.PORT || 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'unicorn-jwt-secret-change-in-prod';

app.use(compression());
app.use(cors());
app.use(express.json());

// ==================== AUTH STORE (in-memory) ====================
const users = [];
const adminSessions = new Set();
const ADMIN_OWNER_NAME = process.env.LEGAL_OWNER_NAME || 'Vladoi Ionut';
const ADMIN_OWNER_EMAIL = process.env.ADMIN_EMAIL || process.env.LEGAL_OWNER_EMAIL || 'vladoi_ionut@yahoo.com';
const ADMIN_OWNER_BTC = process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
let adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_MASTER_PASSWORD || 'UnicornAdmin2026!', 10);
let adminBiometricHash = null;

function adminSecretMiddleware(req, res, next) {
  const expected = process.env.ADMIN_SECRET || '';
  const headerSecret = req.headers['x-admin-secret'];
  const authHeader = req.headers.authorization || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const provided = headerSecret || bearerSecret || req.query.adminSecret;

  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  return next();
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function extractAdminToken(req) {
  const headerToken = req.headers['x-auth-token'];
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return headerToken || bearer || '';
}

function adminTokenMiddleware(req, res, next) {
  const token = extractAdminToken(req);
  if (!token) return res.status(401).json({ error: 'Admin token missing' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!adminSessions.has(token)) return res.status(401).json({ error: 'Session expired' });
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: crypto.randomBytes(8).toString('hex'), name, email, passwordHash, createdAt: new Date().toISOString(), resetToken: null, resetExpires: null };
  users.push(user);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, twoFactorCode } = req.body || {};

  // Admin login (password + 2FA)
  if (!email && password && typeof twoFactorCode !== 'undefined') {
    const expected2FA = process.env.ADMIN_2FA_CODE || '123456';
    const validPassword = await bcrypt.compare(password, adminPasswordHash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Parolă invalidă' });
    if (String(twoFactorCode).trim() !== String(expected2FA).trim()) {
      return res.status(401).json({ success: false, error: 'Cod 2FA invalid' });
    }

    const token = jwt.sign({ role: 'admin', email: ADMIN_OWNER_EMAIL, name: ADMIN_OWNER_NAME }, JWT_SECRET, { expiresIn: '12h' });
    adminSessions.add(token);

    return res.json({
      success: true,
      token,
      owner: {
        name: ADMIN_OWNER_NAME,
        email: ADMIN_OWNER_EMAIL,
        btcAddress: ADMIN_OWNER_BTC
      }
    });
  }

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/status', adminTokenMiddleware, (req, res) => {
  res.json({
    owner: { name: ADMIN_OWNER_NAME, email: ADMIN_OWNER_EMAIL, btcAddress: ADMIN_OWNER_BTC },
    activeSessions: adminSessions.size,
    biometricEnabled: Boolean(adminBiometricHash)
  });
});

app.post('/api/auth/logout', adminTokenMiddleware, (req, res) => {
  const token = extractAdminToken(req);
  adminSessions.delete(token);
  res.json({ success: true });
});

app.post('/api/auth/change-password', adminTokenMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
  const validOld = await bcrypt.compare(oldPassword, adminPasswordHash);
  if (!validOld) return res.status(401).json({ error: 'Parola veche este invalidă' });
  adminPasswordHash = await bcrypt.hash(newPassword, 10);
  res.json({ success: true });
});

app.post('/api/auth/biometric/enroll', adminTokenMiddleware, (req, res) => {
  const { sample } = req.body || {};
  if (!sample) return res.status(400).json({ error: 'sample required' });
  adminBiometricHash = crypto.createHash('sha256').update(String(sample)).digest('hex');
  res.json({ success: true });
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const { name, email } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (name) user.name = name;
  if (email) user.email = email;
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetToken = resetToken;
  user.resetExpires = Date.now() + 3600000;
  // In production: send email with link /reset-password?token=resetToken
  res.json({ message: 'Password reset email sent', devToken: resetToken });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
  const user = users.find(u => u.resetToken === token && u.resetExpires > Date.now());
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetToken = null;
  user.resetExpires = null;
  res.json({ message: 'Password reset successful' });
});

// ==================== MODULE AUTONOME ====================
const autoDeploy = { start: () => {} };
const selfConstruction = { start: () => {} };
const totalSystemHealer = { start: () => {} };

// ==================== INOVAȚII - MOCK MODULES ====================
// Using mock modules to avoid syntax errors in older innovation modules
const mockModule = (name) => ({
  [name]: { status: 'enabled' },
  getStatus: () => ({ status: 'enabled', name }),
  create: (data) => ({ success: true, data }),
  get: (id) => ({ id, data: {} })
});

const qrIdentity = mockModule('qrIdentity');
const aiNegotiator = mockModule('aiNegotiator');
const carbonExchange = mockModule('carbonExchange');
const marketplace = mockModule('marketplace');
const complianceEngine = mockModule('complianceEngine');
const riskAnalyzer = mockModule('riskAnalyzer');
const reputationProtocol = mockModule('reputationProtocol');
const opportunityRadar = mockModule('opportunityRadar');
const businessBlueprint = mockModule('businessBlueprint');
const paymentGateway = mockModule('paymentGateway');
const aviationModule = mockModule('aviationModule');
const paymentSystems = mockModule('paymentSystems');
const governmentModule = mockModule('governmentModule');
const defenseModule = mockModule('defenseModule');
const telecomModule = mockModule('telecomModule');
const enterprisePartner = mockModule('enterprisePartner');
const quantumChain = mockModule('quantumChain');
const workforce = mockModule('workforce');
const ma = mockModule('ma');
const legal = mockModule('legal');
const energy = mockModule('energy');
const uac = mockModule('uac');
const socialViralizer = mockModule('socialViralizer');
const umn = mockModule('umn');
const gdes = mockModule('gdes');
const ultimateModules = mockModule('ultimateModules');
const uee = mockModule('uee');
const legalFortress = mockModule('legalFortress');
const qrc = mockModule('qrc');
const executiveDashboard = mockModule('executiveDashboard');

const unicornInnovationSuite = require('./modules/unicornInnovationSuite');
const autonomousInnovation = require('./modules/autonomousInnovation');
const autoRevenue = require('./modules/autoRevenue');

// Pornire module autonome
selfConstruction.start();
totalSystemHealer.start();
autoDeploy.start();

// Start autonomous systems
console.log('🤖 Autonomous Innovation Engine: STARTING');
console.log('💰 Auto Revenue Engine: STARTING');

// ==================== RUTE API ====================
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/api/modules', (req, res) => {
  const fs = require('fs');
  const modules = fs.readdirSync(path.join(__dirname, 'modules')).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
  res.json({ modules });
});

// ==================== RUTE INOVAȚII ====================

// 1. Quantum-Resistant Digital Identity
app.post('/api/identity/create', (req, res) => {
  const { userId, metadata } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  res.json(qrIdentity.generateIdentity(userId, metadata));
});

app.post('/api/identity/sign', (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });
  try {
    res.json(qrIdentity.sign(userId, message));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/identity/verify', (req, res) => {
  const { publicKey, message, signature } = req.body;
  const result = qrIdentity.verify(publicKey, message, signature);
  res.json(result);
});

// 2. Autonomous AI Negotiator
app.post('/api/negotiate/start', (req, res) => {
  const { counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime } = req.body;
  if (!counterparty || !topic || !initialOffer) return res.status(400).json({ error: 'counterparty, topic and initialOffer required' });
  res.json(aiNegotiator.startNegotiation({ counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime }));
});

app.post('/api/negotiate/message/:id', async (req, res) => {
  const { id } = req.params;
  const { message, userType } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    res.json(await aiNegotiator.processMessage(parseInt(id), message, userType));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/negotiate/:id', (req, res) => {
  const negotiation = aiNegotiator.getNegotiation(parseInt(req.params.id));
  if (!negotiation) return res.status(404).json({ error: 'Negotiation not found' });
  res.json(negotiation);
});

app.get('/api/negotiate/stats', (req, res) => {
  res.json(aiNegotiator.getStats());
});

// 3. Universal Carbon Credit Exchange
app.post('/api/carbon/issue', (req, res) => {
  const { owner, amount, type, projectId, vintage } = req.body;
  if (!owner || !amount) return res.status(400).json({ error: 'owner and amount required' });
  res.json(carbonExchange.issueCredits(owner, amount, type, projectId, vintage));
});

app.post('/api/carbon/trade', async (req, res) => {
  const { buyer, seller, creditId, amount } = req.body;
  try {
    res.json(await carbonExchange.executeTrade(buyer, seller, creditId, amount));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/sell', (req, res) => {
  const { seller, creditId, amount, price } = req.body;
  try {
    res.json(carbonExchange.createSellOrder(seller, creditId, amount, price));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/buy', (req, res) => {
  const { buyer, creditType, amount, maxPrice } = req.body;
  res.json(carbonExchange.createBuyOrder(buyer, creditType, amount, maxPrice));
});

app.post('/api/carbon/match', async (req, res) => {
  res.json(await carbonExchange.matchOrders());
});

app.get('/api/carbon/portfolio/:owner', (req, res) => {
  res.json(carbonExchange.getPortfolio(req.params.owner));
});

app.get('/api/carbon/stats', (req, res) => {
  res.json(carbonExchange.getMarketStats());
});

app.get('/api/carbon/transactions/:user', (req, res) => {
  const { role } = req.query;
  res.json(carbonExchange.getTransactionHistory(req.params.user, role));
});

app.post('/api/carbon/price', (req, res) => {
  const { type, price } = req.body;
  res.json(carbonExchange.updateMarketPrice(type, price));
});

// ==================== MARKETPLACE ROUTES ====================
app.get('/api/marketplace/services', (req, res) => {
  res.json({ services: marketplace.getAllServices() });
});

app.get('/api/marketplace/categories', (req, res) => {
  const categories = {};
  for (const service of marketplace.getAllServices()) {
    if (!categories[service.category]) categories[service.category] = [];
    categories[service.category].push(service);
  }
  res.json({ categories });
});

app.post('/api/marketplace/price', (req, res) => {
  const { serviceId, clientId, clientData } = req.body;
  const price = marketplace.getPersonalizedPrice(serviceId, clientId, clientData);
  if (!price) return res.status(404).json({ error: 'Service not found' });
  res.json({ serviceId, personalizedPrice: price });
});

app.post('/api/marketplace/purchase', (req, res) => {
  const { serviceId, clientId, price, paymentTxId, paymentMethod, serviceName, description } = req.body;
  const client = marketplace.recordPurchase(serviceId, clientId, price, {
    paymentTxId,
    paymentMethod,
    serviceName,
    description
  });
  res.json({ success: true, client });
});

app.get('/api/marketplace/purchases/:clientId', (req, res) => {
  res.json({ purchases: marketplace.getClientPurchases(req.params.clientId) });
});

app.get('/api/marketplace/recommendations/:clientId', (req, res) => {
  const recommendations = marketplace.getRecommendations(req.params.clientId);
  res.json({ recommendations });
});

app.get('/api/marketplace/stats', (req, res) => {
  res.json(marketplace.getMarketplaceStats());
});

app.post('/api/marketplace/discount', (req, res) => {
  const { clientId, serviceId, discountPercent } = req.body;
  const offer = marketplace.applySpecialDiscount(clientId, serviceId, discountPercent / 100);
  res.json(offer);
});

app.post('/api/marketplace/demand', (req, res) => {
  const { serviceId, delta } = req.body;
  marketplace.updateDemand(serviceId, delta);
  res.json({ success: true });
});

// ==================== PAYMENT ROUTES ====================
app.get('/api/payment/methods', (req, res) => {
  res.json({ methods: paymentGateway.getPaymentMethods() });
});

app.get('/api/payment/btc-rate', async (req, res) => {
  try {
    res.json(await paymentGateway.getBitcoinRate());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payment/create', async (req, res) => {
  try {
    const payment = await paymentGateway.createPayment(req.body || {});
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/status/:txId', (req, res) => {
  const payment = paymentGateway.getPaymentStatus(req.params.txId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

app.post('/api/payment/process/:txId', async (req, res) => {
  try {
    const payment = await paymentGateway.processPayment(req.params.txId, req.body || {});
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payment/history', (req, res) => {
  const { clientId, status, method } = req.query;
  res.json({ payments: paymentGateway.getTransactionHistory({ clientId, status, method }) });
});

app.get('/api/payment/stats', (req, res) => {
  res.json(paymentGateway.getStats());
});

app.post('/api/admin/payment/activate', (req, res) => {
  const { method, active } = req.body;
  try {
    res.json(paymentGateway.activateMethod(method, active));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== EXTENDED DOMAIN ROUTES ====================

// Aviation
app.post('/api/aviation/optimize-routes', async (req, res) => {
  try {
    const result = await aviationModule.optimizeRoutes(req.body.airlineId, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/aviation/predictive-maintenance', (req, res) => {
  res.json(aviationModule.predictiveMaintenance(req.body || {}));
});

app.post('/api/aviation/ticket-pricing', (req, res) => {
  const { route, demand, competitors } = req.body;
  res.json(aviationModule.optimizeTicketPrices(route || {}, demand || {}, competitors || []));
});

// Payment Systems
app.post('/api/payments/cross-border', async (req, res) => {
  try {
    const result = await paymentSystems.processCrossBorderPayment(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payments/fraud-detection', (req, res) => {
  res.json(paymentSystems.detectFraud(req.body || {}));
});

app.post('/api/payments/card', (req, res) => {
  const { cardDetails, amount } = req.body;
  res.json(paymentSystems.processCardPayment(cardDetails || {}, Number(amount || 0)));
});

// Government
app.post('/api/government/compliance', (req, res) => {
  const result = governmentModule.checkGovCompliance(req.body.agency, req.body.requirements || []);
  res.json(result);
});

app.post('/api/government/digitalize-service', (req, res) => {
  const { serviceId, params } = req.body;
  res.json(governmentModule.digitalizeService(serviceId, params || {}));
});

app.post('/api/government/analyze-policy', (req, res) => {
  res.json(governmentModule.analyzePolicy(req.body.policyText || ''));
});

// Defense
app.post('/api/defense/encrypt', (req, res) => {
  try {
    const result = defenseModule.quantumEncrypt(req.body.message || '', req.body.recipient);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/defense/threats', (req, res) => {
  res.json(defenseModule.analyzeThreats(req.body || {}));
});

app.post('/api/defense/secure-infrastructure', (req, res) => {
  const { infraId, params } = req.body;
  res.json(defenseModule.secureInfrastructure(infraId, params || {}));
});

// Telecom
app.post('/api/telecom/optimize-5g', (req, res) => {
  res.json(telecomModule.optimize5GNetwork(req.body.networkId, req.body.traffic || {}));
});

app.post('/api/telecom/predict-failures', (req, res) => {
  res.json(telecomModule.predictFailures(req.body || {}));
});

app.post('/api/telecom/revenue-assurance', (req, res) => {
  res.json(telecomModule.revenueAssurance(req.body.cdrData || []));
});

// Enterprise Partnership API
app.post('/api/enterprise/register', async (req, res) => {
  try {
    const partner = enterprisePartner.registerPartner(req.body || {});
    res.json(partner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/partner/:partnerId/:endpoint', async (req, res) => {
  const { partnerId, endpoint } = req.params;
  const apiKey = req.headers['x-api-key'];
  const partner = enterprisePartner.partners.get(partnerId);

  if (!partner || partner.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const result = await enterprisePartner.handlePartnerRequest(partnerId, endpoint, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/partner/:partnerId/dashboard', async (req, res) => {
  const { partnerId } = req.params;
  const apiKey = req.headers['x-api-key'];
  const partner = enterprisePartner.partners.get(partnerId);

  if (!partner || partner.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const dashboard = enterprisePartner.getPartnerDashboard(partnerId);
  res.json(dashboard);
});

app.get('/api/partner/:partnerId/invoice/:month', async (req, res) => {
  try {
    const { partnerId, month } = req.params;
    const invoice = enterprisePartner.generateInvoice(partnerId, month);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== ADVANCED MODULE ROUTES ====================

// Compliance Engine
app.post('/api/compliance/check', async (req, res) => {
  const { operation, data } = req.body;
  if (!operation) return res.status(400).json({ error: 'operation required' });
  const result = await complianceEngine.checkCompliance(operation, data || {});
  res.json(result);
});

app.get('/api/compliance/report', (req, res) => {
  const { period } = req.query;
  res.json(complianceEngine.generateReport(period || 'month'));
});

app.get('/api/compliance/stats', (req, res) => {
  res.json(complianceEngine.getStats());
});

// Risk Analyzer
app.post('/api/risk/analyze', async (req, res) => {
  const { type, data } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  try {
    const result = await riskAnalyzer.analyzeRisk(type, data || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/risk/history', (req, res) => {
  const limit = Number(req.query.limit || 100);
  res.json({ history: riskAnalyzer.getHistory(limit) });
});

app.get('/api/risk/stats', (req, res) => {
  res.json(riskAnalyzer.getStats());
});

// Reputation Protocol
app.post('/api/reputation/register', (req, res) => {
  const { entityId, type, metadata } = req.body;
  if (!entityId || !type) return res.status(400).json({ error: 'entityId and type required' });
  try {
    res.json(reputationProtocol.registerEntity(entityId, type, metadata || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reputation/review', (req, res) => {
  const { reviewerId, targetId, rating, comment, metadata } = req.body;
  try {
    res.json(reputationProtocol.addReview(reviewerId, targetId, rating, comment, metadata || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reputation/transaction', (req, res) => {
  const { entityId, counterpartyId, amount, type } = req.body;
  try {
    res.json(reputationProtocol.recordTransaction(entityId, counterpartyId, amount, type || 'payment'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reputation/:entityId', (req, res) => {
  const reputation = reputationProtocol.getReputation(req.params.entityId);
  if (!reputation) return res.status(404).json({ error: 'Entity not found' });
  res.json(reputation);
});

app.get('/api/reputation/top/list', (req, res) => {
  const limit = Number(req.query.limit || 10);
  const { type } = req.query;
  res.json({ top: reputationProtocol.getTopEntities(limit, type || null) });
});

app.get('/api/reputation/stats', (req, res) => {
  res.json(reputationProtocol.getStats());
});

// Opportunity Radar
app.get('/api/opportunity/list', (req, res) => {
  const filters = {
    minRelevance: req.query.minRelevance ? Number(req.query.minRelevance) : undefined,
    deadlineBefore: req.query.deadlineBefore
  };
  res.json({ opportunities: opportunityRadar.getOpportunities(filters) });
});

app.get('/api/opportunity/alerts/unread', (req, res) => {
  res.json({ alerts: opportunityRadar.getUnreadAlerts() });
});

app.post('/api/opportunity/alerts/read', (req, res) => {
  const { alertId } = req.body;
  res.json(opportunityRadar.markAlertRead(alertId));
});

app.post('/api/opportunity/recommendations', (req, res) => {
  res.json({ recommendations: opportunityRadar.getPersonalizedRecommendations(req.body || {}) });
});

app.get('/api/opportunity/stats', (req, res) => {
  res.json(opportunityRadar.getStats());
});

// Business Blueprint
app.post('/api/blueprint/generate', async (req, res) => {
  try {
    const blueprint = await businessBlueprint.generateBlueprint(req.body || {});
    res.json(blueprint);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/blueprint/list', (req, res) => {
  res.json({ blueprints: businessBlueprint.getAllBlueprints() });
});

app.get('/api/blueprint/:id', (req, res) => {
  const blueprint = businessBlueprint.getBlueprint(req.params.id);
  if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(blueprint);
});

// ==================== 5 INOVAȚII STRATEGICE ====================

// Quantum Blockchain
app.get('/api/blockchain/stats', (req, res) => {
  res.json(quantumChain.getStats());
});

app.post('/api/blockchain/transaction', (req, res) => {
  const tx = quantumChain.addTransaction(req.body || {});
  res.json(tx);
});

app.post('/api/blockchain/mine', (req, res) => {
  const block = quantumChain.mineBlock();
  res.json(block);
});

// AI Workforce Marketplace
app.get('/api/workforce/agents', (req, res) => {
  res.json(Array.from(workforce.agents.values()));
});

app.post('/api/workforce/agent', (req, res) => {
  try {
    res.json(workforce.registerAgent(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workforce/job', (req, res) => {
  try {
    res.json(workforce.postJob(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/workforce/job/:id/agents', (req, res) => {
  res.json(workforce.findBestAgents(req.params.id));
});

app.get('/api/workforce/stats', (req, res) => {
  res.json(workforce.getStats());
});

// M&A Advisor
app.post('/api/ma/targets', (req, res) => {
  res.json(ma.identifyTargets(req.body || {}));
});

app.post('/api/ma/negotiate', async (req, res) => {
  try {
    const deal = await ma.negotiateTerms(req.body.targetId, Number(req.body.initialOffer || 0), Number(req.body.maxPrice || 0));
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ma/stats', (req, res) => {
  res.json(ma.getStats());
});

// Legal Contract
app.post('/api/legal/generate', (req, res) => {
  try {
    res.json(legal.generateContract(req.body.type, req.body.params || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/legal/analyze', (req, res) => {
  try {
    res.json(legal.analyzeContract(req.body.text || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/legal/stats', (req, res) => {
  res.json(legal.getStats());
});

// Energy Grid
app.post('/api/energy/producer', (req, res) => {
  res.json(energy.registerProducer(req.body || {}));
});

app.post('/api/energy/consumer', (req, res) => {
  res.json(energy.registerConsumer(req.body || {}));
});

app.post('/api/energy/optimize', (req, res) => {
  res.json(energy.optimizeFlow());
});

app.post('/api/energy/trade', async (req, res) => {
  res.json(await energy.tradeExcessEnergy());
});

app.get('/api/energy/stats', (req, res) => {
  res.json(energy.getStats());
});

// ==================== UNICORN AUTONOMOUS CORE ====================
app.get('/api/uac/status', (req, res) => {
  res.json(uac.getStatus());
});

app.post('/api/uac/cycle', async (req, res) => {
  await uac.fullAutonomousCycle();
  res.json({ success: true, message: 'Autonomous cycle triggered' });
});

app.post('/api/uac/innovate', async (req, res) => {
  await uac.deepInnovationCycle();
  res.json({ success: true, message: 'Deep innovation cycle triggered' });
});

app.post('/api/uac/optimize', async (req, res) => {
  // Mock implementation
  res.json({ success: true, message: 'System optimization triggered' });
});

// ==================== ADVANCED MODULES (MOCKED) ====================
// These routes are mocked to avoid syntax errors in complex innovation modules
// The autonomous systems (innovation + revenue) are the primary focus

// ==================== UNICORN INNOVATION SUITE (10/10) ====================
// 1) Trust Center
app.get('/api/trust/status', (req, res) => {
  res.json(unicornInnovationSuite.getTrustStatus());
});

app.get('/api/trust/incidents', (req, res) => {
  res.json({ incidents: unicornInnovationSuite.getIncidents() });
});

app.get('/api/trust/audit', adminTokenMiddleware, (req, res) => {
  res.json({ audit: unicornInnovationSuite.getAuditTrail() });
});

// 2) Usage-based billing + plans
app.get('/api/billing/plans', adminTokenMiddleware, (req, res) => {
  res.json({ plans: unicornInnovationSuite.getPlans() });
});

app.post('/api/billing/subscribe', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.subscribe(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/billing/usage/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.trackUsage(req.params.clientId, req.body || {}));
});

app.get('/api/billing/usage/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.getUsage(req.params.clientId));
});

app.get('/api/billing/invoice/:clientId', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.buildInvoice(req.params.clientId));
});

// 3) API keys + webhooks
app.post('/api/platform/api-keys', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.createApiKey(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/platform/api-keys', adminTokenMiddleware, (req, res) => {
  res.json({ keys: unicornInnovationSuite.listApiKeys() });
});

app.post('/api/platform/webhooks', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.registerWebhook(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/platform/webhooks/test', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.triggerWebhookTest((req.body || {}).eventName));
});

// 4) Marketplace intelligence score
app.get('/api/marketplace/intelligence', (req, res) => {
  res.json(unicornInnovationSuite.getMarketplaceIntelligence(req.query.clientId));
});

// 5) Autonomous experiment engine
app.get('/api/experiments', adminTokenMiddleware, (req, res) => {
  res.json({ experiments: unicornInnovationSuite.listExperiments() });
});

app.post('/api/experiments', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.createExperiment(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/experiments/:id/evaluate', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.evaluateExperiment(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 6) Executive Copilot
app.post('/api/executive/copilot', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.askCopilot(req.body || {}));
});

// 7) Security hardening APIs
app.get('/api/security/sessions', adminTokenMiddleware, (req, res) => {
  res.json({ sessions: unicornInnovationSuite.listSessions() });
});

app.post('/api/security/sessions/register', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.registerSession(req.body || {}));
});

app.post('/api/security/sessions/revoke', adminTokenMiddleware, (req, res) => {
  try {
    res.json(unicornInnovationSuite.revokeSession((req.body || {}).sessionId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/security/device/check', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.checkDevice(req.body || {}));
});

// 8) Onboarding wizard
app.post('/api/onboarding/start', (req, res) => {
  res.json(unicornInnovationSuite.startOnboarding(req.body || {}));
});

app.get('/api/onboarding/recommendations/:id', (req, res) => {
  try {
    res.json(unicornInnovationSuite.getOnboardingRecommendations(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 9) Case studies + ROI calculator
app.get('/api/site/case-studies', (req, res) => {
  res.json({ caseStudies: unicornInnovationSuite.getCaseStudies() });
});

app.post('/api/site/roi/calculate', (req, res) => {
  res.json(unicornInnovationSuite.calculateROI(req.body || {}));
});

// 10) Partner / affiliate layer
app.post('/api/partners/referral/create', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.createReferral(req.body || {}));
});

app.get('/api/partners/referral/:code', (req, res) => {
  try {
    res.json(unicornInnovationSuite.getReferral(req.params.code));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/partners/affiliate/stats', adminTokenMiddleware, (req, res) => {
  res.json(unicornInnovationSuite.getAffiliateStats());
});

// ==================== AUTONOMOUS INNOVATION ROUTES ====================
app.get('/api/autonomous/innovation/status', (req, res) => {
  res.json(autonomousInnovation.getStatus());
});

app.get('/api/autonomous/innovation/history', (req, res) => {
  const limit = req.query.limit || 20;
  res.json(autonomousInnovation.getInnovationHistory(limit));
});

app.get('/api/autonomous/innovation/metrics', (req, res) => {
  res.json(autonomousInnovation.getDeploymentMetrics());
});

app.post('/api/autonomous/innovation/trigger', adminTokenMiddleware, (req, res) => {
  const innov = autonomousInnovation.generateNewInnovation();
  res.json({ success: true, innovation: innov });
});

app.post('/api/autonomous/innovation/optimize', adminTokenMiddleware, (req, res) => {
  autonomousInnovation.selfOptimize();
  res.json({ success: true, message: 'Self-optimization triggered' });
});

// ==================== AUTO REVENUE ROUTES ====================
app.get('/api/autonomous/revenue/status', (req, res) => {
  res.json(autoRevenue.getRevenueStatus());
});

app.get('/api/autonomous/revenue/history', (req, res) => {
  const limit = req.query.limit || 20;
  res.json(autoRevenue.getRevenueHistory(limit));
});

app.get('/api/autonomous/revenue/metrics', (req, res) => {
  res.json(autoRevenue.getDetailedMetrics());
});

app.post('/api/autonomous/revenue/generate-deals', adminTokenMiddleware, (req, res) => {
  autoRevenue.generateAffiliateDeals();
  autoRevenue.createMarketplaceListings();
  autoRevenue.negotiateB2BPartnerships();
  res.json({ success: true, message: 'Revenue generation cycle triggered' });
});

app.get('/api/autonomous/platform/status', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    state: 'FULLY_AUTONOMOUS_LIVE',
    autonomousEngines: {
      innovation: autonomousInnovation.getStatus(),
      revenue: autoRevenue.getRevenueStatus(),
    },
    combinedMetrics: {
      totalInnovationsGenerated: autonomousInnovation.metrics.totalInnovationsGenerated,
      totalFeaturesDeployed: autonomousInnovation.metrics.totalFeaturesDeployed,
      projectedAnnualRevenue: autoRevenue.metrics.projectedAnnualRevenue,
      activeDeals: autoRevenue.metrics.activeDeals,
    },
  });
});

// ==================== WEBHOOK DEPLOY (Hetzner fallback) ====================
// Called by GitHub Actions when SSH deploy fails (HETZNER_WEBHOOK_URL points here)
app.post('/deploy', (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || '';
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.HETZNER_WEBHOOK_SECRET || '';
  if (!expectedSecret || incomingSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden', detail: 'Invalid webhook secret' });
  }
  const source = (req.body && req.body.source) || 'unknown';
  const action = (req.body && req.body.action) || 'deploy';
  console.log(`🚀 [WEBHOOK] Deploy triggered — source: ${source}, action: ${action}`);

  // Pull latest code and restart via child_process (non-blocking)
  const { exec } = require('child_process');
  const deployDir = process.env.DEPLOY_PATH || __dirname.replace('/backend', '');
  exec(
    `cd "${deployDir}" && git pull origin main --ff-only && npm install --no-audit --no-fund 2>&1`,
    { timeout: 120000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error('❌ [WEBHOOK] Deploy pull failed:', err.message);
        // Don't restart - return error
        return;
      }
      console.log('✅ [WEBHOOK] Code updated:\n', stdout.slice(-500));
      // Graceful restart: let PM2 / systemd handle it, or self-exit and let process manager restart
      setTimeout(() => process.exit(0), 500);
    }
  );

  res.json({ ok: true, message: 'Deploy initiated', source, action, timestamp: new Date().toISOString() });
});

// ==================== SERVIRE FRONTEND ====================
const clientBuildPath = path.join(__dirname, '../client/build');
const clientIndexPath = path.join(clientBuildPath, 'index.html');
const fs = require('fs');

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}

app.get('*', (req, res) => {
  if (fs.existsSync(clientIndexPath)) {
    return res.sendFile(clientIndexPath);
  }
  // Client not built yet — return API status instead of crashing
  res.json({
    service: 'unicorn-autonomous',
    status: 'running',
    note: 'UI build not found. Run: cd client && npm install && npm run build',
    api: '/api/health'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Unicorn autonom rulând pe portul ${PORT}`);
  console.log(`✨ Autonomous Innovation Engine: ACTIVE`);
  console.log(`💰 Auto Revenue Generation: ACTIVE`);
});
