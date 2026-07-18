# MODULE-INVENTORY — ZeusAI / Unicorn (live audit)

**Generated:** 2026-07-18T03:55:21.215Z
**Branch task:** autonomous-unicorn-global-os

## Counts (accurate — not marketing)

| Metric | Value |
|---|---:|
| Backend module JS files | 405 |
| Site `src/modules` JS files | 7 |
| Backend top-level entries | 284 |
| Boot-required / started (heuristic) | 205 |
| Alias / shim | 28 |
| Marketplace-sweep only | 46 |
| Synthetic-signal present | 78 |

> **Honesty rule:** A module file existing on disk ≠ sellable product ≠ autonomous revenue. Only SKUs with fulfillment recipes enter the public commerce catalog. Autonomy loops that require owner keys (CJ, SMTP, social tokens) stay armed but idle without secrets.

## Status legend

- `boot-started` — required by backend and exposes start/init
- `boot-required` — required by backend (request-driven or passive)
- `marketplace-sweep` — loaded by serviceMarketplace directory walk
- `alias` — thin re-export of another module

## Top-level inventory

| Module | Kind | Files | Status | start/init | status API | Site touch | Notes |
|---|---|---:|---|---|---|---|---|
| `ab-testing.js` | file | 1 | boot-started | Y | Y | Y | — |
| `acquisition-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `adaptiveEnginePool.js` | file | 1 | boot-required | — | Y | — | — |
| `adi-core` | dir | 10 | boot-required | — | Y | Y | — |
| `admin-panel.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `ai_future_innovations` | dir | 10 | boot-started | Y | — | — | synthetic-signal |
| `ai-auto-dispatcher.js` | file | 1 | boot-required | — | Y | Y | — |
| `ai-cfo-agent.js` | file | 1 | boot-started | Y | Y | Y | synthetic-signal |
| `ai-cost-ledger.js` | file | 1 | boot-required | — | Y | — | — |
| `ai-crisis-anticipator.js` | file | 1 | marketplace-sweep | — | — | Y | synthetic-signal |
| `ai-crisis-forecast.js` | file | 1 | marketplace-sweep | — | — | Y | synthetic-signal |
| `ai-digital-ethics.js` | file | 1 | marketplace-sweep | — | — | Y | synthetic-signal |
| `ai-ethics.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `ai-marketplace.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `ai-orchestrator.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `ai-personalized-pricing-auto.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `ai-product-generator.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `ai-provider-health.js` | file | 1 | boot-required | — | Y | — | — |
| `ai-sales-closer-pro.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `ai-sales-closer.js` | file | 1 | boot-started | Y | Y | Y | synthetic-signal |
| `ai-sdr-agent.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `ai-self-healing.js` | file | 1 | alias | — | — | Y | alias |
| `ai-semantic-memory.js` | file | 1 | boot-required | — | Y | — | — |
| `ai-smart-cache.js` | file | 1 | boot-required | — | — | Y | — |
| `aiNegotiator.js` | file | 1 | boot-required | — | — | — | — |
| `aiProviders.js` | file | 1 | boot-required | — | Y | Y | synthetic-signal |
| `aiWorkforce.js` | file | 1 | boot-required | — | — | — | — |
| `analytics.js` | file | 1 | boot-started | Y | Y | Y | — |
| `api-docs.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `auth-guardian.js` | file | 1 | alias | — | — | — | alias |
| `auto-evolve.js` | file | 1 | boot-started | Y | Y | — | — |
| `auto-innovation-loop.js` | file | 1 | alias | — | — | — | alias |
| `auto-marketing.js` | file | 1 | boot-started | Y | Y | Y | — |
| `auto-optimize.js` | file | 1 | alias | — | — | — | alias |
| `auto-repair.js` | file | 1 | alias | — | — | — | alias |
| `auto-restart.js` | file | 1 | boot-started | Y | Y | — | — |
| `auto-trend-analyzer.js` | file | 1 | boot-started | Y | Y | — | — |
| `autoDeploy.js` | file | 1 | boot-started | Y | — | — | — |
| `autonomous-bd-engine.js` | file | 1 | boot-started | Y | Y | — | — |
| `autonomous-intelligence-core.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `autonomous-lead-hunter.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `autonomous-wealth-engine.js` | file | 1 | boot-started | Y | Y | — | — |
| `autonomousInnovation.js` | file | 1 | alias | — | — | — | alias |
| `autonomousLegalEntity.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `autonomousMAdvisor.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `autonomousMoneyMachine.js` | file | 1 | boot-required | — | Y | — | — |
| `autonomy-spine.js` | file | 1 | boot-started | Y | Y | — | — |
| `autonomyChain.js` | file | 1 | boot-required | — | — | Y | — |
| `autoRevenue.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `autoViralGrowth.js` | file | 1 | boot-started | Y | — | Y | synthetic-signal |
| `aviationModule.js` | file | 1 | boot-required | — | — | — | — |
| `aws-auto-healer.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `azure-cost-optimizer.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `billing-engine.js` | file | 1 | boot-required | — | Y | Y | — |
| `billion-scale-activation-orchestrator.js` | file | 1 | alias | — | — | Y | alias |
| `billion-scale-revenue-engine.js` | file | 1 | alias | — | — | — | alias |
| `blockchain-audit.js` | file | 1 | marketplace-sweep | — | — | Y | synthetic-signal |
| `btcInvoiceLedger.js` | file | 1 | boot-required | — | Y | — | — |
| `btcPaymentVerifier.js` | file | 1 | boot-started | Y | Y | — | — |
| `businessBlueprint.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `canary-controller.js` | file | 1 | boot-required | — | Y | Y | — |
| `capabilityTokens.js` | file | 1 | boot-required | — | — | Y | synthetic-signal |
| `capital-protection.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `carbonExchange.js` | file | 1 | boot-required | — | — | — | — |
| `central-orchestrator.js` | file | 1 | boot-started | Y | Y | — | — |
| `checkout-recovery-agent.js` | file | 1 | boot-required | — | Y | Y | — |
| `circuit-breaker.js` | file | 1 | boot-required | — | Y | Y | — |
| `cloud-providers.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `code-optimizer.js` | file | 1 | alias | — | — | — | alias |
| `competitor-spy-agent.js` | file | 1 | boot-started | Y | Y | Y | synthetic-signal |
| `complianceEngine.js` | file | 1 | boot-required | — | — | — | — |
| `configurationManager.js` | file | 1 | boot-required | — | Y | — | — |
| `content-ai.js` | file | 1 | boot-started | Y | Y | Y | — |
| `context-persistence.js` | file | 1 | boot-required | — | Y | — | — |
| `control-plane-agent.js` | file | 1 | boot-started | Y | Y | — | — |
| `conversion-intelligence-layer.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `conversion-truth-layer.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `crash-notifier.js` | file | 1 | boot-started | Y | Y | — | — |
| `creditSystem.js` | file | 1 | boot-required | — | — | — | — |
| `cryptoauth` | dir | 1 | boot-required | — | — | Y | — |
| `cryptoBridge` | dir | 1 | boot-required | — | — | — | synthetic-signal |
| `customer-success-autopilot.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `customerHealth.js` | file | 1 | boot-required | — | — | — | — |
| `deepseek-governor.js` | file | 1 | boot-required | — | Y | Y | synthetic-signal |
| `defenseModule.js` | file | 1 | boot-required | — | — | — | — |
| `disaster-recovery.js` | file | 1 | boot-started | Y | Y | Y | — |
| `domainAutomationManager.js` | file | 1 | boot-started | Y | Y | — | — |
| `dynamic-pricing.js` | file | 1 | boot-required | — | — | Y | synthetic-signal |
| `energyGrid.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `energyTrading.js` | file | 1 | marketplace-sweep | — | Y | — | — |
| `engine-core.js` | file | 1 | marketplace-sweep | Y | Y | — | synthetic-signal |
| `enterprise-cloud-router.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `enterprise-deal-desk.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `enterprise-router.js` | file | 1 | boot-required | — | — | — | — |
| `enterprisePartnership.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `error-pattern-detector.js` | file | 1 | alias | — | — | — | alias |
| `evolution-core.js` | file | 1 | alias | — | — | — | alias |
| `executiveDashboard.js` | file | 1 | boot-started | Y | — | — | — |
| `expansion-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `FeatureFlagManager.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `feedback-ai.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `forward-only-safety.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `funnel-intelligence.js` | file | 1 | boot-required | — | — | — | — |
| `future-state-ai.js` | file | 1 | marketplace-sweep | — | — | Y | synthetic-signal |
| `FutureCompatibilityBridge.js` | file | 1 | boot-required | — | Y | — | — |
| `gcp-cost-optimizer.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `giantIntegrationFabric.js` | file | 1 | boot-required | — | Y | — | — |
| `github-ops.js` | file | 1 | boot-required | — | Y | — | — |
| `global-api-gateway.js` | file | 1 | boot-required | — | Y | Y | — |
| `global-failover.js` | file | 1 | boot-started | Y | Y | Y | synthetic-signal |
| `global-load-balancer.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `global-referral-loop.js` | file | 1 | boot-required | — | Y | — | — |
| `globalDigitalStandard.js` | file | 1 | boot-started | Y | — | — | synthetic-signal |
| `globalEnergyCarbonTrader.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `globalMonetizationMesh.js` | file | 1 | boot-required | — | Y | — | — |
| `governmentModule.js` | file | 1 | boot-required | — | — | — | — |
| `growth-brain.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `growth-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `healthcareAI.js` | file | 1 | marketplace-sweep | — | Y | — | — |
| `improvements-pack` | dir | 9 | boot-required | — | Y | Y | — |
| `industryOS.js` | file | 1 | boot-required | — | Y | — | — |
| `innovation` | dir | 4 | boot-required | — | Y | Y | — |
| `innovation-ship-gate.js` | file | 1 | boot-required | — | Y | — | — |
| `innovationEngine.js` | file | 1 | alias | — | — | — | alias |
| `innovations-100y` | dir | 1 | loaded | — | — | Y | synthetic-signal |
| `innovations-30y.js` | file | 1 | alias | — | — | Y | alias |
| `innovations-50y` | dir | 9 | boot-required | — | — | Y | — |
| `integrations` | dir | 8 | boot-started | Y | Y | Y | — |
| `investor-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `kpi-analytics.js` | file | 1 | boot-required | — | Y | Y | — |
| `lead-intelligence.js` | file | 1 | boot-required | — | — | — | — |
| `legalContract.js` | file | 1 | boot-required | — | — | — | — |
| `legalFortress.js` | file | 1 | boot-started | Y | — | — | — |
| `live-pricing-broker.js` | file | 1 | boot-started | Y | — | — | — |
| `llamaBridge.js` | file | 1 | boot-required | — | Y | — | — |
| `log-monitor.js` | file | 1 | boot-started | Y | Y | Y | — |
| `maAdvisor.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `market-scanner-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `marketing-innovations` | dir | 26 | boot-required | — | — | Y | — |
| `memory-fabric-engine.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `memory-guardian.js` | file | 1 | boot-started | Y | Y | — | — |
| `memory-pressure-guardian.js` | file | 1 | boot-started | Y | Y | — | — |
| `merkle-anchor.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `meshOrchestrator.js` | file | 1 | marketplace-sweep | — | Y | — | — |
| `moat-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `module-performance-ranker.js` | file | 1 | boot-required | — | Y | — | — |
| `moduleIdentity.js` | file | 1 | boot-required | — | — | — | — |
| `ModuleLoader.js` | file | 1 | boot-required | — | Y | — | — |
| `multi-model-router.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `multi-payment-rails.js` | file | 1 | boot-required | — | Y | — | — |
| `mutation-sandbox.js` | file | 1 | boot-required | — | Y | — | — |
| `nowPayments.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `observability.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `offer-factory.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `opportunityRadar.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `ops-watchdog.js` | file | 1 | alias | — | — | Y | alias |
| `orchestrator-v4.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `owner-revenue-dashboard.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `paymentGateway.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `paymentSystems.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `performance-100y` | dir | 1 | loaded | — | — | Y | — |
| `performance-100y-v2` | dir | 1 | loaded | — | — | Y | synthetic-signal |
| `performance-100y-v3` | dir | 1 | loaded | — | — | Y | synthetic-signal |
| `performance-monitor.js` | file | 1 | boot-started | Y | Y | — | — |
| `pnl-time-machine.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `polish-pack` | dir | 1 | loaded | — | — | Y | — |
| `predictive-healing.js` | file | 1 | alias | — | — | — | alias |
| `predictive-market-intelligence.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `predictive-scaler.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `price-autotuner.js` | file | 1 | boot-started | Y | Y | — | — |
| `priceNegotiator.js` | file | 1 | boot-required | — | — | Y | — |
| `profit-attribution.js` | file | 1 | boot-required | — | — | Y | — |
| `profit-autopilot.js` | file | 1 | boot-started | Y | Y | Y | — |
| `profit-control-loop.js` | file | 1 | boot-started | Y | Y | — | — |
| `profit-optimization-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `programmatic-seo-engine.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `proof-of-delivery-ledger.js` | file | 1 | boot-required | — | Y | Y | — |
| `provisioning-engine.js` | file | 1 | boot-required | — | Y | Y | synthetic-signal |
| `qrDigitalIdentity.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `quantum-healing.js` | file | 1 | alias | — | — | — | alias |
| `quantumBlockchain.js` | file | 1 | boot-required | — | — | — | — |
| `quantumIntegrityShield.js` | file | 1 | boot-started | Y | Y | — | — |
| `quantumPaymentNexus.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `quantumResilienceCore.js` | file | 1 | boot-started | Y | — | — | synthetic-signal |
| `quantumResistantBaaS.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `QuantumSecurityLayer.js` | file | 1 | boot-required | — | Y | — | — |
| `quantumVault.js` | file | 1 | boot-required | — | Y | — | — |
| `quarantineBuffer.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `reality-metrics.js` | file | 1 | marketplace-sweep | — | — | Y | synthetic-signal |
| `recovery-engine.js` | file | 1 | alias | — | — | — | alias |
| `recovery-orchestrator.js` | file | 1 | alias | — | — | Y | alias |
| `referralEngine.js` | file | 1 | boot-required | — | — | — | — |
| `reputationProtocol.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `resource-monitor.js` | file | 1 | boot-started | Y | Y | Y | — |
| `retention-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `revenue-autopilot.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `revenue-conversion-auto.js` | file | 1 | marketplace-sweep | — | — | — | — |
| `revenue-flywheel.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `revenueModules.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `riskAnalyzer.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `rollback-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `route-cache.js` | file | 1 | boot-required | — | — | — | — |
| `saas-orchestrator-v4.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `salesOrchestrator.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `security-scanner.js` | file | 1 | boot-started | Y | Y | Y | — |
| `self-adaptation-engine.js` | file | 1 | boot-started | Y | Y | — | — |
| `self-documenter.js` | file | 1 | boot-started | Y | Y | — | — |
| `self-evolving-engine.js` | file | 1 | boot-started | Y | Y | — | — |
| `self-healing-engine.js` | file | 1 | alias | — | — | Y | alias |
| `selfConstruction.js` | file | 1 | boot-started | Y | Y | — | — |
| `sentiment-analysis-engine.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `seo-optimizer.js` | file | 1 | boot-started | Y | Y | Y | — |
| `service-watchdog.js` | file | 1 | alias | — | — | — | alias |
| `serviceCatalog.js` | file | 1 | boot-required | — | Y | Y | — |
| `serviceMarketplace.js` | file | 1 | boot-required | — | — | Y | synthetic-signal |
| `shadow-tester.js` | file | 1 | alias | — | — | Y | alias |
| `site-creator.js` | file | 1 | boot-started | Y | Y | — | — |
| `slo-tracker.js` | file | 1 | boot-required | — | — | Y | — |
| `social-orchestrator` | dir | 12 | boot-required | — | Y | Y | synthetic-signal |
| `socialMediaViralizer.js` | file | 1 | boot-started | Y | — | Y | synthetic-signal |
| `sovereign_innovations` | dir | 9 | boot-required | — | Y | — | — |
| `sovereignAccessGuardian.js` | file | 1 | boot-required | — | Y | — | — |
| `sovereignRevenueRouter.js` | file | 1 | boot-required | — | Y | — | — |
| `subscription-engine.js` | file | 1 | boot-required | — | Y | — | — |
| `succession.js` | file | 1 | marketplace-sweep | — | — | Y | — |
| `supreme-innovator-adapter.js` | file | 1 | marketplace-sweep | — | Y | — | — |
| `supreme-self-healer-adapter.js` | file | 1 | marketplace-sweep | — | Y | — | — |
| `swarm-intelligence.js` | file | 1 | boot-started | Y | Y | — | — |
| `tax-engine.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `telecomModule.js` | file | 1 | boot-required | — | — | — | — |
| `temporalAbiRegistry.js` | file | 1 | boot-required | — | — | — | — |
| `TemporalDataProcessor.js` | file | 1 | boot-required | — | Y | — | — |
| `tenant-analytics.js` | file | 1 | boot-required | — | Y | — | — |
| `tenant-billing.js` | file | 1 | boot-required | — | Y | Y | synthetic-signal |
| `tenant-engine.js` | file | 1 | boot-started | Y | — | — | synthetic-signal |
| `tenant-gateway.js` | file | 1 | boot-required | — | Y | — | — |
| `tenant-manager.js` | file | 1 | boot-started | Y | Y | — | — |
| `tenant-provisioning.js` | file | 1 | boot-required | — | Y | — | — |
| `tenantBilling.js` | file | 1 | alias | — | — | — | alias |
| `tenantProvisioning.js` | file | 1 | alias | — | — | — | alias |
| `totalSystemHealer.js` | file | 1 | alias | — | — | — | alias |
| `traffic-engine.js` | file | 1 | boot-started | Y | Y | Y | synthetic-signal |
| `ui-auto-builder.js` | file | 1 | boot-started | Y | Y | Y | — |
| `ui-evolution.js` | file | 1 | alias | — | — | — | alias |
| `unicorn-commerce-connector.js` | file | 1 | alias | — | — | Y | alias |
| `unicorn-execution-engine.js` | file | 1 | boot-started | Y | Y | — | — |
| `unicorn-realization-engine.js` | file | 1 | boot-started | Y | Y | — | — |
| `unicorn-super-intelligence` | dir | 4 | boot-started | Y | Y | — | — |
| `unicorn-super-intelligence.js` | file | 1 | boot-started | Y | Y | — | — |
| `unicornAutoGenesis.js` | file | 1 | alias | — | — | — | alias |
| `unicornAutonomousCore.js` | file | 1 | boot-started | Y | Y | — | — |
| `unicornBrain.js` | file | 1 | marketplace-sweep | Y | Y | Y | — |
| `unicornEconomy.js` | file | 1 | marketplace-sweep | Y | Y | Y | — |
| `unicornEternalEngine.js` | file | 1 | boot-started | Y | Y | — | synthetic-signal |
| `unicornGrowth.js` | file | 1 | marketplace-sweep | Y | Y | Y | — |
| `unicornGuardian.js` | file | 1 | marketplace-sweep | Y | Y | Y | — |
| `unicornInnovationSuite.js` | file | 1 | alias | — | — | — | alias |
| `unicornInnovator.js` | file | 1 | boot-required | — | Y | Y | — |
| `unicornMeshOrchestrator.js` | file | 1 | boot-started | Y | Y | — | — |
| `unicornOracle.js` | file | 1 | marketplace-sweep | Y | Y | Y | — |
| `unicornOrchestrator.js` | file | 1 | boot-started | Y | Y | — | — |
| `unicornSelfHealer.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `unicornSovereignty.js` | file | 1 | marketplace-sweep | Y | Y | Y | — |
| `unicornTreasury.js` | file | 1 | marketplace-sweep | Y | Y | Y | synthetic-signal |
| `unicornUltimateModules.js` | file | 1 | boot-started | Y | — | — | synthetic-signal |
| `unit-economics-engine.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `universal-adaptor.js` | file | 1 | boot-started | Y | Y | — | — |
| `universal-ai-connector` | dir | 1 | boot-started | Y | Y | — | — |
| `universal-interchain-nexus.js` | file | 1 | boot-started | Y | Y | — | — |
| `universalAIConnector.js` | file | 1 | boot-required | — | Y | — | — |
| `universalAITrainingMarketplace.js` | file | 1 | boot-required | — | Y | — | synthetic-signal |
| `universalMarketNexus.js` | file | 1 | boot-started | Y | — | — | synthetic-signal |
| `upsell-engine.js` | file | 1 | boot-required | — | — | — | synthetic-signal |
| `valueProofLedger.js` | file | 1 | boot-required | — | Y | — | — |
| `vertical-growth-page-engine.js` | file | 1 | marketplace-sweep | — | Y | Y | — |
| `web3Identity.js` | file | 1 | marketplace-sweep | — | Y | — | — |
| `whiteLabelEngine.js` | file | 1 | boot-required | — | — | — | — |
| `workflowEngine.js` | file | 1 | boot-required | — | — | — | — |
| `world-ai-commerce-protocol.js` | file | 1 | boot-required | — | Y | Y | — |
| `worldStandard.js` | file | 1 | boot-required | — | — | — | — |
| `zacAlertChannel.js` | file | 1 | boot-required | — | Y | — | — |
| `zacc` | dir | 24 | boot-required | — | — | Y | synthetic-signal |
| `zeusAutonomousCore` | dir | 8 | boot-started | Y | Y | — | — |
| `zk-revenue-proof.js` | file | 1 | boot-required | — | Y | — | — |

## Site modules (`src/modules`)

- `src/modules/ai-router.js`
- `src/modules/auto-deploy-orchestrator/index.js`
- `src/modules/billionScaleActivationOrchestrator.js`
- `src/modules/billionScaleRevenueEngine.js`
- `src/modules/code-sanity-engine/index.js`
- `src/modules/ops-aggregator.js`
- `src/modules/unicornCommerceConnector.js`

## Unicorn ↔ Site sync contract

1. Sellable catalog: `/api/catalog/master` (site) + `/api/instant/catalog` (curated 25)
2. Live prices: `/api/pricing/live` + `/api/pricing/live/stream`
3. Module mirror: `/api/modules/list` + `/api/modules/stream` → site `MODULES_CACHE`
4. Autonomy status: `/api/autonomy/status`, `/health`, `/site/observe`
5. Public storefront never auto-lists synthetic modules without fulfillment recipes
