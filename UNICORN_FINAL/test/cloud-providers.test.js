'use strict';
// =============================================================================
// Cloud-providers smoke test.
// Validates that the SDK adapters:
//   1) load with all 9 cloud SDKs
//   2) return a structured `missing_credentials` error when no keys provided
//   3) hit the SDK error path cleanly when given fake creds (no network)
// No real AWS/GCP/Azure account required.
// =============================================================================

const assert = require('assert');
const cloud = require('../backend/modules/cloud-providers');
const dr = require('../backend/modules/disaster-recovery');

(async function run() {
  // ---- AWS auto-heal: missing credentials --------------------------------
  let r = await cloud.awsAutoHeal({});
  assert.strictEqual(r.ok, false, 'aws missing creds → ok=false');
  assert.strictEqual(r.error, 'missing_credentials', 'aws error code');
  assert.strictEqual(r.real, false, 'aws real=false on stub');
  console.log('[ok] awsAutoHeal: missing_credentials path');

  // ---- AWS auto-heal: SDK error path (fake creds, no network) -----------
  r = await cloud.awsAutoHeal({ region: 'us-east-1', instanceId: 'i-00000000', accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake' });
  assert.strictEqual(r.ok, false, 'aws fake creds → ok=false');
  assert.ok(['aws_sdk_error', 'instance_not_found'].includes(r.error), 'aws sdk-error code: ' + r.error);
  console.log('[ok] awsAutoHeal: SDK error path · err=' + r.error);

  // ---- GCP cost-optimize: missing credentials -----------------------------
  r = await cloud.gcpCostOptimize({});
  assert.strictEqual(r.ok, false, 'gcp missing creds → ok=false');
  assert.strictEqual(r.error, 'missing_credentials', 'gcp error code');
  console.log('[ok] gcpCostOptimize: missing_credentials path');

  // ---- Azure security-scan: missing credentials ---------------------------
  r = await cloud.azureSecurityScan({});
  assert.strictEqual(r.ok, false, 'azure missing creds → ok=false');
  assert.strictEqual(r.error, 'missing_credentials', 'azure error code');
  console.log('[ok] azureSecurityScan: missing_credentials path');

  // ---- S3 helpers: missing credentials ------------------------------------
  r = await cloud.s3Upload({ bucket: 'b', key: 'k', body: Buffer.from('x') });
  assert.strictEqual(r.ok, false, 's3 missing creds → ok=false');
  assert.strictEqual(r.error, 'missing_credentials', 's3 error code');
  console.log('[ok] s3Upload: missing_credentials path');

  // ---- Disaster recovery autopilot: status & no-bucket path --------------
  const st = dr.getStatus();
  assert.strictEqual(st.name, 'disaster-recovery', 'dr name');
  assert.ok(typeof st.cronArmed === 'boolean', 'dr cronArmed flag');
  console.log('[ok] disaster-recovery getStatus: ' + JSON.stringify({ cronArmed: st.cronArmed, bucket: st.bucket }));

  r = await dr.backupToS3({});
  assert.strictEqual(r.ok, false, 'dr backup w/o bucket → ok=false');
  assert.ok(['no_bucket', 'no_credentials', 'sdk_missing'].includes(r.error), 'dr error code: ' + r.error);
  console.log('[ok] disaster-recovery backupToS3 error path · err=' + r.error);

  console.log('\n[cloud-providers.test.js] all assertions passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
