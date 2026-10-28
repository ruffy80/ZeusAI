'use strict';

/**
 * Read-only fingerprint probe.
 * Compares salesOrchestrator.quote with priceNegotiator.getPrice, fires a
 * business alert in this process only, and refuses to continue if invoice 9
 * changes status. Does not mark anything paid and does not restart services.
 *
 *   node scripts/orchestrator-probe.js
 */
const fs = require('fs');
const path = require('path');

const IDS = ['website-audit', 'instant-website-audit', 'instant-resume-makeover', 'brand-logo-kit'];

function readInvoice9() {
  const candidates = [
    '/var/www/unicorn/shared/data/invoices/9.json',
    path.join(__dirname, '..', 'data', 'invoices', '9.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const body = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { file, status: body.status, priceUsd: body.priceUsd };
  }
  return null;
}

async function main() {
  const before = readInvoice9();
  const sales = require('../backend/modules/salesOrchestrator');
  const prices = require('../backend/modules/priceNegotiator');
  const orch = require('../backend/modules/orchestrator');
  const rows = [];
  for (const id of IDS) {
    const oldQuote = await sales.quote(id);
    const direct = await prices.getPrice(id, {});
    rows.push({
      id,
      oldUsd: oldQuote && oldQuote.usd,
      directUsd: direct && direct.usd,
      sameUsd: oldQuote && direct && oldQuote.usd === direct.usd,
      oldOk: !!(oldQuote && oldQuote.ok),
      source: direct && direct.source,
      mutated: false,
    });
  }
  const alerts = [];
  orch.on('business_alert', (evt) => alerts.push({ capability: evt.capability, error: evt.error }));
  await orch.safeRun('processPaidOrders', async () => {
    throw new Error('drill_not_a_payment');
  });
  const after = readInvoice9();
  const salesStatus = sales.getStatus();
  const report = {
    at: new Date().toISOString(),
    quotes: rows,
    mismatches: rows.filter((row) => row.sameUsd !== true).map((row) => row.id),
    businessAlert: alerts[0] || null,
    sales: {
      module: salesStatus.module,
      profitMargin: salesStatus.profitMargin,
    },
    invoice9Before: before,
    invoice9After: after,
    invoiceUnchanged: !before || (after && before.status === after.status),
  };
  const dir = process.env.ZEUS_STATE_DIR || '/opt/zeusai/state';
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'runtime-fingerprint.json'), JSON.stringify(report, null, 2));
  } catch (_) { /* stdout still carries the report */ }
  console.log(JSON.stringify(report));
  if (report.mismatches.length || alerts.length !== 1 || report.invoiceUnchanged !== true) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e && e.message);
  process.exit(1);
});
