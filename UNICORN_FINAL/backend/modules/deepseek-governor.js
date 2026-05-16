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

// -------- Configuration / Configurație ---------------------------------
const RATE_LIMIT_PER_HOUR = parseInt(process.env.DEEPSEEK_GOVERNOR_HOURLY_LIMIT || '10', 10);
const RATE_LIMIT_PER_DAY  = parseInt(process.env.DEEPSEEK_GOVERNOR_DAILY_LIMIT  || '30', 10);
const RUN_TEST_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_GOVERNOR_RUN_TEST_TIMEOUT_MS || '30000', 10);
const LOG_PATH            = process.env.DEEPSEEK_GOVERNOR_LOG_PATH
                          || path.join(__dirname, '..', '..', 'data', 'logs', 'deepseek-governor.log');
const LOG_MAX_BYTES       = parseInt(process.env.DEEPSEEK_GOVERNOR_LOG_MAX_BYTES || String(2 * 1024 * 1024), 10);

// read_file safety envelope / Plicul de siguranță pentru read_file
const READ_FILE_ROOT      = path.resolve(process.env.DEEPSEEK_GOVERNOR_READ_ROOT || path.join(__dirname, '..', '..'));
const READ_FILE_MAX_BYTES = parseInt(process.env.DEEPSEEK_GOVERNOR_READ_MAX_BYTES || String(256 * 1024), 10);
const READ_FILE_EXT_ALLOWLIST = Object.freeze(['.js', '.json', '.yaml', '.yml', '.log', '.md', '.txt', '.html', '.css']);
// Deny tokens: any path segment matching one of these is rejected outright.
// Tokenuri interzise: orice segment de cale care se potrivește este respins.
const READ_FILE_DENY_SEGMENTS = Object.freeze([
  '.git', 'node_modules', '.ssh', '.npmrc', '.env',
  'secrets', 'private', 'credentials', 'id_rsa', 'id_ed25519',
]);
// Substring deny list applied to the full relative path (case-insensitive).
// Substring-uri interzise în calea relativă completă (case-insensitive).
const READ_FILE_DENY_SUBSTRINGS = Object.freeze([
  'secret', 'password', 'apikey', 'api_key', 'api-key',
  'token', 'jwt', 'private_key', 'privatekey',
]);

// Allowed action names. Anything else is rejected with HTTP 400.
// Numele acțiunilor permise. Orice altceva → respins (400).
const ALLOWED_ACTIONS = Object.freeze([
  'none',
  'read_status',
  'read_file',
  'prices_sync',
  'checkout_fix',
  'run_test',
  'restart_service',
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
  '.github/',
  'node_modules/',
]);
const PROPOSAL_TARGET_DENY_SUFFIXES = Object.freeze([
  '/deepseek-governor.js',
  '/deepseek-loop.js',
  '/deepseek-loop.service',
  'package.json',
  'package-lock.json',
]);

// Roadmap location (read-write via roadmap_update action) / Locația roadmap-ului
const ROADMAP_PATH = process.env.DEEPSEEK_GOVERNOR_ROADMAP_PATH
                  || path.join(__dirname, '..', '..', 'data', 'roadmap.json');

// Operator command queue (consumed by the deepseek-loop) / Coada de comenzi operator
const COMMAND_QUEUE_PATH = process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_PATH
                        || path.join(__dirname, '..', '..', 'data', 'deepseek-commands.jsonl');
const COMMAND_QUEUE_MAX_ENTRIES = parseInt(process.env.DEEPSEEK_GOVERNOR_COMMAND_QUEUE_MAX || '200', 10);

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

function _action_run_test() {
  return new Promise((resolve) => {
    // Sandbox: spawn npm test with NO shell, NO inherited stdin, hard
    // timeout, captured stdout/stderr truncated. The child cannot escalate
    // because it's started with the parent's uid/gid (whatever the unicorn
    // user has) and shell=false prevents command injection.
    // În sandbox: spawn fără shell, timeout dur, ieșire trunchiată.
    const cwd = path.resolve(__dirname, '..', '..');
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn('npm', ['test', '--silent'], {
      cwd,
      env: { ...process.env, NODE_ENV: 'test', CI: '1' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) { /* noop */ }
      resolve({
        ok: false,
        action: 'run_test',
        reason: 'timeout',
        timeoutMs: RUN_TEST_TIMEOUT_MS,
        stdoutTail: stdout.slice(-2000),
        stderrTail: stderr.slice(-2000),
      });
    }, RUN_TEST_TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); if (stdout.length > 50000) stdout = stdout.slice(-40000); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); if (stderr.length > 50000) stderr = stderr.slice(-40000); });
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, action: 'run_test', reason: 'spawn_error', error: String(e && e.message || e).slice(0, 200) });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        action: 'run_test',
        exitCode: code,
        stdoutTail: stdout.slice(-2000),
        stderrTail: stderr.slice(-2000),
      });
    });
  });
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
      case 'prices_sync':     result = await _action_prices_sync(); break;
      case 'checkout_fix':    result = await _action_checkout_fix(); break;
      case 'run_test':        result = await _action_run_test(); break;
      case 'restart_service': result = _action_restart_service(params); break;
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
    paths: { logPath: LOG_PATH, proposalsDir: PROPOSALS_DIR, roadmapPath: ROADMAP_PATH, commandQueuePath: COMMAND_QUEUE_PATH },
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
