# 🚀 3 REVOLUTIONARY INNOVATIONS FOR UNICORN AI PLATFORM

This guide shows you how to add 3 cutting-edge features to your Unicorn project:
1. **Quantum-Resistant Digital Identity** - Post-quantum cryptography
2. **Autonomous AI Negotiator** - AI-powered automated negotiations
3. **Universal Carbon Credit Exchange** - Decentralized carbon marketplace

---

## 📋 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- UNICORN_FINAL project structure already generated

### Step 1: Install & Run

```bash
# Navigate to project root
cd /path/to/your/project

# Run the innovations installer
node add_innovations.js
```

### Step 2: Verify Installation

```bash
# Check if modules were created
ls -la UNICORN_FINAL/src/modules/ | grep -E "quantum|negotiator|carbon"
```

Expected output:
```
ai-negotiator.js
carbon-exchange.js
quantum-resistant-digital-identity.js
```

### Step 3: Update Backend Routes

The installer creates the modules. Now add API routes to your backend:

```bash
# Edit UNICORN_FINAL/src/index.js and add:
nano UNICORN_FINAL/src/index.js
```

Paste before `app.listen()`:

```javascript
// ==================== INOVAȚII ====================
const qrIdentity = require('./modules/quantum-resistant-digital-identity');
const aiNegotiator = require('./modules/ai-negotiator');
const carbonExchange = require('./modules/carbon-exchange');

// Quantum Identity Routes
app.post('/api/identity/create', (req, res) => {
  const { userId, metadata } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const identity = qrIdentity.generateIdentity(userId, metadata);
  res.json(identity);
});

app.post('/api/identity/sign', (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });
  try {
    const signature = qrIdentity.sign(userId, message);
    res.json(signature);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/identity/verify', (req, res) => {
  const { publicKey, message, signature } = req.body;
  if (!publicKey || !message || !signature) return res.status(400).json({ error: 'Missing fields' });
  const result = qrIdentity.verify(publicKey, message, signature);
  res.json(result);
});

app.get('/api/identity/all', (req, res) => {
  const identities = qrIdentity.getAllIdentities();
  res.json(identities);
});

// AI Negotiator Routes
app.post('/api/negotiate/analyze', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const analysis = await aiNegotiator.analyzeMessage(text);
  res.json(analysis);
});

app.post('/api/negotiate/start', (req, res) => {
  const { counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime, deadline } = req.body;
  if (!counterparty || !topic || !initialOffer) return res.status(400).json({ error: 'Missing required fields' });
  const negotiation = aiNegotiator.startNegotiation({ counterparty, topic, initialOffer, targetPrice, maxDiscount, deliveryTime, deadline });
  res.json(negotiation);
});

app.post('/api/negotiate/message/:id', async (req, res) => {
  const { id } = req.params;
  const { message, userType } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await aiNegotiator.processMessage(parseInt(id), message, userType);
    res.json(result);
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
  const stats = aiNegotiator.getStats();
  res.json(stats);
});

// Carbon Exchange Routes
app.post('/api/carbon/issue', (req, res) => {
  const { owner, amount, type, projectId, vintage } = req.body;
  if (!owner || !amount) return res.status(400).json({ error: 'owner and amount required' });
  const credit = carbonExchange.issueCredits(owner, amount, type, projectId, vintage);
  res.json(credit);
});

app.post('/api/carbon/trade', async (req, res) => {
  const { buyer, seller, creditId, amount } = req.body;
  if (!buyer || !seller || !creditId || !amount) return res.status(400).json({ error: 'Missing fields' });
  try {
    const transaction = await carbonExchange.executeTrade(buyer, seller, creditId, amount);
    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/sell', (req, res) => {
  const { seller, creditId, amount, price } = req.body;
  if (!seller || !creditId || !amount) return res.status(400).json({ error: 'Missing fields' });
  try {
    const order = carbonExchange.createSellOrder(seller, creditId, amount, price);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/carbon/order/buy', (req, res) => {
  const { buyer, creditType, amount, maxPrice } = req.body;
  if (!buyer || !creditType || !amount) return res.status(400).json({ error: 'Missing fields' });
  const order = carbonExchange.createBuyOrder(buyer, creditType, amount, maxPrice);
  res.json(order);
});

app.post('/api/carbon/match', async (req, res) => {
  const result = await carbonExchange.matchOrders();
  res.json(result);
});

app.get('/api/carbon/portfolio/:owner', (req, res) => {
  const portfolio = carbonExchange.getPortfolio(req.params.owner);
  res.json(portfolio);
});

app.get('/api/carbon/stats', (req, res) => {
  const stats = carbonExchange.getMarketStats();
  res.json(stats);
});

app.get('/api/carbon/transactions/:user', (req, res) => {
  const { user } = req.params;
  const { role } = req.query;
  const history = carbonExchange.getTransactionHistory(user, role);
  res.json(history);
});

app.post('/api/carbon/price', (req, res) => {
  const { type, price } = req.body;
  if (!type || !price) return res.status(400).json({ error: 'type and price required' });
  const result = carbonExchange.updateMarketPrice(type, price);
  res.json(result);
});
```

