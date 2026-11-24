# @zeusai/sdk

Official zero-dependency Node.js & Browser SDK for **[ZeusAI Unicorn](https://zeusai.pro)** — 21 Live MCP Tools, Proof-Before-Pay Website Audits, HTTP 402 M2M Commerce, Multi-LLM Council, Weekly Drift Watch & 18-Industry Autonomous Services.

## Quick Start

```js
const { ZeusAI } = require('@zeusai/sdk');

const zeus = new ZeusAI({ ref: 'zeus_your_partner_code' });

// 1. Run a free live 7-point Proof-Before-Pay website audit
const audit = await zeus.auditWebsite('https://example.com');
console.log(audit.liveScore, audit.detectedGaps);

// 2. Match any persona or industry to a discounted autonomous bundle
const match = await zeus.findSolution({ industry: 'fintech' });
console.log(match.bundleOffer.checkoutUrls.btc);

// 3. Call any of the 21 live MCP tools via JSON-RPC 2.0
const atlas = await zeus.mcpCall('zeus_unicorn_module_atlas', { organ: 'cro_conversion' });
```

## 1-Line Viral Embed Widget (WordPress · Shopify · Any Website)

```html
<script src="https://zeusai.pro/embed/zeus-audit.js" data-ref="zeus_your_partner_code"></script>
```
