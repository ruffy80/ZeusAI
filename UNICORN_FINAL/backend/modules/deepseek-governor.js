// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-15T07:00:14.374Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// DeepSeek Governor — strict allowlist executor (PR: DeepSeek autonomy)
//
// Goal: let DeepSeek (or any other LLM/operator) trigger a small, bounded
// set of *internal* recovery actions on the Unicorn backend WITHOUT giving
// it the ability to:
//   - eval / exec arbitrary shell
//   - write arbitrary files (especially under backend/modules/ or src/)
//   - commit / push / deploy
//   - restart arbitrary OS services as root
//
// Every action is a hardcoded enum dispatched to a known internal function.
// There is no dynamic require(), no eval(), no shell="true", no template
// command interpolation. The systemd `restart_service` action records
// *intent only* — it never spawns systemctl/pm2 from inside Node — so an
// attacker who controls the LLM response cannot escalate privileges.
//
// Bilingual comments preserved per repo convention (EN + RO).
// Comentarii bilingve păstrate conform convenției repo.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');

// -------- Configuration / Configurație ---------------------------------
const RATE_LIMIT_PER_HOUR = parseInt(process.env.DEEPSEEK_GOVERNOR_HOURLY_LIMIT || '60', 10);
const RATE_LIMIT_PER_DAY  = parseInt(process.env.DEEPSEEK_GOVERNOR_DAILY_LIMIT  || '200', 10);
const RUN_TEST_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_GOVERNOR_RUN_TEST_TIMEOUT_MS || '30000', 10);
const LOG_PATH            = process.env.DEEPSEEK_GOVERNOR_LOG_PATH
                          || path.join(__dirname, '..', '..', 'data', 'logs', 'deepseek-governor.log');
const LOG_MAX_BYTES       = parseInt(process.env.DEEPSEEK_GOVERNOR_LOG_MAX_BYTES || String(2 * 1024 * 1024), 10);

// read_file safety envelope / Plicul de siguranță pentru read_file
const AUTONOMY_ROOT = path.resolve(process.env.DEEPSEEK_GOVERNOR_AUTONOMY_ROOT || '/opt/unicorn');
const READ_FILE_ROOT      = path.resolve(process.env.DEEPSEEK_GOVERNOR_READ_ROOT || AUTONOMY_ROOT);
const READ_FILE_MAX_BYTES = parseInt(process.env.DEEPSEEK_GOVERNOR_READ_MAX_BYTES || String(256 * 1024), 10);
const READ_FILE_EXT_ALLOWLIST = Object.freeze(['.js', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.log', '.md', '.txt', '.html', '.css', '.sh', '.service', '.ini', '.conf', '.sql']);
// Deny tokens: any path segment matching one of these is rejected outright.
// Tokenuri interzise: orice segment de cale care se potrivește este respins.
const READ_FILE_DENY_SEGMENTS = Object.freeze([
  '.git', '.ssh', '.npmrc', '.env',
  'secrets', 'private', 'credentials', 'id_rsa', 'id_ed25519',
]);
// Substring deny list applied to the full relative path (case-insensitive).
// Substring-uri interzise în calea relativă completă (case-insensitive).
const READ_FILE_DENY_SUBSTRINGS = Object.freeze([
  'secret', 'password', 'apikey', 'api_key', 'api-key',
  'token', 'jwt', 'private_key', 'privatekey',
]);

const PROTECTED_BASENAMES = Object.freeze([
  '.env', '.env.local', '.env.production', '.env.development', '.env.test',
  '.gitconfig', '.npmrc', 'id_rsa', 'id_ed25519', 'authorized_keys',
]);
const PROTECTED_RELATIVE_PATHS = Object.freeze([
  '.git/config',
  '.git-credentials',
]);

// Allowed action names. Anything else is rejected with HTTP 400.
// Numele acțiunilor permise. Orice altceva → respins (400).
const ALLOWED_ACTIONS = Object.freeze([
  'none',
  'read_status',
  'read_file',
  'write_file',
  'create_file',
  'move_file',
  'delete_file',
  'execute_safe_script',
  'prices_sync',
  'checkout_fix',
  'run_test',
  'restart_service',
  'git_commit',
  'deploy',
  'github_clone_repo',
  'github_read_repo',
  'github_create_branch',
  'github_commit_push',
  'github_create_pr',
  'github_merge_pr',
  'github_trigger_workflow',
  'github_comment_issue',
  'merge_pr',
  'browse_github',
  'search_github',
  'full_backup',
  'restore_backup',
  'analyze_logs',
  'rollback_deploy',
  // Autonomous mode (write-only proposals — NO direct apply, audit-first):
  // Modul autonom (doar propuneri — fără aplicare directă, audit obligatoriu):
  'code_proposal',
  'roadmap_update',
]);

// code_proposal safety envelope / Plicul de siguranță pentru code_proposal
// Proposals are written to a quarantine directory and require human/CI review
// to land in source. The governor itself never applies them.
// Propunerile se scriu într-un director-carantină; aplicarea cere review.
const PROPOSALS_DIR = process.env.DEEPSEEK_GOVERNOR_PROPOSALS_DIR
                   || path.join(__dirname, '..', '..', 'data', 'deepseek-proposals');
const PROPOSAL_MAX_BYTES = parseInt(process.env.DEEPSEEK_GOVERNOR_PROPOSAL_MAX_BYTES || String(32 * 1024), 10);
const PROPOSAL_MAX_FILES_PER_DAY = parseInt(process.env.DEEPSEEK_GOVERNOR_PROPOSAL_MAX_PER_DAY || '50', 10);
// Target file path inside the proposal must respect the same deny-segments and
// deny-substrings as read_file. We additionally reject any path that would
// touch CI workflows, package metadata, env files, or the governor itself —
// the LLM must NEVER be allowed to weaken its own safety rails.
// Calea țintă a propunerii respectă aceleași reguli ca read_file + interdicții
// suplimentare pentru CI/.env/package.json/governor.
const PROPOSAL_TARGET_DENY_PREFIXES = Object.freeze([
  'server/',
  'src/',
  'backend/',
  '.github/',
  'node_modules/',
]);
const PROPOSAL_TARGET_ALLOW_PREFIXES = Object.freeze([
  'UNICORN_FINAL/backend/modules/',
  'UNICORN_FINAL/backend/constants/',
  'UNICORN_FINAL/src/',
  'UNICORN_FINAL/test/',
  'UNICORN_FINAL/docs/',
  'docs/',
]);
const PROPOSAL_TARGET_DENY_SUFFIXES = Object.freeze([
  '/deepseek-governor.js',
  '/deepseek-loop.js',
  '/deepseek-loop.service',
  'package.json',
  'package-lock.json',
]);

// write_file safety envelope (strict sandbox) / Plic write_file (sandbox strict)
const WRITE_FILE_ROOT = path.resolve(process.env.DEEPSEEK_GOVERNOR_WRITE_ROOT || AUTONOMY_ROOT);
const WRITE_FILE_MAX_BYTES = parseInt(process.env.DEEPSEEK_GOVERNOR_WRITE_MAX_BYTES || String(64 * 1024), 10);
const SAFE_SCRIPT_ROOT = path.resolve(process.env.DEEPSEEK_GOVERNOR_SAFE_SCRIPT_ROOT || AUTONOMY_ROOT);
const SANDBOX_ROOT = path.resolve(process.env.DEEPSEEK_GOVERNOR_SANDBOX_ROOT || path.join(AUTONOMY_ROOT, 'sandbox'));
const AUTONOMOUS_ACTION_LOG_PATH = process.env.DEEPSEEK_GOVERNOR_ACTION_LOG_PATH || '/var/log/autonomous_actions.log';
const POST_MUTATION_SCRIPT = path.resolve(process.env.DEEPSEEK_GOVERNOR_POST_MUTATION_SCRIPT || path.join(SAFE_SCRIPT_ROOT, 'post-mutation-validate.sh'));
const DELETE_FILE_ROOTS = Object.freeze((process.env.DEEPSEEK_GOVERNOR_DELETE_ROOTS
  ? process.env.DEEPSEEK_GOVERNOR_DELETE_ROOTS.split(':').filter(Boolean)
  : [AUTONOMY_ROOT])
  .map((p) => path.resolve(p)));
const DELETE_FILE_PROTECTED_PREFIXES = Object.freeze([
  path.resolve(AUTONOMY_ROOT, '.git'),
  path.resolve(AUTONOMY_ROOT, '.ssh'),
  path.resolve(AUTONOMY_ROOT, 'node_modules'),
  path.resolve(AUTONOMY_ROOT, 'current'),
]);

// Roadmap location (read-write via roadmap_update action) / Locația roadmap-ului
const ROADMAP_PATH = process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH
                  || path.join(__dirname, '..', '..', 'data', 'roadmap.json');

// Operator command queue (consumed by the deepseek-loop) / Coada de comenzi operator
const COMMAND_QUEUE_PATH = process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_PATH
                        || path.join(__dirname, '..', '..', 'data', 'deepseek-commands.jsonl');
const COMMAND_QUEUE_MAX_ENTRIES = parseInt(process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_MAX || '200', 10);
const GITHUB_API_BASE = process.env.DEEPSEEK_GOVERNOR_GITHUB_API_BASE || 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

// Allowlist of service names that `restart_service` is permitted to *flag*.
// Lista de servicii pentru care `restart_service` poate semnala intenție.
const RESTARTABLE_SERVICES = Object.freeze([
  'unicorn-backend',
  'unicorn-frontend',
  'unicorn-site',
  'pricing-module',
]);

// -------- In-memory state / Stare in-memory -----------------------------
const _rateState = new Map();      // key (ip) -> [{ts, day}]
const _seenRequestIds = new Map(); // requestId -> {result, expiresAt}
const REQUEST_ID_TTL_MS = 5 * 60 * 1000;

let _refs = {
  livePricingBroker: null,
  logger: null,
};

// -------- Logging / Logare ----------------------------------------------
function _ensureLogDir() {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  } catch (_) { /* best effort */ }
}

function _rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_PATH);
    if (stat.size > LOG_MAX_BYTES) {
      fs.renameSync(LOG_PATH, LOG_PATH + '.1');
    }
  } catch (_) { /* file missing is fine */ }
}

