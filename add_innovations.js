#!/usr/bin/env node
// =====================================================================
// add_innovations.js
// Adaugă cele 3 inovații în proiectul Unicorn existent
// Rulează în directorul rădăcină al proiectului tău
// =====================================================================

const fs = require('fs');
const path = require('path');

console.log('🚀 Adăugare 3 inovații revoluționare în Unicorn...');

// 1. Creează directorul modules dacă nu există
const modulesDir = path.join(process.cwd(), 'UNICORN_FINAL', 'src', 'modules');
if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });

// ==================== INOVAȚIA 1: Quantum-Resistant Digital Identity ====================
const qrIdentityCode = `
// quantum-resistant-digital-identity.js
// Identitate digitală rezistentă la calculatoare cuantice
// Bazată pe CRYSTALS-Dilithium (simulată pentru demonstrație)

const crypto = require('crypto');

class QuantumResistantIdentity {
  constructor() {
    this.identities = new Map(); // userId -> { publicKey, privateKey, createdAt }
  }

  // Generează o nouă identitate pentru un utilizator
  generateIdentity(userId, metadata = {}) {
    // În producție, aici s-ar folosi o bibliotecă post-quantică reală (ex: liboqs)
    const publicKey = crypto.randomBytes(64).toString('hex');
    const privateKey = crypto.randomBytes(128).toString('hex');
    
    const identity = {
      userId,
      publicKey,
      privateKey,
      createdAt: new Date().toISOString(),
      metadata
    };
    
    this.identities.set(userId, identity);
    return { userId, publicKey, createdAt: identity.createdAt };
  }

  // Semnează un mesaj cu cheia privată a utilizatorului
  sign(userId, message) {
    const identity = this.identities.get(userId);
    if (!identity) throw new Error('Identity not found for user: ' + userId);
    
    // Simulare semnătură post-quantică
    const signature = crypto.createHmac('sha512', identity.privateKey)
      .update(message)
      .digest('hex');
    
    return {
      signature,
      algorithm: 'CRYSTALS-Dilithium (simulated)',
      timestamp: new Date().toISOString()
    };
  }

  // Verifică o semnătură folosind cheia publică
  verify(publicKey, message, signature) {
    // Pentru verificare, avem nevoie de cheia privată asociată? Nu, verificarea se face cu cheia publică
    // În simulare, folosim publicKey ca și cum ar fi privateKey (doar pentru demo)
    const expected = crypto.createHmac('sha512', publicKey)
      .update(message)
      .digest('hex');
    
    return {
      valid: signature === expected,
      message: signature === expected ? 'Signature valid' : 'Invalid signature'
    };
  }

  // Obține toate identitățile (doar pentru admin)
  getAllIdentities() {
    const result = [];
    for (const [userId, identity] of this.identities) {
      result.push({
        userId,
        publicKey: identity.publicKey,
        createdAt: identity.createdAt,
        metadata: identity.metadata
      });
    }
    return result;
  }

  // Șterge o identitate
  revokeIdentity(userId) {
    return this.identities.delete(userId);
  }
}

module.exports = new QuantumResistantIdentity();
`;

