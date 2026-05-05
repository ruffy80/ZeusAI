// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T20:11:21.009Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Sovereign Innovations Loader
// Loads and registers all paradigm-shifting sovereign modules for mesh and API exposure

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

  // Expose status endpoints for each module
  app.get('/api/sovereign-identity/status', (req, res) => res.json(aiSovereignIdentityMesh.getStatus()));
  app.get('/api/quantum-privacy/status', (req, res) => res.json(quantumResilientPrivacyLayer.getStatus()));
  app.get('/api/autonomous-negotiation/status', (req, res) => res.json(universalAutonomousNegotiationProtocol.getStatus()));
  app.get('/api/global-value-ledger/status', (req, res) => res.json(globalValueLedger.getStatus()));
  app.get('/api/temporal-sovereignty/status', (req, res) => res.json(temporalDataSovereignty.getStatus()));
  app.get('/api/interplanetary-commerce/status', (req, res) => res.json(interplanetaryCommerceMesh.getStatus()));
  app.get('/api/self-evolving-law/status', (req, res) => res.json(selfEvolvingLawEngine.getStatus()));

  // Optionally: expose a summary endpoint
  app.get('/api/sovereign-innovations/status', (req, res) => {
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
};
