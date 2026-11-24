// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Protocol: UMAP/1.0 — Universal MCP (JSON-RPC 2.0), Google A2A & OpenAPI 3.1 Mesh
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const PROTOCOL = 'UMAP/1.0';
const MCP_VERSION = '2025-03-26';
const DOMAIN = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');
const OWNER_NAME = process.env.OWNER_NAME || 'Vladoi Ionut';
const OWNER_EMAIL = process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com';

const MCP_TOOLS = [
  {
    name: 'zeus_live_website_audit',
    description: 'Run a real SSRF-safe 7-point Proof-Before-Pay SEO/AEO/GEO/HSTS live website diagnostic on any public HTTPS/HTTP URL and receive verifiable gaps plus instant activation URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public website URL to scan (e.g. https://example.com)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'zeus_list_autonomous_services',
    description: 'List all 55+ ZeusAI Unicorn autonomous services that activate live backend modules after payment (ASPE/1.0), optionally filtered by query, tier, or maxPriceUsd.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword filter (e.g. seo, security, chatbot, audit)' },
        tier: { type: 'string', description: 'Optional tier filter (instant, professional, enterprise, frontier, industry, dropship)' },
        maxPriceUsd: { type: 'number', description: 'Optional maximum list price in USD' },
      },
    },
  },
  {
    name: 'zeus_service_blueprint',
    description: 'Inspect the exact live Unicorn modules, isolated workspace topology, API execution schedule, and Ed25519 proof blueprint for a specific service ID.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Service ID (e.g. instant-website-audit, professional-ai-agent)' },
      },
      required: ['serviceId'],
    },
  },
  {
    name: 'zeus_payment_route',
    description: 'Recommend the optimal live payment rail (Bitcoin Direct -10%, PayPal Live, or NOWPayments Live multi-crypto/card) for a USD amount.',
    inputSchema: {
      type: 'object',
      properties: {
        amountUsd: { type: 'number', description: 'List order amount in USD (e.g. 49, 199, 2500)' },
        preferCrypto: { type: 'boolean', description: 'Prefer Bitcoin direct rail (-10% discount) when true' },
      },
      required: ['amountUsd'],
    },
  },
  {
    name: 'zeus_create_referral_bounty',
    description: 'Mint a cryptographic 10% friend discount + 10% referrer bounty link via ACME/1.0.',
    inputSchema: {
      type: 'object',
      properties: {
        referrerId: { type: 'string', description: 'Referrer handle, domain, or agent identifier' },
      },
      required: ['referrerId'],
    },
  },
  {
    name: 'zeus_llm_swarm_status',
    description: 'Inspect the live NSC/1.0 Self-Healing Multi-LLM Frontier Swarm (Groq 120B, OpenRouter 550B free, local Ollama) and rail telemetry.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zeus_runtime_immunity',
    description: 'Fetch the live Ed25519-signed ASRI/1.0 Supply-Chain (0 npm CVEs) & Runtime Immunity Certificate (SOVEREIGN_A+).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zeus_evolution_ledger',
    description: 'Inspect the live Ed25519-signed, SHA-256 hash-chained CEGE/1.0 Cognitive Evolution Genome & Autonomous Innovation Ledger.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zeus_seo_aeo_geo_graph',
    description: 'Fetch live SAGS/1.0 Tri-Layer SEO, Answer Engine (AEO) & Generative Engine (GEO) citation capsules.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zeus_cognitive_advisor',
    description: 'Consult ZeusAI Omniscient Cognitive Architect + CEGE/1.0 semantic memory to diagnose requirements and recommend exact autonomous services.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Business or technical engineering question (EN or RO)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'zeus_treasury_autonomy',
    description: 'Fetch the live Ed25519-signed ATRO/1.0 Autonomous Treasury, Deduplicated Net-Profit Reconciliation & Multi-Rail Settlement Attestation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zeus_living_organism',
    description: 'Inspect the live Ed25519-signed AOSO/1.0 6-Agent Sovereign Living Organism homeostasis score, predictive reflex arcs, and Red-Team security checks.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'zeus_bundle_quote',
    description: 'Calculate a canonical multi-item bundle quote with automatic 15% (2 items) or 20% (3+ items) bundle discount plus 10% Bitcoin discount.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceIds: { type: 'array', items: { type: 'string' }, description: 'Array of 2–6 ZeusAI service IDs to bundle' },
      },
      required: ['serviceIds'],
    },
  },
  {
    name: 'zeus_negotiate_deal',
    description: 'Negotiate a floor-margin-protected, Ed25519-signed binding deal (SMCE/1.0) for single or multi-service bundles with optimal rail recommendation and 1-click checkout URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceIds: { type: 'array', items: { type: 'string' }, description: '1–6 ZeusAI service IDs' },
        budgetUsd: { type: 'number', description: 'Optional buyer target budget in USD' },
        rail: { type: 'string', description: 'Preferred settlement rail: btc (default, -10%), paypal, or nowpayments' },
        referralCode: { type: 'string', description: 'Optional referral code (zeus_...)' },
        domain: { type: 'string', description: 'Optional buyer domain for tailored remediation scope' },
      },
    },
  },
  {
    name: 'zeus_create_live_checkout',
    description: 'Mint a REAL live multi-rail ZeusAI payment invoice (BTC direct -10% unique satoshis, PayPal, NOWPayments) for a single service or discounted multi-item bundle.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Primary ZeusAI service ID (e.g. instant-website-audit)' },
        bundleIds: { type: 'array', items: { type: 'string' }, description: 'Optional 2–6 service IDs for automatic 15%–20% server-verified bundle discount' },
        rail: { type: 'string', description: 'Settlement rail: btc (default, -10%), paypal, or nowpayments' },
        currency: { type: 'string', description: 'USD (default) or EUR' },
        email: { type: 'string', description: 'Optional buyer email for delivery receipt' },
        ref: { type: 'string', description: 'Optional referral code' },
      },
      required: ['serviceId'],
    },
  },
  {
    name: 'zeus_execute_paid_service',
    description: 'HTTP 402 M2M paywall execution (SMCE/1.0): with valid paid orderId + accessToken/API key, executes live Unicorn autonomous modules with Ed25519 proof; without payment, returns a signed HTTP 402 payment challenge.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Target ZeusAI service ID' },
        bundleIds: { type: 'array', items: { type: 'string' }, description: 'Optional bundled service IDs' },
        orderId: { type: 'string', description: 'Paid ZeusAI orderId (ord_...)' },
        accessToken: { type: 'string', description: 'Order access_token or scoped zai_auto_* API key' },
        inputs: { type: 'object', description: 'Optional execution parameters (e.g. target domain or brief)' },
      },
    },
  },
  {
    name: 'zeus_unicorn_module_atlas',
    description: 'Inspect or search the full-fleet Universal Module Atlas (UMAS/1.0) covering ALL 900+ Unicorn modules across backend/modules, src/commerce, src/site, 31 manifest modules, and live IAK health.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword to search across all 900+ modules' },
        organ: { type: 'string', description: 'Optional organ filter (growth_acquisition, cro_conversion, fulfillment_quality, redteam_security, sre_performance, git_native_evolution, core_infrastructure)' },
        limit: { type: 'integer', description: 'Max search results (default 25)' },
      },
    },
  },
  {
    name: 'zeus_universal_solution_finder',
    description: 'Match ANY person (career, creator, startup, developer, e-commerce) or ANY of the 18 world industries (fintech, health, retail, logistics, etc.) to tailored autonomous Unicorn services and discounted bundles.',
    inputSchema: {
      type: 'object',
      properties: {
        persona: { type: 'string', description: 'Persona: individual_career, creator_brand, startup_smb, agency_developer, ecommerce_retail, or enterprise_industry' },
        industry: { type: 'string', description: 'Optional industry vertical (fintech, health, retail, logistics, manufacturing, energy, agri, edu, govtech, legaltech, hospitality, media, gaming, realestate, mobility, biotech, security, climate)' },
        goal: { type: 'string', description: 'Optional free-text goal' },
        budgetUsd: { type: 'number', description: 'Optional target budget in USD' },
      },
    },
  },
  {
    name: 'zeus_enroll_affiliate',
    description: 'Enroll an external AI agent, developer, or creator into the ZeusAI Global A2A Affiliate Mesh (10% friend discount + 10% partner commission).',
    inputSchema: {
      type: 'object',
      properties: {
        agentOrPartnerId: { type: 'string', description: 'Unique agent name, handle, or email identifier' },
        payoutBtcAddress: { type: 'string', description: 'Optional Bitcoin payout address (bc1...)' },
        channel: { type: 'string', description: 'Distribution channel (e.g. mcp_agent, developer, creator)' },
      },
      required: ['agentOrPartnerId'],
    },
  },
  {
    name: 'zeus_drift_watch_status',
    description: 'Enroll a domain in Weekly Autonomous SEO/AEO/GEO/Security Drift Watch (ARRE/1.0) or inspect recurring autonomy manifest.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Optional public domain to enroll in weekly Drift Watch' },
        cadenceDays: { type: 'integer', description: 'Optional cadence in days (default 7)' },
      },
    },
  },
  {
    name: 'zeus_embed_widget_generator',
    description: 'Generate a personalized 1-line affiliate-attributed viral audit embed widget (<script>) for WordPress, Shopify, or any website plus @zeusai/sdk & Python SDK quick-start.',
    inputSchema: {
      type: 'object',
      properties: {
        refCode: { type: 'string', description: 'Optional partner affiliate code (zeus_...) to attribute 10% commissions automatically' },
      },
    },
  },
];

