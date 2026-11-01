'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.SNM_ENABLED = '0';
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
delete process.env.AUDIT_SCAN_ALLOW_LOOPBACK;

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'company-audit-door-'));
process.env.UNICORN_DATA_DIR = path.join(tmpRoot, 'data');

const audit = require('../src/commerce/audit-scan');
const shell = require('../src/site/v2/shell');
const commerce = require('../src/site/sovereign-commerce');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function run() {
  await check('a public company URL is normalized and a private URL is refused', () => {
    const named = audit.normalizePublicUrl('https://example.com');
    assert.strictEqual(named.ok, true);
    assert.strictEqual(named.url, 'https://example.com/');
    const bare = audit.normalizePublicUrl('example.com');
    assert.strictEqual(bare.ok, true);
    assert.strictEqual(bare.url, 'https://example.com/');
    assert.strictEqual(audit.normalizePublicUrl('').ok, false);
    assert.strictEqual(audit.normalizePublicUrl('   ').reason, 'audit_url_required');
    assert.strictEqual(audit.normalizePublicUrl('http://127.0.0.1/').ok, false);
    assert.strictEqual(audit.normalizePublicUrl('http://127.0.0.1/').reason, 'blocked_host');
    assert.strictEqual(audit.normalizePublicUrl('http://169.254.169.254/').reason, 'blocked_host');
    assert.strictEqual(audit.normalizePublicUrl('http://localhost/').reason, 'blocked_host');
    assert.strictEqual(audit.normalizePublicUrl('javascript:alert(1)').reason, 'unsupported_protocol');
    assert.strictEqual(audit.normalizePublicUrl('https://user:pass@example.com/').reason, 'credentials_in_url');
  });

  await check('the audit page and checkout ask for one public URL and do not invent customers', () => {
    const page = shell.getHtml('/services/instant-website-audit');
    assert.ok(page.includes('data-company-audit-door="1"'));
    assert.ok(page.includes('data-order-input="url"'));
    assert.ok(page.includes('required placeholder="https://company.com"'));
    assert.ok(page.includes('The scan runs after payment'));
    assert.ok(page.includes('/checkout/?plan=instant-website-audit&amp;url=https://company.example'));
    assert.ok(!/Fortune|already use ZeusAI|all large companies/i.test(page));
    const home = shell.getHtml('/');
    assert.ok(!home.includes('data-company-audit-door'));
    const checkout = shell.getHtml('/checkout', { plan: 'instant-website-audit', siteUrl: 'https://example.com' });
    assert.ok(checkout.includes('data-order-input="url"'));
    assert.ok(checkout.includes('value="https://example.com/"'));
    assert.ok(checkout.includes('data-company-audit-door="1"'));
    const bare = shell.getHtml('/checkout', { plan: 'instant-website-audit', siteUrl: 'example.com' });
    assert.ok(bare.includes('value="https://example.com/"'));
    const service = shell.getHtml('/services/instant-website-audit', { siteUrl: 'https://example.com/pricing' });
    assert.ok(service.includes('value="https://example.com/pricing"'));
    assert.ok(service.includes('url=https%3A%2F%2Fexample.com%2Fpricing'));
    const blocked = shell.getHtml('/checkout', { plan: 'instant-website-audit', siteUrl: 'http://127.0.0.1/' });
    assert.ok(blocked.includes('data-order-input="url"'));
    assert.ok(!blocked.includes('value="http://127.0.0.1'));
    const other = shell.getHtml('/checkout', { plan: 'instant-logo-kit', siteUrl: 'https://example.com' });
    assert.ok(!other.includes('placeholder="https://company.com"'));
    assert.ok(!other.includes('data-company-audit-door'));
  });

  await check('createOrder keeps a missing audit URL and rejects a present private URL', async () => {
    const ctx = {
      resolveCatalogItem: async (id) => ({
        id, title: 'Instant Website Audit (AI)', priceUsd: 49, group: 'instant', tier: 'instant',
      }),
    };
    const open = await commerce.createOrder(ctx, { serviceId: 'instant-website-audit', qty: 1 });
    assert.ok(open.order, JSON.stringify(open));
    const rejected = await commerce.createOrder(ctx, {
      serviceId: 'instant-website-audit', qty: 1, inputs: { url: 'http://127.0.0.1/' },
    });
    assert.strictEqual(rejected.error, 'audit_url_rejected');
    assert.strictEqual(rejected.status, 400);
    assert.strictEqual(rejected.reason, 'blocked_host');
    const metadata = await commerce.createOrder(ctx, {
      serviceId: 'instant-website-audit', qty: 1, inputs: { url: 'http://169.254.169.254/' },
    });
    assert.strictEqual(metadata.error, 'audit_url_rejected');
    assert.strictEqual(metadata.reason, 'blocked_host');
    const named = await commerce.createOrder(ctx, {
      serviceId: 'instant-website-audit', qty: 1, inputs: { url: 'example.com' },
    });
    assert.ok(named.order, JSON.stringify(named));
    assert.strictEqual(named.order.buyer.inputs.url, 'https://example.com/');
    assert.strictEqual(named.order.meta.inputs.url, 'https://example.com/');
  });

  await check('the site reads ?url= and the checkout cache does not drop it', () => {
    const root = path.join(__dirname, '..');
    const index = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
    const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
    assert.ok(index.includes('ssrParams.siteUrl = siteUrlQ.slice(0, 300)'));
    assert.ok(index.includes('ssrParams.siteUrl)'));
    assert.ok(client.includes('Enter the public website URL. The scan runs after payment.'));
    assert.ok(client.includes('function auditUrlMissing'));
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.ok(String(pkg.scripts['test:chain']).includes('company-audit-door.test.js'));
  });

  console.log('✅ company-audit-door: ' + passed + ' tests passed');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
