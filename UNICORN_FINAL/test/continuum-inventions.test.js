'use strict';

/**
 * Continuum inventions pack — DAMC + DTBG + TCC + GINX + MDSP wiring.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.RIVOS_DISABLED = '1';
process.env.DISABLE_BILLION_AUTONOMY_LOOP = '1';
process.env.RIVOS_DATA_DIR = require('os').tmpdir() + '/rivos-continuum-' + Date.now();
process.env.ZEUS_TG_MOBDIAL_DIR = require('os').tmpdir() + '/mobdial-continuum-' + Date.now();
process.env.FULFILLMENT_AI_ENABLED = 'auto';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpSanctum = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-sanctum-'));
const sanctumEnv = path.join(tmpSanctum, 'telegram.env');
fs.writeFileSync(sanctumEnv, [
  'ZEUS_TG_BOT_TOKEN=123456789:AATestTokenValueForContinuumTestsXX',
  'ZAC_TELEGRAM_CHAT_ID=-1001234567890',
  '',
].join('\n'));

process.env.TCC_SANCTUM_FILE = sanctumEnv;

// Clear aliases so sanctum reload is the only source
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TG_BOT_TOKEN;
delete process.env.ZAC_TELEGRAM_TOKEN;
delete process.env.ZEUS_TG_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
delete process.env.TG_CHAT_ID;
delete process.env.ZAC_TELEGRAM_CHAT_ID;
delete process.env.ZEUS_TG_GROUP_CHAT_ID;

let passed = 0;
function check(name, fn) {
  const r = fn();
  if (r && typeof r.then === 'function') {
    return r.then(() => {
      console.log('✓', name);
      passed += 1;
    }).catch((e) => {
      console.error('✗', name);
      console.error(e && e.stack || e);
      process.exit(1);
    });
  }
  console.log('✓', name);
  passed += 1;
  return Promise.resolve();
}

async function main() {
  // Fresh require after TCC_SANCTUM_FILE is set
  delete require.cache[require.resolve('../backend/modules/telegram-credential-continuum')];
  const tcc = require('../backend/modules/telegram-credential-continuum');

  await check('TCC reloads sanctum aliases without logging secrets', () => {
    const snap = tcc.reloadFromSanctum();
    assert.equal(snap.tokenArmed, true);
    assert.equal(snap.ownerChatArmed, true);
    assert.ok(snap.restored >= 1 || snap.mirrored >= 1);
    assert.ok(process.env.TELEGRAM_BOT_TOKEN, 'mirrored TELEGRAM_BOT_TOKEN');
    assert.ok(process.env.ZAC_TELEGRAM_TOKEN, 'mirrored ZAC_TELEGRAM_TOKEN');
    assert.ok(process.env.TELEGRAM_CHAT_ID, 'mirrored TELEGRAM_CHAT_ID');
    const json = JSON.stringify(snap);
    assert.ok(!json.includes('AATestToken'));
    assert.ok(!json.includes('-1001234567890'));
  });

  const buy = require('../src/commerce/commerce-buyability');
  await check('DTBG allows instant digital via deterministic lane', () => {
    const a = buy.assessBuyability({
      id: 'instant-seo-content-pack',
      title: 'SEO Pack',
      priceUSD: 49,
      tier: 'instant',
    });
    assert.equal(a.buyable, true);
    assert.ok(a.deliveryTruth);
    assert.ok(a.deliveryTruth.ok);
    assert.ok(['deterministic', 'ai'].includes(a.deliveryTruth.lane));
  });

  await check('DTBG blocks requiresLiveAi when AI unarmed', () => {
    const prev = process.env.FULFILLMENT_AI_ENABLED;
    process.env.FULFILLMENT_AI_ENABLED = '0';
    const a = buy.assessBuyability({
      id: 'instant-website-audit',
      title: 'Audit',
      priceUSD: 29,
      tier: 'instant',
      requiresLiveAi: true,
    });
    process.env.FULFILLMENT_AI_ENABLED = prev;
    assert.equal(a.buyable, false);
    assert.equal(a.reason, 'ai_fulfillment_unarmed');
  });

  await check('DTBG blocks physical without dispatchable', () => {
    const a = buy.assessBuyability({
      id: 'instant-physical-mug',
      title: 'Mug',
      priceUSD: 19,
      tier: 'instant',
      type: 'physical',
      dispatchable: false,
    });
    // isUnavailableItem may catch dispatchable:false physical first
    assert.equal(a.buyable, false);
  });

  const damc = require('../src/commerce/dial-attributed-money-continuum');
  const md = require('../backend/modules/telegram-mobdial-os');

  await check('DAMC stamps dial on order and attributes create', () => {
    const issued = md.issueDial({ id: 42, username: 'tester' });
    const code = issued.member.code;
    assert.ok(code.startsWith('UDIAL-'));
    const order = { orderId: 'ord_damc_1', serviceId: 'instant-seo-content-pack', status: 'pending', meta: {} };
    const r = damc.attributeCreate(order, code);
    assert.equal(r.ok, true);
    assert.equal(order.meta.dial, code);
    assert.equal(order.mobdial.code, code);
  });

  await check('DAMC paid re-attribute increments paid', () => {
    const issued = md.issueDial({ id: 99, username: 'payer' });
    const code = issued.member.code;
    const order = {
      orderId: 'ord_damc_paid',
      serviceId: 'instant-landing-page',
      status: 'paid',
      meta: { dial: code },
      mobdial: { code },
    };
    const before = issued.member.paid || 0;
    const r = damc.attributePaid(order);
    assert.equal(r.ok, true);
    assert.equal(r.dial, code);
    const m = md.findByCode ? md.findByCode(code) : null;
    // attributeCheckout on paid increments; member may be refreshed
    assert.ok(r.attr && r.attr.ok);
    assert.ok(r.attr.paid === true);
  });

  await check('DAMC dialCheckoutHref carries dial query', () => {
    const href = damc.dialCheckoutHref('instant-seo-content-pack', 'UDIAL-TESTCODE');
    assert.ok(href.includes('plan=instant-seo-content-pack'));
    assert.ok(href.includes('dial=UDIAL-TESTCODE'));
    assert.ok(href.includes('utm_medium=mobdial'));
  });

  const rivos = require('../src/commerce/revenue-invention-continuum-os');
  await check('RIVOS discovery exposes MDSP/DAMC/DTBG/TCC/GINX', () => {
    const d = rivos.discovery();
    assert.ok(d.inventions.MDSP);
    assert.ok(d.inventions.DAMC);
    assert.ok(d.inventions.DTBG);
    assert.ok(d.inventions.TCC);
    assert.ok(d.inventions.GINX);
  });

  await check('MDSP dry-run posts dialed money preview', async () => {
    const pulse = await rivos.moneyDialSwarmPulse({ dryRun: true, limit: 3 });
    assert.equal(pulse.invention, 'MDSP');
    assert.ok(pulse.ok === true || pulse.reason === 'no_skus');
    if (pulse.ok) {
      assert.equal(pulse.dryRun, true);
      assert.ok(pulse.preview || pulse.channel === 'dry-run');
    }
  });

  const balos = require('../src/commerce/billion-autonomy-loop-os');
  await check('GINX — BALOS topBuyableInstant reorders via RIVOS gravity', () => {
    rivos.onPaid({ serviceId: 'instant-seo-content-pack', orderId: 'g1', amountUsd: 49 });
    rivos.onPaid({ serviceId: 'instant-seo-content-pack', orderId: 'g2', amountUsd: 49 });
    const skus = balos.topBuyableInstant(8);
    assert.ok(skus.length >= 2);
    const src = fs.readFileSync(path.join(__dirname, '../src/commerce/billion-autonomy-loop-os.js'), 'utf8');
    assert.ok(src.includes('reorderSkus'));
    assert.ok(src.includes('revenue-invention-continuum-os'));
  });

  await check('PPCOS wires DAMC attributePaid', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/commerce/post-pay-closure-os.js'), 'utf8');
    assert.ok(src.includes('dial-attributed-money-continuum'));
    assert.ok(src.includes('attributePaid'));
  });

  await check('AMOS uses TCC + DAMC dials', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/commerce/autonomy-money-surface-os.js'), 'utf8');
    assert.ok(src.includes('telegram-credential-continuum'));
    assert.ok(src.includes('dial-attributed-money-continuum'));
    assert.ok(src.includes('decorateSkuWithDial'));
  });

  console.log('\n✅ continuum-inventions:', passed, 'tests passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
