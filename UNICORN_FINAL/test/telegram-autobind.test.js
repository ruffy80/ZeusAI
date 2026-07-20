#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  extractBindCandidate,
  canPostFromMember,
  formatChatRef,
  upsertEnv,
  readEnvFile,
  chatRank,
} = require('../scripts/zeus-telegram-autobind');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('✓', name);
}

(async () => {
  await check('canPostFromMember · creator/admin with post', () => {
    assert.strictEqual(canPostFromMember({ status: 'creator' }), true);
    assert.strictEqual(canPostFromMember({ status: 'administrator', can_post_messages: true }), true);
    assert.strictEqual(canPostFromMember({ status: 'administrator', can_post_messages: false }), false);
    assert.strictEqual(canPostFromMember({ status: 'member' }), false);
  });

  await check('extractBindCandidate · my_chat_member channel admin', () => {
    const u = {
      my_chat_member: {
        chat: { id: -1001, type: 'channel', username: 'unicorn_platform', title: 'Unicorn' },
        new_chat_member: { status: 'administrator', can_post_messages: true },
      },
    };
    const c = extractBindCandidate(u);
    assert.ok(c);
    assert.strictEqual(c.chat.id, -1001);
    assert.strictEqual(c.prefer, true);
  });

  await check('extractBindCandidate · private /bind', () => {
    const u = {
      message: {
        message_id: 9,
        chat: { id: 42, type: 'private', first_name: 'Owner' },
        text: '/bind',
      },
    };
    const c = extractBindCandidate(u);
    assert.ok(c);
    assert.strictEqual(c.chat.id, 42);
    assert.strictEqual(c.replyCommand, true);
  });

  await check('extractBindCandidate · ignores unrelated private chatter', () => {
    const u = {
      message: {
        message_id: 1,
        chat: { id: 42, type: 'private' },
        text: 'hello bot',
      },
    };
    assert.strictEqual(extractBindCandidate(u), null);
  });

  await check('formatChatRef + chatRank prefer unicorn_platform', () => {
    assert.strictEqual(formatChatRef({ id: 1, username: 'x' }), '@x');
    assert.strictEqual(formatChatRef({ id: -9 }), '-9');
    assert.ok(chatRank({ id: 1, type: 'channel', username: 'unicorn_platform' }) >
      chatRank({ id: 2, type: 'channel', username: 'other' }));
  });

  await check('upsertEnv / readEnvFile round-trip', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-bind-'));
    const file = path.join(dir, '.env');
    fs.writeFileSync(file, 'FOO=1\nTELEGRAM_CHAT_ID=@old\n');
    upsertEnv(file, { TELEGRAM_CHAT_ID: '-100', TG_CHAT_ID: '-100', NEW_KEY: 'x' });
    const env = readEnvFile(file);
    assert.strictEqual(env.TELEGRAM_CHAT_ID, '-100');
    assert.strictEqual(env.TG_CHAT_ID, '-100');
    assert.strictEqual(env.NEW_KEY, 'x');
    assert.strictEqual(env.FOO, '1');
  });

  console.log('\n✅ telegram-autobind:', passed, 'tests passed');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
