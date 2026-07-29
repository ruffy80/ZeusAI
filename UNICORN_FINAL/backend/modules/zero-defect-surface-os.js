'use strict';
/**
 * Zero-Defect Surface OS (ZDOS/1.0)
 * ---------------------------------
 * Permanent integrity layer that prevents site/unicorn routing + honesty
 * regressions from shipping. Pure functions — safe to call from CI and from
 * a lightweight /api/zero-defect/status endpoint.
 *
 * Guarantees:
 *   1. nginx never uses broad ^~ prefixes that shadow backend-owned APIs
 *   2. JSON-LD / visible FAQ copy never claims automatic refund clawbacks
 *   3. PQ crypto requires use export-safe @noble/post-quantum paths
 *   4. Site-owned public contracts (/api/v100/) are explicitly routed to site
 */
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'ZDOS/1.0';
const ROOT = path.join(__dirname, '..', '..');

const FORBIDDEN_NGINX_PREFIXES = [
  { re: /location\s+\^~\s+\/api\/carbon\//, why: 'shadows backend auth-gated /api/carbon/* trading routes' },
  { re: /location\s+\^~\s+\/api\/outcome\//, why: 'shadows backend /api/outcome/{totals,recent,tenant} ledger' },
];

const REQUIRED_NGINX = [
  { re: /location\s+=\s+\/api\/carbon\/cart/, why: 'Frontier F12 carbon cart must hit site' },
  { re: /location\s+=\s+\/api\/outcome\/list/, why: 'Frontier F3 outcome list must hit site' },
  { re: /location\s+\^~\s+\/api\/v100\//, why: '100Y contracts live on site process' },
];

const DISHONEST_PHRASES = [
  /SLA breach\s*→\s*automatic refund/i,
  /refund is automatic/i,
  /refund auto-issues/i,
  /cancelled within 60s/i,
  /will be cancelled within 60s/i,
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function auditNginx(confText) {
  const findings = [];
  for (const f of FORBIDDEN_NGINX_PREFIXES) {
    if (f.re.test(confText)) findings.push({ severity: 'P0', kind: 'nginx_overmatch', detail: f.why });
  }
  for (const r of REQUIRED_NGINX) {
    if (!r.re.test(confText)) findings.push({ severity: 'P1', kind: 'nginx_missing', detail: r.why });
  }
  return findings;
}

function auditHonesty(texts) {
  const findings = [];
  for (const { name, text } of texts) {
    for (const re of DISHONEST_PHRASES) {
      if (re.test(text)) findings.push({ severity: 'P0', kind: 'dishonest_copy', detail: `${re} in ${name}` });
    }
  }
  return findings;
}

function auditPqRequires(text) {
  const findings = [];
  // Bare subpath without .js fails Node exports map for @noble/post-quantum.
  if (/require\(['"]@noble\/post-quantum\/ml-dsa['"]\)/.test(text)) {
    findings.push({ severity: 'P0', kind: 'pq_require', detail: 'use @noble/post-quantum/ml-dsa.js' });
  }
  return findings;
}

function runAudit(opts) {
  const o = opts || {};
  const nginx = o.nginxText != null ? o.nginxText : read('scripts/nginx-unicorn.conf');
  const shell = o.shellText != null ? o.shellText : read('src/site/v2/shell.js');
  const indexJs = o.indexText != null ? o.indexText : read('src/index.js');
  const pq = o.pqText != null ? o.pqText : read('backend/modules/innovations-50y/crypto-agility.js');

  const findings = [];
  findings.push(...auditNginx(nginx));
  findings.push(...auditHonesty([
    { name: 'shell.js', text: shell },
    { name: 'index.js', text: indexJs },
  ]));
  findings.push(...auditPqRequires(pq));

  const p0 = findings.filter((f) => f.severity === 'P0').length;
  const ok = p0 === 0 && findings.length === 0;
  return {
    protocol: PROTOCOL,
    ok,
    grade: ok ? 'S' : (p0 ? 'F' : 'B'),
    findings,
    counts: { total: findings.length, p0, p1: findings.filter((f) => f.severity === 'P1').length },
    generatedAt: new Date().toISOString(),
  };
}

function getStatus() {
  try {
    return runAudit();
  } catch (e) {
    return { protocol: PROTOCOL, ok: false, grade: 'F', error: e && e.message, findings: [] };
  }
}

module.exports = {
  PROTOCOL,
  runAudit,
  auditNginx,
  auditHonesty,
  auditPqRequires,
  getStatus,
  name: 'zero-defect-surface-os',
};