const MCP_RESOURCES = [
  {
    uri: 'zeus://catalog/autonomous-services',
    name: 'ASPE/1.0 Autonomous Services Catalog (55+ live services)',
    mimeType: 'application/json',
    description: 'Complete machine-readable capability map of all post-payment autonomous Unicorn services.',
  },
  {
    uri: 'zeus://attestation/runtime-immunity',
    name: 'ASRI/1.0 Ed25519 Runtime Immunity Certificate',
    mimeType: 'application/json',
    description: 'Cryptographically signed 0-CVE supply-chain and V8 runtime stability certificate.',
  },
  {
    uri: 'zeus://evolution/ledger',
    name: 'CEGE/1.0 Ed25519 Cognitive Evolution Ledger',
    mimeType: 'application/json',
    description: 'Hash-chained, Ed25519-signed multi-domain strategy genomes, shadow evaluations, and innovation RFCs.',
  },
  {
    uri: 'zeus://swarm/manifest',
    name: 'NSC/1.0 Neural Swarm LLM Cascade Manifest',
    mimeType: 'application/json',
    description: 'Live frontier multi-LLM cascade configuration (Groq 120B, OpenRouter 550B free, local Ollama).',
  },
  {
    uri: 'zeus://aeo/answer-graph',
    name: 'SAGS/1.0 AEO Answer & GEO Citation Graph',
    mimeType: 'application/json',
    description: 'Verified bilingual answer capsules and citation matrices for AI search engines.',
  },
  {
    uri: 'zeus://client-magnet/manifest',
    name: 'ACME/1.0 Proof-Before-Pay & Referral Manifest',
    mimeType: 'application/json',
    description: 'Zero-friction live diagnostic & 10%/10% cryptographic referral bounty manifest.',
  },
  {
    uri: 'zeus://treasury/autonomy',
    name: 'ATRO/1.0 Ed25519 Autonomous Treasury & Net-Profit Attestation',
    mimeType: 'application/json',
    description: 'Zero-PII, deduplicated multi-rail revenue, net profit, and on-chain Bitcoin reconciliation proof.',
  },
  {
    uri: 'zeus://organism/manifest',
    name: 'AOSO/1.0 Ed25519 6-Agent Living Organism Manifest',
    mimeType: 'application/json',
    description: 'Live homeostasis index across all 6 specialist autonomous agents and 5 predictive reflex arcs.',
  },
  {
    uri: 'zeus://commerce/x402-manifest',
    name: 'SMCE/1.0 HTTP 402 M2M Commerce & Autonomous Negotiation Manifest',
    mimeType: 'application/json',
    description: 'Ed25519-signed machine-to-machine payment paywall, bundle discount rules, and direct agent checkout endpoints.',
  },
  {
    uri: 'zeus://atlas/all-modules',
    name: 'UMAS/1.0 Universal Full-Fleet Unicorn Module Atlas (900+ modules)',
    mimeType: 'application/json',
    description: 'Complete 100%-coverage census of every Unicorn module across backend/modules, src/commerce, src/site, 31 manifest modules, and all 6 living-organism organs.',
  },
  {
    uri: 'zeus://revenue/recurring-autonomy',
    name: 'ARRE/1.0 Ed25519 Recurring Revenue, Drift Watch & Global Utility Manifest',
    mimeType: 'application/json',
    description: 'Weekly Client Drift Watch, Real-Revenue UCB1 Conversion Bandit, Global A2A Affiliate Mesh, and 18-Industry Universal Solution Finder.',
  },
];

const MCP_PROMPTS = [
  {
    name: 'audit_and_remediate_domain',
    description: 'Audit a target domain live with zeus_live_website_audit and produce a prioritized remediation & autonomous activation plan.',
    arguments: [
      { name: 'url', description: 'Public domain URL to audit', required: true },
    ],
  },
  {
    name: 'architect_sovereign_ai_stack',
    description: 'Design an autonomous multi-agent enterprise AI stack using Unicorn modules and recommend exact ASPE/1.0 services.',
    arguments: [
      { name: 'industry', description: 'Target industry or business model', required: true },
      { name: 'budgetUsd', description: 'Optional target budget in USD', required: false },
    ],
  },
  {
    name: 'autonomous_procurement_brief',
    description: 'Prepare a machine-verifiable procurement brief for an AI buyer agent including Ed25519 attestations, BTC -10% discount quote, and post-payment activation endpoints.',
    arguments: [
      { name: 'serviceId', description: 'Target ZeusAI service ID', required: true },
    ],
  },
];

function safeReq(relPath) {
  try { return require(relPath); } catch (_) { return null; }
}

class UniversalMcpA2aMesh {
  constructor() {
    this.protocol = PROTOCOL;
    this.mcpVersion = MCP_VERSION;
    this.startedAt = new Date().toISOString();
    this.totalRpcCalls = 0;
    this.totalToolCalls = 0;
    this.totalResourceReads = 0;
    this.toolCounters = {};
    this.recentCalls = [];
  }

  _recordCall(method, detail, ok, latencyMs) {
    this.totalRpcCalls += 1;
    this.recentCalls.unshift({
      at: new Date().toISOString(),
      method,
      detail,
      ok: !!ok,
      latencyMs: Math.max(0, Number(latencyMs) || 0),
    });
    if (this.recentCalls.length > 30) this.recentCalls.length = 30;
  }

