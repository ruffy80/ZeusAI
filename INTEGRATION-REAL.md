# 🌐 Real Cloud Integration — DELIVERY

**Owner:** Vladoi Ionut · **BTC:** `bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e` · **Email:** vladoi_ionut@yahoo.com
**Date:** 2026-05-01 · **Scope:** Replace stub enterprise modules with real AWS / Google / Azure SDK calls.

---

## 1. SDKs installed (verified `require()` loads)

```
@aws-sdk/client-ec2          ^3.1040.0
@aws-sdk/client-cloudwatch   ^3.1040.0
@aws-sdk/client-s3           ^3.1040.0
googleapis                   ^144
@azure/identity              ^4.13.1
@azure/arm-monitor           ^7.0.0
@azure/arm-network           ^33.5.0
@azure/arm-storage           ^18.6.0
@azure/arm-keyvault          ^4.0.0
```

All 9 packages load without errors (verified locally with `node -e "require(p)"` for each).

---

## 2. Real adapter — [backend/modules/cloud-providers.js](UNICORN_FINAL/backend/modules/cloud-providers.js)

Each adapter:
- accepts credentials in the **request body** (per-tenant, never our env)
- calls the real SDK
- returns a normalized envelope `{ ok, real:true|false, latencyMs, ... }`
- on missing credentials: returns `{ ok:false, real:false, error:'missing_credentials' }`
  so the platform stays usable in dev / preview without keys.

### 2.1 AWS Auto-Healer — `awsAutoHeal({ region, instanceId, accessKeyId, secretAccessKey, sessionToken })`

Implements:
1. `EC2Client.DescribeInstancesCommand` — reads instance state.
2. If `state === 'stopped'` → `StartInstancesCommand` (action: `started`).
3. If `state === 'running'` → CloudWatch `GetMetricStatisticsCommand` for `AWS/EC2 / StatusCheckFailed` over last 5 min:
   - If any failure datapoint > 0 → `RebootInstancesCommand` (action: `rebooted`).
   - Else → action: `healthy`.
4. Returns `{ ok, real:true, provider:'aws', region, instanceId, previousState, action, timestamp, latencyMs }`.

