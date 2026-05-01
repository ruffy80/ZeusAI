# Production secrets — current state & action items

**Last updated:** 2026-05-01  
**Mandate:** "pasul 7 cu chei reale + setarea env-urilor pe Hetzner"

---

## ✅ What I automated

| # | Task | Status |
|---|---|---|
| 1 | nginx route `/webhooks/` → backend:3000 | ✅ deployed |
| 2 | Stripe webhook endpoint reachable at `https://zeusai.pro/webhooks/stripe` | ✅ live (returns `webhook_secret_missing` 401 — correct) |
| 3 | `/root/unicorn-final/UNICORN_FINAL/.env.local` created (chmod 600) | ✅ on Hetzner |
| 4 | `DR_AUTOPILOT_ENABLED=0` written (safe disarm — no log spam from missing creds) | ✅ on Hetzner |
| 5 | Idempotent secrets-sync script `scripts/sync-secrets-to-hetzner.sh` | ✅ in repo |
| 6 | Format validation (whsec_*, AKIA*, bucket name regex) — refuses to push junk | ✅ |
| 7 | Refuses to set `DR_AUTOPILOT_ENABLED=1` unless **all three** AWS fields validate | ✅ |
| 8 | Zero-downtime pm2 reload + post-write env verification via `/proc/<pid>/environ` | ✅ |

## ❌ What I cannot automate (physical-world boundary)

| Secret | Why I can't | Where to get it |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | Issued by Stripe when you register the endpoint. Cannot be invented. | Stripe Dashboard → Developers → Webhooks → Add endpoint → URL `https://zeusai.pro/webhooks/stripe` → events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.{created,updated,deleted}` → copy `whsec_…` |
| `DR_S3_BUCKET` | Bucket creation requires AWS Console with your 2FA. | AWS Console → S3 → Create bucket → name `zeus-dr-backups-<your-suffix>` (eu-central-1, block public, versioning ON, SSE-S3) |
| `DR_AWS_ACCESS_KEY_ID` + `DR_AWS_SECRET_ACCESS_KEY` | IAM key creation requires your AWS root/admin login. | AWS Console → IAM → Users → `zeus-dr-backup-bot` → inline policy: `s3:PutObject,GetObject,ListBucket,DeleteObject` on the bucket created above → access keys |

These three will take you **~10 minutes total** in the dashboards.

---

## 🚀 The 3-step procedure for arming everything

```bash
# 1. Copy the template (gitignored, never committed)
cp .env.secrets.local.example .env.secrets.local

# 2. Edit .env.secrets.local — paste the 4 values from Stripe Dashboard + AWS Console
#    Keep DR_AUTOPILOT_ENABLED=1

# 3. Push to Hetzner (idempotent, safe to re-run any time)
bash scripts/sync-secrets-to-hetzner.sh
```

The script will:
- Validate every value's format (refuses junk).
- Refuse to arm `DR_AUTOPILOT_ENABLED=1` unless all three AWS fields validate.
- Write `/root/unicorn-final/UNICORN_FINAL/.env.local` with `chmod 600`.
- `pm2 reload all --update-env` (zero downtime).
- Read `/proc/<backend-pid>/environ` to **prove** the new env was picked up.

After it runs successfully:

```bash
# Verify Stripe webhook is now signature-checked (should reject bad sigs with 401 invalid_signature)
curl -s -X POST https://zeusai.pro/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1,v1=deadbeef" \
  -d '{"id":"evt_test","type":"checkout.session.completed"}'

# Manual DR backup trigger (optional — autopilot will fire within 24h)
ssh -i ~/.ssh/hetzner_rsa root@204.168.230.142 \
  "cd /root/unicorn-final/UNICORN_FINAL && node -e \"require('./backend/modules/disaster-recovery').backupToS3().then(r=>console.log(r))\""
```

---

## 🔍 Live verification right now

```
$ curl -s -X POST https://zeusai.pro/webhooks/stripe -H "Content-Type: application/json" -d '{}'
{"ok":false,"error":"webhook_secret_missing"}     ← HTTP 401, correct (endpoint live, awaiting secret)

$ ssh root@hetzner 'cat /root/unicorn-final/UNICORN_FINAL/.env.local'
DR_AUTOPILOT_ENABLED=0                            ← safe default until creds exist
```

Everything is wired. The remaining 10 minutes of dashboard work are entirely on you and entirely outside my reach.
