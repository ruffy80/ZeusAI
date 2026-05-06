// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T20:11:21.009Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Sovereign Innovations Loader
// Loads and registers all paradigm-shifting sovereign modules for mesh and API exposure

const rateLimit = require('express-rate-limit');

module.exports = function registerSovereignInnovations(app, meshOrchestrator) {
  const aiSovereignIdentityMesh = require('./aiSovereignIdentityMesh');
  const quantumResilientPrivacyLayer = require('./quantumResilientPrivacyLayer');
  const universalAutonomousNegotiationProtocol = require('./universalAutonomousNegotiationProtocol');
  const globalValueLedger = require('./globalValueLedger');
  const temporalDataSovereignty = require('./temporalDataSovereignty');
  const interplanetaryCommerceMesh = require('./interplanetaryCommerceMesh');
  const selfEvolvingLawEngine = require('./selfEvolvingLawEngine');

  // Register with mesh orchestrator if available
  if (meshOrchestrator && typeof meshOrchestrator.registerModule === 'function') {
    meshOrchestrator.registerModule(aiSovereignIdentityMesh);
    meshOrchestrator.registerModule(quantumResilientPrivacyLayer);
    meshOrchestrator.registerModule(universalAutonomousNegotiationProtocol);
    meshOrchestrator.registerModule(globalValueLedger);
    meshOrchestrator.registerModule(temporalDataSovereignty);
    meshOrchestrator.registerModule(interplanetaryCommerceMesh);
    meshOrchestrator.registerModule(selfEvolvingLawEngine);
  }

  // High rate limit for sovereign endpoints (10,000/min)
  const sovereignLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10000,
    standardHeaders: true,
    legacyHeaders: false
  });

  // Expose status endpoints for each module with high rate limit
  app.get('/api/sovereign-identity/status', sovereignLimiter, (req, res) => res.json(aiSovereignIdentityMesh.getStatus()));
  app.get('/api/quantum-privacy/status', sovereignLimiter, (req, res) => res.json(quantumResilientPrivacyLayer.getStatus()));
  app.get('/api/autonomous-negotiation/status', sovereignLimiter, (req, res) => res.json(universalAutonomousNegotiationProtocol.getStatus()));
  app.get('/api/global-value-ledger/status', sovereignLimiter, (req, res) => res.json(globalValueLedger.getStatus()));
  app.get('/api/temporal-sovereignty/status', sovereignLimiter, (req, res) => res.json(temporalDataSovereignty.getStatus()));
  app.get('/api/interplanetary-commerce/status', sovereignLimiter, (req, res) => res.json(interplanetaryCommerceMesh.getStatus()));
  app.get('/api/self-evolving-law/status', sovereignLimiter, (req, res) => res.json(selfEvolvingLawEngine.getStatus()));

  // Optionally: expose a summary endpoint
  app.get('/api/sovereign-innovations/status', sovereignLimiter, (req, res) => {
    res.json({
      aiSovereignIdentityMesh: aiSovereignIdentityMesh.getStatus(),
      quantumResilientPrivacyLayer: quantumResilientPrivacyLayer.getStatus(),
      universalAutonomousNegotiationProtocol: universalAutonomousNegotiationProtocol.getStatus(),
      globalValueLedger: globalValueLedger.getStatus(),
      temporalDataSovereignty: temporalDataSovereignty.getStatus(),
      interplanetaryCommerceMesh: interplanetaryCommerceMesh.getStatus(),
      selfEvolvingLawEngine: selfEvolvingLawEngine.getStatus(),
      ts: new Date().toISOString()
    });
  });

  const sovereignPrefixes = [
    '/api/sovereign-identity',
    '/api/quantum-privacy',
    '/api/autonomous-negotiation',
    '/api/global-value-ledger',
    '/api/temporal-sovereignty',
    '/api/interplanetary-commerce',
    '/api/self-evolving-law',
    '/api/sovereign-innovations',
  ];

  // Fallback only for sovereign routes; never intercept the rest of /api/*.
  app.use((req, res, next) => {
    if (sovereignPrefixes.some((prefix) => req.path.startsWith(prefix)) && res.headersSent === false) {
      return res.status(404).json({ error: 'Not found', path: req.path });
    }
    next();
  });
};
