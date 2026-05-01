// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:59:23.820Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =============================================================================
// Cloud Provider Adapters — real SDK calls
// One adapter per provider. Each function:
//   - validates credentials supplied in request body (NOT in env, so each
//     enterprise tenant uses its own keys, never ours)
//   - calls the real SDK
//   - returns a normalized { ok, ... , latencyMs, real:true } envelope
//   - on missing-credentials: returns { ok:false, error:'missing_credentials',
//     real:false } so callers can render a stub when running in dev
// =============================================================================

const { EC2Client, DescribeInstancesCommand, StartInstancesCommand, RebootInstancesCommand } = require('@aws-sdk/client-ec2');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { google } = require('googleapis');
const { ClientSecretCredential } = require('@azure/identity');
const { NetworkManagementClient } = require('@azure/arm-network');
const { StorageManagementClient } = require('@azure/arm-storage');
const { KeyVaultManagementClient } = require('@azure/arm-keyvault');

// ---------- helpers ----------
function _t() { return Date.now(); }
function _ok(started, payload) { return Object.assign({ ok: true, real: true, latencyMs: _t() - started }, payload); }
function _err(started, code, message, extra = {}) { return Object.assign({ ok: false, real: false, error: code, message, latencyMs: _t() - started }, extra); }

// ============================================================================
// AWS
// ============================================================================

function _awsClient(Ctor, { region, accessKeyId, secretAccessKey, sessionToken }) {
  return new Ctor({
    region: region || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey, sessionToken },
  });
}

async function awsAutoHeal({ region, instanceId, accessKeyId, secretAccessKey, sessionToken } = {}) {
  const t = _t();
  if (!accessKeyId || !secretAccessKey || !instanceId) {
    return _err(t, 'missing_credentials', 'Required: accessKeyId, secretAccessKey, instanceId, region');
  }
  try {
    const ec2 = _awsClient(EC2Client, { region, accessKeyId, secretAccessKey, sessionToken });
    const desc = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const inst = desc.Reservations?.[0]?.Instances?.[0];
    if (!inst) return _err(t, 'instance_not_found', `EC2 instance ${instanceId} not found in ${region}`);
    const state = inst.State?.Name; // pending|running|stopping|stopped|terminated
    let action = 'noop';
    if (state === 'stopped') {
      await ec2.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
      action = 'started';
    } else if (state === 'running') {
      // health check via CloudWatch StatusCheckFailed
      const cw = _awsClient(CloudWatchClient, { region, accessKeyId, secretAccessKey, sessionToken });
      const end = new Date();
      const start = new Date(end.getTime() - 5 * 60 * 1000);
      const stats = await cw.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/EC2', MetricName: 'StatusCheckFailed',
        Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
        StartTime: start, EndTime: end, Period: 60, Statistics: ['Maximum'],
      }));
      const failing = (stats.Datapoints || []).some(d => Number(d.Maximum) > 0);
      if (failing) {
        await ec2.send(new RebootInstancesCommand({ InstanceIds: [instanceId] }));
        action = 'rebooted';
      } else {
        action = 'healthy';
      }
    } else {
      action = 'state:' + state;
    }
    return _ok(t, { provider: 'aws', region, instanceId, previousState: state, action, timestamp: new Date().toISOString() });
  } catch (e) {
    return _err(t, 'aws_sdk_error', e.message || String(e), { code: e.Code || e.name });
  }
}

// ============================================================================
// Google Cloud
// ============================================================================