### Step 4: Restart & Test

```bash
# Restart your backend
npm start

# Test with curl
curl -X POST http://localhost:3000/api/identity/create \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","metadata":{"role":"admin"}}'
```

---

## 🔐 INNOVATION 1: Quantum-Resistant Digital Identity

**What it does:** Creates digital identities that are resistant to quantum computing attacks.

### Features
- Post-quantum cryptography (CRYSTALS-Dilithium simulation)
- Generates quantum-safe public/private key pairs
- Sign and verify messages securely
- Manage user identities with metadata

### API Endpoints

#### Create Identity
```bash
POST /api/identity/create
{
  "userId": "user123",
  "metadata": {
    "role": "admin",
    "organization": "Acme Corp"
  }
}

Response:
{
  "userId": "user123",
  "publicKey": "a3f8e2c9...",
  "createdAt": "2026-03-25T10:30:00Z"
}
```

#### Sign Message
```bash
POST /api/identity/sign
{
  "userId": "user123",
  "message": "Please authorize this transaction"
}

Response:
{
  "signature": "5f2a8e3b...",
  "algorithm": "CRYSTALS-Dilithium (simulated)",
  "timestamp": "2026-03-25T10:31:00Z"
}
```

#### Verify Signature
```bash
POST /api/identity/verify
{
  "publicKey": "a3f8e2c9...",
  "message": "Please authorize this transaction",
  "signature": "5f2a8e3b..."
}

Response:
{
  "valid": true,
  "message": "Signature valid"
}
```

#### Get All Identities (Admin)
```bash
GET /api/identity/all

Response:
[
  {
    "userId": "user123",
    "publicKey": "a3f8e2c9...",
    "createdAt": "2026-03-25T10:30:00Z",
    "metadata": {...}
  }
]
```

### Use Cases
- Secure blockchain transactions
- Digital signatures for contracts
- Authentication resistant to quantum attacks
- Non-repudiation in critical systems

---

## 🤖 INNOVATION 2: Autonomous AI Negotiator

**What it does:** Conducts automated negotiations on your behalf using sentiment analysis and intelligent response generation.

### Features
- Analyzes sentiment and intent of messages
- Multiple negotiation strategies (collaborative, competitive, compromising, etc.)
- Tracks negotiation history and rounds
- Automatic deal detection
- Real-time statistics

### API Endpoints

#### Analyze Message
```bash
POST /api/negotiate/analyze
{
  "text": "That price is too high, can you do better?"
}

Response:
{
  "sentiment": {
    "score": -2,
    "positive": false,
    "negative": true
  },
  "intent": "price",
  "language": "en"
}
```

#### Start Negotiation
```bash
POST /api/negotiate/start
{
  "counterparty": "BigCorp Inc",
  "topic": "Software License Deal",
  "initialOffer": 50000,
  "targetPrice": 45000,
  "maxDiscount": 15,
  "deliveryTime": "2-3 weeks",
  "deadline": "2026-04-25T00:00:00Z"
}

Response:
{
  "id": 1,
  "startedAt": "2026-03-25T10:32:00Z"
}
```

#### Process Message (Send & Receive Responses)
```bash
POST /api/negotiate/message/1
{
  "message": "That price works if you can deliver within 1 week",
  "userType": "counterparty"
}

Response:
{
  "response": "Let's find a win-win solution that benefits both parties. Regarding the price, we propose 50000 USD.",
  "status": "active",
  "finalAgreement": null,
  "round": 1
}
```

#### Get Negotiation Details
```bash
GET /api/negotiate/1

Response:
{
  "id": 1,
  "counterparty": "BigCorp Inc",
  "topic": "Software License Deal",
  "currentOffer": 50000,
  "targetPrice": 45000,
  "round": 5,
  "status": "active",
  "history": [
    {
      "round": 1,
      "userType": "counterparty",
      "message": "That price is too high...",
      "timestamp": "2026-03-25T10:33:00Z"
    }
  ],
  "startedAt": "2026-03-25T10:32:00Z"
}
```