function _appendLog(entry) {
  try {
    _ensureLogDir();
    _rotateIfNeeded();
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (_) { /* never throw from logging */ }
  if (_refs.logger && typeof _refs.logger.info === 'function') {
    try { _refs.logger.info('[deepseek-governor]', entry); } catch (_) { /* noop */ }
  }
}

function _appendAutonomousLog(entry) {
  try {
    fs.mkdirSync(path.dirname(AUTONOMOUS_ACTION_LOG_PATH), { recursive: true });
    fs.appendFileSync(AUTONOMOUS_ACTION_LOG_PATH, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (_) { /* never throw */ }
}

function _normalizeSafeRelative(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  if (input.indexOf('\0') !== -1) return null;
  return path.posix.normalize(input.trim().replace(/\\/g, '/'));
}

function _isProtectedRelativePath(relPath) {
  const norm = _normalizeSafeRelative(relPath);
  if (!norm) return true;
  const lower = norm.toLowerCase();
  const base = path.posix.basename(lower);
  if (PROTECTED_BASENAMES.includes(base)) return true;
  if (PROTECTED_RELATIVE_PATHS.includes(lower)) return true;
  const segs = lower.split('/');
  if (segs.includes('.git') || segs.includes('.ssh')) return true;
  if (segs.some((seg) => seg.startsWith('.env'))) return true;
  for (const deny of READ_FILE_DENY_SUBSTRINGS) {
    if (lower.includes(deny)) return true;
  }
  return false;
}

function _resolveWithinRoot(root, rawPath, { mustExist = false } = {}) {
  const norm = _normalizeSafeRelative(rawPath);
  if (!norm) return { ok: false, reason: 'invalid_path' };
  if (path.posix.isAbsolute(norm) || norm === '..' || norm.startsWith('../') || norm.includes('/../')) {
    return { ok: false, reason: 'path_outside_root' };
  }
  const target = path.resolve(root, norm);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { ok: false, reason: 'path_outside_root' };
  if (_isProtectedRelativePath(rel)) return { ok: false, reason: 'protected_path' };
  if (mustExist && !fs.existsSync(target)) return { ok: false, reason: 'not_found' };
  return { ok: true, abs: target, rel: rel.replace(/\\/g, '/') };
}

function _allowedDeleteRootFor(target) {
  for (const protectedPrefix of DELETE_FILE_PROTECTED_PREFIXES) {
    const relProtected = path.relative(protectedPrefix, target);
    if (!relProtected.startsWith('..') && !path.isAbsolute(relProtected)) return null;
  }
  for (const root of DELETE_FILE_ROOTS) {
    const rel = path.relative(root, target);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return root;
  }
  return null;
}

function _collectCleanupCandidates() {
  const now = Date.now();
  const candidates = [];
  for (const root of DELETE_FILE_ROOTS) {
    try {
      if (!fs.existsSync(root)) continue;
      const dirsToScan = (root === AUTONOMY_ROOT)
        ? ['temp', 'old_backups', 'logs-old', 'contrib'].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d))
        : [root];
      for (const scanDir of dirsToScan) {
        const entries = fs.readdirSync(scanDir).slice(0, 200);
        for (const entry of entries) {
          const full = path.join(scanDir, entry);
          if (!_allowedDeleteRootFor(full)) continue;
          const stat = fs.statSync(full);
          if (!stat.isFile()) continue;
          const ageDays = (now - stat.mtimeMs) / (24 * 60 * 60 * 1000);
          const threshold = scanDir.endsWith('old_backups') ? 30 : 7;
          if (ageDays < threshold) continue;
          candidates.push({
            path: full,
            ageDays: +ageDays.toFixed(1),
            bytes: stat.size,
            reason: scanDir.endsWith('old_backups') ? 'backup_older_than_30d' : 'stale_temp_or_log',
          });
          if (candidates.length >= 25) return candidates;
        }
      }
    } catch (_) { /* best-effort */ }
  }
  try {
    const marker = path.join(SANDBOX_ROOT, 'dead-code-candidates.json');
    if (fs.existsSync(marker)) {
      const parsed = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const item of parsed.slice(0, 10)) candidates.push(item);
      }
    }
  } catch (_) { /* best-effort */ }
  return candidates;
}

function _runCommand(bin, args, options = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(bin, args, {
      cwd: options.cwd || path.resolve(__dirname, '..', '..'),
      env: options.env || process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) { /* noop */ }
      resolve({ ok: false, reason: 'timeout', stdoutTail: stdout.slice(-2000), stderrTail: stderr.slice(-2000), timeoutMs: options.timeoutMs || RUN_TEST_TIMEOUT_MS });
    }, options.timeoutMs || RUN_TEST_TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); if (stdout.length > 50000) stdout = stdout.slice(-40000); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); if (stderr.length > 50000) stderr = stderr.slice(-40000); });
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, reason: 'spawn_error', error: String(e && e.message || e).slice(0, 200) });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code, stdoutTail: stdout.slice(-2000), stderrTail: stderr.slice(-2000) });
    });
  });
}

async function _runPostMutationPipeline(meta) {
  try {
    if (!fs.existsSync(POST_MUTATION_SCRIPT)) {
      return { ok: false, reason: 'post_mutation_script_missing', script: POST_MUTATION_SCRIPT };
    }
    const result = await _runCommand(POST_MUTATION_SCRIPT, [meta.action, meta.path || '', meta.mode || ''], {
      cwd: SAFE_SCRIPT_ROOT,
      env: { ...process.env, AUTONOMY_ROOT, SANDBOX_ROOT },
      timeoutMs: Math.max(RUN_TEST_TIMEOUT_MS, 120000),
    });
    return { ...result, script: POST_MUTATION_SCRIPT };
  } catch (e) {
    return { ok: false, reason: 'post_mutation_pipeline_failed', error: String(e && e.message || e).slice(0, 200) };
  }
}

// -------- Rate limiting / Limitare rată ---------------------------------
function _rateAllow(ip) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo  = now - 24 * 60 * 60 * 1000;
  const arr = (_rateState.get(ip) || []).filter(ts => ts > dayAgo);
  const hourCount = arr.filter(ts => ts > hourAgo).length;
  if (hourCount >= RATE_LIMIT_PER_HOUR) return { ok: false, reason: 'hourly_limit', hourCount, dayCount: arr.length };
  if (arr.length >= RATE_LIMIT_PER_DAY) return { ok: false, reason: 'daily_limit', hourCount, dayCount: arr.length };
  arr.push(now);
  _rateState.set(ip, arr);
  return { ok: true, hourCount: hourCount + 1, dayCount: arr.length };
}

function _gcRequestIds() {
  const now = Date.now();
  for (const [k, v] of _seenRequestIds) {
    if (v.expiresAt <= now) _seenRequestIds.delete(k);
  }
}

// -------- Action handlers / Handlere acțiuni ----------------------------
function _action_none() {
  return { ok: true, action: 'none', note: 'no operation performed' };
}

