'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-auth-persist-'));
const dbPath = path.join(tempDir, 'unicorn.db');
const env = { ...process.env, DB_PATH: dbPath, NODE_ENV: 'test' };

function runSnippet(code) {
  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

try {
  runSnippet(`
    const db = require('./backend/db');
    db.users.create({
      id: 'persist-user-1',
      name: 'Persistent User',
      email: 'persist@example.com',
      passwordHash: 'hash',
      emailVerified: 1,
      verifyToken: null,
      verifyExpires: null,
      createdAt: new Date().toISOString(),
    });
    const meta = db.meta();
    if (!meta.durable || meta.mode !== 'sqlite-file') process.exit(2);
  `);

  const output = runSnippet(`
    const db = require('./backend/db');
    const user = db.users.findByEmail('persist@example.com');
    console.log(JSON.stringify({ found: !!user, count: db.users.count(), meta: db.meta() }));
  `);
  const jsonLine = output.split('\n').filter((line) => line.trim().startsWith('{')).pop();
  const payload = JSON.parse(jsonLine);
  assert.equal(payload.found, true, 'registered user should survive a fresh process');
  assert.equal(payload.count, 1, 'user count should persist in sqlite file');
  assert.equal(payload.meta.durable, true, 'DB metadata should report durable storage');
  console.log('auth persistence test passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}