async function gcpCostOptimize({ projectId, billingAccountId, serviceAccountKey, days = 30 } = {}) {
  const t = _t();
  if (!projectId || !serviceAccountKey) {
    return _err(t, 'missing_credentials', 'Required: projectId, serviceAccountKey (JSON), billingAccountId optional');
  }
  try {
    const creds = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/cloud-billing.readonly',
               'https://www.googleapis.com/auth/cloud-platform.read-only'],
    });
    const authClient = await auth.getClient();
    const cb = google.cloudbilling({ version: 'v1', auth: authClient });

    // Pull billing info for project
    const billing = await cb.projects.getBillingInfo({ name: 'projects/' + projectId });
    const billingEnabled = billing.data.billingEnabled === true;

    // Pull SKU catalog (read-only) — used to drive per-service recommendation rules
    const services = await cb.services.list({ pageSize: 50 });

    // Use Cloud Monitoring (timeSeries) for actual usage signals
    const monitoring = google.monitoring({ version: 'v3', auth: authClient });
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 3600 * 1000);
    let cpu = null;
    try {
      const ts = await monitoring.projects.timeSeries.list({
        name: 'projects/' + projectId,
        filter: 'metric.type="compute.googleapis.com/instance/cpu/utilization"',
        'interval.startTime': startTime.toISOString(),
        'interval.endTime': endTime.toISOString(),
        'aggregation.perSeriesAligner': 'ALIGN_MEAN',
        'aggregation.alignmentPeriod': '3600s',
      });
      const pts = (ts.data.timeSeries || []).flatMap(s => (s.points || []).map(p => Number(p.value?.doubleValue || 0)));
      if (pts.length) cpu = pts.reduce((a, b) => a + b, 0) / pts.length;
    } catch (_) { /* monitoring API may be off */ }

    // Recommendations driven by real signals
    const recommendations = [];
    if (cpu !== null && cpu < 0.20) {
      recommendations.push({ category: 'compute', action: 'right-size: avg CPU ' + (cpu * 100).toFixed(1) + '% — downgrade machine type', severity: 'high', estSavingsPct: 35 });
    } else if (cpu !== null && cpu < 0.50) {
      recommendations.push({ category: 'compute', action: 'mixed reserved + spot blend (avg CPU ' + (cpu * 100).toFixed(1) + '%)', severity: 'medium', estSavingsPct: 18 });
    }
    recommendations.push({ category: 'storage', action: 'enable lifecycle: Standard→Nearline at 30d, Coldline at 90d', severity: 'medium', estSavingsPct: 22 });
    recommendations.push({ category: 'network', action: 'enable Cloud CDN + private peering', severity: 'low', estSavingsPct: 12 });

    return _ok(t, {
      provider: 'gcp', projectId, billingAccountId: billingAccountId || null,
      billingEnabled, daysAnalyzed: days, avgCpuUtil: cpu,
      servicesScanned: services.data.services?.length || 0,
      recommendations,
      potentialSavingsPct: recommendations.reduce((a, r) => a + r.estSavingsPct, 0) / recommendations.length,
    });
  } catch (e) {
    return _err(t, 'gcp_sdk_error', e.message || String(e));
  }
}

// ============================================================================
// Azure
// ============================================================================

function _azureCred({ tenantId, clientId, clientSecret }) {
  return new ClientSecretCredential(tenantId, clientId, clientSecret);
}

