// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
// Tests for the LOCAL disaster-recovery backend (zero-cost backups to a
// sibling directory on the same host).
// Covers: backup → list → restore (dry-run) → restore (real) → rotation.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

(async () => {
  // Isolate test data under tmp so we never touch real ledgers.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-local-'));
  const dataDir = path.join(tmp, 'data');
  const backupDir = path.join(tmp, 'backups');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'commerce'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'a.txt'), 'hello-a');
  fs.writeFileSync(path.join(dataDir, 'commerce', 'b.jsonl'), '{"x":1}\n');

  // Configure the module via env BEFORE require so _config() reads the right paths.
  process.env.DR_BACKEND = 'local';
  process.env.DR_LOCAL_DIR = backupDir;
  process.env.DR_DATA_DIR = dataDir;
  process.env.DR_RETENTION_DAYS = '7';
  process.env.DR_INTERVAL_MS = '3600000'; // 1h, never fires during the test
  process.env.DR_AUTOPILOT_ENABLED = '0'; // do not arm cron during unit test

  // Re-require with a clean cache so the env above is honored.
  delete require.cache[require.resolve('../backend/modules/disaster-recovery')];
  const dr = require('../backend/modules/disaster-recovery');

  // 1) backupLocal succeeds and creates a .json.gz file.
  const b1 = await dr.backupLocal();
  assert.strictEqual(b1.ok, true, 'backupLocal should succeed: ' + JSON.stringify(b1));
  assert.strictEqual(b1.backend, 'local');
  assert.ok(fs.existsSync(b1.file), 'backup file should exist on disk: ' + b1.file);
  assert.ok(b1.files >= 2, 'should archive at least the 2 fixture files');
  console.log('[ok] backupLocal · file=' + path.basename(b1.file) + ' · files=' + b1.files + ' · bytes=' + b1.compressedBytes);

  // 2) listLocalBackups returns the new file.
  const list1 = dr.listLocalBackups();
  assert.strictEqual(list1.ok, true);
  assert.strictEqual(list1.count, 1);
  console.log('[ok] listLocalBackups · count=' + list1.count);

  // 3) restoreFromLocal dry-run reports correct file count without writing anything.
  const r1 = await dr.restoreFromLocal({ dryRun: true });
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.dryRun, true);
  assert.strictEqual(r1.restored, 0);
  assert.strictEqual(r1.files, b1.files);
  console.log('[ok] restoreFromLocal dry-run · files=' + r1.files);

  // 4) restoreFromLocal real run writes files into a fresh directory.
  const restoreTarget = path.join(tmp, 'restored');
  const r2 = await dr.restoreFromLocal({ dryRun: false, restoreDir: restoreTarget });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.restored, b1.files);
  assert.strictEqual(fs.readFileSync(path.join(restoreTarget, 'a.txt'), 'utf8'), 'hello-a');
  assert.strictEqual(fs.readFileSync(path.join(restoreTarget, 'commerce', 'b.jsonl'), 'utf8'), '{"x":1}\n');
  console.log('[ok] restoreFromLocal real · restored=' + r2.restored);

  // 5) Rotation prunes files whose mtime is older than retentionDays.
  // Force-age the existing backup by 30 days, then run a second backup.
  const oldPath = b1.file;
  const ancient = Date.now() - 30 * 24 * 3600 * 1000;
  fs.utimesSync(oldPath, ancient / 1000, ancient / 1000);
  const b2 = await dr.backupLocal();
  assert.strictEqual(b2.ok, true);
  assert.ok(b2.rotated >= 1, 'should rotate at least the 30-day-old file, got ' + b2.rotated);
  assert.ok(!fs.existsSync(oldPath), 'aged-out backup should be deleted');
  assert.ok(fs.existsSync(b2.file), 'new backup should exist');
  console.log('[ok] rotation · rotated=' + b2.rotated + ' (older than ' + process.env.DR_RETENTION_DAYS + 'd)');

  // 6) getStatus reports the local backend correctly.
  const st = dr.getStatus();
  assert.strictEqual(st.backend, 'local');
  assert.strictEqual(st.localDir, backupDir);
  assert.strictEqual(st.credentialsConfigured, true, 'local backend has no creds requirement');
  assert.strictEqual(typeof st.localBackupsCount, 'number');
  console.log('[ok] getStatus · backend=' + st.backend + ' · count=' + st.localBackupsCount);

  // 7) processFn auto-routes to local when DR_BACKEND=local.
  const auto = await dr.process({ action: 'backup' });
  assert.strictEqual(auto.ok, true);
  assert.strictEqual(auto.backend, 'local', 'processFn(action=backup) should route to local');
  console.log('[ok] processFn auto-routes to local');

  // Cleanup
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('[disaster-recovery-local.test.js] all assertions passed');
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
