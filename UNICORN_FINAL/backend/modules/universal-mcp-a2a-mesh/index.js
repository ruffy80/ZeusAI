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
        openApi31: `${DOMAIN}/.well-known/openapi.json`,
        proofBeforePayAudit: `${DOMAIN}/api/magnet/instant-audit-teaser`,
        referralBounty: `${DOMAIN}/api/magnet/referral`,
        autonomousServices: `${DOMAIN}/.well-known/autonomous-services.json`,
        runtimeImmunity: `${DOMAIN}/.well-known/runtime-immunity.json`,
        llmSwarm: `${DOMAIN}/.well-known/llm-swarm.json`,
        evolutionLedger: `${DOMAIN}/.well-known/evolution-ledger.json`,
        aeoAnswerGraph: `${DOMAIN}/.well-known/aeo-answer-graph.json`,
        treasuryAutonomy: `${DOMAIN}/.well-known/treasury-autonomy.json`,
      },
      paymentRails: ['Bitcoin Direct On-Chain (-10%)', 'PayPal Live', 'NOWPayments Live (Multi-Crypto + Card)'],
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