#### Get Statistics
```bash
GET /api/negotiate/stats

Response:
{
  "total": 5,
  "active": 2,
  "completed": 2,
  "expired": 1,
  "averageRounds": 4.2
}
```

### Negotiation Strategies

1. **Collaborative** - Default, finds win-win solutions
2. **Accommodating** - Used when counterparty is unhappy
3. **Competitive** - Used when advantage is strong
4. **Compromising** - Used after multiple rounds
5. **Avoiding** - Used when more time is needed

### Use Cases
- B2B deal negotiations
- Contract price discussions
- Service terms discussions
- Supplier negotiations
- Sales follow-ups

---

## 🌍 INNOVATION 3: Universal Carbon Credit Exchange

**What it does:** A decentralized marketplace for buying, selling, and trading carbon credits.

### Features
- Issue and trade carbon credits (VER, CER, EUA, CCB)
- Real-time market pricing
- Order matching (buy/sell orders)
- Portfolio management
- Transaction history tracking
- Market statistics

### API Endpoints

#### Issue Carbon Credits
```bash
POST /api/carbon/issue
{
  "owner": "company123",
  "amount": 1000,
  "type": "VER",
  "projectId": "reforestation-amazon",
  "vintage": 2025
}

Response:
{
  "id": "abc123xyz...",
  "owner": "company123",
  "amount": 1000,
  "type": "VER",
  "price": 5.50,
  "projectId": "reforestation-amazon",
  "vintage": 2025,
  "issuedAt": "2026-03-25T10:35:00Z",
  "status": "active"
}
```

#### Execute Trade
```bash
POST /api/carbon/trade
{
  "buyer": "buyer_corp",
  "seller": "seller_corp",
  "creditId": "abc123xyz...",
  "amount": 500
}

Response:
{
  "id": "txn456...",
  "buyer": "buyer_corp",
  "seller": "seller_corp",
  "creditId": "abc123xyz...",
  "amount": 500,
  "price": 5.50,
  "totalPrice": 2750,
  "timestamp": "2026-03-25T10:36:00Z"
}
```

#### Create Sell Order
```bash
POST /api/carbon/order/sell
{
  "seller": "seller_corp",
  "creditId": "abc123xyz...",
  "amount": 1000,
  "price": 6.00
}

Response:
{
  "id": "sell_order_123",
  "seller": "seller_corp",
  "creditId": "abc123xyz...",
  "amount": 1000,
  "price": 6.00,
  "type": "sell",
  "status": "open"
}
```

#### Create Buy Order
```bash
POST /api/carbon/order/buy
{
  "buyer": "buyer_corp",
  "creditType": "VER",
  "amount": 500,
  "maxPrice": 6.50
}

Response:
{
  "id": "buy_order_456",
  "buyer": "buyer_corp",
  "creditType": "VER",
  "amount": 500,
  "maxPrice": 6.50,
  "type": "buy",
  "status": "open"
}
```

#### Match Orders (Market Making)
```bash
POST /api/carbon/match

Response:
{
  "matched": 3
}
```

#### Get Portfolio
```bash
GET /api/carbon/portfolio/company123

Response:
[
  {
    "id": "abc123xyz...",
    "owner": "company123",
    "amount": 500,
    "type": "VER",
    "price": 5.50,
    "status": "active"
  },
  {
    "id": "def456uvw...",
    "owner": "company123",
    "amount": 250,
    "type": "CER",
    "price": 8.25,
    "status": "active"
  }
]
```

#### Get Market Statistics
```bash
GET /api/carbon/stats

Response:
{
  "totalVolume": 125000,
  "avgPrice": 6.25,
  "transactionsCount": 150,
  "availableCredits": {
    "VER": 50000,
    "CER": 30000,
    "EUA": 20000,
    "CCB": 15000
  },
  "marketPrices": {
    "VER": 5.50,
    "CER": 8.25,
    "EUA": 85.00,
    "CCB": 12.00
  },
  "activeOrders": 45
}
```

#### Update Market Price
```bash
POST /api/carbon/price
{
  "type": "VER",
  "price": 6.75
}

Response:
{
  "updated": true,
  "type": "VER",
  "price": 6.75
}
```

