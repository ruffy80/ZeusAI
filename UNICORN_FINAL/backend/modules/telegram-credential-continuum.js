'use strict';

/**
 * TCC/1.0 — Telegram Credential Continuum
 *
 * Problem: bot/chat keys live under many aliases (TELEGRAM_*, TG_*, ZAC_*,
 * ZEUS_TG_*) and on durable sanctum planes (/var/www/unicorn/shared/.env,
 * /etc/zeusai/secrets/*). Modules that only read one name silently no-op.
 *
 * Invention: one sanctum reload + alias mirror that fills every accepted
 * name from the first real value found — never logs values.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'TCC/1.0';

const TOKEN_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'TG_BOT_TOKEN',
  'ZAC_TELEGRAM_TOKEN',
  'ZEUS_TG_BOT_TOKEN',
];

const OWNER_CHAT_KEYS = [
  'TELEGRAM_CHAT_ID',
  'TG_CHAT_ID',
  'ZAC_TELEGRAM_CHAT_ID',
  'TELEGRAM_OWNER_CHAT_ID',
];

const GROUP_CHAT_KEYS = [
  'ZEUS_TG_GROUP_CHAT_ID',
  'TELEGRAM_GROUP_CHAT_ID',
  'TELEGRAM_CHAT_ID',
  'TG_CHAT_ID',
  'ZAC_TELEGRAM_CHAT_ID',
];

const ALL_KEYS = [...new Set([...TOKEN_KEYS, ...OWNER_CHAT_KEYS, ...GROUP_CHAT_KEYS])];

const PLACEHOLDER_RX = /^(your[_-].*|changeme|todo|placeholder|example|xxxx+|\*+|none|null|undefined|n\/a|tbd|skip|<.*>|YOUR_TELEGRAM)/i;

let _lastReload = {
  at: null,
  restored: 0,
  mirrored: 0,
  filesScanned: 0,
  tokenArmed: false,
  ownerChatArmed: false,
  groupChatArmed: false,
};

function _strip(v) {
  return String(v == null ? '' : v).trim().replace(/^['"]|['"]$/g, '').trim();
}

function isRealSecret(value) {
  const v = _strip(value);
  if (v.length < 5) return false;
  if (PLACEHOLDER_RX.test(v)) return false;
  if (/(your[_-]?|changeme|placeholder|example|xxxx|\.\.\.)/i.test(v)) return false;
  return true;
}

function sanctumFiles() {
  if (process.env.TCC_SANCTUM_FILE) {
    return [String(process.env.TCC_SANCTUM_FILE)];
  }
  const root = path.join(__dirname, '..', '..');
  const repoRoot = path.join(root, '..');
  const files = [
    path.join(root, '.env'),
    path.join(root, '.env.local'),
    path.join(repoRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    '/var/www/unicorn/shared/.env',
    '/etc/zeusai/social.env',
    '/etc/zeusai/secrets/telegram.env',
    '/etc/zeusai/secrets/social.env',
  ];
  try {
    const dir = '/etc/zeusai/secrets';
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.env')) continue;
        files.push(path.join(dir, name));
      }
    }
  } catch (_) { /* non-fatal */ }
  return [...new Set(files)];
}

function _firstArmed(keys) {
  for (const k of keys) {
    if (isRealSecret(process.env[k])) return _strip(process.env[k]);
  }
  return '';
}

function _mirror(keys, value) {
  if (!isRealSecret(value)) return 0;
  let n = 0;
  for (const k of keys) {
    if (!isRealSecret(process.env[k])) {
      process.env[k] = value;
      n += 1;
    }
  }
  return n;
}

/**
 * Load telegram secrets from sanctum planes into process.env, then mirror
 * aliases so every module sees a consistent armed set.
 * Never logs secret values.
 */
function reloadFromSanctum() {
  let restored = 0;
  let filesScanned = 0;
  for (const file of sanctumFiles()) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (_) {
      continue;
    }
    filesScanned += 1;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!ALL_KEYS.includes(key)) continue;
      const val = _strip(line.slice(eq + 1));
      if (!isRealSecret(val)) continue;
      if (!isRealSecret(process.env[key])) {
        process.env[key] = val;
        restored += 1;
      }
    }
  }

  const token = _firstArmed(TOKEN_KEYS);
  const ownerChat = _firstArmed(OWNER_CHAT_KEYS);
  const groupChat = _firstArmed(GROUP_CHAT_KEYS) || ownerChat;

  let mirrored = 0;
  mirrored += _mirror(TOKEN_KEYS, token);
  mirrored += _mirror(OWNER_CHAT_KEYS, ownerChat);
  // Prefer a dedicated group id; else fall back to owner chat so money posts still fire.
  mirrored += _mirror(['ZEUS_TG_GROUP_CHAT_ID', 'TELEGRAM_GROUP_CHAT_ID'], groupChat);

  _lastReload = {
    at: new Date().toISOString(),
    restored,
    mirrored,
    filesScanned,
    tokenArmed: !!token,
    ownerChatArmed: !!ownerChat,
    groupChatArmed: !!groupChat,
  };
  return Object.assign({}, _lastReload);
}

function ensureArmed() {
  if (!_lastReload.at) reloadFromSanctum();
  else if (!_lastReload.tokenArmed || (!_lastReload.ownerChatArmed && !_lastReload.groupChatArmed)) {
    reloadFromSanctum();
  }
  return snapshot();
}

function snapshot() {
  const token = !!_firstArmed(TOKEN_KEYS);
  const owner = !!_firstArmed(OWNER_CHAT_KEYS);
  const group = !!_firstArmed(GROUP_CHAT_KEYS);
  return {
    ok: true,
    protocol: PROTOCOL,
    tokenArmed: token,
    ownerChatArmed: owner,
    groupChatArmed: group,
    readyForOwnerAlert: !!(token && owner),
    readyForGroupMoney: !!(token && group),
    lastReload: Object.assign({}, _lastReload),
    honesty: 'Attests presence only — never exposes token or chat id values.',
  };
}

function token() {
  ensureArmed();
  return _firstArmed(TOKEN_KEYS);
}

function ownerChatId() {
  ensureArmed();
  return _firstArmed(OWNER_CHAT_KEYS);
}

function groupChatId() {
  ensureArmed();
  return _firstArmed(GROUP_CHAT_KEYS) || _firstArmed(OWNER_CHAT_KEYS);
}

module.exports = {
  PROTOCOL,
  TOKEN_KEYS,
  OWNER_CHAT_KEYS,
  GROUP_CHAT_KEYS,
  ALL_KEYS,
  isRealSecret,
  sanctumFiles,
  reloadFromSanctum,
  ensureArmed,
  snapshot,
  token,
  ownerChatId,
  groupChatId,
};