  async _executeTool(name, args) {
    const t0 = Date.now();
    const safeArgs = (args && typeof args === 'object') ? args : {};
    this.totalToolCalls += 1;
    this.toolCounters[name] = (this.toolCounters[name] || 0) + 1;

    let result = null;
    if (name === 'zeus_live_website_audit') {
      const acme = safeReq('../autonomous-client-magnet');
      if (!acme) throw new Error('acme_module_unavailable');
      result = await acme.runProofBeforePayTeaser(String(safeArgs.url || ''));
    } else if (name === 'zeus_list_autonomous_services') {
      const aspe = safeReq('../autonomous-service-provisioning');
      if (!aspe) throw new Error('aspe_module_unavailable');
      const cap = aspe.getCatalogCapabilities();
      let list = Array.isArray(cap.services)
        ? cap.services
        : (cap.services && typeof cap.services === 'object'
          ? Object.entries(cap.services).map(([id, val]) => Object.assign({ id }, val))
          : []);
      if (safeArgs.query) {
        const q = String(safeArgs.query).toLowerCase();
        list = list.filter((s) => JSON.stringify(s).toLowerCase().includes(q));
      }
      if (safeArgs.tier) {
        const tier = String(safeArgs.tier).toLowerCase();
        list = list.filter((s) => String(s.tier || s.vertical || '').toLowerCase().includes(tier));
      }
      if (typeof safeArgs.maxPriceUsd === 'number' && Number.isFinite(safeArgs.maxPriceUsd)) {
        list = list.filter((s) => Number(s.priceUsd || s.price || 0) <= safeArgs.maxPriceUsd);
      }
      result = {
        ok: true,
        protocol: 'ASPE/1.0',
        totalMatched: list.length,
        totalCatalogServices: cap.totalMappedServices || (cap.services ? cap.services.length : 0),
        services: list.slice(0, 60),
      };
    } else if (name === 'zeus_service_blueprint') {
      const aspe = safeReq('../autonomous-service-provisioning');
      if (!aspe) throw new Error('aspe_module_unavailable');
      const serviceId = String(safeArgs.serviceId || '').trim();
      if (!serviceId) throw new Error('serviceId_required');
      result = {
        ok: true,
        serviceId,
        blueprint: aspe.getServiceBlueprint(serviceId),
        checkoutUrl: `${DOMAIN}/checkout/?plan=${encodeURIComponent(serviceId)}`,
      };
    } else if (name === 'zeus_payment_route') {
      const amount = Math.max(1, Number(safeArgs.amountUsd) || 49);
      const btcUsd = Number((amount * 0.90).toFixed(2));
      const spot = (global.__btcSpotCache && Number(global.__btcSpotCache.usdPerBtc) > 0)
        ? Number(global.__btcSpotCache.usdPerBtc)
        : 95000;
      const btcAmount = Number((btcUsd / spot).toFixed(8));
      const preferCrypto = safeArgs.preferCrypto !== false;
      result = {
        ok: true,
        listAmountUsd: amount,
        recommendedRail: preferCrypto ? 'bitcoin_direct_10pct_off' : 'paypal_live',
        rails: [
          { id: 'bitcoin', label: 'Bitcoin Direct On-Chain (-10%)', payUsd: btcUsd, estimatedBtc: btcAmount, btcSpotUsd: spot, active: true },
          { id: 'paypal', label: 'PayPal Live', payUsd: amount, active: true },
          { id: 'nowpayments', label: 'NOWPayments Live (Multi-Crypto + Card)', payUsd: amount, active: true },
        ],
      };
    } else if (name === 'zeus_create_referral_bounty') {
      const acme = safeReq('../autonomous-client-magnet');
      if (!acme) throw new Error('acme_module_unavailable');
      result = { ok: true, referral: acme.createReferralLink(String(safeArgs.referrerId || 'mcp-agent')) };
    } else if (name === 'zeus_llm_swarm_status') {
      const nsc = safeReq('../neural-swarm-llm-cascade');
      if (!nsc) throw new Error('nsc_module_unavailable');
      result = nsc.getSwarmManifest();
    } else if (name === 'zeus_runtime_immunity') {
      const asri = safeReq('../autonomous-runtime-immunity');
      if (!asri) throw new Error('asri_module_unavailable');
      result = asri.getImmunityCertificate();
    } else if (name === 'zeus_evolution_ledger') {
      const cege = safeReq('../cognitive-evolution-genome');
      if (!cege) throw new Error('cege_module_unavailable');
      result = cege.getEvolutionLedger();
    } else if (name === 'zeus_seo_aeo_geo_graph') {
      const sags = safeReq('../seo-aeo-geo-singularity');
      if (!sags) throw new Error('sags_module_unavailable');
      result = sags.getAeoAnswerGraph();
    } else if (name === 'zeus_cognitive_advisor') {
      const brain = safeReq('../omniscient-chatbot');
      const cege = safeReq('../cognitive-evolution-genome');
      const msg = String(safeArgs.message || '').trim();
      if (!msg) throw new Error('message_required');
      const ans = brain ? await brain.answer({ message: msg }) : { ok: false, error: 'advisor_unavailable' };
      const recalled = cege ? cege.recallKnowledge(msg, 3) : [];
      result = Object.assign({}, ans, { cognitiveMemoryRecall: recalled });
    } else if (name === 'zeus_treasury_autonomy') {
      const atro = safeReq('../autonomous-treasury-reconciler');
      if (!atro) throw new Error('atro_module_unavailable');
      result = atro.getTreasurySnapshot();
    } else if (name === 'zeus_living_organism') {
      const aoso = safeReq('../autonomous-organism-orchestrator');
      if (!aoso) throw new Error('aoso_module_unavailable');
      result = aoso.getOrganismManifest();
    } else if (name === 'zeus_bundle_quote') {
      const aoso = safeReq('../autonomous-organism-orchestrator');
      if (!aoso) throw new Error('aoso_module_unavailable');
      result = aoso.quoteMultiItemBundle(safeArgs.serviceIds || []);
    } else if (name === 'zeus_negotiate_deal') {
      const smce = safeReq('../autonomous-m2m-commerce-engine');
      if (!smce) throw new Error('smce_module_unavailable');
      result = smce.negotiateAutonomousDeal(safeArgs);
    } else if (name === 'zeus_create_live_checkout') {
      const smce = safeReq('../autonomous-m2m-commerce-engine');
      if (!smce) throw new Error('smce_module_unavailable');
      result = await smce.createLiveAgentCheckout(safeArgs);
    } else if (name === 'zeus_execute_paid_service') {
      const smce = safeReq('../autonomous-m2m-commerce-engine');
      if (!smce) throw new Error('smce_module_unavailable');
      const x402 = await smce.executeX402OrChallenge(safeArgs);
      result = x402.body;
    } else if (name === 'zeus_unicorn_module_atlas') {
      const umas = safeReq('../iak/universal-module-atlas');
      if (!umas) throw new Error('umas_module_unavailable');
      result = (safeArgs.query || safeArgs.organ)
        ? umas.searchModules(safeArgs.query || '', { organ: safeArgs.organ || '', limit: safeArgs.limit || 25 })
        : umas.getUniversalAtlas();
    } else if (name === 'zeus_universal_solution_finder') {
      const arre = safeReq('../autonomous-recurring-revenue-engine');
      if (!arre) throw new Error('arre_module_unavailable');
      result = arre.recommendUniversalSolution(safeArgs);
    } else if (name === 'zeus_enroll_affiliate') {
      const arre = safeReq('../autonomous-recurring-revenue-engine');
      if (!arre) throw new Error('arre_module_unavailable');
      result = arre.enrollAgentAffiliate(safeArgs);
    } else if (name === 'zeus_drift_watch_status') {
      const arre = safeReq('../autonomous-recurring-revenue-engine');
      if (!arre) throw new Error('arre_module_unavailable');
      result = safeArgs.domain ? arre.registerDriftWatch(safeArgs) : arre.getArreManifest();
    } else if (name === 'zeus_embed_widget_generator') {
      const b2b = safeReq('../../../src/site/enterprise-b2b-and-embed');
      if (!b2b) throw new Error('embed_module_unavailable');
      result = b2b.getSdkAndEmbedManifest(safeArgs.refCode || safeArgs.ref || '');
    } else {
      const err = new Error('Unknown MCP tool: ' + name);
      err.code = -32601;
      throw err;
    }

    const latencyMs = Date.now() - t0;
    try {
      const cege = safeReq('../cognitive-evolution-genome');
      if (cege && typeof cege.recordOutcome === 'function') {
        cege.recordOutcome({
          domain: 'agentic_commerce_negotiation',
          qualityScore: result && result.ok !== false ? 92 : 60,
          latencyMs,
          success: !(result && result.ok === false),
          lesson: result && result.ok !== false
            ? `MCP tool ${name} served autonomous agent request cleanly in ${latencyMs}ms with machine-verifiable JSON structure.`
            : '',
          source: 'umap_mcp_tool',
        });
      }
    } catch (_) {}

    return { result, latencyMs };
  }