#### Get Transaction History
```bash
GET /api/carbon/transactions/company123?role=seller

Response:
[
  {
    "id": "txn789...",
    "buyer": "buyer_corp",
    "seller": "company123",
    "amount": 500,
    "price": 5.50,
    "totalPrice": 2750,
    "timestamp": "2026-03-25T09:00:00Z"
  }
]
```

### Carbon Credit Types

| Type | Name | Typical Price | Use Case |
|------|------|---------------|----------|
| VER | Verified Emission Reduction | $5.50 | Voluntary carbon offsetting |
| CER | Certified Emission Reduction | $8.25 | Kyoto Protocol projects |
| EUA | EU Allowance | $85.00 | EU Emissions Trading System |
| CCB | Climate, Community & Biodiversity | $12.00 | Projects with social benefits |

### Use Cases
- Businesses offsetting carbon emissions
- Carbon credit trading
- Environmental compliance
- Sustainable business practices
- Investment in climate projects

---

## 🔧 Advanced Configuration

### Custom Negotiation Strategies

Edit `ai-negotiator.js` to add custom strategies:

```javascript
this.strategies = {
  custom_strategy: 'Your custom response template here...',
  // ... more strategies
};
```

### Oracle Integration for Carbon Prices

Connect real market data:

```javascript
// In your backend
const updatePricesFromOracle = async () => {
  const prices = await fetchRealPrices(); // Your oracle
  for (const [type, price] of Object.entries(prices)) {
    carbonExchange.updateMarketPrice(type, price);
  }
};

setInterval(updatePricesFromOracle, 60000); // Every minute
```

### Blockchain Integration

Store identities or carbon credits on-chain:

```javascript
// Sign blockchain transaction
const identity = qrIdentity.getIdentity(userId);
const signature = qrIdentity.sign(userId, transactionData);
// Submit to blockchain with signature
```

---

## 📊 Example: Full Negotiation Workflow

```javascript
// 1. Start negotiation
const nego = await fetch('/api/negotiate/start', {
  method: 'POST',
  body: JSON.stringify({
    counterparty: 'Partner LLC',
    topic: 'Project Development',
    initialOffer: 100000,
    targetPrice: 85000,
    deadline: '2026-04-25'
  })
});
const { id } = await nego.json();

// 2. Send first message
const response1 = await fetch(`/api/negotiate/message/${id}`, {
  method: 'POST',
  body: JSON.stringify({
    message: "We can start at $100k but prefer $95k for this project"
  })
});
const r1 = await response1.json();
console.log('AI Response:', r1.response);

// 3. Analyze counterparty sentiment
const analysis = await fetch('/api/negotiate/analyze', {
  method: 'POST',
  body: JSON.stringify({
    text: "That's reasonable, but our budget is only $80k maximum"
  })
});
const sentiment = await analysis.json();
console.log('Sentiment:', sentiment.sentiment.score);

// 4. Continue negotiation until agreement
// ... continue process
```

---

## 🐛 Troubleshooting

### Module Not Found
```
Error: Cannot find module './modules/quantum-resistant-digital-identity'
```
**Solution:** Run `node add_innovations.js` again to ensure modules are created.

### API Endpoint Not Working
```
404 Not Found on POST /api/identity/create
```
**Solution:** 
1. Verify routes are added to backend/index.js
2. Check `require()` statements at top
3. Restart backend server

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Kill previous process or use different port:
```bash
lsof -ti :3000 | xargs kill -9
# or
PORT=3001 npm start
```

---

## 📚 Related Documentation

- [SETUP-HETZNER-GUIDE.md](SETUP-HETZNER-GUIDE.md) - Server deployment guide
- [GITHUB-VERCEL-HETZNER-CONNECTOR.md](GITHUB-VERCEL-HETZNER-CONNECTOR.md) - Deployment automation
- [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md) - Complete setup guide

---

## 🚀 Next Steps

1. **Test Locally** - Verify all endpoints work with curl or Postman
2. **Deploy to Hetzner** - Use `setup_hetzner.js` for server setup
3. **Add Database** - Store identities, negotiations, and carbon credits
4. **Build Frontend** - Create UI for each feature
5. **Connect Blockchain** - For decentralized verification
6. **Add Authentication** - Protect sensitive endpoints

---

## 💡 Tips

- **Performance**: Store negotiations in a database instead of memory
- **Security**: Hash private keys before storing
- **Scalability**: Use message queues for high-volume negotiations
- **Integration**: Connect with real carbon offset APIs
- **Monitoring**: Log all negotiations and trades for compliance

---

Made with ❤️ for **Unicorn AI Platform**

For questions or contributions, visit the repository!
