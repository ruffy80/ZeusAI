// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Universal AI Training Marketplace (UAITM) Module
// Permite listarea și cumpărarea de modele AI fine-tuned.
// Modelele sunt stocate în memorie.

const crypto = require('crypto');

const models = new Map();
const purchases = new Map();

// Seed with some example models
const SEED_MODELS = [
  {
    name: 'Zeus-Finance-7B',
    price: 299,
    description: 'Fine-tuned LLM for financial analysis and forecasting. Trained on 50k finance documents.',
    category: 'Finance',
    baseModel: 'Llama-3-7B',
    accuracy: 0.94,
    parameters: '7B',
    seller: 'unicorn-system',
    tags: ['finance', 'forecasting', 'analysis'],
  },
  {
    name: 'Zeus-Legal-13B',
    price: 499,
    description: 'Legal document analysis and contract generation. Supports 12 languages.',
    category: 'Legal',
    baseModel: 'Mistral-13B',
    accuracy: 0.91,
    parameters: '13B',
    seller: 'unicorn-system',
    tags: ['legal', 'contracts', 'multilingual'],
  },
  {
    name: 'Zeus-MedAssist-3B',
    price: 199,
    description: 'Medical triage assistant trained on clinical notes and medical literature.',
    category: 'Healthcare',
    baseModel: 'Phi-3-Mini',
    accuracy: 0.89,
    parameters: '3B',
    seller: 'unicorn-system',
    tags: ['healthcare', 'medical', 'triage'],
  },
];

// Initialize seed models
SEED_MODELS.forEach(m => {
  const id = 'MODEL-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  models.set(id, {
    id,
    ...m,
    status: 'available',
    downloads: Math.floor(Math.random() * 200),
    rating: parseFloat((4.0 + Math.random()).toFixed(1)),
    listedAt: new Date().toISOString(),
  });
});

class UniversalAITrainingMarketplace {
  listModel({ seller, name, price, description, category, baseModel, parameters, accuracy, tags = [] }) {
    if (!seller || !name || !price || !description) {
      throw new Error('seller, name, price, and description are required');
    }
    if (typeof price !== 'number' || price <= 0) throw new Error('price must be a positive number');

    // Check for duplicate names per seller
    for (const m of models.values()) {
      if (m.seller === seller && m.name === name) {
        throw new Error(`Model "${name}" already listed by this seller`);
      }
    }

    const id = 'MODEL-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const model = {
      id,
      seller,
      name,
      price: parseFloat(price.toFixed(2)),
      description,
      category: category || 'General',
      baseModel: baseModel || 'Unknown',
      parameters: parameters || 'Unknown',
      accuracy: accuracy ? parseFloat(accuracy.toFixed(4)) : null,
      tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
      status: 'available',
      downloads: 0,
      rating: null,
      listedAt: new Date().toISOString(),
    };

    models.set(id, model);
    return model;
  }

  getModels({ category, maxPrice, search, seller } = {}) {
    let results = Array.from(models.values()).filter(m => m.status === 'available');

    if (category) results = results.filter(m => m.category.toLowerCase() === category.toLowerCase());
    if (maxPrice) results = results.filter(m => m.price <= maxPrice);
    if (seller) results = results.filter(m => m.seller === seller);
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  }

  buyModel({ buyerId, modelId, paymentMethod = 'credits' }) {
    if (!buyerId || !modelId) throw new Error('buyerId and modelId are required');

    const model = models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);
    if (model.status !== 'available') throw new Error(`Model ${modelId} is not available`);

    // Check if already purchased
    for (const p of purchases.values()) {
      if (p.buyerId === buyerId && p.modelId === modelId) {
        return { alreadyPurchased: true, purchase: p };
      }
    }

    const purchaseId = 'PUR-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const downloadToken = crypto.randomBytes(32).toString('hex');

    const purchase = {
      id: purchaseId,
      buyerId,
      modelId,
      modelName: model.name,
      price: model.price,
      paymentMethod,
      status: 'completed',
      downloadLink: `https://marketplace.unicorn.ai/download/${modelId}?token=${downloadToken}`,
      downloadToken,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days
      purchasedAt: new Date().toISOString(),
    };

    purchases.set(purchaseId, purchase);

    // Update model download count
    model.downloads = (model.downloads || 0) + 1;
    models.set(modelId, model);

    return { alreadyPurchased: false, purchase };
  }

  getModel(id) {
    const model = models.get(id);
    if (!model) throw new Error(`Model ${id} not found`);
    return model;
  }

  getPurchases(buyerId) {
    return Array.from(purchases.values()).filter(p => p.buyerId === buyerId);
  }

  getStats() {
    const allModels = Array.from(models.values());
    return {
      totalModels: allModels.length,
      availableModels: allModels.filter(m => m.status === 'available').length,
      totalPurchases: purchases.size,
      totalRevenue: Array.from(purchases.values()).reduce((s, p) => s + p.price, 0),
      categories: [...new Set(allModels.map(m => m.category))],
    };
  }
}

module.exports = new UniversalAITrainingMarketplace();