Wired at: `POST /api/enterprise/aws/auto-heal` in [backend/modules/enterprise-cloud-router.js](UNICORN_FINAL/backend/modules/enterprise-cloud-router.js#L165-L177).

### 2.2 Google Cost Optimizer — `gcpCostOptimize({ projectId, billingAccountId, serviceAccountKey, days })`

Implements:
1. `google.auth.GoogleAuth` with scopes `cloud-billing.readonly` + `cloud-platform.read-only`.
2. `cloudbilling.projects.getBillingInfo` — confirms billing-enabled flag.
3. `cloudbilling.services.list` — counts SKUs in scope.
4. `monitoring.projects.timeSeries.list` for metric `compute.googleapis.com/instance/cpu/utilization` over last N days (default 30) with `ALIGN_MEAN, alignmentPeriod=3600s`.
5. Drives recommendations off real CPU mean:
   - avg CPU < 20% → `right-size: downgrade machine type` (estSavingsPct: 35)
   - 20–50% → `mixed reserved + spot blend` (estSavingsPct: 18)
   - Always: `lifecycle Standard→Nearline→Coldline` (22%) and `Cloud CDN + private peering` (12%).
6. Returns `{ ok, real:true, provider:'gcp', projectId, billingEnabled, daysAnalyzed, avgCpuUtil, servicesScanned, recommendations[], potentialSavingsPct }`.

Wired at: `POST /api/enterprise/gcp/cost-optimize` in [enterprise-cloud-router.js#L179-L191](UNICORN_FINAL/backend/modules/enterprise-cloud-router.js#L179-L191).

### 2.3 Azure Security Bot — `azureSecurityScan({ subscriptionId, tenantId, clientId, clientSecret })`

Implements:
1. `ClientSecretCredential` from `@azure/identity`.
2. `NetworkManagementClient.networkSecurityGroups.listAll()` → flags inbound rules with `sourceAddressPrefix ∈ {*, 0.0.0.0/0, Internet}` AND port ∈ {22, 3389, 3306, 5432, 6379, 27017, 9200, *} → severity:high.
3. `StorageManagementClient.storageAccounts.list()` → flags `allowBlobPublicAccess === true` (high) and `minimumTlsVersion !== 'TLS1_2'` (medium).
4. `KeyVaultManagementClient.vaults.listBySubscription()` → flags `enableSoftDelete === false` (high) and `enablePurgeProtection !== true` (medium).
5. Returns `{ ok, real:true, provider:'azure', subscriptionId, scanned: { nsg, storage, keyVault }, issuesCount, issues[], remediationsCount, remediations[], verdict: 'clean'|'warn'|'critical' }`.

Wired at: `POST /api/enterprise/azure/security-scan` in [enterprise-cloud-router.js#L193-L205](UNICORN_FINAL/backend/modules/enterprise-cloud-router.js#L193-L205).

---

## 3. Disaster Recovery Autopilot — [backend/modules/disaster-recovery.js](UNICORN_FINAL/backend/modules/disaster-recovery.js)

Replaces the previous 25-line stub (`_state` + `console.log`).

### 3.1 `backupToS3()`
1. Walks `process.env.DR_DATA_DIR || ../data` recursively (skips dotfiles, node_modules, files > 200 MB).
2. Builds JSON archive `{ meta, files: [{rel, size, sha256, content_b64}] }`.
3. Gzips + uploads via real `S3Client.PutObjectCommand` to `s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}backup-<ISO>.json.gz`.
4. Returns `{ ok, real, bucket, key, files, totalBytes, compressedBytes, sha256, durationMs }`.

### 3.2 `restoreFromBackup({ key?, dryRun=true, restoreDir? })`
1. If no `key`, uses `S3Client.ListObjectsV2Command` to find the most recent backup under `DR_S3_PREFIX`.
2. Downloads via `GetObjectCommand`, gunzips, parses.
3. If `dryRun=false`, writes every file under `restoreDir || data.restore-<ts>/`.
4. Returns `{ ok, real, bucket, key, files, restored, dryRun, errors[] }`.

### 3.3 24h Cron
- `startCron()` arms a `setInterval(backupToS3, DR_INTERVAL_MS || 24*3600*1000)`.
- Auto-arms on import iff `DR_AUTOPILOT_ENABLED=1`.
- Logs each backup result; safe `unref()` so it doesn't hold the event loop in tests.

### 3.4 Required env vars (set on Hetzner host to activate)

```
DR_AUTOPILOT_ENABLED=1
DR_S3_BUCKET=unicorn-dr-prod
DR_S3_PREFIX=backups/
DR_S3_REGION=eu-central-1
DR_AWS_ACCESS_KEY_ID=AKIA...
DR_AWS_SECRET_ACCESS_KEY=...
```

Without these set, the autopilot stays disarmed and `getStatus().bucket=null`. **No surprise egress.**

---

## 4. Stripe Webhook (real, signature-verified) — `POST /webhooks/stripe`

Added to [backend/index.js](UNICORN_FINAL/backend/index.js#L7847-L7918) alongside the existing `/api/payment/webhook/stripe`.

- Raw-body parser registered at line 168.
- Verifies `stripe-signature` HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`.
- In production: rejects with 401 if secret missing; in dev: warns + accepts.
- Handles three event types:

| Event | Effect |
|---|---|
| `checkout.session.completed` (paid) | `enterprise.subscriptions.create()` (30-day, autoRenew=true), `dbUsers.setPlanId`, `emailService.sendPaymentConfirmation`, audit `subscription.activated.stripe` |
| `invoice.paid` | audit `subscription.invoice.paid` with `{ subId, amount }` |
| `customer.subscription.deleted` | `enterprise.subscriptions.cancel` for all active org subs, audit `subscription.cancelled.stripe` |

Returns `{ ok, eventType, handled, ... }` for observability.

---

## 5. OpenAPI updated

3 new entries (real-integration paths) added to `/api/enterprise/openapi.json`:
- `/api/enterprise/aws/auto-heal` — schema with `region, instanceId, accessKeyId, secretAccessKey, sessionToken?`.
- `/api/enterprise/gcp/cost-optimize` — schema with `projectId, billingAccountId?, serviceAccountKey, days?`.
- `/api/enterprise/azure/security-scan` — schema with `subscriptionId, tenantId, clientId, clientSecret`.

OpenAPI now exposes **67 paths**.

---

## 6. Tests

Added [test/cloud-providers.test.js](UNICORN_FINAL/test/cloud-providers.test.js) which validates without any cloud account:

```
[ok] awsAutoHeal: missing_credentials path
[ok] awsAutoHeal: SDK error path · err=aws_sdk_error
[ok] gcpCostOptimize: missing_credentials path
[ok] azureSecurityScan: missing_credentials path
[ok] s3Upload: missing_credentials path
[ok] disaster-recovery getStatus: {"cronArmed":false,"bucket":null}
[ok] disaster-recovery backupToS3 error path · err=no_bucket
```

Wired into `npm test` (full suite still green).

---

## 7. How to verify with a real account (Pasul 7 — owner action)

Because this code uses **client-supplied credentials per request**, no key needs to be deployed for the platform to work. To prove end-to-end with real accounts:

```bash
# AWS — needs an EC2 instance
curl -X POST https://zeusai.pro/api/enterprise/aws/auto-heal \
  -H "x-api-key: $UNK" -H "content-type: application/json" \
  -d '{"region":"eu-central-1","instanceId":"i-01234567abcdef","accessKeyId":"AKIA…","secretAccessKey":"…"}'
# Expect: {"ok":true,"real":true,"action":"healthy|rebooted|started","latencyMs":...}

# GCP — needs project + service account JSON
curl -X POST https://zeusai.pro/api/enterprise/gcp/cost-optimize \
  -H "x-api-key: $UNK" -H "content-type: application/json" \
  -d '{"projectId":"my-proj","serviceAccountKey":<JSON>,"days":30}'
# Expect: {"ok":true,"real":true,"avgCpuUtil":0.X,"recommendations":[…]}

# Azure — needs subscription + service principal
curl -X POST https://zeusai.pro/api/enterprise/azure/security-scan \
  -H "x-api-key: $UNK" -H "content-type: application/json" \
  -d '{"subscriptionId":"…","tenantId":"…","clientId":"…","clientSecret":"…"}'
# Expect: {"ok":true,"real":true,"scanned":{"nsg":N,"storage":N,"keyVault":N},"issues":[…],"verdict":"clean|warn|critical"}
```

The cloud SDK will return real `aws_sdk_error / gcp_sdk_error / azure_sdk_error` with the provider's own error code if creds are wrong — this is the contract that proves real integration.

---

## 8. What this changes vs the stub era

| Behaviour | Before | Now |
|---|---|---|
| `aws/auto-heal` | logged a no-op event in memory | real EC2 reboot / start + CloudWatch health check |
| `gcp/cost-optimize` | hard-coded formula | reads real Cloud Billing + CPU utilization, drives savings off measured load |
| `azure/security-scan` | did not exist | scans NSG, Storage, Key Vault, returns concrete remediations |
| Disaster recovery | 25-line stub | gzipped archive → S3, restore from latest, 24h cron |
| Stripe webhook | one path tied to legacy schema | clean `/webhooks/stripe`, signature-verified, activates `enterprise.subscriptions`, audit + email |
| Cloud SDKs | none in `package.json` | 9 (AWS x3, GCP x1, Azure x4 + identity) |

The Unicorn now has a **real revenue-bearing surface** for cloud-buying customers. Every endpoint that says `real:true` did a live SDK call.