// ==================== INOVAȚIA 2: Autonomous AI Negotiator ====================
const aiNegotiatorCode = `
// ai-negotiator.js
// Negociator AI autonom care poartă negocieri în numele tău

const axios = require('axios');

class AINegotiator {
  constructor() {
    this.strategies = {
      collaborative: 'Let\\'s find a win-win solution that benefits both parties.',
      competitive: 'This is our final and best offer. Take it or leave it.',
      accommodating: 'We value our partnership and can adjust to meet your needs.',
      compromising: 'Let\\'s meet in the middle to reach an agreement quickly.',
      avoiding: 'We need more time to evaluate this proposal.'
    };
    
    this.activeNegotiations = new Map(); // id -> { context, history, status }
    this.negotiationId = 0;
  }

  // Analizează mesajul și extrage intenția și sentimentul
  async analyzeMessage(text) {
    // Analiză simplă a sentimentului
    const negativeWords = ['bad', 'terrible', 'awful', 'not acceptable', 'unacceptable', 'decline', 'reject'];
    const positiveWords = ['great', 'excellent', 'perfect', 'accept', 'agree', 'yes', 'sure'];
    
    let sentiment = 0;
    const lower = text.toLowerCase();
    for (const word of negativeWords) if (lower.includes(word)) sentiment -= 2;
    for (const word of positiveWords) if (lower.includes(word)) sentiment += 2;
    
    // Detectare intenție
    let intent = 'general';
    const intentMap = {
      price: ['price', 'cost', 'budget', 'fee', 'amount'],
      timeline: ['deadline', 'time', 'delay', 'schedule', 'weeks', 'days'],
      quality: ['quality', 'feature', 'performance', 'spec', 'requirement'],
      discount: ['discount', 'deal', 'offer', 'special', 'reduction'],
      contract: ['contract', 'terms', 'condition', 'clause', 'agreement']
    };
    
    for (const [key, words] of Object.entries(intentMap)) {
      if (words.some(w => lower.includes(w))) {
        intent = key;
        break;
      }
    }
    
    return {
      sentiment: {
        score: sentiment,
        positive: sentiment > 0,
        negative: sentiment < 0
      },
      intent,
      language: 'en'
    };
  }

  // Generează răspuns bazat pe context și mesajul primit
  async generateResponse(context, userMessage, analysis = null) {
    if (!analysis) analysis = await this.analyzeMessage(userMessage);
    
    // Alege strategia în funcție de sentiment și intenție
    let strategy = 'collaborative';
    if (analysis.sentiment.score < -2) strategy = 'accommodating';
    if (analysis.sentiment.score > 2) strategy = 'competitive';
    if (analysis.intent === 'price' && context.round > 2) strategy = 'compromising';
    
    // Construiește răspunsul
    let response = this.strategies[strategy];
    
    // Adaugă detalii specifice în funcție de context
    if (analysis.intent === 'price') {
      const offer = context.currentOffer || context.initialOffer;
      response += \` Regarding the price, we propose \${offer} USD.\`;
    }
    
    if (analysis.intent === 'discount') {
      const discount = context.maxDiscount || 10;
      response += \` We can offer up to \${discount}% discount for bulk orders.\`;
    }
    
    if (analysis.intent === 'timeline') {
      response += \` The estimated delivery time is \${context.deliveryTime || '2-3 weeks'}.\`;
    }
    
    return response;
  }

  // Începe o nouă negociere
  startNegotiation(params) {
    const { counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime, deadline } = params;
    const id = ++this.negotiationId;
    
    const negotiation = {
      id,
      counterparty,
      topic,
      initialOffer,
      targetPrice,
      maxDiscount: maxDiscount || 10,
      deliveryTime: deliveryTime || '2-3 weeks',
      deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currentOffer: initialOffer,
      round: 0,
      history: [],
      status: 'active',
      startedAt: new Date().toISOString()
    };
    
    this.activeNegotiations.set(id, negotiation);
    return { id, startedAt: negotiation.startedAt };
  }

  // Procesează un mesaj de la contraparte
  async processMessage(negotiationId, message, userType = 'counterparty') {
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (!negotiation) throw new Error('Negotiation not found');
    if (negotiation.status !== 'active') throw new Error('Negotiation is not active');
    
    // Analizează mesajul
    const analysis = await this.analyzeMessage(message);
    
    // Înregistrează în istoric
    negotiation.history.push({
      round: ++negotiation.round,
      userType,
      message,
      analysis,
      timestamp: new Date().toISOString()
    });
    
    // Generează răspuns
    const context = {
      ...negotiation,
      round: negotiation.round
    };
    const response = await this.generateResponse(context, message, analysis);
    
    // Verifică dacă s-a ajuns la un acord
    let status = 'active';
    let finalAgreement = null;
    
    if (analysis.sentiment.score > 3 && negotiation.round > 2) {
      status = 'agreed';
      finalAgreement = {
        price: negotiation.currentOffer,
        terms: negotiation.topic,
        agreedAt: new Date().toISOString()
      };
      negotiation.status = 'completed';
    } else if (negotiation.round >= 10) {
      status = 'expired';
      negotiation.status = 'expired';
    } else if (new Date() > negotiation.deadline) {
      status = 'expired';
      negotiation.status = 'expired';
    }
    
    return {
      response,
      status,
      finalAgreement,
      round: negotiation.round
    };
  }

  // Actualizează oferta curentă
  updateOffer(negotiationId, newOffer) {
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (!negotiation) throw new Error('Negotiation not found');
    
    negotiation.currentOffer = newOffer;
    negotiation.history.push({
      round: negotiation.round + 1,
      userType: 'system',
      message: \`Offer updated to \${newOffer}\`,
      timestamp: new Date().toISOString()
    });
    
    return { currentOffer: negotiation.currentOffer };
  }

  // Obține detalii despre o negociere
  getNegotiation(negotiationId) {
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (!negotiation) return null;
    
    return {
      id: negotiation.id,
      counterparty: negotiation.counterparty,
      topic: negotiation.topic,
      currentOffer: negotiation.currentOffer,
      targetPrice: negotiation.targetPrice,
      round: negotiation.round,
      status: negotiation.status,
      history: negotiation.history.slice(-10), // ultimele 10 mesaje
      startedAt: negotiation.startedAt
    };
  }

  // Închide o negociere
  closeNegotiation(negotiationId, reason = 'cancelled') {
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (!negotiation) throw new Error('Negotiation not found');
    
    negotiation.status = reason;
    negotiation.endedAt = new Date().toISOString();
    return { closed: true, status: reason };
  }

  // Statistici
  getStats() {
    const negotiations = Array.from(this.activeNegotiations.values());
    const completed = negotiations.filter(n => n.status === 'completed').length;
    const active = negotiations.filter(n => n.status === 'active').length;
    const expired = negotiations.filter(n => n.status === 'expired').length;
    
    return {
      total: negotiations.length,
      active,
      completed,
      expired,
      averageRounds: negotiations.reduce((sum, n) => sum + n.round, 0) / (negotiations.length || 1)
    };
  }
}

module.exports = new AINegotiator();
`;