// read_file: strict whitelist. Path must:
//   1. resolve to a real path inside READ_FILE_ROOT (default = repo root);
//   2. have an extension in READ_FILE_EXT_ALLOWLIST;
//   3. contain no denied path segments (e.g. .git, .ssh, .env, node_modules);
//   4. contain no denied substrings (secret, password, token, ...);
//   5. not be a symlink (lstat check) — no symlink escape;
//   6. not exceed READ_FILE_MAX_BYTES.
// All checks happen AFTER fs.realpathSync resolution so '..' / symlink tricks
// cannot escape the root. Returns base64-encoded content for binary safety.
function _action_read_file(params) {
  const raw = params && typeof params.path === 'string' ? params.path : '';
  if (!raw) return { ok: false, action: 'read_file', reason: 'path_required' };
  // Reject NUL bytes outright (Node sometimes accepts them).
  if (raw.indexOf('\0') !== -1) return { ok: false, action: 'read_file', reason: 'invalid_path' };
  // Reject absolute paths outside the root early; require relative-or-rooted.
  let candidate;
  try {
    candidate = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(READ_FILE_ROOT, raw);
  } catch (_) {
    return { ok: false, action: 'read_file', reason: 'invalid_path' };
  }
  // Resolve symlinks; if the file doesn't exist, realpathSync will throw.
  let real;
  try {
    real = fs.realpathSync(candidate);
  } catch (_) {
    return { ok: false, action: 'read_file', reason: 'not_found' };
  }
  // Containment: must be inside READ_FILE_ROOT.
  const rootReal = fs.realpathSync(READ_FILE_ROOT);
  const rel = path.relative(rootReal, real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, action: 'read_file', reason: 'path_outside_root' };
  }
  // No-symlink: lstat must agree with stat target type (file).
  let lst;
  try { lst = fs.lstatSync(real); } catch (_) { return { ok: false, action: 'read_file', reason: 'not_found' }; }
  if (lst.isSymbolicLink()) return { ok: false, action: 'read_file', reason: 'symlink_not_allowed' };
  if (!lst.isFile())        return { ok: false, action: 'read_file', reason: 'not_a_file' };
  // Extension allowlist.
  const ext = path.extname(real).toLowerCase();
  if (!READ_FILE_EXT_ALLOWLIST.includes(ext)) {
    return { ok: false, action: 'read_file', reason: 'extension_not_allowed', allowed: READ_FILE_EXT_ALLOWLIST };
  }
  // Per-segment deny.
  const segs = rel.split(/[\\/]/);
  for (const seg of segs) {
    const lower = seg.toLowerCase();
    for (const deny of READ_FILE_DENY_SEGMENTS) {
      if (lower === deny.toLowerCase() || lower.endsWith(deny.toLowerCase())) {
        return { ok: false, action: 'read_file', reason: 'segment_denied', segment: seg };
      }
    }
  }
  // Substring deny on full relative path.
  const lowerRel = rel.toLowerCase();
  for (const deny of READ_FILE_DENY_SUBSTRINGS) {
    if (lowerRel.indexOf(deny) !== -1) {
      return { ok: false, action: 'read_file', reason: 'name_denied', match: deny };
    }
  }
  // Size cap.
  if (lst.size > READ_FILE_MAX_BYTES) {
    return { ok: false, action: 'read_file', reason: 'too_large', size: lst.size, max: READ_FILE_MAX_BYTES };
  }
  let buf;
  try { buf = fs.readFileSync(real); } catch (e) {
    return { ok: false, action: 'read_file', reason: 'read_failed', error: String(e && e.message || e).slice(0, 200) };
  }
  return {
    ok: true,
    action: 'read_file',
    path: rel,
    size: buf.length,
    encoding: 'base64',
    content: buf.toString('base64'),
    timestamp: new Date().toISOString(),
  };
}

async function _action_write_file(params) {
  const rawPath = params && typeof params.path === 'string' ? params.path.trim() : '';
  const content = params && typeof params.content === 'string' ? params.content : '';
  if (!rawPath) return { ok: false, action: 'write_file', reason: 'path_required' };
  if (rawPath.indexOf('\0') !== -1) return { ok: false, action: 'write_file', reason: 'invalid_path' };
  const bytes = Buffer.byteLength(content || '', 'utf8');
  if (bytes > WRITE_FILE_MAX_BYTES) {
    return { ok: false, action: 'write_file', reason: 'content_too_large', bytes, max: WRITE_FILE_MAX_BYTES };
  }

  const resolved = _resolveWithinRoot(WRITE_FILE_ROOT, rawPath);
  if (!resolved.ok) return { ok: false, action: 'write_file', reason: resolved.reason };

  const ext = path.extname(resolved.abs).toLowerCase();
  if (!READ_FILE_EXT_ALLOWLIST.includes(ext)) {
    return { ok: false, action: 'write_file', reason: 'extension_not_allowed', allowed: READ_FILE_EXT_ALLOWLIST };
  }

  try {
    fs.mkdirSync(path.dirname(resolved.abs), { recursive: true });
    fs.writeFileSync(resolved.abs, content, { encoding: 'utf8' });
  } catch (e) {
    return { ok: false, action: 'write_file', reason: 'write_failed', error: String(e && e.message || e).slice(0, 200) };
  }

  const pipeline = await _runPostMutationPipeline({ action: 'write_file', path: resolved.rel, mode: 'upsert' });
  _appendAutonomousLog({ ts: new Date().toISOString(), action: 'write_file', path: resolved.rel, bytes, pipeline });

  return {
    ok: true,
    action: 'write_file',
    note: 'written_to_autonomy_root',
    path: resolved.rel,
    bytes,
    pipeline,
    timestamp: new Date().toISOString(),
  };
}

async function _action_create_file(params) {
  const rawPath = params && typeof params.path === 'string' ? params.path.trim() : '';
  const content = params && typeof params.content === 'string' ? params.content : '';
  if (!rawPath) return { ok: false, action: 'create_file', reason: 'path_required' };
  const resolved = _resolveWithinRoot(WRITE_FILE_ROOT, rawPath);
  if (!resolved.ok) return { ok: false, action: 'create_file', reason: resolved.reason };
  if (fs.existsSync(resolved.abs)) return { ok: false, action: 'create_file', reason: 'already_exists' };
  const bytes = Buffer.byteLength(content || '', 'utf8');
  if (bytes > WRITE_FILE_MAX_BYTES) return { ok: false, action: 'create_file', reason: 'content_too_large', bytes, max: WRITE_FILE_MAX_BYTES };
  const ext = path.extname(resolved.abs).toLowerCase();
  if (!READ_FILE_EXT_ALLOWLIST.includes(ext)) return { ok: false, action: 'create_file', reason: 'extension_not_allowed', allowed: READ_FILE_EXT_ALLOWLIST };
  try {
    fs.mkdirSync(path.dirname(resolved.abs), { recursive: true });
    fs.writeFileSync(resolved.abs, content, { encoding: 'utf8', flag: 'wx' });
  } catch (e) {
    return { ok: false, action: 'create_file', reason: 'create_failed', error: String(e && e.message || e).slice(0, 200) };
  }
  const pipeline = await _runPostMutationPipeline({ action: 'create_file', path: resolved.rel, mode: 'create' });
  _appendAutonomousLog({ ts: new Date().toISOString(), action: 'create_file', path: resolved.rel, bytes, pipeline });
  return { ok: true, action: 'create_file', path: resolved.rel, bytes, pipeline, timestamp: new Date().toISOString() };
}

async function _action_move_file(params) {
  const fromPath = params && typeof params.from === 'string' ? params.from.trim() : '';
  const toPath = params && typeof params.to === 'string' ? params.to.trim() : '';
  if (!fromPath || !toPath) return { ok: false, action: 'move_file', reason: 'from_to_required' };
  const fromResolved = _resolveWithinRoot(WRITE_FILE_ROOT, fromPath, { mustExist: true });
  if (!fromResolved.ok) return { ok: false, action: 'move_file', reason: fromResolved.reason, which: 'from' };
  const toResolved = _resolveWithinRoot(WRITE_FILE_ROOT, toPath);
  if (!toResolved.ok) return { ok: false, action: 'move_file', reason: toResolved.reason, which: 'to' };
  if (fs.existsSync(toResolved.abs)) return { ok: false, action: 'move_file', reason: 'destination_exists' };
  try {
    fs.mkdirSync(path.dirname(toResolved.abs), { recursive: true });
    fs.renameSync(fromResolved.abs, toResolved.abs);
  } catch (e) {
    return { ok: false, action: 'move_file', reason: 'move_failed', error: String(e && e.message || e).slice(0, 200) };
  }
  const pipeline = await _runPostMutationPipeline({ action: 'move_file', path: `${fromResolved.rel} -> ${toResolved.rel}`, mode: 'move' });
  _appendAutonomousLog({ ts: new Date().toISOString(), action: 'move_file', from: fromResolved.rel, to: toResolved.rel, pipeline });
  return { ok: true, action: 'move_file', from: fromResolved.rel, to: toResolved.rel, pipeline, timestamp: new Date().toISOString() };
}

async function _action_delete_file(params) {
  const rawPath = params && typeof params.path === 'string' ? params.path.trim() : '';
  if (!rawPath) return { ok: false, action: 'delete_file', reason: 'path_required' };
  const resolved = _resolveWithinRoot(AUTONOMY_ROOT, rawPath, { mustExist: true });
  if (!resolved.ok) return { ok: false, action: 'delete_file', reason: resolved.reason };
  const allowedRoot = _allowedDeleteRootFor(resolved.abs);
  if (!allowedRoot) return { ok: false, action: 'delete_file', reason: 'delete_root_not_allowed', allowedRoots: DELETE_FILE_ROOTS };
  let stat;
  try { stat = fs.lstatSync(resolved.abs); } catch (_) { return { ok: false, action: 'delete_file', reason: 'not_found' }; }
  if (!stat.isFile()) return { ok: false, action: 'delete_file', reason: 'only_files_allowed' };
  try {
    fs.unlinkSync(resolved.abs);
  } catch (e) {
    return { ok: false, action: 'delete_file', reason: 'delete_failed', error: String(e && e.message || e).slice(0, 200) };
  }
  const pipeline = await _runPostMutationPipeline({ action: 'delete_file', path: resolved.rel, mode: 'delete' });
  _appendAutonomousLog({ ts: new Date().toISOString(), action: 'delete_file', path: resolved.rel, bytes: stat.size, pipeline });
  return { ok: true, action: 'delete_file', path: resolved.rel, bytes: stat.size, pipeline, timestamp: new Date().toISOString() };
}