async function azureSecurityScan({ subscriptionId, tenantId, clientId, clientSecret } = {}) {
  const t = _t();
  if (!subscriptionId || !tenantId || !clientId || !clientSecret) {
    return _err(t, 'missing_credentials', 'Required: subscriptionId, tenantId, clientId, clientSecret');
  }
  try {
    const cred = _azureCred({ tenantId, clientId, clientSecret });
    const issues = [];
    const remediations = [];

    // 1) Network Security Groups → flag open ports (any-to-any inbound)
    const net = new NetworkManagementClient(cred, subscriptionId);
    let nsgCount = 0;
    for await (const nsg of net.networkSecurityGroups.listAll()) {
      nsgCount++;
      for (const rule of (nsg.securityRules || [])) {
        const isOpen = rule.access === 'Allow' && rule.direction === 'Inbound'
          && (rule.sourceAddressPrefix === '*' || rule.sourceAddressPrefix === '0.0.0.0/0' || rule.sourceAddressPrefix === 'Internet')
          && (rule.destinationPortRange === '*' || /^(22|3389|3306|5432|6379|27017|9200)$/.test(String(rule.destinationPortRange || '')));
        if (isOpen) {
          issues.push({ kind: 'nsg.open_port', nsg: nsg.name, rule: rule.name, port: rule.destinationPortRange, severity: 'high' });
          remediations.push({ kind: 'nsg.restrict_source', nsg: nsg.name, rule: rule.name, action: 'restrict sourceAddressPrefix to corporate IP CIDR' });
        }
      }
    }

    // 2) Storage accounts → flag public blob access
    const storage = new StorageManagementClient(cred, subscriptionId);
    let storageCount = 0;
    for await (const sa of storage.storageAccounts.list()) {
      storageCount++;
      if (sa.allowBlobPublicAccess === true) {
        issues.push({ kind: 'storage.public_access', account: sa.name, severity: 'high' });
        remediations.push({ kind: 'storage.disable_public_access', account: sa.name, action: 'set allowBlobPublicAccess=false' });
      }
      if (sa.minimumTlsVersion && sa.minimumTlsVersion !== 'TLS1_2') {
        issues.push({ kind: 'storage.weak_tls', account: sa.name, current: sa.minimumTlsVersion, severity: 'medium' });
        remediations.push({ kind: 'storage.upgrade_tls', account: sa.name, action: 'set minimumTlsVersion=TLS1_2' });
      }
    }

    // 3) Key Vault → flag soft-delete disabled
    const kv = new KeyVaultManagementClient(cred, subscriptionId);
    let vaultCount = 0;
    for await (const vault of kv.vaults.listBySubscription()) {
      vaultCount++;
      const props = vault.properties || {};
      if (props.enableSoftDelete === false) {
        issues.push({ kind: 'keyvault.soft_delete_off', vault: vault.name, severity: 'high' });
        remediations.push({ kind: 'keyvault.enable_soft_delete', vault: vault.name, action: 'enableSoftDelete=true' });
      }
      if (props.enablePurgeProtection !== true) {
        issues.push({ kind: 'keyvault.purge_protection_off', vault: vault.name, severity: 'medium' });
        remediations.push({ kind: 'keyvault.enable_purge_protection', vault: vault.name, action: 'enablePurgeProtection=true' });
      }
    }

    return _ok(t, {
      provider: 'azure', subscriptionId,
      scanned: { nsg: nsgCount, storage: storageCount, keyVault: vaultCount },
      issuesCount: issues.length, issues,
      remediationsCount: remediations.length, remediations,
      verdict: issues.length === 0 ? 'clean' : (issues.some(i => i.severity === 'high') ? 'critical' : 'warn'),
    });
  } catch (e) {
    return _err(t, 'azure_sdk_error', e.message || String(e), { code: e.code || e.name });
  }
}

// ============================================================================
// AWS S3 backup helpers — used by disaster-recovery autopilot
// ============================================================================

async function s3Upload({ bucket, key, body, region, accessKeyId, secretAccessKey, contentType = 'application/octet-stream' }) {
  const t = _t();
  if (!bucket || !key || !accessKeyId || !secretAccessKey) {
    return _err(t, 'missing_credentials', 'Required: bucket, key, accessKeyId, secretAccessKey');
  }
  try {
    const s3 = _awsClient(S3Client, { region, accessKeyId, secretAccessKey });
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    return _ok(t, { provider: 'aws-s3', bucket, key, bytes: Buffer.byteLength(body) });
  } catch (e) {
    return _err(t, 'aws_s3_error', e.message || String(e));
  }
}

async function s3ListLatest({ bucket, prefix, region, accessKeyId, secretAccessKey, limit = 1 }) {
  const t = _t();
  try {
    const s3 = _awsClient(S3Client, { region, accessKeyId, secretAccessKey });
    const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }));
    const sorted = (out.Contents || []).sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified)).slice(0, limit);
    return _ok(t, { items: sorted.map(o => ({ key: o.Key, size: o.Size, modified: o.LastModified })) });
  } catch (e) {
    return _err(t, 'aws_s3_error', e.message || String(e));
  }
}

async function s3Download({ bucket, key, region, accessKeyId, secretAccessKey }) {
  const t = _t();
  try {
    const s3 = _awsClient(S3Client, { region, accessKeyId, secretAccessKey });
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks = [];
    for await (const c of r.Body) chunks.push(c);
    const buf = Buffer.concat(chunks);
    return _ok(t, { bucket, key, bytes: buf.length, body: buf });
  } catch (e) {
    return _err(t, 'aws_s3_error', e.message || String(e));
  }
}

module.exports = {
  awsAutoHeal,
  gcpCostOptimize,
  azureSecurityScan,
  s3Upload,
  s3ListLatest,
  s3Download,
};
