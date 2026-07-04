// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ==================== SECURITY SCANNER (REAL) ====================
// Scanare reală de securitate: headere lipsă, secrete expuse în payload,
// configurări slabe, schema de parolă, TLS hints. Returnează findings cu
// severitate + scor de risc. Real checks, deterministic, no external calls.

const { createEngine } = require('./engine-core');

// Pattern-uri reale de secrete (formate cunoscute)
const SECRET_PATTERNS = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private Key Block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Generic API Key', re: /\b(?:api[_-]?key|secret|token)\b["'\s:=]{1,4}[A-Za-z0-9_\-]{20,}/i },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Stripe Secret Key', re: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'Slack Token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'Bitcoin Private (WIF)', re: /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/ },
];

const REQUIRED_SECURITY_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
];

const SEV_WEIGHT = { critical: 25, high: 15, medium: 8, low: 3 };

function scanWork(input = {}) {
  const { headers = {}, payload = '', config = {}, url = '', password = '' } = input;
  const findings = [];

  // 1) Missing security headers
  const lowerHeaders = {};
  for (const k of Object.keys(headers || {})) lowerHeaders[k.toLowerCase()] = headers[k];
  for (const h of REQUIRED_SECURITY_HEADERS) {
    if (!lowerHeaders[h]) findings.push({ type: 'missing_header', header: h, severity: h === 'content-security-policy' || h === 'strict-transport-security' ? 'high' : 'medium', msg: `Missing security header: ${h}` });
  }

  // 2) Secret leakage in payload
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload || '');
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(text)) findings.push({ type: 'secret_exposed', secret: p.name, severity: 'critical', msg: `Possible exposed secret: ${p.name}` });
  }

  // 3) Insecure transport
  if (url && /^http:\/\//i.test(url)) findings.push({ type: 'insecure_transport', severity: 'high', msg: 'URL uses http:// (no TLS)' });

  // 4) Weak config flags
  if (config) {
    if (config.debug === true) findings.push({ type: 'debug_enabled', severity: 'medium', msg: 'Debug mode enabled' });
    if (config.cors === '*' || (config.cors && config.cors.origin === '*')) findings.push({ type: 'cors_wildcard', severity: 'medium', msg: 'CORS allows any origin (*)' });
    if (config.allowEval === true) findings.push({ type: 'eval_allowed', severity: 'high', msg: 'Arbitrary eval allowed' });
    if (config.tlsMinVersion && /1\.0|1\.1/.test(String(config.tlsMinVersion))) findings.push({ type: 'weak_tls', severity: 'high', msg: `Weak TLS min version: ${config.tlsMinVersion}` });
  }

  // 5) Password strength (if provided)
  if (password) {
    const pw = String(password);
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length;
    if (pw.length < 12 || classes < 3) findings.push({ type: 'weak_password', severity: pw.length < 8 ? 'high' : 'medium', msg: `Weak password (len ${pw.length}, ${classes}/4 char classes)` });
  }

  const riskScore = Math.min(100, findings.reduce((s, f) => s + (SEV_WEIGHT[f.severity] || 0), 0));
  const counts = findings.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {});
  const grade = riskScore === 0 ? 'A' : riskScore < 15 ? 'B' : riskScore < 35 ? 'C' : riskScore < 60 ? 'D' : 'F';

  return {
    riskScore, grade, secure: findings.length === 0,
    findingCount: findings.length, severityCounts: counts,
    findings: findings.sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity]),
    checkedHeaders: REQUIRED_SECURITY_HEADERS.length,
  };
}

const engine = createEngine('security-scanner', { label: 'Security Scanner', category: 'security', work: scanWork });
module.exports = {
  name: 'security-scanner',
  process: (input, ctx) => engine.process(input, ctx),
  scan: (input) => scanWork(input),
  SECRET_PATTERNS, REQUIRED_SECURITY_HEADERS,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