async function _action_execute_safe_script(params) {
  const rawScript = params && typeof params.script === 'string' ? params.script.trim() : '';
  const args = Array.isArray(params && params.args) ? params.args.slice(0, 12).map((arg) => String(arg).slice(0, 240)) : [];
  if (!rawScript) return { ok: false, action: 'execute_safe_script', reason: 'script_required' };
  const resolved = _resolveWithinRoot(SAFE_SCRIPT_ROOT, rawScript, { mustExist: true });
  if (!resolved.ok) return { ok: false, action: 'execute_safe_script', reason: resolved.reason };
  const ext = path.extname(resolved.abs).toLowerCase();
  if (!['.sh', '.bash', '.js', '.mjs', '.cjs'].includes(ext)) return { ok: false, action: 'execute_safe_script', reason: 'script_extension_not_allowed' };
  const stat = fs.statSync(resolved.abs);
  if (!stat.isFile()) return { ok: false, action: 'execute_safe_script', reason: 'not_a_file' };
  const cmd = ext === '.js' ? process.execPath : resolved.abs;
  const cmdArgs = ['.js', '.mjs', '.cjs'].includes(ext) ? [resolved.abs, ...args] : args;
  const result = await _runCommand(cmd, cmdArgs, {
    cwd: path.dirname(resolved.abs),
    env: { ...process.env, AUTONOMY_ROOT, SANDBOX_ROOT },
    timeoutMs: Math.max(RUN_TEST_TIMEOUT_MS, 120000),
  });
  _appendAutonomousLog({ ts: new Date().toISOString(), action: 'execute_safe_script', script: resolved.rel, args, result });
  return { ok: !!result.ok, action: 'execute_safe_script', script: resolved.rel, args, ...result, timestamp: new Date().toISOString() };
}

function _action_git_commit(params) {
  const message = params && typeof params.message === 'string' ? params.message.slice(0, 180) : 'deepseek-governor intent commit';
  return {
    ok: true,
    action: 'git_commit',
    mode: 'intent_logged',
    note: 'git commit intent recorded; no shell/git execution from governor',
    message,
    timestamp: new Date().toISOString(),
  };
}

function _action_deploy(params) {
  const target = params && typeof params.target === 'string' ? params.target.slice(0, 120) : 'hetzner-main';
  return {
    ok: true,
    action: 'deploy',
    mode: 'intent_logged',
    note: 'deploy intent recorded; no direct deploy execution from governor',
    target,
    timestamp: new Date().toISOString(),
  };
}

function _sanitizeGitHubRepo(repo) {
  const raw = String(repo || '').trim();
  if (!raw) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) return null;
  return raw;
}

