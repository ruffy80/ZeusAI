# `.deploy/` — GitHub-independent Out-of-Band (OOB) deploy channel

This directory holds the trust material and public key for the **OOB deploy
channel** — a signed, canary-gated way to push `origin/main` (or any ref) to the
live box when **GitHub Actions is unavailable** (e.g. billing-locked) and the
on-server poller is stuck.

## Components

| Piece | Where | Role |
|---|---|---|
| Signed HTTP trigger | `backend/modules/oob-deploy.js` → `POST /api/oob-deploy` | Verifies an HMAC-SHA256 or Ed25519 signed request, replay- & freshness-protected, then launches the runner. |
| Runner | `scripts/oob-deploy-runner.sh` | Pulls the exact ref over **public** GitHub HTTPS, builds a clean release, hands it to the canary+smoke-gated `deploy-atomic-forward.sh`. |
| Poller resuscitator | `scripts/zeus-poller-resuscitate.sh` | One-shot console recovery: clears the kill-switch, deploys `origin/main`, re-enables the `zeus-autodeploy.timer`, optionally installs a deploy pubkey. |
| Trusted keys | `.deploy/oob-trusted-keys.txt` | Ed25519 public keys allowed to sign OOB requests. |
| Cursor deploy key | `.deploy/cursor-cloud-deploy_key.pub` | Public half of the current Cursor Cloud agent deploy key, for authorized_keys bootstrap. |

## Enabling the channel (fail-closed by default)

The endpoint is inert until at least one of these is configured in the live
`.env` (under `/var/www/unicorn/shared/.env`):

```bash
# HMAC shared-secret path
ZEUS_OOB_DEPLOY_SECRET=<long-random-secret>

# …and/or the Ed25519 path — list operator public keys in
# .deploy/oob-trusted-keys.txt (committed) or inline:
ZEUS_OOB_DEPLOY_ED25519_PUB="ssh-ed25519 AAAA... operator"
```

## Triggering a deploy (HMAC example)

```bash
SECRET='...'                                   # ZEUS_OOB_DEPLOY_SECRET
BODY=$(printf '{"ref":"origin/main","ts":%s,"nonce":"%s"}' \
        "$(date +%s000)" "$(openssl rand -hex 16)")
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)
curl -sS -X POST https://zeusai.pro/api/oob-deploy \
  -H "Content-Type: application/json" \
  -H "X-Zeus-Deploy-Signature: sha256=$SIG" \
  --data "$BODY"
# → 202 { ok, deployId, ... }.  Poll:  curl -s https://zeusai.pro/api/oob-deploy/status
```

The signature covers the **exact request body bytes**; `ts` (ms, ±300s window)
and a one-time `nonce` prevent replay. A bad ref fails closed inside the canary
gate — the live symlink only moves after health + quantum-integrity + smoke pass.
