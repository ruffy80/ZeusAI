'use strict';

/**
 * Buy Immortal OS — never again block Buy → BTC invoice.
 *
 * Invariants (CI-enforced via test/buy-immortal.test.js):
 *   1. Sovereign mint (POST /api/checkout/create) must NOT require email.
 *   2. Client sovereignBuy must NOT use window.prompt for email.
 *   3. Invalid remembered email must soft-clear, never hard-block mint.
 *   4. Catalog CTAs must respect assessBuyability (no fake Buy on contact SKUs).
 *   5. createOrder buyability assessment is fail-closed (never silent buyable:true).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLIENT_JS = path.join(ROOT, 'site', 'v2', 'client.js');
const SOVEREIGN_JS = path.join(ROOT, 'site', 'sovereign-commerce.js');
const BUYABILITY_JS = path.join(ROOT, 'commerce', 'commerce-buyability.js');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractFunctionBody(src, fnName) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${fnName}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return '';
  let i = m.index + m[0].length;
  // skip to opening brace of function
  while (i < src.length && src[i] !== '{') i += 1;
  if (i >= src.length) return '';
  let depth = 0;
  const start = i;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return '';
}

function stripJsComments(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function assertNoPromptInSovereignBuy(clientSrc) {
  const body = extractFunctionBody(clientSrc || readUtf8(CLIENT_JS), 'sovereignBuy');
  const code = stripJsComments(body);
  const violations = [];
  if (!body) violations.push('sovereignBuy_missing');
  if (/window\.prompt\s*\(/.test(code) || /\bprompt\s*\(\s*['"`]Delivery/.test(code)) {
    violations.push('window_prompt_in_sovereignBuy');
  }
  if (/A valid delivery email is required/.test(code)) {
    violations.push('hard_email_gate_in_sovereignBuy');
  }
  return { ok: violations.length === 0, violations, bytes: body.length };
}

function assertCreateOrderEmailOptional(sovereignSrc) {
  const src = sovereignSrc || readUtf8(SOVEREIGN_JS);
  const body = extractFunctionBody(src, 'createOrder');
  const violations = [];
  if (!body) violations.push('createOrder_missing');
  if (/error:\s*['"]email_required['"]/.test(body)) {
    violations.push('email_required_reject');
  }
  // Must still validate format when email is present.
  if (!/invalid_email/.test(body) && !/EMAIL_RE/.test(body)) {
    violations.push('missing_email_format_validation');
  }
  return { ok: violations.length === 0, violations };
}

function assertBuyabilityFailClosed(sovereignSrc) {
  const src = sovereignSrc || readUtf8(SOVEREIGN_JS);
  const body = extractFunctionBody(src, 'createOrder');
  const violations = [];
  if (!body) {
    return { ok: false, violations: ['createOrder_missing'] };
  }
  // Fail-open pattern we forbid: catch (_) { /* … */ } after default buyable:true
  // with no re-assessment. Require explicit fail-closed markers.
  if (/buyable:\s*true,\s*mode:\s*['"]btc['"],\s*reason:\s*['"]legacy['"]/.test(body)
      && /catch\s*\([^)]*\)\s*\{\s*\/\*\s*fail-open/.test(body)) {
    violations.push('buyability_fail_open_legacy');
  }
  if (!/buyability_module_unavailable|fail-closed|assessBuyability/.test(body)) {
    violations.push('missing_fail_closed_marker');
  }
  return { ok: violations.length === 0, violations };
}

function assertClientHasBuyabilityCta(clientSrc) {
  const src = clientSrc || readUtf8(CLIENT_JS);
  const violations = [];
  if (!/function\s+clientBuyabilityCta\s*\(/.test(src)) {
    violations.push('clientBuyabilityCta_missing');
  }
  // cardHtml must not be a bare data-link Buy without sovereign / buyability.
  const cardBody = extractFunctionBody(src, 'cardHtml');
  if (cardBody) {
    if (/Buy<\/a>/.test(cardBody) && !/clientBuyabilityCta|data-sovereign-buy/.test(cardBody)) {
      violations.push('cardHtml_ungated_buy');
    }
  }
  const masterBody = extractFunctionBody(src, 'masterCardHtml');
  if (masterBody && !/clientBuyabilityCta/.test(masterBody)) {
    violations.push('masterCardHtml_missing_buyability');
  }
  return { ok: violations.length === 0, violations };
}

function assertHydratePreservesBuyability(clientSrc) {
  const src = clientSrc || readUtf8(CLIENT_JS);
  const body = extractFunctionBody(src, 'hydrateMasterCatalog');
  const violations = [];
  if (!body) return { ok: false, violations: ['hydrateMasterCatalog_missing'] };
  // The remap object must keep server honesty fields.
  for (const field of ['buyable', 'buyMode', 'ctaLabel', 'ctaHref']) {
    if (!new RegExp(`${field}\\s*:`).test(body) && !new RegExp(`p\\.${field}`).test(body)) {
      violations.push(`hydrate_drops_${field}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

function scanAll() {
  const clientSrc = readUtf8(CLIENT_JS);
  const sovereignSrc = readUtf8(SOVEREIGN_JS);
  const checks = {
    noPrompt: assertNoPromptInSovereignBuy(clientSrc),
    emailOptional: assertCreateOrderEmailOptional(sovereignSrc),
    failClosed: assertBuyabilityFailClosed(sovereignSrc),
    clientCta: assertClientHasBuyabilityCta(clientSrc),
    hydrate: assertHydratePreservesBuyability(clientSrc),
    buyabilityModulePresent: fs.existsSync(BUYABILITY_JS),
  };
  const ok = Object.values(checks).every((c) => (typeof c === 'boolean' ? c : c.ok));
  return {
    ok,
    protocol: 'BUY-IMMORTAL/1.0',
    doctrine: 'one_click_btc_invoice_never_blocked_by_email_prompt',
    checks,
  };
}

function getStatus() {
  const report = scanAll();
  return {
    ok: report.ok,
    active: true,
    protocol: report.protocol,
    doctrine: report.doctrine,
    immortal: report.ok,
    checks: Object.fromEntries(
      Object.entries(report.checks).map(([k, v]) => [k, typeof v === 'boolean' ? v : !!v.ok])
    ),
  };
}

module.exports = {
  scanAll,
  getStatus,
  assertNoPromptInSovereignBuy,
  assertCreateOrderEmailOptional,
  assertBuyabilityFailClosed,
  assertClientHasBuyabilityCta,
  assertHydratePreservesBuyability,
  extractFunctionBody,
  CLIENT_JS,
  SOVEREIGN_JS,
};