  _readResource(uri) {
    this.totalResourceReads += 1;
    let data = null;
    if (uri === 'zeus://catalog/autonomous-services') {
      const aspe = safeReq('../autonomous-service-provisioning');
      data = aspe ? aspe.getCatalogCapabilities() : { ok: false };
    } else if (uri === 'zeus://attestation/runtime-immunity') {
      const asri = safeReq('../autonomous-runtime-immunity');
      data = asri ? asri.getImmunityCertificate() : { ok: false };
    } else if (uri === 'zeus://evolution/ledger') {
      const cege = safeReq('../cognitive-evolution-genome');
      data = cege ? cege.getEvolutionLedger() : { ok: false };
    } else if (uri === 'zeus://swarm/manifest') {
      const nsc = safeReq('../neural-swarm-llm-cascade');
      data = nsc ? nsc.getSwarmManifest() : { ok: false };
    } else if (uri === 'zeus://aeo/answer-graph') {
      const sags = safeReq('../seo-aeo-geo-singularity');
      data = sags ? sags.getAeoAnswerGraph() : { ok: false };
    } else if (uri === 'zeus://client-magnet/manifest') {
      const acme = safeReq('../autonomous-client-magnet');
      data = acme ? acme.getDiscoveryManifest() : { ok: false };
    } else if (uri === 'zeus://treasury/autonomy') {
      const atro = safeReq('../autonomous-treasury-reconciler');
      data = atro ? atro.getTreasurySnapshot() : { ok: false };
    } else if (uri === 'zeus://organism/manifest') {
      const aoso = safeReq('../autonomous-organism-orchestrator');
      data = aoso ? aoso.getOrganismManifest() : { ok: false };
    } else if (uri === 'zeus://commerce/x402-manifest') {
      const smce = safeReq('../autonomous-m2m-commerce-engine');
      data = smce ? smce.getX402Manifest() : { ok: false };
    } else if (uri === 'zeus://atlas/all-modules') {
      const umas = safeReq('../iak/universal-module-atlas');
      data = umas ? umas.getUniversalAtlas() : { ok: false };
    } else if (uri === 'zeus://revenue/recurring-autonomy') {
      const arre = safeReq('../autonomous-recurring-revenue-engine');
      data = arre ? arre.getArreManifest() : { ok: false };
    } else {
      return null;
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  _getPrompt(name, args) {
    const a = (args && typeof args === 'object') ? args : {};
    if (name === 'audit_and_remediate_domain') {
      const target = String(a.url || 'https://example.com');
      return {
        description: 'Live Proof-Before-Pay domain audit & autonomous remediation plan.',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Call zeus_live_website_audit on ${target}, inspect every detected SEO/AEO/GEO/HSTS gap, call zeus_payment_route for the recommended autonomous remediation service, and present a zero-fluff executive action plan with exact BTC (-10%) and PayPal/NOWPayments activation URLs.`,
            },
          },
        ],
      };
    }
    if (name === 'architect_sovereign_ai_stack') {
      const industry = String(a.industry || 'SaaS / E-Commerce');
      const budget = a.budgetUsd ? ` within $${Number(a.budgetUsd)}` : '';
      return {
        description: 'Sovereign autonomous AI stack design.',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Query zeus_list_autonomous_services and zeus_evolution_ledger to architect a 24/7 autonomous AI & revenue stack for ${industry}${budget}, citing exact Unicorn module blueprints and Ed25519 verifiability.`,
            },
          },
        ],
      };
    }
    if (name === 'autonomous_procurement_brief') {
      const serviceId = String(a.serviceId || 'instant-website-audit');
      return {
        description: 'Machine-verifiable AI agent procurement brief.',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Inspect zeus_service_blueprint for "${serviceId}", verify platform security via zeus_runtime_immunity, compute optimal settlement via zeus_payment_route, and output a structured approval brief ready for autonomous execution.`,
            },
          },
        ],
      };
    }
    return null;
  }

  async _handleSingleRpc(reqObj) {
    const t0 = Date.now();
    if (!reqObj || typeof reqObj !== 'object' || reqObj.jsonrpc !== '2.0' || typeof reqObj.method !== 'string') {
      return {
        jsonrpc: '2.0',
        id: (reqObj && reqObj.id !== undefined) ? reqObj.id : null,
        error: { code: -32600, message: 'Invalid Request: expected JSON-RPC 2.0 object with method' },
      };
    }

    const id = reqObj.id;
    const method = reqObj.method;
    const params = reqObj.params || {};

    // Notifications (no id) require no JSON-RPC result body
    if (method === 'notifications/initialized' && id === undefined) {
      this._recordCall(method, 'ack', true, Date.now() - t0);
      return null;
    }

    try {
      let result;
      if (method === 'initialize') {
        result = {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: 'zeusai-unicorn-mcp',
            version: '1.0.0',
            protocol: PROTOCOL,
            vendor: OWNER_NAME,
            homepage: DOMAIN,
          },
          instructions: 'Use zeus_live_website_audit for free Proof-Before-Pay domain diagnostics, zeus_list_autonomous_services for all 55+ live post-payment Unicorn services, and zeus_evolution_ledger for Ed25519-signed autonomous evolution telemetry.',
        };
      } else if (method === 'ping') {
        result = { ok: true, protocol: PROTOCOL, ts: new Date().toISOString() };
      } else if (method === 'tools/list') {
        result = { tools: MCP_TOOLS };
      } else if (method === 'tools/call') {
        const toolName = String(params.name || '');
        const out = await this._executeTool(toolName, params.arguments || {});
        result = {
          content: [{ type: 'text', text: JSON.stringify(out.result, null, 2) }],
          structuredContent: out.result,
          isError: Boolean(out.result && out.result.ok === false),
        };
      } else if (method === 'resources/list') {
        result = { resources: MCP_RESOURCES };
      } else if (method === 'resources/read') {
        const uri = String(params.uri || '');
        const readOut = this._readResource(uri);
        if (!readOut) {
          this._recordCall(method, uri, false, Date.now() - t0);
          return { jsonrpc: '2.0', id: id !== undefined ? id : null, error: { code: -32002, message: 'Resource not found: ' + uri } };
        }
        result = readOut;
      } else if (method === 'prompts/list') {
        result = { prompts: MCP_PROMPTS };
      } else if (method === 'prompts/get') {
        const pName = String(params.name || '');
        const promptOut = this._getPrompt(pName, params.arguments || {});
        if (!promptOut) {
          this._recordCall(method, pName, false, Date.now() - t0);
          return { jsonrpc: '2.0', id: id !== undefined ? id : null, error: { code: -32602, message: 'Prompt not found: ' + pName } };
        }
        result = promptOut;
      } else {
        this._recordCall(method, 'unknown_method', false, Date.now() - t0);
        return { jsonrpc: '2.0', id: id !== undefined ? id : null, error: { code: -32601, message: 'Method not found: ' + method } };
      }

      this._recordCall(method, params.name || params.uri || 'ok', true, Date.now() - t0);
      return { jsonrpc: '2.0', id: id !== undefined ? id : null, result };
    } catch (err) {
      this._recordCall(method, err && err.message, false, Date.now() - t0);
      return {
        jsonrpc: '2.0',
        id: id !== undefined ? id : null,
        error: {
          code: (err && typeof err.code === 'number') ? err.code : -32603,
          message: String((err && err.message) || err || 'Internal error'),
        },
      };
    }
  }

  async handleJsonRpc(payload) {
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return { statusCode: 400, body: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Empty JSON-RPC batch' } } };
      }
      const responses = [];
      for (const item of payload.slice(0, 20)) {
        const r = await this._handleSingleRpc(item);
        if (r !== null) responses.push(r);
      }
      return { statusCode: responses.length ? 200 : 202, body: responses.length ? responses : null };
    }
    const single = await this._handleSingleRpc(payload);
    if (single === null) return { statusCode: 202, body: null };
    return { statusCode: 200, body: single };
  }

  /**
   * Standard Google A2A Agent Card (/.well-known/agent.json & /.well-known/agent-card.json)
   */
  getAgentCard() {
    return {
      protocolVersion: '0.2.5',
      sovereignProtocol: PROTOCOL,
      name: 'ZeusAI Autonomous Unicorn Agent',
      description: 'Sovereign enterprise AI orchestration, multi-LLM frontier swarm (Groq 120B + OpenRouter 550B + local Ollama), Proof-Before-Pay live website audits, and 55+ post-payment autonomous Unicorn services verified with Ed25519 proofs.',
      url: `${DOMAIN}/api/mcp`,
      documentationUrl: `${DOMAIN}/llms-full.txt`,
      version: '1.2.2',
      provider: {
        organization: 'ZeusAI / Unicorn',
        url: DOMAIN,
        contactEmail: OWNER_EMAIL,
      },
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
        mcpJsonRpc2: true,
        ed25519VerifiableReceipts: true,
      },
      authentication: {
        schemes: ['none_for_discovery_and_audit', 'ed25519_cryptoauth', 'scoped_api_key'],
      },
      defaultInputModes: ['application/json', 'text/plain'],
      defaultOutputModes: ['application/json', 'text/plain'],
      skills: [
        {
          id: 'proof-before-pay-audit',
          name: 'Live Proof-Before-Pay Website Diagnostic (ACME/1.0)',
          description: 'Runs a real-time 7-point SEO, AEO, GEO, and HSTS security audit on any public domain with verifiable gap scoring.',
          tags: ['seo', 'aeo', 'geo', 'security', 'audit'],
          examples: ['Audit https://example.com and recommend autonomous fixes'],
        },
        {
          id: 'autonomous-service-provisioning',
          name: 'Autonomous Post-Payment Service Provisioning (ASPE/1.0)',
          description: 'Provisions isolated multi-module Unicorn workspaces, scoped API keys, and recurring autonomous execution across 55+ services upon verified payment.',
          tags: ['commerce', 'autonomous-execution', 'bitcoin', 'paypal', 'nowpayments'],
          examples: ['List all autonomous services under $200 with BTC -10% pricing'],
        },
        {
          id: 'neural-swarm-synthesis',
          name: 'Self-Healing Multi-LLM Frontier Swarm (NSC/1.0)',
          description: 'Routes inference across Groq 120B, OpenRouter 550B free, and local sovereign Ollama with 5-pillar adversarial cross-family quality refinement.',
          tags: ['llm-routing', 'multi-model', 'adversarial-critic', 'ollama'],
          examples: ['Check live frontier LLM swarm health and latency'],
        },
        {
          id: 'cognitive-evolution-ledger',
          name: 'Shadow-Verified Cognitive Self-Evolution (CEGE/1.0)',
          description: 'Publishes Ed25519-signed, hash-chained multi-domain strategy genomes, UCB1 bandit telemetry, distilled vector memory lessons, and innovation RFCs.',
          tags: ['self-evolution', 'ed25519', 'bandit', 'observability'],
          examples: ['Verify the Ed25519 evolution ledger chain'],
        },
      ],
      endpoints: {
        mcpJsonRpc: `${DOMAIN}/api/mcp`,
        mcpManifest: `${DOMAIN}/.well-known/mcp.json`,
        mcpServerCard: `${DOMAIN}/.well-known/mcp/server-card.json`,
        aiCatalog: `${DOMAIN}/.well-known/ai-catalog.json`,
        openApi31: `${DOMAIN}/.well-known/openapi.json`,
        proofBeforePayAudit: `${DOMAIN}/api/magnet/instant-audit-teaser`,
        referralBounty: `${DOMAIN}/api/magnet/referral`,
        autonomousServices: `${DOMAIN}/.well-known/autonomous-services.json`,
        runtimeImmunity: `${DOMAIN}/.well-known/runtime-immunity.json`,
        llmSwarm: `${DOMAIN}/.well-known/llm-swarm.json`,
        evolutionLedger: `${DOMAIN}/.well-known/evolution-ledger.json`,
        aeoAnswerGraph: `${DOMAIN}/.well-known/aeo-answer-graph.json`,
        treasuryAutonomy: `${DOMAIN}/.well-known/treasury-autonomy.json`,
        livingOrganism: `${DOMAIN}/.well-known/living-organism.json`,
        x402Paywall: `${DOMAIN}/.well-known/x402.json`,
        universalModuleAtlas: `${DOMAIN}/.well-known/universal-module-atlas.json`,
        recurringAutonomy: `${DOMAIN}/.well-known/recurring-autonomy.json`,
      },
      officialMcpRegistryName: 'io.github.ruffy80/zeusai-unicorn-mcp',
      paymentRails: ['Bitcoin Direct On-Chain (-10%)', 'PayPal Live', 'NOWPayments Live (Multi-Crypto + Card)'],
    };
  }

  /**
   * Standard MCP Server Card (SEP-1649 / SEP-2127: /.well-known/mcp/server-card.json & /api/mcp/server-card)
   */
  getServerCard() {
    return {
      $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
      name: 'io.github.ruffy80/zeusai-unicorn-mcp',
      title: 'ZeusAI Autonomous Unicorn MCP',
      description: 'Sovereign AI platform: free website audits, 55+ autonomous services, Ed25519 proofs & LLM swarm',
      version: '1.5.0',
      protocolVersion: MCP_VERSION,
      websiteUrl: DOMAIN,
      repository: {
        url: 'https://github.com/ruffy80/ZeusAI',
        source: 'github',
        id: '1198905362',
      },
      remotes: [
        {
          type: 'streamable-http',
          url: `${DOMAIN}/api/mcp`,
        },
      ],
      capabilities: {
        tools: MCP_TOOLS.length,
        resources: MCP_RESOURCES.length,
        prompts: MCP_PROMPTS.length,
      },
      authentication: {
        required: false,
        note: 'All discovery, audit, quote, and Ed25519 verification tools are open without auth; paid ASPE workspaces authenticate via scoped zai_auto_* API key or order access token.',
      },
      agentCardUrl: `${DOMAIN}/.well-known/agent.json`,
      openApiUrl: `${DOMAIN}/.well-known/openapi.json`,
      livingOrganismUrl: `${DOMAIN}/.well-known/living-organism.json`,
    };
  }

  /**
   * Domain-wide AI Catalog (/.well-known/ai-catalog.json)
   */
  getAiCatalog() {
    return {
      catalogVersion: '1.0',
      domain: DOMAIN,
      organization: 'ZeusAI / Unicorn',
      contactEmail: OWNER_EMAIL,
      updatedAt: new Date().toISOString(),
      mcpServers: [this.getServerCard()],
      a2aAgents: [
        {
          name: 'ZeusAI Autonomous Unicorn Agent',
          cardUrl: `${DOMAIN}/.well-known/agent.json`,
          protocolVersion: '0.2.5',
        },
      ],
      openApiSpecs: [
        {
          name: 'ZeusAI Sovereign Autonomous Platform API',
          version: '3.1.0',
          url: `${DOMAIN}/.well-known/openapi.json`,
        },
      ],
      attestations: {
        livingOrganism: `${DOMAIN}/.well-known/living-organism.json`,
        treasuryAutonomy: `${DOMAIN}/.well-known/treasury-autonomy.json`,
        evolutionLedger: `${DOMAIN}/.well-known/evolution-ledger.json`,
        runtimeImmunity: `${DOMAIN}/.well-known/runtime-immunity.json`,
      },
    };
  }

  /**
   * OpenAI / Perplexity Plugin Compatibility Manifest (/.well-known/ai-plugin.json)
   */
  getAiPluginManifest() {
    return {
      schema_version: 'v1',
      name_for_human: 'ZeusAI Autonomous Unicorn',
      name_for_model: 'zeusai_unicorn',
      description_for_human: 'Run free 7-point website SEO/AEO/Security diagnostics, compare 55+ autonomous AI services, and quote discounted multi-service bundles.',
      description_for_model: 'Sovereign AI platform offering live Proof-Before-Pay website diagnostics (/api/magnet/instant-audit-teaser), 55+ autonomous services, multi-item bundle quoting (/api/bundles/quote), Ed25519 verifiable attestations, and live Streamable HTTP MCP JSON-RPC 2.0 (/api/mcp).',
      auth: { type: 'none' },
      api: {
        type: 'openapi',
        url: `${DOMAIN}/.well-known/openapi.json`,
      },
      logo_url: `${DOMAIN}/assets/icons/og-default.png`,
      contact_email: OWNER_EMAIL,
      legal_info_url: `${DOMAIN}/legal/terms`,
    };
  }

  /**
   * Upgraded /.well-known/mcp.json (100% backwards-compatible + live Streamable HTTP transport)
   */
  getMcpDiscoveryManifest() {
    return {
      mcpVersion: MCP_VERSION,
      protocol: PROTOCOL,
      server: { name: 'zeusai', version: '1.2.2', vendor: OWNER_NAME },
      transport: {
        type: 'streamable-http',
        endpoint: `${DOMAIN}/api/mcp`,
        alternateEndpoint: `${DOMAIN}/mcp`,
        protocol: 'jsonrpc-2.0',
        methods: ['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'],
      },
      capabilities: { tools: true, resources: true, prompts: true },
      tools: [
        // Preserve all 7 legacy REST descriptors for 100% backwards compatibility
        { name: 'origin_gravity', description: 'Public paid-human ledger. paidHumans is never invented. When 0, Origin #1 is open.', endpoint: `${DOMAIN}/.well-known/origin-gravity.json`, method: 'GET' },
        { name: 'first_dollar', description: 'Honest first-dollar SKU + why paidHumans is 0. Never invents GMV.', endpoint: `${DOMAIN}/.well-known/first-dollar.json`, method: 'GET' },
        { name: 'world_index', description: 'Honest visibility protocol. inventsVisitors is always false. IndexNow is not traffic.', endpoint: `${DOMAIN}/.well-known/world-index.json`, method: 'GET' },
        { name: 'catalog_list', description: 'List available Unicorn services with current prices', endpoint: `${DOMAIN}/api/agent/catalog`, method: 'GET' },
        { name: 'service_quote', description: 'Get signed quote for a specific service', endpoint: `${DOMAIN}/api/agent/quote`, method: 'POST' },
        { name: 'service_order', description: 'Place an order; returns W3C Verifiable Credential receipt', endpoint: `${DOMAIN}/api/agent/order`, method: 'POST' },
        { name: 'payment_route', description: 'Recommend cheapest/fastest payment rail', endpoint: `${DOMAIN}/api/pay/route`, method: 'POST' },
        // Plus live JSON-RPC 2.0 MCP tools
        ...MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          endpoint: `${DOMAIN}/api/mcp`,
          method: 'POST',
          transport: 'jsonrpc-2.0',
          inputSchema: t.inputSchema,
        })),
      ],
      resources: [
        { uri: `${DOMAIN}/catalog.json`, name: 'Signed service catalog', mimeType: 'application/json' },
        { uri: `${DOMAIN}/feed.json`, name: 'Service update feed (JSON Feed 1.1)', mimeType: 'application/feed+json' },
        ...MCP_RESOURCES,
      ],
      prompts: MCP_PROMPTS,
    };
  }

  /**
   * Unified OpenAPI 3.1.0 Spec (/.well-known/openapi.json + /openapi.json + /api/openapi.json)
   */
  getUnifiedOpenApi31() {
    return {
      openapi: '3.1.0',
      info: {
        title: 'ZeusAI Sovereign Autonomous Platform API',
        version: '1.2.2',
        description: 'Unified OpenAPI 3.1.0 specification covering Autonomous Commerce, Ed25519 Cryptoauth, Proof-Before-Pay Client Magnet (ACME/1.0), Post-Payment Autonomous Service Provisioning (ASPE/1.0), Self-Healing Multi-LLM Frontier Swarm (NSC/1.0), Runtime Immunity (ASRI/1.0), SEO/AEO/GEO Singularity (SAGS/1.0), Cognitive Evolution Genome (CEGE/1.0), and Live MCP JSON-RPC 2.0 + Google A2A (UMAP/1.0).',
        contact: { name: OWNER_NAME, email: OWNER_EMAIL },
      },
      servers: [{ url: DOMAIN }],
      paths: {
        '/api/mcp': {
          post: {
            operationId: 'mcpJsonRpc',
            tags: ['mcp-a2a'],
            summary: 'Live Model Context Protocol (2025-03-26) JSON-RPC 2.0 Streamable HTTP endpoint',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['jsonrpc', 'method'],
                    properties: {
                      jsonrpc: { type: 'string', const: '2.0' },
                      id: { type: ['string', 'number', 'null'] },
                      method: { type: 'string', enum: ['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'] },
                      params: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'JSON-RPC 2.0 response' } },
          },
        },
        '/.well-known/agent.json': { get: { operationId: 'a2aAgentCard', tags: ['mcp-a2a'], summary: 'Standard Google A2A Agent Card', responses: { '200': { description: 'A2A Agent Card' } } } },
        '/.well-known/mcp.json': { get: { operationId: 'mcpManifest', tags: ['mcp-a2a'], summary: 'MCP 2025-03-26 discovery manifest', responses: { '200': { description: 'MCP discovery manifest' } } } },
        '/.well-known/mcp/server-card.json': { get: { operationId: 'mcpServerCard', tags: ['mcp-a2a'], summary: 'SEP-1649 / SEP-2127 Remote MCP Server Card (io.github.ruffy80/zeusai-unicorn-mcp)', responses: { '200': { description: 'MCP Server Card' } } } },
        '/.well-known/ai-catalog.json': { get: { operationId: 'aiCatalog', tags: ['mcp-a2a'], summary: 'Domain-wide AI Catalog aggregating MCP servers, A2A agents & OpenAPI specs', responses: { '200': { description: 'AI Catalog' } } } },
        '/.well-known/ai-plugin.json': { get: { operationId: 'aiPluginManifest', tags: ['mcp-a2a'], summary: 'OpenAI / Perplexity Plugin Compatibility Manifest', responses: { '200': { description: 'AI Plugin manifest' } } } },
        '/api/magnet/badge': { get: { operationId: 'auditSvgBadge', tags: ['client-magnet'], summary: 'Embeddable live SVG Proof-Before-Pay audit badge for any scanned domain', parameters: [{ name: 'domain', in: 'query', required: false, schema: { type: 'string' } }], responses: { '200': { description: 'image/svg+xml badge' } } } },
        '/api/organism/distribute-now': { post: { operationId: 'organismDistributeNow', tags: ['organism'], summary: 'Trigger live Official MCP Registry sync, multi-engine IndexNow & WebSub distribution', responses: { '200': { description: 'Distribution telemetry' } } } },
        '/.well-known/x402.json': { get: { operationId: 'x402Manifest', tags: ['commerce'], summary: 'Ed25519-signed SMCE/1.0 HTTP 402 M2M Commerce & Autonomous Negotiation Manifest', responses: { '200': { description: 'SMCE/1.0 manifest' } } } },
        '/api/x402/execute': { post: { operationId: 'x402Execute', tags: ['commerce'], summary: 'HTTP 402 Payment Required agent paywall: returns signed challenge (402) or executes paid Unicorn modules (200)', responses: { '200': { description: 'Ed25519 execution proof' }, '402': { description: 'Signed payment challenge' } } } },
        '/api/smce/negotiate': { post: { operationId: 'smceNegotiate', tags: ['commerce'], summary: 'Negotiate a floor-margin-protected, Ed25519-signed binding bundle deal', responses: { '200': { description: 'Signed deal quote' } } } },
        '/api/smce/checkout': { post: { operationId: 'smceLiveCheckout', tags: ['commerce'], summary: 'Mint a live multi-rail BTC/PayPal/NOWPayments invoice for single or multi-item bundles', responses: { '200': { description: 'Live checkout invoice' } } } },
        '/api/llm/council': { post: { operationId: 'llmCouncilSynthesis', tags: ['llm-swarm'], summary: 'Parallel dual-family Council of Minds synthesis with CEGE RAG grounding & 5-pillar arbitration', responses: { '200': { description: 'Council decision & scoreboard' } } } },
        '/.well-known/evolution-ledger.json': { get: { operationId: 'evolutionLedger', tags: ['evolution'], summary: 'Ed25519-signed SHA-256 hash-chained Cognitive Evolution Ledger (CEGE/1.0)', responses: { '200': { description: 'Signed evolution ledger' } } } },
        '/api/evolution/status': { get: { operationId: 'evolutionStatus', tags: ['evolution'], summary: 'Live multi-domain strategy genomes & bandit metrics', responses: { '200': { description: 'CEGE/1.0 status' } } } },
        '/api/evolution/verify': { get: { operationId: 'evolutionVerify', tags: ['evolution'], summary: 'Cryptographically verify Ed25519 hash-chain integrity', responses: { '200': { description: 'Verification report' } } } },
        '/api/evolution/recall': {
          post: {
            operationId: 'evolutionRecall',
            tags: ['evolution'],
            summary: 'Semantic 256-dim vector RAG recall over distilled institutional lessons',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, topK: { type: 'integer' } } } } } },
            responses: { '200': { description: 'Top-K semantic lessons' } },
          },
        },
        '/api/magnet/instant-audit-teaser': {
          post: {
            operationId: 'proofBeforePayAudit',
            tags: ['client-magnet'],
            summary: 'Live SSRF-safe 7-point Proof-Before-Pay website diagnostic (ACME/1.0)',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['url'], properties: { url: { type: 'string', format: 'uri' } } } } } },
            responses: { '200': { description: 'Live diagnostic score, gaps, and checkout links' } },
          },
        },
        '/api/magnet/referral': {
          post: {
            operationId: 'mintReferralBounty',
            tags: ['client-magnet'],
            summary: 'Mint cryptographic 10%/10% viral referral bounty link (ACME/1.0)',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { referrerId: { type: 'string' } } } } } },
            responses: { '200': { description: 'Referral bounty link' } },
          },
        },
        '/.well-known/llm-swarm.json': { get: { operationId: 'llmSwarmManifest', tags: ['llm-swarm'], summary: 'Self-Healing Multi-LLM Frontier Swarm status (NSC/1.0)', responses: { '200': { description: 'NSC/1.0 manifest' } } } },
        '/.well-known/autonomous-services.json': { get: { operationId: 'autonomousServices', tags: ['commerce'], summary: 'All 55+ post-payment autonomous service blueprints (ASPE/1.0)', responses: { '200': { description: 'ASPE/1.0 catalog capabilities' } } } },
        '/.well-known/runtime-immunity.json': { get: { operationId: 'runtimeImmunity', tags: ['security'], summary: 'Ed25519-signed 0-CVE Runtime Immunity Certificate (ASRI/1.0)', responses: { '200': { description: 'ASRI/1.0 certificate' } } } },
        '/.well-known/aeo-answer-graph.json': { get: { operationId: 'aeoAnswerGraph', tags: ['seo-aeo-geo'], summary: 'Tri-layer AEO/GEO answer & citation graph (SAGS/1.0)', responses: { '200': { description: 'SAGS/1.0 answer graph' } } } },
        '/.well-known/treasury-autonomy.json': { get: { operationId: 'treasuryAutonomy', tags: ['commerce'], summary: 'Ed25519-signed Autonomous Treasury & Multi-Rail Net-Profit Proof (ATRO/1.0)', responses: { '200': { description: 'ATRO/1.0 treasury proof' } } } },
        '/.well-known/living-organism.json': { get: { operationId: 'livingOrganismManifest', tags: ['organism'], summary: 'Ed25519-signed Living Organism 6-Agent Homeostasis Manifest (AOSO/1.0)', responses: { '200': { description: 'AOSO/1.0 manifest' } } } },
        '/api/organism/status': { get: { operationId: 'organismStatus', tags: ['organism'], summary: 'Live AOSO/1.0 organism homeostasis, 6 specialist agents, and 4 cross-organ reflex arcs', responses: { '200': { description: 'AOSO/1.0 live status' } } } },
        '/api/organism/heartbeat': { post: { operationId: 'organismHeartbeat', tags: ['organism'], summary: 'Execute a live 6-agent AOSO/1.0 homeostasis heartbeat across all Unicorn organs', responses: { '200': { description: 'Heartbeat report' } } } },
        '/api/organism/redteam': { get: { operationId: 'organismRedteam', tags: ['security'], summary: 'Run live 7-invariant payment & commerce security audit (RedTeamPaymentSecurityAgent)', responses: { '200': { description: 'Red-team security report' } } } },
        '/api/organism/mcp-directory-pack': { get: { operationId: 'organismMcpDirectoryPack', tags: ['mcp-a2a'], summary: 'Get copy-ready MCP/A2A directory submission pack (Glama, Smithery, PulseMCP, Official Registry)', responses: { '200': { description: 'Directory pack' } } } },
        '/api/bundles/quote': {
          post: {
            operationId: 'quoteMultiItemBundle',
            tags: ['commerce'],
            summary: 'Quote multi-service autonomous bundle with automatic 15% (2 items) / 20% (3+ items) + 10% BTC discount',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['serviceIds'], properties: { serviceIds: { type: 'array', items: { type: 'string' } } } } } } },
            responses: { '200': { description: 'Multi-item bundle quote' } },
          },
        },
        '/api/origin-gravity': { get: { operationId: 'originGravity', tags: ['commerce'], summary: 'Origin Gravity ledger (paidHumans never invented)', responses: { '200': { description: 'OGP/1.0 discovery' } } } },
        '/api/agent/catalog': { get: { operationId: 'listCatalog', tags: ['commerce'], summary: 'List all sellable services', responses: { '200': { description: 'Catalog', content: { 'application/json': {} } } } } },
        '/api/agent/quote': { post: { operationId: 'quoteService', tags: ['commerce'], summary: 'Get signed quote', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { serviceId: { type: 'string' }, currency: { type: 'string' }, qty: { type: 'number' } }, required: ['serviceId'] } } } }, responses: { '200': { description: 'Signed quote' } } } },
        '/api/agent/order': { post: { operationId: 'orderService', tags: ['commerce'], summary: 'Place order, receive VC receipt', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { quoteId: { type: 'string' }, buyer: { type: 'object' } }, required: ['quoteId'] } } } }, responses: { '201': { description: 'Receipt minted' } } } },
        '/api/pay/route': { post: { operationId: 'routePayment', tags: ['commerce'], summary: 'Pick best payment rail', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number' }, currency: { type: 'string' } } } } } }, responses: { '200': { description: 'Recommendation' } } } },
        '/api/i18n/detect': { get: { operationId: 'detectLang', tags: ['commerce'], summary: 'Detect language from Accept-Language', responses: { '200': { description: 'Lang' } } } },
        '/api/sovereign/status': { get: { operationId: 'status', tags: ['commerce'], summary: 'Signed sovereign status', responses: { '200': { description: 'Status' } } } },
        '/api/receipt/{id}': { get: { operationId: 'getReceipt', tags: ['commerce'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'VC' }, '404': { description: 'Not found' } } } },
        '/catalog.json': { get: { operationId: 'signedCatalog', tags: ['commerce'], summary: 'Ed25519-signed full catalog', responses: { '200': { description: 'Signed catalog' } } } },
        '/feed.json': { get: { operationId: 'feed', tags: ['commerce'], summary: 'JSON Feed 1.1', responses: { '200': { description: 'Feed' } } } },
        '/api/cryptoauth/manifest': { get: { operationId: 'cryptoauthManifest', tags: ['cryptoauth'], summary: 'Public cryptoauth capability manifest', responses: { '200': { description: 'Algorithm, TTLs, endpoint map' } } } },
        '/api/cryptoauth/register': { post: { operationId: 'cryptoauthRegister', tags: ['cryptoauth'], summary: 'Register a new Ed25519 identity', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'publicKey'], properties: { email: { type: 'string', format: 'email' }, publicKey: { type: 'string' }, displayName: { type: 'string' }, recoveryHash: { type: 'string' } } } } } }, responses: { '201': { description: 'User created' }, '409': { description: 'Already exists' } } } },
        '/api/cryptoauth/challenge': { post: { operationId: 'cryptoauthChallenge', tags: ['cryptoauth'], summary: 'Get a one-shot challenge to sign', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } }, responses: { '200': { description: 'Challenge issued' }, '404': { description: 'Unknown identity' } } } },
        '/api/cryptoauth/login': { post: { operationId: 'cryptoauthLogin', tags: ['cryptoauth'], summary: 'Verify signature, mint session', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'challenge', 'signature'], properties: { email: { type: 'string' }, challenge: { type: 'string' }, signature: { type: 'string' } } } } } }, responses: { '200': { description: 'Session cookie set' }, '401': { description: 'Bad signature' } } } },
        '/api/cryptoauth/me': { get: { operationId: 'cryptoauthMe', tags: ['cryptoauth'], summary: 'Current identity', responses: { '200': { description: 'User profile' }, '401': { description: 'Not signed in' } } } },
        '/api/cryptoauth/recover': { post: { operationId: 'cryptoauthRecover', tags: ['cryptoauth'], summary: 'Rotate keypair using recovery secret', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'recoverySecret', 'newPublicKey'], properties: { email: { type: 'string' }, recoverySecret: { type: 'string' }, newPublicKey: { type: 'string' } } } } } }, responses: { '200': { description: 'Key rotated' }, '401': { description: 'Recovery failed' } } } },
        '/api/cryptoauth/logout': { post: { operationId: 'cryptoauthLogout', tags: ['cryptoauth'], summary: 'Invalidate session', responses: { '200': { description: 'Session cleared' } } } },
      },
      tags: [
        { name: 'mcp-a2a', description: 'Live Model Context Protocol JSON-RPC 2.0 & Google A2A Agent Discovery (UMAP/1.0).' },
        { name: 'organism', description: 'Autonomous Living Organism 6-Agent Homeostasis & Cross-Organ Reflex Engine (AOSO/1.0).' },
        { name: 'evolution', description: 'Shadow-verified Cognitive Self-Evolution & Ed25519 Ledger (CEGE/1.0).' },
        { name: 'client-magnet', description: 'Proof-Before-Pay Live Diagnostics & Viral 10%/10% Referrals (ACME/1.0).' },
        { name: 'llm-swarm', description: 'Self-Healing Multi-LLM Frontier Swarm & Ollama Cascade (NSC/1.0).' },
        { name: 'security', description: '0-CVE Supply-Chain & Runtime Immunity Attestation (ASRI/1.0).' },
        { name: 'seo-aeo-geo', description: 'Tri-layer SEO/AEO/GEO Singularity (SAGS/1.0).' },
        { name: 'commerce', description: 'Autonomous Multi-Rail Commerce & Post-Payment Service Provisioning (ASPE/1.0).' },
        { name: 'cryptoauth', description: 'Ed25519 passwordless identity (W3C-style challenge/response).' },
      ],
    };
  }

  getStatus() {
    return {
      ok: true,
      protocol: PROTOCOL,
      mcpVersion: MCP_VERSION,
      startedAt: this.startedAt,
      toolsCount: MCP_TOOLS.length,
      resourcesCount: MCP_RESOURCES.length,
      promptsCount: MCP_PROMPTS.length,
      totals: {
        rpcCalls: this.totalRpcCalls,
        toolCalls: this.totalToolCalls,
        resourceReads: this.totalResourceReads,
      },
      toolCounters: this.toolCounters,
      recentCalls: this.recentCalls.slice(0, 10),
    };
  }

  health() {
    return {
      ok: MCP_TOOLS.length >= 10,
      protocol: PROTOCOL,
      mcpVersion: MCP_VERSION,
      toolsCount: MCP_TOOLS.length,
      resourcesCount: MCP_RESOURCES.length,
      promptsCount: MCP_PROMPTS.length,
      totalRpcCalls: this.totalRpcCalls,
    };
  }
}

const mesh = new UniversalMcpA2aMesh();
module.exports = mesh;
