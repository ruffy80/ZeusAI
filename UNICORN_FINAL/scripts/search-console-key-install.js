'use strict';

/**
 * Install a Search Console service-account file without printing it.
 *
 * The owner drops the JSON at /var/www/unicorn/shared/search-console-key.json
 * (mode 600). This script checks the shape, optionally probes Search Console,
 * and writes only GOOGLE_SERVICE_ACCOUNT_JSON_B64 into
 * /var/www/unicorn/shared/search-console.env. It never writes the raw JSON
 * into git or into the main .env, and it never restarts PM2.
 *
 * Exit 2: key file missing. Exit 3: file is not a service-account key.
 * Exit 4: a path points inside this repository. Exit 5: probe or write failed.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_KEY = '/var/www/unicorn/shared/search-console-key.json';
const DEFAULT_ENV = '/var/www/unicorn/shared/search-console.env';
const ENV_NAME = 'GOOGLE_SERVICE_ACCOUNT_JSON_B64';

function repoRoots() {
  return [path.resolve(__dirname, '..', '..'), path.resolve(__dirname, '..')];
}

function insideRepo(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  return repoRoots().some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

function parseAccount(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return { ok: false, reason: 'invalid_json' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'invalid_json' };
  }
  const email = String(data.client_email || '').trim();
  const key = String(data.private_key || '');
  if (data.type && data.type !== 'service_account') {
    return { ok: false, reason: 'not_service_account' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, reason: 'missing_client_email' };
  }
  if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(key) || !/-----END (?:RSA )?PRIVATE KEY-----/.test(key)) {
    return { ok: false, reason: 'missing_private_key' };
  }
  return {
    ok: true,
    account: { type: 'service_account', client_email: email, private_key: key },
  };
}

function publicResult(extra) {
  const out = Object.assign({
    ok: false,
    wroteRawJson: false,
    restartedPm2: false,
    calledGoogle: false,
    wroteEnv: false,
  }, extra || {});
  const text = JSON.stringify(out);
  if (/-----BEGIN |"private_key"|ya29\./.test(text)) {
    return {
      ok: false,
      blocked: true,
      reason: 'refused_to_print_secret',
      wroteRawJson: false,
      restartedPm2: false,
      calledGoogle: false,
      wroteEnv: false,
    };
  }
  return out;
}

function restoreEnv(previous) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

async function installFromFile(opts) {
  const o = opts || {};
  const keyPath = String(o.keyPath || process.env.SEARCH_CONSOLE_KEY_FILE || DEFAULT_KEY);
  const envPath = String(o.envPath || process.env.SEARCH_CONSOLE_ENV_FILE || DEFAULT_ENV);
  if (insideRepo(keyPath) || insideRepo(envPath)) {
    return publicResult({ blocked: true, reason: 'path_inside_repository' });
  }
  if (!fs.existsSync(keyPath)) {
    return publicResult({
      blocked: true,
      reason: 'key_file_missing',
      expectedPath: keyPath,
    });
  }
  let text = '';
  try {
    text = fs.readFileSync(keyPath, 'utf8');
  } catch (_) {
    return publicResult({ blocked: true, reason: 'key_unreadable' });
  }
  const parsed = parseAccount(text);
  if (!parsed.ok) return publicResult({ blocked: true, reason: parsed.reason });
  try { fs.chmodSync(keyPath, 0o600); } catch (_) { /* owned by another user */ }

  const b64 = Buffer.from(JSON.stringify(parsed.account), 'utf8').toString('base64');
  const previous = {
    GOOGLE_SERVICE_ACCOUNT_JSON_B64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64,
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  };
  let calledGoogle = false;
  try {
    if (o.probe) {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 = b64;
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      calledGoogle = true;
      const bridge = require('../backend/modules/search-console-bridge');
      const report = await bridge.readPerformance();
      const probe = {
        ok: !!(report && report.ok),
        blocked: !!(report && report.blocked),
        reason: (report && report.reason) || 'probe_failed',
        siteUrl: (report && report.siteUrl) || null,
      };
      if (!probe.ok) {
        return publicResult({
          blocked: true,
          reason: probe.reason,
          calledGoogle: true,
          probe,
        });
      }
    }
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    const tmp = envPath + '.tmp';
    fs.writeFileSync(tmp, ENV_NAME + '=' + b64 + '\n', { mode: 0o600 });
    fs.renameSync(tmp, envPath);
    fs.chmodSync(envPath, 0o600);
  } catch (_) {
    return publicResult({ blocked: true, reason: 'env_unwritable', calledGoogle });
  } finally {
    restoreEnv(previous);
  }
  return publicResult({
    ok: true,
    installed: true,
    reason: 'installed_b64_only',
    envFile: envPath,
    wroteEnv: true,
    calledGoogle,
    loadsOnNextBackendStart: true,
    clientEmail: parsed.account.client_email,
  });
}

function parseArgs(argv) {
  const out = { probe: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-probe') out.probe = false;
    else if (arg === '--probe') out.probe = true;
    else if (arg === '--key') out.keyPath = argv[i += 1];
    else if (arg === '--env') out.envPath = argv[i += 1];
    else if (arg.startsWith('--key=')) out.keyPath = arg.slice(6);
    else if (arg.startsWith('--env=')) out.envPath = arg.slice(6);
  }
  return out;
}

function exitCode(result) {
  if (result && result.ok) return 0;
  const reason = result && result.reason;
  if (reason === 'key_file_missing') return 2;
  if (reason === 'invalid_json' || reason === 'missing_client_email' || reason === 'missing_private_key' || reason === 'not_service_account') return 3;
  if (reason === 'path_inside_repository') return 4;
  return 5;
}

if (require.main === module) {
  installFromFile(parseArgs(process.argv.slice(2))).then((result) => {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(exitCode(result));
  }).catch(() => {
    process.stdout.write(JSON.stringify({
      ok: false,
      blocked: true,
      reason: 'install_failed',
      wroteRawJson: false,
      restartedPm2: false,
      calledGoogle: false,
      wroteEnv: false,
    }) + '\n');
    process.exit(5);
  });
}

module.exports = {
  DEFAULT_KEY,
  DEFAULT_ENV,
  installFromFile,
  parseAccount,
  insideRepo,
  exitCode,
};