function _githubRequestJson(method, apiPath, bodyObj) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(apiPath, GITHUB_API_BASE);
    } catch (_) {
      resolve({ ok: false, reason: 'invalid_github_url' });
      return;
    }
    const payload = bodyObj ? JSON.stringify(bodyObj) : '';
    const headers = {
      'User-Agent': 'unicorn-deepseek-governor',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request({
      method,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      headers,
      timeout: 12_000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = rawBody ? JSON.parse(rawBody) : null; } catch (_) { /* non-json */ }
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          data: parsed,
          bodyPreview: String(rawBody || '').slice(0, 800),
        });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, reason: 'github_timeout' });
    });
    req.on('error', (e) => {
      resolve({ ok: false, reason: 'github_request_failed', error: String(e && e.message || e).slice(0, 200) });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function _action_github_clone_repo(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const branch = params && typeof params.branch === 'string' ? params.branch.slice(0, 120) : 'main';
  const destination = params && typeof params.destination === 'string' ? params.destination.slice(0, 240) : path.join(AUTONOMY_ROOT, 'contrib', (repo || '').replace('/', '_'));
  if (!repo) return { ok: false, action: 'github_clone_repo', reason: 'invalid_repo' };
  const resolved = _resolveWithinRoot(AUTONOMY_ROOT, destination.startsWith('/opt/unicorn/') ? destination.replace('/opt/unicorn/', '') : destination);
  if (!resolved.ok) return { ok: false, action: 'github_clone_repo', reason: resolved.reason };
  const cloneResult = _runCommand('git', ['clone', '--depth', '1', '--branch', branch, `https://github.com/${repo}.git`, resolved.abs], {
    cwd: AUTONOMY_ROOT,
    timeoutMs: 120000,
  });
  return cloneResult.then((result) => ({
    ok: !!result.ok,
    action: 'github_clone_repo',
    repo,
    branch,
    destination: resolved.abs,
    ...result,
    timestamp: new Date().toISOString(),
  }));
}

async function _action_github_create_branch(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const branch = params && typeof params.branch === 'string' ? params.branch.trim().slice(0, 120) : '';
  const from = params && typeof params.from === 'string' ? params.from.trim().slice(0, 120) : 'main';
  if (!repo || !branch) return { ok: false, action: 'github_create_branch', reason: 'repo_branch_required' };
  if (!GITHUB_TOKEN) return { ok: false, action: 'github_create_branch', reason: 'missing_github_token' };
  const ref = await _githubRequestJson('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(from)}`);
  if (!ref.ok || !ref.data || !ref.data.object || !ref.data.object.sha) {
    return { ok: false, action: 'github_create_branch', reason: 'source_branch_not_found', status: ref.status || 0, bodyPreview: ref.bodyPreview || '' };
  }
  const create = await _githubRequestJson('POST', `/repos/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: ref.data.object.sha,
  });
  if (!create.ok) {
    return { ok: false, action: 'github_create_branch', reason: 'create_branch_failed', status: create.status || 0, bodyPreview: create.bodyPreview || '' };
  }
  return { ok: true, action: 'github_create_branch', repo, branch, from, timestamp: new Date().toISOString() };
}

async function _action_github_commit_push(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const branch = params && typeof params.branch === 'string' ? params.branch.trim().slice(0, 120) : 'main';
  const filePath = params && typeof params.path === 'string' ? params.path.trim().replace(/^\/+/, '') : '';
  const message = params && typeof params.message === 'string' ? params.message.slice(0, 240) : 'DeepSeek autonomous update';
  const contentRaw = params && typeof params.content === 'string' ? params.content : '';
  const isBase64 = params && params.encoding === 'base64';
  const sha = params && typeof params.sha === 'string' ? params.sha.slice(0, 80) : undefined;
  if (!repo || !filePath || !contentRaw) return { ok: false, action: 'github_commit_push', reason: 'repo_path_content_required' };
  if (!GITHUB_TOKEN) return { ok: false, action: 'github_commit_push', reason: 'missing_github_token' };
  const contentB64 = isBase64 ? contentRaw : Buffer.from(contentRaw, 'utf8').toString('base64');
  const write = await _githubRequestJson('PUT', `/repos/${repo}/contents/${filePath}`, {
    message,
    content: contentB64,
    branch,
    ...(sha ? { sha } : {}),
  });
  if (!write.ok) {
    return { ok: false, action: 'github_commit_push', reason: 'commit_push_failed', status: write.status || 0, bodyPreview: write.bodyPreview || '' };
  }
  return {
    ok: true,
    action: 'github_commit_push',
    repo,
    branch,
    path: filePath,
    commitSha: write.data && write.data.commit && write.data.commit.sha ? write.data.commit.sha : null,
    timestamp: new Date().toISOString(),
  };
}

async function _action_github_create_pr(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const head = params && typeof params.head === 'string' ? params.head.slice(0, 180) : '';
  const base = params && typeof params.base === 'string' ? params.base.slice(0, 180) : 'main';
  const title = params && typeof params.title === 'string' ? params.title.slice(0, 240) : '';
  const body = params && typeof params.body === 'string' ? params.body.slice(0, 4000) : '';
  if (!repo || !head || !title) {
    return { ok: false, action: 'github_create_pr', reason: 'repo_head_title_required' };
  }
  if (!GITHUB_TOKEN) return { ok: false, action: 'github_create_pr', reason: 'missing_github_token' };
  const pr = await _githubRequestJson('POST', `/repos/${repo}/pulls`, {
    title,
    head,
    base,
    body,
  });
  if (!pr.ok) {
    return {
      ok: false,
      action: 'github_create_pr',
      reason: 'create_pr_failed',
      status: pr.status || 0,
      bodyPreview: pr.bodyPreview || '',
    };
  }
  return {
    ok: true,
    action: 'github_create_pr',
    repo,
    head,
    base,
    title,
    number: pr.data && pr.data.number ? pr.data.number : null,
    htmlUrl: pr.data && pr.data.html_url ? pr.data.html_url : null,
    timestamp: new Date().toISOString(),
  };
}

async function _action_github_merge_pr(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const pullNumber = parseInt(params && params.pullNumber, 10);
  const mergeMethod = params && typeof params.mergeMethod === 'string' ? params.mergeMethod.toLowerCase() : 'squash';
  const commitTitle = params && typeof params.commitTitle === 'string' ? params.commitTitle.slice(0, 240) : '';
  if (!repo || !Number.isFinite(pullNumber) || pullNumber <= 0) {
    return { ok: false, action: 'github_merge_pr', reason: 'invalid_repo_or_pull_number' };
  }
  if (!['merge', 'squash', 'rebase'].includes(mergeMethod)) {
    return { ok: false, action: 'github_merge_pr', reason: 'invalid_merge_method', allowed: ['merge', 'squash', 'rebase'] };
  }
  if (!GITHUB_TOKEN) return { ok: false, action: 'github_merge_pr', reason: 'missing_github_token' };
  const merged = await _githubRequestJson('PUT', `/repos/${repo}/pulls/${pullNumber}/merge`, {
    merge_method: mergeMethod,
    ...(commitTitle ? { commit_title: commitTitle } : {}),
  });
  if (!merged.ok) {
    return {
      ok: false,
      action: 'github_merge_pr',
      reason: 'merge_failed',
      status: merged.status || 0,
      bodyPreview: merged.bodyPreview || '',
    };
  }
  return {
    ok: true,
    action: 'github_merge_pr',
    repo,
    pullNumber,
    mergeMethod,
    commitTitle,
    merged: !!(merged.data && merged.data.merged),
    timestamp: new Date().toISOString(),
  };
}

function _action_merge_pr(params) {
  return _action_github_merge_pr(params);
}

async function _action_github_trigger_workflow(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const workflowId = params && typeof params.workflowId === 'string' ? params.workflowId.slice(0, 180) : '';
  const ref = params && typeof params.ref === 'string' ? params.ref.slice(0, 120) : 'main';
  const inputs = (params && params.inputs && typeof params.inputs === 'object') ? params.inputs : undefined;
  if (!repo || !workflowId) return { ok: false, action: 'github_trigger_workflow', reason: 'repo_workflow_required' };
  if (!GITHUB_TOKEN) return { ok: false, action: 'github_trigger_workflow', reason: 'missing_github_token' };
  const run = await _githubRequestJson('POST', `/repos/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`, {
    ref,
    ...(inputs ? { inputs } : {}),
  });
  if (!run.ok && run.status !== 204) {
    return { ok: false, action: 'github_trigger_workflow', reason: 'workflow_dispatch_failed', status: run.status || 0, bodyPreview: run.bodyPreview || '' };
  }
  return { ok: true, action: 'github_trigger_workflow', repo, workflowId, ref, timestamp: new Date().toISOString() };
}

async function _action_github_comment_issue(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const issueNumber = parseInt(params && params.issueNumber, 10);
  const body = params && typeof params.body === 'string' ? params.body.slice(0, 8000) : '';
  if (!repo || !Number.isFinite(issueNumber) || issueNumber <= 0 || !body) {
    return { ok: false, action: 'github_comment_issue', reason: 'repo_issue_body_required' };
  }
  if (!GITHUB_TOKEN) return { ok: false, action: 'github_comment_issue', reason: 'missing_github_token' };
  const comment = await _githubRequestJson('POST', `/repos/${repo}/issues/${issueNumber}/comments`, { body });
  if (!comment.ok) {
    return { ok: false, action: 'github_comment_issue', reason: 'comment_failed', status: comment.status || 0, bodyPreview: comment.bodyPreview || '' };
  }
  return {
    ok: true,
    action: 'github_comment_issue',
    repo,
    issueNumber,
    htmlUrl: comment.data && comment.data.html_url ? comment.data.html_url : null,
    timestamp: new Date().toISOString(),
  };
}

async function _action_github_read_repo(params) {
  return _action_browse_github(params);
}

async function _action_browse_github(params) {
  const repo = _sanitizeGitHubRepo(params && params.repo);
  const branch = params && typeof params.branch === 'string' ? params.branch.slice(0, 120) : '';
  const filePath = params && typeof params.path === 'string' ? params.path.trim().replace(/^\/+/, '') : '';
  if (!repo) return { ok: false, action: 'browse_github', reason: 'invalid_repo' };
  const refQ = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const apiPath = filePath
    ? `/repos/${repo}/contents/${filePath}${refQ}`
    : `/repos/${repo}/contents${refQ}`;
  const result = await _githubRequestJson('GET', apiPath);
  if (!result.ok) {
    return {
      ok: false,
      action: 'browse_github',
      reason: result.reason || 'github_api_failed',
      status: result.status || 0,
      bodyPreview: result.bodyPreview || '',
    };
  }
  const data = result.data;
  if (Array.isArray(data)) {
    return {
      ok: true,
      action: 'browse_github',
      repo,
      path: filePath || '',
      branch: branch || null,
      items: data.slice(0, 100).map((it) => ({ name: it.name, type: it.type, path: it.path, size: it.size || 0 })),
      timestamp: new Date().toISOString(),
    };
  }
  return {
    ok: true,
    action: 'browse_github',
    repo,
    path: filePath || '',
    branch: branch || null,
    item: data ? {
      name: data.name,
      type: data.type,
      path: data.path,
      size: data.size || 0,
      sha: data.sha || '',
      encoding: data.encoding || null,
      content: typeof data.content === 'string' ? data.content.slice(0, 200000) : null,
    } : null,
    timestamp: new Date().toISOString(),
  };
}

async function _action_search_github(params) {
  const query = params && typeof params.query === 'string' ? params.query.trim().slice(0, 240) : '';
  const type = params && typeof params.type === 'string' ? params.type.toLowerCase() : 'code';
  if (!query) return { ok: false, action: 'search_github', reason: 'query_required' };
  if (!['code', 'repositories', 'issues', 'commits'].includes(type)) {
    return { ok: false, action: 'search_github', reason: 'invalid_type', allowed: ['code', 'repositories', 'issues', 'commits'] };
  }
  const apiPath = `/search/${type}?q=${encodeURIComponent(query)}&per_page=20`;
  const result = await _githubRequestJson('GET', apiPath);
  if (!result.ok) {
    return {
      ok: false,
      action: 'search_github',
      reason: result.reason || 'github_api_failed',
      status: result.status || 0,
      bodyPreview: result.bodyPreview || '',
    };
  }
  const items = Array.isArray(result.data && result.data.items) ? result.data.items : [];
  return {
    ok: true,
    action: 'search_github',
    type,
    query,
    totalCount: Number(result.data && result.data.total_count) || items.length,
    items: items.slice(0, 20).map((it) => ({
      name: it.name || null,
      fullName: it.full_name || null,
      path: it.path || null,
      htmlUrl: it.html_url || null,
      repository: it.repository && it.repository.full_name ? it.repository.full_name : null,
      score: it.score || null,
    })),
    timestamp: new Date().toISOString(),
  };
}

function _action_read_status() {
  // Curated, public-safe status snapshot — no secrets, no full file reads.
  // Snapshot de status curat — fără secrete, fără citire de fișiere arbitrare.
  const mem = process.memoryUsage();
  const roadmap = _readRoadmapSafe();
  let proposalCount = 0;
  try {
    if (fs.existsSync(PROPOSALS_DIR)) {
      proposalCount = fs.readdirSync(PROPOSALS_DIR).filter(f => f.endsWith('.json')).length;
    }
  } catch (_) { /* best-effort */ }
  const pendingCommands = _listCommands({ limit: 5, includeConsumed: false });
  return {
    ok: true,
    action: 'read_status',
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    memory: { rssMb: +(mem.rss / 1024 / 1024).toFixed(1), heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(1) },
    nodeEnv: process.env.NODE_ENV || 'development',
    pricingSnapshotAvailable: !!(_refs.livePricingBroker && typeof _refs.livePricingBroker.getSnapshot === 'function'),
    roadmap: roadmap ? {
      vision: roadmap.vision || '',
      northStarMetric: roadmap.northStarMetric || '',
      currentPhase: roadmap.currentPhase || '',
      objectivesTotal: roadmap.objectives.length,
      objectivesDone: roadmap.objectives.filter(o => o && o.status === 'done').length,
      topPriorityOpen: roadmap.objectives
        .filter(o => o && o.status !== 'done')
        .sort((a, b) => (a.priority || 99) - (b.priority || 99))
        .slice(0, 5)
        .map(o => ({ id: o.id, title: o.title, status: o.status, priority: o.priority })),
    } : null,
    autonomy: {
      proposalCount,
      pendingCommandCount: pendingCommands.length,
      autonomyRoot: AUTONOMY_ROOT,
      sandboxRoot: SANDBOX_ROOT,
      actionLogPath: AUTONOMOUS_ACTION_LOG_PATH,
      cleanupCandidates: _collectCleanupCandidates(),
      nextCommandPreview: pendingCommands[0]
        ? { id: pendingCommands[0].id, priority: pendingCommands[0].priority, preview: String(pendingCommands[0].instruction).slice(0, 200) }
        : null,
    },
    timestamp: new Date().toISOString(),
  };
}

async function _action_prices_sync() {
  const broker = _refs.livePricingBroker;
  if (!broker || typeof broker._refresh !== 'function') {
    return { ok: false, action: 'prices_sync', reason: 'broker_unavailable' };
  }
  try {
    await broker._refresh();
    const snap = (typeof broker.getSnapshot === 'function') ? broker.getSnapshot() : null;
    return {
      ok: true,
      action: 'prices_sync',
      itemsCount: snap && Array.isArray(snap.items) ? snap.items.length : 0,
      btcRate: snap && snap.btcRate ? snap.btcRate.usd || null : null,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, action: 'prices_sync', reason: 'refresh_failed', error: String(e && e.message || e).slice(0, 200) };
  }
}

async function _action_checkout_fix() {
  // Read-only fix: re-validates pricing snapshot freshness and flags the
  // checkout subsystem as healthy/unhealthy. Does NOT mutate user data or
  // re-issue payments. If you need a destructive checkout repair, do it
  // through a human-reviewed admin endpoint, not through the governor.
  const broker = _refs.livePricingBroker;
  const snapshotOk = !!(broker && typeof broker.getSnapshot === 'function' && broker.getSnapshot());
  return {
    ok: true,
    action: 'checkout_fix',
    pricingSnapshotOk: snapshotOk,
    note: 'read-only health check; no mutations performed',
    timestamp: new Date().toISOString(),
  };
}

async function _action_full_backup(params) {
  const label = params && typeof params.label === 'string' ? params.label.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) : 'auto';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(AUTONOMY_ROOT, 'old_backups');
  const archiveName = `unicorn-${label}-${ts}.tar.gz`;
  const archivePath = path.join(backupDir, archiveName);
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch (_) { /* noop */ }
  const result = await _runCommand('tar', ['-czf', archivePath, '-C', AUTONOMY_ROOT, '.'], {
    cwd: AUTONOMY_ROOT,
    timeoutMs: 300000,
  });
  return {
    ok: !!result.ok,
    action: 'full_backup',
    backupPath: archivePath,
    ...result,
    timestamp: new Date().toISOString(),
  };
}

async function _action_restore_backup(params) {
  const backupRel = params && typeof params.backupPath === 'string' ? params.backupPath.trim() : '';
  const confirm = params && params.confirm === true;
  if (!backupRel) return { ok: false, action: 'restore_backup', reason: 'backup_path_required' };
  if (!confirm) return { ok: false, action: 'restore_backup', reason: 'confirm_required_for_restore' };
  const resolved = _resolveWithinRoot(path.join(AUTONOMY_ROOT, 'old_backups'), backupRel, { mustExist: true });
  if (!resolved.ok) return { ok: false, action: 'restore_backup', reason: resolved.reason };
  const restoreDir = path.join(AUTONOMY_ROOT, 'restores', `restore-${Date.now()}`);
  try { fs.mkdirSync(restoreDir, { recursive: true }); } catch (_) { /* noop */ }
  const result = await _runCommand('tar', ['-xzf', resolved.abs, '-C', restoreDir], {
    cwd: AUTONOMY_ROOT,
    timeoutMs: 300000,
  });
  return {
    ok: !!result.ok,
    action: 'restore_backup',
    backupPath: resolved.abs,
    restoreDir,
    mode: 'restored_to_staging',
    ...result,
    timestamp: new Date().toISOString(),
  };
}

function _action_analyze_logs(params) {
  const latestLog = (dir, prefix) => {
    try {
      const entries = fs.readdirSync(dir)
        .filter((name) => name.startsWith(prefix) && name.endsWith('.log'))
        .map((name) => {
          const abs = path.join(dir, name);
          const stat = fs.statSync(abs);
          return { abs, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      return entries[0] && entries[0].abs;
    } catch (_) {
      return null;
    }
  };
  const livePm2LogDir = '/var/www/unicorn/UNICORN_FINAL/logs';
  const pm2LogDir = fs.existsSync(livePm2LogDir) ? livePm2LogDir : path.join(AUTONOMY_ROOT, 'logs');
  const serviceLogMap = {
    'unicorn-backend': latestLog(pm2LogDir, 'pm2-error-') || path.join(pm2LogDir, 'pm2-error-0.log'),
    'unicorn-site': latestLog(pm2LogDir, 'pm2-error-') || path.join(pm2LogDir, 'pm2-error-1.log'),
    'deepseek-unified': path.join(AUTONOMY_ROOT, 'data', 'logs', 'deepseek-unified.log'),
    'deepseek-loop': path.join(AUTONOMY_ROOT, 'data', 'logs', 'deepseek-loop.log'),
    governor: path.join(AUTONOMY_ROOT, 'data', 'logs', 'deepseek-governor.log'),
  };
  const rawRequested = params && typeof params.path === 'string'
    ? params.path.trim()
    : (params && typeof params.target === 'string' ? params.target.trim() : '');
  const requestedService = params && typeof params.service === 'string' ? params.service.trim() : '';
  const requested = rawRequested || serviceLogMap[requestedService] || serviceLogMap.governor;
  const target = path.isAbsolute(requested) ? requested : path.join(AUTONOMY_ROOT, requested);
  const maxLines = Math.max(20, Math.min(2000, parseInt(params && params.maxLines, 10) || 400));
  const allowedRoots = [AUTONOMY_ROOT, '/var/log', '/var/www/unicorn/UNICORN_FINAL/logs'];
  const isAllowed = allowedRoots.some((root) => {
    const rel = path.relative(path.resolve(root), path.resolve(target));
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });
  if (!isAllowed) return { ok: false, action: 'analyze_logs', reason: 'path_outside_allowed_roots', allowedRoots };
  if (!fs.existsSync(target)) return { ok: false, action: 'analyze_logs', reason: 'not_found', path: target, service: requestedService || null };
  const stat = fs.statSync(target);
  if (!stat.isFile()) return { ok: false, action: 'analyze_logs', reason: 'not_a_file', path: target, service: requestedService || null };
  const content = fs.readFileSync(target, 'utf8');
  const lines = content.split('\n').slice(-maxLines);
  const patterns = {
    error: /error|fatal|exception|panic/i,
    warn: /warn|warning/i,
    timeout: /timeout|timed out|econnreset|econnrefused/i,
    auth: /401|403|unauthorized|forbidden|token/i,
  };
  const counters = Object.fromEntries(Object.keys(patterns).map((k) => [k, 0]));
  for (const line of lines) {
    for (const [key, rx] of Object.entries(patterns)) {
      if (rx.test(line)) counters[key] += 1;
    }
  }
  return {
    ok: true,
    action: 'analyze_logs',
    path: target,
    scannedLines: lines.length,
    counters,
    tail: lines.slice(-120),
    timestamp: new Date().toISOString(),
  };
}

function _action_rollback_deploy(params) {
  const confirm = params && params.confirm === true;
  if (!confirm) return { ok: false, action: 'rollback_deploy', reason: 'confirm_required_for_rollback' };
  const releasesRoot = '/var/www/unicorn/releases';
  const currentLink = '/var/www/unicorn/current';
  if (!fs.existsSync(releasesRoot) || !fs.existsSync(currentLink)) {
    return { ok: false, action: 'rollback_deploy', reason: 'release_structure_missing' };
  }
  const currentTarget = fs.realpathSync(currentLink);
  const releases = fs.readdirSync(releasesRoot)
    .map((name) => ({
      name,
      full: path.join(releasesRoot, name),
      mtime: fs.statSync(path.join(releasesRoot, name)).mtimeMs,
    }))
    .filter((r) => fs.statSync(r.full).isDirectory())
    .sort((a, b) => b.mtime - a.mtime);
  const previous = releases.find((r) => r.full !== currentTarget);
  if (!previous) return { ok: false, action: 'rollback_deploy', reason: 'no_previous_release' };
  try {
    fs.unlinkSync(currentLink);
    fs.symlinkSync(previous.full, currentLink);
    return {
      ok: true,
      action: 'rollback_deploy',
      from: currentTarget,
      to: previous.full,
      note: 'pm2/systemctl restart may still be required by supervisor',
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, action: 'rollback_deploy', reason: 'rollback_failed', error: String(e && e.message || e).slice(0, 200) };
  }
}

function _action_run_test() {
  const cwd = fs.existsSync(path.join(SANDBOX_ROOT, 'package.json'))
    ? SANDBOX_ROOT
    : path.resolve(__dirname, '..', '..');
  return _runCommand('npm', ['test', '--silent'], {
    cwd,
    env: { ...process.env, NODE_ENV: 'test', CI: '1' },
    timeoutMs: RUN_TEST_TIMEOUT_MS,
  }).then((result) => ({ ...result, action: 'run_test', cwd }));
}

function _action_restart_service(params) {
  // INTENT ONLY — we never spawn systemctl/pm2 from inside Node.
  // A separate (human-owned) supervisor watches the log for "restart_request"
  // entries and decides whether to act. This keeps the privilege boundary
  // strictly at the OS level.
  // DOAR INTENȚIE — nu invocăm systemctl/pm2 din Node. Un supervisor uman
  // urmărește log-ul pentru "restart_request" și decide.
  const svc = params && typeof params.service === 'string' ? params.service : '';
  if (!RESTARTABLE_SERVICES.includes(svc)) {
    return { ok: false, action: 'restart_service', reason: 'service_not_allowed', allowed: RESTARTABLE_SERVICES };
  }
  return {
    ok: true,
    action: 'restart_service',
    mode: 'intent-logged',
    service: svc,
    note: 'restart intent recorded; no exec performed by governor — supervisor must consume the log entry',
    timestamp: new Date().toISOString(),
  };
}

// -------- code_proposal handler / Handler propunere de cod -------------
// Writes an envelope-only file under PROPOSALS_DIR. NEVER touches source.
// Scrie un fișier de propunere; NU modifică niciodată codul-sursă.
function _validateProposalTargetPath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    return { ok: false, reason: 'target_path_required' };
  }
  if (targetPath.indexOf('\0') !== -1)        return { ok: false, reason: 'invalid_target' };
  if (path.isAbsolute(targetPath))            return { ok: false, reason: 'target_must_be_relative' };
  // Normalize without resolving (we don't need the file to exist).
  const norm = path.posix.normalize(targetPath.replace(/\\/g, '/'));
  if (norm.startsWith('../') || norm === '..' || norm.indexOf('/../') !== -1) {
    return { ok: false, reason: 'path_traversal' };
  }
  const lower = norm.toLowerCase();
  for (const pfx of PROPOSAL_TARGET_DENY_PREFIXES) {
    if (lower.startsWith(pfx.toLowerCase())) return { ok: false, reason: 'target_prefix_denied', match: pfx };
  }
  if (!PROPOSAL_TARGET_ALLOW_PREFIXES.some((pfx) => norm.startsWith(pfx))) {
    return { ok: false, reason: 'target_prefix_not_allowed', allowed: PROPOSAL_TARGET_ALLOW_PREFIXES };
  }
  for (const sfx of PROPOSAL_TARGET_DENY_SUFFIXES) {
    if (lower === sfx.toLowerCase() || lower.endsWith(sfx.toLowerCase())) {
      return { ok: false, reason: 'target_suffix_denied', match: sfx };
    }
  }
  const segs = norm.split('/');
  for (const seg of segs) {
    const segLower = seg.toLowerCase();
    for (const deny of READ_FILE_DENY_SEGMENTS) {
      if (segLower === deny.toLowerCase()) return { ok: false, reason: 'segment_denied', segment: seg };
    }
  }
  for (const deny of READ_FILE_DENY_SUBSTRINGS) {
    if (lower.indexOf(deny) !== -1) return { ok: false, reason: 'name_denied', match: deny };
  }
  const ext = path.extname(norm).toLowerCase();
  if (!READ_FILE_EXT_ALLOWLIST.includes(ext)) {
    return { ok: false, reason: 'extension_not_allowed', allowed: READ_FILE_EXT_ALLOWLIST };
  }
  return { ok: true, normalized: norm };
}

function _action_code_proposal(params) {
  const targetPath = params && params.targetPath;
  const rationale  = params && typeof params.rationale === 'string' ? params.rationale.slice(0, 4000) : '';
  const objectiveId = params && typeof params.objectiveId === 'string' ? params.objectiveId.slice(0, 128) : '';
  const proposedContent = params && typeof params.proposedContent === 'string' ? params.proposedContent : '';
  const riskLevel = params && typeof params.riskLevel === 'string' ? params.riskLevel.toLowerCase() : 'medium';

  if (!['low', 'medium', 'high'].includes(riskLevel)) {
    return { ok: false, action: 'code_proposal', reason: 'invalid_risk_level' };
  }
  if (!rationale) {
    return { ok: false, action: 'code_proposal', reason: 'rationale_required' };
  }
  const targetCheck = _validateProposalTargetPath(targetPath);
  if (!targetCheck.ok) {
    return { ok: false, action: 'code_proposal', reason: targetCheck.reason, match: targetCheck.match, segment: targetCheck.segment, allowed: targetCheck.allowed };
  }
  const contentBytes = Buffer.byteLength(proposedContent, 'utf8');
  if (contentBytes > PROPOSAL_MAX_BYTES) {
    return { ok: false, action: 'code_proposal', reason: 'proposed_content_too_large', size: contentBytes, max: PROPOSAL_MAX_BYTES };
  }
  if (!proposedContent) {
    return { ok: false, action: 'code_proposal', reason: 'proposed_content_required' };
  }

  // Per-day proposal cap to prevent disk floods.
  // Plafon zilnic pentru a preveni inundarea discului.
  try {
    fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = fs.readdirSync(PROPOSALS_DIR)
      .filter(f => f.startsWith(today + 'T') && f.endsWith('.json'))
      .length;
    if (todayCount >= PROPOSAL_MAX_FILES_PER_DAY) {
      return { ok: false, action: 'code_proposal', reason: 'daily_proposal_cap', cap: PROPOSAL_MAX_FILES_PER_DAY };
    }
  } catch (e) {
    return { ok: false, action: 'code_proposal', reason: 'proposals_dir_unavailable', error: String(e && e.message || e).slice(0, 200) };
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeSlug = (objectiveId || 'proposal').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const fileName = `${ts}-${safeSlug}.json`;
  const fullPath = path.join(PROPOSALS_DIR, fileName);

  const envelope = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    status: 'pending-review',
    objectiveId: objectiveId || null,
    targetPath: targetCheck.normalized,
    riskLevel,
    rationale,
    proposedContent,
    proposedContentBytes: contentBytes,
    note: 'Envelope only — code is NOT applied. Human/CI review required before any edit.',
  };

  try {
    fs.writeFileSync(fullPath, JSON.stringify(envelope, null, 2), { encoding: 'utf8' });
  } catch (e) {
    return { ok: false, action: 'code_proposal', reason: 'write_failed', error: String(e && e.message || e).slice(0, 200) };
  }

  return {
    ok: true,
    action: 'code_proposal',
    proposalId: fileName,
    targetPath: targetCheck.normalized,
    objectiveId: objectiveId || null,
    riskLevel,
    bytes: contentBytes,
    note: 'Proposal stored under PROPOSALS_DIR; requires human/CI review before apply.',
    timestamp: new Date().toISOString(),
  };
}

// roadmap_update handler — narrow scope: only `status` or `notes` of an
// existing objective may be changed. Adding new objectives or rewriting the
// vision requires a human edit of data/roadmap.json.
// Doar `status` / `notes` ale unui obiectiv existent; restul cere edit uman.
function _action_roadmap_update(params) {
  const objectiveId = params && typeof params.objectiveId === 'string' ? params.objectiveId.trim() : '';
  const newStatus = params && typeof params.status === 'string' ? params.status.trim().toLowerCase() : '';
  const note = params && typeof params.note === 'string' ? params.note.slice(0, 1000) : '';
  const ALLOWED_STATUSES = ['pending', 'in-progress', 'done', 'blocked'];

  if (!objectiveId) return { ok: false, action: 'roadmap_update', reason: 'objective_id_required' };
  if (newStatus && !ALLOWED_STATUSES.includes(newStatus)) {
    return { ok: false, action: 'roadmap_update', reason: 'invalid_status', allowed: ALLOWED_STATUSES };
  }

  let roadmap;
  try {
    roadmap = JSON.parse(fs.readFileSync(ROADMAP_PATH, 'utf8'));
  } catch (e) {
    return { ok: false, action: 'roadmap_update', reason: 'roadmap_unavailable', error: String(e && e.message || e).slice(0, 200) };
  }
  if (!roadmap || !Array.isArray(roadmap.objectives)) {
    return { ok: false, action: 'roadmap_update', reason: 'roadmap_malformed' };
  }
  const target = roadmap.objectives.find(o => o && o.id === objectiveId);
  if (!target) return { ok: false, action: 'roadmap_update', reason: 'objective_not_found', objectiveId };

  if (newStatus) target.status = newStatus;
  if (note)      target.lastNote = note;
  target.updatedAt = new Date().toISOString();
  roadmap.updatedAt = target.updatedAt;

  try {
    fs.writeFileSync(ROADMAP_PATH, JSON.stringify(roadmap, null, 2), { encoding: 'utf8' });
  } catch (e) {
    return { ok: false, action: 'roadmap_update', reason: 'write_failed', error: String(e && e.message || e).slice(0, 200) };
  }
  return {
    ok: true,
    action: 'roadmap_update',
    objectiveId,
    status: target.status,
    timestamp: target.updatedAt,
  };
}

// -------- Operator command queue helpers / Coadă comenzi operator -------
// FIFO with priority — DeepSeek loop consumes the highest-priority oldest item.
function _enqueueCommand({ instruction, priority, actor, ip }) {
  const safeInstruction = String(instruction || '').slice(0, 4000);
  if (!safeInstruction.trim()) return { ok: false, reason: 'instruction_required' };
  const p = parseInt(priority, 10);
  const safePriority = Number.isFinite(p) ? Math.max(1, Math.min(10, p)) : 5;
  const id = 'cmd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const entry = {
    id,
    createdAt: new Date().toISOString(),
    priority: safePriority,
    instruction: safeInstruction,
    actor: String(actor || 'admin').slice(0, 64),
    ip: String(ip || 'unknown').slice(0, 64),
    consumed: false,
  };
  try {
    fs.mkdirSync(path.dirname(COMMAND_QUEUE_PATH), { recursive: true });
    fs.appendFileSync(COMMAND_QUEUE_PATH, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (e) {
    return { ok: false, reason: 'queue_write_failed', error: String(e && e.message || e).slice(0, 200) };
  }
  return { ok: true, id, priority: safePriority, createdAt: entry.createdAt };
}

function _listCommands({ limit, includeConsumed } = {}) {
  let lines = [];
  try {
    if (fs.existsSync(COMMAND_QUEUE_PATH)) {
      lines = fs.readFileSync(COMMAND_QUEUE_PATH, 'utf8').split('\n').filter(Boolean);
    }
  } catch (_) { /* ignore */ }
  const cap = Math.max(1, Math.min(COMMAND_QUEUE_MAX_ENTRIES, parseInt(limit, 10) || 50));
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < cap; i--) {
    try {
      const e = JSON.parse(lines[i]);
      if (!includeConsumed && e.consumed) continue;
      out.push(e);
    } catch (_) { /* skip malformed */ }
  }
  out.sort((a, b) => {
    const pd = (b.priority || 0) - (a.priority || 0);
    if (pd !== 0) return pd;
    const ac = String(a.createdAt || '');
    const bc = String(b.createdAt || '');
    return ac < bc ? -1 : ac > bc ? 1 : 0;
  });
  return out;
}

function _consumeNextCommand() {
  let lines = [];
  try {
    if (!fs.existsSync(COMMAND_QUEUE_PATH)) return null;
    lines = fs.readFileSync(COMMAND_QUEUE_PATH, 'utf8').split('\n').filter(Boolean);
  } catch (_) { return null; }
  let best = -1;
  let bestPrio = -1;
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const e = JSON.parse(lines[i]);
      parsed.push(e);
      if (!e.consumed && (e.priority || 0) > bestPrio) {
        bestPrio = e.priority || 0;
        best = i;
      }
    } catch (_) { parsed.push(null); }
  }
  if (best < 0) return null;
  const picked = parsed[best];
  parsed[best] = { ...picked, consumed: true, consumedAt: new Date().toISOString() };
  try {
    fs.writeFileSync(COMMAND_QUEUE_PATH,
      parsed.filter(Boolean).map(o => JSON.stringify(o)).join('\n') + '\n',
      { encoding: 'utf8' });
  } catch (_) { /* best effort */ }
  return picked;
}

function _readRoadmapSafe() {
  try {
    const r = JSON.parse(fs.readFileSync(ROADMAP_PATH, 'utf8'));
    if (r && Array.isArray(r.objectives)) return r;
  } catch (_) { /* ignore */ }
  return null;
}

// -------- Dispatcher / Dispecer ----------------------------------------
async function dispatch({ action, params, requestId, actor, ip }) {
  const safeAction = String(action || '').trim();
  const safeRequestId = String(requestId || '').trim().slice(0, 128);
  const safeIp = String(ip || 'unknown').slice(0, 64);

  if (!ALLOWED_ACTIONS.includes(safeAction)) {
    const entry = { ts: new Date().toISOString(), ip: safeIp, actor: actor || 'admin', action: safeAction, requestId: safeRequestId, ok: false, reason: 'action_not_allowed' };
    _appendLog(entry);
    return { status: 400, body: { error: 'action_not_allowed', allowed: ALLOWED_ACTIONS } };
  }

  // Idempotency by requestId / Idempotență după requestId
  _gcRequestIds();
  if (safeRequestId && _seenRequestIds.has(safeRequestId)) {
    const cached = _seenRequestIds.get(safeRequestId);
    return { status: 200, body: { ...cached.result, cached: true, requestId: safeRequestId } };
  }

  // Rate limiting (skipped only in test env so the suite is deterministic)
  if (process.env.NODE_ENV !== 'test') {
    const rl = _rateAllow(safeIp);
    if (!rl.ok) {
      const entry = { ts: new Date().toISOString(), ip: safeIp, actor: actor || 'admin', action: safeAction, requestId: safeRequestId, ok: false, reason: rl.reason };
      _appendLog(entry);
      return { status: 429, body: { error: 'rate_limited', reason: rl.reason, hourCount: rl.hourCount, dayCount: rl.dayCount } };
    }
  }

  let result;
  try {
    switch (safeAction) {
      case 'none':            result = _action_none(); break;
      case 'read_status':     result = _action_read_status(); break;
      case 'read_file':       result = _action_read_file(params); break;
      case 'write_file':      result = await _action_write_file(params); break;
      case 'create_file':     result = await _action_create_file(params); break;
      case 'move_file':       result = await _action_move_file(params); break;
      case 'delete_file':     result = await _action_delete_file(params); break;
      case 'execute_safe_script': result = await _action_execute_safe_script(params); break;
      case 'prices_sync':     result = await _action_prices_sync(); break;
      case 'checkout_fix':    result = await _action_checkout_fix(); break;
      case 'run_test':        result = await _action_run_test(); break;
      case 'restart_service': result = _action_restart_service(params); break;
      case 'git_commit':      result = _action_git_commit(params); break;
      case 'deploy':          result = _action_deploy(params); break;
      case 'github_clone_repo': result = await _action_github_clone_repo(params); break;
      case 'github_read_repo':   result = await _action_github_read_repo(params); break;
      case 'github_create_branch': result = await _action_github_create_branch(params); break;
      case 'github_commit_push': result = await _action_github_commit_push(params); break;
      case 'github_create_pr':  result = await _action_github_create_pr(params); break;
      case 'github_merge_pr':   result = await _action_github_merge_pr(params); break;
      case 'github_trigger_workflow': result = await _action_github_trigger_workflow(params); break;
      case 'github_comment_issue': result = await _action_github_comment_issue(params); break;
      case 'merge_pr':          result = await _action_merge_pr(params); break;
      case 'browse_github':     result = await _action_browse_github(params); break;
      case 'search_github':     result = await _action_search_github(params); break;
      case 'full_backup':     result = await _action_full_backup(params); break;
      case 'restore_backup':  result = await _action_restore_backup(params); break;
      case 'analyze_logs':    result = _action_analyze_logs(params); break;
      case 'rollback_deploy': result = _action_rollback_deploy(params); break;
      case 'code_proposal':   result = _action_code_proposal(params); break;
      case 'roadmap_update':  result = _action_roadmap_update(params); break;
      default:                result = { ok: false, reason: 'unreachable' };
    }
  } catch (e) {
    result = { ok: false, action: safeAction, reason: 'handler_threw', error: String(e && e.message || e).slice(0, 200) };
  }

  const logEntry = {
    ts: new Date().toISOString(),
    ip: safeIp,
    actor: actor || 'admin',
    action: safeAction,
    requestId: safeRequestId,
    ok: !!result.ok,
    ...(safeAction === 'restart_service' && result.ok ? { restart_request: result.service } : {}),
    summary: result.reason || result.note || (result.ok ? 'success' : 'failed'),
  };
  _appendLog(logEntry);

  if (safeRequestId) {
    _seenRequestIds.set(safeRequestId, { result, expiresAt: Date.now() + REQUEST_ID_TTL_MS });
  }

  return { status: result.ok ? 200 : 422, body: { ...result, requestId: safeRequestId || null } };
}

function getStatus() {
  _gcRequestIds();
  // Aggregate rate state without leaking individual IPs.
  let totalLastHour = 0;
  let totalLastDay = 0;
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo  = now - 24 * 60 * 60 * 1000;
  for (const arr of _rateState.values()) {
    for (const ts of arr) {
      if (ts > dayAgo) totalLastDay++;
      if (ts > hourAgo) totalLastHour++;
    }
  }
  return {
    ok: true,
    allowedActions: ALLOWED_ACTIONS,
    restartableServices: RESTARTABLE_SERVICES,
    limits: {
      perHourPerIp: RATE_LIMIT_PER_HOUR,
      perDayPerIp: RATE_LIMIT_PER_DAY,
      runTestTimeoutMs: RUN_TEST_TIMEOUT_MS,
      proposalMaxBytes: PROPOSAL_MAX_BYTES,
      proposalsMaxPerDay: PROPOSAL_MAX_FILES_PER_DAY,
      commandQueueMaxEntries: COMMAND_QUEUE_MAX_ENTRIES,
    },
    aggregate: { actionsLastHour: totalLastHour, actionsLastDay: totalLastDay, trackedIps: _rateState.size, pendingRequestIds: _seenRequestIds.size },
    paths: { logPath: LOG_PATH, proposalsDir: PROPOSALS_DIR, roadmapPath: ROADMAP_PATH, commandQueuePath: COMMAND_QUEUE_PATH, writeSandboxPath: WRITE_FILE_ROOT },
    autonomy: { root: AUTONOMY_ROOT, sandboxRoot: SANDBOX_ROOT, safeScriptRoot: SAFE_SCRIPT_ROOT, deleteRoots: DELETE_FILE_ROOTS, actionLogPath: AUTONOMOUS_ACTION_LOG_PATH },
    logPath: LOG_PATH,
  };
}

function configure(refs) {
  if (refs && typeof refs === 'object') {
    if ('livePricingBroker' in refs) _refs.livePricingBroker = refs.livePricingBroker;
    if ('logger' in refs)            _refs.logger = refs.logger;
  }
  return getStatus();
}

// Test-only reset / Reset doar pentru teste
function _resetForTests() {
  _rateState.clear();
  _seenRequestIds.clear();
}

module.exports = {
  ALLOWED_ACTIONS,
  RESTARTABLE_SERVICES,
  dispatch,
  getStatus,
  configure,
  _resetForTests,
  // Operator command queue (consumed by deepseek-loop / exposed via admin API).
  // Coadă de comenzi operator (consumată de deepseek-loop / expusă prin admin API).
  enqueueCommand: _enqueueCommand,
  listCommands: _listCommands,
  consumeNextCommand: _consumeNextCommand,
  readRoadmap: _readRoadmapSafe,
  // Test-only helpers (exported for the autonomous mode regression suite).
  _validateProposalTargetPath,
  PROPOSALS_DIR,
  ROADMAP_PATH,
  COMMAND_QUEUE_PATH,
};