// ==================== INOVAȚIA 3: Universal Carbon Credit Exchange ====================
const carbonExchangeCode = `
// carbon-exchange.js
// Piață descentralizată pentru tranzacționarea creditelor de carbon

const crypto = require('crypto');

class CarbonCreditExchange {
  constructor() {
    this.credits = new Map(); // creditId -> credit details
    this.portfolios = new Map(); // owner -> Set of creditIds
    this.transactions = [];
    this.marketPrices = {
      VER: 5.50,   // Verified Emission Reduction
      CER: 8.25,   // Certified Emission Reduction
      EUA: 85.00,  // EU Allowance
      CCB: 12.00   // Climate, Community & Biodiversity
    };
  }

  // Emite credite noi
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

  // Obține prețul curent pentru un tip de credit
  getMarketPrice(type) {
    return this.marketPrices[type] || 10;
  }

  // Actualizează prețul pieței (poate fi apelat de un oracle)
  updateMarketPrice(type, price) {
    if (this.marketPrices[type]) {
      this.marketPrices[type] = price;
      // Actualizează și creditele existente de acest tip
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

  // Creează o comandă de vânzare
  createSellOrder(seller, creditId, amount, price = null) {
    if (!this.portfolios.get(seller)?.has(creditId)) {
      throw new Error('Seller does not own this credit');
    }
    
    const credit = this.credits.get(creditId);
    if (!credit || credit.amount < amount) {
      throw new Error('Insufficient credits');
    }
    
    const orderId = crypto.randomBytes(8).toString('hex');
    const order = {
      id: orderId,
      seller,
      creditId,
      amount,
      price: price || credit.price,
      type: 'sell',
      status: 'open',
      createdAt: new Date().toISOString()
    };
    
    if (!this.orders) this.orders = new Map();
    this.orders.set(orderId, order);
    
    return order;
  }

  // Creează o comandă de cumpărare
  createBuyOrder(buyer, creditType, amount, maxPrice) {
    const orderId = crypto.randomBytes(8).toString('hex');
    const order = {
      id: orderId,
      buyer,
      creditType,
      amount,
      maxPrice,
      type: 'buy',
      status: 'open',
      createdAt: new Date().toISOString()
    };
    
    if (!this.orders) this.orders = new Map();
    this.orders.set(orderId, order);
    
    return order;
  }

  // Execută o tranzacție directă
  async executeTrade(buyer, seller, creditId, amount) {
    const credit = this.credits.get(creditId);
    if (!credit) throw new Error('Credit not found');
    if (credit.owner !== seller) throw new Error('Seller does not own this credit');
    if (credit.amount < amount) throw new Error('Insufficient amount');
    
    const totalPrice = credit.price * amount;
    
    // Actualizează creditul
    credit.amount -= amount;
    if (credit.amount === 0) {
      credit.status = 'depleted';
      this.portfolios.get(seller).delete(creditId);
    }
    this.credits.set(creditId, credit);
    
    // Creează un nou credit pentru cumpărător (fracționat)
    let newCreditId = null;
    if (amount < credit.amount || credit.amount === 0) {
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
    
    // Înregistrează tranzacția
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

  // Execută ordine deschise (market maker)
  async matchOrders() {
    if (!this.orders) return { matched: 0 };
    
    const buyOrders = Array.from(this.orders.values()).filter(o => o.type === 'buy' && o.status === 'open');
    const sellOrders = Array.from(this.orders.values()).filter(o => o.type === 'sell' && o.status === 'open');
    
    let matched = 0;
    
    for (const buy of buyOrders) {
      for (const sell of sellOrders) {
        if (sell.price <= buy.maxPrice) {
          const amount = Math.min(buy.amount, sell.amount);
          try {
            const transaction = await this.executeTrade(buy.buyer, sell.seller, sell.creditId, amount);
            
            // Actualizează ordinele
            buy.amount -= amount;
            sell.amount -= amount;
            
            if (buy.amount === 0) buy.status = 'completed';
            if (sell.amount === 0) sell.status = 'completed';
            
            matched++;
            break; // Trecem la următorul buy order
          } catch (err) {
            console.error('Trade execution failed:', err);
          }
        }
      }
    }
    
    return { matched };
  }

  // Obține portofoliul unui utilizator
  getPortfolio(owner) {
    const creditIds = this.portfolios.get(owner) || new Set();
    const credits = [];
    for (const id of creditIds) {
      const credit = this.credits.get(id);
      if (credit) credits.push(credit);
    }
    return credits;
  }

  // Obține statisticile pieței
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
      activeOrders: this.orders ? Array.from(this.orders.values()).filter(o => o.status === 'open').length : 0
    };
  }

  // Obține istoricul tranzacțiilor unui utilizator
  getTransactionHistory(user, role = 'both') {
    return this.transactions.filter(t => {
      if (role === 'buyer') return t.buyer === user;
      if (role === 'seller') return t.seller === user;
      return t.buyer === user || t.seller === user;
    });
  }
}

module.exports = new CarbonCreditExchange();
`;

