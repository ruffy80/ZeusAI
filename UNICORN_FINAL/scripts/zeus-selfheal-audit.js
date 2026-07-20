#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// zeus-selfheal-audit.js — READ-ONLY self-heal audit for the cron.
//
// Runs selfConstruction.audit() only (never the apply path) and never writes
// module skeletons, then prints a one-line summary. Intended to be scheduled
// every 15 minutes so drift (empty modules, missing exports, placeholder code)
// is surfaced in logs without ever mutating source files.
//
// Exits 0 on a clean/complete audit; exits 0 (non-fatal) with a WARN line if
// the audit itself errors, so the cron never floods mail with failures.

'use strict';

// Belt-and-suspenders: force safe flags so requiring the module tree cannot
// trigger any file-mutating background behaviour.
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_SELF_CONSTRUCTION = process.env.ENABLE_SELF_CONSTRUCTION || '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';

function line(...args) {
  process.stdout.write(`[zeus-selfheal-audit] ${new Date().toISOString()} ${args.join(' ')}\n`);
}

(async () => {
  let sc;
  try {
    sc = require('../backend/modules/selfConstruction');
  } catch (e) {
    line('WARN could not load selfConstruction:', e && e.message);
    process.exit(0);
  }

  try {
    if (typeof sc.audit !== 'function') {
      line('WARN selfConstruction.audit() is not available — skipping');
      process.exit(0);
    }
    const report = sc.audit(); // READ-ONLY
    const t = (report && report.totals) || {};
    line(
      `audit OK mode=${report && report.mode} modules=${t.modules} ` +
      `empty=${t.empty} noExports=${t.noExports} ` +
      `placeholders=${t.placeholders} duplicateOwnership=${t.duplicateOwnership}`
    );
  } catch (e) {
    line('WARN audit error (non-fatal):', e && e.message);
  }
  // Some modules start intervals on load; exit explicitly so cron never hangs.
  process.exit(0);
})();
