'use strict';

process.env.DISABLE_SELF_MUTATION = '1';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const demo = require('../src/site/demo-router');
const shell = require('../src/site/v2/shell');

const sample = demo.optimizePrompt(demo.EXAMPLE_PROMPT);
assert.deepStrictEqual(sample, Object.assign({}, demo.SAMPLE));
assert.strictEqual(sample.analyzed, 'Prompt analyzed.');
assert.strictEqual(sample.routedTo, 'Groq (Llama 3 70B)');
assert.strictEqual(sample.latencyMs, 340);
assert.strictEqual(sample.costUsd, 0.0001);
assert.strictEqual(sample.gpt4CostUsd, 0.0035);
assert.strictEqual(sample.savingsPct, 97);
assert.strictEqual(sample.simulated, true);
assert.strictEqual(sample.stored, false);
assert.strictEqual(sample.providerCalled, false);

assert.deepStrictEqual(demo.optimizePrompt('   '), { ok: false, error: 'prompt_required' });
assert.strictEqual(demo.optimizePrompt('z'.repeat(4001)).error, 'prompt_too_long');

const mid = demo.optimizePrompt('x'.repeat(400));
assert.strictEqual(mid.ok, true);
assert.strictEqual(mid.routedTo, 'DeepSeek (V3)');
assert.ok(mid.savingsPct >= 1 && mid.savingsPct <= 99);
assert.ok(mid.gpt4CostUsd > mid.costUsd);

const long = demo.optimizePrompt('y'.repeat(1200));
assert.strictEqual(long.routedTo, 'Claude (Haiku)');
assert.strictEqual(long.providerCalled, false);

const home = shell.getHtml('/');
assert.match(home, /<title>ZeusAI \| Enterprise AI Cost Optimization & Orchestration<\/title>/);
assert.match(home, /Reduce your LLM API costs by 70% with our autonomous model router\. Enterprise-grade multi-agent orchestration and self-healing infrastructure\./);
assert.match(home, /<h1 id="dtHeroH1">Cut Your AI API Costs by 70% Automatically<\/h1>/);
assert.match(home, /Our autonomous Model Router dynamically selects the cheapest, fastest LLM \(Groq, DeepSeek, Claude\)/);
assert.match(home, /id="dtHeroCta"[^>]*>Get Enterprise Access</);
assert.match(home, />Book Demo</);
assert.match(home, /data-guest-label="Book Demo"/);
assert.match(home, /data-auth-label="My Account"/);
assert.doesNotMatch(home, />My Account</);
assert.doesNotMatch(home, />Sign up</);
assert.match(home, /<li>Secure<\/li>/);
assert.match(home, /<li>No Data Retention<\/li>/);
assert.match(home, />GDPR Compliant</);
assert.match(home, /id="costDemoLabel">Test the Router Live</);
assert.match(home, /placeholder="Enter a prompt \(e\.g\., 'Write a Python script to scrape a website'\)"/);
assert.match(home, /id="costDemoBtn"[^>]*>Calculate Savings</);
assert.match(home, /action="\/api\/demo\/optimize"/);
assert.match(home, /Powered by UNICORN Ecosystem/);
assert.match(home, /Autonomous Self-Healing/);
assert.match(home, /Never go down again\./);
assert.match(home, /href="\/solutions\/self-healing"/);
assert.match(home, /Multi-Agent Orchestration/);
assert.match(home, /Scale your AI operations\./);
assert.match(home, /Continuous R&amp;D/);
assert.match(home, /Let AI find new opportunities for you\./);
assert.match(home, /href="\/solutions\/continuous-rd"/);
assert.match(home, /Learn More/);
assert.match(home, /@media\(max-width:640px\)/);
assert.match(home, /\.cost-modules\{grid-template-columns:1fr\}/);
assert.match(home, /\.cost-demo \.btn\{width:100%\}/);
assert.doesNotMatch(home, /resume/i);
assert.doesNotMatch(home, /\$39/);
assert.doesNotMatch(home, /LinkedIn headline/);
assert.doesNotMatch(home, /Bitcoin checkout/i);
assert.doesNotMatch(home, /stays at zero/);
assert.doesNotMatch(home, /RGP\/1\.0/);
assert.doesNotMatch(home, /Relay Graft/);
assert.match(home, /does not store the prompt/);
assert.match(home, /Simulated route/);

const rd = shell.getHtml('/solutions/continuous-rd');
assert.match(rd, /Let the Research Loop Propose the Next Automation/);
assert.match(rd, /Contact Sales/);
assert.match(rd, /id="howItWorks"/);

const root = path.join(__dirname, '..');
const site = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'backend/index.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
const nginx = fs.readFileSync(path.join(root, 'scripts/nginx-unicorn.conf'), 'utf8');
assert.match(site, /urlPath === '\/api\/demo\/optimize'/);
assert.match(site, /optimizePrompt\(prompt\)/);
assert.doesNotMatch(site.slice(site.indexOf("urlPath === '/api/demo/optimize'"), site.indexOf("urlPath === '/api/demo/optimize'") + 1800), /console\.(log|info|warn|error)/);
assert.match(backend, /app\.post\('\/api\/demo\/optimize'/);
assert.match(client, /function bindCostOptimizer/);
assert.match(client, /data-guest-label/);
assert.match(client, /You just saved /);
assert.match(nginx, /location = \/api\/demo\/optimize/);

console.log('cost-optimizer-demo.test.js: ok');