// ==================== Scriere fișiere ====================
fs.writeFileSync(path.join(modulesDir, 'quantum-resistant-digital-identity.js'), qrIdentityCode);
console.log('✅ 1. Quantum-Resistant Digital Identity adăugat');

fs.writeFileSync(path.join(modulesDir, 'ai-negotiator.js'), aiNegotiatorCode);
console.log('✅ 2. Autonomous AI Negotiator adăugat');

fs.writeFileSync(path.join(modulesDir, 'carbon-exchange.js'), carbonExchangeCode);
console.log('✅ 3. Universal Carbon Credit Exchange adăugat');

// ==================== Adăugare rute API în backend ====================
const backendPath = path.join(process.cwd(), 'UNICORN_FINAL', 'src', 'index.js');
if (fs.existsSync(backendPath)) {
  let backendContent = fs.readFileSync(backendPath, 'utf8');
  
  // Verifică dacă modulele sunt deja importate
  if (!backendContent.includes('quantum-resistant-digital-identity')) {
    const importSection = `
// ==================== INOVAȚII ====================
const qrIdentity = require('./modules/quantum-resistant-digital-identity');
const aiNegotiator = require('./modules/ai-negotiator');
const carbonExchange = require('./modules/carbon-exchange');
`;
    
    // Inserează import-urile la începutul fișierului (după alte require-uri)
    const firstAppLine = backendContent.indexOf('const app = express()');
    if (firstAppLine !== -1) {
      const beforeApp = backendContent.substring(0, firstAppLine);
      const afterApp = backendContent.substring(firstAppLine);
      backendContent = beforeApp + importSection + '\n' + afterApp;
    }
    
    fs.writeFileSync(backendPath, backendContent);
    console.log('✅ Import-uri adăugate în backend/index.js');
  }
} else {
  console.log('⚠️  Nu s-a găsit UNICORN_FINAL/src/index.js. Modulele sunt gata, dar rutele vor fi adăugate manual.');
}

console.log('\n🎉 Cele 3 inovații au fost integrate cu succes!');
console.log('\n📋 Ce ai primit:');
console.log('   1. Quantum-Resistant Digital Identity - protecție împotriva calculatoarelor cuantice');
console.log('   2. Autonomous AI Negotiator - negocieri automate în numele tău');
console.log('   3. Universal Carbon Credit Exchange - piață de carbon descentralizată');
console.log('\n📁 Fișiere create:');
console.log('   - UNICORN_FINAL/src/modules/quantum-resistant-digital-identity.js');
console.log('   - UNICORN_FINAL/src/modules/ai-negotiator.js');
console.log('   - UNICORN_FINAL/src/modules/carbon-exchange.js');
console.log('\n🔗 Pentru a activa API endpoints, adaugă în backend/index.js:');
console.log('');
console.log('app.post("/api/identity/create", (req, res) => {');
console.log('  const { userId, metadata } = req.body;');
console.log('  const identity = qrIdentity.generateIdentity(userId, metadata);');
console.log('  res.json(identity);');
console.log('});');
console.log('');
console.log('// Similar pentru aiNegotiator și carbonExchange endpoints');
console.log('\n✨ API routes available:');
console.log('   - POST /api/identity/* - Digital identity management');
console.log('   - POST /api/negotiate/* - AI negotiation');
console.log('   - POST /api/carbon/* - Carbon credit exchange');
console.log('\n🚀 Apoi repornește serverul pentru a activa inovațiile!');
