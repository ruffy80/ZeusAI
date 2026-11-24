'use strict';

/**
 * @zeusai/sdk — Official Zero-Dependency Client for ZeusAI Unicorn (https://zeusai.pro)
 * Works in Node.js 18+ and modern browsers via native fetch().
 */
class ZeusAI {
  constructor(opts = {}) {
    this.baseUrl = String(opts.baseUrl || 'https://zeusai.pro').replace(/\/+$/, '');
    this.apiKey = opts.apiKey ? String(opts.apiKey) : null;
    this.ref = opts.ref ? String(opts.ref) : null;
    this.timeoutMs = Number(opts.timeoutMs || 20000);
  }

  async _request(path, { method = 'GET', body = null, headers = {} } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const reqHeaders = Object.assign(
      { 'Accept': 'application/json', 'User-Agent': '@zeusai/sdk/1.0.0' },
      headers
    );
    if (this.apiKey && !reqHeaders.Authorization) {
      reqHeaders.Authorization = 'Bearer ' + this.apiKey;
    }
    if (body !== null) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    try {
      const res = await fetch(this.baseUrl + path, {
        method,
        headers: reqHeaders,
        body: body !== null ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }
      return {
        status: res.status,
        ok: res.ok,
        headers: {
          paymentRequired: res.headers.get('x-payment-required'),
          paymentProtocol: res.headers.get('x-payment-protocol'),
        },
        data: json,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Run free 7-point Proof-Before-Pay live website SEO/AEO/GEO/HSTS diagnostic */
  async auditWebsite(url) {
    const r = await this._request('/api/magnet/instant-audit-teaser', {
      method: 'POST',
      body: { url },
    });
    return r.data;
  }

  /** Match any human persona or any of the 18 world industries to a tailored bundle */
  async findSolution(opts = {}) {
    const r = await this._request('/api/arre/recommend', {
      method: 'POST',
      body: Object.assign({ ref: this.ref || undefined }, opts),
    });
    return r.data;
  }

  /** Negotiate an Ed25519-signed, floor-margin-protected multi-item bundle deal */
  async negotiateDeal(opts = {}) {
    const r = await this._request('/api/smce/negotiate', {
      method: 'POST',
      body: Object.assign({ referralCode: this.ref || undefined }, opts),
    });
    return r.data;
  }

  /** Mint a live multi-rail BTC (-10%) / PayPal / NOWPayments checkout invoice */
  async createCheckout(opts = {}) {
    const r = await this._request('/api/smce/checkout', {
      method: 'POST',
      body: Object.assign({ ref: this.ref || undefined }, opts),
    });
    return r.data;
  }

  /** Execute a paid service (HTTP 200 + Ed25519 proof) or receive an HTTP 402 challenge */
  async executePaidService(opts = {}) {
    return this._request('/api/x402/execute', {
      method: 'POST',
      body: opts,
    });
  }

  /** Enroll an AI agent, developer, or creator into the 10%/10% A2A Affiliate Mesh */
  async enrollAffiliate(agentOrPartnerId, opts = {}) {
    const r = await this._request('/api/arre/affiliate/enroll', {
      method: 'POST',
      body: Object.assign({ agentOrPartnerId }, opts),
    });
    return r.data;
  }

  /** Register a domain for weekly Ed25519-signed Drift Watch */
  async registerDriftWatch(domain, opts = {}) {
    const r = await this._request('/api/arre/drift-watch/register', {
      method: 'POST',
      body: Object.assign({ domain }, opts),
    });
    return r.data;
  }

  /** Call any of the 21 live ZeusAI MCP 2025-03-26 JSON-RPC 2.0 tools */
  async mcpCall(toolName, args = {}) {
    const r = await this._request('/api/mcp', {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      },
    });
    return r.data;
  }

  /** Verify an Ed25519-signed ZeusAI quote or execution certificate */
  async verifySignature(artifact) {
    const r = await this._request('/api/smce/verify-signature', {
      method: 'POST',
      body: artifact,
    });
    return r.data;
  }

  /** Query the live 902+ Universal Module Atlas */
  async getModuleAtlas(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.q) qs.set('q', opts.q);
    if (opts.organ) qs.set('organ', opts.organ);
    if (opts.limit) qs.set('limit', String(opts.limit));
    const suffix = qs.toString() ? ('?' + qs.toString()) : '';
    const r = await this._request('/api/modules/atlas' + suffix);
    return r.data;
  }
}

module.exports = { ZeusAI, default: ZeusAI };
