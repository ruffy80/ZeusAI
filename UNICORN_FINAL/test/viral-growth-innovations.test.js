'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const apos = require('../backend/modules/aposAuditEngine');
const proxy = require('../backend/modules/sovereignOpenAiProxy');
const shell = require('../src/site/v2/shell');

test('⚡ APOS Audit Engine - generates verified proof-of-savings', async () => {
  const result = await apos.generateAuditReport({
    company: 'Test FinTech Corp',
    email: 'test@fintechcorp.com',
    workload: 'Customer Support & Voice Agents',
    monthlySpendUsd: 10000,
  });

  assert.strictEqual(result.ok, true);
  assert.ok(result.certificate, 'Certificate should exist');
  assert.ok(result.certificate.certId.startsWith('APOS-'), 'Cert ID should have APOS prefix');
  assert.ok(result.certificate.merkleRoot, 'Merkle root should be present');
  assert.strictEqual(typeof result.certificate.merkleRoot, 'string');
  assert.strictEqual(result.certificate.merkleRoot.length, 64, 'SHA-256 Merkle root should be 64 hex chars');

  assert.strictEqual(result.metrics.currentMonthlySpendUsd, 10000);
  assert.ok(result.metrics.monthlySavingsUsd > 8000, 'Savings should exceed $8,000');
  assert.ok(result.metrics.annualSavingsUsd > 90000, 'Annual savings should exceed $90,000');
  assert.ok(result.executiveSummary, 'Executive summary should be present');

  const status = apos.getStatus();
  assert.strictEqual(status.ok, true);
  assert.ok(status.state.auditsGenerated >= 1);
});

test('🔌 OpenAI-Compatible Sovereign Proxy Gateway - contracts', async () => {
  let mockStatus = 0;
  let mockHeaders = {};
  let mockJson = null;

  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k] = v; },
    status: (s) => { mockStatus = s; return mockRes; },
    json: (j) => { mockJson = j; return mockRes; },
  };

  proxy.handleListModels({}, mockRes);
  assert.strictEqual(mockJson.object, 'list');
  assert.ok(Array.isArray(mockJson.data));
  assert.ok(mockJson.data.some((m) => m.id === 'zeus-sovereign-mesh'));

  const mockReq = {
    body: {
      model: 'zeus-sovereign-mesh',
      messages: [{ role: 'user', content: 'What is the speed of light?' }],
    },
  };

  await proxy.handleChatCompletions(mockReq, mockRes);
  assert.strictEqual(mockJson.object, 'chat.completion');
  assert.ok(mockJson.id.startsWith('chatcmpl-zeus-'));
  assert.ok(Array.isArray(mockJson.choices));
  assert.ok(mockJson.choices[0].message.content.length > 0);
  assert.strictEqual(mockHeaders['x-zeus-gateway'], 'sovereign-hypermesh-1.0');
  assert.strictEqual(mockHeaders['x-zeus-savings-rate'], '94.4%');
});

test('🎨 Shell V2 & Homepage - includes Instant Audit Section', () => {
  const homeHtml = shell.getHtml('/');
  assert.ok(homeHtml.includes('id="instantAudit"'), 'Homepage must contain #instantAudit section');
  assert.ok(homeHtml.includes('id="auditForm"'), 'Homepage must contain #auditForm');
  assert.ok(homeHtml.includes('id="btnRunAudit"'), 'Homepage must contain #btnRunAudit');
  assert.ok(homeHtml.includes('Free Enterprise Proof-of-Savings'), 'Kicker should be present');
});

test('📜 Launchpack - contains global viral templates', () => {
  const packPath = path.join(__dirname, '..', 'LAUNCH_PACK.md');
  assert.ok(fs.existsSync(packPath), 'LAUNCH_PACK.md must exist');
  const content = fs.readFileSync(packPath, 'utf8');
  assert.ok(content.includes('Hacker News'), 'Must contain Hacker News guide');
  assert.ok(content.includes('Product Hunt'), 'Must contain Product Hunt guide');
  assert.ok(content.includes('r/SaaS'), 'Must contain Reddit r/SaaS guide');
  assert.ok(content.includes('Twitter / X Viral Launch Thread'), 'Must contain Twitter guide');
});
